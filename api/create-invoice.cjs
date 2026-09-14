/* ============================================================
   Vercel Serverless Function — Create Invoice Duitku
   CommonJS (.cjs) — credential dibaca dari Supabase tabel settings
   Endpoint: POST /api/create-invoice
============================================================ */

const crypto = require('crypto');

/* ============================================================
   AMBIL CREDENTIAL DUITKU DARI SUPABASE
============================================================ */
async function getDuitkuConfig() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  console.log('[DEBUG] SUPABASE_URL:', SUPABASE_URL);
  console.log('[DEBUG] KEY length:', SUPABASE_SERVICE_KEY?.length);
  console.log('[DEBUG] KEY prefix:', SUPABASE_SERVICE_KEY?.slice(0, 15));

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Server env vars missing');
  }

  const url = `${SUPABASE_URL}/rest/v1/settings?select=key,value&key=in.(duitku_merchant_code,duitku_api_key,duitku_env)`;
  console.log('[DEBUG] Fetch URL:', url);

  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });

  console.log('[DEBUG] Response status:', res.status);
  const responseText = await res.text();
  console.log('[DEBUG] Response body:', responseText);

  if (!res.ok) {
    throw new Error(`Gagal baca settings: HTTP ${res.status} - ${responseText}`);
  }

  let rows;
  try {
    rows = JSON.parse(responseText);
  } catch (e) {
    throw new Error('Response bukan JSON: ' + responseText);
  }

  const config = {};
  rows.forEach(r => { config[r.key] = r.value; });

  if (!config.duitku_merchant_code || !config.duitku_api_key) {
    throw new Error('Credential Duitku belum di-set di admin panel');
  }

  return {
    merchantCode: config.duitku_merchant_code,
    apiKey: config.duitku_api_key,
    env: config.duitku_env || 'sandbox'
  };
}

/* ============================================================
   HANDLER
============================================================ */
module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Cuma terima POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Vercel otomatis parse JSON body buat CommonJS
    const {
      merchantOrderId,
      paymentAmount,
      productDetails,
      email,
      phoneNumber,
      customerVaName,
      items,
      returnUrl,
      callbackUrl,
      expiryPeriod = 60
    } = req.body || {};

    // Validasi
    if (!merchantOrderId || !paymentAmount || !email) {
      return res.status(400).json({ error: 'Data tidak lengkap' });
    }

    // Ambil credential dari Supabase
    const { merchantCode, apiKey, env } = await getDuitkuConfig();

    // Tentukan base URL Duitku
    const baseUrl = env === 'production'
      ? 'https://api-prod.duitku.com'
      : 'https://api-sandbox.duitku.com';

    // Generate signature HMAC SHA256
    // Formula: HMAC_SHA256(merchantCode + timestamp, apiKey)
    const timestamp = Date.now().toString();
    const stringToSign = merchantCode + timestamp;
    const signature = crypto
      .createHmac('sha256', apiKey)
      .update(stringToSign)
      .digest('hex');

    console.log('[DEBUG] Timestamp:', timestamp);
    console.log('[DEBUG] Signature:', signature);
    console.log('[DEBUG] Merchant Code:', merchantCode);
    console.log('[DEBUG] Env:', env);

    // Build payload sesuai dokumentasi Duitku
    const payload = {
      paymentAmount: Math.round(paymentAmount),
      merchantOrderId,
      productDetails,
      email,
      phoneNumber: phoneNumber || '',
      customerVaName: customerVaName || email.split('@')[0],
      itemDetails: (items || []).map(i => ({
        name: i.product,
        price: i.price,
        quantity: i.qty
      })),
      customerDetail: {
        firstName: customerVaName || 'Customer',
        lastName: '',
        email,
        phoneNumber: phoneNumber || ''
      },
      callbackUrl,
      returnUrl,
      expiryPeriod
    };

    console.log('[DEBUG] Payload:', JSON.stringify(payload));

    // POST ke Duitku API
    const duitkuRes = await fetch(`${baseUrl}/api/merchant/createInvoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-duitku-signature': signature,
        'x-duitku-timestamp': timestamp,
        'x-duitku-merchantcode': merchantCode
      },
      body: JSON.stringify(payload)
    });

    const duitkuData = await duitkuRes.json();
    console.log('[DEBUG] Duitku response:', JSON.stringify(duitkuData));

    // Cek response
    if (!duitkuRes.ok || duitkuData.statusCode !== '00') {
      console.error('Duitku error:', duitkuData);
      return res.status(duitkuRes.status || 500).json({
        error: duitkuData.statusMessage || 'Gagal create invoice',
        detail: duitkuData
      });
    }

    // Return ke frontend
    return res.status(200).json({
      reference: duitkuData.reference,
      paymentUrl: duitkuData.paymentUrl,
      statusCode: duitkuData.statusCode,
      statusMessage: duitkuData.statusMessage
    });

  } catch (err) {
    console.error('[ERROR] Server error:', err.message);
    console.error('[ERROR] Stack:', err.stack);
    return res.status(500).json({ error: err.message });
  }
};

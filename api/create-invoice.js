/* ============================================================
   Vercel Serverless Function — Create Invoice Duitku
   POST /api/create-invoice
============================================================ */

const crypto = require('crypto');

// ============================================================
// SUPABASE — baca credential dari tabel settings
// ============================================================
async function getDuitkuConfig() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase env vars missing');
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/settings?select=key,value&key=in.(duitku_merchant_code,duitku_api_key,duitku_env)`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }
  );

  if (!res.ok) throw new Error('Gagal baca settings dari Supabase');

  const rows = await res.json();
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

// ============================================================
// HANDLER
// ============================================================
module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
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
    } = req.body;

    // Validasi
    if (!merchantOrderId || !paymentAmount || !email) {
      return res.status(400).json({ error: 'Data tidak lengkap' });
    }

    // Ambil credential dari Supabase
    const { merchantCode, apiKey, env } = await getDuitkuConfig();

    // Tentukan endpoint
    const baseUrl = env === 'production'
      ? 'https://api-prod.duitku.com'
      : 'https://api-sandbox.duitku.com';

    // Generate signature (HMAC SHA256)
    const timestamp = Date.now().toString();
    const stringToSign = merchantCode + timestamp;
    const signature = crypto
      .createHmac('sha256', apiKey)
      .update(stringToSign)
      .digest('hex');

    // Build payload
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

    // POST ke Duitku
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

    if (!duitkuRes.ok || duitkuData.statusCode !== '00') {
      console.error('Duitku error:', duitkuData);
      return res.status(duitkuRes.status).json({
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
    console.error('Server error:', err);
    return res.status(500).json({ error: err.message });
  }
};

/* ============================================================
   Vercel Serverless Function — Create Invoice Duitku
   ES Module (.js) — karena package.json punya "type": "module"
============================================================ */
import crypto from 'crypto';

/* ---------- AMBIL CREDENTIAL DARI SUPABASE ---------- */
async function getDuitkuConfig() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  console.log('[DEBUG] SUPABASE_URL:', SUPABASE_URL);
  console.log('[DEBUG] KEY length:', SUPABASE_SERVICE_KEY?.length);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Server env vars missing');
  }

  const url = `${SUPABASE_URL}/rest/v1/settings?select=key,value&key=in.(duitku_merchant_code,duitku_api_key,duitku_env)`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });

  console.log('[DEBUG] Supabase status:', res.status);
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Gagal baca settings: HTTP ${res.status} - ${text}`);
  }

  const rows = JSON.parse(text);
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

/* ---------- HANDLER ---------- */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Parse body manual (antisipasi ESM gak auto-parse)
    let body = req.body;
    if (!body || typeof body === 'string') {
      // Baca stream manual
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString();
      try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
    }

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
    } = body;

    if (!merchantOrderId || !paymentAmount || !email) {
      return res.status(400).json({ error: 'Data tidak lengkap' });
    }

    const { merchantCode, apiKey, env } = await getDuitkuConfig();

    const baseUrl = env === 'production'
      ? 'https://api-prod.duitku.com'
      : 'https://api-sandbox.duitku.com';

    const timestamp = Date.now().toString();
    const stringToSign = merchantCode + timestamp;
    const signature = crypto
      .createHmac('sha256', apiKey)
      .update(stringToSign)
      .digest('hex');

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

    if (!duitkuRes.ok || duitkuData.statusCode !== '00') {
      return res.status(duitkuRes.status || 500).json({
        error: duitkuData.statusMessage || 'Gagal create invoice',
        detail: duitkuData
      });
    }

    return res.status(200).json({
      reference: duitkuData.reference,
      paymentUrl: duitkuData.paymentUrl,
      statusCode: duitkuData.statusCode,
      statusMessage: duitkuData.statusMessage
    });

  } catch (err) {
    console.error('[ERROR]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

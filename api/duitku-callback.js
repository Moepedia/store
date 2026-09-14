/* ============================================================
   Vercel Serverless Function — Callback Duitku
   POST /api/duitku-callback
============================================================ */

const crypto = require('crypto');

async function getApiKey() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/settings?select=value&key=eq.duitku_api_key`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }
  );
  const rows = await res.json();
  return rows[0]?.value;
}

async function updateOrderStatus(orderId, status, reference) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      status,
      duitku_reference: reference,
      updated_at: new Date().toISOString()
    })
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    // Duitku kirim x-www-form-urlencoded
    const body = req.body || {};

    const merchantCode = body.merchantCode;
    const amount = body.amount;
    const merchantOrderId = body.merchantOrderId;
    const resultCode = body.resultCode;
    const reference = body.reference;
    const signature = body.signature;

    if (!merchantCode || !amount || !merchantOrderId || !signature) {
      return res.status(400).send('Bad Parameter');
    }

    const apiKey = await getApiKey();
    if (!apiKey) return res.status(500).send('API key not configured');

    // Verifikasi signature
    const stringToSign = merchantCode + amount + merchantOrderId;
    const calcSignature = crypto
      .createHmac('sha256', apiKey)
      .update(stringToSign)
      .digest('hex');

    if (signature !== calcSignature) {
      console.error('Bad signature');
      return res.status(403).send('Bad Signature');
    }

    // Update status order
    // resultCode: '00' = success, '01' = failed
    const status = resultCode === '00' ? 'paid' : 'cancelled';
    await updateOrderStatus(merchantOrderId, status, reference);

    return res.status(200).send('OK');

  } catch (err) {
    console.error('Callback error:', err);
    return res.status(500).send('Error');
  }
};

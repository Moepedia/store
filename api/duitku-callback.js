/* ============================================================
   Vercel Serverless Function — Duitku Callback
   ES Module (.js)
============================================================ */
import crypto from 'crypto';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    // Parse body (Duitku kirim x-www-form-urlencoded)
    let body = req.body;
    if (!body || typeof body === 'string') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString();
      const params = new URLSearchParams(raw);
      body = {};
      params.forEach((v, k) => { body[k] = v; });
    }

    const { merchantCode, amount, merchantOrderId, resultCode, reference, signature } = body;

    if (!merchantCode || !amount || !merchantOrderId || !signature) {
      return res.status(400).send('Bad Parameter');
    }

    const apiKey = await getApiKey();
    if (!apiKey) return res.status(500).send('API key not configured');

    const stringToSign = merchantCode + amount + merchantOrderId;
    const calcSignature = crypto
      .createHmac('sha256', apiKey)
      .update(stringToSign)
      .digest('hex');

    if (signature !== calcSignature) {
      return res.status(403).send('Bad Signature');
    }

    const status = resultCode === '00' ? 'paid' : 'cancelled';
    await updateOrderStatus(merchantOrderId, status, reference);

    return res.status(200).send('OK');

  } catch (err) {
    console.error('[ERROR]', err.message);
    return res.status(500).send('Error');
  }
}

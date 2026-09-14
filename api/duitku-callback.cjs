/* ============================================================
   Vercel Serverless Function — Duitku Callback
   CommonJS (.cjs)
   Endpoint: POST /api/duitku-callback
   Duitku bakal POST ke sini setelah user bayar
============================================================ */

const crypto = require('crypto');

/* ============================================================
   AMBIL API KEY DARI SUPABASE
============================================================ */
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

/* ============================================================
   UPDATE STATUS ORDER DI SUPABASE
============================================================ */
async function updateOrderStatus(orderId, status, reference) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
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

  console.log('[DEBUG] Update order status:', res.status);
  return res.ok;
}

/* ============================================================
   HANDLER
============================================================ */
module.exports = async (req, res) => {
  // Cuma terima POST
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    // Duitku kirim x-www-form-urlencoded
    const body = req.body || {};
    console.log('[DEBUG] Callback body:', JSON.stringify(body));

    const {
      merchantCode,
      amount,
      merchantOrderId,
      resultCode,
      reference,
      signature
    } = body;

    // Validasi parameter wajib
    if (!merchantCode || !amount || !merchantOrderId || !signature) {
      console.error('[ERROR] Bad Parameter:', body);
      return res.status(400).send('Bad Parameter');
    }

    // Ambil API key dari Supabase
    const apiKey = await getApiKey();
    if (!apiKey) {
      console.error('[ERROR] API key not configured');
      return res.status(500).send('API key not configured');
    }

    // Verifikasi signature
    // Formula: HMAC_SHA256(merchantCode + amount + merchantOrderId, apiKey)
    const stringToSign = merchantCode + amount + merchantOrderId;
    const calcSignature = crypto
      .createHmac('sha256', apiKey)
      .update(stringToSign)
      .digest('hex');

    console.log('[DEBUG] Received signature:', signature);
    console.log('[DEBUG] Calculated signature:', calcSignature);

    if (signature !== calcSignature) {
      console.error('[ERROR] Bad signature');
      return res.status(403).send('Bad Signature');
    }

    // Update status order
    // resultCode: '00' = success, '01' = failed
    const status = resultCode === '00' ? 'paid' : 'cancelled';
    console.log('[DEBUG] Updating order', merchantOrderId, 'to', status);

    const ok = await updateOrderStatus(merchantOrderId, status, reference);
    if (!ok) {
      console.error('[ERROR] Failed to update order');
      return res.status(500).send('Failed to update order');
    }

    console.log('[SUCCESS] Callback processed for', merchantOrderId);
    return res.status(200).send('OK');

  } catch (err) {
    console.error('[ERROR] Callback error:', err.message);
    console.error('[ERROR] Stack:', err.stack);
    return res.status(500).send('Error');
  }
};

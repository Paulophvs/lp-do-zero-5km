// Server-side Meta Conversions API (CAPI) — evento Contact (clique que vai pro WhatsApp).
// Mesmo padrao do api/lead.js: token na env da Vercel (META_CAPI_TOKEN), mesmo Pixel ID.
// O browser dispara fbq('track','Contact', {}, {eventID}) e chama aqui com o MESMO event_id.
// A Meta usa esse id pra deduplicar (conta 1 evento, nao 2).
const crypto = require('crypto');

const PIXEL_ID = '1803401826472530';
const GRAPH = 'https://graph.facebook.com/v21.0';

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }));
  }
  const token = process.env.META_CAPI_TOKEN;
  if (!token) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: 'token ausente' }));
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const eventId = body.event_id || crypto.randomUUID();
  const canal = String(body.canal || 'direto').slice(0, 40);
  const assunto = String(body.assunto || 'padrao').slice(0, 40);

  const fwd = req.headers['x-forwarded-for'] || '';
  const ip = fwd.split(',')[0].trim() || req.socket?.remoteAddress || '';
  const ua = req.headers['user-agent'] || '';

  // Sem form aqui: o match vem de ip/user-agent + cookies do proprio Pixel (fbp/fbc).
  const userData = {
    client_ip_address: ip || undefined,
    client_user_agent: ua || undefined,
    fbp: body.fbp || undefined,
    fbc: body.fbc || undefined,
  };

  const payload = {
    ...(body.test_event_code ? { test_event_code: body.test_event_code } : {}),
    data: [
      {
        event_name: 'Contact',
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_source_url: body.source_url || req.headers['referer'] || 'https://www.phcorridas.com/whats',
        event_id: eventId,
        user_data: userData,
        custom_data: {
          content_name: 'clique-whatsapp',
          canal: canal,
          assunto: assunto,
        },
      },
    ],
  };

  try {
    const r = await fetch(`${GRAPH}/${PIXEL_ID}/events?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const out = await r.json();
    if (!r.ok) {
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, meta: out }));
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, event_id: eventId, meta: out }));
  } catch (err) {
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: String(err) }));
  }
};

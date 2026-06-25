// Server-side Meta Conversions API (CAPI) — evento Lead.
// Recebe o submit do form e dispara o evento pelo SERVIDOR (nao pelo browser).
// Token vem da env da Vercel (META_CAPI_TOKEN). Pixel ID abaixo.
const crypto = require('crypto');

const PIXEL_ID = '1803401826472530';
const GRAPH = 'https://graph.facebook.com/v21.0';

function sha256(v) {
  return crypto.createHash('sha256').update(v).digest('hex');
}
// Normaliza e hasheia conforme exigencia da Meta (lowercase, trim).
function hashEmail(e) {
  if (!e) return null;
  return sha256(String(e).trim().toLowerCase());
}
function hashName(n) {
  if (!n) return null;
  return sha256(String(n).trim().toLowerCase());
}
function hashPhone(p) {
  if (!p) return null;
  let d = String(p).replace(/\D/g, '');
  if (!d) return null;
  if (!d.startsWith('55')) d = '55' + d; // E.164 sem '+', padrao BR
  return sha256(d);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
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

  const nome = (body.nome || '').trim();
  const email = (body.email || '').trim();
  const telefone = (body.telefone || '').trim();
  const eventId = (body.event_id || crypto.randomUUID());

  const fwd = req.headers['x-forwarded-for'] || '';
  const ip = fwd.split(',')[0].trim() || req.socket?.remoteAddress || '';
  const ua = req.headers['user-agent'] || '';

  const userData = {
    em: email ? [hashEmail(email)] : undefined,
    ph: telefone ? [hashPhone(telefone)] : undefined,
    fn: nome ? [hashName(nome)] : undefined,
    client_ip_address: ip || undefined,
    client_user_agent: ua || undefined,
    fbp: body.fbp || undefined,
    fbc: body.fbc || undefined,
  };

  const payload = {
    // Se vier test_event_code, o evento aparece na aba "Eventos de Teste" do Gerenciador.
    ...(body.test_event_code ? { test_event_code: body.test_event_code } : {}),
    data: [
      {
        event_name: 'Lead',
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_source_url: body.source_url || req.headers['referer'] || 'https://www.phcorridas.com',
        event_id: eventId,
        user_data: userData,
        custom_data: { content_name: 'LP 5km do Zero', currency: 'BRL' },
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

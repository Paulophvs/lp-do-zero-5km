// Helper minimo pra Upstash Redis via REST API (sem SDK, sem package.json,
// mesmo padrao zero-dependencia do resto do /api).
const BASE = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

async function call(parts) {
  if (!BASE || !TOKEN) throw new Error('KV_REST_API_URL/TOKEN ausente');
  const url = BASE + '/' + parts.map((p) => encodeURIComponent(p)).join('/');
  const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const out = await r.json();
  if (!r.ok) throw new Error('redis error: ' + JSON.stringify(out));
  return out.result;
}

async function redisSet(key, value, ttlSeconds) {
  const v = JSON.stringify(value);
  if (ttlSeconds) return call(['set', key, v, 'EX', String(ttlSeconds)]);
  return call(['set', key, v]);
}

async function redisGet(key) {
  const out = await call(['get', key]);
  if (out === null || out === undefined) return null;
  try {
    return JSON.parse(out);
  } catch {
    return out;
  }
}

function normalizeEmail(e) {
  return String(e || '').trim().toLowerCase();
}

function pedidoKey(email) {
  return 'pedido:' + normalizeEmail(email);
}

module.exports = { redisSet, redisGet, normalizeEmail, pedidoKey };

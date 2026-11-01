// Helper minimo pra Upstash Redis via REST API (sem SDK, sem package.json,
// mesmo padrao zero-dependencia do resto do /api).
// 30/10: o banco antigo (KV_*) foi desinstalado na Vercel em 22/09 e parou de
// responder. O novo (pacepodio-pedidos) entrou com prefixo PEDIDOS_ para nao
// brigar com as variaveis velhas; KV_* fica so de reserva.
const BASE = process.env.PEDIDOS_KV_REST_API_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.PEDIDOS_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN;

async function call(parts) {
  if (!BASE || !TOKEN) throw new Error('KV_REST_API_URL/TOKEN ausente');
  // comando no corpo (POST com JSON), nao na URL: o plano do fortalecimento tem
  // dezenas de KB e estoura o limite de tamanho de URL
  const r = await fetch(BASE, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(parts),
  });
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

async function redisDel(key) {
  return call(['del', key]);
}

// contador com prazo (limite de tentativas de senha): devolve o valor novo
async function redisIncr(key, ttlSeconds) {
  const n = await call(['incr', key]);
  if (n === 1 && ttlSeconds) await call(['expire', key, String(ttlSeconds)]);
  return n;
}

function normalizeEmail(e) {
  return String(e || '').trim().toLowerCase();
}

function pedidoKey(email) {
  return 'pedido:' + normalizeEmail(email);
}

// acesso a area de membros: so o webhook da Hotmart grava aqui. Fica separado
// do pedido porque o salvar-pedido sobrescreve o pedido como "pendente" se a
// pessoa passar de novo pelo formulario.
function alunoKey(email) {
  return 'aluno:' + normalizeEmail(email);
}

// bonus do anual (fortalecimento, alimentacao) sao VITALICIOS (decisao do Paulo
// 30/10): essa chave e gravada sem prazo na primeira compra do anual
function bonusKey(email) {
  return 'bonus:' + normalizeEmail(email);
}

function fortalecimentoKey(email) {
  return 'fc:' + normalizeEmail(email);
}

// codigo do pedido (Paulo 01/11): vai no link da Hotmart (sck) e liga a compra ao
// formulario mesmo se a pessoa trocar o e-mail no checkout
function pedidoCodKey(cod) {
  return 'pedidocod:' + String(cod || '');
}

// dados novos de quem ja pagou e refez o formulario: so valem no proximo pagamento
function pedidoNovoKey(email) {
  return 'pedido-novo:' + normalizeEmail(email);
}

// mostra so o comeco e o dominio (jo***@gmail.com), para nao expor o e-mail inteiro
function mascararEmail(e) {
  const [u, d] = normalizeEmail(e).split('@');
  if (!u || !d) return '';
  return u.slice(0, 2) + '***@' + d;
}

// comando livre (ex.: SCAN do aviso diario das planilhas)
const redisCmd = call;

module.exports = { redisSet, redisGet, redisDel, redisIncr, redisCmd, normalizeEmail, pedidoKey, alunoKey, bonusKey, fortalecimentoKey,
  pedidoCodKey, pedidoNovoKey, mascararEmail };

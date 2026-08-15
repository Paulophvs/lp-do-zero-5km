// Salva o pedido do Pace Baixo como "pendente" antes de mandar pro checkout
// da Hotmart. E o webhook (hotmart-webhook.js) que vira o status pra "pago".
const { redisSet, pedidoKey, normalizeEmail } = require('./_redis');

const TTL_SEGUNDOS = 60 * 60 * 24 * 30; // 30 dias, tempo de sobra pra pagar

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const email = normalizeEmail(body.email);
  if (!email || !email.includes('@')) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'email invalido' }));
  }

  const pedido = {
    nome: String(body.nome || '').trim(),
    email,
    whatsapp: String(body.whatsapp || '').replace(/\D/g, ''),
    distancia: body.distancia,
    minutos: body.minutos,
    segundos: body.segundos,
    qtdDias: body.qtdDias,
    diasSemana: body.diasSemana || null,
    plano: body.plano === 'anual' ? 'anual' : 'mensal',
    status: 'pendente',
    criado_em: Date.now(),
  };

  try {
    await redisSet(pedidoKey(email), pedido, TTL_SEGUNDOS);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: String(err) }));
  }
};

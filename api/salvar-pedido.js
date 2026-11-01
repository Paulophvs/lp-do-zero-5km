// Salva o pedido do Pace Podio como "pendente" antes de mandar pro checkout
// da Hotmart. E o webhook (hotmart-webhook.js) que vira o status pra "pago".
// 01/11 (Paulo):
// - o navegador manda um codigo do pedido (cod), que tambem vai no link da Hotmart
//   (sck). Se a pessoa trocar o e-mail no checkout, o webhook acha o pedido pelo codigo;
// - quem ja pagou e refaz o formulario NAO perde a planilha: os dados novos ficam em
//   pedido-novo:<email> e so valem no proximo pagamento;
// - acao 'completar': pagamento confirmado sem os dados do treino (o codigo nao
//   chegou etc.). A pagina da planilha pergunta distancia, tempo e dias e grava aqui.
//   So funciona em pedido PAGO e SEM dados, entao ninguem troca a planilha de outro.
const { redisSet, redisGet, pedidoKey, pedidoCodKey, pedidoNovoKey, normalizeEmail } = require('./_redis');

const TTL_SEGUNDOS = 60 * 60 * 24 * 30; // 30 dias, tempo de sobra pra pagar
const TTL_PAGO = 60 * 60 * 24 * 400; // igual ao acesso (webhook)
const RECORDE = { 5: 12 * 60 + 35, 10: 26 * 60 + 11 };

function dadosTreino(b) {
  return {
    distancia: Number(b.distancia),
    minutos: Number(b.minutos),
    segundos: Number(b.segundos) || 0,
    qtdDias: Number(b.qtdDias),
    diasSemana: Array.isArray(b.diasSemana) ? b.diasSemana.map(Number) : [],
  };
}

// mesma trava do formulario (motor.js calcular/validarDias)
function treinoValido(d) {
  if (d.distancia !== 5 && d.distancia !== 10) return false;
  if (!Number.isInteger(d.minutos) || !Number.isInteger(d.segundos) || d.segundos < 0 || d.segundos > 59) return false;
  const seg = d.minutos * 60 + d.segundos;
  if (seg < RECORDE[d.distancia] || seg / 60 / d.distancia > 15) return false;
  const ds = d.diasSemana;
  if (!Number.isInteger(d.qtdDias) || d.qtdDias < 2 || d.qtdDias > 6 || ds.length !== d.qtdDias) return false;
  return new Set(ds).size === ds.length && ds.every((x) => Number.isInteger(x) && x >= 1 && x <= 7);
}

function responde(res, status, obj) {
  res.statusCode = status;
  return res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return responde(res, 405, { ok: false, error: 'metodo' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const email = normalizeEmail(body.email);
  if (!email || !email.includes('@')) return responde(res, 400, { ok: false, error: 'email invalido' });

  try {
    const existente = await redisGet(pedidoKey(email));

    if (body.acao === 'completar') {
      if (!existente || existente.status !== 'pago') return responde(res, 404, { ok: false, error: 'sem pagamento' });
      if (existente.distancia) return responde(res, 409, { ok: false, error: 'pedido ja tem dados' });
      const d = dadosTreino(body);
      if (!treinoValido(d)) return responde(res, 400, { ok: false, error: 'dados invalidos' });
      await redisSet(pedidoKey(email), { ...existente, ...d, completado_em: Date.now() }, TTL_PAGO);
      return responde(res, 200, { ok: true });
    }

    const cod = /^[A-Za-z0-9]{8,24}$/.test(String(body.cod || '')) ? String(body.cod) : null;
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
      cod,
    };

    if (existente && existente.status === 'pago') {
      // ja pagou: nao derruba a planilha atual; guarda os dados para o proximo pagamento
      await redisSet(pedidoNovoKey(email), pedido, TTL_SEGUNDOS);
      if (cod) await redisSet(pedidoCodKey(cod), { email, novo: true }, TTL_SEGUNDOS);
      return responde(res, 200, { ok: true, ja_pago: true });
    }

    await redisSet(pedidoKey(email), pedido, TTL_SEGUNDOS);
    if (cod) await redisSet(pedidoCodKey(cod), { email }, TTL_SEGUNDOS);
    return responde(res, 200, { ok: true });
  } catch (err) {
    return responde(res, 502, { ok: false, error: String(err) });
  }
};

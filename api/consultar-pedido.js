// Consulta o status do pedido (pendente/pago) pra pagina de obrigado do
// Pace Baixo decidir se ja pode mostrar a planilha ou se ainda espera o
// webhook da Hotmart confirmar o pagamento.
const { redisGet, pedidoKey, normalizeEmail } = require('./_redis');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  const email = normalizeEmail(req.query?.email);
  if (!email) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'email invalido' }));
  }

  try {
    const pedido = await redisGet(pedidoKey(email));
    if (!pedido) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ ok: false, error: 'pedido nao encontrado' }));
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, pedido }));
  } catch (err) {
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: String(err) }));
  }
};

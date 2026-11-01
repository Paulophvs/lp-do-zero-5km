// Consulta o status do pedido (pendente/pago) pra pagina de obrigado do
// Pace Podio decidir se ja pode mostrar a planilha ou se ainda espera o
// webhook da Hotmart confirmar o pagamento.
// 01/11 (Paulo, LGPD): devolve SO o que monta a planilha. Nunca nome, WhatsApp
// nem o e-mail inteiro de outra pessoa (quem digita um e-mail nao pode puxar os
// dados de um aluno). Quando a compra saiu com outro e-mail, devolve esse e-mail
// mascarado (jo***@gmail.com) para o aluno saber com qual entrar.
const { redisGet, pedidoKey, normalizeEmail, mascararEmail } = require('./_redis');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'metodo' }));
  }

  const email = normalizeEmail(req.query?.email);
  if (!email) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'email invalido' }));
  }

  try {
    const p = await redisGet(pedidoKey(email));
    if (!p) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ ok: false, error: 'pedido nao encontrado' }));
    }
    const pedido = {
      email,                                   // o mesmo que a pessoa digitou
      status: p.status,
      plano: p.plano,
      distancia: p.distancia,
      minutos: p.minutos,
      segundos: p.segundos,
      qtdDias: p.qtdDias,
      diasSemana: p.diasSemana,
      ciclo: p.ciclo,
      // pago sem os dados do treino: a pagina pergunta distancia, tempo e dias
      sem_dados: p.status === 'pago' && !p.distancia,
    };
    if (p.email_compra && normalizeEmail(p.email_compra) !== email) pedido.email_compra = mascararEmail(p.email_compra);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, pedido }));
  } catch (err) {
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: String(err) }));
  }
};

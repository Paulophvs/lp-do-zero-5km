// Diz se um e-mail tem acesso a area de membros (/pacepodio/treinos): plano
// ativo e se tem os bonus vitalicios do anual. So devolve plano e status, nunca nome nem WhatsApp.
const { redisGet, alunoKey, bonusKey, normalizeEmail } = require('./_redis');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'metodo' }));
  }

  const email = normalizeEmail(req.query?.email);
  if (!email || !email.includes('@')) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'email invalido' }));
  }

  try {
    const [aluno, bonus] = await Promise.all([redisGet(alunoKey(email)), redisGet(bonusKey(email))]);
    if (!aluno && !bonus) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ ok: false, error: 'sem compra' }));
    }
    // plano = assinatura ativa (null se venceu); bonus = vitalicio de quem ja comprou o anual
    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true,
      plano: aluno ? (aluno.plano === 'anual' ? 'anual' : 'mensal') : null,
      bonus: !!bonus || (!!aluno && aluno.plano === 'anual'),
    }));
  } catch (err) {
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: String(err) }));
  }
};

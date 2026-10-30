// Diz se um e-mail tem acesso a area de membros (/pacepodio/treinos) e qual
// plano. So devolve plano e status, nunca nome nem WhatsApp.
const { redisGet, alunoKey, normalizeEmail } = require('./_redis');

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
    const aluno = await redisGet(alunoKey(email));
    if (!aluno) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ ok: false, error: 'sem compra' }));
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, plano: aluno.plano === 'anual' ? 'anual' : 'mensal' }));
  } catch (err) {
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: String(err) }));
  }
};

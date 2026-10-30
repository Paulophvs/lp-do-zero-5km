// Guarda e devolve o plano do fortalecimento do aluno (avaliacao, plano pronto,
// semana atual e treinos feitos), para ele continuar em qualquer aparelho.
// So para quem comprou o anual (o fortalecimento e bonus vitalicio do anual).
const { redisGet, redisSet, alunoKey, bonusKey, fortalecimentoKey, normalizeEmail } = require('./_redis');

const TTL = 60 * 60 * 24 * 400;
const MAX_BYTES = 200 * 1024; // plano salvo tem ~20-60 KB

// bonus vitalicio: quem comprou o anual uma vez (chave bonus:) ou tem o anual ativo
async function anual(email) {
  const [bonus, aluno] = await Promise.all([redisGet(bonusKey(email)), redisGet(alunoKey(email))]);
  return !!bonus || (!!aluno && aluno.plano === 'anual');
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};
  const email = normalizeEmail(req.method === 'GET' ? req.query?.email : body.email);
  if (!email || !email.includes('@')) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'email invalido' }));
  }

  try {
    if (!(await anual(email))) {
      res.statusCode = 403;
      return res.end(JSON.stringify({ ok: false, error: 'sem plano anual' }));
    }

    if (req.method === 'GET') {
      const salvo = await redisGet(fortalecimentoKey(email));
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, salvo: salvo || null }));
    }

    if (req.method === 'POST') {
      const salvo = body.salvo;
      if (!salvo || salvo.v !== 1 || !salvo.resp) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ ok: false, error: 'plano invalido' }));
      }
      if (JSON.stringify(salvo).length > MAX_BYTES) {
        res.statusCode = 413;
        return res.end(JSON.stringify({ ok: false, error: 'plano grande demais' }));
      }
      // vale o mais recente pela data que o aparelho marcou: um aparelho
      // atrasado nao pode apagar o que o outro fez depois
      if (!Number.isFinite(salvo.atualizado)) salvo.atualizado = Date.now();
      const atual = await redisGet(fortalecimentoKey(email));
      if (atual && (atual.atualizado || 0) > salvo.atualizado) {
        res.statusCode = 409;
        return res.end(JSON.stringify({ ok: false, error: 'plano mais novo no banco', salvo: atual }));
      }
      await redisSet(fortalecimentoKey(email), salvo, TTL);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, atualizado: salvo.atualizado }));
    }

    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'metodo' }));
  } catch (err) {
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: String(err) }));
  }
};

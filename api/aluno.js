// Diz se um e-mail tem acesso a area de membros (/pacepodio/treinos): plano
// ativo e se tem os bonus vitalicios do anual. So devolve plano e status, nunca nome nem WhatsApp.
const { redisGet, alunoKey, bonusKey, normalizeEmail } = require('./_redis');

const DIA = 24 * 60 * 60 * 1000;
// validade conta do ultimo pagamento aprovado (cada renovacao da Hotmart manda
// um aviso novo e atualiza pago_em). Folga para a cobranca da renovacao entrar.
const PERIODO = { anual: 365 * DIA, mensal: 31 * DIA };
const FOLGA = { anual: 7 * DIA, mensal: 4 * DIA }; // mensal: 35 dias no total (Paulo 30/10)

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
    // plano = assinatura ativa (null se venceu); bonus = sem prazo para quem ja comprou o anual
    const tipo = aluno && aluno.plano === 'anual' ? 'anual' : 'mensal';
    const venceEm = aluno ? (aluno.vence_em || (aluno.pago_em ? aluno.pago_em + PERIODO[tipo] : null)) : null;
    const ativo = !!aluno && (!venceEm || Date.now() <= venceEm + FOLGA[tipo]);
    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true,
      plano: ativo ? tipo : null,
      ultimo_plano: aluno ? tipo : null,
      vence_em: venceEm,
      bonus: !!bonus || (!!aluno && aluno.plano === 'anual' && aluno.rec_pagas === undefined),
    }));
  } catch (err) {
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: String(err) }));
  }
};

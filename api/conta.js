// Conta do aluno na area de membros (30/10): criar senha, entrar, esqueci a
// senha, redefinir e sair. Tudo por POST com { acao, ... }.
// Regra do primeiro acesso (Paulo 30/10): quem pagou ha pouco cria a senha
// direto, sem e-mail (ele quer entrar na hora). Compra antiga ou aluno migrado
// sem senha so cria pelo link do e-mail: assim quem so sabe o e-mail de um
// aluno nao consegue tomar a conta dele.
const { redisGet, redisSet, redisDel, redisIncr, alunoKey, bonusKey, normalizeEmail } = require('./_redis');
const { senhaKey, sessaoKey, hashSenha, confereSenha, criarSessao, novoToken } = require('./_sessao');

const DIA = 24 * 60 * 60 * 1000;
const JANELA_CADASTRO = 30 * DIA; // cria a senha direto ate 30 dias depois do pagamento
const RESET_TTL = 60 * 60; // link do e-mail vale 1 hora
const MAX_TENTATIVAS = 10; // por e-mail a cada 15 minutos
const SENHA_MIN = 6;
const SITE = process.env.SITE_URL || 'https://phcorridas.com';

function resetKey(token) {
  return 'reset:' + token;
}

function responde(res, status, obj) {
  res.statusCode = status;
  return res.end(JSON.stringify(obj));
}

async function comprou(email) {
  const [aluno, bonus] = await Promise.all([redisGet(alunoKey(email)), redisGet(bonusKey(email))]);
  return { aluno, bonus, ok: !!aluno || !!bonus };
}

async function enviarEmailSenha(email, token, primeiro) {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) throw new Error('envio de e-mail nao configurado');
  const link = `${SITE}/pacepodio/treinos/?redefinir=${token}`;
  const titulo = primeiro ? 'Crie sua senha' : 'Redefina sua senha';
  const html = `<div style="font-family:Arial,sans-serif;font-size:16px;color:#1d1d1f;max-width:480px">
<p>Olá!</p>
<p>${primeiro ? 'Para acessar a sua área do aluno do Pace Pódio, crie a sua senha no botão abaixo.'
    : 'Recebemos um pedido para trocar a senha da sua área do aluno do Pace Pódio. Para criar uma senha nova, use o botão abaixo.'}</p>
<p style="margin:28px 0"><a href="${link}" style="background:#f86800;color:#fff;text-decoration:none;font-weight:bold;padding:14px 24px;border-radius:8px;display:inline-block">${titulo.toUpperCase()}</a></p>
<p style="font-size:14px;color:#666">O link vale por 1 hora. Se não foi você que pediu, pode ignorar este e-mail: a sua senha continua a mesma.</p>
<p style="font-size:14px;color:#666">PH Corridas</p></div>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_REMETENTE || 'PH Corridas <nao-responda@phcorridas.com>',
      to: [email],
      subject: `${titulo} | Pace Pódio`,
      html,
    }),
  });
  if (!r.ok) throw new Error('resend ' + r.status + ': ' + (await r.text()).slice(0, 200));
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return responde(res, 405, { ok: false, error: 'metodo' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};
  const acao = body.acao;
  const email = normalizeEmail(body.email);
  const senha = typeof body.senha === 'string' ? body.senha : '';

  try {
    if (acao === 'sair') {
      const m = /^Bearer\s+([A-Za-z0-9_-]{20,})$/.exec(req.headers?.authorization || '');
      if (m) await redisDel(sessaoKey(m[1]));
      return responde(res, 200, { ok: true });
    }

    if (acao === 'redefinir') {
      // vem do link do e-mail: o token prova que a pessoa tem acesso a caixa de e-mail
      const token = String(body.token || '');
      if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return responde(res, 400, { ok: false, error: 'link invalido' });
      if (senha.length < SENHA_MIN) return responde(res, 400, { ok: false, error: 'senha curta' });
      const r = await redisGet(resetKey(token));
      if (!r || !r.email) return responde(res, 410, { ok: false, error: 'link vencido' });
      await redisSet(senhaKey(r.email), { ...hashSenha(senha), criada: Date.now() });
      await redisDel(resetKey(token));
      return responde(res, 200, { ok: true, email: r.email, token: await criarSessao(r.email) });
    }

    if (!email || !email.includes('@')) return responde(res, 400, { ok: false, error: 'email invalido' });

    if (acao === 'entrar') {
      const tent = await redisIncr('tent:' + email, 15 * 60);
      if (tent > MAX_TENTATIVAS) return responde(res, 429, { ok: false, error: 'muitas tentativas' });
      const salvo = await redisGet(senhaKey(email));
      if (!salvo) {
        // sem senha ainda: a tela troca para "crie sua senha" (ou manda o e-mail, se a compra for antiga)
        const c = await comprou(email);
        if (!c.ok) return responde(res, 404, { ok: false, error: 'sem compra' });
        const recente = !!c.aluno && c.aluno.pago_em && Date.now() - c.aluno.pago_em <= JANELA_CADASTRO;
        return responde(res, 409, { ok: false, error: 'sem senha', cadastro_direto: recente });
      }
      if (!confereSenha(senha, salvo)) return responde(res, 401, { ok: false, error: 'senha errada' });
      await redisDel('tent:' + email);
      return responde(res, 200, { ok: true, email, token: await criarSessao(email) });
    }

    if (acao === 'cadastrar') {
      if (senha.length < SENHA_MIN) return responde(res, 400, { ok: false, error: 'senha curta' });
      const c = await comprou(email);
      if (!c.ok) return responde(res, 404, { ok: false, error: 'sem compra' });
      if (await redisGet(senhaKey(email))) return responde(res, 409, { ok: false, error: 'ja tem senha' });
      const recente = !!c.aluno && c.aluno.pago_em && Date.now() - c.aluno.pago_em <= JANELA_CADASTRO;
      if (!recente) return responde(res, 403, { ok: false, error: 'confirmar por email' });
      await redisSet(senhaKey(email), { ...hashSenha(senha), criada: Date.now() });
      return responde(res, 200, { ok: true, email, token: await criarSessao(email) });
    }

    if (acao === 'esqueci') {
      // resposta igual tendo compra ou nao: nao entrega quem e aluno
      const env = await redisIncr('envio:' + email, 60 * 60);
      if (env > 3) return responde(res, 429, { ok: false, error: 'muitos envios' });
      const c = await comprou(email);
      if (c.ok) {
        const token = novoToken();
        await redisSet(resetKey(token), { email }, RESET_TTL);
        const primeiro = !(await redisGet(senhaKey(email)));
        await enviarEmailSenha(email, token, primeiro);
      }
      return responde(res, 200, { ok: true });
    }

    return responde(res, 400, { ok: false, error: 'acao' });
  } catch (err) {
    return responde(res, 502, { ok: false, error: String(err.message || err) });
  }
};

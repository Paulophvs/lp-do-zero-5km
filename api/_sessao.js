// Login da area de membros (30/10): senha criada pelo aluno, guardada so como
// hash scrypt (crypto do Node, sem dependencia). A sessao e um token aleatorio
// que o aparelho guarda; as APIs da area descobrem o e-mail pelo token, nunca
// confiando num e-mail que veio do navegador.
const crypto = require('crypto');
const { redisGet, redisSet, normalizeEmail } = require('./_redis');

const SESSAO_TTL = 60 * 60 * 24 * 365; // 1 ano: o aluno nao precisa entrar de novo

function senhaKey(email) {
  return 'senha:' + normalizeEmail(email);
}

function sessaoKey(token) {
  return 'sessao:' + token;
}

function novoToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashSenha(senha, salt) {
  salt = salt || crypto.randomBytes(16).toString('base64url');
  const hash = crypto.scryptSync(String(senha), salt, 64).toString('base64url');
  return { salt, hash };
}

function confereSenha(senha, salvo) {
  if (!salvo || !salvo.salt || !salvo.hash) return false;
  const a = Buffer.from(hashSenha(senha, salvo.salt).hash);
  const b = Buffer.from(salvo.hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function criarSessao(email) {
  const token = novoToken();
  await redisSet(sessaoKey(token), { email: normalizeEmail(email), criada: Date.now() }, SESSAO_TTL);
  return token;
}

// e-mail da sessao do pedido (cabecalho Authorization: Bearer <token>), ou null
async function emailDaSessao(req) {
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,})$/.exec(req.headers?.authorization || '');
  if (!m) return null;
  const s = await redisGet(sessaoKey(m[1]));
  return s && s.email ? s.email : null;
}

module.exports = { senhaKey, sessaoKey, novoToken, hashSenha, confereSenha, criarSessao, emailDaSessao };

// Limite de avaliacoes do fortalecimento (regra do Paulo, 01/11):
// - ate 2 avaliacoes a cada 27 dias (a janela comeca na 1a avaliacao dela);
// - no dia 27 libera de novo, todo mes;
// - a reavaliacao do FIM DO BLOCO (as 4 semanas feitas) nao gasta a conta e abre
//   uma janela nova. So vale como reavaliacao se o plano guardado no banco
//   (fc:<email>) esta marcado como concluido (fim); senao conta como avaliacao normal,
//   para ninguem burlar escolhendo "Estou terminando um bloco" no meio do bloco.
// GET: situacao (pode, usadas, libera_em). POST { modo }: registra a avaliacao que
// esta sendo feita agora (429 se ja usou as 2). E-mail vem da sessao do login.
const { redisGet, redisSet, alunoKey, bonusKey, fortalecimentoKey, normalizeEmail } = require('./_redis');
const { emailDaSessao } = require('./_sessao');

const DIA = 24 * 60 * 60 * 1000;
const JANELA = 27 * DIA;
const LIMITE = 2;
const TTL = 60 * 60 * 24 * 400;

function avaliacaoKey(email) {
  return 'fcav:' + normalizeEmail(email);
}

// mesmo criterio do /api/fortalecimento (bonus vitalicio do anual)
async function anual(email) {
  const [bonus, aluno] = await Promise.all([redisGet(bonusKey(email)), redisGet(alunoKey(email))]);
  return !!bonus || (!!aluno && aluno.plano === 'anual' && aluno.rec_pagas === undefined);
}

// janela vencida (ou nunca aberta) = conta zerada
function situacao(reg, agora) {
  const ini = reg && reg.janela_ini;
  const vale = !!ini && agora < ini + JANELA;
  const usadas = vale ? (reg.usadas || 0) : 0;
  return {
    usadas,
    limite: LIMITE,
    pode: usadas < LIMITE,
    // a proxima que ele fizer e a ultima da janela: a tela avisa antes
    ultima: usadas === LIMITE - 1,
    janela_ini: vale ? ini : null,
    // quando a janela atual fecha (se ele fizer a proxima agora e for a 1a, abre hoje)
    libera_em: vale ? ini + JANELA : agora + JANELA,
  };
}

function responde(res, status, obj) {
  res.statusCode = status;
  return res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') return responde(res, 405, { ok: false, error: 'metodo' });
  try {
    const email = await emailDaSessao(req);
    if (!email) return responde(res, 401, { ok: false, error: 'sem login' });
    if (!(await anual(email))) return responde(res, 403, { ok: false, error: 'sem plano anual' });
    const agora = Date.now();
    const reg = (await redisGet(avaliacaoKey(email))) || { hist: [] };

    if (req.method === 'GET') return responde(res, 200, { ok: true, ...situacao(reg, agora) });

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};

    let reavFim = false;
    if (body.modo === 'reav') {
      const salvo = await redisGet(fortalecimentoKey(email));
      reavFim = !!(salvo && salvo.fim);
    }
    const st = situacao(reg, agora);
    let novo;
    if (reavFim) {
      // fim do bloco: nao gasta a conta e abre uma janela nova a partir de hoje
      novo = { janela_ini: agora, usadas: 0 };
    } else {
      if (!st.pode) return responde(res, 429, { ok: false, error: 'limite', ...st });
      novo = { janela_ini: st.janela_ini || agora, usadas: st.usadas + 1 };
    }
    novo.hist = [...(reg.hist || []), { em: agora, modo: reavFim ? 'reav-fim' : (body.modo === 'reav' ? 'reav-contou' : 'primeira') }].slice(-30);
    await redisSet(avaliacaoKey(email), novo, TTL);
    return responde(res, 200, { ok: true, contou: !reavFim, ...situacao(novo, agora) });
  } catch (err) {
    return responde(res, 502, { ok: false, error: String(err) });
  }
};

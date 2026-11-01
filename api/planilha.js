// Planilhas do aluno na area de membros (regra do Paulo, 01/11):
// - a 1a planilha e a da compra (pedido do checkout);
// - AJUSTE: somente na 1a planilha, 1 vez, nos 7 primeiros dias (erro de dado:
//   tempo chutado, dias que nao consegue, dor). Nao e pra trocar a meta;
// - NOVA PLANILHA a cada 27 dias, com o tempo atualizado, avancando o modelo
//   M1 > M2 > M3 > M4 > M1 (as planilhas do Paulo se revezam);
// - ANUAL: libera no dia 27 enquanto o plano esta ativo;
// - MENSAL: no dia 27 aparece "pronta" com cadeado, e so libera quando o
//   pagamento da renovacao cai (senao ele pega a nova e cancela antes de pagar).
// As regras ficam AQUI no servidor; a tela so mostra o que esta API devolve.
// O e-mail vem da sessao do login (Authorization: Bearer), nunca do navegador.
const { redisGet, redisSet, alunoKey, pedidoKey, normalizeEmail } = require('./_redis');
const { emailDaSessao } = require('./_sessao');

const DIA = 24 * 60 * 60 * 1000;
const AJUSTE_DIAS = 7;
const NOVA_DIAS = 27;
const TTL = 60 * 60 * 24 * 400; // igual ao acesso do aluno (webhook)
// mesma conta de validade do /api/aluno (manter as duas iguais)
const PERIODO = { anual: 365 * DIA, mensal: 31 * DIA };
const FOLGA = { anual: 7 * DIA, mensal: 4 * DIA };
// recorde mundial (mesma trava do formulario de compra, motor.js calcular)
const RECORDE = { 5: 12 * 60 + 35, 10: 26 * 60 + 11 };

function planilhasKey(email) {
  return 'planilhas:' + normalizeEmail(email);
}

function statusPlano(aluno, agora) {
  if (!aluno) return { tipo: null, ativo: false, venceEm: null };
  const tipo = aluno.plano === 'anual' ? 'anual' : 'mensal';
  const venceEm = aluno.vence_em || (aluno.pago_em ? aluno.pago_em + PERIODO[tipo] : null);
  const ativo = !venceEm || agora <= venceEm + FOLGA[tipo];
  return { tipo, ativo, venceEm };
}

function entrada(p) {
  return {
    distancia: Number(p.distancia),
    minutos: Number(p.minutos),
    segundos: Number(p.segundos) || 0,
    qtdDias: Number(p.qtdDias),
    diasSemana: (p.diasSemana || []).map(Number),
  };
}

// historico do aluno; na 1a vez nasce do pedido pago da compra
async function carregar(email, agora) {
  const [aluno, pedido, reg] = await Promise.all([
    redisGet(alunoKey(email)), redisGet(pedidoKey(email)), redisGet(planilhasKey(email)),
  ]);
  if (reg && Array.isArray(reg.lista) && reg.lista.length) return { aluno, pedido, reg, novo: false };
  if (!pedido || pedido.status !== 'pago' || !pedido.distancia) return { aluno, pedido, reg: null, novo: false };
  const criado = pedido.pago_em || (aluno && aluno.pago_em) || agora;
  const reg2 = {
    lista: [{ n: 1, ciclo: Number(pedido.ciclo) || 1, criado_em: criado, origem: 'compra', ...entrada(pedido) }],
    ajuste_usado: false,
  };
  return { aluno, pedido, reg: reg2, novo: true };
}

function regras(aluno, reg, agora) {
  const st = statusPlano(aluno, agora);
  const lista = reg.lista;
  const atual = lista[lista.length - 1];
  const primeira = lista[0];
  const ajusteAte = (primeira.comprado_em || primeira.criado_em) + AJUSTE_DIAS * DIA;
  const podeAjustar = st.ativo && lista.length === 1 && !reg.ajuste_usado && agora < ajusteAte;
  const liberaEm = atual.criado_em + NOVA_DIAS * DIA;
  const chegou = agora >= liberaEm;
  // renovacao do mensal: pagamento novo depois da planilha atual (1 dia de margem
  // para nao contar o proprio pagamento que gerou a planilha)
  const pagouDepois = !!(aluno && aluno.pago_em && aluno.pago_em > atual.criado_em + DIA);
  let podeGerar = false;
  if (st.ativo && chegou) podeGerar = st.tipo === 'anual' ? true : pagouDepois;
  const faltam = chegou ? 0 : Math.ceil((liberaEm - agora) / DIA);
  return {
    plano: st.tipo,
    ativo: st.ativo,
    vence_em: st.venceEm,
    atual: { n: atual.n, ciclo: atual.ciclo, criado_em: atual.criado_em, distancia: atual.distancia, minutos: atual.minutos,
      segundos: atual.segundos, qtdDias: atual.qtdDias, diasSemana: atual.diasSemana },
    total: lista.length,
    ajuste: { pode: podeAjustar, ate: ajusteAte, usado: !!reg.ajuste_usado },
    nova: {
      libera_em: liberaEm,
      faltam_dias: faltam,
      pode: podeGerar,
      // mensal no dia 27 sem a renovacao paga: "Sua nova planilha esta pronta" com cadeado
      travada: st.ativo && chegou && !podeGerar && st.tipo === 'mensal',
    },
  };
}

function validar(e) {
  if (e.distancia !== 5 && e.distancia !== 10) return 'distancia';
  if (!Number.isInteger(e.minutos) || !Number.isInteger(e.segundos) || e.segundos < 0 || e.segundos > 59 || e.minutos < 0) return 'tempo';
  const seg = e.minutos * 60 + e.segundos;
  if (seg < RECORDE[e.distancia]) return 'tempo';
  if (seg / 60 / e.distancia > 15) return 'tempo';
  const ds = e.diasSemana;
  if (!Number.isInteger(e.qtdDias) || e.qtdDias < 2 || e.qtdDias > 6) return 'dias';
  if (ds.length !== e.qtdDias || new Set(ds).size !== ds.length || ds.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) return 'dias';
  return null;
}

async function gravar(email, reg, pedido, agora) {
  await redisSet(planilhasKey(email), reg, TTL);
  // o pedido guarda a planilha atual: a pagina da planilha (obrigado.html) e o PDF
  // leem dele, entao ajuste e planilha nova aparecem la sem mudar o motor
  if (pedido) {
    const a = reg.lista[reg.lista.length - 1];
    await redisSet(pedidoKey(email), { ...pedido, distancia: a.distancia, minutos: a.minutos, segundos: a.segundos,
      qtdDias: a.qtdDias, diasSemana: a.diasSemana, ciclo: a.ciclo, planilha_n: a.n, planilha_em: a.criado_em }, TTL);
  }
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
    const agora = Date.now();
    const { aluno, pedido, reg, novo } = await carregar(email, agora);
    if (!reg) return responde(res, 404, { ok: false, error: 'sem planilha' });

    if (req.method === 'GET') {
      if (novo) await redisSet(planilhasKey(email), reg, TTL);
      return responde(res, 200, { ok: true, ...regras(aluno, reg, agora) });
    }

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};
    const r = regras(aluno, reg, agora);
    const e = entrada(body);
    const erro = validar(e);
    if (erro) return responde(res, 400, { ok: false, error: erro });

    if (body.acao === 'ajustar') {
      if (!r.ajuste.pode) return responde(res, 403, { ok: false, error: 'ajuste indisponivel' });
      const p = reg.lista[0];
      // o bloco de 4 semanas recomeca no dia do ajuste; o prazo do ajuste continua contando da compra
      reg.lista[0] = { ...p, ...e, criado_em: agora, comprado_em: p.comprado_em || p.criado_em, ajustada_em: agora,
        antes: entrada(p) };
      reg.ajuste_usado = true;
    } else if (body.acao === 'gerar') {
      if (!r.nova.pode) return responde(res, 403, { ok: false, error: 'nova planilha indisponivel' });
      const a = reg.lista[reg.lista.length - 1];
      reg.lista.push({ n: a.n + 1, ciclo: (a.ciclo % 4) + 1, criado_em: agora, origem: 'nova', ...e });
      reg.lista = reg.lista.slice(-30);
    } else {
      return responde(res, 400, { ok: false, error: 'acao' });
    }
    await gravar(email, reg, pedido, agora);
    return responde(res, 200, { ok: true, ...regras(aluno, reg, agora) });
  } catch (err) {
    return responde(res, 502, { ok: false, error: String(err) });
  }
};

module.exports.regras = regras;
module.exports.carregar = carregar;
module.exports.gravarRegistro = (email, reg) => redisSet(planilhasKey(email), reg, TTL);

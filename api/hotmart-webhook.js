// Recebe a notificacao de compra da Hotmart e marca o pedido como "pago".
//
// ATENCAO (14/08): nao consegui acessar developers.hotmart.com pra confirmar
// 100% onde a Hotmart manda o hottok (header x-hotmart-hottok? campo no
// corpo?) e o schema exato do payload (documentacao bloqueou o fetch
// automatizado). Por isso a extracao abaixo e DEFENSIVA: tenta varios
// lugares plausiveis pro hottok e pro email/status, e GRAVA o payload cru
// no Redis (chave "webhook:ultimo") pra eu conferir contra uma notificacao
// REAL (ou o botao "Enviar teste" do painel da Hotmart) antes de confiar
// nisso de vez em producao. Nao apagar esse log ate validar.
const { redisSet, redisGet, redisDel, pedidoKey, alunoKey, bonusKey, pedidoCodKey, pedidoNovoKey, normalizeEmail } = require('./_redis');
const { enviarEmail, emailBotao } = require('./_email');
const { enviarWhatsApp } = require('./_whatsapp');
// historico das planilhas (mesma chave do /api/planilha)
const planilhasKey = (e) => 'planilhas:' + normalizeEmail(e);

// anual dura 12 meses; guarda 400 dias para sobrar margem (antes era 30 e o anual perdia o acesso)
const TTL_ACESSO = 60 * 60 * 24 * 400;
const DIA = 24 * 60 * 60 * 1000;
const PERIODO = { anual: 365 * DIA, mensal: 31 * DIA };

// Validade do aluno. Renovou antes de vencer: o periodo novo conta do vencimento
// atual (nao perde os dias pagos). Mesmo aviso repetido (reenvio da Hotmart ou
// 2 eventos de aprovado da mesma compra) nao soma de novo: confere a transacao
// e, sem transacao no payload, ignora aviso a menos de 24 h do anterior.
// Recuperador de Adesao da Hotmart: sem limite para 12x, ela cria um plano
// mensal "Rec_<nome do anual>" e cobra o anual em 12 vezes por mes. Cada parcela
// manda um aviso de aprovado: so a primeira (ou uma depois de vencido) abre o ano.
function ehRecuperador(body) {
  const nome = String(body?.data?.subscription?.plan?.name || body?.data?.plan?.name || '').toLowerCase();
  return nome.startsWith('rec_');
}

function novaValidade(ant, plano, transacao, agora, recuperador) {
  const vistos = (ant && ant.trans) || [];
  const repetido = !!ant && (transacao ? vistos.includes(transacao) : (ant.pago_em && agora - ant.pago_em < DIA));
  if (repetido && ant.vence_em) return { vence_em: ant.vence_em, pago_em: ant.pago_em, trans: vistos };
  if (recuperador) {
    // Paulo 30/10: no recuperador o aluno costuma parar no meio; cada parcela paga
    // libera so 1 mes (nunca o ano inteiro de uma vez)
    const base = ant && ant.vence_em && ant.vence_em > agora ? ant.vence_em : agora;
    return { vence_em: base + PERIODO.mensal, pago_em: agora, trans: [...vistos, transacao].filter(Boolean).slice(-20),
      rec_pagas: ((ant && ant.rec_pagas) || 0) + 1 };
  }
  const base = ant && ant.vence_em && ant.vence_em > agora ? ant.vence_em : agora;
  return { vence_em: base + PERIODO[plano], pago_em: agora, trans: [...vistos, transacao].filter(Boolean).slice(-20) };
}

const HOTTOK = process.env.HOTMART_HOTTOK;

// status que a Hotmart usa pra "pagamento aprovado" variam por versao da API
// (approved, completed, complete...); aceitamos qualquer um desses.
const STATUS_APROVADO = ['approved', 'completed', 'complete', 'purchase_approved', 'purchase_complete'];

function achaHottok(body, req) {
  return (
    body?.hottok ||
    body?.data?.hottok ||
    req.headers['x-hotmart-hottok'] ||
    req.headers['x-hotmart-signature'] ||
    null
  );
}

function achaEmail(body) {
  return (
    body?.data?.buyer?.email ||
    body?.data?.customer?.email ||
    body?.buyer?.email ||
    body?.email ||
    null
  );
}

function achaStatus(body) {
  const s = (
    body?.data?.purchase?.status ||
    body?.data?.status ||
    body?.status ||
    body?.event ||
    ''
  );
  return String(s).toLowerCase();
}

function achaPlano(body) {
  const nome = String(
    body?.data?.subscription?.plan?.name ||
    body?.data?.purchase?.offer?.code ||
    body?.data?.plan?.name ||
    ''
  ).toLowerCase();
  return nome.includes('anual') || nome.includes('annual') || nome.includes('yearly') ? 'anual' : 'mensal';
}

// 'anual' so quando a Hotmart diz que e anual (nome do plano ou codigo da oferta
// anual b4d6ajy8, cobranca unica desde 30/10; 3ww7ii10 e o anual antigo recorrente); senao null, e quem chama decide o que usar
function achaPlanoHotmart(body) {
  const txt = JSON.stringify([
    body?.data?.subscription?.plan?.name,
    body?.data?.purchase?.offer?.code,
    body?.data?.plan?.name,
  ]).toLowerCase();
  if (txt.includes('anual') || txt.includes('annual') || txt.includes('yearly') || txt.includes('b4d6ajy8') || txt.includes('3ww7ii10')) return 'anual';
  if (txt.includes('mensal') || txt.includes('monthly') || txt.includes('hmpbwfsz')) return 'mensal';
  return null;
}

// reembolso e chargeback (nomes variam entre versoes da Hotmart)
const STATUS_ESTORNO = ['refund', 'chargeback', 'protest', 'dispute'];

// codigo do pedido que o site manda no link (sck=PP<codigo>); a Hotmart devolve em lugares diferentes por versao
function achaCodigo(body) {
  const v = body?.data?.purchase?.origin?.sck || body?.data?.purchase?.sck || body?.data?.origin?.sck ||
    body?.data?.sck || body?.sck || body?.data?.purchase?.origin?.src || '';
  const m = /^PP([A-Za-z0-9]{8,24})$/.exec(String(v).trim());
  return m ? m[1] : null;
}

// tira o acesso: planilha e area (aluno), bonus que veio desse pagamento, e o pedido
async function revogar(email) {
  const agora = Date.now();
  const aluno = await redisGet(alunoKey(email));
  if (aluno) await redisSet(alunoKey(email), { ...aluno, revogado_em: agora, vence_em: agora - 30 * DIA }, TTL_ACESSO);
  const bonus = await redisGet(bonusKey(email));
  // o bonus vitalicio so cai se nasceu desse ultimo pagamento (reembolso da 1a compra do anual)
  if (bonus && (!aluno || !aluno.pago_em || (bonus.desde || 0) >= aluno.pago_em - DIA)) await redisDel(bonusKey(email));
  const pedido = await redisGet(pedidoKey(email));
  if (pedido) await redisSet(pedidoKey(email), { ...pedido, status: 'reembolsado', reembolsado_em: agora }, TTL_ACESSO);
  await redisDel(planilhasKey(email));
}

const SITE = process.env.SITE_URL || 'https://phcorridas.com';
async function avisarPlanilha(email, pedido) {
  const link = `${SITE}/pacepodio/obrigado.html?email=${encodeURIComponent(email)}`;
  const temDados = !!pedido.distancia;
  const html = emailBotao(
    temDados
      ? ['Olá!', 'Seu pagamento foi confirmado e a sua <b>planilha do Pace Pódio está pronta</b>.',
         'É só abrir no botão abaixo. Lá também dá para baixar em PDF.']
      : ['Olá!', 'Seu pagamento foi confirmado. Falta só responder 3 perguntas rápidas (distância, tempo e dias de treino) para montarmos a sua planilha.'],
    temDados ? 'VER MINHA PLANILHA' : 'MONTAR MINHA PLANILHA', link,
    [`Para entrar na sua área do aluno, use este e-mail (${email}) em ${SITE.replace(/^https?:\/\//, '')}/pacepodio/treinos e crie a sua senha no primeiro acesso.`]);
  try { await enviarEmail(email, 'Sua planilha está pronta | Pace Pódio', html); }
  catch (e) { console.error('hotmart-webhook: e-mail da planilha falhou', String(e)); }
  try { await enviarWhatsApp(pedido.whatsapp, [link]); }
  catch (e) { console.error('hotmart-webhook: whatsapp falhou', String(e)); }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Log cru pra validar o formato real na primeira notificacao/teste.
  try {
    await redisSet('webhook:ultimo', { headers: req.headers, body, recebido_em: Date.now() }, 60 * 60 * 24 * 7);
  } catch (e) {
    console.error('falha ao logar webhook cru', e);
  }

  const tokenRecebido = achaHottok(body, req);
  if (!HOTTOK || !tokenRecebido || tokenRecebido !== HOTTOK) {
    console.error('hotmart-webhook: hottok invalido ou ausente');
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: 'hottok invalido' }));
  }

  const email = normalizeEmail(achaEmail(body));
  const status = achaStatus(body);
  const evento = String(body?.event || '').toLowerCase();
  const aprovado = STATUS_APROVADO.some((s) => status.includes(s));
  // reembolso/chargeback tiram o acesso na hora (Paulo 01/11). Cancelamento da
  // renovacao NAO entra aqui: o aluno fica ate o fim do periodo pago.
  const estorno = STATUS_ESTORNO.some((s) => status.includes(s) || evento.includes(s));

  if (!email) {
    console.error('hotmart-webhook: email do comprador nao encontrado no payload');
    res.statusCode = 200; // responde 200 mesmo assim pra Hotmart nao ficar reenviando
    return res.end(JSON.stringify({ ok: false, error: 'email nao encontrado no payload' }));
  }

  if (estorno) {
    try {
      await revogar(email);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, revogado: true }));
    } catch (err) {
      console.error('hotmart-webhook: erro ao revogar', err);
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: String(err) }));
    }
  }

  if (!aprovado) {
    // outros eventos (cancelamento da renovacao etc) so confirmamos recebimento
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ignorado: true, status }));
  }

  try {
    const key = pedidoKey(email);
    let existente = (await redisGet(key)) || { email };
    const pagoAntes = existente.status === 'pago';
    // codigo do pedido (sck): liga a compra ao formulario feito com outro e-mail,
    // ou aos dados novos de quem ja pagou e refez o formulario
    const cod = achaCodigo(body);
    const ligado = cod ? await redisGet(pedidoCodKey(cod)) : null;
    let dadosNovos = null;
    if (ligado && ligado.email) {
      const emailForm = normalizeEmail(ligado.email);
      if (ligado.novo) dadosNovos = await redisGet(pedidoNovoKey(emailForm));
      else if (emailForm !== email && !existente.distancia) {
        const form = await redisGet(pedidoKey(emailForm));
        if (form && form.distancia) {
          dadosNovos = form;
          // o formulario (outro e-mail) passa a mostrar a planilha e avisa com qual e-mail entrar
          await redisSet(pedidoKey(emailForm), { ...form, status: 'pago', email_compra: email, pago_em: Date.now() }, TTL_ACESSO);
        }
      }
    }
    if (!dadosNovos) dadosNovos = await redisGet(pedidoNovoKey(email));
    if (dadosNovos && dadosNovos.distancia) {
      existente = { ...existente, nome: dadosNovos.nome || existente.nome, whatsapp: dadosNovos.whatsapp || existente.whatsapp,
        distancia: dadosNovos.distancia, minutos: dadosNovos.minutos, segundos: dadosNovos.segundos, qtdDias: dadosNovos.qtdDias,
        diasSemana: dadosNovos.diasSemana, plano: dadosNovos.plano || existente.plano, ciclo: 1, email_formulario: dadosNovos.email || null };
      // dados novos = recomeca o historico das planilhas (a 1a nasce de novo do pedido)
      await redisDel(planilhasKey(email));
      await redisDel(pedidoNovoKey(email));
      if (dadosNovos.email && normalizeEmail(dadosNovos.email) !== email) await redisDel(pedidoNovoKey(dadosNovos.email));
    }
    const atualizado = {
      ...existente,
      status: 'pago',
      // vale o plano que a Hotmart cobrou (o do formulario e so o que a pessoa clicou)
      plano: achaPlanoHotmart(body) || existente.plano || achaPlano(body),
      pago_em: Date.now(),
    };
    delete atualizado.reembolsado_em;
    await redisSet(key, atualizado, TTL_ACESSO);
    const plano = achaPlanoHotmart(body) || atualizado.plano || 'mensal';
    const transacao = body?.data?.purchase?.transaction || body?.data?.transaction || null;
    const ant = await redisGet(alunoKey(email));
    const val = novaValidade(ant && !ant.revogado_em ? ant : null, plano, transacao, atualizado.pago_em, ehRecuperador(body));
    const ttl = Math.max(TTL_ACESSO, Math.ceil((val.vence_em - Date.now()) / 1000) + 60 * 60 * 24 * 30);
    await redisSet(alunoKey(email), { email, plano, ...val }, ttl);
    // anual libera os bonus para sempre (sem prazo); renovacoes nao mexem na data original.
    // Pelo recuperador, so depois das 12 parcelas pagas.
    const anualQuitado = plano === 'anual' && (!ehRecuperador(body) || (val.rec_pagas || 0) >= 12);
    if (anualQuitado && !(await redisGet(bonusKey(email)))) {
      await redisSet(bonusKey(email), { email, desde: atualizado.pago_em });
    }
    // aviso "sua planilha esta pronta" (e-mail; WhatsApp com estrutura pronta e desligado).
    // So na compra nova ou com dados novos, nunca em aviso repetido da mesma transacao.
    const repetido = !!ant && val.pago_em === ant.pago_em;
    if (!repetido && (!pagoAntes || dadosNovos)) await avisarPlanilha(email, atualizado);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error('hotmart-webhook: erro ao gravar pedido pago', err);
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: String(err) }));
  }
};

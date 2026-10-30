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
const { redisSet, redisGet, pedidoKey, alunoKey, normalizeEmail } = require('./_redis');

// anual dura 12 meses; guarda 400 dias para sobrar margem (antes era 30 e o anual perdia o acesso)
const TTL_ACESSO = 60 * 60 * 24 * 400;

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
// anual 3ww7ii10); senao null, e quem chama decide o que usar
function achaPlanoHotmart(body) {
  const txt = JSON.stringify([
    body?.data?.subscription?.plan?.name,
    body?.data?.purchase?.offer?.code,
    body?.data?.plan?.name,
  ]).toLowerCase();
  if (txt.includes('anual') || txt.includes('annual') || txt.includes('yearly') || txt.includes('3ww7ii10')) return 'anual';
  if (txt.includes('mensal') || txt.includes('monthly') || txt.includes('hmpbwfsz')) return 'mensal';
  return null;
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
  const aprovado = STATUS_APROVADO.some((s) => status.includes(s));

  if (!email) {
    console.error('hotmart-webhook: email do comprador nao encontrado no payload');
    res.statusCode = 200; // responde 200 mesmo assim pra Hotmart nao ficar reenviando
    return res.end(JSON.stringify({ ok: false, error: 'email nao encontrado no payload' }));
  }

  if (!aprovado) {
    // outros eventos (cancelamento, reembolso etc) por enquanto so confirmamos recebimento
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ignorado: true, status }));
  }

  try {
    const key = pedidoKey(email);
    const existente = (await redisGet(key)) || { email };
    const atualizado = {
      ...existente,
      status: 'pago',
      plano: existente.plano || achaPlano(body),
      pago_em: Date.now(),
    };
    await redisSet(key, atualizado, TTL_ACESSO);
    const plano = achaPlanoHotmart(body) || atualizado.plano || 'mensal';
    await redisSet(alunoKey(email), { email, plano, pago_em: atualizado.pago_em }, TTL_ACESSO);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error('hotmart-webhook: erro ao gravar pedido pago', err);
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: String(err) }));
  }
};

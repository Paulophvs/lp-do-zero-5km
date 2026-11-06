// Aviso diario por e-mail (Paulo 01/11): quando a planilha nova do aluno libera
// (anual no dia 27; mensal quando a renovacao e paga), manda 1 e-mail
// "Sua nova planilha esta liberada". A faixa no site so pega quem entra; o
// e-mail pega quem sumiu. Roda pelo cron da Vercel (vercel.json) as 12h UTC
// (9h na Bahia). So aceita chamada com o CRON_SECRET (a Vercel manda no
// cabecalho Authorization); sem essa variavel configurada, recusa tudo.
const { redisCmd } = require('./_redis');
const { regras, carregar, gravarRegistro } = require('./planilha');

const SITE = process.env.SITE_URL || 'https://phcorridas.com';

async function enviarEmail(email) {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) throw new Error('envio de e-mail nao configurado');
  const link = `${SITE}/pacepodio/treinos/`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:16px;color:#1d1d1f;max-width:480px">
<p>Olá!</p>
<p>Sua <b>nova planilha do Pace Pódio já está liberada</b>.</p>
<p style="font-size:18px;font-weight:bold">Só solicite a nova planilha depois de terminar a atual, porque você vai precisar fazer uma nova avaliação em nosso site.</p>
<p>Não precisa ser hoje. Você pode entrar no site no dia que quiser para solicitar sua nova planilha.</p>
<p style="margin:28px 0"><a href="${link}" style="background:#f86800;color:#fff;text-decoration:none;font-weight:bold;padding:14px 24px;border-radius:8px;display:inline-block">GERAR MINHA NOVA PLANILHA</a></p>
<p style="font-size:14px;color:#666">Entre na sua área do aluno com o seu e-mail e senha.</p>
<p style="font-size:14px;color:#666">PH Corridas</p></div>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_REMETENTE || 'PH Corridas <nao-responda@phcorridas.com>',
      to: [email],
      subject: 'Sua nova planilha está liberada | Pace Pódio',
      html,
    }),
  });
  if (!r.ok) throw new Error('resend ' + r.status + ': ' + (await r.text()).slice(0, 200));
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers?.authorization !== `Bearer ${segredo}`) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: 'nao autorizado' }));
  }
  const agora = Date.now();
  const out = { vistos: 0, enviados: 0, erros: [] };
  try {
    let cursor = '0';
    do {
      const [prox, chaves] = await redisCmd(['scan', cursor, 'match', 'aluno:*', 'count', '200']);
      cursor = String(prox);
      for (const k of chaves || []) {
        const email = k.slice('aluno:'.length);
        out.vistos++;
        try {
          const { aluno, reg } = await carregar(email, agora);
          if (!reg) continue;
          const r = regras(aluno, reg, agora);
          const atual = reg.lista[reg.lista.length - 1];
          if (!r.nova.pode || atual.avisado_nova) continue;
          await enviarEmail(email);
          atual.avisado_nova = agora;
          await gravarRegistro(email, reg);
          out.enviados++;
        } catch (e) {
          out.erros.push(String(e).slice(0, 120));
        }
      }
    } while (cursor !== '0');
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ...out }));
  } catch (err) {
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: String(err), ...out }));
  }
};

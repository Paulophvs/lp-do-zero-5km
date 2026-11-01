// Envio de e-mail transacional (Resend), mesmo formato do esqueci-senha (conta.js).
// Sem RESEND_API_KEY lanca erro; quem chama decide se isso trava ou so registra.
async function enviarEmail(para, assunto, html) {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) throw new Error('envio de e-mail nao configurado');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_REMETENTE || 'PH Corridas <nao-responda@phcorridas.com>',
      to: [para],
      subject: assunto,
      html,
    }),
  });
  if (!r.ok) throw new Error('resend ' + r.status + ': ' + (await r.text()).slice(0, 200));
}

// moldura padrao dos e-mails do Pace Podio (botao laranja)
function emailBotao(paragrafos, botao, link, rodape) {
  return `<div style="font-family:Arial,sans-serif;font-size:16px;color:#1d1d1f;max-width:480px">
${paragrafos.map((p) => `<p>${p}</p>`).join('\n')}
<p style="margin:28px 0"><a href="${link}" style="background:#f86800;color:#fff;text-decoration:none;font-weight:bold;padding:14px 24px;border-radius:8px;display:inline-block">${botao}</a></p>
${(rodape || []).map((p) => `<p style="font-size:14px;color:#666">${p}</p>`).join('\n')}
<p style="font-size:14px;color:#666">PH Corridas</p></div>`;
}

module.exports = { enviarEmail, emailBotao };

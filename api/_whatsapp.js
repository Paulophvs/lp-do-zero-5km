// Envio de WhatsApp (Paulo 01/11): ESTRUTURA PRONTA, DESLIGADA. Ele ainda vai
// contratar a API oficial (WhatsApp Cloud API da Meta) e aprovar o modelo de
// mensagem. Para ligar: WHATSAPP_ATIVO=1, WHATSAPP_TOKEN, WHATSAPP_PHONE_ID e
// WHATSAPP_TEMPLATE (nome do modelo aprovado) na Vercel. Enquanto isso, so devolve
// { pulado: true } e nada sai.
async function enviarWhatsApp(numero, variaveis) {
  if (process.env.WHATSAPP_ATIVO !== '1') return { pulado: true };
  const token = process.env.WHATSAPP_TOKEN, phoneId = process.env.WHATSAPP_PHONE_ID;
  const modelo = process.env.WHATSAPP_TEMPLATE;
  if (!token || !phoneId || !modelo) throw new Error('whatsapp sem configuracao');
  let num = String(numero || '').replace(/\D/g, '');
  if (num.length === 10 || num.length === 11) num = '55' + num; // DDD + numero brasileiro
  if (num.length < 12) throw new Error('numero invalido');
  const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to: num, type: 'template',
      template: { name: modelo, language: { code: 'pt_BR' },
        components: [{ type: 'body', parameters: (variaveis || []).map((t) => ({ type: 'text', text: String(t) })) }] },
    }),
  });
  if (!r.ok) throw new Error('whatsapp ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return { ok: true };
}

module.exports = { enviarWhatsApp };

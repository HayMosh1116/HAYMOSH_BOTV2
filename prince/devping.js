const { gmd } = require('../mayel');

gmd({
  pattern: 'devping',
  category: 'dev',
  description: 'Developer-only pong identifying this bot user',
}, async (from, Prince, conText) => {
  // isDevs is verified by the central handler against the fixed developer
  // identity, including WhatsApp phone/LID mappings. Owner/sudo is not enough.
  if (conText.isDevs !== true) return;
  const owner = String(conText.ownerName || 'Bot user').replace(/[\r\n]+/g, ' ').trim();
  const number = String(conText.ownerNumber || '').replace(/\D/g, '');
  const jid = number ? `${number}@s.whatsapp.net` : null;
  const text = `🏓 *Pong!*\n👤 *Bot user:* ${owner}${number ? `\n📱 @${number}` : ''}\n🤖 *Bot:* ${conText.botName || 'HAYWHY_MDX'}`;
  try {
    await Prince.sendMessage(from, {
      text,
      ...(jid ? { mentions: [jid] } : {}),
    }, { quoted: conText.mek });
  } catch (error) {
    console.error('devping reply failed:', error.message);
  }
});

const DEVELOPER_NUMBER = '2349122761580';
const seenBySocket = new WeakMap();

function normalizeJid(value) {
  const jid = String(value || '').toLowerCase();
  return jid.replace(/:\d+(?=@)/, '');
}
function triggerText(message) {
  let content = message?.message;
  while (content?.ephemeralMessage?.message) content = content.ephemeralMessage.message;
  return content?.conversation || content?.extendedTextMessage?.text ||
    content?.imageMessage?.caption || content?.videoMessage?.caption || '';
}
function isUniversalDevPing(message) {
  const text = triggerText(message);
  return typeof text === 'string' && /^(?:devping|\.devping)$/i.test(text.trim());
}
function isVerifiedDeveloper(message, { user, groupInfo, resolvedLid } = {}) {
  const key = message?.key || {};
  const group = String(key.remoteJid || '').endsWith('@g.us');
  // A fromMe DM's remoteJid is the recipient, NOT the sender.
  const sender = key.fromMe ? user?.id : (key.participant || key.remoteJid);
  const identities = key.fromMe
    ? [user?.id, user?.lid]
    : [sender, key.senderPn, key.participantPn, group ? key.participantAlt : key.remoteJidAlt];
  const senderJids = new Set(identities.filter(Boolean).map(normalizeJid));
  const participant = groupInfo?.participants?.find(p =>
    [p.id, p.lid, p.pn, p.phoneNumber].some(jid => senderJids.has(normalizeJid(jid))));
  const phoneJid = value => {
    const jid = normalizeJid(value);
    return /^\d+$/.test(jid) ? `${jid}@s.whatsapp.net` : jid;
  };
  const phones = [...identities, participant?.pn, participant?.phoneNumber, resolvedLid];
  return phones.some(value => phoneJid(value) === `${DEVELOPER_NUMBER}@s.whatsapp.net`);
}
function uptimeText(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 86400)}d ${Math.floor(value / 3600) % 24}h ${Math.floor(value / 60) % 60}m ${value % 60}s`;
}
async function respondDevPing(from, socket, context) {
  if (context.isDevs !== true || !context.mek?.key?.id) return;
  if (context.connectionStatus !== 'open') return;
  let seen = seenBySocket.get(socket);
  if (!seen) { seen = new Set(); seenBySocket.set(socket, seen); }
  const id = `${from}:${context.mek.key.id}`;
  if (seen.has(id)) return;
  // Claim before awaiting: simultaneous duplicate events must not reply twice.
  seen.add(id);
  if (seen.size > 4096) seen.delete(seen.values().next().value);
  const ping = Math.max(0, Math.round(performance.now() - (context.receivedAt ?? performance.now())));
  const quality = ping < 500 ? 'Good' : ping < 2000 ? 'Fair' : 'Slow';
  const clean = value => String(value || '').replace(/[\r\n*_~`]+/g, ' ').trim();
  const number = String(context.ownerNumber || '').replace(/\D/g, '');
  const text = [
    '╭─── 🏓 *Pong* ───╮',
    '',
    `*${clean(context.botName) || 'HAYWHY_MDX'}*`,
    `Version · ${clean(context.botVersion) || 'Unknown'}`,
    '',
    '─── *OWNER* ───',
    clean(context.ownerName) || 'Not configured',
    number ? `+${number}` : 'Number not configured',
    '',
    '─── *CONNECTION* ───',
    '● Status · Online',
    `Quality · ${quality}¹`,
    '',
    '─── *PERFORMANCE* ───',
    `Uptime · ${uptimeText(process.uptime())}`,
    `Ping · ${ping} ms¹`,
    '',
    '_¹ Processing latency; not network RTT._',
    '╰────────────────╯',
  ].join('\n');
  try {
    // Plain owner number avoids profile-name lookups on the send path.
    await socket.sendMessage(from, { text }, { quoted: context.mek });
  } catch (error) {
    console.error('devping reply failed:', error?.message || String(error));
  }
}
module.exports = { DEVELOPER_NUMBER, isUniversalDevPing, isVerifiedDeveloper, respondDevPing, uptimeText };

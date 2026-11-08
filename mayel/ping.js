const PING_RESPONSE = "HAYWHY's BOT — ONLINE";

async function respondToPing(from, socket, context) {
  const receivedAt = Number(context?.receivedAt);
  const ping = Number.isFinite(receivedAt) && receivedAt > 0
    ? Math.max(0, performance.now() - receivedAt)
    : 0;
  const text = `🌟 *𝐏๏፝֟ƞ̽g* ${ping.toFixed(2)} *𝐌ʂ* 🔥 *𝐇𝐀𝐘𝐖𝐇𝐘'𝐬 𝐁𝐎𝐓 — 𝐎𝐍𝐋𝐈𝐍𝐄*`;
  await socket.sendMessage(from, { text }, { quoted: context?.mek });
}

module.exports = { PING_RESPONSE, respondToPing };

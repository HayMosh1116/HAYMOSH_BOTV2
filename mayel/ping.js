const PING_RESPONSE = "🌟 *𝐏๏፝֟ƞ̽g* {ms} *𝐌ʂ* 🔥 *𝐇𝐀𝐘𝐖𝐇𝐘'𝐬 𝐁𝐎𝐓 — 𝐎𝐍𝐋𝐈𝐍𝐄*";

async function respondToPing(from, socket, context) {
  const startedAt = Number(context?.receivedAt);
  const elapsed = Number.isFinite(startedAt) && startedAt > 0
    ? Math.max(0, performance.now() - startedAt)
    : 0;
  const text = PING_RESPONSE.replace("{ms}", elapsed.toFixed(2));
  await socket.sendMessage(from, { text }, { quoted: context?.mek });
}

module.exports = { PING_RESPONSE, respondToPing };

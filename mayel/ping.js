const PING_RESPONSE = "HAYWHY's BOT — ONLINE";

async function respondToPing(from, socket, context) {
  await socket.sendMessage(from, { text: PING_RESPONSE }, { quoted: context?.mek });
}

module.exports = { PING_RESPONSE, respondToPing };

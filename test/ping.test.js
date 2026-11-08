const test = require('node:test');
const assert = require('node:assert/strict');
const { PING_RESPONSE, respondToPing } = require('../mayel/ping');

test('.ping sends the styled HAYWHY online response with latency', async () => {
  const calls = [];
  const socket = { sendMessage: async (...args) => calls.push(args) };
  const message = { key: { id: 'fixture' } };
  await respondToPing('123@s.whatsapp.net', socket, { mek: message });
  assert.match(PING_RESPONSE, /𝐏๏፝֟ƞ̽g/);
  assert.match(PING_RESPONSE, /𝐇𝐀𝐘𝐖𝐇𝐘'𝐬 𝐁𝐎𝐓 — 𝐎𝐍𝐋𝐈𝐍𝐄/);
  assert.match(calls[0][1].text, /^🌟 \*𝐏๏፝֟ƞ̽g\* \d+\.\d{2} \*𝐌ʂ\* 🔥 \*𝐇𝐀𝐘𝐖𝐇𝐘'𝐬 𝐁𝐎𝐓 — 𝐎𝐍𝐋𝐈𝐍𝐄\*$/);
  assert.deepEqual(calls[0][2], { quoted: message });
});

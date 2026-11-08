const test = require('node:test');
const assert = require('node:assert/strict');
const { PING_RESPONSE, respondToPing } = require('../mayel/ping');

test('.ping sends the exact HAYWHY online response', async () => {
  const calls = [];
  const socket = { sendMessage: async (...args) => calls.push(args) };
  const message = { key: { id: 'fixture' } };
  await respondToPing('123@s.whatsapp.net', socket, { mek: message });
  assert.equal(PING_RESPONSE, "HAYWHY's BOT — ONLINE");
  assert.deepEqual(calls, [[
    '123@s.whatsapp.net',
    { text: "HAYWHY's BOT — ONLINE" },
    { quoted: message },
  ]]);
});

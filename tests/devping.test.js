const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { isUniversalDevPing, isVerifiedDeveloper, respondDevPing, uptimeText } = require('../mayel/devPing');
const developer = '2349122761580@s.whatsapp.net';
const message = (chat, id = 'ping', extra = {}) => ({ key: { id, remoteJid: chat, ...extra }, message: { conversation: 'devping' } });
function socket() { const calls = []; return { calls, sendMessage: async (...args) => { calls.push(args); } }; }
function context(mek, extra = {}) { return { isDevs: true, mek, botName: 'Fleet bot', ownerName: 'Test owner', ownerNumber: '2348000000000', botVersion: '4.0.0', connectionStatus: 'open', receivedAt: performance.now(), ...extra }; }
test('literal trigger ignores configured prefixes and matches only the command, never Pong or quoted text', () => {
  for (const prefix of ['!', '#', '/', '.']) {
    assert.equal(isUniversalDevPing({ ...message(developer), prefix }), true);
  }
  for (const text of ['devping', ' DEVPING ', '.devping']) {
    assert.equal(isUniversalDevPing({ message: { conversation: text } }), true);
  }
  for (const text of ['Pong!', 'reply .devping', '.devping extra', '!devping', 'haywhymdxprefix']) {
    assert.equal(isUniversalDevPing({ message: { conversation: text } }), false);
  }
  assert.equal(isUniversalDevPing({ message: { extendedTextMessage: { text: 'Pong', contextInfo: { quotedMessage: { conversation: '.devping' } } } } }), false);
});
test('developer number 2349122761580 is authorized in phone DMs and groups', () => {
  assert.equal(isVerifiedDeveloper(message(developer)), true);
  assert.equal(isVerifiedDeveloper(message('fleet@g.us', 'ping', { participant: developer })), true);
  assert.equal(isVerifiedDeveloper(message('fleet@g.us', 'ping', { participant: 'abc@lid', participantPn: developer })), true);
});
test('only verified phone/LID mappings authorize, never raw LID digits or owner/sudo roles', () => {
  const lid = '2349122761580@lid';
  assert.equal(isVerifiedDeveloper(message(lid)), false);
  assert.equal(isVerifiedDeveloper(message(lid), { resolvedLid: developer }), true);
  assert.equal(isVerifiedDeveloper(message('other@s.whatsapp.net'), { isSuperUser: true, isSudo: true }), false);
  assert.equal(isVerifiedDeveloper(message('fleet@g.us', 'ping', { participant: 'abc@lid' }), { groupInfo: { participants: [{ id: 'abc@lid', phoneNumber: '2349122761580' }] } }), true);
  assert.equal(isVerifiedDeveloper(message('fleet@g.us', 'ping', { participant: 'other@lid' }), { groupInfo: { participants: [{ id: 'abc@lid', pn: developer }] } }), false);
});
test('fromMe uses bot identity, not developer recipient or participant alternative', () => {
  assert.equal(isVerifiedDeveloper(message(developer, 'self', { fromMe: true, senderPn: developer }), { user: { id: '2348000000000:2@s.whatsapp.net' } }), false);
  assert.equal(isVerifiedDeveloper(message('fleet@g.us', 'self', { fromMe: true }), { user: { id: '2349122761580:7@s.whatsapp.net' } }), true);
});
for (const mode of ['public', 'private']) for (const chat of [developer, 'fleet@g.us']) {
  test(`online bot responds once in ${mode} mode in ${chat.endsWith('@g.us') ? 'group' : 'DM'}`, async () => {
    const bot = socket(); const ctx = context(message(chat), { botMode: mode, botPrefix: '!' });
    await Promise.all([respondDevPing(chat, bot, ctx), respondDevPing(chat, bot, ctx)]);
    assert.equal(bot.calls.length, 1);
    assert.equal(bot.calls[0][0], chat);
    assert.equal(bot.calls[0][2].quoted, ctx.mek);
  });
}
test('each bot independently responds once to the same trigger', async () => {
  const a = socket(), b = socket(), ctx = context(message('fleet@g.us'));
  await respondDevPing('fleet@g.us', a, ctx); await respondDevPing('fleet@g.us', b, ctx);
  assert.equal(a.calls.length, 1); assert.equal(b.calls.length, 1);
});
test('unauthorized and offline bots send nothing', async () => {
  for (const extra of [{ isDevs: false }, { isDevs: 'true' }, { connectionStatus: 'close' }, { connectionStatus: 'connecting' }]) {
    const bot = socket(); await respondDevPing(developer, bot, context(message(developer), extra)); assert.equal(bot.calls.length, 0);
  }
});
test('failed send is isolated and never retried into a reply loop', async () => {
  let calls = 0; const bot = { sendMessage: async () => { calls++; throw new Error('offline'); } };
  const ctx = context(message(developer));
  await assert.doesNotReject(() => respondDevPing(developer, bot, ctx));
  await respondDevPing(developer, bot, ctx); assert.equal(calls, 1);
});
test('uptime uses running bot seconds', () => { assert.equal(uptimeText(90061), '1d 1h 1m 1s'); });
test('existing configured-prefix devping plugin delegates to the same deduplicated handler', () => {
  let command;
  vm.runInNewContext(fs.readFileSync(require.resolve('../prince/devping'), 'utf8'), {
    require: path => path === '../mayel' ? { gmd: (definition, handler) => { command = { definition, handler }; } } : { respondDevPing },
  });
  assert.equal(command.definition.pattern, 'devping'); assert.equal(command.handler, respondDevPing);
});
// Exercise actual main listener wiring without starting WhatsApp or installing
// unrelated dependencies. Capture processCommandMessage's verified dispatch.
const source = fs.readFileSync(require.resolve('../index'), 'utf8');
function wire() {
  const start = source.indexOf('        Prince.ev.on("messages.upsert", async ({ messages = [], type })');
  const end = source.indexOf('\n\n        Prince.ev.on("connection.update",', start);
  let listener; const dispatched = [];
  vm.runInNewContext(source.slice(start, end), {
    Prince: { ev: { on: (_, handler) => { listener = handler; } } }, performance,
    isUniversalDevPing, processCommandMessage: async ms => dispatched.push(ms.key.id), console,
  });
  return { listener, dispatched };
}
test('main listener handles every live ping in a batch without changing other command selection', async () => {
  const { listener, dispatched } = wire();
  await listener({ type: 'notify', messages: [{ key: { id: 'menu' }, message: { conversation: '!menu' } }, message(developer, 'a'), message(developer, 'b')] });
  assert.deepEqual(dispatched, ['menu', 'a', 'b']);
});
test('history replay does not trigger universal ping', async () => {
  const { listener, dispatched } = wire(); await listener({ type: 'append', messages: [message(developer)] }); assert.deepEqual(dispatched, []);
});

// Execute the real command dispatcher, with only WhatsApp/network boundaries
// mocked. Prefix/mode reads deliberately throw if the early path reaches them.
function dispatcher({ mode = 'private', prefix = '!', groupInfo = null, resolvedLid = null } = {}) {
  const bot = socket(); const reads = []; let lookups = 0;
  bot.user = { id: '2348000000000:2@s.whatsapp.net' };
  bot.groupMetadata = async () => { lookups++; return groupInfo; };
  const start = source.indexOf('        const processCommandMessage = async (ms, receivedAt) => {');
  const end = source.indexOf('\n        Prince.ev.on("messages.upsert", async ({ messages = [], type })', start);
  const run = vm.runInNewContext(`${source.slice(start, end)}\nprocessCommandMessage;`, {
    Prince: bot, isUniversalDevPing, isVerifiedDeveloper, respondDevPing,
    resolveJidFromLid: async () => resolvedLid, devPingConnectionStatus: 'open',
    getSetting: (key, fallback) => {
      reads.push(key);
      if (key === 'PREFIX' || key === 'BOT_MODE') throw new Error(`unexpected ${key} gate: ${mode}/${prefix}`);
      return fallback;
    }, botName: 'Fleet bot', ownerName: 'Test owner', ownerNumber: '2348000000000', botVersion: '4.0.0',
  });
  return { bot, run: ms => run(ms, performance.now()), reads, lookups: () => lookups };
}
for (const mode of ['public', 'private']) for (const prefix of ['.', '!', '/']) for (const chat of [developer, 'fleet@g.us']) {
  test(`plain devping bypasses ${prefix} prefix and ${mode} gates in ${chat.endsWith('@g.us') ? 'group' : 'DM'}`, async () => {
    const d = dispatcher({ mode, prefix });
    const ms = message(chat, 'live', chat.endsWith('@g.us') ? { participant: developer } : {});
    await Promise.all([d.run(ms), d.run(ms)]);
    assert.equal(d.bot.calls.length, 1);
    assert.equal(d.bot.calls[0][0], chat);
    assert.equal(d.lookups(), 0);
    assert.equal(d.reads.includes('PREFIX'), false);
    assert.equal(d.reads.includes('BOT_MODE'), false);
  });
}
test('actual dispatcher verifies LID DMs and group membership mappings', async () => {
  const dm = dispatcher({ resolvedLid: developer }); await dm.run(message('abc@lid')); assert.equal(dm.bot.calls.length, 1);
  const group = dispatcher({ groupInfo: { participants: [{ id: 'abc@lid', phoneNumber: '2349122761580' }] } });
  await group.run(message('fleet@g.us', 'live', { participant: 'abc@lid' }));
  assert.equal(group.bot.calls.length, 1);
});
test('actual dispatcher rejects non-developers, numeric LIDs and developer-recipient self messages', async () => {
  for (const ms of [message('2348000000000@s.whatsapp.net'), message('fleet@g.us', 'other', { participant: '2348000000000@s.whatsapp.net' }), message('2349122761580@lid'), message(developer, 'self', { fromMe: true })]) {
    const d = dispatcher(); await d.run(ms); assert.equal(d.bot.calls.length, 0);
  }
});
test('actual dispatcher refuses status and newsletter triggers', async () => {
  for (const chat of ['status@broadcast', '123@newsletter']) {
    const d = dispatcher(); await d.run(message(chat, 'live', { participant: developer })); assert.equal(d.bot.calls.length, 0);
  }
});

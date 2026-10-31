const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function load() {
  let command;
  vm.runInNewContext(fs.readFileSync(require.resolve('../prince/devping'), 'utf8'), {
    require: () => ({ gmd: (definition, handler) => { command = { definition, handler }; } }),
    console: { error: () => {} },
  });
  return command;
}
const context = {
  isDevs: true, ownerName: 'Test bot user', ownerNumber: '2348000000000',
  botName: 'HAYWHY_MDX', mek: { key: { id: 'dev-command' } },
};
test('developer can trigger Pong identifying the bot user in a group', async () => {
  const calls = [];
  await load().handler('fleet@g.us', { sendMessage: async (...args) => calls.push(args) }, context);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'fleet@g.us');
  assert.match(calls[0][1].text, /Pong!/);
  assert.match(calls[0][1].text, /Test bot user/);
  assert.match(calls[0][1].text, /@2348000000000/);
  assert.equal(calls[0][1].mentions[0], '2348000000000@s.whatsapp.net');
  assert.equal(calls[0][2].quoted, context.mek);
});
for (const [role, permissions] of [
  ['ordinary user', { isDevs: false }], ['owner', { isDevs: false, isSuperUser: true }],
  ['sudo', { isDevs: false, isSuperUser: true, isSudo: true }], ['missing identity', {}],
  ['unverified truthy identity', { isDevs: 'true' }],
]) {
  test(`${role} cannot trigger any Pong`, async () => {
    let sent = 0;
    await load().handler('fleet@g.us', { sendMessage: async () => { sent++; } }, permissions);
    assert.equal(sent, 0);
  });
}
test('each receiving bot identifies its own user, not the initiator', async () => {
  const calls = [];
  const socket = { sendMessage: async (...args) => calls.push(args) };
  await load().handler('fleet@g.us', socket, context);
  await load().handler('fleet@g.us', socket, { ...context, ownerName: 'Second user', ownerNumber: '2348000000000001' });
  assert.equal(calls.length, 2);
  assert.match(calls[1][1].text, /Second user/);
  assert.equal(calls[1][1].mentions[0], '2348000000000001@s.whatsapp.net');
});
test('developer receives Pong in DMs too', async () => {
  let destination;
  await load().handler('developer@s.whatsapp.net', { sendMessage: async from => { destination = from; } }, context);
  assert.equal(destination, 'developer@s.whatsapp.net');
});
test('failed sending does not throw into other commands', async () => {
  await assert.doesNotReject(() => load().handler('fleet@g.us', { sendMessage: async () => { throw new Error('offline'); } }, context));
});

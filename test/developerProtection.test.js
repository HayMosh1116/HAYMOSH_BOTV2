const test = require('node:test');
const assert = require('node:assert/strict');
const {
  HAYWHY_DEVELOPER_NUMBER,
  isProtectedDeveloper,
  isProtectedDeveloperAsync,
  digits,
} = require('../mayel/developerProtection');

test('matches the fixed developer phone number and never parses a LID as a number', () => {
  assert.equal(isProtectedDeveloper('2349122761580@s.whatsapp.net'), true);
  assert.equal(isProtectedDeveloper({ pn: '2349122761580@s.whatsapp.net' }), true);
  assert.equal(isProtectedDeveloper('2348000000000@s.whatsapp.net'), false);
  assert.equal(digits('987654321@lid'), '');
  assert.equal(isProtectedDeveloper('987654321@lid'), false);
  assert.equal(HAYWHY_DEVELOPER_NUMBER, '2349122761580');
});

test('resolves an opaque LID to the developer before protecting it', async () => {
  const socket = {
    getJidFromLid: async (lid) => lid === 'dev-lid@lid' ? '2349122761580@s.whatsapp.net' : null,
  };
  assert.equal(await isProtectedDeveloperAsync(socket, 'group@g.us', 'dev-lid@lid'), true);
});

test('does not mistake an ordinary or unresolved LID for the developer', async () => {
  const socket = {
    getJidFromLid: async () => null,
    groupMetadata: async () => ({
      participants: [{ id: 'member-lid@lid', lid: 'member-lid@lid', pn: '2348012345678@s.whatsapp.net' }],
    }),
  };
  assert.equal(await isProtectedDeveloperAsync(socket, 'group@g.us', 'member-lid@lid'), false);
  assert.equal(await isProtectedDeveloperAsync(socket, 'group@g.us', 'unknown-lid@lid'), false);
});

test('matches developer through group participant phone aliases', async () => {
  const socket = {
    groupMetadata: async () => ({
      participants: [{
        id: 'dev-lid@lid',
        lid: 'dev-lid@lid',
        pn: '2349122761580@s.whatsapp.net',
      }],
    }),
  };
  assert.equal(await isProtectedDeveloperAsync(socket, 'group@g.us', 'dev-lid@lid'), true);
});

test('returns false for an ordinary phone JID without metadata lookups', async () => {
  let lookups = 0;
  const socket = { groupMetadata: async () => { lookups++; return { participants: [] }; } };
  assert.equal(await isProtectedDeveloperAsync(socket, 'group@g.us', '2348012345678@s.whatsapp.net'), false);
  assert.equal(lookups, 0);
});

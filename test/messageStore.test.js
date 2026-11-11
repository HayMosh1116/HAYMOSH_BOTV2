const test = require('node:test');
const assert = require('node:assert/strict');
const { gmdStore } = require('../mayel/messageStore');

function msg(jid, id) {
  return { key: { remoteJid: jid, id }, message: { conversation: id } };
}

test('enforces one global message cap and keeps retry lookup indexes consistent', () => {
  const store = new gmdStore({ maxMessages: 2, maxChats: 10, maxContacts: 10 });
  try {
    const first = msg('a@g.us', '1');
    const second = msg('a@g.us', '2');
    const third = msg('b@g.us', '3');
    store.saveMessage(first.key.remoteJid, first);
    store.saveMessage(second.key.remoteJid, second);
    store.saveMessage(third.key.remoteJid, third);

    assert.equal(store.messageOrder.size, 2);
    assert.equal(store.loadMessage('a@g.us', '1'), null);
    assert.equal(store.loadMessage('a@g.us', '2'), second);
    assert.equal(store.loadMessage('some-lid@g.us', '3'), third);
    assert.equal(store.byId.size, 2);
  } finally {
    store.destroy();
  }
});

test('evicts least-recently-used chats and caps chat/contact metadata', () => {
  const store = new gmdStore({ maxMessages: 10, maxChats: 2, maxContacts: 2 });
  try {
    store.saveMessage('a@g.us', msg('a@g.us', '1'));
    store.saveMessage('b@g.us', msg('b@g.us', '2'));
    store.saveMessage('a@g.us', msg('a@g.us', '3')); // touch chat A
    store.saveMessage('c@g.us', msg('c@g.us', '4'));
    assert.equal(store.messages.has('a@g.us'), true);
    assert.equal(store.messages.has('b@g.us'), false);
    assert.equal(store.messages.has('c@g.us'), true);

    store.setChat({ id: 'chat-a' });
    store.setChat({ id: 'chat-b' });
    store.setChat({ id: 'chat-c' });
    store.setContact({ id: 'contact-a' });
    store.setContact({ id: 'contact-b' });
    store.setContact({ id: 'contact-c' });
    assert.equal(store.chats.size, 2);
    assert.equal(store.contacts.size, 2);
    assert.equal(store.chats.has('chat-a'), false);
    assert.equal(store.contacts.has('contact-a'), false);
  } finally {
    store.destroy();
  }
});

test('bind safely handles absent event arrays and caps bulk contacts/chats', () => {
  const store = new gmdStore({ maxMessages: 2, maxChats: 2, maxContacts: 2 });
  const listeners = {};
  try {
    store.bind({ on: (event, callback) => { listeners[event] = callback; } });
    listeners['messages.upsert']({});
    listeners['chats.set']({ chats: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
    listeners['contacts.set']({ contacts: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
    assert.equal(store.chats.size, 2);
    assert.equal(store.contacts.size, 2);
  } finally {
    store.destroy();
  }
});

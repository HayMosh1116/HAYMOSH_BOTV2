const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createMessageDeduplicator,
  extractMessageText,
  messageIdentity,
} = require('../mayel/messageDispatch');

function message(id, remoteJid = '123@g.us', content = { conversation: '.ping' }) {
  return { key: { id, remoteJid, participant: '456@s.whatsapp.net' }, message: content };
}

test('extracts commands from video/document captions and wrapped messages', () => {
  assert.equal(extractMessageText(message('video', '123@g.us', { videoMessage: { caption: '.menu' } })), '.menu');
  assert.equal(extractMessageText(message('doc', '123@g.us', { documentMessage: { caption: '.help' } })), '.help');
  assert.equal(extractMessageText({ message: { ephemeralMessage: { message: { extendedTextMessage: { text: '.ping' } } } } }), '.ping');
  assert.equal(extractMessageText(message('button', '123@g.us', { buttonsResponseMessage: { selectedButtonId: '.status' } })), '.status');
});

test('dispatch selection keeps every new notify message and ignores history append batches', () => {
  const deduper = createMessageDeduplicator();
  const batch = [message('one'), message('two')];
  assert.deepEqual(deduper.filterNotify(batch, 'notify', 100), batch);
  assert.deepEqual(deduper.filterNotify([message('old')], 'append', 200), []);
  assert.equal(deduper.size, 2);
});

test('reconnect catch-up accepts only recent offline append messages in the outage window', () => {
  const deduper = createMessageDeduplicator();
  const now = 1_700_000_000_000;
  const window = { sinceMs: now - 60_000, untilMs: now + 120_000 };
  const recent = { ...message('recent'), messageTimestamp: Math.floor((now - 5_000) / 1000) };
  const stale = { ...message('stale'), messageTimestamp: Math.floor((now - 120_000) / 1000) };
  const self = { ...message('self'), messageTimestamp: Math.floor((now - 5_000) / 1000), key: { ...message('self').key, fromMe: true } };
  assert.deepEqual(deduper.filterReconnectAppend([recent, stale, self], window, now), [recent]);
  assert.deepEqual(deduper.filterReconnectAppend([recent], window, now), []);
  assert.deepEqual(deduper.filterReconnectAppend([recent], { ...window, untilMs: now - 1 }, now), []);
});

test('deduplicates repeated delivery by chat and message id but permits same id in another chat', () => {
  const deduper = createMessageDeduplicator();
  const first = message('same');
  assert.equal(deduper.shouldProcess(first, 100), true);
  assert.equal(deduper.shouldProcess(first, 101), false);
  assert.equal(deduper.shouldProcess(message('same', 'other@g.us'), 102), true);
  assert.equal(messageIdentity(first), messageIdentity(message('same')));
});

test('expires old entries and evicts oldest entries at the configured bound', () => {
  const expiring = createMessageDeduplicator({ ttlMs: 10, maxEntries: 3 });
  assert.equal(expiring.shouldProcess(message('old'), 100), true);
  assert.equal(expiring.shouldProcess(message('old'), 111), true);

  const bounded = createMessageDeduplicator({ ttlMs: 1000, maxEntries: 2 });
  assert.equal(bounded.shouldProcess(message('a'), 100), true);
  assert.equal(bounded.shouldProcess(message('b'), 101), true);
  assert.equal(bounded.shouldProcess(message('c'), 102), true);
  assert.equal(bounded.size, 2);
  assert.equal(bounded.shouldProcess(message('a'), 103), true);
});

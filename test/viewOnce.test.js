const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const fs = require('fs');
const vm = require('vm');

// Stub the WhatsApp library so the media helpers load without a connection.
let downloads = 0;
const origLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === 'prince-baileys') return { downloadMediaMessage: async () => { downloads++; return Buffer.from('MEDIA'); } };
  if (req === 'prince-baileys/lib/Utils/logger') return { default: { child: () => ({}) } };
  return origLoad.call(this, req, ...rest);
};
const mediaCache = require('../mayel/mediaCache');

const key = () => new Uint8Array([1, 2, 3]);
const img = (extra = {}) => ({ imageMessage: { mimetype: 'image/jpeg', caption: 'hi', mediaKey: key(), viewOnce: true, ...extra } });

test('unwraps view-once photo, video and voice note in every wrapper', () => {
  const cases = [
    [{ viewOnceMessage: { message: img() } }, 'imageMessage'],
    [{ viewOnceMessageV2: { message: { videoMessage: { mediaKey: key() } } } }, 'videoMessage'],
    [{ viewOnceMessageV2Extension: { message: { audioMessage: { ptt: true, mediaKey: key() } } } }, 'audioMessage'],
    [{ ephemeralMessage: { message: { viewOnceMessageV2: { message: img() } } } }, 'imageMessage'],
    [{ deviceSentMessage: { message: { viewOnceMessageV2: { message: img() } } } }, 'imageMessage'],
    [img(), 'imageMessage'], // newer quoted copies: wrapper stripped, viewOnce flag kept
  ];
  for (const [msg, type] of cases) {
    const u = mediaCache.unwrapMessage(msg);
    assert.equal(u.type, type); assert.equal(u.viewOnce, true);
  }
});

test('normal (not view-once) media is still detected as normal', () => {
  const u = mediaCache.unwrapMessage({ imageMessage: { mediaKey: key() } });
  assert.equal(u.type, 'imageMessage'); assert.equal(u.viewOnce, false);
  assert.deepEqual(Object.keys(mediaCache.toSendContent({ buffer: Buffer.from('x'), type: 'imageMessage', media: {} })), ['image', 'caption', 'mimetype']);
});

test('reply data is found through disappearing-message and caption wrappers', () => {
  const ctx = { stanzaId: 'Q1', quotedMessage: img() };
  assert.equal(mediaCache.getContextInfo({ ephemeralMessage: { message: { extendedTextMessage: { text: '.vv', contextInfo: ctx } } } }), ctx);
  assert.equal(mediaCache.getContextInfo({ videoMessage: { caption: '.vv', contextInfo: ctx } }), ctx);
  assert.equal(mediaCache.getText({ ephemeralMessage: { message: { extendedTextMessage: { text: 'wow' } } } }), 'wow');
});

test('voice notes are re-sent as voice notes', () => {
  const c = mediaCache.toSendContent({ buffer: Buffer.from('a'), type: 'audioMessage', media: { ptt: true } });
  assert.equal(c.ptt, true); assert.ok(c.audio);
});

test('empty placeholder (no media key) is not downloaded and is explained', async () => {
  const before = downloads;
  const r = await mediaCache.prefetch({}, { key: { id: 'P1' }, message: { viewOnceMessageV2: { message: { imageMessage: {} } } } });
  assert.equal(r, null); assert.equal(downloads, before);
  assert.match(mediaCache.getNote('P1'), /without its media key/);
});

// Run the real .vv / .vv2 reveal function from prince/owner.js.
const src = fs.readFileSync(require.resolve('../prince/owner'), 'utf8');
const start = src.indexOf('async function revealViewOnce(');
const end = src.indexOf('\ngmd({', start);
const revealViewOnce = vm.runInNewContext(`${src.slice(start, end)}\nrevealViewOnce;`, { mediaCache, console });

function run(quoted, { id = 'Q' + Math.random(), wrap = (m) => m, targets = (c, s) => [c, s] } = {}) {
  const sent = []; const replies = []; const reacts = [];
  const mek = { message: wrap({ extendedTextMessage: { text: '.vv', contextInfo: { stanzaId: id, quotedMessage: quoted } } }) };
  const Prince = { user: { id: '2348000000000:5@s.whatsapp.net' }, sendMessage: async (j, c) => sent.push([j, c]) };
  return revealViewOnce(Prince, { mek, from: 'chat@g.us', reply: async (t) => replies.push(t), react: async (e) => reacts.push(e), botName: 'BOT', isSuperUser: true }, targets)
    .then(() => ({ sent, replies, reacts }));
}

test('.vv reveals a view-once photo to chat and bot DM with a clean caption', async () => {
  const r = await run({ viewOnceMessageV2: { message: img() } });
  assert.deepEqual(r.sent.map((s) => s[0]), ['chat@g.us', '2348000000000@s.whatsapp.net']);
  assert.equal(r.sent[0][1].caption, 'hi\n\n> *REVEALED BY BOT*');
  assert.deepEqual(r.reacts, ['✅']);
});

test('.vv2 sends only to bot DM; video and voice note work', async () => {
  const v = await run({ viewOnceMessageV2: { message: { videoMessage: { mediaKey: key() } } } }, { targets: (_c, s) => [s] });
  assert.equal(v.sent.length, 1); assert.ok(v.sent[0][1].video);
  const a = await run({ viewOnceMessageV2Extension: { message: { audioMessage: { ptt: true, mediaKey: key() } } } });
  assert.ok(a.sent[0][1].audio); assert.equal(a.sent[0][1].ptt, true);
});

test('.vv works when the command is sent in a disappearing-messages chat', async () => {
  const r = await run({ viewOnceMessageV2: { message: img() } }, { wrap: (m) => ({ ephemeralMessage: { message: m } }) });
  assert.equal(r.sent.length, 2);
});

test('.vv on an empty placeholder says so and sends nothing', async () => {
  mediaCache.note('EMPTY', 'the message reached the bot but WhatsApp could not decrypt it (absent from node)');
  const r = await run({ viewOnceMessageV2: { message: { imageMessage: {} } } }, { id: 'EMPTY' });
  assert.equal(r.sent.length, 0); assert.match(r.replies[0], /empty placeholder/);
});

test('.vv rejects non-media replies', async () => {
  const r = await run({ conversation: 'text' });
  assert.equal(r.sent.length, 0); assert.match(r.replies[0], /not a supported View Once/);
});

test('.vv rejects ordinary media that is not marked View Once', async () => {
  const r = await run({ imageMessage: { mediaKey: key(), mimetype: 'image/jpeg' } });
  assert.equal(r.sent.length, 0);
  assert.match(r.replies[0], /not marked as View Once/);
});

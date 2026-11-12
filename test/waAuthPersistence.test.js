const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createWaAuthPersistence, encrypt, decrypt, encryptionKey } = require('../mayel/waAuthPersistence');

const key = crypto.randomBytes(32).toString('base64');
const id = 'test-bot';
function tempDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'wa-auth-persist-')); }
function logger() { return { log() {}, warn() {}, error() {} }; }
function fakeCollection(seed = null, failWrite = false) {
  let doc = seed;
  return {
    async findOne() { return doc && structuredClone(doc); },
    async insertOne(value) {
      if (doc) { const error = new Error('duplicate key'); error.code = 11000; throw error; }
      doc = structuredClone(value);
    },
    async findOneAndUpdate(filter, update) {
      if (failWrite) throw new Error('simulated database outage');
      if (!doc || doc.revision !== filter.revision) return null;
      const nextRevision = Number(doc?.revision || 0) + Number(update.$inc?.revision || 0);
      doc = { ...doc, ...structuredClone(update.$set), ...structuredClone(update.$setOnInsert || {}), _id: filter._id, revision: nextRevision };
      return structuredClone(doc);
    },
    get doc() { return doc && structuredClone(doc); },
  };
}

async function putCredentials(directory, value) {
  await fsp.mkdir(directory, { recursive: true, mode: 0o700 });
  await fsp.writeFile(path.join(directory, 'creds.json'), JSON.stringify(value), { mode: 0o600 });
}

test('AES-GCM encrypted payload decrypts and rejects tampering', () => {
  const secret = encryptionKey(key);
  const encrypted = encrypt(Buffer.from('private auth material'), secret);
  assert.notEqual(encrypted.ciphertext, 'private auth material');
  assert.equal(decrypt(encrypted, secret).toString(), 'private auth material');
  encrypted.tag = Buffer.alloc(16).toString('base64');
  assert.throws(() => decrypt(encrypted, secret));
  assert.throws(() => encryptionKey('not-a-key'), /32-byte key/);
});

test('imports an existing local session into encrypted database without replacing it', async () => {
  const directory = tempDir();
  const collection = fakeCollection();
  try {
    await putCredentials(directory, { registered: true, local: 'keep' });
    await fsp.mkdir(path.join(directory, 'keys'), { mode: 0o700 });
    await fsp.writeFile(path.join(directory, 'keys', 'pre-key-1.json'), '{"key":"present"}', { mode: 0o600 });
    const persistence = createWaAuthPersistence({ authDir: directory, id, mongoUri: 'mongodb://test', encryptionKey: key, collection, logger: logger() });
    const result = await persistence.initialize();
    assert.equal(result.mode, 'local-imported');
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'creds.json'))).local, 'keep');
    assert.ok(collection.doc.payload.ciphertext);
    assert.equal(collection.doc.payload.ciphertext.includes('keep'), false);
    assert.equal(collection.doc.revision, 1);
    assert.equal(fs.statSync(path.join(directory, '.wa-auth-db-revision')).mode & 0o777, 0o600);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('an empty database record permits first-time pairing and later accepts the first credential snapshot', async () => {
  const directory = tempDir();
  const collection = fakeCollection();
  try {
    const persistence = createWaAuthPersistence({ authDir: directory, id, mongoUri: 'mongodb://test', encryptionKey: key, collection, logger: logger() });
    assert.equal((await persistence.initialize()).mode, 'empty');
    await putCredentials(directory, { registered: true });
    assert.equal(await persistence.persist(), true);
    assert.equal(collection.doc.revision, 1);
    assert.ok(collection.doc.payload.ciphertext);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('restores the newest encrypted database snapshot before socket creation', async () => {
  const directory = tempDir();
  const payload = encrypt(Buffer.from(JSON.stringify({ format: 1, entries: {
    'creds.json': Buffer.from('{"registered":true,"version":2}').toString('base64'),
    'keys/signal-key.json': Buffer.from('{"key":"restored"}').toString('base64'),
  } })), encryptionKey(key));
  const collection = fakeCollection({ _id: id, revision: 7, payload, updatedAt: new Date() });
  try {
    const persistence = createWaAuthPersistence({ authDir: directory, id, mongoUri: 'mongodb://test', encryptionKey: key, collection, logger: logger() });
    const result = await persistence.initialize();
    assert.equal(result.mode, 'database-restored');
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'creds.json'))).version, 2);
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'keys', 'signal-key.json'))).key, 'restored');
    assert.equal(fs.readFileSync(path.join(directory, '.wa-auth-db-revision'), 'utf8'), '7');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('queues persisted Signal-key writes and snapshots their local file result', async () => {
  const directory = tempDir();
  const collection = fakeCollection();
  try {
    await putCredentials(directory, { registered: true });
    const persistence = createWaAuthPersistence({ authDir: directory, id, mongoUri: 'mongodb://test', encryptionKey: key, collection, logger: logger() });
    await persistence.initialize();
    const original = {
      async get(type, ids) { return Object.fromEntries(ids.map((id) => [id, null])); },
      async set(data) {
        await fsp.mkdir(path.join(directory, 'keys'), { recursive: true, mode: 0o700 });
        await fsp.writeFile(path.join(directory, 'keys', 'signal-key.json'), JSON.stringify(data), { mode: 0o600 });
      },
    };
    const wrapped = persistence.wrapKeyStore(original, () => true);
    await wrapped.set({ 'pre-key': { key1: { private: 'private' } } });
    assert.equal(collection.doc.revision, 2);
    const saved = JSON.parse(decrypt(collection.doc.payload, encryptionKey(key)).toString());
    assert.match(Buffer.from(saved.entries['keys/signal-key.json'], 'base64').toString(), /pre-key/);
    assert.equal(await wrapped.get('pre-key', ['key1']).then((value) => value.key1), null);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('database write failures keep local credentials intact and do not reject key updates', async () => {
  const directory = tempDir();
  const collection = fakeCollection(null, true);
  try {
    await putCredentials(directory, { registered: true, local: 'safe' });
    const persistence = createWaAuthPersistence({ authDir: directory, id, mongoUri: 'mongodb://test', encryptionKey: key, collection, logger: logger() });
    await persistence.initialize();
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'creds.json'))).local, 'safe');
    const wrapped = persistence.wrapKeyStore({ async get() { return {}; }, async set() { return undefined; } }, () => true);
    await assert.doesNotReject(wrapped.set({ 'session': { key: { value: 1 } } }));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('compare-and-swap fences a stale worker instead of overwriting a newer revision', async () => {
  const firstDir = tempDir();
  const secondDir = tempDir();
  const collection = fakeCollection();
  try {
    await putCredentials(firstDir, { registered: true, source: 'first' });
    const first = createWaAuthPersistence({ authDir: firstDir, id, mongoUri: 'mongodb://test', encryptionKey: key, collection, logger: logger() });
    await first.initialize();

    await putCredentials(secondDir, { registered: true, source: 'second' });
    const second = createWaAuthPersistence({ authDir: secondDir, id, mongoUri: 'mongodb://test', encryptionKey: key, collection, logger: logger() });
    await second.initialize();
    const newerRevision = collection.doc.revision;
    const newerSnapshot = decrypt(collection.doc.payload, encryptionKey(key)).toString();

    assert.equal(await first.persist(), false);
    assert.equal(collection.doc.revision, newerRevision);
    assert.equal(decrypt(collection.doc.payload, encryptionKey(key)).toString(), newerSnapshot);
  } finally {
    fs.rmSync(firstDir, { recursive: true, force: true });
    fs.rmSync(secondDir, { recursive: true, force: true });
  }
});

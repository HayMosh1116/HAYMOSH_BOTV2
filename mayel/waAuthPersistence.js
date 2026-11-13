const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { MongoClient } = require('mongodb');

const FORMAT_VERSION = 1;
const MAX_SNAPSHOT_BYTES = 32 * 1024 * 1024;
const MARKER = '.wa-auth-db-revision';

function encryptionKey(value = process.env.WA_AUTH_ENCRYPTION_KEY) {
  const input = String(value || '').trim();
  if (/^[a-f0-9]{64}$/i.test(input)) return Buffer.from(input, 'hex');
  const decoded = Buffer.from(input, 'base64');
  if (decoded.length === 32 && decoded.toString('base64').replace(/=+$/, '') === input.replace(/=+$/, '')) return decoded;
  throw new Error('WA_AUTH_ENCRYPTION_KEY must be a dedicated 32-byte key encoded as 64 hex characters or base64.');
}

function encrypt(plaintext, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { algorithm: 'aes-256-gcm', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
}

function decrypt(payload, key) {
  if (!payload || payload.algorithm !== 'aes-256-gcm') throw new Error('Unsupported WhatsApp auth snapshot format.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, 'base64')), decipher.final()]);
}

function validRelativePath(value) {
  return typeof value === 'string' && value.length > 0 && !path.isAbsolute(value) &&
    value.split(/[\\/]/).every((part) => part && part !== '.' && part !== '..') &&
    value !== MARKER && !value.split(/[\\/]/).some((part) => part.startsWith('.'));
}

async function readSnapshot(directory) {
  const entries = {};
  let total = 0;
  async function walk(current, prefix = '') {
    let children;
    try {
      children = await fs.readdir(current, { withFileTypes: true });
    } catch (error) {
      // Baileys may remove an empty key directory while a snapshot is walking it.
      // Treat that as a concurrent deletion, not a failed authentication backup.
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of children) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (!validRelativePath(relative)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full, relative);
      } else if (entry.isFile()) {
        let data;
        try {
          data = await fs.readFile(full);
        } catch (error) {
          // One-time pre-key files are consumed and deleted by Baileys. A file
          // can disappear between readdir() and readFile(); it must not abort
          // the entire snapshot. A later queued snapshot captures the new state.
          if (error?.code === 'ENOENT') continue;
          throw error;
        }
        total += data.length;
        if (total > MAX_SNAPSHOT_BYTES) throw new Error('WhatsApp auth snapshot exceeds the configured safety limit.');
        entries[relative] = data.toString('base64');
      }
    }
  }
  await walk(directory);
  return entries;
}

async function writeSnapshot(directory, entries) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) throw new Error('Invalid WhatsApp auth snapshot.');
  const targets = Object.keys(entries);
  let total = 0;
  for (const relative of targets) {
    if (!validRelativePath(relative) || typeof entries[relative] !== 'string') throw new Error('Invalid path or data in WhatsApp auth snapshot.');
    total += Buffer.byteLength(entries[relative], 'base64');
    if (total > MAX_SNAPSHOT_BYTES) throw new Error('WhatsApp auth snapshot exceeds the configured safety limit.');
  }

  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.chmod(directory, 0o700);
  const previous = new Map();
  const written = [];
  try {
    for (const relative of targets) {
      const destination = path.join(directory, relative);
      const resolved = path.resolve(destination);
      if (!resolved.startsWith(`${path.resolve(directory)}${path.sep}`)) throw new Error('Invalid path in WhatsApp auth snapshot.');
      await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
      try { previous.set(relative, await fs.readFile(destination)); } catch (error) { if (error.code !== 'ENOENT') throw error; previous.set(relative, null); }
      const temporary = `${destination}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
      await fs.writeFile(temporary, Buffer.from(entries[relative], 'base64'), { mode: 0o600 });
      await fs.rename(temporary, destination);
      written.push(relative);
    }
  } catch (error) {
    for (const relative of written.reverse()) {
      const destination = path.join(directory, relative);
      const old = previous.get(relative);
      if (old === null) await fs.rm(destination, { force: true }).catch(() => {});
      else if (old) await fs.writeFile(destination, old, { mode: 0o600 }).catch(() => {});
    }
    throw error;
  }
}

function createWaAuthPersistence(options = {}) {
  const authDir = path.resolve(options.authDir);
  const mongoUri = String(options.mongoUri || process.env.MONGODB_URI || '').trim();
  const dbName = String(options.dbName || process.env.MONGODB_DB || 'haymosh_bot');
  const id = String(options.id || 'bot_default');
  const logger = options.logger || console;
  let client;
  let collection;
  let queue = Promise.resolve();
  let revision = 0;
  let writerFenced = false;

  async function getCollection() {
    if (!mongoUri) return null;
    if (options.collection) return options.collection;
    if (!collection) {
      client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 });
      await client.connect();
      collection = client.db(dbName).collection('whatsapp_auth_sessions');
    }
    return collection;
  }

  async function localRevision() {
    try {
      const value = Number((await fs.readFile(path.join(authDir, MARKER), 'utf8')).trim());
      return Number.isSafeInteger(value) && value >= 0 ? value : null;
    } catch (_) { return null; }
  }

  async function saveMarker(value) {
    const file = path.join(authDir, MARKER);
    const temp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(temp, String(value), { mode: 0o600 });
    await fs.rename(temp, file);
  }

  async function persistNow(isCurrent = () => true) {
    if (!mongoUri || writerFenced || !isCurrent()) return false;
    const c = await getCollection();
    const entries = await readSnapshot(authDir);
    if (!Object.hasOwn(entries, 'creds.json')) return false;
    const payload = encrypt(Buffer.from(JSON.stringify({ format: FORMAT_VERSION, entries })), encryptionKey(options.encryptionKey));
    if (!isCurrent()) return false;
    const result = await c.findOneAndUpdate(
      { _id: id, revision },
      { $set: { payload, updatedAt: new Date() }, $inc: { revision: 1 } },
      { returnDocument: 'after', includeResultMetadata: false },
    );
    if (!result) {
      writerFenced = true;
      logger.error?.('[WA-AUTH] Snapshot write was fenced because the database revision advanced elsewhere; this process will not overwrite the newer session.');
      return false;
    }
    revision = Number(result.revision || revision + 1);
    await saveMarker(revision);
    return true;
  }

  let pendingPersist = null;
  function schedulePersist(isCurrent = () => true) {
    if (!mongoUri) return Promise.resolve(false);
    // Coalesce bursts: a run that has not started yet will snapshot the newest files anyway.
    if (pendingPersist) return pendingPersist;
    const next = queue.then(() => { pendingPersist = null; return persistNow(isCurrent); });
    pendingPersist = next;
    queue = next.catch((error) => {
      logger.error?.('[WA-AUTH] Database snapshot save failed; local Baileys auth remains intact:', error?.message || error);
      return false;
    });
    return queue;
  }

  async function initialize() {
    await fs.mkdir(authDir, { recursive: true, mode: 0o700 });
    await fs.chmod(authDir, 0o700);
    if (!mongoUri) {
      logger.warn?.('[WA-AUTH] MONGODB_URI is not configured; WhatsApp auth remains local-only.');
      return { mode: 'local', revision: 0 };
    }
    // Validate encryption configuration before touching the database or local session.
    const key = encryptionKey(options.encryptionKey);
    const c = await getCollection();
    let doc = await c.findOne({ _id: id });
    if (!doc) {
      try { await c.insertOne({ _id: id, revision: 0, createdAt: new Date() }); }
      catch (error) { if (error?.code !== 11000) throw error; }
      doc = await c.findOne({ _id: id });
    }
    if (!doc) {
      if (await fs.access(path.join(authDir, 'creds.json')).then(() => true, () => false)) {
        await schedulePersist();
        logger.log?.('[WA-AUTH] Existing local Baileys session imported into encrypted database storage.');
        return { mode: 'local-imported', revision };
      }
      return { mode: 'empty', revision: 0 };
    }

    if (!doc.payload) {
      const hasLocalSession = await fs.access(path.join(authDir, 'creds.json')).then(() => true, () => false);
      if (hasLocalSession && Number(doc.revision || 0) === 0) {
        revision = 0;
        await schedulePersist();
        logger.log?.('[WA-AUTH] Existing local Baileys session imported into encrypted database storage.');
        return { mode: 'local-imported', revision };
      }
      if (Number(doc.revision || 0) === 0) return { mode: 'empty', revision: 0 };
      throw new Error('The stored WhatsApp auth record has no encrypted snapshot.');
    }

    const marker = await localRevision();
    const hasLocalCreds = await fs.access(path.join(authDir, 'creds.json')).then(() => true, () => false);
    // A pre-feature local session has no marker and is treated as the migration
    // source of truth. Never replace it with a possibly older remote copy.
    if (hasLocalCreds && marker === null) {
      revision = Number(doc.revision || 0);
      await schedulePersist();
      logger.log?.('[WA-AUTH] Preserved and imported the pre-existing local Baileys session.');
      return { mode: 'local-imported', revision };
    }

    const decrypted = JSON.parse(decrypt(doc.payload, key).toString('utf8'));
    if (decrypted.format !== FORMAT_VERSION || !decrypted.entries || typeof decrypted.entries !== 'object') throw new Error('Invalid encrypted WhatsApp auth snapshot payload.');
    const remoteRevision = Number(doc.revision || 0);
    if (!hasLocalCreds || marker < remoteRevision) {
      await writeSnapshot(authDir, decrypted.entries);
      await saveMarker(remoteRevision);
      revision = remoteRevision;
      logger.log?.(`[WA-AUTH] Restored encrypted Baileys auth snapshot revision ${remoteRevision}.`);
      return { mode: 'database-restored', revision };
    }
    revision = marker;
    await schedulePersist();
    return { mode: 'local-newer', revision };
  }

  function wrapKeyStore(keyStore, isCurrent) {
    return {
      get: (...args) => keyStore.get(...args),
      set: async (data) => {
        await keyStore.set(data);
        // Do not block Baileys' message pipeline on a full-snapshot database write;
        // a slow or unreachable database must never stall incoming messages.
        schedulePersist(isCurrent).catch(() => {});
      },
    };
  }

  async function close() {
    await queue;
    if (client) await client.close().catch(() => {});
    client = null;
    collection = null;
  }

  return { initialize, persist: schedulePersist, wrapKeyStore, close, get revision() { return revision; } };
}

module.exports = { createWaAuthPersistence, encrypt, decrypt, encryptionKey, readSnapshot, writeSnapshot };

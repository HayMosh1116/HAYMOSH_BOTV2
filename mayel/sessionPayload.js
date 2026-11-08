const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const SESSION_PREFIX = 'HAYWHY_MDX2!';
const MAX_TOKEN_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 2000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;
const MAX_JSON_BYTES = 16 * 1024 * 1024;

function decodeSessionArchive(token) {
  if (typeof token !== 'string' || !token.startsWith(SESSION_PREFIX)) {
    throw new Error(`Invalid session format. Expected ${SESSION_PREFIX}...`);
  }
  const encoded = token.slice(SESSION_PREFIX.length);
  if (!encoded || Buffer.byteLength(encoded, 'utf8') > MAX_TOKEN_BYTES ||
      encoded.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new Error('Session archive encoding is invalid or too large');
  }
  const compressed = Buffer.from(encoded, 'base64');
  if (compressed.toString('base64') !== encoded) throw new Error('Session archive encoding is invalid');

  let parsed;
  try {
    const json = zlib.gunzipSync(compressed, { maxOutputLength: MAX_JSON_BYTES }).toString('utf8');
    parsed = JSON.parse(json);
  } catch (error) {
    throw new Error(`Session archive could not be decoded: ${error.message}`);
  }
  if (!parsed || parsed.version !== 2 || !Array.isArray(parsed.files) ||
      parsed.files.length === 0 || parsed.files.length > MAX_FILES) {
    throw new Error('Session archive schema is unsupported');
  }

  const files = new Map();
  let totalBytes = 0;
  for (const entry of parsed.files) {
    if (!entry || typeof entry.path !== 'string' || typeof entry.data !== 'string' ||
        !/^[A-Za-z0-9._/-]+\.json$/.test(entry.path) ||
        entry.path.split('/').some(part => !part || part === '.' || part === '..') ||
        entry.path.includes('\\') || files.has(entry.path) ||
        entry.data.length % 4 !== 0 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(entry.data)) {
      throw new Error('Session archive contains an invalid file entry');
    }
    const data = Buffer.from(entry.data, 'base64');
    if (data.toString('base64') !== entry.data || data.length > MAX_FILE_BYTES) {
      throw new Error('Session archive contains an invalid or oversized file');
    }
    totalBytes += data.length;
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error('Session archive exceeds the allowed size');
    files.set(entry.path, data);
  }

  const creds = files.get('creds.json');
  if (!creds) throw new Error('Session archive is missing creds.json');
  let credsValue;
  try {
    credsValue = JSON.parse(creds.toString('utf8'));
  } catch (error) {
    throw new Error(`Session credentials are invalid: ${error.message}`);
  }
  if (!credsValue || typeof credsValue !== 'object' || Array.isArray(credsValue)) {
    throw new Error('Session credentials are invalid');
  }
  return files;
}

function writeAuthFiles(files, authDirectory) {
  const root = path.resolve(authDirectory);
  for (const [relativePath, data] of files) {
    if (typeof relativePath !== 'string' || !Buffer.isBuffer(data) ||
        !/^[A-Za-z0-9._/-]+\.json$/.test(relativePath) ||
        relativePath.split('/').some(part => !part || part === '.' || part === '..') ||
        relativePath.includes('\\')) {
      throw new Error('Refusing to write an unsafe auth-state path');
    }
  }
  if (!files.has('creds.json')) throw new Error('Auth state is missing creds.json');
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  fs.chmodSync(root, 0o700);
  for (const entry of fs.readdirSync(root)) {
    fs.rmSync(path.join(root, entry), { recursive: true, force: true });
  }
  for (const [relativePath, data] of files) {
    const destination = path.join(root, ...relativePath.split('/'));
    fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
    fs.writeFileSync(destination, data, { mode: 0o600 });
  }
}

module.exports = { SESSION_PREFIX, decodeSessionArchive, writeAuthFiles };

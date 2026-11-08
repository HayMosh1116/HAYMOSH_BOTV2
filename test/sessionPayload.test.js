const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SESSION_PREFIX, decodeSessionArchive, writeAuthFiles } = require('../mayel/sessionPayload');

function token(files) {
  return SESSION_PREFIX + zlib.gzipSync(Buffer.from(JSON.stringify({ version: 2, files }))).toString('base64');
}
function entry(filePath, value) {
  return { path: filePath, data: Buffer.from(value).toString('base64') };
}

test('decodes full credentials and Signal-key file set', () => {
  const session = decodeSessionArchive(token([
    entry('creds.json', JSON.stringify({ registered: true })),
    entry('keys/app-state-sync-key-1.json', JSON.stringify({ keyData: 'fixture' })),
  ]));
  assert.deepEqual([...session.keys()].sort(), ['creds.json', 'keys/app-state-sync-key-1.json']);
  assert.equal(JSON.parse(session.get('keys/app-state-sync-key-1.json').toString()).keyData, 'fixture');
});

test('rejects unsupported, malformed, missing-credentials and traversal payloads', () => {
  assert.throws(() => decodeSessionArchive('wrong-prefix'), /Invalid session format/);
  assert.throws(() => decodeSessionArchive(SESSION_PREFIX + 'not_base64'), /encoding/);
  assert.throws(() => decodeSessionArchive(token([entry('../creds.json', '{}')])), /invalid file entry/);
  assert.throws(() => decodeSessionArchive(token([entry('keys/key-1.json', '{}')])), /missing creds\.json/);
  assert.throws(() => decodeSessionArchive(token([
    entry('creds.json', '{}'), entry('creds.json', '{}'),
  ])), /invalid file entry/);
});

test('writes credentials and Signal keys with private permissions, replacing stale files', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'haywhy-auth-restore-'));
  try {
    fs.writeFileSync(path.join(directory, 'stale.json'), '{}');
    const files = decodeSessionArchive(token([
      entry('creds.json', JSON.stringify({ registered: true })),
      entry('keys/app-state-sync-key-1.json', JSON.stringify({ keyData: 'fixture' })),
    ]));
    writeAuthFiles(files, directory);
    assert.deepEqual(fs.readdirSync(directory).sort(), ['creds.json', 'keys']);
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'creds.json'), 'utf8')).registered, true);
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'keys', 'app-state-sync-key-1.json'), 'utf8')).keyData, 'fixture');
    assert.equal(fs.statSync(directory).mode & 0o777, 0o700);
    assert.equal(fs.statSync(path.join(directory, 'creds.json')).mode & 0o777, 0o600);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

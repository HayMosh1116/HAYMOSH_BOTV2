const test = require('node:test');
const assert = require('node:assert/strict');
const AdmZip = require('adm-zip');
const { decodeSessionToken } = require('../mayel/sessionPayload');

function zipBuffer(entries) {
  const archive = new AdmZip();
  for (const [name, contents] of entries) archive.addFile(name, Buffer.from(contents));
  return archive.toBuffer();
}
function cypherToken(entries) {
  return `CYPHER-X:~${zipBuffer(entries).toString('base64')}`;
}
function traversalToken() {
  const archive = zipBuffer([['aa/bb/x.json', '{}']]);
  const local = archive.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  const central = archive.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  assert.notEqual(local, -1);
  assert.notEqual(central, -1);
  archive.write('aa/../x.json', local + 30, 'ascii');
  archive.write('aa/../x.json', central + 46, 'ascii');
  return `CYPHER-X:~${archive.toString('base64')}`;
}

test('decodes a Cypher-X ZIP token and restores nested Signal-key files', () => {
  const token = cypherToken([
    ['auth_info_baileys/creds.json', JSON.stringify({ registered: true })],
    ['auth_info_baileys/keys/pre-key-1.json', JSON.stringify({ keyData: 'fixture' })],
  ]);
  const decoded = decodeSessionToken(token);
  assert.equal(decoded.legacy, false);
  assert.deepEqual([...decoded.files.keys()].sort(), ['creds.json', 'keys/pre-key-1.json']);
  assert.equal(JSON.parse(decoded.files.get('creds.json').toString()).registered, true);
  assert.equal(JSON.parse(decoded.files.get('keys/pre-key-1.json').toString()).keyData, 'fixture');
});

test('rejects unsafe or incomplete ZIP auth archives', () => {
  assert.throws(() => decodeSessionToken(traversalToken()), /unsafe path/);
  assert.throws(() => decodeSessionToken(cypherToken([
    ['keys/pre-key-1.json', JSON.stringify({ keyData: 'fixture' })],
  ])), /missing creds\.json/);
});

test('rejects ZIP entries larger than the auth-file bound before extraction', () => {
  const large = JSON.stringify({ data: 'x'.repeat(2 * 1024 * 1024) });
  assert.throws(() => decodeSessionToken(cypherToken([['creds.json', large]])), /exceeds the allowed size/);
});

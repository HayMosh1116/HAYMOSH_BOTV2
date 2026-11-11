const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePairingNumber, requestPairingCode } = require('../mayel/pairingCode');

test('normalizes international phone numbers to digits and rejects invalid lengths', () => {
  assert.equal(normalizePairingNumber('+234 912-345-6789'), '2349123456789');
  assert.equal(normalizePairingNumber('1 (202) 555-0123'), '12025550123');
  assert.equal(normalizePairingNumber(''), null);
  assert.equal(normalizePairingNumber('123'), null);
  assert.equal(normalizePairingNumber('0123456789'), null);
  assert.equal(normalizePairingNumber('1234567890123456'), null);
});

test('requests a pairing code only for an unregistered session with a valid number', async () => {
  let receivedNumber;
  const socket = { async requestPairingCode(number) { receivedNumber = number; return 'ABCD-1234'; } };
  assert.equal(await requestPairingCode(socket, { registered: false }, '+234 912 345 6789'), 'ABCD-1234');
  assert.equal(receivedNumber, '2349123456789');
  assert.equal(await requestPairingCode(socket, { registered: true }, '+2349123456789'), null);
  assert.equal(await requestPairingCode(socket, { registered: false }, ''), null);
});

test('reports unsupported sockets and empty server responses', async () => {
  await assert.rejects(requestPairingCode({}, { registered: false }, '2349123456789'), /does not support pairing-code login/);
  await assert.rejects(requestPairingCode({ async requestPairingCode() { return ''; } }, { registered: false }, '2349123456789'), /empty pairing code/);
});

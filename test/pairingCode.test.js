const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePairingNumber, requestPairingCode } = require('../mayel/pairingCode');
const {
  MIN_PASSWORD_LENGTH,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  verifyPairingPassword,
  createPairingSession,
  isValidPairingSession,
  getPairingCookie,
} = require('../mayel/pairingPageAuth');

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

test('waits for the WhatsApp WebSocket to open before requesting a pairing code', async () => {
  let socketIsOpen = false;
  let requestCount = 0;
  const socket = {
    async waitForSocketOpen() { await Promise.resolve(); socketIsOpen = true; },
    async requestPairingCode(number) {
      assert.equal(socketIsOpen, true);
      assert.equal(number, '2349123456789');
      requestCount++;
      return 'ABCD-1234';
    },
  };
  assert.equal(await requestPairingCode(socket, { registered: false }, '+2349123456789'), 'ABCD-1234');
  assert.equal(requestCount, 1);
});

test('does not request a pairing code if the socket fails to open', async () => {
  let requestCount = 0;
  const socket = {
    async waitForSocketOpen() { throw new Error('Connection Closed'); },
    async requestPairingCode() { requestCount++; return 'ABCD-1234'; },
  };
  await assert.rejects(requestPairingCode(socket, { registered: false }, '2349123456789'), /Connection Closed/);
  assert.equal(requestCount, 0);
});

test('reports unsupported sockets and empty server responses', async () => {
  await assert.rejects(requestPairingCode({}, { registered: false }, '2349123456789'), /does not support pairing-code login/);
  await assert.rejects(requestPairingCode({ async requestPairingCode() { return ''; } }, { registered: false }, '2349123456789'), /empty pairing code/);
});

test('accepts only the configured password without requiring a username', () => {
  const password = 'a-private-pairing-password-42';
  assert.equal(verifyPairingPassword(password, password), true);
  assert.equal(verifyPairingPassword('wrong-password-value', password), false);
  assert.equal(verifyPairingPassword(password, 'too-short'), false);
  assert.equal(verifyPairingPassword(undefined, password), false);
  assert.equal(MIN_PASSWORD_LENGTH, 16);
});

test('creates a random short-lived pairing cookie session and extracts it safely', () => {
  const sessions = new Map();
  const now = 1_000_000;
  const token = createPairingSession(sessions, now);

  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(token, createPairingSession(sessions, now));
  assert.equal(isValidPairingSession(sessions, token, now), true);
  assert.equal(getPairingCookie(`theme=dark; ${SESSION_COOKIE_NAME}=${token}`), token);
  assert.equal(getPairingCookie('theme=dark'), null);
  assert.equal(SESSION_TTL_MS, 10 * 60 * 1000);
  assert.equal(isValidPairingSession(sessions, token, now + SESSION_TTL_MS), false);
  assert.equal(sessions.has(token), false);
});

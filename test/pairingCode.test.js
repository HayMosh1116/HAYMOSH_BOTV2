const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { normalizePairingNumber, requestPairingCode, createOnDemandPairingCodeRequester } = require('../mayel/pairingCode');
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


test('on-demand requester does not generate a code until explicitly called', async () => {
  let requestCount = 0;
  const socket = {};
  const credentials = { registered: false };
  const requestFresh = createOnDemandPairingCodeRequester({
    getSocket: () => socket,
    getCredentials: () => credentials,
    getPhoneNumber: () => '+234 912 345 6789',
    requestCode: async (s, creds, number) => {
      assert.equal(s, socket);
      assert.equal(creds, credentials);
      assert.equal(number, '2349123456789');
      requestCount++;
      return 'ABCD-1234';
    },
  });
  assert.equal(requestCount, 0);
  assert.equal(await requestFresh(), 'ABCD-1234');
  assert.equal(requestCount, 1);
});

test('simultaneous Get pairing code clicks share one WhatsApp request', async () => {
  let requestCount = 0;
  let releaseRequest;
  const socket = {};
  const credentials = { registered: false };
  const requestFresh = createOnDemandPairingCodeRequester({
    getSocket: () => socket,
    getCredentials: () => credentials,
    getPhoneNumber: () => '2349123456789',
    requestCode: async () => {
      requestCount++;
      await new Promise((resolve) => { releaseRequest = resolve; });
      return 'WXYZ-9876';
    },
  });
  const first = requestFresh();
  const second = requestFresh();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requestCount, 1);
  releaseRequest();
  assert.deepEqual(await Promise.all([first, second]), ['WXYZ-9876', 'WXYZ-9876']);
});

test('on-demand requester refuses registered sessions and rejects a code from a replaced socket', async () => {
  let requestCount = 0;
  const registeredCredentials = { registered: true };
  const registered = createOnDemandPairingCodeRequester({
    getSocket: () => ({}),
    getCredentials: () => registeredCredentials,
    getPhoneNumber: () => '2349123456789',
    requestCode: async () => { requestCount++; return 'ABCD-1234'; },
  });
  assert.equal(await registered(), null);
  assert.equal(requestCount, 0);

  let currentSocket = {};
  let releaseRequest;
  const credentials = { registered: false };
  const stale = createOnDemandPairingCodeRequester({
    getSocket: () => currentSocket,
    getCredentials: () => credentials,
    getPhoneNumber: () => '2349123456789',
    requestCode: () => new Promise((resolve) => { releaseRequest = () => resolve('ABCD-1234'); }),
  });
  const pending = stale();
  await new Promise((resolve) => setImmediate(resolve));
  currentSocket = {};
  releaseRequest();
  await assert.rejects(pending, /session changed/);
});


test('a later explicit request asks WhatsApp for a fresh code', async () => {
  let requestCount = 0;
  const socket = {};
  const credentials = { registered: false };
  const requestFresh = createOnDemandPairingCodeRequester({
    getSocket: () => socket,
    getCredentials: () => credentials,
    getPhoneNumber: () => '2349123456789',
    requestCode: async () => `CODE-${++requestCount}`,
  });
  assert.equal(await requestFresh(), 'CODE-1');
  assert.equal(await requestFresh(), 'CODE-2');
  assert.equal(requestCount, 2);
});

test('requester waits for the completed WhatsApp pairing challenge before calling Baileys', async () => {
  let ready = false;
  let requestCount = 0;
  const socket = {};
  const credentials = { registered: false };
  const requestFresh = createOnDemandPairingCodeRequester({
    getSocket: () => socket,
    getCredentials: () => credentials,
    getPhoneNumber: () => '2349123456789',
    isReady: () => ready,
    requestCode: async () => { requestCount++; return 'LIVE-CODE'; },
  });
  await assert.rejects(requestFresh(), /challenge is not ready/);
  assert.equal(requestCount, 0);
  ready = true;
  assert.equal(await requestFresh(), 'LIVE-CODE');
  assert.equal(requestCount, 1);
});

test('pairing page requires a user POST for code generation and keeps the route session-protected', () => {
  const source = fs.readFileSync(require.resolve('../index.js'), 'utf8');
  assert.match(source, /action="\/pairing\/code"/);
  assert.match(source, /app\.post\("\/pairing\/code"/);
  assert.match(source, /if \(!isPairingPageSessionValid\(req\)\)/);
  assert.match(source, /pairingCodeViewers\.has\(pairingSessionToken\)/);
  assert.match(source, /pairingCodeViewers\.add\(pairingSessionToken\)/);
  assert.match(source, /pairingHandshakeReady && !pairingCredentialsRegistered/);
  assert.match(source, /if \(!pairingHandshakeReady\)/);
  assert.doesNotMatch(source, /requestPairingCode\(Prince/);
  assert.doesNotMatch(source, /pairingCodeValue\s*=\s*await/);
});

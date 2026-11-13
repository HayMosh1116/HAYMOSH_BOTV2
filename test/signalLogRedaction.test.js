const test = require('node:test');
const assert = require('node:assert/strict');
const { installSignalLogRedaction } = require('../mayel/signalLogRedaction');

test('suppresses libsignal logs that include complete Signal session objects', () => {
  const calls = [];
  const fakeConsole = {
    info: (...args) => calls.push(['info', ...args]),
    warn: (...args) => calls.push(['warn', ...args]),
  };
  assert.equal(installSignalLogRedaction(fakeConsole), true);
  fakeConsole.info('Closing session:', { privateKey: 'do-not-forward' });
  fakeConsole.info('Removing old closed session:', { privateKey: 'do-not-forward' });
  fakeConsole.warn('Session already closed', { privateKey: 'do-not-forward' });
  fakeConsole.info('WhatsApp connection opened');
  fakeConsole.warn('Retrying after transient socket close');
  assert.deepEqual(calls.map(call => call[0]), ['info', 'warn']);
  assert.equal(calls[0][1], 'WhatsApp connection opened');
  assert.equal(calls[1][1], 'Retrying after transient socket close');
});

test('redaction install is idempotent for a console instance', () => {
  const fakeConsole = { info() {}, warn() {} };
  assert.equal(installSignalLogRedaction(fakeConsole), true);
  assert.equal(installSignalLogRedaction(fakeConsole), false);
});

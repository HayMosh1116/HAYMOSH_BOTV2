const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { getAuthDir } = require('../mayel/authDir');
const { loadSession } = require('../mayel/sessionBootstrap');
const { clearAuthDirectory } = require('../mayel/clearAuthDirectory');

function tempPath() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'haywhy-auth-test-'));
}

function silentLogger() {
  return { log() {}, warn() {} };
}

test('missing SESSION_ID initializes a private direct-login directory instead of failing startup', async () => {
  const root = tempPath();
  const authDir = path.join(root, 'wa-auth');
  try {
    const result = await loadSession({ sessionId: '', authDir, logger: silentLogger() });
    assert.equal(result.mode, 'direct');
    assert.equal(result.authDir, authDir);
    assert.equal(fs.existsSync(authDir), true);
    assert.equal(fs.statSync(authDir).mode & 0o777, 0o700);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('clears auth files without deleting the auth directory mount point', async () => {
  const root = tempPath();
  const authDir = path.join(root, 'mounted-auth');
  try {
    fs.mkdirSync(path.join(authDir, 'keys'), { recursive: true });
    fs.writeFileSync(path.join(authDir, 'creds.json'), '{"registered":false}');
    fs.writeFileSync(path.join(authDir, 'keys', 'pre-key-1.json'), '{}');

    await clearAuthDirectory(authDir);

    assert.equal(fs.existsSync(authDir), true);
    assert.deepEqual(fs.readdirSync(authDir), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('missing SESSION_ID reuses an already authenticated local creds.json', async () => {
  const root = tempPath();
  const authDir = path.join(root, 'wa-auth');
  try {
    fs.mkdirSync(authDir, { recursive: true });
    fs.writeFileSync(path.join(authDir, 'creds.json'), '{"registered":true}');
    const result = await loadSession({ sessionId: '', authDir, logger: silentLogger() });
    assert.equal(result.mode, 'local');
    assert.equal(fs.readFileSync(path.join(authDir, 'creds.json'), 'utf8'), '{"registered":true}');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rejects unsafe auth roots but accepts a dedicated mounted subdirectory', () => {
  assert.equal(getAuthDir(''), path.join(__dirname, '..', 'mayel', 'session'));
  assert.equal(getAuthDir(path.join(os.tmpdir(), 'whatsapp-auth')), path.resolve(os.tmpdir(), 'whatsapp-auth'));
  assert.throws(() => getAuthDir(path.parse(process.cwd()).root), /filesystem root/);
  assert.throws(() => getAuthDir(path.resolve(__dirname, '..')), /inside\/above the bot application directory/);
  assert.throws(() => getAuthDir(path.join(path.resolve(__dirname, '..'), 'auth')), /inside\/above the bot application directory/);
});

test('refuses to import a token already marked logged out by WhatsApp', async () => {
  const root = tempPath();
  const authDir = path.join(root, 'wa-auth');
  const invalidatedPath = path.join(root, 'invalidated');
  const sessionId = 'not-a-real-token';
  try {
    fs.mkdirSync(authDir, { recursive: true });
    const hash = crypto.createHash('sha256').update(sessionId).digest('hex');
    fs.writeFileSync(invalidatedPath, hash);
    await assert.rejects(
      loadSession({ sessionId, authDir, invalidatedPath, logger: silentLogger() }),
      /logged out by WhatsApp/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

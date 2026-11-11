const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { authDir: defaultAuthDir, getAuthDir } = require('./authDir');
const { decodeSessionToken, writeAuthFiles } = require('./sessionPayload');

async function loadSession(options = {}) {
  const input = options.sessionId === undefined ? (process.env.SESSION_ID || '') : options.sessionId;
  if (input != null && typeof input !== 'string') {
    throw new Error('SESSION_ID must be a string when supplied.');
  }
  const id = typeof input === 'string' ? input.trim() : '';
  const sessionDir = options.authDir === undefined ? defaultAuthDir : getAuthDir(options.authDir);
  const log = options.logger || console;
  const sessionPath = path.join(sessionDir, 'creds.json');

  await fs.promises.mkdir(sessionDir, { recursive: true, mode: 0o700 });
  await fs.promises.chmod(sessionDir, 0o700);

  if (!id) {
    if (fs.existsSync(sessionPath)) {
      log.log('📡 Session      : ♻️ Reusing local WhatsApp auth; SESSION_ID is not required.');
      return { mode: 'local', authDir: sessionDir };
    }
    log.log('📡 Session      : 📷 Direct login enabled. A pairing code or QR will be printed in the hosting logs.');
    return { mode: 'direct', authDir: sessionDir };
  }

  const idHash = crypto.createHash('sha256').update(id).digest('hex');
  const markerPath = path.join(sessionDir, '.session_id_hash');
  const invalidatedPath = options.invalidatedPath || path.join(__dirname, '.session-invalidated');
  if (fs.existsSync(invalidatedPath) && fs.readFileSync(invalidatedPath, 'utf8').trim() === idHash) {
    throw new Error('This SESSION_ID was logged out by WhatsApp. Remove it or configure a new session token.');
  }
  if (fs.existsSync(sessionPath) && fs.existsSync(markerPath) &&
      fs.readFileSync(markerPath, 'utf8').trim() === idHash) {
    log.log('📡 Session      : ♻️ Reusing saved session state');
    return { mode: 'local', authDir: sessionDir };
  }

  const { files, legacy } = decodeSessionToken(id);
  // Do not replace local credentials until the replacement token is fully validated.
  writeAuthFiles(files, sessionDir);
  fs.writeFileSync(markerPath, idHash, { mode: 0o600 });
  if (fs.existsSync(invalidatedPath)) fs.rmSync(invalidatedPath, { force: true });
  const additionalAuthFiles = [...files.keys()].filter((file) => file !== 'creds.json').length;
  log.log(`📡 Session      : 🔑 Imported creds.json and ${additionalAuthFiles} additional auth file(s)${legacy ? ' from a legacy token' : ' from an archive token'}`);
  if (additionalAuthFiles === 0) {
    log.warn('⚠️ Session token contains no additional Signal-key files; WhatsApp may reject or fail to decrypt this session.');
  }
  return { mode: 'token', authDir: sessionDir, additionalAuthFiles };
}

module.exports = { loadSession };

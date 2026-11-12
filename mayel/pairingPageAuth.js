const crypto = require('crypto');

const MIN_PASSWORD_LENGTH = 16;
const SESSION_COOKIE_NAME = 'haywhy_pairing_session';
const SESSION_TTL_MS = 10 * 60 * 1000;
const MAX_SESSIONS = 1000;

function verifyPairingPassword(suppliedPassword, configuredPassword) {
  if (typeof configuredPassword !== 'string' || configuredPassword.length < MIN_PASSWORD_LENGTH) return false;
  if (typeof suppliedPassword !== 'string') return false;
  const supplied = Buffer.from(suppliedPassword);
  const expected = Buffer.from(configuredPassword);
  if (supplied.length !== expected.length) return false;
  return crypto.timingSafeEqual(supplied, expected);
}

function createPairingSession(sessions, now = Date.now()) {
  for (const [token, expiresAt] of sessions) {
    if (expiresAt <= now) sessions.delete(token);
  }
  while (sessions.size >= MAX_SESSIONS) {
    const oldestToken = sessions.keys().next().value;
    if (oldestToken === undefined) break;
    sessions.delete(oldestToken);
  }
  const token = crypto.randomBytes(32).toString('base64url');
  sessions.set(token, now + SESSION_TTL_MS);
  return token;
}

function isValidPairingSession(sessions, token, now = Date.now()) {
  if (typeof token !== 'string' || !token) return false;
  const expiresAt = sessions.get(token);
  if (!expiresAt) return false;
  if (expiresAt <= now) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function getPairingCookie(cookieHeader) {
  if (typeof cookieHeader !== 'string') return null;
  const prefix = `${SESSION_COOKIE_NAME}=`;
  const entry = cookieHeader.split(';').map(value => value.trim()).find(value => value.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : null;
}

module.exports = {
  MIN_PASSWORD_LENGTH,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  verifyPairingPassword,
  createPairingSession,
  isValidPairingSession,
  getPairingCookie,
};

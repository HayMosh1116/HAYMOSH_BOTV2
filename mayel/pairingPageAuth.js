const crypto = require('crypto');

const MIN_PASSWORD_LENGTH = 16;

function isAuthorizedPairingRequest(authorizationHeader, configuredPassword) {
  if (typeof configuredPassword !== 'string' || configuredPassword.length < MIN_PASSWORD_LENGTH) return false;
  if (typeof authorizationHeader !== 'string' || !authorizationHeader.startsWith('Basic ')) return false;

  let decoded;
  try {
    decoded = Buffer.from(authorizationHeader.slice(6), 'base64').toString('utf8');
  } catch (_) {
    return false;
  }

  const separator = decoded.indexOf(':');
  if (separator < 0 || decoded.slice(0, separator) !== 'pairing') return false;
  const suppliedPassword = Buffer.from(decoded.slice(separator + 1));
  const expectedPassword = Buffer.from(configuredPassword);
  if (suppliedPassword.length !== expectedPassword.length) return false;
  return crypto.timingSafeEqual(suppliedPassword, expectedPassword);
}

module.exports = { MIN_PASSWORD_LENGTH, isAuthorizedPairingRequest };

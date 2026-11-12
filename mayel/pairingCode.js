function normalizePairingNumber(value) {
  if (typeof value !== 'string') return null;
  const digits = value.trim().replace(/\D/g, '');
  return /^[1-9]\d{5,14}$/.test(digits) ? digits : null;
}

async function waitForSocketOpen(socket, timeoutMs) {
  if (typeof socket?.waitForSocketOpen !== 'function') return;
  let timer;
  try {
    await Promise.race([
      Promise.resolve().then(() => socket.waitForSocketOpen()),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Timed out waiting for the WhatsApp socket to open.')), timeoutMs);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function requestPairingCode(socket, credentials, phoneNumber, options = {}) {
  const normalizedNumber = normalizePairingNumber(phoneNumber);
  if (!normalizedNumber || credentials?.registered) return null;
  if (typeof socket?.requestPairingCode !== 'function') {
    throw new Error('This WhatsApp socket does not support pairing-code login.');
  }
  await waitForSocketOpen(socket, options.timeoutMs ?? 15000);
  const code = await socket.requestPairingCode(normalizedNumber);
  if (typeof code !== 'string' || !code.trim()) {
    throw new Error('WhatsApp returned an empty pairing code.');
  }
  return code.trim();
}

function createOnDemandPairingCodeRequester({ getSocket, getCredentials, getPhoneNumber, isReady = () => true, requestCode = requestPairingCode }) {
  let inFlight = null;
  return async function requestFreshPairingCode() {
    if (inFlight) return inFlight;
    const socket = getSocket?.();
    const credentials = getCredentials?.();
    const phoneNumber = normalizePairingNumber(getPhoneNumber?.());
    if (!phoneNumber) throw new Error('PAIRING_NUMBER is missing or invalid.');
    if (!socket || !credentials) throw new Error('WhatsApp is not ready for pairing-code login yet.');
    if (credentials.registered) return null;
    if (!isReady(socket, credentials)) throw new Error('WhatsApp pairing challenge is not ready yet.');

    const pending = Promise.resolve()
      .then(() => requestCode(socket, credentials, phoneNumber))
      .then((code) => {
        if (socket !== getSocket?.() || credentials !== getCredentials?.() || credentials.registered || !isReady(socket, credentials)) {
          throw new Error('WhatsApp session changed while requesting the pairing code.');
        }
        return code;
      })
      .finally(() => { if (inFlight === pending) inFlight = null; });
    inFlight = pending;
    return pending;
  };
}

module.exports = { normalizePairingNumber, requestPairingCode, createOnDemandPairingCodeRequester };

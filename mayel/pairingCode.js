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

module.exports = { normalizePairingNumber, requestPairingCode };

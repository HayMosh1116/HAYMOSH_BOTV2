const INSTALL_MARKER = Symbol.for('haywhy.signalSessionLogRedaction.installed');
const SENSITIVE_SESSION_LOG = /^(?:Closing session:|Opening session:|Removing old closed session:|Session already closed\b)/;

function installSignalLogRedaction(targetConsole = console) {
  if (!targetConsole || targetConsole[INSTALL_MARKER]) return false;

  for (const method of ['info', 'warn']) {
    if (typeof targetConsole[method] !== 'function') continue;
    const original = targetConsole[method].bind(targetConsole);
    targetConsole[method] = (...args) => {
      if (typeof args[0] === 'string' && SENSITIVE_SESSION_LOG.test(args[0])) return;
      return original(...args);
    };
  }

  Object.defineProperty(targetConsole, INSTALL_MARKER, { value: true });
  return true;
}

module.exports = { installSignalLogRedaction };

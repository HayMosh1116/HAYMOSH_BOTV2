const DEFAULT_DEDUPE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_DEDUPE_MAX_ENTRIES = 20000;

function unwrapMessageContent(input) {
  let message = input?.message || input || {};
  for (let depth = 0; depth < 6; depth += 1) {
    const wrapped =
      message.ephemeralMessage?.message ||
      message.viewOnceMessage?.message ||
      message.viewOnceMessageV2?.message ||
      message.viewOnceMessageV2Extension?.message ||
      message.deviceSentMessage?.message ||
      message.documentWithCaptionMessage?.message;
    if (!wrapped || wrapped === message) break;
    message = wrapped;
  }
  return message;
}

function extractMessageText(input) {
  const message = unwrapMessageContent(input);
  const candidates = [
    message.conversation,
    message.extendedTextMessage?.text,
    message.imageMessage?.caption,
    message.videoMessage?.caption,
    message.documentMessage?.caption,
    message.buttonsResponseMessage?.selectedButtonId,
    message.listResponseMessage?.singleSelectReply?.selectedRowId,
    message.templateButtonReplyMessage?.selectedId,
  ];
  return candidates.find((value) => typeof value === "string") || "";
}

function messageIdentity(message) {
  const key = message?.key;
  if (!key?.id) return null;
  return JSON.stringify([
    String(key.remoteJid || ""),
    String(key.participant || key.participantPn || ""),
    String(key.id),
  ]);
}

function createMessageDeduplicator(options = {}) {
  const ttlMs = Number.isFinite(options.ttlMs) && options.ttlMs > 0
    ? Math.floor(options.ttlMs)
    : DEFAULT_DEDUPE_TTL_MS;
  const maxEntries = Number.isFinite(options.maxEntries) && options.maxEntries > 0
    ? Math.floor(options.maxEntries)
    : DEFAULT_DEDUPE_MAX_ENTRIES;
  const seen = new Map();

  function shouldProcess(message, now = Date.now()) {
    for (const [identity, seenAt] of seen) {
      if (now - seenAt <= ttlMs) break;
      seen.delete(identity);
    }

    const identity = messageIdentity(message);
    if (!identity) return true;
    if (seen.has(identity)) return false;

    seen.set(identity, now);
    while (seen.size > maxEntries) {
      seen.delete(seen.keys().next().value);
    }
    return true;
  }

  return {
    shouldProcess,
    filterNotify(messages, type, now = Date.now()) {
      if (type !== "notify" || !Array.isArray(messages)) return [];
      return messages.filter((message) => shouldProcess(message, now));
    },
    clear() {
      seen.clear();
    },
    get size() {
      return seen.size;
    },
  };
}

module.exports = {
  createMessageDeduplicator,
  extractMessageText,
  messageIdentity,
};

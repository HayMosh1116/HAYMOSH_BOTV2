// Shared in-memory media cache.
// WhatsApp media (especially view-once and deleted messages) can only be
// downloaded while the original message still carries a valid mediaKey and
// the CDN link is alive. Quoted copies have the key stripped ("Cannot derive
// from empty media key") and deleted messages lose their link. So we download
// the media once, as soon as the message arrives, and keep the bytes here.

const { downloadMediaMessage } = require("prince-baileys");
const logger = require("prince-baileys/lib/Utils/logger").default.child({});

const TTL_MS = 60 * 60 * 1000; // keep for 1 hour
const MAX_ITEM = 16 * 1024 * 1024; // skip files above 16 MB
const MAX_TOTAL = 150 * 1024 * 1024; // total memory cap
const DOWNLOAD_TIMEOUT_MS = 30 * 1000; // never leave recovery waiting forever

const MEDIA_TYPES = ["imageMessage", "videoMessage", "audioMessage", "stickerMessage", "documentMessage"];

const cache = new Map(); // id -> { buffer, type, media, ts }
const pending = new Map(); // id -> Promise (dedupe concurrent downloads)
let totalBytes = 0;

// Short notes about why a message could not be cached ("arrived without a media key",
// "download failed: ...") so a failed reveal can tell the owner the real reason.
const notes = new Map(); // id -> { text, ts }
function note(id, text) {
    if (!id) return;
    notes.set(id, { text, ts: Date.now() });
    if (notes.size > 500) notes.delete(notes.keys().next().value);
}
// Ask the primary phone to resend a message that arrived as an empty placeholder.
// Group requests retain participant; the response arrives as another messages.upsert.
const resendRequests = new Map();
async function requestPlaceholderResend(Prince, key) {
    if (typeof Prince?.requestPlaceholderResend !== 'function' || !key?.remoteJid || !key?.id) return { requested: false };
    const requestKey = key.remoteJid + '|' + key.id;
    if (resendRequests.has(requestKey)) return resendRequests.get(requestKey);
    const messageKey = { remoteJid: key.remoteJid, id: key.id, fromMe: Boolean(key.fromMe), ...(key.participant ? { participant: key.participant } : {}) };
    const request = Promise.resolve().then(() => Prince.requestPlaceholderResend(messageKey))
        .then((requestId) => ({ requested: true, requestId }))
        .catch((error) => ({ requested: false, error }));
    resendRequests.set(requestKey, request);
    request.finally(() => { const timer = setTimeout(() => resendRequests.delete(requestKey), 10000); timer.unref?.(); });
    return request;
}

function getNote(id) {
    const n = id && notes.get(id);
    if (!n) return null;
    if (Date.now() - n.ts > TTL_MS) { notes.delete(id); return null; }
    return n.text;
}

function unwrapMessage(message) {
    let m = message || {};
    let viewOnce = false;
    for (let i = 0; i < 6; i++) {
        if (m.viewOnceMessage || m.viewOnceMessageV2 || m.viewOnceMessageV2Extension) viewOnce = true;
        const inner =
            m.ephemeralMessage?.message ||
            m.viewOnceMessage?.message ||
            m.viewOnceMessageV2?.message ||
            m.viewOnceMessageV2Extension?.message ||
            m.documentWithCaptionMessage?.message ||
            m.deviceSentMessage?.message ||
            m.futureProofMessage?.message ||
            m.associatedChildMessage?.message ||
            m.groupMentionedMessage?.message ||
            m.botInvokeMessage?.message ||
            m.editedMessage?.message ||
            m.protocolMessage?.editedMessage;
        if (!inner) break;
        m = inner;
    }
    const type = MEDIA_TYPES.find((t) => m[t]);
    if (type && m[type]?.viewOnce) viewOnce = true;
    return { message: m, type: type || null, media: type ? m[type] : null, viewOnce };
}

// Finds the contextInfo (quote/reply data) of a message, whatever wrapper
// (ephemeral, device-sent, view-once...) or content type it uses.
function getContextInfo(message) {
    const { message: m } = unwrapMessage(message);
    for (const value of Object.values(m || {})) {
        if (value && typeof value === "object" && value.contextInfo) return value.contextInfo;
    }
    return null;
}

// Plain text of a message (conversation / extended text / captions), unwrapped.
function getText(message) {
    const { message: m } = unwrapMessage(message);
    return String(
        m?.conversation || m?.extendedTextMessage?.text ||
        m?.imageMessage?.caption || m?.videoMessage?.caption || "",
    );
}

function hasMediaKey(media) {
    const k = media?.mediaKey;
    if (!k) return false;
    if (typeof k === "string") return k.length > 0;
    return (k.length ?? k.byteLength ?? Object.keys(k).length) > 0;
}

function evict() {
    const now = Date.now();
    for (const [id, v] of cache) {
        if (now - v.ts > TTL_MS || totalBytes > MAX_TOTAL) {
            cache.delete(id);
            totalBytes -= v.buffer.length;
        } else if (totalBytes <= MAX_TOTAL) {
            break; // Map keeps insertion order: the rest are newer
        }
    }
}

function get(id) {
    const v = id && cache.get(id);
    if (!v) return null;
    if (Date.now() - v.ts > TTL_MS) {
        cache.delete(id);
        totalBytes -= v.buffer.length;
        return null;
    }
    return v;
}

/**
 * Downloads and caches the media of a message (if any). Safe to call many
 * times: repeated or concurrent calls for the same id reuse the result.
 * Resolves to the cache entry or null. Never throws.
 */
function prefetch(Prince, ms) {
    try {
        const id = ms?.key?.id;
        if (!id || !ms.message) return Promise.resolve(null);
        const existing = get(id);
        if (existing) return Promise.resolve(existing);
        if (pending.has(id)) return pending.get(id);

        const { type, media } = unwrapMessage(ms.message);
        if (!type || !hasMediaKey(media)) {
            if (type) note(id, "the message reached the bot without its media key (WhatsApp stripped it)");
            return Promise.resolve(null);
        }
        const size = Number(media.fileLength || 0);
        if (size && size > MAX_ITEM) {
            note(id, `the file is larger than ${MAX_ITEM / (1024 * 1024)} MB`);
            return Promise.resolve(null);
        }

        const download = downloadMediaMessage(
            { key: ms.key, message: { [type]: media } },
            "buffer",
            {},
            { logger, reuploadRequest: Prince.updateMediaMessage },
        );
        let timer;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => {
                const err = new Error(`media download timed out after ${DOWNLOAD_TIMEOUT_MS / 1000}s`);
                err.code = "media_download_timeout";
                reject(err);
            }, DOWNLOAD_TIMEOUT_MS);
            timer.unref?.();
        });
        const p = Promise.race([download, timeout])
            .finally(() => clearTimeout(timer))
            .then((buffer) => {
                if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_ITEM) return null;
                const entry = { buffer, type, media, ts: Date.now() };
                notes.delete(id);
                cache.set(id, entry);
                totalBytes += buffer.length;
                evict();
                return entry;
            })
            .catch((e) => {
                console.error("Media prefetch failed:", e.message);
                note(id, `the download failed (${e.message})`);
                return null;
            })
            .finally(() => pending.delete(id));
        pending.set(id, p);
        return p;
    } catch (e) {
        return Promise.resolve(null);
    }
}

/** Waits for an in-flight download, or returns the cached entry. */
async function getOrWait(id) {
    if (pending.has(id)) await pending.get(id);
    return get(id);
}

/** Wait briefly for a placeholder-resend response to arrive as a new upsert. */
async function waitFor(id, timeoutMs = 8000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const entry = await getOrWait(id);
        if (entry) return entry;
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return get(id);
}

/** Builds a sendMessage payload from a cached entry. */
function toSendContent(entry, caption) {
    const { buffer, type, media } = entry;
    const cap = caption !== undefined ? caption : media.caption || "";
    const mimetype = media.mimetype;
    switch (type) {
        case "imageMessage": return { image: buffer, caption: cap, mimetype: mimetype || "image/jpeg" };
        case "videoMessage": return { video: buffer, caption: cap, mimetype: mimetype || "video/mp4", gifPlayback: !!media.gifPlayback };
        case "audioMessage": return { audio: buffer, mimetype: mimetype || "audio/mp4", ptt: !!media.ptt };
        case "stickerMessage": return { sticker: buffer };
        default: return { document: buffer, mimetype: mimetype || "application/octet-stream", fileName: media.fileName || "file", caption: cap };
    }
}

module.exports = { prefetch, get, getOrWait, waitFor, requestPlaceholderResend, unwrapMessage, getContextInfo, getText, hasMediaKey, toSendContent, note, getNote };

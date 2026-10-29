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

const MEDIA_TYPES = ["imageMessage", "videoMessage", "audioMessage", "stickerMessage", "documentMessage"];

const cache = new Map(); // id -> { buffer, type, media, ts }
const pending = new Map(); // id -> Promise (dedupe concurrent downloads)
let totalBytes = 0;

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
            m.editedMessage?.message;
        if (!inner) break;
        m = inner;
    }
    const type = MEDIA_TYPES.find((t) => m[t]);
    if (type && m[type]?.viewOnce) viewOnce = true;
    return { message: m, type: type || null, media: type ? m[type] : null, viewOnce };
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
        if (!type || !hasMediaKey(media)) return Promise.resolve(null);
        const size = Number(media.fileLength || 0);
        if (size && size > MAX_ITEM) return Promise.resolve(null);

        const p = downloadMediaMessage(
            { key: ms.key, message: { [type]: media } },
            "buffer",
            {},
            { logger, reuploadRequest: Prince.updateMediaMessage },
        )
            .then((buffer) => {
                if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_ITEM) return null;
                const entry = { buffer, type, media, ts: Date.now() };
                cache.set(id, entry);
                totalBytes += buffer.length;
                evict();
                return entry;
            })
            .catch((e) => {
                console.error("Media prefetch failed:", e.message);
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

module.exports = { prefetch, get, getOrWait, unwrapMessage, hasMediaKey, toSendContent };

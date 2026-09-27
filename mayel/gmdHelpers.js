const config = require("../config");

const createContext = (userJid, options = {}) => ({
    contextInfo: {
        mentionedJid: [userJid],
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: config.NEWSLETTER_JID,
            newsletterName: config.BOT_NAME,
            serverMessageId: 0
        },
        externalAdReply: {
            title: options.title || config.BOT_NAME,
            body: options.body || config.FOOTER,
            thumbnailUrl: config.BOT_PIC,
            mediaType: 1,
            mediaUrl: options.mediaUrl || config.BOT_PIC,
            sourceUrl: options.sourceUrl || config.NEWSLETTER_URL,
            showAdAttribution: true,
            renderLargerThumbnail: false
        }
    }
});


const createContext2 = (userJid, options = {}) => ({
    contextInfo: {
        mentionedJid: [userJid],
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: config.NEWSLETTER_JID,
            newsletterName: config.BOT_NAME,
            serverMessageId: 0
        },
        externalAdReply: {
            title: options.title || config.BOT_NAME,
            body: options.body || config.FOOTER,
            thumbnailUrl: config.BOT_PIC,
            mediaType: 1,
            showAdAttribution: true,
            renderLargerThumbnail: true
        }
    }
});


// Minimal context — no channel link (used everywhere except downloaders)
const getContextInfo = () => ({});

// Channel context — shows newsletter/channel link (downloaders only)
const getChannelContext = () => ({
    forwardingScore: 1,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: config.NEWSLETTER_JID,
        newsletterName: config.NEWSLETTER_NAME,
        serverMessageId: 1
    },
});

// ---------------------------------------------------------------------------
// GLOBAL WHATSAPP MENTION HELPER
// WhatsApp only renders a real (blue, tappable) mention when BOTH are true:
//   1. the visible text contains "@<user>" where <user> is the JID user part
//   2. the exact same JID is listed in mentions / contextInfo.mentionedJid
// If either side is missing or they disagree (phone vs LID, device suffix
// ":12", double "@s.whatsapp.net"), WhatsApp prints the raw number instead.
// Every outgoing message passes through normalizeMentionedContent (wired at
// the socket boundary in index.js), so all commands inherit correct mentions.
// ---------------------------------------------------------------------------
const mentionGroupCache = new Map(); // short-lived metadata cache only (not settings)
const MENTION_GROUP_CACHE_TTL = 5 * 60 * 1000;

/** Normalize anything (jid, "234..", "234..:5@s.whatsapp.net", "x@lid") to a clean JID. */
function toMentionJid(value) {
    if (!value) return "";
    let v = String(value).trim().replace(/^@+/, "");
    if (!v) return "";
    let [user, server] = v.split("@");
    user = (user || "").split(":")[0];
    if (!server) {
        user = user.replace(/\D/g, "");
        if (!user) return "";
        return user + "@s.whatsapp.net";
    }
    server = server.toLowerCase();
    if (server === "c.us") server = "s.whatsapp.net";
    return user + "@" + server;
}

/** Visible token for a JID: "@2348012345678" (or "@<lid>" for LID users). */
function mentionTag(jid) {
    const clean = toMentionJid(jid);
    return clean ? "@" + clean.split("@")[0] : "@member";
}

/** Build { text, mentions } from a template. Usage: buildMention`Hi ${jid}` is not needed — use tag(). */
function withMentions(text, jids = []) {
    const mentions = [...new Set((jids || []).map(toMentionJid).filter(Boolean))];
    return { text, mentions };
}

async function getGroupMeta(remoteJid, Prince) {
    if (!remoteJid?.endsWith("@g.us") || !Prince?.groupMetadata) return null;
    let cached = mentionGroupCache.get(remoteJid);
    if (!cached || Date.now() - cached.loadedAt > MENTION_GROUP_CACHE_TTL) {
        try {
            cached = { loadedAt: Date.now(), group: await Prince.groupMetadata(remoteJid) };
            mentionGroupCache.set(remoteJid, cached);
        } catch (_) {
            return null;
        }
    }
    return cached.group;
}

function participantIds(p) {
    return [p.id, p.pn, p.lid, p.phoneNumber, p.jid].filter(Boolean).map(toMentionJid);
}

async function getMentionName(remoteJid, jid, { Prince, store } = {}) {
    const clean = toMentionJid(jid);
    if (!clean) return "member";
    const rec = store?.contacts?.get?.(clean);
    const n = rec && (rec.notify || rec.name || rec.verifiedName);
    if (n && !/^\d+$/.test(n)) return String(n);
    const meta = await getGroupMeta(remoteJid, Prince);
    const p = meta?.participants?.find((x) => participantIds(x).includes(clean));
    if (p && (p.notify || p.name)) return String(p.notify || p.name);
    return clean.split("@")[0];
}

/**
 * Makes text tokens and mentionedJid agree:
 *  - cleans every mentioned JID (device suffix, c.us, bare numbers)
 *  - if text has "@<phone>" but the listed JID is that user's LID (or vice
 *    versa), rewrites the token to match the JID actually listed
 *  - any "@<digits>" token in the text with no JID listed gets its JID added
 *    (resolved against group participants so LID users work), so commands
 *    that forgot `mentions` still produce real mentions.
 */
async function normalizeMentionedContent(remoteJid, content, options = {}) {
    if (!content || typeof content !== "object") return content;
    const field = typeof content.text === "string" ? "text" : typeof content.caption === "string" ? "caption" : null;
    const ctx = content.contextInfo || {};
    let mentioned = [
        ...(Array.isArray(content.mentions) ? content.mentions : []),
        ...(Array.isArray(ctx.mentionedJid) ? ctx.mentionedJid : []),
    ].map(toMentionJid).filter(Boolean);
    const text = field ? content[field] : "";
    const tokens = field ? [...text.matchAll(/@(\d{6,})/g)].map((m) => m[1]) : [];
    if (!mentioned.length && !tokens.length) return content;

    const meta = tokens.length || mentioned.length ? await getGroupMeta(remoteJid, options.Prince) : null;
    const parts = meta?.participants || [];
    let newText = text;

    // Tokens without a matching mentioned JID
    for (const digits of [...new Set(tokens)]) {
        if (mentioned.some((j) => j.split("@")[0] === digits)) continue;
        const p = parts.find((x) => participantIds(x).some((id) => id.split("@")[0] === digits));
        if (p) {
            const ids = participantIds(p);
            const listed = mentioned.find((j) => ids.includes(j));
            if (listed) {
                // Token uses phone but JID listed is LID (or reverse): align token
                newText = newText.replace(new RegExp("@" + digits + "(?!\\d)", "g"), mentionTag(listed));
            } else {
                mentioned.push(toMentionJid(p.id));
                const idUser = toMentionJid(p.id).split("@")[0];
                if (idUser !== digits) newText = newText.replace(new RegExp("@" + digits + "(?!\\d)", "g"), "@" + idUser);
            }
        } else if (digits.length <= 15) {
            mentioned.push(digits + "@s.whatsapp.net");
        }
    }
    // Mentioned JIDs with no token in text: nothing to rewrite (WhatsApp ignores them)
    mentioned = [...new Set(mentioned)];
    const normalized = { ...content, mentions: mentioned };
    if (field) normalized[field] = newText;
    if (content.contextInfo) normalized.contextInfo = { ...ctx, mentionedJid: mentioned };
    return normalized;
}
module.exports = {
    createContext,
    createContext2,
    getContextInfo,
    getChannelContext,
    normalizeMentionedContent,
    getMentionName,
    toMentionJid,
    mentionTag,
    withMentions,
};

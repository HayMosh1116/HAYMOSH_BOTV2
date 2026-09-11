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
// Global WhatsApp mention normalizer
// Commands may build mention text from a JID, a phone number, or a participant
// id. Baileys still needs the real JID in mentions/mentionedJid for the
// notification to work, but the visible text should use the WhatsApp name.
// This normalizer is applied at the socket boundary so new commands inherit it.
// ---------------------------------------------------------------------------
const mentionGroupCache = new Map();
const MENTION_GROUP_CACHE_TTL = 5 * 60 * 1000;

function canonicalMentionJid(value) {
    if (!value) return "";
    return String(value).trim();
}

function mentionJidVariants(jid) {
    const value = canonicalMentionJid(jid);
    if (!value) return [];
    const [user] = value.split("@");
    const base = user.split(":")[0];
    return [...new Set([value, base + "@s.whatsapp.net", base + "@c.us", base])];
}

function cleanMentionName(value) {
    if (value === undefined || value === null) return null;
    const name = String(value).replace(/\s+/g, " ").trim().replace(/^@+/, "");
    if (!name) return null;
    if (/^(?:\d{5,}|\d+:\d+|[^\s@]+@[^\s@]+)$/.test(name)) return null;
    return name;
}

function readMentionName(record) {
    if (!record) return null;
    for (const candidate of [record.notify, record.pushName, record.name, record.verifiedName, record.vname]) {
        const name = cleanMentionName(candidate);
        if (name) return name;
    }
    return null;
}

async function getMentionName(remoteJid, jid, { Prince, store } = {}) {
    const variants = mentionJidVariants(jid);
    if (!variants.length) return "member";
    for (const variant of variants) {
        const record = store?.contacts?.get?.(variant);
        const name = readMentionName(record);
        if (name) return name;
    }
    if (remoteJid?.endsWith("@g.us") && Prince?.groupMetadata) {
        let metadata = mentionGroupCache.get(remoteJid);
        if (!metadata || Date.now() - metadata.loadedAt > MENTION_GROUP_CACHE_TTL) {
            try {
                metadata = { loadedAt: Date.now(), group: await Prince.groupMetadata(remoteJid) };
                mentionGroupCache.set(remoteJid, metadata);
            } catch (_) {
                metadata = null;
            }
        }
        const participant = metadata?.group?.participants?.find((entry) => {
            const ids = [entry.id, entry.pn, entry.lid, entry.phoneNumber].filter(Boolean);
            return ids.some((id) => variants.includes(String(id)) || variants.includes(String(id).split("@")[0]));
        });
        const name = readMentionName(participant);
        if (name) return name;
    }
    return "member";
}

function replaceMentionToken(value, jid, displayName) {
    if (typeof value !== "string") return value;
    let result = value;
    const variants = mentionJidVariants(jid).sort((a, b) => b.length - a.length);
    for (const variant of variants) {
        const specialCharacters = new Set(["\\", "^", "$", ".", "*", "+", "?", "(", ")", "[", "]", "{", "}", "|"]);
        const escaped = [...variant].map((character) => specialCharacters.has(character) ? "\\" + character : character).join("");
        const pattern = variant.includes("@")
            ? new RegExp("@" + escaped, "gi")
            : new RegExp("@" + escaped + "(?!\\d)", "g");
        result = result.replace(pattern, "@" + displayName);
    }
    return result;
}

async function normalizeMentionedContent(remoteJid, content, options = {}) {
    if (!content || typeof content !== "object") return content;
    const contextInfo = content.contextInfo || {};
    const mentioned = [...new Set([
        ...(Array.isArray(content.mentions) ? content.mentions : []),
        ...(Array.isArray(contextInfo.mentionedJid) ? contextInfo.mentionedJid : []),
    ].filter(Boolean).map(canonicalMentionJid))];
    if (!mentioned.length) return content;
    const normalized = { ...content };
    for (const jid of mentioned) {
        const name = await getMentionName(remoteJid, jid, options);
        if (typeof normalized.text === "string") normalized.text = replaceMentionToken(normalized.text, jid, name);
        if (typeof normalized.caption === "string") normalized.caption = replaceMentionToken(normalized.caption, jid, name);
    }
    normalized.mentions = mentioned;
    if (Object.prototype.hasOwnProperty.call(content, "contextInfo")) {
        normalized.contextInfo = { ...contextInfo, mentionedJid: mentioned };
    }
    return normalized;
}
module.exports = {
    createContext,
    createContext2,
    getContextInfo,
    getChannelContext,
    normalizeMentionedContent,
    getMentionName,
};

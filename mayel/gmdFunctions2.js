const fs = require("fs-extra");
const path = require("path");
const { pipeline } = require("stream/promises");
const config = require("../config");
const { createContext, toMentionJid, mentionTag } = require("./gmdHelpers");
const { getSetting, addWarning, resetWarnings } = require("./gmdSudoUtil");
const logger = require("prince-baileys/lib/Utils/logger").default.child({});
const { isJidGroup, downloadMediaMessage, getContentType } = require("prince-baileys");
const mediaCache = require("./mediaCache");

const {
    CHATBOT: chatBot,
    ANTICALL: antiCall,
    ANTICALL_MSG: antiCallMsg,
    DM_PRESENCE: dmPresence,
    GC_PRESENCE: groupPresence,
    MODE: botMode, 
    FOOTER: botFooter,
    BOT_NAME: botName,
    BOT_PIC: botPic, 
    TIME_ZONE: tZ,
    ANTIDELETE: antiDelete,
} = config;

const isAnyLink = (message) => {
    const linkPattern = /https?:\/\/[^\s]+/;
    return linkPattern.test(message);
};

const emojis = ['💘', '💝', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💔', '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍'];

const PrinceApiKey = 'prince_api_56yjJ568dte4';
const PrinceTechApi = 'https://api.princetechn.com';

async function PrinceAutoReact(emoji, ms, Prince) {
    try {
        await Prince.sendMessage(ms.key.remoteJid, { react: { text: emoji, key: ms.key } });
    } catch (error) {
        console.error('Error sending auto reaction:', error);
    }
}

const PrinceAntiLink = async (Prince, message, antiLink) => {
    try {
        if (!message?.message || message.key.fromMe) return;
        const from = message.key.remoteJid; 
        const sender = message.key.participant || message.key.remoteJid;
        if (!from.endsWith('@g.us') || antiLink === 'false') return;

        const groupMetadata = await Prince.groupMetadata(from);
        const isAdmin = groupMetadata.participants.find(p => p.id === sender)?.admin;
        if (isAdmin) return;

        const messageType = getContentType(message.message);
        const body = messageType === 'conversation' ? message.message.conversation : message.message[messageType]?.text || message.message[messageType]?.caption || '';
        if (!body || !isAnyLink(body)) return;

        await Prince.sendMessage(from, { delete: message.key });

        const pushName = message.pushName || message.key.pushName || sender.split('@')[0];
        const tag = `@${sender.split('@')[0]}`;

        if (antiLink === 'kick') {
            await Prince.groupParticipantsUpdate(from, [sender], 'remove');
            await Prince.sendMessage(from, {
                text: `⚠️ *${tag}*\nYour message contained a prohibited link.\n*Reason:* Anti-Link Protection\n*Action:* Kicked from group`,
                mentions: [sender]
            });
        } else if (antiLink === 'delete') {
            await Prince.sendMessage(from, {
                text: `⚠️ *${tag}*\nYour message contained a prohibited link.\n*Reason:* Anti-Link Protection\n*Action:* Message deleted`,
                mentions: [sender]
            });
        } else if (antiLink === 'warn') {
            const warnings = await addWarning(from, sender, "Anti-Link", "antilink", "bot");
            if (warnings >= 3) {
                await Prince.groupParticipantsUpdate(from, [sender], 'remove');
                await Prince.sendMessage(from, {
                    text: `🚫 *${tag}*\nYour message contained a prohibited link.\n*Reason:* Anti-Link Protection\n*Action:* Kicked (3 warnings reached)`,
                    mentions: [sender]
                });
                await resetWarnings(from, sender);
            } else {
                await Prince.sendMessage(from, {
                    text: `⚠️ *${tag}*\nYour message contained a prohibited link.\n*Reason:* Anti-Link Protection\n*+${warnings} Warning* (${warnings}/3)`,
                    mentions: [sender]
                });
            }
        }
    } catch (err) { console.error('Anti-link error:', err); }
};

const PrinceStatusMention = async (Prince, message, mode) => {
    try {
        if (!message?.message || message.key.fromMe) return;
        const from = message.key.remoteJid;
        const sender = message.key.participant || message.key.remoteJid;
        if (!from.endsWith('@g.us') || mode === 'false') return;

        const groupMetadata = await Prince.groupMetadata(from);
        const isAdmin = groupMetadata.participants.find(p => p.id === sender)?.admin;
        if (isAdmin) return;
        
        await Prince.sendMessage(from, { delete: message.key });

        const tag = `@${sender.split('@')[0]}`;

        if (mode === 'kick') {
            await Prince.groupParticipantsUpdate(from, [sender], 'remove');
            await Prince.sendMessage(from, {
                text: `🚫 *${tag}*\nTagging everyone is not allowed here.\n*Reason:* Status Mention Protection\n*Action:* Kicked from group`,
                mentions: [sender]
            });
        } else if (mode === 'delete') {
            await Prince.sendMessage(from, {
                text: `⚠️ *${tag}*\nTagging everyone is not allowed here.\n*Reason:* Status Mention Protection\n*Action:* Message deleted`,
                mentions: [sender]
            });
        } else if (mode === 'warn') {
            const warnings = await addWarning(from, sender, "Status Mention", "statusmention", "bot");
            if (warnings >= 3) {
                await Prince.groupParticipantsUpdate(from, [sender], 'remove');
                await Prince.sendMessage(from, {
                    text: `🚫 *${tag}*\nTagging everyone is not allowed here.\n*Reason:* Status Mention Protection\n*Action:* Kicked (3 warnings reached)`,
                    mentions: [sender]
                });
                await resetWarnings(from, sender);
            } else {
                await Prince.sendMessage(from, {
                    text: `⚠️ *${tag}*\nTagging everyone is not allowed here.\n*Reason:* Status Mention Protection\n*+${warnings} Warning* (${warnings}/3)`,
                    mentions: [sender]
                });
            }
        }
    } catch (err) { console.error('Status mention error:', err); }
};

const PrinceAutoBio = async (Prince) => {
    try {
        const hour = new Date().getHours();
        const bioText = `${botName} Active || ${new Date().toLocaleDateString()}`;
        await Prince.updateProfileStatus(bioText);
    } catch (e) {}
};

function PrinceChatBot(Prince, chatBot, chatBotMode, createContext, createContext2, googleTTS) {
    Prince.ev.on("messages.upsert", async ({ messages }) => {
        try {
            const msg = messages[0];
            if (!msg?.message || msg.key.fromMe) return;
            // Simplified for stability
        } catch (e) {}
    });
}

const PrincePresence = async (Prince, jid) => {
    // Intentionally do not publish "available" automatically. This keeps
    // companion-phone notification behavior under WhatsApp's control.
};

const PrinceAnticall = async (json, Prince) => {
    const mode = String(
        getSetting("ANTICALL", config.ANTICALL || "false"),
    ).toLowerCase();
    // Calls are allowed by default. Only an explicit reject/block setting may
    // intercept them; this prevents an accidental truthy value from rejecting
    // every incoming call.
    if (!["reject", "block", "true", "on"].includes(mode)) return;

    for (const id of json) {
        if (id.status === 'offer') {
            await Prince.rejectCall(id.id, id.from);
            if (mode === "block") {
                try {
                    await Prince.updateBlockStatus(id.from, "block");
                } catch (error) {
                    console.error("Anti-call block error:", error.message);
                }
            }
        }
    }
};

// Unwraps view-once / ephemeral / document-with-caption containers and
// returns the inner media message plus its type.
function unwrapMedia(message) {
    let m = message || {};
    for (let i = 0; i < 5; i++) {
        const inner =
            m.ephemeralMessage?.message ||
            m.viewOnceMessage?.message ||
            m.viewOnceMessageV2?.message ||
            m.viewOnceMessageV2Extension?.message ||
            m.documentWithCaptionMessage?.message;
        if (!inner) break;
        m = inner;
    }
    const type = ["imageMessage", "videoMessage", "audioMessage", "stickerMessage", "documentMessage"]
        .find((t) => m[t]);
    return type ? { type, media: m[type], message: m } : null;
}

async function resendMediaFresh(Prince, jid, original, caption) {
    const found = unwrapMedia(original?.message);
    if (!found) return false;
    try {
        // Media downloaded when the message first arrived (deleted messages
        // can no longer be fetched from WhatsApp's servers).
        const cached = await mediaCache.getOrWait(original?.key?.id);
        if (cached) {
            await Prince.sendMessage(jid, mediaCache.toSendContent(cached, caption));
            return true;
        }
        if (!mediaCache.hasMediaKey(found.media)) return false;
        const buffer = await downloadMediaMessage(
            { key: original.key, message: { [found.type]: found.media } },
            "buffer", {},
            { logger, reuploadRequest: Prince.updateMediaMessage },
        );
        if (!Buffer.isBuffer(buffer) || !buffer.length) return false;
        const media = found.media;
        const cap = caption !== undefined ? caption : (media.caption || "");
        const mimetype = media.mimetype;
        let content;
        switch (found.type) {
            case "imageMessage": content = { image: buffer, caption: cap, mimetype }; break;
            case "videoMessage": content = { video: buffer, caption: cap, mimetype, gifPlayback: !!media.gifPlayback }; break;
            case "audioMessage": content = { audio: buffer, mimetype: mimetype || "audio/mp4", ptt: !!media.ptt }; break;
            case "stickerMessage": content = { sticker: buffer }; break;
            default: content = { document: buffer, mimetype: mimetype || "application/octet-stream", fileName: media.fileName || "file", caption: cap };
        }
        await Prince.sendMessage(jid, content);
        return true;
    } catch (e) {
        console.error("Anti-delete media resend failed:", e.message);
        return false;
    }
}

// Returns the readable text of any message (text, captions, polls...).
function extractText(message) {
    const { message: m } = mediaCache.unwrapMessage(message);
    return (
        m.conversation ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption ||
        m.videoMessage?.caption ||
        m.documentMessage?.caption ||
        m.pollCreationMessage?.name ||
        m.pollCreationMessageV3?.name ||
        m.contactMessage?.displayName ||
        (m.locationMessage ? `📍 ${m.locationMessage.degreesLatitude}, ${m.locationMessage.degreesLongitude}` : "") ||
        ""
    );
}

const PrinceAntiDelete = async (Prince, deletedMsg, key, deleter, sender, botOwnerJid, deleterPushName, senderPushName) => {
    try {
        const from = key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const { type: mediaType, viewOnce } = mediaCache.unwrapMessage(deletedMsg.message);
        const body = extractText(deletedMsg.message);

        const senderJid = toMentionJid(sender);
        const deleterJid = toMentionJid(deleter);
        const mentions = [...new Set([senderJid, deleterJid].filter(Boolean))];
        let text = `🚫 *MESSAGE DELETED*\n\n`;
        text += isGroup
            ? `👥 *Group:* ${deletedMsg.groupName || 'Unknown'}\n`
            : `👤 *Chat:* Private DM\n`;
        text += `📝 *Sent By:* ${mentionTag(senderJid)}\n`;
        text += `🗑️ *Deleted By:* ${mentionTag(deleterJid)}\n\n`;
        text += `🔒 *Message:*\n`;

        const contextInfo = {
            mentionedJid: mentions,
            forwardingScore: 999,
            isForwarded: true
        };

        if (!mediaType) {
            const fallbackType = (getContentType(deletedMsg.message) || 'message').replace('Message', '');
            text += body ? `_${body}_` : `_Sent a ${fallbackType}_`;
            await Prince.sendMessage(botOwnerJid, { text, mentions, contextInfo });
            return;
        }

        const label = `${viewOnce ? 'view-once ' : ''}${mediaType.replace('Message', '')}`;
        text += `_Sent a ${label}_`;
        if (body) text += `\n\n📝 *Caption:* _${body}_`;
        await Prince.sendMessage(botOwnerJid, { text, mentions, contextInfo });

        // Send the recovered media as a brand-new message. Forwarding the
        // original makes WhatsApp show "Waiting for this message".
        const sentFresh = await resendMediaFresh(Prince, botOwnerJid, deletedMsg);
        if (!sentFresh) {
            await Prince.sendMessage(botOwnerJid, {
                text: `⚠️ The ${label} could not be recovered (it was deleted before it finished downloading or is too large).`,
            });
        }
    } catch (e) {
        console.error('Anti-delete forwarding error:', e);
    }
};

// ============================================================
// VIEW ONCE AUTO-FORWARD
// Trigger: react with ❤️ 😂 😎 or .. on a view-once message
// Action : downloads the media and sends it to the owner's DM
// Owner-only feature.
// ============================================================

// Cached view-once messages so we can download them by key ID
const _voCache = new Map();
const REACT_EMOJIS = new Set(["❤️", "😂", "😎", "..", "❤", "😍", "🔥"]);

function cacheViewOnce(Prince, ms) {
    const { type, media, viewOnce } = mediaCache.unwrapMessage(ms.message);
    if (!viewOnce || !["imageMessage", "videoMessage", "audioMessage"].includes(type)) return;
    // Keep only copies that still have a media key; a later copy without a
    // key (e.g. a quoted/echoed copy) must not overwrite a good one.
    if (!_voCache.has(ms.key.id) || mediaCache.hasMediaKey(media)) {
        _voCache.set(ms.key.id, { type, media, from: ms.key.remoteJid, key: ms.key });
        setTimeout(() => _voCache.delete(ms.key.id), 30 * 60 * 1000).unref?.();
    }
    // Download right away: view-once links expire quickly and quoted copies
    // have their media key removed ("Cannot derive from empty media key").
    mediaCache.prefetch(Prince, ms);
}

// Returns a ready-to-send payload for a view-once message id, or null.
async function getViewOnceContent(Prince, id, fallback, caption) {
    const cached = await mediaCache.getOrWait(id);
    if (cached) return mediaCache.toSendContent(cached, caption);
    const src = _voCache.get(id) || fallback;
    if (!src?.media || !mediaCache.hasMediaKey(src.media)) return null;
    const entry = await mediaCache.prefetch(Prince, {
        key: { remoteJid: src.from, fromMe: false, id, participant: src.key?.participant },
        message: { [src.type]: src.media },
    });
    return entry ? mediaCache.toSendContent(entry, caption) : null;
}

const PrinceViewOnce = (Prince) => {
    // One listener handles caching, reactions and plain wow/lol replies.
    Prince.ev.on("messages.upsert", async ({ messages }) => {
        for (const ms of messages || []) {
            try {
                if (!ms?.message || !ms.key?.id) continue;
                cacheViewOnce(Prince, ms);
                if (ms.message.reactionMessage) await handleReaction(Prince, ms);
                else await handlePlainReveal(Prince, ms);
            } catch (err) {
                console.error("PrinceViewOnce error:", err.message);
            }
        }
    });
};

function normalizeNum(jid) {
    return String(jid || "").split("@")[0].split(":")[0].replace(/\D/g, "");
}

function isOwnerMsg(Prince, ms) {
    const ownerNumber = normalizeNum(config.OWNER_NUMBER);
    const connectedNumber = normalizeNum(Prince.user?.id);
    const sender = normalizeNum(ms.key.participantPn || ms.key.participant || ms.key.remoteJid);
    return ms.key.fromMe === true ||
        (ownerNumber && sender === ownerNumber) ||
        (connectedNumber && sender === connectedNumber);
}

// React with ❤️ 😂 😎 etc. on a cached view-once -> sent to owner's DM.
async function handleReaction(Prince, ms) {
    const reaction = ms.message.reactionMessage;
    if (!REACT_EMOJIS.has(reaction.text)) return;
    if (!isOwnerMsg(Prince, ms)) return;
    const reactedKeyId = reaction.key?.id;
    const cached = reactedKeyId && _voCache.get(reactedKeyId);
    if (!cached) return;

    const ownerNum = normalizeNum(config.OWNER_NUMBER) || normalizeNum(Prince.user?.id);
    const ownerDM = ownerNum + "@s.whatsapp.net";
    try {
        await Prince.sendMessage(cached.from, { react: { key: ms.key, text: "👀" } });
    } catch (_) {}

    const mediaLabel = cached.type === "imageMessage" ? "Image" : cached.type === "videoMessage" ? "Video" : "Audio";
    const caption = `🔓 *View Once ${mediaLabel} Revealed*\n_Forwarded by ${config.BOT_NAME}_`;
    const content = await getViewOnceContent(Prince, reactedKeyId, null, caption);
    if (!content) {
        console.error("ViewOnce: media unavailable for", reactedKeyId);
        return;
    }
    await Prince.sendMessage(ownerDM, content);
}

// Owner replies "wow"/"lol" (or wow2/lol2 for DM only) to a view-once.
async function handlePlainReveal(Prince, ms) {
    const text = (ms.message.conversation || ms.message.extendedTextMessage?.text || "").trim().toLowerCase();
    if (!["wow", "lol", "wow2", "lol2"].includes(text)) return;
    if (!isOwnerMsg(Prince, ms)) return;

    const ctx = ms.message.extendedTextMessage?.contextInfo;
    const quotedKey = ctx?.stanzaId;
    if (!quotedKey) return;

    let fallback = null;
    if (ctx.quotedMessage) {
        const q = mediaCache.unwrapMessage(ctx.quotedMessage);
        if (q.type) fallback = { type: q.type, media: q.media, from: ms.key.remoteJid, key: { participant: ctx.participant } };
    }
    if (!_voCache.has(quotedKey) && !fallback) return;
    const type = (_voCache.get(quotedKey) || fallback).type;
    if (type !== "imageMessage" && type !== "videoMessage") return;

    const label = type === "imageMessage" ? "Image" : "Video";
    const content = await getViewOnceContent(
        Prince, quotedKey, fallback,
        `🔓 *View Once ${label} Revealed*\n\n_Requested with ${text}_`,
    );
    const ownerDM = Prince.user?.id ? normalizeNum(Prince.user.id) + "@s.whatsapp.net" : null;
    if (!content) {
        if (ownerDM) await Prince.sendMessage(ownerDM, { text: "⚠️ That view-once media is no longer available to download." });
        return;
    }
    if (text === "wow2" || text === "lol2") {
        if (ownerDM) await Prince.sendMessage(ownerDM, content);
    } else {
        await Prince.sendMessage(ms.key.remoteJid, content);
        if (ownerDM && ownerDM !== ms.key.remoteJid) await Prince.sendMessage(ownerDM, content);
    }
}

module.exports = {
    logger, emojis, PrinceAutoReact, PrinceTechApi, PrinceApiKey, PrinceAntiLink,
    PrinceStatusMention, PrinceAutoBio, PrinceChatBot, PrincePresence, PrinceAntiDelete,
    PrinceAnticall, PrinceViewOnce, getViewOnceContent,
};

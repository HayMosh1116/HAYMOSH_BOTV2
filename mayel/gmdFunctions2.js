const fs = require("fs-extra");
const path = require("path");
const { pipeline } = require("stream/promises");
const config = require("../config");
const { createContext } = require("./gmdHelpers");
const { getSetting, addWarning, resetWarnings } = require("./gmdSudoUtil");
const logger = require("prince-baileys/lib/Utils/logger").default.child({});
const { isJidGroup, downloadMediaMessage, getContentType } = require("prince-baileys");

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

        if (antiLink === 'kick') {
            await Prince.groupParticipantsUpdate(from, [sender], 'remove');
            await Prince.sendMessage(from, { text: `⚠️ Anti-link active!\nUser @${sender.split('@')[0]} has been kicked.`, mentions: [sender] });
        } else if (antiLink === 'delete') {
            await Prince.sendMessage(from, { text: `⚠️ Links are not allowed here @${sender.split('@')[0]}!`, mentions: [sender] });
        } else if (antiLink === 'warn') {
            const warnings = await addWarning(from, sender, "Anti-Link");
            if (warnings >= 3) {
                await Prince.groupParticipantsUpdate(from, [sender], 'remove');
                await Prince.sendMessage(from, { text: `🚫 @${sender.split('@')[0]} kicked (3 warnings).`, mentions: [sender] });
                await resetWarnings(from, sender);
            } else {
                await Prince.sendMessage(from, { text: `⚠️ Warning @${sender.split('@')[0]}! (${warnings}/3)`, mentions: [sender] });
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

        if (mode === 'kick') {
            await Prince.groupParticipantsUpdate(from, [sender], 'remove');
            await Prince.sendMessage(from, { text: `🚫 @${sender.split('@')[0]} kicked for tagging everyone.`, mentions: [sender] });
        } else if (mode === 'delete') {
            await Prince.sendMessage(from, { text: `⚠️ Tagging everyone is not allowed @${sender.split('@')[0]}!`, mentions: [sender] });
        } else if (mode === 'warn') {
            const warnings = await addWarning(from, sender, "Status Mention");
            if (warnings >= 3) {
                await Prince.groupParticipantsUpdate(from, [sender], 'remove');
                await Prince.sendMessage(from, { text: `🚫 @${sender.split('@')[0]} kicked (3 warnings).`, mentions: [sender] });
                await resetWarnings(from, sender);
            } else {
                await Prince.sendMessage(from, { text: `⚠️ Warning @${sender.split('@')[0]}! (${warnings}/3)`, mentions: [sender] });
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
    try { await Prince.sendPresenceUpdate('available', jid); } catch (e) {}
};

const PrinceAnticall = async (json, Prince) => {
    for (const id of json) {
        if (id.status === 'offer') {
            await Prince.rejectCall(id.id, id.from);
        }
    }
};

const PrinceAntiDelete = async (Prince, deletedMsg, key, deleter, sender, botOwnerJid, deleterPushName, senderPushName) => {
    try {
        const from = key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const msgType = getContentType(deletedMsg.message);
        
        let text = `*🛡️ PRINCE MDX ANTIDELETE*\n\n`;
        text += `*From:* @${sender.split('@')[0]}\n`;
        text += `*Chat:* ${isGroup ? 'Group' : 'Private'}\n`;
        if (isGroup) text += `*Group Name:* ${deletedMsg.groupName || 'Unknown'}\n`;
        text += `*Time:* ${new Date(deletedMsg.timestamp).toLocaleString()}\n\n`;
        text += `*Message Content:* \n`;

        const contextInfo = {
            mentionedJid: [sender],
            forwardingScore: 999,
            isForwarded: true
        };

        if (msgType === 'conversation' || msgType === 'extendedTextMessage') {
            const body = deletedMsg.message.conversation || deletedMsg.message.extendedTextMessage?.text;
            text += `_${body}_`;
            await Prince.sendMessage(botOwnerJid, { text, mentions: [sender], contextInfo });
        } else {
            text += `_Sent a ${msgType.replace('Message', '')}_`;
            await Prince.sendMessage(botOwnerJid, { text, mentions: [sender], contextInfo });
            
            // Fixed: Use sendMessage with forward instead of non-existent copyNForward
            await Prince.sendMessage(botOwnerJid, { forward: deletedMsg }, { contextInfo });
        }
    } catch (e) {
        console.error('Anti-delete forwarding error:', e);
    }
};

module.exports = {
    logger, emojis, PrinceAutoReact, PrinceTechApi, PrinceApiKey, PrinceAntiLink,
    PrinceStatusMention, PrinceAutoBio, PrinceChatBot, PrincePresence, PrinceAntiDelete, PrinceAnticall,
};

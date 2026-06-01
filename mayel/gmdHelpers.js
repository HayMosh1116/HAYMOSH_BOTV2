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
            body: options.body || "Powered by PrinceTech",
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
            body: options.body || "Powered by Prince Tech",
            thumbnailUrl: config.BOT_PIC,
            mediaType: 1,
            showAdAttribution: true,
            renderLargerThumbnail: true
        }
    }
});


const getContextInfo = () => ({
    forwardingScore: 1,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: config.NEWSLETTER_JID,
        newsletterName: config.NEWSLETTER_NAME,
        serverMessageId: 1
    },
});

module.exports = {
    createContext,
    createContext2,
    getContextInfo
};

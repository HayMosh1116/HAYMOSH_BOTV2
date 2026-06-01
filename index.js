const {
    default: princeConnect,
    isJidGroup,
    jidNormalizedUser,
    isJidBroadcast,
    downloadMediaMessage,
    downloadContentFromMessage,
    downloadAndSaveMediaMessage,
    DisconnectReason,
    getContentType,
    fetchLatestBaileysVersion,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    jidDecode,
} = require("prince-baileys");

const {
    evt,
    logger,
    emojis,
    gmdStore,
    commands,
    setSudo,
    delSudo,
    PrinceTechApi,
    PrinceApiKey,
    PrinceAutoReact,
    PrinceAntiLink,
    PrinceAutoBio,
    PrinceChatBot,
    loadSession,
    getMediaBuffer,
    getSudoNumbers,
    getSetting,
    setSetting,
    getGroupSetting,
    setGroupSetting,
    getFileContentType,
    bufferToStream,
    uploadToPixhost,
    uploadToImgBB,
    gmdBuffer,
    gmdJson,
    formatAudio,
    formatVideo,
    uploadToGithubCdn,
    uploadToPrinceCdn,
    uploadToPasteboard,
    uploadToCatbox,
    PrinceAnticall,
    createContext,
    createContext2,
    getContextInfo,
    verifyJidState,
    PrincePresence,
    PrinceAntiDelete,
    addWarning,
    getUserWarnings,
    resetWarnings
} = require("./mayel");

const {
    Sticker,
    createSticker,
    StickerTypes,
} = require("wa-sticker-formatter");
const pino = require("pino");
const config = require("./config");
const axios = require("axios");
const googleTTS = require("google-tts-api");
const fs = require("fs-extra");
const path = require("path");
const { Boom } = require("@hapi/boom");
const express = require("express");
const { promisify } = require("util");
const stream = require("stream");
const pipeline = promisify(stream.pipeline);
const {
    MODE: botMode,
    BOT_PIC: botPic,
    FOOTER: botFooter,
    CAPTION: botCaption,
    VERSION: botVersion,
    OWNER_NUMBER: ownerNumber,
    OWNER_NAME: ownerName,
    BOT_NAME: botName,
    PREFIX: botPrefix,
    PRESENCE: botPresence,
    CHATBOT: chatBot,
    CHATBOT_MODE: chatBotMode,
    STARTING_MESSAGE: startMess,
    ANTIDELETE: antiDelete,
    ANTILINK: antiLink,
    ANTICALL: antiCall,
    TIME_ZONE: timeZone,
    BOT_REPO: princeRepo,
    NEWSLETTER_JID: newsletterJid,
    NEWSLETTER_URL: newsletterUrl,
    AUTO_REACT: autoReact,
    AUTO_READ_STATUS: autoReadStatus,
    AUTO_LIKE_STATUS: autoLikeStatus,
    STATUS_LIKE_EMOJIS: statusLikeEmojis,
    AUTO_REPLY_STATUS: autoReplyStatus,
    STATUS_REPLY_TEXT: statusReplyText,
    AUTO_READ_MESSAGES: autoRead,
    AUTO_BLOCK: autoBlock,
    AUTO_BIO: autoBio,
} = config;
const PORT = process.env.PORT || 5000;
const app = express();
let Prince;

logger.level = "silent";

app.use(express.static("mayel"));
app.get("/", (req, res) => res.sendFile(__dirname + "/mayel/prince.html"));
app.listen(PORT, () => console.log(`Server Running on Port: ${PORT}`));

const sessionDir = path.join(__dirname, "mayel", "session");

loadSession();

let store;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 50;
const RECONNECT_DELAY = 5000;

async function startPrince() {
    try {
        const { version, isLatest } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

        if (store) {
            store.destroy();
        }
        store = new gmdStore();

        const princeSock = {
            version,
            logger: pino({ level: "silent" }),
            browser: ["PRINCE", "safari", "1.0.0"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            getMessage: async (key) => {
                if (store) {
                    const msg = store.loadMessage(key.remoteJid, key.id);
                    return msg?.message || undefined;
                }
                return { conversation: "Error occurred" };
            },
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            markOnlineOnConnect: true,
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
            patchMessageBeforeSending: (message) => {
                const requiresPatch = !!(
                    message.buttonsMessage ||
                    message.templateMessage ||
                    message.listMessage
                );
                if (requiresPatch) {
                    message = {
                        viewOnceMessage: {
                            message: {
                                messageContextInfo: {
                                    deviceListMetadataVersion: 2,
                                    deviceListMetadata: {},
                                },
                                ...message,
                            },
                        },
                    };
                }
                return message;
            },
        };

        Prince = princeConnect(princeSock);

        store.bind(Prince.ev);

        Prince.ev.process(async (events) => {
            if (events["creds.update"]) {
                await saveCreds();
            }
        });

        if (autoReact === "true") {
            Prince.ev.on("messages.upsert", async (mek) => {
                ms = mek.messages[0];
                try {
                    if (ms.key.fromMe) return;
                    if (!ms.key.fromMe && ms.message) {
                        const randomEmoji =
                            emojis[Math.floor(Math.random() * emojis.length)];
                        await PrinceAutoReact(randomEmoji, ms, Prince);
                    }
                } catch (err) {
                    console.error("Error during auto reaction:", err);
                }
            });
        }

        Prince.ev.on("messages.upsert", async (m) => {
            try {
                const msg = m.messages[0];
                if (!msg) return;
                if (!msg.message) return;
                const serverId = msg.key?.server_id || msg.newsletterServerId;
                if (msg.key.remoteJid === newsletterJid && serverId) {
                    try {
                        const emojiList = ["❤️", "👍", "😮"];
                        const emoji =
                            emojiList[
                                Math.floor(Math.random() * emojiList.length)
                            ];
                        const messageId = serverId.toString();
                        await Prince.newsletterReactMessage(
                            newsletterJid,
                            messageId,
                            emoji,
                        );
                    } catch (err) {}
                }
            } catch (err) {}
        });

        const groupCooldowns = new Map();

        function isGroupSpamming(jid) {
            const now = Date.now();
            const lastTime = groupCooldowns.get(jid) || 0;
            if (now - lastTime < 1500) return true;
            groupCooldowns.set(jid, now);
            return false;
        }

        let Mayel = { chats: {} };
        const botJid = `${Prince.user?.id.split(":")[0]}@s.whatsapp.net`;
        const botOwnerJid = `${Prince.user?.id.split(":")[0]}@s.whatsapp.net`;

        Prince.ev.on("messages.upsert", async ({ messages }) => {
            try {
                const ms = messages[0];
                // console.log(ms); ///////////////////////////////////
                if (!ms?.message) return;

                const { key } = ms;
                if (!key?.remoteJid) return;
                if (key.fromMe) return;
                if (key.remoteJid === "status@broadcast") return;

                const sender =
                    key.senderPn ||
                    key.participantPn ||
                    key.participant ||
                    key.remoteJid;
                const senderPushName = key.pushName || ms.pushName;

                if (sender === botJid || sender === botOwnerJid || key.fromMe)
                    return;

                if (!Mayel.chats[key.remoteJid])
                    Mayel.chats[key.remoteJid] = [];
                Mayel.chats[key.remoteJid].push({
                    ...ms,
                    originalSender: sender,
                    originalPushName: senderPushName,
                    timestamp: Date.now(),
                });

                if (Mayel.chats[key.remoteJid].length > 50) {
                    Mayel.chats[key.remoteJid] =
                        Mayel.chats[key.remoteJid].slice(-50);
                }

                if (ms.message?.protocolMessage?.type === 0) {
                    const deletedId = ms.message.protocolMessage.key.id;
                    const deletedMsg = Mayel.chats[key.remoteJid].find(
                        (m) => m.key.id === deletedId,
                    );
                    if (!deletedMsg?.message) return;

                    const deleter =
                        key.participantPn || key.participant || key.remoteJid;
                    const deleterPushName = key.pushName || ms.pushName;

                    if (deleter === botJid || deleter === botOwnerJid) return;

                    const activeAntiDelete = getSetting("ANTIDELETE", antiDelete);
                    const isGroup = key.remoteJid.endsWith("@g.us");

                    let shouldExecute = false;
                    const mode = String(activeAntiDelete).toLowerCase();
                    if (mode === "all") shouldExecute = true;
                    else if (mode === "chat" && !isGroup) shouldExecute = true;
                    else if (mode === "group" && isGroup) shouldExecute = true;

                    if (shouldExecute) {
                        const isGroup = key.remoteJid.endsWith("@g.us");
                        let groupName = "";
                        if (isGroup) {
                            try {
                                const metadata = await Prince.groupMetadata(key.remoteJid);
                                groupName = metadata.subject;
                            } catch (e) {}
                        }
                        
                        await PrinceAntiDelete(
                            Prince,
                            { ...deletedMsg, groupName },
                            key,
                            deleter,
                            deletedMsg.originalSender,
                            botOwnerJid,
                            deleterPushName,
                            deletedMsg.originalPushName,
                        );
                    }

                    Mayel.chats[key.remoteJid] = Mayel.chats[
                        key.remoteJid
                    ].filter((m) => m.key.id !== deletedId);
                }
            } catch (error) {
                logger.error("Anti-delete system error:", error);
            }
        });

        if (autoBio === "true") {
            setTimeout(() => PrinceAutoBio(Prince), 1000);
            setInterval(() => PrinceAutoBio(Prince), 1000 * 60); // Update every minute
        }

        Prince.ev.on("call", async (json) => {
            await PrinceAnticall(json, Prince);
        });

        Prince.ev.on("messages.upsert", async ({ messages }) => {
            if (messages && messages.length > 0) {
                await PrincePresence(Prince, messages[0].key.remoteJid);
            }
        });

        Prince.ev.on("connection.update", ({ connection }) => {
            if (connection === "open") {
                logger.info("Connection established - updating presence");
                PrincePresence(Prince, "status@broadcast");
            }
        });

            PrinceChatBot(
                Prince,
                chatBot,
                chatBotMode,
                createContext,
                createContext2,
                googleTTS,
            );

            Prince.ev.on("messages.upsert", async ({ messages }) => {
                const message = messages[0];
                if (!message?.message || message.key.fromMe) return;
                const chatJid = message.key.remoteJid;
                if (chatJid && chatJid.endsWith("@g.us")) {
                    const groupAntiLink = getGroupSetting(
                        chatJid,
                        "ANTILINK",
                        "false",
                    );
                    if (groupAntiLink !== "false") {
                        await PrinceAntiLink(Prince, message, groupAntiLink);
                    }
                    
                    const groupStatusMention = getGroupSetting(
                        chatJid,
                        "STATUS_MENTION",
                        "false",
                    );
                    if (groupStatusMention !== "false") {
                        const messageType = getContentType(message.message);
                        const body = messageType === 'conversation'
                            ? message.message.conversation
                            : message.message[messageType]?.text || 
                              message.message[messageType]?.caption || '';
                        
                        if (body && (body.includes('@everyone') || body.includes('@status'))) {
                            await PrinceStatusMention(Prince, message, groupStatusMention);
                        }
                    }
                }
            });

        Prince.ev.on("messages.upsert", async (mek) => {
            try {
                mek = mek.messages[0];
                if (!mek || !mek.message) return;

                const fromJid = mek.key.participant || mek.key.remoteJid;
                mek.message =
                    getContentType(mek.message) === "ephemeralMessage"
                        ? mek.message.ephemeralMessage.message
                        : mek.message;

                if (
                    mek.key &&
                    mek.key?.remoteJid === "status@broadcast" &&
                    isJidBroadcast(mek.key.remoteJid)
                ) {
                    const princetech = jidNormalizedUser(Prince.user.id);

                    if (autoReadStatus === "true") {
                        await Prince.readMessages([mek.key, princetech]);
                    }

                    if (autoLikeStatus === "true" && mek.key.participant) {
                        const emojis =
                            statusLikeEmojis?.split(",") || "💛,❤️,💜,🤍,💙";
                        const randomEmoji =
                            emojis[Math.floor(Math.random() * emojis.length)];
                        await Prince.sendMessage(
                            mek.key.remoteJid,
                            { react: { key: mek.key, text: randomEmoji } },
                            {
                                statusJidList: [
                                    mek.key.participant,
                                    princetech,
                                ],
                            },
                        );
                    }

                    if (autoReplyStatus === "true") {
                        if (mek.key.fromMe) return;
                        const customMessage =
                            statusReplyText || "✅ Status Viewed By Prince-Md";
                        await Prince.sendMessage(
                            fromJid,
                            { text: customMessage },
                            { quoted: mek },
                        );
                    }
                }
            } catch (error) {
                console.error("Error Processing Actions:", error);
            }
        });

        try {
            const pluginsPath = path.join(__dirname, "prince");
            fs.readdirSync(pluginsPath).forEach((fileName) => {
                if (path.extname(fileName).toLowerCase() === ".js") {
                    try {
                        require(path.join(pluginsPath, fileName));
                    } catch (e) {
                        console.error(
                            `❌ Failed to load ${fileName}: ${e.message}`,
                        );
                    }
                }
            });
        } catch (error) {
            console.error("❌ Error reading Taskflow folder:", error.message);
        }

        console.log("✅ Plugin Files Loaded");

        Prince.ev.on("messages.upsert", async ({ messages }) => {
            const ms = messages[0];
            if (!ms?.message || !ms?.key) return;

            function standardizeJid(jid) {
                if (!jid) return "";
                try {
                    jid =
                        typeof jid === "string"
                            ? jid
                            : jid.decodeJid
                              ? jid.decodeJid()
                              : String(jid);
                    jid = jid.split(":")[0].split("/")[0];
                    if (!jid.includes("@")) {
                        jid += "@s.whatsapp.net";
                    } else if (jid.endsWith("@lid")) {
                        return jid.toLowerCase();
                    }
                    return jid.toLowerCase();
                } catch (e) {
                    console.error("JID standardization error:", e);
                    return "";
                }
            }

            const from = standardizeJid(ms.key.remoteJid);
            const botId = standardizeJid(Prince.user?.id);
            const isGroup = from.endsWith("@g.us");
            let groupInfo = null;
            let groupName = "";
            try {
                groupInfo = isGroup
                    ? await Prince.groupMetadata(from).catch(() => null)
                    : null;
                // console.log(groupInfo) //////////////////////////////////////////////////////
                groupName = groupInfo?.subject || "";
            } catch (err) {
                console.error("Group metadata error:", err);
            }

            const sendr = ms.key.fromMe
                ? Prince.user.id.split(":")[0] + "@s.whatsapp.net" ||
                  Prince.user.id
                : ms.key.senderPn ||
                  ms.key.participantPn ||
                  ms.key.participant ||
                  ms.key.remoteJid;
            let participants = [];
            let groupAdmins = [];
            let groupSuperAdmins = [];
            let sender = sendr;
            let isBotAdmin = false;
            let isAdmin = false;
            let isSuperAdmin = false;

            if (groupInfo && groupInfo.participants) {
                participants = groupInfo.participants.map((p) => p.pn || p.id);
                groupAdmins = groupInfo.participants
                    .filter((p) => p.admin === "admin")
                    .map((p) => p.pn || p.id);
                groupSuperAdmins = groupInfo.participants
                    .filter((p) => p.admin === "superadmin")
                    .map((p) => p.pn || p.id);
                const senderLid = standardizeJid(sendr);
                const founds = groupInfo.participants.find(
                    (p) => p.id === senderLid || p.pn === senderLid,
                );
                sender = founds?.pn || founds?.id || sendr;
                isBotAdmin =
                    groupAdmins.includes(standardizeJid(botId)) ||
                    groupSuperAdmins.includes(standardizeJid(botId));
                isSuperAdmin = groupSuperAdmins.includes(sender);
                isAdmin = groupAdmins.includes(sender) || isSuperAdmin;
            }

            const repliedMessage =
                ms.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
                null;
            const type = getContentType(ms.message);
            const pushName = ms.pushName || "Prince-Md User";
            const quoted =
                type == "extendedTextMessage" &&
                ms.message.extendedTextMessage.contextInfo != null
                    ? ms.message.extendedTextMessage.contextInfo
                          .quotedMessage || []
                    : [];
            const body =
                type === "conversation"
                    ? ms.message.conversation
                    : type === "extendedTextMessage"
                      ? ms.message.extendedTextMessage.text
                      : type == "imageMessage" &&
                          ms.message.imageMessage.caption
                        ? ms.message.imageMessage.caption
                        : type == "videoMessage" &&
                            ms.message.videoMessage.caption
                          ? ms.message.videoMessage.caption
                          : "";
            const activePrefix = getSetting("PREFIX", botPrefix);
            const isCommand = body.startsWith(activePrefix);
            const command = isCommand
                ? body
                      .slice(activePrefix.length)
                      .trim()
                      .split(" ")
                      .shift()
                      .toLowerCase()
                : "";

            const mentionedJid = (
                ms.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
            ).map(standardizeJid);
            const tagged =
                ms.mtype === "extendedTextMessage" &&
                ms.message.extendedTextMessage.contextInfo != null
                    ? ms.message.extendedTextMessage.contextInfo.mentionedJid
                    : [];
            const quotedMsg =
                ms.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const ctxInfo = ms.message?.extendedTextMessage?.contextInfo;
            let quotedUser = ctxInfo?.participant || ctxInfo?.remoteJid;
            if (quotedUser && quotedUser.includes("@lid")) {
                if (groupInfo?.participants) {
                    const qFound = groupInfo.participants.find(
                        (p) => p.id === quotedUser || p.lid === quotedUser,
                    );
                    if (qFound?.pn) quotedUser = qFound.pn + "@s.whatsapp.net";
                    else if (qFound?.phoneNumber)
                        quotedUser = qFound.phoneNumber + "@s.whatsapp.net";
                }
                if (quotedUser.includes("@lid")) {
                    try {
                        const resolved = await Prince.getJidFromLid(quotedUser);
                        if (resolved) quotedUser = resolved;
                    } catch (e) {}
                }
            }
            const repliedMessageAuthor = standardizeJid(
                ms.message?.extendedTextMessage?.contextInfo?.participant,
            );
            let messageAuthor = isGroup
                ? standardizeJid(ms.key.participant || ms.participant || from)
                : from;
            if (ms.key.fromMe) messageAuthor = botId;
            const user =
                mentionedJid.length > 0
                    ? mentionedJid[0]
                    : repliedMessage
                      ? repliedMessageAuthor
                      : "";
            const devNumbers =
                "237682698517,254114018035,254728782591,237682698517,237682698517,254113174209"
                    .split(",")
                    .map((num) => num.trim().replace(/\D/g, ""))
                    .filter((num) => num.length > 5);

            const sudoNumbersFromFile = getSudoNumbers() || [];
            const sudoNumbers = (
                config.SUDO_NUMBERS ? config.SUDO_NUMBERS.split(",") : []
            )
                .map((num) => num.trim().replace(/\D/g, ""))
                .filter((num) => num.length > 5);

            const botJid = standardizeJid(botId);
            const ownerJid = standardizeJid(ownerNumber.replace(/\D/g, ""));
            const superUser = [
                ownerJid,
                botJid,
                ...(sudoNumbers || []).map((num) => `${num}@s.whatsapp.net`),
                ...(devNumbers || []).map((num) => `${num}@s.whatsapp.net`),
                ...(sudoNumbersFromFile || []).map(
                    (num) => `${num}@s.whatsapp.net`,
                ),
            ]
                .map((jid) => standardizeJid(jid))
                .filter(Boolean);

            const superUserSet = new Set(superUser);
            const finalSuperUsers = Array.from(superUserSet);

            const isSuperUser = finalSuperUsers.includes(sender);

            const botDevs = [
                "237682698517@s.whatsapp.net",
                "2376826872@s.whatsapp.net",
            ];
            const isDevs = botDevs.includes(sender);

            if (autoBlock && sender && !isSuperUser && !isGroup) {
                const countryCodes = autoBlock
                    .split(",")
                    .map((code) => code.trim());
                if (countryCodes.some((code) => sender.startsWith(code))) {
                    try {
                        await Prince.updateBlockStatus(sender, "block");
                    } catch (blockErr) {
                        console.error("Block error:", blockErr);
                        if (isSuperUser) {
                            await Prince.sendMessage(ownerJid, {
                                text: `⚠️ Failed to block restricted user: ${sender}\nError: ${blockErr.message}`,
                            });
                        }
                    }
                }
            }
            if (autoRead === "true") await Prince.readMessages([ms.key]);
            if (autoRead === "commands" && isCommand) await Prince.readMessages([ms.key]);

            // ============ ANTI-GROUP MENTION SYSTEM ============
            const antiMentionSetting = getGroupSetting(from, 'STATUS_MENTION', 'false').toLowerCase();
            
            if (
                isGroup &&
                antiMentionSetting !== 'false' &&
                !ms.key.fromMe &&
                !isAdmin &&
                type === 'groupStatusMentionMessage'
            ) {
                try {
                    if (!isBotAdmin) {
                        await Prince.sendMessage(from, { text: '*The STATUS_MENTION process is enabled in this group, but the bot needs to be an admin to run. ⛔️*' }, { quoted: ms });
                    } else if (isSuperUser) {
                        // Skip superusers/owners
                    } else {
                        // STEP 1: ALWAYS DELETE THE MESSAGE FIRST
                        await Prince.sendMessage(from, { delete: ms.key });
                        
                        const senderNumber = sender.split('@')[0];
                        const antiMentionAction = antiMentionSetting === 'true' ? 'warn' : antiMentionSetting;
                        
                        // STEP 2: APPLY THE SELECTED ACTION
                        const gMeta = await Prince.groupMetadata(from);
                        const memberCount = gMeta.participants.length;
                        const groupName = gMeta.subject;

                        if (antiMentionAction === 'delete') {
                            await Prince.sendMessage(from, {
                                text: `🚫 *Anti-Group Mention Activated!*\n\n👥 *Group:* ${groupName}\n👥 *Members:* ${memberCount}\n👤 *User:* @${senderNumber}\n📝 *Action:* Message Removed`,
                                mentions: [sender]
                            }, { quoted: ms });
                        } else if (antiMentionAction === 'kick') {
                            await Prince.sendMessage(from, {
                                text: `🚫 *Anti-Group Mention Activated!*\n\n👥 *Group:* ${groupName}\n👥 *Members:* ${memberCount}\n👤 *User:* @${senderNumber}\n📝 *Action:* Kicked from Group`,
                                mentions: [sender]
                            }, { quoted: ms });
                            await Prince.groupParticipantsUpdate(from, [sender], "remove");
                            resetWarnings(from, sender);
                        } else if (antiMentionAction === 'warn') {
                            const newWarningCount = addWarning(from, sender, "Sent group mention message", "anti-group-mention");
                            
                            let warningMessage = '';
                            let shouldKick = false;
                            
                            const baseText = `🚫 *Anti-Group Mention Activated!*\n\n👥 *Group:* ${groupName}\n👥 *Members:* ${memberCount}\n👤 *User:* @${senderNumber}\n`;

                            if (newWarningCount >= 3) {
                                shouldKick = true;
                                warningMessage = `${baseText}⚠️ *Action:* Final Warning Exceeded! (Removed)`;
                            } else {
                                warningMessage = `${baseText}⚠️ *Warning:* ${newWarningCount}/3\n📝 *Note:* Next violation will result in removal.`;
                            }
                            
                            await Prince.sendMessage(from, {
                                text: warningMessage,
                                mentions: [sender]
                            }, { quoted: ms });
                            
                            if (shouldKick) {
                                await Prince.groupParticipantsUpdate(from, [sender], "remove");
                                resetWarnings(from, sender);
                            }
                        }
                        console.log(`✅ Anti-group mention triggered in ${groupName} by ${senderNumber}`);
                    }
                } catch (error) {
                    console.error('Anti-group mention error:', error);
                }
            }
            if (autoRead === "commands" && isCommand)
                await Prince.readMessages([ms.key]);

            const text =
                ms.message?.conversation ||
                ms.message?.extendedTextMessage?.text ||
                ms.message?.imageMessage?.caption ||
                "";
            const args =
                typeof text === "string"
                    ? text.trim().split(/\s+/).slice(1)
                    : [];
            const isCommandMessage =
                typeof text === "string" && text.startsWith(activePrefix);
            const cmd = isCommandMessage
                ? text
                      .slice(activePrefix.length)
                      .trim()
                      .split(/\s+/)[0]
                      ?.toLowerCase()
                : null;

            if (isCommandMessage && cmd) {
                const gmd = Array.isArray(evt.commands)
                    ? evt.commands.find(
                          (c) =>
                              c?.pattern === cmd ||
                              (Array.isArray(c?.aliases) &&
                                  c.aliases.includes(cmd)),
                      )
                    : null;

                if (gmd) {
                    const currentMode = getSetting(
                        "BOT_MODE",
                        config.MODE || "private",
                    ).toLowerCase();
                    if (currentMode === "private" && !isSuperUser) {
                        return;
                    }

                    try {
                        const reply = (teks) => {
                            Prince.sendMessage(
                                from,
                                { text: teks },
                                { quoted: ms },
                            );
                        };
                        /*const reply = async (text, options = {}) => {
                            if (typeof text !== 'string') return;
                            try {
                                await Prince.sendMessage(from, { 
                                    text,
                                    ...createContext(sender, {
                                        title: options.title || groupName || getSetting('BOT_NAME', botName) || "PRINCE-MD",
                                        body: options.body || ""
                                    })
                                }, { quoted: ms });
                            } catch (err) {
                                console.error("Reply error:", err);
                            }
                        };*/

                        const react = async (emoji) => {
                            if (typeof emoji !== "string") return;
                            try {
                                await Prince.sendMessage(from, {
                                    react: {
                                        key: ms.key,
                                        text: emoji,
                                    },
                                });
                            } catch (err) {
                                console.error("Reaction error:", err);
                            }
                        };

                        const edit = async (text, message) => {
                            if (typeof text !== "string") return;

                            try {
                                await Prince.sendMessage(
                                    from,
                                    {
                                        text: text,
                                        edit: message.key,
                                    },
                                    {
                                        quoted: ms,
                                    },
                                );
                            } catch (err) {
                                console.error("Edit error:", err);
                            }
                        };

                        const del = async (message) => {
                            if (!message?.key) return;

                            try {
                                await Prince.sendMessage(
                                    from,
                                    {
                                        delete: message.key,
                                    },
                                    {
                                        quoted: ms,
                                    },
                                );
                            } catch (err) {
                                console.error("Delete error:", err);
                            }
                        };

                        if (gmd.react) {
                            try {
                                await Prince.sendMessage(from, {
                                    react: {
                                        key: ms.key,
                                        text: gmd.react,
                                    },
                                });
                            } catch (err) {
                                console.error("Reaction error:", err);
                            }
                        }

                        Prince.getJidFromLid = async (lid) => {
                            const groupMetadata =
                                await Prince.groupMetadata(from);
                            const match = groupMetadata.participants.find(
                                (p) => p.lid === lid || p.id === lid,
                            );
                            return match?.pn || null;
                        };

                        Prince.getLidFromJid = async (jid) => {
                            const groupMetadata =
                                await Prince.groupMetadata(from);
                            const match = groupMetadata.participants.find(
                                (p) => p.jid === jid || p.id === jid,
                            );
                            return match?.lid || null;
                        };

                        let fileType;
                        (async () => {
                            fileType = await import("file-type");
                        })();

                        Prince.downloadAndSaveMediaMessage = async (
                            message,
                            filename,
                            attachExtension = true,
                        ) => {
                            try {
                                let quoted = message.msg
                                    ? message.msg
                                    : message;
                                let mime =
                                    (message.msg || message).mimetype || "";
                                let messageType = message.mtype
                                    ? message.mtype.replace(/Message/gi, "")
                                    : mime.split("/")[0];

                                const stream = await downloadContentFromMessage(
                                    quoted,
                                    messageType,
                                );
                                let buffer = Buffer.from([]);

                                for await (const chunk of stream) {
                                    buffer = Buffer.concat([buffer, chunk]);
                                }

                                let fileTypeResult;
                                try {
                                    fileTypeResult =
                                        await fileType.fileTypeFromBuffer(
                                            buffer,
                                        );
                                } catch (e) {
                                    console.log(
                                        "file-type detection failed, using mime type fallback",
                                    );
                                }

                                const extension =
                                    fileTypeResult?.ext ||
                                    mime.split("/")[1] ||
                                    (messageType === "image"
                                        ? "jpg"
                                        : messageType === "video"
                                          ? "mp4"
                                          : messageType === "audio"
                                            ? "mp3"
                                            : "bin");

                                const trueFileName = attachExtension
                                    ? `${filename}.${extension}`
                                    : filename;

                                await fs.writeFile(trueFileName, buffer);
                                return trueFileName;
                            } catch (error) {
                                console.error(
                                    "Error in downloadAndSaveMediaMessage:",
                                    error,
                                );
                                throw error;
                            }
                        };

                        const conText = {
                            m: ms,
                            mek: ms,
                            edit,
                            react,
                            del,
                            arg: args,
                            quoted,
                            isCmd: isCommand,
                            command,
                            isAdmin,
                            isBotAdmin,
                            sender,
                            pushName,
                            setSudo,
                            delSudo,
                            q: args.join(" "),
                            reply,
                            config,
                            superUser,
                            tagged,
                            mentionedJid,
                            isGroup,
                            groupInfo,
                            groupName,
                            getSudoNumbers,
                            getSetting,
                            setSetting,
                            getGroupSetting,
                            setGroupSetting,
                            authorMessage: messageAuthor,
                            user: user || "",
                            gmdBuffer,
                            gmdJson,
                            formatAudio,
                            formatVideo,
                            groupMember: isGroup ? messageAuthor : "",
                            from,
                            tagged,
                            groupAdmins,
                            participants,
                            repliedMessage,
                            quotedMsg,
                            quotedUser,
                            isSuperUser,
                            isDevs,
                            botMode,
                            botPic: getSetting("BOT_PIC", botPic),
                            botFooter,
                            botCaption,
                            botVersion,
                            ownerNumber,
                            ownerName,
                            botName: getSetting("BOT_NAME", botName),
                            princeRepo,
                            isSuperAdmin,
                            getMediaBuffer,
                            getFileContentType,
                            bufferToStream,
                            uploadToPixhost,
                            uploadToImgBB,
                            uploadToGithubCdn,
                            uploadToPrinceCdn,
                            uploadToPasteboard,
                            uploadToCatbox,
                            newsletterUrl,
                            newsletterJid,
                            getContextInfo,
                            PrinceTechApi,
                            PrinceApiKey,
                            botPrefix: activePrefix,
                            timeZone,
                            args,
                            mek: ms,
                            ms
                        };

                        await gmd.function(from, Prince, conText);
                    } catch (error) {
                        console.error(`Command error [${cmd}]:`, error);
                        try {
                            await Prince.sendMessage(
                                from,
                                {
                                    text: `🚨 Command failed: ${error.message}`,
                                    ...createContext(messageAuthor, {
                                        title: "Error",
                                        body: "Command execution failed",
                                    }),
                                },
                                { quoted: ms },
                            );
                        } catch (sendErr) {
                            console.error(
                                "Error sending error message:",
                                sendErr,
                            );
                        }
                    }
                }
            }

            // ============ REPLY HANDLERS ============
            if (
                isGroup &&
                repliedMessage &&
                repliedMessageAuthor === botId &&
                body &&
                !isNaN(body)
            ) {
                const quotedText = repliedMessage.conversation || repliedMessage.extendedTextMessage?.text || repliedMessage.imageMessage?.caption || repliedMessage.videoMessage?.caption || "";

                // Status Mention Reply Handler - Moved to prince/group.js for interactive handling
                /* if (quotedText.includes("𝐒𝐓𝐀𝐓𝐔𝐒 𝐌𝐄𝐍𝐓𝐈𝐎𝐍 𝐒𝐄𝐓𝐓𝐈𝐍𝐆𝐒")) {
                    ...
                } */
            }
        });

        Prince.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === "connecting") {
                console.log("🕗 Connecting Bot...");
                reconnectAttempts = 0;
            }

            if (connection === "open") {
                console.log("✅ Connection Instance is Online");
                reconnectAttempts = 0;

                setTimeout(async () => {
                    try {
                        const totalCommands = commands.filter(
                            (command) => command.pattern,
                        ).length;
                        console.log("💜 Connected to Whatsapp, Active!");

                        if (startMess === "true") {
                            const md =
                                getSetting(
                                    "BOT_MODE",
                                    botMode || "private",
                                ).toLowerCase() === "public"
                                    ? "public"
                                    : "private";
                            const connectionMsg = `
*${getSetting("BOT_NAME", botName)} 𝐂𝐎𝐍𝐍𝐄𝐂𝐓𝐄𝐃*

𝐏𝐫𝐞𝐟𝐢𝐱       : *[ ${getSetting("PREFIX", botPrefix)} ]*
𝐏𝐥𝐮𝐠𝐢𝐧𝐬      : *${totalCommands.toString()}*
𝐌𝐨𝐝𝐞        : *${md}*
𝐎𝐰𝐧𝐞𝐫       : *${ownerNumber}*
𝐓𝐮𝐭𝐨𝐫𝐢𝐚𝐥𝐬     : *${config.YT}*
𝐔𝐩𝐝𝐚𝐭𝐞𝐬      : *${newsletterUrl}*

> *${botFooter}*`;

                            await Prince.sendMessage(
                                Prince.user.id,
                                {
                                    text: connectionMsg,
                                    ...createContext(
                                        getSetting("BOT_NAME", botName),
                                        {
                                            title: "BOT INTEGRATED",
                                            body: "Status: Ready for Use",
                                        },
                                    ),
                                },
                                {
                                    disappearingMessagesInChat: true,
                                    ephemeralExpiration: 300,
                                },
                            );
                        }
                        try {
                            await Prince.newsletterFollow(newsletterJid);
                        } catch (err) {}
                    } catch (err) {
                        console.error("Post-connection setup error:", err);
                    }
                }, 5000);
            }

            if (connection === "close") {
                const reason = new Boom(lastDisconnect?.error)?.output
                    ?.statusCode;

                console.log(`Connection closed due to: ${reason}`);

                if (reason === DisconnectReason.badSession) {
                    console.log("Bad session file, delete it and scan again");
                    try {
                        await fs.remove(__dirname + "/mayel/session");
                    } catch (e) {
                        console.error("Failed to remove session:", e);
                    }
                    process.exit(1);
                } else if (reason === DisconnectReason.connectionClosed) {
                    console.log("Connection closed, reconnecting...");
                    setTimeout(() => reconnectWithRetry(), RECONNECT_DELAY);
                } else if (reason === DisconnectReason.connectionLost) {
                    console.log("Connection lost from server, reconnecting...");
                    setTimeout(() => reconnectWithRetry(), RECONNECT_DELAY);
                } else if (reason === DisconnectReason.connectionReplaced) {
                    console.log(
                        "Connection replaced, another new session opened",
                    );
                    process.exit(1);
                } else if (reason === DisconnectReason.loggedOut) {
                    console.log(
                        "Device logged out, delete session and scan again",
                    );
                    try {
                        await fs.remove(__dirname + "/mayel/session");
                    } catch (e) {
                        console.error("Failed to remove session:", e);
                    }
                    process.exit(1);
                } else if (reason === DisconnectReason.restartRequired) {
                    console.log("Restart required, restarting...");
                    setTimeout(() => reconnectWithRetry(), RECONNECT_DELAY);
                } else if (reason === DisconnectReason.timedOut) {
                    console.log("Connection timed out, reconnecting...");
                    setTimeout(() => reconnectWithRetry(), RECONNECT_DELAY * 2);
                } else {
                    console.log(
                        `Unknown disconnect reason: ${reason}, attempting reconnection...`,
                    );
                    setTimeout(() => reconnectWithRetry(), RECONNECT_DELAY);
                }
            }
        });

        Prince.ev.on("group-participants.update", async (update) => {
            try {
                const { id, participants, action } = update;
                if (!id || !participants || !participants.length) return;

                const welcomeEnabled = getGroupSetting(
                    id,
                    "WELCOME_MESSAGE",
                    "false",
                );
                const goodbyeEnabled = getGroupSetting(
                    id,
                    "GOODBYE_MESSAGE",
                    "false",
                );

                const isWelcomeOn =
                    welcomeEnabled === "true" || welcomeEnabled === "on";
                const isGoodbyeOn =
                    goodbyeEnabled === "true" || goodbyeEnabled === "on";

                if (action === "add" && isWelcomeOn) {
                    let groupMeta;
                    try {
                        groupMeta = await Prince.groupMetadata(id);
                    } catch (e) {
                        console.error(
                            "Welcome: Failed to get group metadata:",
                            e,
                        );
                        return;
                    }

                    const groupName = groupMeta.subject || "Group";
                    const groupDesc = groupMeta.desc || "No description";
                    const memberCount = groupMeta.participants?.length || 0;

                    for (const participant of participants) {
                        const userMention = `@${participant.split("@")[0]}`;
                        const customText = getGroupSetting(
                            id,
                            "WELCOME_TEXT",
                            "",
                        );

                        let welcomeMsg;
                        if (customText) {
                            let processed = customText
                                .replace(/{user}/gi, userMention)
                                .replace(/{group}/gi, groupName)
                                .replace(/{desc}/gi, groupDesc);
                            if (!processed.startsWith(userMention)) {
                                processed = `${userMention}\n${processed}`;
                            }
                            welcomeMsg = processed;
                        } else {
                            welcomeMsg = `👋 *Welcome to ${groupName}!*

Hey ${userMention}, welcome to the group!

📍 *Group:* ${groupName}
👥 *Members:* ${memberCount}
📝 *Description:* ${groupDesc}

_Enjoy your stay!_`;
                        }

                        let ppUrl;
                        try {
                            ppUrl = await Prince.profilePictureUrl(
                                participant,
                                "image",
                            );
                        } catch (e) {
                            ppUrl = null;
                        }

                        const welcomeCtx = {
                            ...getContextInfo(),
                            mentionedJid: [participant],
                        };

                        if (ppUrl) {
                            await Prince.sendMessage(id, {
                                image: { url: ppUrl },
                                caption: welcomeMsg,
                                mentions: [participant],
                                contextInfo: welcomeCtx,
                            });
                        } else {
                            await Prince.sendMessage(id, {
                                text: welcomeMsg,
                                mentions: [participant],
                                contextInfo: welcomeCtx,
                            });
                        }
                    }
                }

                if (action === "remove" && isGoodbyeOn) {
                    let groupMeta;
                    try {
                        groupMeta = await Prince.groupMetadata(id);
                    } catch (e) {
                        console.error(
                            "Goodbye: Failed to get group metadata:",
                            e,
                        );
                        return;
                    }

                    const groupName = groupMeta.subject || "Group";
                    const groupDesc = groupMeta.desc || "No description";
                    const memberCount = groupMeta.participants?.length || 0;

                    for (const participant of participants) {
                        const userMention = `@${participant.split("@")[0]}`;
                        const customText = getGroupSetting(
                            id,
                            "GOODBYE_TEXT",
                            "",
                        );

                        let goodbyeMsg;
                        if (customText) {
                            let processed = customText
                                .replace(/{user}/gi, userMention)
                                .replace(/{group}/gi, groupName)
                                .replace(/{desc}/gi, groupDesc);
                            if (!processed.startsWith(userMention)) {
                                processed = `${userMention}\n${processed}`;
                            }
                            goodbyeMsg = processed;
                        } else {
                            goodbyeMsg = `👋 *Goodbye!*

${userMention} has left *${groupName}*

👥 *Members remaining:* ${memberCount}

_We'll miss you!_`;
                        }

                        const goodbyeCtx = {
                            ...getContextInfo(),
                            mentionedJid: [participant],
                        };

                        await Prince.sendMessage(id, {
                            text: goodbyeMsg,
                            mentions: [participant],
                            contextInfo: goodbyeCtx,
                        });
                    }
                }
            } catch (err) {
                console.error("Group participants update error:", err);
            }
        });

        const cleanup = () => {
            if (store) {
                store.destroy();
            }
        };

        process.on("SIGINT", cleanup);
        process.on("SIGTERM", cleanup);
    } catch (error) {
        console.error("Socket initialization error:", error);
        setTimeout(() => reconnectWithRetry(), RECONNECT_DELAY);
    }
}

async function reconnectWithRetry() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error("Max reconnection attempts reached. Exiting...");
        process.exit(1);
    }

    reconnectAttempts++;
    const delay = Math.min(
        RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1),
        300000,
    );

    console.log(
        `Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms...`,
    );

    setTimeout(async () => {
        try {
            await startPrince();
        } catch (error) {
            console.error("Reconnection failed:", error);
            reconnectWithRetry();
        }
    }, delay);
}

setTimeout(() => {
    startPrince().catch((err) => {
        console.error("Initialization error:", err);
        reconnectWithRetry();
    });
}, 5000);

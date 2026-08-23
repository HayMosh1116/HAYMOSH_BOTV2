const { gmd, commands, config, getContextInfo, uploadToImgBB, getSetting, setSetting } = require("../mayel");
const fs = require("fs");
const fsA = require('node:fs');
const { S_WHATSAPP_NET } = require("prince-baileys");
const Jimp = require("jimp");
const path = require("path");
const { exec, spawn } = require('node:child_process');
const moment = require('moment-timezone');

gmd({
  pattern: "channelid",
  aliases: ["getchannelid", "chid"],
  category: "owner",
  react: "📡",
  description: "Get WhatsApp channel JID from invite link",
}, async (from, Prince, conText) => {
  const { q, mek, reply, react, sender, botName, botFooter, newsletterJid } = conText;

  try {
    if (!q) {
      await react("❌");
      return reply("Please provide a channel invite link.\n\nUsage: .channelid <channel-link>");
    }

    const channelId = q.split("/").pop();
    if (!channelId) {
      await react("❌");
      return reply("Invalid channel link. Please provide a valid WhatsApp channel invite link.");
    }

    const res = await Prince.newsletterMetadata("invite", channelId);
    if (!res?.id) {
      await react("❌");
      return reply("Failed to fetch channel JID. Please check the link and try again.");
    }

    await Prince.sendMessage(from, {
      text: `📡 *Channel JID:*\n\n${res.id}`,
      contextInfo: getContextInfo(sender, newsletterJid, botName),
    }, { quoted: mek });
    await react("✅");
  } catch (e) {
    console.error("❌ Error fetching channel JID:", e);
    await react("❌");
    return reply("An error occurred while fetching the channel JID. Please try again.");
  }
});

gmd({
  pattern: "restart",
  aliases: ["reboot", "restartnow"],
  category: "owner",
  react: "🔄",
  description: "Restart the bot process.",
}, async (from, Prince, conText) => {
  const { reply, isSuperUser, sender, newsletterJid, botName, mek } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");

  await Prince.sendMessage(from, {
    text: "🔄 *Restarting bot...*\n\n_Please wait a few seconds..._",
    contextInfo: getContextInfo(sender, newsletterJid, botName),
  }, { quoted: mek });

  setTimeout(() => {
    process.exit(0);
  }, 1500);
});

function saveConfig() {
}

/*
gmd({
  pattern: "anticall",
  alias: ["setanticall"],
  desc: "Enable or Disable Anticall",
  category: "owner",
  react: "📵",
  filename: __filename
}, async (from, Prince, conText) => {
  const { reply, q, m, mek, isSuperUser, BOT_PIC, BOT_NAME } = conText;

  if (!isSuperUser) return reply("*Owner Only Command*");

  const infoMess = {
    image: { url: BOT_PIC },
    caption: `> *${BOT_NAME} 𝐀𝐍𝐓𝐈𝐂𝐀𝐋𝐋 𝐒𝐄𝐓𝐓𝐈𝐍𝐆𝐒*  

Reply With:

*1.* To Decline Calls  
*2.* To Decline & Block Callers  
*3.* To Disable Anticall  

╭────────────────◆  
│ ${config.FOOTER}
╰─────────────────◆`,
    contextInfo: {
      mentionedJid: [m.sender],
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: config.NEWSLETTER_JID,
        newsletterName: config.BOT_NAME || "PRINCE-SYSTEM",
        serverMessageId: 100
      }
    }
  };

  const messageSent = await Prince.sendMessage(from, infoMess);
  const messageId = messageSent.key.id;

  Prince.ev.on("messages.upsert", async (event) => {
    const messageData = event.messages[0];
    if (!messageData.message) return;

    const messageContent =
      messageData.message.conversation ||
      messageData.message.extendedTextMessage?.text;

    const isReplyToPrompt =
      messageData.message.extendedTextMessage?.contextInfo?.stanzaId === messageId;

    if (isReplyToPrompt) {
      await m.react("⬇🤖");
      switch (messageContent.trim()) {
        case "1":
          config.ANTICALL = "true";
          saveConfig();
          return reply("✅ Anticall enabled! Calls will be declined.");

        case "2":
          config.ANTICALL = "block";
          saveConfig();
          return reply("✅ Anticall enabled! Calls will be declined & callers blocked.");

        case "3":
          config.ANTICALL = "false";
          saveConfig();
          return reply("🚫 Anticall has been disabled!");

        default:
          await Prince.sendMessage(from, {
            text: "⚠️ Invalid option! Reply with 1, 2, or 3."
          });
      }
    }
  });

  await m.react("✅");
});
*/

/*
gmd({
  pattern: "anticall",
  alias: ["setanticall"],
  desc: "Enable or Disable Anticall",
  category: "settings",
  react: "📵",
  filename: __filename
}, async (from, Prince, conText) => {
  const { reply, BOT_PIC, BOT_NAME, isSuperUser, sender, mek, m } = conText;

  if (!isSuperUser) return reply("❌ This command is only for *SuperUsers*.");

  const infoMess = {
    image: { url: BOT_PIC },
    caption: `> *${BOT_NAME} 𝐀𝐍𝐓𝐈𝐂𝐀𝐋𝐋 𝐒𝐄𝐓𝐓𝐈𝐍𝐆𝐒*  

Reply With:

*1.* To Decline Calls  
*2.* To Decline & Block Callers  
*3.* To Disable Anticall  

╭────────────────◆  
│ ${config.FOOTER}
╰─────────────────◆`,
    contextInfo: {
      mentionedJid: [sender],
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: config.NEWSLETTER_JID,
        newsletterName: config.BOT_NAME || "PRINCE-SYSTEM",
        serverMessageId: 100
      }
    }
  };

  const messageSent = await Prince.sendMessage(from, infoMess, { quoted: mek });
  const messageId = messageSent.key.id;

  const handleResponse = async (event) => {
    const messageData = event.messages[0];
    if (!messageData.message) return;

    const messageContent =
      messageData.message.conversation ||
      messageData.message.extendedTextMessage?.text;

    const isReplyToPrompt =
      messageData.message.extendedTextMessage?.contextInfo?.stanzaId === messageId;

    if (isReplyToPrompt) {
      await Prince.sendMessage(from, { react: { text: "⬇🤖", key: messageData.key } });

      switch (messageContent.trim()) {
        case "1":
          config.ANTICALL = "true";
          saveConfig();
          return reply("✅ Anticall enabled! Calls will be declined.");

        case "2":
          config.ANTICALL = "block";
          saveConfig();
          return reply("✅ Anticall enabled! Calls will be declined & callers blocked.");

        case "3":
          config.ANTICALL = "false";
          saveConfig();
          return reply("🚫 Anticall has been disabled!");

        default:
          await Prince.sendMessage(from, {
            text: "⚠️ Invalid option! Reply with 1, 2, or 3."
          }, { quoted: messageData });
      }
    }
  };

  Prince.ev.on("messages.upsert", handleResponse);

  await Prince.sendMessage(from, { react: { text: "✅", key: mek.key } });
});
*/


gmd({
  pattern: "anticall",
  aliases: ["setanticall"],
  category: "owner",
  react: "📵",
  description: "Enable/Disable Anti-Call Feature",
}, async (from, Prince, conText) => {
  const { isSuperUser, reply, react, from: chatId, mek } = conText;

  if (!isSuperUser) return reply("❌ *Super User Only Command*");

  const imageUrl = config.BOT_PIC && config.BOT_PIC !== "" 
    ? config.BOT_PIC 
    : "https://i.ibb.co/8KzX3M3/botlogo.jpg"; // fallback

  const infoMess = {
    image: { url: imageUrl },
    caption: `> *${config.BOT_NAME} 𝐀𝐍𝐓𝐈𝐂𝐀𝐋𝐋 𝐒𝐄𝐓𝐓𝐈𝐍𝐆𝐒*  

Reply With:

*1.* Decline Calls  
*2.* Decline & Block Callers  
*3.* Disable Anticall  

╭────────────────◆  
│ ${config.FOOTER}  
╰─────────────────◆`,
    contextInfo: getContextInfo(conText.sender, conText.newsletterJid, conText.botName),
  };

  const sentMsg = await Prince.sendMessage(chatId, infoMess, { quoted: mek });
  const messageId = sentMsg.key.id;

  Prince.ev.on("messages.upsert", async (event) => {
    const messageData = event.messages[0];
    if (!messageData?.message) return;

    const messageContent =
      messageData.message.conversation ||
      messageData.message.extendedTextMessage?.text;

    const isReply =
      messageData.message.extendedTextMessage?.contextInfo?.stanzaId ===
      messageId;

    if (isReply) {
      await react("📵");
      switch (messageContent) {
        case "1":
          setSetting("ANTICALL", "decline");
          return reply("✅ Anticall enabled. Calls will be declined.");

        case "2":
          setSetting("ANTICALL", "block");
          return reply("✅ Anticall set to decline & block callers.");

        case "3":
          setSetting("ANTICALL", "false");
          return reply("❎ Anticall disabled.");

        default:
          await Prince.sendMessage(chatId, {
            text: "⚠️ Invalid option. Please reply with 1, 2, or 3.",
          });
      }
    }
  });

  await react("✅");
});

gmd({
  pattern: "antidelete",
  aliases: ["setantidelete"],
  desc: "Set antidelete mode: chat, group, all, or off",
  category: "owner",
  react: "🛡️",
  filename: __filename,
}, async (from, Prince, conText) => {
  const { q, reply, react, isSuperUser, getSetting, setSetting, sender, newsletterJid, botName, mek, botPic } = conText;
  if (!isSuperUser) return reply("❌ Owner Only Command!");
  
  const currentMode = String(
    getSetting("ANTIDELETE", config.ANTIDELETE || "off"),
  ).toLowerCase();
  const input = (q || '').trim().toLowerCase();
  const validModes = ['chat', 'group', 'all', 'off'];

  if (!input || !validModes.includes(input)) {
    const statusText = `*𝐏𝐑𝐈𝐍𝐂𝐄 𝐌𝐃𝐗 𝐀𝐍𝐓𝐈𝐃𝐄𝐋𝐄𝐓𝐄 𝐒𝐄𝐓𝐓𝐈𝐍𝐆𝐒*

📊 Current Mode: *${currentMode.toUpperCase()}*

Reply With:

*1.* Enable for Private Chats (DM)
*2.* Enable for Group Chats
*3.* Enable for All Chats
*4.* Disable Antidelete

_Or use directly:_
*.antidelete chat/group/all/off*

╭────────────────◆  
│ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴘɪɴᴄᴇ ᴛᴇᴄʜ  
╰─────────────────◆`;

    const sentMsg = await Prince.sendMessage(from, {
      image: { url: botPic },
      caption: statusText,
      contextInfo: getContextInfo(sender, newsletterJid, botName),
    }, { quoted: mek });

    const handler = async (event) => {
      const ms = event.messages[0];
      if (!ms?.message || ms.key.fromMe) return;

      const isReply = ms.message?.extendedTextMessage?.contextInfo?.stanzaId === sentMsg.key.id;
      if (isReply) {
        const text = (ms.message.conversation || ms.message.extendedTextMessage?.text || "").trim();
        let mode = "";
        if (text === "1") mode = "chat";
        else if (text === "2") mode = "group";
        else if (text === "3") mode = "all";
        else if (text === "4") mode = "off";

        if (mode) {
          Prince.ev.off("messages.upsert", handler);
           setSetting("ANTIDELETE", mode);
          await react("✅");
          return reply(`✅ *Antidelete set to:* ${mode.toUpperCase()}`);
        }
      }
    };

    Prince.ev.on("messages.upsert", handler);
    setTimeout(() => Prince.ev.off("messages.upsert", handler), 60000);
    return;
  }

  if (input === currentMode) {
    return reply(`⚠️ Antidelete is already set to *${input}*`);
  }

   setSetting("ANTIDELETE", input);
  await react("✅");
  await reply(`✅ *Antidelete set to:* ${input.toUpperCase()}`);
});

gmd({
  pattern: "del",
  aliases: ["delete", "dlt", "remove"],
  react: "🗑️",
  category: "group",
  description: "Delete a quoted message",
}, async (from, Prince, conText) => {
  const {
    reply,
    react,
    isSuperUser,
    isAdmin,
    isGroup,
    isBotAdmin,
    ms
  } = conText;

  if (!isGroup) return reply("❌ This command only works in groups!");
  if (!isSuperUser && !isAdmin) return reply("❌ Admin/Owner Only Command!");

  const botId = conText.botId || (Prince.user?.id ? Prince.user.id.split(":")[0] + "@s.whatsapp.net" : "");
  
  // High-reliability key extraction
  const getMessageKey = () => {
    // 1. From conText.quoted (helper populated)
    if (conText.quoted && conText.quoted.id) {
      return {
        remoteJid: from,
        fromMe: conText.quoted.fromMe,
        id: conText.quoted.id,
        participant: conText.quoted.sender || (conText.quoted.key && conText.quoted.key.participant)
      };
    }
    
    // 2. From raw message structure (ms.message)
    const contextInfo = ms.message?.extendedTextMessage?.contextInfo || 
                        ms.message?.imageMessage?.contextInfo || 
                        ms.message?.videoMessage?.contextInfo ||
                        ms.message?.documentWithCaptionMessage?.message?.documentMessage?.contextInfo ||
                        ms.message?.viewOnceMessage?.message?.imageMessage?.contextInfo ||
                        ms.message?.viewOnceMessageV2?.message?.imageMessage?.contextInfo;

    if (contextInfo && contextInfo.stanzaId) {
      return {
        remoteJid: from,
        fromMe: contextInfo.participant === botId || contextInfo.participant === Prince.user?.id,
        id: contextInfo.stanzaId,
        participant: contextInfo.participant
      };
    }
    
    return null;
  };

  const key = getMessageKey();

  if (!key || !key.id) {
    return reply("❌ Please quote a message to delete!");
  }

  try {
    const isBotMessage = key.fromMe;

    if (!isBotMessage && !isBotAdmin) {
      return reply(
        "❌ Bot needs admin rights to delete others' messages in groups!",
      );
    }

    await Prince.sendMessage(from, { delete: key });
    await react("✅");
  } catch (error) {
    console.error("Delete error details:", error);
    await react("❌");
    return reply(`❌ Failed to delete message: ${error.message}`);
  }
});

gmd({
  pattern: "antilink",
  aliases: ["setantilink"],
  category: "owner",
  react: "🔗",
  description: "Enable/Disable Anti-Link Feature (per-group)",
}, async (from, Prince, conText) => {
  const { isSuperUser, reply, react, from: chatId, mek, isGroup, q, getGroupSetting, setGroupSetting, groupName } = conText;

  if (!isSuperUser) return reply("❌ *Super User Only Command*");

  if (!isGroup) return reply("❌ This command can only be used in groups!");

  const currentSetting = getGroupSetting(chatId, 'ANTILINK', 'false');

  if (q) {
    const option = q.trim().toLowerCase();
    if (option === 'warn') {
      setGroupSetting(chatId, 'ANTILINK', 'warn');
      return reply("✅ Anti-link enabled for this group.\nMode: *Warn* — Links will be deleted and users warned.");
    } else if (option === 'delete') {
      setGroupSetting(chatId, 'ANTILINK', 'delete');
      return reply("✅ Anti-link enabled for this group.\nMode: *Delete* — Links will be deleted without removing users.");
    } else if (option === 'kick' || option === 'remove') {
      setGroupSetting(chatId, 'ANTILINK', 'kick');
      return reply("✅ Anti-link enabled for this group.\nMode: *Kick* — Users who send links will be removed.");
    } else if (option === 'off' || option === 'false' || option === 'disable') {
      setGroupSetting(chatId, 'ANTILINK', 'false');
      return reply("❎ Anti-link disabled for this group. Links will not be moderated.");
    }
  }

  const statusIcon = currentSetting === 'false' ? '❌ Off' : `✅ ${currentSetting}`;

  const infoMess = {
    image: { url: config.BOT_PIC },
    caption: `> *${config.BOT_NAME} 𝐀𝐍𝐓𝐈𝐋𝐈𝐍𝐊 𝐒𝐄𝐓𝐓𝐈𝐍𝐆𝐒*

📍 Group: *${groupName}*
📊 Current status: *${statusIcon}*

Reply With:

*1.* To Enable Antilink => Warn  
*2.* To Enable Antilink => Delete  
*3.* To Enable Antilink => Remove/Kick  
*4.* To Disable Antilink Feature  

_Or use directly:_
*.antilink warn/delete/kick/off*

╭────────────────◆  
│ ${config.FOOTER}  
╰─────────────────◆`,
    contextInfo: getContextInfo(conText.sender, conText.newsletterJid, conText.botName),
  };

  const sentMsg = await Prince.sendMessage(chatId, infoMess, { quoted: mek });
  const messageId = sentMsg.key.id;

  const handler = async (event) => {
    const messageData = event.messages[0];
    if (!messageData?.message) return;

    const messageContent =
      messageData.message.conversation ||
      messageData.message.extendedTextMessage?.text;

    const isReplyToMenu =
      messageData.message.extendedTextMessage?.contextInfo?.stanzaId ===
      messageId;

    if (isReplyToMenu) {
      Prince.ev.off("messages.upsert", handler);
      await react("🔗");
      switch (messageContent) {
        case "1":
          setGroupSetting(chatId, 'ANTILINK', 'warn');
          return reply(
            "✅ Anti-link enabled for this group.\nMode: *Warn* — Links will be deleted and users warned."
          );

        case "2":
          setGroupSetting(chatId, 'ANTILINK', 'delete');
          return reply(
            "✅ Anti-link enabled for this group.\nMode: *Delete* — Links will be deleted without removing users."
          );

        case "3":
          setGroupSetting(chatId, 'ANTILINK', 'kick');
          return reply(
            "✅ Anti-link enabled for this group.\nMode: *Kick* — Users who send links will be removed."
          );

        case "4":
          setGroupSetting(chatId, 'ANTILINK', 'false');
          return reply(
            "❎ Anti-link disabled for this group. Links will not be moderated."
          );

        default:
          await Prince.sendMessage(chatId, {
            text: "⚠️ Invalid option. Please reply with 1, 2, 3 or 4.",
          });
      }
    }
  };

  Prince.ev.on("messages.upsert", handler);

  setTimeout(() => {
    Prince.ev.off("messages.upsert", handler);
  }, 60000);

  await react("✅");
});


gmd({
  pattern: "shell",
  react: "👑",
  aliases: ['exec', 'terminal', 'sh', 'ex'],
  category: "owner",
  description: "Run shell commands",
}, async (from, Prince, conText) => {
  const { q, mek, react, reply, isDevs } = conText;

  if (!isDevs) {
    await react("❌");
    return reply("❌ Developer Only Command!");
  }

  if (!q) {
    await react("❌");
    return reply("❌ Please provide a shell command!");
  }

  try {
    const options = {
      maxBuffer: 10 * 1024 * 1024, 
      encoding: 'utf-8'
    };

    exec(q, options, async (err, stdout, stderr) => {
      try {
        if (err) {
          await react("❌");
          return reply(`Error: ${err.message}`);
        }
        if (stderr) {
          await react("⚠️");
          return reply(`stderr: ${stderr}`);
        }

        const zipPath = extractFilePath(stdout) || (q.includes('zip') ? extractFilePath(q) : null);
        if (zipPath && fsA.existsSync(zipPath)) {
          await handleZipFile(from, Prince, mek, react, zipPath);
          return;
        }

        if (stdout) {
          if (stdout.length > 10000) {
            await handleLargeOutput(from, Prince, mek, react, stdout);
          } else {
            await react("✅");
            await reply(stdout);
          }
        } else {
          await react("✅");
          await reply("Command executed successfully (no output)");
        }
      } catch (error) {
        console.error("Output handling error:", error);
        await react("❌");
        await reply(`❌ Output handling error: ${error.message}`);
      }
    });
  } catch (error) {
    console.error("Exec Error:", error);
    await react("❌");
    await reply(`❌ Error: ${error.message}`);
  }
});

function extractFilePath(text) {
  const match = text.match(/(\/[^\s]+\.zip)/);
  return match ? match[0].trim() : null;
}

async function handleZipFile(from, Prince, mek, react, zipPath) {
  try {
    await react("📦");
    const zipContent = fsA.readFileSync(zipPath);
    const filename = path.basename(zipPath);
    await Prince.sendMessage(from, {
      document: zipContent,
      fileName: filename,
      mimetype: 'application/zip'
    }, { quoted: mek });
    fsA.unlinkSync(zipPath);
  } catch (e) {
    console.error("Zip send error:", e);
    throw e;
  }
}

async function handleLargeOutput(from, Prince, mek, react, stdout) {
  await react("📤");
  let extension = '.txt';
  let mimetype = 'text/plain';
  let fileContent = stdout;
  
  const isPotentialJson = /^[\s]*[\{\[]/.test(stdout) && /[\}\]]$/.test(stdout.trim());
  if (isPotentialJson) {
    try {
      const jsonObj = JSON.parse(stdout);
      fileContent = JSON.stringify(jsonObj, null, 2);
      extension = '.json';
      mimetype = 'application/json';
    } catch (e) {}
  }
 
  if (mimetype === 'text/plain') {
    if (/<\s*html[\s>]|<!DOCTYPE html>/i.test(stdout)) {
      extension = '.html';
      mimetype = 'text/html';
    } else if (/<\s*\/?\s*(div|span|p|a|img|body|head|title)[\s>]/i.test(stdout)) {
      extension = '.html';
      mimetype = 'text/html';
    } else if (/function\s*\w*\s*\(|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|class\s+\w+/i.test(stdout)) {
      extension = '.js';
      mimetype = 'application/javascript';
    } else if (/^\s*#\s.*|^\s*-\s.*|^\s*\*\s.*|^\s*\d+\.\s.*/.test(stdout)) {
      extension = '.md';
      mimetype = 'text/markdown';
    } else if (/^\s*(def|class)\s+\w+|^\s*import\s+\w+|^\s*from\s+\w+|^\s*print\(/.test(stdout)) {
      extension = '.py';
      mimetype = 'text/x-python';
    } else if (/^\s*package\s+\w+|^\s*import\s+\w+\.\w+|^\s*public\s+class\s+\w+/.test(stdout)) {
      extension = '.java';
      mimetype = 'text/x-java-source';
    } else if (/<\?php|\$[a-zA-Z_]+\s*=|function\s+\w+\s*\(/.test(stdout)) {
      extension = '.php';
      mimetype = 'application/x-httpd-php';
    } else if (/^\s*#include\s+<|^\s*int\s+main\s*\(|^\s*printf\s*\(/.test(stdout)) {
      extension = '.c';
      mimetype = 'text/x-csrc';
    } else if (/^\s*#include\s+<|^\s*using\s+namespace|^\s*cout\s*<</.test(stdout)) {
      extension = '.cpp';
      mimetype = 'text/x-c++src';
    } else if (/^\s*<[?]xml\s+version|<\w+\s+xmlns(:?\w+)?=/.test(stdout)) {
      extension = '.xml';
      mimetype = 'application/xml';
    } else if (/^\s*#!\s*\/bin\/bash|^\s*echo\s+\"\$/.test(stdout)) {
      extension = '.sh';
      mimetype = 'application/x-sh';
    } else if (/^\s*---\s*$|^\s*title\s*:/m.test(stdout)) {
      extension = '.yml';
      mimetype = 'application/x-yaml';
    }
  }
  
  const filename = `output_${Date.now()}${extension}`;
  await Prince.sendMessage(from, {
    document: Buffer.from(fileContent),
    fileName: filename,
    mimetype: mimetype
  }, { quoted: mek });
}


gmd({
  pattern: "eval",
  react: "👑",
  category: "owner",
  description: "Eval any JavaScript code (sync/async)",
}, async (from, Prince, conText) => {
  const { 
    m, mek, edit, react, del, args, quoted, isCmd, command, 
    isAdmin, isBotAdmin, isSuperAdmin, sender, pushName, setSudo, delSudo, 
    q, reply, config, superUser, tagged, mentionedJid, 
    isGroup, groupInfo, groupName, getSudoNumbers, authorMessage, 
    user, groupMember, repliedMessage, quotedMsg, quotedUser, 
    isSuperUser, botMode, botPic, botFooter, botCaption, 
    botVersion, groupAdmins, participants, ownerNumber, ownerName, botName, princeRepo, 
    getMediaBuffer, getFileContentType, bufferToStream, 
    uploadToPixhost, uploadToImgBB, uploadToGithubCdn, 
    uploadToPrinceCdn, uploadToPasteboard, uploadToCatbox, 
    newsletterUrl, newsletterJid, PrinceTechApi, PrinceApiKey, 
    botPrefix, gmdBuffer, gmdJson, formatAudio, formatVideo, timeZone,
    isDevs
  } = conText;

  if (!isDevs) {
    await react("❌");
    return reply("❌ Developer Only Command!");
  }

  if (!q) {
    await react("❌");
    return reply("❌ Please provide code to evaluate!");
  }

  try {
    const isAsync = q.includes('await') || q.includes('async');

    let evaled;
    if (isAsync) {
      evaled = await eval(`(async () => { 
        try { 
          return ${q.includes('return') ? q : `(${q})`} 
        } catch (e) { 
          return "❌ Async Eval Error: " + e.message; 
        } 
      })()`);
    } else {
      evaled = eval(q);
    }
    if (typeof evaled !== 'string') {
      evaled = require('util').inspect(evaled, { depth: 1 });
    }
    await Prince.sendMessage(from, {
      text: evaled,
      mentions: [quotedUser]
    }, { quoted: mek });
    await react("✅");
  } catch (error) {
    console.error("Eval Error:", error);
    await react("❌");
    await reply(`❌ Error: ${error.message}`);
  }
});


gmd({
  pattern: "setsudo",
  aliases: ['addsudo'],
  react: "👑",
  category: "owner",
  description: "Sets User as Sudo",
}, async (from, Prince, conText) => {
  const { q, mek, reply, react, isGroup, isSuperUser, quotedUser, setSudo, mentionedJid } = conText;

  if (!isSuperUser) {
    await react("❌");
    return reply("❌ Owner Only Command!");
  }

  if (!quotedUser && !q && (!mentionedJid || mentionedJid.length === 0)) {
    await react("❌");
    return reply("❌ Please reply to a user, mention them, or provide a phone number!\n\nUsage:\n• Reply to a message: .setsudo\n• Mention: .setsudo @user\n• Number: .setsudo 237XXXXXXXXX");
  }

  try {
    let userNumber;

    if (quotedUser) {
      userNumber = quotedUser.split("@")[0];
    } else if (mentionedJid && mentionedJid.length > 0) {
      userNumber = mentionedJid[0].split("@")[0];
    } else if (q) {
      userNumber = q.replace(/[^0-9]/g, '');
    }

    if (!userNumber || userNumber.length < 5) {
      await react("❌");
      return reply("❌ Invalid number provided!");
    }

    const added = setSudo(userNumber);
    const msg = added
      ? `✅ Added @${userNumber} to sudo list.`
      : `⚠️ @${userNumber} is already in sudo list.`;

    await Prince.sendMessage(from, {
      text: msg,
      mentions: [`${userNumber}@s.whatsapp.net`]
    }, { quoted: mek });
    await react("✅");

  } catch (error) {
    console.error("setsudo error:", error);
    await react("❌");
    await reply(`❌ Error: ${error.message}`);
  }
});


gmd({
  pattern: "delsudo",
  aliases: ['removesudo'],
  react: "👑",
  category: "owner",
  description: "Deletes User as Sudo",
}, async (from, Prince, conText) => {
  const { q, mek, reply, react, isGroup, isSuperUser, quotedUser, delSudo, mentionedJid } = conText;

  if (!isSuperUser) {
    await react("❌");
    return reply("❌ Owner Only Command!");
  }

  if (!quotedUser && !q && (!mentionedJid || mentionedJid.length === 0)) {
    await react("❌");
    return reply("❌ Please reply to a user, mention them, or provide a phone number!\n\nUsage:\n• Reply to a message: .delsudo\n• Mention: .delsudo @user\n• Number: .delsudo 237XXXXXXXXX");
  }

  try {
    let userNumber;

    if (quotedUser) {
      userNumber = quotedUser.split("@")[0];
    } else if (mentionedJid && mentionedJid.length > 0) {
      userNumber = mentionedJid[0].split("@")[0];
    } else if (q) {
      userNumber = q.replace(/[^0-9]/g, '');
    }

    if (!userNumber || userNumber.length < 5) {
      await react("❌");
      return reply("❌ Invalid number provided!");
    }

    const removed = delSudo(userNumber);
    const msg = removed
      ? `❌ Removed @${userNumber} from sudo list.`
      : `⚠️ @${userNumber} is not in the sudo list.`;

    await Prince.sendMessage(from, {
      text: msg,
      mentions: [`${userNumber}@s.whatsapp.net`]
    }, { quoted: mek });
    await react("✅");

  } catch (error) {
    console.error("delsudo error:", error);
    await react("❌");
    await reply(`❌ Error: ${error.message}`);
  }
});


gmd({
  pattern: "getsudo",
  aliases: ['getsudos', 'listsudo', 'listsudos'],
  react: "👑",
  category: "owner",
  description: "Get All Sudo Users",
}, async (from, Prince, conText) => {
  const { q, mek, config, reply, react, isGroup, isSuperUser, quotedUser, getSudoNumbers } = conText;

  try {
    if (!isSuperUser) {
      await react("❌");
      return reply("❌ Owner Only Command!");
    }
    // Get sudo numbers from both sources
    const sudoFromFile = getSudoNumbers() || [];
    const sudoFromConfig = (config.SUDO_NUMBERS ? config.SUDO_NUMBERS.split(',') : [])
      .map(num => num.trim().replace(/\D/g, ''))
      .filter(num => num.length > 5);

    // Combine and deduplicate
    const allSudos = [...new Set([...sudoFromFile, ...sudoFromConfig])];

    if (!allSudos.length) {
      return reply("⚠️ No sudo users added yet (neither in config nor in sudo file).");
    }

    let msg = "*👑 ALL SUDO USERS*\n\n";
    msg += `*Config SUDO_NUMBERS (${sudoFromConfig.length}):*\n`;
    sudoFromConfig.forEach((num, i) => {
      msg += `${i + 1}. wa.me/${num}\n`;
    });

    msg += `\n*File SUDO_NUMBERS (${sudoFromFile.length}):*\n`;
    sudoFromFile.forEach((num, i) => {
      msg += `${i + 1}. wa.me/${num}\n`;
    });

    msg += `\n*Total Sudo Users: ${allSudos.length}*`;
    
    await reply(msg);
    await react("✅");

  } catch (error) {
    console.error("getsudo error:", error);
    await react("❌");
    await reply(`❌ Error: ${error.message}`);
  }
});


gmd({
  pattern: "mode",
  react: "⚙️",
  aliases: ['setmode', 'botmode'],
  category: "owner",
  description: "Switch bot mode between private and public",
}, async (from, Prince, conText) => {
  const { q, mek, reply, react, isSuperUser, getSetting, setSetting, config } = conText;

  if (!isSuperUser) {
    await react("❌");
    return reply("❌ Owner Only Command!");
  }

  const currentMode = getSetting('BOT_MODE', config.MODE || 'private').toLowerCase();

  if (!q) {
    const modeIcon = currentMode === 'public' ? '🌍' : '🔒';
    return reply(`${modeIcon} Current bot mode: *${currentMode}*\n\nUsage:\n• .mode private - Only owner/sudo can use commands\n• .mode public - Everyone can use commands`);
  }

  const newMode = q.trim().toLowerCase();

  if (newMode !== 'private' && newMode !== 'public') {
    await react("❌");
    return reply("❌ Invalid mode! Use *private* or *public*\n\n• .mode private - Only owner/sudo can use commands\n• .mode public - Everyone can use commands");
  }

  if (newMode === currentMode) {
    return reply(`⚠️ Bot is already in *${currentMode}* mode.`);
  }

  setSetting('BOT_MODE', newMode);

  const modeIcon = newMode === 'public' ? '🌍' : '🔒';
  await reply(`${modeIcon} Bot mode changed to *${newMode}*\n\n${newMode === 'private' ? '🔒 Only owner and sudo users can use commands now.' : '🌍 Everyone can now use bot commands.'}`);
  await react("✅");
});


gmd({
  pattern: "botname",
  react: "✏️",
  aliases: ['setbotname', 'renamebot'],
  category: "owner",
  description: "Change the bot name",
}, async (from, Prince, conText) => {
  const { q, reply, react, isSuperUser, getSetting, setSetting, botName } = conText;

  if (!isSuperUser) {
    await react("❌");
    return reply("❌ Owner Only Command!");
  }

  if (!q) {
    const currentName = getSetting('BOT_NAME', botName);
    return reply(`✏️ Current bot name: *${currentName}*\n\nUsage: .botname PRINCE-MDX`);
  }

  const newName = q.trim();
  setSetting('BOT_NAME', newName);

  await reply(`✅ Bot name changed to: *${newName}*`);
  await react("✅");
});


gmd({
  pattern: "setprefix",
  react: "⚙️",
  aliases: ['prefix', 'changeprefix'],
  category: "owner",
  description: "Change the bot command prefix",
}, async (from, Prince, conText) => {
  const { q, reply, react, isSuperUser, getSetting, setSetting, botPrefix, quotedMsg } = conText;

  if (!isSuperUser) {
    await react("❌");
    return reply("❌ Owner Only Command!");
  }

  let text = q?.trim() || "";
  if (!text && quotedMsg) {
    text = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || "";
    text = text.trim();
  }

  if (!text) {
    const currentPrefix = getSetting('PREFIX', botPrefix);
    return reply(`⚙️ Current prefix: *${currentPrefix}*\n\nUsage: .setprefix !\nExample: .setprefix P\nExample: .setprefix #\nExample: .setprefix /\n\nYou can also *reply to a message* containing the prefix.`);
  }

  const newPrefix = text.charAt(0);
  setSetting('PREFIX', newPrefix);

  await reply(`✅ Prefix changed to: *${newPrefix}*\n\nNow use commands like: *${newPrefix}menu*`);
  await react("✅");
});


gmd({
  pattern: "botimg",
  react: "🖼️",
  aliases: ['setbotimg', 'botpic', 'setbotpic', 'botimage'],
  category: "owner",
  description: "Change the bot image",
}, async (from, Prince, conText) => {
  const { q, reply, react, isSuperUser, getSetting, setSetting, botPic, quoted, mek } = conText;

  if (!isSuperUser) {
    await react("❌");
    return reply("❌ Owner Only Command!");
  }

  const quotedImg = quoted?.imageMessage || quoted?.message?.imageMessage;

  if (quotedImg) {
    await react("⏳");
    let tempFilePath;
    try {
      tempFilePath = await Prince.downloadAndSaveMediaMessage(quotedImg, 'temp_botimg');
      const imageBuffer = fs.readFileSync(tempFilePath);
      const result = await uploadToImgBB(imageBuffer, 'botimg.jpg');

      if (!result?.url) {
        await react("❌");
        return reply("❌ Failed to upload image. Try again.");
      }

      const newUrl = result.url;
      setSetting('BOT_PIC', newUrl);

      await Prince.sendMessage(from, {
        image: { url: newUrl },
        caption: `✅ Bot image updated!\n\n🖼️ New image: ${newUrl}`,
      }, { quoted: mek });
      await react("✅");
    } catch (e) {
      console.error("BotImg upload error:", e);
      await react("❌");
      return reply("❌ Failed to upload image: " + e.message);
    } finally {
      if (tempFilePath) {
        try { fs.unlinkSync(tempFilePath); } catch (e) {}
      }
    }
    return;
  }

  if (!q) {
    const currentPic = getSetting('BOT_PIC', botPic);
    return reply(`🖼️ Current bot image:\n${currentPic}\n\nUsage:\n*.botimg <url>* - Set image from URL\n*Reply to an image* with *.botimg* to upload and set it`);
  }

  const newUrl = q.trim();

  if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
    await react("❌");
    return reply("❌ Please provide a valid URL starting with http:// or https://");
  }

  setSetting('BOT_PIC', newUrl);

  await reply(`✅ Bot image updated!\n\n🖼️ New image: ${newUrl}`);
  await react("✅");
});


gmd({
  pattern: "cmd",
  react: "👑",
  aliases: ['getcmd'],
  category: "owner",
  description: "Get and send a command",
}, async (from, Prince, conText) => {
  const { mek, reply, react, isSuperUser, q, botPrefix } = conText;

  if (!isSuperUser) {
    await react("❌");
    return reply("❌ Owner Only Command!");
  }

  if (!q) {
    await react("❌");
    return reply(`❌ Please provide a command name!\nExample: ${botPrefix}cmd owner`);
  }

  try {
    const commandName = q.toLowerCase();
    const commandData = commands.find(cmd => 
      cmd.pattern.toLowerCase() === commandName || 
      (cmd.aliases && cmd.aliases.some(alias => alias.toLowerCase() === commandName))
    );
    if (!commandData) {
      await react("❌");
      return reply("❌ Command not found!");
    }

    const commandPath = commandData.filename;
    const fullCode = await fs.promises.readFile(commandPath, 'utf-8');
    const extractCommand = (code, pattern) => {
      const possibleStarts = [
        `gmd({\n  pattern: "${pattern}"`,
        `gmd({\n  pattern: '${pattern}'`,
        `gmd({\n  pattern: \`${pattern}\``,
        `gmd({ pattern: "${pattern}"`,
        `gmd({ pattern: '${pattern}'`,
        `gmd({ pattern: \`${pattern}\``,
        `gmd({\n    pattern: "${pattern}"`,
        `gmd({\n    pattern: '${pattern}'`,
        `gmd({\n    pattern: \`${pattern}\``
      ];

      let startIndex = -1;
      for (const start of possibleStarts) {
        startIndex = code.indexOf(start);
        if (startIndex !== -1) break;
      }
      if (startIndex === -1) return null;
      let braceCount = 0;
      let inString = false;
      let stringChar = '';
      let escapeNext = false;
      let commandEnd = startIndex;

      for (let i = startIndex; i < code.length; i++) {
        const char = code[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (!inString && (char === '"' || char === "'" || char === '`')) {
          inString = true;
          stringChar = char;
          continue;
        }

        if (inString && char === stringChar) {
          inString = false;
          continue;
        }

        if (char === '\\') {
          escapeNext = true;
          continue;
        }

        if (!inString) {
          if (char === '{' || char === '(') braceCount++;
          if (char === '}' || char === ')') braceCount--;

          if (braceCount === 0 && char === ')') {
            commandEnd = i + 1;
            break;
          }
        }
      }

      return code.substring(startIndex, commandEnd).trim();
    };

    let commandCode = extractCommand(fullCode, commandData.pattern) || 
                     "Could not extract command code";
    const response = `📁 *Command File:* ${path.basename(commandPath)}\n` +
                     `⚙️ *Command Name:* ${commandData.pattern}\n` +
                     `📝 *Description:* ${commandData.description || "Not provided"}\n\n` +
                     `📜 *Command Code:*\n\`\`\`\n${commandCode}\n\`\`\``;
    const fileName = commandName;
        const tempPath = path.join(__dirname, fileName);
        fsA.writeFileSync(tempPath, commandCode);
        await reply(response);
        await Prince.sendMessage(from, { 
            document: fsA.readFileSync(tempPath),
            mimetype: 'text/javascript',
            fileName: `${fileName}.js`
        }, { quoted: mek });
        fsA.unlinkSync(tempPath);
    await react("✅");
  } catch (error) {
    console.error("getcmd error:", error);
    await react("❌");
    await reply(`❌ Error: ${error.message}`);
  }
});


gmd({
  pattern: "jid",
  react: "👑",
  category: "owner",
  description: "Get User/Group JID",
}, async (from, Prince, conText) => {
  const { q, mek, reply, react, isGroup, isSuperUser, quotedUser } = conText;

  if (!isSuperUser) {
    await react("❌");
    return reply("❌ Owner Only Command!");
  }

  try {
    let result;
    
    if (quotedUser) {
      console.log(quotedUser);
      if (quotedUser.startsWith('@') && quotedUser.includes('@lid')) {
        result = quotedUser.replace('@', '') + '@lid';
      } else {
        result = quotedUser;
      }
    }
    else if (isGroup) {
      result = from;
    }
    else {
      result = from || mek.key.remoteJid; 
    }
    console.log(result);

    let finalResult = result;
    if (result && result.includes('@lid')) {
      finalResult = await Prince.getJidFromLid(result);
    }

    await reply(`${finalResult}`);
    await react("✅");

  } catch (error) {
    console.error("getjid error:", error);
    await react("❌");
    await reply(`❌ Error: ${error.message}`);
  }
});


gmd({
  pattern: "getlid",
  react: "👑",
  aliases: ['lid', 'userlid'],
  category: "Group",
  description: "Get User JID from LID",
}, async (from, Prince, conText) => {
  const { q, reply, react, isSuperUser, isGroup, quotedUser } = conText;

  if (!isGroup) {
    await react("❌");
    return reply("❌ Group Only Command!");
  }

  if (!q && !quotedUser) {
    await react("❌");
    return reply("❌ Please quote a user, mention them or provide a lid to convert to jid!");
  }

  if (!isSuperUser) {
    await react("❌");
    return reply("❌ Owner Only Command!");
  }

  try {
    let target = quotedUser || q;
    let conversionNote = "";

    if (target.startsWith('@') && !target.includes('@lid')) {
      target = target.replace('@', '') + '@lid';
      conversionNote = `\n\nℹ️ Converted from mention format`;
    }

    else if (!target.endsWith('@lid')) {
      try {
        const lid = await Prince.getLidFromJid(target);
        if (lid) {
          target = lid;
          conversionNote = `\n\nℹ️ Converted from JID: ${quotedUser || q}`;
        }
      } catch (error) {
        console.error("LID conversion error:", error);
        conversionNote = `\n\n⚠️ Could not convert (already in LID)`;
      }
    }

    await reply(`${target}${conversionNote}`);
    await react("✅");

  } catch (error) {
    console.error("getlid error:", error);
    await react("❌");
    await reply(`❌ Error: ${error.message}`);
  }
});


gmd({
  pattern: "owner",
  react: "👑",
  category: "owner",
  description: "Get Bot Owner.",
}, async (from, Prince, conText) => {
  const { mek, reply, react, isSuperUser, ownerNumber, ownerName, botName } = conText;
  
  if (!isSuperUser) {
    await react("❌");
    return reply(`Owner Only Command!`);
  }
 
  try {
    const vcard = 'BEGIN:VCARD\n'
          + 'VERSION:3.0\n' 
          + `FN:${ownerName}\n` 
          + `ORG:${botName};\n` 
          + `TEL;type=CELL;type=VOICE;waid=${ownerNumber}:${ownerNumber}\n`
          + 'END:VCARD';
    
    await Prince.sendMessage(
      from,
      { 
        contacts: { 
          displayName: ownerName, 
          contacts: [{ vcard }] 
        }
      }, 
      { quoted: mek } 
    );
    
    await react("✅");
  } catch (error) {
    await react("❌");
    await reply(`❌ Failed: ${error.message}`);
  }
});


gmd({
  pattern: "gcpp",
  aliases: ['setgcpp', 'gcfullpp', 'fullgcpp'],
  react: "🔮",
  category: "owner",
  description: "Set group full profile picture without cropping.",
}, async (from, Prince, conText) => {
  const { mek, reply, react, sender, quoted, isGroup, isSuperUser, isAdmin } = conText;
  
  if (!isAdmin) {
    await react("❌");
    return reply(`Admin Only Command!`);
  }
  
  if (!isGroup) {
    await react("❌");
    return reply(`Command can only be used in groups!`);
  }
  
  let tempFilePath;
  try {
    const quotedImg = quoted?.imageMessage || quoted?.message?.imageMessage;
    if (!quotedImg) {
      await react("❌");
      return reply("Please quote an image");
    }
    tempFilePath = await Prince.downloadAndSaveMediaMessage(quotedImg, 'temp_media');
    
    const image = await Jimp.read(tempFilePath);
    const croppedImage = image.crop(0, 0, image.getWidth(), image.getHeight());
    const resizedImage = await croppedImage.scaleToFit(720, 720);
    const imageBuffer = await resizedImage.getBufferAsync(Jimp.MIME_JPEG);

    const pictureNode = {
      tag: "picture",
      attrs: { type: "image" },
      content: imageBuffer
    };

    const iqNode = {
      tag: "iq",
      attrs: {
        to: S_WHATSAPP_NET,
        type: "set",
        xmlns: "w:profile:picture",
        target: from
      },
      content: [pictureNode]
    };

    await Prince.query(iqNode);
    await react("✅");
    await fs.unlink(tempFilePath);
    await reply('✅ Group Profile picture updated successfully (full image)!');
    
  } catch (error) {
    console.error("Error updating group profile picture:", error);
    
    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch(console.error);
    }
    
    if (error.message.includes('not-authorized') || error.message.includes('forbidden')) {
      await reply("❌ I need to be an admin to update group profile picture!");
    } else {
      await reply(`❌ Failed to update group profile picture: ${error.message}`);
    }
    await react("❌");
  }
});




gmd({
  pattern: "fullpp",
  aliases: ['setfullpp'],
  react: "🔮",
  category: "owner",
  description: "Set full profile picture without cropping.",
}, async (from, Prince, conText) => {
  const { mek, reply, react, sender, quoted, isSuperUser } = conText;
  
  if (!isSuperUser) {
    await react("❌");
    return reply(`Owner Only Command!`);
  }
  let tempFilePath;
  try {
    const quotedImg = quoted?.imageMessage || quoted?.message?.imageMessage;
    if (!quotedImg) {
      await react("❌");
      return reply("Please quote an image");
    }
    tempFilePath = await Prince.downloadAndSaveMediaMessage(quotedImg, 'temp_media');
    
    const image = await Jimp.read(tempFilePath);
    const croppedImage = image.crop(0, 0, image.getWidth(), image.getHeight());
    const resizedImage = await croppedImage.scaleToFit(720, 720);
    const imageBuffer = await resizedImage.getBufferAsync(Jimp.MIME_JPEG);

    const pictureNode = {
      tag: "picture",
      attrs: { type: "image" },
      content: imageBuffer
    };

    const iqNode = {
      tag: "iq",
      attrs: {
        to: S_WHATSAPP_NET,
        type: "set",
        xmlns: "w:profile:picture"
      },
      content: [pictureNode]
    };

    await Prince.query(iqNode);
    await react("✅");
    await fs.unlink(tempFilePath);
    await reply('✅ Profile picture updated successfully (full image)!');
    
  } catch (error) {
    console.error("Error updating profile picture:", error);
    
    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch(console.error);
    }
    
    await reply(`❌ Failed to update profile picture: ${error.message}`);
    await react("❌");
  }
});


gmd({
  pattern: "whois",
  aliases: ['profile'],
  react: "👀",
  category: "owner",
  description: "Get someone's full profile details.",
}, async (from, Prince, conText) => {
  const { mek, reply, react, sender, quoted, timeZone, isGroup, quotedMsg, newsletterJid, quotedUser, botName, botFooter, isSuperUser } = conText;
  
  if (!isSuperUser) {
    await react("❌");
    return reply(`Owner Only Command!`);
  }

  if (!quotedUser) {
    await react("❌");
    return reply(`Please reply to/quote a user or their message!`);
  }
  
  let profilePictureUrl;
  let statusText = "Not Found";
  let setAt = "Not Available";
  let targetUser = quotedUser;
  
  try {
    if (quoted) {
      if (isGroup && !targetUser.endsWith('@s.whatsapp.net')) {
        try {
          const jid = await Prince.getJidFromLid(targetUser);
          if (jid) targetUser = jid;
        } catch (error) {
          console.error("Error converting LID to JID:", error);
        }
      }

      try {
        profilePictureUrl = await Prince.profilePictureUrl(targetUser, "image");
      } catch (error) {
        console.error("Error fetching profile picture:", error);
        profilePictureUrl = "https://telegra.ph/file/9521e9ee2fdbd0d6f4f1c.jpg";
      }

      try {
        const statusData = await Prince.fetchStatus(targetUser);
        console.log("Status Data:", statusData);
        
        if (statusData && statusData.length > 0 && statusData[0].status) {
          statusText = statusData[0].status.status || "Not Found";
          setAt = statusData[0].status.setAt || "Not Available";
        }
      } catch (error) {
        console.error("Error fetching status:", error);
      }

      let formattedDate = "Not Available";
      if (setAt && setAt !== "Not Available") {
        try {
          formattedDate = moment(setAt)
            .tz(timeZone)
            .format('dddd, MMMM Do YYYY, h:mm A z');
        } catch (e) {
          console.error("Error formatting date:", e);
        }
      }

      const number = targetUser.replace(/@s\.whatsapp\.net$/, "");

      await Prince.sendMessage(
        from,
        {
          image: { url: profilePictureUrl },
          caption: `*👤 User Profile Information*\n\n` +
                   `*• Name:* @${number}\n` +
                   `*• Number:* ${number}\n` +
                   `*• About:* ${statusText}\n` +
                   `*• Last Updated:* ${formattedDate}\n\n` +
                   `_${botFooter}_`,
          contextInfo: getContextInfo(targetUser, conText.newsletterJid, conText.botName),
        },
        { quoted: mek }
      );
      await react("✅");
    }
  } catch (error) {
    console.error("Error in whois command:", error);
    await reply(`❌ An error occurred while fetching profile information.\nError: ${error.message}`);
    await react("❌");
  }
});


gmd({
  pattern: "pp",
  aliases: ['setpp'],
  react: "🔮",
  category: "owner",
  description: "Set new profile picture.",
}, async (from, Prince, conText) => {
  const { mek, reply, react, sender, quoted, isSuperUser } = conText;
  
  if (!isSuperUser) {
    await react("❌");
    return reply(`Owner Only Command!`);
  }
  
  try {
    const quotedImg = quoted?.imageMessage || quoted?.message?.imageMessage;
    if (!quotedImg) {
      await react("❌");
      return reply("Please quote an image");
    }
    
    const tempFilePath = await Prince.downloadAndSaveMediaMessage(quotedImg, 'temp_media');
    const imageBuffer = await fs.readFile(tempFilePath);
    try {
      await Prince.updateProfilePicture(Prince.user.id, { url: tempFilePath });
      await reply('Profile picture updated successfully!');
      await react("✅");
    } catch (modernError) {
      console.log('Modern method failed, trying legacy method...');

      const iq = {
        tag: "iq",
        attrs: {
          to: S_WHATSAPP_NET,
          type: "set",
          xmlns: "w:profile:picture"
        },
        content: [{
          tag: "picture",
          attrs: {
            type: "image",
          },
          content: imageBuffer
        }]
      };
      
      await Prince.query(iq);
      await reply('Profile picture update requested (legacy method)');
      await react("✅");
    }
    await fs.unlink(tempFilePath).catch(console.error);
    
  } catch (error) {
    console.error("Error updating profile picture:", error);
    await reply(`❌ An error occurred: ${error.message}`);
    await react("❌");
    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch(console.error);
    }
  }
});


gmd({
  pattern: "getpp",
  aliases: ['stealpp', 'snatchpp'],
  react: "👀",
  category: "owner",
  description: "Download someone's profile picture.",
}, async (from, Prince, conText) => {
  const { mek, reply, react, sender, quoted, quotedMsg, newsletterJid, quotedUser, botName, botFooter, isSuperUser } = conText;
  
  if (!isSuperUser) {
    await react("❌");
    return reply(`Owner Only Command!`);
  }

  if (!quotedMsg) {
    await react("❌");
    return reply(`Please reply to/quote a user to get their profile picture!`);
  }
  
  let profilePictureUrl;
  
  try {
    if (quoted) {
      try {
        profilePictureUrl = await Prince.profilePictureUrl(quotedUser, "image");
        
      } catch (error) {
        await react("❌");
        return reply(`User does not have profile picture or they have set it to private!`);
      }

      await Prince.sendMessage(
        from,
        {
          image: { url: profilePictureUrl },
          caption: `Here is the Profile Picture\n\n> *${botFooter}*`,
          contextInfo: getContextInfo(quotedUser, conText.newsletterJid, conText.botName),
        },
        { quoted: mek }
      );
      await react("✅");
    }
  } catch (error) {
    console.error("Error processing profile picture:", error);
    await reply(`❌ An error occurred while fetching the profile picture.`);
    await react("❌");
  }
});


gmd({
  pattern: "getgcpp",
  aliases: ['stealgcpp', 'snatchgcpp'],
  react: "👀",
  category: "group",
  description: "Download group profile picture",
}, async (from, Prince, conText) => {
  const { mek, reply, react, isGroup, newsletterJid, botName, botFooter } = conText;
  
  if (!isGroup) {
    await react("❌");
    return reply("❌ This command only works in groups!");
  }

  try {
    let profilePictureUrl;
    try {
      profilePictureUrl = await Prince.profilePictureUrl(from, "image");
    } catch (error) {
      await react("❌");
      return reply("❌ This group has no profile picture set!");
    }

    await Prince.sendMessage(
      from,
      {
        image: { url: profilePictureUrl },
        caption: `🖼️ *Group Profile Picture*\n\n${botFooter ? `_${botFooter}_` : ''}`,
        contextInfo: getContextInfo(null, conText.newsletterJid, conText.botName),
      },
      { quoted: mek }
    );
    
    await react("✅");

  } catch (error) {
    console.error("getgcpp error:", error);
    await react("❌");
    await reply(`❌ Failed to get group picture: ${error.message}`);
  }
});


gmd({ 
  pattern: "vv2", 
  aliases: ['‎2', 'reveal2', 'wow2', 'lol2'],
  react: "🙄",
  category: "owner",
  description: "Reveal View Once Media"
}, async (from, Prince, conText) => {
    const { mek, reply, quoted, react, botName, isSuperUser } = conText;

    if (!quoted) return reply(`Please reply to/quote a ViewOnce message`);
    if (!isSuperUser) return reply(`Owner Only Command!`);
    
    let viewOnceContent, mediaType;
    
    if (quoted.imageMessage?.viewOnce || quoted.videoMessage?.viewOnce || quoted.audioMessage?.viewOnce) {
        mediaType = Object.keys(quoted).find(key => 
            key.endsWith('Message') && 
            ['image', 'video', 'audio'].some(t => key.includes(t))
        );
        viewOnceContent = { [mediaType]: quoted[mediaType] };
    } 
    else if (quoted.viewOnceMessage) {
        viewOnceContent = quoted.viewOnceMessage.message;
        mediaType = Object.keys(viewOnceContent).find(key => 
            key.endsWith('Message') && 
            ['image', 'video', 'audio'].some(t => key.includes(t))
        );
    } else {
        return reply('Please reply to a view once media message.');
    }

    if (!mediaType) return reply('Unsupported ViewOnce message type.');

    let msg;
    let tempFilePath = null;

    try {
        const mediaMessage = {
            ...viewOnceContent[mediaType],
            viewOnce: false
        };

        tempFilePath = await Prince.downloadAndSaveMediaMessage(mediaMessage, 'temp_media');
        
        const caption = `${mediaMessage.caption}\n\n> *REVEALED BY ${botName}*`;
        const mime = mediaMessage.mimetype || '';

        if (mediaType.includes('image')) {
            msg = { 
                image: { url: tempFilePath }, 
                caption,
                mimetype: mime
            };
        } 
        else if (mediaType.includes('video')) {
            msg = { 
                video: { url: tempFilePath }, 
                caption,
                mimetype: mime
            };
        } 
        else if (mediaType.includes('audio')) {
            msg = { 
                audio: { url: tempFilePath }, 
                ptt: true, 
                mimetype: mime || 'audio/mp4' 
            };
        }

        if (Prince.user?.id) await Prince.sendMessage(Prince.user.id, msg);
      await react("✅");
    } catch (e) {
        console.error("Error in vv command:", e);
        reply(`Error: ${e.message}`);
    } finally {
        if (tempFilePath) {
            try {
                await fs.unlink(tempFilePath);
            } catch (cleanupError) {
                console.error("Failed to clean up temp file:", cleanupError);
            }
        }
    }
});

gmd({ 
  pattern: "vv", 
  aliases: ['‎', 'reveal', 'wow', 'lol'],
  react: "🙄",
  category: "owner",
  description: "Reveal View Once Media"
}, async (from, Prince, conText) => {
    const { mek, reply, quoted, react, botName, isSuperUser } = conText;

    if (!quoted) return reply(`Please reply to/quote a ViewOnce message`);
    if (!isSuperUser) return reply(`Owner Only Command!`);

    let viewOnceContent, mediaType;
  
    if (quoted.imageMessage?.viewOnce || quoted.videoMessage?.viewOnce || quoted.audioMessage?.viewOnce) {
        mediaType = Object.keys(quoted).find(key => 
            key.endsWith('Message') && 
            ['image', 'video', 'audio'].some(t => key.includes(t))
        );
        viewOnceContent = { [mediaType]: quoted[mediaType] };
    } 
    else if (quoted.viewOnceMessage) {
        viewOnceContent = quoted.viewOnceMessage.message;
        mediaType = Object.keys(viewOnceContent).find(key => 
            key.endsWith('Message') && 
            ['image', 'video', 'audio'].some(t => key.includes(t))
        );
    } else {
        return reply('Please reply to a view once media message.');
    }

    if (!mediaType) return reply('Unsupported ViewOnce message type.');

    let msg;
    let tempFilePath = null;

    try {
        const mediaMessage = {
            ...viewOnceContent[mediaType],
            viewOnce: false
        };

        tempFilePath = await Prince.downloadAndSaveMediaMessage(mediaMessage, 'temp_media');
        
        const caption = `${mediaMessage.caption}\n\n> *REVEALED BY ${botName}*`;
        const mime = mediaMessage.mimetype || '';

        if (mediaType.includes('image')) {
            msg = { 
                image: { url: tempFilePath }, 
                caption,
                mimetype: mime
            };
        } 
        else if (mediaType.includes('video')) {
            msg = { 
                video: { url: tempFilePath }, 
                caption,
                mimetype: mime
            };
        } 
        else if (mediaType.includes('audio')) {
            msg = { 
                audio: { url: tempFilePath }, 
                ptt: true, 
                mimetype: mime || 'audio/mp4' 
            };
        }

        await Prince.sendMessage(from, msg);
        if (Prince.user?.id && Prince.user.id !== from) {
            await Prince.sendMessage(Prince.user.id, msg);
        }
      await react("✅");
    } catch (e) {
        console.error("Error in vv command:", e);
        reply(`Error: ${e.message}`);
    } finally {
        if (tempFilePath) {
            try {
                await fs.unlink(tempFilePath);
            } catch (cleanupError) {
                console.error("Failed to clean up temp file:", cleanupError);
            }
        }
    }
});

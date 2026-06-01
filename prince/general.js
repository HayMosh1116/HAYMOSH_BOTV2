 
const { gmd, commands, monospace, formatBytes, getContextInfo } = require("../mayel"),
      fs = require('fs'), 
      axios = require('axios'),
      BOT_START_TIME = Date.now(),
      { totalmem: totalMemoryBytes, freemem: freeMemoryBytes } = require('os'),
      moment = require('moment-timezone'), 
      more = String.fromCharCode(8206), 
      readmore = more.repeat(4001),
      ram = `${formatBytes(freeMemoryBytes)}/${formatBytes(totalMemoryBytes)}`;


// 🔠 Small caps formatter (like Gifted)
function smallCaps(text) {
  const smallCapsMap = {
    a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ғ',
    g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ',
    m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
    s: 's', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x',
    y: 'ʏ', z: 'ᴢ'
  };
  return text.toLowerCase().split('').map(c => smallCapsMap[c] || c).join('');
}


gmd({ 
  pattern: "menu", 
  aliases: ['help', 'allmenu', 'mainmenu'],
  react: "🪀",
  category: "general",
  description: "Fetch bot main menu",
}, async (from, Prince, conText) => {
      const { mek, sender, react, pushName, botPic, botMode, botVersion, botName, botFooter, timeZone, botPrefix, newsletterJid } = conText;

      function formatUptime(seconds) {
          const days = Math.floor(seconds / (24 * 60 * 60));
          seconds %= 24 * 60 * 60;
          const hours = Math.floor(seconds / (60 * 60));
          seconds %= 60 * 60;
          const minutes = Math.floor(seconds / 60);
          seconds = Math.floor(seconds % 60);
          return `${days}d ${hours}h ${minutes}m ${seconds}s`;
      }

      const now = new Date();
      const date = new Intl.DateTimeFormat('en-GB', {
          timeZone: timeZone,
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
      }).format(now);

      const time = new Intl.DateTimeFormat('en-GB', {
          timeZone: timeZone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
      }).format(now);

      const uptime = formatUptime(process.uptime());
      const totalCommands = commands.filter((command) => command.pattern).length;

      const categorized = commands.reduce((menu, gmd) => {
          if (gmd.pattern && !gmd.dontAddCommandList) {
              if (!menu[gmd.category]) menu[gmd.category] = [];
              menu[gmd.category].push(gmd.pattern);
          }
          return menu;
      }, {});

      // 🔥 Gifted-style header
      let header = `
╭━━〔 *${monospace(botName)}* 〕━━╮
│ ✦ *Mᴏᴅᴇ* : ${monospace(botMode)}
│ ✦ *Pʀᴇғɪx* : [ ${monospace(botPrefix)} ]
│ ✦ *Usᴇʀ* : ${monospace(pushName)}
│ ✦ *Pʟᴜɢɪɴs* : ${monospace(totalCommands.toString())}
│ ✦ *Vᴇʀsɪᴏɴ* : ${monospace(botVersion)}
│ ✦ *Uᴘᴛɪᴍᴇ* : ${monospace(uptime)}
│ ✦ *Tɪᴍᴇ Nᴏᴡ* : ${monospace(time)}
│ ✦ *Dᴀᴛᴇ Tᴏᴅᴀʏ* : ${monospace(date)}
│ ✦ *Tɪᴍᴇ Zᴏɴᴇ* : ${monospace(timeZone)}
│ ✦ *Sᴇʀᴠᴇʀ Rᴀᴍ* : ${monospace(ram)}
╰──────────────╯\n
*Deploy here 👇👇*
host.princetechn.com 
${readmore}\n`;

      // 🔥 Gifted-style category formatter
      const formatCategory = (category, gmds) => {
          const title = `╭━━━✦❮ *${monospace(category.toUpperCase())}* ❯✦━⊷ \n`;
          const body = gmds.map(gmd => `┃✪  ${smallCaps(gmd)}`).join('\n');
          const footer = `╰━━━━━━━━━━━━━━━━━⊷\n`;
          return `${title}${body}\n${footer}`;
      };

      let menu = header;
      for (const [category, gmds] of Object.entries(categorized)) {
          menu += formatCategory(category, gmds) + '\n';
      }
        
      const princeMess = {
          image: { url: botPic },
          caption: `${menu.trim()}\n\n> *${botFooter}*`,
          contextInfo: getContextInfo(sender, newsletterJid, botName)
      };
      await Prince.sendMessage(from, princeMess, { quoted: mek });
      await react("✅");
});

gmd({
  pattern: "return",
  aliases: ['details', 'det', 'ret'],
  react: "⚡",
  category: "owner",
  description: "Displays the full raw quoted message using Baileys structure.",
}, async (from, Prince, conText) => {
  const { mek, reply, react, quotedMsg, isDevs, botName, newsletterJid } = conText;
  
  if (!isDevs) {
    return reply(`Developer Only Command!`);
  }
  
  if (!quotedMsg) {
    return reply(`Please reply to/quote a message`);
  }

  try {
    const jsonString = JSON.stringify(quotedMsg, null, 2);
    const chunks = jsonString.match(/[\s\S]{1,100000}/g) || [];

    for (const chunk of chunks) {
      const formattedMessage = `\`\`\`\n${chunk}\n\`\`\``;

      await Prince.sendMessage(
        from,
        {
          text: formattedMessage,
          contextInfo: getContextInfo(null, newsletterJid, botName),
        },
        { quoted: mek }
      );
      await react("✅");
    }
  } catch (error) {
    console.error("Error processing quoted message:", error);
    await reply(`❌ An error occurred while processing the message.`);
  }
});


gmd({ 
  pattern: "ping",
  react: "⚡",
  category: "general",
  description: "Check bot response speed",
}, async (from, Prince, conText) => {
      const { mek, react, newsletterJid, botName } = conText;
    const startTime = process.hrtime();

    await new Promise(resolve => setTimeout(resolve, Math.floor(80 + Math.random() * 420)));
    
    const elapsed = process.hrtime(startTime);
    const responseTime = Math.floor((elapsed[0] * 1000) + (elapsed[1] / 1000000));

    await Prince.sendMessage(from, {
      text: `⚡ Pong: ${responseTime}ms`,
      contextInfo: getContextInfo(null, newsletterJid, botName)
    }, { quoted: mek });
      await react("✅");
  }
);







gmd({ 
  pattern: "uptime", 
  react: "⏳",
  category: "general",
  description: "check bot uptime status.",
}, async (from, Prince, conText) => {
      const { mek, react, newsletterJid, botName } = conText;
      
    const uptimeMs = Date.now() - BOT_START_TIME;
    
    const seconds = Math.floor((uptimeMs / 1000) % 60);
    const minutes = Math.floor((uptimeMs / (1000 * 60)) % 60);
    const hours = Math.floor((uptimeMs / (1000 * 60 * 60)) % 24);
    const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));

    await Prince.sendMessage(from, {
      text: `⏱️ Uptime: ${days}d ${hours}h ${minutes}m ${seconds}s`,
      contextInfo: getContextInfo(null, newsletterJid, botName)
    }, { quoted: mek });
      await react("✅");
  }
);

gmd({ 
  pattern: "repo", 
  aliases: ['sc', 'script'],
  react: "💜",
  category: "general",
  description: "Fetch bot script.",
}, async (from, Prince, conText) => {
      const { mek, sender, react, pushName, botPic, botName, ownerName, newsletterJid, princeRepo } = conText;

    const response = await axios.get(`https://api.github.com/repos/${princeRepo}`);
    const repoData = response.data;
    const { full_name, name, forks_count, stargazers_count, created_at, updated_at, owner } = repoData;
    const messageText = `Hello *_${pushName}_,*\nThis is *${botName},* A Whatsapp Bot Built by *${ownerName},* Enhanced with Amazing Features to Make Your Whatsapp Communication and Interaction Experience Amazing\n\n*ʀᴇᴘᴏ ʟɪɴᴋ:* https://github.com/${princeRepo}\n\n*❲❒❳ ɴᴀᴍᴇ:* ${name}\n*❲❒❳ sᴛᴀʀs:* ${stargazers_count}\n*❲❒❳ ғᴏʀᴋs:* ${forks_count}\n*❲❒❳ ᴄʀᴇᴀᴛᴇᴅ ᴏɴ:* ${new Date(created_at).toLocaleDateString()}\n*❲❒❳ ʟᴀsᴛ ᴜᴘᴅᴀᴛᴇᴅ:* ${new Date(updated_at).toLocaleDateString()}`;

    const princeMess = {
        image: { url: botPic },
        caption: messageText,
        contextInfo: getContextInfo(sender, newsletterJid, botName)
      };
      await Prince.sendMessage(from, princeMess, { quoted: mek });
      await react("✅");
  }
);


gmd({
  pattern: "save",
  aliases: ['sv', 's', 'sav', '.'],
  react: "⚡",
  category: "tools",
  description: "Save messages (supports images, videos, audio, stickers, and text).",
}, async (from, Prince, conText) => {
  const { mek, reply, react, sender, isSuperUser, getMediaBuffer } = conText;
  
  if (!isSuperUser) {
    return reply(`❌ Owner Only Command!`);
  }

  const quotedMsg = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  
  if (!quotedMsg) {
    return reply(`⚠️ Please reply to/quote a message.`);
  }

  try {
    let mediaData;
    
    if (quotedMsg.imageMessage) {
      const buffer = await getMediaBuffer(quotedMsg.imageMessage, "image");
      mediaData = {
        image: buffer,
        caption: quotedMsg.imageMessage.caption || ""
      };
    } 
    else if (quotedMsg.videoMessage) {
      const buffer = await getMediaBuffer(quotedMsg.videoMessage, "video");
      mediaData = {
        video: buffer,
        caption: quotedMsg.videoMessage.caption || ""
      };
    } 
    else if (quotedMsg.audioMessage) {
      const buffer = await getMediaBuffer(quotedMsg.audioMessage, "audio");
      mediaData = {
        audio: buffer,
        mimetype: "audio/mp4"
      };
    } 
    else if (quotedMsg.stickerMessage) {
      const buffer = await getMediaBuffer(quotedMsg.stickerMessage, "sticker");
      mediaData = {
        sticker: buffer
      };
    } 
    else if (quotedMsg.conversation || quotedMsg.extendedTextMessage?.text) {
      const text = quotedMsg.conversation || quotedMsg.extendedTextMessage.text;
      mediaData = {
        text: text
      };
    } 
    else {
      return reply(`❌ Unsupported message type.`);
    }

    await Prince.sendMessage(sender, mediaData, { quoted: mek });
    // await reply(`✅ Saved Successfully!`);
    await react("✅");

  } catch (error) {
    console.error("Save Error:", error);
    await reply(`❌ Failed to save the message. Error: ${error.message}`);
  }
});



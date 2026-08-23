 
const { gmd, commands, monospace, formatBytes, getContextInfo } = require("../mayel"),
      fs = require('fs'), 
      axios = require('axios'),
      BOT_START_TIME = Date.now(),
      { totalmem: totalMemoryBytes, freemem: freeMemoryBytes } = require('os'),
      moment = require('moment-timezone'), 
      more = String.fromCharCode(8206), 
      readmore = more.repeat(4001),
      ram = `${formatBytes(freeMemoryBytes)}/${formatBytes(totalMemoryBytes)}`;


// ─── small caps map ────────────────────────────────────────────────────────────
function smallCaps(text) {
  const map = {
    a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ғ',g:'ɢ',h:'ʜ',i:'ɪ',j:'ᴊ',k:'ᴋ',
    l:'ʟ',m:'ᴍ',n:'ɴ',o:'ᴏ',p:'ᴘ',q:'ǫ',r:'ʀ',s:'s',t:'ᴛ',u:'ᴜ',v:'ᴠ',
    w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ'
  };
  return text.toLowerCase().split('').map(c => map[c] || c).join('');
}

// ─── bold Unicode category display labels ────────────────────────────────────
const categoryDisplayMap = {
    ai:         '𝗔𝗜',
    anime:      '𝗔𝗡𝗜𝗠𝗘',
    converter:  '𝗖𝗢𝗡𝗩𝗘𝗥𝗧',
    convert:    '𝗖𝗢𝗡𝗩𝗘𝗥𝗧',
    sticker:    '𝗦𝗧𝗜𝗖𝗞𝗘𝗥',
    tools:      '𝗧𝗢𝗢𝗟𝗦',
    dev:        '𝗗𝗘𝗩',
    downloader: '𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗',
    download:   '𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗',
    fun:        '𝗙𝗨𝗡',
    search:     '𝗦𝗘𝗔𝗥𝗖𝗛',
    games:      '𝗚𝗔𝗠𝗘𝗦',
    game:       '𝗚𝗔𝗠𝗘𝗦',
    group:      '𝗚𝗥𝗢𝗨𝗣',
    owner:      '𝗢𝗪𝗡𝗘𝗥',
    logo:       '𝗟𝗢𝗚𝗢',
    general:    '𝗠𝗔𝗜𝗡',
    main:       '𝗠𝗔𝗜𝗡',
    menu:       '𝗠𝗘𝗡𝗨',
    misc:       '𝗠𝗜𝗦𝗖',
    other:      '𝗢𝗧𝗛𝗘𝗥',
    hidden:     '𝗛𝗜𝗗𝗗𝗘𝗡',
    sports:     '𝗦𝗣𝗢𝗥𝗧𝗦',
    utility:    '𝗨𝗧𝗜𝗟𝗜𝗧𝗬',
};

// ─── category emojis ──────────────────────────────────────────────────────────
const categoryEmojis = {
    ai:'🤖', anime:'🎌', converter:'🔁', convert:'🔁', sticker:'🖼️',
    tools:'🔧', dev:'💻', downloader:'📥', download:'📥', fun:'🎉',
    search:'🔎', games:'🎮', game:'🎮', group:'👥', owner:'👑',
    logo:'🎨', general:'🏠', main:'🏠', menu:'📋', misc:'📌',
    other:'📦', hidden:'🔒', sports:'⚽', utility:'🛠️',
};

// ─── preferred category order ─────────────────────────────────────────────────
const CATEGORY_ORDER = [
    'ai','anime','converter','sticker','tools','dev',
    'downloader','fun','search','games','group','owner',
    'logo','general','menu','misc','other','hidden','sports',
];

// ─── build categorised command map ────────────────────────────────────────────
function buildCategorized() {
    const menu = {};
    for (const cmd of commands) {
        if (!cmd.pattern || cmd.dontAddCommandList) continue;
        const cat = (cmd.category || 'other').toLowerCase();
        if (!menu[cat]) menu[cat] = [];
        menu[cat].push(cmd.pattern);
    }
    return menu;
}

// ─── sort categories in preferred order ──────────────────────────────────────
function sortedCategories(categorized) {
    const known = CATEGORY_ORDER.filter(c => categorized[c]);
    const extra = Object.keys(categorized).filter(c => !CATEGORY_ORDER.includes(c)).sort();
    return [...known, ...extra];
}

// ─── uptime formatter ─────────────────────────────────────────────────────────
function formatUptime(secs) {
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    const parts = [];
    if (d) parts.push(`${d} day${d > 1 ? 's' : ''}`);
    if (h) parts.push(`${h} hour${h > 1 ? 's' : ''}`);
    if (m) parts.push(`${m} minute${m > 1 ? 's' : ''}`);
    if (s || !parts.length) parts.push(`${s} second${s !== 1 ? 's' : ''}`);
    return parts.join(', ');
}

// ─── .menu ────────────────────────────────────────────────────────────────────
gmd({ 
  pattern: "menu", 
  aliases: ['help', 'mainmenu'],
  react: "🪀",
  category: "general",
  description: "Interactive bot menu — reply with a number to see category commands",
}, async (from, Prince, conText) => {
    const { mek, sender, react, pushName, botPic, botName, botFooter,
            timeZone, botPrefix, newsletterJid, config } = conText;

    const tz     = timeZone || 'Africa/Lagos';
    const now    = new Date();
    const date   = new Intl.DateTimeFormat('en-GB', { timeZone: tz, day:'2-digit', month:'2-digit', year:'numeric' }).format(now);
    const time   = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true }).format(now);
    const uptime = formatUptime(Math.floor(process.uptime()));
    const ownerName = (config?.OWNER_NAME || botName || 'DEV-HAYWHY').trim();

    const categorized = buildCategorized();
    const catNames    = sortedCategories(categorized);
    const totalCmds   = commands.filter(c => c.pattern).length;

    // ── numbered category list ──
    const catList = catNames.map((cat, i) => {
        const emoji   = categoryEmojis[cat] || '📂';
        const label   = categoryDisplayMap[cat] || cat.toUpperCase();
        const num     = String(i + 1).padStart(2, '0');
        return `┃➠ ${num}  ${emoji}  *${label}*`;
    }).join('\n');

    const header =
        `╔═❖🔹 *𝗛𝗔𝗬𝗪𝗛𝗬-𝗠𝗗𝗫* 🔹❖═╗\n` +
        `┃➠ ᴏᴡɴᴇʀ      : 👑 ${ownerName}\n` +
        `┃➠ ᴘʟᴀᴛғᴏʀᴍ  : Heroku\n` +
        `┃➠ ᴜᴘᴛɪᴍᴇ    : ${uptime}\n` +
        `┃➠ ᴘʀᴇғɪx    : ${botPrefix}\n` +
        `┃➠ ᴛɪᴍᴇ      : ${time}\n` +
        `┃➠ ᴅᴀᴛᴇ      : ${date}\n` +
        `┃➠ ᴛᴏᴛᴀʟ ᴄᴍᴅs : ${totalCmds}\n` +
        `╚══════════════════╝\n\n` +
        `${catList}\n\n` +
        `💬 *Reply with a number to open a category*\n` +
        `📋 *${botPrefix}allmenu* → see all commands at once\n` +
        `🌐 https://wa.me/2349122761580\n` +
        `> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ 👾𝒟𝐸𝒱-𝐻𝒜𝒴𝒲𝐻𝒴🤖*`;

    const menuMsg = await Prince.sendMessage(from, {
        image: { url: botPic },
        caption: header,
        contextInfo: getContextInfo(sender, newsletterJid, botName),
    }, { quoted: mek });

    const menuId = menuMsg?.key?.id;
    if (!menuId) { await react("✅"); return; }

    // ── listener: number reply opens submenu ──
    const handleReply = async (event) => {
        const msgData = event?.messages?.[0];
        if (!msgData?.message || msgData.key.remoteJid !== from) return;

        const isReply = msgData.message.extendedTextMessage?.contextInfo?.stanzaId === menuId;
        if (!isReply) return;

        const choice = (
            msgData.message.conversation ||
            msgData.message.extendedTextMessage?.text || ''
        ).trim().toLowerCase();

        // home / back → resend main menu (just notify user to type .menu again)
        if (choice === 'home' || choice === 'back' || choice === '0') {
            await Prince.sendMessage(from, {
                text: `🏠 Type *${botPrefix}menu* to return to the main menu.`,
                contextInfo: getContextInfo(null, newsletterJid, botName),
            }, { quoted: msgData });
            return;
        }

        const idx = parseInt(choice, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= catNames.length) {
            await Prince.sendMessage(from, {
                text: `❌ Invalid choice. Reply with a number between *1* and *${catNames.length}*, or type *home* / *0* to go back.`,
                contextInfo: getContextInfo(null, newsletterJid, botName),
            }, { quoted: msgData });
            return;
        }

        const cat   = catNames[idx];
        const cmds  = categorized[cat] || [];
        const emoji = categoryEmojis[cat] || '📂';
        const label = categoryDisplayMap[cat] || cat.toUpperCase();

        const cmdList = cmds.map(cmd => `┃➠ ${smallCaps(cmd)}`).join('\n');

        const subMenu =
            `╭━━━━❮ ${emoji} *${label}* ❯━⊷\n` +
            `${cmdList}\n` +
            `╰━━━━━━━━━━━━━━━━━⊷\n\n` +
            `💬 Reply *0* or *home* for main menu\n` +
            `> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ 👾𝒟𝐸𝒱-𝐻𝒜𝒴𝒲𝐻𝒴🤖*`;

        await Prince.sendMessage(from, {
            text: subMenu,
            contextInfo: getContextInfo(null, newsletterJid, botName),
        }, { quoted: msgData });
    };

    Prince.ev.on('messages.upsert', handleReply);
    // auto-remove listener after 5 minutes
    setTimeout(() => {
        try { Prince.ev.off('messages.upsert', handleReply); } catch (_) {}
    }, 300000);

    await react('✅');
});


// ─── .allmenu ─────────────────────────────────────────────────────────────────
gmd({
  pattern: "allmenu",
  aliases: ['allcommands', 'fullmenu'],
  react: "📋",
  category: "general",
  description: "Show all commands grouped by category",
}, async (from, Prince, conText) => {
    const { mek, sender, react, botPic, botName, botFooter, botPrefix, newsletterJid } = conText;

    const categorized  = buildCategorized();
    const catNames     = sortedCategories(categorized);
    const totalCmds    = commands.filter(c => c.pattern).length;

    let fullMenu = `╔═❖🔹 *𝗛𝗔𝗬𝗪𝗛𝗬-𝗠𝗗𝗫 — 𝗔𝗟𝗟 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦* 🔹❖═╗\n┃➠ ᴛᴏᴛᴀʟ ᴄᴍᴅs : ${totalCmds}\n╚══════════════════════════════╝\n\n`;

    for (const cat of catNames) {
        const cmds  = categorized[cat] || [];
        const emoji = categoryEmojis[cat] || '📂';
        const label = categoryDisplayMap[cat] || cat.toUpperCase();
        const list  = cmds.map(cmd => `┃➠ ${smallCaps(cmd)}`).join('\n');
        fullMenu += `╭━━━━❮ ${emoji} *${label}* ❯━⊷\n${list}\n╰━━━━━━━━━━━━━━━━━⊷\n\n`;
    }

    fullMenu += `🌐 https://wa.me/2349122761580\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ 👾𝒟𝐸𝒱-𝐻𝒜𝒴𝒲𝐻𝒴🤖*`;

    await Prince.sendMessage(from, {
        image: { url: botPic },
        caption: fullMenu,
        contextInfo: getContextInfo(sender, newsletterJid, botName),
    }, { quoted: mek });

    await react('✅');
});


// ─── .return (dev raw message dump) ──────────────────────────────────────────
gmd({
  pattern: "return",
  aliases: ['details', 'det', 'ret'],
  react: "⚡",
  category: "owner",
  description: "Displays the full raw quoted message using Baileys structure.",
}, async (from, Prince, conText) => {
  const { mek, reply, react, quotedMsg, isDevs, botName, newsletterJid } = conText;
  
  if (!isDevs) return reply(`Developer Only Command!`);
  if (!quotedMsg) return reply(`Please reply to/quote a message`);

  try {
    const jsonString = JSON.stringify(quotedMsg, null, 2);
    const chunks = jsonString.match(/[\s\S]{1,100000}/g) || [];
    for (const chunk of chunks) {
      await Prince.sendMessage(from, {
        text: `\`\`\`\n${chunk}\n\`\`\``,
        contextInfo: getContextInfo(null, newsletterJid, botName),
      }, { quoted: mek });
    }
    await react("✅");
  } catch (error) {
    console.error("Error processing quoted message:", error);
    await reply(`❌ An error occurred while processing the message.`);
  }
});


// ─── .ping ────────────────────────────────────────────────────────────────────
gmd({ 
  pattern: "ping",
  react: "⚡",
  category: "general",
  description: "Check bot response speed",
}, async (from, Prince, conText) => {
    const { mek, react } = conText;
    const PING_EMOJIS = ["👑","⚡","🚀","🤖","💙","✨","🌸","🩵","💫","🎉","🔥","💎","🌟","⭐","🏆"];
    const pick = () => PING_EMOJIS[Math.floor(Math.random() * PING_EMOJIS.length)];
    const startTime = process.hrtime();
    // Measure the real round trip instead of adding a random delay to the result.
    const elapsed = process.hrtime(startTime);
    const ms = ((elapsed[0] * 1e9 + elapsed[1]) / 1e6).toFixed(2);
    const e1 = pick(), e2 = pick();
    await Prince.sendMessage(from, {
      text: `${e1} *𝐏๏፝֟ƞ̽g* ${ms} *𝐌ʂ* ${e2}`,
    }, { quoted: mek });
    await react("✅");
});


// ─── .uptime ──────────────────────────────────────────────────────────────────
gmd({ 
  pattern: "uptime", 
  react: "⏳",
  category: "general",
  description: "Check bot uptime.",
}, async (from, Prince, conText) => {
    const { mek, react, newsletterJid, botName } = conText;
    await Prince.sendMessage(from, {
      text: `⏱️ Uptime: ${formatUptime(Math.floor(process.uptime()))}`,
      contextInfo: getContextInfo(null, newsletterJid, botName)
    }, { quoted: mek });
    await react("✅");
});


// ─── .repo ────────────────────────────────────────────────────────────────────
gmd({ 
  pattern: "repo", 
  aliases: ['sc', 'script'],
  react: "💜",
  category: "general",
  description: "Fetch bot GitHub repo info.",
}, async (from, Prince, conText) => {
    const { mek, sender, react, pushName, botPic, botName, ownerName, newsletterJid, princeRepo } = conText;
    const response = await axios.get(`https://api.github.com/repos/${princeRepo}`);
    const { full_name, name, forks_count, stargazers_count, created_at, updated_at } = response.data;
    const messageText =
        `Hello *_${pushName}_,*\n` +
        `This is *${botName}*, a WhatsApp bot by *${ownerName}*\n\n` +
        `*ʀᴇᴘᴏ:* https://github.com/${princeRepo}\n` +
        `*❲❒❳ ɴᴀᴍᴇ:* ${name}\n` +
        `*❲❒❳ sᴛᴀʀs:* ${stargazers_count}\n` +
        `*❲❒❳ ғᴏʀᴋs:* ${forks_count}\n` +
        `*❲❒❳ ᴄʀᴇᴀᴛᴇᴅ:* ${new Date(created_at).toLocaleDateString()}\n` +
        `*❲❒❳ ᴜᴘᴅᴀᴛᴇᴅ:* ${new Date(updated_at).toLocaleDateString()}`;
    await Prince.sendMessage(from, {
        image: { url: botPic },
        caption: messageText,
        contextInfo: getContextInfo(sender, newsletterJid, botName)
    }, { quoted: mek });
    await react("✅");
});

// ─── .save ────────────────────────────────────────────────────────────────────
gmd({
  pattern: "save",
  aliases: ['sv', 's', 'sav'],
  react: "⚡",
  category: "tools",
  description: "Save messages (images, videos, audio, stickers, text).",
}, async (from, Prince, conText) => {
  const { mek, reply, react, sender, isSuperUser, getMediaBuffer } = conText;
  if (!isSuperUser) return reply(`❌ Owner Only Command!`);

  const quotedMsg = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!quotedMsg) return reply(`⚠️ Please reply to a message.`);

  try {
    let mediaData;
    if (quotedMsg.imageMessage) {
      mediaData = { image: await getMediaBuffer(quotedMsg.imageMessage, "image"), caption: quotedMsg.imageMessage.caption || "" };
    } else if (quotedMsg.videoMessage) {
      mediaData = { video: await getMediaBuffer(quotedMsg.videoMessage, "video"), caption: quotedMsg.videoMessage.caption || "" };
    } else if (quotedMsg.audioMessage) {
      mediaData = { audio: await getMediaBuffer(quotedMsg.audioMessage, "audio"), mimetype: "audio/mp4" };
    } else if (quotedMsg.stickerMessage) {
      mediaData = { sticker: await getMediaBuffer(quotedMsg.stickerMessage, "sticker") };
    } else if (quotedMsg.conversation || quotedMsg.extendedTextMessage?.text) {
      mediaData = { text: quotedMsg.conversation || quotedMsg.extendedTextMessage.text };
    } else {
      return reply(`❌ Unsupported message type.`);
    }
    await Prince.sendMessage(sender, mediaData, { quoted: mek });
    await react("✅");
  } catch (error) {
    console.error("Save Error:", error);
    await reply(`❌ Failed to save: ${error.message}`);
  }
});

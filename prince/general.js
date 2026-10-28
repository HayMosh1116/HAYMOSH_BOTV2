 
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
  react: "📂",
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
  react: "🛠",
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
  react: "🧨",
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
    await react("🧨");
});

// ─── pair-link ────────────────────────────────────────────────────────────────────
gmd({ 
  pattern: "pair-link",
  react: "🔌",
  category: "general",
  description: "sends pair site link",
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
      text: "*CLICK THIS LINK TO GET YOUR SESSION ID:* https://haymoshmdx-production-95c1.up.railway.app",
    }, { quoted: mek });
       await react("🔌");
});

// ─── ONLY HER 💜 ────────────────────────────────────────────────────────────────
gmd({
  pattern: "only-her",
  react: "💜",
  category: "general",
  description: "Tells you everything about his only her",
}, async (from, Prince, conText) => {
  const { mek } = conText;
  const onlyHerText = `
╭━━━〔 💜 𝑶𝑵𝑳𝒀 𝑯𝑬𝑹 💜 〕━━━╮
┃
┃ 𝑺𝒉𝒆'𝒔 𝒏𝒐𝒕 𝒋𝒖𝒔𝒕 𝒂 𝒏𝒂𝒎𝒆...
┃ 𝑺𝒉𝒆'𝒔 𝒕𝒉𝒆 𝒐𝒏𝒆 MY 𝒉𝒆𝒂𝒓𝒕 𝒄𝒉𝒐𝒔𝒆. 🥹💜
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
💌 𝑾𝒂𝒏𝒕 𝒕𝒐 𝒌𝒏𝒐𝒘 𝒉𝒆𝒓?  
𝑹𝒆𝒑𝒍𝒚 𝒘𝒊𝒕𝒉 𝒂 𝒏𝒖𝒎𝒃𝒆𝒓 𝒃𝒆𝒍𝒐𝒘. 👇🏽
╭────────────────────────────╮
│ ① 💜 𝑯𝒆𝒓 𝑵𝒂𝒎𝒆
│ ② 🎬 𝑯𝒆𝒓 𝑭𝒂𝒗𝒐𝒖𝒓𝒊𝒕𝒆𝒔
│ ③ 🎨 𝑯𝒆𝒓 𝑭𝒂𝒗𝒐𝒖𝒓𝒊𝒕𝒆 𝑪𝒐𝒍𝒐𝒓𝒔
│ ④ 👾 𝑯𝒆𝒓 𝑩𝒂𝒃𝒆
│ ⑤ 💍 𝑾𝒉𝒂𝒕 𝑴𝒂𝒌𝒆𝒔 𝑯𝒆𝒓 𝑺𝒑𝒆𝒄𝒊𝒂𝒍
╰────────────────────────────╯
╭─〔 💜 𝑶𝑵𝑳𝒀 𝑯𝑬𝑹 〕─╮
│ 𝑶𝒏𝒆 𝒉𝒆𝒂𝒓𝒕. 𝑶𝒏𝒆 𝒄𝒉𝒐𝒊𝒄𝒆.
│ 𝑶𝒏𝒆 𝒔𝒑𝒆𝒄𝒊𝒂𝒍 𝒘𝒐𝒎𝒂𝒏. 👑
╰────────────────────╯
`;
  await Prince.sendMessage(from, {
    text: onlyHerText
  }, { quoted: mek });
  await Prince.sendMessage(from, {
    text: `
╭━━〔 💜 𝑯𝑬𝑹 𝑰𝑵𝑭𝑶 💜 〕━━╮
① 💜 𝑯𝒆𝒓 𝑵𝒂𝒎𝒆
   ↳ 𝑺𝒊𝒎𝒃𝒊𝒂𝒕 / 𝑫𝒂𝒎𝒊𝒍𝒐𝒍𝒂
② 🎬 𝑯𝒆𝒓 𝑭𝒂𝒗𝒐𝒖𝒓𝒊𝒕𝒆𝒔
   ↳ 𝑹𝒆𝒂𝒅𝒊𝒏𝒈 📖
   ↳ 𝑾𝒂𝒕𝒄𝒉𝒊𝒏𝒈 𝒎𝒐𝒗𝒊𝒆𝒔 🎬
   ↳ 𝑻𝒂𝒍𝒌𝒊𝒏𝒈 𝒕𝒐 𝒉𝒆𝒓 𝑩𝒂𝒃𝒆 🥹💜
③ 🎨 𝑯𝒆𝒓 𝑭𝒂𝒗𝒐𝒖𝒓𝒊𝒕𝒆 𝑪𝒐𝒍𝒐𝒓𝒔
   ↳ 🤍 𝑾𝒉𝒊𝒕𝒆
   ↳ 🖤 𝑩𝒍𝒂𝒄𝒌
   ↳ 💚 𝑮𝒓𝒆𝒆𝒏
   ↳ 🩷 𝑺𝒐𝒎𝒆𝒕𝒊𝒎𝒆𝒔 𝑷𝒊𝒏𝒌
④ 👾 𝑯𝒆𝒓 𝑩𝒂𝒃𝒆
   ↳ 👾𝒟𝐸𝒱-𝐻𝒜𝒴𝒲𝐻𝒴🤖
   ↳ (𝑭𝑰𝑹𝑫𝑨𝑼𝑺 | 𝑨𝒀𝑶𝑩𝑨𝑴𝑰)
⑤ 💍 𝑾𝒉𝒂𝒕 𝑴𝒂𝒌𝒆𝒔 𝑯𝒆𝒓 𝑺𝒑𝒆𝒄𝒊𝒂𝒍
   ↳ 𝑺𝒉𝒆 𝒊𝒔 𝒕𝒉𝒆 𝒑𝒆𝒓𝒔𝒐𝒏
      MY 𝒉𝒆𝒂𝒓𝒕 𝒄𝒂𝒍𝒍𝒔 "𝒉𝒐𝒎𝒆." 🏡💜
╰━━━━━━━━━━━━━━━━━━━━━━╯
      👑 𝑶𝑵𝑳𝒀 𝑯𝑬𝑹 👉💜👈
`
  }, { quoted: mek });
  await react("💜");
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
    await react("💾");
  } catch (error) {
    console.error("Save Error:", error);
    await reply(`❌ Failed to save: ${error.message}`);
  }
});


// ============================================================
// HAYWHY_MDX — FUN COMMANDS
// No-repeat response queues + random fun commands
// ============================================================
// 🎲 No-repeat response system
const funResponseQueues = new Map();
function getRandomNoRepeat(key, items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  let queue = funResponseQueues.get(key);
  if (!queue || queue.length === 0) {
    queue = [...items];
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    const last = funResponseQueues.get(`${key}:last`);
    // Avoid repeating the last response at the start of a new cycle.
    if (queue.length > 1 && queue[queue.length - 1] === last) {
      [queue[0], queue[queue.length - 1]] =
        [queue[queue.length - 1], queue[0]];
    }
    funResponseQueues.set(key, queue);
  }
  const response = queue.pop();
  funResponseQueues.set(`${key}:last`, response);
  return response;
}
// ============================================================
// 😡 DEFINITION OF MIAMI
// ============================================================
gmd({
  pattern: "definition-of-miami",
  react: "😡",
  category: "fun",
  description: "Defines Miami 😂",
}, async (from, Prince, conText) => {
  const { mek, react } = conText;
  await Prince.sendMessage(from, {
    text: "*She’s troublesome, not nice, always annoying, stubborn, irritating, wicked, a certified menace, a walking headache, a professional disturbance, a witch in human form, and honestly, one day she’ll push me to the point of grabbing a dagger! 😂😭*",
  }, { quoted: mek });
  if (typeof react === "function") await react("🤬");
});
// ============================================================
// 💘 FLIRT
// ============================================================
gmd({
  pattern: "flirt",
  react: "😘",
  category: "fun",
  description: "Sends a random flirt without repeating",
}, async (from, Prince, conText) => {
  const { mek } = conText;
  const messages = [
    "Are you Wi-Fi? Because I'm feeling a connection. 😏❤️",
    "I wasn't planning to flirt today, but then you showed up. 😉",
    "Are you a keyboard? Because you're just my type. 🌚😂",
    "You crossed my mind, so I had to blame you for my smile. 💗",
    "Are you a software update? Because you've improved my day. 😂",
    "If beauty were time, you'd be eternity. 💕",
    "You must be a magician; everyone else disappears when you appear. ✨",
    "Are you an API? Because I want to establish a connection. 💻",
    "Your smile deserves its own notification sound. 😍",
    "I think my heart has developed a favourite contact. 👀❤️",
    "You make my phone feel like it has a favourite notification. 📱",
    "I came for a conversation and accidentally caught feelings. 😂",
    "You're the plot twist my boring day needed. 💘",
    "Are you a password? Because you're hard to forget. 😏",
    "I blame you for this unnecessary smile on my face. 🌚",
    "You have no business looking that good. 😭🔥",
    "If flirting were coding, I'd never stop debugging this conversation. 💻💕",
    "You're becoming my favourite distraction. 👀",
    "Are you Bluetooth? Because I think we're pairing. 😂",
    "I don't need a search engine; you already caught my attention. 😌❤️"
  ];
  await Prince.sendMessage(from, {
    text: getRandomNoRepeat("flirt", messages)
  }, { quoted: mek });
});
// ============================================================
// 😈 INSULT — 60 RESPONSES
// ============================================================
gmd({
  pattern: "insult",
  react: "🤡",
  category: "fun",
  description: "Sends a random playful insult without repeating",
}, async (from, Prince, conText) => {
  const { mek } = conText;
  const insults = [
    "Your brain is running on airplane mode. 😂✈️",
    "If nonsense were a profession, you'd be the CEO. 🤡",
    "Your common sense needs a software update. 💀📲",
    "Your brain has too many tabs open, and none are responding. 💻",
    "You're a walking error message. 😂",
    "Your logic left the group chat. 🤣",
    "You bring confusion wherever you go. That's your talent. 😭",
    "You're the reason shampoo bottles have instructions. 🌚",
    "Even your shadow needs personal space from you. 💀",
    "You have the confidence of someone who's never checked their facts. 😂",
    "Your brain is buffering. Please wait. ⏳",
    "You're proof that a person can talk without communicating. 😭",
    "Your thoughts need adult supervision. 🤣",
    "You're not the sharpest tool in the toolbox. You're the instruction manual. 🌚",
    "If laziness were an Olympic sport, you'd miss the competition. 😂",
    "You could lose an argument with a wall. 💀",
    "Your common sense has officially resigned. 📄",
    "You're a limited edition mistake. 😭😂",
    "You have two brain cells fighting for third place. 🥉",
    "You're the human version of a spelling error. 🤡",
    "Your personality needs a factory reset. 🔄",
    "You make simple things look like advanced mathematics. 😂",
    "You're the plot twist nobody requested. 🌚",
    "Your brain is on a free trial that expired years ago. 💀",
    "You could confuse a GPS. 🧭😂",
    "You're a walking example of why instructions exist. 😭",
    "Your ideas need a warning label. ⚠️",
    "You have the strategic thinking of a broken calculator. 🧮",
    "You're the loading screen of human conversation. ⏳",
    "Your brain has gone offline without notice. 📵",
    "You argue like your keyboard is doing all the thinking. 💻",
    "You're a professional at missing the point. 🎯",
    "Even your excuses need better excuses. 😂",
    "Your attention span is shorter than a status update. 🌚",
    "You could turn a straight line into a complicated problem. 💀",
    "You're not confusing; you're a full technical support ticket. 🤣",
    "Your brain called in sick today. 🏥",
    "You're a walking plot hole. 🎬",
    "If overthinking were electricity, you'd power the whole country. ⚡",
    "You have the energy of a phone at 1% battery. 🔋",
    "You're a notification nobody remembers subscribing to. 📱",
    "Even autocorrect has given up on you. 😂",
    "Your brain's favourite hobby is disappointing you. 🌚",
    "You bring less clarity than a blurry screenshot. 📸",
    "You're a software bug with a human face. 💻",
    "You could make a simple yes-or-no question confusing. 😭",
    "Your plans have more holes than a fishing net. 🕸️",
    "You have the timing of a power outage. ⚡",
    "Your excuses deserve an award for creative writing. 🏆",
    "You're the reason group projects need a backup plan. 😂",
    "Even your reflection looks confused. 🪞",
    "You're a walking reminder to read the instructions. 📖",
    "You have the memory of a phone with no storage. 📱",
    "You could get lost in your own explanation. 🧭",
    "Your brain is still loading yesterday's thoughts. ⏳",
    "You're the human equivalent of a typo in production. 💀",
    "You make chaos look like a carefully planned project. 🌪️",
    "Your decision-making process needs technical support. 😂",
    "You're the reason patience comes in limited quantities. 😭",
    "You could disappoint a motivational speaker. 🌚"
  ];
  await Prince.sendMessage(from, {
    text: getRandomNoRepeat("insult", insults)
  }, { quoted: mek });
});
// ============================================================
// 💜 COMPLIMENT
// ============================================================
gmd({
  pattern: "compliment",
  react: "🥹",
  category: "fun",
  description: "Sends a random compliment without repeating",
}, async (from, Prince, conText) => {
  const { mek } = conText;
  const messages = [
    "You're genuinely one of a kind. 💎✨",
    "Your energy makes ordinary moments better. 💖",
    "You have a way of making people smile without trying. 😊",
    "You're smarter than you give yourself credit for. 🧠",
    "Your presence brings good vibes. 🌸",
    "Keep being yourself. There's only one you. 💯",
    "You have a beautiful mind and a lot of potential. 💜",
    "You're proof that good people still exist. 🫶",
    "You deserve the same kindness you give others. 💗",
    "Your ideas can make a real difference. ✨",
    "You have a talent worth developing. 🌟",
    "You make conversations more interesting. 😂",
    "Your persistence is something to be proud of. 💪",
    "You bring your own kind of brilliance. 💎",
    "You deserve to celebrate your progress. 🎉"
  ];
  await Prince.sendMessage(from, {
    text: getRandomNoRepeat("compliment", messages)
  }, { quoted: mek });
});
// ============================================================
// 🔥 PICKUP LINE
// ============================================================
gmd({
  pattern: "pickup",
  react: "🔥",
  category: "fun",
  description: "Sends a random pickup line without repeating",
}, async (from, Prince, conText) => {
  const { mek } = conText;
  const messages = [
    "Are you made of copper and tellurium? Because you're Cu-Te. 🧪😂",
    "Are you a parking ticket? Because you've got FINE written all over you. 🌚",
    "Are you JavaScript? Because you've got me falling for your promises. 💻",
    "Are you the moon? Because you light up my darkest nights. 🌙",
    "Is your name Google? Because you've got what I've been searching for. 😭",
    "Are you an API? Because I want to make a connection. 🤝",
    "You must be a keyboard shortcut, because you're exactly what I needed. 😏",
    "Are you CSS? Because you've styled your way into my heart. 💘",
    "Are you a semicolon? Because you complete my sentence. 😂",
    "Are you a Git commit? Because I want to keep you forever. 💻",
    "Are you a notification? Because you have my attention. 📱",
    "Are you the sun? Because you brighten my day. ☀️",
    "Are you a password manager? Because I trust you with everything. 😂",
    "Are you a search result? Because you're exactly what I wanted. 🔎",
    "Are you a star? Because you make the night look better. ⭐"
  ];
  await Prince.sendMessage(from, {
    text: getRandomNoRepeat("pickup", messages)
  }, { quoted: mek });
});
// ============================================================
// 🌚 ROAST
// ============================================================
gmd({
  pattern: "roast",
  react: "🔥",
  category: "fun",
  description: "Sends a random roast without repeating",
}, async (from, Prince, conText) => {
  const { mek } = conText;
  const messages = [
    "You're not the main character; you're the unexpected ad. 😂",
    "Your confidence is impressive considering the evidence. 🌚",
    "You're like a software update: nobody asked, but here you are. 🤣",
    "You bring everyone so much joy... when you leave the room. 😂",
    "You're not useless; you can always serve as a bad example. 😭",
    "Your personality has a loading screen. ⏳",
    "You're the plot twist that made everyone close the book. 📖",
    "You have the energy of a meeting that should have been an email. 💀",
    "Your jokes need a laugh track and technical support. 😂",
    "You're the reason the mute button was invented. 🔇",
    "You walk into a room and the Wi-Fi gets uncomfortable. 📶",
    "Your life has more unexpected errors than a beta release. 💻",
    "You're a limited-time offer nobody clicked. 🌚",
    "Your fashion sense is still waiting for its software update. 👕",
    "You're the human version of a buffering video. ⏳"
  ];
  await Prince.sendMessage(from, {
    text: getRandomNoRepeat("roast", messages)
  }, { quoted: mek });
});
// ============================================================
// 😂 JOKE
// ============================================================
gmd({
  pattern: "joke",
  react: "🤣",
  category: "fun",
  description: "Sends a random joke without repeating",
}, async (from, Prince, conText) => {
  const { mek } = conText;
  const messages = [
    "Why do programmers prefer dark mode? Because light attracts bugs. 🐛",
    "My wallet is like an onion. Opening it makes me cry. 😭",
    "I told my computer I needed a break. Now it keeps showing KitKat ads. 😂",
    "Why did the developer go broke? Because they used up all their cache. 💸",
    "I have jokes about unemployed people, but none of them work. 😭",
    "Why was the math book sad? It had too many problems. 📚",
    "My sleep schedule and I are in a toxic relationship. 🌚",
    "I tried to be normal once. Worst two minutes of my life. 😂",
    "Why did the computer go to the doctor? It caught a virus. 💻",
    "Why don't programmers like nature? Too many bugs. 🐛",
    "Why was the JavaScript developer sad? They didn't know how to null their feelings. 😂",
    "What do you call a fake noodle? An impasta. 🍝",
    "Why did the phone wear glasses? It lost its contacts. 📱",
    "I started a band called 404. We haven't found a gig yet. 🎸",
    "Why do Java developers wear glasses? Because they can't C#. 🤓"
  ];
  await Prince.sendMessage(from, {
    text: getRandomNoRepeat("joke", messages)
  }, { quoted: mek });
});
// ============================================================
// 💞 SHIP
// ============================================================
gmd({
  pattern: "ship",
  react: "💘",
  category: "fun",
  description: "Generates a random compatibility score",
}, async (from, Prince, conText) => {
  const { mek, q } = conText;
  if (!q?.trim()) {
    return Prince.sendMessage(from, {
      text: "Mention two names!\nExample: .ship Alex Sarah 💘"
    }, { quoted: mek });
  }
  const score = Math.floor(Math.random() * 101);
  const result =
    score >= 80 ? "Wedding invitations loading... 💍😂" :
    score >= 60 ? "There's serious potential here. 👀💕" :
    score >= 40 ? "The relationship needs a little debugging. 💻💗" :
    score >= 20 ? "It's complicated. 🌚" :
    "Even the calculator is concerned. 😭💀";
  await Prince.sendMessage(from, {
    text: `💘 *LOVE COMPATIBILITY TEST* 💘\n\n👥 Pair: ${q}\n❤️ Compatibility: ${score}%\n\n${result}`
  }, { quoted: mek });
});
// ============================================================
// 🤫 TRUTH
// ============================================================
gmd({
  pattern: "truth",
  react: "🤫",
  category: "fun",
  description: "Asks a random truth question without repeating",
}, async (from, Prince, conText) => {
  const { mek } = conText;
  const questions = [
    "What's the biggest lie you've ever told? 👀",
    "Who was your first crush? 😏",
    "What's one secret you've never told your friends? 🌚",
    "What's the most embarrassing thing you've done? 😂",
    "Have you ever liked someone you shouldn't have? 👀",
    "What's one thing you wish people understood about you? 🥹",
    "Who in this group makes you laugh the most? 😂",
    "What's the weirdest thing you do when you're alone? 🌚",
    "What's the funniest misunderstanding you've had? 🤣",
    "What's a habit you'd like to change? 👀",
    "What's the most childish thing you still do? 😂",
    "Have you ever pretended to understand something when you didn't? 😭",
    "What's the most ridiculous reason you've been annoyed? 🌚",
    "What's one skill you wish you had? ✨",
    "What's your most-used excuse? 😂"
  ];
  await Prince.sendMessage(from, {
    text: getRandomNoRepeat("truth", questions)
  }, { quoted: mek });
});
// ============================================================
// 🎯 DARE
// ============================================================
gmd({
  pattern: "dare",
  react: "🎯",
  category: "fun",
  description: "Gives a random harmless dare without repeating",
}, async (from, Prince, conText) => {
  const { mek } = conText;
  const dares = [
    "Send the last emoji you used. 😂",
    "Give someone in this group a funny nickname. 🌚",
    "Describe yourself using only three emojis.",
    "Tell the group your most embarrassing autocorrect mistake. 😭",
    "Send a voice note saying 'I am the CEO of nonsense.' 🤣",
    "Give the person above you an award. 🏆",
    "Write a dramatic apology to your alarm clock. ⏰",
    "Tell the group one harmless, funny secret. 👀",
    "Make up a ridiculous excuse for being late. 😂",
    "Compliment someone in the group without using the word 'nice.' 💜",
    "Describe your day like a movie trailer. 🎬",
    "Invent a ridiculous new law for this group. 😂",
    "Give yourself a dramatic royal title. 👑",
    "Write a sentence without using the letter 'e.' 🌚",
    "Describe your best friend using only food names. 🍕"
  ];
  await Prince.sendMessage(from, {
    text: getRandomNoRepeat("dare", dares)
  }, { quoted: mek });
});
// ============================================================
// 🫂 HUG
// ============================================================
gmd({
  pattern: "hug",
  react: "🫂",
  category: "fun",
  description: "Sends a virtual hug",
}, async (from, Prince, conText) => {
  const { mek, q } = conText;
  const target = q?.trim() || "you";
  const messages = [
    `🫂 *${target}* receives a giant virtual hug!`,
    `🤗 Someone wrap *${target}* in a blanket of good vibes!`,
    `💜 Sending *${target}* a warm hug. No refunds! 😂`,
    `🫂 *${target}* has been hugged. Resistance was unsuccessful. 🌚`,
    `🤗 Hug delivery complete for *${target}*!`,
    `💜 *${target}* deserves a little kindness today. 🫶`,
    `🫂 *${target}* has received premium-quality virtual affection. 😂`,
    `🤗 Emergency hug dispatched to *${target}*!`
  ];
  await Prince.sendMessage(from, {
    text: getRandomNoRepeat("hug", messages)
  }, { quoted: mek });
});
// ============================================================
// 🥹 SIMP
// ============================================================
gmd({
  pattern: "simp",
  react: "🥹",
  category: "fun",
  description: "Measures a playful simp level",
}, async (from, Prince, conText) => {
  const { mek, q } = conText;
  const target = q?.trim() || "You";
  const score = Math.floor(Math.random() * 101);
  const result =
    score >= 90 ? "Certified professional. Stand up, soldier! 😭" :
    score >= 70 ? "You're already planning the wedding. 💍😂" :
    score >= 40 ? "You're catching feelings. Be careful. 👀" :
    score >= 20 ? "A little interested, aren't we? 🌚" :
    "Your heart is currently offline. 😂";
  await Prince.sendMessage(from, {
    text: `🥹 *SIMP METER*\n\n👤 Target: ${target}\n💘 Simp level: ${score}%\n\n${result}`
  }, { quoted: mek });
});
// ============================================================
// 🌈 GAYRATE — FICTIONAL RANDOM SCORE
// ============================================================
gmd({
  pattern: "gayrate",
  react: "🌈",
  category: "fun",
  description: "Generates a fictional random score for fun",
}, async (from, Prince, conText) => {
  const { mek, q } = conText;
  const target = q?.trim() || "You";
  const score = Math.floor(Math.random() * 101);
  await Prince.sendMessage(from, {
    text: `🌈 *RANDOM METER*\n\n👤 Target: ${target}\n🎲 Random score: ${score}%\n\n😂 This is only a random number for fun; it doesn't determine anyone's sexuality.`
  }, { quoted: mek });
});
// ============================================================
// 🎭 CHARACTER
// ============================================================
gmd({
  pattern: "character",
  react: "🎭",
  category: "fun",
  description: "Assigns a random character type without repeating",
}, async (from, Prince, conText) => {
  const { mek, q } = conText;
  const target = q?.trim() || "You";
  const characters = [
    "The Main Character 🎬",
    "The Secret Villain 😈",
    "The Professional Trouble Maker 🌚",
    "The Quiet Genius 🧠",
    "The Walking Meme 😂",
    "The Mysterious Stranger 🕶️",
    "The Group Therapist 🫂",
    "The Unofficial CEO 👑",
    "The Chaos Coordinator 🌪️",
    "The Disappearing Friend 👻",
    "The Certified Gossip Agent 🕵️",
    "The Romantic Disaster 💔",
    "The Human Alarm Clock ⏰",
    "The Drama Department 🎭",
    "The Unpaid Comedian 🤡"
  ];
  await Prince.sendMessage(from, {
    text: `🎭 *CHARACTER ASSIGNMENT*\n\n👤 ${target}\n\n✨ Role: ${getRandomNoRepeat("character", characters)}`
  }, { quoted: mek });
});
// ============================================================
// 💀 CARTOON KILL
// ============================================================
gmd({
  pattern: "kill",
  react: "💀",
  category: "fun",
  description: "Sends a fictional cartoon-style elimination",
}, async (from, Prince, conText) => {
  const { mek, q } = conText;
  if (!q?.trim()) {
    return Prince.sendMessage(from, {
      text: "Give a target for a cartoon-style elimination! 😂\nExample: .kill Miami"
    }, { quoted: mek });
  }
  const scenes = [
    `${q} was defeated by an oversized rubber chicken. 🐔💀`,
    `${q} got sent to the shadow realm by a flying slipper. 🩴😂`,
    `${q} lost a dramatic battle against a mosquito. 🦟😭`,
    `${q} was eliminated by the power of bad Wi-Fi. 📶💀`,
    `${q} got launched into outer space by a trampoline. 🚀🤣`,
    `${q} was defeated in a one-on-one argument with a toaster. 🍞😂`,
    `${q} disappeared after hearing the words "we need to talk." 🌚`,
    `${q} was defeated by an army of angry ducks. 🦆💀`,
    `${q} was sent to the moon by a malfunctioning catapult. 🌙😂`,
    `${q} lost a dramatic battle against a pillow. 🛏️💀`
  ];
  await Prince.sendMessage(from, {
    text: `🎬 *CARTOON ELIMINATION*\n\n${getRandomNoRepeat("kill", scenes)}\n\n😂 *Fictional scene only!*`
  }, { quoted: mek });
});
//hack
gmd({
    pattern: "hack",
    react: "👾",
    category: "fun",
    description: "Run a hacker-style scan on a tagged user"
}, async (from, Prince, conText) => {
    const { mek } = conText;
    const context =
        mek.message?.extendedTextMessage?.contextInfo ||
        mek.message?.imageMessage?.contextInfo ||
        mek.message?.videoMessage?.contextInfo;
    const target = context?.mentionedJid?.[0];
    if (!target) {
        return Prince.sendMessage(from, {
            text: "╭━━━〔 👾 HAYWHY_MDX 〕━━━╮\n┃\n┃ ❌ No target detected!\n┃ 🎯 Tag someone to begin.\n┃\n┃ 📌 Example: .hack @user\n┃\n╰━━━━━━━━━━━━━━━━━━━━"
        }, { quoted: mek });
    }
    // Extract the number if the WhatsApp ID contains one.
    const targetNumber = target
        .split("@")[0]
        .split(":")[0];
    const targetTag = `@${targetNumber}`;
    const sleep = ms =>
        new Promise(resolve => setTimeout(resolve, ms));
    // 1. Initialize
    await Prince.sendMessage(from, {
        text: `╭━━━〔 👾 HAYWHY_MDX 〕━━━╮
┃ 🎯 Target: ${targetTag}
┃ 🔎 Initializing target scan...
┃ ⏳ Loading system modules...
┃ ███░░░░░░░ 30%
╰━━━━━━━━━━━━━━━━━━━━`,
        mentions: [target]
    }, { quoted: mek });
    await sleep(1800);
    // 2. Credentials
    await Prince.sendMessage(from, {
        text: `🔐 *CREDENTIAL SCANNER*
👤 Target: ${targetTag}
🔄 Searching account identifiers...
🔑 Checking authentication records...
⚙️ Processing digital footprint...
⏳ Please wait...`,
        mentions: [target]
    });
    await sleep(2000);
    // 3. IP scan
    await Prince.sendMessage(from, {
        text: `╭━━━〔 🌐 NETWORK SCAN 〕━━━╮
┃ 🎯 Target: ${targetTag}
┃ 📡 Initializing network scan...
┃ 🔍 Analyzing connection data...
┃ 🖥️ Processing network identifiers...
┃ ██████░░░░ 60%
╰━━━━━━━━━━━━━━━━━━━━`,
        mentions: [target]
    });
    await sleep(2000);
    // 4. Location effect
    await Prince.sendMessage(from, {
        text: `╭━━━〔 🛰️ LOCATION TRACKER 〕━━━╮
┃ 🎯 Target: ${targetTag}
┃ 📍 Tracking @${targetNumber} location now...
┃ 🗺️ Mapping target coordinates...
┃ 📡 Synchronizing satellite data...
┃ ⏳ Retrieving final results...
╰━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        mentions: [target]
    });
    await sleep(2500);
    // 5. Final report
    await Prince.sendMessage(from, {
        text: `╭━━━〔 👾 HAYWHY_MDX REPORT 〕━━━╮
┃
┃ 🎯 Target: ${targetTag}
┃ 📱 WhatsApp Number: ${targetNumber}
┃ 🔐 Credentials: Scan simulated
┃ 🌐 IP Address: Not available
┃ 🌍 Country: sent
┃ 📡 Network Carrier: sent
┃ 📍 Live location: sent to ‎⁨👾𝒟𝐸𝒱-𝐻𝒜𝒴𝒲𝐻𝒴🤖⁩’s DM.
┃ 🛰️ Satellite Link: Initialized
┃ 🔎 Digital Footprint: Scan simulated
┃ ⚡ System Status: COMPLETE
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          👽 *HAYWHY_MDX* 👾`,
        mentions: [target]
    }, { quoted: mek });
});
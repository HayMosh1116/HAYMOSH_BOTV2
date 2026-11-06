const { gmd, getSetting, setSetting, getGroupSetting, setGroupSetting, resetAllGroupSettings, getAllGroupSettings, clearAllSudo, getAllUsersNotes, deleteNoteById, updateNoteById, deleteAllNotes, getSudoNumbers, resetSetting, resetAllSettings } = require("../mayel");

function parseBooleanInput(input) {
  if (!input) return null;
  const val = input.toLowerCase().trim();
  if (val === "on") return "true";
  if (val === "off") return "false";
  return val;
}

function formatBoolDisplay(val) {
  return val === "true" ? "ON" : "OFF";
}

function isSettingEnabled(val) {
  if (!val) return false;
  const v = String(val).toLowerCase().trim();
  return v === "true" || v === "on" || v === "1" || v === "yes" || v === "warn" || v === "kick" || v === "delete";
}


gmd(
  {
    pattern: "set",
    aliases: ["funwords", "setfunwords"],
    react: "⚙️",
    category: "owner",
    description: "Configure words for Fun Moderation",
  },
  async (from, Prince, conText) => {
    const { q, reply, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner Only Command!");
    const input = String(q || "").trim();
    const current = String(getSetting("FUN_MODERATION_WORDS", "") || "");
    if (input.toLowerCase() === "list") {
      const words = current.split(",").map(word => word.trim()).filter(Boolean);
      return reply(words.length
        ? "🛡️ *FUN MODERATION WORDS*\n\n" + words.map((word, index) => `${index + 1}. ${word}`).join("\n")
        : "ℹ️ No Fun Moderation words have been configured.");
    }
    if (input.toLowerCase() === "clear") {
      setSetting("FUN_MODERATION_WORDS", "");
      return reply("✅ Fun Moderation word list cleared.");
    }
    if (!input) {
      return reply("🛡️ *FUN MODERATION SETUP*\n\nUse:\n• .set word1,word2,word3\n• .set list\n• .set clear\n\nAt 4 warnings, the bot asks for owner/admin approval. It never removes or blocks automatically.");
    }
    const words = [...new Set(input.split(",").map(word => word.trim().toLowerCase()).filter(Boolean))];
    if (!words.length) return reply("❌ Enter at least one word separated by commas.");
    setSetting("FUN_MODERATION_WORDS", words.join(","));
    return reply("✅ Fun Moderation words saved:\n" + words.map((word, index) => `${index + 1}. ${word}`).join("\n"));
  },
);

gmd(
  {
    pattern: "setautolikestatus",
    aliases: ["autolikestatus", "autostatuslike", "statuslike", "autolike", "likestatus"],
    react: "⚙️",
    category: "owner",
    description: "Set auto like status (on/off)",
  },
  async (from, Prince, conText) => {
    const { q, reply, react, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner Only Command!");
    const valid = ["true", "false"];
    const value = parseBooleanInput(q);
    if (!value || !valid.includes(value)) {
      return reply(`❌ Please specify: on or off`);
    }
    try {
      const current = getSetting("AUTO_LIKE_STATUS");
      if (current === value) {
        return reply(`⚠️ Auto like status is already: *${formatBoolDisplay(value)}*`);
      }
      setSetting("AUTO_LIKE_STATUS", value);
      await react("✅");
      await reply(`✅ Auto like status set to: *${formatBoolDisplay(value)}*`);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "setautoreadstatus",
    aliases: ["autoreadstatus", "readstatus", "viewstatus"],
    react: "⚙️",
    category: "owner",
    description: "Set auto read status (on/off)",
  },
  async (from, Prince, conText) => {
    const { q, reply, react, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner Only Command!");
    const valid = ["true", "false"];
    const value = parseBooleanInput(q);
    if (!value || !valid.includes(value)) {
      return reply(`❌ Please specify: on or off`);
    }
    try {
      const current = getSetting("AUTO_READ_STATUS");
      if (current === value) {
        return reply(`⚠️ Auto read status is already: *${formatBoolDisplay(value)}*`);
      }
      setSetting("AUTO_READ_STATUS", value);
      await react("✅");
      await reply(`✅ Auto read status set to: *${formatBoolDisplay(value)}*`);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "setstatusemojis",
    aliases: ["statusemojis", "likeemojis"],
    react: "⚙️",
    category: "owner",
    description: "Set status like emojis (comma separated)",
  },
  async (from, Prince, conText) => {
    const { q, reply, react, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner Only Command!");
    if (!q) return reply("❌ Please provide emojis separated by commas!\nExample: .setstatusemojis 💛,❤️,💜");
    try {
      const current = getSetting("STATUS_LIKE_EMOJIS");
      if (current === q.trim()) {
        return reply(`⚠️ Status emojis are already set to: *${q.trim()}*`);
      }
      setSetting("STATUS_LIKE_EMOJIS", q.trim());
      await react("✅");
      await reply(`✅ Status emojis set to: *${q.trim()}*`);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "setstatusreplytext",
    aliases: ["statusreplytext", "statusreply"],
    react: "⚙️",
    category: "owner",
    description: "Set status reply text",
  },
  async (from, Prince, conText) => {
    const { q, reply, react, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner Only Command!");
    if (!q) return reply("❌ Please provide reply text!");
    try {
      const current = getSetting("STATUS_REPLY_TEXT");
      if (current === q.trim()) {
        return reply(`⚠️ Status reply text is already set to this value!`);
      }
      setSetting("STATUS_REPLY_TEXT", q.trim());
      await react("✅");
      await reply(`✅ Status reply text updated!`);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "setautoreact",
    aliases: ["autoreact"],
    react: "⚙️",
    category: "owner",
    description: "Set auto react mode (on/all/dm/groups/commands/off)",
  },
  async (from, Prince, conText) => {
    const { q, reply, react, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner Only Command!");
    const input = (q || "").toLowerCase().trim();
    const validModes = ["on", "all", "dm", "groups", "commands", "off"];
    if (!input || !validModes.includes(input)) {
      return reply(`❌ Please specify a valid mode:\n• *on/all* - React to all messages\n• *dm* - React to private chats only\n• *groups* - React to group messages only\n• *commands* - React to bot commands only\n• *off* - Disable auto react`);
    }
    const value = input === "on" ? "all" : input;
    try {
      const current = getSetting("AUTO_REACT");
      if (current === value) {
        return reply(`⚠️ Auto react is already set to: *${value.toUpperCase()}*`);
      }
      setSetting("AUTO_REACT", value);
      await react("✅");
      await reply(`✅ Auto react set to: *${value.toUpperCase()}*`);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "setautoreply",
    aliases: ["autoreply"],
    react: "⚙️",
    category: "owner",
    description: "Set auto reply (on/off)",
  },
  async (from, Prince, conText) => {
    const { q, reply, react, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner Only Command!");
    const valid = ["true", "false"];
    const value = parseBooleanInput(q);
    if (!value || !valid.includes(value)) {
      return reply(`❌ Please specify: on or off`);
    }
    try {
      const current = getSetting("AUTO_REPLY");
      if (current === value) {
        return reply(`⚠️ Auto reply is already: *${formatBoolDisplay(value)}*`);
      }
      setSetting("AUTO_REPLY", value);
      await react("✅");
      await reply(`✅ Auto reply set to: *${formatBoolDisplay(value)}*`);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "setchatbot",
    aliases: ["chatbot"],
    react: "🤖",
    category: "owner",
    description: "Set chatbot mode (true/audio/off)",
  },
  async (from, Prince, conText) => {
    const { q, reply, react, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner Only Command!");
    const input = (q || "").toLowerCase().trim();
    const validModes = ["true", "on", "audio", "false", "off"];
    if (!input || !validModes.includes(input)) {
      const current = getSetting("CHATBOT", "false");
      return reply(`🤖 *Chatbot Settings*\n\nCurrent: *${current.toUpperCase()}*\n\nUsage:\n• *.setchatbot on* - Text replies\n• *.setchatbot audio* - Voice replies\n• *.setchatbot off* - Disable chatbot`);
    }
    const value = input === "on" ? "true" : input === "off" ? "false" : input;
    try {
      setSetting("CHATBOT", value);
      await react("✅");
      const display = value === "true" ? "ON (Text)" : value === "audio" ? "ON (Audio)" : "OFF";
      await reply(`✅ Chatbot set to: *${display}*`);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "setchatbotmode",
    aliases: ["chatbotmode"],
    react: "🤖",
    category: "owner",
    description: "Set chatbot scope (inbox/groups/allchats)",
  },
  async (from, Prince, conText) => {
    const { q, reply, react, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner Only Command!");
    const input = (q || "").toLowerCase().trim();
    const validModes = ["inbox", "groups", "allchats"];
    if (!input || !validModes.includes(input)) {
      const current = getSetting("CHATBOT_MODE", "inbox");
      return reply(`🤖 *Chatbot Mode*\n\nCurrent: *${current.toUpperCase()}*\n\nUsage:\n• *.setchatbotmode inbox* - DMs only\n• *.setchatbotmode groups* - Groups only\n• *.setchatbotmode allchats* - Everywhere`);
    }
    try {
      setSetting("CHATBOT_MODE", input);
      await react("✅");
      await reply(`✅ Chatbot mode set to: *${input.toUpperCase()}*`);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "setautobio",
    aliases: ["autobio"],
    react: "⚙️",
    category: "owner",
    description: "Set auto bio (on/off)",
  },
  async (from, Prince, conText) => {
    const { q, reply, react, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner Only Command!");
    const valid = ["true", "false"];
    const value = parseBooleanInput(q);
    if (!value || !valid.includes(value)) {
      return reply(`❌ Please specify: on or off`);
    }
    try {
      const current = getSetting("AUTO_BIO");
      if (current === value) {
        return reply(`⚠️ Auto bio is already: *${formatBoolDisplay(value)}*`);
      }
      setSetting("AUTO_BIO", value);
      await react("✅");
      await reply(`✅ Auto bio set to: *${formatBoolDisplay(value)}*`);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "setautoblock",
    aliases: ["autoblock", "blockcountry"],
    react: "⚙️",
    category: "owner",
    description: "Set auto block country codes (comma separated or empty to disable)",
  },
  async (from, Prince, conText) => {
    const { q, reply, react, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner Only Command!");
    try {
      const value = q ? q.trim() : "";
      const current = getSetting("AUTO_BLOCK");
      if (current === value) {
        if (value) {
          return reply(`⚠️ Auto block is already set to: *${value}*`);
        } else {
          return reply(`⚠️ Auto block is already disabled!`);
        }
      }
      setSetting("AUTO_BLOCK", value);
      await react("✅");
      if (value) {
        await reply(`✅ Auto block set for country codes: *${value}*`);
      } else {
        await reply(`✅ Auto block disabled`);
      }
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "setautoread",
    aliases: ["autoread", "readmessages"],
    react: "⚙️",
    category: "owner",
    description: "Set auto read messages mode (on/all/dm/groups/commands/off)",
  },
  async (from, Prince, conText) => {
    const { q, reply, react, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner Only Command!");
    const input = (q || "").toLowerCase().trim();
    const validModes = ["on", "all", "dm", "groups", "commands", "off"];
    if (!input || !validModes.includes(input)) {
      return reply(`❌ Please specify a valid mode:\n• *on/all* - Read all messages\n• *dm* - Read private chats only\n• *groups* - Read group messages only\n• *commands* - Read bot commands only\n• *off* - Disable auto read`);
    }
    const value = input === "on" ? "all" : input;
    try {
      const current = getSetting("AUTO_READ_MESSAGES");
      if (current === value) {
        return reply(`⚠️ Auto read messages is already set to: *${value.toUpperCase()}*`);
      }
      setSetting("AUTO_READ_MESSAGES", value);
      await react("✅");
      await reply(`✅ Auto read messages set to: *${value.toUpperCase()}*`);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "setpackname",
    aliases: ["packname", "stickerpack", "stickername"],
    react: "⚙️",
    category: "owner",
    description: "Set sticker pack name",
  },
  async (from, Prince, conText) => {
    const { q, reply, react, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner Only Command!");
    if (!q) return reply("❌ Please provide a pack name!");
    try {
      const current = getSetting("PACK_NAME");
      if (current === q.trim()) {
        return reply(`⚠️ Pack name is already set to: *${q.trim()}*`);
      }
      setSetting("PACK_NAME", q.trim());
      await react("✅");
      await reply(`✅ Pack name set to: *${q.trim()}*`);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "setpackauthor",
    aliases: ["packauthor", "stickerauthor"],
    react: "⚙️",
    category: "owner",
    description: "Set sticker pack author",
  },
  async (from, Prince, conText) => {
    const { q, reply, react, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner Only Command!");
    if (!q) return reply("❌ Please provide a pack author!");
    try {
      const current = getSetting("PACK_AUTHOR");
      if (current === q.trim()) {
        return reply(`⚠️ Pack author is already set to: *${q.trim()}*`);
      }
      setSetting("PACK_AUTHOR", q.trim());
      await react("✅");
      await reply(`✅ Pack author set to: *${q.trim()}*`);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "getsetting",
    aliases: ["getconfig", "viewsetting"],
    react: "⚙️",
    category: "owner",
    description: "Get a specific setting value",
  },
  async (from, Prince, conText) => {
    const { q, reply, react, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner Only Command!");
    if (!q) return reply("❌ Please provide a setting key!\nExample: .getsetting PREFIX");
    try {
      const value = getSetting(q.toUpperCase().trim());
      await react("✅");
      await reply(`⚙️ *${q.toUpperCase()}:* ${value || "Not Set"}`);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "setsetting",
    aliases: ["setconfig", "config"],
    react: "⚙️",
    category: "owner",
    description: "Set any setting (key value)",
  },
  async (from, Prince, conText) => {
    const { q, reply, react, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner Only Command!");
    if (!q || !q.includes(" ")) {
      return reply("❌ Please provide key and value!\nExample: .setsetting PREFIX !");
    }
    try {
      const parts = q.split(" ");
      const key = parts[0].toUpperCase();
      const value = parts.slice(1).join(" ");
      const current = getSetting(key);
      if (current === value) {
        return reply(`⚠️ *${key}* is already set to: *${value}*`);
      }
      setSetting(key, value);
      await react("✅");
      await reply(`✅ *${key}* set to: *${value}*`);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "resetsetting",
    aliases: ["resetconfig", "defaultsetting"],
    react: "⚙️",
    category: "owner",
    description: "Reset a setting to default",
  },
  async (from, Prince, conText) => {
    const { q, reply, react, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner Only Command!");
    if (!q) return reply("❌ Please provide a setting key to reset!");
    try {
      const defaultValue = resetSetting(q.toUpperCase().trim());
      await react("✅");
      await reply(`✅ *${q.toUpperCase()}* reset to default: *${defaultValue || "Not Set"}*`);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "resetallsettings",
    aliases: ["resetsettings", "resetall", "defaultsettings"],
    react: "⚙️",
    category: "owner",
    description: "Reset all settings to defaults",
  },
  async (from, Prince, conText) => {
    const { reply, react, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner Only Command!");
    try {
      resetAllSettings();
      await react("✅");
      await reply(`✅ All settings have been reset to defaults!`);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "setautoreplystatus",
    aliases: ["autoreplystatus", "replystatusauto"],
    react: "⚙️",
    category: "owner",
    description: "Set auto reply to status (on/off)",
  },
  async (from, Prince, conText) => {
    const { q, reply, react, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner Only Command!");
    const valid = ["true", "false"];
    const value = parseBooleanInput(q);
    if (!value || !valid.includes(value)) {
      return reply(`❌ Please specify: on or off`);
    }
    try {
      const current = getSetting("AUTO_REPLY_STATUS");
      if (current === value) {
        return reply(`⚠️ Auto reply status is already: *${formatBoolDisplay(value)}*`);
      }
      setSetting("AUTO_REPLY_STATUS", value);
      await react("✅");
      await reply(`✅ Auto reply status set to: *${formatBoolDisplay(value)}*`);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "setpmpermit",
    aliases: ["pmpermit"],
    react: "⚙️",
    category: "owner",
    description: "Set PM permit (on/off)",
  },
  async (from, Prince, conText) => {
    const { q, reply, react, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner Only Command!");
    const valid = ["true", "false"];
    const value = parseBooleanInput(q);
    if (!value || !valid.includes(value)) {
      return reply(`❌ Please specify: on or off`);
    }
    try {
      const current = getSetting("PM_PERMIT");
      if (current === value) {
        return reply(`⚠️ PM Permit is already: *${formatBoolDisplay(value)}*`);
      }
      setSetting("PM_PERMIT", value);
      await react("✅");
      await reply(`✅ PM Permit set to: *${formatBoolDisplay(value)}*`);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "setgroupevents",
    aliases: ["groupevents", "gcevents", "setgcevents", "events"],
    react: "⚙️",
    category: "group",
    description: "Set group events notifications for this group (on/off)",
  },
  async (from, Prince, conText) => {
    const { q, reply, react, isSuperUser, isGroup, isAdmin } = conText;
    if (!isGroup) return reply("❌ This command only works in groups!");
    if (!isSuperUser && !isAdmin) return reply("❌ Admin/Owner Only Command!");
    const valid = ["true", "false"];
    const value = parseBooleanInput(q);
    if (!value || !valid.includes(value)) {
      return reply(`❌ Please specify: on or off`);
    }
    try {
      const current = getGroupSetting(from, "GROUP_EVENTS");
      if (current === value) {
        return reply(`⚠️ Group events for this group is already: *${formatBoolDisplay(value)}*`);
      }
      setGroupSetting(from, "GROUP_EVENTS", value);
      await react("✅");
      await reply(`✅ Group events for this group: *${formatBoolDisplay(value)}*`);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "resetsudo",
    aliases: ["deleteallsudos", "resetsudos", "clearsudo", "clearsudos"],
    react: "🗑️",
    category: "owner",
    description: "Remove all sudo numbers from database",
  },
  async (from, Prince, conText) => {
    const { reply, react, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner Only Command!");
    try {
      const sudoList = getSudoNumbers();
      if (sudoList.length === 0) {
        return reply("⚠️ No sudo numbers to remove.");
      }
      const count = clearAllSudo();
      await react("✅");
      await reply(`✅ Removed *${count}* sudo number(s) from database.`);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "groupsettings",
    aliases: ["gcsettings", "gcset", "groupset", "gsettings"],
    react: "⚙️",
    category: "group",
    description: "View all settings for this group",
  },
  async (from, Prince, conText) => {
    const { reply, react, isAdmin, isSuperAdmin, isGroup, groupName, botPic, sender, newsletterJid, botName, getContextInfo, mek } = conText;
    if (!isGroup) return reply("❌ This command only works in groups!");
    if (!isAdmin && !isSuperAdmin) return reply("❌ Admin Only Command!");
    try {
      let profilePic;
      try {
        profilePic = await Prince.profilePictureUrl(from, 'image');
      } catch (e) {
        profilePic = botPic;
      }

      const settings = getAllGroupSettings(from);

      const welcomeStatus = isSettingEnabled(settings.WELCOME_MESSAGE) ? "ON" : "OFF";
      const goodbyeStatus = isSettingEnabled(settings.GOODBYE_MESSAGE) ? "ON" : "OFF";
      const antilinkStatus = isSettingEnabled(settings.ANTILINK) ? "ON" : "OFF";
      const mentionStatus = isSettingEnabled(settings.STATUS_MENTION) ? "ON" : "OFF";

      const antilinkRaw = settings.ANTILINK || "off";
      let antilinkAction = "delete";
      if (antilinkRaw === "warn") antilinkAction = "warn";
      else if (antilinkRaw === "kick") antilinkAction = "kick";

      let msg = `╭━━━━━━━━━━━╮\n`;
      msg += `│ ⚙️ *GROUP SETTINGS*\n`;
      msg += `├━━━━━━━━━━━┤\n`;
      msg += `│ 📍 *${groupName || "This Group"}*\n`;
      msg += `├━━━━━━━━━━━┤\n`;
      msg += `│\n`;
      msg += `│ 👋 *Welcome:* ${welcomeStatus}\n`;
      msg += `│ 👋 *Goodbye:* ${goodbyeStatus}\n`;
      msg += `│\n`;
      msg += `├━━━━━━━━━━━┤\n`;
      msg += `│ 🛡️ *PROTECTION*\n`;
      msg += `├━━━━━━━━━━━┤\n`;
      msg += `│\n`;
      msg += `│ 🔗 *Antilink:* ${antilinkStatus}\n`;
      if (antilinkStatus === "ON") {
        msg += `│ └ Action: ${antilinkAction}\n`;
      }
      msg += `│ 🛡️ *Mention:* ${mentionStatus}\n`;
      if (mentionStatus === "ON") {
        msg += `│ └ Action: ${settings.STATUS_MENTION || "warn"}\n`;
      }
      msg += `│\n`;
      msg += `╰━━━━━━━━━━━╯\n`;
      msg += `\n_Use .setwelcome, .setgoodbye, .antilink, etc to modify_`;

      await react("✅");
      await Prince.sendMessage(from, {
        image: { url: profilePic },
        caption: msg,
        contextInfo: getContextInfo(sender, newsletterJid, botName)
      }, { quoted: mek });
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "setwelcome",
    aliases: ["welcome", "welcomemsg"],
    react: "👋",
    category: "group",
    description: "Enable/disable welcome message for this group",
  },
  async (from, Prince, conText) => {
    const { q, reply, react, isAdmin, isSuperAdmin, isGroup, groupName, quotedMsg, botPic, sender, newsletterJid, botName, getContextInfo, mek } = conText;
    if (!isGroup) return reply("❌ This command only works in groups!");
    if (!isAdmin && !isSuperAdmin) return reply("❌ Admin Only Command!");

    let text = q?.trim() || "";
    if (!text && quotedMsg) {
      text = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || "";
    }

    if (!text) {
      const current = getGroupSetting(from, "WELCOME_MESSAGE", "off");
      const status = isSettingEnabled(current) ? "ON" : "OFF";
      const menuText = `👋 *Welcome Message Settings*

📍 *Group:* ${groupName || "This Group"}
📌 *Status:* ${status}

Reply With:
*1.* Enable Welcome
*2.* Disable Welcome
*3.* Set Custom Message (Type your message)

*Variables:* {user}, {group}, {desc}`;

      const sentMsg = await Prince.sendMessage(from, {
        image: { url: botPic },
        caption: menuText,
        contextInfo: getContextInfo(sender, newsletterJid, botName),
      }, { quoted: mek });

      const handler = async (event) => {
        const ms = event.messages[0];
        if (!ms?.message || ms.key.fromMe) return;
        if (ms.message?.extendedTextMessage?.contextInfo?.stanzaId === sentMsg.key.id) {
          const input = (ms.message.conversation || ms.message.extendedTextMessage?.text || "").trim();
          if (input === "1") {
            Prince.ev.off("messages.upsert", handler);
            setGroupSetting(from, "WELCOME_MESSAGE", "true");
            return reply("✅ Welcome message *enabled*.");
          } else if (input === "2") {
            Prince.ev.off("messages.upsert", handler);
            setGroupSetting(from, "WELCOME_MESSAGE", "false");
            return reply("✅ Welcome message *disabled*.");
          } else if (input.length > 1) {
            Prince.ev.off("messages.upsert", handler);
            setGroupSetting(from, "WELCOME_MESSAGE", "true");
            setGroupSetting(from, "WELCOME_TEXT", input);
            return reply(`✅ Custom welcome message set!\n\n*Preview:*\n${input}`);
          }
        }
      };
      Prince.ev.on("messages.upsert", handler);
      setTimeout(() => Prince.ev.off("messages.upsert", handler), 60000);
      return;
    }

    const input = text.toLowerCase();

    if (input === "on") {
      setGroupSetting(from, "WELCOME_MESSAGE", "true");
      await react("✅");
      return reply(`✅ Welcome message *enabled* for *${groupName || "this group"}*`);
    }

    if (input === "off") {
      setGroupSetting(from, "WELCOME_MESSAGE", "false");
      await react("✅");
      return reply(`✅ Welcome message *disabled* for *${groupName || "this group"}*`);
    }

    setGroupSetting(from, "WELCOME_MESSAGE", "true");
    setGroupSetting(from, "WELCOME_TEXT", text);
    await react("✅");
    return reply(`✅ Custom welcome message set for *${groupName || "this group"}*\n\n*Preview:*\n${text}`);
  },
);

gmd(
  {
    pattern: "setgoodbye",
    aliases: ["goodbye", "goodbyemsg", "setbye", "bye"],
    react: "👋",
    category: "group",
    description: "Enable/disable goodbye message for this group",
  },
  async (from, Prince, conText) => {
    const { q, reply, react, isAdmin, isSuperAdmin, isGroup, groupName, quotedMsg, botPic, sender, newsletterJid, botName, getContextInfo, mek } = conText;
    if (!isGroup) return reply("❌ This command only works in groups!");
    if (!isAdmin && !isSuperAdmin) return reply("❌ Admin Only Command!");

    let text = q?.trim() || "";
    if (!text && quotedMsg) {
      text = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || "";
    }

    if (!text) {
      const current = getGroupSetting(from, "GOODBYE_MESSAGE", "off");
      const status = isSettingEnabled(current) ? "ON" : "OFF";
      const menuText = `👋 *Goodbye Message Settings*

📍 *Group:* ${groupName || "This Group"}
📌 *Status:* ${status}

Reply With:
*1.* Enable Goodbye
*2.* Disable Goodbye
*3.* Set Custom Message (Type your message)

*Variables:* {user}, {group}, {desc}`;

      const sentMsg = await Prince.sendMessage(from, {
        image: { url: botPic },
        caption: menuText,
        contextInfo: getContextInfo(sender, newsletterJid, botName),
      }, { quoted: mek });

      const handler = async (event) => {
        const ms = event.messages[0];
        if (!ms?.message || ms.key.fromMe) return;
        if (ms.message?.extendedTextMessage?.contextInfo?.stanzaId === sentMsg.key.id) {
          const input = (ms.message.conversation || ms.message.extendedTextMessage?.text || "").trim();
          if (input === "1") {
            Prince.ev.off("messages.upsert", handler);
            setGroupSetting(from, "GOODBYE_MESSAGE", "true");
            return reply("✅ Goodbye message *enabled*.");
          } else if (input === "2") {
            Prince.ev.off("messages.upsert", handler);
            setGroupSetting(from, "GOODBYE_MESSAGE", "false");
            return reply("✅ Goodbye message *disabled*.");
          } else if (input.length > 1) {
            Prince.ev.off("messages.upsert", handler);
            setGroupSetting(from, "GOODBYE_MESSAGE", "true");
            setGroupSetting(from, "GOODBYE_TEXT", input);
            return reply(`✅ Custom goodbye message set!\n\n*Preview:*\n${input}`);
          }
        }
      };
      Prince.ev.on("messages.upsert", handler);
      setTimeout(() => Prince.ev.off("messages.upsert", handler), 60000);
      return;
    }

    const input = text.toLowerCase();

    if (input === "on") {
      setGroupSetting(from, "GOODBYE_MESSAGE", "true");
      await react("✅");
      return reply(`✅ Goodbye message *enabled* for *${groupName || "this group"}*`);
    }

    if (input === "off") {
      setGroupSetting(from, "GOODBYE_MESSAGE", "false");
      await react("✅");
      return reply(`✅ Goodbye message *disabled* for *${groupName || "this group"}*`);
    }

    setGroupSetting(from, "GOODBYE_MESSAGE", "true");
    setGroupSetting(from, "GOODBYE_TEXT", text);
    await react("✅");
    return reply(`✅ Custom goodbye message set for *${groupName || "this group"}*\n\n*Preview:*\n${text}`);
  },
);

gmd(
  {
    pattern: "resetgroup",
    aliases: ["resetgroupsettings", "cleargroupsettings", "resetgc", "cleargc"],
    react: "🗑️",
    category: "group",
    description: "Reset all settings for this group",
  },
  async (from, Prince, conText) => {
    const { reply, react, isSuperUser, isGroup } = conText;
    if (!isGroup) return reply("❌ This command only works in groups!");
    if (!isSuperUser) return reply("❌ Owner Only Command!");
    try {
      resetAllGroupSettings(from);
      await react("✅");
      await reply(`✅ All settings for this group have been reset to defaults.\n\n*Cleared:*\n▸ Welcome message\n▸ Goodbye message\n▸ Group events\n▸ Antilink\n▸ Antilink warnings`);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "resetdb",
    aliases: ["resetdatabase", "wipedatabase", "wipedb", "factoryreset", "flushdb", "flushdatabase"],
    react: "⚠️",
    category: "owner",
    description: "Reset entire database to defaults",
  },
  async (from, Prince, conText) => {
    const { q, reply, react, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner Only Command!");
    if (q !== "confirm") {
      return reply(`⚠️ *WARNING: This will reset EVERYTHING!*\n\n*Will be cleared:*\n▸ All bot settings\n▸ All sudo numbers\n▸ All group settings\n▸ All antilink warnings\n\nTo confirm, type: *.resetdb confirm*`);
    }
    try {
      resetAllSettings();
      clearAllSudo();
      const { db } = require("../mayel/gmdSudoUtil");
      db.prepare("DELETE FROM group_settings").run();
      db.prepare("DELETE FROM user_notes").run();
      await react("✅");
      await reply(`✅ Database has been completely reset to defaults.\n\nAll settings, sudo numbers, group configurations, and user notes have been cleared.`);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "allnotes",
    aliases: ["viewnotes", "usernotes", "allnotesdb"],
    react: "📋",
    category: "owner",
    description: "View all users' notes (owner only)",
  },
  async (from, Prince, conText) => {
    const { reply, react, isSuperUser } = conText;
    if (!isSuperUser) {
      await react("❌");
      return reply("❌ Owner Only Command!");
    }
    try {
      const allNotes = getAllUsersNotes();
      if (allNotes.length === 0) {
        return reply("📭 No notes in the database.");
      }
      const groupedByUser = {};
      for (const note of allNotes) {
        if (!groupedByUser[note.userJid]) {
          groupedByUser[note.userJid] = [];
        }
        groupedByUser[note.userJid].push(note);
      }
      let text = `📋 *ALL USER NOTES*\n\n`;
      text += `Total: ${allNotes.length} notes from ${Object.keys(groupedByUser).length} users\n\n`;
      for (const [userJid, notes] of Object.entries(groupedByUser)) {
        const userName = userJid.split("@")[0];
        text += `👤 *@${userName}* (${notes.length} notes)\n`;
        for (const note of notes) {
          const preview = note.content.length > 30 ? note.content.substring(0, 30) + "..." : note.content;
          text += `  ID:${note.id} #${note.noteNumber} - ${preview}\n`;
        }
        text += `\n`;
      }
      text += `_Use .admindelnote <id> to delete a note_\n`;
      text += `_Use .adminupdatenote <id> <text> to update_\n`;
      text += `_Use .adminclearnotes <number> to clear user notes_`;
      await reply(text);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "admindelnote",
    aliases: ["deletenotebyid", "rmnotebyid", "admindeletenote"],
    react: "🗑️",
    category: "owner",
    description: "Delete any note by ID (owner only)",
  },
  async (from, Prince, conText) => {
    const { reply, react, isSuperUser, q } = conText;
    if (!isSuperUser) {
      await react("❌");
      return reply("❌ Owner Only Command!");
    }
    if (!q || isNaN(parseInt(q))) {
      return reply("❌ Provide a note ID.\n\nUsage: .admindelnote <id>");
    }
    try {
      const noteId = parseInt(q);
      const deleted = deleteNoteById(noteId);
      if (!deleted) {
        return reply(`❌ Note with ID ${noteId} not found.`);
      }
      await react("✅");
      return reply(`✅ Note ID ${noteId} deleted!`);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "adminupdatenote",
    aliases: ["editnotebyid", "updatenotebyid", "admineditnote"],
    react: "✏️",
    category: "owner",
    description: "Update any note by ID (owner only)",
  },
  async (from, Prince, conText) => {
    const { reply, react, isSuperUser, q } = conText;
    if (!isSuperUser) {
      await react("❌");
      return reply("❌ Owner Only Command!");
    }
    if (!q || q.trim() === "") {
      return reply("❌ Provide note ID and new content.\n\nUsage: .adminupdatenote <id> <new text>");
    }
    try {
      const parts = q.trim().split(/\s+/);
      const noteId = parseInt(parts[0]);
      if (isNaN(noteId)) {
        return reply("❌ First argument must be a note ID.\n\nUsage: .adminupdatenote <id> <new text>");
      }
      const newContent = parts.slice(1).join(" ");
      if (!newContent) {
        return reply("❌ Provide new content.\n\nUsage: .adminupdatenote <id> <new text>");
      }
      const note = updateNoteById(noteId, newContent);
      if (!note) {
        return reply(`❌ Note with ID ${noteId} not found.`);
      }
      await react("✅");
      return reply(`✅ Note ID ${noteId} updated!\n\n📝 "${note.content}"`);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "adminclearnotes",
    aliases: ["clearusernotes", "deleteusernotes", "adminrmallnotes"],
    react: "🗑️",
    category: "owner",
    description: "Delete all notes for a specific user (owner only)",
  },
  async (from, Prince, conText) => {
    const { reply, react, isSuperUser, q } = conText;
    if (!isSuperUser) {
      await react("❌");
      return reply("❌ Owner Only Command!");
    }
    if (!q || q.trim() === "") {
      return reply("❌ Provide user number.\n\nUsage: .adminclearnotes <number>");
    }
    try {
      let userNumber = q.trim().replace(/[^0-9]/g, "");
      const userJid = userNumber + "@s.whatsapp.net";
      const count = deleteAllNotes(userJid);
      if (count === 0) {
        return reply(`📭 No notes found for ${userNumber}.`);
      }
      await react("✅");
      return reply(`✅ Deleted ${count} note${count > 1 ? "s" : ""} for ${userNumber}!`);
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
);

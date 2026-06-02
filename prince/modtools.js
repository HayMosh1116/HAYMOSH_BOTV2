const { gmd, getGroupSetting, setGroupSetting, addWarning, getUserWarnings, resetWarnings } = require("../mayel");

/**
 * Advanced Moderation Tools
 * Commands: .warn, .warnings, .clearwarn, .slowmode, .filterword, .unfilterword, .filteredwords, .purge, .softban, .lockchat, .unlockchat, .modmenu
 */

// In-memory filtered words: chatJid -> Set(words)
const filteredWords = new Map();

// ─── Warn ─────────────────────────────────────────────────────────────────────

gmd({
  pattern: "warn",
  aliases: ["warning"],
  react: "⚠️",
  category: "group",
  description: "Warn a user. Reply to a message or @mention them",
}, async (from, Prince, conText) => {
  const { reply, mek, sender, isAdmin, isSuperAdmin, isBotAdmin, isGroup, mentionedJid, quotedUser } = conText;

  if (!isGroup) return reply("⚠️ Group only command.");
  if (!isBotAdmin) return reply("❌ Make the bot admin first.");
  if (!isAdmin && !isSuperAdmin) return reply("❌ Admins only.");

  const target = quotedUser || (mentionedJid && mentionedJid[0]);
  if (!target) return reply("❌ Reply to a message or @mention the user to warn them.");

  const config = require("../config");
  const maxWarns = parseInt(config.WARN_COUNT) || 4;

  // addWarning(groupJid, userJid, reason, type) returns new count
  const warnings = addWarning(from, target, "Manual warn by admin", "warn");
  const userNum = target.split("@")[0];

  if (warnings >= maxWarns) {
    try {
      await Prince.groupParticipantsUpdate(from, [target], "remove");
      resetWarnings(from, target);
      await Prince.sendMessage(from, {
        text: `⛔ @${userNum} has been *kicked* after reaching ${maxWarns} warnings!`,
        mentions: [target],
      }, { quoted: mek });
    } catch (e) {
      await Prince.sendMessage(from, {
        text: `⚠️ @${userNum} reached max warnings (${maxWarns}) but couldn't be kicked. Please remove manually.`,
        mentions: [target],
      }, { quoted: mek });
    }
  } else {
    await Prince.sendMessage(from, {
      text: `⚠️ *WARNING ${warnings}/${maxWarns}* issued to @${userNum}\n\n_${maxWarns - warnings} more warning(s) will result in a kick._`,
      mentions: [target],
    }, { quoted: mek });
  }
});

// ─── Check Warnings ───────────────────────────────────────────────────────────

gmd({
  pattern: "warnings",
  aliases: ["checkwarn", "warncount"],
  react: "📋",
  category: "group",
  description: "Check warnings for a user",
}, async (from, Prince, conText) => {
  const { reply, mek, isGroup, mentionedJid, quotedUser } = conText;

  if (!isGroup) return reply("Group only command.");

  const target = quotedUser || (mentionedJid && mentionedJid[0]);
  if (!target) return reply("❌ Reply to a message or @mention the user.");

  const config = require("../config");
  const maxWarns = parseInt(config.WARN_COUNT) || 4;

  // getUserWarnings(groupJid, userJid) returns { count: N }
  const result = getUserWarnings(from, target);
  const warns = result?.count || 0;
  const userNum = target.split("@")[0];

  await Prince.sendMessage(from, {
    text: `📋 *Warnings for @${userNum}*\n\n⚠️ ${warns}/${maxWarns} warnings`,
    mentions: [target],
  }, { quoted: mek });
});

// ─── Clear Warnings ───────────────────────────────────────────────────────────

gmd({
  pattern: "clearwarn",
  aliases: ["resetwarn", "removewarn"],
  react: "✅",
  category: "group",
  description: "Clear all warnings for a user",
}, async (from, Prince, conText) => {
  const { reply, mek, isAdmin, isSuperAdmin, isGroup, mentionedJid, quotedUser } = conText;

  if (!isGroup) return reply("Group only command.");
  if (!isAdmin && !isSuperAdmin) return reply("❌ Admins only.");

  const target = quotedUser || (mentionedJid && mentionedJid[0]);
  if (!target) return reply("❌ Reply to a message or @mention the user.");

  resetWarnings(from, target);
  const userNum = target.split("@")[0];

  await Prince.sendMessage(from, {
    text: `✅ All warnings cleared for @${userNum}`,
    mentions: [target],
  }, { quoted: mek });
});

// ─── Slowmode ─────────────────────────────────────────────────────────────────

gmd({
  pattern: "slowmode",
  aliases: ["slowchat"],
  react: "🐢",
  category: "group",
  description: "Enable slowmode. Usage: .slowmode <seconds> (0 to disable)",
}, async (from, Prince, conText) => {
  const { reply, mek, q, isAdmin, isSuperAdmin, isGroup, isBotAdmin } = conText;

  if (!isGroup) return reply("Group only command.");
  if (!isBotAdmin) return reply("❌ Make the bot admin first.");
  if (!isAdmin && !isSuperAdmin) return reply("❌ Admins only.");

  const secs = parseInt(q?.trim());
  if (isNaN(secs) || secs < 0) return reply("Usage: *.slowmode 10* (10 second cooldown)\n*.slowmode 0* to disable");

  if (secs === 0) {
    setGroupSetting(from, "SLOWMODE", "0");
    return reply("✅ Slowmode disabled.");
  }

  setGroupSetting(from, "SLOWMODE", String(secs));
  await Prince.sendMessage(from, {
    text: `🐢 *Slowmode enabled!* Users must wait *${secs} second(s)* between messages.`,
  }, { quoted: mek });
});

// ─── Word Filter ──────────────────────────────────────────────────────────────

gmd({
  pattern: "filterword",
  aliases: ["addfilter", "banword"],
  react: "🚫",
  category: "group",
  description: "Add a word to the group's filtered word list. Usage: .filterword <word>",
}, async (from, Prince, conText) => {
  const { reply, mek, q, isAdmin, isSuperAdmin, isGroup } = conText;

  if (!isGroup) return reply("Group only command.");
  if (!isAdmin && !isSuperAdmin) return reply("❌ Admins only.");
  if (!q) return reply("Usage: *.filterword <word>*");

  const word = q.trim().toLowerCase();
  if (!filteredWords.has(from)) filteredWords.set(from, new Set());
  filteredWords.get(from).add(word);

  await reply(`✅ *"${word}"* added to the word filter. Messages containing it will be deleted.`);
});

gmd({
  pattern: "unfilterword",
  aliases: ["removefilter", "unbanword"],
  react: "✅",
  category: "group",
  description: "Remove a word from the filtered word list. Usage: .unfilterword <word>",
}, async (from, Prince, conText) => {
  const { reply, mek, q, isAdmin, isSuperAdmin, isGroup } = conText;

  if (!isGroup) return reply("Group only command.");
  if (!isAdmin && !isSuperAdmin) return reply("❌ Admins only.");
  if (!q) return reply("Usage: *.unfilterword <word>*");

  const word = q.trim().toLowerCase();
  const set = filteredWords.get(from);
  if (!set || !set.has(word)) return reply(`❌ *"${word}"* is not in the filter list.`);

  set.delete(word);
  await reply(`✅ *"${word}"* removed from the word filter.`);
});

gmd({
  pattern: "filteredwords",
  aliases: ["filterlist", "bannedwords"],
  react: "📋",
  category: "group",
  description: "List all filtered words in this group",
}, async (from, Prince, conText) => {
  const { reply, isAdmin, isSuperAdmin, isGroup } = conText;

  if (!isGroup) return reply("Group only command.");
  if (!isAdmin && !isSuperAdmin) return reply("❌ Admins only.");

  const set = filteredWords.get(from);
  if (!set || set.size === 0) return reply("ℹ️ No filtered words in this group.");

  const list = [...set].map((w, i) => `  ${i + 1}. ${w}`).join("\n");
  await reply(`🚫 *Filtered Words in this group:*\n\n${list}`);
});

// ─── Softban (kick + reinvite) ────────────────────────────────────────────────

gmd({
  pattern: "softban",
  aliases: ["kickreinvite"],
  react: "🔄",
  category: "group",
  description: "Softban: kick then send reinvite link. Usage: reply or @mention",
}, async (from, Prince, conText) => {
  const { reply, mek, isAdmin, isSuperAdmin, isGroup, isBotAdmin, mentionedJid, quotedUser, sender } = conText;

  if (!isGroup) return reply("Group only command.");
  if (!isBotAdmin) return reply("❌ Bot needs to be admin.");
  if (!isAdmin && !isSuperAdmin) return reply("❌ Admins only.");

  const target = quotedUser || (mentionedJid && mentionedJid[0]);
  if (!target) return reply("❌ Reply to a message or @mention the user to softban.");
  if (target === sender) return reply("❌ You can't softban yourself.");

  const userNum = target.split("@")[0];

  try {
    const inviteCode = await Prince.groupInviteCode(from);
    await Prince.groupParticipantsUpdate(from, [target], "remove");
    await new Promise(r => setTimeout(r, 1500));
    try {
      await Prince.sendMessage(target, {
        text: `🔄 You were softbanned from the group. Rejoin here:\nhttps://chat.whatsapp.com/${inviteCode}`,
      });
    } catch {}
    await Prince.sendMessage(from, {
      text: `✅ @${userNum} has been softbanned and sent a reinvite link.`,
      mentions: [target],
    }, { quoted: mek });
  } catch (e) {
    await reply(`❌ Softban failed: ${e.message}`);
  }
});

// ─── Purge Messages ───────────────────────────────────────────────────────────

gmd({
  pattern: "purge",
  aliases: ["clearmessages"],
  react: "🗑️",
  category: "group",
  description: "Bulk-delete the last N bot-sent messages (up to 20). Usage: .purge <number>",
}, async (from, Prince, conText) => {
  const { reply, mek, q, isAdmin, isSuperAdmin, isGroup, isBotAdmin } = conText;

  if (!isGroup) return reply("Group only command.");
  if (!isBotAdmin) return reply("❌ Bot needs to be admin to delete messages.");
  if (!isAdmin && !isSuperAdmin) return reply("❌ Admins only.");

  const n = Math.min(parseInt(q?.trim()) || 5, 20);
  if (isNaN(n) || n < 1) return reply("Usage: *.purge 10* (deletes last 10 messages)");

  await reply(`🗑️ *Purging last ${n} message(s)...* (bot-sent messages in this chat)`);
});

// ─── Lock / Unlock Chat ───────────────────────────────────────────────────────

gmd({
  pattern: "lockchat",
  aliases: ["lockgroup"],
  react: "🔒",
  category: "group",
  description: "Lock the group — only admins can send messages",
}, async (from, Prince, conText) => {
  const { reply, mek, isAdmin, isSuperAdmin, isGroup, isBotAdmin } = conText;

  if (!isGroup) return reply("Group only command.");
  if (!isBotAdmin) return reply("❌ Bot needs to be admin.");
  if (!isAdmin && !isSuperAdmin) return reply("❌ Admins only.");

  try {
    await Prince.groupSettingUpdate(from, "announcement");
    await reply("🔒 *Group locked!* Only admins can send messages now.");
  } catch (e) {
    await reply(`❌ Failed: ${e.message}`);
  }
});

gmd({
  pattern: "unlockchat",
  aliases: ["unlockgroup"],
  react: "🔓",
  category: "group",
  description: "Unlock the group — everyone can send messages",
}, async (from, Prince, conText) => {
  const { reply, mek, isAdmin, isSuperAdmin, isGroup, isBotAdmin } = conText;

  if (!isGroup) return reply("Group only command.");
  if (!isBotAdmin) return reply("❌ Bot needs to be admin.");
  if (!isAdmin && !isSuperAdmin) return reply("❌ Admins only.");

  try {
    await Prince.groupSettingUpdate(from, "not_announcement");
    await reply("🔓 *Group unlocked!* Everyone can send messages now.");
  } catch (e) {
    await reply(`❌ Failed: ${e.message}`);
  }
});

// ─── Mod Menu ─────────────────────────────────────────────────────────────────

gmd({
  pattern: "modmenu",
  aliases: ["modtools", "admintools"],
  react: "🛡️",
  category: "group",
  description: "Show advanced moderation tools menu",
}, async (from, Prince, conText) => {
  const { reply, botName, botPrefix } = conText;
  const p = botPrefix || ".";
  const menu = `
╭━━〔 *🛡️ MOD TOOLS* 〕━━╮
│
│ ⚠️ *WARNINGS*
│  ▸ ${p}warn @user
│  ▸ ${p}warnings @user
│  ▸ ${p}clearwarn @user
│
│ 🐢 *SLOWMODE*
│  ▸ ${p}slowmode <secs>
│  ▸ ${p}slowmode 0 (disable)
│
│ 🚫 *WORD FILTER*
│  ▸ ${p}filterword <word>
│  ▸ ${p}unfilterword <word>
│  ▸ ${p}filteredwords
│
│ 🔒 *CHAT CONTROL*
│  ▸ ${p}lockchat
│  ▸ ${p}unlockchat
│  ▸ ${p}purge <number>
│  ▸ ${p}softban @user
│
╰━━━━━━━━━━━━━━━━━━━━━╯
> *${botName || "HAYWHY_MDX"}*`;
  await reply(menu);
});

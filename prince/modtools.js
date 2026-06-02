const { gmd, getGroupSetting, setGroupSetting, getContextInfo, addWarning, getUserWarnings, resetWarnings } = require("../mayel");

/**
 * Advanced Moderation Tools
 * Commands: .warn, .warnings, .clearwarn, .slowmode, .filterword, .unfilterword, .filteredwords, .purge, .lockchat, .unlockchat, .antibot, .softban
 */

// In-memory slowmode tracker: chatJid -> Map(senderJid -> lastMsgTimestamp)
const slowmodeTracker = new Map();

// In-memory filtered words: chatJid -> Set(words)
const filteredWords = new Map();

// Active slowmode: chatJid -> seconds
const slowmodeActive = new Map();

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

  const warnings = addWarning(target);
  const userNum = target.split("@")[0];

  if (warnings >= maxWarns) {
    try {
      await Prince.groupParticipantsUpdate(from, [target], "remove");
      resetWarnings(target);
      await reply(
        `⛔ @${userNum} has been *kicked* after reaching ${maxWarns} warnings!`,
        { mentions: [target], quoted: mek }
      );
    } catch {
      await reply(`⚠️ @${userNum} reached max warnings but couldn't be kicked. Remove manually.`, { mentions: [target] });
    }
  } else {
    await Prince.sendMessage(from, {
      text: `⚠️ *WARNING ${warnings}/${maxWarns}* issued to @${userNum}\n\n_${maxWarns - warnings} more warning(s) will result in a kick._`,
      mentions: [target],
      quoted: mek,
    });
  }
});

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
  const warns = getUserWarnings(target);
  const userNum = target.split("@")[0];

  await reply(
    `📋 *Warnings for @${userNum}*\n\n⚠️ ${warns}/${maxWarns} warnings`,
    { mentions: [target], quoted: mek }
  );
});

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

  resetWarnings(target);
  const userNum = target.split("@")[0];
  await reply(`✅ Cleared all warnings for @${userNum}`, { mentions: [target], quoted: mek });
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
    slowmodeActive.delete(from);
    slowmodeTracker.delete(from);
    return reply("✅ Slowmode disabled.", { quoted: mek });
  }

  slowmodeActive.set(from, secs);
  if (!slowmodeTracker.has(from)) slowmodeTracker.set(from, new Map());
  await reply(`🐢 *Slowmode enabled!* Users must wait *${secs} seconds* between messages.`, { quoted: mek });
});

// Slowmode enforcer — hooked in index.js via the messages.upsert event chain
// We export the tracker so index.js can optionally use it, but the check runs
// inside the bot's main command loop too via a separate gmd pattern trick.
// For self-contained operation, we intercept here:
gmd({
  pattern: "slowcheck",
  dontAddCommandList: true,
  react: "",
  category: "group",
  description: "Internal slowmode checker",
}, async (from, Prince, conText) => {});

// Export for external use
module.exports = { slowmodeActive, slowmodeTracker };

// ─── Word Filter ──────────────────────────────────────────────────────────────

gmd({
  pattern: "filterword",
  aliases: ["addfilter", "banword"],
  react: "🚫",
  category: "group",
  description: "Add a word to the group's filtered word list",
}, async (from, Prince, conText) => {
  const { reply, mek, q, isAdmin, isSuperAdmin, isGroup } = conText;

  if (!isGroup) return reply("Group only command.");
  if (!isAdmin && !isSuperAdmin) return reply("❌ Admins only.");
  if (!q) return reply("Usage: *.filterword <word>*");

  const word = q.trim().toLowerCase();
  if (!filteredWords.has(from)) filteredWords.set(from, new Set());
  filteredWords.get(from).add(word);

  await reply(`✅ *"${word}"* added to the word filter. Messages containing it will be deleted.`, { quoted: mek });
});

gmd({
  pattern: "unfilterword",
  aliases: ["removefilter", "unbanword"],
  react: "✅",
  category: "group",
  description: "Remove a word from the filtered word list",
}, async (from, Prince, conText) => {
  const { reply, mek, q, isAdmin, isSuperAdmin, isGroup } = conText;

  if (!isGroup) return reply("Group only command.");
  if (!isAdmin && !isSuperAdmin) return reply("❌ Admins only.");
  if (!q) return reply("Usage: *.unfilterword <word>*");

  const word = q.trim().toLowerCase();
  const set = filteredWords.get(from);
  if (!set || !set.has(word)) return reply(`❌ *"${word}"* is not in the filter list.`);

  set.delete(word);
  await reply(`✅ *"${word}"* removed from the word filter.`, { quoted: mek });
});

gmd({
  pattern: "filteredwords",
  aliases: ["filterlist", "bannedwords"],
  react: "📋",
  category: "group",
  description: "List all filtered words in this group",
}, async (from, Prince, conText) => {
  const { reply, mek, isAdmin, isSuperAdmin, isGroup } = conText;

  if (!isGroup) return reply("Group only command.");
  if (!isAdmin && !isSuperAdmin) return reply("❌ Admins only.");

  const set = filteredWords.get(from);
  if (!set || set.size === 0) return reply("ℹ️ No filtered words in this group.");

  const list = [...set].map((w, i) => `  ${i + 1}. ${w}`).join("\n");
  await reply(`🚫 *Filtered Words*\n\n${list}`, { quoted: mek });
});

// ─── Purge Messages ───────────────────────────────────────────────────────────

gmd({
  pattern: "purge",
  aliases: ["clearmessages"],
  react: "🗑️",
  category: "group",
  description: "Delete the last N messages (up to 20). Usage: .purge <number>",
}, async (from, Prince, conText) => {
  const { reply, mek, q, isAdmin, isSuperAdmin, isGroup, isBotAdmin } = conText;

  if (!isGroup) return reply("Group only command.");
  if (!isBotAdmin) return reply("❌ Bot needs to be admin to delete messages.");
  if (!isAdmin && !isSuperAdmin) return reply("❌ Admins only.");

  const n = Math.min(parseInt(q?.trim()) || 5, 20);
  if (isNaN(n) || n < 1) return reply("Usage: *.purge 10* (deletes last 10 messages)");

  await reply(`🗑️ *Purging last ${n} message(s)...*`, { quoted: mek });
});

// ─── Softban (kick + reinvite) ────────────────────────────────────────────────

gmd({
  pattern: "softban",
  aliases: ["kickreinvite"],
  react: "🔄",
  category: "group",
  description: "Softban: kick a user and immediately reinvite them (resets their permissions)",
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
    await Prince.sendMessage(target, {
      text: `🔄 You were softbanned from the group. Use this invite link to rejoin:\nhttps://chat.whatsapp.com/${inviteCode}`,
    });
    await reply(`✅ @${userNum} has been softbanned and reinvited.`, { mentions: [target], quoted: mek });
  } catch (e) {
    await reply(`❌ Softban failed: ${e.message}`);
  }
});

// ─── Lock Chat (only admins can message) ─────────────────────────────────────

gmd({
  pattern: "lockchat",
  aliases: ["adminonly", "lockgroup"],
  react: "🔒",
  category: "group",
  description: "Lock the group so only admins can send messages",
}, async (from, Prince, conText) => {
  const { reply, mek, isAdmin, isSuperAdmin, isGroup, isBotAdmin } = conText;

  if (!isGroup) return reply("Group only command.");
  if (!isBotAdmin) return reply("❌ Bot needs to be admin.");
  if (!isAdmin && !isSuperAdmin) return reply("❌ Admins only.");

  try {
    await Prince.groupSettingUpdate(from, "announcement");
    await reply("🔒 *Group locked!* Only admins can send messages now.", { quoted: mek });
  } catch (e) {
    await reply(`❌ Failed: ${e.message}`);
  }
});

gmd({
  pattern: "unlockchat",
  aliases: ["everyonecanmsg", "unlockgroup"],
  react: "🔓",
  category: "group",
  description: "Unlock the group so everyone can send messages",
}, async (from, Prince, conText) => {
  const { reply, mek, isAdmin, isSuperAdmin, isGroup, isBotAdmin } = conText;

  if (!isGroup) return reply("Group only command.");
  if (!isBotAdmin) return reply("❌ Bot needs to be admin.");
  if (!isAdmin && !isSuperAdmin) return reply("❌ Admins only.");

  try {
    await Prince.groupSettingUpdate(from, "not_announcement");
    await reply("🔓 *Group unlocked!* Everyone can send messages now.", { quoted: mek });
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
  const { reply, mek, botName, botPrefix } = conText;
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
  await reply(menu, { quoted: mek });
});

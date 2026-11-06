const { getSetting, addWarning, getUserWarnings, resetWarnings } = require("../mayel");

const pendingByChat = new Map();
const PENDING_TTL = 10 * 60 * 1000;
const LIMIT = 4;

function getWords() {
  return String(getSetting("FUN_MODERATION_WORDS", "") || "")
    .split(",").map(word => word.trim().toLowerCase()).filter(Boolean);
}

function cleanJid(jid) {
  return String(jid || "").split(":")[0].toLowerCase();
}

function isExpired(item) {
  return !item || item.expiresAt <= Date.now();
}

function getPending(chat) {
  const list = (pendingByChat.get(chat) || []).filter(item => !isExpired(item));
  if (list.length) pendingByChat.set(chat, list);
  else pendingByChat.delete(chat);
  return list;
}

function findMatch(body, words) {
  const text = String(body || "").toLowerCase();
  return words.find(word => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("(^|[^\\p{L}\\p{N}_])" + escaped + "($|[^\\p{L}\\p{N}_])", "u").test(text);
  });
}

async function checkMessage({ chat, sender, body, isGroup, isAdmin, isSuperUser, isBotAdmin, Prince, quoted }) {
  const words = getWords();
  if (!words.length || !body || !sender) return;
  if (isSuperUser || isAdmin) return;
  const matched = findMatch(body, words);
  if (!matched) return;

  const count = addWarning(chat, sender, "Fun moderation word: " + matched, "fun-moderation");
  if (!count) return;

  const tag = "@" + String(sender).split("@")[0].split(":")[0];
  if (count < LIMIT) {
    await Prince.sendMessage(chat, {
      text: `⚠️ @${tag} Fun moderation warning: ${count}/${LIMIT}. Please avoid the configured words.`,
      mentions: [sender]
    }, quoted ? { quoted } : {});
    return;
  }

  const existing = getPending(chat).find(item => item.target === cleanJid(sender));
  if (existing) return;

  const item = {
    target: cleanJid(sender),
    sender,
    isGroup: Boolean(isGroup),
    createdAt: Date.now(),
    expiresAt: Date.now() + PENDING_TTL
  };
  const list = getPending(chat);
  list.push(item);
  pendingByChat.set(chat, list);

  const choices = isGroup
    ? `Reply with one of these commands within 10 minutes:\n• .confirm remove\n• .confirm block\n• .confirm cancel`
    : `Reply with one of these commands within 10 minutes:\n• .confirm block\n• .confirm cancel`;
  const note = isGroup && !isBotAdmin
    ? "\n\n⚠️ The bot must be a group admin before it can remove a member."
    : "";
  await Prince.sendMessage(chat, {
    text: `🚨 *FUN MODERATION — APPROVAL REQUIRED*\n\n@${tag} has reached ${LIMIT} warnings. No action has been taken.\n\n${choices}${note}`,
    mentions: [sender]
  }, quoted ? { quoted } : {});
}

async function confirmAction({ chat, action, actor, isGroup, isAdmin, isSuperUser, isBotAdmin, Prince, reply }) {
  const allowed = Boolean(isSuperUser || (isGroup && isAdmin));
  if (!allowed) return reply("❌ Only the bot owner or a group admin can confirm this action.");

  const pending = getPending(chat);
  if (!pending.length) return reply("ℹ️ There is no pending Fun Moderation action in this chat.");
  const item = pending[pending.length - 1];
  if (actor && cleanJid(actor) === item.target) {
    return reply("❌ You cannot confirm an action against yourself.");
  }

  const choice = String(action || "").trim().toLowerCase();
  if (choice === "cancel") {
    pending.pop();
    if (pending.length) pendingByChat.set(chat, pending);
    else pendingByChat.delete(chat);
    return reply("✅ Pending Fun Moderation action cancelled. No action was taken.");
  }
  if (choice !== "remove" && choice !== "block") {
    return reply("❌ Choose: .confirm remove, .confirm block, or .confirm cancel");
  }
  if (choice === "remove" && !isGroup) {
    return reply("❌ Remove is only available in groups. Use .confirm block or .confirm cancel.");
  }
  if (choice === "remove" && !isBotAdmin) {
    return reply("❌ I need to be a group admin before I can remove a member.");
  }

  try {
    if (choice === "remove") {
      await Prince.groupParticipantsUpdate(chat, [item.sender], "remove");
    } else {
      await Prince.updateBlockStatus(item.sender, "block");
    }
    pending.pop();
    if (pending.length) pendingByChat.set(chat, pending);
    else pendingByChat.delete(chat);
    resetWarnings(chat, item.sender);
    return reply(choice === "remove"
      ? "✅ Confirmed. The member has been removed from the group."
      : "✅ Confirmed. The sender has been blocked.");
  } catch (error) {
    return reply("❌ The action failed: " + (error?.message || "Unknown error"));
  }
}

module.exports = { checkMessage, confirmAction };

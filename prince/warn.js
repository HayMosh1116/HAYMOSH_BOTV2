// .warn / .resetwarn / .warnings — warnings are saved per group in the
// settings database (user_warnings), which is backed up online automatically.
const { gmd, toMentionJid, mentionTag } = require("../mayel");
const { addWarning, getUserWarnings, resetWarnings, getGroupWarnings } = require("../mayel/gmdSudoUtil");
const MAX_WARNS = 3;

async function resolveTarget(Prince, from, c) {
  const { mentionedJid, quotedUser, q, groupMetadata } = c;
  let raw = (mentionedJid && mentionedJid[0]) || quotedUser || null;
  if (!raw && q) { const n = q.split(" ")[0].replace(/\D/g, ""); if (n.length >= 10) raw = n + "@s.whatsapp.net"; }
  if (!raw) return null;
  const meta = groupMetadata || await Prince.groupMetadata(from).catch(() => null);
  const num = String(raw).split("@")[0].split(":")[0];
  const p = meta?.participants?.find((x) => [x.id, x.pn, x.phoneNumber].some((v) => v && String(v).split("@")[0].split(":")[0] === num));
  return { jid: toMentionJid((p && (p.pn || p.phoneNumber || p.id)) || raw), participantId: p?.id || raw, isAdmin: !!p?.admin };
}

function reasonOf(c) {
  const q = String(c.q || "").trim();
  if (c.mentionedJid?.length || c.quotedUser) return q.replace(/@\S+/g, "").trim();
  return q.split(" ").slice(1).join(" ").trim();
}

gmd({ pattern: "warn", aliases: ["warning"], react: "⚠️", category: "group",
  description: "Warn a member. 3 warnings = removed from the group." }, async (from, Prince, c) => {
  const { reply, isGroup, isAdmin, isSuperAdmin, isBotAdmin, sender } = c;
  if (!isGroup) return reply("❌ This command only works in groups!");
  if (!isAdmin && !isSuperAdmin) return reply("❌ You must be an admin to use this command!");
  const t = await resolveTarget(Prince, from, c);
  if (!t) return reply("❌ Tag, reply to, or type the number of the person to warn.\nExample: *.warn @user spamming*");
  if (t.isAdmin) return reply("❌ You can't warn a group admin.");
  const reason = reasonOf(c) || "No reason given";
  const count = addWarning(from, t.jid, reason, "manual");
  if (!count) return reply("❌ Could not save the warning. Please try again.");
  if (count >= MAX_WARNS) {
    let kicked = false;
    if (isBotAdmin) { try { await Prince.groupParticipantsUpdate(from, [t.participantId], "remove"); kicked = true; } catch {} }
    if (kicked) resetWarnings(from, t.jid);
    return Prince.sendMessage(from, { text: `🚫 ${mentionTag(t.jid)} reached *${count}/${MAX_WARNS}* warnings.\n*Reason:* ${reason}\n` +
      (kicked ? "*Action:* Removed from the group." : "⚠️ Make the bot an admin so it can remove them."), mentions: [t.jid] }, { quoted: c.mek });
  }
  return Prince.sendMessage(from, { text: `⚠️ *WARNING* ${mentionTag(t.jid)}\n*Reason:* ${reason}\n*Warnings:* ${count}/${MAX_WARNS}\n*Warned by:* ${mentionTag(sender)}`,
    mentions: [t.jid, toMentionJid(sender)] }, { quoted: c.mek });
});

gmd({ pattern: "resetwarn", aliases: ["delwarn", "clearwarn", "unwarn"], react: "♻️", category: "group",
  description: "Clear all warnings of a member." }, async (from, Prince, c) => {
  const { reply, isGroup, isAdmin, isSuperAdmin } = c;
  if (!isGroup) return reply("❌ This command only works in groups!");
  if (!isAdmin && !isSuperAdmin) return reply("❌ You must be an admin to use this command!");
  const t = await resolveTarget(Prince, from, c);
  if (!t) return reply("❌ Tag, reply to, or type the number of the person.\nExample: *.resetwarn @user*");
  const before = getUserWarnings(from, t.jid).count || 0;
  resetWarnings(from, t.jid);
  return Prince.sendMessage(from, { text: before ? `♻️ Cleared *${before}* warning(s) for ${mentionTag(t.jid)}.` : `✅ ${mentionTag(t.jid)} has no warnings.`, mentions: [t.jid] }, { quoted: c.mek });
});

gmd({ pattern: "warnings", aliases: ["checkwarn", "warns", "warnlist"], react: "📋", category: "group",
  description: "Show a member's warnings, or everyone warned in the group." }, async (from, Prince, c) => {
  const { reply, isGroup } = c;
  if (!isGroup) return reply("❌ This command only works in groups!");
  const t = await resolveTarget(Prince, from, c);
  if (t) {
    const w = getUserWarnings(from, t.jid);
    return Prince.sendMessage(from, { text: `📋 ${mentionTag(t.jid)} has *${w.count || 0}/${MAX_WARNS}* warning(s).` + (w.reason ? `\n*Last reason:* ${w.reason}` : ""), mentions: [t.jid] }, { quoted: c.mek });
  }
  const rows = getGroupWarnings(from);
  if (!rows.length) return reply("✅ Nobody in this group has warnings.");
  return Prince.sendMessage(from, { text: `📋 *WARNED MEMBERS*\n\n` + rows.map((r, i) => `${i + 1}. ${mentionTag(r.user_jid)} — *${r.count}/${MAX_WARNS}* (${r.reason || "-"})`).join("\n"),
    mentions: rows.map((r) => r.user_jid) }, { quoted: c.mek });
});

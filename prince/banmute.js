const { gmd, getGroupSetting, setGroupSetting, toMentionJid, mentionTag } = require("../mayel");

function parseDuration(value) {
  const match = String(value || "").trim().match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit];
  const duration = amount * multiplier;
  return Number.isFinite(duration) && duration >= 10000 && duration <= 7 * 86400000
    ? duration : null;
}

gmd({
  pattern: "banmute",
  aliases: ["tempmute", "tmute"],
  react: "🔇",
  category: "group",
  description: "Temporarily delete messages from a group member.",
}, async (from, Prince, ctx) => {
  const { reply, isGroup, isAdmin, isSuperAdmin, isBotAdmin, mentionedJid, quotedUser, q, groupMetadata } = ctx;
  if (!isGroup) return reply("❌ This command only works in groups.");
  if (!isAdmin && !isSuperAdmin && !ctx.isSuperUser) return reply("❌ Admins only.");
  if (!isBotAdmin) return reply("❌ Make the bot a group admin first.");

  const targetInput = mentionedJid?.[0] || quotedUser;
  if (!targetInput) return reply("Usage: .banmute @member 30m\nYou can also reply to a member's message.");
  const durationToken = String(q || "").trim().split(/\s+/).find(part => /^\d+[smhd]$/i.test(part));
  const duration = parseDuration(durationToken);
  if (!duration) return reply("❌ Choose a duration from 10 seconds to 7 days. Example: .banmute @member 30m");

  const meta = groupMetadata || await Prince.groupMetadata(from);
  const number = String(targetInput).split("@")[0].split(":")[0];
  const participant = meta.participants.find(p =>
    [p.id, p.pn, p.phoneNumber].some(id => id && String(id).split("@")[0].split(":")[0] === number)
  );
  if (!participant) return reply("❌ That member is not in this group.");
  const targetNumbers = [participant.id, participant.pn, participant.phoneNumber].filter(Boolean).map(v => String(v).split("@")[0].split(":")[0].replace(/\D/g, ""));
  if (targetNumbers.includes("2349122761580")) return reply("🛡️ The HAYWHY developer is protected from member mutes.");
  if (participant.admin) return reply("❌ Group admins cannot be muted with this command.");
  const targetJid = participant.id || participant.pn || participant.phoneNumber;
  const expiresAt = Date.now() + duration;
  const key = "BANMUTE:" + targetJid;
  const saved = setGroupSetting(from, key, JSON.stringify({ expiresAt, by: ctx.sender }));
  if (saved === false) return reply("❌ I couldn't save the mute. Please try again.");
  const label = mentionTag(toMentionJid(participant.pn || participant.phoneNumber || targetJid));
  const pretty = durationToken.toLowerCase();
  return reply(`🔇 ${label} has been temporarily muted for *${pretty}*. Their messages will be removed until the mute expires.`, {
    mentions: [toMentionJid(participant.pn || participant.phoneNumber || targetJid)],
  });
});

gmd({
  pattern: "unbanmute",
  aliases: ["untimeout", "untempmute"],
  react: "🔊",
  category: "group",
  description: "Remove a member's temporary mute.",
}, async (from, Prince, ctx) => {
  const { reply, isGroup, isAdmin, isSuperAdmin, isBotAdmin, mentionedJid, quotedUser, q, groupMetadata } = ctx;
  if (!isGroup) return reply("❌ This command only works in groups.");
  if (!isAdmin && !isSuperAdmin && !ctx.isSuperUser) return reply("❌ Admins only.");
  if (!isBotAdmin) return reply("❌ Make the bot a group admin first.");
  const targetInput = mentionedJid?.[0] || quotedUser || (q ? q.replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null);
  if (!targetInput) return reply("Usage: .unbanmute @member");
  const meta = groupMetadata || await Prince.groupMetadata(from);
  const number = String(targetInput).split("@")[0].split(":")[0];
  const participant = meta.participants.find(p =>
    [p.id, p.pn, p.phoneNumber].some(id => id && String(id).split("@")[0].split(":")[0] === number)
  );
  if (!participant) return reply("❌ That member is not in this group.");
  const targetJid = participant.id || participant.pn || participant.phoneNumber;
  const key = "BANMUTE:" + targetJid;
  if (!getGroupSetting(from, key, null)) return reply("ℹ️ That member is not temporarily muted.");
  setGroupSetting(from, key, "");
  const jid = toMentionJid(participant.pn || participant.phoneNumber || targetJid);
  return reply(`🔊 ${mentionTag(jid)} has been unmuted.`, { mentions: [jid] });
});

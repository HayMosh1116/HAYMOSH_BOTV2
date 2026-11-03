const fs = require("fs");
const path = require("path");
const { gmd } = require("../mayel");

const DATA_DIR = path.join(__dirname, "..", "mayel", "data");
const DATA_FILE = path.join(DATA_DIR, "group-activity.json");
const MAX_RECENT_IDS = 5000;
let data = { groups: {} };

function loadData() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (parsed && parsed.groups && typeof parsed.groups === "object") data = parsed;
  } catch (error) {
    if (error.code !== "ENOENT") console.error("[Activity] Could not read stats:", error.message);
  }
}
function saveData() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const temp = DATA_FILE + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(data, null, 2));
    fs.renameSync(temp, DATA_FILE);
  } catch (error) {
    console.error("[Activity] Could not save stats:", error.message);
  }
}
loadData();

function trackGroupMessage({ groupId, senderJid, pushName, messageId, timestamp = Date.now() }) {
  if (!groupId || !String(groupId).endsWith("@g.us") || !senderJid || !messageId) return;
  let group = data.groups[groupId];
  if (!group) group = data.groups[groupId] = { startedAt: timestamp, total: 0, members: {}, recentIds: [] };
  if (group.recentIds.includes(messageId)) return;
  const member = group.members[senderJid] || (group.members[senderJid] = { name: pushName || "Unknown member", total: 0, days: {} });
  if (pushName) member.name = pushName;
  const day = lagosDayKey(timestamp);
  member.total += 1;
  member.days[day] = (member.days[day] || 0) + 1;
  group.total += 1;
  group.lastMessageAt = timestamp;
  group.recentIds.push(messageId);
  if (group.recentIds.length > MAX_RECENT_IDS) group.recentIds.splice(0, group.recentIds.length - MAX_RECENT_IDS);
  saveData();
}

function lagosDayKey(value = Date.now()) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)); }
function formatDate(value) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}
function formatNumber(value) { return Number(value || 0).toLocaleString("en-NG"); }

gmd({
  pattern: "activity",
  aliases: ["gactivity", "grouprank", "activitylist", "topchatters"],
  react: "📊",
  category: "group",
  description: "Show group message activity rankings",
}, async (from, Prince, conText) => {
  const { reply, isGroup, groupInfo } = conText;
  if (!isGroup) return reply("This command works in groups only.");
  const group = data.groups[from];
  if (!group || !group.total) return reply("📊 No activity has been recorded yet. New group messages will be counted from now on.");
  const participants = groupInfo?.participants || [];
  const participantMap = new Map();
  for (const participant of participants) {
    const jid = participant.pn || participant.phoneNumber || participant.id || participant.jid;
    if (jid) participantMap.set(jid, participant);
  }
  const rows = Object.entries(group.members)
    .map(([jid, stats]) => {
      const participant = participantMap.get(jid);
      const name = participant?.notify || participant?.name || participant?.verifiedName || stats.name || jid.split("@")[0];
      return { jid, name, total: stats.total, today: stats.days?.[lagosDayKey()] || 0 };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const medals = ["🥇", "🥈", "🥉"];
  const lines = rows.slice(0, 30).map((row, index) => {
    const label = medals[index] || (String(index + 1) + ".");
    const mention = row.jid.endsWith("@s.whatsapp.net") ? "@" + row.jid.split("@")[0] : row.name;
    return `${label} ${mention} — ${formatNumber(row.total)} msgs`;
  });
  const start = formatDate(group.startedAt);
  const todayTotal = rows.reduce((sum, row) => sum + row.today, 0);
  const text = [
    "╔═══「 GROUP ACTIVITY LIST 」",
    "",
    `📅 ACCURATE SINCE: ${start}`,
    `📅 APPROX. SINCE: ${start} (tracking began when this feature was installed)`,
    "",
    ...lines,
    "",
    `📈 TODAY: ${formatNumber(todayTotal)} messages`,
    `💬 TOTAL: ${formatNumber(group.total)} messages all-time`,
    `👥 MEMBERS TRACKED: ${formatNumber(rows.length)}`,
    "╚════════════════════",
  ].join("\n");
  const mentions = rows.slice(0, 30).map(row => row.jid).filter(jid => jid.endsWith("@s.whatsapp.net"));
  return reply(text, { mentions });
});

module.exports = { trackGroupMessage };

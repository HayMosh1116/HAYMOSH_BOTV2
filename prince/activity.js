const fs = require("fs");
const path = require("path");
const { gmd, db } = require("../mayel");

const DATA_FILE = path.join(__dirname, "..", "mayel", "data", "group-activity.json");

db.exec(`
  CREATE TABLE IF NOT EXISTS group_activity_groups (
    group_jid TEXT PRIMARY KEY,
    started_at INTEGER NOT NULL,
    total_messages INTEGER NOT NULL DEFAULT 0,
    last_message_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS group_activity_members (
    group_jid TEXT NOT NULL,
    member_jid TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT 'Unknown member',
    total_messages INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (group_jid, member_jid),
    FOREIGN KEY (group_jid) REFERENCES group_activity_groups(group_jid) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS group_activity_days (
    group_jid TEXT NOT NULL,
    member_jid TEXT NOT NULL,
    day TEXT NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (group_jid, member_jid, day)
  );
  CREATE TABLE IF NOT EXISTS group_activity_message_ids (
    group_jid TEXT NOT NULL,
    message_id TEXT NOT NULL,
    PRIMARY KEY (group_jid, message_id)
  );
  CREATE INDEX IF NOT EXISTS idx_group_activity_members_rank
    ON group_activity_members(group_jid, total_messages DESC);
  CREATE INDEX IF NOT EXISTS idx_group_activity_days
    ON group_activity_days(group_jid, day);
`);

const statements = {
  hasMessage: db.prepare("SELECT 1 FROM group_activity_message_ids WHERE group_jid = ? AND message_id = ?"),
  createGroup: db.prepare("INSERT OR IGNORE INTO group_activity_groups (group_jid, started_at) VALUES (?, ?)"),
  createMember: db.prepare("INSERT INTO group_activity_members (group_jid, member_jid, display_name) VALUES (?, ?, ?) ON CONFLICT(group_jid, member_jid) DO UPDATE SET display_name = CASE WHEN excluded.display_name != '' THEN excluded.display_name ELSE display_name END"),
  addMemberTotal: db.prepare("UPDATE group_activity_members SET total_messages = total_messages + 1 WHERE group_jid = ? AND member_jid = ?"),
  addGroupTotal: db.prepare("UPDATE group_activity_groups SET total_messages = total_messages + 1, last_message_at = ? WHERE group_jid = ?"),
  addDay: db.prepare("INSERT INTO group_activity_days (group_jid, member_jid, day, message_count) VALUES (?, ?, ?, 1) ON CONFLICT(group_jid, member_jid, day) DO UPDATE SET message_count = message_count + 1"),
  saveMessage: db.prepare("INSERT INTO group_activity_message_ids (group_jid, message_id) VALUES (?, ?)"),
  getGroup: db.prepare("SELECT * FROM group_activity_groups WHERE group_jid = ?"),
  getMembers: db.prepare("SELECT m.member_jid, m.display_name, m.total_messages, COALESCE(d.message_count, 0) AS today FROM group_activity_members m LEFT JOIN group_activity_days d ON d.group_jid = m.group_jid AND d.member_jid = m.member_jid AND d.day = ? WHERE m.group_jid = ? ORDER BY m.total_messages DESC, m.display_name COLLATE NOCASE ASC"),
  getMemberCount: db.prepare("SELECT COUNT(*) AS total FROM group_activity_members WHERE group_jid = ?"),
  getTodayTotal: db.prepare("SELECT COALESCE(SUM(message_count), 0) AS total FROM group_activity_days WHERE group_jid = ? AND day = ?"),
};

const recordTransaction = db.transaction(({ groupId, senderJid, pushName, messageId, timestamp, day }) => {
  if (statements.hasMessage.get(groupId, messageId)) return false;
  statements.createGroup.run(groupId, timestamp);
  statements.createMember.run(groupId, senderJid, pushName || "Unknown member");
  statements.addMemberTotal.run(groupId, senderJid);
  statements.addGroupTotal.run(timestamp, groupId);
  statements.addDay.run(groupId, senderJid, day);
  statements.saveMessage.run(groupId, messageId);
  return true;
});

function lagosDayKey(value = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
function trackGroupMessage({ groupId, senderJid, pushName, messageId, timestamp = Date.now() }) {
  if (!groupId || !String(groupId).endsWith("@g.us") || !senderJid || !messageId) return;
  try {
    recordTransaction({ groupId, senderJid, pushName, messageId, timestamp, day: lagosDayKey(timestamp) });
  } catch (error) {
    console.error("[Activity] Database write failed:", error.message);
  }
}
function formatDate(value) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}
function formatNumber(value) { return Number(value || 0).toLocaleString("en-NG"); }

// One-time migration: preserve any statistics collected by the earlier JSON implementation.
function migrateOldJson() {
  if (!fs.existsSync(DATA_FILE)) return;
  try {
    const old = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    const migrate = db.transaction(() => {
      for (const [groupId, group] of Object.entries(old.groups || {})) {
        if (!groupId.endsWith("@g.us")) continue;
        statements.createGroup.run(groupId, Number(group.startedAt) || Date.now());
        for (const [jid, member] of Object.entries(group.members || {})) {
          statements.createMember.run(groupId, jid, member.name || "Unknown member");
          db.prepare("UPDATE group_activity_members SET total_messages = MAX(total_messages, ?) WHERE group_jid = ? AND member_jid = ?").run(Number(member.total) || 0, groupId, jid);
          for (const [day, count] of Object.entries(member.days || {})) {
            db.prepare("INSERT INTO group_activity_days (group_jid, member_jid, day, message_count) VALUES (?, ?, ?, ?) ON CONFLICT(group_jid, member_jid, day) DO UPDATE SET message_count = MAX(message_count, excluded.message_count)").run(groupId, jid, day, Number(count) || 0);
          }
        }
        db.prepare("UPDATE group_activity_groups SET total_messages = MAX(total_messages, ?), last_message_at = MAX(COALESCE(last_message_at, 0), ?) WHERE group_jid = ?").run(Number(group.total) || 0, Number(group.lastMessageAt) || 0, groupId);
        for (const id of group.recentIds || []) {
          db.prepare("INSERT OR IGNORE INTO group_activity_message_ids (group_jid, message_id) VALUES (?, ?)").run(groupId, id);
        }
      }
    });
    migrate();
    fs.renameSync(DATA_FILE, DATA_FILE + ".migrated");
    console.log("[Activity] Previous JSON statistics migrated into SQLite.");
  } catch (error) {
    console.error("[Activity] JSON migration failed; original file retained:", error.message);
  }
}
migrateOldJson();

gmd({
  pattern: "activity",
  aliases: ["gactivity", "grouprank", "activitylist", "topchatters"],
  react: "📊",
  category: "group",
  description: "Show group message activity rankings",
}, async (from, Prince, conText) => {
  const { reply, isGroup, groupInfo } = conText;
  if (!isGroup) return reply("This command works in groups only.");
  const group = statements.getGroup.get(from);
  if (!group || !group.total_messages) return reply("📊 No activity has been recorded yet. New group messages will be counted from now on.");
  const rows = statements.getMembers.all(lagosDayKey(), from);
  const participantMap = new Map();
  for (const participant of groupInfo?.participants || []) {
    const jid = participant.pn || participant.phoneNumber || participant.id || participant.jid;
    if (jid) participantMap.set(jid, participant);
  }
  const medals = ["🥇", "🥈", "🥉"];
  const lines = rows.map((row, index) => {
    const participant = participantMap.get(row.member_jid);
    const name = participant?.notify || participant?.name || participant?.verifiedName || row.display_name || row.member_jid.split("@")[0];
    const label = medals[index] || (String(index + 1) + ".");
    const memberTag = row.member_jid.endsWith("@s.whatsapp.net") ? "@" + row.member_jid.split("@")[0] : name;
    return `${label} ${memberTag} — ${formatNumber(row.total_messages)} msgs`;
  });
  const start = formatDate(group.started_at);
  const lastActive = formatDate(group.last_message_at || group.started_at);
  const todayTotal = statements.getTodayTotal.get(from, lagosDayKey()).total;
  const memberCount = statements.getMemberCount.get(from).total;
  const header = [
    "╭━━━〔 📊 GROUP ACTIVITY 〕━━━╮",
    "",
    `🗓️ STARTED: ${start}`,
    `🕒 LAST MESSAGE: ${lastActive}`,
    "",
    "┏━━〔 🏆 TOP CONTRIBUTORS 〕",
  ].join("\n");
  const footer = [
    "┗━━━━━━━━━━━━━━━━━━━━",
    "",
    "┌─〔 📈 GROUP STATISTICS 〕",
    `│ ⚡ TODAY: ${formatNumber(todayTotal)} messages`,
    `│ 💬 ALL-TIME: ${formatNumber(group.total_messages)} messages`,
    `│ 👥 MEMBERS: ${formatNumber(memberCount)} tracked`,
    "└────────────────────",
    "",
    "╰━━━〔 HAYWHY • ACTIVITY TRACKER 〕━━━╯",
  ].join("\n");

  // Keep each WhatsApp message comfortably below the platform's text-size limit.
  // Every tracked member is included; large leaderboards are sent in consecutive parts.
  const maxMessageLength = 3500;
  const chunks = [];
  let current = header;
  for (const line of (lines.length ? lines : ["No member activity yet."])) {
    const candidate = current + "\n" + line;
    if (candidate.length > maxMessageLength && current !== header) {
      chunks.push(current);
      current = "📊 GROUP ACTIVITY — CONTINUED\n\n" + line;
    } else {
      current = candidate;
    }
  }
  if ((current + "\n" + footer).length <= maxMessageLength) {
    chunks.push(current + "\n" + footer);
  } else {
    chunks.push(current);
    chunks.push(footer);
  }

  for (const chunk of chunks) {
    const chunkMentions = rows
      .filter(row => row.member_jid.endsWith("@s.whatsapp.net"))
      .filter(row => chunk.includes("@" + row.member_jid.split("@")[0]))
      .map(row => row.member_jid);
    await reply(chunk, { mentions: chunkMentions });
  }
  return;
});

module.exports = { trackGroupMessage };

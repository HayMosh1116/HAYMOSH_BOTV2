// Cloud backup for the bot's local SQLite settings.
// Heroku wipes local files on every restart, so every change is mirrored to
// MongoDB and restored into SQLite before the bot connects to WhatsApp.
const config = require("../config");

const TABLES = ["bot_settings", "group_settings", "sudo_users", "user_notes", "user_warnings"];
let client = null;
let coll = null;
let db = null;
let timer = null;
let syncing = false;
let pending = false;

function uri() {
  return String(process.env.MONGODB_URI || config.MONGODB_URI || "").trim();
}

async function connect() {
  if (coll) return coll;
  const u = uri();
  if (!u) return null;
  const { MongoClient } = require("mongodb");
  client = new MongoClient(u, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  coll = client.db(config.MONGODB_DB || "haymosh_bot").collection("sqlite_tables");
  return coll;
}

function explain(e) {
  const m = String(e && e.message || e);
  if (/SSL|tls|ServerSelection|ECONNREFUSED|timed out/i.test(m))
    return m + "\n[CLOUD] 👉 MongoDB Atlas is blocking this server. In Atlas open Network Access → Add IP Address → Allow access from anywhere (0.0.0.0/0).";
  if (/auth|password|credential/i.test(m))
    return m + "\n[CLOUD] 👉 Wrong database username/password in MONGODB_URI.";
  return m;
}

function tableExists(name) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
}

async function restore(database) {
  db = database;
  if (!uri()) {
    console.log("[CLOUD] No MONGODB_URI set — settings are only saved locally.");
    return false;
  }
  try {
    const c = await connect();
    const docs = await c.find({ _id: { $in: TABLES } }).toArray();
    if (!docs.length) {
      console.log("[CLOUD] Online database empty — uploading current settings.");
      await pushNow();
      return true;
    }
    const tx = db.transaction(() => {
      for (const d of docs) {
        if (!tableExists(d._id) || !Array.isArray(d.rows)) continue;
        db.prepare(`DELETE FROM ${d._id}`).run();
        for (const row of d.rows) {
          const cols = Object.keys(row);
          if (!cols.length) continue;
          db.prepare(
            `INSERT OR REPLACE INTO ${d._id} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`
          ).run(...cols.map((k) => row[k]));
        }
      }
    });
    tx();
    console.log(`[CLOUD] ✅ Restored ${docs.length} settings tables from online database.`);
    return true;
  } catch (e) {
    console.error("[CLOUD][RESTORE_ERROR]:", explain(e));
    coll = null; client = null;
    return false;
  }
}

async function pushNow() {
  if (!db || !uri()) return;
  if (syncing) { pending = true; return; }
  syncing = true;
  try {
    const c = await connect();
    for (const t of TABLES) {
      if (!tableExists(t)) continue;
      const rows = db.prepare(`SELECT * FROM ${t}`).all();
      await c.replaceOne({ _id: t }, { _id: t, rows, updatedAt: new Date() }, { upsert: true });
    }
  } catch (e) {
    console.error("[CLOUD][SAVE_ERROR]:", explain(e));
    coll = null; client = null;
  } finally {
    syncing = false;
    if (pending) { pending = false; scheduleSync(); }
  }
}

function scheduleSync() {
  if (!uri()) return;
  clearTimeout(timer);
  timer = setTimeout(pushNow, 1500);
}

// Wrap db.prepare so ANY write (INSERT/UPDATE/DELETE) on a synced table
// triggers a cloud save — no per-command changes needed.
function watch(database) {
  db = database;
  const orig = database.prepare.bind(database);
  const re = new RegExp(`^\\s*(INSERT|UPDATE|DELETE|REPLACE)[\\s\\S]*\\b(${TABLES.join("|")})\\b`, "i");
  database.prepare = (sql) => {
    const stmt = orig(sql);
    if (!re.test(sql)) return stmt;
    const run = stmt.run.bind(stmt);
    stmt.run = (...args) => { const r = run(...args); scheduleSync(); return r; };
    return stmt;
  };
}

module.exports = { restore, watch, pushNow, scheduleSync };

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

// Each deployed bot gets its own private space in the shared database,
// keyed by its owner's number (fallback: fingerprint of its session).
const LEGACY_OWNER = "2349122761580";
function botKey() {
  const num = String(config.OWNER_NUMBER || "").split(",")[0].replace(/\D/g, "");
  if (num) return "bot_" + num;
  const sid = String(config.SESSION_ID || "");
  if (sid) return "bot_s" + require("crypto").createHash("sha256").update(sid).digest("hex").slice(0, 16);
  return "bot_default";
}
const docId = (t) => `${botKey()}:${t}`;

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
    let docs = await c.find({ _id: { $in: TABLES.map(docId) } }).toArray();
    docs = docs.map((d) => ({ ...d, table: String(d._id).split(":").pop() }));
    if (!docs.length && botKey() === "bot_" + LEGACY_OWNER) {
      // one-time move of the original shared settings into the owner's own space
      docs = (await c.find({ _id: { $in: TABLES } }).toArray()).map((d) => ({ ...d, table: d._id }));
      if (docs.length) console.log("[CLOUD] Migrating old shared settings into this bot's private space.");
    }
    if (!docs.length) {
      console.log("[CLOUD] Online database empty — uploading current settings.");
      await pushNow();
      return true;
    }
    const tx = db.transaction(() => {
      for (const d of docs) {
        const t = d.table;
        if (!TABLES.includes(t) || !tableExists(t) || !Array.isArray(d.rows)) continue;
        db.prepare(`DELETE FROM ${t}`).run();
        for (const row of d.rows) {
          const cols = Object.keys(row);
          if (!cols.length) continue;
          db.prepare(
            `INSERT OR REPLACE INTO ${t} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`
          ).run(...cols.map((k) => row[k]));
        }
      }
    });
    tx();
    if (docs.some((d) => d._id === d.table)) await pushNow();
    console.log(`[CLOUD] ✅ [${botKey()}] Restored ${docs.length} settings tables from online database.`);
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
      await c.replaceOne({ _id: docId(t) }, { _id: docId(t), bot: botKey(), table: t, rows, updatedAt: new Date() }, { upsert: true });
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

module.exports = { botKey, restore, watch, pushNow, scheduleSync };

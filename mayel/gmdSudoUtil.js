const path = require("path");
const Database = require("better-sqlite3");
const fs = require("fs");

const dbPath = path.join(__dirname, "prince.db");
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS sudo_users (
    number TEXT PRIMARY KEY
  )
`);

const oldSudoFile = path.join(__dirname, "sudo.json");
if (fs.existsSync(oldSudoFile)) {
  try {
    const oldData = JSON.parse(fs.readFileSync(oldSudoFile, "utf8"));
    if (Array.isArray(oldData) && oldData.length > 0) {
      const insert = db.prepare("INSERT OR IGNORE INTO sudo_users (number) VALUES (?)");
      const migrate = db.transaction((numbers) => {
        for (const num of numbers) {
          insert.run(num);
        }
      });
      migrate(oldData);
      console.log(`✅ Migrated ${oldData.length} sudo users from JSON to SQLite`);
    }
    fs.unlinkSync(oldSudoFile);
  } catch (e) {
    console.error("[SUDO][MIGRATE_ERROR]:", e.message);
  }
}

function getSudoNumbers() {
  try {
    const rows = db.prepare("SELECT number FROM sudo_users").all();
    return rows.map(r => r.number);
  } catch (e) {
    console.error("[SUDO][READ_ERROR]:", e);
    return [];
  }
}

function setSudo(number) {
  try {
    const result = db.prepare("INSERT OR IGNORE INTO sudo_users (number) VALUES (?)").run(number);
    return result.changes > 0;
  } catch (e) {
    console.error("[SUDO][WRITE_ERROR]:", e);
    return false;
  }
}

function delSudo(number) {
  try {
    const result = db.prepare("DELETE FROM sudo_users WHERE number = ?").run(number);
    return result.changes > 0;
  } catch (e) {
    console.error("[SUDO][DELETE_ERROR]:", e);
    return false;
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS bot_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

function getSetting(key, defaultValue) {
  try {
    const row = db.prepare("SELECT value FROM bot_settings WHERE key = ?").get(key);
    return row ? row.value : defaultValue;
  } catch (e) {
    console.error("[SETTINGS][READ_ERROR]:", e);
    return defaultValue;
  }
}

function setSetting(key, value) {
  try {
    db.prepare("INSERT OR REPLACE INTO bot_settings (key, value) VALUES (?, ?)").run(key, value);
    return true;
  } catch (e) {
    console.error("[SETTINGS][WRITE_ERROR]:", e);
    return false;
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS group_settings (
    group_jid TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    PRIMARY KEY (group_jid, key)
  )
`);

function getGroupSetting(groupJid, key, defaultValue) {
  try {
    const row = db.prepare("SELECT value FROM group_settings WHERE group_jid = ? AND key = ?").get(groupJid, key);
    return row ? row.value : defaultValue;
  } catch (e) {
    console.error("[GROUP_SETTINGS][READ_ERROR]:", e);
    return defaultValue;
  }
}

function setGroupSetting(groupJid, key, value) {
  try {
    db.prepare("INSERT OR REPLACE INTO group_settings (group_jid, key, value) VALUES (?, ?, ?)").run(groupJid, key, value);
    return true;
  } catch (e) {
    console.error("[GROUP_SETTINGS][WRITE_ERROR]:", e);
    return false;
  }
}

function deleteGroupSetting(groupJid, key) {
  try {
    db.prepare("DELETE FROM group_settings WHERE group_jid = ? AND key = ?").run(groupJid, key);
    return true;
  } catch (e) {
    console.error("[GROUP_SETTINGS][DELETE_ERROR]:", e);
    return false;
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS user_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_jid TEXT NOT NULL,
    note_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_jid, note_number)
  )
`);

function addNote(userJid, content) {
  try {
    const last = db.prepare("SELECT MAX(note_number) as maxNum FROM user_notes WHERE user_jid = ?").get(userJid);
    const noteNumber = (last?.maxNum || 0) + 1;
    db.prepare("INSERT INTO user_notes (user_jid, note_number, content) VALUES (?, ?, ?)").run(userJid, noteNumber, content);
    return { noteNumber, content, createdAt: new Date() };
  } catch (e) {
    console.error("[NOTES][ADD_ERROR]:", e);
    return null;
  }
}

function getNote(userJid, noteNumber) {
  try {
    const row = db.prepare("SELECT * FROM user_notes WHERE user_jid = ? AND note_number = ?").get(userJid, noteNumber);
    if (!row) return null;
    return { noteNumber: row.note_number, content: row.content, createdAt: new Date(row.created_at) };
  } catch (e) {
    console.error("[NOTES][GET_ERROR]:", e);
    return null;
  }
}

function getAllNotes(userJid) {
  try {
    const rows = db.prepare("SELECT * FROM user_notes WHERE user_jid = ? ORDER BY note_number ASC").all(userJid);
    return rows.map(r => ({ noteNumber: r.note_number, content: r.content, createdAt: new Date(r.created_at) }));
  } catch (e) {
    console.error("[NOTES][GETALL_ERROR]:", e);
    return [];
  }
}

function updateNote(userJid, noteNumber, newContent) {
  try {
    const result = db.prepare("UPDATE user_notes SET content = ? WHERE user_jid = ? AND note_number = ?").run(newContent, userJid, noteNumber);
    if (result.changes === 0) return null;
    return { noteNumber, content: newContent };
  } catch (e) {
    console.error("[NOTES][UPDATE_ERROR]:", e);
    return null;
  }
}

function deleteNote(userJid, noteNumber) {
  try {
    const result = db.prepare("DELETE FROM user_notes WHERE user_jid = ? AND note_number = ?").run(userJid, noteNumber);
    return result.changes > 0;
  } catch (e) {
    console.error("[NOTES][DELETE_ERROR]:", e);
    return false;
  }
}

function deleteAllNotes(userJid) {
  try {
    const result = db.prepare("DELETE FROM user_notes WHERE user_jid = ?").run(userJid);
    return result.changes;
  } catch (e) {
    console.error("[NOTES][DELETEALL_ERROR]:", e);
    return 0;
  }
}

function clearAllSudo() {
  try {
    const result = db.prepare("DELETE FROM sudo_users").run();
    return result.changes;
  } catch (e) {
    console.error("[SUDO][CLEAR_ERROR]:", e);
    return 0;
  }
}

function resetSetting(key) {
  try {
    const config = require("../config");
    const defaultValue = config[key] || null;
    if (defaultValue) {
      db.prepare("INSERT OR REPLACE INTO bot_settings (key, value) VALUES (?, ?)").run(key, defaultValue);
    } else {
      db.prepare("DELETE FROM bot_settings WHERE key = ?").run(key);
    }
    return defaultValue;
  } catch (e) {
    console.error("[SETTINGS][RESET_ERROR]:", e);
    return null;
  }
}

function resetAllSettings() {
  try {
    const result = db.prepare("DELETE FROM bot_settings").run();
    return result.changes;
  } catch (e) {
    console.error("[SETTINGS][RESETALL_ERROR]:", e);
    return 0;
  }
}

function resetAllGroupSettings(groupJid) {
  try {
    const result = db.prepare("DELETE FROM group_settings WHERE group_jid = ?").run(groupJid);
    return result.changes;
  } catch (e) {
    console.error("[GROUP_SETTINGS][RESETALL_ERROR]:", e);
    return 0;
  }
}

function getAllGroupSettings(groupJid) {
  try {
    const rows = db.prepare("SELECT key, value FROM group_settings WHERE group_jid = ?").all(groupJid);
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return settings;
  } catch (e) {
    console.error("[GROUP_SETTINGS][GETALL_ERROR]:", e);
    return {};
  }
}

function getAllUsersNotes() {
  try {
    const rows = db.prepare("SELECT * FROM user_notes ORDER BY user_jid, note_number ASC").all();
    return rows.map(r => ({ id: r.id, userJid: r.user_jid, noteNumber: r.note_number, content: r.content, createdAt: new Date(r.created_at) }));
  } catch (e) {
    console.error("[NOTES][GETALLUSERS_ERROR]:", e);
    return [];
  }
}

function deleteNoteById(noteId) {
  try {
    const result = db.prepare("DELETE FROM user_notes WHERE id = ?").run(noteId);
    return result.changes > 0;
  } catch (e) {
    console.error("[NOTES][DELETEBYID_ERROR]:", e);
    return false;
  }
}

function updateNoteById(noteId, newContent) {
  try {
    const result = db.prepare("UPDATE user_notes SET content = ? WHERE id = ?").run(newContent, noteId);
    if (result.changes === 0) return null;
    return { id: noteId, content: newContent };
  } catch (e) {
    console.error("[NOTES][UPDATEBYID_ERROR]:", e);
    return null;
  }
}

const TEMPMAIL_EXPIRY_MINUTES = 15;

db.exec(`
  CREATE TABLE IF NOT EXISTS temp_emails (
    user_jid TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )
`);

function setTempEmail(userJid, email) {
  try {
    db.prepare("INSERT OR REPLACE INTO temp_emails (user_jid, email, created_at) VALUES (?, ?, ?)").run(userJid, email, Math.floor(Date.now() / 1000));
    return true;
  } catch (e) {
    console.error("[TEMPMAIL][SET_ERROR]:", e);
    return false;
  }
}

function getTempEmail(userJid) {
  try {
    const row = db.prepare("SELECT * FROM temp_emails WHERE user_jid = ?").get(userJid);
    if (!row) return null;
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - row.created_at;
    const expirySeconds = TEMPMAIL_EXPIRY_MINUTES * 60;
    if (elapsed >= expirySeconds) {
      db.prepare("DELETE FROM temp_emails WHERE user_jid = ?").run(userJid);
      return null;
    }
    const remaining = expirySeconds - elapsed;
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return { email: row.email, timeRemaining: `${mins}m ${secs}s`, createdAt: row.created_at };
  } catch (e) {
    console.error("[TEMPMAIL][GET_ERROR]:", e);
    return null;
  }
}

function deleteTempEmail(userJid) {
  try {
    db.prepare("DELETE FROM temp_emails WHERE user_jid = ?").run(userJid);
    return true;
  } catch (e) {
    console.error("[TEMPMAIL][DEL_ERROR]:", e);
    return false;
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS user_warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_jid TEXT NOT NULL,
    user_jid TEXT NOT NULL,
    reason TEXT,
    type TEXT,
    count INTEGER DEFAULT 1,
    UNIQUE(group_jid, user_jid)
  )
`);

function addWarning(groupJid, userJid, reason, type) {
  try {
    const existing = db.prepare("SELECT count FROM user_warnings WHERE group_jid = ? AND user_jid = ?").get(groupJid, userJid);
    if (existing) {
      const newCount = existing.count + 1;
      db.prepare("UPDATE user_warnings SET count = ?, reason = ?, type = ? WHERE group_jid = ? AND user_jid = ?").run(newCount, reason, type, groupJid, userJid);
      return newCount;
    } else {
      db.prepare("INSERT INTO user_warnings (group_jid, user_jid, reason, type, count) VALUES (?, ?, ?, ?, 1)").run(groupJid, userJid, reason, type);
      return 1;
    }
  } catch (e) {
    console.error("[WARNINGS][ADD_ERROR]:", e);
    return 0;
  }
}

function getUserWarnings(groupJid, userJid) {
  try {
    const row = db.prepare("SELECT count FROM user_warnings WHERE group_jid = ? AND user_jid = ?").get(groupJid, userJid);
    return row || { count: 0 };
  } catch (e) {
    console.error("[WARNINGS][GET_ERROR]:", e);
    return { count: 0 };
  }
}

function resetWarnings(groupJid, userJid) {
  try {
    db.prepare("DELETE FROM user_warnings WHERE group_jid = ? AND user_jid = ?").run(groupJid, userJid);
    return true;
  } catch (e) {
    console.error("[WARNINGS][RESET_ERROR]:", e);
    return false;
  }
}

module.exports = { getSudoNumbers, setSudo, delSudo, getSetting, setSetting, getGroupSetting, setGroupSetting, deleteGroupSetting, resetAllGroupSettings, getAllGroupSettings, addNote, getNote, getAllNotes, updateNote, deleteNote, deleteAllNotes, getAllUsersNotes, deleteNoteById, updateNoteById, clearAllSudo, resetSetting, resetAllSettings, setTempEmail, getTempEmail, deleteTempEmail, addWarning, getUserWarnings, resetWarnings, TEMPMAIL_EXPIRY_MINUTES, db };

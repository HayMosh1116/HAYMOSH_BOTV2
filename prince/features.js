const { gmd, db } = require("../mayel");
if (!db) throw new Error("Shared SQLite database unavailable.");
db.exec(`
CREATE TABLE IF NOT EXISTS player_stats (player_jid TEXT PRIMARY KEY, display_name TEXT, points INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, games_played INTEGER NOT NULL DEFAULT 0, updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS admin_action_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_jid TEXT, actor_jid TEXT, action TEXT NOT NULL, target_jid TEXT, details TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS tournaments (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_jid TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_by TEXT, created_at TEXT DEFAULT (datetime('now')), ended_at TEXT);
CREATE TABLE IF NOT EXISTS tournament_players (tournament_id INTEGER NOT NULL, player_jid TEXT NOT NULL, joined_at TEXT DEFAULT (datetime('now')), PRIMARY KEY(tournament_id, player_jid));
`);
const label = c => String(c.pushName || c.name || c.sender || "Player").split("@")[0].slice(0,60);
const owner = c => Boolean(c.isSuperUser);
const audit = (chat, actor, action, details="") => db.prepare("INSERT INTO admin_action_logs(chat_jid,actor_jid,action,details) VALUES(?,?,?,?)").run(chat||"",actor||"",action,String(details).slice(0,500));
gmd({pattern:"profile",aliases:["myprofile","player"],category:"games",description:"View your permanent game profile."},async(from,Prince,c)=>{
 if(!c.sender)return c.reply("I couldn't identify your player account.");
 db.prepare("INSERT OR IGNORE INTO player_stats(player_jid,display_name) VALUES(?,?)").run(c.sender,label(c));
 const p=db.prepare("SELECT * FROM player_stats WHERE player_jid=?").get(c.sender);
 return c.reply("🎮 *HAYWHY PLAYER PROFILE*\n\n"+label(c)+"\n⭐ Points: "+p.points+"\n🏆 Wins: "+p.wins+"\n🎯 Games played: "+p.games_played);
});
gmd({pattern:"leaderboard",aliases:["rank","topplayers"],category:"games",description:"Show the top game players."},async(from,Prince,c)=>{
 const rows=db.prepare("SELECT display_name,points,wins FROM player_stats ORDER BY points DESC,wins DESC LIMIT 10").all();
 return c.reply(rows.length?"🏆 *HAYWHY LEADERBOARD*\n\n"+rows.map((p,i)=>(i+1)+". "+(p.display_name||"Player")+" — "+p.points+" pts ("+p.wins+" wins)").join("\n"):"No player scores have been recorded yet.");
});
gmd({pattern:"tournament",aliases:["tour"],category:"games",description:"Create, join or finish a chat tournament."},async(from,Prince,c)=>{
 const parts=String(c.q||"").trim().split(/\s+/);const action=(parts.shift()||"status").toLowerCase();const name=parts.join(" ").slice(0,80);
 if(action==="create"){if(!name)return c.reply("Usage: .tournament create <name>");const old=db.prepare("SELECT id FROM tournaments WHERE chat_jid=? AND status='open'").get(from);if(old)return c.reply("This chat already has an open tournament.");const r=db.prepare("INSERT INTO tournaments(chat_jid,name,created_by) VALUES(?,?,?)").run(from,name,c.sender||"");db.prepare("INSERT OR IGNORE INTO tournament_players(tournament_id,player_jid) VALUES(?,?)").run(r.lastInsertRowid,c.sender||"");audit(from,c.sender,"tournament.create",name);return c.reply("🏆 Tournament *"+name+"* created. Join with .tournament join");}
 const t=db.prepare("SELECT * FROM tournaments WHERE chat_jid=? AND status='open' ORDER BY id DESC LIMIT 1").get(from);if(!t)return c.reply("No open tournament. Create one with .tournament create <name>.");
 if(action==="join"){db.prepare("INSERT OR IGNORE INTO tournament_players(tournament_id,player_jid) VALUES(?,?)").run(t.id,c.sender||"");return c.reply("✅ "+label(c)+" joined *"+t.name+"*.");}
 if(action==="end"){if(!owner(c))return c.reply("Owner only.");db.prepare("UPDATE tournaments SET status='ended',ended_at=datetime('now') WHERE id=?").run(t.id);audit(from,c.sender,"tournament.end",t.name);return c.reply("🏁 Tournament *"+t.name+"* ended.");}
 const n=db.prepare("SELECT COUNT(*) n FROM tournament_players WHERE tournament_id=?").get(t.id).n;return c.reply("🏆 *"+t.name+"*\nParticipants: "+n+"\nJoin: .tournament join");
});
gmd({pattern:"actionlogs",aliases:["adminlogs"],category:"owner",description:"View recent admin action logs."},async(from,Prince,c)=>{
 if(!owner(c))return c.reply("Owner only.");const rows=db.prepare("SELECT action,details,created_at FROM admin_action_logs ORDER BY id DESC LIMIT 15").all();
 return c.reply(rows.length?"🧾 *RECENT ADMIN ACTIONS*\n\n"+rows.map(x=>"• "+x.action+" — "+(x.details||"-")+" — "+x.created_at).join("\n"):"No admin actions logged yet.");
});
gmd({pattern:"devtools",aliases:["bothealth"],category:"owner",description:"Show runtime and bot diagnostics."},async(from,Prince,c)=>{
 if(!owner(c))return c.reply("Owner only.");const m=process.memoryUsage();const n=db.prepare("SELECT (SELECT COUNT(*) FROM player_stats) players,(SELECT COUNT(*) FROM admin_action_logs) logs,(SELECT COUNT(*) FROM tournaments) tournaments").get();
 return c.reply("🛠️ *HAYWHY DEVTOOLS*\nNode: "+process.version+"\nUptime: "+Math.floor(process.uptime()/60)+" min\nMemory: "+Math.round(m.rss/1048576)+" MB\nPlayers: "+n.players+"\nAction logs: "+n.logs+"\nTournaments: "+n.tournaments);
});
gmd({pattern:"backupsettings",category:"owner",description:"Send a backup of non-sensitive bot settings."},async(from,Prince,c)=>{
 if(!owner(c))return c.reply("Owner only.");try{const deny=/(token|secret|password|api.?key|session|credential|uri)/i;const tables={};for(const t of ["bot_settings","group_settings"]){tables[t]=db.prepare("SELECT * FROM "+t).all().filter(r=>!Object.keys(r).some(k=>deny.test(k))&&!Object.values(r).some(v=>typeof v==="string"&&deny.test(v)));}const data=Buffer.from(JSON.stringify({version:1,createdAt:new Date().toISOString(),tables},null,2));await Prince.sendMessage(from,{document:data,mimetype:"application/json",fileName:"haywhy-settings-backup.json",caption:"HAYWHY settings backup. Sensitive values excluded."},{quoted:c.mek});audit(from,c.sender,"settings.backup");}catch(e){console.error("[HAYWHY BACKUP]",e);return c.reply("Backup failed. Check server logs.");}
});

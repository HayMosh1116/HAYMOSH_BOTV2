const { gmd } = require("../mayel");

/**
 * Word Chain Game
 * Rules: each player must say a word that starts with the last letter of the previous word.
 * No repeating words. 30 seconds per turn.
 */

const sessions = new Map(); // chatJid -> session object

function getText(m) {
  return (
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    m.message?.imageMessage?.caption ||
    ""
  ).trim().toLowerCase();
}

function senderOf(m, from) {
  return m.key?.senderPn || m.key?.participantPn || m.key?.participant || from;
}

function isValidWord(word) {
  return /^[a-zA-Z]+$/.test(word);
}

function endChain(Prince, from) {
  const s = sessions.get(from);
  if (!s) return;
  try { if (s.handler) Prince.ev.off("messages.upsert", s.handler); } catch {}
  try { if (s.turnTimeout) clearTimeout(s.turnTimeout); } catch {}
  sessions.delete(from);
}

gmd({
  pattern: "wordchain",
  aliases: ["wchain", "chainword"],
  react: "🔗",
  category: "games",
  description: "Start a word chain game — each word must start with the last letter of the previous",
}, async (from, Prince, conText) => {
  const { reply, mek, sender, pushName } = conText;

  if (sessions.has(from)) {
    return reply("🔗 A word chain game is already running! Use *.endchain* to stop it.");
  }

  const startWord = "start";

  const session = {
    lastWord: startWord,
    usedWords: new Set([startWord]),
    scores: {},
    lastPlayer: null,
    handler: null,
    turnTimeout: null,
    roundCount: 0,
  };

  await Prince.sendMessage(from, {
    text: `🔗 *WORD CHAIN STARTED!*\n\nRules:\n• Each word must start with the last letter of the previous word\n• No repeating words\n• Only English words allowed\n• 30 seconds per turn or game ends!\n\n*Starting word:* _${startWord}_\n*Next letter:* *${startWord.slice(-1).toUpperCase()}*\n\nGo! Type a word starting with *${startWord.slice(-1).toUpperCase()}*`,
    quoted: mek,
  });

  function resetTurnTimer() {
    if (session.turnTimeout) clearTimeout(session.turnTimeout);
    session.turnTimeout = setTimeout(async () => {
      endChain(Prince, from);
      let scoreboard = "";
      const sorted = Object.entries(session.scores).sort((a, b) => b[1] - a[1]);
      if (sorted.length) {
        scoreboard = "\n\n🏆 *Scoreboard:*\n" + sorted.map(([k, v], i) => `${i + 1}. ${k} — ${v} pts`).join("\n");
      }
      await Prince.sendMessage(from, {
        text: `⏰ *Time's up! Word chain ended!*\n\n*Last word:* ${session.lastWord}\n*Total rounds:* ${session.roundCount}${scoreboard}`,
      });
    }, 30000);
  }

  resetTurnTimer();

  session.handler = async ({ messages }) => {
    const m = messages[0];
    if (!m?.message || m.key.fromMe) return;
    if (m.key.remoteJid !== from) return;

    const text = getText(m);
    if (!text) return;

    const player = senderOf(m, from);
    const playerName = m.pushName || player.split("@")[0];

    if (text === ".endchain" || text === "/endchain") {
      endChain(Prince, from);
      await Prince.sendMessage(from, { text: "🔗 Word chain ended by player!", quoted: m });
      return;
    }

    const word = text.split(" ")[0].toLowerCase();
    if (!isValidWord(word)) return;

    const expectedStart = session.lastWord.slice(-1);
    if (word[0] !== expectedStart) return;

    if (session.usedWords.has(word)) {
      await Prince.sendMessage(from, {
        text: `❌ *"${word}"* was already used! Try a different word starting with *${expectedStart.toUpperCase()}*`,
        quoted: m,
      });
      return;
    }

    session.usedWords.add(word);
    session.lastWord = word;
    session.lastPlayer = player;
    session.roundCount++;
    session.scores[playerName] = (session.scores[playerName] || 0) + 1;

    const nextLetter = word.slice(-1).toUpperCase();
    resetTurnTimer();

    await Prince.sendMessage(from, {
      text: `✅ *${playerName}:* _${word}_\n\n*Next letter:* *${nextLetter}*\n_Round ${session.roundCount} | Score: ${session.scores[playerName]} pts_`,
      quoted: m,
    });
  };

  Prince.ev.on("messages.upsert", session.handler);
  sessions.set(from, session);
});

gmd({
  pattern: "endchain",
  aliases: ["stopchain"],
  react: "🛑",
  category: "games",
  description: "End the current word chain game",
}, async (from, Prince, conText) => {
  const { reply, mek } = conText;

  if (!sessions.has(from)) {
    return reply("❌ No word chain game is running here.");
  }

  const session = sessions.get(from);
  const sorted = Object.entries(session.scores).sort((a, b) => b[1] - a[1]);
  let scoreboard = sorted.length
    ? "\n\n🏆 *Final Scoreboard:*\n" + sorted.map(([k, v], i) => `${i + 1}. ${k} — ${v} pts`).join("\n")
    : "";

  endChain(Prince, from);
  await reply(`🛑 *Word Chain Ended!*\n\n*Total rounds:* ${session.roundCount}${scoreboard}`, { quoted: mek });
});

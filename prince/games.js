/**
 * Multiplayer-friendly games that work both in DM and in groups.
 * Anyone in the chat can play by typing their guess/answer (no prefix needed).
 *
 * Games: wordle, guess (number), hangman, rps, math, trivia
 * Control: .games (menu), .endgame (stop the current chat's game)
 */

const { gmd, getContextInfo } = require("../mayel");

// One active game per chat: chatJid -> { type, handler, timeout, ... }
const games = new Map();

function endGame(Prince, from) {
  const g = games.get(from);
  if (!g) return false;
  try { if (g.handler) Prince.ev.off("messages.upsert", g.handler); } catch {}
  try { if (g.timeout) clearTimeout(g.timeout); } catch {}
  games.delete(from);
  return true;
}

function getText(m) {
  return (
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    m.message?.imageMessage?.caption ||
    ""
  ).trim();
}

function senderOf(m, from) {
  return (
    m.key?.senderPn ||
    m.key?.participantPn ||
    m.key?.participant ||
    from
  );
}

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── word lists ───────────────────────────────────────────────────────────────
const WORDLE_WORDS = [
  "apple", "brave", "crane", "dance", "eagle", "flame", "ghost", "house",
  "input", "joker", "knife", "lemon", "mango", "noble", "ocean", "piano",
  "queen", "river", "snake", "tiger", "ultra", "vivid", "water", "yacht",
  "zebra", "bread", "chair", "dream", "earth", "fairy", "grape", "heart",
  "ivory", "jelly", "koala", "light", "money", "night", "olive", "pearl",
  "quilt", "robot", "storm", "train", "unity", "voice", "witch", "youth",
  "beach", "cloud", "frost", "glory", "honey", "lucky", "magic", "plant",
];

const HANGMAN_WORDS = [
  "javascript", "computer", "elephant", "mountain", "keyboard", "language",
  "internet", "baseball", "dinosaur", "hospital", "umbrella", "chocolate",
  "butterfly", "telephone", "adventure", "knowledge", "diamond", "festival",
  "galaxy", "horizon", "library", "network", "oxygen", "pyramid", "rainbow",
];

const TRIVIA = [
  { q: "What is the capital of Japan?", a: "tokyo" },
  { q: "How many continents are there on Earth?", a: "7" },
  { q: "What planet is known as the Red Planet?", a: "mars" },
  { q: "What is the largest ocean on Earth?", a: "pacific" },
  { q: "Who painted the Mona Lisa?", a: "leonardo da vinci" },
  { q: "What is the chemical symbol for gold?", a: "au" },
  { q: "How many legs does a spider have?", a: "8" },
  { q: "What is the tallest animal in the world?", a: "giraffe" },
  { q: "What language has the most native speakers?", a: "mandarin" },
  { q: "What is the smallest prime number?", a: "2" },
  { q: "Which country is home to the kangaroo?", a: "australia" },
  { q: "What gas do plants absorb from the atmosphere?", a: "carbon dioxide" },
];

// Wordle scoring with correct duplicate handling
function scoreWordle(guess, target) {
  guess = guess.toLowerCase();
  target = target.toLowerCase();
  const res = Array(5).fill("⬛");
  const t = target.split("");
  const used = Array(5).fill(false);
  for (let i = 0; i < 5; i++) {
    if (guess[i] === t[i]) { res[i] = "🟩"; used[i] = true; }
  }
  for (let i = 0; i < 5; i++) {
    if (res[i] === "🟩") continue;
    for (let j = 0; j < 5; j++) {
      if (!used[j] && guess[i] === t[j]) { res[i] = "🟨"; used[j] = true; break; }
    }
  }
  return res.join("");
}

function wordleBoard(guesses, target) {
  return guesses
    .map((g) => `${scoreWordle(g, target)}  ${g.toUpperCase().split("").join(" ")}`)
    .join("\n");
}

// ── WORDLE ────────────────────────────────────────────────────────────────────
gmd(
  {
    pattern: "wordle",
    aliases: ["word"],
    react: "🟩",
    category: "games",
    description: "Guess the secret 5-letter word in 6 tries (DM or group).",
  },
  async (from, Prince, conText) => {
    const { reply, sender, botName, newsletterJid } = conText;

    if (games.has(from)) {
      return reply("⚠️ A game is already running in this chat. Type *.endgame* to stop it.");
    }

    const target = rand(WORDLE_WORDS);
    const guesses = [];

    const sendCtx = (text) =>
      Prince.sendMessage(from, {
        text,
        contextInfo: getContextInfo(sender, newsletterJid, botName),
      });

    await sendCtx(
      `🟩🟨⬛ *WORDLE*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `A new game has started!\n\n` +
      `Guess the secret *5-letter word* in *6 tries*.\n\n` +
      `🟩 Right letter, right spot\n` +
      `🟨 Right letter, wrong spot\n` +
      `⬛ Letter not in word\n\n` +
      `Just type any 5-letter word to guess!\n` +
      `Type *.endgame* to give up.\n` +
      `━━━━━━━━━━━━━━━━━━━━━━`
    );

    const handler = async ({ messages }) => {
      try {
        const m = messages[0];
        if (!m?.message || m.key.remoteJid !== from) return;
        const guess = getText(m).toLowerCase();
        if (!/^[a-z]{5}$/.test(guess)) return;

        guesses.push(guess);
        const who = senderOf(m, from).split("@")[0];

        if (guess === target) {
          endGame(Prince, from);
          return sendCtx(
            `🎉 *WORDLE — Solved!*\n━━━━━━━━━━━━━━━━━━━━━━\n` +
            `${wordleBoard(guesses, target)}\n\n` +
            `✅ @${who} got it in *${guesses.length}/6* tries!\n` +
            `The word was *${target.toUpperCase()}*.`
          );
        }

        if (guesses.length >= 6) {
          endGame(Prince, from);
          return sendCtx(
            `💀 *WORDLE — Game Over*\n━━━━━━━━━━━━━━━━━━━━━━\n` +
            `${wordleBoard(guesses, target)}\n\n` +
            `❌ Out of tries! The word was *${target.toUpperCase()}*.`
          );
        }

        return sendCtx(
          `🟩🟨⬛ *WORDLE* — Try ${guesses.length}/6\n━━━━━━━━━━━━━━━━━━━━━━\n` +
          `${wordleBoard(guesses, target)}\n\n` +
          `Keep guessing! (${6 - guesses.length} left)`
        );
      } catch (e) {
        console.error("Wordle error:", e);
      }
    };

    const timeout = setTimeout(() => {
      if (games.has(from)) {
        endGame(Prince, from);
        sendCtx(`⌛ *WORDLE* timed out. The word was *${target.toUpperCase()}*.`);
      }
    }, 5 * 60 * 1000);

    games.set(from, { type: "wordle", handler, timeout });
    Prince.ev.on("messages.upsert", handler);
  }
);

// ── GUESS THE NUMBER ───────────────────────────────────────────────────────────
gmd(
  {
    pattern: "guess",
    aliases: ["guessnumber", "numguess"],
    react: "🔢",
    category: "games",
    description: "Bot picks a number 1-100, guess it (DM or group).",
  },
  async (from, Prince, conText) => {
    const { reply, sender, botName, newsletterJid } = conText;

    if (games.has(from)) {
      return reply("⚠️ A game is already running in this chat. Type *.endgame* to stop it.");
    }

    const target = Math.floor(Math.random() * 100) + 1;
    let tries = 0;

    const sendCtx = (text) =>
      Prince.sendMessage(from, {
        text,
        contextInfo: getContextInfo(sender, newsletterJid, botName),
      });

    await sendCtx(
      `🔢 *GUESS THE NUMBER*\n━━━━━━━━━━━━━━━━━━━━━━\n` +
      `I'm thinking of a number between *1 and 100*.\n` +
      `Type a number to guess!\n\n` +
      `Type *.endgame* to give up.`
    );

    const handler = async ({ messages }) => {
      try {
        const m = messages[0];
        if (!m?.message || m.key.remoteJid !== from) return;
        const txt = getText(m);
        if (!/^\d{1,3}$/.test(txt)) return;
        const num = parseInt(txt, 10);
        if (num < 1 || num > 100) return;

        tries++;
        const who = senderOf(m, from).split("@")[0];

        if (num === target) {
          endGame(Prince, from);
          return sendCtx(
            `🎉 *Correct!* The number was *${target}*.\n` +
            `✅ @${who} guessed it in *${tries}* tries!`
          );
        }
        return sendCtx(num < target ? `📈 Higher than *${num}*...` : `📉 Lower than *${num}*...`);
      } catch (e) {
        console.error("Guess error:", e);
      }
    };

    const timeout = setTimeout(() => {
      if (games.has(from)) {
        endGame(Prince, from);
        sendCtx(`⌛ *GUESS* timed out. The number was *${target}*.`);
      }
    }, 5 * 60 * 1000);

    games.set(from, { type: "guess", handler, timeout });
    Prince.ev.on("messages.upsert", handler);
  }
);

// ── HANGMAN ─────────────────────────────────────────────────────────────────
const HANG_STAGES = [
  "  +---+\n      |\n      |\n      |\n     ===",
  "  +---+\n  O   |\n      |\n      |\n     ===",
  "  +---+\n  O   |\n  |   |\n      |\n     ===",
  "  +---+\n  O   |\n /|   |\n      |\n     ===",
  "  +---+\n  O   |\n /|\\  |\n      |\n     ===",
  "  +---+\n  O   |\n /|\\  |\n /    |\n     ===",
  "  +---+\n  O   |\n /|\\  |\n / \\  |\n     ===",
];

function hangmanMask(word, guessed) {
  return word
    .split("")
    .map((c) => (guessed.has(c) ? c.toUpperCase() : "_"))
    .join(" ");
}

gmd(
  {
    pattern: "hangman",
    aliases: ["hang"],
    react: "🪢",
    category: "games",
    description: "Guess the hidden word letter by letter (DM or group).",
  },
  async (from, Prince, conText) => {
    const { reply, sender, botName, newsletterJid } = conText;

    if (games.has(from)) {
      return reply("⚠️ A game is already running in this chat. Type *.endgame* to stop it.");
    }

    const word = rand(HANGMAN_WORDS);
    const guessed = new Set();
    let wrong = 0;

    const sendCtx = (text) =>
      Prince.sendMessage(from, {
        text,
        contextInfo: getContextInfo(sender, newsletterJid, botName),
      });

    await sendCtx(
      `🪢 *HANGMAN*\n━━━━━━━━━━━━━━━━━━━━━━\n` +
      `\`\`\`${HANG_STAGES[0]}\`\`\`\n\n` +
      `Word: ${hangmanMask(word, guessed)}\n` +
      `Length: *${word.length}* letters\n\n` +
      `Type a *single letter*, or guess the *whole word*.\n` +
      `You can make *${HANG_STAGES.length - 1}* wrong guesses.\n` +
      `Type *.endgame* to give up.`
    );

    const handler = async ({ messages }) => {
      try {
        const m = messages[0];
        if (!m?.message || m.key.remoteJid !== from) return;
        const txt = getText(m).toLowerCase();
        const who = senderOf(m, from).split("@")[0];

        // Full-word guess
        if (/^[a-z]{2,}$/.test(txt) && txt.length > 1) {
          if (txt === word) {
            endGame(Prince, from);
            return sendCtx(`🎉 *HANGMAN — Solved!*\nThe word was *${word.toUpperCase()}*.\n✅ Nailed it, @${who}!`);
          }
          if (txt.length === word.length) {
            wrong++;
            if (wrong >= HANG_STAGES.length - 1) {
              endGame(Prince, from);
              return sendCtx(`💀 *HANGMAN — Game Over*\n\`\`\`${HANG_STAGES[HANG_STAGES.length - 1]}\`\`\`\nThe word was *${word.toUpperCase()}*.`);
            }
            return sendCtx(`❌ Not *${txt.toUpperCase()}*.\n\`\`\`${HANG_STAGES[wrong]}\`\`\`\nWord: ${hangmanMask(word, guessed)}`);
          }
          return; // wrong length, ignore
        }

        // Single-letter guess
        if (!/^[a-z]$/.test(txt)) return;
        if (guessed.has(txt)) return sendCtx(`⚠️ "${txt.toUpperCase()}" already tried.`);
        guessed.add(txt);

        if (word.includes(txt)) {
          const mask = hangmanMask(word, guessed);
          if (!mask.includes("_")) {
            endGame(Prince, from);
            return sendCtx(`🎉 *HANGMAN — Solved!*\nWord: ${mask}\nThe word was *${word.toUpperCase()}*. ✅ @${who}`);
          }
          return sendCtx(`✅ Good! "${txt.toUpperCase()}" is in the word.\n\`\`\`${HANG_STAGES[wrong]}\`\`\`\nWord: ${mask}`);
        }

        wrong++;
        if (wrong >= HANG_STAGES.length - 1) {
          endGame(Prince, from);
          return sendCtx(`💀 *HANGMAN — Game Over*\n\`\`\`${HANG_STAGES[HANG_STAGES.length - 1]}\`\`\`\nThe word was *${word.toUpperCase()}*.`);
        }
        return sendCtx(`❌ No "${txt.toUpperCase()}".\n\`\`\`${HANG_STAGES[wrong]}\`\`\`\nWord: ${hangmanMask(word, guessed)}\nWrong: ${wrong}/${HANG_STAGES.length - 1}`);
      } catch (e) {
        console.error("Hangman error:", e);
      }
    };

    const timeout = setTimeout(() => {
      if (games.has(from)) {
        endGame(Prince, from);
        sendCtx(`⌛ *HANGMAN* timed out. The word was *${word.toUpperCase()}*.`);
      }
    }, 5 * 60 * 1000);

    games.set(from, { type: "hangman", handler, timeout });
    Prince.ev.on("messages.upsert", handler);
  }
);

// ── ROCK PAPER SCISSORS (vs bot, instant) ─────────────────────────────────────
gmd(
  {
    pattern: "rps",
    aliases: ["rockpaperscissors"],
    react: "✊",
    category: "games",
    description: "Play Rock Paper Scissors against the bot. Usage: .rps rock|paper|scissors",
  },
  async (from, Prince, conText) => {
    const { reply, q, sender, botName, newsletterJid } = conText;

    const map = { rock: "✊", paper: "✋", scissors: "✌️", r: "✊", p: "✋", s: "✌️" };
    const norm = { r: "rock", p: "paper", s: "scissors", rock: "rock", paper: "paper", scissors: "scissors" };
    const choice = norm[(q || "").trim().toLowerCase()];

    if (!choice) {
      return reply("✊✋✌️ *Rock Paper Scissors*\n\nUsage: *.rps rock* / *.rps paper* / *.rps scissors*");
    }

    const options = ["rock", "paper", "scissors"];
    const bot = rand(options);

    let result;
    if (choice === bot) result = "🤝 It's a *tie*!";
    else if (
      (choice === "rock" && bot === "scissors") ||
      (choice === "paper" && bot === "rock") ||
      (choice === "scissors" && bot === "paper")
    ) result = "🎉 *You win!*";
    else result = "😈 *Bot wins!*";

    await Prince.sendMessage(from, {
      text:
        `✊✋✌️ *ROCK PAPER SCISSORS*\n━━━━━━━━━━━━━━━━━━━━━━\n` +
        `You: ${map[choice]} ${choice}\n` +
        `Bot: ${map[bot]} ${bot}\n\n` +
        `${result}`,
      contextInfo: getContextInfo(sender, newsletterJid, botName),
    }, { quoted: conText.mek });
  }
);

// ── MATH QUIZ (continuous, scores) ─────────────────────────────────────────
gmd(
  {
    pattern: "math",
    aliases: ["mathquiz", "calc"],
    react: "🧮",
    category: "games",
    description: "Continuous math quiz — correct answer or 'next' moves on, 'endgame' to stop.",
  },
  async (from, Prince, conText) => {
    const { reply, sender, botName, newsletterJid } = conText;

    if (games.has(from)) {
      return reply("⚠️ A game is already running. Type *endgame* to stop it.");
    }

    const sendCtx = (text) =>
      Prince.sendMessage(from, {
        text,
        contextInfo: getContextInfo(sender, newsletterJid, botName),
      });

    const state = { type: "math", scores: {}, answer: null, problem: "", timeout: null, handler: null };

    const askNext = async () => {
      const a = Math.floor(Math.random() * 40) + 1;
      const b = Math.floor(Math.random() * 40) + 1;
      const op = rand(["+", "-", "*"]);
      state.answer = op === "+" ? a + b : op === "-" ? a - b : a * b;
      state.problem = `${a} ${op} ${b}`;
      await sendCtx(
        `🧮 *MATH QUIZ*\n━━━━━━━━━━━━━━━━━━━━━━\n` +
        `What is: *${state.problem}* ?\n\n` +
        `Type your answer! *next* to skip, *endgame* to stop.`
      );
    };

    state.handler = async ({ messages }) => {
      try {
        const m = messages[0];
        if (!m?.message || m.key.remoteJid !== from) return;
        const txt = getText(m).toLowerCase().trim();
        if (!txt) return;

        const who = senderOf(m, from).split("@")[0];

        if (txt === "endgame" || txt === ".endgame" || txt === "stopgame") {
          const scoreList = Object.entries(state.scores)
            .sort((a, b) => b[1] - a[1])
            .map(([u, s], i) => `${i + 1}. @${u} — ${s} pt(s)`)
            .join("\n") || "_No points scored._";
          endGame(Prince, from);
          return sendCtx(`🛑 *MATH ended!*\n\n🏆 *Scores:*\n${scoreList}`);
        }
        if (txt === "next" || txt === ".next" || txt === "skip") {
          await sendCtx(`⏭️ Skipping! The answer was *${state.answer}*.`);
          return askNext();
        }

        if (txt.startsWith(".")) return;

        const guess = parseInt(txt.replace(/[^0-9-]/g, ""), 10);
        if (!isNaN(guess) && guess === state.answer) {
          state.scores[who] = (state.scores[who] || 0) + 1;
          await sendCtx(`🎉 Correct @${who}! *${state.problem} = ${state.answer}*\n📊 Your score: ${state.scores[who]} pt(s)\n\n_Next..._`);
          return askNext();
        }
      } catch (e) {
        console.error("Math error:", e);
      }
    };

    games.set(from, state);
    Prince.ev.on("messages.upsert", state.handler);
    await askNext();
  }
);

// ── TRIVIA (continuous, scores) ─────────────────────────────────────────────
gmd(
  {
    pattern: "trivia",
    aliases: ["quiz"],
    react: "❓",
    category: "games",
    description: "Continuous trivia — correct answer or 'next' moves on, 'endgame' to stop.",
  },
  async (from, Prince, conText) => {
    const { reply, sender, botName, newsletterJid } = conText;

    if (games.has(from)) {
      return reply("⚠️ A game is already running. Type *endgame* to stop it.");
    }

    const sendCtx = (text) =>
      Prince.sendMessage(from, {
        text,
        contextInfo: getContextInfo(sender, newsletterJid, botName),
      });

    const state = { type: "trivia", scores: {}, current: null, timeout: null, handler: null };

    const askNext = async () => {
      const item = rand(TRIVIA);
      state.current = item;
      await sendCtx(
        `❓ *TRIVIA*\n━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${item.q}\n\n` +
        `Answer fast! *next* to skip, *endgame* to stop.`
      );
    };

    state.handler = async ({ messages }) => {
      try {
        const m = messages[0];
        if (!m?.message || m.key.remoteJid !== from) return;
        const txt = getText(m).toLowerCase().trim();
        if (!txt) return;

        const who = senderOf(m, from).split("@")[0];

        if (txt === "endgame" || txt === ".endgame" || txt === "stopgame") {
          const scoreList = Object.entries(state.scores)
            .sort((a, b) => b[1] - a[1])
            .map(([u, s], i) => `${i + 1}. @${u} — ${s} pt(s)`)
            .join("\n") || "_No points scored._";
          endGame(Prince, from);
          return sendCtx(`🛑 *TRIVIA ended!*\n\n🏆 *Scores:*\n${scoreList}`);
        }
        if (txt === "next" || txt === ".next" || txt === "skip") {
          await sendCtx(`⏭️ Skipping! The answer was *${state.current?.a}*.`);
          return askNext();
        }

        if (txt.startsWith(".")) return;

        if (state.current && (txt === state.current.a || txt.includes(state.current.a))) {
          state.scores[who] = (state.scores[who] || 0) + 1;
          await sendCtx(`🎉 Correct @${who}! Answer: *${state.current.a}*\n📊 Your score: ${state.scores[who]} pt(s)\n\n_Next question..._`);
          return askNext();
        }
      } catch (e) {
        console.error("Trivia error:", e);
      }
    };

    games.set(from, state);
    Prince.ev.on("messages.upsert", state.handler);
    await askNext();
  }
);

// ── CONTROL ─────────────────────────────────────────────────────────────────
gmd(
  {
    pattern: "endgame",
    aliases: ["stopgame", "cancelgame"],
    react: "🛑",
    category: "games",
    description: "Stop the game currently running in this chat.",
  },
  async (from, Prince, conText) => {
    const { reply } = conText;
    const g = games.get(from);
    if (!g) return reply("ℹ️ There is no active game in this chat.");
    const type = g.type;
    endGame(Prince, from);
    return reply(`🛑 The *${type}* game has been stopped.`);
  }
);

gmd(
  {
    pattern: "games",
    aliases: ["gamemenu", "gamelist"],
    react: "🎮",
    category: "games",
    description: "Show the list of available games.",
  },
  async (from, Prince, conText) => {
    const { sender, botName, newsletterJid, mek } = conText;
    const prefix = conText.botPrefix || ".";

    const text =
      `🎮 *${botName} — GAMES*\n━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Play solo, with a friend in DM, or together in a group!\n\n` +
      `🟩 *${prefix}wordle* — guess the 5-letter word\n` +
      `🔢 *${prefix}guess* — guess the number (1-100)\n` +
      `🪢 *${prefix}hangman* — guess the hidden word\n` +
      `✊ *${prefix}rps <rock|paper|scissors>* — vs the bot\n` +
      `🧮 *${prefix}math* — fastest correct answer wins\n` +
      `❓ *${prefix}trivia* — answer the question first\n\n` +
      `🛑 *${prefix}endgame* — stop the current game\n` +
      `━━━━━━━━━━━━━━━━━━━━━━`;

    await Prince.sendMessage(from, {
      text,
      contextInfo: getContextInfo(sender, newsletterJid, botName),
    }, { quoted: mek });
  }
);

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
  try { if (g.joinHandler) Prince.ev.off("messages.upsert", g.joinHandler); } catch {}
  try { if (g.handler) Prince.ev.off("messages.upsert", g.handler); } catch {}
  try { if (g.joinTimeout) clearTimeout(g.joinTimeout); } catch {}
  try { if (g.timeout) clearTimeout(g.timeout); } catch {}
  try { if (g.turnTimeout) clearTimeout(g.turnTimeout); } catch {}
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

// ── WORD CHAIN ───────────────────────────────────────────────────────────────
// GROUP: 30s join phase → multiplayer (any joined player can play)
// DM: immediate start — bot auto-plays against user
const WC_BOT_WORDS = {
  a:["able","acid","arch","area","army","atom","auto","aged","ache","acre"],
  b:["ball","band","bank","barn","base","bath","beam","bear","beat","beef","bell","belt","bend","bird","bite","bold","bolt","bond","bone","book","bore","bowl","brag","brag","brew","bull","burn","bush","byte"],
  c:["cage","cake","calm","came","camp","cane","cape","card","care","cart","case","cash","cast","cave","chat","chef","chip","city","clam","clan","claw","clay","clip","club","clue","code","coin","cold","come","cord","core","corn","cost","coup","cozy","crab","crop","crow","cube","cure","cute"],
  d:["dare","dark","dart","data","date","dawn","days","dead","deal","dean","dear","deck","deed","deep","deny","desk","diet","dirt","disk","dive","dock","dome","done","door","dork","dorm","dote","dove","down","drag","draw","drew","drop","drum","dual","dull","dump","dune","dusk","dust","duty"],
  e:["each","earl","earn","ease","east","echo","edge","else","emit","envy","epic","ergo","even","ever","evil","exam","exit","expo","eyed","eyes"],
  f:["face","fact","fade","fail","fair","fake","fall","fame","farm","fast","fate","feel","fell","felt","file","fill","film","find","fine","fire","fish","fist","flag","flat","flew","flex","flip","flow","foam","fold","folk","fond","font","food","fool","foot","fore","fork","form","fort","foul","four","free","from","full","fume","fund","fuse","fuzz"],
  g:["gain","gale","game","gang","gave","gaze","gear","germ","glow","glue","goal","goat","gold","golf","gone","good","gown","grab","grad","gray","grew","grid","grin","grip","grit","grow","gulf","gust","guts"],
  h:["hack","hail","hair","half","hall","halt","hand","hang","hard","harm","harp","hash","haste","hate","haul","have","hawk","haze","head","heal","heap","hear","heat","heel","held","helm","help","here","hero","high","hill","hint","hire","hold","hole","holy","home","hood","hope","horn","host","hour","hull","hung","hunt","hurl","hush","hype"],
  i:["idea","idle","inch","into","iron","isle","itch","item"],
  j:["jack","jade","jail","jamb","jest","join","jolt","jump","june","jury","just"],
  k:["keen","keep","kick","kill","kind","king","knee","knew","knit","knot"],
  l:["lace","lack","lake","lamp","land","lane","last","late","laud","lawn","lead","leaf","lean","leap","left","lend","lens","lick","life","lift","like","limb","line","link","lion","list","live","load","lock","loft","lone","long","look","loop","lore","lose","loud","love","luck","lump","lung","lure","lust"],
  m:["made","main","make","mall","mane","mark","mars","mask","mass","mast","mate","maze","meal","mean","meat","meet","melt","memo","menu","mesh","mild","milk","mill","mime","mind","mint","miss","mist","mode","mold","monk","mood","moon","more","most","move","myth"],
  n:["nail","name","nape","navy","near","neat","neck","need","nest","next","nice","nick","nine","node","none","norm","nose","note","null","numb"],
  o:["oaks","obey","odds","omen","once","only","open","oral","orb","orca","oven","owed","owns"],
  p:["pace","pack","pact","page","paid","pain","pair","pale","palm","pane","park","part","pass","past","path","pave","pawn","peak","peel","peer","perk","pest","pick","pile","pine","pink","pipe","pity","plan","play","plot","plow","plug","plum","plus","poem","poet","pole","poll","pond","pool","poor","port","pose","post","pour","prey","prim","prod","prop","pull","pump","pure","push"],
  q:["quad","quit","quiz"],
  r:["race","rack","rage","rail","rain","rank","rare","rate","read","real","reap","reel","rely","rent","rest","rice","rich","ride","ring","riot","rise","risk","road","roam","roar","robe","rock","role","roll","roof","root","rope","rose","rout","rude","ruin","rule","rush","rust"],
  s:["safe","sage","sail","sake","sale","salt","same","sand","sane","sang","sank","save","scan","scar","seal","seam","seed","seek","self","send","sent","shed","ship","shoe","shop","shot","show","shut","sick","side","sigh","sign","silk","sing","sink","site","size","skid","skin","skip","skull","slab","slam","slap","slim","slip","slow","slug","snap","snow","soak","sock","soft","soil","sold","sole","some","song","sore","sort","soul","soup","span","spar","spin","spot","stem","step","stop","stub","such","suit","sulk","sung","sunk","sure","swam","swan","swap","swim","sword"],
  t:["tack","tail","tale","tall","tame","tape","task","taut","team","tear","tell","tend","tent","term","test","text","than","that","them","then","they","thin","this","tick","tide","tier","tile","time","tiny","tire","told","toll","tomb","tome","tone","tool","tore","torn","toss","tour","town","trap","tray","tree","trek","trim","trip","true","tube","tuck","tuff","tusk","twin","type"],
  u:["ugly","undo","unit","upon","urge","used","user"],
  v:["vain","vale","vane","vase","vast","veil","vein","verb","very","vest","vibe","view","vine","vise","void","volt","vote"],
  w:["wade","wage","wake","walk","wall","wand","wane","ward","warm","wary","wave","weak","weld","well","went","were","west","whim","wide","wild","will","wind","wine","wing","wink","wire","wise","wish","wisp","with","woke","wolf","wood","word","wore","work","worm","worn","wrap","writ"],
  x:["xray"],
  y:["yard","yarn","year","yell","yoga","yore","your","yowl"],
  z:["zeal","zest","zinc","zone","zoom"],
};

gmd(
  {
    pattern: "wordchain",
    aliases: ["wchain", "chainword", "wordgame"],
    react: "🔗",
    category: "games",
    description: "Word Chain — group multiplayer with join phase, or 1v1 vs bot in DM.",
  },
  async (from, Prince, conText) => {
    const { reply, mek, sender, botName, newsletterJid } = conText;
    const isGroup = from.endsWith("@g.us");

    if (games.has(from)) {
      return reply("⚠️ A game is already running. Type *.endgame* to stop it.");
    }

    const JOIN_SEC = 30;
    const TURN_SEC = 30;
    const MIN_LEN = 3;

    const STARTERS = [
      "apple","brave","eagle","ocean","tiger","river","earth","storm",
      "dance","flame","ghost","light","magic","snake","train","voice",
      "queen","plant","noble","witch","ivory","jelly","grape","heart",
    ];
    const starterWord = STARTERS[Math.floor(Math.random() * STARTERS.length)];

    const state = {
      type: "wordchain",
      phase: isGroup ? "joining" : "playing",
      joinHandler: null,
      handler: null,
      joinTimeout: null,
      timeout: null,
      turnTimeout: null,
      players: new Set(),
      scores: {},
      lastWord: starterWord,
      lastLetter: starterWord[starterWord.length - 1].toUpperCase(),
      usedWords: new Set([starterWord]),
    };

    games.set(from, state);

    const mention = (jid) => `@${jid.split("@")[0]}`;

    const sendMsg = (text, mentions = []) =>
      Prince.sendMessage(from, { text, mentions });

    const buildBoard = () => {
      const entries = Object.entries(state.scores).sort((a, b) => b[1] - a[1]);
      if (!entries.length) return "_No scores yet_";
      return entries.map(([jid, pts], i) =>
        `${i + 1}. ${mention(jid)} — *${pts} pts*`
      ).join("\n");
    };

    const botPickWord = (letter) => {
      const pool = (WC_BOT_WORDS[letter.toLowerCase()] || [])
        .filter(w => !state.usedWords.has(w) && w.length >= MIN_LEN);
      return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    };

    const startTurnTimer = (lastPlayerJid) => {
      if (state.turnTimeout) clearTimeout(state.turnTimeout);
      state.turnTimeout = setTimeout(async () => {
        if (!games.has(from)) return;
        const mentions = lastPlayerJid ? [lastPlayerJid] : [];
        const who = lastPlayerJid ? mention(lastPlayerJid) : "Someone";
        endGame(Prince, from);
        await sendMsg(
          `⏰ *𝗧𝗶𝗺𝗲 𝗼𝘂𝘁!*\n\n` +
          `${who} took too long! ⌛\n\n` +
          `🏆 *𝗙𝗶𝗻𝗮𝗹 𝗦𝗰𝗼𝗿𝗲𝘀:*\n${buildBoard()}\n\n` +
          `🛑 Game over!`,
          mentions
        );
      }, TURN_SEC * 1000);
    };

    const buildPlayHandler = () => async ({ messages }) => {
      try {
        const m = messages[0];
        if (!m?.message || m.key.remoteJid !== from || m.key.fromMe) return;
        const txt = getText(m).toLowerCase().trim();
        if (!txt || txt.startsWith(".")) return;
        if (!/^[a-z]+$/.test(txt)) return;

        const playerJid = senderOf(m, from);

        if (state.phase !== "playing") return;
        if (isGroup && !state.players.has(playerJid)) return;

        if (txt.length < MIN_LEN) {
          return sendMsg(
            `⚠️ ${mention(playerJid)} — words must be at least *${MIN_LEN} letters*! Try again.`,
            [playerJid]
          );
        }
        if (txt[0] !== state.lastLetter.toLowerCase()) {
          return sendMsg(
            `❌ ${mention(playerJid)} — word must start with *"${state.lastLetter}"*, not "${txt[0].toUpperCase()}"!`,
            [playerJid]
          );
        }
        if (state.usedWords.has(txt)) {
          return sendMsg(
            `🔁 ${mention(playerJid)} — *"${txt.toUpperCase()}"* was already used! Pick another word.`,
            [playerJid]
          );
        }

        const pts = txt.length;
        state.usedWords.add(txt);
        state.lastWord = txt;
        state.lastLetter = txt[txt.length - 1].toUpperCase();
        state.scores[playerJid] = (state.scores[playerJid] || 0) + pts;
        startTurnTimer(playerJid);

        await sendMsg(
          `✅ *${txt.toUpperCase()}* by ${mention(playerJid)}! (+${pts} pts)\n` +
          `📊 Score: *${state.scores[playerJid]} pts*\n\n` +
          `🔗 Next word starts with: *"${state.lastLetter}"*`,
          [playerJid]
        );

        if (!isGroup) {
          await new Promise(r => setTimeout(r, 1200));
          if (!games.has(from)) return;
          const botWord = botPickWord(state.lastLetter);
          if (!botWord) {
            endGame(Prince, from);
            return sendMsg(
              `🤖 *Bot can't find a word starting with "${state.lastLetter}"!*\n\n` +
              `🎉 *You win!*\n🏆 Your score: *${state.scores[playerJid] || 0} pts*`
            );
          }
          const botPts = botWord.length;
          state.usedWords.add(botWord);
          state.lastWord = botWord;
          state.lastLetter = botWord[botWord.length - 1].toUpperCase();
          state.scores["bot"] = (state.scores["bot"] || 0) + botPts;
          startTurnTimer(playerJid);
          await sendMsg(
            `🤖 *Bot:* *${botWord.toUpperCase()}* (+${botPts} pts)\n\n` +
            `🔗 Your turn! Word must start with: *"${state.lastLetter}"*`
          );
        }
      } catch (e) {
        console.error("WordChain play error:", e);
      }
    };

    state.timeout = setTimeout(() => {
      if (games.has(from)) {
        endGame(Prince, from);
        sendMsg(
          `⌛ *𝗪𝗼𝗿𝗱 𝗖𝗵𝗮𝗶𝗻* timed out — no activity for 10 minutes.\n\n` +
          `🏆 *𝗙𝗶𝗻𝗮𝗹 𝗦𝗰𝗼𝗿𝗲𝘀:*\n${buildBoard()}`
        );
      }
    }, 10 * 60 * 1000);

    if (!isGroup) {
      state.handler = buildPlayHandler();
      Prince.ev.on("messages.upsert", state.handler);
      startTurnTimer(sender);
      await sendMsg(
        `╭━━━━━━━━━━━━━━━╮\n` +
        `│ 🔗 *𝗪𝗢𝗥𝗗 𝗖𝗛𝗔𝗜𝗡* — 𝘃𝘀 𝗕𝗼𝘁\n` +
        `├━━━━━━━━━━━━━━━┤\n` +
        `│ 🤖 Bot starts: *${starterWord.toUpperCase()}*\n` +
        `│\n` +
        `│ 📜 *𝗥𝗨𝗟𝗘𝗦:*\n` +
        `│ • Reply with a word starting\n` +
        `│   with the last letter of the\n` +
        `│   previous word\n` +
        `│ • Min *${MIN_LEN}* letters per word\n` +
        `│ • No repeated words\n` +
        `│ • ${TURN_SEC}s per turn or bot wins\n` +
        `│ • Score = word length\n` +
        `│\n` +
        `│ ➤ Next letter: *"${state.lastLetter}"*\n` +
        `│ *.endgame* to quit\n` +
        `╰━━━━━━━━━━━━━━━╯`
      );
      return;
    }

    state.players.add(sender);

    await sendMsg(
      `╭━━━━━━━━━━━━━━━╮\n` +
      `│ 🔗 *𝗪𝗢𝗥𝗗 𝗖𝗛𝗔𝗜𝗡*\n` +
      `├━━━━━━━━━━━━━━━┤\n` +
      `│ ${mention(sender)} started a game!\n` +
      `│\n` +
      `│ 📜 *𝗥𝗨𝗟𝗘𝗦:*\n` +
      `│ • Say a word starting with\n` +
      `│   the last letter of the\n` +
      `│   previous word\n` +
      `│ • Min *${MIN_LEN}* letters per word\n` +
      `│ • No repeated words\n` +
      `│ • Must be real English words\n` +
      `│ • ${TURN_SEC} seconds per turn\n` +
      `│ • Score = word length\n` +
      `│\n` +
      `│ ⏱️ *${JOIN_SEC} seconds to join*\n` +
      `│ 👥 Type *join* to play!\n` +
      `╰━━━━━━━━━━━━━━━╯`,
      [sender]
    );

    state.joinHandler = async ({ messages }) => {
      const m = messages[0];
      if (!m?.message || m.key.remoteJid !== from || m.key.fromMe) return;
      const txt = getText(m).toLowerCase().trim();
      const jid = senderOf(m, from);
      if (txt === "join" && !state.players.has(jid)) {
        state.players.add(jid);
        await sendMsg(
          `✅ ${mention(jid)} joined! *(${state.players.size} player${state.players.size > 1 ? "s" : ""} so far)*`,
          [jid]
        );
      }
    };
    Prince.ev.on("messages.upsert", state.joinHandler);

    state.joinTimeout = setTimeout(async () => {
      if (!games.has(from)) return;
      Prince.ev.off("messages.upsert", state.joinHandler);
      state.joinHandler = null;

      if (state.players.size === 0) {
        endGame(Prince, from);
        return sendMsg("❌ No one joined. Game cancelled.");
      }

      state.phase = "playing";
      const playerMentions = [...state.players];
      const playerList = playerMentions.map(j => `│ • ${mention(j)}`).join("\n");

      await sendMsg(
        `╭━━━━━━━━━━━━━━━╮\n` +
        `│ 🔗 *𝗪𝗢𝗥𝗗 𝗖𝗛𝗔𝗜𝗡 — 𝗦𝗧𝗔𝗥𝗧𝗘𝗗!*\n` +
        `├━━━━━━━━━━━━━━━┤\n` +
        `│ 👥 *Players:*\n` +
        `${playerList}\n` +
        `│\n` +
        `│ 🤖 Bot starts with:\n` +
        `│ ➤ *${starterWord.toUpperCase()}*\n` +
        `│\n` +
        `│ Next word starts with: *"${state.lastLetter}"*\n` +
        `│ Min *${MIN_LEN}* letters • Score = word length\n` +
        `│ *.endgame* to stop\n` +
        `╰━━━━━━━━━━━━━━━╯`,
        playerMentions
      );

      state.handler = buildPlayHandler();
      Prince.ev.on("messages.upsert", state.handler);
      startTurnTimer(null);
    }, JOIN_SEC * 1000);
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
      `❓ *${prefix}trivia* — answer the question first\n` +
      `🔗 *${prefix}wordchain* — word chain (multiplayer)\n\n` +
      `🛑 *${prefix}endgame* — stop the current game\n` +
      `━━━━━━━━━━━━━━━━━━━━━━`;

    await Prince.sendMessage(from, {
      text,
      contextInfo: getContextInfo(sender, newsletterJid, botName),
    }, { quoted: mek });
  }
);

const { gmd, gmdJson, getContextInfo } = require("../mayel");
const axios = require("axios");

/**
 * Music Features
 * Commands: .lyrics2, .musicquiz, .endmusicquiz, .songinfo, .musicmenu
 */

// Music quiz sessions per chat
const quizSessions = new Map();

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getText(m) {
  return (
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    ""
  ).trim().toLowerCase();
}

function senderOf(m, from) {
  return m.key?.senderPn || m.key?.participantPn || m.key?.participant || from;
}

// ─── Music Menu ───────────────────────────────────────────────────────────────

gmd({
  pattern: "musicmenu",
  aliases: ["musics", "musiclist"],
  react: "🎵",
  category: "music",
  description: "Show all music commands",
}, async (from, Prince, conText) => {
  const { reply, mek, botName, botPrefix } = conText;
  const p = botPrefix || ".";
  const menu = `
╭━━〔 *🎵 MUSIC MENU* 〕━━╮
│
│ 🎤 *LYRICS*
│  ▸ ${p}lyrics2 <song name>
│  ▸ ${p}songinfo <song name>
│
│ 🎮 *MUSIC QUIZ*
│  ▸ ${p}musicquiz
│  ▸ ${p}endmusicquiz
│
│ 🎧 *DOWNLOADER*
│  ▸ ${p}play <song name>  (audio)
│  ▸ ${p}ytv <song name>   (video)
│  ▸ ${p}spotify <song>    (Spotify info)
│
╰━━━━━━━━━━━━━━━━━━━━━╯
> *${botName || "HAYWHY_MDX"}*`;
  await reply(menu, { quoted: mek });
});

// ─── Lyrics (with artist info) ────────────────────────────────────────────────

gmd({
  pattern: "lyrics2",
  aliases: ["getlyrics", "songlyrics"],
  react: "🎤",
  category: "music",
  description: "Get lyrics for a song. Usage: .lyrics2 <song name>",
}, async (from, Prince, conText) => {
  const { reply, mek, q, react, PrinceApiKey, PrinceTechApi } = conText;

  if (!q) return reply("🎤 Usage: *.lyrics2 <song name + artist>*\nExample: *.lyrics2 Blinding Lights The Weeknd*");

  await react("⏳");

  try {
    const data = await gmdJson(
      `${PrinceTechApi}/api/music/lyrics?apikey=${encodeURIComponent(PrinceApiKey)}&q=${encodeURIComponent(q)}`
    );

    if (!data || !data.lyrics) {
      await react("❌");
      return reply(`❌ No lyrics found for *"${q}"*. Try being more specific.`);
    }

    const title = data.title || q;
    const artist = data.artist || "Unknown Artist";
    const lyricsText = data.lyrics.slice(0, 3500); // WhatsApp message limit safe

    await Prince.sendMessage(from, {
      text: `🎤 *${title}*\n👤 _${artist}_\n\n${lyricsText}${data.lyrics.length > 3500 ? "\n\n_[lyrics truncated]_" : ""}`,
      quoted: mek,
    });
    await react("✅");
  } catch (e) {
    await react("❌");
    reply(`❌ Couldn't fetch lyrics. Try: *.lyrics <song name>* command or check the song name.`);
  }
});

// ─── Song Info ────────────────────────────────────────────────────────────────

gmd({
  pattern: "songinfo",
  aliases: ["trackinfo", "musicinfo"],
  react: "🎵",
  category: "music",
  description: "Get info about a song",
}, async (from, Prince, conText) => {
  const { reply, mek, q, react, PrinceApiKey, PrinceTechApi } = conText;

  if (!q) return reply("Usage: *.songinfo <song name>*");

  await react("⏳");

  try {
    // Use a general search/info endpoint
    const data = await gmdJson(
      `${PrinceTechApi}/api/music/info?apikey=${encodeURIComponent(PrinceApiKey)}&q=${encodeURIComponent(q)}`
    );

    if (!data || (!data.title && !data.result)) {
      // Fallback: use iTunes search API (public, no key needed)
      const itunes = await axios.get(
        `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=1`
      );
      const track = itunes.data?.results?.[0];
      if (!track) {
        await react("❌");
        return reply(`❌ No song info found for *"${q}"*.`);
      }

      await Prince.sendMessage(from, {
        image: { url: track.artworkUrl100.replace("100x100", "500x500") },
        caption: `🎵 *${track.trackName}*\n👤 Artist: ${track.artistName}\n💿 Album: ${track.collectionName}\n📅 Released: ${track.releaseDate?.slice(0, 10)}\n⏱ Duration: ${Math.floor(track.trackTimeMillis / 60000)}:${String(Math.floor((track.trackTimeMillis % 60000) / 1000)).padStart(2, "0")}\n🎸 Genre: ${track.primaryGenreName}\n\n🔗 Preview: ${track.previewUrl || "N/A"}`,
        quoted: mek,
      });
      await react("✅");
      return;
    }

    await Prince.sendMessage(from, {
      text: `🎵 *Song Info*\n\n${JSON.stringify(data.result || data, null, 2).slice(0, 1500)}`,
      quoted: mek,
    });
    await react("✅");
  } catch (e) {
    // Fallback to iTunes
    try {
      const itunes = await axios.get(
        `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=1`
      );
      const track = itunes.data?.results?.[0];
      if (track) {
        await Prince.sendMessage(from, {
          image: { url: track.artworkUrl100.replace("100x100", "500x500") },
          caption: `🎵 *${track.trackName}*\n👤 Artist: ${track.artistName}\n💿 Album: ${track.collectionName}\n📅 Released: ${track.releaseDate?.slice(0, 10)}\n⏱ Duration: ${Math.floor(track.trackTimeMillis / 60000)}:${String(Math.floor((track.trackTimeMillis % 60000) / 1000)).padStart(2, "0")}\n🎸 Genre: ${track.primaryGenreName}`,
          quoted: mek,
        });
        await react("✅");
      } else {
        await react("❌");
        reply(`❌ No song info found for *"${q}"*.`);
      }
    } catch {
      await react("❌");
      reply("❌ Failed to fetch song info.");
    }
  }
});

// ─── Music Quiz ───────────────────────────────────────────────────────────────

const MUSIC_QUIZ = [
  { hint: "🎤 'Can't stop the feeling, I just wanna dance dance dance...'", answer: "cant stop the feeling", artist: "Justin Timberlake", title: "Can't Stop The Feeling" },
  { hint: "🎤 'Hello from the other side, I must have called a thousand times...'", answer: "hello", artist: "Adele", title: "Hello" },
  { hint: "🎤 'I fall apart, down to my core...'", answer: "i fall apart", artist: "Post Malone", title: "I Fall Apart" },
  { hint: "🎤 'We found love in a hopeless place...'", answer: "we found love", artist: "Rihanna", title: "We Found Love" },
  { hint: "🎤 'Blinding lights, I can't sleep until I feel your touch...'", answer: "blinding lights", artist: "The Weeknd", title: "Blinding Lights" },
  { hint: "🎤 'Shape of you, the club isn't the best place...'", answer: "shape of you", artist: "Ed Sheeran", title: "Shape of You" },
  { hint: "🎤 'Someone like you, I hate to turn up out of the blue...'", answer: "someone like you", artist: "Adele", title: "Someone Like You" },
  { hint: "🎤 'Rolling in the deep, we could have had it all...'", answer: "rolling in the deep", artist: "Adele", title: "Rolling in the Deep" },
  { hint: "🎤 'Stay, stay stay — I was thinking that you could be trusted...'", answer: "stay stay stay", artist: "Taylor Swift", title: "Stay Stay Stay" },
  { hint: "🎤 'Uptown funk you up, uptown funk you up...'", answer: "uptown funk", artist: "Bruno Mars", title: "Uptown Funk" },
  { hint: "🎤 'Closer, let me love you right now, closer...'", answer: "closer", artist: "Chainsmokers", title: "Closer" },
  { hint: "🎤 'Old town road, gonna take my horse...'", answer: "old town road", artist: "Lil Nas X", title: "Old Town Road" },
  { hint: "🎤 'Levitating, I got you moonlight...'", answer: "levitating", artist: "Dua Lipa", title: "Levitating" },
  { hint: "🎤 'Watermelon sugar high...'", answer: "watermelon sugar", artist: "Harry Styles", title: "Watermelon Sugar" },
  { hint: "🎤 'As it was, you know it's not the same as it was...'", answer: "as it was", artist: "Harry Styles", title: "As It Was" },
  { hint: "🎤 'Flowers, I can buy myself flowers...'", answer: "flowers", artist: "Miley Cyrus", title: "Flowers" },
  { hint: "🎤 'Calm down, you need to calm down...'", answer: "calm down", artist: "Rema & Selena Gomez", title: "Calm Down" },
  { hint: "🎤 'Anti-hero, it's me, hi, I'm the problem it's me...'", answer: "anti hero", artist: "Taylor Swift", title: "Anti-Hero" },
  { hint: "🎤 'Creepin, thought it was a dream...'", answer: "creepin", artist: "Metro Boomin & The Weeknd", title: "Creepin'" },
  { hint: "🎤 'Kill bill, I might...'", answer: "kill bill", artist: "SZA", title: "Kill Bill" },
];

gmd({
  pattern: "musicquiz",
  aliases: ["mquiz", "songquiz"],
  react: "🎮",
  category: "music",
  description: "Start a music quiz — guess the song from the lyrics!",
}, async (from, Prince, conText) => {
  const { reply, mek, sender } = conText;

  if (quizSessions.has(from)) {
    return reply("🎮 A music quiz is already running! Type the song name to guess, or use *.endmusicquiz* to stop.");
  }

  const shuffled = [...MUSIC_QUIZ].sort(() => Math.random() - 0.5);
  const session = {
    queue: shuffled,
    index: 0,
    scores: {},
    handler: null,
    timeout: null,
  };

  function nextQuestion() {
    if (session.index >= session.queue.length || session.index >= 10) {
      endQuiz(true);
      return;
    }
    const q = session.queue[session.index];
    resetTimer(q);
    Prince.sendMessage(from, {
      text: `🎵 *MUSIC QUIZ — Round ${session.index + 1}/10*\n\n${q.hint}\n\n_Name this song! You have 30 seconds._`,
    });
  }

  function resetTimer(currentQ) {
    if (session.timeout) clearTimeout(session.timeout);
    session.timeout = setTimeout(async () => {
      if (!quizSessions.has(from)) return;
      const q = session.queue[session.index];
      await Prince.sendMessage(from, {
        text: `⏰ *Time's up!*\nThe answer was: *${q.title}* by *${q.artist}*`,
      });
      session.index++;
      setTimeout(nextQuestion, 2000);
    }, 30000);
  }

  async function endQuiz(natural = false) {
    const s = quizSessions.get(from);
    if (!s) return;
    if (s.handler) Prince.ev.off("messages.upsert", s.handler);
    if (s.timeout) clearTimeout(s.timeout);
    quizSessions.delete(from);

    const sorted = Object.entries(session.scores).sort((a, b) => b[1] - a[1]);
    const scoreboard = sorted.length
      ? sorted.map(([k, v], i) => `${i + 1}. ${k} — ${v} pts 🏅`).join("\n")
      : "No points scored.";

    await Prince.sendMessage(from, {
      text: `🎮 *Music Quiz Ended!*\n\n🏆 *Final Scoreboard:*\n${scoreboard}`,
    });
  }

  session.handler = async ({ messages }) => {
    const m = messages[0];
    if (!m?.message || m.key.fromMe || m.key.remoteJid !== from) return;

    const text = getText(m);
    if (!text) return;
    if (text === ".endmusicquiz") { endQuiz(false); return; }

    if (session.index >= session.queue.length || session.index >= 10) return;
    const currentQ = session.queue[session.index];

    const answers = [currentQ.answer, currentQ.title.toLowerCase()];
    const isCorrect = answers.some(a => text.includes(a) || a.includes(text.replace(/[^a-z0-9 ]/g, "")));

    if (isCorrect) {
      const player = senderOf(m, from);
      const playerName = m.pushName || player.split("@")[0];
      session.scores[playerName] = (session.scores[playerName] || 0) + 1;

      if (session.timeout) clearTimeout(session.timeout);
      await Prince.sendMessage(from, {
        text: `✅ *${playerName}* got it!\n🎵 *${currentQ.title}* by *${currentQ.artist}*\n\n🏅 Score: ${session.scores[playerName]} pts`,
        quoted: m,
      });
      session.index++;
      setTimeout(nextQuestion, 2500);
    }
  };

  Prince.ev.on("messages.upsert", session.handler);
  quizSessions.set(from, session);

  await Prince.sendMessage(from, {
    text: `🎮 *MUSIC QUIZ STARTED!*\n\n📋 10 rounds — identify the song from the lyrics!\n⏱ 30 seconds per round\n\n_Starting in 3 seconds..._`,
    quoted: mek,
  });
  setTimeout(nextQuestion, 3000);
});

gmd({
  pattern: "endmusicquiz",
  aliases: ["stopmquiz"],
  react: "🛑",
  category: "music",
  description: "End the music quiz",
}, async (from, Prince, conText) => {
  const { reply, mek } = conText;
  const s = quizSessions.get(from);
  if (!s) return reply("❌ No music quiz running here.");

  if (s.handler) Prince.ev.off("messages.upsert", s.handler);
  if (s.timeout) clearTimeout(s.timeout);

  const sorted = Object.entries(s.scores).sort((a, b) => b[1] - a[1]);
  const scoreboard = sorted.length
    ? sorted.map(([k, v], i) => `${i + 1}. ${k} — ${v} pts`).join("\n")
    : "No points scored.";

  quizSessions.delete(from);
  await reply(`🛑 *Music Quiz Ended!*\n\n🏆 *Scoreboard:*\n${scoreboard}`, { quoted: mek });
});

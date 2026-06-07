const { gmd, getContextInfo, gmdJson } = require("../mayel");
const axios = require("axios");

const MAX_MEDIA_SIZE = 60 * 1024 * 1024;

async function getFileSize(url) {
  try {
    const res = await axios.head(url, { timeout: 10000 });
    return parseInt(res.headers["content-length"] || "0", 10);
  } catch { return 0; }
}

gmd(
  {
    pattern: "movie",
    category: "downloader",
    react: "🎬",
    aliases: ["film", "moviedl", "moviesearch"],
    description: "Search and download a movie. Usage: .movie <title>",
  },
  async (from, Prince, conText) => {
    const { q, mek, reply, react, sender, botName, botFooter, botPic, newsletterJid, PrinceTechApi, PrinceApiKey } = conText;

    if (!q) {
      await react("❌");
      return reply(
        "🎬 *MOVIE DOWNLOADER*\n\n" +
        "Please provide a movie title to search.\n\n" +
        "*Usage:* .movie <title>\n" +
        "*Example:* .movie Avengers Endgame"
      );
    }

    await react("🔍");
    await reply(`🔍 Searching for *${q}*...`);

    try {
      const searchUrl = `${PrinceTechApi}/api/download/movie?apikey=${PrinceApiKey}&title=${encodeURIComponent(q)}`;
      const response = await axios.get(searchUrl, { timeout: 30000 });

      if (!response.data?.success || !response.data?.result) {
        await react("❌");
        return reply("❌ No results found for *" + q + "*.\n\nTry a different title or check the spelling.");
      }

      const result = response.data.result;

      const isArray = Array.isArray(result);
      const movies = isArray ? result.slice(0, 5) : [result];

      if (movies.length === 0) {
        await react("❌");
        return reply("❌ No movies found for *" + q + "*.");
      }

      if (movies.length === 1 || !isArray) {
        const movie = movies[0];
        await handleMovieDownload(Prince, from, mek, movie, react, reply, sender, botName, botFooter, botPic, newsletterJid);
        return;
      }

      const listText =
        `🎬 *${botName} MOVIE SEARCH*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Results for: *${q}*\n\n` +
        movies.map((m, i) =>
          `${i + 1}️⃣ *${m.title || m.name || "Unknown"}* (${m.year || m.release_date?.slice(0, 4) || "N/A"})\n` +
          `   🎭 ${m.genre || m.genres?.join(", ") || "N/A"} | ⭐ ${m.rating || m.vote_average || "N/A"}`
        ).join("\n\n") +
        `\n\n━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⏱ *Reply with a number (1-${movies.length}) to download*`;

      const menuMsg = await Prince.sendMessage(from, {
        image: { url: movies[0]?.thumbnail || movies[0]?.poster || botPic },
        caption: listText,
        contextInfo: getContextInfo(sender, newsletterJid, botName),
      }, { quoted: mek });

      const menuId = menuMsg.key.id;

      const handleChoice = async (event) => {
        const msgData = event.messages[0];
        if (!msgData?.message) return;
        const isReply = msgData.message.extendedTextMessage?.contextInfo?.stanzaId === menuId;
        if (!isReply) return;

        const choice = (msgData.message.conversation || msgData.message.extendedTextMessage?.text || "").trim();
        const idx = parseInt(choice, 10) - 1;

        if (isNaN(idx) || idx < 0 || idx >= movies.length) {
          await reply("⚠️ Invalid choice. Reply with a number between 1 and " + movies.length + ".");
          return;
        }

        Prince.ev.off("messages.upsert", handleChoice);
        await handleMovieDownload(Prince, from, msgData, movies[idx], react, reply, sender, botName, botFooter, botPic, newsletterJid);
      };

      Prince.ev.on("messages.upsert", handleChoice);
      setTimeout(() => Prince.ev.off("messages.upsert", handleChoice), 120000);

    } catch (error) {
      console.error("Movie search error:", error);
      await react("❌");
      return reply("❌ Failed to search for movies. Please try again later.");
    }
  }
);

async function handleMovieDownload(Prince, from, quotedMsg, movie, react, reply, sender, botName, botFooter, botPic, newsletterJid) {
  const title = movie.title || movie.name || "Movie";
  const year = movie.year || movie.release_date?.slice(0, 4) || "N/A";
  const rating = movie.rating || movie.vote_average || "N/A";
  const genre = movie.genre || (Array.isArray(movie.genres) ? movie.genres.join(", ") : movie.genres) || "N/A";
  const overview = movie.overview || movie.description || movie.synopsis || "";
  const thumbnail = movie.thumbnail || movie.poster || movie.cover || botPic;

  const downloads = [];
  if (movie.download_url) downloads.push({ label: "Download 🎬", url: movie.download_url });
  if (movie.hd_url || movie.hd) downloads.push({ label: "HD Quality 🎥", url: movie.hd_url || movie.hd });
  if (movie.sd_url || movie.sd) downloads.push({ label: "SD Quality 📹", url: movie.sd_url || movie.sd });
  if (Array.isArray(movie.downloads)) {
    movie.downloads.forEach((d, i) => {
      if (d.url) downloads.push({ label: d.quality || d.label || `Option ${i + 1}`, url: d.url });
    });
  }

  if (downloads.length === 0) {
    await react("❌");
    return reply(
      `🎬 *${title}* (${year})\n\n` +
      `❌ No direct download links found for this movie.\n\n` +
      (movie.stream_url ? `🔗 *Stream:* ${movie.stream_url}` : "Try searching with a different title.")
    );
  }

  if (downloads.length === 1) {
    await react("⬇️");
    return sendMovieFile(Prince, from, quotedMsg, downloads[0].url, title, react, reply, botFooter);
  }

  const optionLines = downloads.map((d, i) => `│${i + 1}️⃣ ${d.label}`).join("\n");
  const actionMap = {};
  downloads.forEach((d, i) => { actionMap[String(i + 1)] = d.url; });

  const infoMsg = await Prince.sendMessage(from, {
    image: { url: thumbnail },
    caption:
      `> *${botName} MOVIE DOWNLOADER*\n` +
      `╭───────────────◆\n` +
      `│🎬 *${title}* (${year})\n` +
      `│⭐ *Rating:* ${rating}\n` +
      `│🎭 *Genre:* ${genre}\n` +
      (overview ? `│📝 *Plot:* ${overview.slice(0, 150)}${overview.length > 150 ? "..." : ""}\n` : "") +
      `╰────────────────◆\n` +
      `⏱ *Session expires in 2 minutes*\n` +
      `╭───────────────◆\n` +
      `│Reply with:\n` +
      `${optionLines}\n` +
      `╰────────────────◆`,
    contextInfo: getContextInfo(sender, newsletterJid, botName),
  }, { quoted: quotedMsg });

  const infoId = infoMsg.key.id;

  const handleDownload = async (event) => {
    const msgData = event.messages[0];
    if (!msgData?.message) return;
    const isReply = msgData.message.extendedTextMessage?.contextInfo?.stanzaId === infoId;
    if (!isReply) return;

    const choice = (msgData.message.conversation || msgData.message.extendedTextMessage?.text || "").trim();
    const url = actionMap[choice];

    if (!url) {
      await reply("⚠️ Invalid option. Reply with a number from the list.");
      return;
    }

    Prince.ev.off("messages.upsert", handleDownload);
    await react("⬇️");
    await sendMovieFile(Prince, from, msgData, url, title, react, reply, botFooter);
  };

  Prince.ev.on("messages.upsert", handleDownload);
  setTimeout(() => Prince.ev.off("messages.upsert", handleDownload), 120000);
}

async function sendMovieFile(Prince, from, quotedMsg, url, title, react, reply, botFooter) {
  try {
    const fileSize = await getFileSize(url);
    const safeTitle = title.replace(/[^\w\s.-]/gi, "").trim();

    if (fileSize > MAX_MEDIA_SIZE || fileSize === 0) {
      await Prince.sendMessage(from, {
        document: { url },
        fileName: `${safeTitle}.mp4`,
        mimetype: "video/mp4",
        caption: `🎬 *${title}*\n\n> ${botFooter}`,
      }, { quoted: quotedMsg });
    } else {
      await Prince.sendMessage(from, {
        video: { url },
        mimetype: "video/mp4",
        caption: `🎬 *${title}*\n\n> ${botFooter}`,
      }, { quoted: quotedMsg });
    }

    await react("✅");
  } catch (err) {
    console.error("Movie file send error:", err);
    await react("❌");
    await reply("❌ Failed to send the movie file. Please try again.");
  }
}

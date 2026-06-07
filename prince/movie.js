const { gmd, getContextInfo } = require("../mayel");
const axios = require("axios");

const MAX_MEDIA_SIZE = 60 * 1024 * 1024;

async function getFileSizeSafe(url) {
  try {
    const res = await axios.head(url, { timeout: 8000 });
    return parseInt(res.headers["content-length"] || "0", 10);
  } catch { return 0; }
}

// Try each API endpoint in order, return first success
async function tryEndpoints(endpoints, timeout = 25000) {
  for (const { url, transform } of endpoints) {
    try {
      const res = await axios.get(url, { timeout });
      const data = res.data;
      if (data && (data.success || data.status === true || data.status === "success")) {
        const result = transform ? transform(data) : data.result;
        if (result) return result;
      }
    } catch (_) {
      continue;
    }
  }
  return null;
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
    const {
      q, mek, reply, react, sender, botName, botFooter, botPic,
      newsletterJid, gmdBuffer, PrinceTechApi, PrinceApiKey,
    } = conText;

    if (!q) {
      await react("❌");
      return reply(
        "🎬 *MOVIE DOWNLOADER*\n\n" +
        "Please provide a movie title.\n\n" +
        "*Usage:* .movie <title>\n" +
        "*Example:* .movie Avengers Endgame"
      );
    }

    await react("🔍");
    const searchingMsg = await reply(`🔍 Searching for *${q}*...`);

    try {
      const enc = encodeURIComponent(q);
      const base = `${PrinceTechApi}/api`;
      const key = `apikey=${PrinceApiKey}`;

      // ── Step 1: Search for movie info ────────────────────────────────────
      const searchEndpoints = [
        {
          url: `${base}/search/moviesearch?${key}&query=${enc}`,
          transform: (d) => d.result || d.results || d.data,
        },
        {
          url: `${base}/download/movie?${key}&title=${enc}`,
          transform: (d) => d.result || d.data,
        },
        {
          url: `${base}/download/moviedl?${key}&query=${enc}`,
          transform: (d) => d.result || d.data,
        },
        {
          url: `${base}/download/fzmovie?${key}&query=${enc}`,
          transform: (d) => d.result || d.data,
        },
        {
          url: `${base}/search/movie?${key}&query=${enc}`,
          transform: (d) => d.result || d.results || d.data,
        },
      ];

      let rawResult = null;
      for (const ep of searchEndpoints) {
        try {
          const res = await axios.get(ep.url, { timeout: 25000 });
          const d = res.data;
          if (d && (d.success === true || d.status === true || d.status === "success" || d.ok === true)) {
            const r = ep.transform(d);
            if (r && (Array.isArray(r) ? r.length > 0 : true)) {
              rawResult = r;
              break;
            }
          }
        } catch (_) { continue; }
      }

      if (!rawResult) {
        await react("❌");
        return reply(
          `❌ No movies found for *${q}*.\n\n` +
          `Try a different title or check the spelling.`
        );
      }

      const movies = Array.isArray(rawResult) ? rawResult.slice(0, 5) : [rawResult];

      const selectAndDownload = async (movie, quotedMsg) => {
        await handleMovieChoice(
          Prince, from, quotedMsg, movie, react, reply,
          sender, botName, botFooter, botPic, newsletterJid,
          gmdBuffer, PrinceTechApi, PrinceApiKey
        );
      };

      if (movies.length === 1) {
        return selectAndDownload(movies[0], mek);
      }

      // ── Step 2: Show search results list ─────────────────────────────────
      const listLines = movies.map((m, i) => {
        const title = m.title || m.name || m.movie_name || "Unknown";
        const year = m.year || m.release_date?.slice(0, 4) || "";
        const rating = m.rating || m.imdb || m.vote_average || "";
        return (
          `│${i + 1}️⃣ *${title}*${year ? ` (${year})` : ""}` +
          (rating ? ` ⭐ ${rating}` : "")
        );
      }).join("\n");

      const thumbnail = movies[0]?.thumbnail || movies[0]?.poster || movies[0]?.cover || botPic;

      const listMsg = await Prince.sendMessage(from, {
        image: { url: thumbnail },
        caption:
          `> *${botName} MOVIE SEARCH*\n` +
          `╭───────────────◆\n` +
          `│🔍 *Results for:* ${q}\n` +
          `╰────────────────◆\n` +
          `${listLines}\n\n` +
          `⏱ *Reply with a number (1-${movies.length}) to select*`,
        contextInfo: getContextInfo(sender, newsletterJid, botName),
      }, { quoted: mek });

      const listId = listMsg.key.id;

      const handleChoice = async (event) => {
        const msgData = event.messages[0];
        if (!msgData?.message || msgData.key.remoteJid !== from) return;
        const isReply = msgData.message.extendedTextMessage?.contextInfo?.stanzaId === listId;
        if (!isReply) return;

        const choice = (msgData.message.conversation || msgData.message.extendedTextMessage?.text || "").trim();
        const idx = parseInt(choice, 10) - 1;

        if (isNaN(idx) || idx < 0 || idx >= movies.length) {
          await reply(`⚠️ Please reply with a number between 1 and ${movies.length}.`);
          return;
        }

        Prince.ev.off("messages.upsert", handleChoice);
        await selectAndDownload(movies[idx], msgData);
      };

      Prince.ev.on("messages.upsert", handleChoice);
      setTimeout(() => Prince.ev.off("messages.upsert", handleChoice), 120000);

    } catch (err) {
      console.error("Movie search error:", err.message);
      await react("❌");
      return reply("❌ Failed to search for movies. Please try again later.");
    }
  }
);

async function handleMovieChoice(
  Prince, from, quotedMsg, movie, react, reply,
  sender, botName, botFooter, botPic, newsletterJid,
  gmdBuffer, PrinceTechApi, PrinceApiKey
) {
  const title = movie.title || movie.name || movie.movie_name || "Movie";
  const year = movie.year || movie.release_date?.slice(0, 4) || "";
  const rating = movie.rating || movie.imdb || movie.vote_average || "N/A";
  const genre = movie.genre || (Array.isArray(movie.genres) ? movie.genres.join(", ") : movie.genres) || "N/A";
  const overview = movie.overview || movie.description || movie.synopsis || movie.plot || "";
  const thumbnail = movie.thumbnail || movie.poster || movie.cover || movie.image || botPic;

  // Collect all available download links from the movie object
  const downloads = [];
  const addLink = (label, url) => { if (url && typeof url === "string") downloads.push({ label, url }); };

  addLink("🎬 Download", movie.download_url || movie.downloadUrl);
  addLink("🎥 HD Quality", movie.hd_url || movie.hd || movie.hd_download);
  addLink("📹 SD Quality", movie.sd_url || movie.sd || movie.sd_download);
  addLink("🎞 480p", movie["480p"] || movie.p480);
  addLink("📺 720p", movie["720p"] || movie.p720);
  addLink("💿 1080p", movie["1080p"] || movie.p1080);

  if (Array.isArray(movie.downloads)) {
    for (const d of movie.downloads) {
      if (d?.url) addLink(d.quality || d.label || d.size || "📥 Download", d.url);
    }
  }
  if (Array.isArray(movie.links)) {
    for (const d of movie.links) {
      if (d?.url || d?.link) addLink(d.quality || d.label || "📥 Download", d.url || d.link);
    }
  }

  // If still no links, try fetching download links from a detail endpoint
  if (downloads.length === 0 && (movie.id || movie.slug || movie.link || movie.url)) {
    const detailUrl = movie.link || movie.url || movie.detail_url;
    if (detailUrl) {
      try {
        const enc = encodeURIComponent(detailUrl);
        const dlEndpoints = [
          `${PrinceTechApi}/api/download/moviedl?apikey=${PrinceApiKey}&url=${enc}`,
          `${PrinceTechApi}/api/download/movie?apikey=${PrinceApiKey}&url=${enc}`,
          `${PrinceTechApi}/api/download/fzmovie?apikey=${PrinceApiKey}&url=${enc}`,
        ];
        for (const ep of dlEndpoints) {
          try {
            const res = await axios.get(ep, { timeout: 20000 });
            const d = res.data;
            if (d?.success || d?.status === true) {
              const r = d.result || d.data || {};
              addLink("🎬 Download", r.download_url || r.link);
              addLink("🎥 HD", r.hd_url || r.hd);
              addLink("📹 SD", r.sd_url || r.sd);
              if (Array.isArray(r.downloads)) {
                for (const x of r.downloads) {
                  if (x?.url) addLink(x.quality || "📥 Option", x.url);
                }
              }
              if (downloads.length > 0) break;
            }
          } catch (_) { continue; }
        }
      } catch (_) {}
    }
  }

  // ── Info card ─────────────────────────────────────────────────────────────
  const infoCaption =
    `> *${botName} MOVIE DOWNLOADER*\n` +
    `╭───────────────◆\n` +
    `│🎬 *${title}*${year ? ` (${year})` : ""}\n` +
    `│⭐ *Rating:* ${rating}\n` +
    `│🎭 *Genre:* ${genre}\n` +
    (overview ? `│📝 ${overview.slice(0, 200)}${overview.length > 200 ? "..." : ""}\n` : "") +
    `╰────────────────◆`;

  if (downloads.length === 0) {
    await Prince.sendMessage(from, {
      image: { url: thumbnail },
      caption: infoCaption + `\n\n❌ *No download links found.*\nTry searching with a different title.`,
      contextInfo: getContextInfo(sender, newsletterJid, botName),
    }, { quoted: quotedMsg });
    await react("❌");
    return;
  }

  if (downloads.length === 1) {
    await react("⬇️");
    await Prince.sendMessage(from, {
      image: { url: thumbnail },
      caption: infoCaption,
      contextInfo: getContextInfo(sender, newsletterJid, botName),
    }, { quoted: quotedMsg });
    return sendMovieFile(Prince, from, quotedMsg, downloads[0].url, title, react, reply, botFooter, gmdBuffer);
  }

  // Multiple quality options — show selection menu
  const optionLines = downloads.map((d, i) => `│${i + 1}️⃣ ${d.label}`).join("\n");
  const actionMap = {};
  downloads.forEach((d, i) => { actionMap[String(i + 1)] = d.url; });

  const infoMsg = await Prince.sendMessage(from, {
    image: { url: thumbnail },
    caption:
      infoCaption + "\n" +
      `⏱ *Session expires in 2 minutes*\n` +
      `╭───────────────◆\n` +
      `│Reply with quality:\n` +
      `${optionLines}\n` +
      `╰────────────────◆`,
    contextInfo: getContextInfo(sender, newsletterJid, botName),
  }, { quoted: quotedMsg });

  const infoId = infoMsg.key.id;

  const handleDownload = async (event) => {
    const msgData = event.messages[0];
    if (!msgData?.message || msgData.key.remoteJid !== from) return;
    const isReply = msgData.message.extendedTextMessage?.contextInfo?.stanzaId === infoId;
    if (!isReply) return;

    const choice = (msgData.message.conversation || msgData.message.extendedTextMessage?.text || "").trim();
    const url = actionMap[choice];

    if (!url) {
      await reply(`⚠️ Invalid option. Reply with a number from 1 to ${downloads.length}.`);
      return;
    }

    Prince.ev.off("messages.upsert", handleDownload);
    await react("⬇️");
    await sendMovieFile(Prince, from, msgData, url, title, react, reply, botFooter, gmdBuffer);
  };

  Prince.ev.on("messages.upsert", handleDownload);
  setTimeout(() => Prince.ev.off("messages.upsert", handleDownload), 120000);
}

async function sendMovieFile(Prince, from, quotedMsg, url, title, react, reply, botFooter, gmdBuffer) {
  try {
    const safeTitle = title.replace(/[^\w\s.-]/gi, "").trim() || "movie";
    const fileSize = await getFileSizeSafe(url);

    if (fileSize > MAX_MEDIA_SIZE || fileSize === 0) {
      await Prince.sendMessage(from, {
        document: { url },
        fileName: `${safeTitle}.mp4`,
        mimetype: "video/mp4",
        caption: `🎬 *${title}*\n\n> *${botFooter}*`,
      }, { quoted: quotedMsg });
    } else {
      try {
        const buf = await gmdBuffer(url);
        await Prince.sendMessage(from, {
          video: buf,
          mimetype: "video/mp4",
          caption: `🎬 *${title}*\n\n> *${botFooter}*`,
        }, { quoted: quotedMsg });
      } catch (_) {
        await Prince.sendMessage(from, {
          document: { url },
          fileName: `${safeTitle}.mp4`,
          mimetype: "video/mp4",
          caption: `🎬 *${title}*\n\n> *${botFooter}*`,
        }, { quoted: quotedMsg });
      }
    }

    await react("✅");
  } catch (err) {
    console.error("Movie send error:", err.message);
    await react("❌");
    await reply("❌ Failed to send the movie file. Please try again.");
  }
}

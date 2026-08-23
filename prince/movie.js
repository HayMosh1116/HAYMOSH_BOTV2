const { gmd, getChannelContext: getContextInfo } = require("../mayel");
const axios = require("axios");

const MAX_MOVIE_SIZE = 400 * 1024 * 1024;

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "?";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
}

const YTS_MIRRORS = [
  "https://movies-api.accel.li/api/v2/list_movies.json",
  "https://yts.lt/api/v2/list_movies.json",
  "https://yts.mx/api/v2/list_movies.json",
  "https://yts.do/api/v2/list_movies.json",
  "https://yts-proxy.fun/api/v2/list_movies.json",
];

async function searchYTS(query) {
  const params = `query_term=${encodeURIComponent(query)}&limit=5&with_rt_ratings=true&sort_by=download_count`;
  for (const mirror of [...new Set(YTS_MIRRORS)]) {
    try {
      const res = await axios.get(`${mirror}?${params}`, { timeout: 10000 });
      if (res.data?.status === "ok" && res.data?.data?.movie_count > 0) {
        return res.data.data.movies || [];
      }
    } catch (_) { continue; }
  }
  return [];
}

async function searchPrinceTech(query, PrinceTechApi, PrinceApiKey) {
  const enc = encodeURIComponent(query);
  const key = `apikey=${PrinceApiKey}`;
  const endpoints = [
    `${PrinceTechApi}/api/search/moviesearch?${key}&query=${enc}`,
    `${PrinceTechApi}/api/download/movie?${key}&title=${enc}`,
    `${PrinceTechApi}/api/download/moviedl?${key}&query=${enc}`,
    `${PrinceTechApi}/api/download/fzmovie?${key}&query=${enc}`,
    `${PrinceTechApi}/search/movie?${key}&query=${enc}`,
  ];
  for (const ep of endpoints) {
    try {
      const res = await axios.get(ep, { timeout: 12000 });
      const d = res.data;
      if (d?.success === true || d?.status === true || d?.status === "ok") {
        const r = d.result || d.data || d.results || d.movies;
        if (r && (Array.isArray(r) ? r.length > 0 : Object.keys(r).length > 0)) {
          return Array.isArray(r) ? r.slice(0, 5) : [r];
        }
      }
    } catch (_) { continue; }
  }
  return [];
}

gmd(
  {
    pattern: "movie",
    category: "downloader",
    react: "🎬",
    aliases: ["film", "moviedl", "moviesearch"],
    description: "Search for a movie — poster, info & download links. Usage: .movie <title>",
  },
  async (from, Prince, conText) => {
    const {
      q, mek, reply, react, sender, botName, botFooter, botPic,
      newsletterJid, PrinceTechApi, PrinceApiKey,
    } = conText;

    if (!q) {
      await react("❌");
      return reply(
        "🎬 *MOVIE SEARCH*\n\n" +
        "Please provide a movie title.\n\n" +
        "*Usage:* .movie <title>\n" +
        "*Example:* .movie Avengers Endgame"
      );
    }

    await react("🔍");
    await reply(`🔍 Searching for *${q}*...`);

    try {
      // Primary: YTS.mx (free, no key, always works for English films)
      let movies = await searchYTS(q);

      // Fallback: PrinceTech API
      if (movies.length === 0) {
        movies = await searchPrinceTech(q, PrinceTechApi, PrinceApiKey);
      }

      if (movies.length === 0) {
        await react("❌");
        return reply(
          `❌ No movies found for *${q}*.\n\n` +
          `Tips:\n• Check spelling\n• Use English title\n• Try the year: ".movie Joker 2019"`
        );
      }

      const formatMovie = (m) => {
        const isYts = !!m.large_cover_image;
        const downloads = [];
        if (isYts && Array.isArray(m.torrents)) {
          for (const t of m.torrents) {
            const sizeBytes = Number(t.size_bytes);
            // YTS provides torrent files, not direct movie files. Only show
            // real torrent-file URLs for releases whose movie size is <=400MB.
            if (isHttpUrl(t.url) && sizeBytes > 0 && sizeBytes <= MAX_MOVIE_SIZE) {
              downloads.push({
                label: `${t.quality || "Movie"} — ${formatBytes(sizeBytes)}`,
                link: t.url,
                type: "file",
                fileName: `${(m.title || "movie").replace(/[^a-z0-9]+/gi, "_")}_${t.quality || "download"}.torrent`,
                sizeBytes,
              });
            }
          }
        } else {
          // PrinceTech-style response
          const addDirectFile = (label, link, sizeBytes) => {
            const bytes = Number(sizeBytes);
            if (isHttpUrl(link) && bytes > 0 && bytes <= MAX_MOVIE_SIZE) {
              downloads.push({ label: `${label} — ${formatBytes(bytes)}`, link, type: "file", sizeBytes: bytes });
            }
          };
          addDirectFile("🎬 Download", m.download_url, m.size_bytes || m.size);
          addDirectFile("🎥 HD", m.hd_url || m.hd, m.hd_size_bytes || m.hd_size);
          addDirectFile("📺 720p", m["720p"], m["720p_size_bytes"]);
          addDirectFile("💿 1080p", m["1080p"], m["1080p_size_bytes"]);
          if (Array.isArray(m.downloads)) {
            for (const d of m.downloads) {
              addDirectFile(d.quality || d.label || "📥", d.url, d.size_bytes || d.size);
            }
          }
        }
        return {
          title: m.title || m.name || "Unknown",
          year: m.year || "",
          rating: m.rating || m.imdb || "N/A",
          genres: Array.isArray(m.genres) ? m.genres.join(", ") : (m.genre || "N/A"),
          summary: (m.summary || m.description_full || m.overview || "").slice(0, 280),
          poster: m.large_cover_image || m.thumbnail || m.poster || botPic,
          downloads,
        };
      };

      const sendMovieCard = async (movie, quotedMsg) => {
        const info = formatMovie(movie);
        const plotLine = info.summary
          ? `│📝 ${info.summary}${info.summary.length >= 280 ? "..." : ""}\n`
          : "";

        const infoBlock =
          `╭───────────────◆\n` +
          `│🎬 *${info.title}*${info.year ? ` (${info.year})` : ""}\n` +
          `│⭐ *Rating:* ${info.rating}/10\n` +
          `│🎭 *Genre:* ${info.genres}\n` +
          `${plotLine}` +
          `╰────────────────◆`;

        if (info.downloads.length === 0) {
          await Prince.sendMessage(from, {
            image: { url: info.poster },
            caption:
              infoBlock +
              `\n\n❌ No downloadable release at or below *400 MB* was found for this movie.` +
              `\n\n> *${botFooter}*`,
            contextInfo: getContextInfo(sender, newsletterJid, botName),
          }, { quoted: quotedMsg });
          await react("✅");
          return;
        }

        const sendDownloadFile = async (dl, quotedMsg) => {
          const caption =
            `${infoBlock}\n\n` +
            `📥 *File:* ${dl.fileName || `${info.title}.mp4`}\n` +
            `📦 *Movie size:* ${formatBytes(dl.sizeBytes)}\n` +
            `⚠️ YTS supplies a torrent file; open it in a torrent client to download the movie.\n\n` +
            `> *${botFooter}*`;
          await Prince.sendMessage(from, {
            document: { url: dl.link },
            fileName: dl.fileName || `${info.title}.mp4`,
            mimetype: dl.fileName?.endsWith(".torrent") ? "application/x-bittorrent" : "application/octet-stream",
            caption,
            contextInfo: getContextInfo(sender, newsletterJid, botName),
          }, { quoted: quotedMsg });
        };

        if (info.downloads.length === 1) {
          const dl = info.downloads[0];
          await sendDownloadFile(dl, quotedMsg);
          await react("✅");
          return;
        }

        // Multiple quality options — show selection menu
        const optLines = info.downloads.map((d, i) => `│${i + 1}️⃣ ${d.label}`).join("\n");

        const qualityMsg = await Prince.sendMessage(from, {
          image: { url: info.poster },
          caption:
            `${infoBlock}\n\n` +
            `⏱ *Session expires in 2 minutes*\n` +
            `╭───────────────◆\n` +
            `│📥 Reply with quality:\n` +
            `${optLines}\n` +
            `╰────────────────◆`,
          contextInfo: getContextInfo(sender, newsletterJid, botName),
        }, { quoted: quotedMsg });

        const qualityId = qualityMsg.key.id;

        const handleQuality = async (event) => {
          const msgData = event.messages[0];
          if (!msgData?.message || msgData.key.remoteJid !== from) return;
          const isReply = msgData.message.extendedTextMessage?.contextInfo?.stanzaId === qualityId;
          if (!isReply) return;

          const choice = (msgData.message.conversation || msgData.message.extendedTextMessage?.text || "").trim();
          const idx = parseInt(choice, 10) - 1;

          if (isNaN(idx) || idx < 0 || idx >= info.downloads.length) {
            await reply(`⚠️ Please reply with a number from 1 to ${info.downloads.length}.`);
            return;
          }

          Prince.ev.off("messages.upsert", handleQuality);
          const dl = info.downloads[idx];

          await sendDownloadFile(dl, msgData);
          await react("✅");
        };

        Prince.ev.on("messages.upsert", handleQuality);
        setTimeout(() => Prince.ev.off("messages.upsert", handleQuality), 120000);
      };

      if (movies.length === 1) {
        return sendMovieCard(movies[0], mek);
      }

      // Show search results list
      const listLines = movies.map((m, i) => {
        const title = m.title || m.name || "Unknown";
        const year = m.year || "";
        const rating = m.rating || m.imdb || "";
        return `│${i + 1}️⃣ *${title}*${year ? ` (${year})` : ""}${rating ? ` ⭐${rating}` : ""}`;
      }).join("\n");

      const cover = movies[0]?.large_cover_image || movies[0]?.thumbnail || movies[0]?.poster || botPic;

      const listMsg = await Prince.sendMessage(from, {
        image: { url: cover },
        caption:
          `> *${botName} MOVIE SEARCH*\n` +
          `╭───────────────◆\n` +
          `│🔍 Results for: *${q}*\n` +
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
        await sendMovieCard(movies[idx], msgData);
      };

      Prince.ev.on("messages.upsert", handleChoice);
      setTimeout(() => Prince.ev.off("messages.upsert", handleChoice), 120000);

    } catch (err) {
      console.error("Movie error:", err?.message || err);
      await react("❌");
      return reply("❌ Failed to search. Please try again later.");
    }
  }
);

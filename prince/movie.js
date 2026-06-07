const { gmd, getContextInfo } = require("../mayel");
const axios = require("axios");

const MAX_MEDIA_SIZE = 60 * 1024 * 1024;

// Build a magnet link from a YTS torrent hash
const TRACKERS = [
  "udp://open.tracker.cl:1337/announce",
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://tracker.openbittorrent.com:6969/announce",
  "udp://9.rarbg.to:2940/announce",
  "udp://tracker.leechers-paradise.org:6969/announce",
].map(t => `&tr=${encodeURIComponent(t)}`).join("");

function makeMagnet(hash, title) {
  return `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(title)}${TRACKERS}`;
}

async function searchYTS(query) {
  const url = `https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(query)}&limit=5&with_rt_ratings=true&sort_by=download_count`;
  const res = await axios.get(url, { timeout: 15000 });
  if (res.data?.status === "ok" && res.data?.data?.movie_count > 0) {
    return res.data.data.movies || [];
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
            if (t.hash) {
              downloads.push({
                label: `${t.quality} — ${t.size || "?"}`,
                link: makeMagnet(t.hash, m.title),
                type: "magnet",
              });
            }
          }
        } else {
          // PrinceTech-style response
          if (m.download_url) downloads.push({ label: "🎬 Download", link: m.download_url, type: "url" });
          if (m.hd_url || m.hd) downloads.push({ label: "🎥 HD", link: m.hd_url || m.hd, type: "url" });
          if (m["720p"]) downloads.push({ label: "📺 720p", link: m["720p"], type: "url" });
          if (m["1080p"]) downloads.push({ label: "💿 1080p", link: m["1080p"], type: "url" });
          if (Array.isArray(m.downloads)) {
            for (const d of m.downloads) {
              if (d?.url) downloads.push({ label: d.quality || d.label || "📥", link: d.url, type: "url" });
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
            caption: infoBlock + `\n\n> *${botFooter}*`,
            contextInfo: getContextInfo(sender, newsletterJid, botName),
          }, { quoted: quotedMsg });
          await react("✅");
          return;
        }

        if (info.downloads.length === 1) {
          const dl = info.downloads[0];
          await Prince.sendMessage(from, {
            image: { url: info.poster },
            caption:
              `${infoBlock}\n\n` +
              `📥 *${dl.label}:*\n${dl.link}\n\n` +
              `> *${botFooter}*`,
            contextInfo: getContextInfo(sender, newsletterJid, botName),
          }, { quoted: quotedMsg });
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

          await Prince.sendMessage(from, {
            text:
              `🎬 *${info.title}* — ${dl.label}\n\n` +
              `📥 *Download Link:*\n${dl.link}\n\n` +
              `> *${botFooter}*`,
          }, { quoted: msgData });
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
      console.error("Movie error:", err.message);
      await react("❌");
      return reply("❌ Failed to search. Please try again later.");
    }
  }
);

const { gmd, gmdJson, getContextInfo } = require("../mayel");
const axios = require("axios");

/**
 * Movie & Series Downloader / Info
 * Commands: .movie, .moviesearch, .moviedown, .series, .moviemenu
 */

// ─── Movie Menu ───────────────────────────────────────────────────────────────

gmd({
  pattern: "moviemenu",
  aliases: ["movies", "filmsmenu"],
  react: "🎬",
  category: "downloads",
  description: "Show movie & series commands",
}, async (from, Prince, conText) => {
  const { reply, mek, botName, botPrefix } = conText;
  const p = botPrefix || ".";
  const menu = `
╭━━〔 *🎬 MOVIES MENU* 〕━━╮
│
│ 🔍 *SEARCH & INFO*
│  ▸ ${p}movie <title>
│  ▸ ${p}series <title>
│  ▸ ${p}moviesearch <title>
│
│ 📥 *DOWNLOAD LINKS*
│  ▸ ${p}moviedown <title>
│  ▸ ${p}fzmovies <title>
│  ▸ ${p}netnaija <title>
│
╰━━━━━━━━━━━━━━━━━━━━━╯
> *${botName || "HAYWHY_MDX"}*`;
  await reply(menu, { quoted: mek });
});

// ─── Movie Info (OMDB) ────────────────────────────────────────────────────────

gmd({
  pattern: "movie",
  aliases: ["film", "movieinfo"],
  react: "🎬",
  category: "downloads",
  description: "Get movie info. Usage: .movie <title>",
}, async (from, Prince, conText) => {
  const { reply, mek, q, react, PrinceApiKey, PrinceTechApi } = conText;

  if (!q) return reply("🎬 Usage: *.movie <title>*\nExample: *.movie Avengers Endgame*");

  await react("⏳");

  try {
    // Try PrinceTech first, fall back to OMDB public data
    let movie = null;

    try {
      const data = await gmdJson(
        `${PrinceTechApi}/api/movie/info?apikey=${encodeURIComponent(PrinceApiKey)}&q=${encodeURIComponent(q)}`
      );
      if (data?.result || data?.title) movie = data.result || data;
    } catch {}

    if (!movie) {
      // Fallback: OMDB (free tier)
      const omdb = await axios.get(
        `https://www.omdbapi.com/?t=${encodeURIComponent(q)}&apikey=thewdb`
      );
      if (omdb.data?.Response === "True") {
        movie = omdb.data;
      }
    }

    if (!movie) {
      // Second fallback: TMDB search (no key needed for basic)
      const tmdb = await axios.get(
        `https://api.themoviedb.org/3/search/movie?api_key=4e44d9029b1270a757cddc766a1bcb63&query=${encodeURIComponent(q)}`
      );
      const result = tmdb.data?.results?.[0];
      if (result) {
        const detail = await axios.get(
          `https://api.themoviedb.org/3/movie/${result.id}?api_key=4e44d9029b1270a757cddc766a1bcb63`
        );
        movie = detail.data;
        movie._source = "tmdb";
      }
    }

    if (!movie) {
      await react("❌");
      return reply(`❌ No movie found for *"${q}"*. Try a different title.`);
    }

    if (movie._source === "tmdb") {
      const posterUrl = movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : null;
      const genres = movie.genres?.map(g => g.name).join(", ") || "N/A";
      const caption = `🎬 *${movie.title || movie.original_title}* (${movie.release_date?.slice(0, 4) || "N/A"})\n\n⭐ Rating: ${movie.vote_average?.toFixed(1) || "N/A"}/10 (${movie.vote_count || 0} votes)\n📅 Released: ${movie.release_date || "N/A"}\n⏱ Runtime: ${movie.runtime || "N/A"} min\n🎭 Genre: ${genres}\n🌍 Languages: ${movie.spoken_languages?.map(l => l.english_name).join(", ") || "N/A"}\n\n📝 *Overview:*\n${movie.overview || "N/A"}\n\n> Use *.moviedown ${q}* for download links`;

      if (posterUrl) {
        await Prince.sendMessage(from, { image: { url: posterUrl }, caption, quoted: mek });
      } else {
        await reply(caption, { quoted: mek });
      }
    } else {
      const poster = movie.Poster && movie.Poster !== "N/A" ? movie.Poster : null;
      const caption = `🎬 *${movie.Title || movie.title}* (${movie.Year || movie.year || "N/A"})\n\n⭐ Rating: ${movie.imdbRating || movie.vote_average || "N/A"}/10\n🎭 Genre: ${movie.Genre || movie.genre || "N/A"}\n🎬 Director: ${movie.Director || "N/A"}\n🌍 Language: ${movie.Language || "N/A"}\n⏱ Runtime: ${movie.Runtime || movie.runtime || "N/A"}\n📦 Box Office: ${movie.BoxOffice || "N/A"}\n🏆 Awards: ${movie.Awards || "N/A"}\n\n📝 *Plot:*\n${movie.Plot || movie.overview || "N/A"}\n\n> Use *.moviedown ${q}* for download links`;

      if (poster) {
        await Prince.sendMessage(from, { image: { url: poster }, caption, quoted: mek });
      } else {
        await reply(caption, { quoted: mek });
      }
    }
    await react("✅");
  } catch (e) {
    await react("❌");
    reply(`❌ Failed to fetch movie info for *"${q}"*.`);
  }
});

// ─── Series Info ──────────────────────────────────────────────────────────────

gmd({
  pattern: "series",
  aliases: ["tvshow", "seriesinfo"],
  react: "📺",
  category: "downloads",
  description: "Get TV series info. Usage: .series <title>",
}, async (from, Prince, conText) => {
  const { reply, mek, q, react } = conText;

  if (!q) return reply("📺 Usage: *.series <title>*\nExample: *.series Breaking Bad*");

  await react("⏳");

  try {
    const tmdb = await axios.get(
      `https://api.themoviedb.org/3/search/tv?api_key=4e44d9029b1270a757cddc766a1bcb63&query=${encodeURIComponent(q)}`
    );
    const result = tmdb.data?.results?.[0];
    if (!result) {
      await react("❌");
      return reply(`❌ No TV series found for *"${q}"*.`);
    }

    const detail = await axios.get(
      `https://api.themoviedb.org/3/tv/${result.id}?api_key=4e44d9029b1270a757cddc766a1bcb63`
    );
    const s = detail.data;
    const posterUrl = s.poster_path ? `https://image.tmdb.org/t/p/w500${s.poster_path}` : null;
    const genres = s.genres?.map(g => g.name).join(", ") || "N/A";
    const networks = s.networks?.map(n => n.name).join(", ") || "N/A";

    const caption = `📺 *${s.name}* (${s.first_air_date?.slice(0, 4) || "N/A"})\n\n⭐ Rating: ${s.vote_average?.toFixed(1) || "N/A"}/10\n📅 First Aired: ${s.first_air_date || "N/A"}\n🔢 Seasons: ${s.number_of_seasons || "N/A"}\n🎬 Episodes: ${s.number_of_episodes || "N/A"}\n📡 Status: ${s.status || "N/A"}\n🎭 Genre: ${genres}\n📺 Network: ${networks}\n\n📝 *Overview:*\n${s.overview || "N/A"}`;

    if (posterUrl) {
      await Prince.sendMessage(from, { image: { url: posterUrl }, caption, quoted: mek });
    } else {
      await reply(caption, { quoted: mek });
    }
    await react("✅");
  } catch (e) {
    await react("❌");
    reply(`❌ Failed to fetch series info for *"${q}"*.`);
  }
});

// ─── Movie Search ─────────────────────────────────────────────────────────────

gmd({
  pattern: "moviesearch",
  aliases: ["searchmovie", "findmovie"],
  react: "🔍",
  category: "downloads",
  description: "Search for movies by name and show a list",
}, async (from, Prince, conText) => {
  const { reply, mek, q, react } = conText;

  if (!q) return reply("🔍 Usage: *.moviesearch <keyword>*");

  await react("⏳");

  try {
    const res = await axios.get(
      `https://api.themoviedb.org/3/search/multi?api_key=4e44d9029b1270a757cddc766a1bcb63&query=${encodeURIComponent(q)}&page=1`
    );
    const results = res.data?.results?.filter(r => r.media_type === "movie" || r.media_type === "tv").slice(0, 8);

    if (!results?.length) {
      await react("❌");
      return reply(`❌ No results for *"${q}"*.`);
    }

    const list = results.map((r, i) => {
      const year = (r.release_date || r.first_air_date || "").slice(0, 4);
      const type = r.media_type === "tv" ? "📺" : "🎬";
      const rating = r.vote_average?.toFixed(1) || "N/A";
      return `${i + 1}. ${type} *${r.title || r.name}* (${year}) — ⭐${rating}`;
    }).join("\n");

    await reply(
      `🔍 *Search Results for: "${q}"*\n\n${list}\n\n_Use *.movie <title>* for full details_`,
      { quoted: mek }
    );
    await react("✅");
  } catch (e) {
    await react("❌");
    reply("❌ Search failed. Try again.");
  }
});

// ─── Movie Download Links ─────────────────────────────────────────────────────

gmd({
  pattern: "moviedown",
  aliases: ["dlmovie", "downloadmovie"],
  react: "📥",
  category: "downloads",
  description: "Get download links for a movie. Usage: .moviedown <title>",
}, async (from, Prince, conText) => {
  const { reply, mek, q, react, PrinceApiKey, PrinceTechApi } = conText;

  if (!q) return reply("📥 Usage: *.moviedown <movie title>*\nExample: *.moviedown Black Panther*");

  await react("⏳");

  try {
    let links = null;

    try {
      const data = await gmdJson(
        `${PrinceTechApi}/api/dl/movie?apikey=${encodeURIComponent(PrinceApiKey)}&q=${encodeURIComponent(q)}`
      );
      if (data?.result || data?.links) links = data;
    } catch {}

    if (links && (links.result || links.links)) {
      await Prince.sendMessage(from, {
        text: `📥 *Download links for: ${q}*\n\n${JSON.stringify(links.result || links.links, null, 2).slice(0, 1500)}`,
        quoted: mek,
      });
      await react("✅");
      return;
    }

    // Fallback: provide curated search links
    const encoded = encodeURIComponent(q);
    const linksText = `📥 *Download: ${q}*\n\n🔗 *Search on these sites:*\n\n1. 🌐 FzMovies\nhttps://www.fzmovies.net/search.php?searchtype=Name&search=${encoded}\n\n2. 🌐 NetNaija\nhttps://www.thenetnaija.net/search?query=${encoded}\n\n3. 🌐 O2TvSeries\nhttps://o2tvseries.com/?s=${encoded}\n\n4. 🌐 Filmyzilla\nhttps://filmyzilla.re/?s=${encoded}\n\n5. 🌐 YTS (Torrents)\nhttps://yts.mx/movies?quality=all&genre=all&rating=0&year=0&query_term=${encoded}\n\n_⚠️ Always use a VPN when downloading. Respect copyright laws._`;

    await Prince.sendMessage(from, { text: linksText, quoted: mek });
    await react("✅");
  } catch (e) {
    await react("❌");
    reply(`❌ Download link search failed for *"${q}"*.`);
  }
});

// ─── FzMovies Specific ────────────────────────────────────────────────────────

gmd({
  pattern: "fzmovies",
  aliases: ["fzm"],
  react: "📥",
  category: "downloads",
  description: "Search FzMovies for download. Usage: .fzmovies <title>",
}, async (from, Prince, conText) => {
  const { reply, mek, q, react, PrinceApiKey, PrinceTechApi } = conText;

  if (!q) return reply("Usage: *.fzmovies <movie title>*");

  await react("⏳");

  try {
    let result = null;
    try {
      result = await gmdJson(
        `${PrinceTechApi}/api/dl/fzmovies?apikey=${encodeURIComponent(PrinceApiKey)}&q=${encodeURIComponent(q)}`
      );
    } catch {}

    if (result?.result) {
      await Prince.sendMessage(from, {
        text: `📥 *FzMovies: ${q}*\n\n${typeof result.result === "string" ? result.result : JSON.stringify(result.result, null, 2).slice(0, 1500)}`,
        quoted: mek,
      });
    } else {
      const encoded = encodeURIComponent(q);
      await reply(
        `📥 *FzMovies: ${q}*\n\n🔗 https://www.fzmovies.net/search.php?searchtype=Name&search=${encoded}\n\n_Open the link to find and download your movie._`,
        { quoted: mek }
      );
    }
    await react("✅");
  } catch (e) {
    await react("❌");
    reply("❌ FzMovies search failed.");
  }
});

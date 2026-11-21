const { gmd, getContextInfo } = require("../mayel");
const sportify = require("../mayel/sportifyApi");

function clean(value, max = 120) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

function trackLines(tracks, limit = 12) {
  return (tracks || []).slice(0, limit).map((track, index) =>
    `${index + 1}. *${clean(track.title || track.name, 90)}* — ${clean(track.artist || track.artists?.map?.(a => a.name || a).join(", ") || "Unknown artist", 90)}${track.duration ? ` (${track.duration})` : ""}\n${track.url || (track.id ? `https://open.spotify.com/track/${track.id}` : "")}`
  ).join("\n\n");
}

async function sendText(Prince, from, mek, text, contextInfo) {
  await Prince.sendMessage(from, {
    text,
    ...(contextInfo ? { contextInfo } : {}),
  }, { quoted: mek });
}

function reportError(error) {
  const status = error?.response?.status || error?.status;
  if (status === 404) return "I couldn't find that Spotify item. Check the link or try another search.";
  if (status === 429) return "Sportify is receiving too many requests right now. Please try again shortly.";
  return "Sportify is temporarily unavailable. Please try again in a moment.";
}

gmd({
  pattern: "spotifysearch",
  aliases: ["ssearch", "spsearch"],
  category: "music",
  react: "🔎",
  description: "Search Spotify tracks using Sportify API",
}, async (from, Prince, ctx) => {
  const { q, mek, reply, react, botName, botFooter, sender, newsletterJid } = ctx;
  if (!q?.trim()) {
    await react("❌");
    return reply("Give me a song title or artist. Example: .spotifysearch Faded Alan Walker");
  }
  try {
    const data = await sportify.searchTracks(q.trim(), 5);
    const tracks = sportify.getTracks(data);
    if (!tracks.length) {
      await react("❌");
      return reply("No Spotify tracks found for that search.");
    }
    const output = tracks.map((t, i) =>
      `${i + 1}. *${clean(t.title)}*\n🎤 ${clean(t.artist || t.artists?.join?.(", ") || "Unknown artist")}\n💿 ${clean(t.album || "Unknown album")} • ⏱ ${t.duration || sportify.formatDuration(t.duration_ms)}\n🔗 ${t.url || `https://open.spotify.com/track/${t.id}`}\n📝 Lyrics: .syncedlyrics ${t.id}`
    ).join("\n\n");
    await sendText(Prince, from, mek, `🎧 *${botName || "HAYWHY"} • SPOTIFY SEARCH*\n\n${output}\n\n> *${botFooter || "HAYWHY"}*`, getContextInfo(sender, newsletterJid, botName));
    await react("✅");
  } catch (error) {
    console.error("Sportify search failed:", error?.response?.data || error.message);
    await react("❌");
    return reply(reportError(error));
  }
});

gmd({
  pattern: "trackinfo",
  aliases: ["spotifytrack", "spt"],
  category: "music",
  react: "🎵",
  description: "Get Spotify track information",
}, async (from, Prince, ctx) => {
  const { q, mek, reply, react, botName, botFooter } = ctx;
  const id = sportify.extractSpotifyId(q, "track");
  if (!id) {
    await react("❌");
    return reply("Send a Spotify track URL or track ID. Example: .trackinfo https://open.spotify.com/track/...");
  }
  try {
    const data = await sportify.getTrack(id);
    const t = data.track || data.result?.track || data.result || data;
    await sendText(Prince, from, mek,
      `🎵 *${botName || "HAYWHY"} • TRACK INFO*\n\n*Title:* ${clean(t.title || t.name)}\n*Artist:* ${clean(t.artist || t.artists?.map?.(a => a.name).join(", "))}\n*Duration:* ${t.duration || sportify.formatDuration(t.duration_ms)}\n*Release:* ${clean(t.release_date || "Unknown")}\n*Spotify:* ${t.url || `https://open.spotify.com/track/${id}`}\n\n> *${botFooter || "HAYWHY"}*`);
    await react("✅");
  } catch (error) {
    await react("❌");
    return reply(reportError(error));
  }
});

gmd({
  pattern: "albuminfo",
  aliases: ["spalbum"],
  category: "music",
  react: "💿",
  description: "Get Spotify album details and track list",
}, async (from, Prince, ctx) => {
  const { q, mek, reply, react, botName, botFooter } = ctx;
  const id = sportify.extractSpotifyId(q, "album");
  if (!id) {
    await react("❌");
    return reply("Send a Spotify album URL or album ID.");
  }
  try {
    const data = await sportify.getAlbum(id);
    const a = data.album || data.result?.album || data.result || data;
    const tracks = trackLines(a.tracks || [], 12);
    await sendText(Prince, from, mek,
      `💿 *${botName || "HAYWHY"} • ALBUM INFO*\n\n*Album:* ${clean(a.name || a.title)}\n*Artist:* ${clean(a.artist || a.artists?.map?.(x => x.name).join(", "))}\n*Release:* ${clean(a.release_date || "Unknown")}\n*Tracks:* ${a.total_tracks ?? a.tracks?.length ?? "Unknown"}\n*Spotify:* ${a.url || `https://open.spotify.com/album/${id}`}\n\n${tracks || "Track list unavailable."}\n\n> *${botFooter || "HAYWHY"}*`);
    await react("✅");
  } catch (error) {
    await react("❌");
    return reply(reportError(error));
  }
});

gmd({
  pattern: "artistinfo",
  aliases: ["spartist"],
  category: "music",
  react: "🎤",
  description: "Get Spotify artist information",
}, async (from, Prince, ctx) => {
  const { q, mek, reply, react, botName, botFooter } = ctx;
  if (!q || !q.trim()) { await react("❌"); return reply("Provide an artist name or Spotify artist URL."); }
  let id = sportify.extractSpotifyId(q, "artist");
  try {
    if (!id) {
      const search = await sportify.searchArtists(String(q || "").trim(), 1);
      const artists = search.results || [];
      id = artists[0]?.id;
    }
    if (!id) {
      await react("❌");
      return reply("Send an artist name or Spotify artist URL.");
    }
    const data = await sportify.getArtist(id);
    const a = data.artist || data.result?.artist || data.result || data;
    await sendText(Prince, from, mek,
      `🎤 *${botName || "HAYWHY"} • ARTIST INFO*\n\n*Name:* ${clean(a.name)}\n*Followers:* ${a.followers ? Number(a.followers).toLocaleString() : "Not available"}\n*Genres:* ${clean(a.genres?.join?.(", ") || "Not available")}\n*Spotify:* ${a.url || `https://open.spotify.com/artist/${id}`}\n\n> *${botFooter || "HAYWHY"}*`);
    await react("✅");
  } catch (error) {
    await react("❌");
    return reply(reportError(error));
  }
});

gmd({
  pattern: "toptracks",
  aliases: ["artisttop", "sptop"],
  category: "music",
  react: "🔥",
  description: "Get an artist's top Spotify tracks",
}, async (from, Prince, ctx) => {
  const { q, mek, reply, react, botFooter } = ctx;
  if (!q || !q.trim()) { await react("❌"); return reply("Provide an artist name or Spotify artist URL."); }
  let id = sportify.extractSpotifyId(q, "artist");
  try {
    if (!id) {
      const search = await sportify.searchArtists(String(q || "").trim(), 1);
      id = search.results?.[0]?.id;
    }
    if (!id) {
      await react("❌");
      return reply("Send an artist name or Spotify artist URL.");
    }
    const data = await sportify.getTopTracks(id);
    const tracks = data.tracks || data.result?.tracks || [];
    await sendText(Prince, from, mek,
      `🔥 *TOP TRACKS — ${clean(data.artist || "SPOTIFY ARTIST")}*\n\n${trackLines(tracks, 10) || "No top tracks found."}\n\n> *${botFooter || "HAYWHY"}*`);
    await react("✅");
  } catch (error) {
    await react("❌");
    return reply(reportError(error));
  }
});

gmd({
  pattern: "playlistinfo",
  aliases: ["spplaylist"],
  category: "music",
  react: "📃",
  description: "Get Spotify playlist information",
}, async (from, Prince, ctx) => {
  const { q, mek, reply, react, botName, botFooter } = ctx;
  const id = sportify.extractSpotifyId(q, "playlist");
  if (!id) {
    await react("❌");
    return reply("Send a Spotify playlist URL or playlist ID.");
  }
  try {
    const data = await sportify.getPlaylist(id);
    const p = data.playlist || data.result?.playlist || data.result || data;
    await sendText(Prince, from, mek,
      `📃 *${botName || "HAYWHY"} • PLAYLIST INFO*\n\n*Name:* ${clean(p.name)}\n*Owner:* ${clean(p.owner || "Unknown")}\n*Tracks:* ${p.total_tracks ?? p.tracks?.length ?? "Unknown"}\n*Spotify:* ${p.url || `https://open.spotify.com/playlist/${id}`}\n\n${trackLines(p.tracks || [], 12) || "Track list unavailable."}\n\n> *${botFooter || "HAYWHY"}*`);
    await react("✅");
  } catch (error) {
    await react("❌");
    return reply(reportError(error));
  }
});

gmd({
  pattern: "syncedlyrics",
  aliases: ["slyrics", "timedlyrics"],
  category: "music",
  react: "🎼",
  description: "Get synced lyrics for a Spotify track",
}, async (from, Prince, ctx) => {
  const { q, mek, reply, react, botName, botFooter } = ctx;
  let id = sportify.extractSpotifyId(q, "track");
  try {
    if (!id && q?.trim()) {
      const search = await sportify.searchTracks(q.trim(), 1);
      id = sportify.getTracks(search)[0]?.id;
    }
    if (!id) {
      await react("❌");
      return reply("Send a song title or Spotify track URL. Example: .syncedlyrics Faded Alan Walker");
    }
    const data = await sportify.getLyrics(id);
    const t = data.track || {};
    const lyrics = sportify.formatTimedLyrics(data);
    if (!lyrics) {
      await react("❌");
      return reply("No lyrics were returned for this track.");
    }
    const label = data.synced ? "SYNCED LYRICS" : "LYRICS (NOT SYNCED)";
    const full = `🎼 *${botName || "HAYWHY"} • ${label}*\n\n*Title:* ${clean(t.title || "Unknown")}\n*Artist:* ${clean(t.artist || "Unknown")}\n*Source:* ${clean(data.lyrics_provider || data.source || "Sportify")}\n\n${lyrics}\n\n> *${botFooter || "HAYWHY"}*`;
    if (full.length <= 60000) {
      await sendText(Prince, from, mek, full);
    } else {
      await Prince.sendMessage(from, {
        document: Buffer.from(full, "utf8"),
        mimetype: "text/plain",
        fileName: `${clean(t.title || "lyrics", 60)}.txt`,
        caption: "🎼 Synced lyrics",
      }, { quoted: mek });
    }
    await react("✅");
  } catch (error) {
    console.error("Sportify lyrics failed:", error?.response?.data || error.message);
    await react("❌");
    return reply(reportError(error));
  }
});

const { gmd, getContextInfo } = require("../mayel");

const HTTP_URL_RE = new RegExp("^https?:\\/\\/", "i");
const YOUTUBE_ID_RE = new RegExp("(?:youtu\\.be\\/|v=|\\/shorts\\/|\\/embed\\/|\\/live\\/)([\\w-]{11})");
const FFMPEG_ERROR_RE = new RegExp("ffmpeg|spawn .*ENOENT|audio converter", "i");
const NO_VERIFIED_MATCH_RE = new RegExp("no_verified_match", "i");
const SAFE_FILENAME_RE = new RegExp("[^\\w\\s.-]", "gi");


function getDownloadUrl(payload) {
  const candidates = [
    payload?.result?.download_url,
    payload?.result?.downloadUrl,
    payload?.data?.download_url,
    payload?.data?.downloadUrl,
    payload?.download_url,
    payload?.downloadUrl,
    payload?.result?.url,
    payload?.result?.url_dl,
  ];
  return candidates.find((url) => typeof url === "string" && HTTP_URL_RE.test(url));
}

const yts = require("yt-search");
const { downloadSongAudio, downloadYouTubeAudio, getYouTubeTitle, listSoundCloudMatches, prepareYtDlp, scoreMatch, MATCH_THRESHOLD } = require("../mayel/ytAudio");
const { resolveMusicIdentity, findJamendoTrack, downloadJamendoAudio } = require("../mayel/musicProviders");
prepareYtDlp();

function normalizeVideo(v) {
  if (!v || !v.url) return null;
  return {
    ...v,
    name: v.name || v.title,
    title: v.title || v.name,
    duration: v.timestamp || v.duration?.timestamp || v.duration,
    thumbnail: v.thumbnail || v.image,
  };
}

function extractVideoId(text) {
  const m = String(text || "").match(YOUTUBE_ID_RE);
  return m ? m[1] : null;
}

function rankVideoResults(videos, query) {
  return (videos || [])
    .map(normalizeVideo)
    .filter(Boolean)
    .map((video) => ({
      ...video,
      matchScore: scoreMatch(query, `${video.title || ""} ${video.author?.name || video.author || ""}`),
    }))
    .sort((a, b) => b.matchScore - a.matchScore);
}

// Searches SoundCloud as a real fallback when YouTube search and the legacy
// search APIs are unavailable on datacenter hosts.
async function searchSoundCloud(query) {
  try {
    const results = await listSoundCloudMatches(query, 10);
    const best = results
      .map((track) => ({
        ...track,
        matchScore: scoreMatch(query, track.title),
      }))
      .sort((a, b) => b.matchScore - a.matchScore)[0];

    if (!best || best.matchScore < MATCH_THRESHOLD) return null;
    return {
      url: best.url,
      name: best.title,
      title: best.title,
      duration: best.duration
        ? `${Math.floor(best.duration / 60)}:${String(best.duration % 60).padStart(2, "0")}`
        : "Unknown",
      provider: "SoundCloud",
    };
  } catch (error) {
    console.log("SoundCloud search failed:", error.message);
    return null;
  }
}

// Searches YouTube first, then SoundCloud. The old third-party endpoints
// remain as a final fallback because they are frequently offline.
async function searchYouTube(gmdJson, query) {
  const videoId = extractVideoId(query);
  try {
    if (videoId) {
      const v = await yts({ videoId });
      const found = normalizeVideo(v && { ...v, url: v.url || `https://youtube.com/watch?v=${videoId}` });
      if (found) return found;
    } else {
      const r = await yts(query);
      const found = rankVideoResults(r?.videos, query)[0];
      if (found && found.matchScore < MATCH_THRESHOLD) return null;
      if (found) return found;
    }
  } catch (e) {
    console.log("yt-search failed:", e.message);
  }
  if (videoId) return { url: `https://youtube.com/watch?v=${videoId}`, name: "YouTube Audio", title: "YouTube Audio" };


  // Critical fallback: previously .play stopped here even though the
  // downloader already supported SoundCloud. Search SoundCloud first so
  // the user still gets a result when YouTube blocks the server.
  return await searchSoundCloud(query);
}



gmd({
    pattern: "sendimage",
    aliases: ["sendimg", "dlimg", "dlimage"],
    category: "downloader",
    react: "📷",
    description: "Download Audio from url"
  },
  async (from, Prince, conText) => {
    const { q, mek, reply, react, sender, botFooter, gmdBuffer } = conText;

    if (!q) {
      await react("❌");
      return reply("Please provide image url");
    }

    try {
      const buffer = await gmdBuffer(q);
      if (buffer instanceof Error) {
        await react("❌");
        return reply("Failed to download the image file.");
      }
      await Prince.sendMessage(from, {
        image: buffer,
        mimetype: "image/jpg",
        caption: `> *${botFooter}*`,
      }, { quoted: mek });
      await react("✅");
    } catch (error) {
      console.error("Error during download process:", error);
      await react("❌");
      return reply("Oops! Something went wrong. Please try again.");
    }
  }
);


gmd({
    pattern: "sendaudio",
    aliases: ["sendmp3", "dlmp3", "dlaudio"],
    category: "downloader",
    react: "🎶",
    description: "Download Audio from url"
  },
  async (from, Prince, conText) => {
    const { q, mek, reply, react, sender, botFooter, gmdBuffer, formatAudio } = conText;

    if (!q) {
      await react("❌");
      return reply("Please provide audio url");
    }

    try {
      const buffer = await gmdBuffer(q);
      const convertedBuffer = await formatAudio(buffer);
      if (buffer instanceof Error) {
        await react("❌");
        return reply("Failed to download the audio file.");
      }
      await Prince.sendMessage(from, {
        audio: convertedBuffer,
        mimetype: "audio/mpeg",
        caption: `> *${botFooter}*`,
      }, { quoted: mek });
      await react("✅");
    } catch (error) {
      console.error("Error during download process:", error);
      await react("❌");
      return reply("Oops! Something went wrong. Please try again.");
    }
  }
);


gmd({
    pattern: "sendvideo",
    aliases: ["sendmp4", "dlmp4", "dvideo"],
    category: "downloader",
    react: "🎥",
    description: "Download Video from url"
  },
  async (from, Prince, conText) => {
    const { q, mek, reply, react, sender, botFooter, gmdBuffer, formatVideo } = conText;

    if (!q) {
      await react("❌");
      return reply("Please provide video url");
    }

    try {
      const buffer = await gmdBuffer(q);
      const convertedBuffer = await formatVideo(buffer);
      if (buffer instanceof Error) {
        await react("❌");
        return reply("Failed to download the video file.");
      }
      await Prince.sendMessage(from, {
        video: convertedBuffer,
        mimetype: "video/mp4",
        caption: `> *${botFooter}*`,
      }, { quoted: mek });
      await react("✅");
    } catch (error) {
      console.error("Error during download process:", error);
      await react("❌");
      return reply("Oops! Something went wrong. Please try again.");
    }
  }
);


gmd({
    pattern: "play",
    aliases: ["ytmp3", "ytmp3doc", "audiodoc", "yta"],
    category: "downloader",
    react: "🎶",
    description: "Download Video from Youtube"
  },
  async (from, Prince, conText) => {
    const { q, mek, reply, react, sender, botPic, botName, botFooter, newsletterUrl, newsletterJid, gmdJson, gmdBuffer, formatAudio, PrinceTechApi, PrinceApiKey } = conText;

    if (!q) {
      await react("❌");
      return reply("Please provide a song name or youtube url");
    }

    try {
      const isDirectUrl = HTTP_URL_RE.test(q);
      // Keep command response fast: do not block the search on serial
      // metadata/catalogue APIs. Search YouTube, then verified SoundCloud.
      const identity = null;
      const canonicalQuery = q;
      const jamendoTrack = null;
      const firstVideo = await searchYouTube(gmdJson, canonicalQuery);

      if (!firstVideo) {
        await react("❌");
        return reply("No song was found for that request. Try the song title and artist, or paste a YouTube link.");
      }

      const videoUrl = firstVideo.url;
      
      // Prepare the audio in the background so the song card is sent
      // immediately instead of after the whole download + conversion.
      const audioPromise = (async () => {
        // yt-dlp verifies the source title before downloading. If YouTube
        // blocks the host, it searches SoundCloud and applies the same check.
        try {
          const searchTitle = isDirectUrl ? String(firstVideo.title || "").trim() : canonicalQuery;
          const bannerTitle = String(firstVideo.title || firstVideo.name || "").trim();
          // For a text search, validate only against what the user requested.
          // Never add the selected banner title here: doing that lets a remix
          // or cover selected by search validate itself.
          if (jamendoTrack) {
            const buffer = await downloadJamendoAudio(jamendoTrack);
            console.log(".play: audio from Jamendo", {
              title: jamendoTrack.title,
              artist: jamendoTrack.artist,
              license: jamendoTrack.licenseUrl || "not provided",
            });
            return await formatAudio(buffer);
          }
          const expectedTitles = isDirectUrl ? [bannerTitle] : [canonicalQuery, q];
          const { buffer, source } = await downloadSongAudio(videoUrl, searchTitle, expectedTitles);
          console.log(`.play: audio from ${source}`);
          return await formatAudio(buffer);
        } catch (e) {
          console.log(`.play verified download failed: ${e.message}`);
          if (FFMPEG_ERROR_RE.test(e.message || "")) {
            throw new Error("The song was found, but the bot's audio converter is unavailable. Please contact the bot owner to install FFmpeg.");
          }
          throw new Error(e.code === "no_verified_match" || NO_VERIFIED_MATCH_RE.test(e.message || "")
            ? "I couldn't verify a matching audio source for this song, so I did not send audio. Try adding the artist name."
            : "Failed to download this song right now. Please try again in a moment.");
        }
      })();
      audioPromise.catch(() => {});

      const providerLine = jamendoTrack
        ? `│⿻ *Source:* Jamendo (download permitted)\n│⿻ *License:* ${jamendoTrack.licenseUrl || "See track terms"}`
        : `│⿻ *Source:* Verified ${identity ? "MusicBrainz-normalized YouTube/SoundCloud" : "YouTube/SoundCloud"}`;
      const infoMess = {
        image: { url: firstVideo.thumbnail || botPic },
        caption: `> *${botName} 𝐒𝐎𝐍𝐆 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐄𝐑*  
╭───────────────◆  
│⿻ *Title:* ${firstVideo.name || firstVideo.title || "Unknown"}
│⿻ *Duration:* ${firstVideo.duration || "Unknown"}
${providerLine}
╰────────────────◆
⏱ *Session expires in 2 minutes*
╭───────────────◆
│Reply With:
│1️⃣ To Download Audio 🎶 
│2️⃣ To Download as Document 📄
╰────────────────◆`,
        contextInfo: getContextInfo(sender, newsletterJid, botName)
      };

      const messageSent = await Prince.sendMessage(from, infoMess, { quoted: mek });
      const messageId = messageSent.key.id;
      
      const handleResponse = async (event) => {
        const messageData = event.messages[0];
        if (!messageData.message) return;
        const isReplyToDownloadPrompt = messageData.message.extendedTextMessage?.contextInfo?.stanzaId === messageId;
        if (!isReplyToDownloadPrompt) return;
        const messageContent = messageData.message.conversation || messageData.message.extendedTextMessage?.text;
        await react("⬇️");
        
        try {
          let convertedBuffer;
          try {
            convertedBuffer = await audioPromise;
          } catch (prepErr) {
            await react("❌");
            return reply(prepErr.message, messageData);
          }
          switch (String(messageContent || "").trim()) {
            case "1":
              await Prince.sendMessage(from, {
                audio: convertedBuffer,
                mimetype: "audio/mpeg",
                fileName: `${firstVideo.name || firstVideo.title || "audio"}.mp3`.replace(SAFE_FILENAME_RE, ''),
                caption: `${firstVideo.name}${jamendoTrack?.licenseUrl ? `\nLicense: ${jamendoTrack.licenseUrl}` : ""}`,
                externalAdReply: {
                   title: `${firstVideo.name || firstVideo.title || "audio"}.mp3`,
                  body: `${firstVideo.provider || "Verified music source"} Downloader`,
                  mediaType: 1,
                  thumbnailUrl: firstVideo.thumbnail || botPic,
                  sourceUrl: newsletterUrl,
                  renderLargerThumbnail: false,
                  showAdAttribution: true,
                },
              }, { quoted: messageData });
              Prince.ev.off("messages.upsert", handleResponse);
              break;
              
            case "2":
              await Prince.sendMessage(from, {
                document: convertedBuffer,
                mimetype: "audio/mpeg",
                 fileName: `${firstVideo.name || firstVideo.title || "audio"}.mp3`.replace(SAFE_FILENAME_RE, ''),
                 caption: `${firstVideo.name || firstVideo.title || "Audio"}${jamendoTrack?.licenseUrl ? `\nLicense: ${jamendoTrack.licenseUrl}` : ""}`,
              }, { quoted: messageData });
              Prince.ev.off("messages.upsert", handleResponse);
              break;
              
            default:
              await reply("Invalid option selected. Please reply with:\n1️⃣ For Audio\n2️⃣ For Document", messageData);
              return;
          }
          await react("✅");
        } catch (error) {
          console.error("Error sending media:", error);
          await react("❌");
          await reply("Failed to send media. Please try again.", messageData);
        }
      };

      let sessionExpired = false;
      
      const timeoutHandler = () => {
        sessionExpired = true;
        Prince.ev.off("messages.upsert", handleResponse);
      };

      setTimeout(timeoutHandler, 120000);
      
      Prince.ev.on("messages.upsert", handleResponse);
      
    } catch (error) {
      console.error("Error during download process:", error);
      await react("❌");
      return reply("Oops! Something went wrong. Please try again.");
    }
  }
);


gmd({
    pattern: "video",
    aliases: ["ytmp4doc", "mp4", "ytmp4", "dlmp4"],
    category: "downloader",
    react: "🎥",
    description: "Download Video from Youtube"
  },
  async (from, Prince, conText) => {
    const { q, mek, reply, react, sender, botPic, botName, botFooter, newsletterUrl, newsletterJid, gmdJson, gmdBuffer, formatVideo, PrinceTechApi, PrinceApiKey } = conText;

    if (!q) {
      await react("❌");
      return reply("Please provide a video name or youtube url");
    }

    try {
      const firstVideo = await searchYouTube(gmdJson, q);

      if (!firstVideo) {
        await react("❌");
        return reply("No video was found for that request. Try a different title or paste a YouTube link.");
      }
      const videoUrl = firstVideo.url;
      
      const videoApis = [
        `${PrinceTechApi}/api/download/ytmp4?apikey=${PrinceApiKey}&url=${encodeURIComponent(videoUrl)}`,
        `${PrinceTechApi}/api/download/mp4?apikey=${PrinceApiKey}&url=${encodeURIComponent(videoUrl)}`,
        `${PrinceTechApi}/api/download/ytv?apikey=${PrinceApiKey}&url=${encodeURIComponent(videoUrl)}`,
        `${PrinceTechApi}/api/download/dlmp4?apikey=${PrinceApiKey}&url=${encodeURIComponent(videoUrl)}`,
        `${PrinceTechApi}/api/download/ytvideo?apikey=${PrinceApiKey}&url=${encodeURIComponent(videoUrl)}`,
        `${PrinceTechApi}/api/download/ytvid?apikey=${PrinceApiKey}&url=${encodeURIComponent(videoUrl)}`
      ];

      let downloadUrl = null;

      for (const api of videoApis) {
        try {
          const response = await gmdJson(api);
          const candidate = getDownloadUrl(response);
          if (candidate) {
            downloadUrl = candidate;
            break;
          }
        } catch (e) {
          console.log(`API ${api} failed: ${e.message}`);
        }
      }
      
      if (!downloadUrl) {
        await react("❌");
        return reply("Failed to get download URL for the video.");
      }

       const buffer = await gmdBuffer(downloadUrl);
       if (!Buffer.isBuffer(buffer)) {
        await react("❌");
         return reply("The video service returned an invalid file. Please try again.");
      }
       const convertedBuffer = await formatVideo(buffer);

      const infoMess = {
        image: { url: firstVideo.thumbnail || botPic },
        caption: `> *${botName} 𝐕𝐈𝐃𝐄𝐎 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐄𝐑*  
╭───────────────◆  
│⿻ *Title:* ${firstVideo.name || firstVideo.title || "Unknown"}
│⿻ *Duration:* ${firstVideo.duration || "Unknown"}
╰────────────────◆  
⏱ *Session expires in 2 minutes*
╭───────────────◆
│Reply With:
│1️⃣ To Download Video 🎥 
│2️⃣ To Download as Document 📄
╰────────────────◆`,
        contextInfo: getContextInfo(sender, newsletterJid, botName)
      };

      const messageSent = await Prince.sendMessage(from, infoMess, { quoted: mek });
      const messageId = messageSent.key.id;
      
      const handleResponse = async (event) => {
        const messageData = event.messages[0];
        if (!messageData.message) return;
        const isReplyToDownloadPrompt = messageData.message.extendedTextMessage?.contextInfo?.stanzaId === messageId;
        if (!isReplyToDownloadPrompt) return;
        const messageContent = messageData.message.conversation || messageData.message.extendedTextMessage?.text;
        await react("⬇️");
        
        try {
          switch (messageContent.trim()) {
            case "1":
              await Prince.sendMessage(from, {
                video: convertedBuffer,
                mimetype: "video/mp4",
                pvt: true,
                 fileName: `${firstVideo.name || firstVideo.title || "video"}.mp4`.replace(SAFE_FILENAME_RE, ''),
                 caption: `🎥 ${firstVideo.name || firstVideo.title || "Video"}`,
              }, { quoted: messageData });
              break;
              
            case "2":
              await Prince.sendMessage(from, {
                document: convertedBuffer,
                mimetype: "video/mp4",
                 fileName: `${firstVideo.name || firstVideo.title || "video"}.mp4`.replace(SAFE_FILENAME_RE, ''),
                 caption: `📄 ${firstVideo.name || firstVideo.title || "Video"}`,
              }, { quoted: messageData });
              break;
              
            default:
              await reply("Invalid option selected. Please reply with:\n1️⃣ For Video\n2️⃣ For Document", messageData);
              return;
          }
          await react("✅");
        } catch (error) {
          console.error("Error sending media:", error);
          await react("❌");
          await reply("Failed to send media. Please try again.", messageData);
        }
      };

      let sessionExpired = false;
      
      const timeoutHandler = () => {
        sessionExpired = true;
        Prince.ev.off("messages.upsert", handleResponse);
      };

      setTimeout(timeoutHandler, 120000);
      
      Prince.ev.on("messages.upsert", handleResponse);
      
    } catch (error) {
      console.error("Error during download process:", error);
      await react("❌");
      return reply("Oops! Something went wrong. Please try again.");
    }
  }
);


// ============================================================
// Guru API download tools
// Configure GURU_API_KEY in the hosting platform's environment.
// Never store the key in source code.
// ============================================================
const GURU_API_URL = "https://ktrenqecceeooyrquooc.supabase.co/functions/v1/api-proxy";

async function guruRequest(action, payload) {
  const apiKey = process.env.GURU_API_KEY;
  if (!apiKey) throw new Error("Guru API is not configured. Add GURU_API_KEY to the bot's environment variables.");
  const response = await require("axios").post(
    GURU_API_URL,
    { apiKey, action, payload },
    { timeout: 120000, maxBodyLength: Infinity, maxContentLength: Infinity, responseType: "arraybuffer", validateStatus: () => true }
  );
  const contentType = String(response.headers?.["content-type"] || "");
  const raw = Buffer.from(response.data || []);
  if (response.status < 200 || response.status >= 300) {
    let detail = raw.toString("utf8").slice(0, 500);
    try { detail = JSON.parse(detail).message || JSON.parse(detail).error || detail; } catch (_) {}
    throw new Error("Guru API returned HTTP " + response.status + (detail ? ": " + detail : ""));
  }
  if (contentType.includes("application/json") || contentType.includes("text/")) {
    const text = raw.toString("utf8");
    let data;
    try { data = JSON.parse(text); } catch (_) { throw new Error(text.slice(0, 400) || "Guru API returned an empty response."); }
    if (data.success === false || data.error) throw new Error(data.message || data.error || "Guru API request failed.");
    const findUrl = (value, depth = 0) => {
      if (!value || depth > 5) return null;
      if (typeof value === "string" && HTTP_URL_RE.test(value)) return value;
      if (Array.isArray(value)) { for (const item of value) { const found = findUrl(item, depth + 1); if (found) return found; } }
      if (typeof value === "object") {
        for (const key of ["download_url", "downloadUrl", "url", "link", "file", "result", "data", "output"]) {
          const found = findUrl(value[key], depth + 1); if (found) return found;
        }
      }
      return null;
    };
    const url = findUrl(data);
    if (!url) throw new Error(data.message || "Guru API response did not contain a downloadable file URL.");
    const fileResponse = await require("axios").get(url, { responseType: "arraybuffer", timeout: 120000, maxContentLength: Infinity });
    return Buffer.from(fileResponse.data);
  }
  if (!raw.length) throw new Error("Guru API returned an empty file.");
  return raw;
}

async function sendGuruMedia(from, Prince, conText, action, kind) {
  const { q, mek, reply, react, botFooter } = conText;
  if (!q) { await react("❌"); return reply("Please provide a " + (kind === "image" ? "website URL" : "YouTube URL") + "."); }
  if (kind === "image" && !HTTP_URL_RE.test(q.trim())) {
    await react("❌"); return reply("Please provide a valid website URL starting with https:// or http://.");
  }
  try {
    await react("⏳");
    // Keep guru-mp3 usable without a paid/secret Guru key. The existing
    // downloader verifies the YouTube title before sending the audio.
    if (action === "yt-mp3" && !String(process.env.GURU_API_KEY || "").trim()) {
      const title = await getYouTubeTitle(q.trim());
      const downloaded = await downloadYouTubeAudio(q.trim(), [title]);
      const audio = typeof conText.formatAudio === "function"
        ? await conText.formatAudio(downloaded.buffer)
        : downloaded.buffer;
      await Prince.sendMessage(from, {
        audio,
        mimetype: "audio/mpeg",
        fileName: "youtube-audio.mp3",
        ptt: false,
        caption: botFooter ? String(botFooter) : "",
      }, { quoted: mek });
      await react("✅");
      return;
    }
    const buffer = await guruRequest(action, kind === "image" ? { url: q.trim() } : { url: q.trim() });
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error("The API did not return a valid file.");
    if (kind === "audio") {
      await Prince.sendMessage(from, { audio: buffer, mimetype: "audio/mpeg", fileName: "guru-audio.mp3", ptt: false, caption: botFooter ? String(botFooter) : "" }, { quoted: mek });
    } else if (kind === "video") {
      await Prince.sendMessage(from, { video: buffer, mimetype: "video/mp4", caption: "Downloaded via Guru API." }, { quoted: mek });
    } else {
      await Prince.sendMessage(from, { image: buffer, mimetype: "image/png", caption: "Website screenshot" }, { quoted: mek });
    }
    await react("✅");
  } catch (error) {
    console.error("Guru API " + action + " failed:", error.message);
    await react("❌");
    await reply("Guru API failed: " + error.message);
  }
}

gmd({ pattern: "guru-mp3", aliases: ["gurump3"], category: "downloader", react: "🎵", description: "Download YouTube audio using Guru API" },
  async (from, Prince, conText) => sendGuruMedia(from, Prince, conText, "yt-mp3", "audio"));

gmd({ pattern: "guru-mp4", aliases: ["gurump4"], category: "downloader", react: "🎥", description: "Download YouTube video using Guru API" },
  async (from, Prince, conText) => sendGuruMedia(from, Prince, conText, "yt-mp4", "video"));

gmd({ pattern: "screenshot", aliases: ["webshot", "ssweb"], category: "downloader", react: "📸", description: "Capture a website screenshot using Guru API" },
  async (from, Prince, conText) => sendGuruMedia(from, Prince, conText, "screenshot-web", "image"));

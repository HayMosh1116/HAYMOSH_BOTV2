const { gmd, getContextInfo } = require("../mayel");

const SEARCH_ENDPOINTS = [
  "https://yts.gifted.co.ke/",
  "https://yts.giftedtech.co.ke/",
];

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
  return candidates.find((url) => typeof url === "string" && /^https?:\/\//i.test(url));
}

const yts = require("yt-search");
const { downloadSongAudio, prepareYtDlp, scoreMatch, MATCH_THRESHOLD } = require("../mayel/ytAudio");
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
  const m = String(text || "").match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/);
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

// Searches YouTube directly (yt-search) first; the old third-party search
// endpoints are kept only as a fallback because they are frequently offline.
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
  for (const endpoint of SEARCH_ENDPOINTS) {
    try {
      const response = await gmdJson(`${endpoint}?q=${encodeURIComponent(query)}`);
      if (response && !(response instanceof Error) && Array.isArray(response.videos)) {
        const video = rankVideoResults(response.videos, query)[0];
        if (video && video.matchScore < MATCH_THRESHOLD) continue;
        if (video) return video;
      }
    } catch (_) {}
  }
  return null;
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
      const firstVideo = await searchYouTube(gmdJson, q);

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
          const isDirectUrl = /^https?:\/\//i.test(q);
          const searchTitle = isDirectUrl ? String(firstVideo.title || "").trim() : q;
          const bannerTitle = String(firstVideo.title || firstVideo.name || "").trim();
          // For a text search, validate only against what the user requested.
          // Never add the selected banner title here: doing that lets a remix
          // or cover selected by search validate itself.
          const expectedTitles = isDirectUrl ? [bannerTitle] : [q];
          const { buffer, source } = await downloadSongAudio(videoUrl, searchTitle, expectedTitles);
          console.log(`.play: audio from ${source}`);
          return await formatAudio(buffer);
        } catch (e) {
          console.log(`.play verified download failed: ${e.message}`);
          if (/ffmpeg|spawn .*ENOENT|audio converter/i.test(e.message || "")) {
            throw new Error("The song was found, but the bot's audio converter is unavailable. Please contact the bot owner to install FFmpeg.");
          }
          throw new Error(e.code === "no_verified_match" || /no_verified_match/i.test(e.message)
            ? "I couldn't verify a matching audio source for this song, so I did not send audio. Try adding the artist name."
            : "Failed to download this song right now. Please try again in a moment.");
        }
      })();
      audioPromise.catch(() => {});

      const infoMess = {
        image: { url: firstVideo.thumbnail || botPic },
        caption: `> *${botName} 𝐒𝐎𝐍𝐆 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐄𝐑*  
╭───────────────◆  
│⿻ *Title:* ${firstVideo.name || firstVideo.title || "Unknown"}
│⿻ *Duration:* ${firstVideo.duration || "Unknown"}
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
                fileName: `${firstVideo.name || firstVideo.title || "audio"}.mp3`.replace(/[^\w\s.-]/gi, ''),
                caption: `${firstVideo.name}`,
                externalAdReply: {
                   title: `${firstVideo.name || firstVideo.title || "audio"}.mp3`,
                  body: 'Youtube Downloader',
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
                 fileName: `${firstVideo.name || firstVideo.title || "audio"}.mp3`.replace(/[^\w\s.-]/gi, ''),
                 caption: `${firstVideo.name || firstVideo.title || "Audio"}`,
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
                 fileName: `${firstVideo.name || firstVideo.title || "video"}.mp4`.replace(/[^\w\s.-]/gi, ''),
                 caption: `🎥 ${firstVideo.name || firstVideo.title || "Video"}`,
              }, { quoted: messageData });
              break;
              
            case "2":
              await Prince.sendMessage(from, {
                document: convertedBuffer,
                mimetype: "video/mp4",
                 fileName: `${firstVideo.name || firstVideo.title || "video"}.mp4`.replace(/[^\w\s.-]/gi, ''),
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

const { gmd, getContextInfo } = require("../mayel");
const axios = require("axios");
const GIFTED_DLS = require("gifted-dls");
const giftedDls = new GIFTED_DLS();

const MAX_MEDIA_SIZE = 60 * 1024 * 1024;

function getMimeFromUrl(url) {
  const ext = url.split('.').pop()?.toLowerCase().split('?')[0];
  const mimes = {
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
    mp4: 'video/mp4', mkv: 'video/x-matroska', avi: 'video/x-msvideo', webm: 'video/webm',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
    pdf: 'application/pdf', zip: 'application/zip', rar: 'application/x-rar-compressed',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    apk: 'application/vnd.android.package-archive',
  };
  return mimes[ext] || 'application/octet-stream';
}

function getMimeCategory(mime) {
  if (!mime) return 'document';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  return 'document';
}

async function getFileSize(url) {
  try {
    const res = await axios.head(url, { timeout: 10000 });
    return parseInt(res.headers['content-length'] || '0', 10);
  } catch { return 0; }
}

gmd(
  {
    pattern: "spotify",
    category: "downloader",
    react: "🎧",
    aliases: ["spotifydl", "spotidl", "spoti"],
    description: "Download Spotify tracks by URL or song name",
  },
  async (from, Prince, conText) => {
    const { q, mek, reply, react, sender, botName, botFooter, botPic, newsletterJid, gmdBuffer, formatAudio, PrinceTechApi, PrinceApiKey } = conText;

    if (!q) {
      await react("❌");
      return reply("Please provide a Spotify URL or song name\n\n*Examples:*\n.spotify https://open.spotify.com/track/...\n.spotify The Spectre Alan Walker");
    }

    const truncate = (str, len) =>
      str && str.length > len ? str.substring(0, len - 2) + ".." : str;

    const downloadAndSend = async (trackUrl, quotedMsg) => {
      const endpoints = ["spotifydl", "spotifydlv2"];
      let result = null;

      for (const endpoint of endpoints) {
        try {
          const apiUrl = `${PrinceTechApi}/api/download/${endpoint}?apikey=${PrinceApiKey}&url=${encodeURIComponent(trackUrl)}`;
          const response = await axios.get(apiUrl, { timeout: 30000 });

          if (response.data?.success && response.data?.result?.download_url) {
            result = response.data.result;
            break;
          }
        } catch (err) {
          continue;
        }
      }

      if (!result || !result.download_url) {
        await react("❌");
        return reply("Failed to fetch track. Please try again.", quotedMsg);
      }

      const { title, download_url } = result;

      const audioBuffer = await gmdBuffer(download_url);
      const fileSize = audioBuffer.length;

      if (fileSize > MAX_MEDIA_SIZE) {
        await Prince.sendMessage(from, {
          document: audioBuffer,
          fileName: `${(title || "spotify_track").replace(/[^\w\s.-]/gi, "")}.mp3`,
          mimetype: "audio/mpeg",
        }, { quoted: quotedMsg });
      } else {
        await Prince.sendMessage(from, {
          audio: audioBuffer,
          mimetype: "audio/mpeg",
        }, { quoted: quotedMsg });
      }

      await react("✅");
    };

    try {
      if (q.includes("spotify.com")) {
        await downloadAndSend(q, mek);
        return;
      }

      const searchUrl = `${PrinceTechApi}/api/search/spotifysearch?apikey=${PrinceApiKey}&query=${encodeURIComponent(q)}`;
      const searchResponse = await axios.get(searchUrl, { timeout: 30000 });
      const data = searchResponse.data;

      if (!data?.success || !data?.results) {
        await react("❌");
        return reply("Search failed. Please try with a direct Spotify URL.");
      }

      const results = data.results;

      if (results?.status === false) {
        await react("❌");
        return reply("Search service temporarily unavailable. Please try with a direct Spotify URL.");
      }

      let tracks = [];
      if (Array.isArray(results)) {
        tracks = results.slice(0, 3);
      } else if (results?.tracks && Array.isArray(results.tracks)) {
        tracks = results.tracks.slice(0, 3);
      } else if (typeof results === "object" && (results.url || results.link)) {
        tracks = [results];
      }

      if (tracks.length === 0) {
        await react("❌");
        return reply("No Spotify tracks found. Try a different query or provide a direct Spotify URL.");
      }

      const trackList = tracks.map((track, i) => {
        const title = track.title || track.name || "Unknown";
        const artist = track.artist || track.artists?.join(", ") || "Unknown";
        return `│${i + 1}️⃣ ${truncate(title, 30)} - ${truncate(artist, 20)}`;
      }).join("\n");

      const menuMsg = {
        image: { url: botPic },
        caption: `> *${botName} SPOTIFY DOWNLOADER*
╭───────────────◆
│⿻ *Search:* ${truncate(q, 30)}
╰────────────────◆
⏱ *Session expires in 2 minutes*
╭───────────────◆
│Reply With:
${trackList}
╰────────────────◆`,
        contextInfo: getContextInfo(sender, newsletterJid, botName)
      };

      const messageSent = await Prince.sendMessage(from, menuMsg, { quoted: mek });
      const messageId = messageSent.key.id;

      const handleResponse = async (event) => {
        const messageData = event.messages[0];
        if (!messageData.message) return;
        const isReply = messageData.message.extendedTextMessage?.contextInfo?.stanzaId === messageId;
        if (!isReply) return;
        const choice = (messageData.message.conversation || messageData.message.extendedTextMessage?.text || "").trim();

        const index = parseInt(choice) - 1;
        if (isNaN(index) || index < 0 || index >= tracks.length) {
          await reply("Invalid option. Please reply with a valid number.", messageData);
          return;
        }

        await react("⬇️");

        try {
          const selectedTrack = tracks[index];
          const trackUrl = selectedTrack?.url || selectedTrack?.link || selectedTrack?.external_urls?.spotify || selectedTrack?.spotify_url;

          if (!trackUrl) {
            await react("❌");
            return reply("Track URL not available.", messageData);
          }

          await downloadAndSend(trackUrl, messageData);
          Prince.ev.off("messages.upsert", handleResponse);
        } catch (error) {
          console.error("Spotify download error:", error);
          await react("❌");
          await reply("Failed to download. Please try again.", messageData);
          Prince.ev.off("messages.upsert", handleResponse);
        }
      };

      Prince.ev.on("messages.upsert", handleResponse);
      setTimeout(() => Prince.ev.off("messages.upsert", handleResponse), 120000);
    } catch (error) {
      console.error("Spotify API error:", error);
      await react("❌");
      return reply("An error occurred. Please try again.");
    }
  }
);

gmd(
  {
    pattern: "gdrive",
    category: "downloader",
    react: "📁",
    aliases: ["googledrive", "drive", "gdrivedl"],
    description: "Download from Google Drive",
  },
  async (from, Prince, conText) => {
    const { q, mek, reply, react, sender, botName, botFooter, newsletterJid, gmdBuffer, formatAudio, PrinceTechApi, PrinceApiKey } = conText;

    if (!q) {
      await react("❌");
      return reply("Please provide a Google Drive URL");
    }

    if (!q.includes("drive.google.com")) {
      await react("❌");
      return reply("Please provide a valid Google Drive URL");
    }

    try {
      const apiUrl = `${PrinceTechApi}/api/download/gdrivedl?apikey=${PrinceApiKey}&url=${encodeURIComponent(q)}`;
      const response = await axios.get(apiUrl, { timeout: 60000 });

      if (!response.data?.success || !response.data?.result) {
        await react("❌");
        return reply("Failed to fetch file. Please check the URL and ensure the file is publicly accessible.");
      }

      const { name, download_url } = response.data.result;

      if (!download_url) {
        await react("❌");
        return reply("No download URL available.");
      }

      let mimetype = getMimeFromUrl(name || "");
      let mimeCategory = getMimeCategory(mimetype);

      try {
        const headResponse = await axios.head(download_url, { timeout: 15000 });
        const contentType = headResponse.headers["content-type"];
        if (contentType && !contentType.includes("text/html")) {
          mimetype = contentType.split(";")[0].trim();
          mimeCategory = getMimeCategory(mimetype);
        }
      } catch (headErr) {
        if (headErr.response?.status === 404) {
          await react("❌");
          return reply("File not found. The file may have been deleted or is not publicly accessible.");
        }
      }

      let fileBuffer;
      try {
        fileBuffer = await gmdBuffer(download_url);
      } catch (dlErr) {
        if (dlErr.response?.status === 404 || dlErr.message?.includes("404")) {
          await react("❌");
          return reply("File not found. The file may have been deleted or is not publicly accessible.");
        }
        throw dlErr;
      }

      const fileSize = fileBuffer.length;
      const sendAsDoc = fileSize > MAX_MEDIA_SIZE || mimeCategory === "document";

      if (mimeCategory === "audio" && !sendAsDoc) {
        const formattedAudio = await formatAudio(fileBuffer);
        await Prince.sendMessage(from, {
          audio: formattedAudio,
          mimetype: "audio/mpeg",
        }, { quoted: mek });
      } else if (mimeCategory === "video" && !sendAsDoc) {
        await Prince.sendMessage(from, {
          video: fileBuffer,
          mimetype: mimetype || "video/mp4",
          caption: `*${name || "Google Drive File"}*\n\n> *${botFooter}*`,
        }, { quoted: mek });
      } else if (mimeCategory === "image" && !sendAsDoc) {
        await Prince.sendMessage(from, {
          image: fileBuffer,
          caption: `*${name || "Google Drive File"}*\n\n> *${botFooter}*`,
        }, { quoted: mek });
      } else {
        await Prince.sendMessage(from, {
          document: fileBuffer,
          fileName: name || "gdrive_file",
          mimetype: mimetype || "application/octet-stream",
        }, { quoted: mek });
      }

      await react("✅");
    } catch (error) {
      console.error("Google Drive API error:", error);
      await react("❌");
      if (error.response?.status === 404 || error.message?.includes("404")) {
        return reply("File not found. The file may have been deleted or is not publicly accessible.");
      }
      return reply("An error occurred. Please try again.");
    }
  }
);

gmd(
  {
    pattern: "mediafire",
    category: "downloader",
    react: "🔥",
    aliases: ["mfire", "mediafiredl", "mfiredl"],
    description: "Download from MediaFire",
  },
  async (from, Prince, conText) => {
    const { q, mek, reply, react, sender, botName, botFooter, newsletterJid, gmdBuffer, formatAudio, PrinceTechApi, PrinceApiKey } = conText;

    if (!q) {
      await react("❌");
      return reply("Please provide a MediaFire URL");
    }

    if (!q.includes("mediafire.com")) {
      await react("❌");
      return reply("Please provide a valid MediaFire URL");
    }

    try {
      const apiUrl = `${PrinceTechApi}/api/download/mediafire?apikey=${PrinceApiKey}&url=${encodeURIComponent(q)}`;
      const response = await axios.get(apiUrl, { timeout: 60000 });

      if (!response.data?.success || !response.data?.result) {
        await react("❌");
        return reply("Failed to fetch file. Please check the URL and try again.");
      }

      const { fileName, fileSize, fileType, mimeType, downloadUrl } = response.data.result;

      if (!downloadUrl) {
        await react("❌");
        return reply("No download URL available.");
      }

      const mimetype = mimeType || getMimeFromUrl(downloadUrl);
      const mimeCategory = getMimeCategory(mimetype);

      const sizeMatch = fileSize?.match(/([\d.]+)\s*(KB|MB|GB)/i);
      let sizeBytes = 0;
      if (sizeMatch) {
        const size = parseFloat(sizeMatch[1]);
        const unit = sizeMatch[2].toUpperCase();
        if (unit === "KB") sizeBytes = size * 1024;
        else if (unit === "MB") sizeBytes = size * 1024 * 1024;
        else if (unit === "GB") sizeBytes = size * 1024 * 1024 * 1024;
      }

      const sendAsDoc = sizeBytes > MAX_MEDIA_SIZE || mimeCategory === "document";

      const caption = `*${fileName || "MediaFire File"}*\n\n` +
        `*Size:* ${fileSize || "Unknown"}\n` +
        `*Type:* ${fileType || "Unknown"}\n\n> *${botFooter}*`;

      if (mimeCategory === "audio" && !sendAsDoc) {
        const audioBuffer = await gmdBuffer(downloadUrl);
        const formattedAudio = await formatAudio(audioBuffer);
        await Prince.sendMessage(from, {
          audio: formattedAudio,
          mimetype: "audio/mpeg",
        }, { quoted: mek });
      } else if (mimeCategory === "video" && !sendAsDoc) {
        await Prince.sendMessage(from, {
          video: { url: downloadUrl },
          mimetype: mimetype,
          caption: caption,
        }, { quoted: mek });
      } else if (mimeCategory === "image" && !sendAsDoc) {
        await Prince.sendMessage(from, {
          image: { url: downloadUrl },
          caption: caption,
        }, { quoted: mek });
      } else {
        await Prince.sendMessage(from, {
          document: { url: downloadUrl },
          fileName: fileName || "mediafire_file",
          mimetype: mimetype,
          caption: caption,
        }, { quoted: mek });
      }

      await react("✅");
    } catch (error) {
      console.error("MediaFire API error:", error);
      await react("❌");
      return reply("An error occurred. Please try again.");
    }
  }
);

gmd(
  {
    pattern: "apk",
    category: "downloader",
    react: "📱",
    aliases: ["app", "apkdl", "appdownload"],
    description: "Download Android APK files",
  },
  async (from, Prince, conText) => {
    const { q, mek, reply, react, sender, botName, botFooter, newsletterJid, PrinceTechApi, PrinceApiKey } = conText;

    if (!q) {
      await react("❌");
      return reply("Please provide an app name\n\n*Example:* .apk WhatsApp");
    }

    try {
      await reply(`Searching for *${q}* APK...`);

      const apiUrl = `${PrinceTechApi}/api/download/apkdl?apikey=${PrinceApiKey}&appName=${encodeURIComponent(q)}`;
      const response = await axios.get(apiUrl, { timeout: 60000 });

      if (!response.data?.success || !response.data?.result) {
        await react("❌");
        return reply("App not found. Please try a different name.");
      }

      const { appname, appicon, developer, mimetype, download_url } = response.data.result;

      if (!download_url) {
        await react("❌");
        return reply("No download URL available for this app.");
      }

      const caption = `*${botName} APK DOWNLOADER*\n\n` +
        `*App:* ${appname || q}\n` +
        `*Developer:* ${developer || "Unknown"}\n\n` +
        `_Downloading APK..._\n\n> *${botFooter}*`;

      await Prince.sendMessage(from, {
        image: { url: appicon },
        caption: caption,
        contextInfo: getContextInfo(sender, newsletterJid, botName),
      }, { quoted: mek });

      await Prince.sendMessage(from, {
        document: { url: download_url },
        fileName: `${(appname || q).replace(/[^\w\s.-]/gi, "")}.apk`,
        mimetype: mimetype || "application/vnd.android.package-archive",
      }, { quoted: mek });

      await react("✅");
    } catch (error) {
      console.error("APK download error:", error);
      await react("❌");
      return reply("An error occurred. Please try again.");
    }
  }
);

gmd(
  {
    pattern: "pastebin",
    category: "downloader",
    react: "📋",
    aliases: ["getpaste", "getpastebin", "pastedl", "pastebindl", "paste"],
    description: "Fetch content from Pastebin",
  },
  async (from, Prince, conText) => {
    const { q, mek, reply, react, sender, botName, botFooter, newsletterJid, PrinceTechApi, PrinceApiKey } = conText;

    if (!q) {
      await react("❌");
      return reply("Please provide a Pastebin URL\n\n*Example:* .pastebin https://pastebin.com/xxxxxx");
    }

    if (!q.includes("pastebin.com")) {
      await react("❌");
      return reply("Please provide a valid Pastebin URL");
    }

    try {
      await reply("Fetching paste content...");

      const apiUrl = `${PrinceTechApi}/api/download/pastebin?apikey=${PrinceApiKey}&url=${encodeURIComponent(q)}`;
      const response = await axios.get(apiUrl, { timeout: 30000 });

      if (!response.data?.success || !response.data?.result) {
        await react("❌");
        return reply("Failed to fetch paste. Please check the URL and try again.");
      }

      let content = response.data.result;

      content = content
        .replace(/\\r\\n/g, "\n")
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t");
      content = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

      const pasteId = q.split("/").pop().split("?")[0];

      const header = `*${botName} PASTEBIN VIEWER*\n` +
        `*Paste ID:* ${pasteId}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n`;

      const fullMessage = header + content;

      if (fullMessage.length > 65000) {
        const textBuffer = Buffer.from(content, "utf-8");
        await Prince.sendMessage(from, {
          document: textBuffer,
          fileName: `pastebin_${pasteId}.txt`,
          mimetype: "text/plain",
          caption: `*Paste ID:* ${pasteId}\n_Content too long, sent as file_\n\n> *${botFooter}*`,
        }, { quoted: mek });
      } else {
        await Prince.sendMessage(from, {
          text: fullMessage,
        }, { quoted: mek });
      }

      await react("✅");
    } catch (error) {
      console.error("Pastebin API error:", error);
      await react("❌");
      return reply("An error occurred. Please try again.");
    }
  }
);

gmd(
  {
    pattern: "ytv",
    category: "downloader",
    react: "📽",
    description: "Download Video from Youtube",
  },
  async (from, Prince, conText) => {
    const { q, mek, reply, react, sender, botPic, botName, botFooter, newsletterJid, gmdJson, gmdBuffer, formatVideo, PrinceTechApi, PrinceApiKey } = conText;

    if (!q) {
      await react("❌");
      return reply("Please provide a YouTube URL");
    }

    if (!q.startsWith("https://youtu.be/") && !q.startsWith("https://www.youtube.com/") && !q.startsWith("https://youtube.com/")) {
      return reply("Please provide a valid YouTube URL!");
    }

    try {
      const searchResponse = await gmdJson(`${PrinceTechApi}/search/yts?apikey=${PrinceApiKey}&query=${encodeURIComponent(q)}`);
      const videoInfo = searchResponse.results[0];

      const infoMessage = {
        image: { url: videoInfo.thumbnail || botPic },
        caption: `> *${botName} VIDEO DOWNLOADER*\n\n` +
          `*Title:* ${videoInfo.title}\n` +
          `*Duration:* ${videoInfo.timestamp}\n` +
          `*Views:* ${videoInfo.views}\n` +
          `*Uploaded:* ${videoInfo.ago}\n` +
          `*Artist:* ${videoInfo.author.name}\n\n` +
          `⏱ *Session expires in 2 minutes*\n` +
          `╭───────────────◆\n` +
          `│Reply With:\n` +
          `│1️⃣ Download 360p\n` +
          `│2️⃣ Download 720p\n` +
          `│3️⃣ Download 1080p\n` +
          `╰────────────────◆`,
        contextInfo: getContextInfo(sender, newsletterJid, botName),
      };

      const sentMessage = await Prince.sendMessage(from, infoMessage, { quoted: mek });
      const messageId = sentMessage.key.id;

      const handleResponse = async (event) => {
        const messageData = event.messages[0];
        if (!messageData.message) return;
        const isReply = messageData.message.extendedTextMessage?.contextInfo?.stanzaId === messageId;
        if (!isReply) return;
        const choice = (messageData.message.conversation || messageData.message.extendedTextMessage?.text || "").trim();

        await react("⬇️");

        try {
          let quality;
          switch (choice) {
            case "1":
              quality = 360;
              break;
            case "2":
              quality = 720;
              break;
            case "3":
              quality = 1080;
              break;
            default:
              return reply("Invalid option. Please reply with: 1, 2 or 3", messageData);
          }

          const downloadResult = await giftedDls.ytmp4(q, quality);
          const downloadUrl = downloadResult.result.download_url;
          const videoBuffer = await gmdBuffer(downloadUrl);

          if (videoBuffer instanceof Error) {
            await react("❌");
            return reply("Failed to download the video.", messageData);
          }

          const fileSize = videoBuffer.length;
          const sendAsDoc = fileSize > MAX_MEDIA_SIZE;

          if (sendAsDoc) {
            await Prince.sendMessage(from, {
              document: videoBuffer,
              fileName: `${videoInfo.title.replace(/[^\w\s.-]/gi, "")}.mp4`,
              mimetype: "video/mp4",
              caption: `> *${botFooter}*`,
            }, { quoted: messageData });
          } else {
            const formattedVideo = await formatVideo(videoBuffer);
            await Prince.sendMessage(from, {
              video: formattedVideo,
              mimetype: "video/mp4",
              caption: `> *${botFooter}*`,
            }, { quoted: messageData });
          }

          await react("✅");
          Prince.ev.off("messages.upsert", handleResponse);
        } catch (error) {
          console.error("Error processing video:", error);
          await react("❌");
          await reply("Failed to process video. Please try again.", messageData);
          Prince.ev.off("messages.upsert", handleResponse);
        }
      };

      Prince.ev.on("messages.upsert", handleResponse);
      setTimeout(() => Prince.ev.off("messages.upsert", handleResponse), 120000);
    } catch (error) {
      console.error("YouTube download error:", error);
      await react("❌");
      return reply("An error occurred while processing your request. Please try again.");
    }
  }
);

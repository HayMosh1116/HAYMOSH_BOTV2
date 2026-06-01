const { gmd, getContextInfo } = require("../mayel");



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
        image: imageBuffer,
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
      const searchResponse = await gmdJson(`https://yts.gifted.co.ke/?q=${encodeURIComponent(q)}`);

      if (!searchResponse || !Array.isArray(searchResponse.videos)) {
        await react("❌");
        return reply("Invalid response from search API. Please try again.");
      }

      if (searchResponse.videos.length === 0) {
        await react("❌");
        return reply("No results found for your search.");
      }

      const firstVideo = searchResponse.videos[0];
      const videoUrl = firstVideo.url;
      
      const audioApis = [
        `${PrinceTechApi}/api/download/ytmp3?apikey=${PrinceApiKey}&url=${encodeURIComponent(videoUrl)}`,
        `${PrinceTechApi}/api/download/yta?apikey=${PrinceApiKey}&url=${encodeURIComponent(videoUrl)}`,
        `${PrinceTechApi}/api/download/dlmp3?apikey=${PrinceApiKey}&url=${encodeURIComponent(videoUrl)}`,
        `${PrinceTechApi}/api/download/mp3?apikey=${PrinceApiKey}&url=${encodeURIComponent(videoUrl)}`,
        `${PrinceTechApi}/api/download/ytaudio?apikey=${PrinceApiKey}&url=${encodeURIComponent(videoUrl)}`,
        `${PrinceTechApi}/api/download/ytmusic?apikey=${PrinceApiKey}&url=${encodeURIComponent(videoUrl)}`
      ];

      let downloadUrl = null;

      for (const api of audioApis) {
        try {
          const response = await gmdJson(api);
          if (response.result?.download_url) {
            downloadUrl = response.result.download_url;
            break;
          }
        } catch (e) {
          console.log(`API ${api} failed: ${e.message}`);
        }
      }
      
      if (!downloadUrl) {
        await react("❌");
        return reply("Failed to get download URL for the audio.");
      }

      const buffer = await gmdBuffer(downloadUrl);
      const convertedBuffer = await formatAudio(buffer);
      if (buffer instanceof Error) {
        await react("❌");
        return reply("Failed to download the audio file.");
      }

      const infoMess = {
        image: { url: firstVideo.thumbnail || botPic },
        caption: `> *${botName} 𝐒𝐎𝐍𝐆 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐄𝐑*  
╭───────────────◆  
│⿻ *Title:* ${firstVideo.name}
│⿻ *Duration:* ${firstVideo.duration}
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
          switch (messageContent.trim()) {
            case "1":
              await Prince.sendMessage(from, {
                audio: convertedBuffer,
                mimetype: "audio/mpeg",
                fileName: `${firstVideo.name}.mp3`.replace(/[^\w\s.-]/gi, ''),
                caption: `${firstVideo.name}`,
                externalAdReply: {
                  title: `${firstVideo.name}.mp3`,
                  body: 'Youtube Downloader',
                  mediaType: 1,
                  thumbnailUrl: firstVideo.thumbnail || botPic,
                  sourceUrl: newsletterUrl,
                  renderLargerThumbnail: false,
                  showAdAttribution: true,
                },
              }, { quoted: messageData });
              break;
              
            case "2":
              await Prince.sendMessage(from, {
                document: convertedBuffer,
                mimetype: "audio/mpeg",
                fileName: `${firstVideo.name}.mp3`.replace(/[^\w\s.-]/gi, ''),
                caption: `${firstVideo.name}`,
              }, { quoted: messageData });
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
      const searchResponse = await gmdJson(`https://yts.giftedtech.co.ke/?q=${encodeURIComponent(q)}`);
      
      if (!searchResponse || !Array.isArray(searchResponse.videos)) {
        await react("❌");
        return reply("Invalid response from search API. Please try again.");
      }

      if (searchResponse.videos.length === 0) {
        await react("❌");
        return reply("No results found for your search.");
      }
      
      const firstVideo = searchResponse.videos[0];
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
          if (response.result?.download_url) {
            downloadUrl = response.result.download_url;
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
      const convertedBuffer = await formatVideo(buffer);
      if (buffer instanceof Error) {
        await react("❌");
        return reply("Failed to download the video file.");
      }

      const infoMess = {
        image: { url: firstVideo.thumbnail || botPic },
        caption: `> *${botName} 𝐕𝐈𝐃𝐄𝐎 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐄𝐑*  
╭───────────────◆  
│⿻ *Title:* ${firstVideo.name}
│⿻ *Duration:* ${firstVideo.duration}
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
                fileName: `${firstVideo.name}.mp4`.replace(/[^\w\s.-]/gi, ''),
                caption: `🎥 ${firstVideo.name}`,
              }, { quoted: messageData });
              break;
              
            case "2":
              await Prince.sendMessage(from, {
                document: convertedBuffer,
                mimetype: "video/mp4",
                fileName: `${firstVideo.name}.mp4`.replace(/[^\w\s.-]/gi, ''),
                caption: `📄 ${firstVideo.name}`,
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

const { gmd, getContextInfo } = require("../mayel");
const axios = require("axios");

const MAX_MEDIA_SIZE = 60 * 1024 * 1024;
const GIT_REPO_REGEX = /github\.com\/([^\/]+)\/([^\/\s]+)/;

async function getFileSize(url) {
  try {
    const res = await axios.head(url, { timeout: 10000 });
    return parseInt(res.headers['content-length'] || '0', 10);
  } catch { return 0; }
}

gmd(
  {
    pattern: "gitclone",
    category: "downloader",
    react: "📦",
    aliases: ["gitdl", "github", "git", "repodl", "clone"],
    description: "Download GitHub repository as zip file",
  },
  async (from, Prince, conText) => {
    const { q, mek, reply, react, sender, botName, newsletterJid } = conText;

    if (!q) {
      await react("❌");
      return reply("Please provide a GitHub repository link.\n\n*Usage:* .gitclone https://github.com/user/repo");
    }

    if (!GIT_REPO_REGEX.test(q)) {
      await react("❌");
      return reply("Invalid GitHub link format. Please provide a valid GitHub repository URL.");
    }

    try {
      let [, user, repo] = q.match(GIT_REPO_REGEX) || [];
      repo = repo.replace(/\.git$/, "").split("/")[0];

      const apiUrl = `https://api.github.com/repos/${user}/${repo}`;
      const zipUrl = `https://api.github.com/repos/${user}/${repo}/zipball`;

      await reply(`Fetching repository *${user}/${repo}*...`);

      const repoResponse = await axios.get(apiUrl);
      if (!repoResponse.data) {
        await react("❌");
        return reply("Repository not found or access denied. Make sure the repository is public.");
      }

      const repoData = repoResponse.data;
      const defaultBranch = repoData.default_branch || "main";
      const filename = `${user}-${repo}-${defaultBranch}.zip`;

      await Prince.sendMessage(
        from,
        {
          document: { url: zipUrl },
          fileName: filename,
          mimetype: "application/zip",
          contextInfo: getContextInfo(sender, newsletterJid, botName),
        },
        { quoted: mek }
      );

      await react("✅");
    } catch (error) {
      console.error("GitClone error:", error);
      await react("❌");

      if (error.message?.includes("404")) {
        return reply("Repository not found.");
      } else if (error.message?.includes("rate limit")) {
        return reply("GitHub API rate limit exceeded. Please try again later.");
      } else {
        return reply(`Failed to download repository: ${error.message}`);
      }
    }
  }
);

gmd(
  {
    pattern: "fb",
    category: "downloader",
    react: "📘",
    aliases: ["fbdl", "facebookdl", "facebook"],
    description: "Download Facebook videos",
  },
  async (from, Prince, conText) => {
    const { q, mek, reply, react, sender, botName, botFooter, botPic, newsletterJid, gmdBuffer, toAudio, formatAudio, PrinceTechApi, PrinceApiKey } = conText;

    if (!q) {
      await react("❌");
      return reply("Please provide a Facebook video URL");
    }

    if (!q.includes("facebook.com") && !q.includes("fb.watch")) {
      await react("❌");
      return reply("Please provide a valid Facebook URL");
    }

    try {
      const apiUrl = `${PrinceTechApi}/api/download/facebook?apikey=${PrinceApiKey}&url=${encodeURIComponent(q)}`;
      const response = await axios.get(apiUrl, { timeout: 60000 });

      if (!response.data?.success || !response.data?.result) {
        await react("❌");
        return reply("Failed to fetch video. Please check the URL and try again.");
      }

      const { title, duration, thumbnail, hd_video, sd_video } = response.data.result;

      const options = [];
      const actionMap = {};
      let optNum = 1;

      if (hd_video) {
        options.push(`│${optNum}️⃣ HD Video 🎥`);
        actionMap[String(optNum)] = "hd";
        optNum++;
      }
      if (sd_video) {
        options.push(`│${optNum}️⃣ SD Video 📹`);
        actionMap[String(optNum)] = "sd";
        optNum++;
      }
      options.push(`│${optNum}️⃣ Audio Only 🎶`);
      actionMap[String(optNum)] = "audio";

      const menuMsg = {
        image: { url: thumbnail || botPic },
        caption: `> *${botName} FACEBOOK DOWNLOADER*
╭───────────────◆
│⿻ *Title:* ${title || "Facebook Video"}
│⿻ *Duration:* ${duration || "Unknown"}
╰────────────────◆
⏱ *Session expires in 2 minutes*
╭───────────────◆
│Reply With:
${options.join("\n")}
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
        const action = actionMap[choice];

        if (!action) {
          await reply("Invalid option. Please reply with a valid number.", messageData);
          return;
        }

        await react("⬇️");

        try {
          if (action === "audio") {
            const sourceVideo = hd_video || sd_video;
            if (!sourceVideo) {
              await react("❌");
              return reply("No video available for audio extraction.", messageData);
            }

            const videoBuffer = await gmdBuffer(sourceVideo);
            if (!videoBuffer || videoBuffer instanceof Error || !Buffer.isBuffer(videoBuffer)) {
              await react("❌");
              return reply("Failed to download video for audio extraction. Please try again.", messageData);
            }

            let audioBuffer;
            try {
              audioBuffer = await toAudio(videoBuffer);
            } catch (audioErr) {
              await react("❌");
              const errMsg = audioErr.message || String(audioErr);
              if (errMsg.includes('no audio')) {
                return reply("This video has no audio track to extract.", messageData);
              }
              return reply("Failed to convert video to audio: " + errMsg, messageData);
            }

            if (!audioBuffer || !Buffer.isBuffer(audioBuffer)) {
              await react("❌");
              return reply("Failed to convert video to audio. The video format may not be supported.", messageData);
            }

            const formattedAudio = await formatAudio(audioBuffer);
            const fileSize = formattedAudio.length;

            if (fileSize > MAX_MEDIA_SIZE) {
              await Prince.sendMessage(from, {
                document: formattedAudio,
                fileName: `${(title || "facebook_audio").replace(/[^\w\s.-]/gi, "")}.mp3`,
                mimetype: "audio/mpeg",
              }, { quoted: messageData });
            } else {
              await Prince.sendMessage(from, {
                audio: formattedAudio,
                mimetype: "audio/mpeg",
              }, { quoted: messageData });
            }
          } else {
            const selectedVideoUrl = action === "hd" ? hd_video : sd_video;

            if (!selectedVideoUrl) {
              await react("❌");
              return reply("Selected quality not available.", messageData);
            }

            const fileSize = await getFileSize(selectedVideoUrl);
            const sendAsDoc = fileSize > MAX_MEDIA_SIZE;

            if (sendAsDoc) {
              await Prince.sendMessage(from, {
                document: { url: selectedVideoUrl },
                fileName: `${(title || "facebook_video").replace(/[^\w\s.-]/gi, "")}.mp4`,
                mimetype: "video/mp4",
                caption: `*${title || "Facebook Video"}*\n\n> *${botFooter}*`,
              }, { quoted: messageData });
            } else {
              await Prince.sendMessage(from, {
                video: { url: selectedVideoUrl },
                mimetype: "video/mp4",
                caption: `*${title || "Facebook Video"}*\n\n> *${botFooter}*`,
              }, { quoted: messageData });
            }
          }

          await react("✅");
          Prince.ev.off("messages.upsert", handleResponse);
        } catch (error) {
          console.error("Facebook download error:", error);
          await react("❌");
          await reply("Failed to download. Please try again.", messageData);
          Prince.ev.off("messages.upsert", handleResponse);
        }
      };

      Prince.ev.on("messages.upsert", handleResponse);
      setTimeout(() => Prince.ev.off("messages.upsert", handleResponse), 120000);
    } catch (error) {
      console.error("Facebook API error:", error);
      await react("❌");
      return reply("An error occurred. Please try again.");
    }
  }
);

gmd(
  {
    pattern: "tiktok",
    category: "downloader",
    react: "🎵",
    aliases: ["tiktokdl", "ttdl", "tt"],
    description: "Download TikTok videos",
  },
  async (from, Prince, conText) => {
    const { q, mek, reply, react, sender, botName, botFooter, botPic, newsletterJid, gmdBuffer, toAudio, formatAudio, PrinceTechApi, PrinceApiKey } = conText;

    if (!q) {
      await react("❌");
      return reply("Please provide a TikTok URL");
    }

    if (!q.includes("tiktok.com")) {
      await react("❌");
      return reply("Please provide a valid TikTok URL");
    }

    try {
      const endpoints = ["tiktok", "tiktokdlv2", "tiktokdlv3", "tiktokdlv4"];
      let result = null;

      for (const endpoint of endpoints) {
        try {
          const apiUrl = `${PrinceTechApi}/api/download/${endpoint}?apikey=${PrinceApiKey}&url=${encodeURIComponent(q)}`;
          const response = await axios.get(apiUrl, { timeout: 30000 });

          if (response.data?.success && response.data?.result) {
            result = response.data.result;
            break;
          }
        } catch (err) {
          continue;
        }
      }

      if (!result) {
        await react("❌");
        return reply("Failed to fetch TikTok video. Please try again later.");
      }

      const { title, video, music, cover, author } = result;

      const menuMsg = {
        image: { url: cover || botPic },
        caption: `> *${botName} TIKTOK DOWNLOADER*
╭───────────────◆
│⿻ *Title:* ${title || "TikTok Video"}
│⿻ *Author:* ${author?.name || author || "Unknown"}
╰────────────────◆
⏱ *Session expires in 2 minutes*
╭───────────────◆
│Reply With:
│1️⃣ Video 🎥
│2️⃣ Audio Only 🎶
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
        await react("⬇️");

        try {
          switch (choice) {
            case "1": {
              const fileSize = await getFileSize(video);
              const sendAsDoc = fileSize > MAX_MEDIA_SIZE;

              if (sendAsDoc) {
                await Prince.sendMessage(from, {
                  document: { url: video },
                  fileName: `${(title || "tiktok_video").replace(/[^\w\s.-]/gi, "")}.mp4`,
                  mimetype: "video/mp4",
                  caption: `*${title || "TikTok Video"}*\n\n> *${botFooter}*`,
                }, { quoted: messageData });
              } else {
                await Prince.sendMessage(from, {
                  video: { url: video },
                  mimetype: "video/mp4",
                  caption: `*${title || "TikTok Video"}*\n\n> *${botFooter}*`,
                }, { quoted: messageData });
              }
              break;
            }
            case "2": {
              let audioBuffer;

              if (music) {
                audioBuffer = await gmdBuffer(music);
                audioBuffer = await formatAudio(audioBuffer);
              } else {
                const videoBuffer = await gmdBuffer(video);
                audioBuffer = await toAudio(videoBuffer);
                audioBuffer = await formatAudio(audioBuffer);
              }

              const fileSize = audioBuffer.length;

              if (fileSize > MAX_MEDIA_SIZE) {
                await Prince.sendMessage(from, {
                  document: audioBuffer,
                  fileName: `${(title || "tiktok_audio").replace(/[^\w\s.-]/gi, "")}.mp3`,
                  mimetype: "audio/mpeg",
                }, { quoted: messageData });
              } else {
                await Prince.sendMessage(from, {
                  audio: audioBuffer,
                  mimetype: "audio/mpeg",
                }, { quoted: messageData });
              }
              break;
            }
            default:
              await reply("Invalid option. Please reply with:\n1️⃣ For Video\n2️⃣ For Audio", messageData);
              return;
          }

          await react("✅");
          Prince.ev.off("messages.upsert", handleResponse);
        } catch (error) {
          console.error("TikTok download error:", error);
          await react("❌");
          await reply("Failed to download. Please try again.", messageData);
          Prince.ev.off("messages.upsert", handleResponse);
        }
      };

      Prince.ev.on("messages.upsert", handleResponse);
      setTimeout(() => Prince.ev.off("messages.upsert", handleResponse), 120000);
    } catch (error) {
      console.error("TikTok API error:", error);
      await react("❌");
      return reply("An error occurred. Please try again.");
    }
  }
);

gmd(
  {
    pattern: "twitter",
    category: "downloader",
    react: "🐦",
    aliases: ["twitterdl", "xdl", "xdownloader", "twitterdownloader", "x"],
    description: "Download Twitter/X videos",
  },
  async (from, Prince, conText) => {
    const { q, mek, reply, react, sender, botName, botFooter, botPic, newsletterJid, gmdBuffer, toAudio, formatAudio, PrinceTechApi, PrinceApiKey } = conText;

    if (!q) {
      await react("❌");
      return reply("Please provide a Twitter/X URL");
    }

    if (!q.includes("twitter.com") && !q.includes("x.com")) {
      await react("❌");
      return reply("Please provide a valid Twitter/X URL");
    }

    try {
      const apiUrl = `${PrinceTechApi}/api/download/twitter?apikey=${PrinceApiKey}&url=${encodeURIComponent(q)}`;
      const response = await axios.get(apiUrl, { timeout: 60000 });

      if (!response.data?.success || !response.data?.result) {
        await react("❌");
        return reply("Failed to fetch video. Please check the URL and try again.");
      }

      const { thumbnail, videoUrls } = response.data.result;

      if (!videoUrls || videoUrls.length === 0) {
        await react("❌");
        return reply("No video found in this tweet.");
      }

      const options = [];
      const actionMap = {};
      let optNum = 1;

      videoUrls.forEach((v, index) => {
        options.push(`│${optNum}️⃣ ${v.quality} Quality 🎥`);
        actionMap[String(optNum)] = { type: "video", index };
        optNum++;
      });

      options.push(`│${optNum}️⃣ Audio Only 🎶`);
      actionMap[String(optNum)] = { type: "audio" };

      const menuMsg = {
        image: { url: thumbnail || botPic },
        caption: `> *${botName} TWITTER DOWNLOADER*
╭───────────────◆
│⿻ *Qualities:* ${videoUrls.map((v) => v.quality).join(", ")}
╰────────────────◆
⏱ *Session expires in 2 minutes*
╭───────────────◆
│Reply With:
${options.join("\n")}
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
        const action = actionMap[choice];

        if (!action) {
          await reply("Invalid option. Please reply with a valid number.", messageData);
          return;
        }

        await react("⬇️");

        try {
          if (action.type === "audio") {
            const bestVideo = videoUrls[0]?.url;
            if (!bestVideo) {
              await react("❌");
              return reply("No video available for audio extraction.", messageData);
            }

            const videoBuffer = await gmdBuffer(bestVideo);
            const audioBuffer = await toAudio(videoBuffer);
            const formattedAudio = await formatAudio(audioBuffer);
            const fileSize = formattedAudio.length;

            if (fileSize > MAX_MEDIA_SIZE) {
              await Prince.sendMessage(from, {
                document: formattedAudio,
                fileName: "twitter_audio.mp3",
                mimetype: "audio/mpeg",
              }, { quoted: messageData });
            } else {
              await Prince.sendMessage(from, {
                audio: formattedAudio,
                mimetype: "audio/mpeg",
              }, { quoted: messageData });
            }
          } else {
            const videoUrl = videoUrls[action.index]?.url;

            if (!videoUrl) {
              await react("❌");
              return reply("Selected quality not available.", messageData);
            }

            const fileSize = await getFileSize(videoUrl);
            const sendAsDoc = fileSize > MAX_MEDIA_SIZE;

            if (sendAsDoc) {
              await Prince.sendMessage(from, {
                document: { url: videoUrl },
                fileName: `twitter_video_${videoUrls[action.index].quality}.mp4`,
                mimetype: "video/mp4",
                caption: `> *${botFooter}*`,
              }, { quoted: messageData });
            } else {
              await Prince.sendMessage(from, {
                video: { url: videoUrl },
                mimetype: "video/mp4",
                caption: `> *${botFooter}*`,
              }, { quoted: messageData });
            }
          }

          await react("✅");
          Prince.ev.off("messages.upsert", handleResponse);
        } catch (error) {
          console.error("Twitter download error:", error);
          await react("❌");
          await reply("Failed to download. Please try again.", messageData);
          Prince.ev.off("messages.upsert", handleResponse);
        }
      };

      Prince.ev.on("messages.upsert", handleResponse);
      setTimeout(() => Prince.ev.off("messages.upsert", handleResponse), 120000);
    } catch (error) {
      console.error("Twitter API error:", error);
      await react("❌");
      return reply("An error occurred. Please try again.");
    }
  }
);

gmd(
  {
    pattern: "ig",
    category: "downloader",
    react: "📸",
    aliases: ["insta", "instadl", "igdl", "instagram"],
    description: "Download Instagram reels/videos",
  },
  async (from, Prince, conText) => {
    const { q, mek, reply, react, sender, botName, botFooter, botPic, newsletterJid, gmdBuffer, toAudio, formatAudio, PrinceTechApi, PrinceApiKey } = conText;

    if (!q) {
      await react("❌");
      return reply("Please provide an Instagram URL");
    }

    if (!q.includes("instagram.com")) {
      await react("❌");
      return reply("Please provide a valid Instagram URL");
    }

    try {
      const apiUrl = `${PrinceTechApi}/api/download/instadl?apikey=${PrinceApiKey}&url=${encodeURIComponent(q)}`;
      const response = await axios.get(apiUrl, { timeout: 60000 });

      if (!response.data?.success || !response.data?.result) {
        await react("❌");
        return reply("Failed to fetch content. Please check the URL and try again.");
      }

      const { thumbnail, download_url } = response.data.result;

      if (!download_url) {
        await react("❌");
        return reply("No downloadable content found.");
      }

      const menuMsg = {
        image: { url: thumbnail || botPic },
        caption: `> *${botName} INSTAGRAM DOWNLOADER*
╭───────────────◆
│⿻ *Platform:* Instagram
╰────────────────◆
⏱ *Session expires in 2 minutes*
╭───────────────◆
│Reply With:
│1️⃣ Video 🎥
│2️⃣ Audio Only 🎶
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
        await react("⬇️");

        try {
          switch (choice) {
            case "1": {
              const fileSize = await getFileSize(download_url);
              const sendAsDoc = fileSize > MAX_MEDIA_SIZE;

              if (sendAsDoc) {
                await Prince.sendMessage(from, {
                  document: { url: download_url },
                  fileName: "instagram_video.mp4",
                  mimetype: "video/mp4",
                  caption: `*Downloaded via ${botName}*\n\n> *${botFooter}*`,
                }, { quoted: messageData });
              } else {
                await Prince.sendMessage(from, {
                  video: { url: download_url },
                  mimetype: "video/mp4",
                  caption: `*Downloaded via ${botName}*\n\n> *${botFooter}*`,
                }, { quoted: messageData });
              }
              break;
            }
            case "2": {
              const videoBuffer = await gmdBuffer(download_url);
              const audioBuffer = await toAudio(videoBuffer);
              const formattedAudio = await formatAudio(audioBuffer);
              const fileSize = formattedAudio.length;

              if (fileSize > MAX_MEDIA_SIZE) {
                await Prince.sendMessage(from, {
                  document: formattedAudio,
                  fileName: "instagram_audio.mp3",
                  mimetype: "audio/mpeg",
                }, { quoted: messageData });
              } else {
                await Prince.sendMessage(from, {
                  audio: formattedAudio,
                  mimetype: "audio/mpeg",
                }, { quoted: messageData });
              }
              break;
            }
            default:
              await reply("Invalid option. Please reply with:\n1️⃣ For Video\n2️⃣ For Audio", messageData);
              return;
          }

          await react("✅");
          Prince.ev.off("messages.upsert", handleResponse);
        } catch (error) {
          console.error("Instagram download error:", error);
          await react("❌");
          await reply("Failed to download. Please try again.", messageData);
          Prince.ev.off("messages.upsert", handleResponse);
        }
      };

      Prince.ev.on("messages.upsert", handleResponse);
      setTimeout(() => Prince.ev.off("messages.upsert", handleResponse), 120000);
    } catch (error) {
      console.error("Instagram API error:", error);
      await react("❌");
      return reply("An error occurred. Please try again.");
    }
  }
);

gmd(
  {
    pattern: "snack",
    category: "downloader",
    react: "🍿",
    aliases: ["snackdl", "snackvideo"],
    description: "Download Snack Video",
  },
  async (from, Prince, conText) => {
    const { q, mek, reply, react, sender, botName, botFooter, botPic, newsletterJid, gmdBuffer, toAudio, formatAudio, PrinceTechApi, PrinceApiKey } = conText;

    if (!q) {
      await react("❌");
      return reply("Please provide a Snack Video URL");
    }

    if (!q.includes("snackvideo.com")) {
      await react("❌");
      return reply("Please provide a valid Snack Video URL");
    }

    try {
      const apiUrl = `${PrinceTechApi}/api/download/snackdl?apikey=${PrinceApiKey}&url=${encodeURIComponent(q)}`;
      const response = await axios.get(apiUrl, { timeout: 60000 });

      if (!response.data?.success || !response.data?.result) {
        await react("❌");
        return reply("Failed to fetch video. Please check the URL and try again.");
      }

      const { title, media, thumbnail, author, like, comment, share } = response.data.result;

      if (!media) {
        await react("❌");
        return reply("No video found.");
      }

      const menuMsg = {
        image: { url: thumbnail || botPic },
        caption: `> *${botName} SNACK VIDEO DOWNLOADER*
╭───────────────◆
│⿻ *Title:* ${title || "Snack Video"}
│⿻ *Author:* ${author || "Unknown"}
│⿻ *Likes:* ${like || "0"}
│⿻ *Comments:* ${comment || "0"}
│⿻ *Shares:* ${share || "0"}
╰────────────────◆
⏱ *Session expires in 2 minutes*
╭───────────────◆
│Reply With:
│1️⃣ Video 🎥
│2️⃣ Audio Only 🎶
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
        await react("⬇️");

        try {
          switch (choice) {
            case "1": {
              const fileSize = await getFileSize(media);
              const sendAsDoc = fileSize > MAX_MEDIA_SIZE;

              if (sendAsDoc) {
                await Prince.sendMessage(from, {
                  document: { url: media },
                  fileName: `${(title || "snack_video").replace(/[^\w\s.-]/gi, "")}.mp4`,
                  mimetype: "video/mp4",
                  caption: `*${title || "Snack Video"}*\n\n> *${botFooter}*`,
                }, { quoted: messageData });
              } else {
                await Prince.sendMessage(from, {
                  video: { url: media },
                  mimetype: "video/mp4",
                  caption: `*${title || "Snack Video"}*\n\n> *${botFooter}*`,
                }, { quoted: messageData });
              }
              break;
            }
            case "2": {
              const videoBuffer = await gmdBuffer(media);
              const audioBuffer = await toAudio(videoBuffer);
              const formattedAudio = await formatAudio(audioBuffer);
              const fileSize = formattedAudio.length;

              if (fileSize > MAX_MEDIA_SIZE) {
                await Prince.sendMessage(from, {
                  document: formattedAudio,
                  fileName: `${(title || "snack_audio").replace(/[^\w\s.-]/gi, "")}.mp3`,
                  mimetype: "audio/mpeg",
                }, { quoted: messageData });
              } else {
                await Prince.sendMessage(from, {
                  audio: formattedAudio,
                  mimetype: "audio/mpeg",
                }, { quoted: messageData });
              }
              break;
            }
            default:
              await reply("Invalid option. Please reply with:\n1️⃣ For Video\n2️⃣ For Audio", messageData);
              return;
          }

          await react("✅");
          Prince.ev.off("messages.upsert", handleResponse);
        } catch (error) {
          console.error("Snack Video download error:", error);
          await react("❌");
          await reply("Failed to download. Please try again.", messageData);
          Prince.ev.off("messages.upsert", handleResponse);
        }
      };

      Prince.ev.on("messages.upsert", handleResponse);
      setTimeout(() => Prince.ev.off("messages.upsert", handleResponse), 120000);
    } catch (error) {
      console.error("Snack Video API error:", error);
      await react("❌");
      return reply("An error occurred. Please try again.");
    }
  }
);

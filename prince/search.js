const { gmd, getContextInfo, PrinceTechApi, PrinceApiKey, config } = require("../mayel"),
  acrcloud = require("acrcloud"),
  fs = require("fs").promises,
  axios = require("axios"),
  stream = require("stream"),
  { promisify } = require("util"),
  pipeline = promisify(stream.pipeline),
  {
    generateWAMessageContent,
    generateWAMessageFromContent,
  } = require("prince-baileys"),
  { Sticker, StickerTypes } = require("wa-sticker-formatter");

gmd(
  {
    pattern: "yts",
    aliases: ["yt-search"],
    category: "search",
    react: "🔍",
    description: "perform youtube search",
  },
  async (from, Prince, conText) => {
    const { q, mek, reply, react, sender, botFooter } = conText;

    if (!q) {
      await react("❌");
      return reply("Please provide a search query");
    }

    try {
      const apiUrl = `https://yts.giftedtech.co.ke/?q=${encodeURIComponent(q)}`;
      const res = await axios.get(apiUrl, { timeout: 100000 });
      const results = res.data?.videos;

      if (!Array.isArray(results) || results.length === 0) return;

      const videos = results.slice(0, 5);
      const cards = await Promise.all(
        videos.map(async (vid, i) => ({
          header: {
            title: `🎬 *${vid.name}*`,
            hasMediaAttachment: true,
            imageMessage: (
              await generateWAMessageContent(
                { image: { url: vid.thumbnail } },
                {
                  upload: Prince.waUploadToServer,
                },
              )
            ).imageMessage,
          },
          body: {
            text: `📺 Duration: ${vid.duration}\n👁️ Views: ${vid.views}${vid.published ? `\n📅 Published: ${vid.published}` : ""}`,
          },
          footer: { text: `> *${botFooter}*` },
          nativeFlowMessage: {
            buttons: [
              {
                name: "cta_copy",
                buttonParamsJson: JSON.stringify({
                  display_text: "Copy Link",
                  copy_code: vid.url,
                }),
              },
              {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                  display_text: "Watch on YouTube",
                  url: vid.url,
                }),
              },
            ],
          },
        })),
      );

      const message = generateWAMessageFromContent(
        from,
        {
          viewOnceMessage: {
            message: {
              messageContextInfo: {
                deviceListMetadata: {},
                deviceListMetadataVersion: 2,
              },
              interactiveMessage: {
                body: { text: `🔍 YouTube Results for: *${q}*` },
                footer: {
                  text: `📂 Displaying first *${videos.length}* videos`,
                },
                carouselMessage: { cards },
              },
            },
          },
        },
        { quoted: mek },
      );

      await Prince.relayMessage(from, message.message, {
        messageId: message.key.id,
      });

      await react("✅");
    } catch (error) {
      console.error("Error during search process:", error);
      await react("❌");
      return reply("Oops! Something went wrong. Please try again.");
    }
  },
);

gmd(
  {
    pattern: "shazam",
    aliases: ["whatmusic", "whatsong", "identify", "accr"],
    category: "search",
    react: "🙄",
    description: "Identify music from audio or video messages",
  },
  async (from, Prince, conText) => {
    const {
      mek,
      reply,
      react,
      botPic,
      quoted,
      quotedMsg,
      sender,
      botName,
      botFooter,
      newsletterJid,
    } = conText;

    if (!quotedMsg) {
      await react("❌");
      return reply(
        "Please reply to an audio or video message containing music",
      );
    }

    const quotedAudio = quoted?.audioMessage || quoted?.message?.audioMessage;
    const quotedVideo = quoted?.videoMessage || quoted?.message?.videoMessage;

    if (!quotedAudio && !quotedVideo) {
      await react("❌");
      return reply("The quoted message doesn't contain any audio or video");
    }

    let tempFilePath;
    try {
      const acr = new acrcloud({
        host: "identify-us-west-2.acrcloud.com",
        access_key: "4ee38e62e85515a47158aeb3d26fb741",
        access_secret: "KZd3cUQoOYSmZQn1n5ACW5XSbqGlKLhg6G8S8EvJ",
      });

      tempFilePath = await Prince.downloadAndSaveMediaMessage(
        quotedAudio || quotedVideo,
        "temp_media",
      );

      let buffer = await fs.readFile(tempFilePath);

      const MAX_SIZE = 1 * 1024 * 1024;
      if (buffer.length > MAX_SIZE) {
        buffer = buffer.slice(0, MAX_SIZE);
      }

      const { status, metadata } = await acr.identify(buffer);

      if (status.code !== 0) {
        await react("❌");
        return reply(`Music identification failed: ${status.msg}`);
      }

      if (!metadata?.music?.[0]) {
        await react("❌");
        return reply("No music information found in the audio");
      }

      const { title, artists, album, genres, label, release_date } =
        metadata.music[0];

      let txt = `*${botName} 𝐒𝐇𝐀𝐙𝐀𝐌*\n\n`;
      txt += `*Title:* ${title || "Unknown"}\n`;
      if (artists?.length)
        txt += `*Artists:* ${artists.map((v) => v.name).join(", ")}\n`;
      if (album?.name) txt += `*Album:* ${album.name}\n`;
      if (genres?.length)
        txt += `*Genres:* ${genres.map((v) => v.name).join(", ")}\n`;
      if (label) txt += `*Label:* ${label}\n`;
      if (release_date) txt += `*Release Date:* ${release_date}\n`;
      txt += `\n> *${botFooter}*`;

      await Prince.sendMessage(
        from,
        {
          image: { url: botPic },
          caption: txt,
          contextInfo: getContextInfo(sender, newsletterJid, botName),
        },
        { quoted: mek },
      );
      await react("✅");
    } catch (e) {
      console.error("Error in shazam command:", e);
      await react("❌");
      if (e.message.includes("empty media key")) {
        await reply(
          "The media keys have expired - please send a fresh audio/video message",
        );
      } else if (e.message.includes("too large")) {
        await reply(
          "The audio is too long. Please try with a shorter clip (10-20 seconds).",
        );
      } else {
        await reply(`❌ Error identifying music: ${e.message}`);
      }
    } finally {
      if (tempFilePath) {
        try {
          await fs.access(tempFilePath);
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {
          if (cleanupError.code !== "ENOENT") {
            console.error("Failed to clean up temp file:", cleanupError);
          }
        }
      }
    }
  },
);

gmd(
  {
    pattern: "google",
    aliases: ["ggle", "gglesearch", "googlesearch"],
    category: "search",
    react: "🔍",
    description: "Search Google and display first 5 results",
  },
  async (from, Prince, conText) => {
    const { q, mek, reply, react, botFooter, PrinceTechApi, PrinceApiKey } =
      conText;

    if (!q) {
      await react("❌");
      return reply("Please provide a search query");
    }

    try {
      const apiUrl = `${PrinceTechApi}/api/search/google?apikey=${PrinceApiKey}&query=${encodeURIComponent(q)}`;
      const res = await axios.get(apiUrl, { timeout: 60000 });

      if (
        !res.data?.success ||
        !res.data?.results ||
        !Array.isArray(res.data.results) ||
        res.data.results.length === 0
      ) {
        await react("❌");
        return reply("No results found. Please try a different query.");
      }

      const results = res.data.results.slice(0, 5);

      const defaultImg =
        "https://files.giftedtech.co.ke/image/ZAwgoogle-images-1548419288.jpg";

      const cards = await Promise.all(
        results.map(async (result) => ({
          header: {
            title: `🔍 *${result.title}*`,
            hasMediaAttachment: true,
            imageMessage: (
              await generateWAMessageContent(
                { image: { url: defaultImg } },
                { upload: Prince.waUploadToServer },
              )
            ).imageMessage,
          },
          body: {
            text: `📝 ${result.description || "No description"}`,
          },
          footer: { text: `> *${botFooter}*` },
          nativeFlowMessage: {
            buttons: [
              {
                name: "cta_copy",
                buttonParamsJson: JSON.stringify({
                  display_text: "Copy Link",
                  copy_code: result.link,
                }),
              },
              {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                  display_text: "Open Link",
                  url: result.link,
                }),
              },
            ],
          },
        })),
      );

      const message = generateWAMessageFromContent(
        from,
        {
          viewOnceMessage: {
            message: {
              messageContextInfo: {
                deviceListMetadata: {},
                deviceListMetadataVersion: 2,
              },
              interactiveMessage: {
                body: { text: `🔍 Google Results for: *${q}*` },
                footer: {
                  text: `📂 Displaying first *${results.length}* results`,
                },
                carouselMessage: { cards },
              },
            },
          },
        },
        { quoted: mek },
      );

      await Prince.relayMessage(from, message.message, {
        messageId: message.key.id,
      });
      await react("✅");
    } catch (error) {
      console.error("Google search error:", error);
      await react("❌");
      return reply("Failed to perform Google search. Please try again.");
    }
  },
);

gmd(
  {
    pattern: "lyrics",
    aliases: ["songlyrics", "getlyrics"],
    category: "search",
    react: "🎵",
    description: "Search for song lyrics",
  },
  async (from, Prince, conText) => {
    const {
      q,
      mek,
      reply,
      react,
      sender,
      botName,
      botFooter,
      newsletterJid,
      PrinceTechApi,
      PrinceApiKey,
    } = conText;

    if (!q || !q.trim()) {
      await react("❌");
      return reply("🎵 Please provide a song title or artist name.\nExample: .lyrics Calm Down Rema");
    }

    try {
      let track = null;


      // Try the configured PrinceTech lyrics service first.
      try {
        const response = await axios.get(
          `${String(PrinceTechApi || "").replace(/\/+$/, "")}/api/search/lyricsv2`,
          {
            params: { apikey: PrinceApiKey, query: q.trim() },
            timeout: 15000,
          },
        );

        const result = response.data?.result;
        if (response.data?.success && result && typeof result.lyrics === "string" && result.lyrics.trim()) {
          track = {
            artist: result.artist || "Unknown artist",
            title: result.title || q.trim(),
            lyrics: result.lyrics.trim(),
          };
        }
      } catch (error) {

        console.warn("PrinceTech lyrics provider failed; trying LRCLIB:", error.message);
      }

      // Public fallback: LRCLIB does not require an API key.
      if (!track) {
        const fallback = await axios.get("https://lrclib.net/api/search", {
          params: { q: q.trim() },
          timeout: 20000,
          headers: {
            "User-Agent": "HAYWHY_MDX/1.0 (https://github.com/HayMosh1116/HAYMOSH_BOTV2)",
          },
        });

        const results = Array.isArray(fallback.data) ? fallback.data : [];
        const match = results.find((item) =>
          !item.instrumental &&
          (typeof item.plainLyrics === "string" && item.plainLyrics.trim() ||
           typeof item.syncedLyrics === "string" && item.syncedLyrics.trim())
        );

        if (match) {
          const rawLyrics = match.plainLyrics || match.syncedLyrics || "";
          const cleanLyrics = rawLyrics
            .replace(/^\s*\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]\s?/gm, "")
            .trim();

          if (cleanLyrics) {
            track = {
              artist: match.artistName || "Unknown artist",
              title: match.trackName || q.trim(),
              lyrics: cleanLyrics,
            };
          }
        }
      }

      if (!track) {
        await react("❌");
        return reply("🔎 I couldn't find lyrics for that song. Try the song title together with the artist's name.");
      }

      const message =
        `╭━━━〔 🎵 *${botName || "HAYWHY"} • LYRICS* 〕━━━╮
┃ 🎶 *Title:* ${track.title}
┃ 🎤 *Artist:* ${track.artist}
╰━━━━━━━━━━━━━━━━━━━━

${track.lyrics}

━━━━━━━━━━━━━━━━━━━━
> *${botFooter || botName || "HAYWHY_MDX"}*`;

      await Prince.sendMessage(
        from,
        {
          text: message,
          contextInfo: getContextInfo(sender, newsletterJid, botName),
        },
        { quoted: mek },
      );

      await react("✅");
    } catch (error) {
      console.error("Lyrics search error:", error?.response?.data || error?.stack || error);
      await react("❌");
      return reply("❌ The lyrics services are temporarily unavailable. Please try again shortly.");
    }
  },
);
gmd(
  {
    pattern: "happymod",
    aliases: ["modapks", "apkmod"],
    category: "search",
    react: "📱",
    description: "Search HappyMod for modded APKs",
  },
  async (from, Prince, conText) => {
    const { q, mek, reply, react, botFooter, PrinceTechApi, PrinceApiKey } =
      conText;

    if (!q) {
      await react("❌");
      return reply("Please provide an app name to search");
    }

    try {
      const apiUrl = `${PrinceTechApi}/api/search/happymod?apikey=${PrinceApiKey}&query=${encodeURIComponent(q)}`;
      const res = await axios.get(apiUrl, { timeout: 60000 });

      if (!res.data?.success || !res.data?.results?.data) {
        await react("❌");
        return reply("No results found. Please try a different query.");
      }

      const results = res.data.results.data.slice(0, 5);

      const cards = await Promise.all(
        results.map(async (app) => ({
          header: {
            title: `📱 *${app.name}*`,
            hasMediaAttachment: true,
            imageMessage: (
              await generateWAMessageContent(
                { image: { url: app.icon } },
                {
                  upload: Prince.waUploadToServer,
                },
              )
            ).imageMessage,
          },
          body: {
            text: `📝 ${app.summary || "No description"}\n📦 Source: ${app.source || "Unknown"}`,
          },
          footer: { text: `> *${botFooter}*` },
          nativeFlowMessage: {
            buttons: [
              {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                  display_text: "Download",
                  url: app.url,
                }),
              },
            ],
          },
        })),
      );

      const message = generateWAMessageFromContent(
        from,
        {
          viewOnceMessage: {
            message: {
              messageContextInfo: {
                deviceListMetadata: {},
                deviceListMetadataVersion: 2,
              },
              interactiveMessage: {
                body: { text: `📱 HappyMod Results for: *${q}*` },
                footer: {
                  text: `📂 Displaying first *${results.length}* apps`,
                },
                carouselMessage: { cards },
              },
            },
          },
        },
        { quoted: mek },
      );

      await Prince.relayMessage(from, message.message, {
        messageId: message.key.id,
      });
      await react("✅");
    } catch (error) {
      console.error("HappyMod search error:", error);
      await react("❌");
      return reply("Failed to search HappyMod. Please try again.");
    }
  },
);

gmd(
  {
    pattern: "apkmirror",
    aliases: ["apkmirrorsearch"],
    category: "search",
    react: "📦",
    description: "Search APK Mirror for apps",
  },
  async (from, Prince, conText) => {
    const { q, mek, reply, react, botFooter, PrinceTechApi, PrinceApiKey } =
      conText;

    if (!q) {
      await react("❌");
      return reply("Please provide an app name to search");
    }

    try {
      const apiUrl = `${PrinceTechApi}/api/search/apkmirror?apikey=${PrinceApiKey}&query=${encodeURIComponent(q)}`;
      const res = await axios.get(apiUrl, { timeout: 60000 });

      if (!res.data?.success || !res.data?.results?.data) {
        await react("❌");
        return reply("No results found. Please try a different query.");
      }

      const results = res.data.results.data.slice(0, 5);

      const cards = await Promise.all(
        results.map(async (app) => ({
          header: {
            title: `📦 *${app.name}*`,
            hasMediaAttachment: true,
            imageMessage: (
              await generateWAMessageContent(
                { image: { url: app.icon } },
                {
                  upload: Prince.waUploadToServer,
                },
              )
            ).imageMessage,
          },
          body: {
            text: `📦 Source: ${app.source || "APK Mirror"}`,
          },
          footer: { text: `> *${botFooter}*` },
          nativeFlowMessage: {
            buttons: [
              {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                  display_text: "Download",
                  url: app.url,
                }),
              },
            ],
          },
        })),
      );

      const message = generateWAMessageFromContent(
        from,
        {
          viewOnceMessage: {
            message: {
              messageContextInfo: {
                deviceListMetadata: {},
                deviceListMetadataVersion: 2,
              },
              interactiveMessage: {
                body: { text: `📦 APK Mirror Results for: *${q}*` },
                footer: {
                  text: `📂 Displaying first *${results.length}* apps`,
                },
                carouselMessage: { cards },
              },
            },
          },
        },
        { quoted: mek },
      );

      await Prince.relayMessage(from, message.message, {
        messageId: message.key.id,
      });
      await react("✅");
    } catch (error) {
      console.error("APK Mirror search error:", error);
      await react("❌");
      return reply("Failed to search APK Mirror. Please try again.");
    }
  },
);

gmd(
  {
    pattern: "stickersearch",
    aliases: ["searchsticker", "findsticker"],
    category: "search",
    react: "🎨",
    description: "Search and send stickers",
  },
  async (from, Prince, conText) => {
    const {
      q,
      mek,
      reply,
      react,
      PrinceTechApi,
      PrinceApiKey,
    } = conText;

    if (!q) {
      await react("❌");
      return reply("Please provide a search query for stickers");
    }

    try {
      const apiUrl = `${PrinceTechApi}/api/search/stickersearch?apikey=${PrinceApiKey}&query=${encodeURIComponent(q)}`;
      const res = await axios.get(apiUrl, { timeout: 60000 });

      if (
        !res.data?.success ||
        !res.data?.results ||
        res.data.results.length === 0
      ) {
        await react("❌");
        return reply("No stickers found. Please try a different query.");
      }

      const stickers = res.data.results.slice(0, 10);

      await reply(`Found ${stickers.length} stickers for: *${q}*\nSending...`);

      for (const stickerUrl of stickers) {
        try {
          const response = await axios.get(stickerUrl, {
            responseType: "arraybuffer",
            timeout: 30000,
          });
          const stickerBuffer = Buffer.from(response.data);

          const sticker = new Sticker(stickerBuffer, {
            pack: config.PACK_NAME || "𝐏𝐑𝐈𝐍𝐂𝐄 𝐌𝐃𝐗",
            author: config.PACK_AUTHOR || "𝐏𝐑𝐈𝐍𝐂𝐄 𝐓𝐄𝐂𝐇",
            type: StickerTypes.FULL,
            categories: ["🤩", "🎉"],
            quality: 75,
          });

          const stickerBuff = await sticker.toBuffer();

          await Prince.sendMessage(
            from,
            { sticker: stickerBuff },
            { quoted: mek },
          );
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (stickerErr) {
          console.error("Error sending sticker:", stickerErr.message);
        }
      }

      await react("✅");
    } catch (error) {
      console.error("Sticker search error:", error);
      await react("❌");
      return reply("Failed to search stickers. Please try again.");
    }
  },
);

gmd(
  {
    pattern: "npm",
    aliases: ["npminfo", "package", "pkginfo"],
    category: "search",
    react: "📦",
    description: "Get detailed information about npm packages",
  },
  async (from, Prince, conText) => {
    const { q, mek, reply, react, prefix, sender, botName, newsletterJid, getContextInfo } = conText;

    try {
      if (!q) {
        await react("❌");
        return await reply(`❌ *Please provide a package name!*\n\n📝 *Usage:* ${prefix}npm <package-name>\n📝 *Example:* ${prefix}npm express`);
      }

      const packageName = q.trim().toLowerCase();
      await react("📦");

      try {
        // Fetch package data from npm registry
        const response = await axios.get(`https://registry.npmjs.org/${packageName}`, {
          timeout: 10000
        });

        const packageData = response.data;
        const latestVersion = packageData['dist-tags']?.latest || 'Unknown';
        const versions = Object.keys(packageData.versions || {});
        const latestVersionData = packageData.versions?.[latestVersion] || {};

        // Format the information
        let info = `*𝐍𝐏𝐌 𝐏𝐀𝐂𝐊𝐀𝐆𝐄 𝐈𝐍𝐅𝐎𝐑𝐌𝐀𝐓𝐈𝐎𝐍*\n\n`;
        info += `➠ *Name*           : ${packageData.name || 'N/A'}\n`;
        info += `➠ *Description*    : ${packageData.description || 'No description available'}\n`;
        info += `➠ *Latest Version* : ${latestVersion}\n`;
        info += `➠ *Total Versions* : ${versions.length}\n`;
        info += `➠ *Author*         : ${packageData.author?.name || latestVersionData.author?.name || 'N/A'}\n`;
        info += `➠ *Homepage*       : ${packageData.homepage || latestVersionData.homepage || 'N/A'}\n`;
        info += `➠ *License*        : ${packageData.license || latestVersionData.license || 'N/A'}\n`;

        // Repository information
        if (packageData.repository?.url || latestVersionData.repository?.url) {
          const repoUrl = (packageData.repository?.url || latestVersionData.repository?.url)
            .replace('git+', '')
            .replace('.git', '')
            .replace('git://', 'https://');
          info += `➠ *Repository*     : ${repoUrl}\n`;
        }

        // Keywords
        const keywords = packageData.keywords || latestVersionData.keywords || [];
        if (keywords.length > 0) {
          info += `➠ *Keywords*       : ${keywords.slice(0, 5).join(', ')}${keywords.length > 5 ? '...' : ''}\n`;
        }

        // Dependencies
        const dependencies = latestVersionData.dependencies || {};
        const depCount = Object.keys(dependencies).length;
        if (depCount > 0) {
          info += `➠ *Dependencies*   : ${depCount}\n`;
        }

        // Download stats (using npms.io API for additional stats)
        try {
          const statsResponse = await axios.get(`https://api.npms.io/v2/package/${packageName}`, {
            timeout: 5000
          });
          const stats = statsResponse.data;

          if (stats.evaluation?.popularity?.downloadsCount) {
            info += `➠ *Downloads*      : ${stats.evaluation.popularity.downloadsCount.toLocaleString()}\n`;
          }

          if (stats.score?.final) {
            const score = (stats.score.final * 100).toFixed(1);
            info += `➠ *Quality Score*  : ${score}%\n`;
          }
        } catch (statsError) {
          // Stats API failed, continue without stats
        }

        // Installation command
        info += `\n💻 *Installation:*\n`;
        info += `\`\`\`npm install ${packageName}\`\`\`\n`;
        info += `\`\`\`yarn add ${packageName}\`\`\`\n\n`;

        // Links
        info += `🔗 *Links:*\n`;
        info += `• NPM: https://www.npmjs.com/package/${packageName}\n`;

        if (packageData.repository?.url) {
          const repoUrl = packageData.repository.url
            .replace('git+', '')
            .replace('.git', '')
            .replace('git://', 'https://');
          info += `• Repository: ${repoUrl}\n`;
        }

        info += `\n> *${config.FOOTER || "𝐏𝐑𝐈𝐍𝐂𝐄 𝐌𝐃𝐗"}*`;

        // Send with NPM logo
        await Prince.sendMessage(from, {
          image: { url: "https://raw.githubusercontent.com/npm/logos/master/npm%20logo/npm-logo-red.png" },
          caption: info,
          contextInfo: getContextInfo(sender, newsletterJid, botName)
        }, { quoted: mek });
        await react("✅");

      } catch (apiError) {
        if (apiError.response?.status === 404) {
          await react("❌");
          await reply(`❌ *Package not found!*\n\n🔍 Package "${packageName}" doesn't exist on NPM registry.\n\n💡 *Tip:* Check the package name spelling and try again.`);
        } else {
          throw apiError;
        }
      }

    } catch (error) {
      console.error('NPM Plugin Error:', error);
      await react("❌");
      await reply(`❌ *Error occurred while fetching package information*\n\n🔧 *Error:* ${error.message}\n\n💡 *Try again later or check your internet connection.*`);
    }
  }
);

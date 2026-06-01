const { gmd, config, getContextInfo } = require("../mayel");
const axios = require("axios");
const {
  generateWAMessageContent,
  generateWAMessageFromContent,
} = require("prince-baileys");

const SPORTS_API_BASE = "https://apiskeith.top";
const SPORTS_IMAGE = "https://i.ibb.co/gLRMhk9p/N0r-QVLHAY0.jpg";

const LEAGUE_CONFIG = {
  1: { name: "Premier League", code: "epl", emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  2: { name: "Bundesliga", code: "bundesliga", emoji: "🇩🇪" },
  3: { name: "La Liga", code: "laliga", emoji: "🇪🇸" },
  4: { name: "Ligue 1", code: "ligue1", emoji: "🇫🇷" },
  5: { name: "Serie A", code: "seriea", emoji: "🇮🇹" },
  6: { name: "UEFA Champions League", code: "ucl", emoji: "🏆" },
  7: { name: "FIFA International", code: "fifa", emoji: "🌍" },
  8: { name: "UEFA Euro", code: "euros", emoji: "🇪🇺" },
};


function formatLeagueMenu(title, emoji) {
  let menu = `╭━━━━━━━━━━━╮\n`;
  menu += `│ ${emoji} *${title}*\n`;
  menu += `├━━━━━━━━━━━┤\n`;
  menu += `│ _Reply with number_\n`;
  menu += `├━━━━━━━━━━━┤\n`;
  Object.entries(LEAGUE_CONFIG).forEach(([num, cfg]) => {
    menu += `│ ${num}. ${cfg.emoji} ${cfg.name}\n`;
  });
  menu += `╰━━━━━━━━━━━╯`;
  return menu;
}

function convertToUserTime(timeStr, dateStr, userTimeZone) {
  if (!timeStr || !dateStr) return null;
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const [hours, minutes] = timeStr.split(":").map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));
    return {
      date: utcDate.toLocaleDateString("en-US", { timeZone: userTimeZone }),
      time: utcDate.toLocaleTimeString("en-US", {
        timeZone: userTimeZone,
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  } catch (e) {
    return null;
  }
}

function getMatchIcon(status) {
  const icons = { HT: "⏸️", FT: "✅", Pen: "✅", "1T": "🔴", "2T": "🔴" };
  return icons[status] || "⏰";
}

function getMatchStatusText(status) {
  const statusMap = {
    "": "Not Started",
    FT: "Full Time",
    "1T": "1st Half",
    "2T": "2nd Half",
    HT: "Half Time",
    Pst: "Postponed",
    Canc: "Cancelled",
    Pen: "Penalties",
  };
  return statusMap[status] || status;
}

function formatNewsDate(ts) {
  try {
    return new Date(Number(ts)).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Recent";
  }
}

gmd(
  {
    pattern: "surebet",
    aliases: ["bettips", "odds", "predict", "bet", "sureodds"],
    react: "🎲",
    description: "Get betting tips and odds predictions",
    category: "sports",
  },
  async (from, Prince, conText) => {
    const { mek, reply, react } = conText;
    try {
      await react("⏳");
      const { data } = await axios.get(`${SPORTS_API_BASE}/bet`, {
        timeout: 15000,
      });

      if (!data?.status || !data?.result?.length) {
        await react("❌");
        return reply("❌ No betting tips available right now. Try again later.");
      }

      let txt = `╭━━━━━━━━━━━╮\n`;
      txt += `│ 🎲 *BETTING TIPS*\n`;
      txt += `├━━━━━━━━━━━┤\n`;
      txt += `│ 📊 *Today's Picks*\n`;
      txt += `╰━━━━━━━━━━━╯\n\n`;

      data.result.forEach((match, i) => {
        txt += `┏━ *Match ${i + 1}* ━┓\n`;
        txt += `┃ ⚽ *${match.match}*\n`;
        txt += `┃ 🏆 ${match.league}\n`;
        txt += `┃ 🕐 ${match.time}\n`;
        txt += `┣━━━━━━━━━┫\n`;

        if (match.predictions?.fulltime) {
          txt += `┃ 📈 *FT Odds:*\n`;
          txt += `┃ 🏠 ${match.predictions.fulltime.home}%\n`;
          txt += `┃ 🤝 ${match.predictions.fulltime.draw}%\n`;
          txt += `┃ ✈️ ${match.predictions.fulltime.away}%\n`;
        }
        if (match.predictions?.over_2_5) {
          txt += `┃ ⚽ *O2.5:* ✅${match.predictions.over_2_5.yes}%\n`;
        }
        if (match.predictions?.bothTeamToScore) {
          txt += `┃ 🎯 *BTTS:* ${match.predictions.bothTeamToScore.yes}%\n`;
        }
        if (typeof match.predictions?.value_bets !== "undefined") {
          txt += `┃ 💰 ${match.predictions.value_bets}\n`;
        }
        txt += `┗━━━━━━━━━┛\n\n`;
      });

      txt += `_⚠️ Bet responsibly. Past results don't guarantee future outcomes._\n\n> *${config.FOOTER}*`;

      await Prince.sendMessage(
        from,
        { image: { url: SPORTS_IMAGE }, caption: txt, contextInfo: getContextInfo(conText.sender, conText.newsletterJid, conText.botName) },
        { quoted: mek },
      );
      await react("✅");
    } catch (err) {
      console.error("surebet error:", err);
      await react("❌");
      reply("❌ Failed to fetch betting tips. Try again later.");
    }
  },
);

gmd(
  {
    pattern: "livescore",
    aliases: ["live", "score", "livematch"],
    react: "⚽",
    description: "Get live, finished, or upcoming football matches",
    category: "sports",
  },
  async (from, Prince, conText) => {
    const { mek, timeZone } = conText;
    const ctxInfo = getContextInfo(conText.sender, conText.newsletterJid, conText.botName);

    const caption = `╭━━━━━━━━━━━╮
│ ⚽ *SCORES*
├━━━━━━━━━━━┤
│ _Reply with number_
├━━━━━━━━━━━┤
│ 1. 🔴 Live
│ 2. ✅ Finished
│ 3. ⏰ Upcoming
╰━━━━━━━━━━━╯`;

    const sent = await Prince.sendMessage(
      from,
      { image: { url: SPORTS_IMAGE }, caption, contextInfo: ctxInfo },
      { quoted: mek },
    );

    const messageId = sent.key.id;

    const handler = async (update) => {
      const msg = update.messages[0];
      if (!msg.message) return;

      const responseText =
        msg.message.conversation || msg.message.extendedTextMessage?.text;
      const isReply =
        msg.message.extendedTextMessage?.contextInfo?.stanzaId === messageId;
      const chatId = msg.key.remoteJid;

      if (!isReply || chatId !== from) return;

      const choice = responseText?.trim();
      const optionMap = {
        1: { name: "Live", emoji: "🔴", filter: "live" },
        2: { name: "Finished", emoji: "✅", filter: "finished" },
        3: { name: "Upcoming", emoji: "⏰", filter: "upcoming" },
      };

      if (!optionMap[choice]) {
        return Prince.sendMessage(
          chatId,
          { text: "❌ Invalid option. Reply with 1, 2, or 3.", contextInfo: ctxInfo },
          { quoted: msg },
        );
      }

      const selected = optionMap[choice];

      try {
        await Prince.sendMessage(chatId, {
          react: { text: selected.emoji, key: msg.key },
        });

        const res = await axios.get(`${SPORTS_API_BASE}/livescore`, {
          timeout: 15000,
        });
        const data = res.data;

        if (!data.status || !data.result?.games) {
          return Prince.sendMessage(
            chatId,
            { text: "❌ No match data available at the moment.", contextInfo: ctxInfo },
            { quoted: msg },
          );
        }

        const games = Object.values(data.result.games);
        const userTimeZone = timeZone || config.TIME_ZONE || "Africa/Douala";
        const now = new Date();
        const currentUserTimeStr = now.toLocaleTimeString("en-US", {
          timeZone: userTimeZone,
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
        });

        let filteredGames = games
          .filter((game) => {
            const status = game.R?.st || "";
            if (choice === "1") return ["1T", "2T", "HT"].includes(status);
            if (choice === "2") return ["FT", "Pen"].includes(status);
            if (choice === "3") return ["", "Pst", "Canc"].includes(status);
            return false;
          })
          .map((game) => ({
            ...game,
            userMatchTime: convertToUserTime(game.tm, game.dt, userTimeZone),
          }));

        if (filteredGames.length === 0) {
          return Prince.sendMessage(
            chatId,
            {
              image: { url: SPORTS_IMAGE },
              caption: `╭━━━━━━━━━━━╮\n│ ${selected.emoji} *${selected.name}*\n╰━━━━━━━━━━━╯\n\n_No matches found._`,
              contextInfo: ctxInfo,
            },
            { quoted: msg },
          );
        }

        let output = `╭━━━━━━━━━━━╮\n`;
        output += `│ ${selected.emoji} *${selected.name}*\n`;
        output += `├━━━━━━━━━━━┤\n`;
        output += `│ 🌍 ${userTimeZone}\n`;
        output += `│ 🕐 ${currentUserTimeStr}\n`;
        output += `╰━━━━━━━━━━━╯\n\n`;

        filteredGames.slice(0, 20).forEach((game) => {
          const statusIcon = getMatchIcon(game.R?.st);
          const score =
            game.R?.r1 !== undefined ? `${game.R.r1} - ${game.R.r2}` : "vs";
          const time = game.userMatchTime?.time || game.tm || "";
          const statusText = getMatchStatusText(game.R?.st);

          output += `${statusIcon} *${game.p1}* ${score} *${game.p2}*\n`;
          output += `   🕒 ${time}${statusText ? ` (${statusText})` : ""}\n\n`;
        });

        output += `_📊 Showing ${Math.min(filteredGames.length, 20)} of ${filteredGames.length} matches_\n\n> *${config.FOOTER}*`;

        await Prince.sendMessage(
          chatId,
          { image: { url: SPORTS_IMAGE }, caption: output, contextInfo: ctxInfo },
          { quoted: msg },
        );

        Prince.ev.off("messages.upsert", handler);
      } catch (err) {
        console.error("livescore error:", err);
        await Prince.sendMessage(
          chatId,
          { text: `❌ Error fetching matches: ${err.message}`, contextInfo: ctxInfo },
          { quoted: msg },
        );
      }
    };

    Prince.ev.on("messages.upsert", handler);
    setTimeout(() => Prince.ev.off("messages.upsert", handler), 120000);
  },
);

gmd(
  {
    pattern: "sportnews",
    aliases: ["footballnews", "soccernews"],
    react: "📰",
    category: "sports",
    description: "Get latest football news",
  },
  async (from, Prince, conText) => {
    const { mek, react, reply, botName } = conText;
    const ctxInfo = getContextInfo(conText.sender, conText.newsletterJid, conText.botName);

    try {
      await react("⏳");
      const res = await axios.get(`${SPORTS_API_BASE}/football/news`, {
        timeout: 15000,
      });
      const items = res.data?.result?.data?.items;

      if (!Array.isArray(items) || items.length === 0) {
        await react("❌");
        return reply("❌ No football news available at the moment.");
      }

      const news = items.slice(0, 8);

      try {
        const cards = await Promise.all(
          news.map(async (item) => ({
            header: {
              title: `📰 ${item.title}`,
              hasMediaAttachment: true,
              imageMessage: (
                await generateWAMessageContent(
                  { image: { url: item.cover?.url || "https://i.ibb.co/gLRMhk9p/N0r-QVLHAY0.jpg" } },
                  { upload: Prince.waUploadToServer },
                )
              ).imageMessage,
            },
            body: { text: item.summary || "Click to read more..." },
            footer: { text: formatNewsDate(item.createdAt) },
            nativeFlowMessage: {
              buttons: [
                {
                  name: "cta_url",
                  buttonParamsJson: JSON.stringify({
                    display_text: "🔗 Read Full Story",
                    url: "https://keithsite.vercel.app/sports",
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
                  body: { text: `⚽ *LATEST FOOTBALL NEWS*` },
                  footer: {
                    text: `📂 ${news.length} stories | ${botName || config.BOT_NAME}`,
                  },
                  carouselMessage: { cards },
                  contextInfo: ctxInfo,
                },
              },
            },
          },
          { quoted: mek },
        );

        await Prince.relayMessage(from, message.message, {
          messageId: message.key.id,
        });
      } catch (carouselErr) {
        let txt = `╭━━━━━━━━━━━╮\n`;
        txt += `│ 📰 *FOOTBALL NEWS*\n`;
        txt += `├━━━━━━━━━━━┤\n`;
        txt += `│ 📊 Latest Headlines\n`;
        txt += `╰━━━━━━━━━━━╯\n\n`;

        news.forEach((item, i) => {
          const date = formatNewsDate(item.createdAt);
          txt += `┏━ *News ${i + 1}* ━┓\n`;
          txt += `┃ 📰 *${item.title}*\n`;
          if (item.summary) txt += `┃ 📝 ${item.summary.substring(0, 80)}...\n`;
          txt += `┃ 📅 ${date}\n`;
          txt += `┗━━━━━━━━━┛\n\n`;
        });
        txt += `\n> *${config.FOOTER}*`;

        await Prince.sendMessage(
          from,
          { image: { url: SPORTS_IMAGE }, caption: txt, contextInfo: ctxInfo },
          { quoted: mek },
        );
      }

      await react("✅");
    } catch (err) {
      console.error("sportnews error:", err);
      await react("❌");
      reply("❌ Failed to fetch football news.");
    }
  },
);

gmd(
  {
    pattern: "topscorers",
    aliases: ["scorers", "goals", "goldenboot"],
    react: "⚽",
    description: "View top goal scorers across major leagues",
    category: "sports",
  },
  async (from, Prince, conText) => {
    const { mek } = conText;
    const ctxInfo = getContextInfo(conText.sender, conText.newsletterJid, conText.botName);

    const caption = formatLeagueMenu("TOP SCORERS", "⚽");

    const sent = await Prince.sendMessage(
      from,
      { image: { url: SPORTS_IMAGE }, caption, contextInfo: ctxInfo },
      { quoted: mek },
    );

    const messageId = sent.key.id;

    const handler = async (update) => {
      const msg = update.messages[0];
      if (!msg.message) return;

      const responseText =
        msg.message.conversation || msg.message.extendedTextMessage?.text;
      const isReply =
        msg.message.extendedTextMessage?.contextInfo?.stanzaId === messageId;
      const chatId = msg.key.remoteJid;

      if (!isReply || chatId !== from) return;

      const choice = responseText?.trim();
      const league = LEAGUE_CONFIG[choice];

      if (!league) {
        return Prince.sendMessage(
          chatId,
          { text: "❌ Invalid option. Reply with a number between 1 and 8.", contextInfo: ctxInfo },
          { quoted: msg },
        );
      }

      try {
        await Prince.sendMessage(chatId, {
          react: { text: "⚽", key: msg.key },
        });

        const res = await axios.get(
          `${SPORTS_API_BASE}/${league.code}/scorers`,
          { timeout: 15000 },
        );
        const data = res.data;

        if (!data.status || !Array.isArray(data.result?.topScorers)) {
          return Prince.sendMessage(
            chatId,
            { text: `❌ Failed to fetch ${league.name} scorers.`, contextInfo: ctxInfo },
            { quoted: msg },
          );
        }

        let output = `╭━━━━━━━━━━━╮\n`;
        output += `│ ${league.emoji} *${league.name}*\n`;
        output += `│ ⚽ *TOP SCORERS*\n`;
        output += `╰━━━━━━━━━━━╯\n\n`;

        data.result.topScorers.slice(0, 15).forEach((scorer) => {
          const medal =
            scorer.rank === 1
              ? "🥇"
              : scorer.rank === 2
                ? "🥈"
                : scorer.rank === 3
                  ? "🥉"
                  : "▪️";

          output += `${medal} *${scorer.rank}. ${scorer.player}*\n`;
          output += `   🏟️ ${scorer.team}\n`;
          output += `   ⚽ ${scorer.goals} goals | 🎯 ${scorer.assists} assists\n`;
          if (scorer.penalties > 0)
            output += `   🎯 ${scorer.penalties} penalties\n`;
          output += `\n`;
        });

        output += `\n> *${config.FOOTER}*`;

        await Prince.sendMessage(
          chatId,
          { image: { url: SPORTS_IMAGE }, caption: output, contextInfo: ctxInfo },
          { quoted: msg },
        );

        Prince.ev.off("messages.upsert", handler);
      } catch (err) {
        console.error("topscorers error:", err);
        await Prince.sendMessage(
          chatId,
          { text: `❌ Error: ${err.message}`, contextInfo: ctxInfo },
          { quoted: msg },
        );
      }
    };

    Prince.ev.on("messages.upsert", handler);
    setTimeout(() => Prince.ev.off("messages.upsert", handler), 120000);
  },
);

gmd(
  {
    pattern: "standings",
    aliases: ["leaguetable", "table"],
    react: "📊",
    description: "View current league standings",
    category: "sports",
  },
  async (from, Prince, conText) => {
    const { mek } = conText;
    const ctxInfo = getContextInfo(conText.sender, conText.newsletterJid, conText.botName);

    const caption = formatLeagueMenu("LEAGUE STANDINGS", "📊");

    const sent = await Prince.sendMessage(
      from,
      { image: { url: SPORTS_IMAGE }, caption, contextInfo: ctxInfo },
      { quoted: mek },
    );

    const messageId = sent.key.id;

    const handler = async (update) => {
      const msg = update.messages[0];
      if (!msg.message) return;

      const responseText =
        msg.message.conversation || msg.message.extendedTextMessage?.text;
      const isReply =
        msg.message.extendedTextMessage?.contextInfo?.stanzaId === messageId;
      const chatId = msg.key.remoteJid;

      if (!isReply || chatId !== from) return;

      const choice = responseText?.trim();
      const league = LEAGUE_CONFIG[choice];

      if (!league) {
        return Prince.sendMessage(
          chatId,
          { text: "❌ Invalid option. Reply with 1-8.", contextInfo: ctxInfo },
          { quoted: msg },
        );
      }

      try {
        await Prince.sendMessage(chatId, {
          react: { text: "📊", key: msg.key },
        });

        const res = await axios.get(
          `${SPORTS_API_BASE}/${league.code}/standings`,
          { timeout: 15000 },
        );
        const data = res.data;

        if (!data.status || !Array.isArray(data.result?.standings)) {
          return Prince.sendMessage(
            chatId,
            { text: `❌ Failed to fetch ${league.name} standings.`, contextInfo: ctxInfo },
            { quoted: msg },
          );
        }

        let output = `╭━━━━━━━━━━━╮\n`;
        output += `│ ${league.emoji} *${league.name}*\n`;
        output += `│ 📊 *STANDINGS*\n`;
        output += `╰━━━━━━━━━━━╯\n\n`;

        data.result.standings.forEach((team) => {
          let zone = "";
          if (team.position <= 4) zone = "🏆";
          else if (team.position <= 6) zone = "🔵";
          else if (team.position >= 18) zone = "🔴";
          else zone = "⚪";

          const teamName =
            team.team.length > 10 ? team.team.substring(0, 10) : team.team;
          const gd =
            team.goalDifference >= 0
              ? `+${team.goalDifference}`
              : team.goalDifference;
          output += `${zone}${team.position}. *${teamName}*\n`;
          output += `   P:${team.played} W:${team.won} Pts:${team.points} GD:${gd}\n\n`;
        });

        output += `_🏆UCL 🔵UEL 🔴Rel_\n\n> *${config.FOOTER}*`;

        await Prince.sendMessage(
          chatId,
          { image: { url: SPORTS_IMAGE }, caption: output, contextInfo: ctxInfo },
          { quoted: msg },
        );

        Prince.ev.off("messages.upsert", handler);
      } catch (err) {
        console.error("standings error:", err);
        await Prince.sendMessage(
          chatId,
          { text: `❌ Error: ${err.message}`, contextInfo: ctxInfo },
          { quoted: msg },
        );
      }
    };

    Prince.ev.on("messages.upsert", handler);
    setTimeout(() => Prince.ev.off("messages.upsert", handler), 120000);
  },
);

gmd(
  {
    pattern: "upcomingmatches",
    aliases: ["fixtures", "upcoming", "nextgames", "schedule"],
    react: "📅",
    description: "View upcoming matches across major leagues",
    category: "sports",
  },
  async (from, Prince, conText) => {
    const { mek } = conText;
    const ctxInfo = getContextInfo(conText.sender, conText.newsletterJid, conText.botName);

    const caption = formatLeagueMenu("UPCOMING MATCHES", "📅");

    const sent = await Prince.sendMessage(
      from,
      { image: { url: SPORTS_IMAGE }, caption, contextInfo: ctxInfo },
      { quoted: mek },
    );

    const messageId = sent.key.id;

    const handler = async (update) => {
      const msg = update.messages[0];
      if (!msg.message) return;

      const responseText =
        msg.message.conversation || msg.message.extendedTextMessage?.text;
      const isReply =
        msg.message.extendedTextMessage?.contextInfo?.stanzaId === messageId;
      const chatId = msg.key.remoteJid;

      if (!isReply || chatId !== from) return;

      const choice = responseText?.trim();
      const league = LEAGUE_CONFIG[choice];

      if (!league) {
        return Prince.sendMessage(
          chatId,
          { text: "❌ Invalid option. Reply with 1-8.", contextInfo: ctxInfo },
          { quoted: msg },
        );
      }

      try {
        await Prince.sendMessage(chatId, {
          react: { text: "📅", key: msg.key },
        });

        const res = await axios.get(
          `${SPORTS_API_BASE}/${league.code}/upcomingmatches`,
          { timeout: 15000 },
        );
        const data = res.data;

        if (!data.status || !Array.isArray(data.result?.upcomingMatches)) {
          return Prince.sendMessage(
            chatId,
            { text: `❌ No upcoming ${league.name} fixtures found.`, contextInfo: ctxInfo },
            { quoted: msg },
          );
        }

        let output = `╭━━━━━━━━━━━╮\n`;
        output += `│ ${league.emoji} *${league.name}*\n`;
        output += `│ 📅 *FIXTURES*\n`;
        output += `╰━━━━━━━━━━━╯\n\n`;

        data.result.upcomingMatches.slice(0, 15).forEach((match) => {
          output += `┏━ *MD ${match.matchday}* ━┓\n`;
          output += `┃ 🏟️ ${match.homeTeam}\n`;
          output += `┃ ⚔️ VS\n`;
          output += `┃ ✈️ ${match.awayTeam}\n`;
          output += `┃ 📅 ${match.date}\n`;
          output += `┗━━━━━━━━━┛\n\n`;
        });

        output += `\n> *${config.FOOTER}*`;

        await Prince.sendMessage(
          chatId,
          { image: { url: SPORTS_IMAGE }, caption: output, contextInfo: ctxInfo },
          { quoted: msg },
        );

        Prince.ev.off("messages.upsert", handler);
      } catch (err) {
        console.error("upcomingmatches error:", err);
        await Prince.sendMessage(
          chatId,
          { text: `❌ Error: ${err.message}`, contextInfo: ctxInfo },
          { quoted: msg },
        );
      }
    };

    Prince.ev.on("messages.upsert", handler);
    setTimeout(() => Prince.ev.off("messages.upsert", handler), 120000);
  },
);

gmd(
  {
    pattern: "gamehistory",
    aliases: ["matchevents", "gameevents", "matchstats"],
    react: "📋",
    description: "Get detailed match events and history",
    category: "sports",
  },
  async (from, Prince, conText) => {
    const { mek } = conText;
    const ctxInfo = getContextInfo(conText.sender, conText.newsletterJid, conText.botName);

    const caption = formatLeagueMenu("MATCH HISTORY", "📋");

    const sent = await Prince.sendMessage(
      from,
      { image: { url: SPORTS_IMAGE }, caption, contextInfo: ctxInfo },
      { quoted: mek },
    );

    const messageId = sent.key.id;

    const handler = async (update) => {
      const msg = update.messages[0];
      if (!msg.message) return;

      const responseText =
        msg.message.conversation || msg.message.extendedTextMessage?.text;
      const isReply =
        msg.message.extendedTextMessage?.contextInfo?.stanzaId === messageId;
      const chatId = msg.key.remoteJid;

      if (!isReply || chatId !== from) return;

      const choice = responseText?.trim();
      const league = LEAGUE_CONFIG[choice];

      if (!league) {
        return Prince.sendMessage(
          chatId,
          { text: "❌ Invalid option. Reply with 1-8.", contextInfo: ctxInfo },
          { quoted: msg },
        );
      }

      try {
        await Prince.sendMessage(chatId, {
          react: { text: "📋", key: msg.key },
        });

        const res = await axios.get(
          `${SPORTS_API_BASE}/${league.code}/gamehistory`,
          { timeout: 15000 },
        );
        const data = res.data;

        if (!data.status || !Array.isArray(data.result?.matches)) {
          return Prince.sendMessage(
            chatId,
            { text: `❌ No match history found for ${league.name}.`, contextInfo: ctxInfo },
            { quoted: msg },
          );
        }

        let output = `╭━━━━━━━━━━━╮\n`;
        output += `│ ${league.emoji} *${league.name}*\n`;
        output += `│ 📋 *RECENT*\n`;
        output += `╰━━━━━━━━━━━╯\n\n`;

        data.result.matches.slice(0, 10).forEach((match) => {
          output += `┏━━━━━━━━━┓\n`;
          output += `┃ 📅 ${match.date || "N/A"}\n`;
          output += `┃ *${match.homeTeam}* ${match.homeScore || 0}-${match.awayScore || 0} *${match.awayTeam}*\n`;
          if (match.events?.length) {
            match.events.slice(0, 3).forEach((evt) => {
              output += `┃ ${evt.minute}' ${evt.type === "goal" ? "⚽" : "🟨"} ${evt.player}\n`;
            });
          }
          output += `┗━━━━━━━━━┛\n\n`;
        });

        output += `\n> *${config.FOOTER}*`;

        await Prince.sendMessage(
          chatId,
          { image: { url: SPORTS_IMAGE }, caption: output, contextInfo: ctxInfo },
          { quoted: msg },
        );

        Prince.ev.off("messages.upsert", handler);
      } catch (err) {
        console.error("gamehistory error:", err);
        await Prince.sendMessage(
          chatId,
          { text: `❌ Error: ${err.message}`, contextInfo: ctxInfo },
          { quoted: msg },
        );
      }
    };

    Prince.ev.on("messages.upsert", handler);
    setTimeout(() => Prince.ev.off("messages.upsert", handler), 120000);
  },
);

gmd(
  {
    pattern: "sportsmenu",
    aliases: ["sportshelp", "footballmenu"],
    react: "⚽",
    description: "Show all sports commands",
    category: "sports",
  },
  async (from, Prince, conText) => {
    const { mek, reply, react, botPrefix } = conText;
    const ctxInfo = getContextInfo(conText.sender, conText.newsletterJid, conText.botName);

    try {
      const menuText = `╭───❖ ⚽ *SPORTS MENU* ⚽ ❖───╮
│
│ 🎲 ${botPrefix}surebet - Betting tips
│ ⚽ ${botPrefix}livescore - Live scores
│ 📰 ${botPrefix}sportnews - Football news
│ ⚽ ${botPrefix}topscorers - Top scorers
│ 📊 ${botPrefix}standings - League table
│ 📅 ${botPrefix}upcomingmatches - Fixtures
│ 📋 ${botPrefix}gamehistory - Match history
│
╰─────────────────────────╯

*Available Leagues:*
🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League | 🇩🇪 Bundesliga
🇪🇸 La Liga | 🇫🇷 Ligue 1 | 🇮🇹 Serie A
🏆 UCL | 🌍 FIFA | 🇪🇺 Euro

> *${config.FOOTER}*`;

      await Prince.sendMessage(
        from,
        { image: { url: SPORTS_IMAGE }, caption: menuText, contextInfo: ctxInfo },
        { quoted: mek },
      );
    } catch (e) {
      console.error(e);
      await react("❌");
      reply("❌ Error loading sports menu.");
    }
  },
);

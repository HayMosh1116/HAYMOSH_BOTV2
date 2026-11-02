const { gmd, config, commands, gmdJson, getContextInfo } = require('../mayel');
const fs = require('fs');
const axios = require('axios');


gmd({
  pattern: "gpt",
  react: '🤖',
  desc: "Chat with GPT AI",
  category: "ai",
}, async (from, Prince, conText) => {
  const { reply, react, mek, q, PrinceApiKey, PrinceTechApi, config, m, newsletterJid, botName } = conText;

  if (!q) {
    await react("❌");
    return reply("⚠️ Please provide a query.");
  }

  try {
    const response = await gmdJson(
      `${PrinceTechApi}/api/ai/gpt?apikey=${PrinceApiKey}&q=${encodeURIComponent(q)}`
    );

    if (!response || !response.result) {
      await react("❌");
      return reply("❌ Error: No result from GPT API.");
    }

    await Prince.sendMessage(from, {
      text: response.result,
      contextInfo: getContextInfo(m.sender, newsletterJid, botName),
    }, { quoted: mek });

    await react("✅");
  } catch (e) {
    console.error("GPT Command Error:", e);
    await react("❌");
    reply("❌ Error while fetching data from PrinceTech API.");
  }
});

gmd({
  pattern: "imagine",
  alias: ["imagineai"],
  react: '📸',
  desc: "Generate Image Using Imagine AI.",
  category: "ai",
}, async (from, Prince, conText) => {
  const { reply, react, mek, q, PrinceApiKey, PrinceTechApi, config } = conText;
  try {
    if (!q) return reply("Provide a prompt to generate image!");

    const res = await axios.get(
      `${PrinceTechApi}/api/ai/text2img?apikey=${PrinceApiKey}&prompt=${encodeURIComponent(q)}`,
      { responseType: 'arraybuffer' }
    );

    await Prince.sendMessage(from, {
      image: Buffer.from(res.data),
      caption: `Here is your generated Image for *${q}*\n> ${config.FOOTER}`
    }, { quoted: mek });

    await react("✅");
  } catch (e) {
    console.error("Imagine Error:", e);
    reply("❌ Error while fetching data from PrinceTech API.");
  }
});

gmd({
  pattern: "sd",
  alias: ["stablediffusion"],
  react: '📸',
  desc: "Generate Image Using Stable Diffusion AI.",
  category: "ai",
}, async (from, Prince, conText) => {
  const { reply, react, mek, q, PrinceApiKey, PrinceTechApi } = conText;
  try {
    if (!q) return reply("Provide a prompt to generate image!");
    const res = await axios.get(`${PrinceTechApi}/api/ai/sd?apikey=${PrinceApiKey}&prompt=${encodeURIComponent(q)}`, {
      responseType: 'arraybuffer'
    });
    await Prince.sendMessage(from, {
      image: Buffer.from(res.data),
      caption: `Here is your generated Image for *${q}*\n> ${config.FOOTER}`
    }, { quoted: mek });
    await react("✅");
  } catch (e) {
    console.error("SD Error:", e);
    reply("❌ Error while fetching data from PrinceTech API.");
  }
});
/*
gmd({
  pattern: "imagine",
  alias: ["imagineai"],
  react: '📸',
  desc: "Generate Image Using Imagine AI.",
  category: "ai",
}, async (from, Prince, conText) => {
  const { reply, react, mek, q, PrinceApiKey, PrinceTechApi } = conText;
  try {
    if (!q) return reply("Provide a prompt to generate image!");
    const res = await axios.get(`${PrinceTechApi}/api/ai/imagine?apikey=${PrinceApiKey}&prompt=${encodeURIComponent(q)}`, {
      responseType: 'arraybuffer'
    });
    await Prince.sendMessage(from, {
      image: Buffer.from(res.data),
      caption: `Here is your generated Image for *${q}*\n> ${config.FOOTER}`
    }, { quoted: mek });
    await react("✅");
  } catch (e) {
    console.error("Imagine Error:", e);
    reply("❌ Error while fetching data from PrinceTech API.");
  }
});
*/
gmd({
  pattern: "lumin",
  alias: ["luminai"],
  react: '🤖',
  desc: "Chat With Lumin AI.",
  category: "ai",
}, async (from, Prince, conText) => {
  const { reply, react, mek, q, m, PrinceApiKey, PrinceTechApi } = conText;
  try {
    if (!q) return reply("Provide a query!");
    const data = await gmdJson(`${PrinceTechApi}/api/ai/luminai?apikey=${PrinceApiKey}&query=${encodeURIComponent(q)}`);
    await Prince.sendMessage(from, { text: data.result }, { quoted: mek });
    await react("✅");
  } catch (e) {
    console.error("Lumin Error:", e);
    reply("❌ Error while fetching data from PrinceTech API.");
  }
});

gmd({
  pattern: "wwdgpt",
  react: '🤖',
  desc: "Chat With WWD GPT AI.",
  category: "ai",
}, async (from, Prince, conText) => {
  const { reply, react, mek, q, m, PrinceApiKey, PrinceTechApi } = conText;
  try {
    if (!q) return reply("Provide a query!");
    const data = await gmdJson(`${PrinceTechApi}/api/ai/wwdgpt?apikey=${PrinceApiKey}&prompt=${encodeURIComponent(q)}`);
    await Prince.sendMessage(from, { text: data.result }, { quoted: mek });
    await react("✅");
  } catch (e) {
    console.error("WWDGPT Error:", e);
    reply("❌ Error while fetching data from PrinceTech API.");
  }
});
/*
gmd({
  pattern: "letme",
  alias: ["letmegpt"],
  react: '🤖',
  desc: "Chat With Letme GPT AI.",
  category: "ai",
}, async (from, Prince, conText) => {
  const { reply, react, mek, q, m, PrinceApiKey, PrinceTechApi } = conText;
  try {
    if (!q) return reply("Provide a query!");
    const data = await gmdJson(`${PrinceTechApi}/api/ai/letmegpt?apikey=${PrinceApiKey}&query=${encodeURIComponent(q)}`);
    await Prince.sendMessage(from, { text: data.result }, { quoted: mek });
    await react("✅");
  } catch (e) {
    console.error("Letme Error:", e);
    reply("❌ Error while fetching data from PrinceTech API.");
  }
});
*/


gmd({
  pattern: "letme",
  alias: ["letmegpt"],
  react: '🤖',
  desc: "Chat with Letme GPT AI",
  category: "ai",
}, async (from, Prince, conText) => {
  const {
    reply,
    react,
    mek,
    q,
    m,
    PrinceApiKey,
    PrinceTechApi,
    config,
    newsletterJid,
    botName
  } = conText;

  if (!q) {
    await react("❌");
    return reply("⚠️ Please provide a query for Letme GPT.");
  }

  try {
    const data = await gmdJson(
      `${PrinceTechApi}/api/ai/letmegpt?apikey=${encodeURIComponent(PrinceApiKey)}&q=${encodeURIComponent(q)}`
    );

    if (!data || !data.result) {
      await react("❌");
      return reply("❌ No response from Letme GPT API.");
    }

    await Prince.sendMessage(from, {
      text: data.result,
      contextInfo: getContextInfo(m.sender, newsletterJid, botName)
    }, { quoted: mek });

    await react("✅");
  } catch (e) {
    console.error("Letme GPT Error:", e);
    await react("❌");
    reply("❌ Error while fetching data from PrinceTech API.");
  }
});



gmd({
  pattern: "ai",
  alias: ["chatgpt", "gptai"],
  react: '🤖',
  desc: "Chat with AI",
  category: "ai",
}, async (from, Prince, conText) => {
  const { reply, react, mek, q, m, PrinceApiKey, PrinceTechApi, newsletterJid, botName } = conText;
  if (!q) return reply("⚠️ Provide a query for AI.");
  try {
    const data = await gmdJson(`${PrinceTechApi}/api/ai/ai?apikey=${encodeURIComponent(PrinceApiKey)}&q=${encodeURIComponent(q)}`);
    if (!data || !data.result) return reply("❌ No response from AI API.");
    await Prince.sendMessage(from, { text: data.result, contextInfo: getContextInfo(m.sender, newsletterJid, botName) }, { quoted: mek });
    await react("✅");
  } catch (e) {
    console.error("AI Error:", e);
    reply("❌ Error while fetching data from AI API.");
  }
});


gmd({
  pattern: "gpt4",
  alias: ["chatgpt4"],
  react: '🤖',
  desc: "Chat with GPT-4 AI",
  category: "ai",
}, async (from, Prince, conText) => {
  const { reply, react, mek, q, m, PrinceApiKey, PrinceTechApi, newsletterJid, botName } = conText;
  if (!q) return reply("⚠️ Provide a query for GPT-4.");
  try {
    const data = await gmdJson(`${PrinceTechApi}/api/ai/gpt4?apikey=${encodeURIComponent(PrinceApiKey)}&q=${encodeURIComponent(q)}`);
    if (!data || !data.result) return reply("❌ No response from GPT-4 API.");
    await Prince.sendMessage(from, { text: data.result, contextInfo: getContextInfo(m.sender, newsletterJid, botName) }, { quoted: mek });
    await react("✅");
  } catch (e) {
    console.error("GPT-4 Error:", e);
    reply("❌ Error while fetching data from GPT-4 API.");
  }
});

gmd({
  pattern: "vision",
  react: '🖼️',
  desc: "Analyze image using Vision AI",
  category: "ai",
}, async (from, Prince, conText) => {
  const { reply, react, mek, q, m, PrinceApiKey, PrinceTechApi, newsletterJid, botName } = conText;
  const url = q?.trim().split(" ")[0];
  const prompt = q?.replace(url, "").trim() || "Describe this image in detail.";
  if (!url) return reply("⚠️ Provide an image URL.");
  try {
    const data = await gmdJson(`${PrinceTechApi}/api/ai/vision?apikey=${encodeURIComponent(PrinceApiKey)}&url=${encodeURIComponent(url)}&prompt=${encodeURIComponent(prompt)}`);
    if (!data || !data.result) return reply("❌ No response from Vision AI.");
    await Prince.sendMessage(from, { text: data.result, contextInfo: getContextInfo(m.sender, newsletterJid, botName) }, { quoted: mek });
    await react("✅");
  } catch (e) {
    console.error("Vision Error:", e);
    reply("❌ Error while fetching data from Vision AI.");
  }
});

gmd({
  pattern: "blackbox",
  react: '🕹️',
  desc: "Chat with Blackbox AI",
  category: "ai",
}, async (from, Prince, conText) => {
  const { reply, react, mek, q, m, PrinceApiKey, PrinceTechApi, newsletterJid, botName } = conText;
  if (!q) return reply("⚠️ Provide a query for Blackbox.");
  try {
    const data = await gmdJson(`${PrinceTechApi}/api/ai/blackbox?apikey=${encodeURIComponent(PrinceApiKey)}&q=${encodeURIComponent(q)}`);
    if (!data || !data.result) return reply("❌ No response from Blackbox API.");
    await Prince.sendMessage(from, { text: data.result, contextInfo: getContextInfo(m.sender, newsletterJid, botName) }, { quoted: mek });
    await react("✅");
  } catch (e) {
    console.error("Blackbox Error:", e);
    reply("❌ Error while fetching data from Blackbox API.");
  }
});

gmd({
  pattern: "fluximg",
  react: '🎨',
  desc: "Generate image using Flux AI",
  category: "ai",
}, async (from, Prince, conText) => {
  const { reply, react, mek, q, PrinceApiKey, PrinceTechApi } = conText;
  if (!q) return reply("⚠️ Provide a prompt for Flux Image.");
  try {
    const res = await axios.get(`${PrinceTechApi}/api/ai/fluximg?apikey=${encodeURIComponent(PrinceApiKey)}&prompt=${encodeURIComponent(q)}`, { responseType: 'arraybuffer' });
    await Prince.sendMessage(from, { image: Buffer.from(res.data), caption: `✨ Flux Image for: *${q}*` }, { quoted: mek });
    await react("✅");
  } catch (e) {
    console.error("FluxImg Error:", e);
    reply("❌ Error while fetching Flux Image.");
  }
});

gmd({
  pattern: "deepimg",
  react: '🖌',
  desc: "Generate image using Deep AI",
  category: "ai",
}, async (from, Prince, conText) => {
  const { reply, react, mek, q, PrinceApiKey, PrinceTechApi } = conText;
  if (!q) return reply("⚠️ Provide a prompt for Deep Image.");
  try {
    const res = await axios.get(`${PrinceTechApi}/api/ai/deepimg?apikey=${encodeURIComponent(PrinceApiKey)}&prompt=${encodeURIComponent(q)}`, { responseType: 'arraybuffer' });
    await Prince.sendMessage(from, { image: Buffer.from(res.data), caption: `🖌 Deep AI Image for: *${q}*` }, { quoted: mek });
    await react("✅");
  } catch (e) {
    console.error("DeepImg Error:", e);
    reply("❌ Error while fetching Deep Image.");
  }
});

gmd({
  pattern: "ghibli",
  react: '🌸',
  desc: "Generate Ghibli style image",
  category: "ai",
}, async (from, Prince, conText) => {
  const { reply, react, mek, q, PrinceApiKey, PrinceTechApi } = conText;
  if (!q) return reply("⚠️ Provide a prompt for Ghibli Image.");
  try {
    const res = await axios.get(`${PrinceTechApi}/api/ai/text2ghibli?apikey=${encodeURIComponent(PrinceApiKey)}&prompt=${encodeURIComponent(q)}`, { responseType: 'arraybuffer' });
    await Prince.sendMessage(from, { image: Buffer.from(res.data), caption: `🎬 Ghibli Style Image for: *${q}*` }, { quoted: mek });
    await react("✅");
  } catch (e) {
    console.error("Ghibli Error:", e);
    reply("❌ Error while fetching Ghibli Image.");
  }
});



// HAYWHY AI Gateway: registered-command search with an offline fallback.
const gatewayTokens = value => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
const gatewayCatalogue = () => (Array.isArray(commands) ? commands : [])
  .filter(c => c && c.pattern && !c.dontAddCommandList)
  .map(c => ({
    names: [c.pattern, ...(Array.isArray(c.aliases) ? c.aliases : Array.isArray(c.alias) ? c.alias : [])].filter(Boolean).map(x => String(x).replace(/^\./, "")),
    description: String(c.desc || c.description || c.category || "Available command").replace(/[\r\n]+/g, " ").slice(0, 160),
    category: String(c.category || "")
  }));

const gatewayLocalReply = (task, list) => {
  const lower = task.toLowerCase();
  if (/^(hi|hello|hey|how are you|how r u|good morning|good afternoon|good evening)[.!? ]*$/.test(lower)) {
    return "Hey! 💜 I'm HAYWHY's command assistant. Tell me what you'd like to do, and I'll find the right bot command.";
  }
  const words = new Set(gatewayTokens(lower));
  if (/anti.?link|stop links|block links|link protection/.test(lower)) ["anti", "link", "antilink", "links", "url", "invite"].forEach(x => words.add(x));
  if (/promot|make .*admin/.test(lower)) words.add("promote");
  if (/demot|remove .*admin/.test(lower)) words.add("demote");
  if (/warn/.test(lower)) words.add("warning");
  if (/game|play|quiz|riddle/.test(lower)) words.add("game");

  const matches = list.map(item => {
    const searchable = gatewayTokens(item.names.join(" ") + " " + item.description + " " + item.category);
    let score = 0;
    for (const word of words) {
      if (word.length > 2 && searchable.includes(word)) score += 3;
      if (word.length > 2 && item.names.some(n => n.toLowerCase().includes(word))) score += 5;
    }
    if (/anti.?link|stop links|block links|link protection/.test(lower) && /anti.?link|link/.test(item.names.join(" ") + " " + item.description)) score += 12;
    return { ...item, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);

  if (!matches.length) return "I couldn't find a close match in my registered commands. Try another description, or type .menu to browse all commands.";
  return "I searched the registered commands and found these matches:\n\n" +
    matches.map((x, i) => {
      const primary = x.names[0] || "command";
      const aliases = x.names.slice(1);
      return "✦ *" + (i + 1) + ". ." + primary + "*\n" +
        (aliases.length ? "   _Aliases:_ " + aliases.map(n => "." + n).join(", ") + "\n" : "") +
        "   " + x.description;
    }).join("\n\n") +
    "\n\n_Type .menu to browse all commands._";
};

const gatewayCleanAnswer = value => String(value || "")
  .replace(/\\n/g, "\n").replace(/\r\n/g, "\n")
  .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

gmd({
  pattern: "gateway",
  aliases: ["aigateway", "commandhelp"],
  react: "🧠",
  desc: "Recommend the right HAYWHY bot command for a task",
  category: "ai",
}, async (from, Prince, conText) => {
  const { reply, react, q, PrinceTechApi, PrinceApiKey } = conText;
  if (!q || !q.trim()) {
    return reply("🤖 *H A Y W H Y  G A T E W A Y*\n\nYour command assistant.\nDescribe what you want to do, and I'll find the right command.\n\n✦ *Example*\n.gateway how do I stop links in the group?");
  }
  const task = q.trim().slice(0, 700);
  const catalogue = gatewayCatalogue();
  const commandGuide = catalogue.map(x => x.names.map(n => "." + n).join(" / ") + " — " + x.description).join("\n");

  try {
    if (!PrinceTechApi || !PrinceApiKey) throw new Error("AI API configuration is missing");
    const prompt = [
      "You are HAYWHY AI Gateway, a WhatsApp bot command guide.",
      "Recommend only commands from this exact live catalogue. Never invent commands.",
      "Do not execute commands or claim settings have changed.",
      "For greetings, reply briefly and explain that you help find bot commands.",
      "If no command fits, say so and suggest .menu.",
      "Keep the answer concise, readable and well formatted for WhatsApp.",
      "\nAVAILABLE COMMANDS:\n" + commandGuide,
      "\nUSER TASK:\n" + task
    ].join("\n");
    const response = await gmdJson(String(PrinceTechApi).replace(/\/$/, "") + "/api/ai/gpt?apikey=" +
      encodeURIComponent(PrinceApiKey) + "&q=" + encodeURIComponent(prompt));
    const answer = typeof response?.result === "string" ? gatewayCleanAnswer(response.result) : "";
    if (!answer) throw new Error("AI API returned an empty result");
    await reply("🤖 *H A Y W H Y  G A T E W A Y*\n\n" + answer.slice(0, 3200));
    await react("✅");
  } catch (error) {
    console.error("HAYWHY AI Gateway fallback:", error?.message || error);
    await reply("🤖 *H A Y W H Y  G A T E W A Y*\n🟣 _Local command search_\n\n" + gatewayLocalReply(task, catalogue));
    await react("⚠️");
  }
});

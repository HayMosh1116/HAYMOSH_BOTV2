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
  pattern: "letme",
  react: '💡',
  desc: "Ask LetMeGPT",
  category: "ai",
}, async (from, Prince, conText) => {
  const { reply, react, mek, q, m, PrinceApiKey, PrinceTechApi, newsletterJid, botName } = conText;
  if (!q) return reply("⚠️ Provide a query for LetMeGPT.");
  try {
    const data = await gmdJson(`${PrinceTechApi}/api/ai/letmegpt?apikey=${encodeURIComponent(PrinceApiKey)}&q=${encodeURIComponent(q)}`);
    if (!data || !data.result) return reply("❌ No response from LetMeGPT.");
    await Prince.sendMessage(from, { text: data.result, contextInfo: getContextInfo(m.sender, newsletterJid, botName) }, { quoted: mek });
    await react("✅");
  } catch (e) {
    console.error("LetMe Error:", e);
    reply("❌ Error while fetching data from LetMeGPT API.");
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


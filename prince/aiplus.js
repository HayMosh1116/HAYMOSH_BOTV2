const { gmd, gmdJson, getContextInfo } = require("../mayel");
const axios = require("axios");

/**
 * AI Plus — Extended AI commands
 * Commands: .story, .poem, .roastai, .pickupai, .codeexplain, .translate2, .summarize, .askwiki, .aiadvice, .ainame
 */

// ─── Story Generator ──────────────────────────────────────────────────────────

gmd({
  pattern: "story",
  aliases: ["storygen", "writestory"],
  react: "📖",
  category: "ai",
  description: "Generate a short story. Usage: .story <topic/prompt>",
}, async (from, Prince, conText) => {
  const { reply, mek, q, react, PrinceApiKey, PrinceTechApi, newsletterJid, botName, m } = conText;

  if (!q) return reply("📖 Usage: *.story <topic or prompt>*\nExample: *.story a robot that falls in love*");

  await react("⏳");

  try {
    const prompt = `Write a short creative story (around 150 words) about: ${q}. Make it engaging and end with a twist or meaningful conclusion.`;
    const data = await gmdJson(
      `${PrinceTechApi}/api/ai/gpt?apikey=${encodeURIComponent(PrinceApiKey)}&q=${encodeURIComponent(prompt)}`
    );

    if (!data?.result) { await react("❌"); return reply("❌ Couldn't generate story. Try again."); }

    await Prince.sendMessage(from, {
      text: `📖 *Story: ${q}*\n\n${data.result}`,
      contextInfo: getContextInfo(m?.sender, newsletterJid, botName),
      quoted: mek,
    });
    await react("✅");
  } catch (e) {
    await react("❌");
    reply("❌ Story generation failed. Try again.");
  }
});

// ─── Poem Generator ───────────────────────────────────────────────────────────

gmd({
  pattern: "poem",
  aliases: ["poetry", "writepoem"],
  react: "🌸",
  category: "ai",
  description: "Generate a poem. Usage: .poem <topic>",
}, async (from, Prince, conText) => {
  const { reply, mek, q, react, PrinceApiKey, PrinceTechApi, newsletterJid, botName, m } = conText;

  if (!q) return reply("🌸 Usage: *.poem <topic>*\nExample: *.poem the ocean at night*");

  await react("⏳");

  try {
    const prompt = `Write a beautiful, short poem (4-6 stanzas) about: ${q}. Use vivid imagery and make it emotionally resonant.`;
    const data = await gmdJson(
      `${PrinceTechApi}/api/ai/gpt?apikey=${encodeURIComponent(PrinceApiKey)}&q=${encodeURIComponent(prompt)}`
    );

    if (!data?.result) { await react("❌"); return reply("❌ Couldn't generate poem."); }

    await Prince.sendMessage(from, {
      text: `🌸 *Poem: ${q}*\n\n${data.result}`,
      contextInfo: getContextInfo(m?.sender, newsletterJid, botName),
      quoted: mek,
    });
    await react("✅");
  } catch (e) {
    await react("❌");
    reply("❌ Poem generation failed.");
  }
});

// ─── AI Roast ─────────────────────────────────────────────────────────────────

gmd({
  pattern: "roastai",
  aliases: ["airoast", "smartroast"],
  react: "🔥",
  category: "ai",
  description: "Get an AI-generated custom roast. Usage: .roastai <name or description>",
}, async (from, Prince, conText) => {
  const { reply, mek, q, react, PrinceApiKey, PrinceTechApi, pushName } = conText;

  const target = q || pushName;
  await react("⏳");

  try {
    const prompt = `Roast someone described as: "${target}". Make it funny, savage but not genuinely hurtful. Keep it to 2-3 sentences. No racial or sexual content.`;
    const data = await gmdJson(
      `${PrinceTechApi}/api/ai/gpt?apikey=${encodeURIComponent(PrinceApiKey)}&q=${encodeURIComponent(prompt)}`
    );

    if (!data?.result) { await react("❌"); return reply("❌ AI couldn't roast right now. Try again."); }

    await Prince.sendMessage(from, {
      text: `🔥 *AI Roast for ${target}*\n\n${data.result}`,
      quoted: mek,
    });
    await react("✅");
  } catch (e) {
    await react("❌");
    reply("❌ Roast failed. Try again.");
  }
});

// ─── AI Pickup Line ───────────────────────────────────────────────────────────

gmd({
  pattern: "pickupai",
  aliases: ["aiflirt", "aipickup"],
  react: "😍",
  category: "ai",
  description: "Get an AI-generated pickup line. Usage: .pickupai <name or topic>",
}, async (from, Prince, conText) => {
  const { reply, mek, q, react, PrinceApiKey, PrinceTechApi } = conText;

  const topic = q || "someone special";
  await react("⏳");

  try {
    const prompt = `Generate a creative, charming, and funny pickup line for someone named or described as: "${topic}". Make it clever and original — not a generic one.`;
    const data = await gmdJson(
      `${PrinceTechApi}/api/ai/gpt?apikey=${encodeURIComponent(PrinceApiKey)}&q=${encodeURIComponent(prompt)}`
    );

    if (!data?.result) { await react("❌"); return reply("❌ AI couldn't think of a pickup line right now."); }

    await Prince.sendMessage(from, {
      text: `😍 *AI Pickup Line*\n\n${data.result}`,
      quoted: mek,
    });
    await react("✅");
  } catch (e) {
    await react("❌");
    reply("❌ Failed. Try again.");
  }
});

// ─── Code Explainer ───────────────────────────────────────────────────────────

gmd({
  pattern: "codeexplain",
  aliases: ["explaincode", "whatdoes"],
  react: "💻",
  category: "ai",
  description: "Explain a piece of code in plain English. Reply to code or paste it",
}, async (from, Prince, conText) => {
  const { reply, mek, q, react, PrinceApiKey, PrinceTechApi, quotedMsg } = conText;

  const code = q || (quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text);
  if (!code) return reply("💻 Usage: *.codeexplain <paste your code>*\nor reply to a code message with *.codeexplain*");

  await react("⏳");

  try {
    const prompt = `Explain the following code in simple, plain English. What does it do, step by step? Be concise but clear:\n\n${code.slice(0, 1500)}`;
    const data = await gmdJson(
      `${PrinceTechApi}/api/ai/gpt?apikey=${encodeURIComponent(PrinceApiKey)}&q=${encodeURIComponent(prompt)}`
    );

    if (!data?.result) { await react("❌"); return reply("❌ Couldn't explain the code."); }

    await Prince.sendMessage(from, {
      text: `💻 *Code Explanation*\n\n${data.result}`,
      quoted: mek,
    });
    await react("✅");
  } catch (e) {
    await react("❌");
    reply("❌ Code explanation failed.");
  }
});

// ─── Summarize ────────────────────────────────────────────────────────────────

gmd({
  pattern: "summarize",
  aliases: ["tldr", "summary"],
  react: "📝",
  category: "ai",
  description: "Summarize a long text. Reply to a message or paste text",
}, async (from, Prince, conText) => {
  const { reply, mek, q, react, PrinceApiKey, PrinceTechApi, quotedMsg } = conText;

  const text = q || (quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text);
  if (!text) return reply("📝 Usage: *.summarize <long text>*\nor reply to a message with *.summarize*");
  if (text.length < 100) return reply("❌ Text is too short to summarize.");

  await react("⏳");

  try {
    const prompt = `Summarize the following text in 3-5 bullet points. Be concise and capture the main points:\n\n${text.slice(0, 2000)}`;
    const data = await gmdJson(
      `${PrinceTechApi}/api/ai/gpt?apikey=${encodeURIComponent(PrinceApiKey)}&q=${encodeURIComponent(prompt)}`
    );

    if (!data?.result) { await react("❌"); return reply("❌ Couldn't summarize."); }

    await Prince.sendMessage(from, {
      text: `📝 *Summary (TL;DR)*\n\n${data.result}`,
      quoted: mek,
    });
    await react("✅");
  } catch (e) {
    await react("❌");
    reply("❌ Summary failed.");
  }
});

// ─── AI Advice ────────────────────────────────────────────────────────────────

gmd({
  pattern: "aiadvice",
  aliases: ["getadvice", "askforadvice"],
  react: "🧠",
  category: "ai",
  description: "Get AI-powered advice for any situation",
}, async (from, Prince, conText) => {
  const { reply, mek, q, react, PrinceApiKey, PrinceTechApi, newsletterJid, botName, m } = conText;

  if (!q) return reply("🧠 Usage: *.aiadvice <your situation>*\nExample: *.aiadvice I can't focus when studying*");

  await react("⏳");

  try {
    const prompt = `Give practical, empathetic advice for this situation: "${q}". Provide 3 actionable steps. Be warm, supportive, and realistic. Keep it under 200 words.`;
    const data = await gmdJson(
      `${PrinceTechApi}/api/ai/gpt?apikey=${encodeURIComponent(PrinceApiKey)}&q=${encodeURIComponent(prompt)}`
    );

    if (!data?.result) { await react("❌"); return reply("❌ Couldn't get advice right now."); }

    await Prince.sendMessage(from, {
      text: `🧠 *AI Advice*\n\n_Situation:_ ${q}\n\n${data.result}`,
      contextInfo: getContextInfo(m?.sender, newsletterJid, botName),
      quoted: mek,
    });
    await react("✅");
  } catch (e) {
    await react("❌");
    reply("❌ Advice failed. Try again.");
  }
});

// ─── AI Name Generator ────────────────────────────────────────────────────────

gmd({
  pattern: "ainame",
  aliases: ["namegen", "generatename"],
  react: "✨",
  category: "ai",
  description: "Generate creative names. Usage: .ainame <type of name or description>",
}, async (from, Prince, conText) => {
  const { reply, mek, q, react, PrinceApiKey, PrinceTechApi } = conText;

  if (!q) return reply("✨ Usage: *.ainame <type>*\nExamples:\n*.ainame Nigerian baby girl*\n*.ainame cool gaming username*\n*.ainame tech startup about AI*");

  await react("⏳");

  try {
    const prompt = `Generate 10 creative, unique names for: "${q}". List them numbered, with a brief meaning or reason for each. Make them memorable and relevant.`;
    const data = await gmdJson(
      `${PrinceTechApi}/api/ai/gpt?apikey=${encodeURIComponent(PrinceApiKey)}&q=${encodeURIComponent(prompt)}`
    );

    if (!data?.result) { await react("❌"); return reply("❌ Couldn't generate names."); }

    await Prince.sendMessage(from, {
      text: `✨ *Name Ideas for: ${q}*\n\n${data.result}`,
      quoted: mek,
    });
    await react("✅");
  } catch (e) {
    await react("❌");
    reply("❌ Name generation failed.");
  }
});

// ─── Wikipedia AI Summary ─────────────────────────────────────────────────────

gmd({
  pattern: "askwiki",
  aliases: ["wiki2", "wikiai"],
  react: "📚",
  category: "ai",
  description: "Search Wikipedia and get an AI summary",
}, async (from, Prince, conText) => {
  const { reply, mek, q, react, PrinceApiKey, PrinceTechApi } = conText;

  if (!q) return reply("📚 Usage: *.askwiki <topic>*\nExample: *.askwiki black holes*");

  await react("⏳");

  try {
    const wikiRes = await axios.get(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`
    );
    const extract = wikiRes.data?.extract;
    if (!extract) { await react("❌"); return reply(`❌ No Wikipedia article found for *"${q}"*.`); }

    const prompt = `Summarize and explain this Wikipedia extract in simple terms, highlight 3 key facts:\n\n${extract.slice(0, 1500)}`;
    const data = await gmdJson(
      `${PrinceTechApi}/api/ai/gpt?apikey=${encodeURIComponent(PrinceApiKey)}&q=${encodeURIComponent(prompt)}`
    );

    const thumb = wikiRes.data?.thumbnail?.source;
    const pageUrl = wikiRes.data?.content_urls?.desktop?.page;

    if (thumb) {
      await Prince.sendMessage(from, {
        image: { url: thumb },
        caption: `📚 *${wikiRes.data.title}*\n\n${data?.result || extract.slice(0, 800)}${pageUrl ? `\n\n🔗 ${pageUrl}` : ""}`,
        quoted: mek,
      });
    } else {
      await Prince.sendMessage(from, {
        text: `📚 *${wikiRes.data.title}*\n\n${data?.result || extract.slice(0, 1000)}${pageUrl ? `\n\n🔗 ${pageUrl}` : ""}`,
        quoted: mek,
      });
    }
    await react("✅");
  } catch (e) {
    await react("❌");
    reply(`❌ Wikipedia search failed for *"${q}"*. Try a different spelling.`);
  }
});

// ─── AI Compliment ────────────────────────────────────────────────────────────

gmd({
  pattern: "compliment",
  aliases: ["niceme", "aicomplement"],
  react: "💐",
  category: "ai",
  description: "Get an AI-generated personalised compliment",
}, async (from, Prince, conText) => {
  const { reply, mek, q, react, PrinceApiKey, PrinceTechApi, pushName } = conText;

  const person = q || pushName;
  await react("⏳");

  try {
    const prompt = `Write a heartfelt, genuine, and creative compliment for someone named or described as: "${person}". Make it specific and uplifting, not generic. 2-3 sentences.`;
    const data = await gmdJson(
      `${PrinceTechApi}/api/ai/gpt?apikey=${encodeURIComponent(PrinceApiKey)}&q=${encodeURIComponent(prompt)}`
    );

    if (!data?.result) { await react("❌"); return reply("❌ Couldn't generate a compliment."); }

    await Prince.sendMessage(from, {
      text: `💐 *Compliment for ${person}*\n\n${data.result}`,
      quoted: mek,
    });
    await react("✅");
  } catch (e) {
    await react("❌");
    reply("❌ Failed to generate compliment.");
  }
});

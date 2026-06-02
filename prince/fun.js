const { gmd, getContextInfo } = require("../mayel");
const axios = require("axios");

// ─── Data pools ───────────────────────────────────────────────────────────────

const LOVE_QUOTES = [
  "The best thing to hold onto in life is each other. 💕",
  "You are my today and all of my tomorrows. 💞",
  "In all the world, there is no heart for me like yours. ❤️",
  "I love you not only for what you are, but for what I am when I am with you. 💖",
  "Every love story is beautiful, but ours is my favourite. 💗",
  "You make my heart smile. 😍",
  "I fell in love with you because of the million things you never knew you were doing. 💓",
  "Being deeply loved by someone gives you strength. 💝",
  "Where there is love there is life. 🌹",
  "The secret of a happy marriage is finding the right person. 🥰",
  "Love is not about how many days, months, or years you have been together, it's all about how much you love each other every day. 💑",
  "You are the last thought in my mind before I drift off to sleep. 🌙💕",
  "I would rather spend one lifetime with you, than face all the ages of this world alone. 💍",
  "A true relationship is two unperfect people refusing to give up on each other. 🤝❤️",
  "My favourite place in the world is next to you. 🌍💞",
];

const MOTIVATION_QUOTES = [
  "Push yourself, because no one else is going to do it for you. 💪",
  "Great things never come from comfort zones. 🚀",
  "Dream it. Wish it. Do it. ✨",
  "Success doesn't just find you. You have to go out and get it. 🏆",
  "The harder you work for something, the greater you'll feel when you achieve it. 🔥",
  "Don't stop when you're tired. Stop when you're done. 💯",
  "Wake up with determination. Go to bed with satisfaction. 😤",
  "Do something today that your future self will thank you for. 🙏",
  "Little things make big days. 🌟",
  "It's going to be hard, but hard is not impossible. 💥",
  "Don't wait for opportunity. Create it. 🛠️",
  "Be the change you wish to see in the world. 🌍",
  "You are stronger than you think. 🦾",
  "Your limitation — it's only your imagination. 🧠",
  "Sometimes later becomes never. Do it now. ⏰",
];

const FLIRT_LINES = [
  "Are you a magician? Because whenever I look at you, everyone else disappears. 😏",
  "Do you have a map? I keep getting lost in your eyes. 🗺️😍",
  "Is your name Google? Because you have everything I've been searching for. 🔍💕",
  "Are you a parking ticket? Because you've got 'fine' written all over you. 😂❤️",
  "Do you believe in love at first text, or should I message you again? 📱💞",
  "Are you a camera? Because every time I look at you, I smile. 📸😊",
  "If beauty were time, you'd be an eternity. ⏳✨",
  "Are you from Tennessee? Because you're the only ten I see. 🎸😉",
  "Did it hurt when you fell from heaven? 😇💫",
  "Are you a star? Because your beauty lights up the whole room. 🌟",
  "You must be tired, because you've been running through my mind all day. 😴💭",
  "If I could rearrange the alphabet, I'd put U and I together. 💌",
  "Is there an airport nearby, or is that just my heart taking off? ✈️💗",
  "You're so sweet, you're giving me a toothache. 🦷😍",
  "If looks could kill, you'd definitely be a weapon of mass destruction. 💣😍",
];

const ADVICE_LIST = [
  "Drink more water. Most problems are just dehydration in disguise. 💧",
  "Sleep on big decisions. Things always look different in the morning. 🌅",
  "Surround yourself with people who make you laugh. Life is too short for boring company. 😂",
  "Stop comparing your chapter 1 to someone else's chapter 20. 📖",
  "Learn one new thing every day. Compound interest applies to knowledge too. 🧠",
  "If you can't change it, don't worry about it. If you can change it, why worry? 🧘",
  "Be the person you needed when you were younger. 🫂",
  "Your vibe attracts your tribe. Choose your energy wisely. ✨",
  "Apologise when you're wrong. It costs nothing but means everything. 🙏",
  "Invest in yourself. It's the best investment you'll ever make. 💰",
  "Don't take advice from people you wouldn't trade lives with. 👀",
  "The person who reads a lot is always smarter in every argument. 📚",
  "Chase progress, not perfection. Done is better than perfect. 🏃",
  "Keep your circle small and your energy high. 🔮",
  "Forgive yourself first. Then others. 💚",
];

const INSULTS = [
  "You're not stupid — you just have bad luck thinking. 🧠❌",
  "I'd explain it to you but I don't have the crayons. 🖍️😂",
  "You're the reason they put instructions on shampoo bottles. 🧴😭",
  "Light travels faster than sound. That's why you seemed bright until you spoke. ⚡😂",
  "If brains were petrol, you wouldn't have enough to power an ant's motorcycle. 🏍️😅",
  "You're not the dumbest person in the world, but you better hope they don't die. 💀",
  "Were you born on a highway? Because that's where most accidents happen. 🚗😂",
  "You're like a software update — whenever I see you, I think 'not now'. 🖥️😂",
  "I've seen better heads on a pimple. 😬",
  "You have your whole life to be an idiot. Why not take today off? 🏖️😂",
  "Brains aren't everything. In your case they're nothing. 🪹😭",
  "I would challenge you to a battle of wits, but I see you're unarmed. ⚔️😂",
  "You're like a cloud. When you disappear, it's a beautiful day. ☀️😂",
  "If you were any more inbred, you'd be a sandwich. 🥪😂",
  "You are proof that evolution can go in reverse. 🦎😂",
];

const ROAST_LINES = [
  "Your hairline is so far back, even your barber charges a long-distance fee. 😂✂️",
  "You're so broke, even your dreams come with a payment plan. 💸😂",
  "Your WiFi password is stronger than your whole personality. 📡😭",
  "You took an IQ test and it came back negative. 📉😂",
  "Even your mum fakes being busy when you call. 📵😂",
  "You're the human equivalent of a participation trophy. 🏅😂",
  "Your fashion sense called — it said it's giving up on you. 👗❌",
  "You're the reason why the middle finger was invented. 🖕😂",
  "You've been single so long your hand asked for a ring. 💍😭",
  "Your vibe is so off, GPS can't locate your personality. 🗺️😂",
  "You're like Monday — nobody wants to see you. 📅😂",
  "Your selfie game is so weak, your front camera applied for sick leave. 📸😂",
  "You're so basic, even salt finds you bland. 🧂😭",
  "People don't dislike you. They just prefer your absence. 😶",
  "Your life is like a broken pencil — pointless. ✏️😂",
];

const TRUTH_QUESTIONS = [
  "What's the most embarrassing thing you've ever done in public? 😳",
  "Have you ever lied to get out of trouble? What was the lie? 🤥",
  "Who was your first crush and do they know? 😍",
  "What's the worst thing you've ever said behind someone's back? 👀",
  "Have you ever cheated on a test or exam? 📝",
  "What's your biggest insecurity? 🙈",
  "Have you ever pretended to be sick to avoid something? What was it? 🤒",
  "What's the most childish thing you still do? 🧸",
  "Who in this chat do you find most annoying? 😅",
  "What's a secret you've never told anyone? 🤫",
  "Have you ever stolen something? Even small things count. 👀",
  "What's your most embarrassing search history item? 😂",
  "Have you ever liked someone in this chat romantically? 💕",
  "What's the biggest mistake you've made in a relationship? 💔",
  "What's something you've done that you'd never admit to your parents? 😬",
];

const DARE_CHALLENGES = [
  "Change your display name to 'Bot Slave' for 1 hour. 😂",
  "Send a voice note singing any nursery rhyme. 🎵",
  "Text your last contact 'I love you' and screenshot the reply. 📱",
  "Send your most embarrassing photo in the chat. 😳",
  "Do a 30-second dance and send the video. 💃",
  "Send a voice note saying 'I am the greatest human ever' with full confidence. 🎙️",
  "Write a short love poem about the person who last messaged you. ✍️",
  "Send a selfie making the ugliest face you can. 🤪",
  "Type only in capital letters for the next 10 minutes. 🗣️",
  "Compliment every person in this chat one by one. 💬",
  "Change your profile picture to a cartoon character for 30 minutes. 🎭",
  "Send a voice note saying 'I'm the bot's number one fan'. 🤖",
  "Write a rap about what you ate today. 🎤",
  "Send the 5th photo in your gallery right now. 📸",
  "Tell the group your most embarrassing childhood memory. 🙈",
];

const EIGHTBALL_RESPONSES = [
  "It is certain. ✅", "It is decidedly so. ✅", "Without a doubt. ✅",
  "Yes, definitely. ✅", "You may rely on it. ✅", "As I see it, yes. 🔮",
  "Most likely. 🔮", "Outlook good. 🔮", "Yes. 🔮", "Signs point to yes. 🔮",
  "Reply hazy, try again. ⏳", "Ask again later. ⏳", "Better not tell you now. 🤐",
  "Cannot predict now. 🤷", "Concentrate and ask again. 🧘",
  "Don't count on it. ❌", "My reply is no. ❌", "My sources say no. ❌",
  "Outlook not so good. ❌", "Very doubtful. ❌",
];

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Fun Menu ─────────────────────────────────────────────────────────────────

gmd({
  pattern: "funmenu",
  aliases: ["fun", "funlist"],
  react: "🎉",
  category: "fun",
  description: "Show the fun commands menu",
}, async (from, Prince, conText) => {
  const { reply, mek, botName, botPrefix } = conText;
  const p = botPrefix || ".";
  const menu = `
╭━━〔 *🎉 FUN MENU* 〕━━╮
│
│ 💌 *LOVE & FLIRT*
│  ▸ ${p}lovequote
│  ▸ ${p}flirt
│
│ 💪 *POSITIVITY*
│  ▸ ${p}motivation
│  ▸ ${p}advice
│
│ 😂 *SAVAGE*
│  ▸ ${p}insult
│  ▸ ${p}roast
│
│ 🎮 *PARTY GAMES*
│  ▸ ${p}truth
│  ▸ ${p}dare
│  ▸ ${p}8ball <question>
│
╰━━━━━━━━━━━━━━━━━━━━━╯
> *${botName || "HAYWHY_MDX"}*`;
  await reply(menu, { quoted: mek });
});

// ─── Love Quote ───────────────────────────────────────────────────────────────

gmd({
  pattern: "lovequote",
  aliases: ["lq", "love"],
  react: "💕",
  category: "fun",
  description: "Get a random love quote",
}, async (from, Prince, conText) => {
  const { reply, mek, pushName } = conText;
  await reply(`💕 *Love Quote for ${pushName}*\n\n_"${rand(LOVE_QUOTES)}"_`, { quoted: mek });
});

// ─── Motivation ───────────────────────────────────────────────────────────────

gmd({
  pattern: "motivation",
  aliases: ["motivate", "inspire"],
  react: "💪",
  category: "fun",
  description: "Get a motivational quote",
}, async (from, Prince, conText) => {
  const { reply, mek, pushName } = conText;
  await reply(`🔥 *Motivation for ${pushName}*\n\n_"${rand(MOTIVATION_QUOTES)}"_`, { quoted: mek });
});

// ─── Flirt ────────────────────────────────────────────────────────────────────

gmd({
  pattern: "flirt",
  aliases: ["pickup", "pickupline"],
  react: "😏",
  category: "fun",
  description: "Send a flirt/pickup line",
}, async (from, Prince, conText) => {
  const { reply, mek } = conText;
  await reply(`😏 *Flirt Line*\n\n${rand(FLIRT_LINES)}`, { quoted: mek });
});

// ─── Advice ───────────────────────────────────────────────────────────────────

gmd({
  pattern: "advice",
  react: "🧠",
  category: "fun",
  description: "Get random life advice",
}, async (from, Prince, conText) => {
  const { reply, mek } = conText;
  await reply(`🧠 *Life Advice*\n\n_${rand(ADVICE_LIST)}_`, { quoted: mek });
});

// ─── Insult ───────────────────────────────────────────────────────────────────

gmd({
  pattern: "insult",
  aliases: ["diss"],
  react: "😂",
  category: "fun",
  description: "Get a funny (harmless) insult",
}, async (from, Prince, conText) => {
  const { reply, mek } = conText;
  await reply(`😂 *Ouch!*\n\n${rand(INSULTS)}`, { quoted: mek });
});

// ─── Roast ────────────────────────────────────────────────────────────────────

gmd({
  pattern: "roast",
  aliases: ["burnme"],
  react: "🔥",
  category: "fun",
  description: "Get roasted",
}, async (from, Prince, conText) => {
  const { reply, mek, pushName } = conText;
  await reply(`🔥 *${pushName} got ROASTED!*\n\n${rand(ROAST_LINES)}`, { quoted: mek });
});

// ─── Truth ────────────────────────────────────────────────────────────────────

gmd({
  pattern: "truth",
  aliases: ["truthq"],
  react: "🤫",
  category: "fun",
  description: "Get a truth question for Truth or Dare",
}, async (from, Prince, conText) => {
  const { reply, mek } = conText;
  await reply(`🤫 *TRUTH*\n\n${rand(TRUTH_QUESTIONS)}`, { quoted: mek });
});

// ─── Dare ─────────────────────────────────────────────────────────────────────

gmd({
  pattern: "dare",
  aliases: ["dareq"],
  react: "😈",
  category: "fun",
  description: "Get a dare challenge for Truth or Dare",
}, async (from, Prince, conText) => {
  const { reply, mek } = conText;
  await reply(`😈 *DARE*\n\n${rand(DARE_CHALLENGES)}`, { quoted: mek });
});

// ─── Magic 8 Ball ─────────────────────────────────────────────────────────────

gmd({
  pattern: "8ball",
  aliases: ["eightball", "ask8"],
  react: "🎱",
  category: "fun",
  description: "Ask the magic 8-ball a yes/no question",
}, async (from, Prince, conText) => {
  const { reply, mek, q } = conText;
  if (!q) return reply("🎱 Ask me a question!\nUsage: .8ball Will I be rich?");
  await reply(`🎱 *Magic 8-Ball*\n\n*Question:* _${q}_\n\n*Answer:* ${rand(EIGHTBALL_RESPONSES)}`, { quoted: mek });
});

// ─── Would You Rather ─────────────────────────────────────────────────────────

const WYR_LIST = [
  ["be invisible", "be able to fly"],
  ["never use social media again", "never watch movies/TV again"],
  ["be rich and ugly", "be poor and beautiful"],
  ["know when you'll die", "know how you'll die"],
  ["live without music", "live without the internet"],
  ["always be 10 minutes late", "always be 20 minutes early"],
  ["have super strength", "have super speed"],
  ["be famous but hated", "be unknown but loved"],
  ["eat the same meal every day", "never eat your favourite food again"],
  ["be a master chef", "be a master musician"],
];

gmd({
  pattern: "wyr",
  aliases: ["wouldyourather"],
  react: "🤔",
  category: "fun",
  description: "Would you rather game",
}, async (from, Prince, conText) => {
  const { reply, mek } = conText;
  const [a, b] = rand(WYR_LIST);
  await reply(`🤔 *Would You Rather?*\n\n*Option A:* ${a}\n\n         OR\n\n*Option B:* ${b}\n\n_Reply A or B!_`, { quoted: mek });
});

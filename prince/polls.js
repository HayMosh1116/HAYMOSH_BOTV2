const { gmd, getContextInfo } = require("../mayel");

/**
 * Polls & Voting System
 * Commands: .poll, .vote, .pollresult, .endpoll
 * One active poll per chat.
 */

const polls = new Map(); // chatJid -> poll object

gmd({
  pattern: "poll",
  aliases: ["createpoll", "startpoll"],
  react: "📊",
  category: "group",
  description: "Create a poll. Usage: .poll Question | Option1 | Option2 | ...",
}, async (from, Prince, conText) => {
  const { reply, mek, q, sender, pushName, isGroup, isAdmin, isSuperAdmin, isBotAdmin } = conText;

  if (!q) {
    return reply(
      `📊 *How to create a poll:*\n\n*.poll Question | Option1 | Option2 | Option3*\n\n*Example:*\n.poll Best programming language? | JavaScript | Python | Rust`
    );
  }

  if (polls.has(from)) {
    return reply("❌ A poll is already active here! Use *.endpoll* to close it first.");
  }

  const parts = q.split("|").map(s => s.trim()).filter(Boolean);
  if (parts.length < 3) {
    return reply("❌ You need a question and at least 2 options.\n\nUsage: *.poll Question | Option1 | Option2*");
  }

  const question = parts[0];
  const options = parts.slice(1);

  if (options.length > 10) {
    return reply("❌ Maximum 10 options allowed.");
  }

  const poll = {
    question,
    options,
    votes: {},        // senderJid -> optionIndex
    creator: sender,
    creatorName: pushName,
    createdAt: Date.now(),
  };

  polls.set(from, poll);

  const optionsText = options.map((o, i) => `  *${i + 1}.* ${o}`).join("\n");
  await Prince.sendMessage(from, {
    text: `📊 *POLL STARTED!*\n\n*❓ ${question}*\n\n${optionsText}\n\n_Type *.vote <number>* to cast your vote!_\n_Example: .vote 1_\n\n> Created by ${pushName}`,
    quoted: mek,
  });
});

gmd({
  pattern: "vote",
  aliases: ["castvote"],
  react: "🗳️",
  category: "group",
  description: "Vote in the active poll. Usage: .vote <option number>",
}, async (from, Prince, conText) => {
  const { reply, mek, q, sender, pushName } = conText;

  const poll = polls.get(from);
  if (!poll) return reply("❌ No active poll here. Start one with *.poll*");

  const num = parseInt(q?.trim());
  if (isNaN(num) || num < 1 || num > poll.options.length) {
    return reply(`❌ Invalid option. Vote between 1 and ${poll.options.length}.\nExample: *.vote 1*`);
  }

  const prevVote = poll.votes[sender];
  poll.votes[sender] = num - 1;

  if (prevVote !== undefined && prevVote !== num - 1) {
    await reply(`✅ *${pushName}* changed vote to *${num}. ${poll.options[num - 1]}*`, { quoted: mek });
  } else if (prevVote === num - 1) {
    await reply(`ℹ️ *${pushName}* already voted for *${num}. ${poll.options[num - 1]}*`, { quoted: mek });
  } else {
    await reply(`✅ *${pushName}* voted for *${num}. ${poll.options[num - 1]}*`, { quoted: mek });
  }
});

gmd({
  pattern: "pollresult",
  aliases: ["presult", "pollresults", "checkpoll"],
  react: "📈",
  category: "group",
  description: "Check current poll results",
}, async (from, Prince, conText) => {
  const { reply, mek } = conText;

  const poll = polls.get(from);
  if (!poll) return reply("❌ No active poll here.");

  const totalVotes = Object.keys(poll.votes).length;
  const counts = poll.options.map((_, i) =>
    Object.values(poll.votes).filter(v => v === i).length
  );
  const maxVotes = Math.max(...counts, 1);

  const bars = poll.options.map((opt, i) => {
    const count = counts[i];
    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    const filled = Math.round((count / maxVotes) * 10);
    const bar = "█".repeat(filled) + "░".repeat(10 - filled);
    return `*${i + 1}. ${opt}*\n  ${bar} ${pct}% (${count} vote${count !== 1 ? "s" : ""})`;
  });

  const elapsed = Math.floor((Date.now() - poll.createdAt) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  await reply(
    `📊 *POLL RESULTS (Live)*\n\n*❓ ${poll.question}*\n\n${bars.join("\n\n")}\n\n_Total votes: ${totalVotes} | Running for ${mins}m ${secs}s_`,
    { quoted: mek }
  );
});

gmd({
  pattern: "endpoll",
  aliases: ["closepoll", "stoppoll"],
  react: "🔒",
  category: "group",
  description: "End the current poll and show final results",
}, async (from, Prince, conText) => {
  const { reply, mek, sender, isAdmin, isSuperAdmin } = conText;

  const poll = polls.get(from);
  if (!poll) return reply("❌ No active poll to end.");

  if (poll.creator !== sender && !isAdmin && !isSuperAdmin) {
    return reply("❌ Only the poll creator or admins can end the poll.");
  }

  const totalVotes = Object.keys(poll.votes).length;
  const counts = poll.options.map((_, i) =>
    Object.values(poll.votes).filter(v => v === i).length
  );

  let winnerIdx = counts.indexOf(Math.max(...counts));
  const winner = poll.options[winnerIdx];
  const winnerVotes = counts[winnerIdx];

  const bars = poll.options.map((opt, i) => {
    const count = counts[i];
    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    const filled = Math.round((count / Math.max(...counts, 1)) * 10);
    const bar = "█".repeat(filled) + "░".repeat(10 - filled);
    const crown = i === winnerIdx && totalVotes > 0 ? " 👑" : "";
    return `*${i + 1}. ${opt}*${crown}\n  ${bar} ${pct}% (${count} vote${count !== 1 ? "s" : ""})`;
  });

  polls.delete(from);

  await reply(
    `🔒 *POLL CLOSED — FINAL RESULTS*\n\n*❓ ${poll.question}*\n\n${bars.join("\n\n")}\n\n${totalVotes > 0 ? `🏆 *Winner: ${winner}* with ${winnerVotes} vote${winnerVotes !== 1 ? "s" : ""}!` : "No votes were cast."}\n\n_Total votes: ${totalVotes}_`,
    { quoted: mek }
  );
});

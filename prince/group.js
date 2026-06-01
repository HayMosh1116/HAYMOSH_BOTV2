const { gmd, getContextInfo, getGroupSetting, setGroupSetting } = require("../mayel");

gmd(
  {
    pattern: "unmute",
    react: "⏳",
    aliases: ["open", "groupopen", "gcopen", "adminonly", "adminsonly"],
    category: "group",
    description: "Open Group Chat.",
  },
  async (from, Prince, conText) => {
    const { reply, isAdmin, isSuperAdmin, isGroup, isBotAdmin, mek, sender } =
      conText;

    if (!isGroup) {
      return reply("Groups Only Command only");
    }

    if (!isBotAdmin) {
      const userNumber = sender.split("@")[0];
      return reply(`@${userNumber} This bot is not an admin`, {
        mentions: [`${userNumber}@s.whatsapp.net`],
      });
    }

    if (!isAdmin && !isSuperAdmin) {
      const userNumber = sender.split("@")[0];
      return reply(`@${userNumber} you are not an admin`, {
        mentions: [`${userNumber}@s.whatsapp.net`],
      });
    }

    try {
      await Prince.groupSettingUpdate(from, "not_announcement");
      const userNumber = sender.split("@")[0];
      return reply(`@${userNumber} Group successfully unmuted as you wished!`, {
        mentions: [`${userNumber}@s.whatsapp.net`],
      });
    } catch (error) {
      console.error("Unmute error:", error);
      return reply(`❌ Failed to unmute group: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "mute",
    react: "⏳",
    aliases: ["close", "groupmute", "gcmute", "gcclose"],
    category: "group",
    description: "Close Group Chat",
  },
  async (from, Prince, conText) => {
    const { reply, isAdmin, isSuperAdmin, isGroup, isBotAdmin, mek, sender } =
      conText;

    if (!isGroup) {
      return reply("Groups Only Command only");
    }

    if (!isBotAdmin) {
      const userNumber = sender.split("@")[0];
      return reply(`@${userNumber} This bot is not an admin`, {
        mentions: [`${userNumber}@s.whatsapp.net`],
      });
    }

    if (!isAdmin && !isSuperAdmin) {
      const userNumber = sender.split("@")[0];
      return reply(`@${userNumber} you are not an admin`, {
        mentions: [`${userNumber}@s.whatsapp.net`],
      });
    }

    try {
      await Prince.groupSettingUpdate(from, "announcement");
      const userNumber = sender.split("@")[0];
      return reply(`@${userNumber} Group successfully muted as you wished!`, {
        mentions: [`${userNumber}@s.whatsapp.net`],
      });
    } catch (error) {
      console.error("Mute error:", error);
      return reply(`❌ Failed to mute group: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "met",
    react: "⚡",
    category: "general",
    description: "Check group metadata",
  },
  async (from, Prince, conText) => {
    const { mek, react, sender, newsletterJid, botName } = conText;
    try {
      const gInfo = await Prince.groupMetadata(from);

      const formatJid = (jid) => {
        if (!jid) return "N/A";
        const cleanJid = `@${jid.split("@")[0]}`;
        return cleanJid;
      };

      const superAdmins = [];
      const admins = [];
      const members = [];

      gInfo.participants.forEach((p) => {
        const formattedJid = formatJid(p.phoneNumber || p.pn || p.jid);
        if (p.admin === "superadmin") {
          superAdmins.push(`• ${formattedJid} - 👑 Super Admin`);
        } else if (p.admin === "admin") {
          admins.push(`• ${formattedJid} - 👮 Admin`);
        } else {
          members.push(`• ${formattedJid} - 👤 Member`);
        }
      });

      const allParticipants = [...superAdmins, ...admins, ...members].join(
        "\n",
      );

      const allAdmins = [
        ...superAdmins.map((s) => s.replace(" - 👑 Super Admin", "")),
        ...admins.map((a) => a.replace(" - 👮 Admin", "")),
      ];

      const metadataText = `
📌 *GROUP METADATA* 📌

🔹 *ID:* ${gInfo.id}
🔹 *Subject:* ${gInfo.subject || "None"}
🔹 *Subject Owner:* ${formatJid(gInfo.subjectOwnerPn || gInfo.subjectOwnerJid)}
🔹 *Subject Changed:* ${new Date(gInfo.subjectTime * 1000).toLocaleString()}
🔹 *Owner:* ${formatJid(gInfo.ownerPn || gInfo.ownerJid)}
🔹 *Creation Date:* ${new Date(gInfo.creation * 1000).toLocaleString()}
🔹 *Size:* ${gInfo.size} participants
🔹 *Description:* ${gInfo.desc || "None"}
🔹 *Description Owner:* ${formatJid(gInfo.descOwnerPn || gInfo.descOwnerJid)}
🔹 *Description Changed:* ${new Date(gInfo.descTime * 1000).toLocaleString()}

👑 *ADMINS (${superAdmins.length + admins.length})*
${allAdmins.join("\n") || "No admins"}

👥 *PARTICIPANTS (${gInfo.participants.length})*
${allParticipants}

ℹ️ *GROUP SETTINGS*
• Restrict: ${gInfo.restrict ? "✅" : "❌"}
• Announce: ${gInfo.announce ? "✅" : "❌"}
• Join Approval: ${gInfo.joinApprovalMode ? "✅" : "❌"}
• Member Add: ${gInfo.memberAddMode ? "✅" : "❌"}
• Community: ${gInfo.isCommunity ? "✅" : "❌"}
    `.trim();

      await Prince.sendMessage(
        from,
        {
          text: metadataText,
          contextInfo: getContextInfo(sender, newsletterJid, botName),
        },
        { quoted: mek },
      );
      await react("✅");
    } catch (error) {
      console.error("Error in metadata command:", error);
      await react("❌");
      await Prince.sendMessage(
        from,
        { text: "Failed to fetch group metadata." },
        { quoted: mek },
      );
    }
  },
);

gmd(
  {
    pattern: "demote",
    react: "👑",
    category: "group",
    description: "Demote a user from being an admin.",
  },
  async (from, Prince, conText) => {
    const {
      reply,
      react,
      sender,
      quotedUser,
      superUser,
      isSuperAdmin,
      isAdmin,
      isGroup,
      isBotAdmin,
      q,
      mentionedJid,
      groupAdmins,
      groupMetadata,
    } = conText;

    if (!isGroup) return reply("❌ This command only works in groups!");
    if (!isBotAdmin) return reply("❌ Bot is not an admin in this group!");
    if (!isAdmin && !isSuperAdmin)
      return reply("❌ You must be an admin to use this command!");

    const meta = groupMetadata || await Prince.groupMetadata(from);
    const findParticipant = (jidOrNum) => {
      if (!jidOrNum || !meta?.participants) return null;
      const num = jidOrNum.split("@")[0];
      return meta.participants.find(p => {
        const pId = (p.id || "").split("@")[0];
        const pPn = (p.pn || "").split("@")[0];
        const pPhone = (p.phoneNumber || "").split("@")[0];
        return pId === num || pPn === num || pPhone === num;
      });
    };

    let inputJid = null;
    if (mentionedJid && mentionedJid.length > 0) {
      inputJid = mentionedJid[0];
    } else if (quotedUser) {
      inputJid = quotedUser;
    } else if (q) {
      const num = q.replace(/[^0-9]/g, "");
      if (num.length >= 10) inputJid = num + "@s.whatsapp.net";
    }

    if (!inputJid) {
      await react("❌");
      return reply("❌ Please mention, reply to, or provide a number.\nExample: .demote 254712345678");
    }

    let participant = findParticipant(inputJid);

    if (!participant && inputJid.includes("@lid")) {
      try {
        const resolved = await Prince.getJidFromLid(inputJid);
        if (resolved) participant = findParticipant(resolved);
      } catch (e) {}
    }

    if (!participant) {
      await react("❌");
      return reply("❌ User not found in this group. Try providing their number directly.\nExample: .demote 254712345678");
    }

    const targetId = participant.id;
    const targetNum = (participant.pn || participant.phoneNumber || participant.id || "").split("@")[0];
    const displayJid = targetNum + "@s.whatsapp.net";

    const ownerJid = (conText.ownerNumber || "").replace(/\D/g, '');
    const botJidNum = (Prince.user?.id || "").split(":")[0];
    const sudoNums = superUser.map(u => u.split("@")[0]);
    if (sudoNums.includes(targetNum) || targetNum === ownerJid || targetNum === botJidNum) {
      await react("❌");
      return reply("❌ I cannot demote a superuser!");
    }

    if (participant.admin === "superadmin") {
      return reply(`❌ @${targetNum} is the group owner and cannot be demoted.`, {
        mentions: [displayJid],
      });
    }

    if (!participant.admin) {
      return reply(`❌ @${targetNum} is not an admin.`, {
        mentions: [displayJid],
      });
    }

    try {
      await Prince.groupParticipantsUpdate(from, [targetId], "demote");
      await react("✅");
      await reply(`👑 @${targetNum} is no longer an admin.`, {
        mentions: [displayJid],
      });
    } catch (error) {
      await react("❌");
      await reply(`❌ Failed to demote: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "promote",
    aliases: ["toadmin"],
    react: "👑",
    category: "group",
    description: "Promote a user to admin.",
  },
  async (from, Prince, conText) => {
    const {
      reply,
      react,
      sender,
      quotedUser,
      isSuperAdmin,
      isAdmin,
      isGroup,
      isBotAdmin,
      q,
      mentionedJid,
      groupMetadata,
    } = conText;

    if (!isGroup) return reply("❌ This command only works in groups!");
    if (!isBotAdmin) return reply("❌ Bot is not an admin in this group!");
    if (!isAdmin && !isSuperAdmin)
      return reply("❌ You must be an admin to use this command!");

    const meta = groupMetadata || await Prince.groupMetadata(from);
    const findParticipant = (jidOrNum) => {
      if (!jidOrNum || !meta?.participants) return null;
      const num = jidOrNum.split("@")[0];
      return meta.participants.find(p => {
        const pId = (p.id || "").split("@")[0];
        const pPn = (p.pn || "").split("@")[0];
        const pPhone = (p.phoneNumber || "").split("@")[0];
        return pId === num || pPn === num || pPhone === num;
      });
    };

    let inputJid = null;
    if (mentionedJid && mentionedJid.length > 0) {
      inputJid = mentionedJid[0];
    } else if (quotedUser) {
      inputJid = quotedUser;
    } else if (q) {
      const num = q.replace(/[^0-9]/g, "");
      if (num.length >= 10) inputJid = num + "@s.whatsapp.net";
    }

    if (!inputJid) {
      await react("❌");
      return reply("❌ Please mention, reply to, or provide a number.\nExample: .promote 254712345678");
    }

    let participant = findParticipant(inputJid);

    if (!participant && inputJid.includes("@lid")) {
      try {
        const resolved = await Prince.getJidFromLid(inputJid);
        if (resolved) participant = findParticipant(resolved);
      } catch (e) {}
    }

    if (!participant) {
      await react("❌");
      return reply("❌ User not found in this group. Try providing their number directly.\nExample: .promote 254712345678");
    }

    const targetId = participant.id;
    const targetNum = (participant.pn || participant.phoneNumber || participant.id || "").split("@")[0];
    const displayJid = targetNum + "@s.whatsapp.net";

    if (participant.admin === "superadmin") {
      return reply(`❌ @${targetNum} is the group owner and is already an admin.`, {
        mentions: [displayJid],
      });
    }

    if (participant.admin === "admin") {
      return reply(`❌ @${targetNum} is already an admin.`, {
        mentions: [displayJid],
      });
    }

    try {
      await Prince.groupParticipantsUpdate(from, [targetId], "promote");
      await react("✅");
      await reply(`👑 @${targetNum} is now an admin.`, {
        mentions: [displayJid],
      });
    } catch (error) {
      await react("❌");
      await reply(`❌ Failed to promote: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "kick",
    aliases: ["remove"],
    react: "🚫",
    category: "group",
    description: "Remove a user from the group.",
  },
  async (from, Prince, conText) => {
    const {
      reply,
      react,
      sender,
      quotedUser,
      superUser,
      isSuperAdmin,
      isAdmin,
      isGroup,
      isBotAdmin,
      q,
      mentionedJid,
      groupMetadata,
    } = conText;

    if (!isGroup) return reply("❌ This command only works in groups!");
    if (!isBotAdmin) return reply("❌ Bot is not an admin in this group!");
    if (!isAdmin && !isSuperAdmin)
      return reply("❌ You must be an admin to use this command!");

    const meta = groupMetadata || await Prince.groupMetadata(from);
    const findParticipant = (jidOrNum) => {
      if (!jidOrNum || !meta?.participants) return null;
      const num = jidOrNum.split("@")[0];
      return meta.participants.find(p => {
        const pId = (p.id || "").split("@")[0];
        const pPn = (p.pn || "").split("@")[0];
        const pPhone = (p.phoneNumber || "").split("@")[0];
        return pId === num || pPn === num || pPhone === num;
      });
    };

    let inputJid = null;
    if (mentionedJid && mentionedJid.length > 0) {
      inputJid = mentionedJid[0];
    } else if (quotedUser) {
      inputJid = quotedUser;
    } else if (q) {
      const num = q.replace(/[^0-9]/g, "");
      if (num.length >= 10) inputJid = num + "@s.whatsapp.net";
    }

    if (!inputJid) {
      await react("❌");
      return reply("❌ Please mention, reply to, or provide a number.\nExample: .kick 254712345678");
    }

    let participant = findParticipant(inputJid);

    if (!participant && inputJid.includes("@lid")) {
      try {
        const resolved = await Prince.getJidFromLid(inputJid);
        if (resolved) participant = findParticipant(resolved);
      } catch (e) {}
    }

    if (!participant) {
      await react("❌");
      return reply("❌ User not found in this group. Try providing their number directly.\nExample: .kick 254712345678");
    }

    const targetId = participant.id;
    const targetNum = (participant.pn || participant.phoneNumber || participant.id || "").split("@")[0];
    const displayJid = targetNum + "@s.whatsapp.net";

    const sudoNums = superUser.map(u => u.split("@")[0]);
    if (sudoNums.includes(targetNum)) {
      await react("❌");
      return reply("❌ I cannot kick my creator!");
    }

    const botJidNum = (Prince.user?.id || "").split(":")[0];
    if (targetNum === botJidNum) {
      await react("❌");
      return reply("❌ I cannot kick myself!");
    }

    if (participant.admin === "superadmin") {
      await react("❌");
      return reply(`❌ @${targetNum} is the group owner and cannot be kicked.`, {
        mentions: [displayJid],
      });
    }

    try {
      await Prince.groupParticipantsUpdate(from, [targetId], "remove");
      await react("✅");
      await reply(`🚫 @${targetNum} has been removed from the group.`, {
        mentions: [displayJid],
      });
    } catch (error) {
      await react("❌");
      await reply(`❌ Failed to remove user: ${error.message}`);
    }
  },
);

// Status Mention Command with Interactive Menu
gmd(
  {
    pattern: "statusmention",
    aliases: ["antimention", "tagall-kick", "mention"],
    category: "group",
    desc: "Enable/disable anti-group mention and set action (on/off/warn/kick/delete)",
  },
  async (from, Prince, conText) => {
    const {
      reply,
      isAdmin,
      isSuperUser,
      args,
      groupMetadata,
      groupName,
      sender,
      newsletterJid,
      botName,
      botPic,
      getContextInfo,
    } = conText;

    if (!isAdmin && !isSuperUser) return reply("❌ Admin Only Command!");

    const status = (args[0] || "").toLowerCase();
    const gMeta = groupMetadata || (await Prince.groupMetadata(from));
    const memberCount = gMeta.participants.length;
    const gName = groupName || gMeta.subject;

    if (!status) {
      const currentSetting = getGroupSetting(from, "STATUS_MENTION", "false");
      const statusText =
        currentSetting === "false"
          ? "❌ Off"
          : `✅ ${currentSetting.toUpperCase()}`;

      const menuText = `*𝐏𝐑𝐈𝐍𝐂𝐄 𝐌𝐃𝐗 𝐒𝐓𝐀𝐓𝐔𝐒 𝐌𝐄𝐍𝐓𝐈𝐎𝐍 𝐒𝐄𝐓𝐓𝐈𝐍𝐆𝐒*

📍 Group: *${gName}*
📊 Current status: *${statusText}*

Reply With:

*1.* To Enable Status Mention => Warn  
*2.* To Enable Status Mention => Delete  
*3.* To Enable Status Mention => Remove/Kick  
*4.* To Disable Status Mention Feature  

_Or use directly:_
*.statusmention warn/delete/kick/off*

╭────────────────◆  
│ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴘɪɴᴄᴇ ᴛᴇᴄʜ  
╰─────────────────◆`;

      const sentMsg = await Prince.sendMessage(
        from,
        {
          image: { url: botPic },
          caption: menuText,
          contextInfo: getContextInfo(sender, newsletterJid, botName),
        },
        { quoted: conText.mek || conText.ms },
      );

      const handler = async (mek) => {
        try {
          const message = mek.messages[0];
          if (!message.message || message.key.fromMe) return;

          const chatId = message.key.remoteJid;
          if (chatId !== from) return;

          const isReplyToMenu =
            message.message?.extendedTextMessage?.contextInfo?.stanzaId === sentMsg.key.id;
          
          if (isReplyToMenu) {
            const messageContent = (
              message.message?.conversation ||
              message.message?.extendedTextMessage?.text ||
              ""
            ).trim();

            let action = "";
            let responseText = "";

            if (messageContent === "1") {
              action = "warn";
              responseText = `✅ *Anti-Group Mention* is now *ENABLED* with action: *WARN*\n👥 *Members:* ${memberCount}`;
            } else if (messageContent === "2") {
              action = "delete";
              responseText = `✅ *Anti-Group Mention* is now *ENABLED* with action: *DELETE*\n👥 *Members:* ${memberCount}`;
            } else if (messageContent === "3") {
              action = "kick";
              responseText = `✅ *Anti-Group Mention* is now *ENABLED* with action: *KICK*\n👥 *Members:* ${memberCount}`;
            } else if (messageContent === "4") {
              action = "false";
              responseText = `✅ *Anti-Group Mention* is now *DISABLED* in this group.\n👥 *Members:* ${memberCount}`;
            }

            if (action) {
              Prince.ev.off("messages.upsert", handler);
              setGroupSetting(from, "STATUS_MENTION", action);
              return reply(responseText);
            }
          }
        } catch (e) {
          console.error("Status mention menu error:", e);
        }
      };

      Prince.ev.on("messages.upsert", handler);
      setTimeout(() => Prince.ev.off("messages.upsert", handler), 60000);
      return;
    }

    if (status === "on" || status === "true" || status === "enable" || status === "warn" || status === "1") {
      setGroupSetting(from, "STATUS_MENTION", "warn");
      return reply(`✅ *Anti-Group Mention* is now *ENABLED* with action: *WARN*\n👥 *Members:* ${memberCount}`);
    } else if (status === "kick" || status === "3") {
      setGroupSetting(from, "STATUS_MENTION", "kick");
      return reply(`✅ *Anti-Group Mention* is now *ENABLED* with action: *KICK*\n👥 *Members:* ${memberCount}`);
    } else if (status === "delete" || status === "2") {
      setGroupSetting(from, "STATUS_MENTION", "delete");
      return reply(`✅ *Anti-Group Mention* is now *ENABLED* with action: *DELETE*\n👥 *Members:* ${memberCount}`);
    } else if (status === "off" || status === "false" || status === "disable" || status === "4") {
      setGroupSetting(from, "STATUS_MENTION", "false");
      return reply(`✅ *Anti-Group Mention* is now *DISABLED* in this group.\n👥 *Members:* ${memberCount}`);
    } else {
      return reply(`*Usage:* .statusmention on/off/warn/kick/delete`);
    }
  }
);

gmd(
  {
    pattern: "add",
    aliases: ["invite"],
    react: "➕",
    category: "group",
    description: "Add a user to the group.",
  },
  async (from, Prince, conText) => {
    const {
      reply,
      react,
      isSuperAdmin,
      isAdmin,
      isGroup,
      isBotAdmin,
      q,
      groupMetadata,
    } = conText;

    if (!isGroup) return reply("❌ This command only works in groups!");
    if (!isBotAdmin) return reply("❌ Bot is not an admin in this group!");
    if (!isAdmin && !isSuperAdmin)
      return reply("❌ You must be an admin to use this command!");

    if (!q) {
      await react("❌");
      return reply(
        "❌ Please provide the number to add.\nExample: .add 254712345678",
      );
    }

    const num = q.replace(/[^0-9]/g, "");
    if (num.length < 10) {
      await react("❌");
      return reply(
        "❌ Invalid number format. Please provide a valid phone number.",
      );
    }

    const targetJid = num + "@s.whatsapp.net";

    try {
      const [result] = await Prince.onWhatsApp(num);
      if (!result || !result.exists) {
        await react("❌");
        return reply(`❌ The number ${num} is not registered on WhatsApp.`);
      }
    } catch (err) {
      await react("⚠️");
      return reply(
        `⚠️ Could not verify if ${num} is on WhatsApp. Please try again.`,
      );
    }

    if (groupMetadata?.participants) {
      const alreadyInGroup = groupMetadata.participants.find((p) => {
        const pNum = (p.id || p.pn || p.phoneNumber || "").split("@")[0];
        return pNum === num;
      });
      if (alreadyInGroup) {
        await react("❌");
        return reply(`❌ @${num} is already in this group.`, {
          mentions: [targetJid],
          contextInfo: { mentionedJid: [targetJid] },
        });
      }
    }

    try {
      const result = await Prince.groupParticipantsUpdate(
        from,
        [targetJid],
        "add",
      );
      const status = result[0]?.status;

      if (status === "403") {
        const meta = await Prince.groupMetadata(from);
        const groupName = meta.subject;
        const inviteCode = await Prince.groupInviteCode(from);
        const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;

        await Prince.sendMessage(targetJid, {
          text: `👋 Hello! You've been invited to join *${groupName}*\n\n🔗 *Invite Link:* ${inviteLink}\n\n_Click the link above to join the group._`,
        });

        await react("⚠️");
        await reply(
          `⚠️ @${num} has privacy settings that prevent adding them directly. An invite link has been sent to their DM.`,
          {
            mentions: [targetJid],
            contextInfo: { mentionedJid: [targetJid] },
          },
        );
      } else if (status === "408") {
        await react("❌");
        await reply(
          `❌ @${num} has left this group recently and cannot be added yet.`,
          {
            mentions: [targetJid],
            contextInfo: { mentionedJid: [targetJid] },
          },
        );
      } else if (status === "409") {
        await react("❌");
        await reply(`❌ @${num} is already in this group.`, {
          mentions: [targetJid],
          contextInfo: { mentionedJid: [targetJid] },
        });
      } else {
        await react("✅");
        await reply(`✅ @${num} has been added to the group.`, {
          mentions: [targetJid],
          contextInfo: { mentionedJid: [targetJid] },
        });
      }
    } catch (error) {
      await react("❌");
      await reply(`❌ Failed to add user: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "link",
    aliases: ["gclink", "grouplink", "invitelink", "invite"],
    react: "🔗",
    category: "group",
    description: "Get the group invite link.",
  },
  async (from, Prince, conText) => {
    const {
      reply,
      react,
      isAdmin,
      isSuperAdmin,
      isGroup,
      isBotAdmin,
      mek,
      sender,
      botName,
      newsletterJid,
    } = conText;

    if (!isGroup) return reply("❌ This command only works in groups!");
    if (!isBotAdmin) return reply("❌ Bot is not an admin in this group!");
    if (!isAdmin && !isSuperAdmin)
      return reply("❌ You must be an admin to use this command!");

    try {
      const meta = await Prince.groupMetadata(from);
      const groupName = meta.subject;
      const participantCount = meta.participants.length;
      const adminCount = meta.participants.filter(
        (p) => p.admin === "admin" || p.admin === "superadmin",
      ).length;

      const inviteCode = await Prince.groupInviteCode(from);
      const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;

      const linkText =
        `*🔗 Group Invite Link*\n\n` +
        `*Group:* ${groupName}\n` +
        `*Participants:* ${participantCount}\n` +
        `*Admins:* ${adminCount}\n\n` +
        `*Link:* ${inviteLink}`;

      await Prince.sendMessage(
        from,
        {
          text: linkText,
          contextInfo: getContextInfo(sender, newsletterJid, botName),
        },
        { quoted: mek },
      );

      await react("✅");
    } catch (error) {
      await react("❌");
      await reply(`❌ Failed to get invite link: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "newgroup",
    aliases: ["newgc", "creategroup", "creategroup"],
    react: "🆕",
    category: "group",
    description: "Create a new group with the bot as admin.",
  },
  async (from, Prince, conText) => {
    const {
      reply,
      react,
      sender,
      isSuperUser,
      q,
      mek,
      botName,
      newsletterJid,
    } = conText;

    if (!isSuperUser) return reply("❌ Owner Only Command!");

    if (!q || !q.trim()) {
      await react("❌");
      return reply(
        "❌ Please provide a group name.\nExample: .newgroup ATASSA MD",
      );
    }

    const groupName = q.trim();

    try {
      const group = await Prince.groupCreate(groupName, [sender]);

      const inviteCode = await Prince.groupInviteCode(group.id);
      const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;

      const successText =
        `*🆕 Group Created Successfully!*\n\n` +
        `*Group Name:* ${groupName}\n` +
        `*Group ID:* ${group.id}\n\n` +
        `*Invite Link:* ${inviteLink}`;

      await Prince.sendMessage(
        from,
        {
          text: successText,
          contextInfo: getContextInfo(sender, newsletterJid, botName),
        },
        { quoted: mek },
      );

      await react("✅");
    } catch (error) {
      await react("❌");
      await reply(`❌ Failed to create group: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "killgc",
    aliases: ["terminategc", "destroygc", "nukegc"],
    react: "💀",
    category: "group",
    description: "Terminate group - removes all members and bot leaves.",
  },
  async (from, Prince, conText) => {
    const {
      reply,
      react,
      sender,
      isSuperUser,
      isGroup,
      isBotAdmin,
      isAdmin,
      isSuperAdmin,
      mek,
      botName,
      newsletterJid,
    } = conText;

    if (!isGroup) return reply("❌ This command only works in groups!");
    if (!isSuperUser) return reply("❌ Owner Only Command!");
    if (!isBotAdmin) return reply("❌ Bot is not an admin in this group!");
    if (!isAdmin && !isSuperAdmin)
      return reply("❌ You must be an admin to use this command!");

    try {
      await Prince.sendMessage(
        from,
        {
          text: `⚠️ *WARNING* ⚠️\n\n💀 *Group will be terminated now...*\n\n_All members will be removed._\n\n⚠️ _Using this command frequently might lead to WhatsApp bans._`,
          contextInfo: getContextInfo(sender, newsletterJid, botName),
        },
        { quoted: mek },
      );

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const meta = await Prince.groupMetadata(from);
      const participants = meta.participants;
      const botJid = Prince.user?.id?.split(":")[0] + "@s.whatsapp.net";

      const membersToRemove = participants
        .filter((p) => p.id !== botJid && p.id !== sender)
        .map((p) => p.id);

      if (membersToRemove.length > 0) {
        await Prince.groupParticipantsUpdate(from, membersToRemove, "remove");
      }

      await Prince.groupLeave(from);
    } catch (error) {
      await react("❌");
      await reply(`❌ Failed to terminate group: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "accept",
    aliases: ["approve"],
    react: "✅",
    category: "group",
    description: "Accept a pending join request. Usage: .accept 254712345678",
  },
  async (from, Prince, conText) => {
    const {
      reply,
      react,
      sender,
      isGroup,
      isBotAdmin,
      isAdmin,
      isSuperAdmin,
      args,
    } = conText;

    if (!isGroup) return reply("❌ This command only works in groups!");
    if (!isBotAdmin) return reply("❌ Bot is not an admin in this group!");
    if (!isAdmin && !isSuperAdmin)
      return reply("❌ You must be an admin to use this command!");

    if (!args[0])
      return reply(
        "❌ Please provide a phone number.\n\n*Usage:* .accept 254712345678",
      );

    try {
      const number = args[0].replace(/[^0-9]/g, "");
      const userJid = `${number}@s.whatsapp.net`;

      await Prince.groupRequestParticipantsUpdate(from, [userJid], "approve");

      await react("✅");
      return reply(`✅ Successfully approved @${number}'s join request!`, {
        mentions: [userJid],
      });
    } catch (error) {
      await react("❌");
      if (
        error.message?.includes("not-found") ||
        error.message?.includes("item-not-found")
      ) {
        return reply("❌ No pending join request found for this number.");
      }
      return reply(`❌ Failed to accept request: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "reject",
    aliases: ["decline"],
    react: "❌",
    category: "group",
    description: "Reject a pending join request. Usage: .reject 254712345678",
  },
  async (from, Prince, conText) => {
    const {
      reply,
      react,
      sender,
      isGroup,
      isBotAdmin,
      isAdmin,
      isSuperAdmin,
      args,
    } = conText;

    if (!isGroup) return reply("❌ This command only works in groups!");
    if (!isBotAdmin) return reply("❌ Bot is not an admin in this group!");
    if (!isAdmin && !isSuperAdmin)
      return reply("❌ You must be an admin to use this command!");

    if (!args[0])
      return reply(
        "❌ Please provide a phone number.\n\n*Usage:* .reject 254712345678",
      );

    try {
      const number = args[0].replace(/[^0-9]/g, "");
      const userJid = `${number}@s.whatsapp.net`;

      await Prince.groupRequestParticipantsUpdate(from, [userJid], "reject");

      await react("✅");
      return reply(`✅ Successfully rejected @${number}'s join request!`, {
        mentions: [userJid],
      });
    } catch (error) {
      await react("❌");
      if (
        error.message?.includes("not-found") ||
        error.message?.includes("item-not-found")
      ) {
        return reply("❌ No pending join request found for this number.");
      }
      return reply(`❌ Failed to reject request: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "acceptall",
    aliases: ["approveall"],
    react: "✅",
    category: "group",
    description: "Accept all pending join requests in the group.",
  },
  async (from, Prince, conText) => {
    const { reply, react, sender, isGroup, isBotAdmin, isAdmin, isSuperAdmin } =
      conText;

    if (!isGroup) return reply("❌ This command only works in groups!");
    if (!isBotAdmin) return reply("❌ Bot is not an admin in this group!");
    if (!isAdmin && !isSuperAdmin)
      return reply("❌ You must be an admin to use this command!");

    try {
      const pendingRequests = await Prince.groupRequestParticipantsList(from);

      if (!pendingRequests || pendingRequests.length === 0) {
        return reply("📭 No pending join requests in this group.");
      }

      const jids = pendingRequests.map((r) => r.jid);
      await Prince.groupRequestParticipantsUpdate(from, jids, "approve");

      await react("✅");
      return reply(
        `✅ Successfully approved *${jids.length}* pending join request(s)!`,
      );
    } catch (error) {
      await react("❌");
      return reply(`❌ Failed to accept all requests: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "rejectall",
    aliases: ["declineall"],
    react: "❌",
    category: "group",
    description: "Reject all pending join requests in the group.",
  },
  async (from, Prince, conText) => {
    const { reply, react, sender, isGroup, isBotAdmin, isAdmin, isSuperAdmin } =
      conText;

    if (!isGroup) return reply("❌ This command only works in groups!");
    if (!isBotAdmin) return reply("❌ Bot is not an admin in this group!");
    if (!isAdmin && !isSuperAdmin)
      return reply("❌ You must be an admin to use this command!");

    try {
      const pendingRequests = await Prince.groupRequestParticipantsList(from);

      if (!pendingRequests || pendingRequests.length === 0) {
        return reply("📭 No pending join requests in this group.");
      }

      const jids = pendingRequests.map((r) => r.jid);
      await Prince.groupRequestParticipantsUpdate(from, jids, "reject");

      await react("✅");
      return reply(
        `✅ Successfully rejected *${jids.length}* pending join request(s)!`,
      );
    } catch (error) {
      await react("❌");
      return reply(`❌ Failed to reject all requests: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "online",
    aliases: ["listonline", "whos online", "whosonline"],
    react: "🟢",
    category: "group",
    description: "List members who are currently online in the group.",
  },
  async (from, Prince, conText) => {
    const { reply, react, sender, isGroup, mek, botName, newsletterJid } =
      conText;

    if (!isGroup) return reply("❌ This command only works in groups!");

    try {
      await reply("🔍 Checking online members... Please wait...");

      const groupMeta = await Prince.groupMetadata(from);
      const participants = groupMeta.participants;

      const onlineMembers = [];
      const presenceData = new Map();

      const presenceHandler = (update) => {
        const chatJid = update.id;
        if (update.presences) {
          for (const [jid, presence] of Object.entries(update.presences)) {
            presenceData.set(jid, presence);
            const numOnly = jid.split("@")[0];
            presenceData.set(numOnly, presence);
          }
        }
      };

      Prince.ev.on("presence.update", presenceHandler);

      try {
        const batchSize = 5;
        for (let i = 0; i < participants.length; i += batchSize) {
          const batch = participants.slice(i, i + batchSize);
          await Promise.all(
            batch.map(async (p) => {
              const jid = p.id || p.jid;
              try {
                await Prince.presenceSubscribe(jid);
              } catch (e) {}
            }),
          );
          await new Promise((r) => setTimeout(r, 500));
        }

        await new Promise((r) => setTimeout(r, 2000));

        for (const p of participants) {
          const participantId = p.id || p.jid;
          const numOnly = participantId.split("@")[0];

          let presence =
            presenceData.get(participantId) || presenceData.get(numOnly);

          if (!presence && p.pn) {
            presence =
              presenceData.get(p.pn) || presenceData.get(p.pn.split("@")[0]);
          }

          if (
            presence?.lastKnownPresence === "composing" ||
            presence?.lastKnownPresence === "recording"
          ) {
            let displayJid = participantId;
            if (participantId.endsWith("@lid")) {
              if (p.pn) {
                displayJid = p.pn;
              }
            }
            const number = displayJid.split("@")[0];
            const name = p.notify || p.name || number;
            onlineMembers.push({ jid: displayJid, name, number });
          }
        }
      } finally {
        Prince.ev.off("presence.update", presenceHandler);
      }

      if (onlineMembers.length === 0) {
        await react("😴");
        return reply(
          "😴 No members are currently typing or recording.\n\n_Note: This only detects active typing/recording presence._",
        );
      }

      const mentions = onlineMembers.map((m) => m.jid);
      const memberList = onlineMembers
        .map((m, i) => `${i + 1}. @${m.name}`)
        .join("\n");

      const message =
        `🟢 *ACTIVE MEMBERS (Typing/Recording)*\n\n` +
        `📊 *${onlineMembers.length}* of *${participants.length}* members active\n\n` +
        `${memberList}\n\n` +
        `_Note: Only shows members currently typing or recording._`;

      await react("✅");
      await Prince.sendMessage(
        from,
        {
          text: message,
          mentions: mentions,
          contextInfo: getContextInfo(sender, newsletterJid, botName),
        },
        { quoted: mek },
      );
    } catch (error) {
      await react("❌");
      return reply(`❌ Failed to check online members: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "resetlink",
    aliases: [
      "resetgclink",
      "revoke",
      "resetgrouplink",
      "revokelink",
      "newlink",
    ],
    react: "🔄",
    category: "group",
    description: "Reset the group invite link and get a new one.",
  },
  async (from, Prince, conText) => {
    const {
      reply,
      react,
      isGroup,
      isBotAdmin,
      isAdmin,
      isSuperAdmin,
      mek,
      sender,
      botName,
      newsletterJid,
    } = conText;

    if (!isGroup) return reply("❌ This command only works in groups!");
    if (!isBotAdmin) return reply("❌ Bot is not an admin in this group!");
    if (!isAdmin && !isSuperAdmin)
      return reply("❌ You must be an admin to use this command!");

    try {
      await Prince.groupRevokeInvite(from);

      const newInviteCode = await Prince.groupInviteCode(from);
      const newLink = `https://chat.whatsapp.com/${newInviteCode}`;

      const groupMeta = await Prince.groupMetadata(from);
      const groupName = groupMeta.subject;
      const totalMembers = groupMeta.participants.length;
      const totalAdmins = groupMeta.participants.filter(
        (p) => p.admin === "admin" || p.admin === "superadmin",
      ).length;

      const message =
        `🔄 *GROUP LINK RESET*\n\n` +
        `📛 *Group:* ${groupName}\n` +
        `👥 *Total Members:* ${totalMembers}\n` +
        `👑 *Total Admins:* ${totalAdmins}\n\n` +
        `🔗 *New Link:*\n${newLink}\n\n` +
        `_The old invite link has been revoked._`;

      await react("✅");
      await Prince.sendMessage(
        from,
        {
          text: message,
          contextInfo: getContextInfo(sender, newsletterJid, botName),
        },
        { quoted: mek },
      );
    } catch (error) {
      await react("❌");
      return reply(`❌ Failed to reset group link: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "left",
    aliases: ["leave", "exitgroup", "exitgc"],
    react: "👋",
    category: "group",
    description: "Bot leaves the group. Owner only.",
  },
  async (from, Prince, conText) => {
    const {
      reply,
      react,
      sender,
      isGroup,
      isSuperUser,
      mek,
      botName,
      newsletterJid,
    } = conText;

    if (!isGroup) return reply("❌ This command only works in groups!");
    if (!isSuperUser) return reply("❌ Owner Only Command!");

    try {
      await Prince.sendMessage(
        from,
        {
          text: `👋 *Goodbye!*\n\n_${botName} is leaving this group..._`,
          contextInfo: getContextInfo(sender, newsletterJid, botName),
        },
        { quoted: mek },
      );

      await new Promise((r) => setTimeout(r, 1000));
      await Prince.groupLeave(from);
    } catch (error) {
      await react("❌");
      return reply(`❌ Failed to leave group: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "listrequests",
    aliases: ["joinrequests", "listjoinrequests", "pendingrequests"],
    react: "📋",
    category: "group",
    description: "List all pending join requests in the group.",
  },
  async (from, Prince, conText) => {
    const {
      reply,
      react,
      sender,
      isGroup,
      isBotAdmin,
      isAdmin,
      isSuperAdmin,
      mek,
      botName,
      newsletterJid,
    } = conText;

    if (!isGroup) return reply("❌ This command only works in groups!");
    if (!isBotAdmin) return reply("❌ Bot is not an admin in this group!");
    if (!isAdmin && !isSuperAdmin)
      return reply("❌ You must be an admin to use this command!");

    try {
      const pendingRequests = await Prince.groupRequestParticipantsList(from);

      if (!pendingRequests || pendingRequests.length === 0) {
        await react("📭");
        return reply("📭 No pending join requests in this group.");
      }

      const resolvedJids = await Promise.all(
        pendingRequests.map(async (r) => {
          let jid = r.jid;
          if (jid.endsWith("@lid")) {
            if (Prince.getJidFromLid) {
              try {
                const resolved = await Prince.getJidFromLid(jid);
                if (resolved) jid = resolved;
              } catch {}
            }
          }
          return jid;
        }),
      );

      const requestList = resolvedJids
        .map((jid, i) => {
          const number = jid.split("@")[0];
          return `${i + 1}. @${number}`;
        })
        .join("\n");

      const mentions = resolvedJids;

      const message =
        `📋 *PENDING JOIN REQUESTS*\n\n` +
        `📊 Total: *${pendingRequests.length}* request(s)\n\n` +
        `${requestList}\n\n` +
        `_Use .accept <number> or .acceptall to approve_\n` +
        `_Use .reject <number> or .rejectall to decline_`;

      await react("✅");
      await Prince.sendMessage(
        from,
        {
          text: message,
          mentions: mentions,
          contextInfo: getContextInfo(sender, newsletterJid, botName),
        },
        { quoted: mek },
      );
    } catch (error) {
      await react("❌");
      return reply(`❌ Failed to list requests: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "togroupstatus",
    aliases: ["groupstatus", "statusgroup", "togcstatus"],
    react: "📢",
    category: "group",
    description: "Send text or quoted media to group status. Superuser only.",
  },
  async (from, Prince, conText) => {
    const { reply, react, isSuperUser, isGroup, q, quoted, quotedMsg, mek } = conText;
    const { downloadMediaMessage } = require("prince-baileys");
    const fs = require("fs");
    const path = require("path");

    if (!isGroup) return reply("❌ Group only command!");
    if (!isSuperUser) return reply("❌ Owner Only Command!");

    if (!q && !quotedMsg) {
      return reply(
        "📌 *Usage:*\n" +
          "• .togroupstatus <text>\n" +
          "• Reply to image/video/audio with .togroupstatus <caption>\n" +
          "• Or just .togroupstatus to forward quoted media",
      );
    }

    let tempFilePath = null;

    try {
      let payload = { groupStatusMessage: {} };

      if (quotedMsg) {
        const tempDir = "mayel/temp";
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        if (quoted?.imageMessage) {
          const caption = q || quoted.imageMessage.caption || "";
          const buffer = await downloadMediaMessage(
            { message: quotedMsg },
            "buffer",
            {},
          );
          tempFilePath = path.join(tempDir, `status_${Date.now()}.jpg`);
          fs.writeFileSync(tempFilePath, buffer);
          payload.groupStatusMessage.image = { url: tempFilePath };
          if (caption) payload.groupStatusMessage.caption = caption;
        } else if (quoted?.videoMessage) {
          const caption = q || quoted.videoMessage.caption || "";
          const buffer = await downloadMediaMessage(
            { message: quotedMsg },
            "buffer",
            {},
          );
          tempFilePath = path.join(tempDir, `status_${Date.now()}.mp4`);
          fs.writeFileSync(tempFilePath, buffer);
          payload.groupStatusMessage.video = { url: tempFilePath };
          if (caption) payload.groupStatusMessage.caption = caption;
        } else if (quoted?.audioMessage) {
          const buffer = await downloadMediaMessage(
            { message: quotedMsg },
            "buffer",
            {},
          );
          tempFilePath = path.join(tempDir, `status_${Date.now()}.mp3`);
          fs.writeFileSync(tempFilePath, buffer);
          payload.groupStatusMessage.audio = { url: tempFilePath };
        } else if (quoted?.documentMessage) {
          const buffer = await downloadMediaMessage(
            { message: quotedMsg },
            "buffer",
            {},
          );
          const ext =
            quoted.documentMessage.fileName?.split(".").pop() || "bin";
          tempFilePath = path.join(tempDir, `status_${Date.now()}.${ext}`);
          fs.writeFileSync(tempFilePath, buffer);
          payload.groupStatusMessage.document = { url: tempFilePath };
        } else if (quoted?.stickerMessage) {
          const buffer = await downloadMediaMessage(
            { message: quotedMsg },
            "buffer",
            {},
          );
          tempFilePath = path.join(tempDir, `status_${Date.now()}.webp`);
          fs.writeFileSync(tempFilePath, buffer);
          payload.groupStatusMessage.sticker = { url: tempFilePath };
        } else if (quoted?.conversation || quoted?.extendedTextMessage?.text) {
          payload.groupStatusMessage.text =
            quoted.conversation || quoted.extendedTextMessage.text;
        } else {
          return reply("❌ Unsupported media type for group status.");
        }

        if (
          q &&
          !payload.groupStatusMessage.caption &&
          !payload.groupStatusMessage.text
        ) {
          payload.groupStatusMessage.caption = q;
        }
      } else {
        payload.groupStatusMessage.text = q;
      }

      await Prince.sendMessage(from, payload, { quoted: mek });
      await react("✅");
    } catch (error) {
      console.error("togroupstatus error:", error);
      await react("❌");
      return reply(`❌ Error sending group status: ${error.message}`);
    } finally {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (e) {}
      }
    }
  },
);

gmd(
  {
    pattern: "groupname",
    aliases: [
      "gcname",
      "setgcname",
      "setgroupname",
      "gcsubject",
      "setgcsubject",
    ],
    react: "✏️",
    category: "group",
    description: "Change group name/subject. Usage: .groupname New Group Name",
  },
  async (from, Prince, conText) => {
    const {
      reply,
      react,
      sender,
      isGroup,
      isBotAdmin,
      isAdmin,
      isSuperAdmin,
      q,
    } = conText;

    if (!isGroup) return reply("❌ This command only works in groups!");
    if (!isBotAdmin) return reply("❌ Bot is not an admin in this group!");
    if (!isAdmin && !isSuperAdmin)
      return reply("❌ You must be an admin to use this command!");

    if (!q)
      return reply(
        "❌ Please provide a new group name.\n\n*Usage:* .groupname New Group Name",
      );

    try {
      await Prince.groupUpdateSubject(from, q);
      await react("✅");
      return reply(`✅ Group name changed to: *${q}*`);
    } catch (error) {
      await react("❌");
      return reply(`❌ Failed to change group name: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "gcdesc",
    aliases: [
      "groupdesc",
      "setgcdesc",
      "setgroupdesc",
      "description",
      "setdescription",
    ],
    react: "📝",
    category: "group",
    description: "Change group description. Usage: .gcdesc New Description",
  },
  async (from, Prince, conText) => {
    const {
      reply,
      react,
      sender,
      isGroup,
      isBotAdmin,
      isAdmin,
      isSuperAdmin,
      q,
    } = conText;

    if (!isGroup) return reply("❌ This command only works in groups!");
    if (!isBotAdmin) return reply("❌ Bot is not an admin in this group!");
    if (!isAdmin && !isSuperAdmin)
      return reply("❌ You must be an admin to use this command!");

    if (!q)
      return reply(
        "❌ Please provide a new group description.\n\n*Usage:* .gcdesc New Description Here",
      );

    try {
      await Prince.groupUpdateDescription(from, q);
      await react("✅");
      return reply(`✅ Group description updated successfully!`);
    } catch (error) {
      await react("❌");
      return reply(`❌ Failed to change group description: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "everyone",
    react: "📢",
    aliases: ["everyone", "tag", "tagall1"],
    category: "group",
    description: "Tag everyone in the group with custom message",
  },
  async (from, Prince, conText) => {
    const {
      reply,
      isAdmin,
      isSuperAdmin,
      isGroup,
      mek,
      q,
      participants,
      sender,
      botName,
      newsletterJid,
    } = conText;

    if (!isGroup) {
      return reply("❌ This command can only be used in groups!");
    }

    if (!isAdmin && !isSuperAdmin) {
      const userNumber = sender.split("@")[0];
      return reply(`@${userNumber} Only group admins can use this command!`, {
        mentions: [`${userNumber}@s.whatsapp.net`],
      });
    }

    const subject = q || "everyone";
    const mentionedJids = participants
      .map((p) => {
        const jid =
          typeof p === "string"
            ? p
            : p.id || p.jid || p.pn || p.phoneNumber || "";
        if (!jid) return null;
        return jid.includes("@") ? jid : `${jid}@s.whatsapp.net`;
      })
      .filter(Boolean);

    try {
      await Prince.sendMessage(
        from,
        {
          text: `@${from}`,
          contextInfo: {
            mentionedJid: mentionedJids,
            groupMentions: [
              {
                groupJid: from,
                groupSubject: subject,
              },
            ],
            ...getContextInfo(sender, newsletterJid, botName),
          },
        },
        { quoted: mek },
      );
    } catch (error) {
      console.error("Tag custom error:", error);
      return reply(`❌ Failed to tag custom: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "hidetag",
    react: "📢",
    aliases: ["htag", "hidden", "hidtag"],
    category: "group",
    description: "Send a message that secretly tags everyone",
  },
  async (from, Prince, conText) => {
    const {
      reply,
      isAdmin,
      isSuperAdmin,
      isGroup,
      mek,
      q,
      participants,
      sender,
      quotedMsg,
      botName,
      newsletterJid,
    } = conText;

    if (!isGroup) {
      return reply("❌ This command can only be used in groups!");
    }

    if (!isAdmin && !isSuperAdmin) {
      const userNumber = sender.split("@")[0];
      return reply(`@${userNumber} Only group admins can use this command!`, {
        mentions: [`${userNumber}@s.whatsapp.net`],
      });
    }

    let text = q;
    if (!text && quotedMsg) {
      text =
        quotedMsg.conversation ||
        quotedMsg.extendedTextMessage?.text ||
        quotedMsg.imageMessage?.caption ||
        quotedMsg.videoMessage?.caption ||
        "";
    }

    if (!text) {
      return reply(
        "❌ Please provide a message or reply to one.\n\n*Usage:* .hidetag Your message here",
      );
    }

    const mentionedJids = participants
      .map((p) => {
        const jid =
          typeof p === "string"
            ? p
            : p.id || p.jid || p.pn || p.phoneNumber || "";
        if (!jid) return null;
        return jid.includes("@") ? jid : `${jid}@s.whatsapp.net`;
      })
      .filter(Boolean);

    try {
      await Prince.sendMessage(
        from,
        {
          text: text,
          contextInfo: {
            mentionedJid: mentionedJids,
            ...getContextInfo(sender, newsletterJid, botName),
          },
        },
        { quoted: mek },
      );
    } catch (error) {
      console.error("Hidetag error:", error);
      return reply(`❌ Failed to send hidden tag: ${error.message}`);
    }
  },
);

// Duplicate antigroupmention command removed in favor of .statusmention
/*
gmd(
  {
    pattern: "antigroupmention",
...
*/

// Duplicate setantigcmentionwarnlimit removed
/*
gmd(
  {
    pattern: "setantigcmentionwarnlimit",
...
*/

gmd(
  {
    pattern: "tagall",
    react: "📢",
    aliases: ["all", "mentionall"],
    category: "group",
    description: "Tag all group members with optional message",
  },
  async (from, Prince, conText) => {
    const { reply, react, isAdmin, isSuperAdmin, isGroup, isSuperUser, mek, sender, q, botName } = conText;

    if (!isGroup) {
      return reply("❌ This command only works in groups!");
    }

    if (!isAdmin && !isSuperAdmin && !isSuperUser) {
      return reply("❌ Admin/Owner Only Command!");
    }

    try {
      const meta = await Prince.groupMetadata(from);
      const participants = meta.participants;

      const superAdmins = [];
      const admins = [];
      const members = [];

      for (let p of participants) {
        if (p.admin === "superadmin") {
          superAdmins.push(p.id);
        } else if (p.admin === "admin") {
          admins.push(p.id);
        } else {
          members.push(p.id);
        }
      }

      const sortedParticipants = [...superAdmins, ...admins, ...members];
      let mentions = sortedParticipants;

      let text = `*${botName} TAGALL*\n\n`;
      
      if (q && q.trim()) {
        text += `*Message:* ${q.trim()}\n\n`;
      }
      
      text += `*Tagged By:* @${sender.split('@')[0]}\n\n`;
      text += `*Tagged Members:*\n`;

      for (let id of superAdmins) {
        text += `👑 @${id.split('@')[0]}\n`;
      }
      for (let id of admins) {
        text += `👮 @${id.split('@')[0]}\n`;
      }
      for (let id of members) {
        text += `👤 @${id.split('@')[0]}\n`;
      }

      mentions.push(sender);

      await Prince.sendMessage(from, {
        text: text.trim(),
        mentions
      }, { quoted: mek });

      await react("✅");
    } catch (error) {
      console.error("Tagall error:", error);
      return reply(`❌ Failed to tag all: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "tagadmins",
    react: "👮",
    aliases: ["taggcadmins", "taggroupadmins"],
    category: "group",
    description: "Tag all group admins with optional message",
  },
  async (from, Prince, conText) => {
    const { reply, react, isAdmin, isSuperAdmin, isGroup, isSuperUser, mek, sender, q, botName } = conText;

    if (!isGroup) {
      return reply("❌ This command only works in groups!");
    }

    if (!isAdmin && !isSuperAdmin && !isSuperUser) {
      return reply("❌ Admin/Owner Only Command!");
    }

    try {
      const meta = await Prince.groupMetadata(from);
      const participants = meta.participants;

      const superAdmins = [];
      const admins = [];

      for (let p of participants) {
        if (p.admin === "superadmin") {
          superAdmins.push(p.id);
        } else if (p.admin === "admin") {
          admins.push(p.id);
        }
      }

      const allAdmins = [...superAdmins, ...admins];
      
      if (allAdmins.length === 0) {
        return reply("❌ No admins found in this group!");
      }

      let mentions = [...allAdmins, sender];

      let text = `*${botName} TAG ADMINS*\n\n`;
      
      if (q && q.trim()) {
        text += `*Message:* ${q.trim()}\n\n`;
      }
      
      text += `*Tagged By:* @${sender.split('@')[0]}\n\n`;
      text += `*Tagged Admins:*\n`;

      for (let id of superAdmins) {
        text += `👑 @${id.split('@')[0]}\n`;
      }
      for (let id of admins) {
        text += `👮 @${id.split('@')[0]}\n`;
      }

      await Prince.sendMessage(from, {
        text: text.trim(),
        mentions
      }, { quoted: mek });

      await react("✅");
    } catch (error) {
      console.error("Tagadmins error:", error);
      return reply(`❌ Failed to tag admins: ${error.message}`);
    }
  },
);

gmd(
  {
    pattern: "antipromote",
    react: "🛡️",
    category: "group",
    description: "Toggle anti-promote protection. Demotes both promoter and promoted user.",
  },
  async (from, Prince, conText) => {
    const { reply, react, isGroup, isBotAdmin, isAdmin, isSuperAdmin, args } = conText;

    if (!isGroup) return reply("❌ This command only works in groups!");
    if (!isBotAdmin) return reply("❌ Bot is not an admin in this group!");
    if (!isAdmin && !isSuperAdmin) return reply("❌ You must be an admin to use this command!");

    const action = args[0]?.toLowerCase();
    const rawCurrent = await getGroupSetting(from, "ANTIPROMOTE");
    const current = rawCurrent === "true" ? "true" : "false";
    
    if (!action || !["on", "off"].includes(action)) {
      return reply(`🛡️ *Anti-Promote Protection*\n\nCurrent: ${current === "true" ? "ON ✅" : "OFF ❌"}\n\n*Usage:*\n.antipromote on - Enable\n.antipromote off - Disable\n\n_When enabled, if someone promotes another user, both will be demoted._`);
    }

    const value = action === "on" ? "true" : "false";
    if (current === value) {
      return reply(`⚠️ Anti-Promote is already ${action === "on" ? "ON" : "OFF"}!`);
    }
    
    await setGroupSetting(from, "ANTIPROMOTE", value);
    await react("✅");
    return reply(`✅ Anti-Promote is now ${action === "on" ? "ON" : "OFF"} for this group.`);
  },
);

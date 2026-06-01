const { gmd, getContextInfo, setTempEmail, getTempEmail, deleteTempEmail, TEMPMAIL_EXPIRY_MINUTES } = require("../mayel");
const axios = require("axios");

function getUserName(jid) {
    return jid.split("@")[0];
}

function normalizeUserJid(jid) {
    if (!jid) return "";
    let normalized = jid.split(":")[0].split("/")[0];
    if (!normalized.includes("@")) {
        normalized += "@s.whatsapp.net";
    }
    return normalized;
}

function extractCode(text) {
    const codePatterns = [
        /\b(\d{4,8})\b/,
        /code[:\s]+(\d{4,8})/i,
        /verification[:\s]+(\d{4,8})/i,
        /otp[:\s]+(\d{4,8})/i,
        /pin[:\s]+(\d{4,8})/i,
    ];
    for (const pattern of codePatterns) {
        const match = text.match(pattern);
        if (match) return match[1];
    }
    return null;
}

gmd(
    {
        pattern: "tempmail",
        aliases: ["tempmailgen", "generatemail", "newmail", "getmail"],
        react: "📧",
        category: "tempmail",
        description: "Generate a new temporary email address",
    },
    async (from, Prince, conText) => {
        const { sender, mek, reply, react, botFooter, botName, PrinceTechApi, PrinceApiKey } = conText;

        const userJid = normalizeUserJid(sender);
        const existingData = getTempEmail(userJid);

        if (existingData) {
            await react("⚠️");
            await Prince.sendMessage(
                from,
                {
                    text: `⚠️ *ACTIVE EMAIL EXISTS*

Hey @${getUserName(sender)}, you already have an active temp email:

📬 *Email:* ${existingData.email}
⏰ *Expires in:* ${existingData.timeRemaining}

Use *.delmail* first to delete it, then generate a new one.

📥 Use *.tempinbox* to check messages
📖 Use *.readmail <number>* to read emails`,
                    contextInfo: getContextInfo(sender),
                },
                { quoted: mek },
            );
            return;
        }

        await react("⏳");

        try {
            const res = await axios.get(
                `${PrinceTechApi}/api/tempmail/generate`,
                {
                    params: { apikey: PrinceApiKey },
                    timeout: 30000,
                },
            );

            if (!res.data?.success || !res.data?.result?.email) {
                await react("❌");
                return reply("Failed to generate temp email. Try again later.");
            }

            const email = res.data.result.email;
            setTempEmail(userJid, email);

            await Prince.sendMessage(
                from,
                {
                    text: `📧 *TEMP MAIL GENERATED*

Hey @${getUserName(sender)}, your temporary email:

📬 *Email:* ${email}

⏰ *Expires in:* ${TEMPMAIL_EXPIRY_MINUTES} minutes
📥 Use *.tempinbox* to check messages
📖 Use *.readmail <number>* to read specific email
🗑️ Use *.delmail* to delete and create new

_Copy the email above and use it for verification_`,
                    contextInfo: getContextInfo(sender),
                },
                { quoted: mek },
            );

            await react("✅");
        } catch (e) {
            console.error("Tempmail generate error:", e);
            await react("❌");
            return reply("Failed to generate temp email: " + e.message);
        }
    },
);

gmd(
    {
        pattern: "tempinbox",
        aliases: ["checkinbox", "inbox", "myinbox", "checktempmail"],
        react: "📥",
        category: "tempmail",
        description: "Check inbox of your generated temp email",
    },
    async (from, Prince, conText) => {
        const { sender, mek, reply, react, botFooter, botName, PrinceTechApi, PrinceApiKey } = conText;

        const userJid = normalizeUserJid(sender);
        const emailData = getTempEmail(userJid);

        if (!emailData) {
            await react("❌");
            return reply(
                `❌ Hey @${getUserName(sender)}, you don't have an active temp email.\n\nUse *.tempmail* to generate one first.`,
            );
        }

        const email = emailData.email;
        await react("⏳");

        try {
            const res = await axios.get(`${PrinceTechApi}/api/tempmail/inbox`, {
                params: { apikey: PrinceApiKey, email: email },
                timeout: 30000,
            });

            if (!res.data?.success) {
                if (res.data?.message?.includes("No Emails")) {
                    await react("📭");
                    await Prince.sendMessage(
                        from,
                        {
                            text: `📭 *EMPTY INBOX*

Hey @${getUserName(sender)}, no emails received yet.

📬 *Your Email:* ${email}
⏰ *Expires in:* ${emailData.timeRemaining}

_Wait a few seconds after sending an email and try again._`,
                            contextInfo: getContextInfo(sender),
                        },
                        { quoted: mek },
                    );
                    return;
                }
                await react("❌");
                return reply(
                    "Failed to fetch inbox. Your email may have expired. Generate a new one with *.tempmail*",
                );
            }

            const emails = res.data.result;
            if (!emails || emails.length === 0) {
                await react("📭");
                await Prince.sendMessage(
                    from,
                    {
                        text: `📭 *EMPTY INBOX*

Hey @${getUserName(sender)}, no emails received yet.

📬 *Your Email:* ${email}
⏰ *Expires in:* ${emailData.timeRemaining}

_Wait a few seconds after sending an email or try again._`,
                        contextInfo: getContextInfo(sender),
                    },
                    { quoted: mek },
                );
                return;
            }

            let inboxText = `📥 *TEMP MAIL INBOX*

Hey @${getUserName(sender)}, you have *${emails.length}* email(s)

📬 *Email:* ${email}
⏰ *Expires in:* ${emailData.timeRemaining}

`;

            emails.forEach((mail, index) => {
                const num = index + 1;
                const from_addr = mail.from || mail.sender || "Unknown";
                const subject = mail.subject || "No Subject";
                const date = mail.date || mail.received || "";

                inboxText += `━━━━━━━━━━━━━━━━━━
📩 *#${num}*
👤 *From:* ${from_addr}
📋 *Subject:* ${subject}
📅 *Date:* ${date}
`;
            });

            inboxText += `━━━━━━━━━━━━━━━━━━

📖 Use *.readmail <number>* to read full email`;

            await Prince.sendMessage(
                from,
                {
                    text: inboxText,
                    contextInfo: getContextInfo(sender),
                },
                { quoted: mek },
            );

            await react("✅");
        } catch (e) {
            console.error("Tempmail inbox error:", e);
            await react("❌");
            if (e.message?.includes("expired") || e.response?.status === 404) {
                return reply(
                    "Your temp email has expired. Generate a new one with *.tempmail*",
                );
            }
            return reply("Failed to check inbox: " + e.message);
        }
    },
);

gmd(
    {
        pattern: "readmail",
        aliases: ["getmsg", "viewmail", "openmail"],
        react: "📖",
        category: "tempmail",
        description: "Read a specific email by number",
    },
    async (from, Prince, conText) => {
        const { sender, mek, reply, react, q, botFooter, botName, PrinceTechApi, PrinceApiKey } = conText;

        const userJid = normalizeUserJid(sender);
        const emailData = getTempEmail(userJid);

        if (!emailData) {
            await react("❌");
            return reply(
                `❌ Hey @${getUserName(sender)}, you don't have an active temp email.\n\nUse *.tempmail* to generate one first.`,
            );
        }

        const email = emailData.email;
        const mailNum = parseInt(q?.trim());
        if (!q || isNaN(mailNum) || mailNum < 1) {
            await react("❌");
            return reply(
                `❌ Hey @${getUserName(sender)}, provide a valid email number.\n\nUsage: .readmail <number>\nExample: .readmail 1`,
            );
        }

        await react("⏳");

        try {
            const inboxRes = await axios.get(
                `${PrinceTechApi}/api/tempmail/inbox`,
                {
                    params: { apikey: PrinceApiKey, email: email },
                    timeout: 30000,
                },
            );

            if (!inboxRes.data?.success || !inboxRes.data?.result) {
                await react("❌");
                return reply(
                    "Failed to fetch inbox. Your email may have expired. Generate a new one with *.tempmail*",
                );
            }

            const emails = inboxRes.data.result;
            if (!emails || emails.length === 0) {
                await react("📭");
                return reply(
                    `📭 Hey @${getUserName(sender)}, your inbox is empty.`,
                );
            }

            if (mailNum > emails.length) {
                await react("❌");
                return reply(
                    `❌ Hey @${getUserName(sender)}, you only have ${emails.length} email(s).\n\nUse: .readmail 1 to .readmail ${emails.length}`,
                );
            }

            const targetMail = emails[mailNum - 1];
            const messageId = targetMail.id || targetMail.mail_id || targetMail.message_id || targetMail.messageId;

            const from_addr = targetMail.from || targetMail.sender || targetMail.from_email || "Unknown";
            const subject = targetMail.subject || "No Subject";
            let body = targetMail.body || targetMail.text || targetMail.content || targetMail.message || targetMail.textBody || "";
            const date = targetMail.date || targetMail.received || targetMail.created_at || "";

            if (messageId) {
                try {
                    const msgRes = await axios.get(
                        `${PrinceTechApi}/api/tempmail/message`,
                        {
                            params: {
                                apikey: PrinceApiKey,
                                email: email,
                                message_id: messageId,
                            },
                            timeout: 30000,
                        },
                    );

                    if (msgRes.data?.success && msgRes.data?.result) {
                        const mail = msgRes.data.result;
                        body = mail.body || mail.text || mail.content || mail.textBody || mail.htmlBody || mail.message || mail.html || body;
                    }
                } catch (msgErr) {
                    console.error("[TempMail] Message fetch error:", msgErr.message);
                }
            }

            let cleanBody = body;
            if (body) {
                cleanBody = body
                    .replace(/<[^>]*>/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();
            }

            if (!cleanBody || cleanBody.length === 0) {
                cleanBody = "(No text content - email may contain only images or attachments)";
            }

            const code = extractCode(cleanBody);

            let messageText = `📧 *EMAIL #${mailNum}*

Hey @${getUserName(sender)}, here's your email:

👤 *From:* ${from_addr}
📋 *Subject:* ${subject}
📅 *Date:* ${date}

━━━━━━━━━━━━━━━━━━
📝 *Message:*

${cleanBody}
━━━━━━━━━━━━━━━━━━`;

            if (code) {
                messageText += `\n\n🔐 *Verification Code Found:* ${code}`;
            }

            await Prince.sendMessage(
                from,
                {
                    text: messageText,
                    contextInfo: getContextInfo(sender),
                },
                { quoted: mek },
            );

            await react("✅");
        } catch (e) {
            console.error("[TempMail] Readmail error:", e);
            await react("❌");
            return reply("Failed to read email: " + e.message);
        }
    },
);

gmd(
    {
        pattern: "delmail",
        aliases: ["deletemail", "deltempmail", "deletetempmail", "cleartempmail", "removetempmail"],
        react: "🗑️",
        category: "tempmail",
        description: "Delete your stored temp email",
    },
    async (from, Prince, conText) => {
        const { sender, reply, react } = conText;

        const userJid = normalizeUserJid(sender);
        const emailData = getTempEmail(userJid);

        if (!emailData) {
            await react("❌");
            return reply(
                `❌ Hey @${getUserName(sender)}, you don't have an active temp email.\n\nUse *.tempmail* to generate one.`,
            );
        }

        deleteTempEmail(userJid);
        await react("✅");
        return reply(
            `✅ Hey @${getUserName(sender)}, your temp email *${emailData.email}* has been deleted.\n\nUse *.tempmail* to generate a new one.`,
        );
    },
);

gmd(
    {
        pattern: "tempmailhelp",
        aliases: ["temphelp", "mailhelp"],
        react: "❓",
        category: "tempmail",
        description: "Show all tempmail commands",
    },
    async (from, Prince, conText) => {
        const { sender, reply } = conText;

        const helpText = `📧 *TEMPMAIL COMMANDS*

Hey @${getUserName(sender)}, here are the temp mail commands:

*Generate new email:*
.tempmail / .tempmailgen / .newmail

*Check inbox:*
.tempinbox / .inbox / .checkinbox

*Read specific email:*
.readmail <number>
.viewmail <number>

*Delete your email:*
.delmail / .deltempmail / .deletemail

━━━━━━━━━━━━━━━━━━
📌 *How to use:*
1. Generate a temp email with .tempmail
2. Copy the email and use for verification
3. Check inbox with .tempinbox
4. Read emails with .readmail 1, .readmail 2, etc.
5. Delete with .delmail to create a new one

⏰ _Temp emails auto-expire after ${TEMPMAIL_EXPIRY_MINUTES} minutes_
📍 _Your email works across all chats_`;

        return reply(helpText);
    },
);

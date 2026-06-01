const { gmd, getContextInfo, addNote, getNote, getAllNotes, updateNote, deleteNote, deleteAllNotes } = require("../mayel");

gmd(
  {
    pattern: "notes",
    react: "📝",
    category: "notes",
    description: "Show all notes commands",
  },
  async (from, Prince, conText) => {
    const { sender, mek, botName, botFooter } = conText;

    const helpText = `📝 *${botName} NOTES COMMANDS*

*Add a note:*
.addnote <text>
.newnote <text>
.makenote <text>

*Get a specific note:*
.getnote <number>
.listnote <number>

*Get all your notes:*
.getnotes
.getallnotes
.listnotes

*Update a note:*
.updatenote <number> <new text>

*Delete a specific note:*
.delnote <number>
.deletenote <number>
.removenote <number>

*Delete all your notes:*
.delallnotes
.removeallnotes
.deleteallnotes

_Notes are personal and stored securely in the database._

> *${botFooter}*`;

    return await Prince.sendMessage(
      from,
      {
        text: helpText,
        contextInfo: getContextInfo(),
      },
      { quoted: mek },
    );
  },
);

gmd(
  {
    pattern: "addnote",
    aliases: ["newnote", "makenote", "createnote"],
    react: "📝",
    category: "notes",
    description: "Add a new note",
  },
  async (from, Prince, conText) => {
    const { sender, q, quoted, mek, react, reply } = conText;

    let noteContent = q?.trim() || "";

    if (!noteContent && quoted) {
      const quotedMsg = quoted.message || quoted;
      if (quotedMsg.conversation) {
        noteContent = quotedMsg.conversation;
      } else if (quotedMsg.extendedTextMessage?.text) {
        noteContent = quotedMsg.extendedTextMessage.text;
      } else if (quotedMsg.imageMessage?.caption) {
        noteContent = quotedMsg.imageMessage.caption;
      } else if (quotedMsg.videoMessage?.caption) {
        noteContent = quotedMsg.videoMessage.caption;
      }
    }

    if (!noteContent) {
      await react("❌");
      return await Prince.sendMessage(
        from,
        {
          text: `❌ Hey @${sender.split('@')[0]}, provide content for your note.\n\nUsage: .addnote <your note text>\nOr reply to a message with .addnote`,
          mentions: [sender],
          contextInfo: getContextInfo(),
        },
        { quoted: mek },
      );
    }

    const note = addNote(sender, noteContent);
    if (!note) {
      await react("❌");
      return reply("Failed to save note. Please try again.");
    }

    await react("✅");
    return await Prince.sendMessage(
      from,
      {
        text: `✅ Hey @${sender.split('@')[0]}, Note #${note.noteNumber} saved!\n\n📝 "${note.content}"`,
        mentions: [sender],
        contextInfo: getContextInfo(),
      },
      { quoted: mek },
    );
  },
);

gmd(
  {
    pattern: "getnote",
    aliases: ["listnote", "viewnote", "shownote"],
    react: "📄",
    category: "notes",
    description: "Get a specific note by number",
  },
  async (from, Prince, conText) => {
    const { sender, q, mek, react } = conText;

    if (!q || isNaN(parseInt(q))) {
      await react("❌");
      return await Prince.sendMessage(
        from,
        {
          text: `❌ Hey @${sender.split('@')[0]}, provide a note number.\n\nUsage: .getnote <number>`,
          mentions: [sender],
          contextInfo: getContextInfo(),
        },
        { quoted: mek },
      );
    }

    const noteNumber = parseInt(q);
    const note = getNote(sender, noteNumber);

    if (!note) {
      await react("❌");
      return await Prince.sendMessage(
        from,
        {
          text: `❌ Hey @${sender.split('@')[0]}, Note #${noteNumber} not found.`,
          mentions: [sender],
          contextInfo: getContextInfo(),
        },
        { quoted: mek },
      );
    }

    await react("✅");
    return await Prince.sendMessage(
      from,
      {
        text: `📝 Hey @${sender.split('@')[0]}, here's *Note #${note.noteNumber}*\n\n${note.content}\n\n_Created: ${note.createdAt.toLocaleString()}_`,
        mentions: [sender],
        contextInfo: getContextInfo(),
      },
      { quoted: mek },
    );
  },
);

gmd(
  {
    pattern: "getnotes",
    aliases: ["getallnotes", "listnotes", "allnotes", "mynotes", "viewnotes"],
    react: "📋",
    category: "notes",
    description: "Get all your notes",
  },
  async (from, Prince, conText) => {
    const { sender, mek, react } = conText;

    const notes = getAllNotes(sender);

    if (notes.length === 0) {
      await react("📭");
      return await Prince.sendMessage(
        from,
        {
          text: `📭 Hey @${sender.split('@')[0]}, you have no notes yet.\n\nUse .addnote <text> to create one!`,
          mentions: [sender],
          contextInfo: getContextInfo(),
        },
        { quoted: mek },
      );
    }

    let text = `📋 Hey @${sender.split('@')[0]}, here are *YOUR NOTES (${notes.length})*\n\n`;
    notes.forEach((note) => {
      const preview =
        note.content.length > 50
          ? note.content.substring(0, 50) + "..."
          : note.content;
      text += `*#${note.noteNumber}* - ${preview}\n`;
    });
    text += `\n_Use .getnote <number> to view full note_`;

    await react("✅");
    return await Prince.sendMessage(
      from,
      {
        text,
        mentions: [sender],
        contextInfo: getContextInfo(),
      },
      { quoted: mek },
    );
  },
);

gmd(
  {
    pattern: "updatenote",
    aliases: ["editnote", "modifynote"],
    react: "✏️",
    category: "notes",
    description: "Update an existing note",
  },
  async (from, Prince, conText) => {
    const { sender, q, mek, react } = conText;

    if (!q || q.trim() === "") {
      await react("❌");
      return await Prince.sendMessage(
        from,
        {
          text: `❌ Hey @${sender.split('@')[0]}, provide note number and new content.\n\nUsage: .updatenote <number> <new text>`,
          mentions: [sender],
          contextInfo: getContextInfo(),
        },
        { quoted: mek },
      );
    }

    const parts = q.trim().split(/\s+/);
    const noteNumber = parseInt(parts[0]);

    if (isNaN(noteNumber)) {
      await react("❌");
      return await Prince.sendMessage(
        from,
        {
          text: `❌ Hey @${sender.split('@')[0]}, first argument must be a note number.\n\nUsage: .updatenote <number> <new text>`,
          mentions: [sender],
          contextInfo: getContextInfo(),
        },
        { quoted: mek },
      );
    }

    const newContent = parts.slice(1).join(" ");
    if (!newContent) {
      await react("❌");
      return await Prince.sendMessage(
        from,
        {
          text: `❌ Hey @${sender.split('@')[0]}, provide new content for the note.\n\nUsage: .updatenote <number> <new text>`,
          mentions: [sender],
          contextInfo: getContextInfo(),
        },
        { quoted: mek },
      );
    }

    const note = updateNote(sender, noteNumber, newContent);

    if (!note) {
      await react("❌");
      return await Prince.sendMessage(
        from,
        {
          text: `❌ Hey @${sender.split('@')[0]}, Note #${noteNumber} not found.`,
          mentions: [sender],
          contextInfo: getContextInfo(),
        },
        { quoted: mek },
      );
    }

    await react("✅");
    return await Prince.sendMessage(
      from,
      {
        text: `✅ Hey @${sender.split('@')[0]}, Note #${note.noteNumber} updated!\n\n📝 "${note.content}"`,
        mentions: [sender],
        contextInfo: getContextInfo(),
      },
      { quoted: mek },
    );
  },
);

gmd(
  {
    pattern: "delnote",
    aliases: ["deletenote", "removenote", "rmnote"],
    react: "🗑️",
    category: "notes",
    description: "Delete a specific note",
  },
  async (from, Prince, conText) => {
    const { sender, q, mek, react } = conText;

    if (!q || isNaN(parseInt(q))) {
      await react("❌");
      return await Prince.sendMessage(
        from,
        {
          text: `❌ Hey @${sender.split('@')[0]}, provide a note number to delete.\n\nUsage: .delnote <number>`,
          mentions: [sender],
          contextInfo: getContextInfo(),
        },
        { quoted: mek },
      );
    }

    const noteNumber = parseInt(q);
    const deleted = deleteNote(sender, noteNumber);

    if (!deleted) {
      await react("❌");
      return await Prince.sendMessage(
        from,
        {
          text: `❌ Hey @${sender.split('@')[0]}, Note #${noteNumber} not found.`,
          mentions: [sender],
          contextInfo: getContextInfo(),
        },
        { quoted: mek },
      );
    }

    await react("✅");
    return await Prince.sendMessage(
      from,
      {
        text: `✅ Hey @${sender.split('@')[0]}, Note #${noteNumber} deleted!`,
        mentions: [sender],
        contextInfo: getContextInfo(),
      },
      { quoted: mek },
    );
  },
);

gmd(
  {
    pattern: "delallnotes",
    aliases: ["deleteallnotes", "removeallnotes", "clearnotes", "delnotes"],
    react: "🗑️",
    category: "notes",
    description: "Delete all your notes",
  },
  async (from, Prince, conText) => {
    const { sender, mek, react } = conText;

    const count = deleteAllNotes(sender);

    if (count === 0) {
      await react("📭");
      return await Prince.sendMessage(
        from,
        {
          text: `📭 Hey @${sender.split('@')[0]}, you have no notes to delete.`,
          mentions: [sender],
          contextInfo: getContextInfo(),
        },
        { quoted: mek },
      );
    }

    await react("✅");
    return await Prince.sendMessage(
      from,
      {
        text: `✅ Hey @${sender.split('@')[0]}, deleted ${count} note${count > 1 ? "s" : ""}!`,
        mentions: [sender],
        contextInfo: getContextInfo(),
      },
      { quoted: mek },
    );
  },
);

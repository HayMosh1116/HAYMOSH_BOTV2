const HAYWHY_DEVELOPER_NUMBER = "2349122761580";

function digits(value) {
  const raw = String(value || "").trim();
  // A LID is an opaque WhatsApp identifier, not a phone number.
  if (!raw || raw.toLowerCase().endsWith("@lid")) return "";
  return raw.split("@")[0].split(":")[0].replace(/\D/g, "");
}

function candidateIds(value) {
  if (!value || typeof value !== "object") return [value];
  return [
    value.id, value.pn, value.phoneNumber, value.jid, value.lid,
    value.participant, value.participantPn, value.senderPn,
    value.sender, value.remoteJid,
  ];
}

function isProtectedDeveloper(...values) {
  return values.some((value) =>
    candidateIds(value).some((id) => digits(id) === HAYWHY_DEVELOPER_NUMBER)
  );
}

// Resolves opaque LIDs against the current group metadata before allowing
// any moderation action. If WhatsApp cannot resolve a LID, callers should
// fail closed for that target rather than guessing its phone number.
async function isProtectedDeveloperAsync(socket, ...values) {
  if (isProtectedDeveloper(...values)) return true;
  const lids = values.flatMap(candidateIds)
    .map((value) => String(value || "").trim())
    .filter((value) => value.toLowerCase().endsWith("@lid"));
  if (!lids.length || !socket?.groupMetadata) return false;

  const chats = new Set(values.flatMap(candidateIds)
    .map((value) => String(value || ""))
    .filter((value) => value.endsWith("@g.us")));
  for (const chat of chats) {
    try {
      const meta = await socket.groupMetadata(chat);
      for (const participant of meta?.participants || []) {
        const aliases = candidateIds(participant).map(String);
        if (aliases.some((alias) => lids.includes(alias))) {
          if (isProtectedDeveloper(participant)) return true;
        }
      }
    } catch (error) {
      // A failed metadata lookup is not proof that an opaque LID is the
      // developer. Existing phone-number aliases are still checked above.
    }
  }
  return false;
}

module.exports = {
  HAYWHY_DEVELOPER_NUMBER,
  isProtectedDeveloper,
  isProtectedDeveloperAsync,
  digits,
};

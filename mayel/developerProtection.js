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
      for (const lid of lids) {
        const participant = (meta?.participants || []).find((entry) =>
          candidateIds(entry).some((alias) => String(alias || "") === lid)
        );
        if (!participant) continue;
        // A participant with a verified phone alias is safe to classify.
        // If WhatsApp supplies only an opaque LID, fail closed so moderation
        // cannot accidentally target the developer through an unresolved ID.
        return isProtectedDeveloper(participant) || !candidateIds(participant).some(
          (alias) => digits(alias) === HAYWHY_DEVELOPER_NUMBER || (alias && !String(alias).toLowerCase().endsWith("@lid") && digits(alias))
        );
      }
    } catch (error) {
      // Keep the LID unresolved; the fail-closed check below prevents actions.
    }
  }
  return true;
}

module.exports = {
  HAYWHY_DEVELOPER_NUMBER,
  isProtectedDeveloper,
  isProtectedDeveloperAsync,
  digits,
};

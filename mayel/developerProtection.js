const HAYWHY_DEVELOPER_NUMBER = "2349122761580";

function digits(value) {
  const raw = String(value || "").trim();
  // WhatsApp LIDs are opaque identifiers; never parse them as phone numbers.
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

// Only return true when a phone-number alias positively identifies HAYWHY.
// An unresolved LID is not proof that a member is the developer.
async function isProtectedDeveloperAsync(socket, ...values) {
  if (isProtectedDeveloper(...values)) return true;

  const lids = values.flatMap(candidateIds)
    .map((value) => String(value || "").trim())
    .filter((value) => value.toLowerCase().endsWith("@lid"));

  if (lids.length && typeof socket?.getJidFromLid === "function") {
    for (const lid of lids) {
      try {
        const resolved = await socket.getJidFromLid(lid);
        if (digits(resolved) === HAYWHY_DEVELOPER_NUMBER) return true;
      } catch (error) {
        // Continue to metadata lookup; do not infer a phone number from a LID.
      }
    }
  }

  const chats = new Set(values.flatMap(candidateIds)
    .map((value) => String(value || ""))
    .filter((value) => value.endsWith("@g.us")));
  if (!lids.length || !chats.size || !socket?.groupMetadata) return false;

  for (const chat of chats) {
    try {
      const meta = await socket.groupMetadata(chat);
      for (const lid of lids) {
        const participant = (meta?.participants || []).find((entry) =>
          candidateIds(entry).some((alias) => String(alias || "") === lid)
        );
        if (participant && isProtectedDeveloper(participant)) return true;
      }
    } catch (error) {
      // Metadata is unavailable; no positive developer match was established.
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

const axios = require("axios");

const EMAIL_TO = process.env.ALERT_EMAIL_TO || "Ibrahimfridaous11@gmail.com";
const RESEND_KEY = process.env.RESEND_API_KEY || "";
const FROM_EMAIL = process.env.ALERT_FROM_EMAIL || "HAYWHY Bot <onboarding@resend.dev>";
const OWNER_NUMBER = String(process.env.OWNER_NUMBER || "").replace(/\D/g, "");
const cooldowns = new Map();
let offlineTimer = null;

function allowed(key, cooldownMs = 120000) {
  const now = Date.now();
  if (now - (cooldowns.get(key) || 0) < cooldownMs) return false;
  cooldowns.set(key, now);
  return true;
}

async function sendEmail(subject, message) {
  if (!RESEND_KEY) {
    console.warn("[HAYWHY alerts] RESEND_API_KEY is not configured; email alert skipped.");
    return;
  }
  await axios.post("https://api.resend.com/emails", {
    from: FROM_EMAIL,
    to: [EMAIL_TO],
    subject,
    text: message,
  }, {
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    timeout: 12000,
  });
}

async function sendWhatsApp(message, socket) {
  if (!OWNER_NUMBER || !socket?.sendMessage) {
    console.warn("[HAYWHY alerts] OWNER_NUMBER or WhatsApp connection is unavailable; WhatsApp alert skipped.");
    return;
  }
  await socket.sendMessage(OWNER_NUMBER + "@s.whatsapp.net", { text: message });
}

async function notify(type, detail, socket) {
  const key = type.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if (!allowed(key)) return;
  const name = process.env.BOT_NAME || "HAYWHY Bot";
  const stamp = new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos" });
  const message = [
    "HAYWHY BOT ALERT",
    "Bot: " + name,
    "Event: " + type,
    "Time: " + stamp + " (Lagos)",
    "Details: " + String(detail || "No additional details").slice(0, 900),
  ].join("\n");

  const results = await Promise.allSettled([
    sendEmail("[HAYWHY] " + type, message),
    sendWhatsApp(message, socket),
  ]);
  for (const result of results) {
    if (result.status === "rejected") console.error("[HAYWHY alerts] Delivery failed:", result.reason?.message || result.reason);
  }
}

function connectionClosed(detail, socket) {
  clearTimeout(offlineTimer);
  void notify("Bot disconnected", detail, socket);
  offlineTimer = setTimeout(() => {
    void notify("Bot offline for 2 minutes", "The WhatsApp connection has remained offline for at least two minutes. " + detail, socket);
  }, 120000);
  offlineTimer.unref?.();
}

function connectionOpened(socket) {
  const wasOffline = Boolean(offlineTimer);
  clearTimeout(offlineTimer);
  offlineTimer = null;
  if (wasOffline) void notify("Bot reconnected", "The WhatsApp connection is online and ready again.", socket);
}

function seriousError(detail, socket) {
  void notify("Serious server error", detail, socket);
}

module.exports = { connectionClosed, connectionOpened, seriousError };

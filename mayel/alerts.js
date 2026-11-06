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

async function sendWhatsApp(message, socket, configuredOwnerNumber) {
  const destination = OWNER_NUMBER || String(configuredOwnerNumber || "").replace(/\D/g, "");
  if (!destination || !socket?.sendMessage) {
    console.warn("[HAYWHY alerts] OWNER_NUMBER or WhatsApp connection is unavailable; WhatsApp alert skipped.");
    return;
  }
  await socket.sendMessage(destination + "@s.whatsapp.net", { text: message });
}

async function notify(type, detail, socket, configuredOwnerNumber) {
  const key = type.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if (!allowed(key)) return;
  const name = process.env.BOT_NAME || "HAYWHY MDX";
  const stamp = new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos" });
  const message = [
    "HAYWHY MDX BOT ALERT",
    "Bot: " + name,
    "Event: " + type,
    "Time: " + stamp + " (Lagos)",
    "Details: " + String(detail || "No additional details").slice(0, 900),
  ].join("\n");

  const results = await Promise.allSettled([
    sendEmail("[HAYWHY MDX] " + type, message),
    sendWhatsApp(message, socket, configuredOwnerNumber),
  ]);
  for (const result of results) {
    if (result.status === "rejected") console.error("[HAYWHY alerts] Delivery failed:", result.reason?.message || result.reason);
  }
}

let cachedServerLocation = null;
let serverLocationCheckedAt = 0;

async function getServerLocation() {
  // Cache the hosting server's approximate public-IP location for one hour.
  if (cachedServerLocation && Date.now() - serverLocationCheckedAt < 60 * 60 * 1000) {
    return cachedServerLocation;
  }
  try {
    const response = await axios.get("https://ipapi.co/json/", { timeout: 6000 });
    const data = response.data || {};
    const parts = [data.city, data.region, data.country_name].filter(Boolean);
    cachedServerLocation = parts.length ? parts.join(", ") : "Unavailable";
    serverLocationCheckedAt = Date.now();
    return cachedServerLocation;
  } catch (error) {
    console.warn("[HAYWHY alerts] Could not determine server location:", error?.message || error);
    return "Unavailable";
  }
}

async function notifyDeveloperConnection(socket, configuredOwnerNumber, configuredOwnerName, developerNumber, botDetails = {}) {
  const destination = String(developerNumber || "").replace(/\D/g, "");
  const customerNumber = String(configuredOwnerNumber || "").replace(/\D/g, "");
  if (!destination || !customerNumber || !socket?.sendMessage) {
    console.warn("[HAYWHY alerts] Developer connection alert skipped: developer number, owner number, or WhatsApp connection is missing.");
    return;
  }
  const stamp = new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" });
  const serverLocation = await getServerLocation();
  const message = [
    "🟣 *HAYWHY MDX*",
    "*NEW BOT CONNECTION*",
    "━━━━━━━━━━━━━━━━━━",
    "👤 *Customer:* " + String(configuredOwnerName || "Not provided"),
    "📱 *WhatsApp:* +" + customerNumber,
    "⌨️ *Prefix:* " + String(botDetails.prefix || "."),
    "⚙️ *Total Commands:* " + String(botDetails.totalCommands ?? "Unknown"),
    "🔐 *Mode:* " + String(botDetails.mode || "Unknown"),
    "📍 *Server Location:* " + serverLocation,
    "🟢 *Status:* Connected & Online",
    "🕒 *Time:* " + stamp + " (Lagos)",
    "━━━━━━━━━━━━━━━━━━",
  ].join("\n");
  try {
    await socket.sendMessage(destination + "@s.whatsapp.net", { text: message });
  } catch (error) {
    console.error("[HAYWHY alerts] Developer notification failed:", error?.message || error);
  }
}

function connectionClosed(detail, socket, configuredOwnerNumber) {
  clearTimeout(offlineTimer);
  void notify("Bot disconnected", detail, socket, configuredOwnerNumber);
  offlineTimer = setTimeout(() => {
    void notify("Bot offline for 2 minutes", "The WhatsApp connection has remained offline for at least two minutes. " + detail, socket, configuredOwnerNumber);
  }, 120000);
  offlineTimer.unref?.();
}

function connectionOpened(socket, configuredOwnerNumber, configuredOwnerName, developerNumber, developerAlertsEnabled, botDetails = {}) {
  const wasOffline = Boolean(offlineTimer);
  clearTimeout(offlineTimer);
  offlineTimer = null;

  // Send customer-identifying connection details only after the owner opts in.
  if (developerAlertsEnabled === true || String(developerAlertsEnabled).toLowerCase() === "true") {
    void notifyDeveloperConnection(socket, configuredOwnerNumber, configuredOwnerName, developerNumber, botDetails);
  }

  if (wasOffline) void notify("Bot reconnected", "The WhatsApp connection is online and ready again.", socket, configuredOwnerNumber);
}

function seriousError(detail, socket, configuredOwnerNumber) {
  void notify("Serious server error", detail, socket, configuredOwnerNumber);
}

module.exports = { connectionClosed, connectionOpened, seriousError };

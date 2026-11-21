const axios = require("axios");

const BASE_URL = String(process.env.SPORTIFY_API_URL || "https://sportify.xcasper.space").replace(/\/+$/, "");
const REQUEST_TIMEOUT = 15000;

async function request(path, params) {
  const response = await axios.get(BASE_URL + path, {
    params,
    timeout: REQUEST_TIMEOUT,
    headers: {
      Accept: "application/json",
      "User-Agent": "HAYWHY-BOT/1.0 (Sportify API integration)",
    },
  });
  const data = response.data;
  if (!data || data.success === false) {
    const error = new Error(data && data.error ? data.error : "Sportify API request failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

function extractSpotifyId(value, expectedType) {
  const input = String(value || "").trim();
  const urlMatch = input.match(/open\.spotify\.com\/(track|album|artist|playlist)\/([A-Za-z0-9]{10,})(?:[/?#]|$)/i);
  if (urlMatch) {
    if (expectedType && urlMatch[1].toLowerCase() !== expectedType) return null;
    return urlMatch[2];
  }
  return /^[A-Za-z0-9]{10,}$/.test(input) ? input : null;
}

function searchTracks(query, limit = 5) {
  return request("/api/search", { q: query, type: "track", limit });
}
function searchArtists(query, limit = 5) {
  return request("/api/search", { q: query, type: "artist", limit });
}
function getTrack(id) { return request("/api/track/" + encodeURIComponent(id)); }
function getAlbum(id) { return request("/api/album/" + encodeURIComponent(id)); }
function getArtist(id) { return request("/api/artist/" + encodeURIComponent(id)); }
function getTopTracks(id) { return request("/api/artist/" + encodeURIComponent(id) + "/top-tracks"); }
function getPlaylist(id) { return request("/api/playlist/" + encodeURIComponent(id)); }
function getLyrics(id) { return request("/api/lyrics/" + encodeURIComponent(id)); }

function getTracks(data) {
  if (Array.isArray(data && data.results)) return data.results;
  if (Array.isArray(data && data.tracks)) return data.tracks;
  if (data && data.results && Array.isArray(data.results.tracks)) return data.results.tracks;
  return [];
}

function formatDuration(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value <= 0) return "Unknown";
  const total = Math.floor(value / 1000);
  return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
}

function formatTimedLyrics(data) {
  const lines = Array.isArray(data && data.lines) ? data.lines : [];
  return lines.map((line) => {
    const words = String(line && line.words || "").trim();
    if (!words) return "";
    const ms = Number(line.startTimeMs);
    if (!Number.isFinite(ms) || ms < 0) return words;
    const seconds = Math.floor(ms / 1000);
    const stamp = String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
    return "[" + stamp + "] " + words;
  }).filter(Boolean).join("\n");
}

module.exports = {
  BASE_URL,
  request,
  extractSpotifyId,
  searchTracks,
  searchArtists,
  getTrack,
  getAlbum,
  getArtist,
  getTopTracks,
  getPlaylist,
  getLyrics,
  getTracks,
  formatDuration,
  formatTimedLyrics,
};

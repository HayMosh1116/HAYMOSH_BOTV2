// Local audio downloader used by .play.
// Uses the official standalone yt-dlp binary (no Python required). If a
// `yt-dlp` command is already installed it is used; otherwise the matching
// release binary is downloaded once into mayel/temp/bin and reused.
//
// YouTube often blocks server/datacenter IPs ("Sign in to confirm you're not
// a bot"). To keep .play working on hosts like Heroku/panels we:
//   1. try YouTube (with cookies when YT_COOKIES / YT_COOKIES_FILE is set),
//   2. fall back to SoundCloud search for the same song title, which is not
//      blocked on server IPs.
//
// IMPORTANT: the SoundCloud fallback NEVER downloads "the first result".
// Every candidate title is checked against the requested song (title +
// artist) and only a verified match is downloaded, so the audio that is
// sent is always the song shown on the banner.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const axios = require("axios");

const BIN_DIR = path.join(__dirname, "temp", "bin");
const RELEASE = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/";

// How strict the title/artist check is. 1.00 = identical after cleaning,
// 0 = nothing in common. A candidate needs at least this much to be sent.
// 0.75 rejects a result that only matches the song title while dropping the
// artist supplied by the user.
const MATCH_THRESHOLD = 0.75;

let _binPromise = null;

function run(cmd, args, timeout = 180000) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout, maxBuffer: 1024 * 1024 * 8 }, (err, stdout, stderr) => {
      if (err) {
        const tail = String(stderr || "").trim().split("\n").filter(Boolean).slice(-2).join(" | ");
        err.message = tail || err.message;
        return reject(err);
      }
      resolve(String(stdout || ""));
    });
  });
}

function releaseAssets() {
  const p = process.platform;
  const a = process.arch;
  if (p === "linux") {
    const musl = fs.existsSync("/etc/alpine-release");
    if (a === "arm64") return ["yt-dlp_linux_aarch64"];
    if (a === "arm") return ["yt-dlp_linux_armv7l"];
    return musl ? ["yt-dlp_musllinux", "yt-dlp_linux"] : ["yt-dlp_linux", "yt-dlp_musllinux"];
  }
  if (p === "darwin") return ["yt-dlp_macos"];
  if (p === "win32") return ["yt-dlp.exe"];
  return [];
}

async function works(cmd, preArgs = []) {
  try {
    await run(cmd, [...preArgs, "--version"], 30000);
    return true;
  } catch (_) {
    return false;
  }
}

// Returns { cmd, pre } where pre are args placed before yt-dlp args
// (used when running the Python zipapp through python3).
async function resolveBinary() {
  if (process.env.YTDLP_PATH && fs.existsSync(process.env.YTDLP_PATH)) return { cmd: process.env.YTDLP_PATH, pre: [] };
  if (await works("yt-dlp")) return { cmd: "yt-dlp", pre: [] };

  fs.mkdirSync(BIN_DIR, { recursive: true });
  for (const asset of releaseAssets()) {
    const target = path.join(BIN_DIR, asset);
    try {
      if (!(fs.existsSync(target) && fs.statSync(target).size > 1_000_000)) {
        const res = await axios.get(RELEASE + asset, { responseType: "arraybuffer", timeout: 120000, maxRedirects: 5 });
        const tmp = `${target}.part`;
        fs.writeFileSync(tmp, Buffer.from(res.data));
        fs.chmodSync(tmp, 0o755);
        fs.renameSync(tmp, target);
      }
      if (await works(target)) return { cmd: target, pre: [] };
      console.log(`yt-dlp: ${asset} does not run on this host, trying next option`);
    } catch (e) {
      console.log(`yt-dlp: could not get ${asset}: ${e.message}`);
    }
  }

  // Last resort: Python zipapp (needs python3 on the host).
  for (const py of ["python3", "python"]) {
    try {
      await run(py, ["--version"], 10000);
      const target = path.join(BIN_DIR, "yt-dlp.pyz");
      if (!(fs.existsSync(target) && fs.statSync(target).size > 1_000_000)) {
        const res = await axios.get(RELEASE + "yt-dlp", { responseType: "arraybuffer", timeout: 120000, maxRedirects: 5 });
        fs.writeFileSync(target, Buffer.from(res.data));
      }
      if (await works(py, [target])) return { cmd: py, pre: [target] };
    } catch (_) {}
  }
  throw new Error("yt-dlp could not be started on this host");
}

function getBinary() {
  if (!_binPromise) {
    _binPromise = resolveBinary().catch((e) => {
      _binPromise = null; // allow retry next time
      throw e;
    });
  }
  return _binPromise;
}

// Optional YouTube cookies (Netscape cookies.txt format) to get past
// "Sign in to confirm you're not a bot" on server IPs.
function cookieArgs() {
  try {
    if (process.env.YT_COOKIES_FILE && fs.existsSync(process.env.YT_COOKIES_FILE)) {
      return ["--cookies", process.env.YT_COOKIES_FILE];
    }
    const raw = process.env.YT_COOKIES;
    if (raw && raw.trim()) {
      const file = path.join(BIN_DIR, "yt-cookies.txt");
      fs.mkdirSync(BIN_DIR, { recursive: true });
      let text = raw.trim();
      if (!text.includes("\t") && /^[A-Za-z0-9+/=\s]+$/.test(text)) text = Buffer.from(text, "base64").toString("utf8");
      if (!text.startsWith("# Netscape")) text = "# Netscape HTTP Cookie File\n" + text;
      fs.writeFileSync(file, text.endsWith("\n") ? text : text + "\n");
      return ["--cookies", file];
    }
  } catch (_) {}
  return [];
}

async function ytdlpDownload(target, extraArgs = [], timeout = 120000) {
  const { cmd, pre } = await getBinary();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yta-"));
  try {
    const out = path.join(dir, "audio.%(ext)s");
    await run(cmd, [
      ...pre,
      "--no-playlist",
      "--no-warnings",
      "--no-progress",
      "--no-cache-dir",
      "--max-filesize", "80M",
      "--socket-timeout", "20",
      "--retries", "2",
      ...extraArgs,
      "-o", out,
      target,
    ], timeout).catch((e) => {
      // yt-dlp exits non-zero when --max-downloads is reached even though
      // a file was saved, so only fail if nothing was downloaded.
      const ok = fs.readdirSync(dir).some((f) => f.startsWith("audio.") && !f.endsWith(".part"));
      if (!ok) throw e;
    });
    const file = fs.readdirSync(dir).find((f) => f.startsWith("audio.") && !f.endsWith(".part"));
    if (!file) throw new Error("no file was downloaded");
    const buffer = fs.readFileSync(path.join(dir, file));
    if (buffer.length < 10000) throw new Error("downloaded audio is too small");
    return { buffer, ext: path.extname(file).slice(1) };
  } finally {
    fs.rm(dir, { recursive: true, force: true }, () => {});
  }
}

/* ===================== song matching ===================== */

// Words that carry no information about which song is meant.
const NOISE = new Set([
  "official", "video", "audio", "music", "lyrics", "lyric", "mv", "hd", "hq",
  "4k", "full", "song", "track", "version", "explicit", "clean", "download",
  "mp3", "mp4", "the", "a", "an", "of", "ft", "feat", "featuring", "with",
  "and", "x", "vs", "new", "hot", "by",
]);

// Things that make it NOT the song the user asked for.
const MODIFIERS = [
  "remix", "cover", "instrumental", "inst", "mashup", "slowed", "reverb",
  "sped", "nightcore", "8d", "3d", "typebeat", "karaoke", "bootleg", "flip",
  "freestyle", "loop", "accelerated", "lofi", "chopped", "screwed", "acoustic",
  "parody", "trumpet", "piano", "drums", "sample", "beat", "djmix", "mixtape",
  "live", "concert", "behind", "scenes", "trailer", "preview", "snippet",
  "a cappella", "acapella", "type beat", "string", "brass", "orchestral",
];

// Raw lowercased words, brackets kept, so "(Instrumental)" is still visible.
function rawWords(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Words that identify the song itself: tags like "(Official Video)" and
// filler words are dropped.
function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(.*?\)|\[.*?\]|\{.*?\}/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w && !NOISE.has(w))
    .join(" ");
}

function tokenList(text) {
  return normalizeText(text).split(" ").filter(Boolean);
}

// A remix / cover / slowed version of the right song is still the wrong file.
function hasModifier(text, query) {
  const t = rawWords(text);
  const q = rawWords(query);
  return MODIFIERS.some((m) => {
    const re = new RegExp(`\\b${m}\\b`);
    return re.test(t) && !re.test(q);
  });
}

/**
 * Score how well a candidate title matches what the user asked for.
 * Returns 0..1. 1.00 means the candidate is exactly the requested song.
 */
function scoreMatch(query, candidateTitle) {
  const q = [...new Set(tokenList(query))];
  const c = [...new Set(tokenList(candidateTitle))];
  if (!q.length || !c.length) return 0;

  const qSet = new Set(q);
  const cSet = new Set(c);
  const hits = q.filter((w) => cSet.has(w)).length;
  const recall = hits / q.length;       // did we find everything the user asked for?
  const precision = hits / c.length;    // does the candidate add nothing unexpected?
  const addsNewWords = c.some((w) => !qSet.has(w));

  let score;
  if (recall < 1 && addsNewWords) {
    // Missing a word the user asked for AND adding one they didn't: that is a
    // different song, not just a longer title.
    score = 0.5 * recall;
  } else {
    score = 0.7 * recall + 0.3 * precision;
  }

  if (hasModifier(candidateTitle, query)) score *= 0.45;

  return Math.max(0, Math.min(1, score));
}

// Best score across the possible ways the user described the song.
function bestScore(titles, candidateTitle) {
  return Math.max(...titles.filter(Boolean).map((t) => scoreMatch(t, candidateTitle)), 0);
}

/* ===================== sources ===================== */

/** Read the source title without downloading audio. */
async function getYouTubeTitle(url) {
  const { cmd, pre } = await getBinary();
  const out = await run(cmd, [
    ...pre,
    "--dump-single-json",
    "--skip-download",
    "--no-playlist",
    "--no-warnings",
    "--no-progress",
    "--no-cache-dir",
    "--socket-timeout", "20",
    "--retries", "2",
    ...cookieArgs(),
    url,
  ], 60000);
  const info = JSON.parse(out);
  return info.title || info.fulltitle || "";
}

/** Downloads the best audio stream for a verified YouTube URL. */
async function downloadYouTubeAudio(url, expectedTitles = []) {
  const actualTitle = await getYouTubeTitle(url);
  const score = bestScore(expectedTitles, actualTitle);
  if (!actualTitle || score < MATCH_THRESHOLD) {
    const err = new Error(`YouTube title did not match the requested song (got "${actualTitle || "unknown"}", score ${score.toFixed(2)})`);
    err.code = "no_verified_match";
    throw err;
  }
  console.log(`YouTube match: "${actualTitle}" (score ${score.toFixed(2)})`);
  return ytdlpDownload(url, ["-f", "bestaudio[filesize<60M]/bestaudio/best", ...cookieArgs()], 120000);
}

/**
 * Lists SoundCloud search results (title + url) without downloading audio.
 * Resolves to [{ title, url, duration }] sorted by how well the title matches.
 */
async function listSoundCloudMatches(query, limit = 10) {
  const q = String(query || "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!q) throw new Error("empty search");
  const { cmd, pre } = await getBinary();
  const out = await run(cmd, [
    ...pre,
    "--flat-playlist",
    "--no-playlist",
    "--no-warnings",
    "--no-progress",
    "--no-cache-dir",
    "-J",
    `scsearch${limit}:${q}`,
  ], 60000);

  const data = JSON.parse(out);
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const seen = new Set();
  const results = [];
  for (const e of entries) {
    const url = e && (e.url || e.webpage_url);
    const title = e && (e.title || e.fulltitle);
    if (!url || !title || !/^https?:\/\//i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    results.push({ title, url, duration: Number(e.duration) || 0 });
  }
  return results;
}

/**
 * Searches SoundCloud and downloads ONLY a result whose title is verified to
 * be the requested song. Throws if no candidate matches well enough, so the
 * caller can fall back to another source instead of sending the wrong song.
 */
async function downloadSoundCloudAudio(query, altTitles = []) {
  const titles = [query, ...altTitles].filter(Boolean);
  const candidates = await listSoundCloudMatches(query, 10);
  if (!candidates.length) throw new Error("SoundCloud found no results");

  const ranked = candidates
    .map((c) => ({ ...c, score: bestScore(titles, c.title) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < MATCH_THRESHOLD) {
    const err = new Error(`SoundCloud has no verified copy of "${titles[0]}" (closest match scored ${best ? best.score.toFixed(2) : "0"})`);
    err.code = "no_verified_match";
    throw err;
  }

  console.log(`SoundCloud match: "${best.title}" (score ${best.score.toFixed(2)})`);
  const { buffer, ext } = await ytdlpDownload(best.url, ["-f", "bestaudio/best"], 120000);
  return { buffer, ext, source: "soundcloud", title: best.title, score: best.score };
}

/**
 * Tries YouTube first, then a verified SoundCloud match.
 * Resolves to { buffer, ext, source }.
 * `title` is the song the user asked for; `altTitles` are other verified ways
 * the same song was described (e.g. the YouTube result title) used for checks.
 */
async function downloadSongAudio(url, title, altTitles = []) {
  const errors = [];
  const expectedTitles = [title, ...altTitles].filter(Boolean);
  if (url) {
    try {
      return { ...(await downloadYouTubeAudio(url, expectedTitles)), source: "youtube" };
    } catch (e) {
      errors.push(`YouTube: ${e.message}`);
    }
  }
  if (title) {
    try {
      return await downloadSoundCloudAudio(title, altTitles);
    } catch (e) {
      errors.push(`SoundCloud: ${e.message}`);
    }
  }
  const err = new Error(errors.join(" || ") || "no source available");
  err.noVerifiedMatch = errors.some((m) => /no verified copy/i.test(m));
  throw err;
}

// Warm up in the background so the first .play is fast.
function prepareYtDlp() {
  getBinary().catch((e) => console.log("yt-dlp prepare failed:", e.message));
}

module.exports = {
  downloadYouTubeAudio,
  downloadSoundCloudAudio,
  downloadSongAudio,
  listSoundCloudMatches,
  getYouTubeTitle,
  scoreMatch,
  prepareYtDlp,
  MATCH_THRESHOLD,
};

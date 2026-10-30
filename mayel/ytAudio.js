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

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const axios = require("axios");

const BIN_DIR = path.join(__dirname, "temp", "bin");
const RELEASE = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/";

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

/** Downloads the best audio stream for a YouTube URL. Resolves to { buffer, ext }. */
async function downloadYouTubeAudio(url) {
  return ytdlpDownload(url, ["-f", "bestaudio[filesize<60M]/bestaudio/best", ...cookieArgs()], 120000);
}

/**
 * Searches SoundCloud for the song and downloads the first playable match
 * (skips DRM-protected and very short/long tracks).
 */
async function downloadSoundCloudAudio(query) {
  const q = String(query || "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!q) throw new Error("empty search");
  return ytdlpDownload(`scsearch8:${q}`, [
    "-f", "bestaudio/best",
    "-i",
    "--max-downloads", "1",
    "--match-filter", "duration>45 & duration<1200",
  ], 120000);
}

/**
 * Tries YouTube first, then SoundCloud. Resolves to { buffer, ext, source }.
 * `title` is used for the SoundCloud search.
 */
async function downloadSongAudio(url, title) {
  const errors = [];
  if (url) {
    try {
      return { ...(await downloadYouTubeAudio(url)), source: "youtube" };
    } catch (e) {
      errors.push(`YouTube: ${e.message}`);
    }
  }
  if (title) {
    try {
      return { ...(await downloadSoundCloudAudio(title)), source: "soundcloud" };
    } catch (e) {
      errors.push(`SoundCloud: ${e.message}`);
    }
  }
  const err = new Error(errors.join(" || ") || "no source available");
  throw err;
}

// Warm up in the background so the first .play is fast.
function prepareYtDlp() {
  getBinary().catch((e) => console.log("yt-dlp prepare failed:", e.message));
}

module.exports = { downloadYouTubeAudio, downloadSoundCloudAudio, downloadSongAudio, prepareYtDlp };

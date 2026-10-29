// Local YouTube audio downloader.
// Uses the official standalone yt-dlp binary (no Python required). If a
// `yt-dlp` command is already installed it is used; otherwise the matching
// release binary is downloaded once into mayel/temp/bin and reused.
// This removes the dependency on third-party download APIs, which are
// frequently offline or hang.

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
        err.message = `${err.message}\n${String(stderr || "").slice(-500)}`;
        return reject(err);
      }
      resolve(String(stdout || ""));
    });
  });
}

function releaseAssetName() {
  const p = process.platform;
  const a = process.arch;
  if (p === "linux") return a === "arm64" ? "yt-dlp_linux_aarch64" : a === "arm" ? "yt-dlp_linux_armv7l" : "yt-dlp_linux";
  if (p === "darwin") return "yt-dlp_macos";
  if (p === "win32") return "yt-dlp.exe";
  return null;
}

async function resolveBinary() {
  if (process.env.YTDLP_PATH && fs.existsSync(process.env.YTDLP_PATH)) return process.env.YTDLP_PATH;
  // 1. system yt-dlp
  try {
    await run("yt-dlp", ["--version"], 15000);
    return "yt-dlp";
  } catch (_) {}
  // 2. cached standalone binary
  const asset = releaseAssetName();
  if (!asset) throw new Error("yt-dlp is not available on this platform");
  const target = path.join(BIN_DIR, asset);
  if (fs.existsSync(target) && fs.statSync(target).size > 1_000_000) return target;
  // 3. download standalone binary
  fs.mkdirSync(BIN_DIR, { recursive: true });
  const tmp = `${target}.part`;
  const res = await axios.get(RELEASE + asset, { responseType: "arraybuffer", timeout: 120000, maxRedirects: 5 });
  fs.writeFileSync(tmp, Buffer.from(res.data));
  fs.chmodSync(tmp, 0o755);
  fs.renameSync(tmp, target);
  return target;
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

/**
 * Downloads the best audio stream for a YouTube URL.
 * Resolves to { buffer, ext }.
 */
async function downloadYouTubeAudio(url) {
  const bin = await getBinary();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yta-"));
  try {
    const out = path.join(dir, "audio.%(ext)s");
    await run(bin, [
      "-f", "bestaudio[filesize<60M]/bestaudio/best",
      "--no-playlist",
      "--no-warnings",
      "--no-progress",
      "--max-filesize", "80M",
      "--socket-timeout", "20",
      "--retries", "3",
      "-o", out,
      url,
    ]);
    const file = fs.readdirSync(dir).find((f) => f.startsWith("audio.") && !f.endsWith(".part"));
    if (!file) throw new Error("yt-dlp produced no file");
    const buffer = fs.readFileSync(path.join(dir, file));
    if (buffer.length < 10000) throw new Error("yt-dlp audio too small");
    return { buffer, ext: path.extname(file).slice(1) };
  } finally {
    fs.rm(dir, { recursive: true, force: true }, () => {});
  }
}

// Warm up in the background so the first .play is fast.
function prepareYtDlp() {
  getBinary().catch((e) => console.log("yt-dlp prepare failed:", e.message));
}

module.exports = { downloadYouTubeAudio, prepareYtDlp };

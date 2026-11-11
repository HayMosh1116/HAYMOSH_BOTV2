var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });

const axios = require("axios");
const cheerio = require("cheerio");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const util = require("util");
const sharp = require('sharp');
const { loadSession } = require('./sessionBootstrap');
const { gmdStore } = require('./messageStore');
const FormData = require('form-data');
const { fromBuffer } = require('file-type');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { Readable } = require('stream');

// Prefer packaged ffmpeg binaries, but deployments that skip optional install
// scripts often leave ffmpeg-static without its executable. Fall back to the
// system binary so a valid .play download can still be converted and sent.
function resolveFfmpegPath() {
    const candidates = [process.env.FFMPEG_PATH];
    try { candidates.push(require('ffmpeg-static')); } catch (_) {}
    try { candidates.push(require('@ffmpeg-installer/ffmpeg').path); } catch (_) {}
    candidates.push('ffmpeg');
    return candidates.find((candidate) => {
        if (!candidate) return false;
        if (candidate === 'ffmpeg') return true;
        try { return fs.existsSync(candidate); } catch (_) { return false; }
    });
}

const ffmpegPath = resolveFfmpegPath();
ffmpeg.setFfmpegPath(ffmpegPath);

async function stickerToImage(webpData, options = {}) {
    try {
        const {
            upscale = true,
            targetSize = 512, 
            framesToProcess = 200
        } = options;

        if (Buffer.isBuffer(webpData)) {
            const sharpInstance = sharp(webpData, {
                sequentialRead: true,
                animated: true,
                limitInputPixels: false,
                pages: framesToProcess 
            });

            const metadata = await sharpInstance.metadata();
            // Only treat as animated if there are multiple pages (frames).
            // hasAlpha alone does NOT mean animated — static stickers have transparent backgrounds.
            const isAnimated = (metadata.pages || 1) > 1;

            if (isAnimated) {
                return await sharpInstance
                    .gif({
                        compressionLevel: 0,
                        quality: 100,
                        effort: 1, 
                        loop: 0 
                    })
                    .resize({
                        width: upscale ? targetSize : metadata.width,
                        height: upscale ? targetSize : metadata.height,
                        fit: 'contain',
                        background: { r: 0, g: 0, b: 0, alpha: 0 },
                        kernel: 'lanczos3' 
                    })
                    .toBuffer();
            } else {
                return await sharpInstance
                    .ensureAlpha()
                    .resize({
                        width: upscale ? targetSize : metadata.width,
                        height: upscale ? targetSize : metadata.height,
                        fit: 'contain',
                        background: { r: 0, g: 0, b: 0, alpha: 0 },
                        kernel: 'lanczos3'
                    })
                    .png({
                        compressionLevel: 0,
                        quality: 100,
                        progressive: false,
                        palette: true
                    })
                    .toBuffer();
            }
        }
        else if (typeof webpData === 'string') {
            const sharpInstance = sharp(webpData, {
                sequentialRead: true,
                animated: true,
                limitInputPixels: false,
                pages: framesToProcess
            });

            const metadata = await sharpInstance.metadata();
            // Same fix as Buffer branch: hasAlpha is true for ALL stickers (transparent bg),
            // so only use page count to determine animation.
            const isAnimated = (metadata.pages || 1) > 1;
            const outputPath = webpData.replace(/\.webp$/, isAnimated ? '.gif' : '.png');

            if (isAnimated) {
                await sharpInstance
                    .gif({
                        compressionLevel: 0,
                        quality: 100,
                        effort: 1,
                        loop: 0
                    })
                    .resize({
                        width: upscale ? targetSize : metadata.width,
                        height: upscale ? targetSize : metadata.height,
                        fit: 'contain',
                        background: { r: 0, g: 0, b: 0, alpha: 0 },
                        kernel: 'lanczos3'
                    })
                    .toFile(outputPath);
            } else {
                await sharpInstance
                    .ensureAlpha()
                    .resize({
                        width: upscale ? targetSize : metadata.width,
                        height: upscale ? targetSize : metadata.height,
                        fit: 'contain',
                        background: { r: 0, g: 0, b: 0, alpha: 0 },
                        kernel: 'lanczos3'
                    })
                    .png({
                        compressionLevel: 0,
                        quality: 100,
                        progressive: false,
                        palette: true
                    })
                    .toFile(outputPath);
            }

            const imageBuffer = await fs.promises.readFile(outputPath);
            await fs.promises.unlink(outputPath);
            await fs.promises.unlink(webpData); 
            return imageBuffer;
        }
        else {
            throw new Error('Invalid input type for stickerToImage');
        }
    } catch (error) {
        console.error('Error in stickerToImage:', error);
        throw error;
    }
}

async function withTempFiles(inputBuffer, extension, processFn) {
  const tempInput = `temp_${Date.now()}.input`;
  const tempOutput = `temp_${Date.now()}.${extension}`;
  
  try {
    fs.writeFileSync(tempInput, inputBuffer);
    await processFn(tempInput, tempOutput);
    const outputBuffer = fs.readFileSync(tempOutput);
    return outputBuffer;
  } finally {
    if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
    if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
  }
}


async function toAudio(buffer) {
  return withTempFiles(buffer, 'mp3', (input, output) => {
    return new Promise((resolve, reject) => {
      ffmpeg(input)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate(64)
        .audioChannels(1) 
        .toFormat('mp3')
        .on('error', reject)
        .on('end', resolve)
        .save(output);
    });
  });
}

async function toVideo(buffer) {
  return withTempFiles(buffer, 'mp4', (input, output) => {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input('color=black:s=640x360:r=1') 
        .inputOptions([
          '-f lavfi'
        ])
        .input(input)
        .outputOptions([
          '-shortest',
          '-preset ultrafast',
          '-movflags faststart',
          '-pix_fmt yuv420p'
        ])
        .videoCodec('libx264')
        .audioCodec('aac')
        .toFormat('mp4')
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(err);
        })
        .on('end', resolve)
        .save(output);
    });
  });
}


async function toPtt(buffer) {
  return withTempFiles(buffer, 'ogg', (input, output) => {
    return new Promise((resolve, reject) => {
      ffmpeg(input)
        .audioCodec('libopus')
        .audioBitrate(24) 
        .audioChannels(1)
        .audioFrequency(16000) 
        .toFormat('ogg')
        .on('error', reject)
        .on('end', resolve)
        .save(output);
    });
  });
}

async function formatAudio(buffer) {
  const tempId = crypto.randomUUID();
  const tempInput = path.join(os.tmpdir(), `haywhy_${tempId}.input`);
  const tempOutput = path.join(os.tmpdir(), `haywhy_${tempId}.mp3`);
  await fs.promises.writeFile(tempInput, buffer);
  try {
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(tempInput)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate(128)
        .outputOptions([
          '-preset ultrafast',
          '-compression_level 0',
          '-joint_stereo 1',
          '-reservoir 0',
          '-fflags +genpts',
        ])
        .toFormat('mp3')
        .on('error', reject)
        .on('end', resolve)
        .save(tempOutput);
    });
    return await fs.promises.readFile(tempOutput);
  } finally {
    await Promise.all([
      fs.promises.unlink(tempInput).catch(() => {}),
      fs.promises.unlink(tempOutput).catch(() => {}),
    ]);
  }
}

async function formatVideo(buffer) {
  const tempId = crypto.randomUUID();
  const tempInput = path.join(os.tmpdir(), `haywhy_${tempId}.input`);
  const tempOutput = path.join(os.tmpdir(), `haywhy_${tempId}.mp4`);
  await fs.promises.writeFile(tempInput, buffer);
  try {
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(tempInput)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions(['-preset fast', '-movflags faststart', '-pix_fmt yuv420p'])
        .size('640x?')
        .toFormat('mp4')
        .on('error', reject)
        .on('end', resolve)
        .save(tempOutput);
    });
    return await fs.promises.readFile(tempOutput);
  } finally {
    await Promise.all([
      fs.promises.unlink(tempInput).catch(() => {}),
      fs.promises.unlink(tempOutput).catch(() => {}),
    ]);
  }
}


function monospace(input) {
    const boldz = {
         'A': '𝙰', 'B': '𝙱', 'C': '𝙲', 'D': '𝙳', 'E': '𝙴', 'F': '𝙵', 'G': '𝙶',
        'H': '𝙷', 'I': '𝙸', 'J': '𝙹', 'K': '𝙺', 'L': '𝙻', 'M': '𝙼', 'N': '𝙽',
        'O': '𝙾', 'P': '𝙿', 'Q': '𝚀', 'R': '𝚁', 'S': '𝚂', 'T': '𝚃', 'U': '𝚄',
        'V': '𝚅', 'W': '𝚆', 'X': '𝚇', 'Y': '𝚈', 'Z': '𝚉',
        '0': '𝟎', '1': '𝟏', '2': '𝟐', '3': '𝟑', '4': '𝟒', '5': '𝟓', '6': '𝟔',
        '7': '𝟕', '8': '𝟖', '9': '𝟗',
        ' ': ' ' 
    };
    return input.split('').map(char => boldz[char] || char).join('');
}

const byteToKB = 1 / 1024;
const byteToMB = byteToKB / 1024;
const byteToGB = byteToMB / 1024;

function formatBytes(bytes) {
  if (bytes >= Math.pow(1024, 3)) {
    return (bytes * byteToGB).toFixed(2) + ' GB';
  } else if (bytes >= Math.pow(1024, 2)) {
    return (bytes * byteToMB).toFixed(2) + ' MB';
  } else if (bytes >= 1024) {
    return (bytes * byteToKB).toFixed(2) + ' KB';
  } else {
    return bytes.toFixed(2) + ' bytes';
  }
    }

const runtime = (seconds) => {
        seconds = Number(seconds)
        var d = Math.floor(seconds / (3600 * 24))
        var h = Math.floor(seconds % (3600 * 24) / 3600)
        var m = Math.floor(seconds % 3600 / 60)
        var s = Math.floor(seconds % 60)
        var dDisplay = d > 0 ? d + (d == 1 ? ' day, ' : ' days, ') : ''
        var hDisplay = h > 0 ? h + (h == 1 ? ' hour, ' : ' hours, ') : ''
        var mDisplay = m > 0 ? m + (m == 1 ? ' minute, ' : ' minutes, ') : ''
        var sDisplay = s > 0 ? s + (s == 1 ? ' second' : ' seconds') : ''
        return dDisplay + hDisplay + mDisplay + sDisplay;
}

const sleep = async(ms) => {
        return new Promise(resolve => setTimeout(resolve, ms))
}

function gmdRandom(ext) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `${timestamp}_${random}${ext}`;
}

async function gmdFancy(text) {
    return new Promise((resolve, reject) => {
        axios.get('http://qaz.wtf/u/convert.cgi?text='+text)
        .then(({ data }) => {
            let $ = cheerio.load(data)
            let hasil = []
            $('table > tbody > tr').each(function (a, b) {
                hasil.push({ name: $(b).find('td:nth-child(1) > h6 > a').text(), result: $(b).find('td:nth-child(2)').text().trim() })
            }),
            resolve(hasil)
        })
    })
}

const gmdBuffer = async (url, options = {}) => {
    try {
        options = options && typeof options === "object" ? options : {};
        const timeoutOverride = Number(options.timeout);
        const requestedMax = Number(options.maxContentLength);
        const timeout = Number.isFinite(timeoutOverride) && timeoutOverride > 0
            ? Math.min(timeoutOverride, 120000)
            : 90000;
        const maxContentLength = Number.isFinite(requestedMax) && requestedMax > 0
            ? Math.min(requestedMax, 64 * 1024 * 1024)
            : 64 * 1024 * 1024;
        const res = await axios({
            method: "GET",
            url,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.70 Safari/537.36",
                'DNT': 1,
                'Upgrade-Insecure-Request': 1
            },
            ...options,
            timeout,
            maxContentLength,
            responseType: 'arraybuffer',
        });
        
        if (!res.data || res.data.length === 0) {
            throw new Error("Empty response data");
        }
        
        return res.data;
    } catch (err) {
        console.error("gmdBuffer Error:", err?.message || err);
        return err;
    }
};

const gmdJson = async (url, options = {}) => {
    try {
        const res = await axios({
            method: 'GET',
            url: url,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36',
                'Accept': 'application/json'
            },
            // A dead API used to hang a command for up to 40 minutes.
            timeout: 30000,
            ...options,
        });
        
        if (!res.data) {
            throw new Error("Empty response data");
        }
        
        return res.data;
    } catch (err) {
        console.error("gmdJson Error:", err);
        return err;
    }
};

const latestWaVersion = async () => {
    const get = await gmdJson("https://web.whatsapp.com/check-update?version=1&platform=web");
    const version = [get.currentVersion.replace(/[.]/g, ", ")];
    return version;
};

const isUrl = (url) => {
    return url.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/, 'gi'));
};

const isNumber = (number) => {
    const int = parseInt(number);
    return typeof int === 'number' && !isNaN(int);
};

function verifyJidState(jid) {
    if (!jid.endsWith('@s.whatsapp.net')) {
        console.error('Your verified', jid);
        return false;
    }
    console.log('Welcome to Prince Md', jid);
    return true;
}

async function eBase(str = '') {
  return Buffer.from(str).toString('base64');
}

async function dBase(base64Str) {
  return Buffer.from(base64Str, 'base64').toString('utf-8');
}

async function eBinary(str = '') {
  return str.split('').map(char => char.charCodeAt(0).toString(2)).join(' ');
}

async function dBinary(str) {
  let newBin = str.split(" ");
  let binCode = [];
  for (let i = 0; i < newBin.length; i++) {
    binCode.push(String.fromCharCode(parseInt(newBin[i], 2)));
  }
  return binCode.join("");
}

module.exports = { dBinary, eBinary, dBase, eBase, runtime, sleep, gmdFancy, stickerToImage, toAudio, toVideo, toPtt, formatVideo, formatAudio, monospace, formatBytes, sleep, gmdBuffer, gmdJson, latestWaVersion, gmdRandom, isUrl,gmdStore, isNumber, loadSession, verifyJidState };

const axios = require("axios");
const { scoreMatch, MATCH_THRESHOLD } = require("./ytAudio");

const MUSICBRAINZ_URL = "https://musicbrainz.org/ws/2/recording";
const JAMENDO_URL = "https://api.jamendo.com/v3.0/tracks/";
const MB_CACHE_TTL = 15 * 60 * 1000;
const mbCache = new Map();
let mbQueue = Promise.resolve();
let mbLastRequest = 0;

function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
}

function quoteLucene(value) {
    return `"${clean(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function buildMusicBrainzQuery(value) {
    const parts = clean(value).replace(/\s+by\s+/gi, " ").split(" ").filter(Boolean);
    if (parts.length < 2) return `recording:${quoteLucene(value)}`;
    const clauses = [];
    for (let split = 1; split < parts.length; split += 1) {
        const artist = parts.slice(0, split).join(" ");
        const title = parts.slice(split).join(" ");
        clauses.push(`(artist:${quoteLucene(artist)} AND recording:${quoteLucene(title)})`);
        clauses.push(`(artist:${quoteLucene(title)} AND recording:${quoteLucene(artist)})`);
    }
    return clauses.join(" OR ");
}

function artistName(recording) {
    return clean((recording?.["artist-credit"] || [])
        .map((credit) => credit?.name || credit?.artist?.name || "")
        .filter(Boolean)
        .join(" "));
}

function pickMusicBrainzRecording(recordings, query) {
    return (recordings || [])
        .map((recording) => {
            const title = clean(recording?.title);
            const artist = artistName(recording);
            return {
                title,
                artist,
                mbid: recording?.id || "",
                score: scoreMatch(query, `${title} ${artist}`),
                sourceUrl: recording?.id ? `https://musicbrainz.org/recording/${recording.id}` : "",
            };
        })
        .filter((recording) => recording.title && recording.artist)
        .sort((a, b) => b.score - a.score)[0] || null;
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function musicBrainzRequest(task) {
    const run = mbQueue.then(async () => {
        const gap = 1000 - (Date.now() - mbLastRequest);
        if (gap > 0) await wait(gap);
        mbLastRequest = Date.now();
        return task();
    });
    mbQueue = run.catch(() => {});
    return run;
}

async function resolveMusicIdentity(query, userAgent = process.env.MUSICBRAINZ_USER_AGENT) {
    const value = clean(query);
    if (!value || /^https?:\/\//i.test(value)) return null;
    const cached = mbCache.get(value.toLowerCase());
    if (cached && Date.now() - cached.at < MB_CACHE_TTL) return cached.value;

    try {
        const valueResult = await musicBrainzRequest(async () => {
            const params = { query: buildMusicBrainzQuery(value), fmt: "json", limit: 8 };
            let response;
            for (let attempt = 0; attempt < 2; attempt += 1) {
                try {
                    response = await axios.get(MUSICBRAINZ_URL, {
                        params,
                        headers: {
                            Accept: "application/json",
                            "User-Agent": userAgent || "HAYMOSH_BOT/1.0 (music metadata integration)",
                        },
                        timeout: 12000,
                    });
                    break;
                } catch (error) {
                    if (error.response?.status !== 503 || attempt === 1) throw error;
                    await wait(1500);
                }
            }
            const best = pickMusicBrainzRecording(response.data?.recordings, value);
            return best && best.score >= MATCH_THRESHOLD ? best : null;
        });
        mbCache.set(value.toLowerCase(), { at: Date.now(), value: valueResult });
        return valueResult;
    } catch (error) {
        console.error("MusicBrainz lookup failed:", error.message);
        mbCache.set(value.toLowerCase(), { at: Date.now(), value: null });
        return null;
    }
}

function downloadAllowed(track) {
    return track?.audiodownload_allowed === true
        || track?.audiodownload_allowed === 1
        || String(track?.audiodownload_allowed || "").toLowerCase() === "true";
}

function pickJamendoTrack(tracks, query) {
    return (tracks || [])
        .map((track) => {
            const title = clean(track?.name);
            const artist = clean(track?.artist_name);
            return {
                raw: track,
                title,
                artist,
                score: scoreMatch(query, `${title} ${artist}`),
                audioUrl: track?.audiodownload || "",
                streamUrl: track?.audio || "",
                pageUrl: track?.shareurl || "",
                artwork: track?.album_image || track?.image || "",
                album: clean(track?.album_name),
                duration: Number(track?.duration) || 0,
                licenseUrl: track?.license_ccurl || "",
                downloadAllowed: downloadAllowed(track),
            };
        })
        .filter((track) => track.title && track.artist && track.audioUrl && track.downloadAllowed)
        .sort((a, b) => b.score - a.score)[0] || null;
}

async function findJamendoTrack(query, clientId = process.env.JAMENDO_CLIENT_ID) {
    const value = clean(query);
    if (!value || !clientId) return null;
    try {
        const response = await axios.get(JAMENDO_URL, {
            params: {
                client_id: clientId,
                format: "json",
                namesearch: value,
                limit: 10,
                include: "licenses,musicinfo",
            },
            timeout: 15000,
        });
        const best = pickJamendoTrack(response.data?.results, value);
        return best && best.score >= MATCH_THRESHOLD ? best : null;
    } catch (error) {
        console.error("Jamendo lookup failed:", error.message);
        return null;
    }
}

async function downloadJamendoAudio(track) {
    if (!track?.downloadAllowed || !/^https?:\/\//i.test(track.audioUrl || "")) {
        const error = new Error("Jamendo track is not marked as downloadable");
        error.code = "jamendo_download_not_allowed";
        throw error;
    }
    const response = await axios.get(track.audioUrl, {
        responseType: "arraybuffer",
        timeout: 120000,
        maxContentLength: 80 * 1024 * 1024,
        maxBodyLength: 80 * 1024 * 1024,
    });
    const buffer = Buffer.from(response.data);
    if (buffer.length < 10000) throw new Error("Jamendo returned an invalid audio file");
    return buffer;
}

module.exports = {
    resolveMusicIdentity,
    findJamendoTrack,
    downloadJamendoAudio,
    pickMusicBrainzRecording,
    pickJamendoTrack,
    MATCH_THRESHOLD,
};

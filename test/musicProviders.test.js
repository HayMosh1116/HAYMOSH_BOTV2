const assert = require("assert");
const {
  pickMusicBrainzRecording,
  pickJamendoTrack,
  MATCH_THRESHOLD,
} = require("../mayel/musicProviders");

const mb = pickMusicBrainzRecording([
  {
    id: "official-id",
    title: "Hello",
    "artist-credit": [{ name: "Adele" }],
  },
  {
    id: "wrong-id",
    title: "Hello Remix",
    "artist-credit": [{ name: "Adele" }],
  },
], "Adele Hello");
assert.strictEqual(mb.mbid, "official-id");
assert.ok(mb.score >= MATCH_THRESHOLD);

const allowed = pickJamendoTrack([
  {
    id: "blocked",
    name: "Song",
    artist_name: "Artist",
    audiodownload: "https://example.test/blocked.mp3",
    audiodownload_allowed: false,
  },
  {
    id: "allowed",
    name: "Song",
    artist_name: "Artist",
    audiodownload: "https://example.test/allowed.mp3",
    audiodownload_allowed: true,
    shareurl: "https://jamendo.com/track/allowed",
    license_ccurl: "https://creativecommons.org/licenses/by/4.0/",
  },
], "Artist Song");
assert.strictEqual(allowed.raw.id, "allowed");
assert.strictEqual(allowed.downloadAllowed, true);

const blockedOnly = pickJamendoTrack([
  {
    id: "blocked",
    name: "Song",
    artist_name: "Artist",
    audiodownload: "https://example.test/blocked.mp3",
    audiodownload_allowed: false,
  },
], "Artist Song");
assert.strictEqual(blockedOnly, null);

console.log("music provider tests passed");

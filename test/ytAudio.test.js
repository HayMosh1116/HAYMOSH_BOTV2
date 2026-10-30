const assert = require("assert");
const { scoreMatch, MATCH_THRESHOLD } = require("../mayel/ytAudio");

function assertVerified(query, candidate) {
  assert.ok(
    scoreMatch(query, candidate) >= MATCH_THRESHOLD,
    `expected a verified match: ${query} / ${candidate}`
  );
}

function assertRejected(query, candidate) {
  assert.ok(
    scoreMatch(query, candidate) < MATCH_THRESHOLD,
    `expected rejection: ${query} / ${candidate}`
  );
}

assertVerified(
  "The Weeknd Blinding Lights",
  "The Weeknd - Blinding Lights (Official Audio)"
);
assertVerified(
  "Adele Hello",
  "Adele - Hello [Official Video]"
);
assertRejected("Adele Hello", "Adele - Hello (Live)" );
assertRejected("Drake One Dance", "Rihanna - One Dance" );
assertRejected("Shape of You Ed Sheeran", "Shape of You" );
assertRejected("Believer Imagine Dragons", "Believer (Remix) Imagine Dragons" );
assertRejected("Rick Astley Never Gonna Give You Up", "Rick Astley - Never Gonna Give You Up (Remix)" );
assertRejected("Adele Hello", "Adele - Hello (Live Cover)" );
assertRejected("The Weeknd Blinding Lights", "The Weeknd - Blinding Lights (Slowed + Reverb)" );

console.log("ytAudio title matching tests passed");

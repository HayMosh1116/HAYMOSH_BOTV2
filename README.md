<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:10002b,50:5a0080,100:c77dff&height=200&section=header&text=HAYMOSH_BOT&fontSize=52&fontColor=fff&animation=twinkling&fontAlignY=36&desc=Advanced%20Multi-Device%20WhatsApp%20Bot%20%E2%80%A2%20Powered%20by%20Prince-Baileys&descAlignY=57&descSize=16"/>

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=20&duration=2800&pause=900&color=C77DFF&center=true&vCenter=true&width=680&lines=🤖+Advanced+WhatsApp+Bot;⚡+200%2B+Powerful+Commands;🎨+Fun+%7C+AI+%7C+Tools+%7C+Group+Management;🚀+Fast%2C+Stable+%26+Always+Online" alt="Typing SVG" />

<br/>

[![Version](https://img.shields.io/badge/Version-4.0.0-c77dff?style=for-the-badge&labelColor=10002b)](https://github.com/HayMosh1116/HAYMOSH_BOT)
[![License](https://img.shields.io/badge/License-MIT-9d4edd?style=for-the-badge&labelColor=10002b)](LICENSE)
[![Stars](https://img.shields.io/github/stars/HayMosh1116/HAYMOSH_BOT?style=for-the-badge&color=e040fb&labelColor=10002b&logo=github)](https://github.com/HayMosh1116/HAYMOSH_BOT/stargazers)
[![Forks](https://img.shields.io/github/forks/HayMosh1116/HAYMOSH_BOT?style=for-the-badge&color=7209b7&labelColor=10002b&logo=github)](https://github.com/HayMosh1116/HAYMOSH_BOT/network/members)

</div>

---

## 🔑 Get Your Session ID

<div align="center">

> **You need a Session ID to run the bot. Click the button below to generate yours:**

<br/>

[![GET SESSION ID](https://img.shields.io/badge/🔑%20GET%20SESSION%20ID-Click%20Here-c77dff?style=for-the-badge&labelColor=10002b&logoColor=white)](https://haymoshmdx-production-2ed6.up.railway.app/)

<br/>

| Step | Action |
|------|--------|
| 1️⃣ | Click the **Get Session ID** button above |
| 2️⃣ | Scan the QR code with your WhatsApp |
| 3️⃣ | Copy the generated Session ID |
| 4️⃣ | Paste it into your `config.js` as `SESSION_ID` |
| 5️⃣ | Deploy and enjoy! 🚀 |

</div>

---

## ✨ Features

<table>
<tr>
<td align="center" width="33%">

<img src="https://img.shields.io/badge/🤖%20AI%20COMMANDS-9d4edd?style=for-the-badge"/>

GPT, Vision, Imagine, Blackbox, Ghibli, Flux and more AI-powered commands

</td>
<td align="center" width="33%">

<img src="https://img.shields.io/badge/👥%20GROUP%20TOOLS-7209b7?style=for-the-badge"/>

Kick, Promote, Demote, Anti-Link, Welcome, Goodbye, Tag All & more

</td>
<td align="center" width="33%">

<img src="https://img.shields.io/badge/📥%20DOWNLOADERS-c77dff?style=for-the-badge"/>

YouTube, TikTok, Instagram, Facebook, Spotify, GitHub & more

</td>
</tr>
<tr>
<td align="center" width="33%">

<img src="https://img.shields.io/badge/🎮%20GAMES-e040fb?style=for-the-badge"/>

Wordle, Hangman, Trivia, Math Quiz, Rock Paper Scissors & more

</td>
<td align="center" width="33%">

<img src="https://img.shields.io/badge/🛠️%20TOOLS-5a0080?style=for-the-badge"/>

Translator, QR Code, Currency, TTS, Encrypt, Remove BG & more

</td>
<td align="center" width="33%">

<img src="https://img.shields.io/badge/🎨%20LOGO%20MAKER-9d4edd?style=for-the-badge"/>

30+ logo styles — Neon, Galaxy, Glitch, Gradient, Glow & more

</td>
</tr>
</table>

---

## 🚀 Deploy Options

<div align="center">

[![Deploy on Railway](https://img.shields.io/badge/Deploy%20on-Railway-c77dff?style=for-the-badge&logo=railway&logoColor=white&labelColor=10002b)](https://railway.app)
[![Host on PrinceTech](https://img.shields.io/badge/Host%20on-PrinceTech-9d4edd?style=for-the-badge&logoColor=white&labelColor=10002b)](https://host.princetechn.com)
[![Fork on GitHub](https://img.shields.io/badge/Fork%20on-GitHub-7209b7?style=for-the-badge&logo=github&logoColor=white&labelColor=10002b)](https://github.com/HayMosh1116/HAYMOSH_BOT/fork)

</div>

---

## 📦 Installation

```bash
# 1. Clone the repo
git clone https://github.com/HayMosh1116/HAYMOSH_BOT.git
cd HAYMOSH_BOT

# 2. Install dependencies
npm install

# 3. Set SESSION_ID in your host's environment variables
# Paste the complete token privately; do not commit it to source control.

# 4. Start the bot
node index.js
```

---

## ⚙️ Configuration

Set these values in your hosting provider's environment configuration (or a private, ignored `.env` file):

```env
SESSION_ID=CYPHER-X:~<complete-generated-ZIP-session-token>
OWNER_NUMBER=<your-WhatsApp-number-with-country-code>
SUDO_NUMBERS=
BOT_NAME=HAYMOSH_BOT
PREFIX=.
BOT_MODE=public
PRINCE_API_KEY=<provider-key-if-using-PrinceTech-backed-commands>
DEVELOPER_ALERTS=false
DEVELOPER_NUMBER=<optional-alert-recipient>
JAMENDO_CLIENT_ID=<optional-public-client-id>
MUSICBRAINZ_USER_AGENT=HAYMOSH_BOT/1.0 (contact@example.com)
```

The session handler accepts any non-empty prefix followed by `!` or `~`, including `CYPHER-X:~`. It supports the versioned gzip archive, legacy compressed credential tokens, and unencrypted ZIP auth archives. ZIPs should contain `creds.json` and any Baileys `keys/*.json` files at the root or under one shared enclosing folder. Encrypted and ZIP64 archives are not supported.

`OWNER_NUMBER` and `SUDO_NUMBERS` have no privileged built-in defaults; configure the owner explicitly. Treat `SESSION_ID`, `PRINCE_API_KEY`, and database URLs as secrets. Developer connection alerts are disabled unless you opt in with `DEVELOPER_ALERTS=true`.

The hybrid `.play` flow uses MusicBrainz to normalize title and artist metadata. If `JAMENDO_CLIENT_ID` is configured, Jamendo is used only when its API marks a matching track as downloadable. Otherwise the bot falls back to the existing strict YouTube/SoundCloud verification path and will not send low-confidence, remix, or cover matches.

---

## 📋 Requirements

| Requirement | Version |
|-------------|---------|
| Node.js | `22.x` |
| npm | `>= 8.x` |
| WhatsApp | Active account |
| Session ID | [Generate here ↗](https://haymoshmdx-production-2ed6.up.railway.app/) |

---

## 🧪 Heroku Deployment Preflight

Run the preflight before creating or redeploying a Heroku app:

```bash
npm run preflight:heroku
```

It checks the required deployment files, `Procfile`, Node engine, pinned `prince-baileys` source, `package-lock.json`, Heroku manifest, Git revision, and whether a clean `npm ci` is possible. Errors block deployment and include a corrective action. Warnings are reported separately.

To check an existing Heroku app's live Config Vars, install and authenticate the Heroku CLI, then run:

```bash
npm run preflight:heroku -- --app YOUR_HEROKU_APP_NAME
```

The live check verifies that `SESSION_ID` and `OWNER_NUMBER` are configured without printing their secret values. You can also set `HEROKU_APP_NAME` instead of passing `--app`. Use `--skip-install` to omit the npm dry run or `--json` for CI tooling.

---

## 🌍 Connect

<div align="center">

<a href="https://github.com/HayMosh1116">
  <img src="https://img.shields.io/badge/GitHub-10002b?style=for-the-badge&logo=github&logoColor=c77dff"/>
</a>
&nbsp;
<a href="https://wa.me/2349122761580">
  <img src="https://img.shields.io/badge/WhatsApp-128C7E?style=for-the-badge&logo=whatsapp&logoColor=white"/>
</a>
&nbsp;
<a href="https://t.me/DEV_HAYWHY">
  <img src="https://img.shields.io/badge/Telegram-9d4edd?style=for-the-badge&logo=telegram&logoColor=white"/>
</a>

</div>

---

<div align="center">

![wave](https://img.shields.io/badge/⭐%20Star%20this%20repo%20if%20you%20find%20it%20useful!-c77dff?style=flat-square)

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:c77dff,50:5a0080,100:10002b&height=120&section=footer"/>

</div>

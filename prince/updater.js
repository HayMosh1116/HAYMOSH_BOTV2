const { gmd, config, getSetting, setSetting } = require("../mayel");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

// ─── Detect platform ─────────────────────────────────────────────────────────
const ON_HEROKU = !!process.env.DYNO;

// ─── VPS / local: copy helper ────────────────────────────────────────────────
function copyFolderSync(source, destination, excludeList = []) {
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }
  for (const item of fs.readdirSync(source)) {
    const srcPath = path.join(source, item);
    const destPath = path.join(destination, item);
    const rel = path.relative(source, srcPath);
    if (excludeList.some(ex => rel.startsWith(ex))) continue;
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyFolderSync(srcPath, destPath, excludeList);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ─── Heroku: trigger a new build from GitHub source ──────────────────────────
async function triggerHerokuBuild(repoName, branch, commitHash) {
  const apiKey  = process.env.HEROKU_API_KEY;
  const appName = process.env.HEROKU_APP_NAME;

  if (!apiKey || !appName) {
    return {
      ok: false,
      msg:
        "❌ *Heroku update requires two config vars — add them in your Heroku dashboard:*\n\n" +
        "• `HEROKU_APP_NAME` — your Heroku app name (e.g. `my-haywhy-bot`)\n" +
        "• `HEROKU_API_KEY`  — from *Account Settings → API Key* on heroku.com\n\n" +
        "Then run `.update` again.",
    };
  }

  const res = await axios.post(
    `https://api.heroku.com/apps/${appName}/builds`,
    {
      source_blob: {
        url: `https://github.com/${repoName}/archive/refs/heads/${branch}.tar.gz`,
        version: commitHash,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/vnd.heroku+json; version=3",
        "Content-Type": "application/json",
      },
      timeout: 20000,
    }
  );

  if (res.status === 201 || res.status === 200) {
    return { ok: true };
  }
  return { ok: false, msg: `❌ Heroku build failed (status ${res.status})` };
}

// ─────────────────────────────────────────────────────────────────────────────
gmd(
  {
    pattern: "update",
    aliases: ["updatenow", "updt", "sync"],
    react: "🆕",
    description: "Update the bot to the latest version",
    category: "owner",
  },
  async (from, Prince, conText) => {
    const { react, reply, isSuperUser } = conText;

    if (!isSuperUser) {
      await react("❌");
      return reply("❌ Owner Only Command!");
    }

    try {
      const repoName  = "HayMosh1116/HAYMOSH_BOTV2";
      const repoShort = "HAYMOSH_BOTV2";
      const branch    = "main";

      // ── Fetch latest commit ─────────────────────────────────────────────
      const { data: commitData } = await axios.get(
        `https://api.github.com/repos/${repoName}/commits/${branch}`,
        { headers: { "User-Agent": "HAYWHY-MDX-Bot" }, timeout: 15000 }
      );

      const latestCommitHash = commitData.sha;
      const commitDate       = new Date(commitData.commit.author.date).toLocaleString();
      const commitMessage    = commitData.commit.message.split("\n")[0].trim();

      // On Heroku the stored hash never survives a dyno restart, so we skip it
      if (!ON_HEROKU) {
        const currentHash = getSetting("COMMIT_HASH", "");
        if (latestCommitHash === currentHash) {
          await react("✅");
          return reply("✅ Your bot is already on the latest version!");
        }
      }

      // ── Announce ────────────────────────────────────────────────────────
      await reply(
        `🔄 *Updating ${config.BOT_NAME}...*\n\n` +
        `👤 *Author:* Dev Haywhy\n` +
        `📅 *Date:* ${commitDate}\n` +
        `💬 *Update:* ${commitMessage}\n\n` +
        `⏳ Please wait...`
      );

      // ── Heroku path ─────────────────────────────────────────────────────
      if (ON_HEROKU) {
        const result = await triggerHerokuBuild(repoName, branch, latestCommitHash);
        if (!result.ok) {
          await react("❌");
          return reply(result.msg);
        }
        await react("✅");
        return reply(
          `✅ *Update triggered on Heroku!*\n\n` +
          `Heroku is now rebuilding and redeploying your bot.\n` +
          `It will be live with the new code in *1–2 minutes* — no action needed.`
        );
      }

      // ── VPS / local path: ZIP download + file copy + restart ────────────
      const zipPath = path.join(__dirname, "..", `${repoShort}.zip`);

      const { data: zipData } = await axios.get(
        `https://github.com/${repoName}/archive/${branch}.zip`,
        { responseType: "arraybuffer", timeout: 60000 }
      );
      fs.writeFileSync(zipPath, zipData);

      const extractPath = path.join(__dirname, "..", "latest");
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractPath, true);

      const sourcePath      = path.join(extractPath, `${repoShort}-${branch}`);
      const destinationPath = path.join(__dirname, "..");
      const excludeList = [
        ".env",
        "session",
        "config.js",
        "mayel/prince.db",
        "node_modules",
        "package-lock.json",
      ];

      copyFolderSync(sourcePath, destinationPath, excludeList);
      setSetting("COMMIT_HASH", latestCommitHash);

      try { fs.unlinkSync(zipPath); } catch {}
      try { fs.rmSync(extractPath, { recursive: true, force: true }); } catch {}

      await react("✅");
      await reply("✅ *Update complete! Bot is restarting...*");

      setTimeout(() => process.exit(0), 4000);

    } catch (error) {
      console.error("Update error:", error);
      await react("❌");
      return reply(`❌ Update Failed: ${error.message}\n_Try redeploying manually._`);
    }
  }
);

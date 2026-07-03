const { gmd, config, getSetting, setSetting } = require("../mayel");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

// ─── Platform detection ──────────────────────────────────────────────────────
const ON_HEROKU = !!process.env.DYNO;

// ─── VPS / local: recursive copy helper ─────────────────────────────────────
function copyFolderSync(source, destination, excludeList = []) {
  if (!fs.existsSync(destination)) fs.mkdirSync(destination, { recursive: true });
  for (const item of fs.readdirSync(source)) {
    const srcPath = path.join(source, item);
    const destPath = path.join(destination, item);
    const rel = path.relative(source, srcPath);
    if (excludeList.some(ex => rel.startsWith(ex))) continue;
    if (fs.statSync(srcPath).isDirectory()) copyFolderSync(srcPath, destPath, excludeList);
    else fs.copyFileSync(srcPath, destPath);
  }
}

// ─── Heroku: push a version file to GitHub → triggers GitHub auto-deploy ─────
// This works with your existing GITHUB_TOKEN — no extra Heroku config needed.
async function triggerHerokuRedeploy(repoName, branch, token, latestSha) {
  const ghHeaders = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "HAYWHY-MDX-Bot",
  };

  const filePath = ".version";
  const newContent = Buffer.from(
    `${latestSha}\n${new Date().toISOString()}\n`
  ).toString("base64");

  // Get current file SHA so GitHub allows the update
  let currentSha = null;
  try {
    const { data } = await axios.get(
      `https://api.github.com/repos/${repoName}/contents/${filePath}?ref=${branch}`,
      { headers: ghHeaders, timeout: 10000 }
    );
    currentSha = data.sha;
  } catch (_) {}

  const body = {
    message: `chore: deploy trigger ${latestSha.slice(0, 7)}`,
    content: newContent,
    branch,
  };
  if (currentSha) body.sha = currentSha;

  await axios.put(
    `https://api.github.com/repos/${repoName}/contents/${filePath}`,
    body,
    { headers: ghHeaders, timeout: 15000 }
  );
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
      const ghToken   = process.env.GITHUB_TOKEN;

      // ── Fetch latest commit info ──────────────────────────────────────────
      const { data: commitData } = await axios.get(
        `https://api.github.com/repos/${repoName}/commits/${branch}`,
        {
          headers: {
            "User-Agent": "HAYWHY-MDX-Bot",
            ...(ghToken ? { Authorization: `token ${ghToken}` } : {}),
          },
          timeout: 15000,
        }
      );

      const latestSha    = commitData.sha;
      const commitDate   = new Date(commitData.commit.author.date).toLocaleString();
      const commitMsg    = commitData.commit.message.split("\n")[0].trim();

      // ── Already up to date? ───────────────────────────────────────────────
      if (!ON_HEROKU) {
        const storedHash = getSetting("COMMIT_HASH", "");
        if (latestSha === storedHash) {
          await react("✅");
          return reply("✅ Your bot is already on the latest version!");
        }
      }

      // ── Announce ──────────────────────────────────────────────────────────
      await reply(
        `🔄 *Updating ${config.BOT_NAME}...*\n\n` +
        `👤 *Author:* Dev Haywhy\n` +
        `📅 *Date:* ${commitDate}\n` +
        `💬 *Update:* ${commitMsg}\n\n` +
        `⏳ Please wait...`
      );

      // ══════════════════════════════════════════════════════════════════════
      // HEROKU PATH — push a version marker to GitHub → Heroku auto-redeploys
      // ══════════════════════════════════════════════════════════════════════
      if (ON_HEROKU) {
        if (!ghToken) {
          await react("❌");
          return reply(
            "❌ *GITHUB_TOKEN not found in config vars.*\n" +
            "Add it in your Heroku dashboard → Settings → Config Vars, then retry."
          );
        }

        await triggerHerokuRedeploy(repoName, branch, ghToken, latestSha);

        await react("✅");
        return reply(
          `✅ *Update triggered!*\n\n` +
          `Heroku is now pulling the latest code from GitHub and redeploying.\n` +
          `Your bot will be back up with the new version in *1–2 minutes*.`
        );
      }

      // ══════════════════════════════════════════════════════════════════════
      // VPS / LOCAL PATH — download ZIP, overwrite files, restart process
      // ══════════════════════════════════════════════════════════════════════
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
        ".env", "session", "config.js", "mayel/prince.db",
        "node_modules", "package-lock.json",
      ];

      copyFolderSync(sourcePath, destinationPath, excludeList);
      setSetting("COMMIT_HASH", latestSha);

      try { fs.unlinkSync(zipPath); } catch {}
      try { fs.rmSync(extractPath, { recursive: true, force: true }); } catch {}

      await react("✅");
      await reply("✅ *Update complete! Bot is restarting...*");
      setTimeout(() => process.exit(0), 4000);

    } catch (error) {
      console.error("Update error:", error.message);
      await react("❌");
      return reply(`❌ Update failed: ${error.message}\n_Try redeploying manually._`);
    }
  }
);

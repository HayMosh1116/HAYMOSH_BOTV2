const { gmd, config, getSetting, setSetting } = require("../mayel");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const { execFile } = require("child_process");

// ─── Platform detection ──────────────────────────────────────────────────────
const ON_HEROKU = !!process.env.DYNO;

// ─── VPS / local: recursive copy helper ─────────────────────────────────────
function copyFolderSync(source, destination, excludeList = [], root = source) {
  if (!fs.existsSync(destination)) fs.mkdirSync(destination, { recursive: true });
  for (const item of fs.readdirSync(source)) {
    const srcPath = path.join(source, item);
    const destPath = path.join(destination, item);
    const rel = path.relative(root, srcPath).split(path.sep).join("/");
    if (excludeList.some((ex) => ex.endsWith(".*")
      ? rel === ex.slice(0, -2) || rel.startsWith(`${ex.slice(0, -2)}.`)
      : rel === ex || rel.startsWith(`${ex}/`))) continue;
    if (fs.statSync(srcPath).isDirectory()) copyFolderSync(srcPath, destPath, excludeList, root);
    else fs.copyFileSync(srcPath, destPath);
  }
}

function runPackageInstall() {
  const cwd = path.join(__dirname, "..");
  const packageManager = process.platform === "win32" ? "npm.cmd" : "npm";
  const args = ["install", "--omit=dev", "--ignore-scripts"];
  return new Promise((resolve, reject) => {
    execFile("pnpm", ["install", "--prod", "--ignore-scripts", "--no-frozen-lockfile"],
      { cwd, timeout: 120000 }, (pnpmError, stdout, stderr) => {
        if (!pnpmError) return resolve(stdout);
        execFile(packageManager, args, { cwd, timeout: 120000 },
          (npmError, npmStdout, npmStderr) => {
            if (npmError) return reject(new Error(npmStderr.trim() || npmError.message));
            resolve(npmStdout);
          });
      });
  });
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
      // ── Fetch latest commit info ──────────────────────────────────────────
      const { data: commitData } = await axios.get(
        `https://api.github.com/repos/${repoName}/commits/${branch}`,
        {
          headers: { "User-Agent": "HAYWHY-MDX-Bot" },
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
      // ALL HOSTS — download ZIP, overwrite files, restart process
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

      const extractedRoot = fs.readdirSync(extractPath)
        .map((item) => path.join(extractPath, item))
        .find((item) => fs.statSync(item).isDirectory());
      if (!extractedRoot) throw new Error("GitHub archive did not contain a project directory");
      const sourcePath = extractedRoot;
      const destinationPath = path.join(__dirname, "..");
      const excludeList = [
        ".env", ".env.*", "session", "config.js", "mayel/prince.db",
        "node_modules", "package-lock.json",
        "pnpm-lock.yaml", "latest", `${repoShort}.zip`,
      ];

      copyFolderSync(sourcePath, destinationPath, excludeList, sourcePath);
      if (fs.existsSync(path.join(destinationPath, "package.json"))) {
        await runPackageInstall();
      }
      setSetting("COMMIT_HASH", latestSha);

      try { fs.unlinkSync(zipPath); } catch {}
      try { fs.rmSync(extractPath, { recursive: true, force: true }); } catch {}

      await react("✅");
      await reply(
        `✅ *Update complete! Bot is restarting...*\n\n` +
        `📦 Version: \`${latestSha.slice(0, 7)}\``
      );
      setTimeout(() => process.exit(0), 4000);

    } catch (error) {
      console.error("Update error:", error.message);
      await react("❌");
      return reply(`❌ Update failed: ${error.message}\n_Try redeploying manually._`);
    }
  }
);

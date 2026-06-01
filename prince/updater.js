const { gmd, config, getSetting, setSetting } = require("../mayel");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

// FIXED copy function
function copyFolderSync(source, destination, excludeList = []) {
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const items = fs.readdirSync(source);

  for (const item of items) {
    const srcPath = path.join(source, item);
    const destPath = path.join(destination, item);
    const relativePath = path.relative(source, srcPath);

    // Skip excluded files
    if (excludeList.some(ex => relativePath.startsWith(ex))) {
      continue;
    }

    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      copyFolderSync(srcPath, destPath, excludeList);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

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
    //await reply("🔍 Checking for New Updates...");

      // FORCE PRINCE-MDX REPO
      const repoName = "Princemaye/PRINCE-MDX";

      const { data: commitData } = await axios.get(
        `https://api.github.com/repos/${repoName}/commits/main`
      );

      const latestCommitHash = commitData.sha;
      const currentHash = getSetting("COMMIT_HASH", "");

      if (latestCommitHash === currentHash) {
        return reply("✅ Your Bot is Already on the Latest Version!");
      }

      const authorName = commitData.commit.author.name;
      const authorEmail = commitData.commit.author.email;
      const commitDate = new Date(
        commitData.commit.author.date
      ).toLocaleString();
      const commitMessage = commitData.commit.message;

      await reply(
        `🔄 Updating Bot...\n` +
        `👤 Author: ${authorName} \n` +
        `📅 Date: ${commitDate}\n` +
        `💬 Message: ${commitMessage}`
      );

      const repoShort = "PRINCE-MDX";
      const branch = "main";

      const zipPath = path.join(__dirname, "..", `${repoShort}.zip`);

      // Download ZIP
      const { data: zipData } = await axios.get(
        `https://github.com/${repoName}/archive/${branch}.zip`,
        { responseType: "arraybuffer" }
      );

      fs.writeFileSync(zipPath, zipData);

      // Extract ZIP
      const extractPath = path.join(__dirname, "..", "latest");
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractPath, true);

      const sourcePath = path.join(
        extractPath,
        `${repoShort}-${branch}`
      );

      const destinationPath = path.join(__dirname, "..");
/*
      const excludeList = [
        ".env",
        "session",
        "config.js",
        "mayel/prince.db",
      ];
*/
      const excludeList = [
  ".env",
  "session",
  "config.js",
  "mayel/prince.db",
  "node_modules",
  "package-lock.json",
];
      // Copy files
      copyFolderSync(sourcePath, destinationPath, excludeList);

      setSetting("COMMIT_HASH", latestCommitHash);

      // Cleanup
      try {
        fs.unlinkSync(zipPath);
      } catch {}

      try {
        fs.rmSync(extractPath, { recursive: true, force: true });
      } catch {}

      await reply("✅ Update Complete! Bot is Restarting...");

   setTimeout(() => {
  process.exit(0);
}, 5000);

    } catch (error) {
      console.error("Update error:", error);
      return reply("❌ Update Failed. Please try by Redeploying Manually.");
    }
  }
);

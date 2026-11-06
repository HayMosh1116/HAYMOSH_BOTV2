#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const skipInstall = args.includes("--skip-install");
const appArgIndex = args.indexOf("--app");
const appName = appArgIndex >= 0 ? args[appArgIndex + 1] : process.env.HEROKU_APP_NAME;

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage: npm run preflight:heroku -- [options]

Options:
  --app NAME       Check live Heroku Config Vars for NAME
  --skip-install   Skip npm ci --dry-run
  --json           Print machine-readable results
  --help           Show this help

Environment:
  HEROKU_APP_NAME  Same as --app NAME

The live app check requires the Heroku CLI to be installed and authenticated.`);
  process.exit(0);
}

const results = [];
function add(level, check, message, action = "") {
  results.push({ level, check, message, action });
}
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
  } catch (error) {
    add("error", file, `Cannot read or parse JSON: ${error.message}`, `Fix ${file} and run the preflight again.`);
    return null;
  }
}
function exists(file) {
  if (!fs.existsSync(path.join(ROOT, file))) {
    add("error", "required files", `${file} is missing.`, `Restore ${file} before deploying.`);
    return false;
  }
  add("ok", "required files", `${file} is present.`);
  return true;
}
function run(command, commandArgs, options = {}) {
  return spawnSync(command, commandArgs, {
    cwd: ROOT,
    encoding: "utf8",
    timeout: options.timeout || 120000,
    maxBuffer: 1024 * 1024 * 8,
    ...options,
  });
}

for (const file of ["package.json", "package-lock.json", "Procfile", "app.json", "index.js"]) exists(file);

const pkg = readJson("package.json");
const lock = readJson("package-lock.json");
const app = readJson("app.json");

if (pkg) {
  const engine = String(pkg.engines?.node || "");
  const requiredMajor = engine.match(/(\d+)/)?.[1];
  const currentMajor = process.versions.node.split(".")[0];
  if (!requiredMajor) {
    add("error", "Node runtime", "package.json does not declare a Node engine.", "Declare the Node version Heroku must use.");
  } else if (requiredMajor !== currentMajor) {
    add("warning", "Node runtime", `Local Node ${process.versions.node} differs from declared Node ${engine}.`, "Run the preflight with the same Node major used by Heroku, or update the engine intentionally.");
  } else {
    add("ok", "Node runtime", `Node ${process.versions.node} satisfies ${engine}.`);
  }

  if (typeof pkg.scripts?.start !== "string" || !pkg.scripts.start.trim()) {
    add("error", "start script", "package.json has no start script.", "Add a start script such as `node index.js`.");
  } else {
    add("ok", "start script", `Start command is: ${pkg.scripts.start}`);
  }

  const musicDependency = String(pkg.dependencies?.["prince-baileys"] || "");
  if (!musicDependency) {
    add("error", "WhatsApp dependency", "prince-baileys is not declared.", "Declare the pinned WhatsApp library dependency.");
  } else if (/^https:\/\/github\.com\/[^/]+\/[^/]+\/archive\/[0-9a-f]{40}\.tar\.gz$/i.test(musicDependency)) {
    add("ok", "WhatsApp dependency", `prince-baileys uses a pinned HTTPS archive (${musicDependency.slice(-47, -7)}).`);
  } else if (/ssh|git@|github:|\/main(?:\.git)?$/i.test(musicDependency)) {
    add("error", "WhatsApp dependency", `prince-baileys is not deployment-safe: ${musicDependency}`, "Use a pinned HTTPS commit archive, not a moving branch or SSH Git URL.");
  } else {
    add("warning", "WhatsApp dependency", `prince-baileys source is unusual: ${musicDependency}`, "Confirm that fresh Heroku builds can fetch this source without credentials.");
  }

  const sharpRuntimePackages = {
    "@img/sharp-linux-x64": "0.34.5",
    "@img/sharp-libvips-linux-x64": "1.2.4",
  };
  const optionalDependencies = pkg.optionalDependencies || {};
  for (const [name, version] of Object.entries(sharpRuntimePackages)) {
    if (optionalDependencies[name] !== version) {
      add("error", "Sharp Linux runtime", `${name}@${version} is not declared as an optional dependency.`, `Add ${name}@${version} to optionalDependencies so Linux x64 deployments can load sharp.`);
    }
  }
  if (Object.entries(sharpRuntimePackages).every(([name, version]) => optionalDependencies[name] === version)) {
    add("ok", "Sharp Linux runtime", "Sharp Linux x64 and libvips runtime packages are explicitly declared.");
  }
}

if (lock && pkg) {
  const root = lock.packages?.[""];
  if (!root) {
    add("error", "package lock", "package-lock.json has no root package entry.", "Regenerate it with `npm install --package-lock-only`.");
  } else {
    const lockDependency = root.dependencies?.["prince-baileys"];
    const packageDependency = pkg.dependencies?.["prince-baileys"];
    if (lockDependency !== packageDependency) {
      add("error", "package lock", "package-lock.json and package.json disagree on prince-baileys.", "Run `npm install --package-lock-only` and commit the updated lockfile.");
    } else {
      add("ok", "package lock", "package-lock.json matches package.json for prince-baileys.");
    }
  }
}

const procfile = fs.existsSync(path.join(ROOT, "Procfile")) ? fs.readFileSync(path.join(ROOT, "Procfile"), "utf8").trim() : "";
if (procfile !== "web: node index.js") {
  add("error", "Procfile", `Expected \\"web: node index.js\\", found \\"${procfile || "(empty)"}\\".`, "Set the web process to `node index.js`.");
} else {
  add("ok", "Procfile", "web process runs node index.js.");
}

if (app) {
  if (app.stack !== "heroku-24") add("warning", "Heroku stack", `app.json uses ${app.stack || "no stack"}.`, "Use the supported stack intentionally; new deployments currently target heroku-24.");
  else add("ok", "Heroku stack", "app.json targets heroku-24.");
  if (!app.buildpacks?.some((item) => String(item.url || "").includes("heroku/nodejs"))) add("error", "buildpack", "app.json does not declare the Heroku Node.js buildpack.", "Add the heroku/nodejs buildpack.");
  else add("ok", "buildpack", "Heroku Node.js buildpack is configured.");
  for (const key of ["SESSION_ID", "OWNER_NUMBER"]) {
    if (!app.env?.[key]?.required) add("error", "app Config Vars", `${key} is not marked required in app.json.`, `Mark ${key} as required and configure it before deployment.`);
    else add("ok", "app Config Vars", `${key} is marked required.`);
  }
}

if (!skipInstall) {
  const install = run(process.platform === "win32" ? "npm.cmd" : "npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund", "--dry-run"]);
  if (install.status !== 0) {
    const output = `${install.stdout || ""}${install.stderr || ""}`.trim().split("\n").slice(-8).join(" ");
    add("error", "npm install", `npm ci --dry-run failed: ${output}`, "Fix the reported dependency or lockfile problem before deploying.");
  } else {
    add("ok", "npm install", "npm ci --dry-run completed successfully.");
  }
}

const git = run("git", ["rev-parse", "--short", "HEAD"]);
if (git.status === 0) add("ok", "Git revision", `Deploying repository revision ${git.stdout.trim()}.`);
else add("warning", "Git revision", "Git revision could not be determined.", "Run the preflight from the repository root.");
const dirty = run("git", ["status", "--porcelain"]);
if (dirty.status === 0 && dirty.stdout.trim()) add("warning", "Git worktree", "Uncommitted changes are present.", "Commit and push the intended changes before deploying.");
else if (dirty.status === 0) add("ok", "Git worktree", "Working tree is clean.");

function checkLiveApp() {
  if (!appName) {
    add("warning", "live Heroku app", "No app selected; live Config Vars were not checked.", "Set HEROKU_APP_NAME or run `npm run preflight:heroku -- --app YOUR_APP_NAME`.");
    return;
  }
  const heroku = run("heroku", ["config", "--app", appName, "--json"], { timeout: 30000 });
  if (heroku.error?.code === "ENOENT") {
    add("warning", "live Heroku app", "Heroku CLI is not installed, so live Config Vars were not checked.", "Install/authenticate the Heroku CLI, then rerun with --app.");
    return;
  }
  if (heroku.status !== 0) {
    add("error", "live Heroku app", `Could not read Config Vars for ${appName}: ${(heroku.stderr || heroku.stdout || "unknown Heroku CLI error").trim()}`, "Authenticate the Heroku CLI and verify the app name and access.");
    return;
  }
  let config;
  try { config = JSON.parse(heroku.stdout); } catch (error) {
    add("error", "live Heroku app", `Heroku returned invalid JSON: ${error.message}`, "Retry after authenticating the Heroku CLI.");
    return;
  }
  for (const key of ["SESSION_ID", "OWNER_NUMBER"]) {
    if (!String(config[key] || "").trim()) add("error", "live Config Vars", `${key} is missing or empty on ${appName}.`, `Set it with: heroku config:set ${key}=... --app ${appName}`);
    else add("ok", "live Config Vars", `${key} is configured on ${appName}.`);
  }
  if (config.BOT_MODE && !["public", "private"].includes(String(config.BOT_MODE).toLowerCase())) add("error", "live Config Vars", `BOT_MODE=${config.BOT_MODE} is invalid.`, "Set BOT_MODE to public or private.");
  else add("ok", "live Config Vars", `BOT_MODE is ${config.BOT_MODE ? String(config.BOT_MODE).toLowerCase() : "not set (app default applies)"}.`);
  if (config.DEVELOPER_ALERTS && !["true", "false"].includes(String(config.DEVELOPER_ALERTS).toLowerCase())) add("error", "live Config Vars", `DEVELOPER_ALERTS=${config.DEVELOPER_ALERTS} is invalid.`, "Set DEVELOPER_ALERTS to true or false.");
  else add("ok", "live Config Vars", `DEVELOPER_ALERTS is ${config.DEVELOPER_ALERTS ? String(config.DEVELOPER_ALERTS).toLowerCase() : "not set (false default applies)"}.`);
}
checkLiveApp();

const errors = results.filter((item) => item.level === "error");
const warnings = results.filter((item) => item.level === "warning");
if (jsonOutput) {
  console.log(JSON.stringify({ ok: errors.length === 0, errors: errors.length, warnings: warnings.length, results }, null, 2));
} else {
  const symbols = { ok: "OK ", warning: "WARN", error: "FAIL" };
  for (const item of results) {
    console.log(`[${symbols[item.level]}] ${item.check}: ${item.message}`);
    if (item.action) console.log(`       Action: ${item.action}`);
  }
  console.log(`\nPreflight result: ${errors.length ? "BLOCKED" : "READY"} (${errors.length} errors, ${warnings.length} warnings)`);
  if (!errors.length && warnings.length) console.log("Warnings do not block deployment, but review them before continuing.");
}
process.exit(errors.length ? 1 : 0);

const os = require('os');
const path = require('path');

const DEFAULT_AUTH_DIR = path.join(__dirname, 'session');

function isSameOrAncestor(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function getAuthDir(value = process.env.WA_AUTH_DIR) {
  if (typeof value !== 'string' || !value.trim()) return DEFAULT_AUTH_DIR;
  const resolved = path.resolve(value.trim());
  if (resolved === path.parse(resolved).root) {
    throw new Error('WA_AUTH_DIR must be a dedicated directory, not a filesystem root.');
  }

  const homeDir = os.homedir();
  const appRoot = path.resolve(__dirname, '..');
  if (isSameOrAncestor(resolved, homeDir) ||
      isSameOrAncestor(resolved, appRoot) ||
      isSameOrAncestor(appRoot, resolved)) {
    throw new Error('WA_AUTH_DIR cannot be a filesystem root, the home directory, or inside/above the bot application directory; choose a dedicated auth directory on persistent storage.');
  }
  return resolved;
}

const authDir = getAuthDir();

module.exports = { authDir, getAuthDir };

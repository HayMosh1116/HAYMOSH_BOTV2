const fs = require('fs/promises');
const path = require('path');

async function clearAuthDirectory(directory) {
  const resolvedDirectory = path.resolve(directory);
  let entries;
  try {
    entries = await fs.readdir(resolvedDirectory);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }

  await Promise.all(entries.map((entry) =>
    fs.rm(path.join(resolvedDirectory, entry), { recursive: true, force: true }),
  ));
}

module.exports = { clearAuthDirectory };

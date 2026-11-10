const zlib = require('zlib');

const MAX_ENTRIES = 2000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const decoder = new TextDecoder('utf-8', { fatal: true });
const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < CRC_TABLE.length; index++) {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  CRC_TABLE[index] = value >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function hasZipSignature(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 4 &&
    (buffer.readUInt32LE(0) === LOCAL_SIGNATURE || buffer.readUInt32LE(0) === EOCD_SIGNATURE);
}

function findEndOfCentralDirectory(buffer) {
  const start = Math.max(0, buffer.length - 22 - 0xffff);
  for (let offset = buffer.length - 22; offset >= start; offset--) {
    if (buffer.readUInt32LE(offset) !== EOCD_SIGNATURE) continue;
    const commentLength = buffer.readUInt16LE(offset + 20);
    if (offset + 22 + commentLength === buffer.length) return offset;
  }
  throw new Error('ZIP session archive has no valid end record');
}

function safeArchivePath(name, isDirectory) {
  if (typeof name !== 'string' || !name || name.includes('\\') ||
      name.startsWith('/') || /^[A-Za-z]:/.test(name) || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new Error('ZIP session contains an unsafe path');
  }
  const trimmed = isDirectory && name.endsWith('/') ? name.slice(0, -1) : name;
  const parts = trimmed.split('/');
  if (!parts.length || parts.some(part => !part || part === '.' || part === '..') ||
      !/^[A-Za-z0-9._/-]+$/.test(trimmed)) {
    throw new Error('ZIP session contains an unsafe path');
  }
  return parts.join('/');
}

function decodeZipAuthArchive(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22 || !hasZipSignature(buffer)) {
    throw new Error('Session payload is not a supported ZIP archive');
  }
  const eocd = findEndOfCentralDirectory(buffer);
  const diskNumber = buffer.readUInt16LE(eocd + 4);
  const centralDisk = buffer.readUInt16LE(eocd + 6);
  const entriesOnDisk = buffer.readUInt16LE(eocd + 8);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount ||
      entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff ||
      entryCount === 0 || entryCount > MAX_ENTRIES ||
      centralOffset + centralSize > eocd || centralOffset + centralSize < centralOffset) {
    throw new Error('ZIP session archive uses an unsupported or invalid directory layout');
  }

  const files = new Map();
  const localRanges = [];
  let totalSize = 0;
  let cursor = centralOffset;
  const centralEnd = centralOffset + centralSize;

  for (let index = 0; index < entryCount; index++) {
    if (cursor + 46 > centralEnd || buffer.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) {
      throw new Error('ZIP session archive has a malformed central directory');
    }
    const madeBy = buffer.readUInt16LE(cursor + 4);
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const expectedCrc = buffer.readUInt32LE(cursor + 16);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const diskStart = buffer.readUInt16LE(cursor + 34);
    const externalAttributes = buffer.readUInt32LE(cursor + 38);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const recordEnd = cursor + 46 + nameLength + extraLength + commentLength;
    if (recordEnd > centralEnd || diskStart !== 0 || compressedSize === 0xffffffff ||
        uncompressedSize === 0xffffffff || localOffset === 0xffffffff) {
      throw new Error('ZIP session archive contains an unsupported ZIP64 or multi-disk entry');
    }
    if (flags & 0x41) throw new Error('Encrypted ZIP session archives are not supported');
    if (method !== 0 && method !== 8) throw new Error('ZIP session uses an unsupported compression method');
    const nameBytes = buffer.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = decoder.decode(nameBytes);
    const extraStart = cursor + 46 + nameLength;
    for (let extra = extraStart; extra < extraStart + extraLength;) {
      if (extra + 4 > extraStart + extraLength) throw new Error('ZIP session contains malformed extra data');
      const extraId = buffer.readUInt16LE(extra);
      const extraSize = buffer.readUInt16LE(extra + 2);
      if (extra + 4 + extraSize > extraStart + extraLength) throw new Error('ZIP session contains malformed extra data');
      if (extraId === 0x0001) throw new Error('ZIP64 session archives are not supported');
      extra += 4 + extraSize;
    }

    const unixMode = (madeBy >>> 8) === 3 ? (externalAttributes >>> 16) & 0xffff : 0;
    const fileType = unixMode & 0xf000;
    if (fileType === 0xa000) throw new Error('ZIP session symlinks are not supported');
    const isDirectory = name.endsWith('/') || fileType === 0x4000;
    const safeName = safeArchivePath(name, isDirectory);
    if (uncompressedSize > MAX_FILE_BYTES || compressedSize > buffer.length) {
      throw new Error('ZIP session entry exceeds the allowed size');
    }
    totalSize += uncompressedSize;
    if (totalSize > MAX_TOTAL_BYTES) throw new Error('ZIP session archive exceeds the allowed size');

    if (localOffset + 30 > centralOffset || buffer.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) {
      throw new Error('ZIP session archive has a malformed local file header');
    }
    const localFlags = buffer.readUInt16LE(localOffset + 6);
    const localMethod = buffer.readUInt16LE(localOffset + 8);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const localNameStart = localOffset + 30;
    const dataStart = localNameStart + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (localFlags !== flags || localMethod !== method || localNameLength !== nameLength ||
        dataStart > centralOffset || dataEnd > centralOffset ||
        !buffer.subarray(localNameStart, localNameStart + localNameLength).equals(nameBytes)) {
      throw new Error('ZIP session local and central headers do not match');
    }
    localRanges.push([localOffset, dataEnd]);

    if (!isDirectory && safeName.toLowerCase().endsWith('.json')) {
      if (files.has(safeName)) throw new Error('ZIP session contains duplicate filenames');
      const compressed = buffer.subarray(dataStart, dataEnd);
      let data;
      try {
        data = method === 0
          ? Buffer.from(compressed)
          : zlib.inflateRawSync(compressed, { maxOutputLength: MAX_FILE_BYTES });
      } catch (error) {
        throw new Error(`ZIP session entry could not be decompressed: ${error.message}`);
      }
      if (data.length !== uncompressedSize || crc32(data) !== expectedCrc) {
        throw new Error('ZIP session entry size or checksum is invalid');
      }
      try {
        JSON.parse(data.toString('utf8'));
      } catch (error) {
        throw new Error(`ZIP session entry is not valid JSON: ${safeName}`);
      }
      files.set(safeName, data);
    }
    cursor = recordEnd;
  }
  if (cursor !== centralEnd) throw new Error('ZIP session central-directory length is inconsistent');

  localRanges.sort((a, b) => a[0] - b[0]);
  for (let index = 1; index < localRanges.length; index++) {
    if (localRanges[index][0] < localRanges[index - 1][1]) {
      throw new Error('ZIP session entries overlap');
    }
  }

  if (!files.has('creds.json')) {
    const credentialPaths = [...files.keys()].filter(name => name.endsWith('/creds.json'));
    if (credentialPaths.length === 1) {
      const root = credentialPaths[0].slice(0, -'/creds.json'.length);
      const prefix = `${root}/`;
      if ([...files.keys()].every(name => name.startsWith(prefix))) {
        const normalized = new Map();
        for (const [name, data] of files) {
          const relative = name.slice(prefix.length);
          if (!relative || normalized.has(relative)) throw new Error('ZIP session contains duplicate filenames');
          normalized.set(relative, data);
        }
        files.clear();
        for (const [name, data] of normalized) files.set(name, data);
      }
    }
  }
  if (!files.has('creds.json')) throw new Error('ZIP session archive is missing creds.json');
  const normalizedFiles = new Map();
  for (const [name, data] of files) {
    const relativePath = name.startsWith('keys/') ? name.slice('keys/'.length) : name;
    if (!relativePath || relativePath.includes('/') || normalizedFiles.has(relativePath)) {
      throw new Error('ZIP session auth files do not match the supported Baileys layout');
    }
    normalizedFiles.set(relativePath, data);
  }
  const creds = JSON.parse(normalizedFiles.get('creds.json').toString('utf8'));
  if (!creds || typeof creds !== 'object' || Array.isArray(creds)) {
    throw new Error('ZIP session credentials must be a JSON object');
  }
  files.clear();
  for (const [name, data] of normalizedFiles) files.set(name, data);
  return files;
}

module.exports = { hasZipSignature, decodeZipAuthArchive };

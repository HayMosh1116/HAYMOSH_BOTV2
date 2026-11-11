const test = require('node:test');
const assert = require('node:assert/strict');
const { gmd, commands } = require('../mayel/gmdCmds');

test('normalizes singular alias arrays and merges them into canonical aliases', () => {
  const before = commands.length;
  const registered = gmd({
    pattern: 'registrytestprimary',
    alias: ['OldAlias', 'shared'],
    aliases: ['NewAlias', 'shared'],
  }, async () => {});
  assert.deepEqual(registered.aliases, ['newalias', 'shared', 'oldalias']);
  assert.equal(commands.length, before + 1);
  assert.equal(commands.find((command) => command.aliases.includes('oldalias')), registered);
});

test('normalizes a legacy singular alias string', () => {
  const registered = gmd({ pattern: 'registryteststring', alias: 'LegacyName' }, async () => {});
  assert.deepEqual(registered.aliases, ['legacyname']);
});

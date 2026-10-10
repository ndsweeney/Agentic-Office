const test = require('node:test');
const assert = require('node:assert/strict');
const { hookCommand, quoteShell, mergeHooks } = require('../src/hooks');
const { EVENTS } = require('../src/office');

test('installation preserves settings and hooks and is idempotent', () => {
  const existing = { type: 'command', command: 'echo existing', timeout: 20 };
  const original = { permissions: { allow: ['Read'] }, hooks: { Stop: [{ matcher: '', hooks: [existing] }] } };
  const command = hookCommand('node', '/storage/hook.js', '/storage/events.jsonl', false);
  const once = mergeHooks(original, command);
  assert.deepEqual(mergeHooks(once, command), once);
  assert.deepEqual(once.permissions, original.permissions);
  assert.deepEqual(once.hooks.Stop[0].hooks, [existing]);
  assert.equal(original.hooks.Stop.length, 1);
  for (const name of EVENTS) assert.equal(once.hooks[name].at(-1).hooks[0].command, command);
  const updated = mergeHooks(once, hookCommand('/new/node', '/storage/hook.js', '/storage/events.jsonl', false));
  assert.equal(updated.hooks.Stop.length, 2);
});

test('shell quoting treats configured paths as data', () => {
  assert.equal(quoteShell("/path/it's $(danger);", false), "'/path/it'\\''s $(danger);'");
  assert.equal(quoteShell('C:\\Program Files\\node.exe', true), '"C:\\Program Files\\node.exe"');
  for (const path of ['a"b', '%PATH%', 'a!b']) assert.throws(() => quoteShell(path, true));
  assert.throws(() => quoteShell('node\ncommand', false));
  assert.throws(() => quoteShell('', false));
});

test('invalid settings fail without mutation', () => {
  for (const value of [null, [], { hooks: [] }, { hooks: { Stop: {} } }, { hooks: { Stop: [{}] } }]) {
    assert.throws(() => mergeHooks(value, 'node hook'));
  }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { EventReader } = require('../src/event-reader');

async function temporary(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-office-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return path.join(directory, 'events.jsonl');
}

test('standalone hook safely captures a real payload and reader replays once', async t => {
  const file = await temporary(t);
  const payload = {
    hook_event_name: 'UserPromptSubmit', session_id: 's', prompt: 'Build 🏢',
    cwd: '/workspace', transcript_path: '/private', tool_input: { token: 'do-not-store' }
  };
  const run = spawnSync(process.execPath, [
    path.resolve(__dirname, '../scripts/claude-hook.js'), '--agentic-office', '--output', file
  ], { input: JSON.stringify(payload), encoding: 'utf8' });
  assert.equal(run.status, 0);
  assert.equal(run.stdout, '');
  assert.equal(run.stderr, '');
  const captured = [];
  const reader = new EventReader(file, event => captured.push(event));
  await reader.read();
  await reader.read();
  assert.equal(captured.length, 1);
  assert.equal(captured[0].prompt, payload.prompt);
  assert.equal(captured[0].transcript_path, undefined);
  assert.equal(captured[0].tool_input, undefined);
  if (process.platform !== 'win32') assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
});

test('reader handles partial UTF-8, malformed lines, missing files, and rotation', async t => {
  const file = await temporary(t);
  const captured = [];
  const reader = new EventReader(file, event => captured.push(event));
  await reader.read();
  const bytes = Buffer.from(JSON.stringify({ prompt: '🏢' }) + '\n');
  const split = bytes.indexOf(Buffer.from('🏢')) + 2;
  await fs.writeFile(file, bytes.subarray(0, split));
  await reader.read();
  assert.equal(captured.length, 0);
  await fs.appendFile(file, bytes.subarray(split));
  await reader.read();
  assert.equal(captured[0].prompt, '🏢');
  await fs.appendFile(file, 'not json\n{"ok":true}\n');
  await reader.read();
  assert.equal(captured[1].ok, true);
  await fs.rename(file, file + '.old');
  await fs.writeFile(file, '{"rotated":true}\n');
  await reader.read();
  assert.equal(captured[2].rotated, true);
});

test('reader bounds oversized lines and recovers at the next newline', async t => {
  const file = await temporary(t);
  const captured = [];
  const reader = new EventReader(file, event => captured.push(event));
  await fs.writeFile(file, 'x'.repeat(20000));
  await reader.read();
  await fs.appendFile(file, '\n{"ok":true}\n');
  await reader.read();
  assert.deepEqual(captured, [{ ok: true }]);
});

test('malformed hook input never blocks Claude or writes decisions', async t => {
  const file = await temporary(t);
  const run = spawnSync(process.execPath, [
    path.resolve(__dirname, '../scripts/claude-hook.js'), '--output', file
  ], { input: 'not json', encoding: 'utf8' });
  assert.equal(run.status, 0);
  assert.equal(run.stdout, '');
  await assert.rejects(fs.stat(file), { code: 'ENOENT' });
});

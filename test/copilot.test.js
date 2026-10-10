const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { CopilotReader, CopilotSession } = require('../src/copilot');
const { Office } = require('../src/office');

function raw(type, data, timestamp = '2026-10-10T10:00:00.000Z') {
  return { type, data, id: 'x', timestamp };
}

test('copilot session events translate into office activity with model and provider', () => {
  const session = new CopilotSession();
  const office = new Office();
  const feed = event => session.translate(event).forEach(item => office.apply(item));
  assert.deepEqual(session.translate(raw('user.message', { content: 'early' })), []);
  feed(raw('session.start', { sessionId: 'cop-1', context: { cwd: 'C:\\work\\app' } }));
  feed(raw('session.model_change', { newModel: 'gpt-5.4' }));
  feed(raw('user.message', { content: 'Build a website' }));
  let [main] = office.snapshot();
  assert.equal(main.status, 'working');
  assert.equal(main.provider, 'copilot');
  assert.equal(main.model, 'gpt-5.4');
  assert.equal(main.task, 'Build a website');
  feed(raw('tool.execution_start', { toolCallId: 'c1', toolName: 'bash' }));
  assert.equal(office.snapshot()[0].tool, 'bash');
  feed(raw('subagent.started', { toolCallId: 'sub1', agentName: 'website-builder' }));
  assert.equal(office.snapshot().length, 2);
  const sub = office.snapshot().find(agent => agent.agentId === 'sub1');
  assert.equal(sub.type, 'website-builder');
  assert.equal(sub.status, 'working');
  feed(raw('tool.execution_complete', { toolCallId: 'sub1', model: 'gpt-5.4' }));
  assert.equal(office.snapshot().find(agent => agent.agentId === 'sub1').status, 'finished');
  feed(raw('assistant.message', { phase: 'final_answer', content: 'Done' }));
  [main] = office.snapshot();
  assert.equal(main.status, 'idle');
  feed(raw('session.shutdown', { shutdownType: 'routine' }));
  assert.ok(office.snapshot().every(agent => agent.status === 'finished'));
});

test('copilot reader tails only recent sessions inside the workspace', async t => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-office-copilot-'));
  t.after(() => fs.rm(home, { recursive: true, force: true }));
  const root = path.join(home, 'session-state');
  const write = async (id, cwd) => {
    await fs.mkdir(path.join(root, id), { recursive: true });
    await fs.writeFile(path.join(root, id, 'events.jsonl'),
      JSON.stringify(raw('session.start', { sessionId: id, context: { cwd } })) + '\n' +
      JSON.stringify(raw('user.message', { content: 'hi' })) + '\n');
  };
  const inside = path.join(os.tmpdir(), 'agentic-work', 'app', 'sub');
  const outside = path.join(os.tmpdir(), 'agentic-elsewhere');
  await write('inside', inside);
  await write('outside', outside);
  await write('stale', path.dirname(inside));
  const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  await fs.utimes(path.join(root, 'stale', 'events.jsonl'), old, old);
  const captured = [];
  const reader = new CopilotReader(event => captured.push(event), { home });
  reader.setFolders([path.dirname(inside)]);
  await reader.read();
  assert.deepEqual([...new Set(captured.map(event => event.session_id))], ['inside']);
  assert.ok(captured.every(event => event.provider === 'copilot'));
  const missing = new CopilotReader(() => {}, { home: path.join(home, 'nope') });
  await missing.read();
});

test('hook bridge extracts the model from the transcript tail without storing transcript text', async t => {
  const { spawnSync } = require('node:child_process');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-office-model-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const transcript = path.join(directory, 'session.jsonl');
  await fs.writeFile(transcript,
    JSON.stringify({ type: 'system', message: { model: '<synthetic>' } }) + '\n' +
    JSON.stringify({ type: 'assistant', message: { model: 'claude-opus-5-5', content: 'secret text' } }) + '\n');
  const subagentDir = path.join(directory, 'session', 'subagents');
  await fs.mkdir(subagentDir, { recursive: true });
  await fs.writeFile(path.join(subagentDir, 'agent-a1.jsonl'),
    JSON.stringify({ type: 'assistant', message: { model: 'claude-haiku-5-5' } }) + '\n');
  const output = path.join(directory, 'events.jsonl');
  const run = payload => spawnSync(process.execPath, [
    path.resolve(__dirname, '../scripts/claude-hook.js'), '--agentic-office', '--output', output
  ], { input: JSON.stringify(payload), encoding: 'utf8' });
  run({ hook_event_name: 'PreToolUse', session_id: 's', transcript_path: transcript, tool_name: 'Read' });
  run({ hook_event_name: 'PreToolUse', session_id: 's', transcript_path: transcript, agent_id: 'a1', agent_type: 'Explore', tool_name: 'Grep' });
  run({ hook_event_name: 'SessionStart', session_id: 's', model: 'claude-fable-5-1' });
  const lines = (await fs.readFile(output, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(lines.map(line => line.model), ['claude-opus-5-5', 'claude-haiku-5-5', 'claude-fable-5-1']);
  assert.ok(lines.every(line => !JSON.stringify(line).includes('secret text')));
});

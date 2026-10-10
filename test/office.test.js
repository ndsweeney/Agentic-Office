const test = require('node:test');
const assert = require('node:assert/strict');
const { Office, normalizeEvent } = require('../src/office');

function event(name, extra = {}) {
  return { hook_event_name: name, session_id: 'session', ...extra };
}

test('main session transitions and task preview', () => {
  const office = new Office();
  const status = () => office.snapshot()[0].status;
  office.apply(event('SessionStart'));
  assert.equal(status(), 'idle');
  office.apply(event('UserPromptSubmit', { prompt: 'Implement office' }));
  assert.equal(status(), 'working');
  assert.equal(office.snapshot()[0].task, 'Implement office');
  office.apply(event('PermissionRequest', { tool_name: 'Bash' }));
  assert.equal(status(), 'waiting');
  office.apply(event('PostToolUseFailure', { tool_name: 'Bash' }));
  assert.equal(status(), 'working');
  office.apply(event('Stop'));
  assert.equal(status(), 'idle');
  office.apply(event('SessionEnd'));
  assert.equal(status(), 'finished');
});

test('parallel subagents have independent desks, departments, and tool attribution', () => {
  const office = new Office();
  office.apply(event('SubagentStart', { agent_id: 'a', agent_type: 'Explore' }));
  office.apply(event('SubagentStart', { agent_id: 'b', agent_type: 'Explore' }));
  office.apply(event('PermissionRequest', { agent_id: 'a', agent_type: 'Explore' }));
  office.apply(event('PreToolUse', { agent_id: 'b', tool_name: 'Read' }));
  const agents = office.snapshot({ Explore: 'Research' });
  assert.equal(agents.length, 2);
  assert.notEqual(agents[0].id, agents[1].id);
  assert.equal(agents[0].status, 'waiting');
  assert.equal(agents[1].status, 'working');
  assert.equal(agents[1].tool, 'Read');
  assert.equal(agents[0].department, 'Research');
  assert.equal(agents[0].task, '');
  office.apply(event('SubagentStop', { agent_id: 'a' }));
  assert.equal(office.snapshot()[0].status, 'finished');
  office.apply(event('SessionEnd'));
  assert.ok(office.snapshot().every(agent => agent.status === 'finished'));
});

test('notifications do not falsely report completion and sessions remain isolated', () => {
  const office = new Office();
  office.apply(event('PreToolUse', { agent_type: 'Planner' }));
  office.apply(event('Notification', { notification_type: 'auth_success' }));
  assert.equal(office.snapshot()[0].status, 'working');
  office.apply(event('Notification', { notification_type: 'idle_prompt' }));
  assert.equal(office.snapshot()[0].status, 'waiting');
  office.apply(event('SessionStart', { session_id: 'other' }));
  office.apply(event('SessionEnd'));
  assert.equal(office.snapshot()[1].status, 'idle');
  assert.equal(office.snapshot()[0].agentId, 'main');
  assert.equal(office.snapshot()[0].type, 'Planner');
});

test('invalid input is ignored and private fields are excluded', () => {
  const office = new Office();
  for (const input of [null, {}, event('Unknown'), event('Stop', { session_id: 123 }), event('SubagentStart')]) {
    assert.equal(office.apply(input), false);
  }
  const normalized = normalizeEvent(event('PreToolUse', { tool_input: { secret: 'private' }, transcript_path: '/private' }));
  assert.equal(normalized.tool_input, undefined);
  assert.equal(normalized.transcript_path, undefined);
  assert.equal(normalizeEvent(event('UserPromptSubmit', { prompt: 'x'.repeat(1000) })).prompt.length, 500);
});

test('office bounds agent count and retires finished agents first', () => {
  const office = new Office();
  office.maxAgents = 2;
  office.apply(event('SubagentStart', { agent_id: 'a' }));
  office.apply(event('SubagentStart', { agent_id: 'b' }));
  assert.equal(office.apply(event('SubagentStart', { agent_id: 'c' })), false);
  office.apply(event('SubagentStop', { agent_id: 'a' }));
  assert.equal(office.apply(event('SubagentStart', { agent_id: 'c' })), true);
  assert.deepEqual(office.snapshot().map(agent => agent.agentId), ['b', 'c']);
});

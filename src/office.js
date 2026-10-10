const STATUSES = new Set(['working', 'waiting', 'idle', 'finished']);
const EVENTS = new Set([
  'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse',
  'PostToolUseFailure', 'PermissionRequest', 'Notification', 'Stop',
  'SubagentStart', 'SubagentStop', 'SessionEnd'
]);

function text(value, limit = 500) {
  return typeof value === 'string' ? value.slice(0, limit) : '';
}

function normalizeEvent(input) {
  if (!input || typeof input !== 'object' || !EVENTS.has(input.hook_event_name)) return null;
  const sessionId = text(input.session_id, 200);
  if (!sessionId) return null;
  return {
    hook_event_name: input.hook_event_name,
    session_id: sessionId,
    agent_id: text(input.agent_id, 200),
    agent_type: text(input.agent_type, 100),
    cwd: text(input.cwd, 1000),
    prompt: text(input.prompt),
    tool_name: text(input.tool_name, 100),
    notification_type: text(input.notification_type, 100),
    model: text(input.model, 100),
    provider: input.provider === 'copilot' ? 'copilot' : 'claude',
    received_at: text(input.received_at, 50) || new Date().toISOString()
  };
}

class Office {
  constructor() {
    this.agents = new Map();
    this.maxAgents = 200;
  }

  apply(input) {
    const event = normalizeEvent(input);
    if (!event) return false;
    const isSubagent = event.hook_event_name.startsWith('Subagent');
    if (isSubagent && !event.agent_id) return false;
    if (event.hook_event_name === 'SessionEnd') {
      for (const item of this.agents.values()) {
        if (item.sessionId === event.session_id) {
          item.status = 'finished';
          item.tool = '';
          item.updatedAt = event.received_at;
        }
      }
      return true;
    }
    const id = JSON.stringify([event.session_id, event.agent_id || null]);
    let agent = this.agents.get(id);
    if (!agent) {
      if (this.agents.size >= this.maxAgents) {
        const oldest = [...this.agents.values()].find(item => item.status === 'finished');
        if (!oldest) return false;
        this.agents.delete(oldest.id);
      }
      agent = {
        id, sessionId: event.session_id, agentId: event.agent_id || 'main',
        type: event.agent_type || (event.agent_id ? 'Subagent' : 'Main'),
        provider: event.provider, model: '',
        task: '', tool: '', cwd: event.cwd, status: 'idle', updatedAt: event.received_at
      };
      this.agents.set(id, agent);
    }
    agent.updatedAt = event.received_at;
    if (event.cwd) agent.cwd = event.cwd;
    if (event.agent_type) agent.type = event.agent_type;
    if (event.model) agent.model = event.model;
    switch (event.hook_event_name) {
      case 'SessionStart': agent.status = 'idle'; break;
      case 'UserPromptSubmit':
        agent.task = event.prompt;
        agent.status = 'working';
        agent.tool = '';
        break;
      case 'SubagentStart':
      case 'PreToolUse':
      case 'PostToolUse':
      case 'PostToolUseFailure':
        agent.status = 'working';
        agent.tool = event.tool_name || agent.tool;
        break;
      case 'PermissionRequest':
        agent.status = 'waiting';
        agent.tool = event.tool_name || agent.tool;
        break;
      case 'Notification':
        if (event.notification_type === 'permission_prompt' || event.notification_type === 'idle_prompt') {
          agent.status = 'waiting';
        }
        break;
      case 'Stop': agent.status = 'idle'; agent.tool = ''; break;
      case 'SubagentStop': agent.status = 'finished'; agent.tool = ''; break;
    }
    return true;
  }

  snapshot(departments = {}) {
    return [...this.agents.values()].map(agent => ({
      ...agent,
      department: Object.hasOwn(departments, agent.type) && typeof departments[agent.type] === 'string'
        ? text(departments[agent.type], 100) || agent.type
        : agent.type === 'Main' ? 'Coordination' : agent.type
    }));
  }
}

module.exports = { Office, normalizeEvent, EVENTS, STATUSES };

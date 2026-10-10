const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { EventReader } = require('./event-reader');

const ACTIVE_WINDOW_MS = 12 * 60 * 60 * 1000;
const SCAN_INTERVAL_MS = 5000;

function copilotHome() {
  return process.env.COPILOT_HOME || path.join(os.homedir(), '.copilot');
}

// Translates one Copilot CLI session event into zero or more Agentic Office hook-style events.
// Copilot writes ~/.copilot/session-state/<id>/events.jsonl for CLI sessions and for the
// agent sessions VS Code runs through the CLI. Session state is kept per file.
class CopilotSession {
  constructor() {
    this.sessionId = '';
    this.cwd = '';
    this.model = '';
    this.subagents = new Map(); // toolCallId -> agent name
  }

  translate(raw) {
    if (!raw || typeof raw !== 'object' || typeof raw.type !== 'string') return [];
    const data = raw.data && typeof raw.data === 'object' ? raw.data : {};
    const at = typeof raw.timestamp === 'string' ? raw.timestamp : new Date().toISOString();
    if (raw.type === 'session.start') {
      this.sessionId = typeof data.sessionId === 'string' ? data.sessionId : this.sessionId;
      this.cwd = typeof data.context?.cwd === 'string' ? data.context.cwd : this.cwd;
      return this.emit('SessionStart', at);
    }
    if (!this.sessionId) return [];
    switch (raw.type) {
      case 'session.model_change':
        if (typeof data.newModel === 'string') this.model = data.newModel;
        return this.emit('SessionStart', at);
      case 'user.message':
        return this.emit('UserPromptSubmit', at, { prompt: typeof data.content === 'string' ? data.content : '' });
      case 'subagent.started':
        if (typeof data.toolCallId === 'string' && data.toolCallId) {
          const name = typeof data.agentName === 'string' && data.agentName ? data.agentName : 'Subagent';
          this.subagents.set(data.toolCallId, name);
          return this.emit('SubagentStart', at, { agent_id: data.toolCallId, agent_type: name });
        }
        return [];
      case 'tool.execution_start':
        return this.emit('PreToolUse', at, { tool_name: typeof data.toolName === 'string' ? data.toolName : '' });
      case 'tool.execution_complete': {
        if (typeof data.model === 'string' && data.model) this.model = data.model;
        const name = this.subagents.get(data.toolCallId);
        if (name) {
          this.subagents.delete(data.toolCallId);
          return this.emit('SubagentStop', at, { agent_id: data.toolCallId, agent_type: name });
        }
        return this.emit('PostToolUse', at, { tool_name: typeof data.toolName === 'string' ? data.toolName : '' });
      }
      case 'assistant.turn_start':
        return this.emit('PreToolUse', at);
      case 'assistant.message':
        return data.phase === 'final_answer' ? this.emit('Stop', at) : [];
      case 'session.shutdown':
        return this.emit('SessionEnd', at);
      default:
        return [];
    }
  }

  emit(name, at, extra = {}) {
    return [{
      hook_event_name: name,
      session_id: this.sessionId,
      cwd: this.cwd,
      provider: 'copilot',
      model: this.model,
      received_at: at,
      ...extra
    }];
  }
}

class CopilotReader {
  constructor(onEvent, { home = copilotHome(), now = Date.now } = {}) {
    this.onEvent = onEvent;
    this.root = path.join(home, 'session-state');
    this.now = now;
    this.readers = new Map();
    this.lastScan = 0;
    this.folders = [];
  }

  setFolders(folders) {
    this.folders = folders.map(folder => path.resolve(folder).toLowerCase().replace(/[\\/]+$/, ''));
  }

  inWorkspace(cwd) {
    if (!this.folders.length) return true;
    const target = path.resolve(cwd || '').toLowerCase();
    return this.folders.some(folder => target === folder || target.startsWith(folder + path.sep));
  }

  async scan() {
    let entries;
    try { entries = await fs.readdir(this.root, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') { this.readers.clear(); return; } throw error; }
    const seen = new Set();
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const file = path.join(this.root, entry.name, 'events.jsonl');
      let stat;
      try { stat = await fs.stat(file); } catch { continue; }
      if (this.now() - stat.mtimeMs > ACTIVE_WINDOW_MS) continue;
      seen.add(file);
      if (!this.readers.has(file)) {
        const session = new CopilotSession();
        this.readers.set(file, new EventReader(file, raw => {
          for (const event of session.translate(raw)) {
            if (this.inWorkspace(event.cwd)) this.onEvent(event);
          }
        }));
      }
    }
    for (const file of this.readers.keys()) if (!seen.has(file)) this.readers.delete(file);
  }

  async read() {
    if (this.now() - this.lastScan >= SCAN_INTERVAL_MS) {
      this.lastScan = this.now();
      await this.scan();
    }
    await Promise.all([...this.readers.values()].map(reader => reader.read()));
  }
}

module.exports = { CopilotReader, CopilotSession, copilotHome };

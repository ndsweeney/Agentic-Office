#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

// Keep this file standalone: the installer copies it to stable extension storage.
const events = new Set([
  'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse',
  'PostToolUseFailure', 'PermissionRequest', 'Notification', 'Stop',
  'SubagentStart', 'SubagentStop', 'SessionEnd'
]);
const outputIndex = process.argv.indexOf('--output');
const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : '';
let input = '';
let bytes = 0;
const timer = setTimeout(() => process.exit(0), 2000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  bytes += Buffer.byteLength(chunk);
  if (bytes > 1024 * 1024) process.exit(0);
  input += chunk;
});
process.stdin.on('error', () => process.exit(0));
process.stdin.on('end', () => {
  clearTimeout(timer);
  try {
    const payload = JSON.parse(input);
    if (!output || !path.isAbsolute(output) || !events.has(payload.hook_event_name)) return;
    if (typeof payload.session_id !== 'string' || !payload.session_id) return;
    const event = { received_at: new Date().toISOString() };
    const limits = {
      hook_event_name: 100, session_id: 200, agent_id: 200, agent_type: 100,
      cwd: 1000, prompt: 500, tool_name: 100, notification_type: 100
    };
    for (const [key, limit] of Object.entries(limits)) {
      if (typeof payload[key] === 'string') event[key] = payload[key].slice(0, limit);
    }
    fs.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
    fs.appendFileSync(output, JSON.stringify(event) + '\n', { mode: 0o600 });
  } catch {
    // Visualization must never block Claude or emit hook decision output.
  }
});

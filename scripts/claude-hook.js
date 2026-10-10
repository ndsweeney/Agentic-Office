#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

// Keep this file standalone: the installer copies it to stable extension storage.
const events = new Set([
  'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse',
  'PostToolUseFailure', 'PermissionRequest', 'Notification', 'Stop',
  'SubagentStart', 'SubagentStop', 'SessionEnd'
]);
const TAIL = 64 * 1024;

// Reads only the last 64 KiB of a transcript to find the model of the latest assistant turn.
// No transcript text is kept; the model name is the only thing extracted.
function modelFromTranscript(file) {
  if (typeof file !== 'string' || !path.isAbsolute(file)) return '';
  let handle;
  try {
    handle = fs.openSync(file, 'r');
    const size = fs.fstatSync(handle).size;
    const length = Math.min(TAIL, size);
    const buffer = Buffer.alloc(length);
    fs.readSync(handle, buffer, 0, length, size - length);
    const matches = buffer.toString('utf8').match(/"model":"([^"]{1,100})"/g) || [];
    for (let i = matches.length - 1; i >= 0; i--) {
      const model = matches[i].slice(9, -1);
      if (model && !model.startsWith('<')) return model;
    }
  } catch {
    // Missing or unreadable transcripts simply leave the model unknown.
  } finally {
    if (handle !== undefined) fs.closeSync(handle);
  }
  return '';
}

function expandHome(file) {
  return file.startsWith('~') ? path.join(require('node:os').homedir(), file.slice(1)) : file;
}

function resolveModel(payload) {
  if (typeof payload.model === 'string' && payload.model) return payload.model;
  const candidates = [];
  if (typeof payload.agent_transcript_path === 'string') candidates.push(payload.agent_transcript_path);
  if (typeof payload.agent_id === 'string' && payload.agent_id && typeof payload.transcript_path === 'string') {
    const main = payload.transcript_path;
    const base = path.basename(main, path.extname(main));
    candidates.push(path.join(path.dirname(main), base, 'subagents', 'agent-' + payload.agent_id + '.jsonl'));
  }
  if (typeof payload.transcript_path === 'string') candidates.push(payload.transcript_path);
  for (const candidate of candidates) {
    const model = modelFromTranscript(expandHome(candidate));
    if (model) return model;
  }
  return '';
}

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
    const model = resolveModel(payload);
    if (model) event.model = model.slice(0, 100);
    fs.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
    fs.appendFileSync(output, JSON.stringify(event) + '\n', { mode: 0o600 });
  } catch {
    // Visualization must never block Claude or emit hook decision output.
  }
});

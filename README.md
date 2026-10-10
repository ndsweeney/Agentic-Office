# Agentic Office

A dependency-free VS Code extension that shows Claude Code agents as colored
dots at department desks. It runs **alongside** Claude for VS Code, not inside
Claude's chat panel, and uses Claude's command hooks rather than private extension APIs.

## Run it

1. Install Node.js 18+ where Claude Code runs and use VS Code 1.85+.
2. Open this repository in VS Code and press **F5** to launch the extension
   development host. No dependency installation or compilation is required.
3. In that host, open the trusted workspace where you use Claude Code.
4. Run **Agentic Office: Open Office** from the Command Palette.
5. Click **Install Claude hooks** (or run **Agentic Office: Install Claude Code Hooks**).
   Choose a folder if using a multi-root workspace, and approve the local settings change.
6. Restart Claude Code or start a new session to load hooks. Submit a prompt or
   launch subagents; their desks appear as events arrive.

If `node` is not on Claude's PATH, set `agenticOffice.nodePath` to its executable's
absolute path before installing hooks. This is a machine-scoped setting. For SSH,
WSL, or containers, install/run the extension and Node on that workspace host.
The office polls local activity every 750 ms; it does not require a server or port.

To package for installation, use the standard VS Code extension packaging
workflow (`vsce package`) and **Extensions: Install from VSIX**. Packaging tools
are not bundled with this repository.

## Office and inspector

- Main sessions sit in **Coordination**; subagent types form their own departments.
- Each agent has its own desk, keyed by session and agent ID. Parallel agents
  with the same type remain separate. Click a dot (or focus it and press Enter)
  to inspect status, prompt preview, last tool, IDs, workspace, and last activity.
- Map agent types to departments using the `agenticOffice.departments` setting
  (for example, map `Explore` to `Research`). Changes apply immediately.
- Colors and accessible labels indicate **working** (green), **waiting** (amber),
  **idle** (blue), or **finished** (muted). Motion respects reduced-motion preferences.

## Hook contract and limits

| Event | Interpretation |
| --- | --- |
| `SessionStart` | Main session is idle |
| `UserPromptSubmit` | Main session is working; captures `prompt` preview |
| `SubagentStart` | Agent identified by `agent_id`/`agent_type` is working |
| `PreToolUse`, `PostToolUse`, `PostToolUseFailure` | Agent is working; records `tool_name` |
| `PermissionRequest` | Agent is waiting |
| `Notification` | `permission_prompt` or `idle_prompt` means main session is waiting |
| `Stop` | Main session is idle (a completed turn is not an ended session) |
| `SubagentStop` | Subagent is finished |
| `SessionEnd` | All agents belonging to the session are finished |

Inputs use `hook_event_name`, `session_id`, and optional `cwd`. Tool events use
`agent_id` and `agent_type` **when supplied**; without `agent_id` they update the
main session. A main session may have an `agent_type` without being a subagent.
Lifecycle hooks identify subagents but do **not** provide their assigned prompt;
the inspector explicitly shows that limitation instead of guessing or reading transcripts.

Verified against the [official Anthropic SDK hook input definitions](https://github.com/anthropics/claude-agent-sdk-python/blob/b6e9d12fe1cc98dde988ab7b7713c1feeee50c6c/src/claude_agent_sdk/types.py)
and [official SDK changelog](https://github.com/anthropics/claude-agent-sdk-typescript/blob/85d8f8e0772199ec7965a0c2e874ac88343f2a01/CHANGELOG.md).
The changelog records a VS Code `PermissionRequest` fix in Claude Code 2.1.21
and tool-event agent attribution in SDK 0.2.69. Use a recent Claude Code version:
older builds can omit attribution. The SDK source does not provide complete
`SessionStart`/`SessionEnd` input definitions; this extension only consumes their
common envelope, not unverified event-specific fields.
See the [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)
for your installed version's settings and support.

Status is an **inference from the last observed hook**, not a live heartbeat.
Closing/crashing Claude without a final hook, rejecting permissions, disabling
hooks, or missing version-specific events can leave stale dots. Long-running work
between hooks stays working. Historical activity is replayed when the extension
starts, so the last-activity timestamp matters. At most 200 agents are displayed;
finished agents are evicted first when that limit is reached. Only the most recent
1 MiB of an event backlog is replayed. This can omit older starts/tasks.

## Settings, privacy, and removal

Installation merges hooks into `.claude/settings.local.json`, preserves unrelated
settings/hooks, and creates a uniquely named sibling backup before changing an
existing file. Reinstalling replaces this extension's hooks without duplicating
them. Invalid JSON/settings are rejected without overwriting them. Hooks disabled
by higher-priority Claude settings or organizational policy must be enabled separately.

The standalone bridge is copied into VS Code extension global storage, in a
workspace-specific directory with an `events.jsonl` file. Hook commands contain
these absolute paths, remain valid across extension upgrades, and must be
reinstalled if you move the workspace or switch VS Code profiles.
The bridge emits no hook decisions or stdout and fails open; visualization errors
must not interrupt Claude. Payloads larger than 1 MiB are ignored.

Only IDs, agent type, workspace path, event name, last tool name, notification type,
timestamp, and **up to 500 characters of your prompt** are persisted. Tool inputs,
outputs, credentials, and transcripts are not collected; prompts may nevertheless
contain sensitive information. Install only if you accept local prompt storage.
Files/directories created for activity use owner-only permissions on POSIX;
Windows uses the storage directory's inherited ACLs. No activity is sent over a network.
Webview content uses text-only rendering and a restrictive content security policy.

To uninstall the integration, remove only command hooks containing
`--agentic-office --output` from `.claude/settings.local.json` (or restore a backup
if no newer settings need preserving), then restart Claude. Disabling/uninstalling
the extension alone does not remove installed hooks. Delete the workspace's
`events.jsonl` at the path in those commands to clear saved history; close the
office/extension first. Logs are append-only and are **not automatically deleted**;
remove them periodically for retention/disk usage. Backup settings can also contain
private values and should not be committed.

## Development

- `npm test`: Node's built-in tests for agent state, hook merging/quoting, and the bridge/reader.
- `npm run check`: syntax checks for all production JavaScript.
- F5: manually test the extension host, hook installation, and webview interactions.

No runtime or development dependencies are required.
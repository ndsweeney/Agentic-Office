# Changelog

## 0.1.0

- Live map of Claude Code agents fed by local Claude hooks, plus GitHub Copilot
  CLI sessions read from `~/.copilot/session-state`.
- Four themes, selectable in the panel: 8-bit open-plan office, TNG-style
  starship bridge, single-plane Lemmings level, and a Worms battle on
  destructible terrain.
- Only working or waiting agents are drawn; finished agents play a themed exit.
- Model name shown under every worker, taken from Claude's SessionStart hook or
  the tail of the session transcript, and from Copilot's own events.
- Agent inspector with status, model, provider, department, prompt preview,
  last tool, IDs and workspace.

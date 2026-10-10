const vscode = require('vscode');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { Office } = require('./office');
const { hookCommand, mergeHooks } = require('./hooks');
const { EventReader } = require('./event-reader');
const { CopilotReader } = require('./copilot');

const THEMES = new Set(['office', 'bridge', 'lemmings', 'worms']);

function activate(context) {
  const office = new Office();
  const readers = new Map();
  const copilot = new CopilotReader(event => office.apply(event));
  const output = vscode.window.createOutputChannel('Agentic Office');
  let panel;
  let disposed = false;
  let errorReported = false;

  function locations(folder) {
    const key = crypto.createHash('sha256').update(folder.uri.toString()).digest('hex');
    const directory = path.join(context.globalStorageUri.fsPath, key);
    return { directory, events: path.join(directory, 'events.jsonl'), script: path.join(directory, 'claude-hook.js') };
  }

  function refreshReaders() {
    const folders = vscode.workspace.workspaceFolders || [];
    const active = new Set(folders.map(folder => folder.uri.toString()));
    for (const key of readers.keys()) if (!active.has(key)) readers.delete(key);
    copilot.setFolders(folders.map(folder => folder.uri.fsPath));
    for (const folder of folders) {
      const key = folder.uri.toString();
      if (!readers.has(key)) {
        readers.set(key, new EventReader(locations(folder).events, event => office.apply(event)));
      }
    }
  }

  function update() {
    if (panel) {
      const config = vscode.workspace.getConfiguration('agenticOffice');
      const theme = config.get('theme', 'office');
      panel.webview.postMessage({ type: 'snapshot', agents: office.snapshot(config.get('departments', {})), theme: THEMES.has(theme) ? theme : 'office' });
    }
  }

  async function poll() {
    if (disposed) return;
    try {
      const copilotEnabled = vscode.workspace.getConfiguration('agenticOffice').get('copilotSessions', true);
      await Promise.all([...[...readers.values()].map(reader => reader.read()), copilotEnabled ? copilot.read() : Promise.resolve()]);
      errorReported = false;
      update();
    } catch (error) {
      if (!errorReported) output.appendLine(`Could not read activity: ${error.message}`);
      errorReported = true;
    }
  }

  async function installHooks() {
    if (!vscode.workspace.isTrusted) {
      throw new Error('Trust this workspace before installing Claude Code hooks.');
    }
    const folders = vscode.workspace.workspaceFolders || [];
    const folder = folders.length === 1 ? folders[0] : await vscode.window.showWorkspaceFolderPick();
    if (!folder) return;
    const confirm = await vscode.window.showWarningMessage(
      'Add Agentic Office hooks to this folder’s .claude/settings.local.json? Prompt previews (up to 500 characters) and agent activity will be stored locally. Existing settings will be backed up.',
      { modal: true }, 'Install Hooks'
    );
    if (confirm !== 'Install Hooks') return;
    const settingsPath = path.join(folder.uri.fsPath, '.claude', 'settings.local.json');
    let original;
    try { original = await fs.readFile(settingsPath, 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const settings = original === undefined ? {} : JSON.parse(original);
    if (settings.disableAllHooks === true) {
      throw new Error('Claude hooks are disabled in settings.local.json; enable them before installing.');
    }
    const location = locations(folder);
    const node = vscode.workspace.getConfiguration('agenticOffice').get('nodePath', 'node');
    const merged = mergeHooks(settings, hookCommand(node, location.script, location.events));
    await fs.mkdir(location.directory, { recursive: true, mode: 0o700 });
    await fs.copyFile(path.join(context.extensionPath, 'scripts', 'claude-hook.js'), location.script);
    await fs.chmod(location.script, 0o600);
    await fs.mkdir(path.dirname(settingsPath), { recursive: true });
    if (original !== undefined) {
      const backup = `${settingsPath}.agentic-office-${crypto.randomUUID()}.bak`;
      await fs.writeFile(backup, original, { flag: 'wx', mode: 0o600 });
    }
    await fs.writeFile(settingsPath, JSON.stringify(merged, null, 2) + '\n', { mode: 0o600 });
    refreshReaders();
    vscode.window.showInformationMessage('Agentic Office hooks installed. Restart Claude Code or start a new session to load them.');
  }

  function openOffice() {
    if (panel) { panel.reveal(); return; }
    panel = vscode.window.createWebviewPanel('agenticOffice', 'Agentic Office', vscode.ViewColumn.Beside, {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
    });
    panel.webview.html = html(panel.webview, context.extensionUri);
    panel.onDidDispose(() => { panel = undefined; }, null, context.subscriptions);
    panel.webview.onDidReceiveMessage(message => {
      if (message?.type === 'ready') update();
      if (message?.type === 'installHooks') {
        installHooks().catch(error => vscode.window.showErrorMessage(`Agentic Office: ${error.message}`));
      }
      if (message?.type === 'setTheme' && THEMES.has(message.theme)) {
        vscode.workspace.getConfiguration('agenticOffice').update('theme', message.theme, vscode.ConfigurationTarget.Global)
          .then(undefined, error => output.appendLine(`Could not save theme: ${error.message}`));
      }
    }, null, context.subscriptions);
  }

  refreshReaders();
  const timer = setInterval(poll, 750);
  poll();
  context.subscriptions.push(
    output,
    vscode.commands.registerCommand('agenticOffice.open', openOffice),
    vscode.commands.registerCommand('agenticOffice.installHooks', () =>
      installHooks().catch(error => vscode.window.showErrorMessage(`Agentic Office: ${error.message}`))),
    vscode.workspace.onDidChangeWorkspaceFolders(refreshReaders),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('agenticOffice')) update();
    }),
    { dispose() { disposed = true; clearInterval(timer); panel?.dispose(); } }
  );
}

function html(webview, extensionUri) {
  const nonce = crypto.randomBytes(24).toString('base64');
  const css = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'office.css'));
  const js = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'office.js'));
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${css}"><title>Agentic Office</title></head>
<body>
<header><div><h1>Agentic Office</h1><p>Claude Code + Copilot · live local activity</p></div>
<div class="controls"><label for="theme">Theme</label><select id="theme" class="pixel-box"><option value="office">8-bit office</option><option value="bridge">Starship bridge</option><option value="lemmings">Lemmings</option><option value="worms">Worms</option></select><button id="install" class="pixel-box">Install Claude hooks</button></div></header>
<nav aria-label="Status legend"><span class="working">Working</span><span class="waiting">Waiting</span><span class="idle">Idle</span><span class="finished">Finished</span></nav>
<main><section id="office" class="pixel-box" aria-label="Office map">
<div id="stage"><canvas id="map" aria-hidden="true"></canvas><div id="overlay" role="group" aria-label="Agents at desks"></div></div>
<div id="empty" class="empty"><h2>Your office is ready</h2><p>Install hooks, then start Claude Code in this workspace. Workers appear at desks as activity arrives.</p><p>Requires Node.js 18+ in Claude’s environment. No connection to private VS Code extension APIs is needed.</p></div>
</section>
<aside id="details" class="pixel-box" aria-label="Agent details"><h2>Agent inspector</h2><p>Select a worker at a desk to inspect that agent.</p></aside></main>
<p class="note">Status is inferred from hooks, not a heartbeat. Task previews are available for the main session; subagent tasks are not supplied by lifecycle hooks.</p>
<script nonce="${nonce}" src="${js}"></script></body></html>`;
}

module.exports = { activate };

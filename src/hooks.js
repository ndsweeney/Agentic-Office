const { EVENTS } = require('./office');

function quoteShell(value, windows = process.platform === 'win32') {
  if (typeof value !== 'string' || !value || /[\r\n\0]/.test(value)) {
    throw new Error('Hook command paths must be nonempty and contain no line breaks.');
  }
  if (windows) {
    if (/["%!]/.test(value)) throw new Error('Windows hook paths cannot contain quotes, %, or !.');
    return `"${value}"`;
  }
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

function hookCommand(node, script, output, windows) {
  return `${quoteShell(node, windows)} ${quoteShell(script, windows)} --agentic-office --output ${quoteShell(output, windows)}`;
}

function mergeHooks(settings, command) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new Error('Claude settings must be a JSON object.');
  }
  if (settings.hooks !== undefined && (!settings.hooks || typeof settings.hooks !== 'object' || Array.isArray(settings.hooks))) {
    throw new Error('Existing Claude hooks must be an object.');
  }
  const hooks = { ...settings.hooks };
  for (const event of EVENTS) {
    const existing = hooks[event] || [];
    if (!Array.isArray(existing) || existing.some(group => !group || !Array.isArray(group.hooks))) {
      throw new Error(`Invalid existing hooks for ${event}; settings were not changed.`);
    }
    const groups = existing.map(group => ({
      ...group,
      hooks: group.hooks.filter(hook => !(
        hook.type === 'command' && typeof hook.command === 'string' &&
        hook.command.includes(' --agentic-office --output ')
      ))
    })).filter(group => group.hooks.length);
    groups.push({ matcher: '', hooks: [{ type: 'command', command, timeout: 3 }] });
    hooks[event] = groups;
  }
  return { ...settings, hooks };
}

module.exports = { quoteShell, hookCommand, mergeHooks };

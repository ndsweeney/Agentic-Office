(() => {
  const vscode = acquireVsCodeApi();
  const office = document.getElementById('office');
  const details = document.getElementById('details');
  const statuses = new Set(['working', 'waiting', 'idle', 'finished']);
  let agents = [];
  let selected = vscode.getState()?.selected || '';
  let signature = '';

  function element(tag, content, className) {
    const node = document.createElement(tag);
    if (content) node.textContent = content;
    if (className) node.className = className;
    return node;
  }

  function inspect() {
    details.replaceChildren(element('h2', 'Agent inspector'));
    const agent = agents.find(item => item.id === selected);
    if (!agent) {
      details.append(element('p', 'Select a dot at a desk to inspect an agent.'));
      return;
    }
    details.append(element('h3', agent.type));
    const list = element('dl');
    const fields = {
      Status: agent.status,
      Department: agent.department,
      Task: agent.task || (agent.agentId === 'main' ? 'No prompt received yet.' : 'Not provided by Claude subagent lifecycle hooks.'),
      'Last tool': agent.tool || '—',
      'Agent ID': agent.agentId,
      Session: agent.sessionId,
      Workspace: agent.cwd || '—',
      'Last activity': new Date(agent.updatedAt).toLocaleString()
    };
    for (const [label, value] of Object.entries(fields)) {
      list.append(element('dt', label), element('dd', value));
    }
    details.append(list);
  }

  function render() {
    const focused = document.activeElement?.dataset?.agentId;
    office.replaceChildren();
    if (!agents.length) {
      const empty = element('div', '', 'empty');
      empty.append(element('h2', 'Your office is ready'),
        element('p', 'Install hooks, then start Claude Code in this workspace. Agents appear here as activity arrives.'),
        element('p', 'Requires Node.js 18+ in Claude’s environment. No connection to private VS Code extension APIs is needed.'));
      office.append(empty);
    }
    const departments = new Map();
    for (const agent of agents) {
      if (!departments.has(agent.department)) departments.set(agent.department, []);
      departments.get(agent.department).push(agent);
    }
    for (const [name, members] of departments) {
      const room = element('section', '', 'department');
      room.append(element('h2', `${name} · ${members.length}`));
      const desks = element('div', '', 'desks');
      members.forEach((agent, index) => {
        const desk = element('div', '', 'desk');
        desk.append(element('span', `Desk ${index + 1}`, 'desk-label'));
        const button = element('button', '', `agent ${statuses.has(agent.status) ? agent.status : 'idle'}`);
        button.dataset.agentId = agent.id;
        button.setAttribute('aria-label', `${agent.type}, ${agent.status}, desk ${index + 1}`);
        button.setAttribute('aria-pressed', String(agent.id === selected));
        button.title = `${agent.type}: ${agent.status}`;
        button.append(element('span', '●', 'dot'), element('span', agent.type, 'agent-name'));
        button.addEventListener('click', () => {
          selected = agent.id;
          vscode.setState({ selected });
          for (const dot of office.querySelectorAll('.agent')) dot.setAttribute('aria-pressed', String(dot === button));
          inspect();
        });
        desk.append(button);
        desks.append(desk);
      });
      room.append(desks);
      office.append(room);
    }
    if (focused) {
      [...office.querySelectorAll('.agent')].find(button => button.dataset.agentId === focused)?.focus();
    }
    inspect();
  }

  document.getElementById('install').addEventListener('click', () => vscode.postMessage({ type: 'installHooks' }));
  window.addEventListener('message', event => {
    if (event.data?.type !== 'snapshot' || !Array.isArray(event.data.agents)) return;
    const next = JSON.stringify(event.data.agents);
    if (signature === next) return;
    signature = next;
    agents = event.data.agents;
    render();
  });
  render();
  vscode.postMessage({ type: 'ready' });
})();

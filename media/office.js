(() => {
  const vscode = acquireVsCodeApi();
  const stage = document.getElementById('stage');
  const canvas = document.getElementById('map');
  const overlay = document.getElementById('overlay');
  const empty = document.getElementById('empty');
  const details = document.getElementById('details');
  const themeSelect = document.getElementById('theme');
  const ctx = canvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const TILE = 16;
  const STATUS = { working: '#4ec04e', waiting: '#f0b43c', idle: '#5c9cf5', finished: '#8a8a9a' };
  const HAIR = ['#2b1d12', '#e0b05a', '#b34a2a', '#f2f2f2', '#4b3a7a', '#1d6b4b', '#c94a7a'];
  const SKIN = '#f3c9a0', DARK = '#1a1c2c', BUBBLE_FILL = '#f8f8f8', SELECT = '#ffe14d', TEXT = '#f4f4f4';
  const EXIT_MS = 1400; // how long a finished agent's exit effect plays
  const GRAVITY = 300;

  // 5x7 bitmap font for labels. Rows are top to bottom; '#' is lit.
  const FONT = {
    A: '.###./#...#/#...#/#####/#...#/#...#/#...#', B: '####./#...#/#...#/####./#...#/#...#/####.',
    C: '.####/#..../#..../#..../#..../#..../.####', D: '####./#...#/#...#/#...#/#...#/#...#/####.',
    E: '#####/#..../#..../####./#..../#..../#####', F: '#####/#..../#..../####./#..../#..../#....',
    G: '.####/#..../#..../#.###/#...#/#...#/.####', H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
    I: '#####/..#../..#../..#../..#../..#../#####', J: '..###/...#./...#./...#./...#./#..#./.##..',
    K: '#...#/#..#./#.#../##.../#.#../#..#./#...#', L: '#..../#..../#..../#..../#..../#..../#####',
    M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#', N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
    O: '.###./#...#/#...#/#...#/#...#/#...#/.###.', P: '####./#...#/#...#/####./#..../#..../#....',
    Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#', R: '####./#...#/#...#/####./#.#../#..#./#...#',
    S: '.####/#..../#..../.###./....#/....#/####.', T: '#####/..#../..#../..#../..#../..#../..#..',
    U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.', V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
    W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#', X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
    Y: '#...#/#...#/.#.#./..#../..#../..#../..#..', Z: '#####/....#/...#./..#../.#.../#..../#####',
    0: '.###./#...#/#..##/#.#.#/##..#/#...#/.###.', 1: '..#../.##../..#../..#../..#../..#../.###.',
    2: '.###./#...#/....#/...#./..#../.#.../#####', 3: '#####/...#./..#../...#./....#/#...#/.###.',
    4: '...#./..##./.#.#./#..#./#####/...#./...#.', 5: '#####/#..../####./....#/....#/#...#/.###.',
    6: '..##./.#.../#..../####./#...#/#...#/.###.', 7: '#####/....#/...#./..#../.#.../.#.../.#...',
    8: '.###./#...#/#...#/.###./#...#/#...#/.###.', 9: '.###./#...#/#...#/.####/....#/...#./.##..',
    '-': '...../...../...../#####/...../...../.....', '.': '...../...../...../...../...../.##../.##..',
    ':': '...../.##../.##../...../.##../.##../.....', '/': '....#/....#/...#./..#../.#.../#..../#....',
    '_': '...../...../...../...../...../...../#####', '?': '.###./#...#/....#/...#./..#../...../..#..',
    '!': '..#../..#../..#../..#../..#../...../..#..', ' ': '...../...../...../...../...../...../.....',
    '*': '#####/.###./#####/...../...../...../.....', '~': '.#.#./#.#../...../.#.#./#.#../...../.....',
    "'": '..#../..#../...../...../...../...../.....', '#': '.#.#./#####/.#.#./.#.#./#####/.#.#./.....'
  };
  const UNKNOWN = '#####/#...#/#...#/#...#/#...#/#...#/#####';
  // 3x5 mini font for small tags.
  const MINI = {
    A: '.#./#.#/###/#.#/#.#', B: '##./#.#/##./#.#/##.', C: '.##/#../#../#../.##', D: '##./#.#/#.#/#.#/##.',
    E: '###/#../##./#../###', F: '###/#../##./#../#..', G: '.##/#../#.#/#.#/.##', H: '#.#/#.#/###/#.#/#.#',
    I: '###/.#./.#./.#./###', J: '..#/..#/..#/#.#/.#.', K: '#.#/#.#/##./#.#/#.#', L: '#../#../#../#../###',
    M: '#.#/###/###/#.#/#.#', N: '##./#.#/#.#/#.#/#.#', O: '.#./#.#/#.#/#.#/.#.', P: '##./#.#/##./#../#..',
    Q: '.#./#.#/#.#/.#./..#', R: '##./#.#/##./#.#/#.#', S: '.##/#../.#./..#/##.', T: '###/.#./.#./.#./.#.',
    U: '#.#/#.#/#.#/#.#/###', V: '#.#/#.#/#.#/#.#/.#.', W: '#.#/#.#/###/###/#.#', X: '#.#/#.#/.#./#.#/#.#',
    Y: '#.#/#.#/.#./.#./.#.', Z: '###/..#/.#./#../###', 0: '###/#.#/#.#/#.#/###', 1: '.#./##./.#./.#./###',
    2: '##./..#/.#./#../###', 3: '###/..#/.##/..#/###', 4: '#.#/#.#/###/..#/..#', 5: '###/#../###/..#/###',
    6: '.##/#../###/#.#/###', 7: '###/..#/.#./.#./.#.', 8: '###/#.#/###/#.#/###', 9: '###/#.#/###/..#/##.',
    '-': '.../.../###/.../...', '.': '.../.../.../.../.#.', ' ': '.../.../.../.../...', '?': '##./..#/.#./.../.#.',
    '!': '.#./.#./.#./.../.#.', "'": '.#./.#./.../.../...', ',': '.../.../.../.#./#..', '#': '#.#/###/#.#/###/#.#'
  };

  const SPRITE_BODY = [
    '..HHHHHH..', '.HHHHHHHH.', '.HSSSSSSH.', '.HSESSESH.', '..SSSSSS..', '...SSSS...',
    '..BBBBBB..', '..BBBBBB..', '..BBBBBB..', '..BBBBBB..'
  ];
  const LEMMING = [
    '...GGGG...', '..GGGGGG..', '..GGGGGG..', '..GSSSSG..', '...SSSS...',
    '..BBBBBB..', '..BBBBBB..', '..BBBBBB..', '..BBBBBB..', '..BBBBBB..'
  ];
  const PLANT = ['..GG..', '.GGgG.', 'GGgGGG', '.GGGg.', '..PP..', '.PPPP.'];
  const COOLER = ['.BBBB.', 'BBBBBB', 'BBBBBB', '.WWWW.', '.WWWW.', '.WWWW.', '.WWWW.', '.KKKK.'];
  const PRINTER = ['..KKKKKK..', '.KKKKKKKK.', 'GGGGGGGGGG', 'GGWWWWWWGG', 'GGGGGGGGGG', 'GGGGGGGGGG'];
  const COFFEE = ['KKKKKK', 'KRRRRK', 'KKKKKK', 'K.WW.K', 'K.WW.K', 'KKKKKK'];
  const SOFA = ['SSSSSSSSSSSS', 'SssssssssssS', 'SSSSSSSSSSSS', 'S..........S'];

  let agents = [];      // every agent in the snapshot
  let shown = [];       // only the agents on the map (working or waiting)
  let theme = 'office';
  let selected = vscode.getState()?.selected || '';
  let signature = '';
  let layout = { tilesW: 8, tilesH: 6, rooms: [] };
  let scale = 2;
  let dpr = 1;
  let now = 0;
  let frame = 0;
  let raf = 0;
  const buttons = new Map();
  const exits = [];              // finished agents whose exit effect is still playing
  const lastPositions = new Map();

  // ---------- drawing primitives (base pixel units) ----------
  let g = ctx; // current drawing target; swapped when painting offscreen backdrops
  function rect(x, y, w, h, color) { g.fillStyle = color; g.fillRect(x, y, w, h); }

  function sprite(rows, palette, x, y, size = 1) {
    rows.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        const color = palette[row[rx]];
        if (color) rect(x + rx * size, y + ry * size, size, size, color);
      }
    });
  }

  function flip(rows) { return rows.map(row => [...row].reverse().join('')); }

  function text(value, x, y, color, size = 1) {
    const chars = String(value).toUpperCase();
    for (let i = 0; i < chars.length; i++) {
      const rows = (FONT[chars[i]] || UNKNOWN).split('/');
      rows.forEach((row, ry) => {
        for (let rx = 0; rx < 5; rx++) if (row[rx] === '#') rect(x + i * 6 * size + rx * size, y + ry * size, size, size, color);
      });
    }
  }

  function miniText(value, x, y, color) {
    const chars = String(value).toUpperCase();
    for (let i = 0; i < chars.length; i++) {
      const rows = (MINI[chars[i]] || MINI['?']).split('/');
      rows.forEach((row, ry) => {
        for (let rx = 0; rx < 3; rx++) if (row[rx] === '#') rect(x + i * 4 + rx, y + ry, 1, 1, color);
      });
    }
  }

  function fitText(value, maxPx, size = 1) {
    const max = Math.max(1, Math.floor(maxPx / (6 * size)));
    const chars = String(value);
    return chars.length > max ? chars.slice(0, Math.max(1, max - 1)) + '~' : chars;
  }

  function disc(cx, cy, r, color) {
    for (let dy = -r; dy <= r; dy++) {
      const w = Math.floor(Math.sqrt(r * r - dy * dy));
      rect(cx - w, cy + dy, w * 2 + 1, 1, color);
    }
  }

  function withAlpha(alpha, fn) { g.globalAlpha = Math.max(0, Math.min(1, alpha)); fn(); g.globalAlpha = 1; }

  function hashOf(value) {
    let h = 7;
    for (let i = 0; i < String(value).length; i++) h = (h * 31 + String(value).charCodeAt(i)) >>> 0;
    return h;
  }

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function statusOf(agent) { return STATUS[agent.status] ? agent.status : 'idle'; }

  function modelLabel(agent) {
    const raw = String(agent.model || '').toLowerCase().replace(/^claude-/, '').replace(/-\d{8}$/, '');
    return raw ? raw.slice(0, 12) : '';
  }

  function groupAgents(list) {
    const groups = new Map();
    for (const agent of list) {
      if (!groups.has(agent.department)) groups.set(agent.department, []);
      groups.get(agent.department).push(agent);
    }
    const names = [...groups.keys()].sort((a, b) =>
      a === 'Coordination' ? -1 : b === 'Coordination' ? 1 : a.localeCompare(b));
    return names.map(name => ({ name, members: groups.get(name) }));
  }

  // Offscreen backdrop cache: static scenery is painted once per layout and blitted every frame.
  const backdrops = new Map();
  function backdrop(name, key, W, H, painter) {
    let entry = backdrops.get(name);
    if (!entry || entry.key !== key) {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const previous = g;
      g = c.getContext('2d');
      painter();
      g = previous;
      entry = { key, canvas: c };
      backdrops.set(name, entry);
    }
    return entry.canvas;
  }

  // ---------- shared worker drawing ----------
  function drawSelection(x, y) {
    rect(x - 3, y - 3, TILE * 2 + 6, TILE * 2 + 6, SELECT);
    rect(x - 1, y - 1, TILE * 2 + 2, TILE * 2 + 2, DARK);
    rect(x, y, TILE * 2, TILE * 2, 'rgba(255,225,77,0.18)');
  }

  function drawWorker(x, y, agent, pos, options = {}) {
    const status = statusOf(agent);
    const hair = HAIR[hashOf(agent.id) % HAIR.length];
    const body = options.body || STATUS[status];
    const skin = options.skin || SKIN;
    const step = pos?.moving ? frame % 2 : 0;
    const rows = pos?.dir < 0 ? flip(SPRITE_BODY) : SPRITE_BODY;
    sprite(rows, { H: hair, S: skin, E: DARK, B: body }, x + 11, y + 2 - step, 1);
    if (pos?.moving) {
      rect(x + 11 + (pos.dir > 0 ? 1 : 0), y + 8 - step, 2, 3, skin); rect(x + 19 - (pos.dir > 0 ? 0 : 1), y + 8 - step, 2, 3, skin);
      rect(x + (step ? 13 : 14), y + 12 - step, 2, 3, DARK); rect(x + (step ? 18 : 17), y + 12 - step, 2, 3, DARK);
    } else {
      const armY = status === 'working' && !options.still && frame % 2 ? y + 9 : y + 10;
      rect(x + 11, armY, 2, 3, skin); rect(x + 19, armY, 2, 3, skin);
      rect(x + 13, y + 12, 2, 3, DARK); rect(x + 17, y + 12, 2, 3, DARK);
    }
    if (options.item) options.item(x, y, pos?.dir || 1);
  }

  function drawSpeech(x, y, message, color = DARK) {
    const sw = message.length * 4 + 4;
    rect(x + 16 - Math.floor(sw / 2), y - 14, sw, 8, BUBBLE_FILL); rect(x + 15, y - 6, 2, 2, BUBBLE_FILL);
    miniText(message, x + 18 - Math.floor(sw / 2), y - 13, color);
  }

  function drawStatusBubble(x, y, agent) {
    const status = statusOf(agent);
    const bubble = status === 'waiting' ? '?' : status === 'working' ? '...' : '';
    if (!bubble) return;
    const bw = bubble.length * 6 + 4;
    const bx = x + 22, by = y - 12;
    rect(bx - 1, by - 1, bw + 2, 11, DARK); rect(bx, by, bw, 9, BUBBLE_FILL); rect(bx + 2, by + 9, 2, 2, BUBBLE_FILL);
    text(bubble, bx + 2, by + 1, status === 'waiting' && frame % 2 ? STATUS.waiting : DARK);
  }

  function drawModel(x, y, agent) {
    const label = modelLabel(agent);
    if (!label) return;
    const w = label.length * 4 + 3;
    const lx = x + 16 - Math.floor(w / 2), ly = y + TILE * 2 + 1;
    rect(lx, ly, w, 7, 'rgba(10,10,18,0.85)');
    miniText(label, lx + 2, ly + 1, TEXT);
  }

  function drawBurst(cx, cy, p, color = '#ffe14d') {
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + p * 2;
      rect(Math.round(cx + Math.cos(a) * (4 + p * 14)), Math.round(cy + Math.sin(a) * (4 + p * 14)), 2, 2, color);
    }
  }

  function sparkleColumn(x, y, p, colors) {
    for (let i = 0; i < 26; i++) {
      const h = hashOf(`spark${i}${frame}`);
      const sy = y - 4 + (h >> 4) % 28;
      if ((h + Math.floor(p * 10)) % 3 === 0) rect(x + 10 + h % 13, sy, 1, 2, colors[(h >> 9) % colors.length]);
    }
  }

  // =====================================================================
  // Arena: a stateful top-down crowd used by the office and the bridge.
  // Actors wander, return home, attack each other, shout, enter and exit.
  // Positions scale with the map so resizing never resets the chaos.
  // =====================================================================
  class Arena {
    constructor(cfg) {
      this.cfg = cfg; this.actors = new Map(); this.shots = []; this.beams = []; this.bursts = [];
      this.W = 0; this.H = 0; this.lastTime = 0;
    }

    resize(W, H) {
      if (this.W && this.H && (W !== this.W || H !== this.H)) {
        const kx = W / this.W, ky = H / this.H;
        for (const a of this.actors.values()) { a.x *= kx; a.y *= ky; a.tx *= kx; a.ty *= ky; }
        for (const s of this.shots) { s.x0 *= kx; s.y0 *= ky; }
      }
      this.W = W; this.H = H;
    }

    sync(entries) {
      const seen = new Set();
      for (const { agent, home } of entries) {
        seen.add(agent.id);
        let actor = this.actors.get(agent.id);
        if (!actor) {
          actor = { id: agent.id, agent, x: home.x, y: home.y, tx: home.x, ty: home.y, home, dir: home.dir || 1,
            state: 'home', until: now + rand(1500, 4000), say: null, enteredAt: now, hitUntil: 0, moving: false, item: null };
          this.actors.set(agent.id, actor);
          if (this.cfg.quips.enter) this.shout(actor, pick(this.cfg.quips.enter));
        } else {
          actor.agent = agent;
          const moved = actor.home.x !== home.x || actor.home.y !== home.y;
          actor.home = home;
          if (moved && actor.state === 'home') { actor.tx = home.x; actor.ty = home.y; }
        }
      }
      for (const id of this.actors.keys()) if (!seen.has(id)) this.actors.delete(id);
    }

    shout(actor, message) { actor.say = { text: message, until: now + 1800 }; }

    step(dt) {
      const list = [...this.actors.values()];
      for (const actor of list) {
        const working = statusOf(actor.agent) === 'working';
        if (now - actor.enteredAt < this.cfg.enterMs) continue;      // still arriving
        if (now < actor.hitUntil) { actor.moving = false; continue; } // staggered
        if (!working) { actor.tx = actor.home.x; actor.ty = actor.home.y; actor.state = 'home'; }
        else if (now >= actor.until) {
          const roll = Math.random();
          const others = list.filter(other => other !== actor && now - other.enteredAt >= this.cfg.enterMs);
          if (roll < 0.34) { actor.state = 'home'; actor.tx = actor.home.x; actor.ty = actor.home.y; actor.until = now + rand(2500, 7000); }
          else if (roll < 0.72) { const p = this.cfg.randomPoint(); actor.state = 'walk'; actor.tx = p.x; actor.ty = p.y; actor.until = now + rand(2500, 6000); }
          else if (roll < 0.9 && others.length) { this.attack(actor, pick(others)); actor.until = now + rand(1200, 2500); }
          else { this.shout(actor, pick(this.cfg.quips.random)); actor.until = now + rand(1500, 3000); }
        }
        if (actor.state !== 'attack') {
          const dx = actor.tx - actor.x, dy = actor.ty - actor.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 1.5) {
            const move = Math.min(dist, this.cfg.speed * dt);
            actor.x += dx / dist * move; actor.y += dy / dist * move;
            actor.dir = dx < 0 ? -1 : 1; actor.moving = true;
          } else { actor.x = actor.tx; actor.y = actor.ty; actor.moving = false; }
        } else if (now >= actor.until) actor.state = 'home';
      }
      for (let i = this.shots.length - 1; i >= 0; i--) {
        const s = this.shots[i];
        if (now - s.start >= s.dur) { this.hit(s.victim, s.attacker); this.shots.splice(i, 1); }
      }
      this.beams = this.beams.filter(b => now < b.until);
      this.bursts = this.bursts.filter(b => now - b.start < 500);
    }

    attack(attacker, victim) {
      const weapon = pick(this.cfg.weapons);
      attacker.state = 'attack'; attacker.moving = false;
      attacker.dir = victim.x >= attacker.x ? 1 : -1;
      attacker.item = { weapon, until: now + 900 };
      this.shout(attacker, pick(this.cfg.quips.attack));
      if (weapon.kind === 'beam') {
        this.beams.push({ x0: attacker.x + 16 + attacker.dir * 8, y0: attacker.y + 8, victim, until: now + 350, color: weapon.color, core: weapon.core });
        this.hit(victim, attacker);
      } else {
        this.shots.push({ x0: attacker.x + 16, y0: attacker.y + 6, victim, attacker, start: now, dur: 550, weapon });
      }
    }

    hit(victim, attacker) {
      if (!this.actors.has(victim.id)) return;
      victim.hitUntil = now + 700;
      victim.say = { text: pick(this.cfg.quips.hit), until: now + 1600 };
      this.bursts.push({ x: victim.x + 16, y: victim.y + 6, start: now });
      const push = victim.x >= attacker.x ? 5 : -5;
      victim.x = Math.max(0, Math.min(this.W - 32, victim.x + push));
    }

    drawEffects() {
      for (const s of this.shots) {
        const t = Math.min(1, (now - s.start) / s.dur);
        const x = Math.round(s.x0 + (s.victim.x + 16 - s.x0) * t);
        const y = Math.round(s.y0 + (s.victim.y + 6 - s.y0) * t - 28 * 4 * t * (1 - t));
        s.weapon.draw(x, y, t);
      }
      for (const b of this.beams) {
        const x1 = b.victim.x + 16, y1 = b.victim.y + 8;
        const steps = Math.max(1, Math.floor(Math.hypot(x1 - b.x0, y1 - b.y0) / 2));
        for (let i = 0; i <= steps; i++) {
          const x = Math.round(b.x0 + (x1 - b.x0) * i / steps), y = Math.round(b.y0 + (y1 - b.y0) * i / steps);
          rect(x - 1, y - 1, 3, 3, b.color); rect(x, y, 1, 1, b.core);
        }
      }
      for (const b of this.bursts) drawBurst(b.x, b.y, (now - b.start) / 500);
    }
  }

  // Shared helpers for themes built on an arena.
  function arenaPosition(arena, desk) {
    const actor = arena.actors.get(desk.agent.id);
    if (!actor) return { x: desk.x * TILE, y: desk.y * TILE, moving: false, dir: 1, away: false };
    return { x: Math.round(actor.x), y: Math.round(actor.y), moving: actor.moving, dir: actor.dir, away: actor.state !== 'home' || actor.moving };
  }

  function drawActor(arena, desk, pos, enterEffect) {
    const { agent } = desk;
    const actor = arena.actors.get(agent.id);
    if (!actor) return;
    const entering = (now - actor.enteredAt) / arena.cfg.enterMs;
    const hurt = now < actor.hitUntil;
    const draw = () => drawWorker(pos.x, pos.y + (hurt && frame % 2 ? -1 : 0), agent, pos, {
      body: hurt && frame % 2 ? '#ffffff' : undefined,
      still: actor.state === 'attack',
      item: actor.item && now < actor.item.until ? (x, y, dir) => actor.item.weapon.hold?.(x, y, dir) : null
    });
    if (entering < 1 && enterEffect) enterEffect(pos.x, pos.y, entering, draw);
    else draw();
    if (actor.say && now < actor.say.until) drawSpeech(pos.x, pos.y - 2, actor.say.text, hurt ? '#c0392b' : DARK);
    else if (statusOf(agent) === 'waiting') drawStatusBubble(pos.x, pos.y, agent);
    drawModel(pos.x, pos.y, agent);
  }

  // =====================================================================
  // Theme: 8-bit open-plan office
  // =====================================================================
  const OFFICE_QUIPS = {
    enter: ['MORNING!', 'HI TEAM', 'COFFEE FIRST', 'WHERE DO I SIT?'],
    random: ['STANDUP?', 'COFFEE!', 'WORKS ON MY MACHINE', 'WHO BROKE MAIN?', 'TICKET #42', 'LUNCH?', 'MERGE IT', 'NEEDS TESTS', 'ONE MORE EDIT', 'IS IT FRIDAY?'],
    attack: ['CODE REVIEW!', 'REBASE THIS!', 'MY STAPLER!', 'DEPLOY FRIDAY!', 'HOTFIX!', 'LGTM?!', 'FORCE PUSH!', 'SYNERGY!'],
    hit: ['OW!', 'MERGE CONFLICT!', 'NOT AGAIN', 'HR!', 'SEGFAULT!', '404 BRAIN', 'MY MUG!', 'REVERT!']
  };
  const OFFICE_WEAPONS = [
    { name: 'stapler', kind: 'throw', draw: (x, y) => { rect(x - 4, y - 2, 8, 3, '#c0392b'); rect(x - 4, y - 3, 8, 1, '#d8d8e8'); }, hold: (x, y, d) => rect(x + (d > 0 ? 20 : 6), y + 8, 6, 3, '#c0392b') },
    { name: 'keyboard', kind: 'throw', draw: (x, y) => { rect(x - 5, y - 2, 10, 4, '#8c8fa8'); rect(x - 4, y - 1, 8, 1, '#d8d8e8'); }, hold: (x, y, d) => rect(x + (d > 0 ? 20 : 4), y + 7, 8, 3, '#8c8fa8') },
    { name: 'mug', kind: 'throw', draw: (x, y) => { rect(x - 2, y - 3, 5, 5, '#f0f0f0'); rect(x + 3, y - 2, 1, 2, '#f0f0f0'); rect(x - 1, y - 2, 3, 1, '#5a3414'); }, hold: (x, y, d) => rect(x + (d > 0 ? 21 : 7), y + 7, 4, 4, '#f0f0f0') },
    { name: 'chair', kind: 'throw', draw: (x, y) => { rect(x - 5, y - 5, 10, 4, '#2a2b3f'); rect(x - 4, y, 8, 3, '#2a2b3f'); rect(x - 1, y + 3, 2, 3, '#8c8fa8'); rect(x - 5, y + 6, 10, 1, '#8c8fa8'); }, hold: (x, y, d) => rect(x + (d > 0 ? 20 : 2), y + 2, 10, 6, '#2a2b3f') },
    { name: 'monitor', kind: 'throw', draw: (x, y) => { rect(x - 5, y - 4, 10, 7, '#1e1f30'); rect(x - 4, y - 3, 8, 4, '#5c9cf5'); }, hold: (x, y, d) => rect(x + (d > 0 ? 20 : 2), y + 3, 10, 6, '#1e1f30') },
    { name: 'rubber band', kind: 'beam', color: '#ffe14d', core: '#fff6b0', hold: (x, y, d) => rect(x + (d > 0 ? 20 : 8), y + 8, 4, 1, '#ffe14d') }
  ];
  const officeArena = new Arena({
    speed: 26, enterMs: 900, weapons: OFFICE_WEAPONS, quips: OFFICE_QUIPS,
    randomPoint() {
      for (let i = 0; i < 12; i++) {
        const x = rand(TILE + 2, officeArena.W - TILE * 3 - 2), y = rand(TILE + 2, officeArena.H - TILE * 3 - 2);
        if (!office.furniture.some(f => x + 32 > f.x && x < f.x + f.w && y + 32 > f.y && y < f.y + f.h)) return { x, y };
      }
      return { x: officeArena.W / 2, y: officeArena.H / 2 };
    }
  });

  const office = {
    label: '8-bit office',
    fps: 30,
    minTiles: 14,
    emptyText: 'WAITING FOR AGENTS',
    quietText: 'ALL QUIET',
    carpets: ['#3d5a80', '#5a6b3d', '#6b3d5a', '#3d6b6b', '#6b5a3d', '#5a3d6b', '#4a6b5a', '#6b4a4a'],
    furniture: [],
    P: {
      outside: '#1a1c2c', floorA: '#4a4c63', floorB: '#51536b', grout: '#3a3c52',
      wallTop: '#7b7ea0', wallFace: '#4b4d6b', wallDark: '#2e3047', plaque: '#23243a',
      deskTop: '#a8743f', deskEdge: '#6b4424', monitor: '#1e1f30', key: '#d8d8e8', chair: '#2a2b3f',
      pot: '#8a4b2a', leaf: '#4ec04e', leafDark: '#2f8a3a', water: '#5c9cf5', window: '#9ad0ff'
    },
    layout(groups, tilesW) {
      const W = Math.max(office.minTiles, tilesW);
      const rooms = [];
      const furniture = [];
      let x = 2, y = 2, rowHeight = 0;
      groups.forEach(({ name, members }, index) => {
        const maxCols = Math.max(1, Math.min(3, Math.floor((W - 6) / 3)));
        const cols = Math.max(1, Math.min(members.length, maxCols));
        const rows = Math.ceil(members.length / cols);
        const w = cols * 3, h = rows * 3 + 1;
        if (x > 2 && x + w + 1 > W - 2) { x = 2; y += rowHeight + 1; rowHeight = 0; }
        const desks = members.map((agent, i) => ({ agent, index: i, x: x + (i % cols) * 3, y: y + 1 + Math.floor(i / cols) * 3 }));
        for (const desk of desks) furniture.push({ x: desk.x * TILE - 2, y: desk.y * TILE - 2, w: TILE * 2 + 4, h: TILE * 2 + 4 });
        rooms.push({ name, x, y, w, h, cols, rows, desks, carpet: office.carpets[index % office.carpets.length] });
        x += w + 1;
        rowHeight = Math.max(rowHeight, h);
      });
      const H = Math.max(10, (rooms.length ? y + rowHeight : 6) + 2);
      office.furniture = furniture;
      const entries = [];
      for (const room of rooms) for (const desk of room.desks) entries.push({ agent: desk.agent, home: { x: desk.x * TILE, y: desk.y * TILE, dir: 1 } });
      officeArena.resize(W * TILE, H * TILE);
      officeArena.sync(entries);
      return { tilesW: W, tilesH: H, rooms };
    },
    standing(desk) { return arenaPosition(officeArena, desk); },
    walk(desk) { return arenaPosition(officeArena, desk); },
    paintBackdrop(L) {
      const P = office.P;
      const W = L.tilesW, H = L.tilesH;
      rect(0, 0, W * TILE, H * TILE, P.outside);
      for (let ty = 1; ty < H - 1; ty++) for (let tx = 1; tx < W - 1; tx++) {
        rect(tx * TILE, ty * TILE, TILE, TILE, (tx + ty) % 2 ? P.floorA : P.floorB);
        rect(tx * TILE, ty * TILE, TILE, 1, P.grout); rect(tx * TILE, ty * TILE, 1, TILE, P.grout);
      }
      // outer walls with windows along the top
      rect(0, 0, W * TILE, TILE, P.wallFace); rect(0, 0, W * TILE, 6, P.wallTop);
      for (let tx = 3; tx < W - 3; tx += 5) { rect(tx * TILE + 2, 3, TILE * 2 - 4, 10, P.window); rect(tx * TILE + TILE - 1, 3, 2, 10, P.wallFace); }
      rect(0, (H - 1) * TILE, W * TILE, TILE, P.wallFace); rect(0, (H - 1) * TILE, W * TILE, 6, P.wallTop);
      rect(0, 0, TILE, H * TILE, P.wallFace); rect(0, 0, 6, H * TILE, P.wallTop);
      rect((W - 1) * TILE, 0, TILE, H * TILE, P.wallFace); rect(W * TILE - 6, 0, 6, H * TILE, P.wallTop);
      const doorX = Math.floor(W / 2) * TILE;
      rect(doorX, (H - 1) * TILE, TILE * 2, TILE, P.floorA); rect(doorX, (H - 1) * TILE, 2, TILE, P.deskEdge); rect(doorX + TILE * 2 - 2, (H - 1) * TILE, 2, TILE, P.deskEdge);
      // pods: carpet patch, floor sign, desks
      for (const room of L.rooms) {
        rect(room.x * TILE - 4, room.y * TILE - 4, room.w * TILE + 8 - TILE, room.h * TILE + 8, room.carpet);
        const label = fitText(room.name, room.w * TILE - TILE - 8);
        rect(room.x * TILE, room.y * TILE + 2, label.length * 6 + 6, 11, P.plaque);
        text(label, room.x * TILE + 3, room.y * TILE + 4, TEXT);
        for (const desk of room.desks) {
          const x = desk.x * TILE, y = desk.y * TILE;
          rect(x + 9, y + 1, 14, 4, P.chair); rect(x + 7, y + 8, 18, 7, P.chair);
          rect(x, y + TILE, TILE * 2, TILE, P.deskTop);
          rect(x, y + TILE, TILE * 2, 2, '#c48b52'); rect(x, y + TILE * 2 - 3, TILE * 2, 3, P.deskEdge);
          rect(x + 10, y + TILE + 2, 12, 8, P.monitor); rect(x + 15, y + TILE + 10, 2, 2, P.monitor); rect(x + 11, y + TILE + 12, 10, 2, P.key);
        }
      }
      // decor in the corners
      sprite(PLANT, { G: P.leaf, g: P.leafDark, P: P.pot }, W * TILE - TILE * 2 + 2, TILE + 4, 2);
      sprite(COOLER, { B: P.water, W: '#dff7ff', K: '#8c8fa8' }, W * TILE - TILE * 2 + 2, TILE * 3, 2);
      sprite(PRINTER, { K: '#2a2b3f', G: '#8c8fa8', W: '#f0f0f0' }, TILE + 4, (H - 3) * TILE + 2, 2);
      sprite(COFFEE, { K: '#2a2b3f', R: '#c0392b', W: '#f0f0f0' }, W * TILE - TILE * 2 + 2, (H - 3) * TILE + 2, 2);
      sprite(SOFA, { S: '#6b3d5a', s: '#8a5a78' }, TILE + 4, TILE + 6, 2);
      sprite(PLANT, { G: P.leaf, g: P.leafDark, P: P.pot }, TILE + 4, TILE * 3 + 4, 2);
    },
    drawScene(L) {
      const dt = reducedMotion.matches ? 0 : Math.min(0.05, Math.max(0, (now - officeArena.lastTime) / 1000));
      officeArena.lastTime = now;
      if (dt) officeArena.step(dt);
      const key = JSON.stringify([L.tilesW, L.tilesH, L.rooms.map(r => [r.name, r.x, r.y, r.w, r.h, r.desks.length])]);
      g.drawImage(backdrop('office', key, L.tilesW * TILE, L.tilesH * TILE, () => office.paintBackdrop(L)), 0, 0);
      for (const room of L.rooms) for (const desk of room.desks) rect(desk.x * TILE + 12, desk.y * TILE + TILE + 4, 8, 4, statusOf(desk.agent) === 'working' && frame % 4 === 3 ? '#dff7ff' : STATUS[statusOf(desk.agent)]);
    },
    drawSeat(desk, pos) {
      if (desk.agent.id === selected) drawSelection(pos.x, pos.y);
      drawActor(officeArena, desk, pos, (x, y, p, draw) => withAlpha(p, draw));
    },
    drawEffects() { officeArena.drawEffects(); },
    explode(exit, p) {
      // off home: a puff of smoke and a farewell
      const cx = exit.x + 16, cy = exit.y + 8;
      for (let i = 0; i < 7; i++) {
        const h = hashOf(`puff${i}`);
        disc(cx - 10 + h % 20, cy - Math.round(p * 20) + (h >> 4) % 10, Math.max(1, Math.round(5 * (1 - p))), (h >> 8) % 2 ? '#9a9aa8' : '#c8c8d8');
      }
      if (p < 0.4) withAlpha(1 - p * 2.5, () => drawWorker(exit.x, exit.y, { id: exit.id, status: 'finished' }, null));
      if (p < 0.8) drawSpeech(exit.x, exit.y - 4 - Math.round(p * 10), 'HOME TIME!');
    }
  };

  // =====================================================================
  // Theme: starship bridge (TNG-style layout)
  // =====================================================================
  const BRIDGE_QUIPS = {
    enter: ['REPORTING, SIR', 'PERMISSION TO COME ABOARD', 'ENERGIZED'],
    random: ['ENGAGE!', 'MAKE IT SO', 'RED ALERT!', 'SHIELDS UP', 'FASCINATING', 'TEA, EARL GREY', 'HAILING...', 'SENSORS CLEAR', 'WARP 9!', 'IT\'S A TRAP'],
    attack: ['FOR THE EMPIRE!', "QAPLA'!", 'TODAY IS A GOOD DAY TO DIE', 'GLORY TO THE EMPIRE!', 'HONOR!', 'FOR KAHLESS!', 'BATTLE STATIONS!'],
    hit: ['ARGH!', 'MEDICAL!', 'SHIELDS!', 'I YIELD!', 'DISHONOR!', 'SICKBAY!', 'MY UNIFORM!']
  };
  const BRIDGE_WEAPONS = [
    { name: 'phaser', kind: 'beam', color: '#ff7a1a', core: '#ffe14d', hold: (x, y, d) => { rect(x + (d > 0 ? 20 : 7), y + 8, 5, 2, '#8c8fa8'); rect(x + (d > 0 ? 24 : 7), y + 7, 1, 1, '#ff7a1a'); } },
    { name: 'phaser', kind: 'beam', color: '#ff7a1a', core: '#ffe14d', hold: (x, y, d) => { rect(x + (d > 0 ? 20 : 7), y + 8, 5, 2, '#8c8fa8'); rect(x + (d > 0 ? 24 : 7), y + 7, 1, 1, '#ff7a1a'); } },
    { name: 'disruptor', kind: 'beam', color: '#4ec04e', core: '#dfffdf', hold: (x, y, d) => rect(x + (d > 0 ? 20 : 6), y + 8, 6, 2, '#3a3550') },
    { name: 'padd', kind: 'throw', draw: (x, y) => { rect(x - 4, y - 3, 8, 6, '#2a2d40'); rect(x - 3, y - 2, 6, 4, '#ff9966'); }, hold: (x, y, d) => rect(x + (d > 0 ? 20 : 4), y + 6, 7, 5, '#2a2d40') }
  ];
  const bridgeArena = new Arena({
    speed: 24, enterMs: 1500, weapons: BRIDGE_WEAPONS, quips: BRIDGE_QUIPS,
    randomPoint() {
      const b = bridge.geometry;
      for (let i = 0; i < 12; i++) {
        const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * 0.82;
        const x = b.cx + Math.cos(a) * b.rx * r - 16, y = b.cy + Math.sin(a) * b.ry * r - 16;
        if (y > b.cy - b.ry * 0.7 && !(Math.hypot((x + 16 - b.cx) / b.rx, (y + 16 - b.cy) / b.ry) < 0.3)) return { x, y };
      }
      return { x: b.cx - 16, y: b.cy + b.ry * 0.5 };
    }
  });

  const bridge = {
    label: 'Starship bridge',
    fps: 30,
    minTiles: 26,
    emptyText: 'AWAITING CREW',
    quietText: 'ALL STATIONS QUIET',
    geometry: { cx: 0, cy: 0, rx: 1, ry: 1 },
    P: {
      space: '#05060f', star: '#ffffff', starDim: '#7a7f9a', hull: '#d8d6cc', hullDark: '#8f8e86', hullLine: '#b9b7ad',
      floor: '#3f5f8f', floorLight: '#4a6c9f', carpet: '#b8402e', carpetLight: '#cf5a45', platform: '#c2452f',
      rail: '#8a5a2a', railLight: '#b8803f', screen: '#0b1030', bezel: '#c0c4d8', planet: '#5c9cf5', planetLight: '#9ad0ff', planetDark: '#2f5fa8',
      console: '#2a2d40', consoleTop: '#4f5468', amber: '#ff9966', lilac: '#cc99cc', peach: '#ffcc99', blue: '#9999ff',
      chair: '#e8e4d0', chairDark: '#b9b4a0', door: '#9aa0b4', doorSeam: '#5c6176', label: '#f4f4f4'
    },
    // Station slots in priority order. Fractions of the bridge ellipse; dir is the facing.
    stations: {
      command: [
        { key: 'captain', label: "CAPTAIN", fx: 0, fy: 0.08, dir: 1 },
        { key: 'xo', label: '1ST OFFICER', fx: 0.21, fy: 0.08, dir: -1 },
        { key: 'counselor', label: 'COUNSELOR', fx: -0.21, fy: 0.08, dir: 1 }
      ],
      crew: [
        { key: 'conn', label: 'CONN', fx: -0.14, fy: -0.5, dir: 1 },
        { key: 'ops', label: 'OPS', fx: 0.14, fy: -0.5, dir: -1 },
        { key: 'tactical', label: 'TACTICAL', fx: 0, fy: 0.5, dir: 1 },
        { key: 'science1', label: 'SCIENCE I', fx: -0.52, fy: 0.62, dir: 1 },
        { key: 'science2', label: 'SCIENCE II', fx: -0.28, fy: 0.78, dir: 1 },
        { key: 'engineering', label: 'ENGINEERING', fx: 0, fy: 0.84, dir: 1 },
        { key: 'env', label: 'ENVIRONMENT', fx: 0.28, fy: 0.78, dir: -1 },
        { key: 'mission', label: 'MISSION OPS', fx: 0.52, fy: 0.62, dir: -1 }
      ]
    },
    layout(groups, tilesW) {
      const W = Math.max(bridge.minTiles, tilesW), H = 24;
      const cx = (W * TILE) / 2, cy = (H * TILE) / 2 + 8, rx = (W * TILE) / 2 - TILE * 1.5, ry = (H * TILE) / 2 - TILE * 1.2;
      bridge.geometry = { cx, cy, rx, ry };
      const command = groups.find(group => group.name === 'Coordination');
      const others = groups.filter(group => group.name !== 'Coordination');
      const slots = { command: [...bridge.stations.command], crew: [...bridge.stations.crew] };
      const desks = [];
      const assign = (agent, index) => {
        let slot = slots[index].shift() || slots[index === 'command' ? 'crew' : 'command'].shift();
        if (!slot) {
          const h = hashOf(agent.id);
          slot = { key: 'standing', label: 'RELIEF', fx: ((h % 100) / 100 - 0.5) * 1.2, fy: 0.2 + ((h >> 8) % 100) / 100 * 0.5, dir: 1 };
        }
        desks.push({ agent, index: desks.length, x: 0, y: 0, slot });
      };
      if (command) for (const agent of command.members) assign(agent, 'command');
      for (const group of others) for (const agent of group.members) assign(agent, 'crew');
      const entries = desks.map(desk => {
        const x = Math.round(cx + desk.slot.fx * rx) - 16, y = Math.round(cy + desk.slot.fy * ry) - 16;
        desk.x = x / TILE; desk.y = y / TILE;
        return { agent: desk.agent, home: { x, y, dir: desk.slot.dir } };
      });
      bridgeArena.resize(W * TILE, H * TILE);
      bridgeArena.sync(entries);
      return { tilesW: W, tilesH: H, rooms: desks.length ? [{ name: 'bridge', x: 0, y: 0, w: W, h: H, cols: desks.length, rows: 1, desks }] : [] };
    },
    standing(desk) { return arenaPosition(bridgeArena, desk); },
    walk(desk) { return arenaPosition(bridgeArena, desk); },
    ellipseBand(cx, cy, rx1, ry1, rx2, ry2, color, a0 = 0, a1 = 360) {
      // Fills pixels whose normalized radius is between the two ellipses, within an angle range (degrees, screen space).
      const x0 = Math.floor(cx - rx2), x1 = Math.ceil(cx + rx2), y0 = Math.floor(cy - ry2), y1 = Math.ceil(cy + ry2);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const nx = (x - cx), ny = (y - cy);
          const outer = (nx * nx) / (rx2 * rx2) + (ny * ny) / (ry2 * ry2);
          const inner = rx1 > 0 ? (nx * nx) / (rx1 * rx1) + (ny * ny) / (ry1 * ry1) : 2;
          if (outer <= 1 && inner >= 1) {
            let a = Math.atan2(ny, nx) * 180 / Math.PI; if (a < 0) a += 360;
            if (a0 <= a1 ? (a >= a0 && a <= a1) : (a >= a0 || a <= a1)) rect(x, y, 1, 1, color);
          }
        }
      }
    },
    paintBackdrop(L) {
      const P = bridge.P;
      const { cx, cy, rx, ry } = bridge.geometry;
      const W = L.tilesW * TILE, H = L.tilesH * TILE;
      rect(0, 0, W, H, P.space);
      for (let i = 0; i < Math.floor(W * H / 900); i++) { const h = hashOf(`star${i}`); rect(h % W, Math.floor(h / W) % H, 1, 1, (h >> 7) % 4 ? P.star : P.starDim); }
      const band = (r1, r2, color, a0, a1) => bridge.ellipseBand(cx, cy, rx * r1, ry * r1, rx * r2, ry * r2, color, a0, a1);
      band(0, 1.06, P.hullDark); band(0, 1.0, P.hull); band(0, 0.93, P.hullLine); band(0, 0.9, P.floor);
      for (let i = 0; i < 400; i++) { const h = hashOf(`floor${i}`); const a = (h % 360) * Math.PI / 180, r = ((h >> 9) % 90) / 100; rect(Math.round(cx + Math.cos(a) * rx * r), Math.round(cy + Math.sin(a) * ry * r), 2, 1, P.floorLight); }
      // red carpet horseshoe around the command area, open to the front, plus the command platform
      band(0.56, 0.72, P.carpet, 340, 200);
      band(0.42, 0.56, P.carpetLight, 20, 160);
      band(0, 0.4, P.platform); band(0.37, 0.4, P.carpetLight);
      // horseshoe railing behind the command chairs, with the tactical console on it
      band(0.44, 0.47, P.rail, 15, 165); band(0.44, 0.455, P.railLight, 15, 165);
      const tac = { x: cx - 24, y: cy + ry * 0.47 - 4 };
      rect(tac.x, tac.y, 48, 8, P.console); rect(tac.x, tac.y, 48, 2, P.consoleTop);
      for (let i = 0; i < 6; i++) rect(tac.x + 3 + i * 7, tac.y + 3, 5, 3, [P.amber, P.lilac, P.peach][i % 3]);
      // aft console bank along the back wall
      band(0.8, 0.9, P.console, 25, 155); band(0.8, 0.815, P.consoleTop, 25, 155);
      for (let a = 30; a <= 150; a += 6) {
        const r = 0.85, x = Math.round(cx + Math.cos(a * Math.PI / 180) * rx * r), y = Math.round(cy + Math.sin(a * Math.PI / 180) * ry * r);
        rect(x - 2, y - 2, 4, 3, [P.amber, P.lilac, P.blue, P.peach][(a / 6) % 4]);
      }
      // viewscreen at the front
      const vw = Math.round(rx * 0.9), vh = Math.round(ry * 0.22);
      const vx = Math.round(cx - vw / 2), vy = Math.round(cy - ry * 0.98);
      rect(vx - 3, vy - 3, vw + 6, vh + 6, P.bezel); rect(vx, vy, vw, vh, P.screen);
      for (let i = 0; i < Math.floor(vw / 5); i++) { const h = hashOf(`view${i}`); rect(vx + h % vw, vy + (h >> 6) % vh, 1, 1, (h >> 4) % 5 ? P.star : P.starDim); }
      const px = vx + vw - 34, py = vy + 4;
      [3, 5, 7, 7, 7, 5, 3].forEach((w, row) => rect(px + Math.floor((7 - w) / 2) * 2, py + row * 2, w * 2, 2, P.planet));
      rect(px + 4, py + 2, 4, 2, P.planetLight); rect(px - 4, py + 6, 22, 1, P.lilac);
      // CONN and OPS consoles (curved desk in front of the two front seats)
      for (const fx of [-0.14, 0.14]) {
        const x = Math.round(cx + fx * rx) - 18, y = Math.round(cy - 0.5 * ry) - 16 - 12;
        rect(x, y, 36, 10, P.console); rect(x, y, 36, 2, P.consoleTop);
        rect(x + 4, y + 4, 8, 3, P.amber); rect(x + 14, y + 4, 8, 3, P.lilac); rect(x + 24, y + 4, 8, 3, P.blue);
      }
      // chairs: command trio and front seats
      const chair = (x, y) => { rect(x + 8, y - 2, 16, 6, P.chair); rect(x + 9, y - 2, 14, 2, '#f8f6ee'); rect(x + 6, y + 6, 3, 10, P.chairDark); rect(x + 23, y + 6, 3, 10, P.chairDark); rect(x + 9, y + 17, 14, 5, P.chairDark); };
      for (const s of bridge.stations.command) chair(Math.round(cx + s.fx * rx) - 16, Math.round(cy + s.fy * ry) - 16);
      for (const s of bridge.stations.crew.slice(0, 2)) chair(Math.round(cx + s.fx * rx) - 16, Math.round(cy + s.fy * ry) - 16);
      // station labels on the deck
      for (const s of [...bridge.stations.command, ...bridge.stations.crew]) {
        const x = Math.round(cx + s.fx * rx), y = Math.round(cy + s.fy * ry) + 22;
        miniText(s.label, x - s.label.length * 2, y, 'rgba(255,255,255,0.55)');
      }
      // doors: turbolifts aft left/right, ready room front-left, lounge aft
      const door = (a, label) => {
        const x = Math.round(cx + Math.cos(a * Math.PI / 180) * rx * 0.95), y = Math.round(cy + Math.sin(a * Math.PI / 180) * ry * 0.95);
        rect(x - 9, y - 7, 18, 14, P.door); rect(x - 1, y - 7, 2, 14, P.doorSeam); rect(x - 9, y - 7, 18, 2, P.bezel);
        miniText(label, x - label.length * 2, y + 9, P.hullDark);
      };
      door(172, 'LIFT'); door(8, 'LIFT'); door(205, 'READY ROOM'); door(335, 'LOUNGE');
    },
    drawScene(L) {
      const dt = reducedMotion.matches ? 0 : Math.min(0.05, Math.max(0, (now - bridgeArena.lastTime) / 1000));
      bridgeArena.lastTime = now;
      if (dt) bridgeArena.step(dt);
      const key = JSON.stringify([L.tilesW, L.tilesH]);
      g.drawImage(backdrop('bridge', key, L.tilesW * TILE, L.tilesH * TILE, () => bridge.paintBackdrop(L)), 0, 0);
      // twinkle on the viewscreen
      const { cx, cy, rx, ry } = bridge.geometry;
      const vw = Math.round(rx * 0.9), vh = Math.round(ry * 0.22), vx = Math.round(cx - vw / 2), vy = Math.round(cy - ry * 0.98);
      for (let i = 0; i < 6; i++) { const h = hashOf(`tw${i}${frame}`); rect(vx + h % vw, vy + (h >> 6) % vh, 1, 1, bridge.P.star); }
    },
    drawSeat(desk, pos) {
      if (desk.agent.id === selected) drawSelection(pos.x, pos.y);
      drawActor(bridgeArena, desk, pos, (x, y, p, draw) => {
        sparkleColumn(x, y, p, ['#9ad0ff', '#dff7ff', '#ffffff']);
        withAlpha(p, draw);
      });
    },
    drawEffects() { bridgeArena.drawEffects(); },
    explode(exit, p) {
      sparkleColumn(exit.x, exit.y, p, ['#9ad0ff', '#dff7ff', '#ffffff']);
      withAlpha(1 - p, () => drawWorker(exit.x, exit.y, { id: exit.id, status: 'finished' }, null, { body: '#8a8a9a' }));
      if (p < 0.5) drawSpeech(exit.x, exit.y - 4, 'ENERGIZE');
    }
  };

  // =====================================================================
  // Theme: lemmings (one plane)
  // =====================================================================
  const WALK_SPEED = 22;
  const lemmings = {
    label: 'Lemmings',
    fps: 12,
    minTiles: 12,
    emptyText: 'WAITING FOR LEMMINGS',
    quietText: 'LEVEL CLEAR',
    P: {
      sky: '#0a0a12', rockA: '#4a2c5a', rockB: '#6a3f7a', rockC: '#2e1a3a',
      grass: '#3cb44b', grassDark: '#2f8a3a', dirt: '#6b4424', dirtLight: '#8a5a30', dirtDark: '#4a2c14',
      hair: '#3cb44b', face: '#f6d2c0', hatch: '#7a7f9a', hatchDark: '#4f5468', hatchOpen: '#1a1c2c',
      sign: '#a8743f', signDark: '#6b4424', arch: '#8a5a30', archLight: '#c48b52', flame: '#f0b43c', flameHot: '#ff6b3c',
      sparkle: '#dff7ff', dust: '#c8c8d8', dustDark: '#8a8a9a', star: '#ffe14d'
    },
    layout(groups, tilesW) {
      const W = Math.max(lemmings.minTiles, tilesW);
      const desks = [];
      const all = groups.flatMap(group => group.members.map(agent => ({ agent, group: group.name })));
      const span = Math.max(1, W - 8);
      all.forEach((item, i) => desks.push({ agent: item.agent, index: i, x: 2 + Math.floor(span * (i + 0.5) / Math.max(1, all.length)), y: 3, group: item.group }));
      const hatches = groups.map((group, i) => ({ name: group.name, count: group.members.length, x: 2 + Math.floor(span * (i + 0.5) / Math.max(1, groups.length)) }));
      return { tilesW: W, tilesH: 7, rooms: desks.length ? [{ name: 'level', x: 1, y: 1, w: W - 2, h: 5, cols: desks.length, rows: 1, desks, hatches }] : [] };
    },
    // Lemmings walk the whole level end to end like the game, turning at the rock edge and the exit.
    walk(desk, room, home) {
      const left = room.x * TILE + 2, right = (room.x + room.w) * TILE - TILE * 2 - 36;
      const span = Math.max(1, right - left);
      const seed = hashOf(desk.agent.id);
      const dist = ((now * WALK_SPEED) / 1000 + (seed % (span * 2))) % (span * 2);
      const x = Math.round(dist < span ? left + dist : right - (dist - span));
      return { x, y: home.y, away: true, moving: true, dir: dist < span ? 1 : -1 };
    },
    drawScene(L) {
      const P = lemmings.P;
      const W = L.tilesW * TILE, H = L.tilesH * TILE;
      rect(0, 0, W, H, P.sky);
      for (let i = 0; i < Math.floor(W * H / 500); i++) {
        const h = hashOf(`rock${i}`);
        rect(h % W, (h >> 5) % H, 3 + h % 5, 2 + (h >> 3) % 4, [P.rockA, P.rockB, P.rockC][(h >> 9) % 3]);
      }
      for (const room of L.rooms) lemmings.drawLevel(room);
    },
    drawLevel(room) {
      const P = lemmings.P;
      const px = room.x * TILE, pw = room.w * TILE;
      const gy = (room.y + 3) * TILE;
      rect(px, gy + 1, pw, TILE * 2 - 1, P.dirt);
      for (let i = 0; i < Math.floor(pw / 4); i++) {
        const h = hashOf(`dirt${i}`);
        rect(px + h % pw, gy + 5 + (h >> 4) % (TILE * 2 - 7), 2, 1, (h >> 8) % 2 ? P.dirtLight : P.dirtDark);
      }
      rect(px, gy, pw, 3, P.grass); rect(px, gy + 3, pw, 1, P.grassDark);
      rect(px, gy + TILE * 2 - 2, pw, 2, P.dirtDark);
      rect(px - 2, gy + 2, 2, TILE * 2 - 4, P.rockC); rect(px + pw, gy + 2, 2, TILE * 2 - 4, P.rockC);
      // one exit door at the far right
      const ex = px + pw - TILE * 2 - 2, ey = gy - 15;
      rect(ex, ey + 3, 24, 12, P.arch); rect(ex + 2, ey, 20, 15, P.arch);
      rect(ex + 4, ey + 2, 16, 13, P.hatchOpen); rect(ex + 6, ey, 12, 2, P.archLight);
      const hot = frame % 2 === 0;
      rect(ex - 2, ey + 1, 3, 3, hot ? P.flameHot : P.flame); rect(ex + 23, ey + 1, 3, 3, hot ? P.flame : P.flameHot);
      // one entrance hatch and sign per department along the top
      room.hatches.forEach((hatch, i) => {
        const hx = hatch.x * TILE - 14, hy = room.y * TILE + 2 + (i % 2) * 14; // staggered so signs don't collide on narrow maps
        rect(hx, hy, 28, 8, P.hatch); rect(hx, hy, 28, 2, '#a3a8bd'); rect(hx + 4, hy + 8, 20, 3, P.hatchOpen);
        rect(hx + 2, hy + 6, 24, 2, P.hatchDark); rect(hx + 12, hy + 11, 4, 2, P.hatchDark);
        const label = fitText(`${hatch.name} ${hatch.count}`, 80);
        const lw = label.length * 6 + 6;
        rect(hx + 30, hy, lw, 11, P.sign); rect(hx + 30, hy + 9, lw, 2, P.signDark);
        text(label, hx + 33, hy + 2, DARK);
      });
    },
    drawLemming(x, y, agent, pos, fighting) {
      const P = lemmings.P;
      const status = statusOf(agent);
      const finished = status === 'finished';
      const robe = finished ? '#5a5a6a' : STATUS[status];
      const hair = finished ? '#6a8a6e' : P.hair;
      const skin = finished ? '#b9a893' : P.face;
      const shake = fighting ? (frame % 2 ? 1 : -1) : 0;
      const bob = pos.moving ? frame % 2 : 0;
      sprite(LEMMING, { G: hair, S: skin, B: robe }, x + 11 + shake, y + 2 - bob, 1);
      if (fighting) {
        rect(x + 8 + shake, y + 7 - (frame % 2) * 3, 4, 2, skin); rect(x + 20 + shake, y + 7 - ((frame + 1) % 2) * 3, 4, 2, skin);
      } else if (status === 'waiting') {
        rect(x + 8, y + 8, 5, 2, skin); rect(x + 19, y + 8, 5, 2, skin);
      } else if (pos.moving) {
        rect(x + 12 + pos.dir, y + 9 - bob, 2, 3, skin); rect(x + 18 + pos.dir, y + 9 - bob, 2, 3, skin);
      } else {
        rect(x + 12, y + 9, 2, 3, skin); rect(x + 18, y + 9, 2, 3, skin);
      }
      const stride = pos.moving && frame % 2;
      rect(x + (stride ? 13 : 14) + shake, y + 12 - bob, 2, 3, DARK); rect(x + (stride ? 18 : 17) + shake, y + 12 - bob, 2, 3, DARK);
    },
    drawSeat(desk, pos, room, positions) {
      const P = lemmings.P;
      const { agent } = desk;
      const rival = positions.find(other => other.desk !== desk && Math.abs(other.pos.x - pos.x) < 16);
      const fighting = Boolean(rival && statusOf(agent) === 'working' && statusOf(rival.desk.agent) === 'working');
      if (agent.id === selected) drawSelection(pos.x, pos.y);
      lemmings.drawLemming(pos.x, pos.y, agent, pos, fighting);
      if (fighting && rival.pos.x > pos.x) {
        const cx = Math.round((pos.x + rival.pos.x) / 2) + 16, cy = pos.y + 4;
        for (let i = 0; i < 7; i++) {
          const h = hashOf(`dust${i}${frame}`);
          rect(cx - 8 + h % 16, cy + (h >> 4) % 12, 3, 3, (h >> 8) % 2 ? P.dust : P.dustDark);
        }
        for (let i = 0; i < 3; i++) {
          const h = hashOf(`star${i}${frame >> 1}`);
          text('*', cx - 10 + h % 20, cy - 10 + (h >> 4) % 6, P.star);
        }
        text('!', cx - 2, cy - 18, STATUS.waiting);
      }
      drawModel(pos.x, pos.y, agent);
      if (!fighting && statusOf(agent) === 'waiting') drawStatusBubble(pos.x, pos.y, agent);
    },
    explode(exit, p) {
      // the classic: "OH NO!", a wobble, then pop
      if (p < 0.55) {
        const shake = frame % 2 ? 1 : -1;
        sprite(LEMMING, { G: lemmings.P.hair, S: lemmings.P.face, B: '#5c9cf5' }, exit.x + 11 + shake, exit.y + 2, 1);
        drawSpeech(exit.x, exit.y - 2, 'OH NO!', '#c0392b');
      } else {
        const q = (p - 0.55) / 0.45;
        for (let i = 0; i < 14; i++) {
          const h = hashOf(`pop${exit.id}${i}`);
          const a = (h % 360) * Math.PI / 180, s = 10 + (h >> 9) % 20;
          rect(Math.round(exit.x + 16 + Math.cos(a) * s * q), Math.round(exit.y + 8 + Math.sin(a) * s * q + 20 * q * q), 2, 2, [lemmings.P.hair, lemmings.P.face, '#5c9cf5', '#ffe14d'][(h >> 4) % 4]);
        }
      }
    }
  };

  // =====================================================================
  // Theme: worms — a destructible-terrain battle simulation
  // =====================================================================
  const WORM = [
    '...PPPP...', '..PWWPWW..', '..PWBPWB..', '..PPPPPP..', '...PPPP...', '...PPPP...',
    '...PPP....', '..PPPP....', '.PPPPP....', '.DPPPP....', '..DPPPPP..', '...DDDDDD.'
  ];
  const GRAVE = ['..GGGG..', '.GGGGGG.', '.GGXXGG.', '.GXXXXG.', '.GGXXGG.', '.GGXXGG.', '.GGGGGG.', 'GGGGGGGG'];
  const SHEEP = ['..WWWWWW..', '.WWWWWWWWK', '.WWWWWWWKK', '.WWWWWWWWK', '..WWWWWW..', '..K..K.K..'];
  const COW = ['.......KK.', 'WWWWWWWWKK', 'WKWWWKWWWW', 'WWWWWWWWWP', 'WWKWWWWWW.', '.K..K..KK.'];
  const PLANE = ['......GG........', '.....GGGGGGGGGG.', 'GGGGGGGGGGGGGGGR', '.....GGGGGGGGGG.', '......GG........'];
  const QUIPS = {
    turn: ['MY TURN!', 'WATCH THIS', 'HEHE', 'STAND BACK', 'FIRE!', 'INCOMING!', 'OI!'],
    hit: ['OUCH!', 'OW!', 'NOOO!', 'OI!', 'RUDE!', 'MY HAIR!', 'MEDIC!'],
    land: ['PHEW', 'HELLO!', 'REPORTING'],
    drown: ['GLUB GLUB', 'BLUB'],
    die: ['SO LONG', 'OH DEAR', 'BYE!']
  };
  const WEAPONS = [
    { key: 'bazooka', name: 'BAZOOKA', weight: 5 },
    { key: 'grenade', name: 'GRENADE', weight: 4 },
    { key: 'shotgun', name: 'SHOTGUN', weight: 4 },
    { key: 'holy', name: 'HOLY HAND GRENADE', weight: 1 },
    { key: 'airstrike', name: 'AIR STRIKE', weight: 2 },
    { key: 'sheep', name: 'SUPER SHEEP', weight: 2 },
    { key: 'cow', name: 'MAD COW', weight: 3 },
    { key: 'dynamite', name: 'DYNAMITE', weight: 2 },
    { key: 'banana', name: 'BANANA BOMB', weight: 2 }
  ];

  class WormWorld {
    constructor() {
      this.W = 0; this.H = 0; this.terrain = null; this.gap = 48;
      this.canvas = document.createElement('canvas');
      this.worms = new Map(); this.teams = new Map(); this.teamOrder = []; this.teamCursor = 0;
      this.projectiles = []; this.particles = []; this.texts = []; this.blasts = []; this.graves = []; this.planes = []; this.shots = [];
      this.damage_ = []; // carved circles in map fractions, replayed after a resize so the map stays eaten
      this.wind = 0; this.turn = null; this.turnTimer = 4; this.lastTime = 0; this.shake = 0; this.dirty = true;
    }

    get waterY() { return this.H - 30; }
    inChannel(x) { return Math.abs(x - this.W / 2) < this.gap / 2; }

    solid(x, y) {
      x |= 0; y |= 0;
      return x >= 0 && x < this.W && y >= 0 && y < this.H && this.terrain[y * this.W + x] === 1;
    }

    resize(W, H) {
      if (W === this.W && H === this.H) return;
      const oldW = this.W, oldH = this.H;
      this.W = W; this.H = H;
      this.terrain = new Uint8Array(W * H);
      this.canvas.width = W; this.canvas.height = H;
      this.generate();
      for (const d of this.damage_) this.carve(Math.round(d.fx * W), Math.round(d.fy * H), d.r, false);
      this.projectiles = []; this.planes = []; this.shots = [];
      for (const worm of this.worms.values()) {
        if (worm.respawnAt) continue;
        if (oldW && oldH) { worm.x = worm.x * W / oldW; worm.y = worm.y * H / oldH; }
        if (this.inChannel(worm.x)) worm.x = this.W / 2 + (worm.x < this.W / 2 ? -1 : 1) * (this.gap / 2 + 10);
        this.settle(worm);
      }
      for (const grave of this.graves) { if (oldW) { grave.x = grave.x * W / oldW; grave.y = grave.y * H / oldH; } }
      this.dirty = true;
    }

    // Drops a worm straight onto the terrain under (or above) it.
    settle(worm) {
      worm.x = Math.max(6, Math.min(this.W - 6, worm.x));
      let y = Math.max(0, Math.min(this.H - 1, Math.round(worm.y)));
      if (this.solid(worm.x, y)) { while (y > 0 && this.solid(worm.x, y - 1)) y--; }
      else { while (y < this.H - 1 && !this.solid(worm.x, y + 1)) y++; }
      worm.y = y; worm.vx = 0; worm.vy = 0; worm.chute = false; worm.grounded = true;
    }

    noise(seed, x, cell) {
      const i = Math.floor(x / cell), k = (x / cell) - i;
      const a = hashOf(`${seed}:${i}`) % 1000 / 1000, b = hashOf(`${seed}:${i + 1}`) % 1000 / 1000;
      const s = k * k * (3 - 2 * k);
      return a + (b - a) * s - 0.5;
    }

    // Two continents, left and right, with a narrow sea between them. Land runs to the map bottom.
    generate() {
      const { W, H } = this;
      this.terrain.fill(0);
      const halves = [[0, Math.floor(W / 2 - this.gap / 2)], [Math.ceil(W / 2 + this.gap / 2), W]];
      halves.forEach(([x0, x1], side) => {
        const base = Math.floor(H * 0.48 + (hashOf(`base${W}${side}`) % 40));
        for (let x = x0; x < x1; x++) {
          const edge = side === 0 ? x1 - x : x - x0;
          const shore = edge < 24 ? (24 - edge) * 1.2 : 0;
          const top = Math.floor(base - 34 * this.noise(`hills${W}:${side}`, x, 52) - 14 * this.noise(`bumps${W}:${side}`, x, 14) + shore);
          for (let y = Math.max(0, top); y < H; y++) this.terrain[y * W + x] = 1;
        }
        for (let c = 0; c < 3; c++) {
          const h = hashOf(`cave${W}:${side}:${c}`);
          this.carve(x0 + 30 + h % Math.max(1, x1 - x0 - 60), base + 30 + (h >> 6) % 50, 8 + (h >> 12) % 8, false);
        }
      });
      this.dirty = true;
    }

    carve(cx, cy, r, remember = true) {
      const { W, H } = this;
      for (let dy = -r; dy <= r; dy++) {
        const w = Math.floor(Math.sqrt(r * r - dy * dy));
        const y = cy + dy;
        if (y < 0 || y >= H) continue;
        for (let x = Math.max(0, cx - w); x <= Math.min(W - 1, cx + w); x++) this.terrain[y * W + x] = 0;
      }
      if (remember) { this.damage_.push({ fx: cx / W, fy: cy / H, r }); if (this.damage_.length > 400) this.damage_.shift(); }
      this.dirty = true;
    }

    paint() {
      const { W, H } = this;
      const P = worms.P;
      const c = this.canvas.getContext('2d');
      const image = c.createImageData(W, H);
      const data = image.data;
      const colors = {};
      const rgb = hex => colors[hex] || (colors[hex] = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]);
      for (let x = 0; x < W; x++) {
        let depth = 0;
        for (let y = 0; y < H; y++) {
          const idx = y * W + x;
          if (!this.terrain[idx]) { depth = 0; continue; }
          depth++;
          let color = P.soil;
          if (depth <= 3) color = P.soilTop;
          else if (y + 1 >= H) color = P.soil;
          else if (!this.terrain[idx + W]) color = P.soilDark;
          else if ((x * 7 + y * 13) % 37 === 0) color = P.soilLight;
          else if ((x * 5 + y * 11) % 41 === 0) color = P.soilDark;
          const [r, gg, b] = rgb(color);
          data[idx * 4] = r; data[idx * 4 + 1] = gg; data[idx * 4 + 2] = b; data[idx * 4 + 3] = 255;
        }
      }
      c.putImageData(image, 0, 0);
      this.dirty = false;
    }

    sync(entries) {
      const seen = new Set();
      this.teamOrder = [];
      for (const { agent, team, teamName } of entries) {
        seen.add(agent.id);
        if (!this.teams.has(teamName)) this.teams.set(teamName, { name: teamName, color: team, cursor: 0 });
        if (!this.teamOrder.includes(teamName)) this.teamOrder.push(teamName);
        let worm = this.worms.get(agent.id);
        if (!worm) {
          worm = { id: agent.id, agent, team: teamName, x: 0, y: 0, vx: 0, vy: 0, dir: 1, health: 100, chute: false,
            grounded: false, ai: { state: 'stand', until: 0, dir: 1 }, say: null, hurtUntil: 0, respawnAt: 0, gone: false };
          this.worms.set(agent.id, worm);
          this.parachute(worm);
          this.texts.push({ x: worm.x, y: 30, text: 'INCOMING!', color: team, life: 1.6, vy: -8 });
        }
        worm.agent = agent; worm.team = teamName;
      }
      for (const [id, worm] of this.worms) if (!seen.has(id) && !worm.gone) this.worms.delete(id);
    }

    parachute(worm) {
      const side = Math.random() < 0.5 ? 0 : 1;
      const x0 = side === 0 ? 24 : this.W / 2 + this.gap / 2 + 24, x1 = side === 0 ? this.W / 2 - this.gap / 2 - 24 : this.W - 24;
      worm.x = Math.floor(rand(x0, Math.max(x0 + 1, x1)));
      worm.y = -20 - Math.floor(Math.random() * 40);
      worm.vx = 0; worm.vy = 0; worm.chute = true; worm.grounded = false; worm.respawnAt = 0;
      worm.ai = { state: 'stand', until: now + 1500, dir: Math.random() < 0.5 ? -1 : 1 };
    }

    kill(id, label) {
      const worm = this.worms.get(id);
      if (!worm) return;
      this.worms.delete(id);
      if (!worm.respawnAt) {
        this.blast(worm.x, worm.y - 6, 22, 0, null);
        this.graves.push({ x: worm.x, y: worm.y, label: String(label || '').slice(0, 7), color: this.teams.get(worm.team)?.color || '#fff', vy: 0 });
        this.texts.push({ x: worm.x, y: worm.y - 30, text: pick(QUIPS.die), color: '#aaaaaa', life: 1.5, vy: -10 });
      }
    }

    say(worm, message) { worm.say = { text: message, until: now + 1800 }; }

    damage(worm, amount, fromX, fromY, force) {
      if (worm.respawnAt || worm.chute) return;
      worm.health = Math.max(0, worm.health - amount);
      worm.hurtUntil = now + 500;
      const dx = worm.x - fromX, dy = (worm.y - 6) - fromY;
      const dist = Math.max(6, Math.hypot(dx, dy));
      worm.vx += (dx / dist) * force; worm.vy += (dy / dist) * force - force * 0.5;
      worm.grounded = false;
      this.texts.push({ x: worm.x, y: worm.y - 34, text: `-${amount}`, color: '#ff5555', life: 1.2, vy: -14 });
      this.say(worm, pick(QUIPS.hit));
      if (worm.health <= 0) this.die(worm);
    }

    die(worm) {
      worm.respawnAt = now + 3500;
      this.blast(worm.x, worm.y - 6, 18, 0, null);
      this.graves.push({ x: worm.x, y: worm.y, label: String(worm.agent.type).slice(0, 7), color: this.teams.get(worm.team)?.color || '#fff', vy: 0 });
      this.texts.push({ x: worm.x, y: worm.y - 30, text: pick(QUIPS.die), color: '#aaaaaa', life: 1.5, vy: -10 });
      worm.y = -200;
    }

    blast(x, y, r, dmg, source) {
      this.carve(Math.round(x), Math.round(y), r);
      this.blasts.push({ x, y, r, start: now });
      this.shake = Math.min(8, this.shake + r / 5);
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI, s = 40 + Math.random() * 90;
        this.particles.push({ x, y, vx: Math.cos(a) * s * (Math.random() < 0.5 ? 1 : -1), vy: -Math.sin(a) * s, life: 0.8 + Math.random() * 0.6, color: Math.random() < 0.5 ? worms.P.soil : worms.P.soilTop, size: 2, gravity: true });
      }
      for (let i = 0; i < 6; i++) this.particles.push({ x: x - 8 + Math.random() * 16, y: y - 4, vx: (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 20, life: 1 + Math.random(), color: Math.random() < 0.5 ? worms.P.smoke : worms.P.smokeDark, size: 4 + Math.random() * 4, gravity: false });
      if (dmg) {
        const reach = r + 12;
        for (const worm of this.worms.values()) {
          if (worm.respawnAt) continue;
          const dist = Math.hypot(worm.x - x, worm.y - 6 - y);
          if (dist < reach) this.damage(worm, Math.max(5, Math.round(dmg * (1 - dist / reach) + 5)), x, y, 70 + dmg * 1.5);
        }
      }
      for (const grave of this.graves) { if (Math.hypot(grave.x - x, grave.y - y) < r + 8) grave.vy = -80; }
    }

    workingWorms() { return [...this.worms.values()].filter(worm => !worm.respawnAt && !worm.chute && statusOf(worm.agent) === 'working'); }
    liveWorms() { return [...this.worms.values()].filter(worm => !worm.respawnAt && !worm.chute); }

    startTurn() {
      const fighters = this.workingWorms();
      if (this.liveWorms().length < 2 || !fighters.length) { this.turnTimer = 2; return; }
      const teamsWithWorms = this.teamOrder.filter(name => fighters.some(worm => worm.team === name));
      const teamName = teamsWithWorms[this.teamCursor++ % teamsWithWorms.length];
      const team = this.teams.get(teamName);
      const squad = fighters.filter(worm => worm.team === teamName);
      const shooter = squad[team.cursor++ % squad.length];
      const others = this.liveWorms().filter(worm => worm !== shooter);
      const rivals = others.filter(worm => worm.team !== teamName);
      const target = pick(rivals.length ? rivals : others);
      const total = WEAPONS.reduce((sum, weapon) => sum + weapon.weight, 0);
      let roll = Math.random() * total, weapon = WEAPONS[0];
      for (const item of WEAPONS) { roll -= item.weight; if (roll <= 0) { weapon = item; break; } }
      shooter.dir = target.x >= shooter.x ? 1 : -1;
      shooter.ai = { state: 'stand', until: now + 2000, dir: shooter.dir };
      this.say(shooter, pick(QUIPS.turn));
      this.wind = Math.round((Math.random() - 0.5) * 10);
      this.turn = { shooter, target, weapon, phase: 'announce', at: now };
    }

    solve(from, to, gravity, windy, angleDeg) {
      const angle = angleDeg * Math.PI / 180;
      const dir = to.x >= from.x ? 1 : -1;
      let best = null;
      for (let speed = 60; speed <= 420; speed += 12) {
        let x = from.x, y = from.y, vx = Math.cos(angle) * speed * dir, vy = -Math.sin(angle) * speed;
        for (let t = 0; t < 6; t += 0.04) {
          vy += gravity * 0.04; if (windy) vx += this.wind * 0.04 * 6;
          x += vx * 0.04; y += vy * 0.04;
          if (vy > 0 && y >= to.y) break;
        }
        const miss = Math.abs(x - to.x);
        if (!best || miss < best.miss) best = { miss, vx: Math.cos(angle) * speed * dir, vy: -Math.sin(angle) * speed };
      }
      const error = 0.92 + Math.random() * 0.16;
      return { vx: best.vx * error, vy: best.vy * error };
    }

    fire() {
      const { shooter, target, weapon } = this.turn;
      const from = { x: shooter.x, y: shooter.y - 8 }, to = { x: target.x, y: target.y - 6 };
      const launch = (type, extra, gravity, windy, angle) => {
        const v = this.solve(from, to, gravity, windy, angle);
        this.projectiles.push({ type, x: from.x, y: from.y, vx: v.vx, vy: v.vy, owner: shooter, ...extra });
      };
      switch (weapon.key) {
        case 'bazooka': launch('rocket', { r: 18, dmg: 32, windy: true, bounce: false, fuse: 0 }, GRAVITY, true, 42); break;
        case 'grenade': launch('grenade', { r: 18, dmg: 32, windy: false, bounce: true, fuse: 3 }, GRAVITY, false, 58); break;
        case 'holy': launch('holy', { r: 42, dmg: 80, windy: false, bounce: true, fuse: 3.2 }, GRAVITY, false, 60); break;
        case 'banana': launch('banana', { r: 16, dmg: 24, windy: false, bounce: true, fuse: 2 }, GRAVITY, false, 55); break;
        case 'cow':
          // thrown in an arc; once it lands it charges like a mad thing and goes off
          launch('cow', { r: 28, dmg: 60, windy: false, bounce: true, fuse: 7, charging: false, dir: shooter.dir, hop: 0 }, GRAVITY, false, 50);
          this.say(shooter, 'MOO!');
          break;
        case 'shotgun':
          this.shots.push({ at: now + 100, shooter, target }, { at: now + 600, shooter, target });
          break;
        case 'airstrike':
          this.planes.push({ x: target.x < this.W / 2 ? this.W + 30 : -40, dir: target.x < this.W / 2 ? -1 : 1, dropX: target.x, bombs: 5, dropped: 0, nextDrop: 0 });
          break;
        case 'sheep':
          this.projectiles.push({ type: 'sheep', x: from.x + shooter.dir * 8, y: shooter.y, vx: 0, vy: 0, dir: shooter.dir, hop: 0, r: 24, dmg: 50, fuse: 6, owner: shooter });
          this.say(shooter, 'BAAA!');
          break;
        case 'dynamite':
          this.projectiles.push({ type: 'dynamite', x: shooter.x, y: shooter.y, vx: 0, vy: 0, r: 32, dmg: 55, fuse: 3, owner: shooter });
          shooter.ai = { state: 'walk', until: now + 2600, dir: -shooter.dir };
          this.say(shooter, 'RUN!');
          break;
      }
    }

    shotgun(shot) {
      const { shooter, target } = shot;
      const sx = shooter.x, sy = shooter.y - 8;
      const dx = target.x - sx, dy = (target.y - 6) - sy;
      const len = Math.max(1, Math.hypot(dx, dy));
      const ux = dx / len, uy = dy / len;
      let x = sx + ux * 10, y = sy + uy * 10, hitWorm = null;
      for (let d = 10; d < 420; d += 2) {
        x += ux * 2; y += uy * 2;
        if (this.solid(x, y) || x < 0 || x > this.W || y > this.H) break;
        hitWorm = this.liveWorms().find(worm => worm !== shooter && Math.abs(worm.x - x) < 7 && Math.abs(worm.y - 6 - y) < 9);
        if (hitWorm) break;
      }
      for (let d = 0; d < 1; d += 0.08) this.particles.push({ x: sx + ux * 12 + (x - sx - ux * 12) * d, y: sy + uy * 12 + (y - sy - uy * 12) * d, vx: 0, vy: 0, life: 0.15, color: '#ffe14d', size: 1, gravity: false });
      this.blast(x, y, 7, 22, shooter);
      shooter.vx -= ux * 20;
    }

    explode(p) {
      this.blast(p.x, p.y, p.r, p.dmg, p.owner);
      if (p.type === 'holy') this.texts.push({ x: p.x, y: p.y - 40, text: 'HALLELUJAH!', color: '#ffe14d', life: 1.6, vy: -10 });
      if (p.type === 'cow') this.texts.push({ x: p.x, y: p.y - 36, text: 'MOOOO!', color: '#f4f4f4', life: 1.4, vy: -10 });
      if (p.type === 'banana') {
        for (let i = 0; i < 5; i++) this.projectiles.push({ type: 'bananette', x: p.x, y: p.y - 6, vx: (i - 2) * 40 + (Math.random() - 0.5) * 20, vy: -140 - Math.random() * 60, r: 14, dmg: 20, windy: false, bounce: true, fuse: 1.4 + i * 0.15, owner: p.owner });
      }
    }

    // Critters (sheep, landed cows) walk and hop along the ground until they go off.
    critter(p, dt, speed) {
      p.fuse -= dt; p.hop -= dt;
      const grounded = this.solid(p.x, p.y + 1);
      if (grounded) { p.vy = 0; if (p.hop <= 0) { p.vy = -150; p.hop = 0.7 + Math.random() * 0.4; } }
      else p.vy += GRAVITY * dt;
      const nx = p.x + p.dir * speed * dt;
      if ((this.solid(nx, p.y - 2) && this.solid(nx, p.y - 6)) || this.inChannel(nx)) p.dir = -p.dir; else p.x = nx;
      let ny = p.y + p.vy * dt;
      while (p.vy > 0 && this.solid(p.x, ny) && ny > p.y) ny -= 1;
      p.y = ny;
      const victim = this.liveWorms().find(worm => worm !== p.owner && Math.hypot(worm.x - p.x, worm.y - p.y) < 12);
      if (victim || p.fuse <= 0 || p.y > this.H) { if (p.y <= this.H) this.explode(p); return true; }
      return false;
    }

    step(dt) {
      if (!this.terrain) return;
      if (!this.turn) {
        this.turnTimer -= dt;
        if (this.turnTimer <= 0) this.startTurn();
      } else {
        const turn = this.turn;
        const active = this.projectiles.length || this.planes.length || this.shots.length;
        if (turn.phase === 'announce' && now - turn.at > 1300) {
          if (this.worms.has(turn.shooter.id) && this.worms.has(turn.target.id) && !turn.shooter.respawnAt && !turn.target.respawnAt) { this.fire(); turn.phase = 'wait'; turn.at = now; }
          else { this.turn = null; this.turnTimer = 1; }
        } else if (turn.phase === 'wait' && (!active && now - turn.at > 600 || now - turn.at > 12000)) { turn.phase = 'rest'; turn.at = now; }
        else if (turn.phase === 'rest' && now - turn.at > 1400) { this.turn = null; this.turnTimer = 1.2; }
      }
      for (let i = this.shots.length - 1; i >= 0; i--) if (now >= this.shots[i].at) { this.shotgun(this.shots[i]); this.shots.splice(i, 1); }
      for (let i = this.planes.length - 1; i >= 0; i--) {
        const plane = this.planes[i];
        plane.x += plane.dir * 170 * dt;
        const passed = plane.dir > 0 ? plane.x >= plane.dropX - 30 : plane.x <= plane.dropX + 30;
        if (passed && plane.dropped < plane.bombs && now >= plane.nextDrop) {
          plane.dropped++; plane.nextDrop = now + 90;
          this.projectiles.push({ type: 'bomb', x: plane.x, y: 14, vx: plane.dir * 60, vy: 0, r: 14, dmg: 22, windy: false, bounce: false, fuse: 0, owner: null });
        }
        if (plane.x < -60 || plane.x > this.W + 60) this.planes.splice(i, 1);
      }
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        let done = false;
        if (p.type === 'sheep' || (p.type === 'cow' && p.charging)) {
          done = this.critter(p, dt, p.type === 'cow' ? 75 : 55);
        } else if (p.type === 'dynamite') {
          p.fuse -= dt;
          if (!this.solid(p.x, p.y + 1)) p.y += 60 * dt;
          if (p.fuse <= 0) { done = true; this.explode(p); }
          else if (Math.random() < 0.5) this.particles.push({ x: p.x + 3, y: p.y - 12, vx: (Math.random() - 0.5) * 30, vy: -30, life: 0.3, color: '#ffe14d', size: 1, gravity: false });
        } else {
          p.vy += GRAVITY * dt;
          if (p.windy) p.vx += this.wind * 6 * dt;
          if (p.fuse) { p.fuse -= dt; if (p.fuse <= 0) { this.explode(p); done = true; } }
          if (!done) {
            const steps = Math.max(1, Math.ceil(Math.hypot(p.vx * dt, p.vy * dt) / 2));
            for (let s = 0; s < steps && !done; s++) {
              const nx = p.x + (p.vx * dt) / steps, ny = p.y + (p.vy * dt) / steps;
              if (this.solid(nx, ny)) {
                if (p.type === 'cow') { p.charging = true; p.hop = 0.3; p.dir = p.vx >= 0 ? 1 : -1; p.vx = 0; p.vy = 0; break; }
                if (p.bounce) {
                  if (this.solid(nx, p.y)) p.vx = -p.vx * 0.55; else { p.vy = -p.vy * 0.45; p.vx *= 0.75; }
                  if (Math.abs(p.vy) < 25 && Math.abs(p.vx) < 10) { p.vx = 0; p.vy = 0; }
                } else { this.explode(p); done = true; }
              } else { p.x = nx; p.y = ny; }
            }
            if (!done && (p.type === 'rocket' || p.type === 'bomb')) {
              const victim = this.liveWorms().find(worm => worm !== p.owner && Math.abs(worm.x - p.x) < 7 && Math.abs(worm.y - 6 - p.y) < 9);
              if (victim) { this.explode(p); done = true; }
            }
            if (!done && (p.x < -40 || p.x > this.W + 40 || p.y > this.H)) {
              if (this.inChannel(p.x) && p.y > this.waterY) this.splash(p.x);
              done = true;
            }
          }
        }
        if (done) this.projectiles.splice(i, 1);
      }
      const turnWorm = this.turn && this.turn.phase !== 'rest' ? this.turn.shooter : null;
      for (const worm of this.worms.values()) {
        if (worm.respawnAt) { if (now >= worm.respawnAt) { worm.health = 100; this.parachute(worm); this.texts.push({ x: worm.x, y: 30, text: 'REINFORCEMENTS!', color: this.teams.get(worm.team)?.color || '#fff', life: 1.6, vy: -8 }); } continue; }
        if (worm.chute) {
          worm.vy = 55; worm.vx = this.wind * 1.5;
          worm.x = Math.max(6, Math.min(this.W - 6, worm.x + worm.vx * dt));
          if (this.inChannel(worm.x)) worm.x = this.W / 2 + (worm.x < this.W / 2 ? -1 : 1) * (this.gap / 2 + 6);
          worm.y += worm.vy * dt;
          if (this.solid(worm.x, worm.y + 1)) { worm.chute = false; worm.vx = 0; worm.vy = 0; worm.grounded = true; this.say(worm, pick(QUIPS.land)); }
          else if (worm.y > this.H) { this.settle(worm); }
          continue;
        }
        worm.grounded = this.solid(worm.x, worm.y + 1);
        if (!worm.grounded) {
          worm.vy += GRAVITY * dt;
          let ny = worm.y + worm.vy * dt;
          if (worm.vy > 0) {
            let landed = false;
            for (let y = worm.y; y <= ny; y++) { if (this.solid(worm.x, y + 1)) { ny = y; landed = true; break; } }
            if (landed) {
              if (worm.vy > 170) { this.damage(worm, 5, worm.x, worm.y + 10, 0); for (let k = 0; k < 4; k++) this.particles.push({ x: worm.x, y: ny, vx: (Math.random() - 0.5) * 60, vy: -30, life: 0.4, color: worms.P.soilTop, size: 2, gravity: true }); }
              worm.vy = 0; worm.grounded = true;
            }
          } else {
            for (let y = worm.y; y >= ny; y--) { if (this.solid(worm.x, y - 12)) { ny = y; worm.vy = 0; break; } }
          }
          worm.y = ny;
          if (worm.vx) {
            const nx = worm.x + worm.vx * dt;
            if (this.solid(nx, worm.y - 4) || nx < 4 || nx > this.W - 4 || this.inChannel(nx)) worm.vx = -worm.vx * 0.4; else worm.x = nx;
          }
          if (worm.y > this.H - 2) this.settle(worm);
          continue;
        }
        if (Math.abs(worm.vx) > 2) {
          worm.vx *= 0.8;
          const nx = worm.x + worm.vx * dt;
          if (!this.solid(nx, worm.y - 4) && !this.inChannel(nx)) worm.x = nx;
        } else worm.vx = 0;
        const fighting = turnWorm === worm;
        if (statusOf(worm.agent) === 'working' && !fighting && now >= worm.ai.until) {
          const roll = Math.random();
          worm.ai = roll < 0.45 ? { state: 'walk', until: now + 800 + Math.random() * 2200, dir: Math.random() < 0.5 ? -1 : 1 }
            : roll < 0.55 ? { state: 'hop', until: now + 400, dir: worm.dir }
            : { state: 'stand', until: now + 1000 + Math.random() * 2500, dir: worm.dir };
          if (worm.ai.state === 'hop') { worm.vy = -120; worm.vx = worm.dir * 40; worm.grounded = false; }
        }
        if (worm.ai.state === 'walk' && (statusOf(worm.agent) === 'working') && (!fighting || this.turn?.weapon.key === 'dynamite')) {
          worm.dir = worm.ai.dir;
          const nx = worm.x + worm.dir * 20 * dt;
          let climbed = false;
          if (!this.inChannel(nx)) {
            for (let up = 0; up <= 5; up++) {
              if (!this.solid(nx, worm.y - up - 1) && !this.solid(nx, worm.y - up - 6)) { worm.x = Math.max(4, Math.min(this.W - 4, nx)); worm.y -= up; climbed = true; break; }
            }
          }
          if (!climbed) { worm.ai.dir = -worm.ai.dir; worm.dir = worm.ai.dir; }
          else if (!this.solid(worm.x, worm.y + 1)) worm.grounded = false;
        }
        if (worm.grounded && worm.ai.state !== 'walk' && !fighting) worm.y = Math.round(worm.y);
      }
      for (const grave of this.graves) {
        if (!this.solid(grave.x, grave.y + 1) && grave.y < this.H - 1) { grave.vy += GRAVITY * dt; grave.y += grave.vy * dt; } else grave.vy = 0;
      }
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const q = this.particles[i];
        q.life -= dt; if (q.gravity) q.vy += GRAVITY * dt;
        q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.life <= 0 || (q.gravity && this.solid(q.x, q.y))) this.particles.splice(i, 1);
      }
      for (let i = this.texts.length - 1; i >= 0; i--) { const t = this.texts[i]; t.life -= dt; t.y += t.vy * dt; if (t.life <= 0) this.texts.splice(i, 1); }
      this.blasts = this.blasts.filter(b => now - b.start < 900);
      this.shake = Math.max(0, this.shake - 18 * dt);
      if (this.dirty) this.paint();
    }

    splash(x) {
      for (let i = 0; i < 8; i++) this.particles.push({ x, y: this.waterY, vx: (Math.random() - 0.5) * 60, vy: -60 - Math.random() * 60, life: 0.7, color: worms.P.waterLight, size: 2, gravity: true });
    }
  }

  const world = new WormWorld();

  const worms = {
    label: 'Worms',
    fps: 30,
    minTiles: 16,
    emptyText: 'WAITING FOR WORMS',
    quietText: 'CEASEFIRE',
    teams: ['#55e055', '#55e0e0', '#ff66ff', '#ff5555', '#ffee55', '#ff9966', '#9999ff', '#ffffff'],
    P: {
      sky: '#0e1c4a', speck: '#5fcf5f', water: '#1b4fd8', waterLight: '#4f86ff', waterDark: '#12379a',
      soilTop: '#c8884a', soil: '#8a5a2a', soilDark: '#5e3a1a', soilLight: '#a86f38',
      worm: '#ffb0c8', wormDark: '#d06a90', eye: '#ffffff', pupil: '#101010', label: 'rgba(10,10,30,0.9)',
      flash: '#ffffff', fire: '#ff7a1a', fireCore: '#ffe14d', smoke: '#9a9aa8', smokeDark: '#5a5a68',
      rocket: '#d8d8e8', rocketTip: '#ff5555', cross: '#ff3b3b', bazooka: '#4a4a58', grave: '#b8b8c8', graveDark: '#6a6a7a',
      grenade: '#3cb44b', holy: '#ffd34d', banana: '#ffe14d', sheep: '#f4f4f4', sheepDark: '#202020', cowPink: '#ffb0c8', plane: '#9aa0b4', dynamite: '#d83a3a'
    },
    layout(groups, tilesW) {
      const W = Math.max(worms.minTiles, tilesW), H = 20;
      const desks = [];
      const entries = [];
      groups.forEach(({ name, members }, index) => {
        const team = worms.teams[index % worms.teams.length];
        for (const agent of members) {
          desks.push({ agent, index: desks.length, x: 0, y: 0, team, teamName: name });
          entries.push({ agent, team, teamName: name });
        }
      });
      world.resize(W * TILE, H * TILE);
      world.sync(entries);
      return { tilesW: W, tilesH: H, rooms: desks.length ? [{ name: 'arena', x: 0, y: 0, w: W, h: H, cols: desks.length, rows: 1, desks }] : [] };
    },
    standing(desk) {
      const worm = world.worms.get(desk.agent.id);
      if (!worm || worm.respawnAt) return { x: -200, y: -200 };
      return { x: Math.round(worm.x) - 16, y: Math.round(worm.y) - 14 };
    },
    walk(desk, room, home) {
      const worm = world.worms.get(desk.agent.id);
      return { ...home, away: true, moving: Boolean(worm && (worm.ai.state === 'walk' || !worm.grounded)), dir: worm ? worm.dir : 1 };
    },
    drawScene(L) {
      const P = worms.P;
      const dt = reducedMotion.matches ? 0 : Math.min(0.05, Math.max(0, (now - world.lastTime) / 1000));
      world.lastTime = now;
      if (dt) world.step(dt);
      if (world.dirty) world.paint();
      const W = world.W, H = world.H;
      const sx = world.shake ? Math.round((Math.random() - 0.5) * world.shake) : 0, sy = world.shake ? Math.round((Math.random() - 0.5) * world.shake) : 0;
      g.setTransform(scale * dpr, 0, 0, scale * dpr, sx * scale * dpr, sy * scale * dpr);
      g.imageSmoothingEnabled = false;
      rect(-8, -8, W + 16, H + 16, P.sky);
      for (let i = 0; i < Math.floor(W * H / 2500); i++) {
        const h = hashOf(`speck${i}`);
        const px = (h % W + Math.floor(now / 80) * ((h >> 6) % 2 ? 1 : -1)) % W;
        rect((px + W) % W, (Math.floor(h / W) + Math.floor(now / 120)) % H, 2, 2, P.speck);
      }
      // the small sea in the channel between the two continents
      const cx = W / 2, wy = world.waterY;
      rect(cx - world.gap / 2 - 2, wy, world.gap + 4, H - wy + 8, P.water);
      for (let px = cx - world.gap / 2; px < cx + world.gap / 2; px += 8) {
        const bob = (Math.floor(px / 8) + frame) % 3;
        rect(px, wy + bob, 5, 2, P.waterLight); rect(px + 3, wy + 8 + ((bob + 1) % 3), 4, 1, P.waterDark);
      }
      g.drawImage(world.canvas, 0, 0);
      for (const grave of world.graves) {
        sprite(GRAVE, { G: P.grave, X: P.graveDark }, Math.round(grave.x) - 4, Math.round(grave.y) - 8, 1);
        miniText(grave.label, Math.round(grave.x) - grave.label.length * 2, Math.round(grave.y) - 14, grave.color);
      }
    },
    drawWorm(x, y, dir, hurt) {
      const P = worms.P;
      const palette = hurt && frame % 2 ? { P: '#ffffff', D: '#ffd0e0', W: '#ff5555', B: '#ff5555' } : { P: P.worm, D: P.wormDark, W: P.eye, B: P.pupil };
      sprite(dir < 0 ? flip(WORM) : WORM, palette, x + 11, y, 1);
    },
    drawSeat(desk, pos) {
      const P = worms.P;
      const { agent } = desk;
      const worm = world.worms.get(agent.id);
      if (!worm || worm.respawnAt) return;
      const status = statusOf(agent);
      const x = pos.x, y = pos.y + 2;
      const team = world.teams.get(worm.team)?.color || desk.team;
      if (agent.id === selected) drawSelection(pos.x, pos.y);
      if (worm.chute) {
        const cx = x + 16, cy = y - 18;
        disc(cx, cy, 14, team); rect(cx - 15, cy + 1, 31, 14, P.sky);
        for (let k = -12; k <= 12; k += 6) rect(cx + k, cy - 13 + Math.abs(k) / 2, 1, 12 - Math.abs(k) / 2, 'rgba(0,0,0,0.25)');
        rect(cx - 14, cy, 1, 16, '#d8d8e8'); rect(cx + 14, cy, 1, 16, '#d8d8e8');
      }
      worms.drawWorm(x, y, worm.dir, now < worm.hurtUntil);
      const turn = world.turn;
      if (turn && turn.shooter === worm && turn.phase === 'announce') {
        const bounce = frame % 2 ? 0 : 2;
        rect(x + 13, y - 40 + bounce, 6, 6, team); rect(x + 11, y - 35 + bounce, 10, 2, team); rect(x + 14, y - 33 + bounce, 4, 3, team);
        if (['bazooka', 'shotgun'].includes(turn.weapon.key)) { const ax = worm.dir > 0 ? x + 18 : x + 5; rect(ax, y + 4, 9, 3, P.bazooka); rect(worm.dir > 0 ? ax + 8 : ax - 1, y + 3, 2, 5, P.rocketTip); }
        if (turn.weapon.key === 'cow') sprite(worm.dir < 0 ? flip(COW) : COW, { W: P.sheep, K: P.sheepDark, P: P.cowPink }, x + 11, y - 10, 1);
      }
      if (turn && turn.target === worm && turn.phase === 'announce') {
        const tx = x + 16, ty = y + 6, blink = frame % 2;
        rect(tx - 7, ty, 15, 1, blink ? P.cross : P.rocketTip); rect(tx, ty - 7, 1, 15, blink ? P.cross : P.rocketTip);
      }
      const name = String(agent.type).slice(0, 7);
      const nw = name.length * 6 + 4;
      rect(x + 16 - Math.floor(nw / 2), y - 22, nw, 9, P.label);
      text(name, x + 18 - Math.floor(nw / 2), y - 21, team);
      const hp = status === 'waiting' ? (frame % 2 ? '?' : ' ') : String(worm.health);
      const hw = hp.length * 6 + 4;
      rect(x + 16 - Math.floor(hw / 2), y - 12, hw, 9, P.label);
      text(hp, x + 18 - Math.floor(hw / 2), y - 11, status === 'waiting' ? STATUS.waiting : now < worm.hurtUntil ? '#ff5555' : team);
      if (worm.say && now < worm.say.until) drawSpeech(x, y - 18, worm.say.text);
      drawModel(x, y - 2, agent);
    },
    drawEffects() {
      const P = worms.P;
      for (const p of world.projectiles) {
        const x = Math.round(p.x), y = Math.round(p.y);
        switch (p.type) {
          case 'rocket': rect(x - 4, y - 2, 8, 4, P.rocket); rect(p.vx >= 0 ? x + 4 : x - 6, y - 1, 2, 2, P.rocketTip); rect(p.vx >= 0 ? x - 6 : x + 4, y - 1, 2, 2, frame % 2 ? P.fire : P.fireCore); break;
          case 'grenade': disc(x, y - 3, 3, P.grenade); rect(x - 1, y - 7, 2, 2, P.rocket); break;
          case 'holy': disc(x, y - 4, 4, P.holy); rect(x - 1, y - 7, 2, 5, '#8a5a2a'); rect(x - 2, y - 6, 4, 1, '#8a5a2a'); break;
          case 'banana': case 'bananette': rect(x - 3, y - 2, 6, 2, P.banana); rect(x - 4, y - 3, 2, 2, P.banana); rect(x + 2, y - 3, 2, 2, P.banana); break;
          case 'bomb': rect(x - 2, y - 4, 4, 7, '#5a5a68'); rect(x - 1, y - 6, 2, 2, P.rocketTip); break;
          case 'sheep': sprite(p.dir < 0 ? flip(SHEEP) : SHEEP, { W: P.sheep, K: P.sheepDark }, x - 5, y - 6, 1); break;
          case 'cow': {
            const spin = p.charging ? 0 : Math.floor(now / 120) % 2;
            sprite((p.charging ? p.dir : (p.vx >= 0 ? 1 : -1)) < 0 ? flip(COW) : COW, { W: P.sheep, K: P.sheepDark, P: P.cowPink }, x - 5, y - 6 - spin * 2, 1);
            if (p.charging && frame % 2) rect(x + (p.dir > 0 ? -8 : 6), y - 2, 3, 2, P.smoke);
            break;
          }
          case 'dynamite': rect(x - 2, y - 10, 4, 10, P.dynamite); rect(x - 1, y - 12, 1, 2, '#d8d8e8'); if (frame % 2) rect(x - 2, y - 14, 3, 2, P.fireCore); break;
        }
      }
      for (const plane of world.planes) sprite(plane.dir < 0 ? flip(PLANE) : PLANE, { G: P.plane, R: P.rocketTip }, Math.round(plane.x) - 8, 4, 1);
      for (const q of world.particles) rect(Math.round(q.x), Math.round(q.y), q.size, q.size, q.color);
      for (const b of world.blasts) {
        const p = (now - b.start) / 900;
        if (p < 0.15) disc(b.x, b.y, Math.round(b.r * (0.4 + p * 4)), P.flash);
        else if (p < 0.6) { disc(b.x, b.y, Math.round(b.r * (0.9 + p * 0.4)), P.fire); disc(b.x, b.y - 2, Math.round(b.r * 0.55), P.fireCore); }
      }
      for (const t of world.texts) text(t.text, Math.round(t.x) - t.text.length * 3, Math.round(t.y), t.color);
      const teams = world.teamOrder.map(name => world.teams.get(name));
      teams.forEach((team, i) => {
        const members = [...world.worms.values()].filter(worm => worm.team === team.name);
        const total = members.reduce((sum, worm) => sum + (worm.respawnAt ? 0 : worm.health), 0);
        const max = Math.max(1, members.length * 100);
        const ty = 4 + i * 10;
        miniText(team.name.slice(0, 10), 4, ty + 1, team.color);
        rect(48, ty, 62, 7, 'rgba(0,0,0,0.5)'); rect(49, ty + 1, Math.round(60 * total / max), 5, team.color);
      });
      const wx = world.W - 60;
      rect(wx, 4, 56, 8, 'rgba(0,0,0,0.5)');
      rect(wx + 28, 5, 1, 6, '#d8d8e8');
      if (world.wind) rect(world.wind > 0 ? wx + 29 : wx + 28 + world.wind * 5, 6, Math.abs(world.wind) * 5, 4, world.wind > 0 ? P.waterLight : P.rocketTip);
      miniText('WIND', wx - 20, 6, '#d8d8e8');
      const turn = world.turn;
      if (turn && turn.phase !== 'rest') {
        const team = world.teams.get(turn.shooter.team);
        const banner = `${String(turn.shooter.agent.type).slice(0, 7)}: ${turn.weapon.name}`;
        const bw = banner.length * 6 + 8;
        rect(Math.round(world.W / 2 - bw / 2), 4, bw, 11, P.label);
        text(banner, Math.round(world.W / 2 - bw / 2) + 4, 6, team?.color || '#fff');
      }
      g.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    },
    explode(exit) {
      if (exit.handled) return;
      exit.handled = true;
      world.kill(exit.id, exit.label);
    }
  };

  const THEMES = { office, bridge, lemmings, worms };

  // ---------- positions ----------
  function positionOf(desk, room) {
    const T = THEMES[theme];
    const home = T.standing ? T.standing(desk, room) : { x: desk.x * TILE, y: desk.y * TILE };
    const { agent } = desk;
    if (statusOf(agent) !== 'working' || reducedMotion.matches) return { ...home, away: false, moving: false, dir: 1 };
    if (T.walk) return T.walk(desk, room, home);
    return { ...home, away: false, moving: false, dir: 1 };
  }

  // ---------- rendering ----------
  function draw() {
    const T = THEMES[theme];
    g = ctx;
    T.drawScene(layout);
    const positions = [];
    for (const room of layout.rooms) for (const desk of room.desks) positions.push({ desk, room, pos: positionOf(desk, room) });
    for (const { desk, room, pos } of positions) T.drawSeat(desk, pos, room, positions);
    for (const { desk, pos } of positions) {
      placeButton(desk, pos);
      lastPositions.set(desk.agent.id, { x: pos.x, y: pos.y, label: desk.agent.type });
    }
    T.drawEffects?.(positions);
    const clock = performance.now();
    for (let i = exits.length - 1; i >= 0; i--) {
      const p = (clock - exits[i].start) / EXIT_MS;
      if (p >= 1) exits.splice(i, 1);
      else T.explode?.(exits[i], p);
    }
    if (!layout.rooms.length && !exits.length) {
      const msg = agents.length ? T.quietText : T.emptyText;
      text(msg, Math.floor((layout.tilesW * TILE - msg.length * 6) / 2), Math.floor(layout.tilesH * TILE / 2) - 4, TEXT);
    }
  }

  function resize() {
    const T = THEMES[theme];
    const width = Math.max(200, stage.clientWidth);
    scale = width >= 1100 ? 3 : width >= 420 ? 2 : 1;
    const tilesW = Math.max(T.minTiles, Math.floor(width / (TILE * scale)));
    layout = T.layout(groupAgents(shown), tilesW);
    dpr = window.devicePixelRatio || 1;
    const cssW = layout.tilesW * TILE * scale, cssH = layout.tilesH * TILE * scale;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    overlay.style.width = `${cssW}px`;
    overlay.style.height = `${cssH}px`;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    buildOverlay();
    draw();
    animate();
  }

  function animate() {
    cancelAnimationFrame(raf);
    if (reducedMotion.matches || (!shown.length && !exits.length)) return;
    let last = -1;
    const tick = time => {
      now = time;
      if (!shown.length && !exits.length) { draw(); return; }
      const next = Math.floor(time / (1000 / (THEMES[theme].fps || 8)));
      if (next !== last) { last = next; frame = Math.floor(time / 250); draw(); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function applyTheme(next) {
    if (!THEMES[next] || next === theme) return;
    theme = next;
    document.body.dataset.theme = theme;
    themeSelect.value = theme;
    exits.length = 0;
    resize();
  }

  // ---------- accessible overlay ----------
  function element(tag, content, className) {
    const node = document.createElement(tag);
    if (content) node.textContent = content;
    if (className) node.className = className;
    return node;
  }

  function placeButton(desk, pos) {
    const button = buttons.get(desk.agent.id);
    if (!button) return;
    const left = `${pos.x * scale}px`, top = `${(pos.y - 12) * scale}px`;
    if (button.style.left !== left) button.style.left = left;
    if (button.style.top !== top) button.style.top = top;
  }

  function buildOverlay() {
    const focused = document.activeElement?.dataset?.agentId;
    overlay.replaceChildren();
    buttons.clear();
    for (const room of layout.rooms) {
      for (const desk of room.desks) {
        const { agent } = desk;
        const button = element('button', '', 'agent');
        button.dataset.agentId = agent.id;
        button.style.width = `${TILE * 2 * scale}px`;
        button.style.height = `${(TILE * 2 + 12) * scale}px`;
        button.setAttribute('aria-label', `${agent.type}${agent.model ? ` on ${agent.model}` : ''}, ${agent.status}, ${room.name} seat ${desk.index + 1}`);
        button.setAttribute('aria-pressed', String(agent.id === selected));
        button.title = `${agent.type}: ${agent.status}${agent.model ? ` (${agent.model})` : ''}`;
        button.addEventListener('click', event => { event.stopPropagation(); select(agent.id); });
        overlay.append(button);
        buttons.set(agent.id, button);
        placeButton(desk, positionOf(desk, room));
      }
    }
    if (focused) buttons.get(focused)?.focus();
    empty.hidden = agents.length > 0;
  }

  function select(id) {
    selected = id;
    vscode.setState({ selected });
    for (const [agentId, button] of buttons) button.setAttribute('aria-pressed', String(agentId === selected));
    draw();
    inspect();
  }

  function inspect() {
    details.replaceChildren(element('h2', 'Agent inspector'));
    const agent = agents.find(item => item.id === selected);
    details.hidden = !agent;
    if (!agent) return;
    const title = element('h3', '');
    title.append(element('span', '■ ', `swatch ${statusOf(agent)}`), document.createTextNode(agent.type));
    details.append(title);
    const list = element('dl');
    const fields = {
      Status: agent.status,
      Model: agent.model || 'Not reported yet.',
      Provider: agent.provider === 'copilot' ? 'GitHub Copilot' : 'Claude Code',
      Department: agent.department,
      Task: agent.task || (agent.agentId === 'main' ? 'No prompt received yet.' : 'Not provided by lifecycle hooks.'),
      'Last tool': agent.tool || '—',
      'Agent ID': agent.agentId,
      Session: agent.sessionId,
      Workspace: agent.cwd || '—',
      'Last activity': new Date(agent.updatedAt).toLocaleString()
    };
    for (const [label, value] of Object.entries(fields)) list.append(element('dt', label), element('dd', value));
    details.append(list);
  }

  document.getElementById('install').addEventListener('click', () => vscode.postMessage({ type: 'installHooks' }));
  document.getElementById('office').addEventListener('click', () => { if (selected) select(''); });
  window.addEventListener('keydown', event => { if (event.key === 'Escape' && selected) select(''); });
  themeSelect.addEventListener('change', () => {
    const next = themeSelect.value;
    applyTheme(next);
    vscode.postMessage({ type: 'setTheme', theme: next });
  });
  window.addEventListener('message', event => {
    if (event.data?.type !== 'snapshot' || !Array.isArray(event.data.agents)) return;
    applyTheme(event.data.theme);
    const next = JSON.stringify(event.data.agents);
    if (signature === next) return;
    signature = next;
    const wasShown = new Set(shown.map(agent => agent.id));
    agents = event.data.agents;
    shown = agents.filter(agent => agent.status === 'working' || agent.status === 'waiting');
    // Agents that were on the map and have now finished play the theme's exit effect.
    for (const agent of agents) {
      const last = lastPositions.get(agent.id);
      if (agent.status === 'finished' && wasShown.has(agent.id) && last && THEMES[theme].explode) {
        exits.push({ id: agent.id, label: agent.type, x: last.x, y: last.y, start: performance.now() });
      }
    }
    resize();
    inspect();
  });
  new ResizeObserver(() => resize()).observe(stage);
  reducedMotion.addEventListener?.('change', resize);
  document.body.dataset.theme = theme;
  resize();
  inspect();
  vscode.postMessage({ type: 'ready' });
})();

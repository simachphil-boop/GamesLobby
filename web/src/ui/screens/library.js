// Game Library and per-game table setup.
import { h, shuffleInPlace } from '../../core/util.js';
import { btn, screen, show, header, options, alertBox, toast } from '../ui.js';
import { t, tl } from '../../i18n/index.js';
import { save, owns, commit } from '../../core/store.js';
import { GAMES } from '../../games/registry.js';
import { PERSONAS, personaById } from '../../bots/personas.js';
import { ROOMS } from '../../core/catalog.js';
import { LEVELS } from '../../games/framework.js';
import { sfx } from '../../core/audio.js';

function thumb(def) {
  const c = document.createElement('canvas');
  c.width = 320; c.height = 240;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 320, 240);
  grad.addColorStop(0, def.colors?.[0] || '#2a1a6a'); grad.addColorStop(1, def.colors?.[1] || '#0b0d26');
  g.fillStyle = grad; g.fillRect(0, 0, 320, 240);
  if (def.thumb) def.thumb(g, 320, 240);
  else { g.font = '110px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(def.icon || '🎲', 160, 125); }
  return c;
}

export function library(app, mode = 'bots') {
  let cat = 'all';
  const grid = h('div', { class: 'cards scroll grow' });
  const cats = ['all', 'board', 'card', 'strategy'];
  const tabs = h('div', { class: 'tabs' });
  const renderTabs = () => {
    tabs.innerHTML = '';
    for (const c of cats) {
      const el = h('div', { class: 'tab' + (c === cat ? ' on' : '') }, c === 'all' ? t('lib.all') : t('cat.' + c));
      el.addEventListener('click', () => { sfx('click'); cat = c; renderTabs(); render(); });
      tabs.appendChild(el);
    }
  };
  const render = () => {
    grid.innerHTML = '';
    for (const def of GAMES) {
      if (def.hidden) continue;
      if (cat !== 'all' && def.category !== cat) continue;
      if (mode === 'local' && def.maxPlayers < 2) continue;
      const played = save.profile.stats.perGame[def.id]?.played || 0;
      const card = h('div', { class: 'gcard panel' }, thumb(def),
        h('div', { class: 'tag' }, t('cat.' + def.category)),
        h('div', { class: 'info' }, h('div', { class: 'name' }, t('game.' + def.id + '.name')),
          h('div', { class: 'meta' }, t('lib.players', { min: def.minPlayers, max: def.maxPlayers }) + (played ? ' · ' + t('lib.played', { n: played }) : ''))));
      card.addEventListener('click', () => { sfx('open'); show(setup, app, def.id, mode); });
      grid.appendChild(card);
    }
  };
  renderTabs(); render();
  const el = screen('', header(t('lib.title')), tabs, grid);
  return { el, onShow: () => app.rig.setCinematic('library') };
}

export function setup(app, gameId, mode = 'bots') {
  const def = GAMES.find((g) => g.id === gameId);
  const saved = save.gameOptions[gameId] || {};
  const opts = {};
  for (const o of def.options || []) {
    let v = saved[o.key] ?? o.default;
    if (o.collection && !owns(o.collection, v)) v = o.default;
    opts[o.key] = v;
  }
  let n = Math.max(def.minPlayers, Math.min(def.maxPlayers, saved._players || def.defaultPlayers || def.minPlayers));
  let humans = mode === 'local' ? Math.min(n, Math.max(2, saved._humans || 2)) : 1;
  let difficulty = saved._difficulty || 'normal';
  let room = save.settings.room;
  let personas = shuffleInPlace(PERSONAS.map((p) => p.id));
  if (saved._personas) personas = [...saved._personas.filter((id) => personaById(id)), ...personas.filter((id) => !saved._personas.includes(id))];

  const body = h('div', { class: 'scroll grow panel', style: { padding: '14px' } });
  const render = () => {
    body.innerHTML = '';
    const field = (label, el) => h('div', { class: 'field' }, h('label', null, label), el);
    body.append(h('div', { class: 'row', style: { marginBottom: '10px' } },
      h('div', { style: { fontSize: '34px' } }, def.icon),
      h('div', { class: 'col grow', style: { gap: '2px' } }, h('div', { class: 'title' }, t('game.' + def.id + '.name')), h('div', { class: 'mini' }, t('game.' + def.id + '.desc'))),
      btn(t('lib.rules'), () => alertBox(h('div', { class: 'rules' }, tl(def.rulesText))), 'small ghost')));
    if (def.maxPlayers > def.minPlayers) {
      const list = []; for (let i = def.minPlayers; i <= def.maxPlayers; i++) list.push({ value: i, label: String(i) });
      body.append(field(t('setup.players'), options(list, n, (v) => { n = v; humans = Math.min(humans, n); render(); })));
    }
    if (mode === 'local') {
      const list = []; for (let i = 2; i <= n; i++) list.push({ value: i, label: String(i) });
      body.append(field(t('setup.humans'), options(list, humans, (v) => { humans = v; render(); })));
    }
    const botsN = n - humans;
    if (botsN > 0) {
      body.append(field(t('setup.difficulty'), h('div', null,
        options(LEVELS.map((l) => ({ value: l, label: t('diff.' + l) })), difficulty, (v) => { difficulty = v; render(); }),
        h('div', { class: 'mini', style: { marginTop: '6px' } }, t('diff.' + difficulty + '.d')))));
      const opp = h('div', { class: 'opts' });
      for (let i = 0; i < botsN; i++) {
        const p = personaById(personas[i]);
        const el = h('div', { class: 'opt sel' }, '🤖 ' + tl(p.name), h('div', { class: 'mini' }, tl(p.style)));
        el.addEventListener('click', () => {
          sfx('click');
          // cycle to next persona not already seated
          const used = new Set(personas.slice(0, botsN));
          let k = PERSONAS.findIndex((x) => x.id === personas[i]);
          for (let s = 0; s < PERSONAS.length; s++) { k = (k + 1) % PERSONAS.length; if (!used.has(PERSONAS[k].id)) break; }
          const j = personas.indexOf(PERSONAS[k].id);
          [personas[i], personas[j]] = [personas[j], personas[i]];
          render();
        });
        opp.appendChild(el);
      }
      body.append(field(t('setup.opponents'), opp));
    }
    for (const o of def.options || []) {
      if (o.showIf && !o.showIf(opts, n)) continue;
      const list = o.values.map((v) => ({ value: v.value, label: v.label ? tl(v.label) : t(v.key) }));
      body.append(field(t(o.labelKey), options(list, opts[o.key], (v) => { opts[o.key] = v; if (o.rerender) render(); },
        { locked: (v) => !!o.collection && !owns(o.collection, v) })));
    }
    body.append(field(t('setup.room'), options(ROOMS.map((r) => ({ value: r.id, label: t('room.' + r.id) })), room, (v) => { room = v; },
      { locked: (v) => !owns('rooms', v) })));
  };
  render();
  const start = () => {
    save.gameOptions[gameId] = { ...opts, _players: n, _humans: humans, _difficulty: difficulty, _personas: personas.slice(0, 4) };
    commit();
    const seats = [];
    for (let i = 0; i < humans; i++) seats.push({ type: 'human' });
    for (let i = 0; i < n - humans; i++) seats.push({ type: 'bot', personaId: personas[i], level: difficulty });
    // interleave humans and bots around the table for local games
    app.startMatch(def, { mode, gameId, options: { ...opts, difficulty }, seats, room });
  };
  const el = screen('', header(t('setup.title')), body,
    h('div', { class: 'row', style: { marginTop: '12px', justifyContent: 'center' } }, btn(t('setup.start'), start, 'primary', { style: 'min-width:220px;font-size:18px' })));
  return { el };
}

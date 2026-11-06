// ONLINE: create/join rooms by code, lobby, host picks the game, synchronized start.
import { h, shuffleInPlace } from '../../core/util.js';
import { btn, screen, header, options, toast } from '../ui.js';
import { t } from '../../i18n/index.js';
import { save, commit } from '../../core/store.js';
import { OnlineRoom, makeCode } from '../../net/online.js';
import { GAMES } from '../../games/registry.js';
import { PERSONAS } from '../../bots/personas.js';
import { LEVELS } from '../../games/framework.js';
import { sfx } from '../../core/audio.js';

export function online(app) {
  let room = null;
  let game = save.gameOptions._onlineGame || 'colorblitz';
  let nPlayers = 4;
  let difficulty = 'normal';
  const body = h('div', { class: 'panel scroll grow', style: { padding: '16px', maxWidth: '560px', width: '100%', margin: '0 auto' } });
  const server = save.settings.server;

  const startLocalMatch = (config) => {
    const def = GAMES.find((g) => g.id === config.gameId);
    const seats = room.localSeats(config);
    const localSeat = room.localSeatIndex(config);
    const r = room; room = null; // ownership moves to the match
    app.startMatch(def, { mode: 'online', gameId: def.id, options: config.options, seed: config.seed, seats, localSeat, net: r });
  };

  const bind = () => {
    room.on('status', render);
    room.on('roster', render);
    room.on('joined', (p) => { sfx('notify'); toast(t('on.joined', { name: p.name })); });
    room.on('left', (p) => toast(t('on.disconnected', { name: p.name })));
    room.on('joinFailed', () => { toast(t('on.joinFail')); room.close(); room = null; render(); });
    room.on('hostLeft', () => { if (room) { toast(t('on.status.offline')); room.close(); room = null; render(); } });
    room.on('start', (config) => startLocalMatch(config));
  };

  const render = () => {
    body.innerHTML = '';
    body.append(h('div', { class: 'mini', style: { marginBottom: '10px' } },
      (server ? '🌐 ' + t('on.transport.server') + ': ' + server : '📱 ' + t('on.transport.local')) + ' · ' + t('on.status.' + (room ? room.status : 'offline'))));
    if (!server) body.append(h('div', { class: 'mini', style: { marginBottom: '12px' } }, t('on.serverNone')));
    if (!room) {
      const name = h('input', { type: 'text', value: save.profile.name, maxlength: 14 });
      const code = h('input', { type: 'text', placeholder: t('on.enterCode'), maxlength: 5, style: { textTransform: 'uppercase', letterSpacing: '.2em' } });
      body.append(
        h('div', { class: 'field' }, h('label', null, t('on.name')), name),
        btn('➕ ' + t('on.create'), () => {
          room = new OnlineRoom({ code: makeCode(), host: true, name: name.value || save.profile.name, look: save.profile.avatar, server });
          bind(); render();
        }, 'primary'),
        h('div', { class: 'section-t' }, t('on.join')),
        h('div', { class: 'row' }, code, btn(t('on.join'), () => {
          const c = code.value.trim().toUpperCase();
          if (c.length < 4) { sfx('error'); return; }
          room = new OnlineRoom({ code: c, host: false, name: name.value || save.profile.name, look: save.profile.avatar, server });
          bind(); render();
        })),
      );
      return;
    }
    const codeEl = h('div', { class: 'code' }, room.code);
    codeEl.addEventListener('click', () => { navigator.clipboard?.writeText(room.code).then(() => toast(t('on.copied'))).catch(() => {}); });
    body.append(h('div', { class: 'field' }, h('label', null, t('on.code')), codeEl), h('div', { class: 'mini center' }, t('on.hint')),
      h('div', { class: 'section-t' }, t('on.players') + ` (${room.players.length}/5)`),
      ...room.players.map((p) => h('div', { class: 'list-item' }, h('div', null, p.id === room.hostId ? '👑' : '🙂'), h('div', { class: 'grow' }, p.name + (p.id === room.id ? ` (${t('you')})` : '')))),
      room.players.length < 2 ? h('div', { class: 'mini' }, t('on.waiting')) : null);
    if (room.isHost) {
      const def = GAMES.find((g) => g.id === game);
      body.append(h('div', { class: 'section-t' }, t('on.chooseGame')),
        options(GAMES.filter((g) => !g.hidden && g.online !== false).map((g) => ({ value: g.id, label: g.icon + ' ' + t('game.' + g.id + '.name') })), game, (v) => { game = v; save.gameOptions._onlineGame = v; commit(); room.selectedGame = v; room.broadcastRoster(); render(); }));
      const minP = Math.max(def.minPlayers, room.players.length);
      if (def.maxPlayers > minP) {
        const list = []; for (let i = minP; i <= def.maxPlayers; i++) list.push({ value: i, label: String(i) });
        nPlayers = Math.max(minP, Math.min(def.maxPlayers, nPlayers));
        body.append(h('div', { class: 'section-t' }, t('setup.players')), options(list, nPlayers, (v) => { nPlayers = v; }));
      } else nPlayers = minP;
      body.append(h('div', { class: 'section-t' }, t('setup.difficulty')), options(LEVELS.map((l) => ({ value: l, label: t('diff.' + l) })), difficulty, (v) => { difficulty = v; }));
      body.append(h('div', { class: 'row', style: { marginTop: '14px', justifyContent: 'center' } },
        btn(t('on.start'), () => {
          const d = GAMES.find((g) => g.id === game);
          if (room.players.length > d.maxPlayers) { sfx('error'); return; }
          const opts = {};
          for (const o of d.options || []) opts[o.key] = (save.gameOptions[d.id] || {})[o.key] ?? o.default;
          opts.difficulty = difficulty;
          const cfg = room.startGame(game, opts, shuffleInPlace(PERSONAS.map((p) => p.id)), Math.max(nPlayers, d.minPlayers));
          startLocalMatch(cfg);
        }, 'primary')));
    } else {
      body.append(h('div', { class: 'center muted', style: { margin: '12px' } }, room.selectedGame ? '🎲 ' + t('game.' + room.selectedGame + '.name') : ''), h('div', { class: 'center mini' }, t('on.guestWait')));
    }
    body.append(h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '10px' } }, btn(t('on.leave'), () => { room.close(); room = null; render(); }, 'ghost small')));
  };
  render();
  return { el: screen('', header(t('on.title')), body), onHide: () => { if (room) { room.close(); room = null; } } };
}

// Main menu, mode selection and profile chip.
import { h } from '../../core/util.js';
import { btn, screen, show, modal, closeModal, toast } from '../ui.js';
import { t } from '../../i18n/index.js';
import { save, xpForLevel, dailyStatus } from '../../core/store.js';
import { bus } from '../../core/events.js';
import { GAMES } from '../../games/registry.js';
import { PERSONAS } from '../../bots/personas.js';
import { shuffleInPlace } from '../../core/util.js';

export function topBar(app) {
  const p = save.profile;
  const xp = Math.round((p.xp / xpForLevel(p.level)) * 100);
  const prof = h('div', { class: 'chip', style: { cursor: 'pointer' } },
    h('div', { class: 'dot' }, p.name.slice(0, 1).toUpperCase()),
    h('div', { class: 'col', style: { gap: '3px' } }, h('div', null, p.name, ' ', h('span', { class: 'gold' }, `· ${t('level')} ${p.level}`)), h('div', { class: 'xpbar' }, h('i', { style: { width: xp + '%' } }))));
  prof.addEventListener('click', () => show(app.screens.profile, app));
  const coins = h('div', { class: 'chip', style: { paddingLeft: '10px' } }, h('i', { class: 'coin' }), ' ', p.coins.toLocaleString());
  return h('div', { class: 'menu-top' }, prof, coins);
}

export function mainMenu(app) {
  const ds = dailyStatus();
  const m = save.match;
  const gdef = m && GAMES.find((g) => g.id === m.gameId);
  const grid = h('div', { class: 'menu-grid' },
    gdef ? btn(h('span', null, '▶ ' + t('menu.continueOf', { game: t('game.' + gdef.id + '.name') })), () => app.resumeMatch(), 'good continue') : null,
    btn(h('span', null, t('menu.play')), () => show(modeSelect, app), 'primary play'),
    btn([h('span', { class: 'ico' }, '📚'), t('menu.library')], () => show(app.screens.library, app, 'bots')),
    btn([h('span', { class: 'ico' }, '🧑'), t('menu.character')], () => show(app.screens.character, app)),
    btn([h('span', { class: 'ico' }, '💎'), t('menu.collection')], () => show(app.screens.collection, app)),
    btn([h('span', { class: 'ico' }, '🌐'), t('menu.online')], () => show(app.screens.online, app)),
    btn([h('span', { class: 'ico' }, '🎁'), t('menu.daily'), ds.canClaim ? h('span', { class: 'badge' }, '!') : null], () => show(app.screens.daily, app)),
    btn([h('span', { class: 'ico' }, '⚙️'), t('menu.settings')], () => show(app.screens.settings, app)),
  );
  const el = screen('menu', topBar(app),
    h('div', { class: 'menu-body' },
      h('div', { class: 'col', style: { alignItems: 'center', gap: '6px' } },
        h('div', { class: 'logo' }, h('span', null, 'BOARD'), h('b', null, 'VERSE')),
        h('div', { class: 'tagline' }, t('menu.tagline'))),
      grid),
    h('div', { class: 'menu-foot' }, 'BOARDVERSE · v' + (window.BV_VERSION || '1.0')));
  const off = bus.on('profile', () => { const nt = topBar(app); el.firstChild.replaceWith(nt); });
  return {
    el, onHide: off,
    onShow: () => { app.rig.setCinematic('menu'); },
    back: () => { if (window.BoardverseNative) window.BoardverseNative.exitApp(); return true; },
  };
}

export function modeSelect(app) {
  const card = (icon, title, desc, onClick, cls = '') => {
    const b = btn(h('div', { class: 'row', style: { textAlign: 'left' } }, h('div', { style: { fontSize: '30px' } }, icon),
      h('div', { class: 'col', style: { gap: '2px' } }, h('div', null, title), h('div', { class: 'mini', style: { fontWeight: 500 } }, desc))), onClick, cls);
    b.style.width = '100%';
    return b;
  };
  const el = screen('', h('div', { class: 'header' }, btn('←', () => app.goMenu(), 'icon ghost back'), h('div', { class: 'title' }, t('mode.title'))),
    h('div', { class: 'col', style: { maxWidth: '520px', width: '100%', margin: 'auto' } },
      card('🤖', t('mode.bots'), t('mode.bots.desc'), () => show(app.screens.library, app, 'bots'), 'primary'),
      card('👥', t('mode.local'), t('mode.local.desc'), () => show(app.screens.library, app, 'local')),
      card('🌐', t('mode.online'), t('mode.online.desc'), () => show(app.screens.online, app)),
      card('⚡', t('mode.quick'), t('mode.quick.desc'), () => quickGame(app)),
    ));
  return { el };
}

export function quickGame(app) {
  // Prefer the favorite / least recently seen game, random 2-4 players, normal bots.
  const pg = save.profile.stats.perGame;
  const pool = GAMES.filter((g) => !g.hidden);
  const weights = pool.map((g) => 1 + (pg[g.id]?.played || 0) * 0.3 + (g.id === 'tycoon' || g.id === 'colorblitz' ? 1 : 0));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  let def = pool[0];
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) { def = pool[i]; break; } }
  const n = Math.max(def.minPlayers, Math.min(def.maxPlayers, def.quickPlayers || def.defaultPlayers || 2));
  const opts = {};
  for (const o of def.options || []) opts[o.key] = (save.gameOptions[def.id] || {})[o.key] ?? o.default;
  const personas = shuffleInPlace([...PERSONAS]);
  const seats = [{ type: 'human' }];
  for (let i = 1; i < n; i++) seats.push({ type: 'bot', personaId: personas[i].id, level: 'normal' });
  toast('⚡ ' + t('game.' + def.id + '.name'));
  app.startMatch(def, { mode: 'quick', gameId: def.id, options: { ...opts, difficulty: 'normal' }, seats });
}

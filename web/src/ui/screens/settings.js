// SETTINGS, DAILY REWARDS and PROFILE screens.
import { h } from '../../core/util.js';
import { btn, screen, header, toggle, options, confirmBox, toast, refresh } from '../ui.js';
import { t, LANGS, setLang } from '../../i18n/index.js';
import { save, setSetting, resetProgress, dailyStatus, claimDaily, DAILY_REWARDS, ACHIEVEMENTS, favoriteGame, xpForLevel, ownedCount } from '../../core/store.js';
import { ROOMS, UI_THEMES } from '../../core/catalog.js';
import { owns } from '../../core/store.js';
import { sfx } from '../../core/audio.js';
import { GAMES } from '../../games/registry.js';
import { bus } from '../../core/events.js';

const row = (label, control) => h('div', { class: 'setrow' }, h('div', { class: 'lbl' }, label), control);

export function settings(app) {
  const s = save.settings;
  const slider = (key) => {
    const r = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s[key], style: { maxWidth: '160px' } });
    r.addEventListener('input', () => setSetting(key, parseFloat(r.value)));
    return r;
  };
  const server = h('input', { type: 'text', value: s.server || '', placeholder: 'ws://192.168.1.10:8787' });
  server.addEventListener('change', () => { setSetting('server', server.value.trim()); toast(t('toast.saved')); });
  const body = h('div', { class: 'panel scroll grow', style: { padding: '6px 16px 16px' } },
    h('div', { class: 'section-t' }, t('set.section.general')),
    h('div', { class: 'field' }, h('label', null, t('set.language')),
      options(LANGS.map((l) => ({ value: l.id, label: l.name })), s.lang, (v) => { setLang(v); refresh(); })),
    h('div', { class: 'field' }, h('label', null, t('set.room')),
      options(ROOMS.map((r) => ({ value: r.id, label: t('room.' + r.id) })), s.room, (v) => app.setRoom(v), { locked: (v) => !owns('rooms', v) })),
    h('div', { class: 'field' }, h('label', null, t('set.uiTheme')),
      options(UI_THEMES.map((r) => ({ value: r.id, label: t('theme.' + r.id) })), s.uiTheme, (v) => setSetting('uiTheme', v), { locked: (v) => !owns('themes', v) })),
    row(t('set.botChat'), toggle(s.botChat, (v) => setSetting('botChat', v))),
    row(t('set.haptics'), toggle(s.haptics, (v) => setSetting('haptics', v))),
    h('div', { class: 'field' }, h('label', null, t('set.speed')),
      options([1, 1.6, 2.5].map((v) => ({ value: v, label: t('speed.' + v) })), s.speed, (v) => setSetting('speed', v))),
    h('div', { class: 'section-t' }, t('set.section.audio')),
    row(t('set.music'), toggle(s.music, (v) => setSetting('music', v))),
    row(t('set.musicVol'), slider('musicVol')),
    row(t('set.sfx'), toggle(s.sfx, (v) => setSetting('sfx', v))),
    row(t('set.sfxVol'), slider('sfxVol')),
    row(t('set.ambience'), toggle(s.ambience, (v) => setSetting('ambience', v))),
    h('div', { class: 'section-t' }, t('set.section.video')),
    h('div', { class: 'field' }, h('label', null, t('set.graphics')),
      options(['auto', 'low', 'medium', 'high'].map((v) => ({ value: v, label: t('q.' + v) })), s.quality, (v) => setSetting('quality', v))),
    h('div', { class: 'field' }, h('label', null, t('set.fps')),
      options([30, 60].map((v) => ({ value: v, label: v + ' FPS' })), s.fps, (v) => setSetting('fps', v)), h('div', { class: 'mini', style: { marginTop: '6px' } }, t('set.batteryHint'))),
    h('div', { class: 'field' }, h('label', null, t('set.camera')),
      options([{ value: 'fp', label: t('hud.fp') }, { value: 'tp', label: t('hud.tp') }], s.camera, (v) => { setSetting('camera', v); app.rig.mode = v; bus.emit('camera', v); })),
    row(t('set.sway'), toggle(s.sway, (v) => setSetting('sway', v))),
    h('div', { class: 'section-t' }, t('set.section.online')),
    h('div', { class: 'field' }, h('label', null, t('set.server')), server),
    h('div', { class: 'section-t' }, t('set.section.data')),
    btn(t('set.reset'), async () => { if (await confirmBox(t('set.resetConfirm'), { danger: true })) { resetProgress(); app.refreshLobbyAvatar(); toast(t('toast.saved')); } }, 'danger small'),
    h('div', { class: 'mini', style: { marginTop: '14px' } }, `BOARDVERSE v${window.BV_VERSION || '1.0'} · ${t('set.about')}: original board & card game universe. No real-money gambling.`),
  );
  return { el: screen('', header(t('set.title')), body) };
}

export function daily(app) {
  const body = h('div', { class: 'panel', style: { padding: '16px', maxWidth: '520px', width: '100%', margin: 'auto' } });
  const render = () => {
    const st = dailyStatus();
    const done = st.canClaim ? st.day - 1 : st.day;
    body.innerHTML = '';
    const grid = h('div', { class: 'daily-grid' });
    DAILY_REWARDS.forEach((v, i) => {
      const d = i + 1;
      const cls = 'day' + (d <= done ? ' done' : '') + (st.canClaim && d === st.day ? ' today' : '') + (d === 7 ? ' big' : '');
      grid.appendChild(h('div', { class: cls }, h('div', { class: 'd' }, t('daily.day', { n: d })), h('div', { style: { fontSize: '26px' } }, d === 7 ? '🎁' : d <= done ? '✅' : '🪙'), h('div', { class: 'v' }, '+' + v)));
    });
    body.append(grid, h('div', { class: 'mini center', style: { margin: '10px 0' } }, t('daily.streak', { n: save.profile.daily.streak })));
    if (st.canClaim) {
      body.append(h('div', { class: 'row', style: { justifyContent: 'center' } }, btn(t('daily.claim') + ' +' + DAILY_REWARDS[st.day - 1], () => {
        const r = claimDaily();
        if (r) { sfx('coins'); toast(t('daily.reward', { n: r.reward }), 'gold'); app.celebrate(); }
        render();
      }, 'primary')));
    } else body.append(h('div', { class: 'center gold' }, '✓ ' + t('daily.claimed')), h('div', { class: 'mini center' }, t('daily.comeBack')));
  };
  render();
  return { el: screen('', header(t('daily.title')), body) };
}

export function profile(app) {
  const p = save.profile;
  const s = p.stats;
  const fav = favoriteGame();
  const wr = s.played ? Math.round((s.wins / s.played) * 100) + '%' : t('prof.none');
  const stat = (v, l) => h('div', { class: 'stat' }, h('b', null, String(v)), h('span', null, l));
  const body = h('div', { class: 'panel scroll grow', style: { padding: '16px' } },
    h('div', { class: 'row' }, h('div', { class: 'chip' }, h('div', { class: 'dot', style: { width: '48px', height: '48px', fontSize: '22px' } }, p.name.slice(0, 1).toUpperCase())),
      h('div', { class: 'col', style: { gap: '4px' } }, h('div', { class: 'title' }, p.name), h('div', { class: 'gold' }, `${t('level')} ${p.level} · ${p.xp}/${xpForLevel(p.level)} XP`), h('div', { class: 'mini' }, `ⓒ ${p.coins} · ${t('prof.items')}: ${ownedCount()}`))),
    h('div', { class: 'section-t' }, ''),
    h('div', { class: 'stat-grid' }, stat(s.played, t('prof.played')), stat(s.wins, t('prof.wins')), stat(s.losses, t('prof.losses')),
      stat(wr, t('prof.winrate')), stat(s.bestStreak, t('prof.streak')), stat(fav ? t('game.' + fav + '.name') : t('prof.none'), t('prof.favorite'))),
    h('div', { class: 'section-t' }, t('prof.perGame')),
    ...GAMES.filter((g) => s.perGame[g.id]).map((g) => {
      const x = s.perGame[g.id];
      return h('div', { class: 'list-item' }, h('div', null, g.icon), h('div', { class: 'grow' }, t('game.' + g.id + '.name')), h('div', { class: 'mini' }, `${x.wins}/${x.played}`));
    }),
    h('div', { class: 'section-t' }, t('prof.achievements') + ` (${Object.keys(p.achievements).length}/${ACHIEVEMENTS.length})`),
    ...ACHIEVEMENTS.map((a) => h('div', { class: 'ach' + (p.achievements[a.id] ? '' : ' locked') }, h('div', { class: 'ic' }, a.icon),
      h('div', { class: 'col', style: { gap: '2px' } }, h('b', null, t('ach.' + a.id + '.name')), h('span', { class: 'mini' }, t('ach.' + a.id + '.desc'))))),
  );
  return { el: screen('', header(t('prof.title')), body) };
}

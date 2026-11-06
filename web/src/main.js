// BOARDVERSE entry point.
import { App } from './app.js';
import { mainMenu, modeSelect } from './ui/screens/menu.js';
import { library, setup } from './ui/screens/library.js';
import { character } from './ui/screens/character.js';
import { collection } from './ui/screens/collection.js';
import { settings, daily, profile } from './ui/screens/settings.js';
import { online } from './ui/screens/online.js';
import { back, toast, hasModal } from './ui/ui.js';
import { initAudio, suspendAudio, resumeAudio } from './core/audio.js';
import { commit, save } from './core/store.js';
import { bus } from './core/events.js';
import { t, setLang } from './i18n/index.js';

window.BV_VERSION = '1.0.0';
function boot() {
  const bar = document.querySelector('.boot-bar i');
  if (bar) bar.style.width = '40%';
  setLang(save.settings.lang);
  const app = new App();
  app.screens = { mainMenu, modeSelect, library, setup, character, collection, settings, daily, profile, online };
  window.BV = {
    app,
    onBack: () => {
      if (app.match && !hasModal()) { app.match.hud.pauseMenu(); return; }
      if (!back() && !app.match) { if (window.BoardverseNative) window.BoardverseNative.exitApp(); }
    },
    onPause: () => { commit(true); suspendAudio(); app.engine.paused = true; },
    onResume: () => { resumeAudio(); app.engine.paused = false; },
  };
  bus.on('achievements', (list) => list.forEach((a) => toast(`${a.icon} ${t('toast.achievement', { name: t('ach.' + a.id + '.name') })}`, 'gold')));
  document.addEventListener('pointerdown', () => initAudio(), { once: true });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.BV.onBack(); });
  window.addEventListener('beforeunload', () => commit(true));
  if (bar) bar.style.width = '100%';
  app.goMenu();
  setTimeout(() => document.getElementById('boot')?.classList.add('hide'), 350);
  setTimeout(() => document.getElementById('boot')?.remove(), 1100);
  // Debug/test hook: ?auto=<gameId>&n=4 runs a bots-only match (used by automated tests)
  const q = new URLSearchParams(location.search);
  if (q.get('auto')) {
    import('./games/registry.js').then(({ GAMES }) => {
      const def = GAMES.find((g) => g.id === q.get('auto'));
      const n = parseInt(q.get('n') || def.defaultPlayers || 2, 10);
      const seats = []; const ids = ['alex', 'max', 'sofia', 'luna'];
      for (let i = 0; i < n; i++) seats.push(q.get('human') === '1' && i === 0 ? { type: 'human' } : { type: 'bot', personaId: ids[i], level: q.get('level') || 'normal' });
      const opts = {}; for (const o of def.options || []) opts[o.key] = q.get(o.key) || o.default;
      app.startMatch(def, { mode: 'bots', gameId: def.id, options: opts, seats });
    });
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

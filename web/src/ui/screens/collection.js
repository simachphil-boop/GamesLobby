// COLLECTION: every cosmetic, unlockable with coins or achievements, and "use" shortcuts.
import { h } from '../../core/util.js';
import { btn, screen, header, toast, confirmBox } from '../ui.js';
import { t } from '../../i18n/index.js';
import { save, commit, owns, buy, setSetting, ownedCount } from '../../core/store.js';
import { bus } from '../../core/events.js';
import { CATEGORIES } from '../../core/catalog.js';
import { sfx } from '../../core/audio.js';
import { EMOTE_ICON } from '../hud.js';

export const ICONS = {
  tokens: { car: '🚗', ship: '🚢', cat: '🐱', dog: '🐶', crown: '👑', meeple: '🧍', plane: '✈️', robot: '🤖', rocket: '🚀', elephant: '🐘', crystal: '💎', dragon: '🐉' },
  decks: { classic: '🟥', neon: '🟪', pastel: '🩷', royal: '🟨' },
  boards: { classic: '🏙️', metro: '🌆', tropic: '🏝️', space: '🪐', medieval: '🏰', future: '🌐' },
  rooms: { modern: '🛋️', cozy: '🔥', luxury: '💎', retro: '🕹️', future: '🛸', casino: '🌃' },
  outfits: { tshirt: '👕', hoodie: '🧥', sweater: '🧶', jacket: '🧥', suit: '🤵', dress: '👗', tracksuit: '🏃', royal: '🫅' },
  hairs: { short: '💇', bob: '💇‍♀️', long: '👩', bun: '🧕', spiky: '🦔', curly: '👩‍🦱', ponytail: '👱‍♀️', mohawk: '🤘', bald: '👨‍🦲' },
  accessories: { none: '∅', glasses: '👓', sunglasses: '🕶️', cap: '🧢', hat: '🎩', beanie: '🧶', headphones: '🎧', bow: '🎀', earrings: '💍', crown: '👑' },
  emotes: EMOTE_ICON,
  themes: { royal: '🌌', aurora: '🌈', ember: '🌋', mint: '🍃' },
};

function itemName(cat, id) {
  if (cat === 'rooms') return t('room.' + id);
  if (cat === 'emotes') return t('emote.' + id);
  if (cat === 'themes') return t('theme.' + id);
  return t(`item.${cat}.${id}`);
}

function inUse(cat, id) {
  const av = save.profile.avatar;
  switch (cat) {
    case 'rooms': return save.settings.room === id;
    case 'themes': return save.settings.uiTheme === id;
    case 'outfits': return av.outfit === id;
    case 'hairs': return av.hair === id;
    case 'accessories': return av.accessory === id;
    case 'tokens': return (save.gameOptions.tycoon || {}).token === id;
    case 'boards': return (save.gameOptions.tycoon || {}).board === id;
    case 'decks': return (save.gameOptions.colorblitz || {}).deck === id;
    default: return false;
  }
}

function use(app, cat, id) {
  const av = save.profile.avatar;
  const go = (game, key) => { save.gameOptions[game] = { ...(save.gameOptions[game] || {}), [key]: id }; commit(); };
  switch (cat) {
    case 'rooms': app.setRoom(id); break;
    case 'themes': setSetting('uiTheme', id); break;
    case 'outfits': av.outfit = id; commit(); app.refreshLobbyAvatar(); break;
    case 'hairs': av.hair = id; commit(); app.refreshLobbyAvatar(); break;
    case 'accessories': av.accessory = id; commit(); app.refreshLobbyAvatar(); break;
    case 'tokens': go('tycoon', 'token'); break;
    case 'boards': go('tycoon', 'board'); break;
    case 'decks': go('colorblitz', 'deck'); break;
    default: return false;
  }
  return true;
}

export function collection(app) {
  let cat = 'tokens';
  const tabs = h('div', { class: 'tabs' });
  const grid = h('div', { class: 'cards scroll grow', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))' } });
  const total = Object.values(CATEGORIES).reduce((a, l) => a + l.length, 0);
  const progress = h('div', { class: 'mini center' });
  const render = () => {
    progress.textContent = t('col.progress', { n: ownedCount(), total }) + ' · ' + save.profile.coins + ' ⓒ';
    tabs.innerHTML = '';
    for (const c of Object.keys(CATEGORIES)) {
      const el = h('div', { class: 'tab' + (c === cat ? ' on' : '') }, t('col.' + c));
      el.addEventListener('click', () => { sfx('click'); cat = c; render(); });
      tabs.appendChild(el);
    }
    grid.innerHTML = '';
    for (const it of CATEGORIES[cat]) {
      const own = owns(cat, it.id);
      const using = own && inUse(cat, it.id);
      const card = h('div', { class: 'item panel' + (own ? '' : ' locked') + (using ? ' sel' : '') },
        h('div', { class: 'pic' }, ICONS[cat]?.[it.id] || '★'),
        h('div', { class: 'nm' }, itemName(cat, it.id)),
        h('div', { class: 'pr' }, own ? (using ? '✓ ' + t('col.equipped') : (cat === 'emotes' ? t('col.owned') : t('col.equip'))) :
          it.unlock && it.price === 0 ? '🏆 ' + t('ach.' + it.unlock + '.name') : (it.unlock ? `ⓒ ${it.price} / 🏆` : `ⓒ ${it.price}`)));
      card.addEventListener('click', async () => {
        if (own) { if (use(app, cat, it.id)) { sfx('pop'); render(); } return; }
        if (save.profile.coins < it.price) { sfx('error'); toast(t('col.notEnough') + (it.unlock ? ' · ' + t('col.unlockBy', { ach: t('ach.' + it.unlock + '.name') }) : '')); return; }
        if (!(await confirmBox(`${t('col.buy')}: ${itemName(cat, it.id)} — ⓒ ${it.price}?`))) return;
        if (buy(cat, it.id)) { sfx('buy'); toast(t('col.bought', { name: itemName(cat, it.id) }), 'gold'); use(app, cat, it.id); render(); }
      });
      grid.appendChild(card);
    }
  };
  render();
  const off = bus.on('profile', render);
  return { el: screen('', header(t('col.title')), progress, tabs, grid), onHide: off };
}

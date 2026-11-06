// MY CHARACTER: live 3D avatar editor (the camera flies to your seat at the table).
import { h } from '../../core/util.js';
import { btn, screen, header, toast, confirmBox } from '../ui.js';
import { t } from '../../i18n/index.js';
import { save, commit, owns, buy } from '../../core/store.js';
import { bus } from '../../core/events.js';
import { SKIN_TONES, HAIR_COLORS, OUTFIT_COLORS, EYE_COLORS, HAIRS, OUTFITS, ACCESSORIES, CATEGORIES } from '../../core/catalog.js';
import { sfx } from '../../core/audio.js';

export function character(app) {
  const av = save.profile.avatar;
  let tab = 'look';
  const panel = h('div', { class: 'panel scroll', style: { padding: '14px', maxHeight: '46vh' } });
  const apply = (emote) => {
    commit();
    const c = app.refreshLobbyAvatar();
    if (c && emote) c.emote(emote);
    bus.emit('profile');
  };
  const swatches = (list, key) => {
    const w = h('div', { class: 'swatches' });
    list.forEach((col, i) => {
      const s = h('div', { class: 'sw' + (av[key] === i ? ' sel' : ''), style: { background: col } });
      s.addEventListener('click', () => { sfx('click'); av[key] = i; apply('happy'); render(); });
      w.appendChild(s);
    });
    return w;
  };
  const items = (cat, list, key, emote) => {
    const w = h('div', { class: 'opts' });
    for (const it of list) {
      const own = owns(cat, it.id);
      const el = h('div', { class: 'opt' + (av[key] === it.id ? ' sel' : '') + (own ? '' : ' locked') },
        t(`item.${cat}.${it.id}`), own ? null : h('span', { class: 'price' }, ` · ⓒ${it.price}`));
      el.addEventListener('click', async () => {
        if (!own) {
          if (it.unlock && it.price === 0) { toast(t('col.unlockBy', { ach: t('ach.' + it.unlock + '.name') })); return; }
          if (save.profile.coins < it.price) { sfx('error'); toast(t('col.notEnough')); return; }
          if (!(await confirmBox(t('char.buy', { price: it.price }) + ' — ' + t(`item.${cat}.${it.id}`) + '?'))) return;
          if (!buy(cat, it.id)) { sfx('error'); return; }
          sfx('buy');
        } else sfx('click');
        av[key] = it.id; apply(emote); render();
      });
      w.appendChild(el);
    }
    return w;
  };
  const field = (label, el) => h('div', { class: 'field' }, h('label', null, label), el);
  const tabs = h('div', { class: 'tabs' });
  const wallet = h('span', null, '');
  const render = () => {
    tabs.innerHTML = '';
    wallet.textContent = save.profile.coins.toLocaleString();
    for (const k of ['look', 'style', 'extras']) {
      const el = h('div', { class: 'tab' + (k === tab ? ' on' : '') }, t('char.tab.' + k));
      el.addEventListener('click', () => { sfx('click'); tab = k; render(); });
      tabs.appendChild(el);
    }
    panel.innerHTML = '';
    if (tab === 'look') {
      const name = h('input', { type: 'text', value: save.profile.name, maxlength: 14 });
      name.addEventListener('change', () => { save.profile.name = name.value.trim().slice(0, 14) || 'Player'; commit(); bus.emit('profile'); toast(t('char.saved')); });
      panel.append(
        field(t('char.name'), name),
        field(t('char.skin'), swatches(SKIN_TONES, 'skin')),
        field(t('char.eyes'), swatches(EYE_COLORS, 'eyes')),
        field(t('char.body'), (() => {
          const w = h('div', { class: 'opts' });
          for (const b of ['slim', 'avg', 'broad']) {
            const el = h('div', { class: 'opt' + (av.body === b ? ' sel' : '') }, t('body.' + b));
            el.addEventListener('click', () => { sfx('click'); av.body = b; apply('nod'); render(); });
            w.appendChild(el);
          }
          return w;
        })()),
        field(t('char.mood'), (() => {
          const w = h('div', { class: 'opts' });
          for (const m of ['happy', 'neutral', 'smug', 'thinking']) {
            const el = h('div', { class: 'opt' + (av.mood === m ? ' sel' : '') }, t('mood.' + m));
            el.addEventListener('click', () => { sfx('click'); av.mood = m; apply(); render(); });
            w.appendChild(el);
          }
          return w;
        })()),
      );
    } else if (tab === 'style') {
      panel.append(
        field(t('char.hair'), items('hairs', HAIRS, 'hair', 'happy')),
        field(t('char.hairColor'), swatches(HAIR_COLORS, 'hairColor')),
        field(t('char.outfit'), items('outfits', OUTFITS, 'outfit', 'celebrate')),
        field(t('char.outfitColor'), swatches(OUTFIT_COLORS, 'outfitColor')),
      );
    } else {
      panel.append(field(t('char.accessory'), items('accessories', ACCESSORIES, 'accessory', 'cool')));
      const emo = h('div', { class: 'opts' });
      for (const [k, e] of [['wave', 'wave'], ['laugh', 'laugh'], ['celebrate', 'celebrate'], ['thinking', 'thinking'], ['surprised', 'surprised'], ['love', 'love']]) {
        const el = h('div', { class: 'opt' }, t('emote.' + (k === 'celebrate' ? 'party' : k === 'thinking' ? 'think' : k === 'surprised' ? 'wow' : k)));
        el.addEventListener('click', () => { sfx('pop'); app.lobbyAvatar()?.emote(e); });
        emo.appendChild(el);
      }
      panel.append(field(t('hud.emote'), emo));
    }
  };
  render();
  panel.style.maxHeight = 'none';
  const el = screen('charscr', header(t('char.title'), null, h('div', { class: 'chip' }, h('i', { class: 'coin' }), wallet)),
    h('div', { class: 'cpanel' }, tabs, h('div', { class: 'mini', style: { padding: '0 4px' } }, t('char.shopHint')), panel));
  return {
    el,
    onShow: () => { app.rig.setCinematic('character'); setTimeout(() => app.lobbyAvatar()?.emote('wave'), 900); },
    onHide: () => { commit(); },
  };
}

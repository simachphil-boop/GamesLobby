// In-game HUD (BOARDVERSE 1.1 layout):
//  top-left: your portrait card · top-center: 1st/3rd person switch · top-right: Rules / Settings / Exit
//  left column: opponents with portraits · right rail: quick emotions · bottom-right: big action button
import { h } from '../core/util.js';
import { btn, modal, closeModal, confirmBox, toggle, alertBox } from './ui.js';
import { t, tl } from '../i18n/index.js';
import { save, setSetting } from '../core/store.js';
import { EMOTES } from '../core/catalog.js';
import { sfx } from '../core/audio.js';
import { bus } from '../core/events.js';
import { renderPortrait } from '../scene/portrait.js';

const EMOTE_ICON = { wave: '👋', laugh: '😂', thumbs: '👍', think: '🤔', wow: '😮', cool: '😎', sad: '😢', angry: '😠', love: '😍', party: '🥳' };
export const EMOTE_ANIM = { wave: 'wave', laugh: 'laugh', thumbs: 'thumbs', think: 'thinking', wow: 'surprised', cool: 'cool', sad: 'sad', angry: 'angry', love: 'love', party: 'celebrate' };
const LEVEL_DOTS = { easy: 1, normal: 2, hard: 3, expert: 4 };

export class Hud {
  constructor(match) {
    this.match = match;
    const rig = match.app.rig;
    this.el = h('div', { class: 'screen hud2' });
    this.meCard = h('div', { class: 'pcard interactive' });
    this.seg = h('div', { class: 'seg interactive' },
      h('div', { 'data-m': 'fp' }, '👁', h('span', { class: 'lbl' }, t('hud.fp'))),
      h('div', { 'data-m': 'tp' }, '👥', h('span', { class: 'lbl' }, t('hud.tp'))));
    this.seg.querySelectorAll('div').forEach((d) => d.addEventListener('click', () => { sfx('click'); rig.setMode(d.dataset.m); }));
    const ibtn = (ic, label, fn) => { const b = h('div', { class: 'ibtn interactive' }, h('div', { class: 'ic' }, ic), h('div', { class: 'lbl' }, label)); b.addEventListener('click', () => { sfx('click'); fn(); }); return b; };
    this.tr = h('div', { class: 'ibtns' },
      ibtn('📖', t('hud.rules'), () => alertBox(h('div', { class: 'rules' }, tl(match.def.rulesText)))),
      ibtn('😊', t('hud.emote'), () => this.emoteMenu()),
      ibtn('⚙️', t('hud.menu'), () => this.pauseMenu()),
      ibtn('🚪', t('menu.exit'), async () => { if (await confirmBox(t('hud.quitConfirm'), { danger: true })) match.quit(); }));
    this.opps = h('div', { class: 'lc' });
    this.rail = h('div', { class: 'rc interactive' });
    this.bannerBox = h('div', { class: 'mid' });
    this.statusEl = h('div', { class: 'status' });
    this.extra = h('div', { class: 'col', style: { alignItems: 'center' } });
    this.actionsEl = h('div', { class: 'br' });
    this.corner = h('div', { class: 'bl' });
    this.el.append(h('div', { class: 'tl' }, this.meCard), h('div', { class: 'tc' }, this.seg), h('div', { class: 'tr' }, this.tr), this.opps, this.rail,
      this.bannerBox, h('div', { class: 'bc' }, this.extra, this.statusEl), this.actionsEl, this.corner);
    this.renderRail();
    this.syncCam();
    this.offCam = bus.on('camera', () => this.syncCam());
  }
  syncCam() { const m = this.match.app.rig.mode; this.seg.querySelectorAll('div').forEach((d) => d.classList.toggle('on', d.dataset.m === m)); }
  renderRail() {
    const owned = save.profile.owned.emotes;
    const quick = ['laugh', 'thumbs', 'wave', 'love', 'party', 'cool'].filter((e) => owned.includes(e)).slice(0, 4);
    this.rail.innerHTML = '';
    for (const id of quick) {
      const e = h('div', { class: 'em', title: t('emote.' + id) }, EMOTE_ICON[id]);
      e.addEventListener('click', () => { sfx('pop'); this.match.userEmote(id); });
      this.rail.appendChild(e);
    }
    const more = h('div', { class: 'em' }, '⋯'); more.addEventListener('click', () => this.emoteMenu()); this.rail.appendChild(more);
  }
  portrait(i) {
    try { return renderPortrait(this.match.app.engine, this.seats[i].character); } catch (e) { return ''; }
  }

  setPlayers(seats) {
    this.seats = seats;
    // portraits are rendered from the live 3D characters after they are placed
    requestAnimationFrame(() => requestAnimationFrame(() => this.buildCards()));
  }
  buildCards() {
    const me = this.match.me;
    this.cards = [];
    this.opps.innerHTML = '';
    this.seats.forEach((s, i) => {
      const img = h('img', { class: 'portrait sm', src: this.portrait(i), alt: '' });
      const stat = h('div', { class: 'os' }, '');
      const dots = h('div', { class: 'dots' }, ...[1, 2, 3, 4].map((k) => h('i', { class: k <= (s.isBot ? LEVEL_DOTS[s.level] || 2 : 4) ? '' : 'off' })));
      const card = h('div', { class: 'opp interactive' }, img, h('div', null, h('div', { class: 'on' }, s.name), stat, dots));
      card.addEventListener('click', () => this.match.view.onPlayerChip?.(i));
      card.style.borderLeft = `5px solid ${s.color}`;
      this.cards[i] = { card, stat };
      if (i !== me) this.opps.appendChild(card);
    });
    const ms = this.seats[me];
    this.meStat = h('div', { class: 'plv' }, '');
    this.meCard.innerHTML = '';
    this.meCard.append(h('img', { class: 'portrait', src: this.portrait(me), alt: '' }),
      h('div', { class: 'col', style: { gap: '2px' } }, h('div', { class: 'pname' }, ms.name),
        h('div', { class: 'plv' }, '⭐ ' + t('level') + ' ' + save.profile.level), this.meStat));
    this.meCard.style.borderColor = ms.color;
    if (this._lastState) this.updatePlayers(this._lastState);
    if (this._active != null) this.setActive(this._active);
  }
  updatePlayers(state) {
    this._lastState = state;
    if (!this.cards) return;
    const v = this.match.view;
    this.seats.forEach((s, i) => {
      const st = v.playerStat ? v.playerStat(state, i) : '';
      this.cards[i].stat.textContent = st ?? '';
      this.cards[i].card.classList.toggle('out', !!(v.isOut && v.isOut(state, i)));
      if (i === this.match.me && this.meStat) this.meStat.textContent = st ? '◆ ' + st : '';
    });
  }
  setActive(seat) {
    this._active = seat;
    this.cards?.forEach((c, i) => c.card.classList.toggle('active', i === seat));
    this.meCard.style.boxShadow = seat === this.match.me ? '0 0 0 2px #ffd34a, 0 0 26px rgba(255,190,60,.5)' : '';
  }
  status(text, mine = false) { this.statusEl.textContent = text || ''; this.statusEl.classList.toggle('me', mine); this.statusEl.style.display = text ? '' : 'none'; }
  banner(text, ms = 1600) {
    const b = h('div', { class: 'banner' }, text);
    this.bannerBox.innerHTML = '';
    this.bannerBox.appendChild(b);
    clearTimeout(this._bt);
    this._bt = setTimeout(() => b.remove(), ms);
  }
  /** buttons: [{label, onClick, cls, disabled}] — the 'primary' one becomes the big corner action. */
  actions(list) {
    this.actionsEl.innerHTML = '';
    const items = (list || []).filter(Boolean);
    const primary = items.find((a) => (a.cls || '').includes('primary'));
    for (const a of items) {
      if (a === primary) continue;
      const b = btn(a.label, a.onClick, (a.cls || '') + ' smallact');
      if (a.disabled) b.disabled = true;
      this.actionsEl.appendChild(b);
    }
    if (primary) {
      const m = String(primary.label).match(/^(\p{Extended_Pictographic}️?)\s*(.*)$/u);
      const content = m ? [h('span', { class: 'bi' }, m[1]), h('span', null, m[2])] : primary.label;
      const b = btn(content, primary.onClick, primary.cls + ' bigact');
      if (primary.disabled) b.disabled = true;
      this.actionsEl.appendChild(b);
    }
  }
  setExtra(el) { this.extra.innerHTML = ''; if (el) this.extra.appendChild(el); }
  setCorner(el) { this.corner.innerHTML = ''; if (el) this.corner.appendChild(el); }

  emoteMenu() {
    const owned = save.profile.owned.emotes;
    let m;
    const grid = h('div', { class: 'emotes' }, ...EMOTES.filter((e) => owned.includes(e.id)).map((e) =>
      btn(EMOTE_ICON[e.id], () => { closeModal(m); this.match.userEmote(e.id); }, '', { title: t('emote.' + e.id) })));
    m = modal(h('div', { class: 'col' }, h('div', { class: 'title center' }, t('hud.emote')), grid));
  }

  pauseMenu() {
    const M = this.match;
    let m;
    const close = () => closeModal(m);
    const rows = [
      btn(t('hud.resume'), close, 'primary'),
      btn(t('hud.rules'), () => { close(); alertBox(h('div', { class: 'rules' }, tl(M.def.rulesText))); }),
      M.canUndo() ? btn('↶ ' + t('hud.undo'), () => { close(); M.undo(); }) : null,
      h('div', { class: 'setrow' }, h('div', { class: 'lbl' }, t('set.music')), toggle(save.settings.music, (v) => setSetting('music', v))),
      h('div', { class: 'setrow' }, h('div', { class: 'lbl' }, t('set.sfx')), toggle(save.settings.sfx, (v) => setSetting('sfx', v))),
      M.config.mode !== 'online' ? btn(t('hud.restart'), async () => { close(); if (await confirmBox(t('hud.restart') + '?')) M.restart(); }) : null,
      btn(t('hud.quit'), async () => { close(); if (await confirmBox(t('hud.quitConfirm'), { danger: true })) M.quit(); }, 'danger'),
    ];
    m = modal(h('div', { class: 'col' }, h('div', { class: 'title center' }, t('hud.pause')), ...rows.filter(Boolean)));
  }

  dispose() { this.offCam(); clearTimeout(this._bt); }
}
export { EMOTE_ICON };

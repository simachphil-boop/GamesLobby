// In-game HUD shared by all games: player chips, status line, banner, action buttons,
// camera toggle, emotes and the pause menu.
import { h } from '../core/util.js';
import { btn, modal, closeModal, confirmBox, toggle, alertBox } from './ui.js';
import { t, tl } from '../i18n/index.js';
import { save, setSetting } from '../core/store.js';
import { EMOTES } from '../core/catalog.js';
import { sfx } from '../core/audio.js';
import { bus } from '../core/events.js';

const EMOTE_ICON = { wave: '👋', laugh: '😂', thumbs: '👍', think: '🤔', wow: '😮', cool: '😎', sad: '😢', angry: '😠', love: '😍', party: '🥳' };
export const EMOTE_ANIM = { wave: 'wave', laugh: 'laugh', thumbs: 'thumbs', think: 'thinking', wow: 'surprised', cool: 'cool', sad: 'sad', angry: 'angry', love: 'love', party: 'celebrate' };

export class Hud {
  constructor(match) {
    this.match = match;
    this.el = h('div', { class: 'screen hud' });
    this.players = h('div', { class: 'players' });
    this.camBtn = btn(this.camIcon(), () => match.app.rig.toggle(), 'icon', { title: t('hud.camera') });
    this.top = h('div', { class: 'hud-row' },
      btn('☰', () => this.pauseMenu(), 'icon', { title: t('hud.menu') }),
      this.players,
      this.camBtn,
      btn('😊', () => this.emoteMenu(), 'icon', { title: t('hud.emote') }));
    this.bannerBox = h('div', { class: 'hud-mid' });
    this.statusEl = h('div', { class: 'status' });
    this.actionsEl = h('div', { class: 'actions' });
    this.extra = h('div', { class: 'col', style: { alignItems: 'center', width: '100%' } });
    this.bottom = h('div', { class: 'hud-row bottom' }, h('div', { class: 'col', style: { alignItems: 'center', width: '100%', gap: '8px' } }, this.extra, this.statusEl, this.actionsEl));
    this.el.append(this.top, this.bannerBox, this.bottom);
    this.offCam = bus.on('camera', () => { this.camBtn.textContent = this.camIcon(); });
  }
  camIcon() { return this.match.app.rig.mode === 'fp' ? '👁' : '🎥'; }

  setPlayers(seats) {
    this.seats = seats;
    this.players.innerHTML = '';
    this.chips = seats.map((s) => {
      const chip = h('div', { class: 'pchip' },
        h('div', { class: 'av', style: { background: s.color } }, s.name.slice(0, 1).toUpperCase()),
        h('div', { class: 'col', style: { gap: '0' } }, h('div', { class: 'nm' }, s.name), h('div', { class: 'st' }, '')));
      chip.addEventListener('click', () => this.match.view.onPlayerChip?.(s.index));
      this.players.appendChild(chip);
      return chip;
    });
  }
  updatePlayers(state) {
    if (!this.chips) return;
    const v = this.match.view;
    this.seats.forEach((s, i) => {
      const st = v.playerStat ? v.playerStat(state, i) : '';
      this.chips[i].querySelector('.st').textContent = st ?? '';
      this.chips[i].classList.toggle('out', !!(v.isOut && v.isOut(state, i)));
    });
  }
  setActive(seat) { this.chips?.forEach((c, i) => c.classList.toggle('active', i === seat)); }

  status(text, mine = false) { this.statusEl.textContent = text || ''; this.statusEl.classList.toggle('me', mine); this.statusEl.style.display = text ? '' : 'none'; }

  banner(text, ms = 1600) {
    const b = h('div', { class: 'banner' }, text);
    this.bannerBox.innerHTML = '';
    this.bannerBox.appendChild(b);
    clearTimeout(this._bt);
    this._bt = setTimeout(() => b.remove(), ms);
  }

  /** buttons: [{label, onClick, cls, disabled}] */
  actions(list) {
    this.actionsEl.innerHTML = '';
    for (const a of list || []) {
      if (!a) continue;
      const b = btn(a.label, a.onClick, a.cls || '');
      if (a.disabled) b.disabled = true;
      this.actionsEl.appendChild(b);
    }
  }
  setExtra(el) { this.extra.innerHTML = ''; if (el) this.extra.appendChild(el); }

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
      btn((M.app.rig.mode === 'fp' ? '🎥 ' + t('hud.tp') : '👁 ' + t('hud.fp')), () => { close(); M.app.rig.toggle(); }),
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

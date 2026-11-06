// Board/Card Game Engine core: the Match runner shared by every game module.
//
// A game module provides:
//   rules: pure, deterministic state machine
//     setup(options, nPlayers, seed) -> state      (state is plain JSON, includes its own RNG seed)
//     actor(state) -> seat index that must act now
//     apply(state, action, seat) -> NEW state         (never mutates the input)
//     isOver(state) / result(state) -> {winners:[seat], ranking?:[seat], scores?:[n], draw?:bool}
//     validate?(state, action, seat) -> bool          (used for actions from the network)
//   ai.choose(state, seat, level, traits, rng) -> action (or Promise)
//   View: class with build/sync/animate/human/dispose (+ optional playerStat, setViewer, finale)
//
// The Match turns that into a playable table: humans (local or hot-seat), bots, remote players,
// animations, reactions, undo, autosave/resume and results.
import * as THREE from 'three';
import { Character } from '../scene/characters.js';
import { seatAngles, seatPosition, SEAT_R, TABLE_Y } from '../scene/room.js';
import { Reactions } from '../bots/reactions.js';
import { personaById } from '../bots/personas.js';
import { Hud, EMOTE_ANIM, EMOTE_ICON } from '../ui/hud.js';
import { h, sleep, clone } from '../core/util.js';
import { t, tl } from '../i18n/index.js';
import { save, storeMatch, recordMatch } from '../core/store.js';
import { sfx } from '../core/audio.js';
import { btn, modal, closeModal, toast } from '../ui/ui.js';
import { tweens, disposeTree } from '../scene/engine.js';
import { newSeed, makeRng } from '../core/rng.js';
import { runAI } from '../ai/runner.js';

export const SEAT_COLORS = ['#f7c95a', '#4aa8ff', '#ff5a7a', '#4ce39a', '#b07aff', '#ff9a3a'];
export const LEVELS = ['easy', 'normal', 'hard', 'expert'];

export class Match {
  /**
   * config: { mode:'bots'|'local'|'online'|'quick', gameId, options, seed,
   *           seats:[{type:'human'|'bot'|'remote', personaId?, name?, look?, level?}], state? }
   */
  constructor(app, def, config) {
    this.app = app;
    this.def = def;
    this.config = config;
    this.rules = def.rules;
    this.epoch = 0;
    this.ended = false;
    this.history = [];
    this.lastHuman = null;
    this.cancelers = new Set();
    this.net = config.net || null;
  }

  // ---------- table setup ----------
  buildSeats() {
    const angles = seatAngles(this.config.seats.length);
    const colors = this.def.seatColors || SEAT_COLORS;
    let humanN = 0;
    this.seats = this.config.seats.map((s, i) => {
      const persona = s.personaId ? personaById(s.personaId) : null;
      let name = s.name;
      let look = s.look;
      if (persona) { name = name || tl(persona.name); look = look || persona.look; }
      if (s.type === 'human') {
        humanN++;
        if (!name) name = humanN === 1 ? save.profile.name : `${t('setup.human')} ${humanN}`;
        if (!look) look = humanN === 1 ? save.profile.avatar : { ...save.profile.avatar, hair: ['bob', 'curly', 'spiky'][humanN % 3], outfitColor: (humanN * 3) % 10, skin: (humanN * 2) % 6, accessory: 'none' };
      }
      const character = new Character(look || {}, { name });
      const angle = angles[i];
      character.root.position.copy(seatPosition(angle, SEAT_R));
      character.root.rotation.y = angle;
      this.app.engine.scene.add(character.root);
      return {
        index: i, type: s.type, persona, name, look, character, angle, color: colors[i % colors.length],
        level: s.level || this.config.options?.difficulty || persona?.diff || 'normal',
        isHuman: s.type === 'human', isBot: s.type === 'bot', isRemote: s.type === 'remote',
      };
    });
    this.app.room.placeChairs(angles);
    this.humanSeats = this.seats.filter((s) => s.isHuman).map((s) => s.index);
    this.me = this.config.localSeat ?? this.humanSeats[0] ?? 0;
    this.reactions = new Reactions(this.seats, this.app.labels);
    this.updateOff = this.app.engine.onUpdate((dt, tt) => { for (const s of this.seats) s.character.update(dt, tt); });
  }

  /** Context object handed to the game's View. */
  ctx() {
    const self = this;
    return {
      engine: this.app.engine, rig: this.app.rig, room: this.app.room, labels: this.app.labels, particles: this.app.particles,
      table: this.table, seats: this.seats, hud: this.hud, options: this.config.options, def: this.def,
      get me() { return self.me; },
      react: (seat, kind, opts) => this.reactions.event(seat, kind, opts),
      say: (seat, event) => this.reactions.say(seat, event),
      lookAll: (v3) => this.seats.forEach((s) => s.character.lookAt(v3)),
      lookReset: () => this.seats.forEach((s) => s.character.lookAt(null)),
      reach: (seat, v3) => (seat === this.me && this.app.rig.mode === 'fp' && !this.seats[seat].character.root.visible ? Promise.resolve() : this.seats[seat].character.reach(v3)),
      isHumanTurn: () => this._humanTurn,
      tableToWorld: (v) => v.clone().add(new THREE.Vector3(0, TABLE_Y, 0)),
    };
  }

  async start() {
    this.app.enterTable();
    this.buildSeats();
    this.table = new THREE.Group();
    this.table.position.y = TABLE_Y;
    this.app.engine.scene.add(this.table);
    this.hud = new Hud(this);
    this.app.mountHud(this.hud);
    this.hud.setPlayers(this.seats);
    this.app.rig.focus = this.def.focus ?? 0.92;
    this.applyCameraSeat(this.me, false);
    const resumed = !!this.config.state;
    this.seed = this.config.seed ?? newSeed();
    this.state = resumed ? this.config.state : this.rules.setup(this.config.options || {}, this.seats.length, this.seed);
    this.view = new this.def.View(this.ctx());
    this.view.build(this.state);
    this.hud.updatePlayers(this.state);
    this.offCamera = this.app.onCameraMode(() => this.applyFirstPersonVisibility());
    this.applyFirstPersonVisibility();
    if (!resumed) this.reactions.greet();
    if (this.net) {
      this.netOffs = [
        this.net.on('emote', (seat, id) => this.remoteEmote(seat, id)),
        this.net.on('takeover', (seat) => { if (!this.net.isHost) toast(t('on.disconnected', { name: this.seats[seat]?.name || '?' })); }),
        this.net.on('hostLeft', () => { toast(t('on.status.offline')); this.quit(); }),
      ];
    }
    this.persist();
    await sleep(resumed ? 300 : 900);
    this.run();
  }

  applyCameraSeat(seat, animate = true) {
    this.viewSeat = seat;
    this.app.rig.setSeat(this.seats[seat].angle, animate);
    this.applyFirstPersonVisibility();
  }
  applyFirstPersonVisibility() {
    for (const s of this.seats) {
      const hide = this.app.rig.mode === 'fp' && s.index === this.viewSeat;
      s.character.root.visible = !hide;
    }
  }

  // ---------- main loop ----------
  async run() {
    const epoch = this.epoch;
    while (!this.ended && epoch === this.epoch) {
      if (this.rules.isOver(this.state)) { await this.finish(); return; }
      const seat = this.rules.actor(this.state);
      this.hud.setActive(seat);
      this.hud.updatePlayers(this.state);
      let action;
      try { action = await this.getAction(seat, epoch); } catch (e) { console.error(e); action = null; }
      if (epoch !== this.epoch || this.ended) return;
      if (action == null) { await sleep(50); continue; }
      await this.commit(action, seat, this.seats[seat].isRemote);
    }
  }

  cancelable(promise) {
    let cancel;
    const c = new Promise((res) => { cancel = () => res(null); });
    this.cancelers.add(cancel);
    return Promise.race([promise, c]).finally(() => this.cancelers.delete(cancel));
  }
  cancelPending() { for (const c of [...this.cancelers]) c(); this.cancelers.clear(); this.view?.cancelHuman?.(); }

  async getAction(seat, epoch) {
    const s = this.seats[seat];
    if (s.isHuman) {
      if (this.humanSeats.length > 1) await this.handoff(seat);
      if (epoch !== this.epoch) return null;
      if (this.lastHuman !== seat || !this._humanTurn) sfx('turn');
      this.lastHuman = seat;
      this._humanTurn = true;
      this.hud.status(this.humanSeats.length > 1 ? `${s.name}: ${t('hud.yourTurn')}` : t('hud.yourTurn'), true);
      this.history.push({ state: this.state, seat });
      if (this.history.length > 60) this.history.shift();
      const a = await this.cancelable(Promise.resolve(this.view.human(this.state, seat)));
      this._humanTurn = false;
      if (a == null) this.history.pop();
      this.hud.actions([]);
      return a;
    }
    this._humanTurn = false;
    this.hud.actions([]);
    if (s.isRemote) {
      this.hud.status(t('hud.waitingRemote', { name: s.name }));
      const a = await this.cancelable(this.net.nextAction(seat));
      if (a && a.__takeover) {
        Object.assign(s, { type: 'bot', isRemote: false, isBot: true, level: this.config.options?.difficulty || 'normal' });
        toast(t('on.disconnected', { name: s.name }));
        return null;
      }
      return a;
    }
    // bot
    this.hud.status(t('hud.thinking', { name: s.name }));
    const traits = s.persona?.traits || { risk: 0.5, aggression: 0.5, patience: 0.5, chatty: 0.3, tilt: 0.3, mistakes: 0 };
    const quick = this.def.quickBots?.(this.state, seat);
    const thinkFor = quick ? 0.25 : (0.45 + traits.patience * 0.9) * (s.level === 'easy' ? 0.7 : 1);
    if (!quick && Math.random() < 0.3) this.reactions.thinking(seat);
    s.character.lookAt(new THREE.Vector3(0, TABLE_Y, 0));
    const t0 = performance.now();
    const rng = makeRng((this.state.seed ^ (seat * 7919) ^ Math.floor(performance.now())) >>> 0);
    const action = await this.cancelable(runAI(this.def, this.state, seat, s.level, traits, rng));
    const spent = (performance.now() - t0) / 1000;
    const speed = save.settings.speed || 1;
    if (spent < thinkFor / speed) await this.cancelable(sleep((thinkFor / speed - spent) * 1000));
    s.character.lookAt(null);
    return action;
  }

  async commit(action, seat, fromNet = false) {
    const prev = this.state;
    if (fromNet && this.rules.validate && !this.rules.validate(prev, action, seat)) { console.warn('rejected net action', action); return; }
    let next;
    try { next = this.rules.apply(prev, action, seat); } catch (e) { console.error('apply failed', e, action); return; }
    this.state = next;
    if (this.net && !fromNet) this.net.sendAction(seat, action);
    this.persist();
    const epoch = this.epoch;
    try { await this.view.animate(prev, action, next, seat); } catch (e) { console.error(e); this.view.sync?.(next); }
    if (epoch !== this.epoch) return;
    this.hud.updatePlayers(next);
  }

  // ---------- hot-seat ----------
  async handoff(seat) {
    const s = this.seats[seat];
    if (this.viewSeat !== seat) {
      if (this.def.hiddenInfo && this.lastHuman != null && this.lastHuman !== seat) {
        this.view.setViewer?.(-1); // hide private info while the device changes hands
        await this.cancelable(new Promise((resolve) => {
          const el = h('div', { class: 'handoff' },
            h('div', { class: 'title' }, t('hud.passDevice', { name: s.name })),
            btn(t('hud.ready'), () => { el.remove(); resolve(true); }, 'primary'));
          document.body.appendChild(el);
          this.cancelers.add(() => el.remove());
        }));
      }
      this.applyCameraSeat(seat);
      this.me = seat;
      this.view.setViewer?.(seat);
    }
  }

  // ---------- user actions ----------
  userEmote(id) {
    const me = this.seats[this.me];
    me.character.emote(EMOTE_ANIM[id] || 'happy');
    this.app.labels.bubble(me.character, EMOTE_ICON[id] + ' ' + t('emote.' + id), 2.2);
    this.net?.sendEmote?.(this.me, id);
    const kind = { laugh: 'surprise', angry: 'surprise', wave: 'good', thumbs: 'good', party: 'good', love: 'good' }[id] || 'surprise';
    setTimeout(() => {
      for (const s of this.seats) {
        if (!s.isBot) continue;
        s.character.lookAt(me.character.headWorld());
        if (Math.random() < 0.6) s.character.emote(id === 'wave' ? 'wave' : id === 'laugh' ? 'laugh' : id === 'angry' ? 'surprised' : id === 'sad' ? 'nod' : 'happy');
        setTimeout(() => s.character.lookAt(null), 1600);
      }
      if (Math.random() < 0.5) {
        const bots = this.seats.filter((s) => s.isBot);
        const b = bots[Math.floor(Math.random() * bots.length)];
        if (b) this.reactions.say(b.index, kind === 'good' ? 'good' : 'surprise');
      }
    }, 500);
  }
  remoteEmote(seat, id) {
    const s = this.seats[seat];
    if (!s) return;
    s.character.emote(EMOTE_ANIM[id] || 'happy');
    this.app.labels.bubble(s.character, EMOTE_ICON[id] || '🙂', 2);
  }

  canUndo() {
    return this.config.mode !== 'online' && this.humanSeats.length === 1 && this.def.undo !== false && this.history.length > 0 && !this.ended;
  }
  undo() {
    if (!this.canUndo()) return;
    const h0 = this.history.pop();
    this.epoch++;
    this.cancelPending();
    this.state = h0.state;
    this.view.sync(this.state);
    this.hud.updatePlayers(this.state);
    this.persist();
    toast('↶ ' + t('hud.undo'));
    this.run();
  }

  async restart() {
    this.epoch++;
    this.cancelPending();
    this.ended = false;
    this.history = [];
    this.view.dispose();
    this.table.clear();
    this.seed = newSeed();
    this.state = this.rules.setup(this.config.options || {}, this.seats.length, this.seed);
    this.view = new this.def.View(this.ctx());
    this.view.build(this.state);
    this.hud.updatePlayers(this.state);
    this.persist();
    this.reactions.greet();
    await sleep(600);
    this.run();
  }

  persist() {
    if (this.config.mode === 'online' || this.ended) return;
    const { net, state, ...cfg } = this.config;
    storeMatch({ gameId: this.def.id, config: { ...cfg, seed: this.seed }, state: this.state, savedAt: Date.now() });
  }

  async finish() {
    this.ended = true;
    this.hud.actions([]);
    const res = this.rules.result(this.state);
    const winners = res.winners || [];
    this.hud.setActive(-1);
    this.hud.status('');
    this.reactions.finale(winners);
    await this.view.finale?.(this.state, res);
    const meWon = winners.includes(this.humanSeats[0] ?? 0);
    const outcome = res.draw ? 'draw' : meWon ? 'win' : 'loss';
    sfx(outcome === 'loss' ? 'lose' : 'win');
    if (outcome !== 'loss') this.app.particles.burst(new THREE.Vector3(0, TABLE_Y + 0.3, 0), { count: 140, up: 3.2 });
    storeMatch(null);
    const reward = this.humanSeats.length ? recordMatch(this.def.id, outcome, { online: this.config.mode === 'online' }) : null;
    await sleep(1600);
    if (this.disposed) return;
    this.showResults(res, outcome, reward);
  }

  showResults(res, outcome, reward) {
    const order = res.ranking || [...(res.winners || []), ...this.seats.map((s) => s.index).filter((i) => !(res.winners || []).includes(i))];
    const spectator = !this.humanSeats.length;
    const title = spectator ? (res.draw ? t('res.draw') : t('res.winner', { name: this.seats[res.winners[0]]?.name || '' })) : outcome === 'win' ? t('res.win') : outcome === 'draw' ? t('res.draw') : t('res.lose');
    const winnerName = res.winners?.length === 1 ? this.seats[res.winners[0]].name : null;
    let m;
    const body = h('div', { class: 'col' },
      h('div', { class: 'result-title' + (outcome === 'loss' && !spectator ? ' lose' : ''), style: spectator ? { fontSize: '28px' } : null }, title),
      winnerName && !res.draw ? h('div', { class: 'center muted' }, t('res.winner', { name: winnerName })) : null,
      reward ? h('div', { class: 'reward' }, h('span', null, t('res.xp', { n: reward.xp })), h('span', null, h('i', { class: 'coin' }), ' ', t('res.coins', { n: reward.coins }))) : null,
      reward?.leveled ? h('div', { class: 'center gold' }, '⭐ ' + t('res.levelUp', { level: save.profile.level })) : null,
      ...(reward?.achievements || []).map((a) => h('div', { class: 'center gold' }, `${a.icon} ${t('res.achievement')}: ${t('ach.' + a.id + '.name')}`)),
      h('div', { class: 'section-t' }, t('res.ranking')),
      ...order.map((si, k) => h('div', { class: 'rank' }, h('div', { class: 'pos' }, String(k + 1)),
        h('div', { class: 'grow' }, this.seats[si].name), h('div', { class: 'gold' }, res.scores ? String(res.scores[si] ?? '') : (res.winners?.includes(si) ? '🏆' : '')))),
    );
    const buttons = [btn(t('res.lobby'), () => { closeModal(m); this.quit(); }, 'ghost')];
    if (this.config.mode !== 'online') buttons.push(btn(t('res.rematch'), () => { closeModal(m); this.restart(); }, 'primary'));
    m = modal(body, { buttons, dismissible: false });
  }

  quit() {
    this.ended = true;
    this.epoch++;
    this.cancelPending();
    this.dispose();
    this.app.leaveTable();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.netOffs?.forEach((f) => f());
    this.net?.close?.();
    this.offCamera?.();
    this.updateOff?.();
    this.view?.dispose();
    this.hud.dispose();
    this.app.labels.clear();
    if (this.table) { disposeTree(this.table); this.app.engine.scene.remove(this.table); }
    for (const s of this.seats) { this.app.engine.scene.remove(s.character.root); s.character.dispose(); }
  }
}

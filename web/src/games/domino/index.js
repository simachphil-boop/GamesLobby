// DOMINO 3D.
import * as THREE from 'three';
import * as rules from './rules.js';
import * as ai from './ai.js';
import { ViewBase, std, V3 } from '../common.js';
import { canvasTexture, roundRect } from '../../scene/textures.js';
import { tweens, Ease, wait } from '../../scene/engine.js';
import { sfx } from '../../core/audio.js';
import { h } from '../../core/util.js';
import { registerStrings, t } from '../../i18n/index.js';
import { btn, modal, closeModal, choose as chooseModal } from '../../ui/ui.js';

registerStrings({
  en: { 'game.domino.name': 'Domino', 'game.domino.desc': 'Match the ends, block rivals, empty your hand', 'do.variant': 'Rules', 'do.block': 'Block (no drawing)', 'do.draw': 'Draw from boneyard', 'do.fives': 'All Fives (score multiples of 5)',
    'do.duration': 'Match length', 'do.single': 'One round', 'do.short': 'To 100 points', 'do.long': 'To 150 points', 'do.draw.btn': 'Draw tile', 'do.pass': 'Pass', 'do.st': 'Tap a highlighted tile to place it', 'do.st.none': 'No matching tile',
    'do.side': 'Which end?', 'do.left': '◀ Left end', 'do.right': 'Right end ▶', 'do.fivesB': '{who} scores {n}!', 'do.round': '{who} wins the round +{n}', 'do.blocked': 'Blocked! Lowest hand wins', 'do.next': 'Next round', 'do.roundTitle': 'Round {n}' },
  ru: { 'game.domino.name': 'Домино', 'game.domino.desc': 'Совпадайте концами, блокируйте соперников, избавьтесь от костяшек', 'do.variant': 'Правила', 'do.block': 'Блок (без базара)', 'do.draw': 'С базаром', 'do.fives': 'Все пятёрки (очки кратные 5)',
    'do.duration': 'Длительность', 'do.single': 'Один раунд', 'do.short': 'До 100 очков', 'do.long': 'До 150 очков', 'do.draw.btn': 'Взять из базара', 'do.pass': 'Пас', 'do.st': 'Нажмите на подсвеченную костяшку', 'do.st.none': 'Нет подходящей костяшки',
    'do.side': 'К какому концу?', 'do.left': '◀ Левый конец', 'do.right': 'Правый конец ▶', 'do.fivesB': '{who} получает {n}!', 'do.round': '{who} выигрывает раунд +{n}', 'do.blocked': 'Рыба! Побеждает меньшая сумма', 'do.next': 'Следующий раунд', 'do.roundTitle': 'Раунд {n}' },
});
const TW = 0.05, TL = 0.1, TH = 0.014;
const PIP = { 0: [], 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
function faceTex(a, b) {
  return canvasTexture(64, 128, (g, w, hh) => {
    g.fillStyle = '#f8f4ea'; roundRect(g, 0, 0, w, hh, 8); g.fill();
    g.fillStyle = '#1a1430'; g.fillRect(6, hh / 2 - 1.5, w - 12, 3);
    for (const [v, cy] of [[a, hh / 4], [b, (3 * hh) / 4]]) for (const [x, y] of PIP[v]) { g.beginPath(); g.arc(w / 2 + x * 15, cy + y * 15, 5.5, 0, 7); g.fill(); }
  }, { key: `dom${a}${b}` });
}
const geo = new THREE.BoxGeometry(TW, TH, TL); geo.userData.shared = true;
const side = new THREE.MeshStandardMaterial({ color: '#efe8d8', roughness: 0.4 }); side.userData.shared = true;
const back = new THREE.MeshStandardMaterial({ color: '#2a1a4a', roughness: 0.5 }); back.userData.shared = true;
const faceMats = new Map();
function tileMesh(tile) {
  const k = tile ? tile.a + '-' + tile.b : 'x';
  if (tile && !faceMats.has(k)) { const m = new THREE.MeshStandardMaterial({ map: faceTex(tile.a, tile.b), roughness: 0.35 }); m.userData.shared = true; faceMats.set(k, m); }
  const m = new THREE.Mesh(geo, [side, side, tile ? faceMats.get(k) : back, back, side, side]);
  m.castShadow = true;
  return m;
}

class View extends ViewBase {
  build(s) {
    this.s = s;
    this.viewer = this.ctx.me;
    const felt = new THREE.Mesh(new THREE.CircleGeometry(0.75, 48), new THREE.MeshStandardMaterial({ color: '#1f4a3a', roughness: 0.95 }));
    felt.rotation.x = -Math.PI / 2; felt.position.y = 0.001; felt.receiveShadow = true; this.group.add(felt);
    this.chainG = new THREE.Group(); this.group.add(this.chainG);
    this.myHand = new THREE.Group(); this.ctx.rig.handRig.add(this.myHand);
    this.fans = this.ctx.seats.map((seat) => { const g = new THREE.Group(); g.position.set(Math.sin(seat.angle) * 0.95, 0, Math.cos(seat.angle) * 0.95); g.rotation.y = seat.angle; this.group.add(g); return g; });
    this.boneG = new THREE.Group(); this.boneG.position.set(0.55, 0, -0.45); this.group.add(this.boneG);
    this.sync(s);
  }
  setViewer(seat) { this.viewer = seat; this.renderHands(this.s); }
  /** Snake layout: right arm goes +x then turns, left arm mirrored. */
  chainLayout(chain) {
    const out = [];
    if (!chain.length) return out;
    const startIdx = chain.findIndex((c) => c.first);
    const centerIdx = startIdx >= 0 ? startIdx : 0;
    const place = (i, dir) => {
      let x = 0, z = 0, ang = 0, along = dir, row = 0;
      const res = [];
      for (let k = i; dir > 0 ? k < chain.length : k >= 0; k += dir) {
        const c = chain[k];
        const dbl = c.a === c.b;
        const len = dbl ? TW : TL;
        if (k !== centerIdx) {
          if (Math.abs(x + along * (len / 2 + 0.004)) > 0.48) { row++; z += dir * 0.13; along = -along; x += along * 0.02; }
          x += along * (len / 2 + 0.002);
        }
        res.push({ k, x, z, flipVis: dir * along < 0 });
        x += along * (len / 2 + 0.002);
      }
      return res;
    };
    const right = place(centerIdx, 1), left = place(centerIdx, -1).slice(1);
    // left arm starts from the center tile's left edge
    const c0 = chain[centerIdx]; const half = (c0 && c0.a === c0.b ? TW : TL) / 2;
    for (const p of right) out[p.k] = p;
    for (const p of left) out[p.k] = { ...p, x: p.x - 0, z: p.z };
    void half;
    return out;
  }
  renderChain(s) {
    this.chainG.clear();
    const lay = this.chainLayout(s.chain);
    s.chain.forEach((c, k) => {
      const m = tileMesh({ a: c.flip ? c.b : c.a, b: c.flip ? c.a : c.b });
      const p = lay[k];
      m.position.set(p.x, TH / 2, p.z);
      // a (first half) faces left on the line; doubles stand across
      m.rotation.y = c.a === c.b ? 0 : (p.flipVis ? -Math.PI / 2 : Math.PI / 2);
      this.chainG.add(m);
    });
  }
  renderHands(s) {
    this.myHand.clear(); this.fans.forEach((f) => f.clear()); this.boneG.clear();
    s.hands.forEach((hand, seat) => {
      if (seat === this.viewer) {
        const portrait = this.ctx.engine.portrait;
        const sp = Math.min(0.065, (portrait ? 0.3 : 0.6) / Math.max(1, hand.length));
        hand.forEach((tl, i) => {
          const m = tileMesh(tl); m.scale.setScalar(portrait ? 0.95 : 1.15);
          const x = (i - (hand.length - 1) / 2) * sp;
          m.position.set(x, this.playable?.has(tl.id) ? 0.025 : 0, 0); m.rotation.set(Math.PI / 2, 0, 0);
          m.userData.tile = tl.id; this.myHand.add(m);
        });
      } else hand.forEach((tl, i) => { const m = tileMesh(null); m.position.set((i - (hand.length - 1) / 2) * 0.055, TL / 2, 0); m.rotation.set(Math.PI / 2, 0, 0); this.fans[seat].add(m); });
    });
    s.boneyard.forEach((_, i) => { const m = tileMesh(null); m.position.set((i % 4) * 0.055, TH / 2 + Math.floor(i / 4) * TH, 0); m.rotation.y = Math.PI; this.boneG.add(m); });
  }
  sync(s) { this.s = s; this.renderChain(s); this.renderHands(s); }
  async animate(prev, a, next, seat) {
    this.playable = null;
    for (const ev of next.ev) {
      if (ev.t === 'deal') { sfx('shuffle'); this.ctx.hud.banner(t('game.round', { n: ev.round }), 1200); }
      if (ev.t === 'play') {
        sfx('piece');
        const from = seat === this.viewer ? this.myHand.localToWorld(V3()) : this.fans[seat].localToWorld(V3(0, 0.05, 0));
        const tmp = tileMesh(ev.tile); this.group.add(tmp); tmp.position.copy(this.group.worldToLocal(from));
        this.ctx.reach(seat, this.world(V3(0, 0, 0)));
        const to = V3(0, 0.05, 0);
        const p0 = tmp.position.clone();
        await tweens.run(0.4, (e) => { tmp.position.lerpVectors(p0, to, e); tmp.rotation.y = e * Math.PI; }, Ease.inOut);
        tmp.removeFromParent();
      }
      if (ev.t === 'draw') sfx('card');
      if (ev.t === 'pass') { this.ctx.hud.banner(this.ctx.seats[ev.seat].name + ': ' + t('do.pass'), 900); this.ctx.react(ev.seat, 'unlucky', { magnitude: 0.3 }); }
      if (ev.t === 'fives') { this.ctx.hud.banner(t('do.fivesB', { who: this.ctx.seats[ev.seat].name, n: ev.pts }), 1300); sfx('coin'); this.ctx.react(ev.seat, 'good', { magnitude: 0.5 }); }
      if (ev.t === 'roundWin') { this.ctx.hud.banner((ev.blocked ? t('do.blocked') + ' · ' : '') + t('do.round', { who: this.ctx.seats[ev.seat].name, n: ev.pts }), 2200); this.ctx.react(ev.seat, 'win', { magnitude: 1 }); }
    }
    this.sync(next);
  }
  human(s, seat) {
    this.viewer = seat;
    const opts = rules.options(s, seat);
    this.playable = new Set(opts.map((o) => o.id));
    this.renderHands(s);
    return this.ask((done) => {
      const hud = this.ctx.hud;
      if (s.phase === 'roundOver') {
        let m;
        m = modal(h('div', { class: 'col' }, h('div', { class: 'title center' }, t('do.roundTitle', { n: s.round })), ...s.scores.map((sc, i) => h('div', { class: 'rank' }, h('div', { class: 'grow' }, this.ctx.seats[i].name), h('div', { class: 'gold' }, String(sc))))),
          { buttons: [btn(t('do.next'), () => { closeModal(m); done({ t: 'next' }); }, 'primary')], dismissible: false });
        return;
      }
      hud.status(opts.length ? t('do.st') : t('do.st.none'), true);
      if (!opts.length) hud.actions([s.variant !== 'block' && s.boneyard.length ? { label: t('do.draw.btn'), onClick: () => done({ t: 'draw' }), cls: 'primary' } : { label: t('do.pass'), onClick: () => done({ t: 'pass' }), cls: 'primary' }]);
      this.tapHandler = async (hit) => {
        const id = ViewBase.dataOf(hit, 'tile');
        if (id === undefined) return;
        const os = opts.filter((o) => o.id === id);
        if (!os.length) { sfx('error'); return; }
        let side = os[0].side;
        if (os.length > 1) side = await chooseModal(t('do.side'), [{ label: t('do.left'), value: 'L' }, { label: t('do.right'), value: 'R' }]);
        if (!side) return;
        done({ t: 'play', id, side });
      };
    });
  }
  playerStat(s, i) { return `🁢${s.hands[i].length}` + (s.target || s.variant === 'fives' ? ` · ${s.scores[i]}` : ''); }
  dispose() { this.myHand.removeFromParent(); super.dispose(); }
}
export default {
  focus: 0.7, id: 'domino', category: 'card', icon: '🁫', minPlayers: 2, maxPlayers: 4, defaultPlayers: 2,
  colors: ['#1f4a3a', '#0a1a10'], rules, ai, View, hiddenInfo: true, undo: false,
  options: [
    { key: 'variant', labelKey: 'do.variant', default: 'draw', values: ['block', 'draw', 'fives'].map((v) => ({ value: v, key: 'do.' + v })) },
    { key: 'duration', labelKey: 'do.duration', default: 'single', values: ['single', 'short', 'long'].map((v) => ({ value: v, key: 'do.' + v })) },
  ],
  rulesText: {
    en: 'Place tiles so touching ends match. Empty your hand to win the round and score the pips left in opponents\' hands.\n• Block: if you cannot play, pass. Draw: take tiles from the boneyard until you can play.\n• If nobody can play, the game is blocked and the lowest hand wins.\n• All Fives: whenever both open ends add up to a multiple of 5 you score that many points.',
    ru: 'Выкладывайте костяшки так, чтобы соприкасающиеся концы совпадали. Избавьтесь от всех костяшек — и получите очки за остаток у соперников.\n• Блок: нечем ходить — пас. С базаром: берите из базара, пока не сможете сходить.\n• Если никто не может ходить — «рыба», побеждает меньшая сумма.\n• Все пятёрки: если сумма открытых концов кратна 5 — получаете столько очков.',
  },
  thumb(g) { for (let i = 0; i < 4; i++) { g.save(); g.translate(90 + i * 45, 120); g.rotate(i % 2 ? 0.2 : -0.2); g.fillStyle = '#f8f4ea'; g.fillRect(-18, -36, 36, 72); g.fillStyle = '#1a1430'; g.fillRect(-14, -1, 28, 2); for (let k = 0; k < i + 1; k++) { g.beginPath(); g.arc(-8 + (k % 2) * 16, -24 + Math.floor(k / 2) * 10, 3.5, 0, 7); g.fill(); } g.restore(); } },
};

// CHECKERS 3D — Russian, English and casual rule sets.
import * as THREE from 'three';
import * as rules from './rules.js';
import * as ai from './ai.js';
import { ViewBase, Highlights, arcMove, std, V3, boardPlate } from '../common.js';
import { tweens, Ease } from '../../scene/engine.js';
import { sfx } from '../../core/audio.js';
import { registerStrings, t } from '../../i18n/index.js';

registerStrings({
  en: {
    'game.checkers.name': 'Checkers', 'game.checkers.desc': 'Jump, capture and crown your kings', 'ck.variant': 'Rules', 'ck.side': 'Your pieces',
    'ck.russian': 'Russian (flying kings)', 'ck.english': 'English / American', 'ck.casual': 'Casual (capture optional)', 'ck.light': 'Light', 'ck.dark': 'Dark', 'ck.random': 'Random',
    'ck.st': 'Select a piece, then a highlighted square', 'ck.king': 'Crowned!', 'ck.multi': 'Multi-capture ×{n}!',
  },
  ru: {
    'game.checkers.name': 'Шашки', 'game.checkers.desc': 'Бейте, проходите в дамки и побеждайте', 'ck.variant': 'Правила', 'ck.side': 'Ваши шашки',
    'ck.russian': 'Русские (дамка-летунья)', 'ck.english': 'Английские / американские', 'ck.casual': 'Свободные (бить не обязательно)', 'ck.light': 'Белые', 'ck.dark': 'Чёрные', 'ck.random': 'Случайно',
    'ck.st': 'Выберите шашку, затем подсвеченную клетку', 'ck.king': 'В дамки!', 'ck.multi': 'Взятие ×{n}!',
  },
});

const SQ = 0.11;
class View extends ViewBase {
  build(s) {
    this.s = s;
    this.flip = s.lightSeat !== 0;
    const plate = boardPlate(SQ * 8 + 0.08, (g, w) => {
      g.fillStyle = '#3a1a0a'; g.fillRect(0, 0, w, w);
      const m = (0.04 / (SQ * 8 + 0.08)) * w, q = (w - 2 * m) / 8;
      for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { g.fillStyle = (r + f) % 2 ? '#2a1a12' : '#f0dcb0'; g.fillRect(m + f * q, m + r * q, q, q); }
    }, { thickness: 0.035, edge: '#3a1a0a' });
    this.group.add(plate);
    this.pickables.push(plate);
    this.Y = 0.035;
    this.matL = std('#f2e6d0', { roughness: 0.35 });
    this.matD = std('#b0202a', { roughness: 0.35 });
    this.gold = std('#ffd24a', { metalness: 0.9, roughness: 0.25 });
    this.discGeo = new THREE.CylinderGeometry(SQ * 0.4, SQ * 0.4, 0.018, 28);
    this.ringGeo = new THREE.TorusGeometry(SQ * 0.26, 0.004, 6, 28); this.ringGeo.rotateX(Math.PI / 2);
    this.hl = new Highlights(this.group, '#6af0ff', 'disc', SQ * 0.6);
    this.selMark = new THREE.Mesh(new THREE.PlaneGeometry(SQ, SQ), new THREE.MeshBasicMaterial({ color: '#7cf8ff', transparent: true, opacity: 0.45, depthWrite: false }));
    this.selMark.rotation.x = -Math.PI / 2; this.selMark.visible = false; this.group.add(this.selMark);
    this.pieces = new Map();
    this.sync(s);
  }
  sqPos(sq) {
    let f = sq & 7, r = sq >> 3;
    // light pieces start on the near side of the light player's seat
    if (this.flip) { f = 7 - f; r = 7 - r; }
    return V3((f - 3.5) * SQ, this.Y, (3.5 - r) * SQ);
  }
  sqAt(x, z) {
    let f = Math.floor(x / SQ + 4), r = Math.floor(4 - z / SQ);
    if (f < 0 || f > 7 || r < 0 || r > 7) return -1;
    if (this.flip) { f = 7 - f; r = 7 - r; }
    return r * 8 + f;
  }
  makePiece(p) {
    const g = new THREE.Group();
    const mat = p > 0 ? this.matL : this.matD;
    const d = new THREE.Mesh(this.discGeo, mat); d.position.y = 0.009; d.castShadow = true; g.add(d);
    const r = new THREE.Mesh(this.ringGeo, mat); r.position.y = 0.019; g.add(r);
    if (Math.abs(p) === 2) this.crown(g, mat);
    g.userData.p = p;
    return g;
  }
  crown(g, mat) {
    const d2 = new THREE.Mesh(this.discGeo, mat); d2.position.y = 0.027; d2.castShadow = true; g.add(d2);
    const c = new THREE.Mesh(new THREE.TorusGeometry(SQ * 0.18, 0.006, 6, 20), this.gold); c.rotation.x = Math.PI / 2; c.position.y = 0.037; g.add(c);
    g.userData.king = true;
  }
  sync(s) {
    this.s = s;
    for (const m of this.pieces.values()) m.removeFromParent();
    this.pieces.clear();
    s.b.forEach((p, sq) => { if (p) { const m = this.makePiece(p); m.position.copy(this.sqPos(sq)); m.userData.sq = sq; this.group.add(m); this.pieces.set(sq, m); } });
  }
  async animate(prev, a, next, seat) {
    this.hl.clear(); this.selMark.visible = false;
    const ev = next.ev.find((e) => e.t === 'move');
    if (!ev) { this.sync(next); return; }
    const m = ev.m;
    const mesh = this.pieces.get(m.path[0]);
    this.pieces.delete(m.path[0]);
    await this.ctx.reach(seat, this.world(this.sqPos(m.path[0])));
    for (let i = 1; i < m.path.length; i++) {
      await arcMove(mesh, this.sqPos(m.path[i]), { height: m.caps.length ? 0.07 : 0.03, dur: m.caps.length ? 0.38 : 0.32 });
      sfx('piece');
      // remove the piece jumped over on this leg
      const cap = m.caps[i - 1];
      if (cap !== undefined) {
        const victim = this.pieces.get(cap);
        this.pieces.delete(cap);
        if (victim) {
          sfx('capture');
          const side = victim.userData.p > 0 ? 1 : -1;
          tweens.run(0.5, (e) => { victim.position.y = this.Y + e * 0.2; victim.scale.setScalar(1 - e); }).then(() => victim.removeFromParent());
          this.ctx.particles.burst(this.world(victim.position), { count: 14, speed: 0.4, up: 0.8, colors: [side > 0 ? '#f2e6d0' : '#e03a4a'] });
        }
      }
    }
    const to = m.path[m.path.length - 1];
    mesh.userData.sq = to;
    this.pieces.set(to, mesh);
    if (m.promote && !mesh.userData.king) {
      this.crown(mesh, ev.piece > 0 ? this.matL : this.matD);
      sfx('special');
      this.ctx.hud.banner('👑 ' + t('ck.king'), 1300);
      this.ctx.react(seat, 'lucky', { magnitude: 0.6 });
    }
    if (m.caps.length >= 2) { this.ctx.hud.banner(t('ck.multi', { n: m.caps.length }), 1300); this.ctx.react(seat, 'good', { magnitude: 0.8, target: 1 - seat }); }
    else if (m.caps.length) this.ctx.react(1 - seat, 'unlucky', { magnitude: 0.3 });
    this.s = next;
  }
  human(s, seat) {
    const moves = rules.legal(s);
    return this.ask((done) => {
      this.ctx.hud.status(t('ck.st') + (moves[0]?.caps.length && s.variant !== 'casual' ? ' · ' + t('game.mustCapture') : ''), true);
      let sel = -1;
      const movable = new Set(moves.map((m) => m.path[0]));
      this.hl.set([...movable].map((sq) => this.sqPos(sq).add(V3(0, 0.03, 0))), '#ffe27a');
      const pick = (sq) => {
        sel = sq;
        this.selMark.visible = true; this.selMark.position.copy(this.sqPos(sq)); this.selMark.position.y = this.Y + 0.002;
        this.hl.set(moves.filter((m) => m.path[0] === sq).map((m) => this.sqPos(m.path[m.path.length - 1]).add(V3(0, 0.001, 0))));
        sfx('click');
      };
      this.tapHandler = (hit) => {
        if (!hit) return;
        let sq = ViewBase.dataOf(hit, 'sq');
        if (sq === undefined) { const p = this.group.worldToLocal(hit.point.clone()); sq = this.sqAt(p.x, p.z); }
        if (sq < 0) return;
        if (movable.has(sq)) { pick(sq); return; }
        if (sel < 0) return;
        const cands = moves.filter((m) => m.path[0] === sel && m.path[m.path.length - 1] === sq).sort((a, b) => b.caps.length - a.caps.length);
        if (!cands.length) { sfx('error'); return; }
        this.hl.clear(); this.selMark.visible = false;
        done({ t: 'move', path: cands[0].path, caps: cands[0].caps });
      };
    });
  }
  clearHighlights() { this.hl.clear(); this.selMark.visible = false; }
  update(dt, tt) { this.hl.update(tt); }
  playerStat(s, i) { const side = i === s.lightSeat ? 1 : -1; return (side > 0 ? '⚪' : '🔴') + s.b.filter((p) => Math.sign(p) === side).length; }
  dispose() { this.hl.dispose(); super.dispose(); }
}

export default {
  focus: 0.5, id: 'checkers', category: 'strategy', icon: '⛀', minPlayers: 2, maxPlayers: 2, defaultPlayers: 2,
  colors: ['#b0202a', '#2a0a0a'], workerAI: true, rules, ai, View,
  options: [
    { key: 'variant', labelKey: 'ck.variant', default: 'russian', values: ['russian', 'english', 'casual'].map((v) => ({ value: v, key: 'ck.' + v })) },
    { key: 'side', labelKey: 'ck.side', default: 'light', values: ['light', 'dark', 'random'].map((v) => ({ value: v, key: 'ck.' + v })) },
  ],
  rulesText: {
    en: `Capture all opponent pieces or leave them without moves.
• Pieces move diagonally forward on dark squares. Capture by jumping over an adjacent enemy piece to the empty square behind it; keep jumping while possible.
• A piece reaching the far row becomes a king.
Russian: capturing is mandatory, men may capture backwards, kings fly any distance; a man crowned during a capture continues as a king.
English: capturing is mandatory, men capture forward only, kings move one square in any diagonal direction.
Casual: like English, but capturing is optional.
50 king moves without captures is a draw.`,
    ru: `Заберите все шашки соперника или лишите его ходов.
• Шашки ходят по диагонали вперёд по тёмным клеткам. Бьют, перепрыгивая через соседнюю шашку соперника на свободное поле за ней; бить можно серией.
• Шашка, дошедшая до последнего ряда, становится дамкой.
Русские: бить обязательно, простые бьют и назад, дамка ходит на любое расстояние; ставшая дамкой во время взятия продолжает бить как дамка.
Английские: бить обязательно, простые бьют только вперёд, дамка ходит на одну клетку.
Свободные: как английские, но бить не обязательно.
50 ходов дамками без взятий — ничья.`,
  },
  thumb(g) {
    for (let r = 0; r < 4; r++) for (let f = 0; f < 6; f++) { g.fillStyle = (r + f) % 2 ? '#2a1a12' : '#f0dcb0'; g.fillRect(70 + f * 30, 60 + r * 30, 30, 30); }
    for (const [x, y, c] of [[85, 75, '#f2e6d0'], [145, 75, '#f2e6d0'], [115, 135, '#b0202a'], [205, 135, '#b0202a']]) { g.fillStyle = c; g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill(); }
  },
};

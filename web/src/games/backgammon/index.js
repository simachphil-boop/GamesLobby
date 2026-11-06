// BACKGAMMON 3D.
import * as THREE from 'three';
import * as rules from './rules.js';
import * as ai from './ai.js';
import { ViewBase, Highlights, arcMove, std, V3, boardPlate } from '../common.js';
import { makeDie, rollDice } from '../../scene/dice.js';
import { sfx } from '../../core/audio.js';
import { registerStrings, t } from '../../i18n/index.js';

registerStrings({
  en: { 'game.backgammon.name': 'Backgammon', 'game.backgammon.desc': 'Race your 15 checkers home and bear them off', 'bg.variant': 'Start position', 'bg.std': 'Standard', 'bg.nack': 'Nackgammon',
    'bg.roll': '🎲 ROLL', 'bg.st.roll': 'Roll the dice', 'bg.st.move': 'Dice: {d} · tap a checker, then a target', 'bg.blocked': '{who} cannot move', 'bg.hit': 'Hit!', 'bg.gammon': 'Gammon!' },
  ru: { 'game.backgammon.name': 'Нарды', 'game.backgammon.desc': 'Приведите 15 шашек домой и выбросите их с доски', 'bg.variant': 'Начальная позиция', 'bg.std': 'Стандарт', 'bg.nack': 'Нэкгаммон',
    'bg.roll': '🎲 БРОСОК', 'bg.st.roll': 'Бросьте кубики', 'bg.st.move': 'Кубики: {d} · выберите шашку, затем цель', 'bg.blocked': '{who} не может ходить', 'bg.hit': 'Выбил!', 'bg.gammon': 'Марс!' },
});

const BW = 1.36, BD = 0.94, PW = 0.092, R = 0.038;
class View extends ViewBase {
  build(s) {
    this.s = s;
    const plate = boardPlate(1, (g, w) => {
      g.fillStyle = '#5a2e14'; g.fillRect(0, 0, w, w);
      g.fillStyle = '#e8d2a6'; g.fillRect(40, 40, w - 80, w - 80);
      const sx = w / BW, sz = w / BD;
      for (let i = 0; i < 24; i++) {
        const { x, top } = this.ptGeo(i);
        const px = (x + BW / 2) * sx;
        g.fillStyle = i % 2 ? '#8a1a2a' : '#1f3a2a';
        g.beginPath();
        if (top) { g.moveTo(px - PW / 2 * sx, 40); g.lineTo(px + PW / 2 * sx, 40); g.lineTo(px, 40 + 0.4 * sz); }
        else { g.moveTo(px - PW / 2 * sx, w - 40); g.lineTo(px + PW / 2 * sx, w - 40); g.lineTo(px, w - 40 - 0.4 * sz); }
        g.fill();
      }
      g.fillStyle = '#5a2e14'; g.fillRect(w / 2 - 30, 0, 60, w);
    }, { thickness: 0.035, edge: '#5a2e14' });
    plate.scale.set(BW, 1, BD);
    this.group.add(plate); this.pickables.push(plate);
    this.Y = 0.035;
    this.geo = new THREE.CylinderGeometry(R, R, 0.016, 24);
    this.mats = [std('#f4ece0', { roughness: 0.3 }), std('#2a1e2a', { roughness: 0.3 })];
    this.checkers = [];
    this.hl = new Highlights(this.group, '#6af0ff', 'disc', PW * 0.9);
    this.dice = [makeDie(0.06), makeDie(0.06)];
    this.dice.forEach((d, i) => { d.position.set(0.3 + i * 0.08, this.Y + 0.03, 0); this.group.add(d); });
    this.sync(s);
  }
  ptGeo(i) {
    // seat 0 sees its home (0-5) at the near-right; bottom row 0..11 right→left, top row 12..23 left→right
    const top = i >= 12;
    const col = top ? i - 12 : 11 - i;
    const x = -0.546 + col * PW + (col >= 6 ? 0.08 : 0); // 12 points + central bar, centered
    return { x, top };
  }
  stackPos(where, k, p) {
    if (where === 'bar') return V3(0, this.Y + 0.008 + k * 0.017, (p === 0 ? 0.08 : -0.08));
    if (where === 'off') return V3(BW / 2 + 0.07, this.Y + 0.008 + k * 0.012, (p === 0 ? 0.35 : -0.35));
    const { x, top } = this.ptGeo(where);
    const step = k < 5 ? k : 4 + (k - 4) * 0.35;
    const z = (top ? -1 : 1) * (BD / 2 - 0.06 - step * R * 2);
    return V3(x, this.Y + 0.008 + (k >= 5 ? 0.017 : 0), z);
  }
  sync(s) {
    this.s = s;
    this.checkers.forEach((c) => c.removeFromParent());
    this.checkers = [];
    const add = (p, where, k) => { const m = new THREE.Mesh(this.geo, this.mats[p]); m.castShadow = true; m.position.copy(this.stackPos(where, k, p)); m.userData.where = where; this.group.add(m); this.checkers.push(m); };
    s.pts.forEach((v, i) => { for (let k = 0; k < Math.abs(v); k++) add(v > 0 ? 0 : 1, i, k); });
    for (const p of [0, 1]) { for (let k = 0; k < s.bar[p]; k++) add(p, 'bar', k); for (let k = 0; k < s.off[p]; k++) add(p, 'off', k); }
    for (const m of this.checkers) if (m.userData.where === 'off') m.scale.y = 0.6;
  }
  findTop(where, p) {
    const list = this.checkers.filter((c) => c.userData.where === where && c.material === this.mats[p]);
    return list.sort((a, b) => b.position.y - a.position.y || Math.abs(a.position.z) - Math.abs(b.position.z))[0];
  }
  async animate(prev, a, next, seat) {
    this.hl.clear();
    for (const ev of next.ev) {
      if (ev.t === 'roll') {
        const ang = this.ctx.seats[seat].angle;
        await rollDice(this.dice, ev.dice, V3(Math.sin(ang) * 0.5, this.Y + 0.03, Math.cos(ang) * 0.5), [V3(0.3, this.Y + 0.03, -0.04), V3(0.38, this.Y + 0.03, 0.04)]);
        if (ev.dice[0] === ev.dice[1]) this.ctx.react(seat, 'lucky', { magnitude: 0.5 });
      }
      if (ev.t === 'blocked') { this.ctx.hud.banner(t('bg.blocked', { who: this.ctx.seats[ev.seat].name }), 1400); this.ctx.react(ev.seat, 'unlucky', { magnitude: 0.4 }); }
      if (ev.t === 'move') {
        const m = this.findTop(ev.from, seat);
        await this.ctx.reach(seat, this.world(m.position));
        if (ev.hit) {
          const victim = this.findTop(ev.to, 1 - seat);
          if (victim) { victim.userData.where = 'bar'; arcMove(victim, this.stackPos('bar', prev.bar[1 - seat], 1 - seat), { height: 0.15 }); }
          sfx('capture'); this.ctx.hud.banner(t('bg.hit'), 900); this.ctx.react(seat, 'good', { magnitude: 0.5, target: 1 - seat });
        }
        const k = ev.to === 'off' ? prev.off[seat] : Math.abs(prev.pts[ev.to]) * (ev.hit ? 0 : 1);
        m.userData.where = ev.to;
        await arcMove(m, this.stackPos(ev.to, k, seat), { height: 0.08, dur: 0.4 });
        sfx('piece');
      }
      if (ev.t === 'win' && ev.gammon) this.ctx.hud.banner(t('bg.gammon'), 2000);
    }
    this.sync(next);
  }
  human(s, seat) {
    return this.ask((done) => {
      const hud = this.ctx.hud;
      if (s.phase === 'roll') { hud.status(t('bg.st.roll'), true); hud.actions([{ label: t('bg.roll'), onClick: () => done({ t: 'roll' }), cls: 'primary' }]); return; }
      const steps = rules.legalSteps(s);
      hud.status(t('bg.st.move', { d: s.dice.join(' · ') }), true);
      let sel = null;
      const sources = [...new Set(steps.map((m) => m.from))];
      const showSources = () => this.hl.set(sources.map((f) => this.stackPos(f, 0, seat)), '#ffe27a');
      showSources();
      const nearest = (p) => {
        let best = null, bd = 0.08;
        const cands = [...new Set([...steps.map((m) => m.from), ...steps.map((m) => m.to)])];
        for (const w of cands) { const q = this.stackPos(w, 0, seat); const d = Math.hypot(q.x - p.x, (q.z - p.z) * 0.35); if (d < bd) { bd = d; best = w; } }
        return best;
      };
      this.tapHandler = (hit) => {
        if (!hit) return;
        const p = this.group.worldToLocal(hit.point.clone());
        const w = nearest(p);
        if (w === null) return;
        if (sel !== null) {
          const ms = steps.filter((m) => m.from === sel && m.to === w).sort((a, b) => a.die - b.die);
          if (ms.length) { this.hl.clear(); done({ t: 'move', from: ms[0].from, to: ms[0].to, die: ms[0].die }); return; }
        }
        if (sources.includes(w)) {
          sel = w; sfx('click');
          this.hl.set(steps.filter((m) => m.from === w).map((m) => this.stackPos(m.to, 0, seat)));
        }
      };
    });
  }
  clearHighlights() { this.hl.clear(); }
  update(dt, tt) { this.hl.update(tt); }
  playerStat(s, i) { return `${rules.pips(s, i)} · ${s.off[i]}/15`; }
  dispose() { this.hl.dispose(); super.dispose(); }
}
export default {
  focus: 0.62, id: 'backgammon', category: 'board', icon: '🎲', minPlayers: 2, maxPlayers: 2, defaultPlayers: 2,
  colors: ['#8a1a2a', '#2a0e06'], rules, ai, View, undo: false,
  options: [{ key: 'variant', labelKey: 'bg.variant', default: 'std', values: [{ value: 'std', key: 'bg.std' }, { value: 'nack', key: 'bg.nack' }] }],
  rulesText: {
    en: 'Move all 15 checkers into your home board and bear them off first.\n• Roll two dice; each die moves one checker that many points. Doubles give four moves.\n• You cannot land on a point holding 2+ enemy checkers. Landing on a single enemy checker (blot) sends it to the bar.\n• Checkers on the bar must re-enter in the opponent\'s home before anything else moves.\n• Once all your checkers are home you may bear off.\n• You must use as many dice as possible; if only one can be used, use the larger.\nWinning while the opponent has borne off nothing is a gammon.',
    ru: 'Приведите все 15 шашек в свой дом и первым выбросите их с доски.\n• Бросайте два кубика: каждый кубик — ход одной шашкой на столько пунктов. Дубль даёт четыре хода.\n• Нельзя вставать на пункт с 2+ шашками соперника. Одиночную шашку соперника можно выбить на бар.\n• Шашки с бара сначала должны войти в дом соперника.\n• Когда все шашки дома, их можно выбрасывать.\n• Нужно использовать максимум кубиков; если можно только один — больший.\nПобеда, когда соперник не выбросил ни одной шашки, — марс.',
  },
  thumb(g) { g.fillStyle = '#e8d2a6'; g.fillRect(60, 40, 200, 160); for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#8a1a2a' : '#1f3a2a'; g.beginPath(); g.moveTo(66 + i * 32, 40); g.lineTo(94 + i * 32, 40); g.lineTo(80 + i * 32, 110); g.fill(); } g.fillStyle = '#fff'; g.beginPath(); g.arc(80, 185, 12, 0, 7); g.fill(); g.fillStyle = '#2a1e2a'; g.beginPath(); g.arc(240, 55, 12, 0, 7); g.fill(); },
};

// LUDO 3D.
import * as THREE from 'three';
import * as rules from './rules.js';
import * as ai from './ai.js';
import { ViewBase, Highlights, arcMove, std, V3, boardPlate } from '../common.js';
import { makeDie, rollDice } from '../../scene/dice.js';
import { sfx } from '../../core/audio.js';
import { registerStrings, t } from '../../i18n/index.js';

registerStrings({
  en: { 'game.ludo.name': 'Ludo', 'game.ludo.desc': 'Race four tokens home, knock rivals back to base', 'lu.variant': 'Rules', 'lu.classic': 'Classic (exact finish, bonus turns)', 'lu.easy': 'Relaxed',
    'lu.roll': '🎲 ROLL', 'lu.st.roll': 'Roll the die', 'lu.st.move': 'You rolled {n} · tap a glowing token', 'lu.cap': '{who} knocks a token home!', 'lu.six': 'Six! Roll again', 'lu.three': 'Three sixes — turn lost', 'lu.home': 'Token home!' },
  ru: { 'game.ludo.name': 'Лудо', 'game.ludo.desc': 'Приведите четыре фишки домой и выбивайте соперников', 'lu.variant': 'Правила', 'lu.classic': 'Классика (точный финиш, доп. ходы)', 'lu.easy': 'Упрощённые',
    'lu.roll': '🎲 БРОСОК', 'lu.st.roll': 'Бросьте кубик', 'lu.st.move': 'Выпало {n} · нажмите на светящуюся фишку', 'lu.cap': '{who} выбивает фишку!', 'lu.six': 'Шестёрка! Ещё бросок', 'lu.three': 'Три шестёрки — ход сгорает', 'lu.home': 'Фишка дома!' },
});
const PATH = [[6, 13], [6, 12], [6, 11], [6, 10], [6, 9], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8], [0, 7], [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0], [7, 0], [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], [14, 7], [14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8], [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14], [7, 14], [6, 14]];
const HOME_DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const BASES = [[1.5, 10.5], [1.5, 1.5], [10.5, 1.5], [10.5, 10.5]];
const CC = ['#e8443a', '#2fb35a', '#f2c42a', '#2f7bd8'];
const B = 1.35, CELL = B / 15;

class View extends ViewBase {
  build(s) {
    this.s = s;
    const plate = boardPlate(B, (g, w) => {
      const q = w / 15;
      g.fillStyle = '#fbf6ea'; g.fillRect(0, 0, w, w);
      BASES.forEach(([x, y], c) => { g.fillStyle = CC[c]; g.fillRect((x - 1.5) * q, (y - 1.5) * q, 6 * q, 6 * q); g.fillStyle = '#fff'; g.fillRect((x - 0.5) * q, (y - 0.5) * q, 4 * q, 4 * q); });
      g.strokeStyle = '#555'; g.lineWidth = 2;
      PATH.forEach(([x, y], i) => {
        g.fillStyle = '#ffffff';
        for (let c = 0; c < 4; c++) if (i === c * 13) g.fillStyle = CC[c];
        g.fillRect(x * q, y * q, q, q); g.strokeRect(x * q, y * q, q, q);
        if (rules.SAFE.includes(i)) { g.fillStyle = '#555'; g.font = `${q * 0.6}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('★', (x + 0.5) * q, (y + 0.5) * q); }
      });
      for (let c = 0; c < 4; c++) for (const cell of this.homeCells(c)) { g.fillStyle = CC[c]; g.fillRect(cell[0] * q, cell[1] * q, q, q); g.strokeRect(cell[0] * q, cell[1] * q, q, q); }
      const tri = [[6, 9, 9, 9], [6, 6, 6, 9], [6, 6, 9, 6], [9, 6, 9, 9]];
      tri.forEach(([x1, y1, x2, y2], c) => { g.fillStyle = CC[c]; g.beginPath(); g.moveTo(x1 * q, y1 * q); g.lineTo(x2 * q, y2 * q); g.lineTo(7.5 * q, 7.5 * q); g.fill(); });
    }, { thickness: 0.03, edge: '#e8e0cc' });
    this.group.add(plate); this.pickables.push(plate);
    this.Y = 0.03;
    const prof = [[0.45, 0], [0.45, 0.1], [0.25, 0.2], [0.18, 0.6], [0.3, 0.75], [0.28, 0.95], [0, 1.05]].map(([a, b]) => new THREE.Vector2(a, b));
    this.pawnGeo = new THREE.LatheGeometry(prof, 20);
    this.tokens = s.tokens.map((tk, seat) => tk.map((r, k) => {
      const m = new THREE.Mesh(this.pawnGeo, std(CC[s.colors[seat]], { roughness: 0.3 })); m.scale.setScalar(0.04); m.castShadow = true;
      m.userData.tok = { seat, k }; this.group.add(m); this.pickables.push(m); return m;
    }));
    this.die = makeDie(0.07); this.die.position.set(0, this.Y + 0.035, 0); this.group.add(this.die);
    this.hl = new Highlights(this.group, '#ffffff', 'disc', CELL * 1.2);
    this.sync(s);
  }
  homeCells(c) {
    const end = PATH[(c * 13 + 50) % 52]; const [dx, dy] = HOME_DIR[c];
    return [1, 2, 3, 4, 5].map((k) => [end[0] + dx * k, end[1] + dy * k]);
  }
  cellPos(x, y) { return V3((x + 0.5 - 7.5) * CELL, this.Y, (y + 0.5 - 7.5) * CELL); }
  tokenPos(seat, k, r) {
    const c = this.s.colors[seat];
    if (r === -1) { const [bx, by] = BASES[c]; return this.cellPos(bx + (k % 2) * 2 + 0.5 - 0.5, by + Math.floor(k / 2) * 2); }
    if (r === 56) return this.cellPos(7 + (k % 2) * 0.5 - 0.25 - 0.5 + 0.5, 7 + Math.floor(k / 2) * 0.5 - 0.25).add(V3((c - 1.5) * 0.02, 0, 0));
    if (r > 50) { const [x, y] = this.homeCells(c)[r - 51]; return this.cellPos(x, y); }
    const [x, y] = PATH[rules.absCell(c, r)];
    // spread tokens sharing a cell
    const same = [];
    this.s.tokens.forEach((tk, o) => tk.forEach((rr, kk) => { if (rr >= 0 && rr <= 50 && rules.absCell(this.s.colors[o], rr) === rules.absCell(c, r)) same.push(o * 4 + kk); }));
    const idx = same.indexOf(seat * 4 + k);
    return this.cellPos(x, y).add(V3((idx % 2) * 0.016 - (same.length > 1 ? 0.008 : 0), 0, Math.floor(idx / 2) * 0.016));
  }
  sync(s) { this.s = s; s.tokens.forEach((tk, seat) => tk.forEach((r, k) => this.tokens[seat][k].position.copy(this.tokenPos(seat, k, r)))); }
  async animate(prev, a, next, seat) {
    this.hl.clear();
    for (const ev of next.ev) {
      if (ev.t === 'roll') {
        const ang = this.ctx.seats[seat].angle;
        await rollDice([this.die], [ev.die], V3(Math.sin(ang) * 0.45, this.Y, Math.cos(ang) * 0.45), [V3(0, this.Y + 0.035, 0)]);
        if (ev.die === 6) { this.ctx.hud.banner('🎲 ' + t('lu.six'), 1000); this.ctx.react(seat, 'lucky', { magnitude: 0.3 }); }
      }
      if (ev.t === 'three6') { this.ctx.hud.banner(t('lu.three'), 1400); this.ctx.react(seat, 'unlucky', { magnitude: 0.6 }); }
      if (ev.t === 'move') {
        const m = this.tokens[seat][ev.token];
        this.s = { ...next, tokens: prev.tokens };
        await this.ctx.reach(seat, this.world(m.position));
        if (ev.from === -1) await arcMove(m, this.tokenPos(seat, ev.token, 0), { height: 0.12 });
        else for (let r = ev.from + 1; r <= ev.to; r++) { await arcMove(m, this.tokenPos(seat, ev.token, r), { height: 0.04, dur: 0.16 }); sfx('step'); }
        this.s = next;
        for (const c of ev.captured) {
          sfx('capture');
          this.ctx.hud.banner(t('lu.cap', { who: this.ctx.seats[seat].name }), 1400);
          this.ctx.react(seat, 'good', { magnitude: 0.8, target: c.seat }); this.ctx.react(c.seat, 'ouch', { magnitude: 0.7 });
          arcMove(this.tokens[c.seat][c.token], this.tokenPos(c.seat, c.token, -1), { height: 0.3, dur: 0.6 });
        }
        if (ev.to === 56) { this.ctx.hud.banner('🏠 ' + t('lu.home'), 1000); this.ctx.particles.burst(this.world(m.position), { count: 30 }); }
      }
    }
    this.sync(next);
  }
  human(s, seat) {
    return this.ask((done) => {
      if (s.phase === 'roll') { this.ctx.hud.status(t('lu.st.roll'), true); this.ctx.hud.actions([{ label: t('lu.roll'), onClick: () => done({ t: 'roll' }), cls: 'primary' }]); return; }
      const ms = rules.movable(s, seat);
      this.ctx.hud.status(t('lu.st.move', { n: s.die }), true);
      this.hl.set(ms.map((k) => this.tokenPos(seat, k, s.tokens[seat][k])), CC[s.colors[seat]]);
      this.tapHandler = (hit) => {
        const tk = ViewBase.dataOf(hit, 'tok');
        let k = tk && tk.seat === seat ? tk.k : undefined;
        if (k === undefined && hit) { // tap near a movable token
          const p = this.group.worldToLocal(hit.point.clone());
          let bd = 0.06; for (const kk of ms) { const d = this.tokenPos(seat, kk, s.tokens[seat][kk]).distanceTo(V3(p.x, this.Y, p.z)); if (d < bd) { bd = d; k = kk; } }
        }
        if (k === undefined || !ms.includes(k)) return;
        this.hl.clear(); done({ t: 'move', token: k });
      };
    });
  }
  clearHighlights() { this.hl.clear(); }
  update(dt, tt) { this.hl.update(tt); }
  playerStat(s, i) { return '🏠' + s.tokens[i].filter((r) => r === 56).length + '/4'; }
  dispose() { this.hl.dispose(); this.pawnGeo.dispose(); super.dispose(); }
}
export default {
  focus: 0.68, id: 'ludo', category: 'board', icon: '🎯', minPlayers: 2, maxPlayers: 4, defaultPlayers: 4,
  colors: ['#e8443a', '#2a0a2a'], rules, ai, View, undo: false,
  quickBots: (s) => s.phase === 'roll',
  options: [{ key: 'variant', labelKey: 'lu.variant', default: 'classic', values: ['classic', 'easy'].map((v) => ({ value: v, key: 'lu.' + v })) }],
  rulesText: {
    en: 'Bring all four tokens from your base to the center.\n• Roll a 6 to bring a token onto the track. A 6 also gives another roll; three 6s in a row lose the turn.\n• Landing on an opponent sends their token back to base (except on ★ safe cells and start cells).\n• After a lap, tokens enter their own colored home column. Classic rules need an exact roll to finish and give a bonus roll for captures and finishing.',
    ru: 'Приведите все четыре фишки из базы в центр.\n• Шестёрка выводит фишку на поле и даёт ещё бросок; три шестёрки подряд — ход сгорает.\n• Встав на клетку с фишкой соперника, вы отправляете её в базу (кроме безопасных клеток ★ и стартовых).\n• После круга фишки идут по своему цветному коридору. В классике нужен точный бросок для финиша, а за выбивание и финиш даётся дополнительный бросок.',
  },
  thumb(g) { const c = ['#e8443a', '#2fb35a', '#f2c42a', '#2f7bd8']; [[70, 30], [70, 130], [170, 30], [170, 130]].forEach(([x, y], i) => { g.fillStyle = c[i]; g.fillRect(x, y, 80, 80); g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 40, y + 40, 22, 0, 7); g.fill(); }); },
};

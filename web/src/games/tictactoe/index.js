// TIC-TAC-TOE 3D — game module (definition + 3D view).
import * as THREE from 'three';
import * as rules from './rules.js';
import * as ai from './ai.js';
import { ViewBase, Highlights, std, V3 } from '../common.js';
import { tweens, Ease } from '../../scene/engine.js';
import { sfx } from '../../core/audio.js';
import { registerStrings, t } from '../../i18n/index.js';

registerStrings({
  en: { 'game.tictactoe.name': 'Tic-Tac-Toe 3D', 'game.tictactoe.desc': 'Classic X and O on 3×3, 4×4 and 5×5 boards', 'ttt.size': 'Board size', 'ttt.theme': 'Visual theme',
    'ttt.neon': 'Neon', 'ttt.wood': 'Wood', 'ttt.ice': 'Ice', 'ttt.candy': 'Candy', 'ttt.x': 'X', 'ttt.o': 'O' },
  ru: { 'game.tictactoe.name': 'Крестики-нолики 3D', 'game.tictactoe.desc': 'Классика на полях 3×3, 4×4 и 5×5', 'ttt.size': 'Размер поля', 'ttt.theme': 'Тема оформления',
    'ttt.neon': 'Неон', 'ttt.wood': 'Дерево', 'ttt.ice': 'Лёд', 'ttt.candy': 'Конфеты' },
});

const THEMES = {
  neon: { base: '#0c0a2a', line: '#5af0ff', x: '#ff4a9a', o: '#5af0ff', emissive: true },
  wood: { base: '#9a6a3a', line: '#4a2a12', x: '#2a1a10', o: '#f2e2c0', emissive: false },
  ice: { base: '#cfeaff', line: '#7ab8e8', x: '#2f6fd8', o: '#9ad8ff', emissive: false, glass: true },
  candy: { base: '#ffd6ec', line: '#ff7ab0', x: '#ff3a7a', o: '#3ad8a8', emissive: false },
};

class View extends ViewBase {
  build(s) {
    this.s = s;
    const th = THEMES[this.ctx.options.theme] || THEMES.neon;
    this.th = th;
    const N = s.size;
    const S = Math.min(1.2, 0.36 * N);
    this.S = S; this.cell = S / N;
    const base = new THREE.Mesh(new THREE.BoxGeometry(S + 0.12, 0.04, S + 0.12), std(th.base, { roughness: th.glass ? 0.1 : 0.6, transparent: !!th.glass, opacity: th.glass ? 0.85 : 1 }));
    base.position.y = 0.02; base.receiveShadow = true; this.group.add(base);
    const lineM = std(th.line, th.emissive ? { emissive: th.line, emissiveIntensity: 1.2 } : {});
    for (let i = 1; i < N; i++) {
      const off = -S / 2 + i * this.cell;
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.02, S), lineM); a.position.set(off, 0.05, 0); this.group.add(a);
      const b = new THREE.Mesh(new THREE.BoxGeometry(S, 0.02, 0.015), lineM); b.position.set(0, 0.05, off); this.group.add(b);
    }
    this.cellMeshes = [];
    for (let i = 0; i < N * N; i++) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(this.cell * 0.95, this.cell * 0.95), new THREE.MeshBasicMaterial({ visible: false }));
      c.rotation.x = -Math.PI / 2; c.position.copy(this.cellPos(i)); c.position.y = 0.045;
      c.userData.cell = i;
      this.group.add(c); this.cellMeshes.push(c); this.pickables.push(c);
    }
    this.hl = new Highlights(this.group, th.emissive ? '#ffffff' : th.line, 'square', this.cell * 0.85);
    this.pieces = new Map();
    s.cells.forEach((p, i) => { if (p !== null) this.addPiece(i, p, false); });
    this.ctx.hud.status('');
  }
  cellPos(i) {
    const N = this.s.size;
    return V3(-this.S / 2 + this.cell * (i % N + 0.5), 0.05, -this.S / 2 + this.cell * (Math.floor(i / N) + 0.5));
  }
  pieceMesh(p) {
    const th = this.th;
    const col = p === 0 ? th.x : th.o;
    const m = std(col, th.emissive ? { emissive: col, emissiveIntensity: 0.8 } : { roughness: 0.3 });
    const g = new THREE.Group();
    const sz = this.cell * 0.36;
    if (p === 0) {
      for (const r of [Math.PI / 4, -Math.PI / 4]) { const b = new THREE.Mesh(new THREE.BoxGeometry(sz * 2.2, sz * 0.45, sz * 0.45), m); b.rotation.y = r; b.position.y = sz * 0.25; b.castShadow = true; g.add(b); }
    } else {
      const o = new THREE.Mesh(new THREE.TorusGeometry(sz * 0.8, sz * 0.26, 14, 32), m); o.rotation.x = Math.PI / 2; o.position.y = sz * 0.25; o.castShadow = true; g.add(o);
    }
    return g;
  }
  addPiece(i, p, animate = true) {
    const g = this.pieceMesh(p);
    const pos = this.cellPos(i);
    g.position.copy(pos);
    this.group.add(g);
    this.pieces.set(i, g);
    if (!animate) return Promise.resolve();
    g.position.y = 0.6;
    g.rotation.y = 2;
    return tweens.run(0.45, (e) => { g.position.y = 0.05 + (1 - e) * 0.55; g.rotation.y = (1 - e) * 2; }, Ease.outBounce).then(() => sfx('drop'));
  }
  sync(s) {
    for (const g of this.pieces.values()) g.removeFromParent();
    this.pieces.clear();
    this.winBar?.removeFromParent();
    this.s = s;
    s.cells.forEach((p, i) => { if (p !== null) this.addPiece(i, p, false); });
  }
  async animate(prev, a, next, seat) {
    this.s = next;
    this.hl.clear();
    await this.ctx.reach(seat, this.world(this.cellPos(a.cell)));
    await this.addPiece(a.cell, prev.turn);
    if (next.winner !== null && next.winner >= 0) {
      const pts = next.line.map((i) => this.cellPos(i));
      pts.sort((p, q) => p.x - q.x || p.z - q.z);
      const A = pts[0], B = pts[pts.length - 1];
      const len = A.distanceTo(B) + this.cell * 0.6;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, 0.03), new THREE.MeshBasicMaterial({ color: '#ffe27a' }));
      bar.position.copy(A).lerp(B, 0.5); bar.position.y = 0.16;
      bar.rotation.y = -Math.atan2(B.z - A.z, B.x - A.x);
      this.group.add(bar); this.winBar = bar;
      bar.scale.x = 0.01;
      await tweens.run(0.4, (e) => { bar.scale.x = e; }, Ease.out);
      this.ctx.particles.burst(this.world(bar.position), { count: 70 });
    } else if (next.moves >= 3 && Math.random() < 0.3) {
      // threat detection -> reaction
      this.ctx.react(seat, 'good', { magnitude: 0.3 });
    }
  }
  human(s, seat) {
    return this.ask((done) => {
      const free = rules.legal(s);
      this.hl.set(free.map((i) => this.cellPos(i)));
      this.ctx.hud.status(t('hud.yourTurn') + ' · ' + (seat === 0 ? '✖' : '◯'), true);
      this.tapHandler = (hit) => {
        const c = ViewBase.dataOf(hit, 'cell');
        if (c === undefined || s.cells[c] !== null) return;
        sfx('click');
        this.hl.clear();
        done({ cell: c });
      };
    });
  }
  clearHighlights() { this.hl.clear(); }
  update(dt, t) { this.hl.update(t); }
  playerStat(s, i) { return i === 0 ? '✖' : '◯'; }
  dispose() { this.hl.dispose(); super.dispose(); }
}

export default {
  id: 'tictactoe', category: 'strategy', icon: '❌', minPlayers: 2, maxPlayers: 2, defaultPlayers: 2,
  colors: ['#ff4a9a', '#2a0a4a'], workerAI: true, rules, ai, View,
  options: [
    { key: 'size', labelKey: 'ttt.size', default: '3', values: [{ value: '3', label: '3×3' }, { value: '4', label: '4×4' }, { value: '5', label: '5×5' }] },
    { key: 'theme', labelKey: 'ttt.theme', default: 'neon', values: ['neon', 'wood', 'ice', 'candy'].map((v) => ({ value: v, key: 'ttt.' + v })) },
  ],
  rulesText: {
    en: 'Players take turns placing X and O.\n• 3×3: get 3 in a row.\n• 4×4 and 5×5: get 4 in a row.\nRows count horizontally, vertically and diagonally. A full board without a line is a draw.',
    ru: 'Игроки по очереди ставят крестики и нолики.\n• 3×3: соберите 3 в ряд.\n• 4×4 и 5×5: соберите 4 в ряд.\nРяд считается по горизонтали, вертикали и диагонали. Заполненное поле без ряда — ничья.',
  },
  thumb(g, w, h) {
    g.strokeStyle = '#5af0ff'; g.lineWidth = 8; g.shadowColor = '#5af0ff'; g.shadowBlur = 16;
    for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(80 + i * 53, 40); g.lineTo(80 + i * 53, 200); g.stroke(); g.beginPath(); g.moveTo(80, 40 + i * 53); g.lineTo(240, 40 + i * 53); g.stroke(); }
    g.strokeStyle = '#ff4a9a'; g.shadowColor = '#ff4a9a'; g.lineWidth = 10;
    g.beginPath(); g.moveTo(92, 52); g.lineTo(122, 82); g.moveTo(122, 52); g.lineTo(92, 82); g.stroke();
    g.beginPath(); g.moveTo(198, 158); g.lineTo(228, 188); g.moveTo(228, 158); g.lineTo(198, 188); g.stroke();
    g.strokeStyle = '#5af0ff'; g.shadowColor = '#5af0ff';
    g.beginPath(); g.arc(160, 120, 17, 0, 7); g.stroke();
    g.shadowBlur = 0;
  },
};

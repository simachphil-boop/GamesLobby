// CHESS 3D — full rules (castling, en passant, promotion, check/mate/stalemate, draws), clocks, history, undo.
import * as THREE from 'three';
import * as rules from './rules.js';
import * as ai from './ai.js';
import * as E from './engine.js';
import { ViewBase, Highlights, arcMove, std, V3, boardPlate } from '../common.js';
import { tweens, Ease, wait } from '../../scene/engine.js';
import { sfx } from '../../core/audio.js';
import { h } from '../../core/util.js';
import { registerStrings, t } from '../../i18n/index.js';
import { btn, modal, closeModal, choose as chooseModal } from '../../ui/ui.js';

registerStrings({
  en: {
    'game.chess.name': 'Chess 3D', 'game.chess.desc': 'The royal game with clocks, move history and undo',
    'ch.side': 'Your pieces', 'ch.timer': 'Clock', 'ch.white': 'White', 'ch.black': 'Black', 'ch.random': 'Random',
    'ch.none': 'No clock', 'ch.blitz': 'Blitz 5 min', 'ch.rapid': 'Rapid 10 min', 'ch.theme': 'Board style', 'ch.classic': 'Classic wood', 'ch.marble': 'Marble', 'ch.glass': 'Glass',
    'ch.history': '📜 Moves', 'ch.promote': 'Promote pawn to', 'ch.check': 'Check!', 'ch.mate': 'Checkmate!', 'ch.stalemate': 'Stalemate — draw',
    'ch.fifty': 'Draw by the 50-move rule', 'ch.repetition': 'Draw by threefold repetition', 'ch.material': 'Draw — insufficient material', 'ch.time': 'Time is up!',
    'ch.st': 'Select a piece, then a square', 'ch.q': 'Queen', 'ch.r': 'Rook', 'ch.b': 'Bishop', 'ch.n': 'Knight', 'ch.resign': 'Resign',
  },
  ru: {
    'game.chess.name': 'Шахматы 3D', 'game.chess.desc': 'Королевская игра с часами, историей ходов и отменой',
    'ch.side': 'Ваши фигуры', 'ch.timer': 'Часы', 'ch.white': 'Белые', 'ch.black': 'Чёрные', 'ch.random': 'Случайно',
    'ch.none': 'Без часов', 'ch.blitz': 'Блиц 5 мин', 'ch.rapid': 'Рапид 10 мин', 'ch.theme': 'Стиль доски', 'ch.classic': 'Классическое дерево', 'ch.marble': 'Мрамор', 'ch.glass': 'Стекло',
    'ch.history': '📜 Ходы', 'ch.promote': 'Превратить пешку в', 'ch.check': 'Шах!', 'ch.mate': 'Мат!', 'ch.stalemate': 'Пат — ничья',
    'ch.fifty': 'Ничья по правилу 50 ходов', 'ch.repetition': 'Ничья: троекратное повторение', 'ch.material': 'Ничья: недостаточно материала', 'ch.time': 'Время вышло!',
    'ch.st': 'Выберите фигуру, затем клетку', 'ch.q': 'Ферзь', 'ch.r': 'Ладья', 'ch.b': 'Слон', 'ch.n': 'Конь', 'ch.resign': 'Сдаться',
  },
});

const SQ = 0.11;
const THEMES = {
  classic: { light: '#e8cfa0', dark: '#8a5a32', frame: '#4a2a12', white: '#f3ead8', black: '#2a1c14' },
  marble: { light: '#eeeef4', dark: '#6a6a7a', frame: '#2a2a34', white: '#fafaff', black: '#1a1a24' },
  glass: { light: '#bfe6ff', dark: '#3a5a9a', frame: '#0a1a3a', white: '#e8f6ff', black: '#1a2a6a', glass: true },
};

// Lathe profiles (radius, height) — original stylized Staunton-like silhouettes
const PROFILES = {
  P: [[0.3, 0], [0.3, 0.06], [0.2, 0.1], [0.12, 0.35], [0.18, 0.42], [0.12, 0.47], [0.17, 0.6], [0.14, 0.72], [0, 0.76]],
  R: [[0.34, 0], [0.34, 0.07], [0.24, 0.12], [0.2, 0.6], [0.28, 0.66], [0.28, 0.86], [0.2, 0.86], [0.2, 0.8], [0, 0.8]],
  B: [[0.32, 0], [0.32, 0.07], [0.22, 0.12], [0.13, 0.55], [0.2, 0.6], [0.13, 0.66], [0.18, 0.8], [0.12, 0.95], [0.05, 1.0], [0, 1.02]],
  Q: [[0.36, 0], [0.36, 0.07], [0.25, 0.13], [0.15, 0.7], [0.24, 0.76], [0.16, 0.82], [0.24, 1.02], [0.12, 1.06], [0, 1.08]],
  K: [[0.37, 0], [0.37, 0.07], [0.26, 0.13], [0.16, 0.75], [0.25, 0.8], [0.17, 0.86], [0.22, 1.02], [0.1, 1.07], [0, 1.08]],
  N: [[0.33, 0], [0.33, 0.07], [0.23, 0.12], [0.2, 0.3], [0, 0.3]],
};
const geoCache = {};
function pieceGeo(P) {
  if (geoCache[P]) return geoCache[P];
  const pts = PROFILES[P].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 24);
  g.userData.shared = true;
  geoCache[P] = g;
  return g;
}
function makePiece(p, mat) {
  const P = p.toUpperCase();
  const g = new THREE.Group();
  const body = new THREE.Mesh(pieceGeo(P), mat); body.castShadow = true; g.add(body);
  if (P === 'N') {
    // horse head: angled neck + snout + ears
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.3), mat); neck.position.set(0, 0.5, 0.02); neck.rotation.x = -0.25; neck.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.42), mat); head.position.set(0, 0.72, -0.12); head.rotation.x = 0.35; head.castShadow = true;
    const ear1 = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4), mat); ear1.position.set(0.06, 0.86, 0.04);
    const ear2 = ear1.clone(); ear2.position.x = -0.06;
    const mane = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.08), mat); mane.position.set(0, 0.58, 0.17); mane.rotation.x = -0.25;
    g.add(neck, head, ear1, ear2, mane);
  }
  if (P === 'K') {
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.06), mat); c1.position.y = 1.18;
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.06), mat); c2.position.y = 1.2;
    g.add(c1, c2);
  }
  if (P === 'Q') for (let i = 0; i < 8; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat); const a = (i / 8) * Math.PI * 2; b.position.set(Math.cos(a) * 0.2, 1.05, Math.sin(a) * 0.2); g.add(b); }
  if (P === 'B') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mat); b.position.y = 1.05; g.add(b); }
  if (P === 'R') for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.1), mat); b.position.set(Math.cos(a) * 0.2, 0.9, Math.sin(a) * 0.2); b.rotation.y = -a; g.add(b); }
  g.scale.setScalar(0.085);
  return g;
}

class View extends ViewBase {
  build(s) {
    this.s = s;
    const th = THEMES[this.ctx.options.theme] || THEMES.classic;
    this.th = th;
    // board oriented so that the side of seat 0 is near seat 0 (+z)
    this.flip = s.whiteSeat !== 0;
    const plate = boardPlate(SQ * 8 + 0.08, (g, w) => {
      g.fillStyle = th.frame; g.fillRect(0, 0, w, w);
      const m = (0.04 / (SQ * 8 + 0.08)) * w, q = (w - 2 * m) / 8;
      for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { g.fillStyle = (r + f) % 2 ? th.light : th.dark; g.fillRect(m + f * q, m + r * q, q, q); }
      g.fillStyle = '#e8d8b8'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = 0; i < 8; i++) {
        const file = this.flip ? 'hgfedcba'[i] : 'abcdefgh'[i];
        const rank = this.flip ? String(i + 1) : String(8 - i);
        g.fillText(file, m + i * q + q / 2, w - m / 2); g.fillText(rank, m / 2, m + i * q + q / 2);
      }
    }, { thickness: 0.035, edge: th.frame });
    if (th.glass) { plate.material[2].transparent = true; plate.material[2].opacity = 0.92; plate.material[2].roughness = 0.1; }
    this.group.add(plate);
    this.pickables.push(plate);
    this.Y = 0.035;
    this.matW = std(th.white, { roughness: th.glass ? 0.05 : 0.3, metalness: 0.05, transparent: !!th.glass, opacity: th.glass ? 0.85 : 1 });
    this.matB = std(th.black, { roughness: th.glass ? 0.05 : 0.25, metalness: 0.15, transparent: !!th.glass, opacity: th.glass ? 0.9 : 1 });
    this.hl = new Highlights(this.group, '#6af0ff', 'disc', SQ * 0.6);
    this.hlCap = new Highlights(this.group, '#ff6a6a', 'disc', SQ * 0.9);
    const markMat = new THREE.MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.35, depthWrite: false });
    this.lastMarks = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(SQ, SQ), markMat); m.rotation.x = -Math.PI / 2; m.visible = false; this.group.add(m); return m; });
    this.selMark = new THREE.Mesh(new THREE.PlaneGeometry(SQ, SQ), new THREE.MeshBasicMaterial({ color: '#7cf8ff', transparent: true, opacity: 0.45, depthWrite: false }));
    this.selMark.rotation.x = -Math.PI / 2; this.selMark.visible = false; this.group.add(this.selMark);
    this.checkMark = new THREE.Mesh(new THREE.CircleGeometry(SQ * 0.48, 24), new THREE.MeshBasicMaterial({ color: '#ff3a3a', transparent: true, opacity: 0.55, depthWrite: false }));
    this.checkMark.rotation.x = -Math.PI / 2; this.checkMark.visible = false; this.group.add(this.checkMark);
    this.pieces = new Map(); // square -> mesh
    this.graveyard = [[], []];
    this.sync(s);
    this.clockTimer = null;
  }
  sqPos(sq) {
    let f = sq & 7, r = sq >> 3;
    if (this.flip) { f = 7 - f; r = 7 - r; }
    return V3((f - 3.5) * SQ, this.Y, (3.5 - r) * SQ);
  }
  sqAt(x, z) {
    let f = Math.floor(x / SQ + 4), r = Math.floor(4 - z / SQ);
    if (f < 0 || f > 7 || r < 0 || r > 7) return -1;
    if (this.flip) { f = 7 - f; r = 7 - r; }
    return r * 8 + f;
  }
  sync(s) {
    this.s = s;
    for (const m of this.pieces.values()) m.removeFromParent();
    this.pieces.clear();
    for (const g of this.graveyard.flat()) g.removeFromParent();
    this.graveyard = [[], []];
    s.pos.b.forEach((p, sq) => { if (p) this.addPiece(p, sq); });
    for (const hst of s.history) if (hst.cap) this.toGrave(this.makeMesh(hst.cap), E.isWhite(hst.cap) ? 0 : 1, false);
    this.marks(s);
  }
  makeMesh(p) {
    const m = makePiece(p, E.isWhite(p) ? this.matW : this.matB);
    m.userData.piece = p;
    // knights face the opponent
    m.rotation.y = (E.isWhite(p) ? 0 : Math.PI) + (this.flip ? Math.PI : 0);
    return m;
  }
  addPiece(p, sq) {
    const m = this.makeMesh(p);
    m.position.copy(this.sqPos(sq));
    m.userData.sq = sq;
    this.group.add(m);
    this.pieces.set(sq, m);
    return m;
  }
  toGrave(m, white, animate = true) {
    const list = this.graveyard[white ? 0 : 1];
    const k = list.length;
    // captured pieces line up beside the board on the capturer's side
    const sideZ = (white ? 1 : -1) * (this.flip ? -1 : 1);
    const pos = V3(0.56 + Math.floor(k / 8) * 0.07, 0, sideZ * (0.38 - (k % 8) * 0.09));
    m.scale.setScalar(0.065);
    list.push(m);
    if (!m.parent) this.group.add(m);
    if (!animate) { m.position.copy(pos); return Promise.resolve(); }
    return arcMove(m, pos, { height: 0.25, dur: 0.55 });
  }
  marks(s) {
    const last = s.history[s.history.length - 1];
    this.lastMarks.forEach((m, i) => {
      m.visible = !!last;
      if (last) { m.position.copy(this.sqPos(i ? last.t : last.f)); m.position.y = this.Y + 0.001; }
    });
    const chk = E.inCheck(s.pos);
    this.checkMark.visible = chk;
    if (chk) { this.checkMark.position.copy(this.sqPos(E.kingSq(s.pos, s.pos.w))); this.checkMark.position.y = this.Y + 0.002; }
  }

  async animate(prev, a, next, seat) {
    this.s = next;
    this.hl.clear(); this.hlCap.clear(); this.selMark.visible = false;
    for (const ev of next.ev) {
      if (ev.t === 'timeout') { this.ctx.hud.banner('⏱ ' + t('ch.time'), 2000); continue; }
      if (ev.t !== 'move') continue;
      const m = ev.m;
      const mesh = this.pieces.get(m.f);
      await this.ctx.reach(seat, this.world(this.sqPos(m.f)));
      // capture
      let capSq = m.t;
      if (m.k === 'ep') capSq = m.t + (prev.pos.w ? -8 : 8);
      const victim = this.pieces.get(capSq);
      this.pieces.delete(m.f);
      const knight = ev.piece.toUpperCase() === 'N';
      await arcMove(mesh, this.sqPos(m.t), { height: knight ? 0.12 : 0.05, dur: 0.45 });
      sfx(victim ? 'capture' : 'piece');
      if (victim) {
        this.pieces.delete(capSq);
        this.toGrave(victim, !E.isWhite(victim.userData.piece));
        this.ctx.react(seat, 'good', { magnitude: { P: 0.2, N: 0.5, B: 0.5, R: 0.7, Q: 1 }[victim.userData.piece.toUpperCase()] || 0.3, target: 1 - seat });
      }
      mesh.userData.sq = m.t;
      this.pieces.set(m.t, mesh);
      if (m.k === 'castle') {
        const [rf, rt] = m.t > m.f ? [m.f + 3, m.f + 1] : [m.f - 4, m.f - 1];
        const rook = this.pieces.get(rf);
        this.pieces.delete(rf);
        await arcMove(rook, this.sqPos(rt), { height: 0.1, dur: 0.4 });
        this.pieces.set(rt, rook);
        sfx('piece');
      }
      if (m.p) {
        mesh.removeFromParent();
        this.pieces.delete(m.t);
        const np = this.addPiece(prev.pos.w ? m.p.toUpperCase() : m.p, m.t);
        this.ctx.particles.burst(this.world(np.position), { count: 40, up: 1.4, speed: 0.7 });
        sfx('special');
      }
      if (next.result?.reason === 'mate') { this.ctx.hud.banner('♚ ' + t('ch.mate'), 2600); this.ctx.react(seat, 'win', { magnitude: 1 }); }
      else if (ev.check) { this.ctx.hud.banner(t('ch.check'), 1200); sfx('notify'); this.ctx.react(1 - seat, 'surprise', { magnitude: 0.6 }); }
      if (next.result && next.result.winner < 0) this.ctx.hud.banner(t('ch.' + next.result.reason), 2600);
    }
    this.marks(next);
  }

  clockText(s) {
    if (!s.clocks) return '';
    const fmtT = (ms) => { const sec = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); };
    const w = s.whiteSeat, b = 1 - w;
    return `⏱ ${t('ch.white')} ${fmtT(s.clocks[w])} · ${t('ch.black')} ${fmtT(s.clocks[b])}`;
  }

  human(s, seat) {
    const moves = rules.legal(s);
    const start = performance.now();
    return this.ask((done) => {
      const hud = this.ctx.hud;
      hud.status(t('ch.st') + (E.inCheck(s.pos) ? ' · ' + t('ch.check') : ''), true);
      hud.actions([{ label: t('ch.history'), onClick: () => this.historyModal(s), cls: 'ghost' }]);
      if (s.clocks) {
        const clk = h('div', { class: 'status timer' });
        hud.setExtra(clk);
        const tick = () => {
          const left = s.clocks[seat] - (performance.now() - start);
          const copy = { ...s, clocks: s.clocks.slice() }; copy.clocks[seat] = left;
          clk.textContent = this.clockText(copy);
          if (left <= 0) { clearInterval(this.clockTimer); done({ t: 'timeout' }); }
        };
        tick();
        this.clockTimer = setInterval(tick, 250);
      }
      let sel = -1;
      const pick = (sq) => {
        sel = sq;
        const ms = moves.filter((m) => m.f === sq);
        this.selMark.visible = true; this.selMark.position.copy(this.sqPos(sq)); this.selMark.position.y = this.Y + 0.002;
        this.hl.set(ms.filter((m) => !s.pos.b[m.t] && m.k !== 'ep').map((m) => this.sqPos(m.t).add(V3(0, 0.001, 0))));
        this.hlCap.set(ms.filter((m) => s.pos.b[m.t] || m.k === 'ep').map((m) => this.sqPos(m.t).add(V3(0, 0.001, 0))));
        const mesh = this.pieces.get(sq);
        if (mesh) tweens.run(0.2, (e) => { mesh.position.y = this.Y + Math.sin(e * Math.PI) * 0.02; });
        sfx('click');
      };
      const finish = (a) => { clearInterval(this.clockTimer); a.spent = Math.round(performance.now() - start); this.hl.clear(); this.hlCap.clear(); this.selMark.visible = false; done(a); };
      this.tapHandler = async (hit) => {
        if (!hit) return;
        const p = this.group.worldToLocal(hit.point.clone());
        let sq = this.sqAt(p.x, p.z);
        const pd = ViewBase.dataOf(hit, 'sq');
        if (pd !== undefined && this.pieces.get(pd)) sq = pd;
        if (sq < 0) return;
        const own = s.pos.b[sq] && E.isWhite(s.pos.b[sq]) === s.pos.w;
        if (own) { pick(sq); return; }
        if (sel < 0) return;
        const cands = moves.filter((m) => m.f === sel && m.t === sq);
        if (!cands.length) { sfx('error'); return; }
        let promo = null;
        if (cands[0].p) {
          promo = await chooseModal(t('ch.promote'), ['q', 'r', 'b', 'n'].map((x) => ({ label: t('ch.' + x), value: x, cls: x === 'q' ? 'primary' : '' })), { dismissible: false });
        }
        finish({ t: 'move', from: sel, to: sq, p: promo });
      };
    });
  }
  cancelHuman() { clearInterval(this.clockTimer); super.cancelHuman(); }
  clearHighlights() { this.hl.clear(); this.hlCap.clear(); this.selMark.visible = false; }
  historyModal(s) {
    const rows = [];
    for (let i = 0; i < s.history.length; i += 2) rows.push(h('div', null, `${i / 2 + 1}. ${s.history[i].san}  ${s.history[i + 1]?.san || ''}`));
    let m;
    m = modal(h('div', { class: 'col' }, h('div', { class: 'title center' }, t('ch.history')), h('div', { class: 'log scroll' }, ...(rows.length ? rows : [h('div', { class: 'muted' }, '—')]))),
      { buttons: [btn(t('close'), () => closeModal(m), 'ghost')] });
  }
  update(dt, tt) {
    this.hl.update(tt); this.hlCap.update(tt);
    if (this.checkMark.visible) this.checkMark.material.opacity = 0.4 + Math.sin(tt * 6) * 0.2;
  }
  playerStat(s, i) { return (i === s.whiteSeat ? '♔ ' : '♚ ') + (s.clocks ? Math.ceil(s.clocks[i] / 60000) + 'm' : ''); }
  async finale(s, res) { if (res.reason === 'time') this.ctx.hud.banner('⏱ ' + t('ch.time'), 2500); await wait(0.3); }
  dispose() { clearInterval(this.clockTimer); this.hl.dispose(); this.hlCap.dispose(); super.dispose(); }
}

export default {
  focus: 0.5,
  id: 'chess', category: 'strategy', icon: '♟️', minPlayers: 2, maxPlayers: 2, defaultPlayers: 2,
  colors: ['#8a5a32', '#1a0e06'], workerAI: true, rules, ai, View,
  options: [
    { key: 'side', labelKey: 'ch.side', default: 'white', values: ['white', 'black', 'random'].map((v) => ({ value: v, key: 'ch.' + v })) },
    { key: 'timer', labelKey: 'ch.timer', default: 'none', values: ['none', 'blitz', 'rapid'].map((v) => ({ value: v, key: 'ch.' + v })) },
    { key: 'theme', labelKey: 'ch.theme', default: 'classic', values: ['classic', 'marble', 'glass'].map((v) => ({ value: v, key: 'ch.' + v })) },
  ],
  rulesText: {
    en: `Checkmate the opponent's king.
• Each piece moves in its own way: pawn forward (captures diagonally, two squares from the start), knight in an L, bishop diagonally, rook straight, queen both, king one square.
• Castling: king moves two squares toward an unmoved rook if no pieces are between them, the king is not in check and doesn't pass through attacked squares.
• En passant: a pawn that just moved two squares can be captured as if it moved one.
• A pawn reaching the last rank promotes (queen, rook, bishop or knight).
• Draws: stalemate, threefold repetition, 50 moves without capture or pawn move, insufficient material.
Tap a piece to see its legal moves. In single-player games you can undo moves from the menu.`,
    ru: `Поставьте мат королю соперника.
• Пешка ходит вперёд (бьёт по диагонали, с начальной позиции — на 2 клетки), конь — буквой «Г», слон — по диагонали, ладья — по прямой, ферзь — и так, и так, король — на 1 клетку.
• Рокировка: король идёт на 2 клетки к ладье, если оба не ходили, между ними пусто, король не под шахом и не проходит через битые поля.
• Взятие на проходе: пешку, только что прошедшую 2 клетки, можно взять, как если бы она прошла одну.
• Пешка на последней горизонтали превращается (ферзь, ладья, слон или конь).
• Ничья: пат, троекратное повторение, 50 ходов без взятий и ходов пешек, недостаточно материала.
Нажмите на фигуру, чтобы увидеть её ходы. В одиночной игре ход можно отменить в меню.`,
  },
  thumb(g) {
    for (let r = 0; r < 4; r++) for (let f = 0; f < 6; f++) { g.fillStyle = (r + f) % 2 ? '#e8cfa0' : '#8a5a32'; g.fillRect(70 + f * 30, 60 + r * 30, 30, 30); }
    g.font = '64px serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2;
    g.fillText('♔', 120, 110); g.strokeText('♔', 120, 110); g.fillStyle = '#111'; g.fillText('♛', 200, 150);
  },
};

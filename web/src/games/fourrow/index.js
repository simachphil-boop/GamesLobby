// FOUR IN A ROW 3D — vertical frame on the table, discs drop with a bounce.
import * as THREE from 'three';
import * as rules from './rules.js';
import * as ai from './ai.js';
import { ViewBase, std, V3 } from '../common.js';
import { tweens, Ease } from '../../scene/engine.js';
import { sfx } from '../../core/audio.js';
import { registerStrings, t } from '../../i18n/index.js';

registerStrings({
  en: { 'game.fourrow.name': 'Four in a Row', 'game.fourrow.desc': 'Drop discs and connect four first', 'fr.size': 'Grid', 'fr.classic': '7×6 classic', 'fr.big': '8×7', 'fr.huge': '9×7', 'fr.st': 'Tap a column to drop your disc' },
  ru: { 'game.fourrow.name': 'Четыре в ряд', 'game.fourrow.desc': 'Бросайте фишки и первым соберите четыре в ряд', 'fr.size': 'Поле', 'fr.classic': '7×6 классика', 'fr.big': '8×7', 'fr.huge': '9×7', 'fr.st': 'Нажмите на столбец, чтобы бросить фишку' },
});
const C = 0.085;
class View extends ViewBase {
  build(s) {
    this.s = s;
    const W = s.W, H = s.H;
    this.ox = -(W - 1) / 2 * C; this.base = 0.06;
    const frameMat = std('#2a5ad8', { roughness: 0.35 });
    const g = this.group;
    // perforated panel: bars between holes
    for (let c = 0; c <= W; c++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.012, H * C + 0.02, 0.05), frameMat); b.position.set(this.ox - C / 2 + c * C, this.base + H * C / 2 - C / 2, 0); b.castShadow = true; g.add(b); }
    for (let r = 0; r <= H; r++) { const b = new THREE.Mesh(new THREE.BoxGeometry(W * C + 0.012, 0.012, 0.05), frameMat); b.position.set(0, this.base - C / 2 + r * C, 0); g.add(b); }
    const back = new THREE.Mesh(new THREE.BoxGeometry(W * C, H * C, 0.004), new THREE.MeshStandardMaterial({ color: '#1a3a9a', transparent: true, opacity: 0.25 }));
    back.position.set(0, this.base + H * C / 2 - C / 2, -0.02); g.add(back);
    for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.24), frameMat); leg.position.set(sx * (W * C / 2 + 0.02), 0.03, 0); g.add(leg); }
    this.cols = [];
    for (let c = 0; c < W; c++) {
      const z = new THREE.Mesh(new THREE.BoxGeometry(C, H * C + 0.12, 0.08), new THREE.MeshBasicMaterial({ visible: false }));
      z.position.set(this.ox + c * C, this.base + H * C / 2, 0); z.userData.col = c; g.add(z); this.pickables.push(z); this.cols.push(z);
    }
    this.hover = new THREE.Mesh(new THREE.CylinderGeometry(C * 0.42, C * 0.42, 0.02, 24), new THREE.MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.6 }));
    this.hover.rotation.x = Math.PI / 2; this.hover.visible = false; g.add(this.hover);
    this.discGeo = new THREE.CylinderGeometry(C * 0.42, C * 0.42, 0.022, 28); this.discGeo.rotateX(Math.PI / 2);
    this.mats = [std(this.ctx.seats[0].color, { roughness: 0.3 }), std(this.ctx.seats[1].color, { roughness: 0.3 })];
    this.discs = [];
    this.sync(s);
  }
  pos(r, c) { return V3(this.ox + c * C, this.base + r * C, 0); }
  sync(s) { this.s = s; this.discs.forEach((d) => d.removeFromParent()); this.discs = []; s.cells.forEach((p, i) => { if (p >= 0) { const d = new THREE.Mesh(this.discGeo, this.mats[p]); d.position.copy(this.pos(Math.floor(i / s.W), i % s.W)); this.group.add(d); this.discs.push(d); } }); }
  async animate(prev, a, next, seat) {
    this.hover.visible = false;
    const ev = next.ev[0];
    const d = new THREE.Mesh(this.discGeo, this.mats[seat]); d.castShadow = true;
    const top = this.pos(next.H + 0.6, ev.col), end = this.pos(ev.row, ev.col);
    d.position.copy(top); this.group.add(d); this.discs.push(d);
    await this.ctx.reach(seat, this.world(top));
    await tweens.run(0.25 + (next.H - ev.row) * 0.05, (e) => { d.position.lerpVectors(top, end, e); }, Ease.outBounce);
    sfx('drop');
    if (next.line) {
      this.ctx.particles.burst(this.world(end), { count: 60 });
      for (const i of next.line) { const m = this.discs.find((x) => x.position.distanceTo(this.pos(Math.floor(i / next.W), i % next.W)) < 1e-3); if (m) m.material = std('#ffe27a', { emissive: '#ffae00', emissiveIntensity: 0.7 }); }
    } else if (next.moves > 6 && Math.random() < 0.25) this.ctx.react(seat, 'good', { magnitude: 0.3 });
  }
  human(s, seat) {
    return this.ask((done) => {
      this.ctx.hud.status(t('fr.st'), true);
      this.tapHandler = (hit) => {
        const c = ViewBase.dataOf(hit, 'col');
        if (c === undefined || !rules.legal(s).includes(c)) return;
        if (this.hoverCol === c) { this.hoverCol = -1; done({ t: 'drop', col: c }); return; }
        // first tap previews the column, second confirms (prevents mis-drops on phones)
        this.hoverCol = c; this.hover.visible = true; this.hover.material.color.set(this.ctx.seats[seat].color);
        this.hover.position.copy(this.pos(s.H + 0.4, c)); sfx('click');
      };
    });
  }
  update(dt, tt) { if (this.hover.visible) this.hover.position.y = this.base + (this.s.H + 0.4) * C + Math.sin(tt * 5) * 0.01; }
  playerStat(s, i) { return '●'; }
}
export default {
  focus: 0.5, id: 'fourrow', category: 'strategy', icon: '🔴', minPlayers: 2, maxPlayers: 2, defaultPlayers: 2,
  colors: ['#2a5ad8', '#0a1a4a'], workerAI: true, rules, ai, View,
  options: [{ key: 'size', labelKey: 'fr.size', default: 'classic', values: ['classic', 'big', 'huge'].map((v) => ({ value: v, key: 'fr.' + v })) }],
  rulesText: {
    en: 'Players take turns dropping a disc into a column; it falls to the lowest free spot.\nConnect four of your discs horizontally, vertically or diagonally to win. A full grid is a draw.\nTap a column to preview, tap again to drop.',
    ru: 'Игроки по очереди бросают фишку в столбец — она падает на нижнюю свободную клетку.\nСоберите четыре свои фишки по горизонтали, вертикали или диагонали. Заполненное поле — ничья.\nНажмите на столбец для предпросмотра, повторно — чтобы бросить.',
  },
  thumb(g) { g.fillStyle = '#2a5ad8'; g.fillRect(80, 50, 160, 140); for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) { g.fillStyle = r > 2 ? (c + r) % 2 ? '#ff5a7a' : '#f7c95a' : '#0b0d26'; g.beginPath(); g.arc(96 + c * 26, 66 + r * 27, 10, 0, 7); g.fill(); } },
};

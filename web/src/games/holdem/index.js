// HOLD'EM 3D — Texas Hold'em for virtual points (no real-money betting).
import * as THREE from 'three';
import * as rules from './rules.js';
import * as ai from './ai.js';
import { ViewBase, std, V3, textSprite } from '../common.js';
import { canvasTexture, roundRect } from '../../scene/textures.js';
import { tweens, Ease, wait } from '../../scene/engine.js';
import { sfx } from '../../core/audio.js';
import { h } from '../../core/util.js';
import { registerStrings, t } from '../../i18n/index.js';
import { btn, modal, closeModal } from '../../ui/ui.js';

registerStrings({
  en: { 'game.holdem.name': "Hold'em", 'game.holdem.desc': "Texas Hold'em for virtual points — bluff, bet and read the table", 'pk.duration': 'Match length', 'pk.short': '15 hands', 'pk.medium': '30 hands', 'pk.full': 'Until one remains',
    'pk.fold': 'Fold', 'pk.check': 'Check', 'pk.call': 'Call {n}', 'pk.raise': 'Raise', 'pk.allin': 'All-in {n}', 'pk.raiseTo': 'Raise to {n}', 'pk.half': '½ pot', 'pk.pot': 'Pot', 'pk.min': 'Min',
    'pk.st': 'Pot {p} · to call {c}', 'pk.b.fold': '{who} folds', 'pk.b.raise': '{who} raises to {n}', 'pk.b.allin': '{who} goes ALL-IN!', 'pk.b.win': '{who} wins {n}', 'pk.b.blinds': 'Blinds up: {sb}/{bb}', 'pk.b.bust': '{who} is out of points',
    'pk.cat0': 'High card', 'pk.cat1': 'Pair', 'pk.cat2': 'Two pair', 'pk.cat3': 'Three of a kind', 'pk.cat4': 'Straight', 'pk.cat5': 'Flush', 'pk.cat6': 'Full house', 'pk.cat7': 'Four of a kind', 'pk.cat8': 'Straight flush', 'pk.hand': 'Hand {n}' },
  ru: { 'game.holdem.name': 'Холдем', 'game.holdem.desc': 'Техасский холдем на виртуальные очки — блефуйте и читайте стол', 'pk.duration': 'Длительность', 'pk.short': '15 раздач', 'pk.medium': '30 раздач', 'pk.full': 'До последнего',
    'pk.fold': 'Пас', 'pk.check': 'Чек', 'pk.call': 'Колл {n}', 'pk.raise': 'Рейз', 'pk.allin': 'Ва-банк {n}', 'pk.raiseTo': 'Рейз до {n}', 'pk.half': '½ банка', 'pk.pot': 'Банк', 'pk.min': 'Мин.',
    'pk.st': 'Банк {p} · колл {c}', 'pk.b.fold': '{who} сбрасывает', 'pk.b.raise': '{who} повышает до {n}', 'pk.b.allin': '{who} идёт ва-банк!', 'pk.b.win': '{who} забирает {n}', 'pk.b.blinds': 'Блайнды: {sb}/{bb}', 'pk.b.bust': '{who} выбывает',
    'pk.cat0': 'Старшая карта', 'pk.cat1': 'Пара', 'pk.cat2': 'Две пары', 'pk.cat3': 'Сет', 'pk.cat4': 'Стрит', 'pk.cat5': 'Флеш', 'pk.cat6': 'Фулл-хаус', 'pk.cat7': 'Каре', 'pk.cat8': 'Стрит-флеш', 'pk.hand': 'Раздача {n}' },
});
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'], SUITS = ['♠', '♥', '♦', '♣'];
const CW = 0.07, CH = 0.1;
function cardTex(c) {
  return canvasTexture(128, 184, (g, w, hh) => {
    g.fillStyle = '#fff'; roundRect(g, 0, 0, w, hh, 12); g.fill();
    const red = c >= 0 && (rules.suitOf(c) === 1 || rules.suitOf(c) === 2);
    if (c < 0) { g.fillStyle = '#7a1a3a'; roundRect(g, 8, 8, w - 16, hh - 16, 8); g.fill(); g.strokeStyle = '#f7d98a'; g.lineWidth = 3; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(w / 2, hh / 2, 8 + i * 7, 0, 7); g.stroke(); } return; }
    g.fillStyle = red ? '#d0203a' : '#14142a';
    g.font = '900 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(RANKS[rules.rankOf(c)], 28, 30); g.font = '32px sans-serif'; g.fillText(SUITS[rules.suitOf(c)], 28, 64);
    g.font = '86px sans-serif'; g.fillText(SUITS[rules.suitOf(c)], w / 2 + 10, hh / 2 + 22);
  }, { key: 'pk' + c });
}
const cardGeo = new THREE.BoxGeometry(CW, 0.0015, CH); cardGeo.userData.shared = true;
const edge = new THREE.MeshStandardMaterial({ color: '#eee' }); edge.userData.shared = true;
const mats = new Map();
const mat = (c) => { if (!mats.has(c)) { const m = new THREE.MeshStandardMaterial({ map: cardTex(c), roughness: 0.4 }); m.userData.shared = true; mats.set(c, m); } return mats.get(c); };
const cardMesh = (c) => { const m = new THREE.Mesh(cardGeo, [edge, edge, mat(c), mat(-1), edge, edge]); m.castShadow = true; return m; };

class View extends ViewBase {
  build(s) {
    this.s = s; this.viewer = this.ctx.me;
    const felt = new THREE.Mesh(new THREE.CircleGeometry(0.95, 64), new THREE.MeshStandardMaterial({ color: '#145a3c', roughness: 0.95 }));
    felt.rotation.x = -Math.PI / 2; felt.position.y = 0.001; felt.receiveShadow = true; this.group.add(felt);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.025, 8, 64), std('#3a1a0a')); rim.rotation.x = Math.PI / 2; rim.position.y = 0.01; this.group.add(rim);
    this.chipGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.006, 16);
    this.chipMats = [std('#f4f4f4'), std('#d0203a'), std('#2a5ad8'), std('#1a1a1a'), std('#f7c95a')];
    this.dyn = new THREE.Group(); this.group.add(this.dyn);
    this.myHand = new THREE.Group(); this.ctx.rig.handRig.add(this.myHand);
    this.button = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.008, 20), std('#ffffff')); this.group.add(this.button);
    this.sync(s);
  }
  seatPt(i, r) { const a = this.ctx.seats[i].angle; return V3(Math.sin(a) * r, 0, Math.cos(a) * r); }
  stack(pos, amount, scale = 1) {
    const n = Math.min(24, Math.ceil(amount / 50));
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(this.chipGeo, this.chipMats[Math.floor(k / 6) % 5]);
      m.position.copy(pos).add(V3((Math.floor(k / 8) - 1) * 0.04 * scale, 0.004 + (k % 8) * 0.0065, 0)); m.castShadow = true; this.dyn.add(m);
    }
  }
  setViewer(seat) { this.viewer = seat; this.sync(this.s); }
  sync(s, revealed = null) {
    this.s = s;
    this.dyn.clear(); this.myHand.clear();
    s.board.forEach((c, k) => { const m = cardMesh(c); m.position.set((k - 2) * (CW + 0.012), 0.002, -0.05); m.scale.setScalar(1.3); this.dyn.add(m); });
    for (let i = 0; i < s.n; i++) {
      if (s.out[i]) continue;
      this.stack(this.seatPt(i, 0.78), s.chips[i]);
      if (s.bets[i]) this.stack(this.seatPt(i, 0.55), s.bets[i], 0.6);
      if (s.folded[i]) continue;
      if (i === this.viewer && !this.ctx.seats[i].isBot && !this.ctx.seats[i].isRemote) {
        s.hole[i].forEach((c, k) => { const m = cardMesh(c); m.scale.setScalar(this.ctx.engine.portrait ? 1.2 : 1.3); m.position.set((k - 0.5) * 0.11, 0, 0); m.rotation.set(Math.PI / 2, 0, (0.5 - k) * 0.15); this.myHand.add(m); });
      } else {
        const show = revealed && revealed[i];
        s.hole[i].forEach((c, k) => { const m = cardMesh(c); const p = this.seatPt(i, 0.66); m.position.set(p.x + (k - 0.5) * 0.04, 0.002 + k * 0.002, p.z); m.rotation.y = this.ctx.seats[i].angle + (k - 0.5) * 0.2; if (!show) m.rotation.z = Math.PI; this.dyn.add(m); });
      }
    }
    const P = rules.pot(s) - s.bets.reduce((a, b) => a + b, 0);
    if (P > 0) this.stack(V3(0.0, 0, 0.12), P, 1);
    const b = this.seatPt(s.dealer, 0.6); this.button.position.set(b.x + 0.08, 0.005, b.z);
  }
  async animate(prev, a, next, seat) {
    const hud = this.ctx.hud, name = (i) => this.ctx.seats[i].name;
    let revealed = null;
    for (const ev of next.ev) {
      switch (ev.t) {
        case 'fold': hud.banner(t('pk.b.fold', { who: name(ev.seat) }), 900); sfx('card'); this.ctx.react(ev.seat, 'unlucky', { magnitude: 0.2 }); break;
        case 'check': sfx('tick'); this.ctx.seats[ev.seat].character.emote('nod'); break;
        case 'call': sfx('chip'); if (ev.allin) { hud.banner(t('pk.b.allin', { who: name(ev.seat) }), 1300); this.ctx.react(ev.seat, 'surprise', { magnitude: 0.8 }); } break;
        case 'raise': sfx('chip'); sfx('coins'); hud.banner(ev.allin ? t('pk.b.allin', { who: name(ev.seat) }) : t('pk.b.raise', { who: name(ev.seat), n: ev.to }), 1200); this.ctx.react(ev.seat, ev.allin ? 'surprise' : 'good', { magnitude: ev.allin ? 0.9 : 0.4 }); await this.ctx.reach(ev.seat, this.world(this.seatPt(ev.seat, 0.55))); break;
        case 'street': sfx('deal'); this.sync({ ...next, board: ev.board, bets: Array(next.n).fill(0) }); await wait(0.5); break;
        case 'showdown': {
          revealed = {}; for (const hh of ev.hole) revealed[hh.seat] = true;
          this.sync({ ...prev, board: ev.board, folded: prev.folded, bets: Array(prev.n).fill(0), committed: prev.committed }, revealed);
          for (const hh of ev.hole) this.ctx.labels.float(this.world(this.seatPt(hh.seat, 0.66)).add(V3(0, 0.12, 0)), t('pk.cat' + hh.cat));
          sfx('card'); await wait(1.8);
          break;
        }
        case 'win': {
          const tot = {}; for (const p of ev.pots) { const sh = Math.floor(p.amount / p.winners.length); p.winners.forEach((w) => { tot[w] = (tot[w] || 0) + sh; }); }
          for (const [w, n] of Object.entries(tot)) { hud.banner('🏆 ' + t('pk.b.win', { who: name(+w), n }), 1600); this.ctx.react(+w, n > 300 ? 'win' : 'good', { magnitude: Math.min(1, n / 600) }); }
          sfx('coins'); await wait(0.9);
          break;
        }
        case 'bust': hud.banner(t('pk.b.bust', { who: name(ev.seat) }), 1500); this.ctx.react(ev.seat, 'lose', { magnitude: 1 }); break;
        case 'blinds': hud.banner(t('pk.b.blinds', ev), 1300); break;
        case 'deal': sfx('shuffle'); hud.banner(t('pk.hand', { n: ev.hand }), 900); break;
        default: break;
      }
    }
    this.sync(next);
  }
  human(s, seat) {
    this.viewer = seat; this.sync(s);
    return this.ask((done) => {
      const tc = rules.toCall(s, seat), P = rules.pot(s), max = s.bets[seat] + s.chips[seat];
      this.ctx.hud.status(t('pk.st', { p: P, c: tc }), true);
      const minTo = Math.min(max, s.currentBet + s.minRaise);
      const acts = [{ label: t('pk.fold'), onClick: () => done({ t: 'fold' }), cls: 'danger' }];
      acts.push(tc ? { label: t('pk.call', { n: Math.min(tc, s.chips[seat]) }), onClick: () => done({ t: 'call' }), cls: 'primary' } : { label: t('pk.check'), onClick: () => done({ t: 'check' }), cls: 'primary' });
      if (max > s.currentBet) acts.push({ label: t('pk.raise') + ' ▲', onClick: () => this.raiseModal(s, seat, minTo, max, done) });
      this.ctx.hud.actions(acts);
    });
  }
  raiseModal(s, seat, minTo, max, done) {
    let to = minTo, m;
    const P = rules.pot(s);
    const lab = h('div', { class: 'title center gold' }, t('pk.raiseTo', { n: to }));
    const r = h('input', { type: 'range', min: minTo, max, step: 5, value: to });
    r.addEventListener('input', () => { to = +r.value; lab.textContent = t('pk.raiseTo', { n: to }); });
    const preset = (label, v) => btn(label, () => { to = Math.max(minTo, Math.min(max, Math.round(v / 5) * 5)); r.value = to; lab.textContent = t('pk.raiseTo', { n: to }); }, 'small ghost');
    m = modal(h('div', { class: 'col' }, lab, r, h('div', { class: 'row', style: { justifyContent: 'center', flexWrap: 'wrap' } },
      preset(t('pk.min'), minTo), preset(t('pk.half'), s.currentBet + P / 2), preset(t('pk.pot'), s.currentBet + P), preset(t('pk.allin', { n: '' }), max))),
    { buttons: [btn(t('cancel'), () => closeModal(m), 'ghost'), btn(t('confirm'), () => { closeModal(m); done({ t: 'raise', to: to === max ? max : Math.max(minTo, to) }); }, 'primary')] });
  }
  playerStat(s, i) { return s.out[i] ? '—' : '◉' + s.chips[i]; }
  isOut(s, i) { return s.out[i]; }
  dispose() { this.myHand.removeFromParent(); this.chipGeo.dispose(); super.dispose(); }
}
export default {
  focus: 0.75, id: 'holdem', category: 'card', icon: '♠️', minPlayers: 2, maxPlayers: 5, defaultPlayers: 4,
  colors: ['#145a3c', '#2a0a1a'], rules, ai, View, hiddenInfo: true, undo: false,
  options: [{ key: 'duration', labelKey: 'pk.duration', default: 'medium', values: ['short', 'medium', 'full'].map((v) => ({ value: v, key: 'pk.' + v })) }],
  rulesText: {
    en: "Texas Hold'em played for virtual points only.\n• Everyone gets 2 private cards; 5 community cards come in three steps (flop, turn, river).\n• Each betting round you may fold, check/call, or raise. Blinds rise every 6 hands.\n• At showdown the best 5-card hand wins: straight flush > four of a kind > full house > flush > straight > three of a kind > two pair > pair > high card.\n• All-in players can only win the part of the pot they matched (side pots).\nWhoever holds the most points when the hand limit ends (or the last player standing) wins.",
    ru: 'Техасский холдем только на виртуальные очки.\n• Каждый получает 2 закрытые карты; 5 общих карт открываются в три этапа (флоп, тёрн, ривер).\n• В каждом круге торговли можно сбросить, чекнуть/уравнять или повысить. Блайнды растут каждые 6 раздач.\n• На вскрытии побеждает лучшая комбинация из 5 карт: стрит-флеш > каре > фулл-хаус > флеш > стрит > сет > две пары > пара > старшая карта.\n• Игрок ва-банк может выиграть только ту часть банка, которую уравнял (побочные банки).\nПобеждает тот, у кого больше всего очков в конце лимита раздач (или последний оставшийся).',
  },
  thumb(g) { [[110, -0.2, '♠', '#14142a'], [160, 0.15, '♥', '#d0203a']].forEach(([x, r, sy, c]) => { g.save(); g.translate(x, 120); g.rotate(r); g.fillStyle = '#fff'; g.fillRect(-35, -50, 70, 100); g.fillStyle = c; g.font = '60px sans-serif'; g.textAlign = 'center'; g.fillText(sy, 0, 20); g.font = 'bold 22px sans-serif'; g.fillText('A', -20, -28); g.restore(); }); for (let i = 0; i < 5; i++) { g.fillStyle = ['#d0203a', '#2a5ad8', '#f7c95a'][i % 3]; g.beginPath(); g.ellipse(230, 190 - i * 8, 22, 8, 0, 0, 7); g.fill(); } },
};

// COLOR BLITZ — UNO-style shedding card game module.
import * as THREE from 'three';
import * as rules from './rules.js';
import * as ai from './ai.js';
import { makeCard, setCardFace, backTexture, DESIGNS, CARD_W, CARD_H } from './cards.js';
import { ViewBase, V3 } from '../common.js';
import { tweens, Ease, wait } from '../../scene/engine.js';
import { sfx } from '../../core/audio.js';
import { h } from '../../core/util.js';
import { registerStrings, t } from '../../i18n/index.js';
import { btn, modal, closeModal } from '../../ui/ui.js';

registerStrings({
  en: {
    'game.colorblitz.name': 'Color Blitz', 'game.colorblitz.desc': 'Match colors and numbers, hit rivals with +2 and +4, shout ONE!',
    'cb.deck': 'Card design', 'cb.variant': 'House rules', 'cb.duration': 'Match length',
    'cb.v.classic': 'Classic', 'cb.v.stack': 'Stacking +2/+4', 'cb.v.drawUntil': 'Draw until playable', 'cb.v.strict': 'Strict +4',
    'cb.d.single': 'One round', 'cb.d.short': 'First to 200', 'cb.d.long': 'First to 500',
    'cb.draw': 'Draw', 'cb.drawN': 'Take +{n}', 'cb.pass': 'Keep & pass', 'cb.one': 'ONE!', 'cb.catch': 'Catch {name}!',
    'cb.st.play': 'Play a matching card or draw', 'cb.st.after': 'Play the drawn card or keep it', 'cb.st.pending': 'Stack a draw card or take +{n}',
    'cb.pick': 'Choose a color', 'cb.r': 'Red', 'cb.y': 'Yellow', 'cb.g': 'Green', 'cb.b': 'Blue',
    'cb.b.color': '{who} picks {color}', 'cb.b.skip': '{who} is skipped!', 'cb.b.rev': 'Direction reversed!', 'cb.b.pen': '{who} draws {n}!',
    'cb.b.one': '{who}: ONE!', 'cb.b.caught': '{who} forgot to say ONE! +2', 'cb.b.round': '{who} wins the round +{n}', 'cb.b.stack': 'Stack: +{n}',
    'cb.next': 'Next round', 'cb.roundTitle': 'Round {n} results', 'cb.shuffle': 'Reshuffling the pile',
  },
  ru: {
    'game.colorblitz.name': 'Цветной блиц', 'game.colorblitz.desc': 'Совпадайте цветом и цифрой, бейте соперников +2 и +4, кричите «ОДНА!»',
    'cb.deck': 'Дизайн карт', 'cb.variant': 'Домашние правила', 'cb.duration': 'Длительность',
    'cb.v.classic': 'Классика', 'cb.v.stack': 'Накопление +2/+4', 'cb.v.drawUntil': 'Брать до подходящей', 'cb.v.strict': 'Строгий +4',
    'cb.d.single': 'Один раунд', 'cb.d.short': 'До 200 очков', 'cb.d.long': 'До 500 очков',
    'cb.draw': 'Взять', 'cb.drawN': 'Взять +{n}', 'cb.pass': 'Оставить', 'cb.one': 'ОДНА!', 'cb.catch': 'Поймать: {name}!',
    'cb.st.play': 'Положите подходящую карту или возьмите', 'cb.st.after': 'Сыграйте взятую карту или оставьте', 'cb.st.pending': 'Ответьте картой добора или возьмите +{n}',
    'cb.pick': 'Выберите цвет', 'cb.r': 'Красный', 'cb.y': 'Жёлтый', 'cb.g': 'Зелёный', 'cb.b': 'Синий',
    'cb.b.color': '{who} выбирает: {color}', 'cb.b.skip': '{who} пропускает ход!', 'cb.b.rev': 'Смена направления!', 'cb.b.pen': '{who} берёт {n}!',
    'cb.b.one': '{who}: ОДНА!', 'cb.b.caught': '{who} забыл(а) сказать «ОДНА!» +2', 'cb.b.round': '{who} выигрывает раунд +{n}', 'cb.b.stack': 'Накоплено: +{n}',
    'cb.next': 'Следующий раунд', 'cb.roundTitle': 'Итоги раунда {n}', 'cb.shuffle': 'Перемешиваем сброс',
  },
});

const DRAW_POS = V3(-0.2, 0, 0.02);
const DISCARD_POS = V3(0.12, 0, 0.0);
const hash = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

class View extends ViewBase {
  build(s) {
    this.s = s;
    this.design = this.ctx.options.deck || 'classic';
    this.D = DESIGNS[this.design] || DESIGNS.classic;
    this.viewer = this.ctx.me;
    this.meshes = new Map();
    // felt mat under the piles
    const mat = new THREE.Mesh(new THREE.CircleGeometry(0.55, 48), new THREE.MeshStandardMaterial({ color: this.design === 'neon' ? '#0d0a24' : this.design === 'royal' ? '#1a1430' : '#1f5a3a', roughness: 0.9 }));
    mat.rotation.x = -Math.PI / 2; mat.position.y = 0.001; mat.receiveShadow = true;
    this.group.add(mat);
    // draw pile
    const back = new THREE.MeshStandardMaterial({ map: backTexture(this.design), roughness: 0.5 });
    const edge = new THREE.MeshStandardMaterial({ color: '#f0f0f0', roughness: 0.7 });
    this.pile = new THREE.Mesh(new THREE.BoxGeometry(CARD_W, 1, CARD_H), [edge, edge, back, edge, edge, edge]);
    this.pile.position.copy(DRAW_POS); this.pile.rotation.y = 0.15; this.pile.castShadow = true;
    this.pile.userData.pile = true;
    this.group.add(this.pile);
    this.pickables.push(this.pile);
    // discard + color ring
    this.discardGroup = new THREE.Group(); this.group.add(this.discardGroup);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.185, 48), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.copy(DISCARD_POS).add(V3(0, 0.002, 0));
    this.group.add(this.ring);
    // direction arrows orbiting the piles
    this.arrows = [];
    const arrowMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 });
    for (let k = 0; k < 4; k++) {
      const a = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 3), arrowMat);
      a.rotation.x = Math.PI / 2;
      const holder = new THREE.Group(); holder.add(a);
      this.group.add(holder); this.arrows.push(holder);
    }
    this.arrowPhase = 0;
    // hands: opponent fans at their seats, mine on the camera rig
    this.fans = this.ctx.seats.map((seat) => {
      const g = new THREE.Group();
      const a = seat.angle;
      g.position.set(Math.sin(a) * 1.34, 0.2, Math.cos(a) * 1.34);
      g.rotation.y = a;
      this.group.add(g);
      return g;
    });
    this.myHand = new THREE.Group();
    this.ctx.rig.handRig.add(this.myHand);
    this.ctx.seats.forEach((seat) => seat.character.holdCards(true));
    this.oneArmed = false;
    this.layout(s, false);
  }

  setViewer(seat) { this.viewer = seat; this.layout(this.s, true); }
  sync(s) { this.s = s; for (const m of this.meshes.values()) m.removeFromParent(); this.meshes.clear(); this.layout(s, false); }

  /** Compute where every visible card should be, then move meshes there (re-parenting with world-space continuity). */
  layout(s, animate = true, delays = null) {
    const want = new Map();
    // hands
    s.hands.forEach((hand, seat) => {
      const mine = seat === this.viewer;
      const n = hand.length;
      if (mine) {
        const portrait = this.ctx.engine.portrait;
        const maxW = portrait ? 0.22 : 0.62;
        const sp = Math.min(0.07, maxW / Math.max(1, n - 1));
        hand.forEach((c, i) => {
          const x = (i - (n - 1) / 2) * sp;
          const lift = this.playableIds?.has(c.id) ? 0.03 : 0;
          want.set(c.id, { parent: this.myHand, pos: V3(x, -Math.abs(x) * 0.18 + lift, i * 0.0012), rot: new THREE.Euler(Math.PI / 2 - 0.05, 0, -x * 0.5), face: c, scale: portrait ? 0.8 : 0.88 });
        });
      } else {
        const sp = Math.min(0.03, 0.26 / Math.max(1, n - 1));
        hand.forEach((c, i) => {
          const x = (i - (n - 1) / 2) * sp;
          // cards held upright-ish, backs toward the table center
          want.set(c.id, { parent: this.fans[seat], pos: V3(x, -Math.abs(x) * 0.25, -i * 0.0012 - 0.02), rot: new THREE.Euler(Math.PI / 2 - 0.3, 0, -x * 1.1, 'XYZ'), face: null, scale: 0.75 });
        });
      }
    });
    // discard (top 10)
    const d = s.discard;
    d.slice(-10).forEach((c, k, arr) => {
      const r = hash(c.id + 1) - 0.5;
      want.set(c.id, { parent: this.discardGroup, pos: DISCARD_POS.clone().add(V3(r * 0.03, 0.002 + k * 0.0018, (hash(c.id + 7) - 0.5) * 0.03)), rot: new THREE.Euler(0, r * 1.2, 0), face: c, scale: 1.5 });
    });
    // pile height
    this.pile.scale.set(1.5, Math.max(0.002, s.deck.length * 0.0011), 1.5);
    this.pile.position.y = this.pile.scale.y / 2;
    // remove stale meshes
    for (const [id, m] of this.meshes) if (!want.has(id)) { m.removeFromParent(); this.meshes.delete(id); }
    const pileTop = this.group.localToWorld(DRAW_POS.clone().add(V3(0, this.pile.scale.y + 0.004, 0)));
    let k = 0;
    const jobs = [];
    for (const [id, w] of want) {
      let m = this.meshes.get(id);
      const card = s.hands.flat().concat(s.discard).find((c) => c.id === id);
      const needFace = w.face ? card : null;
      if (!m) {
        m = makeCard(this.design, needFace);
        this.meshes.set(id, m);
        m.userData.id = id;
        if (animate) { this.group.add(m); m.position.copy(this.group.worldToLocal(pileTop.clone())); m.rotation.set(Math.PI, 0.15, 0); }
        w.parent.attach(m);
      } else if (m.parent !== w.parent) w.parent.attach(m);
      if (needFace && m.userData.faceId !== id) { setCardFace(m, this.design, card); m.userData.faceId = id; }
      if (!needFace && m.userData.faceId !== undefined) { m.material = makeCard(this.design, null).material; m.userData.faceId = undefined; }
      m.userData.id = id;
      const q = new THREE.Quaternion().setFromEuler(w.rot);
      if (!animate) { m.position.copy(w.pos); m.quaternion.copy(q); m.scale.setScalar(w.scale); continue; }
      const p0 = m.position.clone(), q0 = m.quaternion.clone(), s0 = m.scale.x;
      if (p0.distanceTo(w.pos) < 1e-4 && q0.angleTo(q) < 1e-3 && Math.abs(s0 - w.scale) < 1e-3) continue;
      const delay = delays?.get(id) ?? 0;
      const moved = p0.distanceTo(w.pos) > 0.1;
      jobs.push(wait(delay).then(() => tweens.run(moved ? 0.42 : 0.18, (e) => {
        m.position.lerpVectors(p0, w.pos, e);
        if (moved) m.position.y += Math.sin(e * Math.PI) * 0.06;
        m.quaternion.copy(q0).slerp(q, e);
        m.scale.setScalar(s0 + (w.scale - s0) * e);
      }, Ease.inOut)));
      k++;
    }
    return Promise.all(jobs);
  }

  colorName(c) { return t('cb.' + c); }
  name(i) { return this.ctx.seats[i]?.name || ''; }

  async animate(prev, a, next, seat) {
    this.s = next;
    this.playableIds = null;
    const hud = this.ctx.hud;
    let delays = null;
    for (const ev of next.ev) {
      switch (ev.t) {
        case 'deal': sfx('shuffle'); hud.banner(t('game.round', { n: ev.round }), 1200); delays = new Map(); next.hands.forEach((hd) => hd.forEach((c, i) => delays.set(c.id, i * 0.08 + Math.random() * 0.05))); break;
        case 'play': {
          sfx('cardSlap');
          if (seat !== this.viewer) this.ctx.reach(seat, this.world(DISCARD_POS));
          if (ev.card.c === 'w') { hud.banner(t('cb.b.color', { who: this.name(ev.seat), color: this.colorName(ev.color) }), 1500); sfx('special'); }
          if (ev.card.v === 'd4' || ev.card.v === 'd2') this.ctx.react(ev.seat, 'good', { magnitude: ev.card.v === 'd4' ? 0.8 : 0.5 });
          break;
        }
        case 'draw': if (ev.ids.length) sfx('deal'); break;
        case 'penalty': hud.banner(t('cb.b.pen', { who: this.name(ev.seat), n: ev.n }), 1500); this.ctx.react(ev.seat, ev.n >= 4 ? 'ouch' : 'unlucky', { magnitude: ev.n / 6 }); break;
        case 'stack': hud.banner(t('cb.b.stack', { n: ev.pending }), 1200); break;
        case 'skip': hud.banner('⊘ ' + t('cb.b.skip', { who: this.name(ev.seat) }), 1300); this.ctx.react(ev.seat, 'unlucky', { magnitude: 0.4 }); break;
        case 'reverse': hud.banner('⇄ ' + t('cb.b.rev'), 1200); sfx('whoosh'); break;
        case 'one': hud.banner('☝ ' + t('cb.b.one', { who: this.name(ev.seat) }), 1500); this.ctx.labels.bubble(this.ctx.seats[ev.seat].character, t('cb.one'), 1.8); sfx('notify'); break;
        case 'caught': hud.banner(t('cb.b.caught', { who: this.name(ev.victim) }), 1800); this.ctx.react(ev.seat, 'good', { magnitude: 0.6 }); this.ctx.react(ev.victim, 'unlucky', { magnitude: 0.7 }); break;
        case 'roundWin': hud.banner('🏆 ' + t('cb.b.round', { who: this.name(ev.seat), n: ev.pts }), 2200); this.ctx.react(ev.seat, 'win', { magnitude: 1 }); break;
        case 'reshuffle': hud.banner(t('cb.shuffle'), 1000); sfx('shuffle'); break;
        default: break;
      }
    }
    // one hand of the active player looks at the pile
    await this.layout(next, true, delays);
    this.pulseColor(next.color, prev.color !== next.color);
  }

  pulseColor(c, flash) {
    const col = this.D[c] || '#ffffff';
    this.ring.material.color.set(col);
    if (flash) { this.ctx.particles.burst(this.world(DISCARD_POS).add(V3(0, 0.03, 0)), { count: 30, colors: [col, '#ffffff'], speed: 0.8, up: 1.2 }); }
  }

  human(s, seat) {
    this.viewer = seat;
    const playable = rules.playableCards(s, seat);
    this.playableIds = new Set(playable.map((c) => c.id));
    this.layout(s, true);
    this.pulseColor(s.color, false);
    return this.ask((done) => {
      const hud = this.ctx.hud;
      if (s.phase === 'roundOver') { this.roundModal(s, done); return; }
      const hand = s.hands[seat];
      const acts = [];
      if (s.unsaid !== null && s.unsaid !== seat && s.hands[s.unsaid].length === 1 && s.phase === 'play') acts.push({ label: '🫵 ' + t('cb.catch', { name: this.name(s.unsaid) }), onClick: () => done({ t: 'catch' }), cls: 'danger' });
      if (s.phase === 'afterDraw') { hud.status(t('cb.st.after'), true); acts.push({ label: t('cb.pass'), onClick: () => done({ t: 'pass' }) }); }
      else if (s.pending > 0) { hud.status(t('cb.st.pending', { n: s.pending }), true); acts.push({ label: t('cb.drawN', { n: s.pending }), onClick: () => done({ t: 'draw' }), cls: 'primary' }); }
      else { hud.status(t('cb.st.play'), true); acts.push({ label: '🂠 ' + t('cb.draw'), onClick: () => done({ t: 'draw' }), cls: playable.length ? '' : 'primary' }); }
      if (hand.length === 2) {
        const oneBtn = { label: (this.oneArmed ? '✅ ' : '☝ ') + t('cb.one'), onClick: () => { this.oneArmed = !this.oneArmed; sfx('pop'); setActs(); }, cls: this.oneArmed ? 'good' : 'primary' };
        acts.unshift(oneBtn);
      }
      const setActs = () => {
        if (hand.length === 2) acts[0] = { label: (this.oneArmed ? '✅ ' : '☝ ') + t('cb.one'), onClick: acts[0].onClick, cls: this.oneArmed ? 'good' : 'primary' };
        hud.actions(acts);
      };
      setActs();
      const playCard = (card) => {
        const finish = (color) => {
          const a = { t: 'play', id: card.id, one: this.oneArmed && hand.length === 2 };
          if (color) a.color = color;
          this.oneArmed = false;
          done(a);
        };
        if (card.c === 'w') this.colorPicker(finish); else finish();
      };
      this.tapHandler = (hit) => {
        const id = ViewBase.dataOf(hit, 'id');
        if (hit && ViewBase.dataOf(hit, 'pile') && s.phase === 'play') { done({ t: 'draw' }); return; }
        if (id === undefined) return;
        const card = playable.find((c) => c.id === id);
        if (!card) { if (hand.some((c) => c.id === id)) { sfx('error'); this.shake(id); } return; }
        sfx('click');
        playCard(card);
      };
    });
  }
  shake(id) {
    const m = this.meshes.get(id);
    if (!m) return;
    const x0 = m.position.x;
    tweens.run(0.3, (e) => { m.position.x = x0 + Math.sin(e * Math.PI * 6) * 0.006 * (1 - e); });
  }
  colorPicker(cb) {
    let m;
    const grid = h('div', { class: 'color-pick' }, ...rules.COLORS.map((c) => {
      const b = btn(this.colorName(c), () => { closeModal(m); cb(c); });
      b.style.background = this.D[c]; b.style.color = '#fff'; b.style.textShadow = '0 2px 4px rgba(0,0,0,.5)';
      return b;
    }));
    m = modal(h('div', { class: 'col' }, h('div', { class: 'title center' }, t('cb.pick')), grid), { dismissible: false });
  }
  roundModal(s, done) {
    let m;
    const rows = s.scores.map((sc, i) => h('div', { class: 'rank' }, h('div', { class: 'pos' }, i === s.roundWinner ? '🏆' : ''), h('div', { class: 'grow' }, this.name(i)), h('div', { class: 'mini' }, s.hands[i].length + ' 🂠'), h('div', { class: 'gold' }, String(sc))));
    m = modal(h('div', { class: 'col' }, h('div', { class: 'title center' }, t('cb.roundTitle', { n: s.round })), ...rows, h('div', { class: 'mini center' }, '🎯 ' + s.target)),
      { buttons: [btn(t('cb.next'), () => { closeModal(m); done({ t: 'next' }); }, 'primary')], dismissible: false });
  }
  update(dt, tt) {
    const s = this.s;
    if (!s) return;
    this.arrowPhase += dt * 0.5 * (s.dir || 1);
    this.arrows.forEach((a, k) => {
      const ang = this.arrowPhase + (k / 4) * Math.PI * 2;
      a.position.set(Math.cos(ang) * 0.5, 0.01, Math.sin(ang) * 0.5);
      a.rotation.y = -ang + (s.dir > 0 ? Math.PI : 0);
    });
    this.ring.material.opacity = 0.65 + Math.sin(tt * 4) * 0.25;
    // the active player's fan bobs slightly
    const cur = rules.actor(s);
    this.fans.forEach((f, i) => { f.position.y = 0.2 + (i === cur ? Math.sin(tt * 5) * 0.01 : 0); });
  }
  playerStat(s, i) { return `🂠${s.hands[i].length}` + (s.target ? ` · ${s.scores[i]}` : ''); }
  dispose() {
    this.ctx.seats.forEach((seat) => seat.character.holdCards(false));
    this.myHand.removeFromParent();
    super.dispose();
  }
}

export default {
  focus: 0.7,
  id: 'colorblitz', category: 'card', icon: '🃏', minPlayers: 2, maxPlayers: 5, defaultPlayers: 4, quickPlayers: 4,
  colors: ['#e3342f', '#2a1a6a'], rules, ai, View, hiddenInfo: true, undo: false,
  options: [
    { key: 'deck', labelKey: 'cb.deck', default: 'classic', collection: 'decks', values: Object.keys(DESIGNS).map((d) => ({ value: d, key: 'item.decks.' + d })) },
    { key: 'variant', labelKey: 'cb.variant', default: 'classic', values: ['classic', 'stack', 'drawUntil', 'strict'].map((v) => ({ value: v, key: 'cb.v.' + v })) },
    { key: 'duration', labelKey: 'cb.duration', default: 'single', values: ['single', 'short', 'long'].map((v) => ({ value: v, key: 'cb.d.' + v })) },
  ],
  rulesText: {
    en: `Get rid of all your cards first.
• Play a card matching the top card's color, number or symbol. Wild cards can always be played and let you choose the color.
• ⊘ Skip — next player loses a turn. ⇄ Reverse — direction changes (acts like Skip with 2 players). +2 — next player draws 2 and is skipped. +4 — choose a color, next player draws 4 and is skipped.
• If you can't (or don't want to) play, draw a card. If it's playable you may play it immediately.
• When you play your second-to-last card, press ONE! first. If you forget and the next player catches you, you draw 2.
• Scoring: the round winner gets the value of opponents' cards (numbers = face value, action cards 20, wilds 50).
House rules: Stacking (answer +2/+4 with another draw card), Draw until playable, Strict +4 (only when you have no card of the current color).`,
    ru: `Избавьтесь от всех карт первым.
• Кладите карту того же цвета, числа или символа, что и верхняя. Карту смены цвета можно класть всегда — она позволяет выбрать цвет.
• ⊘ Пропуск — следующий игрок пропускает ход. ⇄ Реверс — смена направления (при двух игроках работает как пропуск). +2 — следующий берёт 2 и пропускает ход. +4 — выберите цвет, следующий берёт 4 и пропускает ход.
• Если нечем ходить (или не хотите) — возьмите карту. Если она подходит, её можно сразу сыграть.
• Кладя предпоследнюю карту, нажмите «ОДНА!». Если забудете и следующий игрок вас поймает — возьмёте 2 карты.
• Очки: победитель раунда получает сумму карт соперников (числа — номинал, действия — 20, смена цвета — 50).
Домашние правила: Накопление (+2/+4 можно перебить), Брать до подходящей, Строгий +4 (только если нет карт текущего цвета).`,
  },
  thumb(g) {
    const cols = ['#e3342f', '#f6c90e', '#2fb36a', '#2f7bd8'];
    cols.forEach((c, i) => {
      g.save(); g.translate(110 + i * 34, 130); g.rotate(-0.35 + i * 0.22);
      g.fillStyle = '#fff'; g.fillRect(-36, -56, 72, 112); g.fillStyle = c; g.fillRect(-31, -51, 62, 102);
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, 0, 24, 40, -0.5, 0, 7); g.fill();
      g.fillStyle = c; g.font = '900 32px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(['7', '+2', '⇄', '+4'][i], 0, 2);
      g.restore();
    });
  },
};

// TYCOON — the flagship property-trading board game (Monopoly-style mechanics, original content).
import * as THREE from 'three';
import * as rules from './rules.js';
import * as ai from './ai.js';
import { TILES, GROUPS, RAILS, UTILS, boardTheme, tileName, isProperty, groupOf, EVENT_CARDS, FUND_CARDS, BOARD_IDS } from './boards.js';
import { BOARD, U, CORNER, tileCenter, inward, along, sideOf, tileAt, drawBoardTexture, cardBackTexture, cardFaceTexture } from './board3d.js';
import { makeToken, TOKEN_IDS } from '../tokens.js';
import { ViewBase, arcMove, std, V3 } from '../common.js';
import { makeDie, rollDice } from '../../scene/dice.js';
import { tweens, Ease, wait } from '../../scene/engine.js';
import { sfx } from '../../core/audio.js';
import { h, fmt } from '../../core/util.js';
import { registerStrings, t, lang } from '../../i18n/index.js';
import { btn, modal, closeModal, toast } from '../../ui/ui.js';
import { save } from '../../core/store.js';

registerStrings({
  en: {
    'game.tycoon.name': 'Tycoon', 'game.tycoon.desc': 'Buy streets, build hotels, trade and bankrupt your rivals',
    'tyc.board': 'Board', 'tyc.token': 'Your token', 'tyc.variant': 'Rule set', 'tyc.duration': 'Match length',
    'tyc.v.classic': 'Classic', 'tyc.v.jackpot': 'Jackpot rest stop', 'tyc.v.speed': 'Speed start',
    'tyc.d.short': 'Short · 20 rounds', 'tyc.d.medium': 'Medium · 40 rounds', 'tyc.d.full': 'Until one remains',
    'tyc.roll': '🎲 ROLL', 'tyc.buy': 'Buy · ${n}', 'tyc.auction': 'Auction', 'tyc.manage': '🏠 Properties', 'tyc.trade': '🤝 Trade',
    'tyc.end': 'End turn ➜', 'tyc.payJail': 'Pay ${n}', 'tyc.useCard': 'Use pass', 'tyc.rollJail': '🎲 Roll for doubles',
    'tyc.bankrupt': 'Declare bankruptcy', 'tyc.pass': 'Pass',
    'tyc.st.roll': 'Roll the dice', 'tyc.st.buy': 'Buy {name}?', 'tyc.st.end': 'Build, trade or end your turn',
    'tyc.st.debt': 'You owe ${n}. Sell houses or mortgage property.', 'tyc.st.auction': 'Auction · top bid ${n}', 'tyc.st.jail': 'In jail · attempt {n}/3',
    'tyc.st.cantPay': 'Not enough assets — you must declare bankruptcy',
    'tyc.b.bought': '{who} bought {name}', 'tyc.b.rent': '{who} paid ${n} rent', 'tyc.b.tax': '{who} paid ${n}',
    'tyc.b.salary': '{who} collected ${n}', 'tyc.b.jail': '{who} goes to jail!', 'tyc.b.free': '{who} is out of jail',
    'tyc.b.doubles': 'Doubles!', 'tyc.b.auctionWin': '{who} won {name} for ${n}', 'tyc.b.auctionNone': 'Nobody bought {name}',
    'tyc.b.bankrupt': '{who} is bankrupt!', 'tyc.b.trade': '{who} and {to} made a deal!', 'tyc.b.tradeNo': '{to} declined the deal',
    'tyc.b.auction': 'Auction: {name}', 'tyc.b.jackpot': '{who} took the jackpot ${n}!', 'tyc.b.offer': '{who} proposes a deal to {to}',
    'tyc.b.round': 'Round {n}/{max}', 'tyc.b.lastRound': 'Final round!',
    'tyc.m.title': 'Properties', 'tyc.m.none': 'No properties yet', 'tyc.m.build': '+🏠 ${n}', 'tyc.m.sell': '−🏠 +${n}',
    'tyc.m.mort': 'Mortgage +${n}', 'tyc.m.unmort': 'Redeem −${n}', 'tyc.m.mortgaged': 'mortgaged', 'tyc.m.cash': 'Cash: ${n} · Net worth: ${w}',
    'tyc.t.title': 'Propose a trade', 'tyc.t.with': 'Trade with', 'tyc.t.give': 'You give', 'tyc.t.get': 'You get', 'tyc.t.cash': 'Cash',
    'tyc.t.send': 'Send offer', 'tyc.t.offer': '{who} offers you a deal', 'tyc.t.accept': 'Accept', 'tyc.t.decline': 'Decline',
    'tyc.t.nothing': 'nothing', 'tyc.t.theyGive': '{who} gives', 'tyc.t.youGive': 'You give',
    'tyc.c.rent': 'Rent', 'tyc.c.set': 'Rent with full set', 'tyc.c.h': 'With {n} house(s)', 'tyc.c.hotel': 'With hotel', 'tyc.c.houseCost': 'House cost',
    'tyc.c.mortgage': 'Mortgage value', 'tyc.c.owner': 'Owner', 'tyc.c.bank': 'Bank', 'tyc.c.rail': 'Rent with {n} transport(s)',
    'tyc.c.util': '4× dice · 10× dice with both utilities', 'tyc.bid': '+${n}',
  },
  ru: {
    'game.tycoon.name': 'Магнат', 'game.tycoon.desc': 'Покупайте улицы, стройте отели, торгуйтесь и разоряйте соперников',
    'tyc.board': 'Игровое поле', 'tyc.token': 'Ваша фишка', 'tyc.variant': 'Набор правил', 'tyc.duration': 'Длительность',
    'tyc.v.classic': 'Классика', 'tyc.v.jackpot': 'Джекпот на отдыхе', 'tyc.v.speed': 'Быстрый старт',
    'tyc.d.short': 'Короткая · 20 кругов', 'tyc.d.medium': 'Средняя · 40 кругов', 'tyc.d.full': 'До последнего игрока',
    'tyc.roll': '🎲 БРОСОК', 'tyc.buy': 'Купить · ${n}', 'tyc.auction': 'Аукцион', 'tyc.manage': '🏠 Имущество', 'tyc.trade': '🤝 Обмен',
    'tyc.end': 'Завершить ход ➜', 'tyc.payJail': 'Заплатить ${n}', 'tyc.useCard': 'Пропуск', 'tyc.rollJail': '🎲 Бросить на дубль',
    'tyc.bankrupt': 'Объявить банкротство', 'tyc.pass': 'Пас',
    'tyc.st.roll': 'Бросьте кубики', 'tyc.st.buy': 'Купить «{name}»?', 'tyc.st.end': 'Стройте, торгуйтесь или завершите ход',
    'tyc.st.debt': 'Вы должны ${n}. Продайте дома или заложите имущество.', 'tyc.st.auction': 'Аукцион · ставка ${n}', 'tyc.st.jail': 'В тюрьме · попытка {n}/3',
    'tyc.st.cantPay': 'Не хватает имущества — придётся объявить банкротство',
    'tyc.b.bought': '{who} купил(а) «{name}»', 'tyc.b.rent': '{who} заплатил(а) аренду ${n}', 'tyc.b.tax': '{who} заплатил(а) ${n}',
    'tyc.b.salary': '{who} получил(а) ${n}', 'tyc.b.jail': '{who} отправляется в тюрьму!', 'tyc.b.free': '{who} вышел(ла) из тюрьмы',
    'tyc.b.doubles': 'Дубль!', 'tyc.b.auctionWin': '{who} выиграл(а) «{name}» за ${n}', 'tyc.b.auctionNone': '«{name}» никто не купил',
    'tyc.b.bankrupt': '{who} обанкротился(ась)!', 'tyc.b.trade': '{who} и {to} заключили сделку!', 'tyc.b.tradeNo': '{to} отклонил(а) сделку',
    'tyc.b.auction': 'Аукцион: «{name}»', 'tyc.b.jackpot': '{who} сорвал(а) джекпот ${n}!', 'tyc.b.offer': '{who} предлагает сделку: {to}',
    'tyc.b.round': 'Круг {n}/{max}', 'tyc.b.lastRound': 'Последний круг!',
    'tyc.m.title': 'Имущество', 'tyc.m.none': 'Пока нет имущества', 'tyc.m.build': '+🏠 ${n}', 'tyc.m.sell': '−🏠 +${n}',
    'tyc.m.mort': 'Заложить +${n}', 'tyc.m.unmort': 'Выкупить −${n}', 'tyc.m.mortgaged': 'в залоге', 'tyc.m.cash': 'Наличные: ${n} · Капитал: ${w}',
    'tyc.t.title': 'Предложить обмен', 'tyc.t.with': 'С кем', 'tyc.t.give': 'Вы отдаёте', 'tyc.t.get': 'Вы получаете', 'tyc.t.cash': 'Деньги',
    'tyc.t.send': 'Отправить', 'tyc.t.offer': '{who} предлагает вам сделку', 'tyc.t.accept': 'Принять', 'tyc.t.decline': 'Отклонить',
    'tyc.t.nothing': 'ничего', 'tyc.t.theyGive': '{who} отдаёт', 'tyc.t.youGive': 'Вы отдаёте',
    'tyc.c.rent': 'Аренда', 'tyc.c.set': 'Аренда с полным набором', 'tyc.c.h': 'С {n} дом.', 'tyc.c.hotel': 'С отелем', 'tyc.c.houseCost': 'Цена дома',
    'tyc.c.mortgage': 'Залог', 'tyc.c.owner': 'Владелец', 'tyc.c.bank': 'Банк', 'tyc.c.rail': 'Аренда при {n} транспорте',
    'tyc.c.util': '4× кубики · 10× при обоих предприятиях', 'tyc.bid': '+${n}',
  },
});

const money = (n) => '$' + fmt(n);
const L = () => lang();

class View extends ViewBase {
  build(s) {
    this.s = s;
    this.th = boardTheme(s.board);
    const tex = drawBoardTexture(s.board, L() === 'ru' ? 'ru' : 'en');
    const side = std(this.th.dark ? '#1a1e3a' : '#5a3a20');
    const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
    this.boardMesh = new THREE.Mesh(new THREE.BoxGeometry(BOARD, 0.03, BOARD), [side, side, top, side, side, side]);
    this.boardMesh.position.y = 0.015;
    this.boardMesh.receiveShadow = true;
    this.group.add(this.boardMesh);
    this.pickables.push(this.boardMesh);
    this.Y = 0.031;
    // decks
    this.decks = {};
    for (const [deck, x, z] of [['event', -0.36, -0.36], ['fund', 0.36, 0.36]]) {
      const back = new THREE.MeshStandardMaterial({ map: cardBackTexture(deck, this.th), roughness: 0.5 });
      const white = std('#f8f4ec');
      const stack = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.22), [white, white, back, white, white, white]);
      stack.position.set(x, this.Y + 0.015, z); stack.rotation.y = Math.PI / 4; stack.castShadow = true;
      this.group.add(stack); this.decks[deck] = stack;
    }
    // tokens
    const mine = this.ctx.options.token || 'car';
    const pool = TOKEN_IDS.filter((id) => id !== mine);
    this.tokens = this.ctx.seats.map((seat, i) => {
      const id = seat.isHuman && i === this.ctx.me ? mine : pool[(i * 3 + 1) % pool.length];
      const tk = makeToken(id, seat.color);
      tk.scale.setScalar(0.085);
      tk.userData.tokenId = id;
      this.group.add(tk);
      return tk;
    });
    // dice
    this.dice = [makeDie(0.075), makeDie(0.075)];
    this.dice.forEach((d, i) => { d.position.set(-0.15 + i * 0.12, this.Y + 0.0375, 0.15); this.group.add(d); });
    // layers rebuilt from state
    this.tileLayer = new THREE.Group(); this.group.add(this.tileLayer);
    this.cashPiles = this.ctx.seats.map(() => null);
    this.billGeo = new THREE.BoxGeometry(0.13, 0.005, 0.065);
    this.billMat = std(this.th.dark ? '#4ad8a0' : '#6ac87a', { roughness: 0.8, metalness: 0 });
    this.houseGeo = new THREE.BoxGeometry(0.026, 0.022, 0.026);
    this.roofGeo = new THREE.ConeGeometry(0.022, 0.018, 4); this.roofGeo.rotateY(Math.PI / 4);
    this.hotelGeo = new THREE.BoxGeometry(0.06, 0.03, 0.032);
    this.markerGeo = new THREE.BoxGeometry(1, 0.004, 1);
    this.coinGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.006, 14);
    this.coinMat = std('#ffd24a', { metalness: 0.9, roughness: 0.25 });
    this.sync(s);
    this.boardTap = (hit) => { if (!hit) return; const p = this.group.worldToLocal(hit.point.clone()); const i = tileAt(p.x, p.z); if (i >= 0) this.showTile(i); };
    this.tapHandler = this.boardTap;
    this.activeSeat = -1;
  }

  // ---------- positions ----------
  tokenSpot(i, seat, jailed = false) {
    const c = tileCenter(i);
    const a = along(i), n = inward(i);
    const k = i % 10 === 0 ? 1.6 : 1;
    const offs = [[-0.024, 0.03], [0.024, 0.03], [-0.024, -0.025], [0.024, -0.025], [0, 0.002]][seat % 5];
    let x = c.x + a.x * offs[0] * k + n.x * offs[1] * k, z = c.y + a.y * offs[0] * k + n.y * offs[1] * k;
    if (i === 10) {
      // jail corner: inmates sit in the inner cell, visitors on the outer edges
      const inner = jailed ? 0.04 : -0.045;
      x = c.x + inner + offs[0] * 0.8; z = c.y - inner + offs[1] * 0.6;
    }
    return V3(x, this.Y, z);
  }
  seatEdge(seat) { const a = this.ctx.seats[seat].angle; return V3(Math.sin(a) * 1.12, this.Y, Math.cos(a) * 1.12); }
  facing(i) { const a = along(i); return Math.atan2(a.x, a.y); }

  // ---------- state -> visuals ----------
  sync(s) {
    this.s = s;
    s.players.forEach((p, i) => {
      const tk = this.tokens[i];
      tk.visible = !p.out;
      tk.position.copy(this.tokenSpot(p.pos, i, p.jail));
      tk.rotation.y = this.facing(p.pos);
    });
    this.renderTiles(s);
    this.renderCash(s);
  }

  renderTiles(s) {
    this.tileLayer.clear();
    s.tiles.forEach((tl, i) => {
      if (tl.owner < 0) return;
      const c = tileCenter(i), n = inward(i), a = along(i);
      const col = tl.mort ? '#777788' : this.ctx.seats[tl.owner].color;
      const mk = new THREE.Mesh(this.markerGeo, std(col, { emissive: col, emissiveIntensity: tl.mort ? 0 : 0.35 }));
      const w = U * 0.86, d = 0.018;
      const outer = CORNER / 2 - 0.012;
      mk.position.set(c.x - n.x * outer, this.Y + 0.002, c.y - n.y * outer);
      mk.scale.set(Math.abs(a.x) * w + Math.abs(n.x) * d, 1, Math.abs(a.y) * w + Math.abs(n.y) * d);
      this.tileLayer.add(mk);
      if (tl.mort) {
        const ov = new THREE.Mesh(new THREE.PlaneGeometry(U * 0.92, CORNER * 0.92), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.35, depthWrite: false }));
        ov.rotation.x = -Math.PI / 2; ov.rotation.z = [0, -Math.PI / 2, Math.PI, Math.PI / 2][sideOf(i)];
        ov.position.set(c.x, this.Y + 0.003, c.y);
        this.tileLayer.add(ov);
      }
      if (tl.houses > 0) this.placeHouses(i, tl.houses, false);
    });
  }

  placeHouses(i, n, animate) {
    const c = tileCenter(i), nn = inward(i), a = along(i);
    const band = CORNER / 2 - CORNER * 0.11;
    const base = V3(c.x + nn.x * band, this.Y, c.y + nn.y * band);
    const meshes = [];
    if (n === 5) {
      const ht = new THREE.Mesh(this.hotelGeo, std('#e0303a'));
      ht.rotation.y = this.facing(i);
      ht.position.copy(base).add(V3(0, 0.015, 0));
      meshes.push(ht);
    } else {
      for (let k = 0; k < n; k++) {
        const off = (k - (n - 1) / 2) * 0.03;
        const g = new THREE.Group();
        const body = new THREE.Mesh(this.houseGeo, std('#2fb35a')); body.position.y = 0.011;
        const roof = new THREE.Mesh(this.roofGeo, std('#1f8a40')); roof.position.y = 0.031;
        g.add(body, roof);
        g.position.set(base.x + a.x * off, this.Y, base.z + a.y * off);
        g.rotation.y = this.facing(i);
        meshes.push(g);
      }
    }
    for (const m of meshes) {
      m.traverse((o) => { o.castShadow = true; });
      m.userData.tile = i;
      this.tileLayer.add(m);
      if (animate) {
        const y0 = m.position.y;
        m.position.y = y0 + 0.35;
        tweens.run(0.45, (e) => { m.position.y = y0 + (1 - e) * 0.35; }, Ease.outBounce);
      }
    }
  }

  renderCash(s) {
    s.players.forEach((p, i) => {
      if (this.cashPiles[i]) { this.group.remove(this.cashPiles[i]); this.cashPiles[i].dispose(); }
      const n = p.out ? 0 : Math.max(0, Math.min(40, Math.round(p.cash / 75)));
      const im = new THREE.InstancedMesh(this.billGeo, this.billMat, Math.max(1, n));
      im.count = n;
      const base = this.seatEdge(i);
      const ang = this.ctx.seats[i].angle;
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
      for (let k = 0; k < n; k++) {
        const stack = k % 2, lvl = Math.floor(k / 2);
        const side = V3(Math.cos(ang), 0, -Math.sin(ang)).multiplyScalar(stack ? 0.08 : -0.08);
        q.setFromEuler(new THREE.Euler(0, ang + ((k * 37) % 9 - 4) * 0.02, 0));
        m4.compose(base.clone().add(side).add(V3(0, 0.003 + lvl * 0.0055, 0)), q, V3(1, 1, 1));
        im.setMatrixAt(k, m4);
      }
      im.castShadow = true;
      im.instanceMatrix.needsUpdate = true;
      this.group.add(im);
      this.cashPiles[i] = im;
    });
  }

  // ---------- animation ----------
  name(i) { return this.ctx.seats[i]?.name || ''; }
  tname(i) { return tileName(this.s.board, i, L()); }
  async hop(seat, from, to) {
    const tk = this.tokens[seat];
    let k = from;
    const steps = (to - from + 40) % 40;
    const dur = steps > 7 ? 0.13 : 0.17;
    while (k !== to) {
      const nk = (k + 1) % 40;
      tk.rotation.y = this.facing(k);
      sfx('step');
      await arcMove(tk, this.tokenSpot(nk, seat), { height: 0.07, dur });
      k = nk;
    }
    tk.rotation.y = this.facing(to);
  }
  async flyCoins(from, to, amount) {
    const A = from >= 0 ? this.seatEdge(from) : V3(0, this.Y, 0);
    const B = to >= 0 ? this.seatEdge(to) : V3(0, this.Y, 0);
    const n = Math.min(8, 2 + Math.floor(amount / 100));
    const coins = [];
    for (let k = 0; k < n; k++) {
      const c = new THREE.Mesh(this.coinGeo, this.coinMat);
      c.position.copy(A); c.castShadow = true;
      this.group.add(c); coins.push(c);
    }
    if (from >= 0) this.ctx.labels.float(this.world(A).add(V3(0, 0.15, 0)), '−' + money(amount), 'bad');
    sfx('coins');
    await Promise.all(coins.map((c, k) => wait(k * 0.05).then(() => tweens.run(0.55, (e) => {
      c.position.lerpVectors(A, B, e); c.position.y = this.Y + Math.sin(e * Math.PI) * 0.25 + 0.01; c.rotation.x = e * 8;
    }, Ease.inOut)).then(() => c.removeFromParent())));
    if (to >= 0) this.ctx.labels.float(this.world(B).add(V3(0, 0.15, 0)), '+' + money(amount), 'good');
    sfx('coin');
  }
  async showCard(ev) {
    const card = (ev.deck === 'event' ? EVENT_CARDS : FUND_CARDS)[ev.id];
    const text = this.cardText(card);
    const deck = this.decks[ev.deck];
    const back = new THREE.MeshStandardMaterial({ map: cardBackTexture(ev.deck, this.th) });
    const face = new THREE.MeshStandardMaterial({ map: cardFaceTexture(ev.deck, text) });
    const edge = std('#f8f4ec');
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.003, 0.24), [edge, edge, back, face, edge, edge]);
    m.position.copy(deck.position).add(V3(0, 0.02, 0));
    m.rotation.y = deck.rotation.y;
    this.group.add(m);
    sfx('card');
    this.ctx.hud.banner('🃏 ' + text, 3200);
    // lift toward the viewer and flip face-up
    const viewer = this.ctx.seats[this.ctx.me].angle;
    const target = V3(Math.sin(viewer) * 0.25, this.Y + 0.35, Math.cos(viewer) * 0.25);
    const from = m.position.clone();
    await tweens.run(0.7, (e) => {
      m.position.lerpVectors(from, target, e);
      m.rotation.set(-Math.PI * e * 0.75, viewer * e + deck.rotation.y * (1 - e), 0, 'YXZ');
    }, Ease.inOut);
    await wait(1.7);
    await tweens.run(0.4, (e) => { m.position.lerpVectors(target, from, e); m.scale.setScalar(1 - e * 0.5); }, Ease.in);
    m.removeFromParent();
    m.geometry.dispose(); face.map.dispose(); face.dispose(); back.dispose();
  }
  cardText(card) {
    let s = card[L()] || card.en;
    return s.replace(/\{(\d+)\}/g, (_, i) => this.tname(+i));
  }

  async animate(prev, a, next, seat) {
    const s0 = prev;
    this.s = next;
    const hud = this.ctx.hud;
    for (const ev of next.ev) {
      switch (ev.t) {
        case 'roll': {
          const from = this.seatEdge(ev.seat);
          await this.ctx.reach(ev.seat, this.world(from));
          const rest = [V3(-0.08, this.Y + 0.0375, 0.12), V3(0.06, this.Y + 0.0375, 0.18)];
          await rollDice(this.dice, ev.dice, from, rest);
          if (ev.doubles) { hud.banner('🎲 ' + t('tyc.b.doubles'), 1200); this.ctx.react(ev.seat, 'lucky', { magnitude: 0.4 }); }
          break;
        }
        case 'move': {
          const tk = this.tokens[ev.seat];
          this.ctx.seats[ev.seat].character.lookAt(this.world(tk.position));
          if (ev.direct) { sfx('whoosh'); await arcMove(tk, this.tokenSpot(ev.to, ev.seat), { height: 0.3, dur: 0.6 }); }
          else await this.hop(ev.seat, ev.from, ev.to);
          sfx('piece');
          this.ctx.lookAll(this.world(tk.position));
          setTimeout(() => this.ctx.lookReset(), 1200);
          break;
        }
        case 'pay': {
          const big = ev.amount >= 150;
          if (ev.reason === 'rent') { hud.banner(t('tyc.b.rent', { who: this.name(ev.from), n: fmt(ev.amount) }) + ' → ' + this.name(ev.to), 1800); this.ctx.react(ev.from, big ? 'ouch' : 'unlucky', { magnitude: Math.min(1, ev.amount / 600), target: ev.to }); if (big) setTimeout(() => this.ctx.react(ev.to, 'good', { magnitude: 0.4 }), 600); }
          else if (ev.reason === 'salary') hud.banner(t('tyc.b.salary', { who: this.name(ev.to), n: fmt(ev.amount) }), 1300);
          else if (ev.reason === 'jackpot') { hud.banner(t('tyc.b.jackpot', { who: this.name(ev.to), n: fmt(ev.amount) }), 2000); this.ctx.react(ev.to, 'lucky', { magnitude: 0.9 }); }
          else if (ev.reason === 'tax' || ev.reason === 'jail' || ev.reason === 'repairs') hud.banner(t('tyc.b.tax', { who: this.name(ev.from), n: fmt(ev.amount) }), 1500);
          await this.flyCoins(ev.from, ev.to, ev.amount);
          this.renderCash(next);
          break;
        }
        case 'buy': {
          sfx('buy');
          hud.banner(t('tyc.b.bought', { who: this.name(ev.seat), name: this.tname(ev.tile) }), 1700);
          await this.flyCoins(ev.seat, -1, ev.amount);
          this.renderTiles(next);
          this.ctx.particles.burst(this.world(V3(tileCenter(ev.tile).x, this.Y + 0.02, tileCenter(ev.tile).y)), { count: 26, up: 1.5, speed: 0.6, colors: [this.ctx.seats[ev.seat].color, '#ffffff'] });
          const g = groupOf(ev.tile);
          this.ctx.react(ev.seat, rules.ownsGroup(next, ev.seat, ev.tile) && TILES[ev.tile].type === 'street' ? 'lucky' : 'good', { magnitude: rules.ownsGroup(next, ev.seat, ev.tile) ? 0.9 : 0.25 });
          break;
        }
        case 'card': await this.showCard(ev); break;
        case 'jail': {
          hud.banner('🚔 ' + t('tyc.b.jail', { who: this.name(ev.seat) }), 1800);
          sfx('bad');
          await arcMove(this.tokens[ev.seat], this.tokenSpot(10, ev.seat, true), { height: 0.35, dur: 0.7 });
          this.ctx.react(ev.seat, 'unlucky', { magnitude: 0.8 });
          break;
        }
        case 'jailFree':
          hud.banner('🔓 ' + t('tyc.b.free', { who: this.name(ev.seat) }), 1300);
          await arcMove(this.tokens[ev.seat], this.tokenSpot(10, ev.seat, false), { height: 0.1, dur: 0.35 });
          break;
        case 'build':
          sfx('build');
          await this.ctx.reach(ev.seat, this.world(V3(tileCenter(ev.tile).x, this.Y, tileCenter(ev.tile).y)));
          this.renderTiles(next);
          if (Math.random() < 0.4) this.ctx.react(ev.seat, 'good', { magnitude: 0.3 });
          await this.flyCoins(ev.seat, -1, TILES[ev.tile].house);
          break;
        case 'sell': case 'mortgage': case 'unmortgage':
          sfx(ev.t === 'unmortgage' ? 'pay' : 'coin');
          this.renderTiles(next); this.renderCash(next);
          if (ev.amount) this.ctx.labels.float(this.world(this.seatEdge(ev.seat)).add(V3(0, 0.15, 0)), (ev.t === 'unmortgage' ? '−' : '+') + money(ev.amount), ev.t === 'unmortgage' ? 'bad' : 'good');
          await wait(0.25);
          break;
        case 'auction': hud.banner('🔨 ' + t('tyc.b.auction', { name: this.tname(ev.tile) }), 1600); sfx('notify'); await wait(0.5); break;
        case 'bid':
          sfx('chip');
          this.ctx.labels.float(this.world(this.seatEdge(ev.seat)).add(V3(0, 0.2, 0)), money(ev.amount));
          if (Math.random() < 0.3) this.ctx.react(ev.seat, 'good', { magnitude: 0.2 });
          break;
        case 'passBid': this.ctx.labels.float(this.world(this.seatEdge(ev.seat)).add(V3(0, 0.2, 0)), t('tyc.pass'), 'bad'); break;
        case 'auctionWin':
          hud.banner(t('tyc.b.auctionWin', { who: this.name(ev.seat), name: this.tname(ev.tile), n: fmt(ev.amount) }), 1800);
          await this.flyCoins(ev.seat, -1, ev.amount);
          this.renderTiles(next);
          this.ctx.react(ev.seat, 'good', { magnitude: 0.5 });
          break;
        case 'auctionNone': hud.banner(t('tyc.b.auctionNone', { name: this.tname(ev.tile) }), 1500); break;
        case 'tradeOffer': hud.banner('🤝 ' + t('tyc.b.offer', { who: this.name(ev.from), to: this.name(ev.to) }), 1500); this.ctx.seats[ev.from].character.emote('point'); break;
        case 'tradeDone':
          sfx('special');
          hud.banner('🤝 ' + t('tyc.b.trade', { who: this.name(ev.from), to: this.name(ev.to) }), 2000);
          this.renderTiles(next); this.renderCash(next);
          this.ctx.seats[ev.from].character.emote('celebrate'); this.ctx.seats[ev.to].character.emote('nod');
          break;
        case 'tradeRejected': hud.banner(t('tyc.b.tradeNo', { to: this.name(ev.to) }), 1600); this.ctx.seats[ev.to].character.emote('shake'); break;
        case 'bankrupt':
          sfx('lose');
          hud.banner('💥 ' + t('tyc.b.bankrupt', { who: this.name(ev.seat) }), 2400);
          this.ctx.react(ev.seat, 'lose', { magnitude: 1 });
          await tweens.run(0.6, (e) => { this.tokens[ev.seat].scale.setScalar(0.085 * (1 - e)); });
          this.tokens[ev.seat].visible = false;
          this.renderTiles(next); this.renderCash(next);
          break;
        case 'debt': if (this.ctx.seats[ev.seat].isHuman) hud.banner(t('tyc.st.debt', { n: fmt(ev.amount) }), 2000); break;
        default: break;
      }
    }
    if (prev.round !== next.round && !next.winner) {
      const left = next.maxRounds - next.round;
      if (next.maxRounds < 150) hud.banner(left === 0 ? t('tyc.b.lastRound') : t('tyc.b.round', { n: next.round, max: next.maxRounds }), 1300);
    }
    this.sync(next);
  }

  // ---------- HUD helpers ----------
  propCard(i, s = this.s) {
    const tile = TILES[i];
    const tl = s.tiles[i];
    const color = tile.type === 'street' ? this.th.colors[tile.g] : tile.type === 'rail' ? '#3a3a4a' : '#5a6a7a';
    const rows = [];
    if (tile.type === 'street') {
      rows.push([t('tyc.c.rent'), money(tile.rent[0])], [t('tyc.c.set'), money(tile.rent[0] * 2)]);
      for (let k = 1; k <= 4; k++) rows.push([t('tyc.c.h', { n: k }), money(tile.rent[k])]);
      rows.push([t('tyc.c.hotel'), money(tile.rent[5])], [t('tyc.c.houseCost'), money(tile.house)]);
    } else if (tile.type === 'rail') for (let k = 1; k <= 4; k++) rows.push([t('tyc.c.rail', { n: k }), money(25 * 2 ** (k - 1))]);
    else if (tile.type === 'util') rows.push([t('tyc.c.util'), '']);
    if (isProperty(i)) rows.push([t('tyc.c.mortgage'), money(tile.price / 2)], [t('tyc.c.owner'), tl.owner >= 0 ? this.name(tl.owner) + (tl.mort ? ' · ' + t('tyc.m.mortgaged') : '') : t('tyc.c.bank')]);
    return h('div', { class: 'prop-card', style: { width: '230px', maxWidth: '80vw' } },
      h('div', { class: 'band', style: { background: color } }, this.tname(i), tile.price ? h('div', { style: { fontSize: '12px', opacity: '.9' } }, money(tile.price)) : null),
      h('table', null, ...rows.map(([a, b]) => h('tr', null, h('td', null, a), h('td', null, b)))));
  }
  showTile(i) {
    if (!isProperty(i)) { toast(this.tname(i)); return; }
    let m;
    m = modal(h('div', { class: 'col', style: { alignItems: 'center' } }, this.propCard(i)), { buttons: [btn(t('close'), () => closeModal(m), 'ghost')] });
  }
  onPlayerChip(seat) {
    const s = this.s;
    const owned = s.tiles.map((tl, i) => i).filter((i) => s.tiles[i].owner === seat);
    let m;
    m = modal(h('div', { class: 'col' }, h('div', { class: 'title center' }, this.name(seat)),
      h('div', { class: 'center gold' }, t('tyc.m.cash', { n: fmt(s.players[seat].cash), w: fmt(rules.netWorth(s, seat)) })),
      owned.length ? h('div', null, ...owned.map((i) => this.propRow(i, s))) : h('div', { class: 'muted center' }, t('tyc.m.none'))),
    { buttons: [btn(t('close'), () => closeModal(m), 'ghost')] });
  }
  propRow(i, s, controls = null) {
    const tile = TILES[i], tl = s.tiles[i];
    const color = tile.type === 'street' ? this.th.colors[tile.g] : '#556';
    const hs = tl.houses === 5 ? '🏨' : '🏠'.repeat(tl.houses);
    return h('div', { class: 'list-item' }, h('div', { class: 'sq', style: { background: color } }),
      h('div', { class: 'grow' }, h('div', null, this.tname(i)), h('div', { class: 'mini' }, (tl.mort ? '⛓ ' + t('tyc.m.mortgaged') + ' ' : '') + hs)), controls);
  }

  manageModal(s, seat, done) {
    const owned = s.tiles.map((tl, i) => i).filter((i) => s.tiles[i].owner === seat);
    let m;
    const act = (a) => { this.manageOpen = true; closeModal(m); done(a); };
    const rows = owned.map((i) => {
      const ctr = h('div', { class: 'row', style: { gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' } });
      const mk = (label, a, ok, cls = 'small') => { const b = btn(label, () => act(a), cls); if (!ok) b.disabled = true; ctr.appendChild(b); };
      if (TILES[i].type === 'street') {
        mk(t('tyc.m.build', { n: TILES[i].house }), { t: 'build', tile: i }, rules.validate(s, { t: 'build', tile: i }, seat), 'small good');
        if (s.tiles[i].houses) mk(t('tyc.m.sell', { n: TILES[i].house / 2 }), { t: 'sell', tile: i }, rules.validate(s, { t: 'sell', tile: i }, seat));
      }
      if (s.tiles[i].mort) mk(t('tyc.m.unmort', { n: rules.unmortgageCost(i) }), { t: 'unmortgage', tile: i }, rules.validate(s, { t: 'unmortgage', tile: i }, seat));
      else mk(t('tyc.m.mort', { n: TILES[i].price / 2 }), { t: 'mortgage', tile: i }, rules.validate(s, { t: 'mortgage', tile: i }, seat), 'small ghost');
      return this.propRow(i, s, ctr);
    });
    m = modal(h('div', { class: 'col' }, h('div', { class: 'title center' }, t('tyc.m.title')),
      h('div', { class: 'center gold' }, t('tyc.m.cash', { n: fmt(s.players[seat].cash), w: fmt(rules.netWorth(s, seat)) })),
      rows.length ? h('div', null, ...rows) : h('div', { class: 'muted center' }, t('tyc.m.none'))),
    { buttons: [btn(t('close'), () => { this.manageOpen = false; closeModal(m); }, 'ghost')], onClose: () => { this.manageOpen = false; } });
  }

  tradeModal(s, seat, done) {
    const others = s.players.map((p, i) => i).filter((i) => i !== seat && !s.players[i].out);
    let to = others[0];
    const give = new Set(), get = new Set();
    let giveCash = 0, getCash = 0;
    let m;
    const body = h('div', { class: 'col' });
    const tradeable = (who) => s.tiles.map((tl, i) => i).filter((i) => isProperty(i) && s.tiles[i].owner === who && groupOf(i).every((k) => TILES[i].type !== 'street' || s.tiles[k].houses === 0));
    const list = (who, set) => h('div', null, ...tradeable(who).map((i) => {
      const row = this.propRow(i, s);
      if (set.has(i)) row.classList.add('sel');
      row.addEventListener('click', () => { sfx('click'); if (set.has(i)) set.delete(i); else set.add(i); render(); });
      return row;
    }));
    const slider = (max, val, on) => {
      const r = h('input', { type: 'range', min: 0, max: Math.max(0, Math.floor(max / 10) * 10), step: 10, value: val });
      const lab = h('span', { class: 'gold' }, money(val));
      r.addEventListener('input', () => { on(+r.value); lab.textContent = money(+r.value); });
      return h('div', { class: 'row' }, h('span', { class: 'mini' }, t('tyc.t.cash')), r, lab);
    };
    const render = () => {
      body.innerHTML = '';
      const chips = h('div', { class: 'opts' }, ...others.map((i) => {
        const c = h('div', { class: 'opt' + (i === to ? ' sel' : '') }, this.name(i));
        c.addEventListener('click', () => { to = i; get.clear(); getCash = 0; render(); });
        return c;
      }));
      body.append(h('div', { class: 'title center' }, t('tyc.t.title')), h('div', { class: 'section-t' }, t('tyc.t.with')), chips,
        h('div', { class: 'section-t' }, t('tyc.t.give')), list(seat, give), slider(s.players[seat].cash, giveCash, (v) => { giveCash = v; }),
        h('div', { class: 'section-t' }, t('tyc.t.get')), list(to, get), slider(s.players[to].cash, getCash, (v) => { getCash = v; }));
    };
    render();
    m = modal(body, {
      buttons: [btn(t('cancel'), () => closeModal(m), 'ghost'), btn(t('tyc.t.send'), () => {
        const a = { t: 'trade', to, give: { tiles: [...give], cash: giveCash }, get: { tiles: [...get], cash: getCash } };
        if (!rules.validate(s, a, seat)) { sfx('error'); return; }
        closeModal(m); done(a);
      }, 'primary')],
    });
  }

  offerModal(s, seat, done) {
    const tr = s.trade;
    const desc = (tiles, cash) => [...tiles.map((i) => this.propRow(i, s)), cash ? h('div', { class: 'list-item gold' }, '💵 ' + money(cash)) : null, !tiles.length && !cash ? h('div', { class: 'muted' }, t('tyc.t.nothing')) : null];
    let m;
    const finish = (a) => { closeModal(m); done(a); };
    m = modal(h('div', { class: 'col' }, h('div', { class: 'title center' }, t('tyc.t.offer', { who: this.name(tr.from) })),
      h('div', { class: 'section-t' }, t('tyc.t.theyGive', { who: this.name(tr.from) })), ...desc(tr.give.tiles, tr.give.cash),
      h('div', { class: 'section-t' }, t('tyc.t.youGive')), ...desc(tr.get.tiles, tr.get.cash)),
    { buttons: [btn(t('tyc.t.decline'), () => finish({ t: 'tradeReject' }), 'ghost'), btn(t('tyc.t.accept'), () => finish({ t: 'tradeAccept' }), 'good')], dismissible: false });
    this.ctx.seats[tr.from].character.emote('point');
  }

  async human(s, seat) {
    const a = await this.ask((done) => {
      const hud = this.ctx.hud;
      const p = s.players[seat];
      const can = (a) => rules.validate(s, a, seat);
      const manage = { label: t('tyc.manage'), onClick: () => this.manageModal(s, seat, done), cls: 'ghost' };
      const trade = { label: t('tyc.trade'), onClick: () => this.tradeModal(s, seat, done), cls: 'ghost', disabled: s.tradesThisTurn >= 3 };
      if (this.manageOpen && ['roll', 'end', 'buy', 'debt'].includes(s.phase)) setTimeout(() => this.manageModal(s, seat, done), 50);
      switch (s.phase) {
        case 'roll':
          if (p.jail) {
            hud.status(t('tyc.st.jail', { n: p.jailTurns + 1 }), true);
            hud.actions([{ label: t('tyc.rollJail'), onClick: () => done({ t: 'roll' }), cls: 'primary' },
              { label: t('tyc.payJail', { n: rules.JAIL_FINE }), onClick: () => done({ t: 'payJail' }), disabled: !can({ t: 'payJail' }) },
              p.jailCards ? { label: t('tyc.useCard'), onClick: () => done({ t: 'useCard' }) } : null, manage]);
          } else {
            hud.status(t('tyc.st.roll'), true);
            hud.actions([{ label: t('tyc.roll'), onClick: () => done({ t: 'roll' }), cls: 'primary' }, manage, trade]);
          }
          break;
        case 'end':
          hud.status(t('tyc.st.end'), true);
          hud.actions([manage, trade, { label: t('tyc.end'), onClick: () => done({ t: 'end' }), cls: 'primary' }]);
          break;
        case 'buy': {
          const i = p.pos;
          hud.status(t('tyc.st.buy', { name: this.tname(i) }), true);
          hud.setExtra(this.propCard(i, s));
          hud.actions([{ label: t('tyc.buy', { n: TILES[i].price }), onClick: () => done({ t: 'buy' }), cls: 'primary', disabled: !can({ t: 'buy' }) },
            { label: t('tyc.auction'), onClick: () => done({ t: 'decline' }) }, manage]);
          break;
        }
        case 'auction': {
          const au = s.auction;
          hud.status(t('tyc.st.auction', { n: fmt(au.bid) }) + (au.bidder >= 0 ? ' · ' + this.name(au.bidder) : ''), true);
          hud.setExtra(this.propCard(au.tile, s));
          hud.actions([10, 50, 100].map((inc) => {
            const amt = Math.max(10, au.bid + inc);
            return { label: t('tyc.bid', { n: inc }) + ' → ' + money(amt), onClick: () => done({ t: 'bid', amount: amt }), cls: inc === 10 ? 'primary' : '', disabled: !can({ t: 'bid', amount: amt }) };
          }).concat([{ label: t('tyc.pass'), onClick: () => done({ t: 'pass' }), cls: 'ghost' }]));
          break;
        }
        case 'debt': {
          const liq = rules.liquidity(s, seat);
          hud.status(liq >= s.debt.amount ? t('tyc.st.debt', { n: fmt(s.debt.amount) }) : t('tyc.st.cantPay'), true);
          hud.actions([manage, { label: t('tyc.bankrupt'), onClick: () => done({ t: 'bankrupt' }), cls: 'danger', disabled: liq >= s.debt.amount }]);
          if (liq >= s.debt.amount && !this.manageOpen) setTimeout(() => this.manageModal(s, seat, done), 300);
          break;
        }
        case 'trade': this.offerModal(s, seat, done); break;
        default: done({ t: 'end' });
      }
    });
    this.tapHandler = this.boardTap;
    return a;
  }
  cancelHuman() { super.cancelHuman(); this.tapHandler = this.boardTap; }

  update(dt, tt) {
    const s = this.s;
    if (!s || s.winner !== null) return;
    const cur = rules.actor(s);
    this.tokens.forEach((tk, i) => {
      if (!tk.visible) return;
      const glow = i === cur ? Math.abs(Math.sin(tt * 4)) * 0.012 : 0;
      tk.position.y = this.Y + glow;
    });
  }
  playerStat(s, i) { return s.players[i].out ? '—' : money(s.players[i].cash); }
  isOut(s, i) { return s.players[i].out; }
  dispose() { this.billGeo.dispose(); this.houseGeo.dispose(); this.roofGeo.dispose(); this.hotelGeo.dispose(); this.markerGeo.dispose(); this.coinGeo.dispose(); super.dispose(); }
}

export default {
  id: 'tycoon', category: 'board', icon: '🏙️', minPlayers: 2, maxPlayers: 5, defaultPlayers: 4, quickPlayers: 4,
  colors: ['#2f8a5a', '#0b2a1a'], rules, ai, View, undo: false,
  quickBots: (s) => ['auction', 'end', 'debt'].includes(s.phase),
  options: [
    { key: 'board', labelKey: 'tyc.board', default: 'classic', collection: 'boards', values: BOARD_IDS.map((b) => ({ value: b, key: 'item.boards.' + b })) },
    { key: 'token', labelKey: 'tyc.token', default: 'car', collection: 'tokens', values: TOKEN_IDS.map((b) => ({ value: b, key: 'item.tokens.' + b })) },
    { key: 'variant', labelKey: 'tyc.variant', default: 'classic', values: ['classic', 'jackpot', 'speed'].map((v) => ({ value: v, key: 'tyc.v.' + v })) },
    { key: 'duration', labelKey: 'tyc.duration', default: 'medium', values: ['short', 'medium', 'full'].map((v) => ({ value: v, key: 'tyc.d.' + v })) },
  ],
  rulesText: {
    en: `Goal: be the last player standing (or the richest when the round limit ends the match).
• Roll two dice and move clockwise. Passing START pays $200.
• Land on a free property: buy it, or it goes to auction where everyone can bid.
• Land on someone's property: pay rent. Owning a full color set doubles base rent and lets you build.
• Houses must be built evenly; 5th level is a hotel. Mortgage property for half its price, redeem for 110%.
• Doubles let you roll again; three doubles in a row send you to jail. Leave jail by paying $50, using a pass, or rolling doubles (3 tries).
• Event and Fund cards bring surprises. Taxes go to the bank (or to the rest-stop jackpot in the Jackpot rule set).
• Trade properties and cash with other players at any time on your turn.
• If you can't pay, sell houses and mortgage; if it's still not enough you go bankrupt.
Rule sets: Classic · Jackpot (fees collect on the REST tile) · Speed start (2 random streets each, bonus on START).`,
    ru: `Цель: остаться последним игроком (или быть богаче всех, когда закончится лимит кругов).
• Бросайте два кубика и двигайтесь по часовой стрелке. Проход через СТАРТ даёт $200.
• Свободный участок можно купить, иначе он уходит на аукцион для всех игроков.
• На чужом участке платите аренду. Полный цветовой набор удваивает базовую аренду и позволяет строить.
• Дома строятся равномерно; пятый уровень — отель. Залог даёт половину цены, выкуп — 110%.
• Дубль даёт повторный бросок; три дубля подряд — тюрьма. Выйти: заплатить $50, использовать пропуск или выбросить дубль (3 попытки).
• Карточки «Событие» и «Фонд» приносят сюрпризы. Налоги идут в банк (или в джекпот на клетке ОТДЫХ в режиме «Джекпот»).
• В свой ход можно обмениваться участками и деньгами с другими игроками.
• Если не можете заплатить — продавайте дома и закладывайте участки; если не хватает — банкротство.
Наборы правил: Классика · Джекпот · Быстрый старт (по 2 случайные улицы, бонус на СТАРТЕ).`,
  },
  thumb(g, w, h) {
    g.fillStyle = '#dff0e2'; g.fillRect(60, 30, 200, 180);
    const cols = ['#8a5a34', '#9ad6f0', '#d65aa8', '#f08a2a', '#e03a3a', '#f2d23a', '#2fa35a', '#2a4ab8'];
    for (let i = 0; i < 8; i++) { g.fillStyle = cols[i]; g.fillRect(60 + i * 25, 30, 25, 18); g.fillRect(60 + i * 25, 192, 25, 18); }
    g.fillStyle = '#c0392b'; g.font = '900 34px sans-serif'; g.textAlign = 'center'; g.fillText('TYCOON', 160, 130);
    g.fillStyle = '#2fb35a'; for (let i = 0; i < 3; i++) { g.fillRect(100 + i * 22, 60, 14, 12); g.beginPath(); g.moveTo(98 + i * 22, 60); g.lineTo(107 + i * 22, 52); g.lineTo(116 + i * 22, 60); g.fill(); }
    g.fillStyle = '#e0303a'; g.fillRect(200, 150, 30, 18);
  },
};

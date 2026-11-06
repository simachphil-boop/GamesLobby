// TYCOON rules — a property-trading board game (Monopoly-style mechanics, original content).
// Pure & deterministic: apply() returns a new state; dice/cards come from the seeded RNG in state.
import { TILES, GROUPS, RAILS, UTILS, isProperty, groupOf, EVENT_CARDS, FUND_CARDS } from './boards.js';
import { nextRand, shuffleSeeded } from '../../core/rng.js';
import { clone } from '../../core/util.js';

export const START_CASH = 1500;
export const SALARY = 200;
export const JAIL_FINE = 50;
const ROUND_LIMIT = { short: 20, medium: 40, full: 150 };

export function setup(opts = {}, n = 4, seed = 1) {
  const s = {
    n, seed, board: opts.board || 'classic', variant: opts.variant || 'classic',
    maxRounds: ROUND_LIMIT[opts.duration || 'medium'] || 40,
    players: Array.from({ length: n }, () => ({ cash: START_CASH, pos: 0, jail: false, jailTurns: 0, jailCards: 0, out: false, doubles: 0 })),
    tiles: TILES.map(() => ({ owner: -1, houses: 0, mort: false })),
    cur: 0, phase: 'roll', dice: [1, 1], round: 1, pot: 0, houses: 32, hotels: 12,
    decks: { event: [], fund: [] }, auction: null, trade: null, debt: null, card: null, tradesThisTurn: 0,
    ev: [], log: [], winner: null,
  };
  s.decks.event = shuffleSeeded(s, EVENT_CARDS.map((_, i) => i));
  s.decks.fund = shuffleSeeded(s, FUND_CARDS.map((_, i) => i));
  if (s.variant === 'speed') {
    // Speed start: everyone gets two random streets
    const free = shuffleSeeded(s, TILES.map((t, i) => i).filter((i) => TILES[i].type === 'street'));
    for (let p = 0; p < n; p++) for (let k = 0; k < 2; k++) s.tiles[free.pop()].owner = p;
  }
  return s;
}

// ---------- helpers ----------
const alive = (s) => s.players.map((p, i) => i).filter((i) => !s.players[i].out);
export const ownsGroup = (s, seat, i) => { const g = groupOf(i); return !!g && g.every((k) => s.tiles[k].owner === seat); };
export function netWorth(s, seat) {
  const p = s.players[seat];
  let w = p.cash;
  s.tiles.forEach((t, i) => {
    if (t.owner !== seat) return;
    w += t.mort ? TILES[i].price / 2 : TILES[i].price;
    if (t.houses) w += t.houses * TILES[i].house;
  });
  return w;
}
export function rentFor(s, i, diceSum, mult = 1) {
  const t = s.tiles[i];
  const tile = TILES[i];
  if (t.owner < 0 || t.mort) return 0;
  if (tile.type === 'street') {
    if (t.houses > 0) return tile.rent[t.houses];
    return tile.rent[0] * (ownsGroup(s, t.owner, i) ? 2 : 1);
  }
  if (tile.type === 'rail') {
    const n = RAILS.filter((k) => s.tiles[k].owner === t.owner).length;
    return 25 * Math.pow(2, n - 1) * mult;
  }
  if (tile.type === 'util') {
    const n = UTILS.filter((k) => s.tiles[k].owner === t.owner).length;
    return diceSum * (mult > 1 ? 10 : n === 2 ? 10 : 4);
  }
  return 0;
}
export function canBuild(s, seat, i) {
  const tile = TILES[i], t = s.tiles[i];
  if (tile.type !== 'street' || t.owner !== seat || t.houses >= 5) return false;
  const g = GROUPS[tile.g];
  if (!g.every((k) => s.tiles[k].owner === seat && !s.tiles[k].mort)) return false;
  const min = Math.min(...g.map((k) => s.tiles[k].houses));
  if (t.houses > min) return false;
  if (s.players[seat].cash < tile.house) return false;
  if (t.houses === 4) return s.hotels > 0;
  return s.houses > 0;
}
export function canSell(s, seat, i) {
  const tile = TILES[i], t = s.tiles[i];
  if (tile.type !== 'street' || t.owner !== seat || t.houses === 0) return false;
  const max = Math.max(...GROUPS[tile.g].map((k) => s.tiles[k].houses));
  return t.houses === max;
}
export function canMortgage(s, seat, i) {
  const t = s.tiles[i];
  if (!isProperty(i) || t.owner !== seat || t.mort) return false;
  const g = groupOf(i);
  return TILES[i].type !== 'street' || g.every((k) => s.tiles[k].houses === 0);
}
export const unmortgageCost = (i) => Math.ceil(TILES[i].price * 0.55);
export function canUnmortgage(s, seat, i) {
  const t = s.tiles[i];
  return isProperty(i) && t.owner === seat && t.mort && s.players[seat].cash >= unmortgageCost(i);
}
/** Max cash a player could raise by selling all houses and mortgaging everything. */
export function liquidity(s, seat) {
  let v = s.players[seat].cash;
  s.tiles.forEach((t, i) => {
    if (t.owner !== seat) return;
    v += (t.houses * TILES[i].house) / 2;
    if (!t.mort) v += TILES[i].price / 2;
  });
  return v;
}
const tradeable = (s, seat, i) => isProperty(i) && s.tiles[i].owner === seat && (TILES[i].type !== 'street' || GROUPS[TILES[i].g].every((k) => s.tiles[k].houses === 0));

export function actor(s) {
  if (s.phase === 'auction') return s.auction.active[s.auction.idx];
  if (s.phase === 'trade') return s.trade.to;
  if (s.phase === 'debt') return s.debt.seat;
  return s.cur;
}
export const isOver = (s) => s.winner !== null;

// ---------- money ----------
function credit(s, seat, amount, reason) { s.players[seat].cash += amount; s.ev.push({ t: 'pay', from: -1, to: seat, amount, reason }); }
/** Charge `amount` from seat to `to` (-1 bank, -2 jackpot pot). If short, enter debt. */
function charge(s, seat, to, amount, reason, after) {
  const p = s.players[seat];
  if (p.cash >= amount) {
    p.cash -= amount;
    if (to >= 0) s.players[to].cash += amount;
    if (to === -2) s.pot += amount;
    s.ev.push({ t: 'pay', from: seat, to, amount, reason });
    return true;
  }
  s.debt = { seat, to, amount, reason, after };
  s.phase = 'debt';
  s.ev.push({ t: 'debt', seat, amount });
  return false;
}
function settleDebtIfPossible(s) {
  const d = s.debt;
  if (!d || s.players[d.seat].cash < d.amount) return;
  s.debt = null;
  s.phase = 'end';
  const p = s.players[d.seat];
  if (d.to === -3) {
    for (const o of alive(s)) {
      if (o === d.seat) continue;
      p.cash -= d.each; s.players[o].cash += d.each;
      s.ev.push({ t: 'pay', from: d.seat, to: o, amount: d.each, reason: d.reason });
    }
  } else charge(s, d.seat, d.to, d.amount, d.reason);
  if (d.after === 'jailMove') { moveTo(s, d.seat, (p.pos + d.dice) % 40); land(s, d.seat, d.dice); }
  finishTurnStep(s);
}

// ---------- movement ----------
function moveTo(s, seat, to, { collectGo = true, direct = false } = {}) {
  const p = s.players[seat];
  const from = p.pos;
  p.pos = to;
  s.ev.push({ t: 'move', seat, from, to, direct });
  if (collectGo && to < from) credit(s, seat, SALARY, 'salary'); // passed (or landed on) START
}
function sendToJail(s, seat) {
  const p = s.players[seat];
  p.pos = 10; p.jail = true; p.jailTurns = 0; p.doubles = 0;
  s.ev.push({ t: 'jail', seat });
}

function drawCard(s, deck) {
  const d = s.decks[deck];
  const id = d.shift();
  const card = (deck === 'event' ? EVENT_CARDS : FUND_CARDS)[id];
  if (card.k === 'jailCard') { s.jailCardsOut = s.jailCardsOut || { event: [], fund: [] }; s.jailCardsOut[deck].push(id); } else d.push(id);
  s.card = { deck, id };
  s.ev.push({ t: 'card', deck, id, seat: s.cur });
  return card;
}

function land(s, seat, diceSum, mult = 1) {
  const p = s.players[seat];
  const i = p.pos;
  const tile = TILES[i];
  switch (tile.type) {
    case 'gotojail': sendToJail(s, seat); return;
    case 'tax': charge(s, seat, s.variant === 'jackpot' ? -2 : -1, tile.amount, 'tax', 'land'); return;
    case 'parking':
      if (s.variant === 'jackpot' && s.pot > 0) { credit(s, seat, s.pot, 'jackpot'); s.pot = 0; }
      return;
    case 'go':
      if (s.variant === 'speed') credit(s, seat, SALARY, 'bonus');
      return;
    case 'event': case 'fund': {
      const card = drawCard(s, tile.type);
      applyCard(s, seat, card, diceSum);
      return;
    }
    case 'street': case 'rail': case 'util': {
      const t = s.tiles[i];
      if (t.owner === -1) { s.phase = 'buy'; return; }
      if (t.owner === seat || t.mort) return;
      if (s.players[t.owner].out) return;
      const rent = rentFor(s, i, diceSum, mult);
      if (rent > 0) charge(s, seat, t.owner, rent, 'rent', 'land');
      return;
    }
    default: return;
  }
}

function applyCard(s, seat, c, diceSum) {
  const p = s.players[seat];
  switch (c.k) {
    case 'move': moveTo(s, seat, c.to); land(s, seat, diceSum); break;
    case 'moveRel': { const to = (p.pos + c.n + 40) % 40; moveTo(s, seat, to, { collectGo: false, direct: true }); land(s, seat, diceSum); break; }
    case 'nearest': {
      const list = c.what === 'rail' ? RAILS : UTILS;
      let to = list.find((k) => k > p.pos);
      if (to === undefined) to = list[0];
      moveTo(s, seat, to);
      if (s.tiles[to].owner >= 0 && s.tiles[to].owner !== seat) {
        // utility rent uses a fresh roll
        let sum = diceSum;
        if (c.what === 'util') { const a = 1 + Math.floor(nextRand(s) * 6), b = 1 + Math.floor(nextRand(s) * 6); sum = a + b; s.ev.push({ t: 'roll', dice: [a, b], seat, extra: true }); }
        land(s, seat, sum, 2);
      } else land(s, seat, diceSum);
      break;
    }
    case 'money':
      if (c.v >= 0) credit(s, seat, c.v, 'card');
      else charge(s, seat, s.variant === 'jackpot' ? -2 : -1, -c.v, 'card', 'land');
      break;
    case 'jail': sendToJail(s, seat); break;
    case 'jailCard': p.jailCards++; break;
    case 'repairs': {
      let cost = 0;
      s.tiles.forEach((t) => { if (t.owner === seat) cost += t.houses === 5 ? c.H : t.houses * c.h; });
      if (cost > 0) charge(s, seat, -1, cost, 'repairs', 'land');
      break;
    }
    case 'payEach': {
      const others = alive(s).filter((k) => k !== seat);
      const total = c.v * others.length;
      if (p.cash >= total) { for (const o of others) charge(s, seat, o, c.v, 'card'); }
      else { s.debt = { seat, to: -3, amount: total, reason: 'card', each: c.v, after: 'land' }; s.phase = 'debt'; s.ev.push({ t: 'debt', seat, amount: total }); }
      break;
    }
    case 'collectEach':
      for (const o of alive(s)) {
        if (o === seat) continue;
        const amt = Math.min(c.v, s.players[o].cash);
        s.players[o].cash -= amt; p.cash += amt;
        if (amt) s.ev.push({ t: 'pay', from: o, to: seat, amount: amt, reason: 'gift' });
      }
      break;
    default: break;
  }
}

/** After resolving a landing: decide whether the player rolls again or ends. */
function finishTurnStep(s) {
  if (s.phase === 'debt' || s.phase === 'buy' || s.phase === 'auction' || s.winner !== null) return;
  const p = s.players[s.cur];
  if (p.out) { nextTurn(s); return; }
  s.phase = (s.lastDoubles && !p.jail) ? 'roll' : 'end';
}

function nextTurn(s) {
  const al = alive(s);
  if (al.length <= 1) { finish(s); return; }
  let i = s.cur;
  do { i = (i + 1) % s.n; } while (s.players[i].out);
  if (i <= s.cur) s.round++;
  s.cur = i;
  s.phase = 'roll';
  s.lastDoubles = false;
  s.players[i].doubles = 0;
  s.tradesThisTurn = 0;
  s.card = null;
  if (s.round > s.maxRounds) finish(s);
}

function finish(s) {
  const al = alive(s);
  const ranking = [...al].sort((a, b) => netWorth(s, b) - netWorth(s, a));
  s.winner = ranking[0];
  s.ranking = [...ranking, ...(s.outOrder || []).slice().reverse()];
  s.phase = 'over';
  s.ev.push({ t: 'over', winner: s.winner });
}

function bankrupt(s, seat) {
  const d = s.debt;
  const to = d ? d.to : -1;
  const p = s.players[seat];
  s.ev.push({ t: 'bankrupt', seat, to });
  // liquidate houses at half price
  s.tiles.forEach((t, i) => {
    if (t.owner !== seat) return;
    if (t.houses) { p.cash += (t.houses * TILES[i].house) / 2; if (t.houses === 5) s.hotels++; else s.houses += t.houses; t.houses = 0; }
  });
  if (to >= 0) {
    s.players[to].cash += Math.max(0, p.cash);
    s.players[to].jailCards += p.jailCards;
    s.tiles.forEach((t) => { if (t.owner === seat) t.owner = to; });
  } else {
    if (to === -3) {
      // distribute remaining cash among others
      const others = alive(s).filter((k) => k !== seat);
      const share = Math.floor(Math.max(0, p.cash) / Math.max(1, others.length));
      for (const o of others) s.players[o].cash += share;
    }
    s.tiles.forEach((t) => { if (t.owner === seat) { t.owner = -1; t.mort = false; } });
  }
  p.cash = 0; p.out = true; p.jailCards = 0;
  (s.outOrder ||= []).push(seat);
  s.debt = null;
  if (s.trade && (s.trade.from === seat || s.trade.to === seat)) s.trade = null;
  if (alive(s).length <= 1) { finish(s); return; }
  if (seat === s.cur) nextTurn(s);
  else s.phase = 'end';
}

// ---------- auction ----------
function startAuction(s, tile) {
  const order = [];
  for (let k = 1; k <= s.n; k++) { const i = (s.cur + k) % s.n; if (!s.players[i].out) order.push(i); }
  s.auction = { tile, bid: 0, bidder: -1, active: order, idx: 0 };
  s.phase = 'auction';
  s.ev.push({ t: 'auction', tile });
}
function endAuctionIfDone(s) {
  const a = s.auction;
  if (a.idx >= a.active.length) a.idx = 0;
  const done = a.active.length === 0 || (a.bidder >= 0 && a.active.length === 1 && a.active[0] === a.bidder);
  if (!done) return;
  if (a.bidder >= 0) {
    s.players[a.bidder].cash -= a.bid;
    s.tiles[a.tile].owner = a.bidder;
    s.ev.push({ t: 'auctionWin', tile: a.tile, seat: a.bidder, amount: a.bid });
  } else s.ev.push({ t: 'auctionNone', tile: a.tile });
  s.auction = null;
  s.phase = 'end';
  finishTurnStep(s);
}

// ---------- legality ----------
export function validate(s, a, seat) {
  if (s.winner !== null || actor(s) !== seat) return false;
  const p = s.players[seat];
  switch (a.t) {
    case 'roll': return s.phase === 'roll';
    case 'payJail': return s.phase === 'roll' && p.jail && p.cash >= JAIL_FINE;
    case 'useCard': return s.phase === 'roll' && p.jail && p.jailCards > 0;
    case 'buy': return s.phase === 'buy' && p.cash >= TILES[p.pos].price;
    case 'decline': return s.phase === 'buy';
    case 'bid': return s.phase === 'auction' && Number.isInteger(a.amount) && a.amount > s.auction.bid && a.amount >= 10 && a.amount <= p.cash;
    case 'pass': return s.phase === 'auction';
    case 'end': return s.phase === 'end';
    case 'build': return ['roll', 'end', 'buy'].includes(s.phase) && canBuild(s, seat, a.tile);
    case 'sell': return ['roll', 'end', 'buy', 'debt'].includes(s.phase) && canSell(s, seat, a.tile);
    case 'mortgage': return ['roll', 'end', 'buy', 'debt'].includes(s.phase) && canMortgage(s, seat, a.tile);
    case 'unmortgage': return ['roll', 'end'].includes(s.phase) && canUnmortgage(s, seat, a.tile);
    case 'bankrupt': return s.phase === 'debt';
    case 'trade': {
      if (!['roll', 'end'].includes(s.phase) || a.to === seat || !s.players[a.to] || s.players[a.to].out) return false;
      if (s.tradesThisTurn >= 3) return false;
      const g = a.give, r = a.get;
      if (!g.tiles.every((i) => tradeable(s, seat, i)) || !r.tiles.every((i) => tradeable(s, a.to, i))) return false;
      if (g.cash < 0 || r.cash < 0 || g.cash > p.cash || r.cash > s.players[a.to].cash) return false;
      return g.tiles.length + r.tiles.length + g.cash + r.cash > 0;
    }
    case 'tradeAccept': case 'tradeReject': return s.phase === 'trade';
    default: return false;
  }
}

// ---------- apply ----------
export function apply(s0, a, seat) {
  const s = clone(s0);
  s.ev = [];
  if (!validate(s, a, seat)) throw new Error('illegal action ' + JSON.stringify(a));
  const p = s.players[seat];
  switch (a.t) {
    case 'roll': {
      const d1 = 1 + Math.floor(nextRand(s) * 6), d2 = 1 + Math.floor(nextRand(s) * 6);
      const doubles = d1 === d2;
      s.dice = [d1, d2];
      s.ev.push({ t: 'roll', dice: [d1, d2], seat, doubles });
      if (p.jail) {
        if (doubles) { p.jail = false; p.jailTurns = 0; s.ev.push({ t: 'jailFree', seat, how: 'doubles' }); s.lastDoubles = false; }
        else {
          p.jailTurns++;
          if (p.jailTurns >= 3) {
            p.jail = false; p.jailTurns = 0;
            s.lastDoubles = false;
            if (!charge(s, seat, s.variant === 'jackpot' ? -2 : -1, JAIL_FINE, 'jail', 'jailMove')) { s.debt.dice = d1 + d2; return s; }
          } else { s.lastDoubles = false; s.phase = 'end'; return s; }
        }
      } else {
        s.lastDoubles = doubles;
        if (doubles) {
          p.doubles++;
          if (p.doubles >= 3) { sendToJail(s, seat); s.lastDoubles = false; s.phase = 'end'; return s; }
        }
      }
      const to = (p.pos + d1 + d2) % 40;
      moveTo(s, seat, to);
      s.phase = 'end';
      land(s, seat, d1 + d2);
      finishTurnStep(s);
      return s;
    }
    case 'payJail':
      charge(s, seat, s.variant === 'jackpot' ? -2 : -1, JAIL_FINE, 'jail');
      p.jail = false; p.jailTurns = 0;
      s.ev.push({ t: 'jailFree', seat, how: 'pay' });
      return s;
    case 'useCard': {
      p.jailCards--; p.jail = false; p.jailTurns = 0;
      const out = s.jailCardsOut || { event: [], fund: [] };
      const deck = out.event.length ? 'event' : 'fund';
      const id = out[deck].shift();
      if (id !== undefined) s.decks[deck].push(id);
      s.jailCardsOut = out;
      s.ev.push({ t: 'jailFree', seat, how: 'card' });
      return s;
    }
    case 'buy': {
      const i = p.pos;
      p.cash -= TILES[i].price;
      s.tiles[i].owner = seat;
      s.ev.push({ t: 'buy', tile: i, seat, amount: TILES[i].price });
      s.phase = 'end';
      finishTurnStep(s);
      return s;
    }
    case 'decline': startAuction(s, p.pos); return s;
    case 'bid': {
      const au = s.auction;
      au.bid = a.amount; au.bidder = seat;
      s.ev.push({ t: 'bid', seat, amount: a.amount });
      au.idx = (au.idx + 1) % au.active.length;
      endAuctionIfDone(s);
      return s;
    }
    case 'pass': {
      const au = s.auction;
      au.active.splice(au.idx, 1);
      s.ev.push({ t: 'passBid', seat });
      if (au.active.length) au.idx %= au.active.length;
      endAuctionIfDone(s);
      return s;
    }
    case 'end': nextTurn(s); return s;
    case 'build': {
      const t = s.tiles[a.tile];
      p.cash -= TILES[a.tile].house;
      if (t.houses === 4) { s.hotels--; s.houses += 4; } else s.houses--;
      t.houses++;
      s.ev.push({ t: 'build', tile: a.tile, seat, houses: t.houses });
      return s;
    }
    case 'sell': {
      const t = s.tiles[a.tile];
      if (t.houses === 5) {
        if (s.houses >= 4) { s.houses -= 4; s.hotels++; t.houses = 4; p.cash += TILES[a.tile].house / 2; }
        else { s.hotels++; p.cash += (TILES[a.tile].house * 5) / 2; t.houses = 0; }
      } else { t.houses--; s.houses++; p.cash += TILES[a.tile].house / 2; }
      s.ev.push({ t: 'sell', tile: a.tile, seat, houses: t.houses });
      if (s.phase === 'debt') settleDebtIfPossible(s);
      return s;
    }
    case 'mortgage':
      s.tiles[a.tile].mort = true;
      p.cash += TILES[a.tile].price / 2;
      s.ev.push({ t: 'mortgage', tile: a.tile, seat, amount: TILES[a.tile].price / 2 });
      if (s.phase === 'debt') settleDebtIfPossible(s);
      return s;
    case 'unmortgage':
      s.tiles[a.tile].mort = false;
      p.cash -= unmortgageCost(a.tile);
      s.ev.push({ t: 'unmortgage', tile: a.tile, seat, amount: unmortgageCost(a.tile) });
      return s;
    case 'bankrupt': bankrupt(s, seat); return s;
    case 'trade':
      s.trade = { from: seat, to: a.to, give: a.give, get: a.get, back: s.phase };
      s.tradesThisTurn++;
      (s.offers ||= {})[`${seat}>${a.to}:${a.get.tiles.join(',')}`] = s.round;
      s.phase = 'trade';
      s.ev.push({ t: 'tradeOffer', from: seat, to: a.to });
      return s;
    case 'tradeAccept': {
      const tr = s.trade;
      const okNow = tr.give.tiles.every((i) => tradeable(s, tr.from, i)) && tr.get.tiles.every((i) => tradeable(s, tr.to, i))
        && s.players[tr.from].cash >= tr.give.cash && s.players[tr.to].cash >= tr.get.cash;
      if (okNow) {
        for (const i of tr.give.tiles) s.tiles[i].owner = tr.to;
        for (const i of tr.get.tiles) s.tiles[i].owner = tr.from;
        s.players[tr.from].cash += tr.get.cash - tr.give.cash;
        s.players[tr.to].cash += tr.give.cash - tr.get.cash;
        s.ev.push({ t: 'tradeDone', ...tr });
      } else s.ev.push({ t: 'tradeRejected', from: tr.from, to: tr.to });
      s.phase = tr.back; s.trade = null;
      return s;
    }
    case 'tradeReject': {
      const tr = s.trade;
      s.ev.push({ t: 'tradeRejected', from: tr.from, to: tr.to });
      s.phase = tr.back; s.trade = null;
      return s;
    }
    default: throw new Error('unknown action');
  }
}

export function result(s) {
  const ranking = s.ranking || [s.winner];
  return { winners: [s.winner], ranking, scores: s.players.map((_, i) => '$' + Math.round(netWorth(s, i))) };
}

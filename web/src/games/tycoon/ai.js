// TYCOON bot AI. Strategy scales with difficulty and persona traits:
//  easy   — buys impulsively, small cash reserve, rarely builds, random mistakes
//  normal — values color sets, builds on monopolies, sensible auctions
//  hard   — keeps a danger-based reserve, proposes trades to complete sets, tactical jail stays
//  expert — aggressive 3-house builds, set-blocking, careful trade evaluation
import { TILES, GROUPS, RAILS, UTILS, isProperty, groupOf } from './boards.js';
import { validate, canBuild, canSell, canMortgage, canUnmortgage, ownsGroup, rentFor, liquidity, unmortgageCost } from './rules.js';

const LV = { easy: 0, normal: 1, hard: 2, expert: 3 };

/** Strategic value of tile i for seat (in cash units). */
export function tileValue(s, seat, i) {
  const tile = TILES[i];
  let v = tile.price;
  const g = groupOf(i);
  if (!g) return v;
  const mine = g.filter((k) => k !== i && s.tiles[k].owner === seat).length;
  const others = g.filter((k) => k !== i && s.tiles[k].owner >= 0 && s.tiles[k].owner !== seat);
  const free = g.filter((k) => k !== i && s.tiles[k].owner < 0).length;
  if (tile.type === 'street') {
    if (mine === g.length - 1) v *= 2.4;          // completes my set
    else if (mine > 0 && others.length === 0) v *= 1.5;
    const oneOwner = others.length === g.length - 1 && others.every((k) => s.tiles[k].owner === s.tiles[others[0]].owner);
    if (oneOwner) v *= 1.9;                          // blocks an opponent's set
    if (free === g.length - 1) v *= 1.1;
    v *= 1 + tile.g * 0.03;                          // orange/red sets land more often
  } else if (tile.type === 'rail') v *= 1 + mine * 0.35;
  else v *= mine ? 1.3 : 0.85;
  return v;
}

/** Cash to keep for upcoming rents. */
function reserve(s, seat, level, traits) {
  let danger = 0;
  s.tiles.forEach((t, i) => {
    if (t.owner >= 0 && t.owner !== seat && !t.mort && !s.players[t.owner].out) danger = Math.max(danger, rentFor(s, i, 7));
  });
  const base = [40, 100, 150, 120][LV[level]];
  const k = [0.2, 0.45, 0.5, 0.38][LV[level]] * (1.2 - (traits?.risk ?? 0.5) * 0.6);
  return base + danger * k;
}

function manageStep(s, seat, level, traits, rng) {
  const p = s.players[seat];
  const lv = LV[level];
  const res = reserve(s, seat, level, traits);
  // 1) unmortgage set pieces when comfortable
  if (lv >= 1) {
    for (let i = 0; i < 40; i++) {
      if (canUnmortgage(s, seat, i) && p.cash - unmortgageCost(i) > res * 1.5) return { t: 'unmortgage', tile: i };
    }
  }
  // 2) build houses evenly (cheapest-to-develop high-yield first)
  if (lv >= 1 || rng() < 0.4) {
    const cap = lv >= 3 ? 5 : lv === 2 ? 5 : 4;
    const cands = [];
    for (let i = 0; i < 40; i++) {
      if (!canBuild(s, seat, i)) continue;
      if (s.tiles[i].houses >= cap) continue;
      const cost = TILES[i].house;
      if (p.cash - cost < res * (lv === 3 && s.tiles[i].houses < 3 ? 0.6 : 1)) continue;
      const gain = TILES[i].rent[s.tiles[i].houses + 1] - TILES[i].rent[s.tiles[i].houses];
      cands.push({ i, score: gain / cost + (s.tiles[i].houses < 3 ? 1 : 0) });
    }
    cands.sort((a, b) => b.score - a.score);
    if (cands.length) return { t: 'build', tile: cands[0].i };
  }
  return null;
}

/** Find a trade that completes one of my sets. */
function proposeTrade(s, seat, level, traits, rng) {
  const lv = LV[level];
  if (lv < 1 || s.tradesThisTurn >= 1) return null;
  if (rng() > [0, 0.12, 0.35, 0.5][lv] * (0.6 + (traits?.aggression ?? 0.5))) return null;
  const p = s.players[seat];
  for (const g of GROUPS) {
    const mine = g.filter((k) => s.tiles[k].owner === seat);
    const missing = g.filter((k) => s.tiles[k].owner !== seat);
    if (mine.length === 0 || missing.length !== 1) continue;
    const m = missing[0];
    const owner = s.tiles[m].owner;
    if (owner < 0 || s.players[owner].out) continue;
    if (!g.every((k) => s.tiles[k].houses === 0)) continue;
    // offer: cash, possibly plus a tile that doesn't complete their set
    const value = tileValue(s, owner, m);
    let cash = Math.round(Math.min(p.cash - 50, value * (1.25 + rng() * 0.35)) / 10) * 10;
    const giveTiles = [];
    if (cash < value) {
      // sweeten with a spare property that is useless to me
      const spare = s.tiles.map((t, i) => i).find((i) => isProperty(i) && s.tiles[i].owner === seat && !ownsGroup(s, seat, i)
        && groupOf(i).filter((k) => s.tiles[k].owner === seat).length === 1 && groupOf(i) !== g && s.tiles[i].houses === 0
        && !(groupOf(i).filter((k) => k !== i).every((k) => s.tiles[k].owner === owner)));
      if (spare !== undefined) giveTiles.push(spare);
    }
    if (cash < 10 && !giveTiles.length) continue;
    const last = s.offers?.[`${seat}>${owner}:${m}`];
    if (last !== undefined && s.round - last < 6) continue;
    const a = { t: 'trade', to: owner, give: { tiles: giveTiles, cash: Math.max(0, cash) }, get: { tiles: [m], cash: 0 } };
    // only offer what the other side would plausibly accept (raise cash if we can afford it)
    let gain = evaluateTrade(s, owner, { from: seat, ...a }, 'normal');
    if (gain <= 10) {
      const extra = Math.ceil((10 - gain + 30) / 10) * 10;
      const myGain = tileValue(s, seat, m) - a.give.cash - extra;
      if (a.give.cash + extra > p.cash - 80 || myGain < 0) continue;
      a.give.cash += extra;
      gain = evaluateTrade(s, owner, { from: seat, ...a }, 'normal');
      if (gain <= 10) continue;
    }
    if (validate(s, a, seat)) return a;
  }
  return null;
}

/** Evaluate an incoming offer from the point of view of `seat` (the receiver). */
export function evaluateTrade(s, seat, tr, level = 'normal') {
  const giver = tr.from;
  let gain = tr.give.cash - tr.get.cash;
  for (const i of tr.give.tiles) gain += tileValue(s, seat, i);
  for (const i of tr.get.tiles) gain -= tileValue(s, seat, i);
  // danger: does the giver complete a set with what they get?
  for (const i of tr.get.tiles) {
    const g = groupOf(i);
    if (TILES[i].type === 'street' && g.every((k) => k === i || s.tiles[k].owner === giver)) gain -= TILES[i].price * [0.5, 1.2, 1.8, 2.2][LV[level]];
  }
  return gain;
}

export function choose(s, seat, level, traits = {}, rng = Math.random) {
  const p = s.players[seat];
  const lv = LV[level] ?? 1;
  const mistake = [0.18, 0.06, 0.02, 0][lv] + (traits.mistakes || 0);
  const res = reserve(s, seat, level, traits);
  switch (s.phase) {
    case 'trade': {
      const gain = evaluateTrade(s, seat, s.trade, level);
      const want = [-40, 10, 40, 60][lv] * (1 + (traits.aggression ?? 0.5) * 0.3);
      return { t: gain > want || (lv === 0 && rng() < 0.25) ? 'tradeAccept' : 'tradeReject' };
    }
    case 'auction': {
      const a = s.auction;
      const val = tileValue(s, seat, a.tile) * [0.8, 1.0, 1.08, 1.12][lv] * (0.85 + (traits.risk ?? 0.5) * 0.35);
      const max = Math.min(val, p.cash - res * 0.5);
      const step = a.bid < 100 ? 10 : a.bid < 300 ? 20 : 50;
      const next = Math.max(10, a.bid + step);
      if (next <= max && next <= p.cash && a.bidder !== seat) return { t: 'bid', amount: next };
      if (a.bidder === seat) return { t: 'pass' };
      return { t: 'pass' };
    }
    case 'buy': {
      const i = p.pos;
      const price = TILES[i].price;
      if (p.cash < price) {
        // raise money for a set-completing tile on hard+
        if (lv >= 2 && tileValue(s, seat, i) > price * 2 && liquidity(s, seat) > price + res) {
          const m = mortgageCandidate(s, seat);
          if (m != null) return { t: 'mortgage', tile: m };
        }
        return { t: 'decline' };
      }
      const val = tileValue(s, seat, i);
      const after = p.cash - price;
      let buy = after >= res * 0.6 || val > price * 1.8;
      if (lv === 0) buy = rng() < 0.85;
      if (rng() < mistake) buy = !buy;
      return { t: buy ? 'buy' : 'decline' };
    }
    case 'debt': {
      const d = s.debt;
      if (liquidity(s, seat) < d.amount) return { t: 'bankrupt' };
      // sell houses on the least valuable group first, then mortgage singles
      const m = mortgageCandidate(s, seat, true);
      if (m != null) return { t: 'mortgage', tile: m };
      for (let i = 0; i < 40; i++) if (canSell(s, seat, i)) return { t: 'sell', tile: i };
      return { t: 'bankrupt' };
    }
    case 'roll': {
      if (p.jail) {
        const unowned = s.tiles.filter((t, i) => isProperty(i) && t.owner < 0).length;
        const late = unowned < 8 || lv >= 2 && s.tiles.some((t) => t.owner !== seat && t.houses >= 2);
        if (p.jailCards > 0 && !late) return { t: 'useCard' };
        if (!late && p.cash > res + 50 && validate(s, { t: 'payJail' }, seat)) return { t: 'payJail' };
        return { t: 'roll' };
      }
      const m = manageStep(s, seat, level, traits, rng);
      if (m) return m;
      const tr = proposeTrade(s, seat, level, traits, rng);
      if (tr) return tr;
      return { t: 'roll' };
    }
    case 'end': {
      const m = manageStep(s, seat, level, traits, rng);
      if (m) return m;
      const tr = proposeTrade(s, seat, level, traits, rng);
      if (tr) return tr;
      return { t: 'end' };
    }
    default: return { t: 'end' };
  }
}

function mortgageCandidate(s, seat, allowSets = false) {
  let best = null, bestScore = Infinity;
  for (let i = 0; i < 40; i++) {
    if (!canMortgage(s, seat, i)) continue;
    const inSet = ownsGroup(s, seat, i);
    if (inSet && !allowSets) continue;
    const score = tileValue(s, seat, i) + (inSet ? 1000 : 0);
    if (score < bestScore) { bestScore = score; best = i; }
  }
  return best;
}

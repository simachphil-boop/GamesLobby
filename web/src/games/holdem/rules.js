// HOLD'EM rules (Texas Hold'em for virtual points only — no real money involved).
// Cards 0..51: rank = c % 13 (0 = 2 … 12 = Ace), suit = floor(c / 13).
import { shuffleSeeded } from '../../core/rng.js';
import { clone } from '../../core/util.js';
const HANDS = { short: 15, medium: 30, full: 200 };
export const rankOf = (c) => c % 13, suitOf = (c) => Math.floor(c / 13);

/** Score of the best 5-card hand in up to 7 cards (higher is better). */
export function evaluate(cards) {
  const cnt = Array(13).fill(0), suits = [[], [], [], []];
  for (const c of cards) { cnt[rankOf(c)]++; suits[suitOf(c)].push(rankOf(c)); }
  const straightHigh = (mask) => { for (let hi = 12; hi >= 3; hi--) { let ok = true; for (let k = 0; k < 5; k++) { const r = hi - k < 0 ? 12 : hi - k; if (!(mask & (1 << (hi - k === -1 ? 12 : hi - k)))) { ok = false; break; } void r; } if (ok) return hi; } return -1; };
  const maskOf = (ranks) => ranks.reduce((m, r) => m | (1 << r), 0) | 0;
  const wheel = (mask) => (mask & 0x100f) === 0x100f; // A-2-3-4-5
  const sh = (mask) => { const h = straightHigh(mask); return h >= 3 && h !== 3 ? h : (wheel(mask) ? 3 : h >= 4 ? h : -1); };
  const enc = (cat, ks) => ks.slice(0, 5).reduce((a, k) => a * 13 + k, cat) * Math.pow(13, 5 - Math.min(5, ks.length));
  for (const s of suits) if (s.length >= 5) {
    const m = maskOf(s); const h = sh(m);
    if (h >= 0) return enc(8, [h]);
  }
  const byCount = [...Array(13).keys()].sort((a, b) => cnt[b] - cnt[a] || b - a).filter((r) => cnt[r]);
  const desc = [...Array(13).keys()].reverse();
  if (cnt[byCount[0]] === 4) return enc(7, [byCount[0], desc.find((r) => r !== byCount[0] && cnt[r])]);
  if (cnt[byCount[0]] === 3 && cnt[byCount[1]] >= 2) return enc(6, [byCount[0], byCount[1]]);
  for (const s of suits) if (s.length >= 5) return enc(5, s.sort((a, b) => b - a));
  const h = sh(maskOf(cards.map(rankOf)));
  if (h >= 0) return enc(4, [h]);
  if (cnt[byCount[0]] === 3) return enc(3, [byCount[0], ...desc.filter((r) => r !== byCount[0] && cnt[r])]);
  if (cnt[byCount[0]] === 2 && cnt[byCount[1]] === 2) return enc(2, [byCount[0], byCount[1], desc.find((r) => r !== byCount[0] && r !== byCount[1] && cnt[r])]);
  if (cnt[byCount[0]] === 2) return enc(1, [byCount[0], ...desc.filter((r) => r !== byCount[0] && cnt[r])]);
  return enc(0, desc.filter((r) => cnt[r]));
}
export const category = (score) => Math.floor(score / Math.pow(13, 5));

export function setup(opts = {}, n = 4, seed = 1) {
  const s = { n, chips: Array(n).fill(1000), out: Array(n).fill(false), dealer: n - 1, sb: 10, bb: 20, handNo: 0, maxHands: HANDS[opts.duration || 'medium'] || 30, seed, winner: null, ev: [] };
  newHand(s);
  return s;
}
const alive = (s) => [...Array(s.n).keys()].filter((i) => !s.out[i]);
const nextFrom = (s, i, pred) => { for (let k = 1; k <= s.n; k++) { const j = (i + k) % s.n; if (pred(j)) return j; } return -1; };
function newHand(s) {
  s.handNo++;
  if (s.handNo > 1 && (s.handNo - 1) % 6 === 0) { s.sb = Math.round(s.sb * 1.5 / 5) * 5; s.bb = s.sb * 2; s.ev.push({ t: 'blinds', sb: s.sb, bb: s.bb }); }
  s.deck = shuffleSeeded(s, [...Array(52).keys()]);
  s.hole = Array.from({ length: s.n }, () => []);
  s.board = []; s.folded = s.out.slice(); s.bets = Array(s.n).fill(0); s.committed = Array(s.n).fill(0);
  s.dealer = nextFrom(s, s.dealer, (j) => !s.out[j]);
  for (let r = 0; r < 2; r++) for (const i of alive(s)) s.hole[i].push(s.deck.pop());
  const heads = alive(s).length === 2;
  const sbSeat = heads ? s.dealer : nextFrom(s, s.dealer, (j) => !s.out[j]);
  const bbSeat = nextFrom(s, sbSeat, (j) => !s.out[j]);
  post(s, sbSeat, s.sb); post(s, bbSeat, s.bb);
  s.street = 'preflop'; s.currentBet = s.bb; s.minRaise = s.bb;
  s.acted = Array(s.n).fill(false);
  s.toAct = nextFrom(s, bbSeat, (j) => canAct(s, j));
  s.ev.push({ t: 'deal', hand: s.handNo, dealer: s.dealer, sbSeat, bbSeat });
  if (s.toAct < 0) runOut(s);
}
function post(s, i, amt) { const a = Math.min(amt, s.chips[i]); s.chips[i] -= a; s.bets[i] += a; s.committed[i] += a; }
const canAct = (s, i) => !s.folded[i] && !s.out[i] && s.chips[i] > 0;
export const actor = (s) => s.toAct;
export const isOver = (s) => s.winner !== null;
export const toCall = (s, i) => Math.max(0, s.currentBet - s.bets[i]);
export const pot = (s) => s.committed.reduce((a, b) => a + b, 0);
export function validate(s, a, seat) {
  if (s.winner !== null || seat !== s.toAct) return false;
  const tc = toCall(s, seat);
  switch (a.t) {
    case 'fold': return true;
    case 'check': return tc === 0;
    case 'call': return tc > 0;
    case 'raise': {
      const max = s.bets[seat] + s.chips[seat];
      if (!Number.isInteger(a.to) || a.to > max || a.to <= s.currentBet) return false;
      return a.to >= s.currentBet + s.minRaise || a.to === max; // short all-in allowed
    }
    default: return false;
  }
}
export function apply(s0, a, seat) {
  const s = clone(s0); s.ev = [];
  if (!validate(s, a, seat)) throw new Error('illegal ' + JSON.stringify(a));
  s.acted[seat] = true;
  if (a.t === 'fold') { s.folded[seat] = true; s.ev.push({ t: 'fold', seat }); }
  else if (a.t === 'check') s.ev.push({ t: 'check', seat });
  else if (a.t === 'call') { const amt = Math.min(toCall(s, seat), s.chips[seat]); post(s, seat, amt); s.ev.push({ t: 'call', seat, amount: amt, allin: s.chips[seat] === 0 }); }
  else {
    const add = a.to - s.bets[seat];
    if (a.to - s.currentBet >= s.minRaise) s.minRaise = a.to - s.currentBet;
    s.currentBet = a.to; post(s, seat, add);
    for (let i = 0; i < s.n; i++) if (i !== seat) s.acted[i] = false;
    s.ev.push({ t: 'raise', seat, to: a.to, allin: s.chips[seat] === 0 });
  }
  const live = [...Array(s.n).keys()].filter((i) => !s.folded[i]);
  if (live.length === 1) { award(s, [{ amount: pot(s), winners: live }], false); return s; }
  const pending = [...Array(s.n).keys()].filter((i) => canAct(s, i) && (!s.acted[i] || s.bets[i] < s.currentBet));
  if (pending.length) { s.toAct = nextFrom(s, seat, (j) => pending.includes(j)); return s; }
  nextStreet(s);
  return s;
}
function nextStreet(s) {
  s.bets = Array(s.n).fill(0); s.currentBet = 0; s.minRaise = s.bb; s.acted = Array(s.n).fill(false);
  const actors = [...Array(s.n).keys()].filter((i) => canAct(s, i));
  if (s.street === 'river') { showdown(s); return; }
  const deal = (k) => { s.deck.pop(); for (let i = 0; i < k; i++) s.board.push(s.deck.pop()); };
  if (s.street === 'preflop') { deal(3); s.street = 'flop'; } else if (s.street === 'flop') { deal(1); s.street = 'turn'; } else { deal(1); s.street = 'river'; }
  s.ev.push({ t: 'street', street: s.street, board: s.board.slice() });
  if (actors.length < 2) { nextStreet(s); return; }
  s.toAct = nextFrom(s, s.dealer, (j) => canAct(s, j));
}
function runOut(s) { while (s.street !== 'river') nextStreet(s); if (s.winner === null && s.street === 'river') showdown(s); }
function showdown(s) {
  const live = [...Array(s.n).keys()].filter((i) => !s.folded[i]);
  const scores = {}; for (const i of live) scores[i] = evaluate([...s.hole[i], ...s.board]);
  // side pots by contribution levels
  const levels = [...new Set(s.committed.filter((c) => c > 0))].sort((a, b) => a - b);
  const pots = []; let prev = 0;
  for (const L of levels) {
    let amount = 0; for (let i = 0; i < s.n; i++) amount += Math.max(0, Math.min(s.committed[i], L) - prev);
    const elig = live.filter((i) => s.committed[i] >= L);
    if (amount > 0) {
      if (!elig.length) { pots.length ? pots[pots.length - 1].amount += amount : pots.push({ amount, winners: live }); }
      else { const best = Math.max(...elig.map((i) => scores[i])); pots.push({ amount, winners: elig.filter((i) => scores[i] === best) }); }
    }
    prev = L;
  }
  s.ev.push({ t: 'showdown', hole: live.map((i) => ({ seat: i, cards: s.hole[i], cat: category(scores[i]) })), board: s.board.slice() });
  award(s, pots, true);
}
function award(s, pots, shown) {
  for (const p of pots) {
    const share = Math.floor(p.amount / p.winners.length);
    p.winners.forEach((w, k) => { s.chips[w] += share + (k === 0 ? p.amount - share * p.winners.length : 0); });
  }
  s.ev.push({ t: 'win', pots, shown });
  s.committed = Array(s.n).fill(0); s.bets = Array(s.n).fill(0);
  for (let i = 0; i < s.n; i++) if (!s.out[i] && s.chips[i] <= 0) { s.out[i] = true; s.ev.push({ t: 'bust', seat: i }); (s.bustOrder ||= []).push(i); }
  const al = alive(s);
  if (al.length <= 1 || s.handNo >= s.maxHands) {
    s.winner = al.reduce((b, i) => (s.chips[i] > s.chips[b] ? i : b), al[0]);
    s.toAct = -1;
    return;
  }
  newHand(s);
}
export function result(s) {
  const ranking = [...Array(s.n).keys()].sort((a, b) => s.chips[b] - s.chips[a] || (s.bustOrder || []).indexOf(b) - (s.bustOrder || []).indexOf(a));
  return { winners: [s.winner], ranking, scores: s.chips.map((c) => c + ' ◉') };
}

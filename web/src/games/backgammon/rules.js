// BACKGAMMON rules. Points 0..23; seat 0 moves 23→0 (home 0-5), seat 1 moves 0→23 (home 18-23).
// pts[i] > 0: seat 0 checkers, < 0: seat 1 checkers. Moves are single steps {t:'move', from, to, die}
// with from = 'bar' and to = 'off' for entering / bearing off. Players must use as many dice as possible
// (and the larger die when only one can be used).
import { nextRand } from '../../core/rng.js';
import { clone } from '../../core/util.js';

export function setup(opts = {}, n = 2, seed = 1) {
  const pts = Array(24).fill(0);
  const put = (i, k) => { pts[i] += k; pts[23 - i] -= k; };
  if (opts.variant === 'nack') { put(23, 2); put(22, 2); put(12, 4); put(7, 3); put(5, 4); }
  else { put(23, 2); put(12, 5); put(7, 3); put(5, 5); }
  return { pts, bar: [0, 0], off: [0, 0], turn: seed % 2, phase: 'roll', dice: [], winner: null, gammon: false, seed, ev: [] };
}
export const actor = (s) => s.turn;
export const isOver = (s) => s.winner !== null;
const own = (s, p, i) => (p === 0 ? s.pts[i] > 0 : s.pts[i] < 0);
const count = (s, p, i) => Math.abs(s.pts[i]) * (own(s, p, i) ? 1 : 0);
const blocked = (s, p, i) => (p === 0 ? s.pts[i] <= -2 : s.pts[i] >= 2);
function allHome(s, p) {
  if (s.bar[p]) return false;
  for (let i = 0; i < 24; i++) if (own(s, p, i) && (p === 0 ? i > 5 : i < 18)) return false;
  return true;
}
/** Single-step moves for player p with die d. */
export function stepMoves(s, p, d) {
  const out = [];
  if (s.bar[p]) {
    const to = p === 0 ? 24 - d : d - 1;
    if (!blocked(s, p, to)) out.push({ from: 'bar', to, die: d });
    return out;
  }
  const home = allHome(s, p);
  for (let i = 0; i < 24; i++) {
    if (!own(s, p, i)) continue;
    const to = p === 0 ? i - d : i + d;
    if (to >= 0 && to < 24) { if (!blocked(s, p, to)) out.push({ from: i, to, die: d }); continue; }
    if (!home) continue;
    const exact = p === 0 ? to === -1 : to === 24;
    if (exact) { out.push({ from: i, to: 'off', die: d }); continue; }
    // higher die may bear off the farthest checker
    let farther = false;
    for (let j = 0; j < 24; j++) if (own(s, p, j) && (p === 0 ? j > i : j < i)) farther = true;
    if (!farther) out.push({ from: i, to: 'off', die: d });
  }
  return out;
}
export function doStep(s, p, m) {
  const sg = p === 0 ? 1 : -1;
  let hit = false;
  if (m.from === 'bar') s.bar[p]--; else s.pts[m.from] -= sg;
  if (m.to === 'off') s.off[p]++;
  else {
    if (s.pts[m.to] === -sg) { s.pts[m.to] = 0; s.bar[1 - p]++; hit = true; }
    s.pts[m.to] += sg;
  }
  const i = s.dice.indexOf(m.die); s.dice.splice(i, 1);
  return hit;
}
/** All maximal sequences of steps for the remaining dice. */
export function sequences(s, p) {
  let best = [], maxLen = 0;
  const rec = (st, seq) => {
    const dice = [...new Set(st.dice)];
    let any = false;
    for (const d of dice) for (const m of stepMoves(st, p, d)) {
      any = true;
      const c = { pts: st.pts.slice(), bar: st.bar.slice(), off: st.off.slice(), dice: st.dice.slice() };
      doStep(c, p, m);
      rec(c, [...seq, m]);
    }
    if (!any) {
      if (seq.length > maxLen) { maxLen = seq.length; best = [seq]; } else if (seq.length === maxLen && seq.length) best.push(seq);
    }
  };
  rec({ pts: s.pts, bar: s.bar, off: s.off, dice: s.dice.slice() }, []);
  if (maxLen === 1 && s.dice.length === 2 && s.dice[0] !== s.dice[1]) {
    const hi = Math.max(...s.dice);
    if (best.some((q) => q[0].die === hi)) best = best.filter((q) => q[0].die === hi);
  }
  return best;
}
export function legalSteps(s) {
  const seen = new Map();
  for (const q of sequences(s, s.turn)) { const m = q[0]; seen.set(`${m.from}>${m.to}:${m.die}`, m); }
  return [...seen.values()];
}
export function validate(s, a, seat) {
  if (s.winner !== null || seat !== s.turn) return false;
  if (a.t === 'roll') return s.phase === 'roll';
  if (a.t === 'move') return s.phase === 'move' && legalSteps(s).some((m) => m.from === a.from && m.to === a.to && m.die === a.die);
  return false;
}
function endTurn(s) { s.turn = 1 - s.turn; s.phase = 'roll'; s.dice = []; }
export function apply(s0, a, seat) {
  const s = clone(s0); s.ev = [];
  if (!validate(s, a, seat)) throw new Error('illegal ' + JSON.stringify(a));
  if (a.t === 'roll') {
    const d1 = 1 + Math.floor(nextRand(s) * 6), d2 = 1 + Math.floor(nextRand(s) * 6);
    s.dice = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
    s.rolled = [d1, d2];
    s.ev.push({ t: 'roll', dice: [d1, d2], seat });
    s.phase = 'move';
    if (!legalSteps(s).length) { s.ev.push({ t: 'blocked', seat }); endTurn(s); }
    return s;
  }
  const hit = doStep(s, seat, a);
  s.ev.push({ t: 'move', seat, from: a.from, to: a.to, die: a.die, hit });
  if (s.off[seat] === 15) {
    s.winner = seat; s.gammon = s.off[1 - seat] === 0;
    s.ev.push({ t: 'win', seat, gammon: s.gammon });
    return s;
  }
  if (!s.dice.length || !legalSteps(s).length) endTurn(s);
  return s;
}
export function result(s) { return { winners: [s.winner], ranking: [s.winner, 1 - s.winner], scores: s.off.map((o) => o + '/15') }; }
export function pips(s, p) {
  let n = s.bar[p] * 25;
  for (let i = 0; i < 24; i++) if (own(s, p, i)) n += count(s, p, i) * (p === 0 ? i + 1 : 24 - i);
  return n;
}

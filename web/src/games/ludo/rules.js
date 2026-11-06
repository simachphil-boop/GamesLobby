// LUDO rules. Track of 52 cells; each color c starts at 13c. Token progress r: -1 base, 0..50 track,
// 51..55 home column, 56 finished. Six to leave base, six = extra turn, three sixes = turn lost.
import { nextRand } from '../../core/rng.js';
import { clone } from '../../core/util.js';
export const SAFE = [0, 8, 13, 21, 26, 34, 39, 47];
export const colorsFor = (n) => (n === 2 ? [0, 2] : n === 3 ? [0, 2, 1] : [0, 3, 2, 1]);
export function setup(opts = {}, n = 4, seed = 1) {
  return { n, colors: colorsFor(n), tokens: Array.from({ length: n }, () => [-1, -1, -1, -1]), turn: 0, phase: 'roll', die: 0, sixes: 0,
    exact: opts.variant !== 'easy', captureBonus: opts.variant !== 'easy', winner: null, finishedOrder: [], seed, ev: [] };
}
export const actor = (s) => s.turn;
export const isOver = (s) => s.winner !== null;
export const absCell = (color, r) => (color * 13 + r) % 52;
export function target(s, seat, k) {
  const r = s.tokens[seat][k], d = s.die;
  if (r === 56) return null;
  if (r === -1) return d === 6 ? 0 : null;
  let nr = r + d;
  if (nr > 56) { if (s.exact) return null; nr = 56; }
  return nr;
}
export function movable(s, seat) { return [0, 1, 2, 3].filter((k) => target(s, seat, k) !== null); }
export function validate(s, a, seat) {
  if (s.winner !== null || seat !== s.turn) return false;
  if (a.t === 'roll') return s.phase === 'roll';
  if (a.t === 'move') return s.phase === 'move' && movable(s, seat).includes(a.token);
  return false;
}
function next(s) { s.turn = (s.turn + 1) % s.n; s.phase = 'roll'; s.sixes = 0; }
export function apply(s0, a, seat) {
  const s = clone(s0); s.ev = [];
  if (!validate(s, a, seat)) throw new Error('illegal');
  if (a.t === 'roll') {
    s.die = 1 + Math.floor(nextRand(s) * 6);
    s.ev.push({ t: 'roll', seat, die: s.die });
    if (s.die === 6) s.sixes++;
    if (s.sixes === 3) { s.ev.push({ t: 'three6', seat }); next(s); return s; }
    if (!movable(s, seat).length) { s.ev.push({ t: 'nomove', seat }); if (s.die === 6) s.phase = 'roll'; else next(s); return s; }
    s.phase = 'move';
    return s;
  }
  const from = s.tokens[seat][a.token], to = target(s, seat, a.token);
  s.tokens[seat][a.token] = to;
  const color = s.colors[seat];
  const ev = { t: 'move', seat, token: a.token, from, to, captured: [] };
  if (to <= 50) {
    const cell = absCell(color, to);
    if (!SAFE.includes(cell)) {
      s.tokens.forEach((tk, o) => { if (o === seat) return; tk.forEach((r, k) => { if (r >= 0 && r <= 50 && absCell(s.colors[o], r) === cell) { tk[k] = -1; ev.captured.push({ seat: o, token: k, r }); } }); });
    }
  }
  s.ev.push(ev);
  if (s.tokens[seat].every((r) => r === 56)) { s.winner = seat; s.ev.push({ t: 'win', seat }); return s; }
  const bonus = s.die === 6 || (s.captureBonus && ev.captured.length) || (to === 56 && s.captureBonus);
  if (bonus) { s.phase = 'roll'; if (s.die !== 6) s.sixes = 0; } else next(s);
  return s;
}
export function result(s) {
  const prog = (i) => s.tokens[i].reduce((a, r) => a + (r + 1), 0);
  const ranking = [...Array(s.n).keys()].sort((a, b) => (b === s.winner) - (a === s.winner) || prog(b) - prog(a));
  return { winners: [s.winner], ranking, scores: s.tokens.map((tk) => tk.filter((r) => r === 56).length + '/4') };
}

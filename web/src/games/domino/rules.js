// DOMINO rules (double-six). Variants: block (no drawing), draw (boneyard), fives (All Fives scoring).
import { shuffleSeeded } from '../../core/rng.js';
import { clone } from '../../core/util.js';
const TARGET = { single: 0, short: 100, long: 150 };
export function setup(opts = {}, n = 2, seed = 1) {
  const s = { n, variant: opts.variant || 'draw', target: TARGET[opts.duration || 'single'] ?? 0, scores: Array(n).fill(0), round: 1, starter: 0, winner: null, seed, ev: [] };
  deal(s);
  return s;
}
function deal(s) {
  const tiles = [];
  let id = 0;
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) tiles.push({ id: id++, a, b });
  shuffleSeeded(s, tiles);
  const per = s.n === 2 ? 7 : s.variant === 'block' ? 7 : 5;
  s.hands = Array.from({ length: s.n }, () => tiles.splice(0, per));
  s.boneyard = tiles;
  s.chain = []; // [{id,a,b,flip}] left→right; displayed values: flip ? [b,a] : [a,b]
  s.ends = null; s.turn = s.starter; s.phase = 'play'; s.passes = 0; s.roundWinner = null;
  s.ev.push({ t: 'deal', round: s.round });
}
export const actor = (s) => (s.phase === 'roundOver' ? s.roundWinner : s.turn);
export const isOver = (s) => s.winner !== null;
export const pipSum = (h) => h.reduce((a, t) => a + t.a + t.b, 0);
export function options(s, seat) {
  const out = [];
  for (const t of s.hands[seat]) {
    if (!s.ends) { out.push({ id: t.id, side: 'R' }); continue; }
    if (t.a === s.ends[0] || t.b === s.ends[0]) out.push({ id: t.id, side: 'L' });
    if ((t.a === s.ends[1] || t.b === s.ends[1]) && !(s.ends[0] === s.ends[1] && out.some((o) => o.id === t.id))) out.push({ id: t.id, side: 'R' });
  }
  return out;
}
export function validate(s, a, seat) {
  if (s.winner !== null || seat !== actor(s)) return false;
  if (a.t === 'next') return s.phase === 'roundOver';
  if (s.phase !== 'play') return false;
  const opts = options(s, seat);
  if (a.t === 'play') return opts.some((o) => o.id === a.id && o.side === a.side);
  if (a.t === 'draw') return !opts.length && s.variant !== 'block' && s.boneyard.length > 0;
  if (a.t === 'pass') return !opts.length && (s.variant === 'block' || !s.boneyard.length);
  return false;
}
const endSum = (s) => (s.chain.length === 1 ? s.chain[0].a + s.chain[0].b : s.ends[0] + s.ends[1]);
export function apply(s0, a, seat) {
  const s = clone(s0); s.ev = [];
  if (!validate(s, a, seat)) throw new Error('illegal');
  if (a.t === 'next') { s.round++; s.starter = (s.starter + 1) % s.n; deal(s); return s; }
  if (a.t === 'draw') { const t = s.boneyard.pop(); s.hands[seat].push(t); s.ev.push({ t: 'draw', seat, id: t.id }); return s; }
  if (a.t === 'pass') {
    s.passes++; s.ev.push({ t: 'pass', seat });
    if (s.passes >= s.n) return endRound(s, null);
    s.turn = (s.turn + 1) % s.n; return s;
  }
  const h = s.hands[seat], i = h.findIndex((t) => t.id === a.id), t = h.splice(i, 1)[0];
  s.passes = 0;
  if (!s.ends) { s.chain.push({ ...t, flip: false, first: true }); s.ends = [t.a, t.b]; }
  else if (a.side === 'L') { const flip = t.a === s.ends[0]; s.chain.unshift({ ...t, flip }); s.ends[0] = flip ? t.b : t.a; }
  else { const flip = t.b === s.ends[1]; s.chain.push({ ...t, flip }); s.ends[1] = flip ? t.a : t.b; }
  s.ev.push({ t: 'play', seat, tile: t, side: a.side });
  if (s.variant === 'fives') { const sum = endSum(s); if (sum % 5 === 0 && sum > 0) { s.scores[seat] += sum; s.ev.push({ t: 'fives', seat, pts: sum }); } }
  if (!h.length) return endRound(s, seat);
  s.turn = (s.turn + 1) % s.n;
  return s;
}
function endRound(s, w) {
  if (w === null) { // blocked: lowest pip count wins
    let best = 0; for (let i = 1; i < s.n; i++) if (pipSum(s.hands[i]) < pipSum(s.hands[best])) best = i; w = best;
  }
  let pts = 0; s.hands.forEach((h, i) => { if (i !== w) pts += pipSum(h); });
  if (s.variant === 'fives') pts = Math.round(pts / 5) * 5;
  s.scores[w] += pts; s.roundWinner = w;
  s.ev.push({ t: 'roundWin', seat: w, pts, blocked: s.passes >= s.n });
  if (!s.target || s.scores[w] >= s.target) { s.winner = w; s.phase = 'over'; } else s.phase = 'roundOver';
  return s;
}
export function result(s) {
  const ranking = [...Array(s.n).keys()].sort((a, b) => (b === s.winner) - (a === s.winner) || s.scores[b] - s.scores[a]);
  return { winners: [s.winner], ranking, scores: s.scores };
}

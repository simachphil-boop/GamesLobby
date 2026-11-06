// Checkers bots: alpha-beta minimax over full capture sequences.
import { genMoves, applyMove } from './rules.js';

function evaluate(b, side, variant) {
  let sc = 0;
  const kingV = variant === 'russian' ? 360 : 260;
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq];
    if (!p) continue;
    const r = sq >> 3, f = sq & 7;
    const s = Math.sign(p);
    let v = Math.abs(p) === 2 ? kingV : 100;
    if (Math.abs(p) === 1) {
      v += (s === 1 ? r : 7 - r) * 6;                      // advancement
      if ((s === 1 && r === 0) || (s === -1 && r === 7)) v += 8; // back-rank guard
    }
    if (f > 1 && f < 6 && r > 1 && r < 6) v += 6;           // center
    if (f === 0 || f === 7) v -= 3;
    sc += s * v;
  }
  return sc * side;
}
function search(b, turn, variant, depth, alpha, beta) {
  const moves = genMoves(b, turn, variant);
  if (!moves.length) return -100000 - depth;
  if (depth <= 0 && !moves[0].caps.length) return evaluate(b, turn, variant);
  if (depth <= -4) return evaluate(b, turn, variant);
  let best = -Infinity;
  for (const m of moves) {
    const copy = b.slice();
    applyMove(copy, m);
    const v = -search(copy, -turn, variant, depth - 1, -beta, -alpha);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}
export function choose(s, seat, level = 'normal', traits = {}, rng = Math.random) {
  const moves = genMoves(s.b, s.turn, s.variant);
  if (!moves.length) return null;
  const depth = { easy: 1, normal: 3, hard: 5, expert: 7 }[level] ?? 3;
  const noise = { easy: 60, normal: 15, hard: 4, expert: 0 }[level] ?? 10;
  if (level === 'easy' && rng() < 0.3 + (traits.mistakes || 0)) { const m = moves[Math.floor(rng() * moves.length)]; return { t: 'move', path: m.path, caps: m.caps }; }
  let best = null, bestV = -Infinity;
  const t0 = Date.now();
  for (const m of moves.sort((a, b) => b.caps.length - a.caps.length)) {
    const copy = s.b.slice();
    applyMove(copy, m);
    const v = -search(copy, -s.turn, s.variant, depth - 1, -Infinity, Infinity) + (rng() - 0.5) * noise;
    if (v > bestV) { bestV = v; best = m; }
    if (Date.now() - t0 > 4000) break;
  }
  return { t: 'move', path: best.path, caps: best.caps };
}

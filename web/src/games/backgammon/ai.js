// Backgammon bots: evaluate every maximal move sequence and play its first step.
import { sequences, doStep, pips } from './rules.js';
function evalPos(s, p, lv) {
  const o = 1 - p, sg = p === 0 ? 1 : -1;
  let v = (pips(s, o) - pips(s, p)) * 1.0 + s.off[p] * 8 - s.off[o] * 8 + s.bar[o] * 18 - s.bar[p] * 18;
  if (lv >= 1) {
    for (let i = 0; i < 24; i++) {
      const c = s.pts[i] * sg;
      if (c === 1) {
        // exposed blot: penalize by how many opponent checkers sit within 12 behind it
        let shots = 0;
        for (let j = 0; j < 24; j++) { const oc = -s.pts[j] * sg; if (oc > 0) { const dist = p === 0 ? i - j : j - i; if (dist < 0 && -dist <= 12) shots++; } }
        if (s.bar[o]) shots += 2;
        v -= (lv >= 2 ? 4 : 2.5) * Math.min(shots, 4) * (1 + (p === 0 ? (23 - i) : i) / 24);
      }
      if (c >= 2) { const home = p === 0 ? i <= 6 : i >= 17; v += home ? 5 : 2; }
    }
    if (lv >= 2) { // primes
      let run = 0, best = 0;
      for (let k = 0; k < 24; k++) { const i = p === 0 ? k : 23 - k; if (s.pts[i] * sg >= 2) { run++; best = Math.max(best, run); } else run = 0; }
      v += best * best * 1.5;
    }
  }
  return v;
}
export function choose(s, seat, level = 'normal', traits = {}, rng = Math.random) {
  if (s.phase === 'roll') return { t: 'roll' };
  const lv = { easy: 0, normal: 1, hard: 2, expert: 3 }[level] ?? 1;
  const seqs = sequences(s, seat);
  if (!seqs.length) return null;
  if (lv === 0 && rng() < 0.4) { const m = seqs[Math.floor(rng() * seqs.length)][0]; return { t: 'move', ...m }; }
  let best = seqs[0], bv = -Infinity;
  for (const q of seqs) {
    const c = { pts: s.pts.slice(), bar: s.bar.slice(), off: s.off.slice(), dice: s.dice.slice() };
    for (const m of q) doStep(c, seat, m);
    const v = evalPos(c, seat, lv) + (rng() - 0.5) * [10, 3, 0.5, 0][lv];
    if (v > bv) { bv = v; best = q; }
  }
  return { t: 'move', ...best[0] };
}

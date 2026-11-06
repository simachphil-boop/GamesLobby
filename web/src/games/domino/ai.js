// Domino bots: prefer heavy tiles and doubles, keep suit variety, score fives, block opponents.
import { options } from './rules.js';
export function choose(s, seat, level = 'normal', traits = {}, rng = Math.random) {
  if (s.phase === 'roundOver') return { t: 'next' };
  const opts = options(s, seat);
  if (!opts.length) return s.variant !== 'block' && s.boneyard.length ? { t: 'draw' } : { t: 'pass' };
  const lv = { easy: 0, normal: 1, hard: 2, expert: 3 }[level] ?? 1;
  if (lv === 0 && rng() < 0.5) { const o = opts[Math.floor(rng() * opts.length)]; return { t: 'play', ...o }; }
  const hand = s.hands[seat];
  const count = Array(7).fill(0); for (const t of hand) { count[t.a]++; if (t.b !== t.a) count[t.b]++; }
  let best = opts[0], bv = -Infinity;
  for (const o of opts) {
    const t = hand.find((x) => x.id === o.id);
    let v = t.a + t.b + (t.a === t.b ? 4 : 0);
    let newEnd = t.a + t.b;
    if (s.ends) {
      const e = o.side === 'L' ? s.ends[0] : s.ends[1];
      newEnd = t.a === e ? t.b : t.a;
      v += count[newEnd] * (lv >= 2 ? 3 : 1.5);
      if (s.variant === 'fives') { const other = o.side === 'L' ? s.ends[1] : s.ends[0]; const sum = newEnd + other; if (sum % 5 === 0) v += sum * 2; }
    }
    v += rng() * [5, 2, 0.5, 0][lv];
    if (v > bv) { bv = v; best = o; }
  }
  return { t: 'play', ...best };
}

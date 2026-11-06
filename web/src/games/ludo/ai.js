// Ludo bots: score each movable token (capture, finish, leave base, safety, progress).
import { movable, target, absCell, SAFE } from './rules.js';
export function choose(s, seat, level = 'normal', traits = {}, rng = Math.random) {
  if (s.phase === 'roll') return { t: 'roll' };
  const ms = movable(s, seat);
  const lv = { easy: 0, normal: 1, hard: 2, expert: 3 }[level] ?? 1;
  if (lv === 0 && rng() < 0.5) return { t: 'move', token: ms[Math.floor(rng() * ms.length)] };
  const color = s.colors[seat];
  const enemyAt = (cell) => s.tokens.some((tk, o) => o !== seat && tk.some((r) => r >= 0 && r <= 50 && absCell(s.colors[o], r) === cell));
  const danger = (cell) => { if (SAFE.includes(cell)) return 0; let d = 0; s.tokens.forEach((tk, o) => { if (o === seat) return; tk.forEach((r) => { if (r < 0 || r > 50) return; const dist = (cell - absCell(s.colors[o], r) + 52) % 52; if (dist >= 1 && dist <= 6) d++; }); }); return d; };
  let best = ms[0], bv = -Infinity;
  for (const k of ms) {
    const r = s.tokens[seat][k], to = target(s, seat, k);
    let v = to * 0.5;
    if (r === -1) v += 25;
    if (to === 56) v += 40;
    if (to > 50 && r <= 50) v += 15;
    if (to <= 50) {
      const cell = absCell(color, to);
      if (!SAFE.includes(cell) && enemyAt(cell)) v += 50 + (traits.aggression ?? 0.5) * 10;
      if (SAFE.includes(cell)) v += 8;
      if (lv >= 2) v -= danger(cell) * 9;
    }
    if (lv >= 2 && r >= 0 && r <= 50) v += danger(absCell(color, r)) * 7;
    v += rng() * [6, 3, 1, 0][lv];
    if (v > bv) { bv = v; best = k; }
  }
  return { t: 'move', token: best };
}

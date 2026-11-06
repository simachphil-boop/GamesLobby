// Chess bots: iterative-deepening alpha-beta with quiescence; strength by depth/noise/time.
import * as E from './engine.js';

const CFG = {
  easy: { depth: 1, noise: 260, q: false, time: 300 },
  normal: { depth: 2, noise: 60, q: true, time: 800 },
  hard: { depth: 3, noise: 12, q: true, time: 1500 },
  expert: { depth: 5, noise: 0, q: true, time: 2600 },
};
export function choose(s, seat, level = 'normal', traits = {}, rng = Math.random) {
  const c = CFG[level] || CFG.normal;
  const pos = { ...s.pos, b: s.pos.b.slice() };
  const moves = E.legalMoves(pos);
  if (!moves.length) return { t: 'resign' };
  if (level === 'easy' && rng() < 0.25 + (traits.mistakes || 0)) {
    const m = moves[Math.floor(rng() * moves.length)];
    return { t: 'move', from: m.f, to: m.t, p: m.p || null, spent: 900 };
  }
  // tiny opening book feel: vary first moves
  const t0 = Date.now();
  const m = E.search(pos, c.depth, { timeMs: c.time, quiesce: c.q, noise: c.noise + (s.history.length < 4 ? 25 : 0), rng });
  return { t: 'move', from: m.f, to: m.t, p: m.p || null, spent: Math.max(800, Date.now() - t0 + 600) };
}

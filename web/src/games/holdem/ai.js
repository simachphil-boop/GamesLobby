// Hold'em bots: Monte-Carlo equity vs. live opponents + pot odds, with persona-driven aggression/bluffs.
import { evaluate, toCall, pot, rankOf, suitOf } from './rules.js';
function equity(s, seat, sims, rng) {
  const opp = [...Array(s.n).keys()].filter((i) => i !== seat && !s.folded[i]);
  const known = new Set([...s.hole[seat], ...s.board]);
  const pool = [...Array(52).keys()].filter((c) => !known.has(c));
  let win = 0;
  for (let k = 0; k < sims; k++) {
    const d = pool.slice();
    for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    let p = 0;
    const board = [...s.board]; while (board.length < 5) board.push(d[p++]);
    const me = evaluate([...s.hole[seat], ...board]);
    let best = true, tie = 0;
    for (const o of opp) { const v = evaluate([d[p++], d[p++], ...board]); if (v > me) { best = false; break; } if (v === me) tie++; }
    if (best) win += tie ? 1 / (tie + 1) : 1;
  }
  return win / sims;
}
function preflop(s, seat) {
  const [a, b] = s.hole[seat]; const ra = rankOf(a), rb = rankOf(b);
  let v = (Math.max(ra, rb) + 2) / 14 * 0.5 + (ra === rb ? 0.35 : 0) + (suitOf(a) === suitOf(b) ? 0.06 : 0) - Math.min(4, Math.abs(ra - rb)) * 0.025;
  return Math.min(1, v);
}
export function choose(s, seat, level = 'normal', traits = {}, rng = Math.random) {
  const lv = { easy: 0, normal: 1, hard: 2, expert: 3 }[level] ?? 1;
  const tc = toCall(s, seat), P = pot(s), stack = s.chips[seat];
  const live = [...Array(s.n).keys()].filter((i) => !s.folded[i]).length;
  let eq = lv === 0 || s.board.length === 0 && lv === 1 ? preflop(s, seat) * (2 / live) ** 0.5 : equity(s, seat, [0, 120, 260, 450][lv], rng);
  if (lv === 0) eq += (rng() - 0.5) * 0.3;
  const odds = tc / (P + tc || 1);
  const aggr = (traits.aggression ?? 0.5), risk = traits.risk ?? 0.5;
  const bluff = rng() < (0.03 + risk * 0.06) * (lv >= 2 ? 1 : 0.5);
  const strong = eq > 0.62 - aggr * 0.1 + (live - 2) * 0.03;
  const raiseTo = (frac) => { const to = Math.min(s.bets[seat] + stack, Math.max(s.currentBet + s.minRaise, Math.round((s.currentBet + P * frac) / 5) * 5)); return to; };
  if ((strong || bluff) && stack > tc) {
    const to = raiseTo(eq > 0.8 ? 1 : 0.6 + aggr * 0.3);
    if (to > s.currentBet) return { t: 'raise', to };
  }
  if (tc === 0) return { t: 'check' };
  if (eq > odds + 0.04 - risk * 0.06 || (tc <= s.bb && eq > 0.2)) return tc >= stack && eq < 0.5 && lv >= 2 ? { t: 'fold' } : { t: 'call' };
  return { t: 'fold' };
}

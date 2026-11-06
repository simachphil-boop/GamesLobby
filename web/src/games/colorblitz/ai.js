// COLOR BLITZ bot AI.
//  easy: random legal card, sometimes forgets to call ONE, rarely catches others
//  normal: matches the color it holds most of, saves wild cards
//  hard: attacks a next player who is close to winning, catches un-called ONE
//  expert: also picks colors opponents are known to lack and times +4 cards
import { playableCards, COLORS, top } from './rules.js';

const LV = { easy: 0, normal: 1, hard: 2, expert: 3 };

function bestColor(s, seat, level) {
  const hand = s.hands[seat];
  const count = Object.fromEntries(COLORS.map((c) => [c, 0]));
  for (const c of hand) if (c.c !== 'w') count[c.c] += /^\d$/.test(c.v) ? 1 : 1.3;
  if (LV[level] >= 3) {
    const nxt = ((seat + s.dir) % s.n + s.n) % s.n;
    for (const c of s.lacks[nxt] || []) count[c] += 1.5;
  }
  return COLORS.reduce((a, b) => (count[b] > count[a] ? b : a), COLORS[0]);
}

export function choose(s, seat, level = 'normal', traits = {}, rng = Math.random) {
  const lv = LV[level] ?? 1;
  if (s.phase === 'roundOver') return { t: 'next' };
  // catch an opponent who forgot to call ONE
  if (s.phase === 'play' && s.unsaid !== null && s.unsaid !== seat && s.hands[s.unsaid].length === 1) {
    if (rng() < [0.25, 0.6, 0.85, 1][lv]) return { t: 'catch' };
  }
  const cards = playableCards(s, seat);
  if (!cards.length) return s.phase === 'afterDraw' ? { t: 'pass' } : { t: 'draw' };
  const mistake = [0.2, 0.05, 0.02, 0][lv] + (traits.mistakes || 0);
  if (s.phase === 'play' && rng() < mistake * 0.5 && s.pending === 0) return { t: 'draw' };
  const hand = s.hands[seat];
  const nxt = ((seat + s.dir) % s.n + s.n) % s.n;
  const danger = s.hands[nxt].length <= 2;
  const myColor = bestColor(s, seat, level);
  let pick;
  if (lv === 0) pick = cards[Math.floor(rng() * cards.length)];
  else {
    const scored = cards.map((c) => {
      let sc = 0;
      if (c.c === 'w') sc -= c.v === 'd4' ? 6 : 4;                 // save wilds
      if (c.c === myColor) sc += 3;
      if (/^\d$/.test(c.v)) sc += +c.v / 10;                        // dump high numbers
      if (['skip', 'rev', 'd2'].includes(c.v)) sc += danger && lv >= 2 ? 6 : 1;
      if (c.v === 'd4' && danger && lv >= 2) sc += 9;
      if (hand.length <= 2 && c.c === 'w') sc += 5;                 // finish strong
      if (lv >= 3 && c.c !== 'w' && (s.lacks[nxt] || []).includes(c.c)) sc += 2.5;
      sc += (traits.aggression ?? 0.5) * (['d2', 'skip'].includes(c.v) ? 1.5 : 0);
      return { c, sc: sc + rng() * 0.6 };
    });
    scored.sort((a, b) => b.sc - a.sc);
    pick = scored[0].c;
  }
  const a = { t: 'play', id: pick.id };
  if (pick.c === 'w') a.color = lv === 0 ? COLORS[Math.floor(rng() * 4)] : bestColor(s, seat, level);
  if (hand.length === 2) a.one = rng() < [0.55, 0.9, 0.97, 1][lv];
  return a;
}

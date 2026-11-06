import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/games/chess/engine.js';
import * as R from '../src/games/chess/rules.js';
import * as AI from '../src/games/chess/ai.js';
import { makeRng } from '../src/core/rng.js';

function perft(pos, d) {
  if (d === 0) return 1;
  let n = 0;
  for (const m of E.legalMoves(pos)) { const u = E.make(pos, m); n += perft(pos, d - 1); E.unmake(pos, m, u); }
  return n;
}
test('perft start position', () => {
  const p = E.fromFEN(E.START);
  assert.equal(perft(p, 1), 20); assert.equal(perft(p, 2), 400); assert.equal(perft(p, 3), 8902);
});
test('perft kiwipete (castling, ep, promotions)', () => {
  const p = E.fromFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
  assert.equal(perft(p, 1), 48); assert.equal(perft(p, 2), 2039); assert.equal(perft(p, 3), 97862);
});
test('perft position 3 (en passant edge cases)', () => {
  const p = E.fromFEN('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1');
  assert.equal(perft(p, 3), 2812); assert.equal(perft(p, 4), 43238);
});
test('fools mate detected', () => {
  let s = R.setup({}, 2, 1);
  const sq = (n) => 'abcdefgh'.indexOf(n[0]) + (+n[1] - 1) * 8;
  for (const [f, t] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]) s = R.apply(s, { t: 'move', from: sq(f), to: sq(t) }, R.actor(s));
  assert.equal(s.result.reason, 'mate'); assert.equal(s.result.winner, 1);
  assert.equal(s.history[3].san, 'Qh4#');
});
test('bots play complete games', () => {
  for (let g = 0; g < 3; g++) {
    let s = R.setup({}, 2, g + 3);
    const rng = makeRng(g);
    let n = 0;
    while (!R.isOver(s) && n < 300) { const seat = R.actor(s); s = R.apply(s, AI.choose(s, seat, ['easy', 'normal'][(seat + g) % 2], {}, rng), seat); n++; }
    assert.ok(n > 4);
  }
});

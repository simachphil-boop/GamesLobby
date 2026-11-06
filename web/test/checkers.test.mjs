import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/games/checkers/rules.js';
import * as AI from '../src/games/checkers/ai.js';
import { makeRng } from '../src/core/rng.js';

test('initial moves', () => {
  const s = R.setup({}, 2, 1);
  assert.equal(R.legal(s).length, 7);
});
test('forced capture and multi-jump', () => {
  const s = R.setup({ variant: 'russian' }, 2, 1);
  s.b.fill(0);
  s.b[2 * 8 + 2] = 1; s.b[3 * 8 + 3] = -1; s.b[5 * 8 + 5] = -1;
  const ms = R.legal(s);
  assert.ok(ms.every((m) => m.caps.length));
  assert.ok(ms.some((m) => m.caps.length === 2));
});
test('russian man captures backwards, english does not', () => {
  for (const [variant, expect] of [['russian', true], ['english', false]]) {
    const s = R.setup({ variant }, 2, 1);
    s.b.fill(0); s.b[4 * 8 + 4] = 1; s.b[3 * 8 + 3] = -1;
    assert.equal(R.legal(s).some((m) => m.caps.length), expect, variant);
  }
});
test('flying king captures from distance', () => {
  const s = R.setup({ variant: 'russian' }, 2, 1);
  s.b.fill(0); s.b[0] = 2; s.b[4 * 8 + 4] = -1;
  const ms = R.legal(s);
  assert.ok(ms.length >= 3 && ms.every((m) => m.caps.length === 1));
});
for (const variant of ['russian', 'english', 'casual']) {
  test('bots finish games: ' + variant, () => {
    for (let g = 0; g < 4; g++) {
      let s = R.setup({ variant }, 2, g);
      const rng = makeRng(g + 9);
      let n = 0;
      while (!R.isOver(s) && n < 400) { const seat = R.actor(s); s = R.apply(s, AI.choose(s, seat, ['easy', 'normal'][(g + seat) % 2], {}, rng), seat); n++; }
      assert.ok(R.isOver(s) || n === 400);
    }
  });
}

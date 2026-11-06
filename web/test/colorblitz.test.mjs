import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/games/colorblitz/rules.js';
import * as AI from '../src/games/colorblitz/ai.js';
import { makeRng } from '../src/core/rng.js';

const total = (s) => s.deck.length + s.discard.length + s.hands.reduce((a, h) => a + h.length, 0);

for (const variant of ['classic', 'stack', 'drawUntil', 'strict']) {
  test('colorblitz bots finish matches: ' + variant, () => {
    for (let seed = 1; seed <= 40; seed++) {
      const n = 2 + (seed % 3);
      let s = R.setup({ variant, duration: seed % 2 ? 'short' : 'single' }, n, seed * 101);
      const rng = makeRng(seed);
      let steps = 0;
      while (!R.isOver(s)) {
        const seat = R.actor(s);
        const a = AI.choose(s, seat, ['easy', 'normal', 'hard', 'expert'][(seat + seed) % 4], {}, rng);
        assert.ok(R.validate(s, a, seat), 'invalid ' + JSON.stringify(a) + ' phase ' + s.phase);
        s = R.apply(s, a, seat);
        assert.equal(total(s), 108, 'card conservation');
        const tp = R.top(s);
        if (tp.c !== 'w') assert.ok(s.color === tp.c || ['skip', 'rev', 'd2'].includes(tp.v) || /^\d$/.test(tp.v));
        if (++steps > 20000) throw new Error('no end ' + seed);
      }
      assert.ok(s.winner >= 0);
    }
  });
}

test('colorblitz playability', () => {
  const s = R.setup({}, 2, 7);
  s.discard = [{ id: 900, c: 'r', v: '5' }]; s.color = 'r';
  assert.ok(R.playable(s, 0, { c: 'r', v: '1' }));
  assert.ok(R.playable(s, 0, { c: 'b', v: '5' }));
  assert.ok(!R.playable(s, 0, { c: 'b', v: '6' }));
  assert.ok(R.playable(s, 0, { c: 'w', v: 'd4' }));
});

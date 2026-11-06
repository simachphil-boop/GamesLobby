import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/core/rng.js';
async function run(name, opts, n, games = 6, cap = 4000) {
  const R = await import(`../src/games/${name}/rules.js`), AI = await import(`../src/games/${name}/ai.js`);
  for (let g = 0; g < games; g++) {
    let s = R.setup(opts, n, g + 11); const rng = makeRng(g); let k = 0;
    while (!R.isOver(s)) {
      const seat = R.actor(s); const a = await AI.choose(s, seat, ['easy', 'normal', 'hard', 'expert'][(g + seat) % 4], {}, rng);
      assert.ok(R.validate(s, a, seat), name + ' invalid ' + JSON.stringify(a)); s = R.apply(s, a, seat);
      if (++k > cap) throw new Error(name + ' no end');
    }
  }
}
test('fourrow', () => run('fourrow', {}, 2));
test('backgammon', () => run('backgammon', {}, 2));
test('backgammon nack', () => run('backgammon', { variant: 'nack' }, 2));
test('ludo 2-4', async () => { for (const n of [2, 3, 4]) await run('ludo', {}, n, 4, 20000); });
test('ludo easy', () => run('ludo', { variant: 'easy' }, 4, 3, 20000));
test('domino variants', async () => { for (const variant of ['block', 'draw', 'fives']) for (const n of [2, 3, 4]) await run('domino', { variant, duration: 'short' }, n, 2, 20000); });
test('holdem evaluator', async () => {
  const R = await import('../src/games/holdem/rules.js');
  const c = (r, s) => s * 13 + r; // r: 0=2..12=A
  const royal = R.evaluate([c(12, 0), c(11, 0), c(10, 0), c(9, 0), c(8, 0), c(0, 1), c(1, 2)]);
  const quads = R.evaluate([c(5, 0), c(5, 1), c(5, 2), c(5, 3), c(8, 0), c(0, 1), c(1, 2)]);
  const wheel = R.evaluate([c(12, 0), c(0, 1), c(1, 2), c(2, 3), c(3, 0), c(9, 1), c(10, 2)]);
  const pair = R.evaluate([c(5, 0), c(5, 1), c(2, 2), c(9, 3), c(8, 0), c(0, 1), c(11, 2)]);
  assert.equal(R.category(royal), 8); assert.equal(R.category(quads), 7); assert.equal(R.category(wheel), 4); assert.equal(R.category(pair), 1);
  assert.ok(royal > quads && quads > wheel && wheel > pair);
});
test('holdem chips conserved', async () => {
  const R = await import('../src/games/holdem/rules.js'), AI = await import('../src/games/holdem/ai.js');
  for (const n of [2, 3, 5]) { let s = R.setup({ duration: 'short' }, n, n); const rng = makeRng(n); let k = 0;
    while (!R.isOver(s)) { const a = AI.choose(s, R.actor(s), 'normal', {}, rng); assert.ok(R.validate(s, a, R.actor(s)), JSON.stringify(a)); s = R.apply(s, a, R.actor(s));
      assert.equal(s.chips.reduce((x, y) => x + y, 0) + R.pot(s), 1000 * n); if (++k > 5000) throw new Error('loop'); } }
});

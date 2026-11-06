import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/games/tycoon/rules.js';
import * as AI from '../src/games/tycoon/ai.js';
import { TILES } from '../src/games/tycoon/boards.js';
import { makeRng } from '../src/core/rng.js';

function play(seed, n, levels, opts = {}) {
  let s = R.setup({ board: 'classic', duration: opts.duration || 'full', variant: opts.variant || 'classic' }, n, seed);
  const rng = makeRng(seed + 1);
  let steps = 0;
  while (!R.isOver(s)) {
    const seat = R.actor(s);
    const a = AI.choose(s, seat, levels[seat], { risk: 0.5, aggression: 0.5 }, rng);
    assert.ok(R.validate(s, a, seat), `invalid action ${JSON.stringify(a)} in phase ${s.phase} seed ${seed} step ${steps}`);
    s = R.apply(s, a, seat);
    // invariants
    const houses = s.tiles.reduce((acc, t) => acc + (t.houses > 0 && t.houses < 5 ? t.houses : 0), 0);
    const hotels = s.tiles.filter((t) => t.houses === 5).length;
    assert.equal(houses + s.houses, 32, 'house supply');
    assert.equal(hotels + s.hotels, 12, 'hotel supply');
    s.players.forEach((p, i) => { if (!p.out && s.phase !== 'debt') assert.ok(p.cash >= 0, `negative cash p${i} ${p.cash}`); });
    s.tiles.forEach((t, i) => { if (t.houses) assert.ok(!t.mort && t.owner >= 0, 'houses on mortgaged/unowned'); });
    if (++steps > 20000) throw new Error('did not terminate, seed ' + seed);
  }
  return { s, steps };
}

test('tycoon: bots finish full games with consistent state', () => {
  let total = 0, rounds = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const n = 2 + (seed % 3);
    const lv = ['easy', 'normal', 'hard', 'expert'];
    const { s, steps } = play(seed * 7919, n, Array.from({ length: n }, (_, i) => lv[(seed + i) % 4]), { variant: ['classic', 'jackpot', 'speed'][seed % 3] });
    total += steps; rounds += s.round;
    assert.ok(s.winner >= 0);
  }
  console.log('avg steps', total / 40, 'avg rounds', rounds / 40);
});

test('tycoon: short duration ends by round limit with richest winner', () => {
  const { s } = play(99, 4, ['normal', 'normal', 'normal', 'normal'], { duration: 'short' });
  assert.ok(s.round <= 21);
  const nw = s.players.map((_, i) => R.netWorth(s, i));
  assert.equal(nw[s.winner], Math.max(...s.players.map((p, i) => (p.out ? -1 : nw[i]))));
});

test('tycoon: rent rules', () => {
  let s = R.setup({}, 2, 5);
  s.tiles[1].owner = 1; s.tiles[3].owner = 1;
  assert.equal(R.rentFor(s, 1, 7), 4); // monopoly doubles base rent
  s.tiles[3].owner = 0;
  assert.equal(R.rentFor(s, 1, 7), 2);
  s.tiles[5].owner = 1; s.tiles[15].owner = 1; s.tiles[25].owner = 1;
  assert.equal(R.rentFor(s, 5, 7), 100);
  s.tiles[12].owner = 1; assert.equal(R.rentFor(s, 12, 8), 32);
  s.tiles[28].owner = 1; assert.equal(R.rentFor(s, 12, 8), 80);
});

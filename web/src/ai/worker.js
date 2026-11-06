// AI worker entry: receives {game,state,seat,level,traits,seed} and returns the chosen action.
import { WORKER_AIS } from './registry.js';
import { makeRng } from '../core/rng.js';

self.onmessage = async (e) => {
  const { id, game, state, seat, level, traits, seed } = e.data;
  try {
    const fn = WORKER_AIS[game];
    if (!fn) throw new Error('no worker ai for ' + game);
    const action = await fn(state, seat, level, traits, makeRng(seed));
    self.postMessage({ id, action });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message || err) });
  }
};

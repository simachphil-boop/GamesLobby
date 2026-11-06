// AIs that run inside the worker (pure modules only — no DOM/three imports).
import * as tictactoe from '../games/tictactoe/ai.js';

export const WORKER_AIS = {
  tictactoe: tictactoe.choose,
};

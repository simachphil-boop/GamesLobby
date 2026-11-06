// AIs that run inside the worker (pure modules only — no DOM/three imports).
import * as tictactoe from '../games/tictactoe/ai.js';
import * as chess from '../games/chess/ai.js';
import * as checkers from '../games/checkers/ai.js';

export const WORKER_AIS = {
  tictactoe: tictactoe.choose,
  chess: chess.choose,
  checkers: checkers.choose,
};

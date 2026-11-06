// Game Library registry: every game is an independent module with its own rules/state/AI/view.
import tycoon from './tycoon/index.js';
import tictactoe from './tictactoe/index.js';

export const GAMES = [tycoon, tictactoe];

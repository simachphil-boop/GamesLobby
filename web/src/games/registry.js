// Game Library registry: every game is an independent module with its own rules/state/AI/view.
import tycoon from './tycoon/index.js';
import colorblitz from './colorblitz/index.js';
import chess from './chess/index.js';
import checkers from './checkers/index.js';
import fourrow from './fourrow/index.js';
import backgammon from './backgammon/index.js';
import ludo from './ludo/index.js';
import domino from './domino/index.js';
import holdem from './holdem/index.js';
import tictactoe from './tictactoe/index.js';

export const GAMES = [tycoon, colorblitz, holdem, chess, checkers, backgammon, ludo, domino, fourrow, tictactoe];

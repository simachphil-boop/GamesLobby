// Tic-Tac-Toe AI: perfect minimax on 3×3; alpha-beta with a line heuristic on bigger boards.
import { legal, findLine } from './rules.js';

function score(cells, size, k, me) {
  // count open windows weighted by length
  let sc = 0;
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) for (const [dx, dy] of dirs) {
    const ex = x + dx * (k - 1), ey = y + dy * (k - 1);
    if (ex < 0 || ey < 0 || ex >= size || ey >= size) continue;
    let mine = 0, theirs = 0;
    for (let i = 0; i < k; i++) { const c = cells[(y + dy * i) * size + x + dx * i]; if (c === me) mine++; else if (c !== null) theirs++; }
    if (mine && !theirs) sc += Math.pow(10, mine);
    if (theirs && !mine) sc -= Math.pow(10, theirs) * 1.1;
  }
  return sc;
}

function search(cells, size, k, turn, me, depth, alpha, beta, last) {
  if (last != null && findLine(cells, size, k, last)) return (cells[last] === me ? 1 : -1) * (100000 + depth);
  const moves = []; cells.forEach((c, i) => { if (c === null) moves.push(i); });
  if (!moves.length) return 0;
  if (depth === 0) return score(cells, size, k, me);
  // center-first ordering
  const c = (size - 1) / 2;
  moves.sort((a, b) => (Math.abs(a % size - c) + Math.abs(Math.floor(a / size) - c)) - (Math.abs(b % size - c) + Math.abs(Math.floor(b / size) - c)));
  if (turn === me) {
    let best = -Infinity;
    for (const m of moves) { cells[m] = turn; best = Math.max(best, search(cells, size, k, 1 - turn, me, depth - 1, alpha, beta, m)); cells[m] = null; alpha = Math.max(alpha, best); if (alpha >= beta) break; }
    return best;
  }
  let best = Infinity;
  for (const m of moves) { cells[m] = turn; best = Math.min(best, search(cells, size, k, 1 - turn, me, depth - 1, alpha, beta, m)); cells[m] = null; beta = Math.min(beta, best); if (alpha >= beta) break; }
  return best;
}

export function choose(s, seat, level, traits, rng = Math.random) {
  const moves = legal(s);
  const mistake = { easy: 0.45, normal: 0.18, hard: 0.05, expert: 0 }[level] + (traits?.mistakes || 0);
  // always take an immediate win / block (except sometimes on easy)
  const cells = s.cells.slice();
  for (const who of [seat, 1 - seat]) {
    for (const m of moves) { cells[m] = who; const w = findLine(cells, s.size, s.k, m); cells[m] = null; if (w && !(level === 'easy' && rng() < 0.3)) return { cell: m }; }
  }
  if (rng() < mistake) return { cell: moves[Math.floor(rng() * moves.length)] };
  const depth = s.size === 3 ? 9 : { easy: 1, normal: 2, hard: 3, expert: 4 }[level];
  let best = -Infinity, bestMoves = [];
  for (const m of moves) {
    cells[m] = seat;
    const v = search(cells, s.size, s.k, 1 - seat, seat, depth - 1, -Infinity, Infinity, m);
    cells[m] = null;
    if (v > best) { best = v; bestMoves = [m]; } else if (v === best) bestMoves.push(m);
  }
  return { cell: bestMoves[Math.floor(rng() * bestMoves.length)] };
}

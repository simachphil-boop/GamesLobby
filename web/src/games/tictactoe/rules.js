// Tic-Tac-Toe rules: N×N board, K in a row wins (3×3/3, 4×4/4, 5×5/4).
export function setup(opts = {}, n = 2, seed = 1) {
  const size = parseInt(opts.size || 3, 10);
  const k = size === 3 ? 3 : 4;
  return { size, k, cells: Array(size * size).fill(null), turn: 0, winner: null, line: null, seed, moves: 0, first: 0 };
}
export const actor = (s) => s.turn;
export const isOver = (s) => s.winner !== null;
export function legal(s) { const r = []; s.cells.forEach((c, i) => { if (c === null) r.push(i); }); return r; }
export function validate(s, a, seat) { return seat === s.turn && Number.isInteger(a.cell) && s.cells[a.cell] === null && s.winner === null; }

const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
export function findLine(cells, size, k, idx) {
  const p = cells[idx];
  if (p === null) return null;
  const x0 = idx % size, y0 = Math.floor(idx / size);
  for (const [dx, dy] of DIRS) {
    const line = [idx];
    for (const sgn of [1, -1]) {
      let x = x0 + dx * sgn, y = y0 + dy * sgn;
      while (x >= 0 && y >= 0 && x < size && y < size && cells[y * size + x] === p) { line.push(y * size + x); x += dx * sgn; y += dy * sgn; }
    }
    if (line.length >= k) return line;
  }
  return null;
}

export function apply(s, a, seat) {
  const n = { ...s, cells: s.cells.slice() };
  n.cells[a.cell] = s.turn;
  n.moves++;
  const line = findLine(n.cells, n.size, n.k, a.cell);
  if (line) { n.winner = s.turn; n.line = line; }
  else if (n.cells.every((c) => c !== null)) n.winner = -1;
  n.turn = 1 - s.turn;
  return n;
}
export function result(s) {
  if (s.winner === -1) return { winners: [], draw: true, ranking: [0, 1] };
  return { winners: [s.winner], ranking: [s.winner, 1 - s.winner] };
}

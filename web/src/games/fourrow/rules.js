// FOUR IN A ROW rules (Connect-Four-style): drop discs into columns, 4 in a row wins.
import { clone } from '../../core/util.js';
const SIZES = { classic: [7, 6], big: [8, 7], huge: [9, 7] };
export function setup(opts = {}, n = 2, seed = 1) {
  const [W, H] = SIZES[opts.size || 'classic'] || SIZES.classic;
  return { W, H, cells: Array(W * H).fill(-1), turn: 0, winner: null, line: null, moves: 0, seed, ev: [] };
}
export const actor = (s) => s.turn;
export const isOver = (s) => s.winner !== null;
export const dropRow = (cells, W, H, c) => { for (let r = 0; r < H; r++) if (cells[r * W + c] === -1) return r; return -1; };
export const legal = (s) => [...Array(s.W).keys()].filter((c) => dropRow(s.cells, s.W, s.H, c) >= 0);
export function lineAt(cells, W, H, idx) {
  const p = cells[idx]; if (p < 0) return null;
  const x0 = idx % W, y0 = Math.floor(idx / W);
  for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    const line = [idx];
    for (const sg of [1, -1]) { let x = x0 + dx * sg, y = y0 + dy * sg; while (x >= 0 && y >= 0 && x < W && y < H && cells[y * W + x] === p) { line.push(y * W + x); x += dx * sg; y += dy * sg; } }
    if (line.length >= 4) return line;
  }
  return null;
}
export function validate(s, a, seat) { return s.winner === null && seat === s.turn && a.t === 'drop' && legal(s).includes(a.col); }
export function apply(s0, a, seat) {
  const s = clone(s0); s.ev = [];
  if (!validate(s, a, seat)) throw new Error('illegal');
  const r = dropRow(s.cells, s.W, s.H, a.col), idx = r * s.W + a.col;
  s.cells[idx] = seat; s.moves++;
  s.ev.push({ t: 'drop', col: a.col, row: r, seat });
  const line = lineAt(s.cells, s.W, s.H, idx);
  if (line) { s.winner = seat; s.line = line; } else if (s.moves === s.W * s.H) s.winner = -1;
  s.turn = 1 - seat;
  return s;
}
export function result(s) { return s.winner === -1 ? { winners: [], draw: true, ranking: [0, 1] } : { winners: [s.winner], ranking: [s.winner, 1 - s.winner] }; }

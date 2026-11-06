// Four-in-a-row bots: alpha-beta with window scoring, center-first ordering.
import { dropRow, lineAt, legal } from './rules.js';
function score(cells, W, H, me) {
  let sc = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    const ex = x + dx * 3, ey = y + dy * 3; if (ex < 0 || ex >= W || ey < 0 || ey >= H) continue;
    let a = 0, b = 0; for (let i = 0; i < 4; i++) { const c = cells[(y + dy * i) * W + x + dx * i]; if (c === me) a++; else if (c >= 0) b++; }
    if (a && !b) sc += [0, 1, 6, 40][a]; if (b && !a) sc -= [0, 1, 7, 50][b];
  }
  for (let y = 0; y < H; y++) { const c = cells[y * W + (W >> 1)]; if (c === me) sc += 3; else if (c >= 0) sc -= 3; }
  return sc;
}
function search(cells, W, H, turn, me, d, al, be, last) {
  if (last >= 0 && lineAt(cells, W, H, last)) return (cells[last] === me ? 1 : -1) * (100000 + d);
  const cols = [...Array(W).keys()].filter((c) => dropRow(cells, W, H, c) >= 0).sort((a, b) => Math.abs(a - (W - 1) / 2) - Math.abs(b - (W - 1) / 2));
  if (!cols.length) return 0; if (d === 0) return score(cells, W, H, me);
  let best = turn === me ? -Infinity : Infinity;
  for (const c of cols) {
    const r = dropRow(cells, W, H, c), i = r * W + c; cells[i] = turn;
    const v = search(cells, W, H, 1 - turn, me, d - 1, al, be, i); cells[i] = -1;
    if (turn === me) { best = Math.max(best, v); al = Math.max(al, v); } else { best = Math.min(best, v); be = Math.min(be, v); }
    if (al >= be) break;
  }
  return best;
}
export function choose(s, seat, level = 'normal', traits = {}, rng = Math.random) {
  const cols = legal(s);
  const depth = { easy: 1, normal: 3, hard: 5, expert: 7 }[level] ?? 3;
  if (level === 'easy' && rng() < 0.35) return { t: 'drop', col: cols[Math.floor(rng() * cols.length)] };
  const cells = s.cells.slice(); let best = cols[0], bv = -Infinity;
  for (const c of cols) {
    const r = dropRow(cells, s.W, s.H, c), i = r * s.W + c; cells[i] = seat;
    const v = search(cells, s.W, s.H, 1 - seat, seat, depth - 1, -Infinity, Infinity, i) + (rng() - 0.5) * (level === 'normal' ? 8 : 1); cells[i] = -1;
    if (v > bv) { bv = v; best = c; }
  }
  return { t: 'drop', col: best };
}

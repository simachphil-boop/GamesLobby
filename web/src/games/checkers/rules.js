// CHECKERS rules: Russian (flying kings, men capture backwards), English (short kings), Casual (no forced capture).
// Board: 64 squares (r*8+f), only dark squares ((r+f)%2===0) are used.
// Pieces: 1 light man, 2 light king, -1 dark man, -2 dark king. Light starts on rows 0-2 and moves up.
import { clone } from '../../core/util.js';

export function setup(opts = {}, n = 2, seed = 1) {
  const b = Array(64).fill(0);
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) if ((r + f) % 2 === 0) { if (r < 3) b[r * 8 + f] = 1; if (r > 4) b[r * 8 + f] = -1; }
  let lightSeat = 0;
  if (opts.side === 'dark') lightSeat = 1; else if (opts.side === 'random') lightSeat = seed % 2;
  return { b, turn: 1, lightSeat, variant: opts.variant || 'russian', quiet: 0, winner: null, last: null, seed, ev: [], moves: 0 };
}
export const actor = (s) => (s.turn === 1 ? s.lightSeat : 1 - s.lightSeat);
export const isOver = (s) => s.winner !== null;
const inside = (r, f) => r >= 0 && r < 8 && f >= 0 && f < 8;
const DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

/** All legal moves for side `turn` (1 light / -1 dark). Move: {path:[sq...], caps:[sq...], promote} */
export function genMoves(b, turn, variant) {
  const caps = [], quiet = [];
  const flying = variant === 'russian';
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq];
    if (!p || Math.sign(p) !== turn) continue;
    const king = Math.abs(p) === 2;
    const r0 = sq >> 3, f0 = sq & 7;
    // captures (DFS)
    const dfs = (r, f, isKing, path, taken) => {
      let extended = false;
      for (const [dr, df] of DIRS) {
        if (!isKing && variant !== 'russian' && dr !== turn) continue; // english/casual men capture forward only
        if (isKing && flying) {
          let rr = r + dr, ff = f + df;
          while (inside(rr, ff) && b[rr * 8 + ff] === 0 || (inside(rr, ff) && path.length && rr * 8 + ff === sq)) { rr += dr; ff += df; }
          if (!inside(rr, ff)) continue;
          const mid = rr * 8 + ff;
          if (Math.sign(b[mid]) !== -turn || taken.includes(mid)) continue;
          let lr = rr + dr, lf = ff + df;
          while (inside(lr, lf) && (b[lr * 8 + lf] === 0 || lr * 8 + lf === sq)) {
            const land = lr * 8 + lf;
            extended = true;
            dfs(lr, lf, true, [...path, land], [...taken, mid]);
            lr += dr; lf += df;
          }
        } else {
          const mr = r + dr, mf = f + df, lr = r + 2 * dr, lf = f + 2 * df;
          if (!inside(lr, lf)) continue;
          const mid = mr * 8 + mf, land = lr * 8 + lf;
          if (Math.sign(b[mid]) !== -turn || taken.includes(mid)) continue;
          if (b[land] !== 0 && land !== sq) continue;
          extended = true;
          const promoteNow = !isKing && (turn === 1 ? lr === 7 : lr === 0);
          if (promoteNow && variant !== 'russian') { caps.push({ path: [...path, land], caps: [...taken, mid], promote: true }); continue; }
          dfs(lr, lf, isKing || promoteNow, [...path, land], [...taken, mid]);
        }
      }
      if (!extended && taken.length) {
        const end = path[path.length - 1];
        const er = end >> 3;
        caps.push({ path, caps: taken, promote: !king && (turn === 1 ? er === 7 : er === 0) || (!king && isKing) });
      }
    };
    dfs(r0, f0, king, [sq], []);
    // quiet moves
    for (const [dr, df] of DIRS) {
      if (!king && dr !== turn) continue;
      let rr = r0 + dr, ff = f0 + df;
      while (inside(rr, ff) && b[rr * 8 + ff] === 0) {
        quiet.push({ path: [sq, rr * 8 + ff], caps: [], promote: !king && (turn === 1 ? rr === 7 : rr === 0) });
        if (!king || !flying) break;
        rr += dr; ff += df;
      }
    }
  }
  if (caps.length && variant !== 'casual') return caps;
  return [...caps, ...quiet];
}
export const legal = (s) => genMoves(s.b, s.turn, s.variant);
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
export function validate(s, a, seat) {
  if (s.winner !== null || seat !== actor(s) || a.t !== 'move') return false;
  return legal(s).some((m) => same(m.path, a.path) && same(m.caps, a.caps));
}
export function applyMove(b, m) {
  const from = m.path[0], to = m.path[m.path.length - 1];
  const p = b[from];
  b[from] = 0;
  for (const c of m.caps) b[c] = 0;
  b[to] = m.promote ? 2 * Math.sign(p) : p;
}
export function apply(s0, a, seat) {
  const s = clone(s0);
  s.ev = [];
  if (!validate(s, a, seat)) throw new Error('illegal ' + JSON.stringify(a));
  const m = legal(s).find((x) => same(x.path, a.path) && same(x.caps, a.caps));
  const moved = s.b[m.path[0]];
  applyMove(s.b, m);
  s.ev.push({ t: 'move', m, piece: moved });
  s.last = m;
  s.moves++;
  s.quiet = m.caps.length || Math.abs(moved) === 1 ? 0 : s.quiet + 1;
  s.turn = -s.turn;
  if (!legal(s).length) s.winner = seat;
  else if (s.quiet >= 50) s.winner = -1;
  return s;
}
export function result(s) {
  if (s.winner === -1) return { winners: [], draw: true, ranking: [0, 1] };
  return { winners: [s.winner], ranking: [s.winner, 1 - s.winner] };
}

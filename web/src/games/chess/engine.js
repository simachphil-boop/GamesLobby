// Chess engine core (pure): position representation, legal move generation, make/unmake,
// SAN notation, draw detection and an alpha-beta search used by the bots.
// Board: 64 squares, index = rank*8 + file (rank 0 = white's back rank). 'PNBRQK' white, 'pnbrqk' black.

export const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const N_OFF = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const K_OFF = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const B_DIR = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const R_DIR = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const isWhite = (p) => p && p === p.toUpperCase();
const sqName = (s) => 'abcdefgh'[s & 7] + ((s >> 3) + 1);
export { sqName };

export function fromFEN(fen) {
  const [rows, turn, cast, ep, hm, fm] = fen.split(' ');
  const b = Array(64).fill(null);
  rows.split('/').forEach((row, i) => {
    const r = 7 - i;
    let f = 0;
    for (const ch of row) { if (/\d/.test(ch)) f += +ch; else b[r * 8 + f++] = ch; }
  });
  let c = 0;
  if (cast.includes('K')) c |= 1; if (cast.includes('Q')) c |= 2; if (cast.includes('k')) c |= 4; if (cast.includes('q')) c |= 8;
  const eps = ep === '-' ? -1 : ('abcdefgh'.indexOf(ep[0]) + (parseInt(ep[1], 10) - 1) * 8);
  return { b, w: turn === 'w', c, ep: eps, hm: parseInt(hm || '0', 10), fm: parseInt(fm || '1', 10) };
}
export function key(pos) { return pos.b.map((p) => p || '.').join('') + (pos.w ? 'w' : 'b') + pos.c + '/' + pos.ep; }

export function isAttacked(pos, sq, byWhite) {
  const b = pos.b;
  const r = sq >> 3, f = sq & 7;
  // pawns
  const pr = byWhite ? r - 1 : r + 1;
  if (pr >= 0 && pr < 8) for (const df of [-1, 1]) {
    const ff = f + df;
    if (ff >= 0 && ff < 8) { const p = b[pr * 8 + ff]; if (p === (byWhite ? 'P' : 'p')) return true; }
  }
  for (const [dr, df] of N_OFF) { const rr = r + dr, ff = f + df; if (rr >= 0 && rr < 8 && ff >= 0 && ff < 8 && b[rr * 8 + ff] === (byWhite ? 'N' : 'n')) return true; }
  for (const [dr, df] of K_OFF) { const rr = r + dr, ff = f + df; if (rr >= 0 && rr < 8 && ff >= 0 && ff < 8 && b[rr * 8 + ff] === (byWhite ? 'K' : 'k')) return true; }
  for (const [dirs, kinds] of [[B_DIR, byWhite ? 'BQ' : 'bq'], [R_DIR, byWhite ? 'RQ' : 'rq']]) {
    for (const [dr, df] of dirs) {
      let rr = r + dr, ff = f + df;
      while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
        const p = b[rr * 8 + ff];
        if (p) { if (kinds.includes(p)) return true; break; }
        rr += dr; ff += df;
      }
    }
  }
  return false;
}
export function kingSq(pos, white) { return pos.b.indexOf(white ? 'K' : 'k'); }
export function inCheck(pos, white = pos.w) { const k = kingSq(pos, white); return k >= 0 && isAttacked(pos, k, !white); }

/** Pseudo-legal moves. m = {f, t, p?(promo lowercase), k?('ep'|'castle'|'double')} */
export function pseudoMoves(pos, capturesOnly = false) {
  const b = pos.b, W = pos.w, out = [];
  for (let s = 0; s < 64; s++) {
    const p = b[s];
    if (!p || isWhite(p) !== W) continue;
    const r = s >> 3, f = s & 7;
    const P = p.toUpperCase();
    const enemy = (q) => q && isWhite(q) !== W;
    if (P === 'P') {
      const d = W ? 1 : -1, start = W ? 1 : 6, last = W ? 7 : 0;
      const one = s + d * 8;
      const add = (t, k) => {
        if ((t >> 3) === last) for (const pr of ['q', 'r', 'b', 'n']) out.push({ f: s, t, p: pr, k });
        else out.push({ f: s, t, k });
      };
      if (!capturesOnly && one >= 0 && one < 64 && !b[one]) {
        add(one);
        const two = s + d * 16;
        if (r === start && !b[two]) out.push({ f: s, t: two, k: 'double' });
      }
      for (const df of [-1, 1]) {
        const ff = f + df;
        if (ff < 0 || ff > 7) continue;
        const t = (r + d) * 8 + ff;
        if (t < 0 || t > 63) continue;
        if (enemy(b[t])) add(t);
        else if (t === pos.ep) out.push({ f: s, t, k: 'ep' });
      }
      continue;
    }
    if (P === 'N' || P === 'K') {
      for (const [dr, df] of P === 'N' ? N_OFF : K_OFF) {
        const rr = r + dr, ff = f + df;
        if (rr < 0 || rr > 7 || ff < 0 || ff > 7) continue;
        const t = rr * 8 + ff;
        if (!b[t] ? !capturesOnly : enemy(b[t])) out.push({ f: s, t });
      }
      if (P === 'K' && !capturesOnly) {
        const home = W ? 4 : 60;
        if (s === home && !inCheck(pos, W)) {
          const [kBit, qBit] = W ? [1, 2] : [4, 8];
          if (pos.c & kBit && !b[home + 1] && !b[home + 2] && b[home + 3] === (W ? 'R' : 'r') && !isAttacked(pos, home + 1, !W) && !isAttacked(pos, home + 2, !W)) out.push({ f: s, t: home + 2, k: 'castle' });
          if (pos.c & qBit && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === (W ? 'R' : 'r') && !isAttacked(pos, home - 1, !W) && !isAttacked(pos, home - 2, !W)) out.push({ f: s, t: home - 2, k: 'castle' });
        }
      }
      continue;
    }
    const dirs = P === 'B' ? B_DIR : P === 'R' ? R_DIR : [...B_DIR, ...R_DIR];
    for (const [dr, df] of dirs) {
      let rr = r + dr, ff = f + df;
      while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
        const t = rr * 8 + ff;
        if (b[t]) { if (enemy(b[t])) out.push({ f: s, t }); break; }
        if (!capturesOnly) out.push({ f: s, t });
        rr += dr; ff += df;
      }
    }
  }
  return out;
}

const CASTLE_MASK = Array(64).fill(15);
CASTLE_MASK[0] = 15 & ~2; CASTLE_MASK[7] = 15 & ~1; CASTLE_MASK[4] = 15 & ~3;
CASTLE_MASK[56] = 15 & ~8; CASTLE_MASK[63] = 15 & ~4; CASTLE_MASK[60] = 15 & ~12;

export function make(pos, m) {
  const b = pos.b;
  const u = { cap: b[m.t], c: pos.c, ep: pos.ep, hm: pos.hm, capSq: m.t };
  const piece = b[m.f];
  b[m.t] = m.p ? (pos.w ? m.p.toUpperCase() : m.p) : piece;
  b[m.f] = null;
  if (m.k === 'ep') { const cs = m.t + (pos.w ? -8 : 8); u.cap = b[cs]; u.capSq = cs; b[cs] = null; }
  if (m.k === 'castle') {
    if (m.t > m.f) { b[m.f + 1] = b[m.f + 3]; b[m.f + 3] = null; } else { b[m.f - 1] = b[m.f - 4]; b[m.f - 4] = null; }
  }
  pos.ep = m.k === 'double' ? (m.f + m.t) / 2 : -1;
  pos.c &= CASTLE_MASK[m.f] & CASTLE_MASK[m.t];
  pos.hm = piece.toUpperCase() === 'P' || u.cap ? 0 : pos.hm + 1;
  if (!pos.w) pos.fm++;
  pos.w = !pos.w;
  return u;
}
export function unmake(pos, m, u) {
  const b = pos.b;
  pos.w = !pos.w;
  if (!pos.w) pos.fm--;
  const moved = b[m.t];
  b[m.f] = m.p ? (pos.w ? 'P' : 'p') : moved;
  b[m.t] = null;
  if (u.cap) b[u.capSq] = u.cap;
  if (m.k === 'castle') {
    if (m.t > m.f) { b[m.f + 3] = b[m.f + 1]; b[m.f + 1] = null; } else { b[m.f - 4] = b[m.f - 1]; b[m.f - 1] = null; }
  }
  pos.c = u.c; pos.ep = u.ep; pos.hm = u.hm;
}

export function legalMoves(pos) {
  const out = [];
  for (const m of pseudoMoves(pos)) {
    const u = make(pos, m);
    if (!inCheck(pos, !pos.w)) out.push(m);
    unmake(pos, m, u);
  }
  return out;
}

export function insufficient(pos) {
  const pieces = pos.b.map((p, i) => [p, i]).filter(([p]) => p && p.toUpperCase() !== 'K');
  if (pieces.length === 0) return true;
  if (pieces.length === 1 && 'NBnb'.includes(pieces[0][0])) return true;
  if (pieces.every(([p]) => 'Bb'.includes(p))) {
    const colors = new Set(pieces.map(([, i]) => ((i >> 3) + (i & 7)) % 2));
    return colors.size === 1;
  }
  return false;
}

export function san(pos, m, legal = legalMoves(pos)) {
  const p = pos.b[m.f];
  const P = p.toUpperCase();
  let s;
  if (m.k === 'castle') s = m.t > m.f ? 'O-O' : 'O-O-O';
  else {
    const cap = !!pos.b[m.t] || m.k === 'ep';
    if (P === 'P') s = (cap ? 'abcdefgh'[m.f & 7] + 'x' : '') + sqName(m.t) + (m.p ? '=' + m.p.toUpperCase() : '');
    else {
      const amb = legal.filter((o) => o.t === m.t && o.f !== m.f && pos.b[o.f] === p);
      let dis = '';
      if (amb.length) {
        if (!amb.some((o) => (o.f & 7) === (m.f & 7))) dis = 'abcdefgh'[m.f & 7];
        else if (!amb.some((o) => (o.f >> 3) === (m.f >> 3))) dis = String((m.f >> 3) + 1);
        else dis = sqName(m.f);
      }
      s = P + dis + (cap ? 'x' : '') + sqName(m.t);
    }
  }
  const u = make(pos, m);
  const chk = inCheck(pos);
  const mate = chk && legalMoves(pos).length === 0;
  unmake(pos, m, u);
  return s + (mate ? '#' : chk ? '+' : '');
}

// ---------- evaluation & search ----------
const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
const PST = {
  P: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, -20, -20, 10, 10, 5, 5, -5, -10, 0, 0, -10, -5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, 5, 10, 25, 25, 10, 5, 5, 10, 10, 20, 30, 30, 20, 10, 10, 50, 50, 50, 50, 50, 50, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0],
  N: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 5, 5, 0, -20, -40, -30, 5, 10, 15, 15, 10, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 10, 15, 15, 10, 0, -30, -40, -20, 0, 0, 0, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  B: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 5, 0, 0, 0, 0, 5, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  R: [0, 0, 0, 5, 5, 0, 0, 0, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 5, 10, 10, 10, 10, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  Q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 5, 0, 0, 0, 0, -10, -10, 5, 5, 5, 5, 5, 0, -10, 0, 0, 5, 5, 5, 5, 0, -5, -5, 0, 5, 5, 5, 5, 0, -5, -10, 0, 5, 5, 5, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  K: [20, 30, 10, 0, 0, 10, 30, 20, 20, 20, 0, 0, 0, 0, 20, 20, -10, -20, -20, -20, -20, -20, -20, -10, -20, -30, -30, -40, -40, -30, -30, -20, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30],
};
export function evaluate(pos) {
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const p = pos.b[i];
    if (!p) continue;
    const P = p.toUpperCase();
    const w = p === P;
    const sq = w ? i : (7 - (i >> 3)) * 8 + (i & 7);
    const v = VAL[P] + PST[P][sq];
    s += w ? v : -v;
  }
  return pos.w ? s : -s;
}
const order = (pos, moves) => moves.map((m) => {
  const cap = pos.b[m.t];
  let sc = 0;
  if (cap) sc = 10 * VAL[cap.toUpperCase()] - VAL[pos.b[m.f].toUpperCase()];
  if (m.p) sc += 800;
  return { m, sc };
}).sort((a, b) => b.sc - a.sc).map((x) => x.m);

export function search(pos, depth, { timeMs = 2000, quiesce = true, noise = 0, rng = Math.random } = {}) {
  const t0 = Date.now();
  let nodes = 0;
  let stop = false;
  function qs(alpha, beta, d) {
    const stand = evaluate(pos);
    if (stand >= beta) return beta;
    if (alpha < stand) alpha = stand;
    if (d > 6) return alpha;
    for (const m of order(pos, pseudoMoves(pos, true))) {
      const u = make(pos, m);
      if (!inCheck(pos, !pos.w)) {
        const v = -qs(-beta, -alpha, d + 1);
        unmake(pos, m, u);
        if (v >= beta) return beta;
        if (v > alpha) alpha = v;
      } else unmake(pos, m, u);
    }
    return alpha;
  }
  function ab(d, alpha, beta, ply) {
    if ((++nodes & 1023) === 0 && Date.now() - t0 > timeMs) stop = true;
    if (stop) return 0;
    if (d === 0) return quiesce ? qs(alpha, beta, 0) : evaluate(pos);
    let any = false;
    for (const m of order(pos, pseudoMoves(pos))) {
      const u = make(pos, m);
      if (inCheck(pos, !pos.w)) { unmake(pos, m, u); continue; }
      any = true;
      const v = -ab(d - 1, -beta, -alpha, ply + 1);
      unmake(pos, m, u);
      if (v >= beta) return beta;
      if (v > alpha) alpha = v;
    }
    if (!any) return inCheck(pos) ? -100000 + ply : 0;
    return alpha;
  }
  const root = order(pos, legalMoves(pos));
  if (!root.length) return null;
  let best = root[0];
  for (let d = 1; d <= depth; d++) {
    let bestV = -Infinity, bestM = null, alpha = -Infinity;
    for (const m of root) {
      const u = make(pos, m);
      const raw = -ab(d - 1, -Infinity, noise ? Infinity : -alpha, 1);
      unmake(pos, m, u);
      if (stop) break;
      if (raw > alpha) alpha = raw;
      const v = raw + (noise ? (rng() - 0.5) * noise : 0);
      if (v > bestV) { bestV = v; bestM = m; }
    }
    if (stop && d > 1) break;
    if (bestM) best = bestM;
    // principal move first next iteration
    root.sort((a, b) => (a === best ? -1 : b === best ? 1 : 0));
    if (Date.now() - t0 > timeMs * 0.5) break;
  }
  return best;
}

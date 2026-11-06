// Chess game rules wrapper: turns, clocks, history, draws, results.
import * as E from './engine.js';
import { clone } from '../../core/util.js';

const CLOCKS = { none: 0, blitz: 5 * 60000, rapid: 10 * 60000 };

export function setup(opts = {}, n = 2, seed = 1) {
  let whiteSeat = 0;
  if (opts.side === 'black') whiteSeat = 1;
  else if (opts.side === 'random') whiteSeat = seed % 2;
  const clock = CLOCKS[opts.timer || 'none'] || 0;
  const pos = E.fromFEN(E.START);
  return { pos, whiteSeat, history: [], reps: { [E.key(pos)]: 1 }, clocks: clock ? [clock, clock] : null, result: null, seed, ev: [] };
}
export const sideOf = (s, seat) => (seat === s.whiteSeat ? 'w' : 'b');
export const actor = (s) => (s.pos.w ? s.whiteSeat : 1 - s.whiteSeat);
export const isOver = (s) => !!s.result;
export const legal = (s) => E.legalMoves(s.pos);

export function validate(s, a, seat) {
  if (s.result || seat !== actor(s)) return false;
  if (a.t === 'timeout') return !!s.clocks;
  if (a.t === 'resign') return true;
  if (a.t !== 'move') return false;
  return legal(s).some((m) => m.f === a.from && m.t === a.to && (m.p || null) === (a.p || null));
}

export function apply(s0, a, seat) {
  const s = clone(s0);
  s.ev = [];
  if (!validate(s, a, seat)) throw new Error('illegal ' + JSON.stringify(a));
  if (a.t === 'resign') { s.result = { winner: 1 - seat, reason: 'resign' }; return s; }
  if (a.t === 'timeout') { s.clocks[seat] = 0; s.result = { winner: 1 - seat, reason: 'time' }; s.ev.push({ t: 'timeout', seat }); return s; }
  const moves = legal(s);
  const m = moves.find((x) => x.f === a.from && x.t === a.to && (x.p || null) === (a.p || null));
  const san = E.san(s.pos, m, moves);
  const cap = s.pos.b[m.t] || (m.k === 'ep' ? s.pos.b[m.t + (s.pos.w ? -8 : 8)] : null);
  const piece = s.pos.b[m.f];
  if (s.clocks && a.spent) s.clocks[seat] = Math.max(0, s.clocks[seat] - a.spent);
  E.make(s.pos, m);
  s.history.push({ san, f: m.f, t: m.t, p: m.p || null, k: m.k || null, cap, piece });
  s.ev.push({ t: 'move', m, cap, piece, san, check: E.inCheck(s.pos) });
  const k = E.key(s.pos);
  s.reps[k] = (s.reps[k] || 0) + 1;
  const next = E.legalMoves(s.pos);
  if (!next.length) {
    s.result = E.inCheck(s.pos) ? { winner: seat, reason: 'mate' } : { winner: -1, reason: 'stalemate' };
  } else if (s.pos.hm >= 100) s.result = { winner: -1, reason: 'fifty' };
  else if (s.reps[k] >= 3) s.result = { winner: -1, reason: 'repetition' };
  else if (E.insufficient(s.pos)) s.result = { winner: -1, reason: 'material' };
  if (s.clocks && s.clocks[seat] <= 0 && !s.result) s.result = { winner: 1 - seat, reason: 'time' };
  return s;
}

export function result(s) {
  const r = s.result;
  if (r.winner < 0) return { winners: [], draw: true, ranking: [0, 1], reason: r.reason };
  return { winners: [r.winner], ranking: [r.winner, 1 - r.winner], reason: r.reason };
}

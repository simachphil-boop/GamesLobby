// COLOR BLITZ rules — shedding card game with UNO-style mechanics (original naming & art).
// Cards: {id, c: 'r'|'y'|'g'|'b'|'w', v: '0'..'9'|'skip'|'rev'|'d2'|'wild'|'d4'}
import { shuffleSeeded } from '../../core/rng.js';
import { clone } from '../../core/util.js';

export const COLORS = ['r', 'y', 'g', 'b'];
const TARGETS = { single: 0, short: 200, long: 500 };

export function makeDeck() {
  const d = [];
  let id = 0;
  for (const c of COLORS) {
    d.push({ id: id++, c, v: '0' });
    for (let k = 0; k < 2; k++) {
      for (let n = 1; n <= 9; n++) d.push({ id: id++, c, v: String(n) });
      for (const v of ['skip', 'rev', 'd2']) d.push({ id: id++, c, v });
    }
  }
  for (let k = 0; k < 4; k++) { d.push({ id: id++, c: 'w', v: 'wild' }); d.push({ id: id++, c: 'w', v: 'd4' }); }
  return d;
}
export const points = (card) => (card.c === 'w' ? 50 : /^\d$/.test(card.v) ? +card.v : 20);

export function setup(opts = {}, n = 4, seed = 1) {
  const s = {
    n, seed, variant: opts.variant || 'classic', target: TARGETS[opts.duration || 'single'] ?? 0,
    scores: Array(n).fill(0), round: 1, dealer: 0, ev: [], winner: null,
  };
  deal(s);
  return s;
}

function deal(s) {
  const deck = shuffleSeeded(s, makeDeck());
  s.hands = Array.from({ length: s.n }, () => []);
  for (let k = 0; k < 7; k++) for (let p = 0; p < s.n; p++) s.hands[p].push(deck.pop());
  // flip a number card to start
  let top;
  for (;;) {
    top = deck.pop();
    if (/^\d$/.test(top.v)) break;
    deck.unshift(top);
  }
  s.deck = deck;
  s.discard = [top];
  s.color = top.c;
  s.dir = 1;
  s.cur = (s.dealer + 1) % s.n;
  s.phase = 'play';
  s.pending = 0;
  s.drawn = null;
  s.unsaid = null;
  s.roundWinner = null;
  s.lacks = Array.from({ length: s.n }, () => []);
  s.ev.push({ t: 'deal', round: s.round });
}

export const top = (s) => s.discard[s.discard.length - 1];
const next = (s, from = s.cur, steps = 1) => ((from + s.dir * steps) % s.n + s.n) % s.n;

export function playable(s, seat, card) {
  const tp = top(s);
  if (s.pending > 0) {
    // stacking variant: only draw cards can answer a pending draw
    if (card.v === 'd2') return tp.v === 'd2';
    if (card.v === 'd4') return true;
    return false;
  }
  if (card.c === 'w') {
    if (card.v === 'd4' && s.variant === 'strict') return !s.hands[seat].some((c) => c.c === s.color);
    return true;
  }
  return card.c === s.color || card.v === tp.v;
}
export function playableCards(s, seat) {
  if (s.phase === 'afterDraw') return s.hands[seat].filter((c) => c.id === s.drawn && playable(s, seat, c));
  return s.hands[seat].filter((c) => playable(s, seat, c));
}

export function actor(s) { return s.phase === 'roundOver' ? s.roundWinner : s.cur; }
export const isOver = (s) => s.winner !== null;

function reshuffle(s) {
  if (s.deck.length) return;
  const keep = s.discard.pop();
  const rest = s.discard.map((c) => ({ ...c }));
  s.discard = [keep];
  s.deck = shuffleSeeded(s, rest);
  if (s.deck.length) s.ev.push({ t: 'reshuffle' });
}
function drawCards(s, seat, n) {
  const got = [];
  for (let k = 0; k < n; k++) {
    reshuffle(s);
    if (!s.deck.length) break;
    const c = s.deck.pop();
    s.hands[seat].push(c);
    got.push(c.id);
  }
  s.ev.push({ t: 'draw', seat, ids: got });
  return got;
}

export function validate(s, a, seat) {
  if (s.winner !== null || actor(s) !== seat) return false;
  switch (a.t) {
    case 'play': {
      if (s.phase !== 'play' && s.phase !== 'afterDraw') return false;
      const card = s.hands[seat].find((c) => c.id === a.id);
      if (!card) return false;
      if (s.phase === 'afterDraw' && card.id !== s.drawn) return false;
      if (!playable(s, seat, card)) return false;
      if (card.c === 'w' && !COLORS.includes(a.color)) return false;
      return true;
    }
    case 'draw': return s.phase === 'play';
    case 'pass': return s.phase === 'afterDraw';
    case 'catch': return s.phase === 'play' && s.unsaid !== null && s.unsaid !== seat && s.hands[s.unsaid].length === 1;
    case 'next': return s.phase === 'roundOver';
    default: return false;
  }
}

function endTurn(s, skip = 0) {
  s.cur = next(s, s.cur, 1 + skip);
  s.phase = 'play';
  s.drawn = null;
}

export function apply(s0, a, seat) {
  const s = clone(s0);
  s.ev = [];
  if (!validate(s, a, seat)) throw new Error('illegal ' + JSON.stringify(a));
  // an un-called ONE can only be caught before the next player acts
  if (a.t !== 'catch') { if (s.unsaid !== null && s.unsaid !== seat) s.unsaid = null; }
  switch (a.t) {
    case 'catch': {
      const v = s.unsaid;
      s.unsaid = null;
      s.ev.push({ t: 'caught', seat, victim: v });
      drawCards(s, v, 2);
      return s;
    }
    case 'draw': {
      if (s.pending > 0) {
        const n = s.pending;
        s.pending = 0;
        drawCards(s, seat, n);
        s.ev.push({ t: 'penalty', seat, n });
        endTurn(s);
        return s;
      }
      // remember which color this player lacked (expert bots use it)
      if (!s.lacks[seat].includes(s.color)) s.lacks[seat].push(s.color);
      if (s.variant === 'drawUntil') {
        let got;
        let guard = 0;
        do { got = drawCards(s, seat, 1); guard++; } while (got.length && !playable(s, seat, s.hands[seat][s.hands[seat].length - 1]) && guard < 40);
      } else drawCards(s, seat, 1);
      const last = s.hands[seat][s.hands[seat].length - 1];
      if (last && playable(s, seat, last)) { s.phase = 'afterDraw'; s.drawn = last.id; }
      else endTurn(s);
      return s;
    }
    case 'pass': endTurn(s); return s;
    case 'next':
      s.round++;
      s.dealer = (s.dealer + 1) % s.n;
      deal(s);
      return s;
    case 'play': {
      const hand = s.hands[seat];
      const idx = hand.findIndex((c) => c.id === a.id);
      const card = hand.splice(idx, 1)[0];
      if (card.c === 'w') card.chosen = a.color;
      s.discard.push(card);
      s.color = card.c === 'w' ? a.color : card.c;
      s.lacks.forEach((l, i) => { if (i !== seat) return; s.lacks[i] = l.filter((c) => c !== s.color); });
      s.ev.push({ t: 'play', seat, card, color: s.color, one: !!a.one });
      if (hand.length === 1) {
        if (a.one) s.ev.push({ t: 'one', seat });
        else s.unsaid = seat;
      }
      if (hand.length === 0) { endRound(s, seat); return s; }
      const stack = s.variant === 'stack';
      let skip = 0;
      switch (card.v) {
        case 'skip': skip = 1; s.ev.push({ t: 'skip', seat: next(s) }); break;
        case 'rev':
          s.dir = -s.dir;
          s.ev.push({ t: 'reverse', dir: s.dir });
          if (s.n === 2) skip = 1;
          break;
        case 'd2': case 'd4': {
          const n = card.v === 'd2' ? 2 : 4;
          if (stack) {
            s.pending += n;
            s.ev.push({ t: 'stack', pending: s.pending });
          } else {
            const victim = next(s);
            drawCards(s, victim, n);
            s.ev.push({ t: 'penalty', seat: victim, n });
            skip = 1;
          }
          break;
        }
        default: break;
      }
      endTurn(s, skip);
      return s;
    }
    default: throw new Error('unknown');
  }
}

function endRound(s, seat) {
  let pts = 0;
  s.hands.forEach((h, i) => { if (i !== seat) pts += h.reduce((a, c) => a + points(c), 0); });
  s.scores[seat] += pts;
  s.roundWinner = seat;
  s.unsaid = null;
  s.pending = 0;
  s.ev.push({ t: 'roundWin', seat, pts });
  if (!s.target || s.scores[seat] >= s.target) {
    s.winner = seat;
    s.phase = 'over';
  } else s.phase = 'roundOver';
}

export function result(s) {
  const ranking = s.scores.map((_, i) => i).sort((a, b) => (b === s.winner) - (a === s.winner) || s.scores[b] - s.scores[a] || s.hands[a].length - s.hands[b].length);
  return { winners: [s.winner], ranking, scores: s.target ? s.scores : s.hands.map((h) => h.length + ' 🂠') };
}

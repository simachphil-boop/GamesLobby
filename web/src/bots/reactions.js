// Reaction director: turns game events into emotions, gestures, gaze and short lines,
// so bots react to the actor *and* to each other.
import { lineFor } from './personas.js';
import { lang } from '../i18n/index.js';
import { save } from '../core/store.js';
import { sfx } from '../core/audio.js';

const ACTOR_EMOTE = {
  good: { calm: 'nod', joker: 'laugh', analytic: 'nod', emotional: 'happy', confident: 'thumbs', quirky: 'happy', shy: 'happy', hype: 'celebrate', competitive: 'point' },
  lucky: { calm: 'happy', joker: 'laugh', analytic: 'nod', emotional: 'celebrate', confident: 'cool', quirky: 'celebrate', shy: 'happy', hype: 'celebrate', competitive: 'happy' },
  unlucky: { calm: 'shake', joker: 'facepalm', analytic: 'thinking', emotional: 'sad', confident: 'shake', quirky: 'surprised', shy: 'sad', hype: 'angry', competitive: 'angry' },
  ouch: { calm: 'sad', joker: 'facepalm', analytic: 'facepalm', emotional: 'sad', confident: 'angry', quirky: 'surprised', shy: 'sad', hype: 'angry', competitive: 'angry' },
  win: { calm: 'happy', joker: 'celebrate', analytic: 'nod', emotional: 'celebrate', confident: 'cool', quirky: 'celebrate', shy: 'happy', hype: 'celebrate', competitive: 'celebrate' },
  lose: { calm: 'nod', joker: 'facepalm', analytic: 'thinking', emotional: 'sad', confident: 'angry', quirky: 'shake', shy: 'sad', hype: 'facepalm', competitive: 'angry' },
  surprise: { calm: 'surprised', joker: 'surprised', analytic: 'surprised', emotional: 'surprised', confident: 'surprised', quirky: 'laugh', shy: 'surprised', hype: 'surprised', competitive: 'surprised' },
  think: { calm: 'thinking', joker: 'thinking', analytic: 'thinking', emotional: 'thinking', confident: 'thinking', quirky: 'thinking', shy: 'thinking', hype: 'thinking', competitive: 'thinking' },
};
// How bystanders feel about an event happening to someone else
const BYSTANDER = {
  good: { emote: ['surprised', 'clap', 'nod'], line: 'praise', rival: 'shake' },
  lucky: { emote: ['surprised', 'clap'], line: 'surprise', rival: 'facepalm' },
  unlucky: { emote: ['laugh', 'nod'], line: null, rival: 'laugh' },
  ouch: { emote: ['laugh', 'surprised'], line: 'surprise', rival: 'laugh' },
  win: { emote: ['clap', 'sad'], line: 'lose', rival: 'sad' },
  surprise: { emote: ['surprised'], line: 'surprise', rival: 'surprised' },
};

export class Reactions {
  /** seats: [{character, persona|null, isBot}] */
  constructor(seats, labels) {
    this.seats = seats;
    this.labels = labels;
    this.talkCd = seats.map(() => 0);
    this.last = 0;
  }
  now() { return performance.now() / 1000; }

  say(i, event, force = false) {
    const s = this.seats[i];
    if (!s || !s.persona || !save.settings.botChat) return;
    const t = this.now();
    if (!force && t < this.talkCd[i]) return;
    const line = lineFor(s.persona, event, lang());
    if (!line) return;
    this.talkCd[i] = t + 4 + Math.random() * 3;
    this.labels.bubble(s.character, line, 2.8);
  }

  /** Main entry: something happened to seat `actor`. */
  event(actor, kind, { magnitude = 0.5, target = null } = {}) {
    const a = this.seats[actor];
    if (!a) return;
    const voice = a.persona?.voice || 'calm';
    const em = ACTOR_EMOTE[kind]?.[voice];
    if (em && a.character) a.character.emote(em);
    if (kind === 'laugh') sfx('laugh');
    if (a.persona) {
      const chance = (a.persona.traits.chatty * 0.8 + magnitude * 0.4);
      if (kind === 'win' || kind === 'lose' || Math.random() < chance) this.say(actor, kind === 'surprise' ? 'surprise' : kind, kind === 'win' || kind === 'lose');
    }
    // bystanders look and react
    const by = BYSTANDER[kind];
    this.seats.forEach((s, i) => {
      if (i === actor || !s.character) return;
      s.character.lookAt(a.character.headWorld());
      setTimeout(() => s.character && s.character.lookAt(null), 1800 + Math.random() * 800);
      if (!by || !s.persona) return;
      const p = s.persona.traits;
      const isTarget = target === i;
      const roll = Math.random();
      if (roll < 0.25 + magnitude * 0.45 + p.tilt * 0.2) {
        setTimeout(() => {
          if (!s.character) return;
          if (isTarget || (p.aggression > 0.6 && roll < 0.2)) s.character.emote(by.rival);
          else s.character.emote(by.emote[Math.floor(Math.random() * by.emote.length)]);
        }, 250 + Math.random() * 500);
      }
      if (by.line && roll < p.chatty * 0.35 * magnitude) setTimeout(() => this.say(i, by.line), 700 + Math.random() * 600);
    });
  }

  thinking(i) {
    const s = this.seats[i];
    if (!s?.character) return;
    if (Math.random() < 0.5) s.character.emote('thinking');
    if (s.persona && Math.random() < s.persona.traits.chatty * 0.25) this.say(i, 'think');
  }

  greet() {
    this.seats.forEach((s, i) => {
      if (!s.persona) return;
      setTimeout(() => { s.character?.emote('wave'); if (Math.random() < 0.7) this.say(i, 'greet', true); }, 400 + i * 700);
    });
  }

  /** Everyone reacts to the final result. winners: seat indices */
  finale(winners) {
    this.seats.forEach((s, i) => {
      if (!s.character) return;
      const won = winners.includes(i);
      setTimeout(() => {
        s.character.emote(won ? 'celebrate' : (s.persona?.voice === 'calm' || s.persona?.voice === 'shy' ? 'clap' : 'sad'));
        if (s.persona) this.say(i, won ? 'win' : 'lose', true);
      }, i * 350);
    });
  }
}

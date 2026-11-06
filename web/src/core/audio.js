// Audio System: every sound is synthesized with WebAudio at runtime (no licensed samples),
// so the APK stays small and all audio is original.
//   sfx(name)       — one-shot effects
//   music           — generative lounge music (per-room mood), separate toggle/volume
//   ambience        — room tone (fireplace crackle, city hum, synth drone…), separate toggle
import { save } from './store.js';
import { bus } from './events.js';

let ctx = null;
let master, sfxGain, musicGain, ambGain, noiseBuf;
const MOODS = {
  modern: { bpm: 84, root: 57, prog: [[0, 4, 7, 11], [9, 12, 16, 19], [2, 5, 9, 12], [7, 11, 14, 17]], wave: 'triangle' },
  cozy: { bpm: 72, root: 55, prog: [[0, 4, 7, 11], [5, 9, 12, 16], [9, 12, 16, 19], [7, 11, 14, 17]], wave: 'sine' },
  luxury: { bpm: 76, root: 53, prog: [[0, 4, 7, 11], [2, 5, 9, 12], [4, 7, 11, 14], [5, 9, 12, 16]], wave: 'sine' },
  retro: { bpm: 104, root: 57, prog: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [5, 9, 12]], wave: 'square' },
  future: { bpm: 96, root: 50, prog: [[0, 3, 7, 10], [8, 12, 15, 19], [3, 7, 10, 14], [10, 14, 17, 21]], wave: 'sawtooth' },
  casino: { bpm: 92, root: 52, prog: [[0, 3, 7, 10], [5, 8, 12, 15], [7, 10, 14, 17], [3, 7, 10, 14]], wave: 'triangle' },
};

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  sfxGain = ctx.createGain(); sfxGain.connect(master);
  musicGain = ctx.createGain(); musicGain.connect(master);
  ambGain = ctx.createGain(); ambGain.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolumes();
  startMusic();
  startAmbience();
}

export function applyVolumes() {
  if (!ctx) return;
  const s = save.settings;
  const now = ctx.currentTime;
  sfxGain.gain.setTargetAtTime(s.sfx ? s.sfxVol : 0, now, 0.05);
  musicGain.gain.setTargetAtTime(s.music ? s.musicVol * 0.35 : 0, now, 0.3);
  ambGain.gain.setTargetAtTime(s.ambience ? 0.22 : 0, now, 0.3);
}
bus.on('settings', (k) => {
  if (['sfx', 'sfxVol', 'music', 'musicVol', 'ambience'].includes(k)) applyVolumes();
  if (k === 'room') { setMood(save.settings.room); }
});

export function suspendAudio() { if (ctx && ctx.state === 'running') ctx.suspend(); }
export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

// ---------- primitives ----------
function tone(freq, dur, { type = 'sine', vol = 0.3, attack = 0.005, when = 0, slide = 0, out = sfxGain, detune = 0 } = {}) {
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, { vol = 0.3, when = 0, freq = 2000, q = 1, type = 'bandpass', out = sfxGain, attack = 0.002 } = {}) {
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(out);
  src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
}
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------- sound effects ----------
const SFX = {
  click: () => { tone(880, 0.06, { type: 'triangle', vol: 0.18 }); tone(1320, 0.04, { type: 'sine', vol: 0.08, when: 0.01 }); },
  hover: () => tone(1200, 0.03, { vol: 0.05 }),
  back: () => tone(520, 0.08, { type: 'triangle', vol: 0.15, slide: 0.7 }),
  open: () => { tone(500, 0.12, { type: 'sine', vol: 0.12, slide: 1.8 }); noise(0.15, { vol: 0.05, freq: 3000 }); },
  whoosh: () => noise(0.5, { vol: 0.18, freq: 900, q: 0.7, attack: 0.18 }),
  dice: () => {
    for (let i = 0; i < 9; i++) {
      const w = i * 0.055 + Math.random() * 0.03;
      noise(0.05, { vol: 0.35 - i * 0.03, when: w, freq: 2500 + Math.random() * 2500, q: 4 });
      tone(180 + Math.random() * 120, 0.05, { type: 'square', vol: 0.05, when: w });
    }
  },
  diceLand: () => { noise(0.08, { vol: 0.3, freq: 1600, q: 3 }); tone(140, 0.12, { type: 'sine', vol: 0.25 }); },
  card: () => { noise(0.12, { vol: 0.25, freq: 4500, q: 0.8, attack: 0.01 }); noise(0.04, { vol: 0.2, when: 0.1, freq: 1500, q: 2 }); },
  cardSlap: () => { noise(0.07, { vol: 0.4, freq: 2200, q: 1.2 }); tone(160, 0.08, { vol: 0.2 }); },
  deal: () => { for (let i = 0; i < 3; i++) noise(0.06, { vol: 0.18, when: i * 0.07, freq: 5000, q: 1 }); },
  shuffle: () => { for (let i = 0; i < 14; i++) noise(0.04, { vol: 0.15, when: i * 0.035, freq: 4000 + Math.random() * 2000, q: 1 }); },
  piece: () => { tone(320, 0.09, { type: 'sine', vol: 0.3, slide: 0.6 }); noise(0.04, { vol: 0.15, freq: 1200, q: 3 }); },
  step: () => { tone(420 + Math.random() * 60, 0.06, { type: 'sine', vol: 0.16, slide: 0.7 }); },
  capture: () => { tone(220, 0.25, { type: 'sawtooth', vol: 0.12, slide: 0.4 }); noise(0.12, { vol: 0.25, freq: 900, q: 2 }); tone(988, 0.2, { vol: 0.1, when: 0.08 }); },
  coin: () => { tone(1568, 0.12, { type: 'square', vol: 0.06 }); tone(2093, 0.25, { type: 'square', vol: 0.06, when: 0.07 }); },
  coins: () => { for (let i = 0; i < 5; i++) tone(1400 + Math.random() * 900, 0.15, { type: 'triangle', vol: 0.08, when: i * 0.06 }); },
  buy: () => { [72, 76, 79, 84].forEach((m, i) => tone(midi(m), 0.18, { type: 'triangle', vol: 0.15, when: i * 0.07 })); },
  build: () => { for (let i = 0; i < 3; i++) { noise(0.06, { vol: 0.3, when: i * 0.12, freq: 700, q: 2 }); tone(200, 0.08, { vol: 0.15, when: i * 0.12 }); } },
  pay: () => { tone(660, 0.1, { type: 'triangle', vol: 0.12 }); tone(440, 0.18, { type: 'triangle', vol: 0.12, when: 0.08 }); },
  bad: () => { tone(330, 0.3, { type: 'sawtooth', vol: 0.08, slide: 0.5 }); },
  error: () => { tone(200, 0.12, { type: 'square', vol: 0.08 }); tone(150, 0.15, { type: 'square', vol: 0.08, when: 0.1 }); },
  notify: () => { tone(988, 0.1, { vol: 0.14 }); tone(1319, 0.18, { vol: 0.14, when: 0.09 }); },
  turn: () => { tone(784, 0.12, { type: 'sine', vol: 0.14 }); tone(1175, 0.2, { type: 'sine', vol: 0.12, when: 0.1 }); },
  win: () => { [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => tone(midi(m), 0.4, { type: 'triangle', vol: 0.14, when: i * 0.09 })); tone(midi(84), 1.2, { type: 'sine', vol: 0.12, when: 0.65 }); },
  lose: () => { [67, 63, 60, 55].forEach((m, i) => tone(midi(m), 0.45, { type: 'triangle', vol: 0.13, when: i * 0.18 })); },
  pop: () => tone(600, 0.08, { type: 'sine', vol: 0.2, slide: 2 }),
  special: () => { [76, 79, 83, 88].forEach((m, i) => tone(midi(m), 0.2, { type: 'square', vol: 0.06, when: i * 0.05 })); noise(0.4, { vol: 0.08, freq: 6000, attack: 0.1 }); },
  tick: () => tone(1800, 0.02, { type: 'square', vol: 0.04 }),
  drop: () => { tone(500, 0.18, { type: 'sine', vol: 0.2, slide: 0.35 }); noise(0.05, { vol: 0.2, when: 0.15, freq: 1000, q: 3 }); },
  chip: () => { noise(0.04, { vol: 0.25, freq: 3500, q: 6 }); tone(2600, 0.05, { vol: 0.05 }); },
  laugh: () => { for (let i = 0; i < 4; i++) tone(520 - i * 30, 0.08, { type: 'sine', vol: 0.05, when: i * 0.11 }); },
  levelup: () => { [67, 71, 74, 79, 83, 86].forEach((m, i) => tone(midi(m), 0.3, { type: 'square', vol: 0.05, when: i * 0.06 })); },
};

let lastHaptic = 0;
export function sfx(name) {
  if (!ctx || !save.settings.sfx) return;
  try { SFX[name] && SFX[name](); } catch (e) { /* ignore */ }
}
export function haptic() {
  if (!save.settings.haptics) return;
  const now = Date.now();
  if (now - lastHaptic < 60) return;
  lastHaptic = now;
  try {
    if (window.BoardverseNative && window.BoardverseNative.haptic) window.BoardverseNative.haptic();
    else if (navigator.vibrate) navigator.vibrate(12);
  } catch (e) { /* ignore */ }
}

// ---------- generative music ----------
let mood = MOODS.modern;
let musicTimer = null;
let nextBar = 0;
let bar = 0;
export function setMood(room) { mood = MOODS[room] || MOODS.modern; ambienceFor(room); }

function startMusic() {
  setMood(save.settings.room);
  nextBar = ctx.currentTime + 0.2;
  clearInterval(musicTimer);
  musicTimer = setInterval(scheduleMusic, 200);
}
function scheduleMusic() {
  if (!ctx || ctx.state !== 'running') return;
  const beat = 60 / mood.bpm;
  while (nextBar < ctx.currentTime + 1.5) {
    const chord = mood.prog[bar % mood.prog.length];
    const t0 = nextBar - ctx.currentTime;
    // pad
    chord.forEach((iv, k) => {
      tone(midi(mood.root + iv), beat * 4.2, { type: mood.wave === 'square' ? 'triangle' : mood.wave, vol: 0.05, attack: 0.6, when: t0, out: musicGain, detune: (k - 1.5) * 4 });
    });
    // bass
    tone(midi(mood.root - 12 + chord[0]), beat * 1.8, { type: 'sine', vol: 0.12, attack: 0.02, when: t0, out: musicGain });
    tone(midi(mood.root - 12 + chord[0] + 7), beat * 0.9, { type: 'sine', vol: 0.08, attack: 0.02, when: t0 + beat * 2, out: musicGain });
    // light arpeggio melody
    for (let i = 0; i < 4; i++) {
      if (Math.random() < 0.55) {
        const n = chord[(i + bar) % chord.length] + 12 + (Math.random() < 0.3 ? 12 : 0);
        tone(midi(mood.root + n), beat * 0.8, { type: 'sine', vol: 0.035, when: t0 + i * beat + beat * 0.5, out: musicGain });
      }
      // soft hat
      noise(0.03, { vol: 0.02, when: t0 + i * beat + beat * 0.5, freq: 8000, q: 1, type: 'highpass', out: musicGain });
    }
    nextBar += beat * 4;
    bar++;
  }
}

// ---------- ambience ----------
let ambNodes = [];
let crackleTimer = null;
function startAmbience() { ambienceFor(save.settings.room); }
function ambienceFor(room) {
  if (!ctx) return;
  ambNodes.forEach((n) => { try { n.stop(); } catch (e) { /* ignore */ } });
  ambNodes = [];
  clearInterval(crackleTimer);
  // continuous filtered noise bed
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass';
  f.frequency.value = room === 'future' ? 300 : room === 'modern' ? 420 : 260;
  const g = ctx.createGain(); g.gain.value = room === 'cozy' ? 0.25 : 0.35;
  src.connect(f); f.connect(g); g.connect(ambGain); src.start();
  ambNodes.push(src);
  if (room === 'future' || room === 'casino') {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = room === 'future' ? 55 : 73.4;
    const og = ctx.createGain(); og.gain.value = 0.06; o.connect(og); og.connect(ambGain); o.start(); ambNodes.push(o);
  }
  if (room === 'cozy' || room === 'luxury') {
    crackleTimer = setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      for (let i = 0; i < 3; i++) if (Math.random() < 0.5) noise(0.02, { vol: 0.25, when: Math.random() * 0.3, freq: 2500 + Math.random() * 3000, q: 3, out: ambGain });
    }, 320);
  }
}

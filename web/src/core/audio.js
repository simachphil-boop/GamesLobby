// Audio System (sample-based).
//   • UI sounds: studio-recorded CC0 samples (uisfx, see assets/audio/ui/LICENSE-CC0.txt)
//   • Table foley: physically-modelled dice/cards/chips/wood/coins rendered offline (tools/audio/foley.py)
//   • Music: original arrangements rendered with FluidSynth + FluidR3_GM (MIT) (tools/audio/compose.py)
//   • Ambience: seamless room-tone loops per room
// Assets are embedded by the build as window.BV_SOUNDS (base64), so they work from file:// on PC and Android.
import { save } from './store.js';
import { bus } from './events.js';

let ctx = null;
let master, sfxGain, ambGain;
const buffers = new Map();
let musicEl = null, musicName = null, fadeTimer = null;
let ambSrc = null, ambName = null;
const ROOM_MUSIC = { modern: 'modern', luxury: 'luxury', cozy: 'cozy', retro: 'retro', future: 'future', casino: 'luxury' };
const ROOM_AMB = { modern: 'amb_city', luxury: 'amb_fire', cozy: 'amb_fire', retro: 'amb_room', future: 'amb_future', casino: 'amb_room' };
let musicMode = 'menu';

// game event -> [category, sample, gain, pitchJitter]
const MAP = {
  click: ['ui', 'click', 0.7], hover: ['ui', 'hover', 0.35], back: ['ui', 'back', 0.6], open: ['ui', 'open', 0.55], confirm: ['ui', 'confirm', 0.7],
  notify: ['ui', 'notify', 0.7], turn: ['ui', 'turn', 0.6], win: ['ui', 'win', 0.9], lose: ['ui', 'lose', 0.8], buy: ['ui', 'buy', 0.8],
  error: ['ui', 'error', 0.6], special: ['ui', 'special', 0.75], levelup: ['ui', 'levelup', 0.9], pop: ['ui', 'pop', 0.6], tick: ['ui', 'tick', 0.4],
  achievement: ['ui', 'achievement', 0.9], reward: ['ui', 'reward', 0.9], bad: ['ui', 'error', 0.5],
  dice: ['fx', 'dice', 1, 0.05], diceLand: ['fx', 'diceLand', 0.9, 0.06], card: ['fx', 'card', 0.8, 0.08], cardSlap: ['fx', 'cardSlap', 0.9, 0.06],
  deal: ['fx', 'deal', 0.8, 0.06], shuffle: ['fx', 'shuffle', 0.8, 0.03], chip: ['fx', 'chip', 0.8, 0.08], chips: ['fx', 'chips', 0.8, 0.05],
  coin: ['fx', 'coin', 0.6, 0.06], coins: ['fx', 'coins', 0.65, 0.05], pay: ['fx', 'coins', 0.55, 0.05], piece: ['fx', 'piece', 0.9, 0.07],
  step: ['fx', 'step', 0.6, 0.12], capture: ['fx', 'capture', 0.9, 0.05], build: ['fx', 'build', 0.8, 0.05], domino: ['fx', 'domino', 0.9, 0.07],
  drop: ['fx', 'drop', 0.9, 0.06], whoosh: ['fx', 'whoosh', 0.5, 0.1], laugh: ['ui', 'pop', 0.3],
};

function b64ToBuf(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
const SND = () => window.BV_SOUNDS || { ui: {}, fx: {}, music: {} };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.connect(ctx.destination);
  // gentle bus compression keeps loud foley and UI consistent
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.003; comp.release.value = 0.2;
  comp.connect(master);
  sfxGain = ctx.createGain(); sfxGain.connect(comp);
  ambGain = ctx.createGain(); ambGain.connect(master);
  // decode short samples up front (small)
  for (const cat of ['ui', 'fx']) {
    for (const [name, b64] of Object.entries(SND()[cat] || {})) {
      ctx.decodeAudioData(b64ToBuf(b64)).then((b) => buffers.set(cat + '/' + name, b)).catch(() => {});
    }
  }
  applyVolumes();
  playMusic(musicMode === 'menu' ? 'menu' : ROOM_MUSIC[save.settings.room]);
  setAmbience(save.settings.room);
}

export function applyVolumes() {
  const s = save.settings;
  if (ctx) {
    sfxGain.gain.setTargetAtTime(s.sfx ? s.sfxVol : 0, ctx.currentTime, 0.05);
    ambGain.gain.setTargetAtTime(s.ambience ? 0.35 : 0, ctx.currentTime, 0.3);
  }
  if (musicEl) musicEl.volume = s.music ? Math.min(1, s.musicVol * 0.7) : 0;
}
bus.on('settings', (k) => {
  if (['sfx', 'sfxVol', 'music', 'musicVol', 'ambience'].includes(k)) applyVolumes();
  if (k === 'room') setMood(save.settings.room);
});

export function suspendAudio() { if (ctx && ctx.state === 'running') ctx.suspend(); musicEl?.pause(); }
export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); if (musicEl && save.settings.music) musicEl.play().catch(() => {}); }

let lastPlay = new Map();
export function sfx(name) {
  if (!ctx || !save.settings.sfx) return;
  const m = MAP[name];
  if (!m) return;
  const [cat, sample, gain, jitter = 0] = m;
  const buf = buffers.get(cat + '/' + sample);
  if (!buf) return;
  const now = ctx.currentTime;
  if (now - (lastPlay.get(name) || 0) < 0.03) return; // avoid machine-gun stacking
  lastPlay.set(name, now);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = 1 + (Math.random() * 2 - 1) * jitter;
  const g = ctx.createGain();
  g.gain.value = gain * (1 - Math.random() * jitter);
  // subtle stereo placement for table sounds
  if (cat === 'fx' && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner(); p.pan.value = (Math.random() - 0.5) * 0.4;
    src.connect(g); g.connect(p); p.connect(sfxGain);
  } else { src.connect(g); g.connect(sfxGain); }
  src.start();
}

let lastHaptic = 0;
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

// ---------- music (streamed via <audio>, crossfaded) ----------
const urlCache = new Map();
function musicUrl(name) {
  if (urlCache.has(name)) return urlCache.get(name);
  const b64 = SND().music?.[name];
  if (!b64) return null;
  const url = URL.createObjectURL(new Blob([b64ToBuf(b64)], { type: 'audio/mpeg' }));
  urlCache.set(name, url);
  return url;
}
function playMusic(name) {
  if (!name || name === musicName) return;
  const url = musicUrl(name);
  if (!url) return;
  musicName = name;
  const old = musicEl;
  const el = new Audio(url);
  el.loop = true;
  el.volume = 0;
  musicEl = el;
  const target = () => (save.settings.music ? Math.min(1, save.settings.musicVol * 0.7) : 0);
  el.play().catch(() => {});
  clearInterval(fadeTimer);
  let k = 0;
  fadeTimer = setInterval(() => {
    k = Math.min(1, k + 0.04);
    el.volume = target() * k;
    if (old) old.volume = Math.max(0, old.volume * (1 - k));
    if (k >= 1) { clearInterval(fadeTimer); if (old) { old.pause(); old.src = ''; } }
  }, 60);
}
/** 'menu' or 'table' — the menu has its own theme, tables play the room's track. */
export function setMusicMode(mode) {
  musicMode = mode;
  if (ctx) playMusic(mode === 'menu' ? 'menu' : ROOM_MUSIC[save.settings.room]);
}

function setAmbience(room) {
  if (!ctx) return;
  const name = ROOM_AMB[room] || 'amb_room';
  if (name === ambName) return;
  const b64 = SND().fx?.[name];
  if (!b64) return;
  ambName = name;
  ctx.decodeAudioData(b64ToBuf(b64)).then((buf) => {
    if (ambSrc) { try { ambSrc.stop(); } catch (e) { /* ignore */ } }
    ambSrc = ctx.createBufferSource();
    ambSrc.buffer = buf; ambSrc.loop = true;
    ambSrc.connect(ambGain); ambSrc.start();
  }).catch(() => {});
}
export function setMood(room) {
  setAmbience(room);
  if (musicMode !== 'menu' && ctx) playMusic(ROOM_MUSIC[room]);
}

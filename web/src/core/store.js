// Save System + User Profile + Achievements.
// Everything persists to localStorage (and to native SharedPreferences on Android as a backup).
// The format is versioned so future updates can migrate old saves.
import { bus } from './events.js';
import { CATEGORIES, defaultOwned } from './catalog.js';
import { todayKey, clone } from './util.js';

const KEY = 'boardverse.save.v1';
const SAVE_VERSION = 1;

function detectLang() {
  const supported = ['ru', 'en', 'es', 'fr', 'de', 'it', 'tr', 'zh', 'ja'];
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return supported.includes(nav) ? nav : 'en';
}

export function defaultSave() {
  return {
    version: SAVE_VERSION,
    profile: {
      name: 'Player',
      avatar: {
        skin: 1, hair: 'short', hairColor: 1, eyes: 0, outfit: 'hoodie', outfitColor: 0,
        accessory: 'none', mood: 'happy', body: 'avg', badge: 'star',
      },
      level: 1, xp: 0, coins: 500,
      stats: { played: 0, wins: 0, losses: 0, draws: 0, streak: 0, bestStreak: 0, perGame: {}, online: 0 },
      achievements: {},
      owned: defaultOwned(),
      daily: { last: null, streak: 0 },
      createdAt: Date.now(),
    },
    settings: {
      lang: detectLang(), quality: 'auto', fps: 60, music: true, sfx: true, ambience: true,
      musicVol: 0.5, sfxVol: 0.8, camera: 'fp', sway: true, haptics: true, botChat: true,
      speed: 1, uiTheme: 'royal', room: 'modern', server: '', tutorialSeen: false,
    },
    gameOptions: {},
    lastGame: null,
    match: null, // serialized in-progress match (resume support)
  };
}

function migrate(data) {
  const base = defaultSave();
  if (!data || typeof data !== 'object') return base;
  // deep-merge known sections so newly added fields get defaults
  const out = { ...base, ...data, version: SAVE_VERSION };
  out.profile = { ...base.profile, ...(data.profile || {}) };
  out.profile.avatar = { ...base.profile.avatar, ...(data.profile?.avatar || {}) };
  out.profile.stats = { ...base.profile.stats, ...(data.profile?.stats || {}) };
  out.profile.owned = { ...base.profile.owned };
  for (const cat of Object.keys(CATEGORIES)) {
    const set = new Set([...(base.profile.owned[cat] || []), ...((data.profile?.owned || {})[cat] || [])]);
    out.profile.owned[cat] = [...set];
  }
  out.settings = { ...base.settings, ...(data.settings || {}) };
  return out;
}

function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
  if (!raw && window.BoardverseNative && window.BoardverseNative.restoreSave) {
    try { raw = window.BoardverseNative.restoreSave() || null; } catch (e) { /* ignore */ }
  }
  try { return migrate(raw ? JSON.parse(raw) : null); } catch (e) { return defaultSave(); }
}

export const save = load();
let timer = null;

/** Persist (debounced). */
export function commit(immediate = false) {
  const write = () => {
    timer = null;
    const json = JSON.stringify(save);
    try { localStorage.setItem(KEY, json); } catch (e) { /* ignore */ }
    if (window.BoardverseNative && window.BoardverseNative.backupSave) {
      try { window.BoardverseNative.backupSave(json); } catch (e) { /* ignore */ }
    }
  };
  if (immediate) { clearTimeout(timer); write(); return; }
  if (!timer) timer = setTimeout(write, 400);
}

export function setSetting(key, value) {
  save.settings[key] = value;
  commit();
  bus.emit('settings', key, value);
}

export function resetProgress() {
  const fresh = defaultSave();
  fresh.settings = save.settings;
  Object.keys(save).forEach((k) => delete save[k]);
  Object.assign(save, fresh);
  commit(true);
  bus.emit('profile');
}

// ---------- Profile / progression ----------
export const xpForLevel = (lvl) => 200 + (lvl - 1) * 120;

export function addXp(amount) {
  const p = save.profile;
  p.xp += amount;
  let leveled = 0;
  while (p.xp >= xpForLevel(p.level)) { p.xp -= xpForLevel(p.level); p.level++; leveled++; p.coins += 100; }
  commit();
  bus.emit('profile');
  return leveled;
}

export function addCoins(n) { save.profile.coins += n; commit(); bus.emit('profile'); }

export function owns(cat, id) { return (save.profile.owned[cat] || []).includes(id); }

export function grant(cat, id) {
  if (!owns(cat, id)) { save.profile.owned[cat].push(id); commit(); bus.emit('profile'); return true; }
  return false;
}

export function buy(cat, id) {
  const item = CATEGORIES[cat].find((i) => i.id === id);
  if (!item || owns(cat, id)) return false;
  if (save.profile.coins < item.price) return false;
  save.profile.coins -= item.price;
  grant(cat, id);
  checkAchievements();
  return true;
}

export const ownedCount = () => Object.values(save.profile.owned).reduce((a, l) => a + l.length, 0);

// ---------- Achievements ----------
export const ACHIEVEMENTS = [
  { id: 'first_win', icon: '🏆', test: (p) => p.stats.wins >= 1 },
  { id: 'regular', icon: '🎲', test: (p) => p.stats.played >= 10 },
  { id: 'master_player', icon: '👑', test: (p) => p.stats.played >= 100 },
  { id: 'card_master', icon: '🃏', test: (p) => catWins(p, 'card') >= 10 },
  { id: 'strategist', icon: '♟️', test: (p) => catWins(p, 'strategy') >= 10 },
  { id: 'tycoon', icon: '🏙️', test: (p) => (p.stats.perGame.tycoon?.wins || 0) >= 1 },
  { id: 'collector', icon: '💎', test: () => ownedCount() >= 60 },
  { id: 'on_fire', icon: '🔥', test: (p) => p.stats.bestStreak >= 3 },
  { id: 'explorer', icon: '🧭', test: (p) => Object.keys(p.stats.perGame).length >= 10 },
  { id: 'loyal', icon: '📅', test: (p) => p.daily.streak >= 7 },
  { id: 'social', icon: '🌐', test: (p) => p.stats.online >= 1 },
  { id: 'rich', icon: '💰', test: (p) => p.coins >= 3000 },
];
const CARD_GAMES = ['colorblitz', 'holdem', 'domino'];
const STRATEGY_GAMES = ['chess', 'checkers', 'backgammon', 'fourrow', 'tictactoe'];
function catWins(p, cat) {
  const list = cat === 'card' ? CARD_GAMES : STRATEGY_GAMES;
  return list.reduce((a, id) => a + (p.stats.perGame[id]?.wins || 0), 0);
}

export function checkAchievements() {
  const p = save.profile;
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (!p.achievements[a.id] && a.test(p)) {
      p.achievements[a.id] = Date.now();
      p.coins += 150;
      unlocked.push(a);
      // achievement-gated cosmetics
      for (const [cat, list] of Object.entries(CATEGORIES)) {
        for (const item of list) if (item.unlock === a.id) grant(cat, item.id);
      }
    }
  }
  if (unlocked.length) { commit(); bus.emit('achievements', unlocked); bus.emit('profile'); }
  return unlocked;
}

/** Record a finished match. outcome: 'win' | 'loss' | 'draw' */
export function recordMatch(gameId, outcome, { online = false } = {}) {
  const p = save.profile;
  const s = p.stats;
  s.played++;
  const g = (s.perGame[gameId] ||= { played: 0, wins: 0, losses: 0, draws: 0 });
  g.played++;
  if (outcome === 'win') { s.wins++; g.wins++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak); }
  else if (outcome === 'loss') { s.losses++; g.losses++; s.streak = 0; }
  else { s.draws++; g.draws++; }
  if (online) s.online++;
  const xp = outcome === 'win' ? 120 : outcome === 'draw' ? 60 : 35;
  const coins = outcome === 'win' ? 60 : outcome === 'draw' ? 30 : 15;
  p.coins += coins;
  const leveled = addXp(xp);
  const ach = checkAchievements();
  commit();
  return { xp, coins, leveled, achievements: ach };
}

export function favoriteGame() {
  const pg = save.profile.stats.perGame;
  let best = null;
  for (const [id, g] of Object.entries(pg)) if (!best || g.played > pg[best].played) best = id;
  return best;
}

// ---------- Daily rewards ----------
export const DAILY_REWARDS = [100, 150, 200, 250, 300, 400, 750];

export function dailyStatus() {
  const d = save.profile.daily;
  const today = todayKey();
  if (d.last === today) return { canClaim: false, day: ((d.streak - 1) % 7) + 1, streak: d.streak };
  const y = new Date(); y.setDate(y.getDate() - 1);
  const streak = d.last === todayKey(y) ? d.streak + 1 : 1;
  return { canClaim: true, day: ((streak - 1) % 7) + 1, streak };
}

export function claimDaily() {
  const st = dailyStatus();
  if (!st.canClaim) return null;
  const d = save.profile.daily;
  const reward = DAILY_REWARDS[st.day - 1];
  d.streak = st.streak;
  d.last = todayKey();
  save.profile.coins += reward;
  commit();
  checkAchievements();
  bus.emit('profile');
  return { reward, day: st.day };
}

// ---------- Match resume ----------
export function storeMatch(m) { save.match = m ? clone(m) : null; commit(); }

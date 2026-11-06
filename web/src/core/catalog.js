// Collection catalog: every unlockable cosmetic in BOARDVERSE.
// price: in-game coins (never real money). unlock: alternative achievement id that grants it for free.

export const TOKENS = [
  { id: 'car', price: 0 }, { id: 'ship', price: 0 }, { id: 'cat', price: 0 }, { id: 'dog', price: 0 },
  { id: 'crown', price: 0 }, { id: 'meeple', price: 0 }, { id: 'plane', price: 150 }, { id: 'robot', price: 200 },
  { id: 'rocket', price: 250 }, { id: 'elephant', price: 250 }, { id: 'crystal', price: 300 },
  { id: 'dragon', price: 400, unlock: 'tycoon' },
];
export const DECKS = [
  { id: 'classic', price: 0 }, { id: 'neon', price: 200 }, { id: 'pastel', price: 150 }, { id: 'royal', price: 300, unlock: 'card_master' },
];
export const BOARDS = [
  { id: 'classic', price: 0 }, { id: 'metro', price: 0 }, { id: 'tropic', price: 200 },
  { id: 'space', price: 250 }, { id: 'medieval', price: 250 }, { id: 'future', price: 300 },
];
export const ROOMS = [
  { id: 'modern', price: 0 }, { id: 'cozy', price: 0 }, { id: 'luxury', price: 400 },
  { id: 'retro', price: 300 }, { id: 'future', price: 450 }, { id: 'casino', price: 500, unlock: 'master_player' },
];
export const OUTFITS = [
  { id: 'tshirt', price: 0 }, { id: 'hoodie', price: 0 }, { id: 'sweater', price: 80 }, { id: 'jacket', price: 150 },
  { id: 'suit', price: 200 }, { id: 'dress', price: 150 }, { id: 'tracksuit', price: 120 }, { id: 'royal', price: 400, unlock: 'collector' },
];
export const HAIRS = [
  { id: 'short', price: 0 }, { id: 'bob', price: 0 }, { id: 'long', price: 0 }, { id: 'bun', price: 60 },
  { id: 'spiky', price: 60 }, { id: 'curly', price: 0 }, { id: 'ponytail', price: 80 }, { id: 'mohawk', price: 150 },
  { id: 'bald', price: 0 },
];
export const ACCESSORIES = [
  { id: 'none', price: 0 }, { id: 'glasses', price: 100 }, { id: 'sunglasses', price: 150 }, { id: 'cap', price: 120 },
  { id: 'hat', price: 220 }, { id: 'beanie', price: 120 }, { id: 'headphones', price: 250 }, { id: 'bow', price: 100 },
  { id: 'earrings', price: 160 }, { id: 'crown', price: 500, unlock: 'first_win' },
];
export const EMOTES = [
  { id: 'wave', price: 0 }, { id: 'laugh', price: 0 }, { id: 'thumbs', price: 0 }, { id: 'think', price: 0 },
  { id: 'wow', price: 50 }, { id: 'cool', price: 80 }, { id: 'sad', price: 50 }, { id: 'angry', price: 80 },
  { id: 'love', price: 120 }, { id: 'party', price: 200, unlock: 'strategist' },
];
export const UI_THEMES = [
  { id: 'royal', price: 0 }, { id: 'aurora', price: 150 }, { id: 'ember', price: 150 }, { id: 'mint', price: 150 },
];

export const CATEGORIES = {
  tokens: TOKENS, decks: DECKS, boards: BOARDS, rooms: ROOMS, outfits: OUTFITS,
  hairs: HAIRS, accessories: ACCESSORIES, emotes: EMOTES, themes: UI_THEMES,
};

export const SKIN_TONES = ['#f8d9c0', '#eec19f', '#d9a27a', '#b97c55', '#8d5a3b', '#5e3b26'];
export const HAIR_COLORS = ['#1d1612', '#4a2e1c', '#8a5a2b', '#d9a75a', '#f1e1b0', '#b23a2a', '#e8e8f0', '#6a3fd8', '#2f8fe0', '#e05a9a'];
export const OUTFIT_COLORS = ['#3a4fd8', '#7b3fe4', '#d8a73a', '#2fb38a', '#e0503a', '#1f2340', '#f0f0f5', '#e07ab0', '#38b8e8', '#6b4a2a'];
export const EYE_COLORS = ['#3b2414', '#2f6fb0', '#3a8a4a', '#7a7a8a', '#9a5a2a'];

export function defaultOwned() {
  const owned = {};
  for (const [cat, list] of Object.entries(CATEGORIES)) owned[cat] = list.filter((i) => i.price === 0).map((i) => i.id);
  return owned;
}

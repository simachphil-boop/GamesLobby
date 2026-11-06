// Deterministic RNG stored inside game state so that every client in an online room
// (and every replay of a saved match) produces identical dice / shuffles.
export function nextRand(state) {
  // mulberry32 on state.seed (uint32)
  let t = (state.seed = (state.seed + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const randInt = (state, n) => Math.floor(nextRand(state) * n);
export function shuffleSeeded(state, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(state, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
export const newSeed = () => (Math.random() * 4294967296) >>> 0;
/** Plain function RNG for AI (not part of synced state). */
export function makeRng(seed = newSeed()) {
  const s = { seed };
  return () => nextRand(s);
}

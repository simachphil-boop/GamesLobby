// Runs bot decisions. Search-heavy AIs (chess, checkers, four-in-a-row…) run in a Web Worker
// so the 3D scene keeps animating while the bot "thinks"; everything else runs inline.
import workerSrc from 'virtual:ai-worker';

let worker = null;
let workerFailed = false;
let reqId = 0;
const pending = new Map();

function getWorker() {
  if (worker || workerFailed) return worker;
  try {
    const url = URL.createObjectURL(new Blob([workerSrc], { type: 'text/javascript' }));
    worker = new Worker(url);
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.error) p.reject(new Error(e.data.error)); else p.resolve(e.data.action);
    };
    worker.onerror = () => { workerFailed = true; worker = null; for (const p of pending.values()) p.fallback(); pending.clear(); };
  } catch (e) { workerFailed = true; worker = null; }
  return worker;
}

export async function runAI(def, state, seat, level, traits, rng) {
  const inline = () => Promise.resolve(def.ai.choose(state, seat, level, traits, rng));
  if (def.workerAI) {
    const w = getWorker();
    if (w) {
      const id = ++reqId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, fallback: () => inline().then(resolve, reject) });
        w.postMessage({ id, game: def.id, state, seat, level, traits, seed: Math.floor(rng() * 4294967296) });
        setTimeout(() => { if (pending.has(id)) { pending.delete(id); inline().then(resolve, reject); } }, 12000);
      }).catch(() => inline());
    }
  }
  return inline();
}

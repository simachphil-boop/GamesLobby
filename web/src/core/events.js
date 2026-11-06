// Minimal event bus.
export class Emitter {
  constructor() { this._h = new Map(); }
  on(ev, fn) {
    if (!this._h.has(ev)) this._h.set(ev, new Set());
    this._h.get(ev).add(fn);
    return () => this._h.get(ev).delete(fn);
  }
  emit(ev, ...args) {
    const s = this._h.get(ev);
    if (s) for (const fn of [...s]) { try { fn(...args); } catch (e) { console.error(e); } }
  }
}
export const bus = new Emitter();

// HTML overlays anchored to 3D points: character speech bubbles, floating score/cash text.
import * as THREE from 'three';
import { h } from '../core/util.js';

export class Labels {
  constructor(engine) {
    this.engine = engine;
    this.root = document.getElementById('labels');
    this.items = new Set();
    engine.onUpdate((dt) => this.update(dt));
  }
  /** Speech bubble that follows a character. */
  bubble(character, text, seconds = 2.6, mood = '') {
    for (const it of this.items) if (it.owner === character) this.remove(it);
    const el = h('div', { class: 'bubble ' + mood }, text);
    this.root.appendChild(el);
    const it = { el, owner: character, anchor: () => character.bubbleAnchor(), life: seconds, age: 0 };
    this.items.add(it);
    character.speaking = Math.min(1.2, text.length * 0.05);
    return it;
  }
  /** Floating text rising from a world point (e.g. "+200"). */
  float(worldPos, text, cls = '') {
    const el = h('div', { class: 'float-text ' + cls }, text);
    this.root.appendChild(el);
    const p = worldPos.clone();
    const it = { el, anchor: () => p, life: 1.6, age: 0, rise: true };
    this.items.add(it);
  }
  remove(it) { it.el.remove(); this.items.delete(it); }
  clear() { for (const it of [...this.items]) this.remove(it); }
  update(dt) {
    for (const it of [...this.items]) {
      it.age += dt;
      if (it.age > it.life) { this.remove(it); continue; }
      let s = this.engine.toScreen(it.anchor());
      // the viewer's own (hidden, first-person) character speaks from the bottom of the screen
      if (it.owner && !it.owner.root.visible) s = { x: window.innerWidth / 2, y: window.innerHeight * 0.72, visible: true };
      const rise = it.rise ? it.age * 40 : 0;
      it.el.style.transform = `translate(${s.x}px, ${s.y - rise}px) translate(-50%, -100%)`;
      it.el.style.opacity = s.visible ? String(Math.min(1, (it.life - it.age) * 3, it.age * 8)) : '0';
    }
  }
}

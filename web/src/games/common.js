// Shared helpers for game views (3D picking, highlights, materials, labels).
import * as THREE from 'three';
import { disposeTree, tweens, Ease } from '../scene/engine.js';
import { canvasTexture } from '../scene/textures.js';

export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class ViewBase {
  constructor(ctx) {
    this.ctx = ctx;
    this.group = new THREE.Group();
    ctx.table.add(this.group);
    this.pickables = [];
    this.tapHandler = null;
    this._tapOff = ctx.rig.onTap((x, y) => {
      if (!this.tapHandler) return;
      const hits = ctx.engine.pick(x, y, this.pickables, true);
      this.tapHandler(hits[0] || null, x, y);
    });
    this._updOff = ctx.engine.onUpdate((dt, t) => this.update && this.update(dt, t));
  }
  /** Wait for a human action. setup(resolve) installs taps/buttons and calls resolve(action). */
  ask(setup) {
    return new Promise((resolve) => {
      this._resolve = (a) => { this.tapHandler = null; this._resolve = null; this.ctx.hud.actions([]); this.ctx.hud.setExtra(null); resolve(a); };
      setup(this._resolve);
    });
  }
  cancelHuman() { this.tapHandler = null; this._resolve = null; this.ctx.hud.actions([]); this.ctx.hud.setExtra(null); this.clearHighlights?.(); }
  /** Find the userData value walking up the hit object's parents. */
  static dataOf(hit, key) {
    let o = hit?.object;
    while (o) { if (o.userData && o.userData[key] !== undefined) return o.userData[key]; o = o.parent; }
    return undefined;
  }
  world(v) { return this.group.localToWorld(v.clone()); }
  dispose() {
    this._tapOff(); this._updOff();
    disposeTree(this.group);
    this.group.removeFromParent();
    this.ctx.hud.actions([]); this.ctx.hud.setExtra(null);
  }
}

/** Pulsing ring/disc highlight meshes pool. */
export class Highlights {
  constructor(parent, color = '#7cf8ff', shape = 'disc', size = 0.1) {
    this.parent = parent;
    const geo = shape === 'square' ? new THREE.PlaneGeometry(size, size) : new THREE.RingGeometry(size * 0.55, size * 0.75, 28);
    geo.rotateX(-Math.PI / 2);
    this.geo = geo;
    this.mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    this.items = [];
  }
  set(points, color) {
    this.clear();
    for (const p of points) {
      const m = new THREE.Mesh(this.geo, color ? this.mat.clone() : this.mat);
      if (color) m.material.color.set(color);
      m.position.copy(p); m.position.y += 0.004;
      m.renderOrder = 2;
      this.parent.add(m);
      this.items.push(m);
    }
  }
  clear() { for (const m of this.items) { m.removeFromParent(); if (m.material !== this.mat) m.material.dispose(); } this.items = []; }
  update(t) { const s = 1 + Math.sin(t * 5) * 0.08; this.mat.opacity = 0.32 + Math.sin(t * 5) * 0.14; for (const m of this.items) m.scale.set(s, 1, s); }
  dispose() { this.clear(); this.geo.dispose(); this.mat.dispose(); }
}

export const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1, ...o });

/** Move an object along an arc. */
export function arcMove(obj, to, { height = 0.15, dur = 0.45, ease = Ease.inOut, spin = 0 } = {}) {
  const from = obj.position.clone();
  const r0 = obj.rotation.y;
  return tweens.run(dur, (e) => {
    obj.position.lerpVectors(from, to, e);
    obj.position.y += Math.sin(e * Math.PI) * height;
    if (spin) obj.rotation.y = r0 + spin * e;
  }, ease);
}

/** Rounded board plate with a canvas texture. */
export function boardPlate(size, draw, { thickness = 0.04, key, edge = '#2a1a10' } = {}) {
  const tex = canvasTexture(1024, 1024, draw, { key });
  const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
  const side = new THREE.MeshStandardMaterial({ color: edge, roughness: 0.6 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(size, thickness, size), [side, side, top, side, side, side]);
  m.position.y = thickness / 2;
  m.receiveShadow = true; m.castShadow = true;
  return m;
}

/** Simple sprite text label lying on (or standing above) the table. */
export function textSprite(text, { color = '#fff', size = 0.18, bg = 'rgba(10,10,40,0.75)', font = 'bold 54px sans-serif' } = {}) {
  const tex = canvasTexture(256, 96, (g, w, h) => {
    if (bg) { g.fillStyle = bg; g.beginPath(); g.roundRect ? g.roundRect(4, 4, w - 8, h - 8, 30) : g.rect(4, 4, w - 8, h - 8); g.fill(); }
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 2);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(size * 2.67, size, 1);
  return s;
}

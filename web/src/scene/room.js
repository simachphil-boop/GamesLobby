// Room System: six procedurally built interiors around the same playing table.
import * as THREE from 'three';
import {
  woodTexture, marbleTexture, feltTexture, tileTexture, carpetTexture, gridTexture, wallTexture,
  skylineTexture, artTexture, glowTexture, textTexture,
} from './textures.js';
import { disposeTree } from './engine.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const TABLE_Y = 0.78;          // table surface height
export const SEAT_R = 1.72;           // chair distance from table center
export const PLAY_SIZE = 1.9;         // usable square on the table

/** Seat angles (radians, 0 = player at +Z), clockwise turn order. */
export function seatAngles(n) {
  if (n <= 1) return [0];
  if (n === 2) return [0, Math.PI];
  if (n === 3) return [0, Math.PI * 0.62, -Math.PI * 0.62].map((a) => a);
  if (n === 4) return [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  // 5-6 players: evenly spaced around the table, clockwise from the viewer
  return Array.from({ length: n }, (_, i) => { const a = (i * 2 * Math.PI) / n; return a > Math.PI ? a - 2 * Math.PI : a; });
}
export function seatPosition(angle, r = SEAT_R) {
  return new THREE.Vector3(Math.sin(angle) * r, 0, Math.cos(angle) * r);
}

export const ROOM_THEMES = {
  modern: {
    floor: () => woodTexture('#b08a64', '#6a4a30', 'floor-modern', 8), wall: () => wallTexture('#d9dde8', '#9aa3c0', 'panels'),
    wallColor: '#e4e7f0', table: 'square', tableTop: () => woodTexture('#5b3a22', '#2e1a0c', 'tt-modern', 4), trim: '#2a2f45',
    felt: '#23345e', chair: '#2b3150', accent: '#5aa0ff', night: false, ambient: 0.75, key: 1.6, warm: '#fff1dc', fog: '#cfd6e6',
  },
  luxury: {
    floor: () => marbleTexture('#efe9df', '#b9a98a', 'floor-lux'), wall: () => wallTexture('#3a1830', '#d9b25a', 'damask'),
    wallColor: '#4a2038', table: 'round', tableTop: () => woodTexture('#3a1e10', '#1a0c06', 'tt-lux', 3), trim: '#d9b25a',
    felt: '#4a1030', chair: '#6a1838', accent: '#ffd27a', night: true, ambient: 0.55, key: 1.3, warm: '#ffd9a0', fog: '#2a1020',
  },
  cozy: {
    floor: () => woodTexture('#8a5a34', '#4a2a14', 'floor-cozy', 7), wall: () => wallTexture('#e8d6b8', '#b88a5a', 'stripes'),
    wallColor: '#e6d2b0', table: 'round', tableTop: () => woodTexture('#9a6a3a', '#5a3818', 'tt-cozy', 5), trim: '#5a3818',
    felt: '#3a5a3a', chair: '#8a4a2a', accent: '#ffb35a', night: true, ambient: 0.6, key: 1.2, warm: '#ffc98a', fog: '#3a2818',
  },
  retro: {
    floor: () => tileTexture('#f0e6d0', '#c0392b', true, 'floor-retro'), wall: () => wallTexture('#f2b84a', '#c0602a', 'retro'),
    wallColor: '#f0b040', table: 'square', tableTop: () => woodTexture('#d8a060', '#8a5a2a', 'tt-retro', 6), trim: '#1aa39a',
    felt: '#1a8a80', chair: '#c0392b', accent: '#1ad0c0', night: false, ambient: 0.8, key: 1.4, warm: '#fff0d0', fog: '#e8c890',
  },
  future: {
    floor: () => gridTexture('#06071a', '#2a5cff', 'floor-future'), wall: () => wallTexture('#0d1030', '#3a6bff', 'panels'),
    wallColor: '#10143a', table: 'round', tableTop: () => gridTexture('#0a0c26', '#7a4bff', 'tt-future'), trim: '#5af0ff',
    felt: '#140a3a', chair: '#1a1f4a', accent: '#5af0ff', night: true, ambient: 0.45, key: 1.1, warm: '#a8c8ff', fog: '#05061a', neon: true,
  },
  casino: {
    floor: () => carpetTexture('#3a0f1e', '#5a1a2e', 'floor-casino'), wall: () => wallTexture('#1c0c18', '#c9a040', 'damask'),
    wallColor: '#24101e', table: 'square', tableTop: () => feltTexture('#145a3c', 'tt-casino'), trim: '#c9a040',
    felt: '#145a3c', chair: '#5a0f22', accent: '#ff3a7a', night: true, ambient: 0.45, key: 1.2, warm: '#ffcf8a', fog: '#12060c', neon: true,
  },
};

const matCache = new Map();
// Materials without textures are shared by value so static batching can merge them.
const M = (o) => {
  if (o.map || o.transparent) return new THREE.MeshStandardMaterial(o);
  const key = JSON.stringify(o);
  if (!matCache.has(key)) { const m = new THREE.MeshStandardMaterial(o); m.userData.shared = true; matCache.set(key, m); }
  return matCache.get(key);
};

export class Room {
  constructor(engine) {
    this.engine = engine;
    this.group = new THREE.Group();
    engine.scene.add(this.group);
    this.chairs = [];
    this.animated = [];
    engine.onUpdate((dt, t) => { for (const f of this.animated) f(dt, t); });
  }

  build(themeId) {
    const th = ROOM_THEMES[themeId] || ROOM_THEMES.modern;
    this.themeId = themeId;
    this.theme = th;
    disposeTree(this.group);
    this.group.clear();
    this.animated = [];
    this.chairs = [];
    const g = this.group;
    const scene = this.engine.scene;
    scene.background = new THREE.Color(th.fog);
    scene.fog = new THREE.Fog(th.fog, 9, 20);

    // --- lights ---
    const hemi = new THREE.HemisphereLight(th.night ? '#8a90c8' : '#ffffff', th.night ? '#2a1a2a' : '#8a7a6a', th.ambient);
    g.add(hemi);
    const key = new THREE.DirectionalLight(th.warm, th.key);
    key.position.set(2.5, 5.5, 2.2);
    key.target.position.set(0, TABLE_Y, 0);
    key.castShadow = this.engine.q.shadows;
    key.shadow.mapSize.set(this.engine.q.shadowMap, this.engine.q.shadowMap);
    const sc = key.shadow.camera; sc.left = -3; sc.right = 3; sc.top = 3; sc.bottom = -3; sc.near = 1; sc.far = 12;
    key.shadow.bias = -0.0008; key.shadow.normalBias = 0.02;
    g.add(key, key.target);
    const fill = new THREE.PointLight(th.accent, th.neon ? 6 : 3, 9, 1.6);
    fill.position.set(-3, 2.6, -3);
    g.add(fill);
    if (this.engine.q.lights >= 2) {
      const pend = new THREE.PointLight(th.warm, 5, 5, 1.8);
      pend.position.set(0, 2.4, 0);
      g.add(pend);
    }
    if (this.engine.q.lights >= 3) {
      const rim = new THREE.PointLight(th.accent, 3, 8, 1.6);
      rim.position.set(3.5, 2.2, 2.5);
      g.add(rim);
    }

    // --- shell ---
    const floorTex = th.floor();
    floorTex.repeat.set(th === ROOM_THEMES.retro ? 6 : 3, th === ROOM_THEMES.retro ? 6 : 3);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), M({ map: floorTex, roughness: th === ROOM_THEMES.luxury ? 0.25 : 0.75, metalness: 0.05 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);
    const wallMat = M({ map: th.wall(), roughness: 0.9, color: '#ffffff' });
    const W = 7, H = 3.6;
    const mkWall = (x, z, ry, w) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), wallMat);
      m.position.set(x, H / 2, z); m.rotation.y = ry; g.add(m); return m;
    };
    mkWall(0, -W, 0, 14); mkWall(0, W, Math.PI, 14); mkWall(-W, 0, Math.PI / 2, 14); mkWall(W, 0, -Math.PI / 2, 14);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), M({ color: th.night ? '#15121e' : '#f2f2f6', roughness: 1 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = H; g.add(ceil);
    // baseboards
    const bb = M({ color: th.trim, roughness: 0.6 });
    for (const [x, z, ry] of [[0, -W + 0.03, 0], [0, W - 0.03, 0], [-W + 0.03, 0, Math.PI / 2], [W - 0.03, 0, Math.PI / 2]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(14, 0.14, 0.05), bb); b.position.set(x, 0.07, z); b.rotation.y = ry; g.add(b);
    }

    // --- window with city view (behind the opponents, visible in first person) ---
    this.addWindow(g, th, 0, -W + 0.02, 0);
    this.addWindow(g, th, -W + 0.02, -2.2, Math.PI / 2, 2.2);

    // --- rug ---
    const rug = new THREE.Mesh(new THREE.CircleGeometry(3.1, 48), M({ map: carpetTexture(th.felt, th.trim, 'rug' + themeId), roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.y = 0.005; rug.receiveShadow = true; g.add(rug);

    // --- table ---
    this.addTable(g, th);

    // --- decor ---
    this.addShelf(g, th, -3.6, -W + 0.35, 0);
    this.addShelf(g, th, 3.6, -W + 0.35, 0);
    this.addShelf(g, th, W - 0.35, 2.0, -Math.PI / 2);
    this.addPlant(g, -5.6, -5.6, 1.2); this.addPlant(g, 5.6, -5.6, 1.0); this.addPlant(g, 5.6, 5.4, 1.3); this.addPlant(g, -5.6, 5.0, 0.9);
    this.addPainting(g, th, W - 0.03, -2.6, -Math.PI / 2, 1);
    this.addPainting(g, th, -W + 0.03, 2.8, Math.PI / 2, 2);
    this.addPainting(g, th, 0, W - 0.03, Math.PI, 3);
    this.addFloorLamp(g, th, -4.6, -3.6);
    this.addFloorLamp(g, th, 4.6, 4.2);
    this.addPendant(g, th);
    this.addSofa(g, th, 0, 5.6, Math.PI);
    if (themeId === 'cozy') this.addFireplace(g, W - 0.3, -2.4 + 0.0, -Math.PI / 2, th);
    if (themeId === 'luxury') this.addChandelier(g, th);
    if (themeId === 'retro') { this.addArcade(g, -W + 0.6, 4.2, Math.PI / 2, '#c0392b'); this.addArcade(g, -W + 0.6, 5.3, Math.PI / 2, '#1a8a80'); }
    if (th.neon) this.addNeon(g, th, themeId);
    this.batchStatic();
    return this;
  }

  /** Merge static decor meshes that share a material into single draw calls (mobile perf). */
  batchStatic() {
    this.group.updateMatrixWorld(true);
    const buckets = new Map();
    const dynamic = new Set(this.dynamicRoots || []);
    this.group.traverse((o) => {
      if (!o.isMesh || Array.isArray(o.material) || o.userData.keep) return;
      for (let p = o; p; p = p.parent) if (dynamic.has(p)) return;
      const key = o.material.uuid + (o.receiveShadow ? 'r' : '') + (o.castShadow ? 'c' : '');
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(o);
    });
    for (const list of buckets.values()) {
      if (list.length < 2) continue;
      const geos = list.map((m) => {
        let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        g.applyMatrix4(m.matrixWorld);
        return g;
      });
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, list[0].material);
      mesh.receiveShadow = list[0].receiveShadow; mesh.castShadow = list[0].castShadow;
      for (const m of list) m.removeFromParent();
      this.group.add(mesh);
    }
    this.dynamicRoots = [];
  }

  addWindow(g, th, x, z, ry, w = 3.6) {
    const grp = new THREE.Group();
    const view = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.8), new THREE.MeshBasicMaterial({ map: skylineTexture(th.night), fog: false }));
    grp.add(view);
    const frameM = M({ color: th.trim, roughness: 0.5, metalness: 0.3 });
    const bars = [[0, 0.92, w + 0.12, 0.08], [0, -0.92, w + 0.12, 0.08], [-w / 2, 0, 0.08, 1.9], [w / 2, 0, 0.08, 1.9], [0, 0, 0.05, 1.8], [0, 0.1, w, 0.04]];
    for (const [bx, by, bw, bh] of bars) { const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.08), frameM); b.position.set(bx, by, 0.02); grp.add(b); }
    const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.06, 0.25), frameM); sill.position.set(0, -0.96, 0.1); grp.add(sill);
    // curtains
    const cm = M({ color: th.felt, roughness: 1, side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 2.5, 6, 1), cm);
      const pos = c.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 18) * 0.04);
      c.geometry.computeVertexNormals();
      c.position.set(s * (w / 2 + 0.3), -0.05, 0.1); grp.add(c);
    }
    grp.position.set(x, 1.85, z); grp.rotation.y = ry;
    g.add(grp);
  }

  addTable(g, th) {
    const topMat = M({ map: th.tableTop(), roughness: 0.45, metalness: 0.05 });
    const trimMat = M({ color: th.trim, roughness: 0.35, metalness: th.neon || th === ROOM_THEMES.luxury ? 0.6 : 0.1, emissive: th.neon ? th.trim : '#000', emissiveIntensity: th.neon ? 0.35 : 0 });
    const legMat = M({ color: '#2a1a12', roughness: 0.6 });
    let top;
    if (th.table === 'round') {
      top = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.42, 0.07, 64), topMat);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.04, 10, 64), trimMat);
      rim.rotation.x = Math.PI / 2; rim.position.y = TABLE_Y - 0.035; g.add(rim);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.5, TABLE_Y - 0.07, 24), legMat);
      ped.position.y = (TABLE_Y - 0.07) / 2; ped.castShadow = true; g.add(ped);
    } else {
      top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.07, 2.6), topMat);
      for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const e = new THREE.Mesh(new THREE.BoxGeometry(sx ? 0.06 : 2.68, 0.09, sz ? 0.06 : 2.68), trimMat);
        e.position.set(sx * 1.32, TABLE_Y - 0.035, sz * 1.32); g.add(e);
      }
      for (const [lx, lz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, TABLE_Y - 0.07, 0.1), legMat);
        l.position.set(lx * 1.15, (TABLE_Y - 0.07) / 2, lz * 1.15); l.castShadow = true; g.add(l);
      }
    }
    top.position.y = TABLE_Y - 0.035;
    top.receiveShadow = true; top.castShadow = true; top.userData.keep = true;
    g.add(top);
    this.tableTop = top;
  }

  /** Chairs are placed per match (seat count varies). */
  placeChairs(angles) {
    for (const c of this.chairs) { this.group.remove(c); disposeTree(c); }
    this.chairs = [];
    const th = this.theme;
    const mat = M({ color: th.chair, roughness: 0.8 });
    const frame = M({ color: th.trim, roughness: 0.4, metalness: 0.4 });
    for (const a of angles) {
      const c = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.58), mat); seat.position.y = 0.48; seat.castShadow = true;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.12), mat); back.position.set(0, 0.92, 0.3); back.castShadow = true;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.06, 0.16), frame); cap.position.set(0, 1.33, 0.3);
      c.add(seat, back, cap);
      for (const [x, z] of [[0.26, 0.24], [-0.26, 0.24], [0.26, -0.24], [-0.26, -0.24]]) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.44, 8), frame); l.position.set(x, 0.22, z); c.add(l);
      }
      const p = seatPosition(a, SEAT_R + 0.08);
      c.position.copy(p);
      c.rotation.y = a;
      this.group.add(c);
      this.chairs.push(c);
    }
  }

  addShelf(g, th, x, z, ry) {
    const grp = new THREE.Group();
    const wood = M({ map: woodTexture('#6a4428', '#3a2010', 'shelfwood', 3), roughness: 0.7 });
    const W = 1.8, H = 2.2, D = 0.4;
    for (const sx of [-1, 1]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.05, H, D), wood); s.position.set(sx * W / 2, H / 2, 0); grp.add(s); }
    const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.02), wood); back.position.set(0, H / 2, -D / 2); grp.add(back);
    const colors = ['#c0392b', '#2f6fd8', '#f1c40f', '#27ae60', '#8e44ad', '#e67e22', '#16a085', '#d35400', '#ecf0f1', '#e84393'];
    let ci = Math.abs(Math.round(x * 3 + z));
    for (let lvl = 0; lvl < 4; lvl++) {
      const y = 0.1 + lvl * 0.55;
      const b = new THREE.Mesh(new THREE.BoxGeometry(W, 0.04, D), wood); b.position.set(0, y, 0); grp.add(b);
      let px = -W / 2 + 0.08;
      while (px < W / 2 - 0.25) {
        const flat = (ci % 3) === 0;
        const bw = flat ? 0.38 : 0.06 + (ci % 4) * 0.03, bh = flat ? 0.08 + (ci % 2) * 0.04 : 0.32 + (ci % 3) * 0.06;
        const mat = M({ color: colors[ci % colors.length], roughness: 0.6 });
        if (flat) {
          // stack of game boxes
          for (let k = 0; k < 2 + (ci % 2); k++) {
            const box = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, D * 0.8), M({ color: colors[(ci + k * 3) % colors.length], roughness: 0.5 }));
            box.position.set(px + bw / 2, y + 0.02 + bh / 2 + k * bh, 0); grp.add(box);
          }
        } else {
          const box = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, D * 0.75), mat);
          box.position.set(px + bw / 2, y + 0.02 + bh / 2, 0); grp.add(box);
        }
        px += bw + 0.02; ci++;
      }
    }
    grp.position.set(x, 0, z); grp.rotation.y = ry;
    g.add(grp);
  }

  addPlant(g, x, z, s) {
    const grp = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.4, 16), M({ color: '#d9d4cc', roughness: 0.6 }));
    pot.position.y = 0.2; grp.add(pot);
    const leafMat = M({ color: '#2f7a3a', roughness: 0.8, side: THREE.DoubleSide });
    const leafMat2 = M({ color: '#3f9a4a', roughness: 0.8, side: THREE.DoubleSide });
    for (let i = 0; i < 9; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), i % 2 ? leafMat : leafMat2);
      leaf.scale.set(0.5, 1.6, 0.18);
      const a = (i / 9) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 0.12, 0.6 + (i % 3) * 0.12, Math.sin(a) * 0.12);
      leaf.rotation.set(Math.sin(a) * 0.6, a, Math.cos(a) * 0.6);
      grp.add(leaf);
    }
    grp.scale.setScalar(s);
    grp.position.set(x, 0, z);
    g.add(grp);
    const ph = x + z;
    this.animated.push((dt, t) => { grp.rotation.z = Math.sin(t * 0.7 + ph) * 0.02; });
    (this.dynamicRoots ||= []).push(grp);
  }

  addPainting(g, th, x, z, ry, seed) {
    const pal = th.night ? ['#1a1030', '#ff6a9a', '#ffd27a', '#5af0ff', '#7a4bff'] : ['#f4efe6', '#2f6fd8', '#f1c40f', '#c0392b', '#1d1d1d'];
    const grp = new THREE.Group();
    const art = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.4), M({ map: artTexture(seed, pal), roughness: 0.8 }));
    art.position.z = 0.03;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.55, 0.05), M({ color: th.trim, roughness: 0.4, metalness: 0.5 }));
    grp.add(frame, art);
    grp.position.set(x, 1.9, z); grp.rotation.y = ry;
    g.add(grp);
  }

  addFloorLamp(g, th, x, z) {
    const grp = new THREE.Group();
    const metal = M({ color: '#222', roughness: 0.3, metalness: 0.8 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.04, 20), metal);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 8), metal); pole.position.y = 0.8;
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 0.32, 20, 1, true),
      M({ color: '#fff4dd', emissive: th.warm, emissiveIntensity: 0.9, side: THREE.DoubleSide, roughness: 1 }));
    shade.position.y = 1.65;
    grp.add(base, pole, shade);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#ffd9a0'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
    glow.scale.set(1.4, 1.4, 1); glow.position.y = 1.65; grp.add(glow);
    grp.position.set(x, 0, z);
    g.add(grp);
  }

  addPendant(g, th) {
    const grp = new THREE.Group();
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.0, 6), M({ color: '#111' })); cord.position.y = 3.1;
    const shade = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      M({ color: th.trim, roughness: 0.3, metalness: 0.6, side: THREE.DoubleSide }));
    shade.position.y = 2.6;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff3d8' }));
    bulb.position.y = 2.55;
    grp.add(cord, shade, bulb);
    g.add(grp);
  }

  addSofa(g, th, x, z, ry) {
    const grp = new THREE.Group();
    const mat = M({ color: th.chair, roughness: 0.9 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.45, 0.9), mat); base.position.y = 0.3;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.6, 0.25), mat); back.position.set(0, 0.75, -0.35);
    const a1 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.5, 0.9), mat); a1.position.set(1.3, 0.55, 0);
    const a2 = a1.clone(); a2.position.x = -1.3;
    for (let i = -1; i <= 1; i += 2) {
      const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.12), M({ color: th.accent, roughness: 1 }));
      pillow.position.set(i * 0.7, 0.72, -0.18); pillow.rotation.z = i * 0.15; grp.add(pillow);
    }
    grp.add(base, back, a1, a2);
    grp.position.set(x, 0, z); grp.rotation.y = ry;
    g.add(grp);
  }

  addFireplace(g, x, z, ry, th) {
    const grp = new THREE.Group();
    const brick = M({ map: wallTexture('#8a3a24', '#3a1a10', 'brick', 'brick'), roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.3, 0.5), brick); body.position.y = 0.65;
    const hole = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 0.05), new THREE.MeshBasicMaterial({ color: '#120604' }));
    hole.position.set(0, 0.45, 0.24);
    const mantle = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.6), M({ color: '#4a2a14' })); mantle.position.y = 1.32;
    const fire = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#ff8a2a'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    fire.position.set(0, 0.4, 0.3); fire.scale.set(0.9, 0.7, 1);
    const light = new THREE.PointLight('#ff8a3a', 4, 5, 1.8); light.position.set(0, 0.5, 0.6);
    grp.add(body, hole, mantle, fire, light);
    grp.position.set(x, 0, z); grp.rotation.y = ry;
    g.add(grp);
    (this.dynamicRoots ||= []).push(fire);
    this.animated.push((dt, t) => {
      const f = 0.85 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.07;
      fire.scale.set(0.9 * f, 0.7 * (2 - f), 1); light.intensity = 3.5 * f;
    });
  }

  addChandelier(g, th) {
    const grp = new THREE.Group();
    const gold = M({ color: '#d9b25a', metalness: 0.9, roughness: 0.25 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 8, 40), gold); ring.rotation.x = Math.PI / 2;
    grp.add(ring);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff6dc' }));
      c.position.set(Math.cos(a) * 0.55, 0.06, Math.sin(a) * 0.55); grp.add(c);
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.04), M({ color: '#ffffff', metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.8 }));
      crystal.position.set(Math.cos(a) * 0.45, -0.15, Math.sin(a) * 0.45); grp.add(crystal);
    }
    grp.position.y = 3.0;
    g.add(grp);
    this.animated.push((dt, t) => { grp.rotation.y = t * 0.05; });
    (this.dynamicRoots ||= []).push(grp);
  }

  addArcade(g, x, z, ry, color) {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.7), M({ color, roughness: 0.6 })); body.position.y = 0.9;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.4), new THREE.MeshBasicMaterial({ map: gridTexture('#000', '#ffde3a', 'arcade' + color) }));
    scr.position.set(0, 1.3, 0.36);
    grp.add(body, scr);
    grp.position.set(x, 0, z); grp.rotation.y = ry; g.add(grp);
  }

  addNeon(g, th, themeId) {
    const neon = new THREE.MeshBasicMaterial({ color: th.accent });
    for (const [x, z, ry] of [[0, -6.95, 0], [-6.95, 0, Math.PI / 2], [6.95, 0, -Math.PI / 2]]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.04, 0.02), neon);
      strip.position.set(x, 3.2, z); strip.rotation.y = ry; g.add(strip);
      const strip2 = strip.clone(); strip2.position.y = 0.3; g.add(strip2);
    }
    const signTex = textTexture('BOARDVERSE', { w: 1024, h: 192, font: 'bold 120px sans-serif', color: '#fff', glow: th.accent });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.6), new THREE.MeshBasicMaterial({ map: signTex, transparent: true }));
    sign.position.set(0, 3.0, -6.9); g.add(sign);
    if (themeId === 'future') {
      const holo = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.012, 6, 64), new THREE.MeshBasicMaterial({ color: '#5af0ff', transparent: true, opacity: 0.6 }));
      holo.rotation.x = Math.PI / 2; holo.position.y = 2.4; g.add(holo);
      const holo2 = holo.clone(); holo2.scale.setScalar(0.7); g.add(holo2);
      (this.dynamicRoots ||= []).push(holo, holo2);
      this.animated.push((dt, t) => { holo.position.y = 2.4 + Math.sin(t) * 0.05; holo2.position.y = 2.5 + Math.cos(t * 1.3) * 0.06; holo.rotation.z = t * 0.3; });
    }
    if (themeId === 'casino') {
      this.animated.push((dt, t) => { sign.material.opacity = 0.85 + Math.sin(t * 3) * 0.15; });
    }
  }
}

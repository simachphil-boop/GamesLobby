// Character System: procedural low-poly avatars with a drawn, animated face,
// two-bone IK arms (reaching for pieces, holding cards), emotes and look-at.
import * as THREE from 'three';
import { SKIN_TONES, HAIR_COLORS, OUTFIT_COLORS, EYE_COLORS } from '../core/catalog.js';
import { TABLE_Y } from './room.js';
import { tweens, Ease } from './engine.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const SG = (geo) => { geo.userData.shared = true; return geo; };
const GEO = {
  sphere: SG(new THREE.SphereGeometry(1, 20, 14)),
  sphereLo: SG(new THREE.SphereGeometry(1, 12, 8)),
  limb: SG(new THREE.CapsuleGeometry(0.05, 0.2, 4, 10).translate(0, -0.13, 0)),
  fore: SG(new THREE.CapsuleGeometry(0.043, 0.19, 4, 10).translate(0, -0.12, 0)),
  torso: SG(new THREE.CylinderGeometry(0.2, 0.17, 0.5, 18)),
  cyl: SG(new THREE.CylinderGeometry(1, 1, 1, 18)),
  cone: SG(new THREE.ConeGeometry(1, 1, 14)),
  box: SG(new THREE.BoxGeometry(1, 1, 1)),
  torus: SG(new THREE.TorusGeometry(1, 0.12, 8, 24)),
  face: SG(new THREE.SphereGeometry(1, 28, 20, Math.PI * 1.5 - 1.05, 2.1, Math.PI * 0.26, Math.PI * 0.5)),
};
const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...opts });
    m.userData.shared = true;
    matCache.set(key, m);
  }
  return matCache.get(key);
}
function mesh(geo, material, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geo, material);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
}

function mergeChildren(group, keep) {
  const buckets = new Map();
  for (const o of group.children) {
    if (!o.isMesh || keep.has(o) || Array.isArray(o.material) || o.material.transparent) continue;
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material).push(o);
  }
  for (const [material, list] of buckets) {
    if (list.length < 2) continue;
    const geos = list.map((m) => {
      m.updateMatrix();
      const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone());
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      return g.applyMatrix4(m.matrix);
    });
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    list.forEach((m) => m.removeFromParent());
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true;
    group.add(mesh);
  }
}

// ---------- face drawing ----------
const EXPR = {
  neutral: { brow: 0, browY: 0, mouth: 'line', curve: 0.1, eye: 1 },
  happy: { brow: -0.1, browY: -2, mouth: 'smile', curve: 0.6, eye: 0.9, blush: 0.35 },
  laugh: { brow: -0.2, browY: -4, mouth: 'open', curve: 0.8, eye: 0.15, blush: 0.5 },
  sad: { brow: 0.35, browY: 2, mouth: 'smile', curve: -0.45, eye: 0.75 },
  surprised: { brow: -0.05, browY: -10, mouth: 'o', curve: 0, eye: 1.25 },
  thinking: { brow: 0.15, browY: -3, mouth: 'side', curve: 0.1, eye: 0.85, lookUp: true },
  angry: { brow: -0.45, browY: 3, mouth: 'smile', curve: -0.3, eye: 0.8 },
  smug: { brow: -0.15, browY: -1, mouth: 'smirk', curve: 0.4, eye: 0.7 },
  wink: { brow: -0.1, browY: -2, mouth: 'smile', curve: 0.6, eye: 1, wink: true, blush: 0.3 },
  cool: { brow: -0.2, browY: 0, mouth: 'smirk', curve: 0.3, eye: 0.6 },
  love: { brow: -0.1, browY: -3, mouth: 'smile', curve: 0.7, eye: 1, hearts: true, blush: 0.6 },
};

function drawFace(g, expr, blink, lx, ly, eyeColor, lashes) {
  const W = 256;
  g.clearRect(0, 0, W, W);
  const e = EXPR[expr] || EXPR.neutral;
  const cx = 128, ey = 112, sep = 40;
  const open = Math.max(0.05, (blink ? 0.08 : e.eye));
  // blush
  if (e.blush) {
    g.fillStyle = `rgba(255,90,110,${e.blush * 0.6})`;
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 58, ey + 34, 18, 10, 0, 0, 7); g.fill(); }
  }
  for (const s of [-1, 1]) {
    const x = cx + s * sep;
    const winkThis = e.wink && s === 1;
    const oy = e.lookUp ? -6 : 0;
    if (e.hearts) {
      g.fillStyle = '#ff3a6a';
      g.beginPath(); const hx = x, hy = ey - 2;
      g.moveTo(hx, hy + 12); g.bezierCurveTo(hx - 22, hy - 4, hx - 10, hy - 20, hx, hy - 8);
      g.bezierCurveTo(hx + 10, hy - 20, hx + 22, hy - 4, hx, hy + 12); g.fill();
    } else if (winkThis || open < 0.2) {
      g.strokeStyle = '#2a1a14'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath();
      if (expr === 'laugh' || winkThis) { g.arc(x, ey + 6, 14, Math.PI * 1.15, Math.PI * 1.85); }
      else { g.moveTo(x - 14, ey); g.lineTo(x + 14, ey); }
      g.stroke();
    } else {
      const ry = 17 * open;
      g.fillStyle = '#ffffff';
      g.beginPath(); g.ellipse(x, ey, 15, ry, 0, 0, 7); g.fill();
      g.save(); g.beginPath(); g.ellipse(x, ey, 15, ry, 0, 0, 7); g.clip();
      const px = x + lx * 6, py = ey + ly * 5 + oy;
      g.fillStyle = eyeColor; g.beginPath(); g.arc(px, py, 10, 0, 7); g.fill();
      g.fillStyle = '#120a08'; g.beginPath(); g.arc(px, py, 5.5, 0, 7); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(px - 3.5, py - 4, 3, 0, 7); g.fill();
      g.restore();
      g.strokeStyle = '#2a1a14'; g.lineWidth = 3.5;
      g.beginPath(); g.ellipse(x, ey, 15, ry, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      if (lashes) { g.lineWidth = 3; for (const k of [-1, 0, 1]) { g.beginPath(); g.moveTo(x + s * (10 + k * 4), ey - ry + 2); g.lineTo(x + s * (16 + k * 5), ey - ry - 5); g.stroke(); } }
    }
    // brows
    g.strokeStyle = '#3a2418'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath();
    const by = ey - 30 + e.browY;
    // inner end rises when worried/sad (brow>0) and drops when angry (brow<0)
    g.moveTo(x - s * 15, by - e.brow * 14);
    g.lineTo(x + s * 15, by + e.brow * 8);
    g.stroke();
  }
  // nose hint
  g.strokeStyle = 'rgba(120,60,40,0.35)'; g.lineWidth = 3;
  g.beginPath(); g.arc(cx, ey + 32, 6, 0.2, Math.PI - 0.2); g.stroke();
  // mouth
  const my = ey + 58;
  g.strokeStyle = '#5a1e1e'; g.lineWidth = 5; g.lineCap = 'round'; g.fillStyle = '#7a2a2a';
  switch (e.mouth) {
    case 'smile': {
      const c = e.curve * 22;
      g.beginPath(); g.moveTo(cx - 24, my - c * 0.3); g.quadraticCurveTo(cx, my + c, cx + 24, my - c * 0.3); g.stroke();
      break;
    }
    case 'open': {
      g.beginPath(); g.moveTo(cx - 26, my - 6); g.quadraticCurveTo(cx, my + 34, cx + 26, my - 6); g.closePath(); g.fill();
      g.fillStyle = '#ff8a9a'; g.beginPath(); g.ellipse(cx, my + 12, 10, 6, 0, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.fillRect(cx - 18, my - 6, 36, 6);
      break;
    }
    case 'o': g.beginPath(); g.ellipse(cx, my + 4, 10, 14, 0, 0, 7); g.fill(); break;
    case 'side': g.beginPath(); g.moveTo(cx - 12, my + 4); g.quadraticCurveTo(cx + 6, my, cx + 18, my - 6); g.stroke(); break;
    case 'smirk': g.beginPath(); g.moveTo(cx - 20, my + 2); g.quadraticCurveTo(cx + 4, my + 10, cx + 24, my - 8); g.stroke(); break;
    default: g.beginPath(); g.moveTo(cx - 16, my); g.lineTo(cx + 16, my + e.curve * 6); g.stroke();
  }
}

// ---------- Character ----------
export class Character {
  /**
   * @param {object} look avatar config {skin,hair,hairColor,eyes,outfit,outfitColor,accessory,body,mood}
   */
  constructor(look, { name = '', lashes = false } = {}) {
    this.name = name;
    this.look = { ...look };
    this.lashes = lashes || ['long', 'bob', 'ponytail', 'bun'].includes(look.hair);
    this.root = new THREE.Group();
    this.mood = look.mood || 'neutral';
    this.expr = this.mood;
    this.exprUntil = 0;
    this.blinkT = 2 + Math.random() * 3;
    this.blinking = 0;
    this.lookTarget = null;
    this.lookCur = new THREE.Vector2(0, 0); // yaw, pitch
    this.eye = new THREE.Vector2();
    this.anim = null;
    this.phase = Math.random() * 10;
    this.handMode = 'rest';
    this.reachTarget = null;
    this.handCur = [new THREE.Vector3(), new THREE.Vector3()];
    this.speaking = 0;
    this.build();
  }

  build() {
    const L = this.look;
    const skin = mat(SKIN_TONES[L.skin % SKIN_TONES.length] || SKIN_TONES[1], { roughness: 0.65 });
    const oc = OUTFIT_COLORS[L.outfitColor % OUTFIT_COLORS.length] || '#3a4fd8';
    const outfit = mat(oc, { roughness: 0.85 });
    const hairM = mat(HAIR_COLORS[L.hairColor % HAIR_COLORS.length] || '#3a2418', { roughness: 0.6 });
    const bodyW = L.body === 'slim' ? 0.88 : L.body === 'broad' ? 1.16 : 1;
    this.skinMat = skin;

    const body = new THREE.Group();
    body.position.y = 0.56;
    this.body = body;
    this.root.add(body);

    // legs (seated, thighs forward under table)
    const pants = mat(L.outfit === 'suit' ? '#1a1c2a' : L.outfit === 'dress' ? oc : '#2a3050', { roughness: 0.9 });
    for (const s of [-1, 1]) {
      const thigh = mesh(GEO.box, pants, 0.13, 0.13, 0.42); thigh.position.set(s * 0.1, -0.02, -0.18); body.add(thigh);
      const shin = mesh(GEO.box, pants, 0.11, 0.42, 0.12); shin.position.set(s * 0.1, -0.24, -0.38); body.add(shin);
      const shoe = mesh(GEO.box, mat('#1a1414'), 0.12, 0.07, 0.2); shoe.position.set(s * 0.1, -0.46, -0.44); body.add(shoe);
    }
    // torso
    const torso = mesh(GEO.torso, outfit, bodyW, 1, 0.78);
    torso.position.y = 0.26;
    body.add(torso);
    this.torso = torso;
    const shoulders = mesh(GEO.sphereLo, outfit, 0.24 * bodyW, 0.1, 0.15); shoulders.position.y = 0.48; body.add(shoulders);
    this.addOutfitDetails(body, L, oc, bodyW);

    // neck + head
    const neck = new THREE.Group(); neck.position.y = 0.53; body.add(neck);
    const neckMesh = mesh(GEO.cyl, skin, 0.055, 0.1, 0.055); neckMesh.position.y = 0.03; neck.add(neckMesh);
    const head = new THREE.Group(); head.position.y = 0.08; neck.add(head);
    this.neck = neck; this.head = head;
    const R = 0.155;
    const skull = mesh(GEO.sphere, skin, R, R * 1.08, R * 0.98); skull.position.y = 0.14; head.add(skull);
    for (const s of [-1, 1]) { const ear = mesh(GEO.sphereLo, skin, 0.03, 0.045, 0.02); ear.position.set(s * R * 0.98, 0.14, 0); head.add(ear); }
    // face decal
    this.faceCanvas = document.createElement('canvas');
    this.faceCanvas.width = this.faceCanvas.height = 256;
    this.faceCtx = this.faceCanvas.getContext('2d');
    this.faceTex = new THREE.CanvasTexture(this.faceCanvas);
    this.faceTex.colorSpace = THREE.SRGBColorSpace;
    const faceMat = new THREE.MeshStandardMaterial({ map: this.faceTex, transparent: true, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const face = new THREE.Mesh(GEO.face, faceMat);
    face.scale.set(R * 1.012, R * 1.09, R * 0.995); face.position.y = 0.14;
    head.add(face);
    this.faceMesh = face;
    this.headR = R;
    this.addHair(head, L.hair, hairM, R);
    this.addAccessory(head, L.accessory, R);

    // arms
    this.shoulders = [];
    this.elbows = [];
    this.hands = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(s * 0.215 * bodyW, 0.46, 0); body.add(sh);
      const up = mesh(GEO.limb, outfit); sh.add(up);
      const el = new THREE.Group(); el.position.y = -0.27; sh.add(el);
      const fo = mesh(GEO.fore, L.outfit === 'tshirt' || L.outfit === 'dress' ? skin : outfit); el.add(fo);
      const hand = mesh(GEO.sphereLo, skin, 0.048, 0.042, 0.055); hand.position.y = -0.27; el.add(hand);
      this.shoulders.push(sh); this.elbows.push(el); this.hands.push(hand);
    }
    this.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    // Draw-call reduction: merge rigid parts that share a material within each animated bone.
    const keep = new Set([this.torso, this.faceMesh]);
    for (const grp of [this.body, this.head, ...this.elbows, ...this.shoulders]) mergeChildren(grp, keep);
    this.redrawFace(true);
    this.restHands();
  }

  addOutfitDetails(body, L, oc, bw) {
    const white = mat('#f4f4f8');
    const gold = mat('#d9b25a', { metalness: 0.7, roughness: 0.3 });
    switch (L.outfit) {
      case 'hoodie': {
        const hood = mesh(GEO.torus, mat(oc), 0.15, 0.15, 0.3); hood.position.set(0, 0.5, 0.06); hood.rotation.x = Math.PI / 2; body.add(hood);
        for (const s of [-1, 1]) { const str = mesh(GEO.cyl, white, 0.008, 0.14, 0.008); str.position.set(s * 0.05, 0.38, -0.155); body.add(str); }
        const pocket = mesh(GEO.box, mat(oc, { roughness: 1 }), 0.22, 0.09, 0.02); pocket.position.set(0, 0.12, -0.15); body.add(pocket);
        break;
      }
      case 'suit': case 'jacket': {
        const shirt = mesh(GEO.cone, white, 0.08, 0.26, 0.02); shirt.position.set(0, 0.38, -0.165); shirt.rotation.x = Math.PI; body.add(shirt);
        if (L.outfit === 'suit') { const tie = mesh(GEO.box, mat('#b0202a'), 0.035, 0.22, 0.015); tie.position.set(0, 0.34, -0.172); body.add(tie); }
        else { for (const s of [-1, 1]) { const z = mesh(GEO.box, mat('#d0d0d8', { metalness: 0.6 }), 0.008, 0.4, 0.01); z.position.set(s * 0.03, 0.26, -0.17); body.add(z); } }
        break;
      }
      case 'sweater': {
        for (let i = 0; i < 3; i++) { const st = mesh(GEO.cyl, white, 0.19 * bw, 0.025, 0.15); st.position.y = 0.16 + i * 0.1; body.add(st); }
        break;
      }
      case 'tracksuit': {
        const z = mesh(GEO.box, white, 0.015, 0.45, 0.01); z.position.set(0, 0.26, -0.168); body.add(z);
        for (const s of [-1, 1]) { const st = mesh(GEO.box, white, 0.02, 0.5, 0.01); st.position.set(s * 0.17 * bw, 0.26, -0.11); body.add(st); }
        break;
      }
      case 'dress': {
        const skirt = mesh(GEO.cone, mat(oc), 0.3, 0.35, 0.3); skirt.position.y = -0.02; skirt.rotation.x = Math.PI; body.add(skirt);
        const neck = mesh(GEO.torus, white, 0.07, 0.07, 0.07); neck.position.y = 0.5; neck.rotation.x = Math.PI / 2; body.add(neck);
        break;
      }
      case 'royal': {
        const fur = mesh(GEO.torus, white, 0.18, 0.18, 0.5); fur.position.y = 0.48; fur.rotation.x = Math.PI / 2; body.add(fur);
        const trim = mesh(GEO.box, gold, 0.03, 0.45, 0.01); trim.position.set(0, 0.25, -0.17); body.add(trim);
        break;
      }
      default: {
        const collar = mesh(GEO.torus, mat(oc, { roughness: 1 }), 0.075, 0.075, 0.1); collar.position.y = 0.5; collar.rotation.x = Math.PI / 2; body.add(collar);
      }
    }
  }

  addHair(head, style, m, R) {
    const y = 0.14;
    const cap = (sx = 1.06, sy = 1.08, sz = 1.06, dy = 0.02) => {
      const c = new THREE.Mesh(new THREE.SphereGeometry(R, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), m);
      c.scale.set(sx, sy, sz); c.position.y = y + dy; c.castShadow = true; head.add(c); return c;
    };
    switch (style) {
      case 'bald': break;
      case 'short': cap(1.06, 1.06, 1.08, 0.015); break;
      case 'bob': {
        cap(1.1, 1.1, 1.1, 0.01);
        const back = mesh(GEO.sphere, m, R * 1.1, R * 0.9, R * 0.9); back.position.set(0, y - 0.04, 0.03); head.add(back);
        break;
      }
      case 'long': {
        cap(1.08, 1.1, 1.1, 0.01);
        const back = mesh(GEO.box, m, R * 2.1, R * 2.6, R * 0.6); back.position.set(0, y - 0.12, 0.09); head.add(back);
        break;
      }
      case 'bun': {
        cap(1.06, 1.08, 1.08, 0.01);
        const bun = mesh(GEO.sphere, m, R * 0.45); bun.position.set(0, y + R * 1.05, 0.06); head.add(bun);
        break;
      }
      case 'ponytail': {
        cap(1.06, 1.08, 1.08, 0.01);
        const tail = mesh(GEO.cone, m, R * 0.3, R * 1.6, R * 0.3); tail.position.set(0, y - 0.04, R * 1.15); tail.rotation.x = Math.PI * 0.85; head.add(tail);
        break;
      }
      case 'spiky': {
        cap(1.04, 1.02, 1.06, 0.02);
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2;
          const sp = mesh(GEO.cone, m, R * 0.22, R * 0.6, R * 0.22);
          sp.position.set(Math.cos(a) * R * 0.5, y + R * 0.85, Math.sin(a) * R * 0.5 + 0.01);
          sp.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); head.add(sp);
        }
        break;
      }
      case 'mohawk': {
        for (let i = 0; i < 6; i++) {
          const sp = mesh(GEO.cone, m, R * 0.14, R * 0.7, R * 0.3);
          sp.position.set(0, y + R * 0.95 - Math.abs(i - 2.5) * 0.012, -R * 0.6 + i * R * 0.28); head.add(sp);
        }
        break;
      }
      case 'curly': {
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          const b = mesh(GEO.sphereLo, m, R * 0.36);
          const ring = i % 2 ? 0.75 : 0.95;
          b.position.set(Math.cos(a) * R * ring, y + R * (0.55 + (i % 3) * 0.15), Math.sin(a) * R * ring + 0.02);
          head.add(b);
        }
        cap(1.05, 1.05, 1.05, 0.03);
        break;
      }
      default: cap();
    }
  }

  addAccessory(head, acc, R) {
    const y = 0.14;
    const black = mat('#141418', { roughness: 0.3, metalness: 0.4 });
    const gold = mat('#e6c25a', { metalness: 0.85, roughness: 0.25 });
    const oc = mat(OUTFIT_COLORS[(this.look.outfitColor + 3) % OUTFIT_COLORS.length]);
    switch (acc) {
      case 'glasses': case 'sunglasses': {
        for (const s of [-1, 1]) {
          const ring = mesh(GEO.torus, black, 0.036, 0.036, 0.05); ring.position.set(s * 0.06, y + 0.01, -R * 0.98); head.add(ring);
          if (acc === 'sunglasses') { const lens = mesh(GEO.cyl, mat('#0a0a14', { roughness: 0.1, metalness: 0.8 }), 0.035, 0.005, 0.035); lens.rotation.x = Math.PI / 2; lens.position.copy(ring.position); head.add(lens); }
          const arm = mesh(GEO.box, black, 0.006, 0.006, R * 0.9); arm.position.set(s * R * 0.92, y + 0.02, -R * 0.5); head.add(arm);
        }
        const bridge = mesh(GEO.box, black, 0.04, 0.006, 0.006); bridge.position.set(0, y + 0.02, -R * 1.0); head.add(bridge);
        break;
      }
      case 'cap': {
        const c = new THREE.Mesh(new THREE.SphereGeometry(R * 1.1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), oc); c.position.y = y + 0.02; head.add(c);
        const brim = mesh(GEO.cyl, oc, R * 0.75, 0.012, R * 0.6); brim.position.set(0, y + R * 0.52, -R * 0.98); brim.rotation.x = -0.12; head.add(brim);
        break;
      }
      case 'hat': {
        const brim = mesh(GEO.cyl, black, R * 1.7, 0.012, R * 1.7); brim.position.y = y + R * 0.7; head.add(brim);
        const top = mesh(GEO.cyl, black, R * 0.95, R * 0.9, R * 0.95); top.position.y = y + R * 1.12; head.add(top);
        const band = mesh(GEO.cyl, mat('#b0202a'), R * 0.97, 0.03, R * 0.97); band.position.y = y + R * 0.8; head.add(band);
        break;
      }
      case 'beanie': {
        const c = new THREE.Mesh(new THREE.SphereGeometry(R * 1.13, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), oc); c.position.y = y + 0.025; head.add(c);
        const fold = mesh(GEO.cyl, oc, R * 1.15, 0.04, R * 1.15); fold.position.y = y + 0.04; head.add(fold);
        const pom = mesh(GEO.sphereLo, mat('#f4f4f8'), 0.04); pom.position.y = y + R * 1.2; head.add(pom);
        break;
      }
      case 'headphones': {
        const band = mesh(GEO.torus, black, R * 1.12, R * 1.12, R * 0.6); band.position.y = y + 0.01; head.add(band);
        for (const s of [-1, 1]) { const cup = mesh(GEO.cyl, oc, 0.055, 0.04, 0.055); cup.rotation.z = Math.PI / 2; cup.position.set(s * R * 1.08, y, 0); head.add(cup); }
        break;
      }
      case 'bow': {
        for (const s of [-1, 1]) { const w = mesh(GEO.cone, mat('#ff4a8a'), 0.04, 0.08, 0.025); w.rotation.z = s * Math.PI / 2; w.position.set(s * 0.04 + 0.07, y + R * 0.95, -0.02); head.add(w); }
        break;
      }
      case 'earrings': {
        for (const s of [-1, 1]) { const e = mesh(GEO.sphereLo, gold, 0.014); e.position.set(s * R * 0.98, y - 0.05, -0.005); head.add(e); }
        break;
      }
      case 'crown': {
        const ring = mesh(GEO.cyl, gold, R * 0.75, 0.05, R * 0.75); ring.position.y = y + R * 1.0; head.add(ring);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const sp = mesh(GEO.cone, gold, 0.022, 0.06, 0.022); sp.position.set(Math.cos(a) * R * 0.72, y + R * 1.0 + 0.05, Math.sin(a) * R * 0.72); head.add(sp);
        }
        const gem = mesh(GEO.sphereLo, mat('#e0203a', { metalness: 0.3, roughness: 0.1 }), 0.018); gem.position.set(0, y + R * 1.0, -R * 0.76); head.add(gem);
        break;
      }
      default: break;
    }
  }

  // ---------- face ----------
  redrawFace(force = false) {
    const ex = Math.round(this.eye.x * 4) / 4, ey = Math.round(this.eye.y * 4) / 4;
    const key = this.expr + (this.blinking > 0) + ex + ',' + ey;
    if (!force && key === this._faceKey) return;
    this._faceKey = key;
    drawFace(this.faceCtx, this.expr, this.blinking > 0, ex, ey, EYE_COLORS[this.look.eyes % EYE_COLORS.length], this.lashes);
    this.faceTex.needsUpdate = true;
  }

  setExpression(expr, seconds = 2.2) {
    this.expr = expr;
    this.exprUntil = seconds > 0 ? this._t + seconds : Infinity;
  }
  setMood(m) { this.mood = m; if (this.exprUntil < this._t) this.expr = m; }

  /** Look at a world point (or null for idle gaze). */
  lookAt(v3) { this.lookTarget = v3 ? v3.clone() : null; }

  // ---------- hands / IK ----------
  restHands() { this.handMode = 'rest'; }
  holdCards(on) { this.handMode = on ? 'cards' : 'rest'; }

  /** Reach for a world point with the right hand; resolves when back. */
  async reach(worldPos, hold = 0.25) {
    this.reachTarget = worldPos.clone();
    this.reachBlend = 0;
    await tweens.run(0.35, (e) => { this.reachBlend = e; }, Ease.out);
    await tweens.wait(hold);
    await tweens.run(0.35, (e) => { this.reachBlend = 1 - e; }, Ease.inOut);
    this.reachTarget = null;
  }

  solveArm(i, targetBody) {
    const sh = this.shoulders[i], el = this.elbows[i];
    const S = sh.position;
    const L1 = 0.27, L2 = 0.27;
    const toT = targetBody.clone().sub(S);
    let d = toT.length();
    d = Math.min(Math.max(d, 0.12), L1 + L2 - 0.002);
    const dir = toT.normalize();
    const side = i === 0 ? -1 : 1;
    const pole = new THREE.Vector3(side * 0.9, -1, 0.5).normalize();
    const axis = new THREE.Vector3().crossVectors(dir, pole).normalize();
    const a1 = Math.acos(THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const upperDir = dir.clone().applyAxisAngle(axis, a1);
    const down = new THREE.Vector3(0, -1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(down, upperDir);
    sh.quaternion.copy(q);
    const E = S.clone().add(upperDir.clone().multiplyScalar(L1));
    const T = S.clone().add(dir.clone().multiplyScalar(d));
    const foreDir = T.sub(E).normalize().applyQuaternion(q.clone().invert());
    el.quaternion.setFromUnitVectors(down, foreDir);
  }

  handTargetsFor(t) {
    // Returns [left,right] desired hand points in body space
    const restL = new THREE.Vector3(-0.17, TABLE_Y - 0.56 + 0.03, -0.42);
    const restR = new THREE.Vector3(0.17, TABLE_Y - 0.56 + 0.03, -0.42);
    let L = restL, R = restR;
    if (this.handMode === 'cards') {
      L = new THREE.Vector3(-0.06, 0.38, -0.36); R = new THREE.Vector3(0.06, 0.38, -0.36);
    }
    const a = this.anim;
    if (a) {
      const k = a.t / a.dur;
      const env = Math.sin(Math.min(1, k) * Math.PI);
      const headPt = new THREE.Vector3(0.0, 0.62, -0.17);
      switch (a.type) {
        case 'wave': R = R.clone().lerp(new THREE.Vector3(0.32 + Math.sin(a.t * 14) * 0.08, 0.86, -0.12), Math.min(1, env * 1.6)); break;
        case 'celebrate': {
          const up = Math.min(1, env * 1.8);
          L = L.clone().lerp(new THREE.Vector3(-0.3, 1.0 + Math.sin(a.t * 12) * 0.05, -0.1), up);
          R = R.clone().lerp(new THREE.Vector3(0.3, 1.0 + Math.cos(a.t * 12) * 0.05, -0.1), up);
          break;
        }
        case 'thinking': R = R.clone().lerp(headPt.clone().add(new THREE.Vector3(0.03, -0.03, -0.04)), Math.min(1, env * 2)); break;
        case 'clap': {
          const c = Math.abs(Math.sin(a.t * 12)) * 0.08;
          const blend = Math.min(1, env * 2);
          L = L.clone().lerp(new THREE.Vector3(-0.02 - c, 0.42, -0.34), blend);
          R = R.clone().lerp(new THREE.Vector3(0.02 + c, 0.42, -0.34), blend);
          break;
        }
        case 'angry': {
          const p = Math.abs(Math.sin(a.t * 10)) * 0.08 * env;
          L = L.clone().add(new THREE.Vector3(0, p, 0)); R = R.clone().add(new THREE.Vector3(0, p, 0));
          break;
        }
        case 'surprised': {
          const blend = Math.min(1, env * 2);
          L = L.clone().lerp(new THREE.Vector3(-0.28, 0.5, -0.25), blend);
          R = R.clone().lerp(new THREE.Vector3(0.28, 0.5, -0.25), blend);
          break;
        }
        case 'facepalm': R = R.clone().lerp(headPt.clone().add(new THREE.Vector3(0, 0.07, -0.06)), Math.min(1, env * 2)); break;
        case 'point': R = R.clone().lerp(new THREE.Vector3(0.12, 0.42, -0.62), Math.min(1, env * 2)); break;
        case 'thumbs': R = R.clone().lerp(new THREE.Vector3(0.2, 0.55, -0.4), Math.min(1, env * 2)); break;
        default: break;
      }
    }
    if (this.reachTarget && this.reachBlend > 0) {
      const local = this.body.worldToLocal(this.reachTarget.clone());
      R = R.clone().lerp(local, this.reachBlend);
    }
    return [L, R];
  }

  // ---------- emotes ----------
  /** type: nod|shake|happy|laugh|sad|surprised|thinking|wave|celebrate|angry|clap|facepalm|point|thumbs|love|cool */
  emote(type, dur) {
    const D = { nod: 0.9, shake: 1.0, happy: 1.4, laugh: 1.8, sad: 2.2, surprised: 1.4, thinking: 2.6, wave: 1.8, celebrate: 2.4, angry: 1.6, clap: 1.8, facepalm: 2, point: 1.2, thumbs: 1.6, love: 2, cool: 1.6 };
    const exprFor = { nod: 'happy', shake: 'neutral', happy: 'happy', laugh: 'laugh', sad: 'sad', surprised: 'surprised', thinking: 'thinking', wave: 'happy', celebrate: 'laugh', angry: 'angry', clap: 'happy', facepalm: 'sad', point: 'smug', thumbs: 'wink', love: 'love', cool: 'cool' };
    this.anim = { type, t: 0, dur: dur || D[type] || 1.5 };
    this.setExpression(exprFor[type] || 'happy', this.anim.dur + 0.4);
  }
  isBusy() { return !!this.anim; }

  // ---------- per-frame ----------
  update(dt, t) {
    this._t = t;
    const ph = this.phase;
    // expression timeout
    if (this.exprUntil !== Infinity && t > this.exprUntil) { this.expr = this.mood; this.exprUntil = Infinity; }
    // blinking
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blinking = 0.12; this.blinkT = 2 + Math.random() * 4; }
    if (this.blinking > 0) this.blinking -= dt;

    // breathing / idle sway
    const breath = Math.sin(t * 1.6 + ph);
    this.torso.scale.z = 0.78 * (1 + breath * 0.02);
    let bodyY = 0.56 + breath * 0.004, bodyRx = 0, bodyRz = Math.sin(t * 0.5 + ph) * 0.015;
    let headYaw = 0, headPitch = 0, headRoll = Math.sin(t * 0.7 + ph) * 0.03;

    // look target -> desired yaw/pitch in root space
    let wantYaw = Math.sin(t * 0.3 + ph) * 0.15, wantPitch = 0.12;
    if (this.lookTarget) {
      const local = this.root.worldToLocal(this.lookTarget.clone());
      const headPos = new THREE.Vector3(0, 1.3, 0);
      const d = local.sub(headPos);
      wantYaw = Math.atan2(-d.x, -d.z);
      wantPitch = Math.atan2(-d.y, Math.hypot(d.x, d.z));
      wantYaw = THREE.MathUtils.clamp(wantYaw, -1.1, 1.1);
      wantPitch = THREE.MathUtils.clamp(wantPitch, -0.5, 0.75);
    }
    const k = 1 - Math.exp(-dt * 5);
    this.lookCur.x += (wantYaw - this.lookCur.x) * k;
    this.lookCur.y += (wantPitch - this.lookCur.y) * k;
    headYaw = this.lookCur.x * 0.75; headPitch = this.lookCur.y * 0.8;
    // eyes follow the residual gaze
    this.eye.set(THREE.MathUtils.clamp(-(wantYaw - headYaw) * 2.5, -1, 1), THREE.MathUtils.clamp((wantPitch - headPitch) * 3, -1, 1));

    const a = this.anim;
    if (a) {
      a.t += dt;
      const p = Math.min(1, a.t / a.dur);
      const env = Math.sin(p * Math.PI);
      switch (a.type) {
        case 'nod': headPitch += Math.sin(a.t * 14) * 0.18 * env; break;
        case 'shake': headYaw += Math.sin(a.t * 16) * 0.3 * env; break;
        case 'happy': bodyY += Math.abs(Math.sin(a.t * 9)) * 0.025 * env; headRoll += Math.sin(a.t * 6) * 0.08 * env; break;
        case 'laugh': bodyY += Math.abs(Math.sin(a.t * 16)) * 0.018 * env; headPitch -= 0.25 * env; bodyRx -= 0.06 * env; break;
        case 'celebrate': bodyY += Math.abs(Math.sin(a.t * 10)) * 0.04 * env; headPitch -= 0.2 * env; break;
        case 'sad': headPitch += 0.38 * env; bodyRx += 0.12 * env; bodyY -= 0.02 * env; break;
        case 'surprised': headPitch -= 0.22 * env; bodyY += 0.03 * env; bodyRx -= 0.08 * env; break;
        case 'thinking': headRoll += 0.18 * env; headPitch -= 0.12 * env; headYaw += 0.2 * env; break;
        case 'angry': bodyRx += 0.08 * env; headPitch += 0.1 * env; break;
        case 'facepalm': headPitch += 0.3 * env; break;
        case 'love': headRoll += Math.sin(a.t * 5) * 0.15 * env; break;
        case 'cool': headPitch -= 0.1 * env; headRoll += 0.12 * env; break;
        default: break;
      }
      if (a.t >= a.dur) this.anim = null;
    }
    if (this.speaking > 0) { this.speaking -= dt; headPitch += Math.sin(t * 18) * 0.02; }
    this.body.position.y = bodyY;
    this.body.rotation.x = bodyRx;
    this.body.rotation.z = bodyRz;
    this.head.rotation.set(headPitch, headYaw, headRoll, 'YXZ');

    // arms
    const [L, R] = this.handTargetsFor(t);
    const kk = 1 - Math.exp(-dt * 10);
    if (!this._handInit) { this.handCur[0].copy(L); this.handCur[1].copy(R); this._handInit = true; }
    this.handCur[0].lerp(L, kk); this.handCur[1].lerp(R, kk);
    // small idle finger-tap motion
    const tap = Math.max(0, Math.sin(t * 3 + ph)) * 0.008;
    this.solveArm(0, this.handCur[0].clone().add(new THREE.Vector3(0, tap, 0)));
    this.solveArm(1, this.handCur[1]);
    this.redrawFace();
  }

  /** World position above the head (for speech bubbles). */
  bubbleAnchor() { return this.head.localToWorld(new THREE.Vector3(0, 0.42, 0)); }
  headWorld() { return this.head.localToWorld(new THREE.Vector3(0, 0.14, 0)); }

  dispose() {
    this.faceTex.dispose();
    this.faceMesh.material.dispose();
    this.root.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
  }
}

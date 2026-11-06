// 3D dice with pips; rolls tumble through the air and land showing a predetermined value
// (the value comes from the deterministic game state, so online clients agree).
import * as THREE from 'three';
import { canvasTexture } from './textures.js';
import { tweens, Ease } from './engine.js';
import { TABLE_Y } from './room.js';
import { sfx } from '../core/audio.js';

const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
function faceTex(n, body, pip) {
  return canvasTexture(128, 128, (g, w) => {
    g.fillStyle = body; g.fillRect(0, 0, w, w);
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, w - 6);
    g.fillStyle = pip;
    for (const [x, y] of PIPS[n]) { g.beginPath(); g.arc(w / 2 + x * 32, w / 2 + y * 32, n === 1 ? 16 : 11, 0, 7); g.fill(); }
  }, { key: 'die' + n + body + pip });
}
// BoxGeometry material order: +x, -x, +y, -y, +z, -z. Opposite faces sum to 7.
const FACE_ORDER = [3, 4, 1, 6, 2, 5];
// rotation (euler) that brings value n to the top (+y)
const UP_ROT = { 1: [0, 0, 0], 6: [Math.PI, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2], 2: [-Math.PI / 2, 0, 0], 5: [Math.PI / 2, 0, 0] };

export function makeDie(size = 0.13, body = '#f8f4ec', pip = '#1a1430') {
  const mats = FACE_ORDER.map((n) => new THREE.MeshStandardMaterial({ map: faceTex(n, body, pip), roughness: 0.35 }));
  const geo = new THREE.BoxGeometry(size, size, size, 2, 2, 2);
  // round the corners slightly
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const l = v.length(); v.multiplyScalar(1 - 0.06 * (l / (size * 0.866))); p.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mats);
  m.castShadow = true;
  m.userData.size = size;
  m.rotation.order = 'YXZ'; // yaw last, so the UP_ROT face stays on top
  return m;
}

/** Animate dice from `from` to rest positions (same parent space, y = resting center) showing values. */
export async function rollDice(dice, values, from, restPositions) {
  sfx('dice');
  const starts = dice.map(() => from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.25, (Math.random() - 0.5) * 0.2)));
  const spins = dice.map(() => new THREE.Vector3(6 + Math.random() * 6, 4 + Math.random() * 6, 5 + Math.random() * 6));
  await tweens.run(0.95, (e, raw) => {
    dice.forEach((d, i) => {
      const end = restPositions[i];
      const s = d.userData.size;
      const p = starts[i].clone().lerp(end, e);
      // bounces
      const bounce = Math.abs(Math.sin(raw * Math.PI * 2.5)) * (1 - raw) * 0.35;
      p.y = end.y + bounce + (1 - e) * 0.2; // rest positions are in the dice parent's space
      d.position.copy(p);
      const r = UP_ROT[values[i]];
      const k = 1 - e;
      d.rotation.set(r[0] + spins[i].x * k, r[1] + spins[i].y * k + i, r[2] + spins[i].z * k);
    });
  }, Ease.out);
  sfx('diceLand');
}

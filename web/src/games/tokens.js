// Procedural 3D game tokens (12 original low-poly models), shared by board games.
import * as THREE from 'three';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.55, ...o });
function add(g, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz);
  m.castShadow = true;
  g.add(m);
  return m;
}
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const S = (r, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs);
const C = (rt, rb, h, s = 14) => new THREE.CylinderGeometry(rt, rb, h, s);
const K = (r, h, s = 12) => new THREE.ConeGeometry(r, h, s);

/** Build token `id` in `color`. Height ≈ 1 unit; caller scales. Faces +Z by default. */
export function makeToken(id, color) {
  const g = new THREE.Group();
  const m = std(color);
  const dark = std('#1a1a22', { metalness: 0.2, roughness: 0.6 });
  const light = std('#f4f4ff', { metalness: 0.1, roughness: 0.4 });
  // base disc
  add(g, C(0.42, 0.46, 0.08, 24), m, 0, 0.04);
  switch (id) {
    case 'car':
      add(g, B(0.5, 0.2, 0.86), m, 0, 0.26); add(g, B(0.44, 0.2, 0.44), m, 0, 0.45, -0.05);
      add(g, B(0.4, 0.14, 0.02), std('#9ad8ff', { metalness: 0.1 }), 0, 0.46, 0.18);
      for (const [x, z] of [[0.27, 0.27], [-0.27, 0.27], [0.27, -0.28], [-0.27, -0.28]]) add(g, C(0.12, 0.12, 0.08, 14), dark, x, 0.2, z, 0, 0, Math.PI / 2);
      break;
    case 'ship':
      add(g, B(0.42, 0.18, 0.86), m, 0, 0.2); add(g, K(0.21, 0.3, 4), m, 0, 0.2, 0.55, Math.PI / 2, Math.PI / 4);
      add(g, C(0.03, 0.03, 0.8), dark, 0, 0.65); add(g, B(0.02, 0.5, 0.42), light, 0, 0.72, 0.02);
      add(g, B(0.02, 0.3, 0.3), light, 0, 0.55, -0.32);
      break;
    case 'cat':
      add(g, S(0.26), m, 0, 0.32, 0, 0, 0, 0, 1, 0.9, 1.3); add(g, S(0.2), m, 0, 0.62, 0.22);
      add(g, K(0.07, 0.16, 4), m, 0.11, 0.81, 0.22); add(g, K(0.07, 0.16, 4), m, -0.11, 0.81, 0.22);
      add(g, C(0.04, 0.03, 0.5), m, 0, 0.5, -0.36, -0.7);
      add(g, S(0.03), dark, 0.07, 0.66, 0.4); add(g, S(0.03), dark, -0.07, 0.66, 0.4);
      break;
    case 'dog':
      add(g, S(0.26), m, 0, 0.32, 0, 0, 0, 0, 1, 0.9, 1.35); add(g, S(0.2), m, 0, 0.6, 0.24);
      add(g, B(0.12, 0.1, 0.18), m, 0, 0.55, 0.42); add(g, S(0.04), dark, 0, 0.58, 0.52);
      add(g, B(0.06, 0.2, 0.12), m, 0.18, 0.6, 0.22, 0, 0, 0.3); add(g, B(0.06, 0.2, 0.12), m, -0.18, 0.6, 0.22, 0, 0, -0.3);
      add(g, C(0.04, 0.03, 0.26), m, 0, 0.45, -0.38, -0.9);
      break;
    case 'crown':
      add(g, C(0.3, 0.3, 0.3, 20, 1, true), m, 0, 0.3);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; add(g, K(0.07, 0.24, 6), m, Math.cos(a) * 0.29, 0.56, Math.sin(a) * 0.29); add(g, S(0.035), std('#ff3a5a'), Math.cos(a) * 0.29, 0.69, Math.sin(a) * 0.29); }
      add(g, C(0.31, 0.31, 0.05, 20), m, 0, 0.16);
      break;
    case 'meeple':
      add(g, C(0.16, 0.28, 0.45, 16), m, 0, 0.3); add(g, S(0.16), m, 0, 0.68);
      add(g, C(0.06, 0.06, 0.62, 10), m, 0, 0.42, 0, 0, 0, Math.PI / 2);
      break;
    case 'plane':
      add(g, C(0.1, 0.1, 0.9, 12), m, 0, 0.42, 0, Math.PI / 2); add(g, K(0.1, 0.18, 12), m, 0, 0.42, 0.54, Math.PI / 2);
      add(g, B(0.95, 0.03, 0.22), m, 0, 0.42, 0.05); add(g, B(0.36, 0.03, 0.12), m, 0, 0.46, -0.38);
      add(g, B(0.03, 0.2, 0.14), m, 0, 0.56, -0.38); add(g, C(0.03, 0.03, 0.26), dark, 0, 0.22);
      break;
    case 'robot':
      add(g, B(0.4, 0.38, 0.3), m, 0, 0.36); add(g, B(0.3, 0.24, 0.26), m, 0, 0.7);
      add(g, S(0.04), std('#5af0ff', { emissive: '#5af0ff', emissiveIntensity: 1 }), 0.07, 0.72, 0.14); add(g, S(0.04), std('#5af0ff', { emissive: '#5af0ff', emissiveIntensity: 1 }), -0.07, 0.72, 0.14);
      add(g, C(0.015, 0.015, 0.16), dark, 0, 0.9); add(g, S(0.04), std('#ff3a5a'), 0, 0.99);
      add(g, B(0.08, 0.3, 0.08), m, 0.26, 0.36); add(g, B(0.08, 0.3, 0.08), m, -0.26, 0.36);
      break;
    case 'rocket':
      add(g, C(0.15, 0.17, 0.62, 16), m, 0, 0.45); add(g, K(0.15, 0.3, 16), light, 0, 0.91);
      add(g, S(0.06), std('#9ad8ff'), 0, 0.55, 0.14);
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; add(g, B(0.02, 0.22, 0.16), std('#ff4a5a'), Math.sin(a) * 0.17, 0.24, Math.cos(a) * 0.17, 0, a); }
      break;
    case 'elephant':
      add(g, S(0.3), m, 0, 0.42, -0.04, 0, 0, 0, 1, 0.85, 1.15); add(g, S(0.2), m, 0, 0.58, 0.3);
      add(g, C(0.05, 0.035, 0.36), m, 0, 0.4, 0.46, 0.35); add(g, C(0.16, 0.16, 0.02, 16), m, 0.2, 0.6, 0.25, 0, 0, Math.PI / 2);
      add(g, C(0.16, 0.16, 0.02, 16), m, -0.2, 0.6, 0.25, 0, 0, Math.PI / 2);
      for (const [x, z] of [[0.15, 0.15], [-0.15, 0.15], [0.15, -0.2], [-0.15, -0.2]]) add(g, C(0.07, 0.07, 0.22), m, x, 0.18, z);
      break;
    case 'crystal':
      add(g, new THREE.OctahedronGeometry(0.3), new THREE.MeshPhysicalMaterial({ color, metalness: 0.1, roughness: 0.05, transmission: 0.6, thickness: 0.4, transparent: true, opacity: 0.9 }), 0, 0.5, 0, 0, 0, 0, 0.8, 1.35, 0.8);
      add(g, new THREE.OctahedronGeometry(0.1), light, 0, 0.5);
      break;
    case 'dragon':
      add(g, S(0.24), m, 0, 0.36, 0, 0, 0, 0, 0.9, 0.9, 1.3); add(g, S(0.16), m, 0, 0.66, 0.24, 0, 0, 0, 1, 0.9, 1.3);
      add(g, K(0.05, 0.18, 6), std('#f4e0a0'), 0.08, 0.82, 0.18, -0.4); add(g, K(0.05, 0.18, 6), std('#f4e0a0'), -0.08, 0.82, 0.18, -0.4);
      add(g, B(0.5, 0.02, 0.3), m, 0.3, 0.55, -0.05, 0, 0, 0.5); add(g, B(0.5, 0.02, 0.3), m, -0.3, 0.55, -0.05, 0, 0, -0.5);
      add(g, K(0.07, 0.4, 8), m, 0, 0.3, -0.42, -Math.PI / 2 - 0.4);
      add(g, S(0.03), std('#ffde3a', { emissive: '#ffae00', emissiveIntensity: 0.8 }), 0.06, 0.7, 0.38); add(g, S(0.03), std('#ffde3a', { emissive: '#ffae00', emissiveIntensity: 0.8 }), -0.06, 0.7, 0.38);
      break;
    default:
      add(g, C(0.2, 0.3, 0.6, 16), m, 0, 0.38); add(g, S(0.18), m, 0, 0.78);
  }
  return g;
}
export const TOKEN_IDS = ['car', 'ship', 'cat', 'dog', 'crown', 'meeple', 'plane', 'robot', 'rocket', 'elephant', 'crystal', 'dragon'];

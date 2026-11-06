// Renders a head-and-shoulders portrait of a 3D character (used for player cards in the UI).
import * as THREE from 'three';

let rt = null;
const SIZE = 192;
const cache = new WeakMap();

export function renderPortrait(engine, character) {
  if (cache.has(character)) return cache.get(character);
  const r = engine.renderer;
  if (!rt) { rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace; }
  character.root.updateMatrixWorld(true);
  const head = character.headWorld();
  const q = character.root.getWorldQuaternion(new THREE.Quaternion());
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 30);
  cam.position.copy(head).addScaledVector(fwd, 0.95).add(new THREE.Vector3(0, 0.02, 0));
  cam.lookAt(head.x, head.y - 0.06, head.z);
  const vis = character.root.visible;
  character.root.visible = true;
  const prevT = r.getRenderTarget();
  r.setRenderTarget(rt);
  r.render(engine.scene, cam);
  const px = new Uint8Array(SIZE * SIZE * 4);
  r.readRenderTargetPixels(rt, 0, 0, SIZE, SIZE, px);
  r.setRenderTarget(prevT);
  character.root.visible = vis;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d');
  const img = g.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) img.data.set(px.subarray((SIZE - 1 - y) * SIZE * 4, (SIZE - y) * SIZE * 4), y * SIZE * 4);
  g.putImageData(img, 0, 0);
  const url = c.toDataURL('image/jpeg', 0.88);
  cache.set(character, url);
  return url;
}

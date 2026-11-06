// Color Blitz card artwork (4 original deck designs), drawn procedurally.
import * as THREE from 'three';
import { canvasTexture, roundRect } from '../../scene/textures.js';

export const CARD_W = 0.105, CARD_H = 0.155, CARD_T = 0.0016;
export const DESIGNS = {
  classic: { r: '#e3342f', y: '#f6c90e', g: '#2fb36a', b: '#2f7bd8', w: '#1a1a24', bg: '#ffffff', ink: '#ffffff', back: ['#2a1a6a', '#e3342f'], style: 'oval' },
  neon: { r: '#ff2a6a', y: '#ffe23a', g: '#3affa0', b: '#3ab0ff', w: '#c86aff', bg: '#0a0a18', ink: '#ffffff', back: ['#0a0a18', '#c86aff'], style: 'neon' },
  pastel: { r: '#ff8aa0', y: '#ffd88a', g: '#8ae0b0', b: '#8ab8ff', w: '#b8a0e0', bg: '#fffaf4', ink: '#ffffff', back: ['#f4e8ff', '#b8a0e0'], style: 'soft' },
  royal: { r: '#b0203a', y: '#d9a72a', g: '#1f7a4a', b: '#1f3f9a', w: '#14142a', bg: '#14142a', ink: '#f7d98a', back: ['#14142a', '#d9a72a'], style: 'royal' },
};
const SYMBOL = { skip: '⊘', rev: '⇄', d2: '+2', wild: '✦', d4: '+4' };

export function faceTexture(design, card) {
  const D = DESIGNS[design] || DESIGNS.classic;
  const key = `cb-${design}-${card.c}-${card.v}`;
  return canvasTexture(160, 240, (g, w, h) => {
    const col = D[card.c];
    g.fillStyle = D.bg; roundRect(g, 0, 0, w, h, 16); g.fill();
    if (D.style === 'neon') {
      g.strokeStyle = col; g.lineWidth = 8; g.shadowColor = col; g.shadowBlur = 16; roundRect(g, 10, 10, w - 20, h - 20, 12); g.stroke(); g.shadowBlur = 0;
    } else {
      g.fillStyle = col; roundRect(g, 8, 8, w - 16, h - 16, 12); g.fill();
      if (D.style === 'royal') { g.strokeStyle = '#f7d98a'; g.lineWidth = 4; roundRect(g, 14, 14, w - 28, h - 28, 10); g.stroke(); }
    }
    const label = SYMBOL[card.v] || card.v;
    // central oval
    g.save(); g.translate(w / 2, h / 2); g.rotate(-0.5);
    if (D.style === 'oval' || D.style === 'soft') { g.fillStyle = D.style === 'soft' ? 'rgba(255,255,255,0.75)' : '#ffffff'; g.beginPath(); g.ellipse(0, 0, 52, 86, 0, 0, 7); g.fill(); }
    if (D.style === 'royal') { g.strokeStyle = '#f7d98a'; g.lineWidth = 3; g.beginPath(); g.ellipse(0, 0, 52, 86, 0, 0, 7); g.stroke(); }
    g.restore();
    if (card.c === 'w') {
      // four-color wheel
      const cs = [D.r, D.y, D.g, D.b];
      for (let k = 0; k < 4; k++) { g.fillStyle = cs[k]; g.beginPath(); g.moveTo(w / 2, h / 2); g.arc(w / 2, h / 2, 42, k * Math.PI / 2 - Math.PI / 4, (k + 1) * Math.PI / 2 - Math.PI / 4); g.fill(); }
    }
    const big = label.length > 1 ? 54 : 74;
    g.font = `900 ${big}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const centerInk = D.style === 'oval' ? col : D.style === 'soft' ? col : D.style === 'neon' ? col : '#f7d98a';
    if (card.c === 'w') { g.fillStyle = '#ffffff'; g.strokeStyle = '#000'; g.lineWidth = 6; g.strokeText(label, w / 2, h / 2 + 4); g.fillText(label, w / 2, h / 2 + 4); }
    else {
      g.fillStyle = centerInk; if (D.style === 'neon') { g.shadowColor = col; g.shadowBlur = 18; }
      g.strokeStyle = D.style === 'oval' ? '#00000033' : 'transparent'; g.lineWidth = 4;
      g.fillText(label, w / 2, h / 2 + 4); g.shadowBlur = 0;
      if (card.v === '6' || card.v === '9') { g.fillRect(w / 2 - 16, h / 2 + 40, 32, 5); }
    }
    g.font = '900 28px sans-serif'; g.fillStyle = D.style === 'neon' ? col : D.ink;
    g.fillText(label, 26, 30);
    g.save(); g.translate(w - 26, h - 30); g.rotate(Math.PI); g.fillText(label, 0, 0); g.restore();
  }, { key });
}

export function backTexture(design) {
  const D = DESIGNS[design] || DESIGNS.classic;
  return canvasTexture(160, 240, (g, w, h) => {
    g.fillStyle = '#ffffff'; roundRect(g, 0, 0, w, h, 16); g.fill();
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, D.back[0]); grad.addColorStop(1, D.back[1]);
    g.fillStyle = grad; roundRect(g, 8, 8, w - 16, h - 16, 12); g.fill();
    g.save(); g.translate(w / 2, h / 2); g.rotate(-0.5);
    g.fillStyle = D.back[1]; g.beginPath(); g.ellipse(0, 0, 50, 84, 0, 0, 7); g.fill();
    g.restore();
    g.font = '900 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffffff'; g.save(); g.translate(w / 2, h / 2); g.rotate(-0.5); g.fillText('BLITZ', 0, 0); g.restore();
  }, { key: 'cb-back-' + design });
}

const geo = new THREE.BoxGeometry(CARD_W, CARD_T, CARD_H);
geo.userData.shared = true;
const edgeMat = new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 0.6 });
edgeMat.userData.shared = true;
const matCache = new Map();
function cachedMat(tex) {
  if (!matCache.has(tex)) { const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 }); m.userData.shared = true; matCache.set(tex, m); }
  return matCache.get(tex);
}
/** A 3D card: face on +Y, back on -Y. card=null makes an anonymous back-only card. */
export function makeCard(design, card) {
  const back = cachedMat(backTexture(design));
  const face = card ? cachedMat(faceTexture(design, card)) : back;
  const m = new THREE.Mesh(geo, [edgeMat, edgeMat, face, back, edgeMat, edgeMat]);
  m.castShadow = true;
  m.userData.card = card;
  return m;
}
export function setCardFace(mesh, design, card) {
  mesh.material = [edgeMat, edgeMat, cachedMat(faceTexture(design, card)), cachedMat(backTexture(design)), edgeMat, edgeMat];
  mesh.userData.card = card;
}

// TYCOON board geometry + procedural board artwork.
import * as THREE from 'three';
import { TILES, boardTheme, tileName, RAILS, UTILS } from './boards.js';
import { canvasTexture } from '../../scene/textures.js';

export const BOARD = 1.84;
const HALF = BOARD / 2;
export const U = BOARD / 12.2;   // regular tile width
export const CORNER = U * 1.6;   // corner size / tile depth

/** Side of tile i: 0 bottom, 1 left, 2 top, 3 right. */
export const sideOf = (i) => Math.floor(i / 10) % 4;

/** Center of tile i in board-local (x, z). */
export function tileCenter(i) {
  const k = i % 10;
  const along = k === 0 ? CORNER / 2 : CORNER + (k - 0.5) * U; // distance from the side's starting corner edge
  const inset = HALF - CORNER / 2;
  switch (sideOf(i)) {
    case 0: return k === 0 ? new THREE.Vector2(inset, inset) : new THREE.Vector2(HALF - along, inset);
    case 1: return k === 0 ? new THREE.Vector2(-inset, inset) : new THREE.Vector2(-inset, HALF - along);
    case 2: return k === 0 ? new THREE.Vector2(-inset, -inset) : new THREE.Vector2(-HALF + along, -inset);
    default: return k === 0 ? new THREE.Vector2(inset, -inset) : new THREE.Vector2(inset, -HALF + along);
  }
}
/** Unit vector pointing from tile toward the board center (inward normal of its side). */
export function inward(i) {
  return [new THREE.Vector2(0, -1), new THREE.Vector2(1, 0), new THREE.Vector2(0, 1), new THREE.Vector2(-1, 0)][sideOf(i)];
}
/** Unit vector along the side (direction of travel). */
export function along(i) {
  return [new THREE.Vector2(-1, 0), new THREE.Vector2(0, -1), new THREE.Vector2(1, 0), new THREE.Vector2(0, 1)][sideOf(i)];
}
export function tileAt(x, z) {
  if (Math.abs(x) > HALF || Math.abs(z) > HALF) return -1;
  const inner = HALF - CORNER;
  if (Math.abs(x) < inner && Math.abs(z) < inner) return -1;
  let best = -1, bd = Infinity;
  for (let i = 0; i < 40; i++) { const c = tileCenter(i); const d = (c.x - x) ** 2 + (c.y - z) ** 2; if (d < bd) { bd = d; best = i; } }
  return best;
}

// ---------- artwork ----------
function wrap(g, text, maxW, maxLines = 3) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function icon(g, kind, x, y, s, color) {
  g.save(); g.translate(x, y); g.strokeStyle = color; g.fillStyle = color; g.lineWidth = s * 0.08;
  switch (kind) {
    case 'event': g.font = `900 ${s}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, s * 0.05); g.beginPath(); g.arc(0, 0, s * 0.55, 0, 7); g.stroke(); break;
    case 'fund': g.strokeRect(-s * 0.45, -s * 0.2, s * 0.9, s * 0.55); g.beginPath(); g.moveTo(-s * 0.45, -s * 0.2); g.quadraticCurveTo(0, -s * 0.6, s * 0.45, -s * 0.2); g.stroke(); g.fillRect(-s * 0.08, -s * 0.1, s * 0.16, s * 0.2); break;
    case 'rail': g.fillRect(-s * 0.4, -s * 0.3, s * 0.8, s * 0.45); g.fillRect(-s * 0.25, -s * 0.5, s * 0.25, s * 0.2); g.beginPath(); g.arc(-s * 0.22, s * 0.25, s * 0.12, 0, 7); g.arc(s * 0.22, s * 0.25, s * 0.12, 0, 7); g.fill(); break;
    case 'util0': g.beginPath(); g.moveTo(s * 0.1, -s * 0.5); g.lineTo(-s * 0.3, s * 0.05); g.lineTo(0, s * 0.05); g.lineTo(-s * 0.1, s * 0.5); g.lineTo(s * 0.3, -s * 0.05); g.lineTo(0, -s * 0.05); g.closePath(); g.fill(); break;
    case 'util1': g.beginPath(); g.moveTo(0, -s * 0.5); g.quadraticCurveTo(s * 0.45, s * 0.1, 0, s * 0.45); g.quadraticCurveTo(-s * 0.45, s * 0.1, 0, -s * 0.5); g.fill(); break;
    case 'tax': g.font = `900 ${s * 0.9}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('%', 0, 0); break;
    default: break;
  }
  g.restore();
}

function motif(g, th, cx, cy, R) {
  g.save(); g.translate(cx, cy);
  const a = th.accent;
  g.globalAlpha = 0.22; g.fillStyle = a; g.strokeStyle = a; g.lineWidth = 10;
  switch (th.motif) {
    case 'skyline': case 'city':
      for (let i = -6; i <= 6; i++) { const h = 80 + ((i * 37) % 7 + 7) % 7 * 40; g.fillRect(i * 60 - 25, 120 - h, 50, h); }
      break;
    case 'palm':
      g.beginPath(); g.arc(0, 260, 300, Math.PI, 0); g.fill();
      g.lineWidth = 22; g.beginPath(); g.moveTo(0, 100); g.quadraticCurveTo(30, -60, 10, -160); g.stroke();
      for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(10 + Math.cos(k) * 70, -160 + Math.sin(k * 2) * 20, 90, 22, k * 1.05, 0, 7); g.fill(); }
      break;
    case 'planet':
      g.beginPath(); g.arc(0, 0, 150, 0, 7); g.fill();
      g.beginPath(); g.ellipse(0, 0, 280, 60, -0.3, 0, 7); g.stroke();
      for (let k = 0; k < 40; k++) g.fillRect(Math.cos(k * 7) * R * 0.8, Math.sin(k * 13) * R * 0.8, 6, 6);
      break;
    case 'castle':
      g.fillRect(-220, -40, 440, 200);
      for (let k = -2; k <= 2; k++) { g.fillRect(k * 100 - 30, -120, 60, 80); g.beginPath(); g.moveTo(k * 100 - 40, -120); g.lineTo(k * 100, -190); g.lineTo(k * 100 + 40, -120); g.fill(); }
      break;
    case 'dome':
      g.beginPath(); g.arc(0, 100, 260, Math.PI, 0); g.stroke();
      g.beginPath(); g.arc(0, 100, 180, Math.PI, 0); g.stroke();
      for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(k * 60, 100); g.lineTo(k * 30, -140); g.stroke(); }
      break;
    default: break;
  }
  g.restore();
}

export function drawBoardTexture(board, lang) {
  const th = boardTheme(board);
  return canvasTexture(2048, 2048, (g, W) => {
    const s = W / BOARD;
    const px = (v) => (v + HALF) * s;
    g.fillStyle = th.bg; g.fillRect(0, 0, W, W);
    // center
    const inner = (HALF - CORNER) * s;
    g.fillStyle = th.center; g.fillRect(W / 2 - inner, W / 2 - inner, inner * 2, inner * 2);
    motif(g, th, W / 2, W / 2, inner);
    g.save(); g.translate(W / 2, W / 2); g.rotate(-Math.PI / 4);
    g.font = '900 200px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = th.dark ? '#ffffff' : '#ffffff'; g.strokeStyle = th.accent; g.lineWidth = 18;
    g.strokeText('TYCOON', 0, 0); g.fillText('TYCOON', 0, 0);
    g.font = '700 54px sans-serif'; g.fillStyle = th.ink; g.globalAlpha = 0.7;
    g.fillText('BOARDVERSE', 0, 140);
    g.restore();
    // deck spots
    for (const [dx, dy, label] of [[-0.36, -0.36, lang === 'ru' ? 'СОБЫТИЕ' : 'EVENT'], [0.36, 0.36, lang === 'ru' ? 'ФОНД' : 'FUND']]) {
      g.save(); g.translate(px(dx), px(dy)); g.rotate(-Math.PI / 4);
      g.setLineDash([18, 12]); g.strokeStyle = th.ink; g.globalAlpha = 0.5; g.lineWidth = 6;
      g.strokeRect(-110, -160, 220, 320); g.setLineDash([]);
      g.font = '800 34px sans-serif'; g.textAlign = 'center'; g.fillStyle = th.ink; g.fillText(label, 0, 210);
      g.restore();
    }
    // tiles
    for (let i = 0; i < 40; i++) {
      const c = tileCenter(i);
      const k = i % 10;
      const w = (k === 0 ? CORNER : U) * s, h = CORNER * s;
      g.save();
      g.translate(px(c.x), px(c.y));
      g.rotate([0, Math.PI / 2, Math.PI, -Math.PI / 2][sideOf(i)]);
      const tile = TILES[i];
      g.fillStyle = th.bg; g.fillRect(-w / 2, -h / 2, w, h);
      g.strokeStyle = th.ink; g.globalAlpha = 0.85; g.lineWidth = 3; g.strokeRect(-w / 2, -h / 2, w, h); g.globalAlpha = 1;
      g.fillStyle = th.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
      const name = tileName(board, i, lang);
      if (tile.type === 'street') {
        g.fillStyle = th.colors[tile.g]; g.fillRect(-w / 2, -h / 2, w, h * 0.22);
        g.strokeStyle = th.ink; g.strokeRect(-w / 2, -h / 2, w, h * 0.22);
      }
      if (k === 0) {
        g.rotate(-Math.PI / 4 * 0);
        g.font = '900 40px sans-serif'; g.fillStyle = th.ink;
        const lines = wrap(g, name, w * 0.9);
        lines.forEach((l, j) => g.fillText(l, 0, (j - (lines.length - 1) / 2) * 44));
        if (tile.type === 'go') { g.fillStyle = th.accent; g.font = '900 70px sans-serif'; g.fillText('➜', 0, h * 0.3); g.font = '700 26px sans-serif'; g.fillStyle = th.ink; g.fillText('+200', 0, -h * 0.3); }
        if (tile.type === 'jail') { g.strokeStyle = th.ink; g.lineWidth = 6; for (let b = -2; b <= 2; b++) { g.beginPath(); g.moveTo(b * 20, -h * 0.42); g.lineTo(b * 20, -h * 0.22); g.stroke(); } }
        if (tile.type === 'gotojail') { g.fillStyle = '#c0392b'; g.font = '900 60px sans-serif'; g.fillText('⛔', 0, h * 0.3); }
        if (tile.type === 'parking') { g.fillStyle = th.accent; g.beginPath(); g.arc(0, h * 0.3, 34, 0, 7); g.fill(); g.fillStyle = th.bg; g.font = '900 40px sans-serif'; g.fillText('☕', 0, h * 0.3); }
      } else {
        g.font = '700 23px sans-serif'; g.fillStyle = th.ink;
        const top = tile.type === 'street' ? -h / 2 + h * 0.3 : -h / 2 + h * 0.16;
        const lines = wrap(g, name, w * 0.88);
        lines.forEach((l, j) => g.fillText(l, 0, top + j * 26));
        if (tile.type === 'event' || tile.type === 'fund' || tile.type === 'rail' || tile.type === 'util' || tile.type === 'tax') {
          const kind = tile.type === 'util' ? 'util' + UTILS.indexOf(i) : tile.type;
          icon(g, kind, 0, h * 0.08, w * 0.55, tile.type === 'event' ? '#e0602a' : tile.type === 'fund' ? '#2a8ad8' : th.ink);
        }
        if (tile.price) { g.font = '800 26px sans-serif'; g.fillText('$' + tile.price, 0, h / 2 - 26); }
        if (tile.type === 'tax') { g.font = '800 26px sans-serif'; g.fillText('−$' + tile.amount, 0, h / 2 - 26); }
      }
      g.restore();
    }
    g.strokeStyle = th.ink; g.lineWidth = 8; g.strokeRect(4, 4, W - 8, W - 8);
  });
}

export function cardBackTexture(deck, th) {
  return canvasTexture(256, 384, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, deck === 'event' ? '#ff8a3a' : '#3a8aff'); grad.addColorStop(1, deck === 'event' ? '#c0392b' : '#2a3ab8');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 8; g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#fff'; g.font = '900 120px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(deck === 'event' ? '?' : '★', w / 2, h / 2);
  }, { key: 'tyc-back-' + deck });
}

export function cardFaceTexture(deck, text) {
  return canvasTexture(256, 384, (g, w, h) => {
    g.fillStyle = '#fffaf0'; g.fillRect(0, 0, w, h);
    g.fillStyle = deck === 'event' ? '#e0602a' : '#2a6ad8'; g.fillRect(0, 0, w, 60);
    g.fillStyle = '#fff'; g.font = '900 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(deck === 'event' ? 'EVENT' : 'FUND', w / 2, 32);
    g.fillStyle = '#1a1430'; g.font = '700 22px sans-serif';
    const lines = wrap(g, text, w - 36, 8);
    lines.forEach((l, j) => g.fillText(l, w / 2, 110 + j * 30));
  });
}

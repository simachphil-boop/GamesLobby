// Procedural canvas textures — all artwork in BOARDVERSE is generated in code (original assets).
import * as THREE from 'three';

const cache = new Map();

export function canvasTexture(w, h, draw, { repeat, key, srgb = true } = {}) {
  if (key && cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat[0], repeat[1]); }
  if (key) { tex.userData.shared = true; cache.set(key, tex); }
  return tex;
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function rnd(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

export function woodTexture(base = '#7a4a26', dark = '#4a2a12', key = 'wood' + base, planks = 6) {
  return canvasTexture(512, 512, (g, w, h) => {
    const r = rnd(7);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const ph = h / planks;
    for (let p = 0; p < planks; p++) {
      const y0 = p * ph;
      g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.12})`; g.fillRect(0, y0, w, ph);
      for (let i = 0; i < 26; i++) {
        g.strokeStyle = dark; g.globalAlpha = 0.08 + r() * 0.18; g.lineWidth = 1 + r() * 2;
        g.beginPath();
        const yy = y0 + r() * ph;
        g.moveTo(0, yy);
        for (let x = 0; x <= w; x += 32) g.lineTo(x, yy + Math.sin(x * 0.02 + i) * (2 + r() * 3));
        g.stroke();
      }
      g.globalAlpha = 0.5; g.fillStyle = dark; g.fillRect(0, y0, w, 2);
      g.globalAlpha = 1;
    }
  }, { repeat: [1, 1], key });
}

export function marbleTexture(base = '#e9e6ef', vein = '#9a94a8', key = 'marble' + base) {
  return canvasTexture(512, 512, (g, w, h) => {
    const r = rnd(11);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) {
      g.strokeStyle = vein; g.globalAlpha = 0.15 + r() * 0.25; g.lineWidth = 0.5 + r() * 2.5;
      g.beginPath();
      let x = r() * w, y = 0;
      g.moveTo(x, y);
      while (y < h) { x += (r() - 0.5) * 60; y += 20 + r() * 30; g.lineTo(x, y); }
      g.stroke();
    }
    g.globalAlpha = 1;
  }, { repeat: [2, 2], key });
}

export function feltTexture(color = '#1f6b4a', key = 'felt' + color) {
  return canvasTexture(256, 256, (g, w, h) => {
    const r = rnd(3);
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    const img = g.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (r() - 0.5) * 18;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
  }, { repeat: [3, 3], key });
}

export function tileTexture(a = '#d8d4cc', b = '#2a2a33', checker = true, key = 'tile' + a + b + checker) {
  return canvasTexture(256, 256, (g, w, h) => {
    const n = 4, s = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      g.fillStyle = checker ? ((x + y) % 2 ? a : b) : a;
      g.fillRect(x * s, y * s, s, s);
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.strokeRect(x * s, y * s, s, s);
    }
  }, { repeat: [6, 6], key });
}

export function carpetTexture(c1 = '#5a2340', c2 = '#7a3a5a', key = 'carpet' + c1) {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = c1; g.fillRect(0, 0, w, h);
    g.strokeStyle = c2; g.lineWidth = 6;
    for (let i = -w; i < w * 2; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); }
    g.fillStyle = 'rgba(255,215,120,0.25)';
    for (let y = 16; y < h; y += 64) for (let x = 16; x < w; x += 64) { g.beginPath(); g.arc(x + 16, y + 16, 5, 0, 7); g.fill(); }
  }, { repeat: [3, 3], key });
}

export function gridTexture(bg = '#07081a', line = '#3a6bff', key = 'grid' + line) {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = line; g.globalAlpha = 0.7; g.lineWidth = 2;
    for (let i = 0; i <= w; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
    g.globalAlpha = 1;
  }, { repeat: [8, 8], key });
}

export function wallTexture(base, accent, pattern = 'plain', key = 'wall' + base + accent + pattern) {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = accent; g.strokeStyle = accent;
    if (pattern === 'stripes') { for (let x = 0; x < w; x += 32) { g.globalAlpha = 0.18; g.fillRect(x, 0, 12, h); } }
    if (pattern === 'damask') {
      g.globalAlpha = 0.16;
      for (let y = 0; y < h; y += 64) for (let x = (y / 64) % 2 ? 32 : 0; x < w; x += 64) {
        g.beginPath(); g.ellipse(x + 16, y + 32, 10, 22, 0, 0, 7); g.fill();
        g.beginPath(); g.arc(x + 16, y + 6, 5, 0, 7); g.fill();
      }
    }
    if (pattern === 'panels') { g.globalAlpha = 0.25; g.lineWidth = 4; g.strokeRect(16, 16, w - 32, h - 32); }
    if (pattern === 'retro') {
      g.globalAlpha = 0.25; g.lineWidth = 10;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(w / 2, h, 40 + i * 30, Math.PI, 0); g.stroke(); }
    }
    if (pattern === 'brick') {
      g.globalAlpha = 0.25; g.lineWidth = 3;
      for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = (y / 32) % 2 ? 0 : 32; x < w; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); } }
    }
    g.globalAlpha = 1;
  }, { repeat: [4, 2], key });
}

export function skylineTexture(night = true, key = 'sky' + night) {
  return canvasTexture(1024, 512, (g, w, h) => {
    const r = rnd(42);
    const grad = g.createLinearGradient(0, 0, 0, h);
    if (night) { grad.addColorStop(0, '#060818'); grad.addColorStop(0.6, '#1b1650'); grad.addColorStop(1, '#5a2a6a'); }
    else { grad.addColorStop(0, '#6aa8ff'); grad.addColorStop(0.7, '#bcd8ff'); grad.addColorStop(1, '#ffe2c0'); }
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    if (night) for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.8})`; g.fillRect(r() * w, r() * h * 0.5, 1.5, 1.5); }
    else { g.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(r() * w, 40 + r() * 120, 60 + r() * 50, 14 + r() * 10, 0, 0, 7); g.fill(); } }
    for (let layer = 0; layer < 3; layer++) {
      let x = 0;
      while (x < w) {
        const bw = 30 + r() * 70, bh = 80 + r() * (220 - layer * 50) + layer * 40;
        const shade = night ? 18 + layer * 14 : 120 - layer * 30;
        g.fillStyle = night ? `rgb(${shade},${shade},${shade + 30})` : `rgb(${shade},${shade + 20},${shade + 50})`;
        g.fillRect(x, h - bh, bw, bh);
        for (let wy = h - bh + 8; wy < h - 6; wy += 12) for (let wx = x + 5; wx < x + bw - 5; wx += 10) {
          if (r() < (night ? 0.45 : 0.25)) { g.fillStyle = night ? (r() < 0.8 ? '#ffd27a' : '#7ad8ff') : 'rgba(255,255,255,0.6)'; g.fillRect(wx, wy, 5, 7); }
        }
        x += bw + 2 + r() * 8;
      }
    }
  }, { key });
}

export function artTexture(seed, palette, key = 'art' + seed) {
  return canvasTexture(256, 320, (g, w, h) => {
    const r = rnd(seed * 97 + 13);
    g.fillStyle = palette[0]; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      g.fillStyle = palette[1 + (i % (palette.length - 1))];
      g.globalAlpha = 0.6 + r() * 0.4;
      const t = r();
      if (t < 0.4) { g.beginPath(); g.arc(r() * w, r() * h, 20 + r() * 70, 0, 7); g.fill(); }
      else if (t < 0.75) g.fillRect(r() * w, r() * h, 20 + r() * 120, 10 + r() * 80);
      else { g.beginPath(); g.moveTo(r() * w, r() * h); g.lineTo(r() * w, r() * h); g.lineTo(r() * w, r() * h); g.fill(); }
    }
    g.globalAlpha = 1;
  }, { key });
}

export function glowTexture(color = '#ffffff', key = 'glow' + color) {
  return canvasTexture(128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, color); grad.addColorStop(0.35, color + '88'); grad.addColorStop(1, color + '00');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  }, { key });
}

export function textTexture(text, { w = 512, h = 128, font = 'bold 72px sans-serif', color = '#fff', bg = null, glow = null } = {}) {
  return canvasTexture(w, h, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (glow) { g.shadowColor = glow; g.shadowBlur = 24; }
    g.fillStyle = color; g.fillText(text, w / 2, h / 2);
  });
}

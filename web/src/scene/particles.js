// Lightweight particle bursts (confetti, coins, sparkles) with a hard cap scaled by quality.
import * as THREE from 'three';
import { glowTexture } from './textures.js';

export class Particles {
  constructor(engine) {
    this.engine = engine;
    this.max = 600;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.max * 3);
    this.col = new Float32Array(this.max * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.PointsMaterial({ size: 0.05, vertexColors: true, map: glowTexture('#ffffff'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    engine.scene.add(this.points);
    this.parts = [];
    engine.onUpdate((dt) => this.update(dt));
  }
  burst(origin, { count = 60, colors = ['#ffd27a', '#ff5a8a', '#5af0ff', '#7a4bff', '#5aff9a'], speed = 2.2, up = 2.5, life = 1.8, gravity = 4 } = {}) {
    const n = Math.round(count * this.engine.q.particles);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      if (this.parts.length >= this.max) this.parts.shift();
      c.set(colors[i % colors.length]);
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random());
      this.parts.push({
        p: origin.clone(), v: new THREE.Vector3(Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s),
        c: c.clone(), life: life * (0.6 + Math.random() * 0.6), age: 0, g: gravity,
      });
    }
  }
  update(dt) {
    let j = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.age += dt;
      if (p.age > p.life) { this.parts.splice(i, 1); continue; }
    }
    for (const p of this.parts) {
      p.v.y -= p.g * dt; p.v.multiplyScalar(0.985);
      p.p.addScaledVector(p.v, dt);
      if (p.p.y < 0.79 && p.v.y < 0 && Math.abs(p.p.x) < 1.35 && Math.abs(p.p.z) < 1.35) { p.p.y = 0.79; p.v.y *= -0.3; }
      const f = 1 - p.age / p.life;
      this.pos[j * 3] = p.p.x; this.pos[j * 3 + 1] = p.p.y; this.pos[j * 3 + 2] = p.p.z;
      this.col[j * 3] = p.c.r * f; this.col[j * 3 + 1] = p.c.g * f; this.col[j * 3 + 2] = p.c.b * f;
      j++;
    }
    for (let k = j; k < this.max; k++) { this.pos[k * 3 + 1] = -99; }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    this.points.geometry.setDrawRange(0, Math.max(1, j));
  }
}

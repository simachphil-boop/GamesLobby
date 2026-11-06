// Render engine: renderer, scene, quality presets, frame limiter, tweening, picking.
import * as THREE from 'three';
import { save } from '../core/store.js';
import { bus } from '../core/events.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export const QUALITY = {
  low: { pixelRatio: 1, shadows: false, antialias: false, particles: 0.35, shadowMap: 512, lights: 1, bloom: false, env: false },
  medium: { pixelRatio: 1.5, shadows: true, antialias: false, particles: 0.7, shadowMap: 1024, lights: 2, bloom: true, env: true },
  high: { pixelRatio: 2, shadows: true, antialias: true, particles: 1, shadowMap: 2048, lights: 3, bloom: true, env: true },
};

// ---------- Tweens ----------
export const Ease = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outBounce: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  outElastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};

class Tweens {
  constructor() { this.list = []; this.time = 0; }
  /** Animate t from 0..1 over `dur` seconds (scaled by game speed). */
  run(dur, onUpdate, ease = Ease.inOut, { unscaled = false } = {}) {
    return new Promise((resolve) => {
      const speed = unscaled ? 1 : (save.settings.speed || 1);
      const tw = { t: 0, dur: Math.max(0.001, dur / speed), onUpdate, ease, resolve };
      this.list.push(tw);
      onUpdate(ease(0), 0);
    });
  }
  /** Tween numeric props of an object (or THREE.Vector3/Euler). */
  to(obj, props, dur, ease = Ease.inOut, opts) {
    const from = {};
    for (const k of Object.keys(props)) from[k] = obj[k];
    return this.run(dur, (e) => { for (const k of Object.keys(props)) obj[k] = from[k] + (props[k] - from[k]) * e; }, ease, opts);
  }
  wait(sec, opts) { return this.run(sec, () => {}, Ease.linear, opts); }
  update(dt) {
    this.time += dt;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const tw = this.list[i];
      tw.t += dt / tw.dur;
      const done = tw.t >= 1;
      try { tw.onUpdate(tw.ease(Math.min(1, tw.t)), Math.min(1, tw.t)); } catch (e) { console.error(e); }
      if (done) { this.list.splice(i, 1); tw.resolve(); }
    }
  }
  clear() { this.list.forEach((t) => t.resolve()); this.list = []; }
}
export const tweens = new Tweens();
export const wait = (sec) => tweens.wait(sec);

// ---------- Engine ----------
export class Engine {
  constructor(container) {
    this.container = container;
    this.qualityName = this.resolveQuality(save.settings.quality);
    this.q = QUALITY[this.qualityName];
    this.renderer = new THREE.WebGLRenderer({ antialias: this.q.antialias, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.05, 80);
    this.scene.add(this.camera);
    this.updaters = new Set();
    this.raycaster = new THREE.Raycaster();
    this.clock = new THREE.Clock();
    this.paused = false;
    this.lastFrame = 0;
    this.applyQuality();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    document.addEventListener('visibilitychange', () => { this.paused = document.hidden; });
    bus.on('settings', (k, v) => {
      if (k === 'quality') { this.qualityName = this.resolveQuality(v); this.q = QUALITY[this.qualityName]; this.applyQuality(); bus.emit('quality', this.qualityName); }
    });
  }

  resolveQuality(q) {
    if (q && q !== 'auto') return q;
    // auto: modest default on phones to avoid heating; high on desktops
    const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    const cores = navigator.hardwareConcurrency || 4;
    if (!mobile) return 'high';
    return cores >= 8 ? 'medium' : 'low';
  }

  applyQuality() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.q.pixelRatio);
    // image-based lighting gives PBR materials soft reflections (gold, varnish, glass)
    if (this.q.env && !this.envTex) {
      const pm = new THREE.PMREMGenerator(this.renderer);
      this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      pm.dispose();
    }
    this.scene.environment = this.q.env ? this.envTex : null;
    this.scene.environmentIntensity = 0.32;
    // bloom makes neon signs, lamps and gold highlights glow
    if (this.q.bloom && !this.composer) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.45, 0.93);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }
    this.useComposer = !!this.q.bloom;
    this.renderer.setPixelRatio(dpr);
    this.renderer.shadowMap.enabled = this.q.shadows;
    this.scene.traverse((o) => {
      if (o.isDirectionalLight || o.isSpotLight) {
        o.castShadow = this.q.shadows && o.userData.shadow !== false;
        if (o.shadow) { o.shadow.mapSize.set(this.q.shadowMap, this.q.shadowMap); if (o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; } }
      }
      if (o.material) o.material.needsUpdate = true;
    });
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px';
    this.renderer.domElement.style.height = h + 'px';
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); }
    this.camera.aspect = w / h;
    // wider vertical FOV in portrait so the table fits
    this.camera.fov = w < h ? 68 : 52;
    this.camera.updateProjectionMatrix();
    this.portrait = w < h;
    bus.emit('resize', w, h);
  }

  onUpdate(fn) { this.updaters.add(fn); return () => this.updaters.delete(fn); }

  start() {
    const loop = (now) => {
      requestAnimationFrame(loop);
      if (this.paused) { this.clock.getDelta(); return; }
      const fps = save.settings.fps || 60;
      const minDt = 1000 / fps - 2;
      if (now - this.lastFrame < minDt) return;
      this.lastFrame = now;
      const dt = Math.min(0.05, this.clock.getDelta());
      tweens.update(dt);
      for (const fn of this.updaters) { try { fn(dt, tweens.time); } catch (e) { console.error(e); } }
      if (this.useComposer && this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(loop);
  }

  /** Raycast from client coords against a list of objects. */
  pick(clientX, clientY, objects, recursive = true) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.intersectObjects(objects, recursive);
  }

  /** World position -> screen pixels (for HTML labels). */
  toScreen(v3) {
    const p = v3.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight, visible: p.z < 1 && p.z > -1 };
  }
}

/** Dispose geometries/materials/textures of a subtree. */
export function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m.userData.shared) continue;
        for (const k of ['map', 'emissiveMap', 'roughnessMap', 'normalMap', 'alphaMap']) if (m[k] && !m[k].userData.shared) m[k].dispose();
        m.dispose();
      }
    }
  });
}

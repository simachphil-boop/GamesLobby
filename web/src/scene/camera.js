// Camera System: First-person (seated at the table) and Third-person (orbit above the table)
// with smooth animated transitions, natural head sway, drag-to-look, pinch-zoom,
// plus cinematic poses for menus. Also routes taps (non-drag clicks) to the active game.
import * as THREE from 'three';
import { save, setSetting } from '../core/store.js';
import { bus } from '../core/events.js';
import { TABLE_Y, SEAT_R, seatPosition } from './room.js';
import { Ease } from './engine.js';
import { sfx } from '../core/audio.js';

const tmpM = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

export class CameraRig {
  constructor(engine) {
    this.engine = engine;
    this.cam = engine.camera;
    this.mode = save.settings.camera === 'tp' ? 'tp' : 'fp';
    this.cinematic = 'menu';
    this.seatAngle = 0;
    this.focus = 0.92; // half-size of the play area; smaller boards bring the camera closer
    this.yawOff = 0; this.pitchOff = 0; this.zoom = 1;
    this.trans = null;
    this.tapHandlers = new Set();
    this.dragEnabled = true;
    this.handRig = new THREE.Group();
    this.cam.add(this.handRig);
    this.layoutHandRig();
    bus.on('resize', () => this.layoutHandRig());
    this.cam.position.set(0, 2.2, 4.5);
    this.cam.lookAt(0, TABLE_Y, 0);
    this.bindInput(engine.renderer.domElement);
    engine.onUpdate((dt, t) => this.update(dt, t));
  }

  layoutHandRig() {
    const portrait = window.innerWidth < window.innerHeight;
    this.handRig.position.set(0, portrait ? -0.25 : -0.17, portrait ? -0.62 : -0.66);
    this.handRig.userData.portrait = portrait;
  }

  beginTransition(dur = 1.1) {
    this.trans = { t: 0, dur, fromPos: this.cam.position.clone(), fromQ: this.cam.quaternion.clone() };
  }

  setMode(mode, animate = true) {
    if (mode === this.mode && !this.cinematic) return;
    this.mode = mode;
    this.yawOff = 0; this.pitchOff = 0;
    if (animate) { this.beginTransition(1.1); sfx('whoosh'); }
    setSetting('camera', mode);
    bus.emit('camera', mode);
  }
  toggle() { this.setMode(this.mode === 'fp' ? 'tp' : 'fp'); }

  setCinematic(name, animate = true) {
    if (this.cinematic === name) return;
    this.cinematic = name;
    this.yawOff = 0; this.pitchOff = 0; this.zoom = 1;
    if (animate) this.beginTransition(name ? 1.4 : 1.2);
  }

  setSeat(angle, animate = true) {
    if (Math.abs(angle - this.seatAngle) < 1e-4) return;
    this.seatAngle = angle;
    this.yawOff = 0; this.pitchOff = 0;
    if (animate) this.beginTransition(1.2);
  }

  /** Desired camera pose for the current state (pos + target). */
  pose(t) {
    const a = this.seatAngle;
    const portrait = this.engine.portrait;
    if (this.cinematic === 'menu') {
      const yaw = t * 0.05;
      const r = portrait ? 5.2 : 4.4;
      return { pos: new THREE.Vector3(Math.sin(yaw) * r, 2.3, Math.cos(yaw) * r), target: new THREE.Vector3(0, 1.0, 0) };
    }
    if (this.cinematic === 'character') {
      const av = seatPosition(0, SEAT_R);
      const yaw = this.yawOff;
      const d = (portrait ? 1.55 : 1.15) * this.zoom;
      const pos = new THREE.Vector3(av.x - Math.sin(yaw) * d, 1.25, av.z - Math.cos(yaw) * d);
      return { pos, target: new THREE.Vector3(av.x, portrait ? 1.0 : 1.1, av.z) };
    }
    if (this.cinematic === 'library') {
      return { pos: new THREE.Vector3(-1.2, 1.6, 2.9), target: new THREE.Vector3(-2.8, 1.2, -6.5) };
    }
    if (this.mode === 'fp') {
      const f = this.focus;
      const eye = seatPosition(a, Math.min(SEAT_R - 0.02, 0.86 + f * 0.8 - (portrait ? -0.08 : 0)));
      eye.y = (portrait ? 1.16 : 1.08) + f * 0.37;
      const look = new THREE.Vector3(Math.sin(a) * (portrait ? 0.2 : 0.1), TABLE_Y, Math.cos(a) * (portrait ? 0.2 : 0.1));
      // apply look offsets (yaw around eye, pitch)
      const dir = look.clone().sub(eye);
      const dist = dir.length();
      dir.normalize();
      dir.applyAxisAngle(UP, this.yawOff);
      const right = new THREE.Vector3().crossVectors(dir, UP).normalize();
      dir.applyAxisAngle(right, this.pitchOff);
      if (save.settings.sway) {
        eye.x += Math.sin(t * 0.55) * 0.012 * Math.cos(a);
        eye.z -= Math.sin(t * 0.55) * 0.012 * Math.sin(a);
        eye.y += Math.sin(t * 0.83) * 0.008;
      }
      return { pos: eye, target: eye.clone().add(dir.multiplyScalar(dist)) };
    }
    // third person orbit
    const yaw = a + this.yawOff;
    const pitch = THREE.MathUtils.clamp(0.98 + this.pitchOff, 0.45, 1.45);
    const d = (portrait ? 4.1 : 3.25) * this.zoom * (0.5 + this.focus * 0.55);
    const center = new THREE.Vector3(0, TABLE_Y, 0);
    const pos = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch) * d, Math.sin(pitch) * d + TABLE_Y, Math.cos(yaw) * Math.cos(pitch) * d);
    return { pos, target: center.clone().add(new THREE.Vector3(0, -0.05, 0)) };
  }

  update(dt, t) {
    // in third person the held cards shrink toward the bottom so they don't cover the table
    const tp = this.mode === 'tp' && !this.cinematic;
    const portrait = this.handRig.userData.portrait;
    const wantY = (portrait ? -0.25 : -0.17) - (tp ? 0.08 : 0), wantS = tp ? 0.62 : 1;
    this.handRig.position.y += (wantY - this.handRig.position.y) * Math.min(1, dt * 6);
    this.handRig.scale.setScalar(this.handRig.scale.x + (wantS - this.handRig.scale.x) * Math.min(1, dt * 6));
    const { pos, target } = this.pose(t);
    tmpM.lookAt(pos, target, UP);
    const q = new THREE.Quaternion().setFromRotationMatrix(tmpM);
    if (this.trans) {
      this.trans.t += dt / this.trans.dur;
      const e = Ease.inOut(Math.min(1, this.trans.t));
      const p = this.trans.fromPos.clone().lerp(pos, e);
      p.y += Math.sin(e * Math.PI) * 0.45;
      this.cam.position.copy(p);
      this.cam.quaternion.copy(this.trans.fromQ).slerp(q, e);
      if (this.trans.t >= 1) this.trans = null;
    } else {
      const k = 1 - Math.exp(-dt * 12);
      this.cam.position.lerp(pos, k);
      this.cam.quaternion.slerp(q, k);
    }
  }

  // ---------- input ----------
  onTap(fn) { this.tapHandlers.add(fn); return () => this.tapHandlers.delete(fn); }

  bindInput(el) {
    const pts = new Map();
    let start = null, moved = false, pinch0 = 0, zoom0 = 1;
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture?.(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { start = { x: e.clientX, y: e.clientY, yaw: this.yawOff, pitch: this.pitchOff }; moved = false; }
      if (pts.size === 2) {
        const [p1, p2] = [...pts.values()];
        pinch0 = Math.hypot(p1.x - p2.x, p1.y - p2.y); zoom0 = this.zoom; moved = true;
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [p1, p2] = [...pts.values()];
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (pinch0 > 0) this.zoom = THREE.MathUtils.clamp(zoom0 * (pinch0 / d), 0.6, 1.5);
        return;
      }
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) > 10) moved = true;
      if (moved && this.dragEnabled) {
        const s = 1 / Math.min(window.innerWidth, window.innerHeight);
        if (this.cinematic === 'character') { this.yawOff = THREE.MathUtils.clamp(start.yaw - dx * s * 3, -1.2, 1.2); return; }
        if (this.cinematic) return;
        if (this.mode === 'fp') {
          this.yawOff = THREE.MathUtils.clamp(start.yaw + dx * s * 1.6, -0.9, 0.9);
          this.pitchOff = THREE.MathUtils.clamp(start.pitch + dy * s * 1.2, -0.35, 0.5);
        } else {
          this.yawOff = start.yaw - dx * s * 3;
          this.pitchOff = THREE.MathUtils.clamp(start.pitch + dy * s * 1.5, -0.5, 0.45);
        }
      }
    });
    const up = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size === 0) {
        if (!moved && start) for (const fn of this.tapHandlers) fn(e.clientX, e.clientY);
        start = null;
        // FP look returns softly to center after a while
        if (this.mode === 'fp' && !this.cinematic) this._relax = 2.5;
      }
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => { this.zoom = THREE.MathUtils.clamp(this.zoom * (e.deltaY > 0 ? 1.08 : 0.93), 0.6, 1.5); }, { passive: true });
    this.engine.onUpdate((dt) => {
      if (this._relax > 0 && pts.size === 0) {
        this._relax -= dt;
        if (this._relax <= 0) {
          const from = { y: this.yawOff, p: this.pitchOff };
          const k = { v: 0 };
          const step = () => { k.v += 0.04; this.yawOff = from.y * (1 - k.v); this.pitchOff = from.p * (1 - k.v); if (k.v < 1 && pts.size === 0) requestAnimationFrame(step); };
          step();
        }
      }
    });
  }
}

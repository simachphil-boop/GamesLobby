// Application shell: owns the 3D world (engine, room, camera, labels, particles),
// the animated lobby table behind the menus, and switching between menus and matches.
import * as THREE from 'three';
import { Engine, tweens } from './scene/engine.js';
import { Room, seatAngles, seatPosition, SEAT_R, TABLE_Y } from './scene/room.js';
import { CameraRig } from './scene/camera.js';
import { Labels } from './scene/labels.js';
import { Particles } from './scene/particles.js';
import { Character } from './scene/characters.js';
import { makeDie } from './scene/dice.js';
import { PERSONAS } from './bots/personas.js';
import { Reactions } from './bots/reactions.js';
import { save, setSetting, storeMatch } from './core/store.js';
import { bus } from './core/events.js';
import { setMood } from './core/audio.js';
import { reset, fadeThrough, toast } from './ui/ui.js';
import { Match } from './games/framework.js';
import { GAMES } from './games/registry.js';
import { t } from './i18n/index.js';
import { shuffleInPlace } from './core/util.js';

export class App {
  constructor() {
    this.engine = new Engine(document.getElementById('stage'));
    this.room = new Room(this.engine);
    this.room.build(save.settings.room);
    this.rig = new CameraRig(this.engine);
    this.labels = new Labels(this.engine);
    this.particles = new Particles(this.engine);
    this.match = null;
    this.lobby = null;
    document.body.classList.add('theme-' + save.settings.uiTheme);
    bus.on('settings', (k, v) => {
      if (k === 'uiTheme') { document.body.className = document.body.className.replace(/theme-\w+/g, '') + ' theme-' + v; }
    });
    bus.on('quality', () => { if (!this.match) this.rebuildRoom(save.settings.room, false); });
    this.engine.start();
  }

  onCameraMode(fn) { return bus.on('camera', fn); }

  async rebuildRoom(id, fade = true) {
    const doIt = () => {
      this.room.build(id);
      setMood(id);
      if (this.lobby) this.startLobby();
    };
    if (fade) await fadeThrough(doIt); else doIt();
  }

  async setRoom(id) {
    if (save.settings.room === id) return;
    setSetting('room', id);
    await this.rebuildRoom(id);
  }

  // ---------- lobby (ambient table behind menus) ----------
  startLobby() {
    this.stopLobby();
    const lobby = { chars: [], group: new THREE.Group(), timers: [] };
    const angles = seatAngles(4);
    this.room.placeChairs(angles);
    const picks = shuffleInPlace([...PERSONAS]).slice(0, 3);
    const looks = [save.profile.avatar, ...picks.map((p) => p.look)];
    angles.forEach((a, i) => {
      const c = new Character(looks[i], {});
      c.root.position.copy(seatPosition(a, SEAT_R));
      c.root.rotation.y = a;
      this.engine.scene.add(c.root);
      lobby.chars.push(c);
    });
    lobby.seats = lobby.chars.map((c, i) => ({ character: c, persona: i ? picks[i - 1] : null }));
    lobby.reactions = new Reactions(lobby.seats, this.labels);
    // decorative props: a few dice and cards on the table
    const d1 = makeDie(), d2 = makeDie();
    d1.position.set(0.15, TABLE_Y + 0.065, 0.1); d1.rotation.set(0, 0.4, 0);
    d2.position.set(-0.08, TABLE_Y + 0.065, 0.22); d2.rotation.set(Math.PI / 2, 1, 0);
    lobby.group.add(d1, d2);
    const cardMat = new THREE.MeshStandardMaterial({ color: '#f4f0ff', roughness: 0.5 });
    const backMat = new THREE.MeshStandardMaterial({ color: '#4a2aa8', roughness: 0.5 });
    for (let i = 0; i < 7; i++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.003, 0.13), [cardMat, cardMat, i % 2 ? backMat : cardMat, cardMat, cardMat, cardMat]);
      c.position.set(-0.3 + Math.cos(i) * 0.25, TABLE_Y + 0.002 + i * 0.003, -0.15 + Math.sin(i * 2) * 0.2);
      c.rotation.y = i * 0.7;
      lobby.group.add(c);
    }
    this.engine.scene.add(lobby.group);
    lobby.off = this.engine.onUpdate((dt, tt) => {
      for (const c of lobby.chars) c.update(dt, tt);
      lobby.next = (lobby.next ?? 2) - dt;
      if (lobby.next <= 0) {
        lobby.next = 2.5 + Math.random() * 3;
        const i = 1 + Math.floor(Math.random() * 3);
        const kinds = ['good', 'lucky', 'unlucky', 'surprise', 'think'];
        const kind = kinds[Math.floor(Math.random() * kinds.length)];
        if (kind === 'think') lobby.reactions.thinking(i);
        else lobby.reactions.event(i, kind, { magnitude: Math.random() });
        if (Math.random() < 0.3) lobby.chars[i].reach(new THREE.Vector3((Math.random() - 0.5) * 0.6, TABLE_Y + 0.05, (Math.random() - 0.5) * 0.6));
      }
    });
    this.lobby = lobby;
  }
  stopLobby() {
    const l = this.lobby;
    if (!l) return;
    l.off();
    for (const c of l.chars) { this.engine.scene.remove(c.root); c.dispose(); }
    this.engine.scene.remove(l.group);
    l.group.traverse((o) => { o.geometry?.dispose(); });
    this.labels.clear();
    this.lobby = null;
  }
  /** Refresh the user's avatar on the lobby table (after editing the character). */
  refreshLobbyAvatar() {
    if (!this.lobby) return;
    const old = this.lobby.chars[0];
    const c = new Character(save.profile.avatar, {});
    c.root.position.copy(old.root.position);
    c.root.rotation.copy(old.root.rotation);
    this.engine.scene.remove(old.root); old.dispose();
    this.engine.scene.add(c.root);
    this.lobby.chars[0] = c;
    this.lobby.seats[0].character = c;
    return c;
  }
  lobbyAvatar() { return this.lobby?.chars[0]; }
  /** Coin burst over the table + everyone cheers (daily reward, purchases). */
  celebrate() {
    this.particles.burst(new THREE.Vector3(0, TABLE_Y + 0.2, 0), { count: 90, colors: ['#ffd27a', '#fff3b0', '#f7a83a'], up: 3 });
    this.lobby?.chars.forEach((c, i) => setTimeout(() => c.emote(i ? 'clap' : 'celebrate'), i * 150));
  }

  // ---------- matches ----------
  enterTable() {
    this.stopLobby();
    this.rig.setCinematic(null);
  }
  mountHud(hud) {
    const ui = document.getElementById('ui');
    ui.innerHTML = '';
    ui.appendChild(hud.el);
  }
  async startMatch(def, config) {
    if (config.room && config.room !== save.settings.room) { setSetting('room', config.room); }
    await fadeThrough(async () => {
      if (this.room.themeId !== save.settings.room) { this.room.build(save.settings.room); setMood(save.settings.room); }
      document.getElementById('ui').innerHTML = '';
      this.match = new Match(this, def, config);
      await this.match.start();
    });
    if (!save.settings.tutorialSeen) { setSetting('tutorialSeen', true); setTimeout(() => toast(t('toast.tutorial')), 1500); }
  }
  resumeMatch() {
    const m = save.match;
    if (!m) return false;
    const def = GAMES.find((g) => g.id === m.gameId);
    if (!def) { storeMatch(null); return false; }
    this.startMatch(def, { ...m.config, state: m.state });
    return true;
  }
  leaveTable() {
    this.match = null;
    this.goMenu();
  }
  goMenu() {
    if (!this.lobby) this.startLobby();
    this.rig.setCinematic('menu');
    reset(this.screens.mainMenu, this);
  }
}

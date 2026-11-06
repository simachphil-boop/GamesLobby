// Online Multiplayer: rooms with invite codes, lockstep action sync, join/leave handling.
//
// Transports:
//   - LocalTransport: BroadcastChannel between windows/tabs on the same device (no server needed)
//   - WsTransport: the bundled relay server (server/relay.js) over WebSocket, for internet play
// Sync model: all clients run the same deterministic rules with the same seed. Every action
// (human or host-controlled bot) is broadcast; clients apply them in order. If a guest drops,
// the host converts their seat to a bot and keeps playing for everyone.
import { uid } from '../core/util.js';
import { Emitter } from '../core/events.js';

class LocalTransport {
  constructor(room) {
    this.ch = new BroadcastChannel('boardverse-' + room);
    this.ev = new Emitter();
    this.ch.onmessage = (e) => this.ev.emit('msg', e.data);
    setTimeout(() => this.ev.emit('open'), 0);
  }
  send(m) { this.ch.postMessage(m); }
  on(e, f) { return this.ev.on(e, f); }
  close() { this.ch.close(); }
}

class WsTransport {
  constructor(url, room, id) {
    this.ev = new Emitter();
    this.queue = [];
    try { this.ws = new WebSocket(url); } catch (e) { setTimeout(() => this.ev.emit('error', e), 0); return; }
    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({ t: '_join', room, id }));
      for (const m of this.queue) this.ws.send(JSON.stringify(m));
      this.queue = [];
      this.ev.emit('open');
    };
    this.ws.onmessage = (e) => { try { this.ev.emit('msg', JSON.parse(e.data)); } catch (err) { /* ignore */ } };
    this.ws.onerror = (e) => this.ev.emit('error', e);
    this.ws.onclose = () => this.ev.emit('close');
  }
  send(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); else this.queue.push(m); }
  on(e, f) { return this.ev.on(e, f); }
  close() { try { this.ws && this.ws.close(); } catch (e) { /* ignore */ } }
}

export function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

/** A room session (before and during the match). */
export class OnlineRoom extends Emitter {
  constructor({ code, host, name, look, server }) {
    super();
    this.code = code;
    this.isHost = host;
    this.id = uid();
    this.me = { id: this.id, name, look };
    this.players = host ? [this.me] : [];
    this.hostId = host ? this.id : null;
    this.lastSeen = new Map();
    this.status = 'connecting';
    this.transport = server ? new WsTransport(server, code, this.id) : new LocalTransport(code);
    this.mode = server ? 'server' : 'local';
    this.transport.on('open', () => {
      this.status = 'connected';
      this.emit('status');
      if (!host) this.send({ t: 'hello', id: this.id, name, look });
      else this.broadcastRoster();
    });
    this.transport.on('error', () => { this.status = 'offline'; this.emit('status'); });
    this.transport.on('close', () => { this.status = 'offline'; this.emit('status'); });
    this.transport.on('msg', (m) => this.onMsg(m));
    this.beat = setInterval(() => this.heartbeat(), 2000);
    this.game = null;
    this.actionQueue = [];
    this.waiters = [];
    if (!host) this.joinTimer = setTimeout(() => { if (!this.hostId) this.emit('joinFailed'); }, 6000);
  }

  send(m) { m.from = this.id; this.transport.send(m); }

  heartbeat() {
    this.send({ t: 'ping' });
    if (!this.isHost) {
      if (this.hostId && Date.now() - (this.lastSeen.get(this.hostId) || Date.now()) > 9000) this.emit('hostLeft');
      return;
    }
    const now = Date.now();
    for (const p of [...this.players]) {
      if (p.id === this.id) continue;
      if (now - (this.lastSeen.get(p.id) || now) > 9000) this.dropPlayer(p.id);
    }
  }

  dropPlayer(id) {
    const p = this.players.find((x) => x.id === id);
    if (!p) return;
    this.players = this.players.filter((x) => x.id !== id);
    this.emit('left', p);
    if (this.game) {
      const seat = this.game.seats.findIndex((s) => s.id === id);
      if (seat >= 0) { this.send({ t: 'takeover', seat }); this.takeover(seat); }
    } else this.broadcastRoster();
  }

  broadcastRoster() {
    if (!this.isHost) return;
    this.send({ t: 'roster', players: this.players, hostId: this.id, game: this.selectedGame });
    this.emit('roster');
  }

  onMsg(m) {
    if (!m || m.from === this.id) return;
    this.lastSeen.set(m.from, Date.now());
    switch (m.t) {
      case 'hello':
        if (this.isHost && !this.game) {
          if (!this.players.find((p) => p.id === m.id) && this.players.length < 4) {
            this.players.push({ id: m.id, name: m.name, look: m.look });
            this.emit('joined', m);
          }
          this.broadcastRoster();
        }
        break;
      case 'roster':
        if (!this.isHost) {
          clearTimeout(this.joinTimer);
          this.hostId = m.hostId; this.players = m.players; this.selectedGame = m.game;
          this.lastSeen.set(m.hostId, Date.now());
          this.emit('roster');
        }
        break;
      case 'start':
        if (!this.isHost && m.config.seats.some((s) => s.id === this.id)) { this.game = m.config; this.emit('start', m.config); }
        break;
      case 'action':
        this.actionQueue.push(m);
        this.flush();
        break;
      case 'emote': this.emit('emote', m.seat, m.id); break;
      case 'takeover': this.takeover(m.seat); break;
      case 'bye':
        if (this.isHost) this.dropPlayer(m.from);
        else if (m.from === this.hostId) this.emit('hostLeft');
        break;
      default: break;
    }
  }

  takeover(seat) {
    // resolve anyone waiting on that seat so the match can switch it to a bot
    this.emit('takeover', seat);
    this.waiters = this.waiters.filter((w) => {
      if (w.seat === seat && this.isHost) { w.resolve({ __takeover: true }); return false; }
      return true;
    });
  }

  /** Host: start the match. Returns host-side seats config. */
  startGame(gameId, options, botPersonas, nPlayers) {
    const seats = this.players.map((p) => ({ id: p.id, name: p.name, look: p.look, kind: 'human' }));
    let k = 0;
    while (seats.length < nPlayers) seats.push({ kind: 'bot', personaId: botPersonas[k++] });
    const seed = (Math.random() * 4294967296) >>> 0;
    const config = { gameId, options, seed, seats };
    this.game = config;
    this.send({ t: 'start', config });
    return config;
  }

  /** Build the local Match seat list from the shared config. */
  localSeats(config) {
    return config.seats.map((s) => {
      if (s.kind === 'human') return s.id === this.id ? { type: 'human', name: s.name, look: s.look } : { type: 'remote', name: s.name, look: s.look, id: s.id };
      return this.isHost ? { type: 'bot', personaId: s.personaId, level: config.options.difficulty || 'normal' } : { type: 'remote', personaId: s.personaId };
    });
  }
  localSeatIndex(config) { return config.seats.findIndex((s) => s.id === this.id); }

  // ----- Match net interface -----
  sendAction(seat, action) { this.seq = (this.seq || 0) + 1; this.send({ t: 'action', seat, action, seq: this.seq }); }
  sendEmote(seat, id) { this.send({ t: 'emote', seat, id }); }
  nextAction(seat) {
    return new Promise((resolve) => { this.waiters.push({ seat, resolve }); this.flush(); });
  }
  flush() {
    while (this.actionQueue.length && this.waiters.length) {
      const m = this.actionQueue[0];
      const wi = this.waiters.findIndex((w) => w.seat === m.seat);
      if (wi < 0) break;
      this.actionQueue.shift();
      const [w] = this.waiters.splice(wi, 1);
      w.resolve(m.action);
    }
  }

  close() {
    clearInterval(this.beat);
    clearTimeout(this.joinTimer);
    try { this.send({ t: 'bye' }); } catch (e) { /* ignore */ }
    setTimeout(() => this.transport.close(), 100);
  }
}

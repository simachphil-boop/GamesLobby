// BOARDVERSE online relay server (no dependencies): node server/relay.js [port]
// Clients send {t:'_join', room, id}; every other message is relayed to the rest of the room.
// Game logic stays on clients (deterministic lockstep), so the server is tiny and stateless.
const http = require('http');
const crypto = require('crypto');
const port = +(process.argv[2] || process.env.PORT || 8787);
const rooms = new Map();

function frame(str) {
  const data = Buffer.from(str);
  const len = data.length;
  const head = len < 126 ? Buffer.from([0x81, len]) : len < 65536 ? Buffer.from([0x81, 126, len >> 8, len & 255]) : Buffer.concat([Buffer.from([0x81, 127, 0, 0, 0, 0]), Buffer.from([(len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255])]);
  return Buffer.concat([head, data]);
}
function parse(buf) {
  const out = [];
  let o = 0;
  while (o + 2 <= buf.length) {
    const op = buf[o] & 15; let len = buf[o + 1] & 127; let p = o + 2;
    if (len === 126) { len = buf.readUInt16BE(p); p += 2; } else if (len === 127) { len = Number(buf.readBigUInt64BE(p)); p += 8; }
    const masked = buf[o + 1] & 128; const mask = masked ? buf.slice(p, p + 4) : null; if (masked) p += 4;
    if (p + len > buf.length) break;
    const data = buf.slice(p, p + len);
    if (mask) for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
    out.push({ op, text: data.toString() });
    o = p + len;
  }
  return { msgs: out, rest: buf.slice(o) };
}
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('BOARDVERSE relay OK\n'); });
server.on('upgrade', (req, sock) => {
  const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  let buf = Buffer.alloc(0); let room = null;
  const leave = () => { if (room && rooms.has(room)) { rooms.get(room).delete(sock); if (!rooms.get(room).size) rooms.delete(room); } };
  sock.on('data', (d) => {
    const r = parse(Buffer.concat([buf, d])); buf = r.rest;
    for (const m of r.msgs) {
      if (m.op === 8) { leave(); sock.end(); return; }
      if (m.op !== 1) continue;
      let msg; try { msg = JSON.parse(m.text); } catch { continue; }
      if (msg.t === '_join') { leave(); room = String(msg.room).slice(0, 12); if (!rooms.has(room)) rooms.set(room, new Set()); rooms.get(room).add(sock); continue; }
      if (!room) continue;
      for (const peer of rooms.get(room) || []) if (peer !== sock) peer.write(frame(m.text));
    }
  });
  sock.on('close', leave); sock.on('error', leave);
});
server.listen(port, () => console.log('BOARDVERSE relay on ws://0.0.0.0:' + port));

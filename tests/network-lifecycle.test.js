const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs');
const { EventEmitter } = require('node:events');
const engine = fs.readFileSync('js/legacy/03-engine.js', 'utf8');
const transport = engine.slice(engine.indexOf('let roundEndTimer ='), engine.indexOf('function startRound()')) + engine.slice(engine.indexOf('const NET = {'), engine.indexOf('const room = {'));
const recovery = fs.readFileSync('js/legacy/30-multiplayer-drops-a-guest-used-to-be-thrown-back-to-the-ti.js', 'utf8');
const fallback = fs.readFileSync('js/legacy/45-fewer-dropped-players-each-guest-has-two-links-to-the-host.js', 'utf8');
function setup() {
  let now = 100, next = 0;
  const timers = new Map(), peers = [], received = [], left = [];
  class Channel extends EventEmitter {
    constructor(peer, label) { super(); this.peer = peer; this.label = label; this.open = false; this.sent = []; }
    ready() { this.open = true; this.emit('open'); }
    send(data) { this.sent.push(data); }
    close() { this.open = false; this.emit('close'); }
  }
  class Peer extends EventEmitter {
    constructor(id) { super(); this.id = id || 'guest-' + peers.length; this.channels = []; this.destroyed = false; this.disconnected = false; this.reconnects = 0; peers.push(this); }
    connect(id, options) { const channel = new Channel(id, options.label); this.channels.push(channel); return channel; }
    destroy() { this.destroyed = true; this.channels.forEach((c) => c.close()); this.emit('close'); }
    reconnect() { this.reconnects++; this.disconnected = false; }
  }
  const element = () => ({ hidden: true, append() {}, appendChild() {}, style: {} });
  const lobby = element();
  const c = { Peer, console, Map, Set, Math, Promise, Error, performance: { now: () => now }, document: { hidden: false, getElementById: () => lobby, createElement: element, body: element(), head: element(), addEventListener() {} }, addEventListener() {},
    setTimeout(fn, delay) { const id = ++next; timers.set(id, { fn, at: now + delay }); return id; }, clearTimeout(id) { timers.delete(id); }, setInterval() { return ++next; }, clearInterval() {},
    world: { phase: 'menu', actors: [] }, room: { started: false, members: new Map(), slots: { atk: [], def: [] } },
    joinRoom() {}, myName: () => 'guest', myActor: () => null, banner() {}, step() {}, isAI: () => true, actorById() {}, lobbyRemove() {}, lobbyMove() {}, lobbySnapshot: () => ({}), renderLobby() {},
  };
  c.window = c; vm.createContext(c); vm.runInContext(transport + '\nwindow.NET = NET;', c);
  c.NET.onAction = () => {}; c.NET.onPeerGone = () => {}; c.NET.onHostGone = () => left.push('left'); c.NET.onEvent = (m) => received.push(m); c.NET.onSnapshot = (m) => received.push(m);
  vm.runInContext(recovery + '\n' + fallback, c);
  async function flush() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
  async function advance(ms) { const target = now + ms; for (;;) { const item = [...timers].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0]; if (!item) break; timers.delete(item[0]); now = item[1].at; item[1].fn(); await flush(); } now = target; await flush(); }
  async function connect(code = 'ABC123') { const promise = c.netJoin(code); const peer = peers.at(-1); peer.emit('open', peer.id); peer.channels[0].ready(); peer.channels[1].ready(); await promise; await flush(); return peer; }
  return { c, peers, received, left, Channel, advance, flush, connect, lobby };
}
test('state channel closing during join preserves the reliable channel', async () => {
  const h = setup(), p = h.c.netJoin('ABC123'); p.catch(() => {});
  const peer = h.peers[0]; peer.emit('open', peer.id); peer.channels[0].close(); peer.channels[1].ready();
  await p; assert.equal(h.left.length, 0); assert.equal(h.c.NET.status, 'open');
});
test('late data from replaced guest channels cannot change the new session', async () => {
  const h = setup(), old = await h.connect(); await h.connect('DEF456');
  old.channels[0].emit('data', { t: 's', stale: true }); old.channels[1].emit('data', { t: 'begin', stale: true });
  assert.equal(h.received.length, 0);
});
test('old host-side channel close does not delete its replacement', () => {
  const h = setup(), { c, Channel } = h; c.NET.mode = 'host'; c.NET.peer = {};
  const old = new Channel('guest', 'state'), current = new Channel('guest', 'state'), event = new Channel('guest', 'event');
  for (const channel of [old, event, current]) { c.hostAccept(channel); channel.ready(); }
  old.close(); assert.equal(c.NET.conns.get('guest').state, current); assert.equal(event.open, true);
});
test('leaving while joining settles the pending promise and blocks late open', async () => {
  const h = setup(); let result = 'pending'; const p = h.c.netJoin('ABC123').then(() => result = 'open', () => result = 'cancelled');
  const peer = h.peers[0]; h.c.netShutdown(); await h.advance(40001);
  assert.equal(result, 'cancelled'); peer.emit('open', peer.id); assert.equal(h.c.NET.up, null); assert.equal(h.c.NET.mode, 'solo'); await p;
});
test('host reconnects signaling without dropping its game channels', async () => {
  const h = setup(), p = h.c.netHost('ABC123'), peer = h.peers[0]; peer.emit('open', peer.id); await p;
  peer.disconnected = true; peer.emit('disconnected'); await h.advance(2000);
  assert.equal(peer.reconnects, 1); assert.equal(peer.destroyed, false); assert.equal(h.c.NET.mode, 'host');
});
test('quitting during a redial releases busy state and does not resume the old room', async () => {
  const h = setup(); await h.connect(); h.c.world.phase = 'live';
  const p = h.c.netRedial(); await h.advance(250); h.c.netShutdown(); await h.advance(50000);
  assert.equal(h.c.NET_RC.busy, false); assert.equal(h.c.NET.mode, 'solo'); assert.equal(h.c.NET_REDIALS || 0, 0); await p;
});
test('join timeout destroys the failed peer and ignores a late open', async () => {
  const h = setup(); let result; const p = h.c.netJoin('ABC123', 1000).catch((e) => result = e);
  const peer = h.peers[0]; await h.advance(1001); await p;
  assert.match(result.message, /방을 찾지 못했습니다/); assert.equal(peer.destroyed, true); assert.equal(h.c.NET.peer, null);
  peer.emit('open', peer.id); assert.equal(h.c.NET.up, null);
});
test('host shutdown rejects a pending creation and ignores old incoming channels', async () => {
  const h = setup(); let rejected = false; const p = h.c.netHost('ABC123').catch(() => rejected = true);
  const old = h.peers[0]; h.c.netShutdown(); await p; assert.equal(rejected, true);
  const channel = new h.Channel('late', 'event'); old.emit('connection', channel); channel.ready();
  assert.equal(h.c.NET.conns.size, 0); assert.equal(h.c.NET.mode, 'solo');
});
test('state-only loss routes both host snapshots and guest input to the reliable link', async () => {
  const h = setup(), guest = await h.connect(), event = guest.channels[1]; guest.channels[0].close();
  h.c.sendInput({ t: 'in', seq: 1 }); assert.equal(event.sent.at(-1).seq, 1); assert.equal(h.left.length, 0);
  h.c.NET.mode = 'host'; h.c.NET.conns.set('remote', { event }); h.c.sendSnapshot({ t: 's', rd: 2 }); assert.equal(event.sent.at(-1).rd, 2);
});
test('signaling retries stop when the transport is retired', async () => {
  const h = setup(), p = h.c.netHost('ABC123'), peer = h.peers[0]; peer.emit('open', peer.id); await p;
  peer.disconnected = true; peer.emit('disconnected'); h.c.netShutdown(); await h.advance(20000);
  assert.equal(peer.reconnects, 0); assert.equal(h.c.NET.mode, 'solo');
});
test('lobby seat survives one full reconnect attempt and expires once', async () => {
  const h = setup(), c = h.c; let expired = 0;
  // Reload the lobby wrapper over a recording base callback to observe its timeout.
  c.NET.onPeerGone = () => expired++; vm.runInContext(fallback, c);
  c.NET.mode = 'host'; c.NET.room = 'ABC123'; c.NET.peer = {}; c.room.members.set('lost', { team: 'atk', slot: 0 });
  c.NET.onPeerGone('lost'); await h.advance(45000); assert.equal(expired, 0);
  await h.advance(15001); assert.equal(expired, 1);
});
test('leaving a room cancels retained lobby seats from that room', async () => {
  const h = setup(), c = h.c; let expired = 0; c.NET.onPeerGone = () => expired++; vm.runInContext(fallback, c);
  c.NET.mode = 'host'; c.NET.room = 'ABC123'; c.NET.peer = { destroy() {} }; c.room.members.set('lost', { team: 'atk', slot: 0 });
  c.NET.onPeerGone('lost'); c.netShutdown(); c.NET.room = 'DEF456'; c.NET.mode = 'host'; c.NET.peer = {};
  await h.advance(65000); assert.equal(expired, 0);
});

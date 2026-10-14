// Deterministic PeerJS-shaped test transport. It does NOT exercise WebRTC/ICE/TURN.
// Real game callbacks run in two browser contexts; this relay only delivers channel events.
async function installTransport(pages) {
  const peers = new Map(), links = new Map(), errors = [], held = new Set();
  let stopped = false;
  const deliver = (page, message) => page.evaluate((m) => window.NET_TEST.receive(m), message).catch((e) => { if (!stopped) errors.push(e.message); });
  async function addPage(page) {
    await page.exposeBinding('__networkTestSend', ({ page: sender }, m) => {
      if (m.t === 'register') {
        peers.set(m.peer, sender); return deliver(sender, { t: 'open-peer', peer: m.peer });
      }
      if (m.t === 'connect') {
        const remote = peers.get(m.remote);
        if (!remote) return deliver(sender, { t: 'error-peer', peer: m.peer, type: 'peer-unavailable' });
        links.set(m.id, { left: sender, right: remote, label: m.label });
        return deliver(remote, { t: 'incoming', id: m.id, peer: m.remote, remote: m.peer, label: m.label }).then(() => deliver(sender, { t: 'open-channel', id: m.id }));
      }
      if (m.t === 'destroy') { if (peers.get(m.peer) === sender) peers.delete(m.peer); return; }
      const link = links.get(m.id);
      if (!link) return;
      const target = link.left === sender ? link.right : link.left;
      if (m.t === 'close') { links.delete(m.id); return deliver(target, m); }
      if (m.t === 'data' && !held.has(link.label)) return deliver(target, m);
    });
    await page.evaluate(() => {
      const peers = new Map(), channels = new Map();
      class Emitter {
        constructor() { this.listeners = new Map(); }
        on(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(fn); return this; }
        emit(name, value) { for (const fn of this.listeners.get(name) || []) fn(value); }
      }
      const send = (message) => window.__networkTestSend(message);
      class Channel extends Emitter {
        constructor(owner, remote, label, id = crypto.randomUUID()) { super(); this.owner = owner; this.peer = remote; this.label = label; this.id = id; this.open = false; this.closed = false; channels.set(id, this); owner.channels.add(this); }
        ready() { if (!this.closed) { this.open = true; this.emit('open'); } }
        send(data) { if (this.open) send({ t: 'data', id: this.id, data }); }
        close(local = true) { if (this.closed) return; this.closed = true; this.open = false; this.emit('close'); channels.delete(this.id); if (local) send({ t: 'close', id: this.id }); }
      }
      class Peer extends Emitter {
        constructor(id) { super(); this.id = id || crypto.randomUUID(); this.channels = new Set(); this.destroyed = false; this.disconnected = false; peers.set(this.id, this); send({ t: 'register', peer: this.id }); }
        connect(remote, options) { const c = new Channel(this, remote, options.label); send({ t: 'connect', peer: this.id, remote, label: options.label, id: c.id }); return c; }
        destroy() { if (this.destroyed) return; this.destroyed = true; for (const c of this.channels) c.close(); peers.delete(this.id); send({ t: 'destroy', peer: this.id }); this.emit('close'); }
        reconnect() { if (this.destroyed) throw Error('Destroyed peer'); this.disconnected = false; send({ t: 'register', peer: this.id }); }
      }
      window.Peer = Peer;
      window.NET_TEST = { receive(m) {
        const peer = peers.get(m.peer), channel = channels.get(m.id);
        if (m.t === 'open-peer') peer && !peer.destroyed && peer.emit('open', peer.id);
        else if (m.t === 'error-peer') peer && peer.emit('error', { type: m.type });
        else if (m.t === 'incoming' && peer && !peer.destroyed) { const c = new Channel(peer, m.remote, m.label, m.id); peer.emit('connection', c); c.ready(); }
        else if (m.t === 'open-channel') channel && channel.ready();
        else if (m.t === 'data') channel && channel.open && channel.emit('data', m.data);
        else if (m.t === 'close') channel && channel.close(false);
      } };
    });
  }
  for (const page of pages) await addPage(page);
  return { errors, addPage, hold: (label) => held.add(label), resume: (label) => held.delete(label), stop: () => { stopped = true; } };
}
module.exports = { installTransport };

const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const source = fs.readFileSync('js/legacy/03-engine.js', 'utf8');
const enter = source.slice(source.indexOf('function clientEnterMatch(e) {'), source.indexOf('function clearActors()', source.indexOf('function clientEnterMatch(e) {')));
function setup(existing = false) {
  const begun = [], snapshots = [], actor = { id: 4, ctrl: 'me' };
  const c = { room: { map: existing ? 'pogu' : 'glacier', started: existing }, world: { phase: existing ? 'live' : 'menu', actors: existing ? [actor] : [] }, CUR_MAP_KEY: existing ? 'pogu' : 'glacier', myActor: () => existing ? actor : null,
    clientBeginMatch: (m) => begun.push(m), NET: { onSnapshot: (s) => snapshots.push(s) }, banner() {} };
  vm.createContext(c); vm.runInContext(enter, c);
  return { c, begun, snapshots };
}
test('joining an active match initializes its map and actor manifest before applying current state', () => {
  const h = setup(), event = { started: true, actorId: 4, map: 'pogu', actors: [{ id: 4, ctrl: 'guest', agent: 'agent' }], snapshot: { t: 's', rd: 3, ph: 'live' } };
  h.c.clientEnterMatch(event); assert.equal(h.begun.length, 1); assert.equal(h.begun[0], event); assert.equal(h.snapshots[0], event.snapshot); assert.equal(h.c.room.started, true);
});
test('same-actor recovery applies current state without restarting the round', () => {
  const h = setup(true), event = { started: true, actorId: 4, map: 'pogu', actors: [{ id: 4 }], snapshot: { t: 's', rd: 3, ph: 'live' } };
  h.c.clientEnterMatch(event); assert.equal(h.begun.length, 0); assert.equal(h.snapshots[0], event.snapshot);
});

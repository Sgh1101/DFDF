const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const source = fs.readFileSync('js/legacy/44-account-sync.js', 'utf8');
const heartbeat = source.slice(source.indexOf('  async function beat()'), source.indexOf('\n  setInterval(() => {\n    (hb', source.indexOf('  async function beat()')));
test('late room heartbeat cannot run old-room commands in a new room or account', async () => {
  for (const change of ['room', 'transport', 'account']) {
    let resolve, session = 'old', commands = 0;
    const c = { online: true, NET: { mode: 'host', room: 'ABC123', status: 'open', peer: {} }, token: () => session, sessionMatches: (t) => t === session,
      room: { members: new Map(), mode: 'std', map: 'pogu', started: false }, META: {}, window: {}, L: (ko) => ko, myName: () => 'host', reported: null,
      api: () => new Promise((r) => resolve = r), applyCfg: () => commands++, runCmd: () => commands++, kick: () => commands++, memberByName: () => 'peer' };
    vm.createContext(c); vm.runInContext(heartbeat, c); const p = c.beat();
    if (change === 'room') c.NET.room = 'DEF456';
    if (change === 'transport') c.NET.peer = {};
    if (change === 'account') session = 'new';
    resolve({ config: {}, cmds: [{ cmd: 'close' }], banned: ['player'] }); await p;
    assert.equal(commands, 0, change); assert.equal(c.reported, null, change);
  }
});
test('current room heartbeat applies its response and records the requested room', async () => {
  let commands = 0;
  const c = { online: true, NET: { mode: 'host', room: 'ABC123', status: 'open', peer: {} }, token: () => 'session', sessionMatches: () => true,
    room: { members: new Map(), mode: 'std', map: 'pogu', started: false }, META: {}, window: {}, L: (ko) => ko, myName: () => 'host', reported: null,
    api: async () => ({ cmds: [{ cmd: 'msg' }] }), runCmd: () => commands++, applyCfg() {}, kick() {}, memberByName() {} };
  vm.createContext(c); vm.runInContext(heartbeat, c); await c.beat();
  assert.equal(commands, 1); assert.equal(c.reported, 'ABC123');
});

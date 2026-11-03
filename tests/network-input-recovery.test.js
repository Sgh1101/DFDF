const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const GAME_RULES = require('../js/game-rules');
const source = fs.readFileSync('js/legacy/03-engine.js', 'utf8');
const stepSource = source.slice(source.indexOf('const SNAP_HZ ='), source.indexOf('const _v3tmp ='));
const queueStart = source.indexOf('function netInputFrames(');
const queueSource = source.slice(queueStart >= 0 ? queueStart : source.indexOf('function netQueueInput('), source.indexOf('((NET.onInput ='));
const receiveSource = source.slice(source.indexOf('(NET.onInput = (e, t) => {'), source.indexOf('  (NET.onAction = (e, t) => {')).trim().replace(/,$/, ';');

function setup(mode) {
  let now = 1000;
  const actor = { id: 2, ctrl: mode === 'client' ? 'me' : 'guest', alive: true, pos: { x: 0, z: 0 }, y: 0, yaw: 0, pitch: 0, input: { seq: 0, mv: [0, 0], btn: 0 } };
  const sent = [];
  const c = { NET: { mode, peer: {} }, world: { actors: [actor], round: 1 }, GAME_RULES, performance: { now: () => now },
    camera: { updateMatrixWorld() {} }, updateFrustum() {}, syncActorModel() {}, interpRemote() {}, followCamera() {},
    gatherInput: () => ({ mv: [1, 0], yaw: 0, pitch: 0, btn: 0 }),
    sendInput: m => sent.push(JSON.parse(JSON.stringify(m))),
    simMove: (a, dt) => { a.pos.x += a.input.mv[0] * 10 * dt; a.pos.z += a.input.mv[1] * 10 * dt; },
  };
  vm.createContext(c);
  vm.runInContext(stepSource + queueSource + receiveSource, c);
  return { c, actor, sent, frame(dt = 1 / 60) { now += dt * 1000; c.netStep(dt); },
    receive(m) { c.NET.onInput('guest', m); },
    flush() { actor._bank = 0.5; actor._bankT = now; c.guestMoves(actor, 1 / 60); },
  };
}

function run(delivery) {
  const guest = setup('client'), host = setup('host');
  for (let i = 0; i < 6; i++) guest.frame();
  for (const index of delivery) { host.receive(guest.sent[index]); host.flush(); }
  return { guest, host };
}

test('reordered inputs preserve the movement the participant predicted', () => {
  const { guest, host } = run([1, 0, 3, 2, 5, 4]);
  assert.ok(Math.abs(host.actor.pos.x - guest.actor.pos.x) < 1e-9,
    `host moved ${host.actor.pos.x}, participant predicted ${guest.actor.pos.x}`);
  assert.equal(host.actor.simSeq, guest.sent.at(-1).seq);
});

test('the next input recovers two missing packets without moving twice when they arrive later', () => {
  const { guest, host } = run([2, 5, 0, 1, 3, 4, 5]);
  assert.ok(Math.abs(host.actor.pos.x - guest.actor.pos.x) < 1e-9,
    `host moved ${host.actor.pos.x}, participant predicted ${guest.actor.pos.x}`);
});

test('recovery preserves direction changes instead of repeating the newest direction', () => {
  const guest = setup('client'), host = setup('host');
  for (let i = 0; i < 6; i++) {
    guest.c.gatherInput = () => ({ mv: [i % 2 ? -1 : 1, 0], btn: 0, yaw: 0, pitch: 0 });
    guest.frame();
  }
  for (const i of [2, 5]) { host.receive(guest.sent[i]); host.flush(); }
  assert.ok(Math.abs(host.actor.pos.x) < 1e-9, `alternating directions should cancel, got ${host.actor.pos.x}`);
});

test('high refresh-rate input retains every original movement substep during recovery', () => {
  const guest = setup('client'), host = setup('host');
  for (let i = 0; i < 12; i++) guest.frame(1 / 120);
  for (const i of [2, 5]) { host.receive(guest.sent[i]); host.flush(); }
  assert.ok(Math.abs(host.actor.pos.x - guest.actor.pos.x) < 1e-9);
});

test('a new round cannot replay movement from the previous round', () => {
  const guest = setup('client');
  for (let i = 0; i < 4; i++) guest.frame();
  guest.c.world.round++;
  guest.frame();
  const host = setup('host');
  host.receive(guest.sent.at(-1)); host.flush();
  assert.ok(Math.abs(host.actor.pos.x - 0.167) < 1e-9);
});

test('changing bodies never replays movement from the old body', () => {
  const guest = setup('client');
  for (let i = 0; i < 4; i++) guest.frame();
  guest.c.world.actors = [{ ...guest.actor, id: 9, pos: { x: 0, z: 0 } }];
  guest.frame();
  const host = setup('host');
  host.receive(guest.sent.at(-1)); host.flush();
  assert.ok(Math.abs(host.actor.pos.x - 0.167) < 1e-9);
});

test('a replacement connection does not send input history from the old connection', () => {
  const guest = setup('client');
  for (let i = 0; i < 4; i++) guest.frame();
  guest.c.NET.peer = {};
  guest.frame();
  const host = setup('host');
  host.receive(guest.sent.at(-1)); host.flush();
  assert.ok(Math.abs(host.actor.pos.x - 0.167) < 1e-9);
});

test('a partial input from the old round is not charged to the new round', () => {
  const guest = setup('client');
  guest.frame(); guest.frame(1 / 120);
  guest.c.world.round++;
  guest.frame();
  const host = setup('host');
  host.receive(guest.sent.at(-1)); host.flush();
  assert.ok(Math.abs(host.actor.pos.x - 0.167) < 1e-9, `moved ${host.actor.pos.x} metres in the first new frame`);
});

test('an old client without recovery history still moves once per input', () => {
  const host = setup('host');
  host.receive({ t: 'in', seq: 1, dt: 167, mv: [1, 0], btn: 0, yaw: 0, pitch: 0 });
  host.flush();
  assert.ok(Math.abs(host.actor.pos.x - 0.167) < 1e-9);
});

test('switching from legacy timing cannot replay commands already accepted by the host', () => {
  const host = setup('host');
  const command = { dt: 167, mv: [1, 0], btn: 0, yaw: 0, pitch: 0 };
  host.receive({ ...command, seq: 1 }); host.flush();
  host.receive({ ...command, seq: 2, dt: undefined });
  host.receive({ ...command, seq: 3, prev: [{ ...command, seq: 1 }, { ...command, seq: 2 }] }); host.flush();
  assert.ok(Math.abs(host.actor.pos.x - 0.334) < 1e-9, `old movement was replayed: ${host.actor.pos.x}`);
});

test('recovered commands must pass the same movement validation as a live input', () => {
  const host = setup('host');
  const command = { seq: 4, dt: 167, mv: [1, 0], btn: 0, yaw: 0, pitch: 0 };
  host.receive({ ...command, prev: [
    { ...command, seq: 1, mv: [Infinity, 0] },
    { ...command, seq: 2, dt: 5000 },
    { ...command, seq: 3, btn: 100000 },
  ] });
  host.flush();
  assert.ok(Math.abs(host.actor.pos.x - 0.167) < 1e-9);
  assert.equal(host.actor.simSeq, 4);
});

test('repeating commands never bypasses the host movement time budget', () => {
  const guest = setup('client'), host = setup('host');
  for (let i = 0; i < 120; i++) guest.frame();
  for (const m of guest.sent) host.receive(m);
  host.flush();
  assert.ok(host.actor.pos.x <= 5, `moved ${host.actor.pos.x} metres with half a second available`);
  assert.ok(host.actor.simSeq < guest.sent.at(-1).seq, 'the remaining input must wait for host time');
});

const test = require("node:test"), assert = require("node:assert/strict");
const RV = require("../js/ragdoll-verlet");

// The Verlet skeleton of the falling bodies (js/ragdoll-verlet.js): links hold, it settles on a floor, then freezes and stops costing.
const flat = (extra) => ({ ground: () => 0, ...extra });
const make = (opt, scale = 1.1) => {
  const pts = RV.stand(0, 0, 0, scale);
  return { pts, body: RV.create(pts, RV.LINKS, flat(opt)) };
};
const P = (b, name) => { const i = RV.IDX[name]; return [b.P[3 * i], b.P[3 * i + 1], b.P[3 * i + 2]]; };
const dist = (b, a, c) => Math.hypot(...P(b, a).map((v, i) => v - P(b, c)[i]));
const run = (b, seconds) => { for (let t = 0; t < seconds && !b.frozen; t += 1 / 60) b.step(1 / 60); };

test("the skeleton has the joints and links the rig needs, all by name", () => {
  assert.equal(RV.NAMES.length, 16);
  for (const l of RV.LINKS) { assert.ok(RV.IDX[l[0]] >= 0 && RV.IDX[l[1]] >= 0, l.join()); assert.notEqual(l[0], l[1]); }
  const { body } = make();
  assert.equal(body.lengths.length, RV.LINKS.length);
  assert.ok(body.lengths.every((v) => v > 0.05), "no zero-length link");
});

test("a bone link keeps its length while the body falls, rolls and lies down", () => {
  const { body } = make();
  const bones = RV.LINKS.map((l, i) => [i, l]).filter(([i, l]) => !l[2]);
  const rest = bones.map(([i]) => body.lengths[i]);
  body.kick(-1, 2.2, 1.5, -3.5);
  body.kick(RV.IDX.head, 1, 1, -2);
  let worst = 0;
  for (let t = 0; t < 4 && !body.frozen; t += 1 / 60) {
    body.step(1 / 60);
    bones.forEach(([i, l], k) => { const d = dist(body, l[0], l[1]); worst = Math.max(worst, Math.abs(d - rest[k]) / rest[k]); });
  }
  assert.ok(worst < 0.08, "no bone stretched or shrank by more than 8%: worst " + worst.toFixed(3));
});

test("it never sinks into the floor, and ends lying down: the head near the ground", () => {
  const { body } = make();
  body.kick(-1, 0, 1, -4);
  run(body, 8);
  for (let i = 0; i < body.n; i++) assert.ok(body.P[3 * i + 1] >= body.R[i] - 1e-6, RV.NAMES[i] + " is above the floor");
  assert.ok(body.frozen, "frozen within the time");
  const head = P(body, "head")[1], hip = P(body, "hip")[1];
  assert.ok(head < 0.5, "the head is near the ground: " + head.toFixed(2));
  assert.ok(hip < 0.4, "the pelvis is low: " + hip.toFixed(2));
});

test("it settles by itself and then freezes: no work at all after that", () => {
  let calls = 0;
  const { body } = make({ ground: () => { calls++; return 0; } });
  body.kick(-1, 1, 0, -2);
  run(body, 9);
  assert.ok(body.frozen, "frozen");
  assert.ok(body.t < 7, "it was the speed that froze it, not the time limit: " + body.t.toFixed(2));
  const before = calls, p0 = Array.from(body.P);
  for (let i = 0; i < 100; i++) assert.equal(body.step(1 / 30), 0);
  assert.equal(calls, before, "a frozen body asks the world nothing");
  assert.deepEqual(Array.from(body.P), p0, "and does not move");
});

test("a body that never stops is frozen at the time limit", () => {
  const { body } = make({ maxTime: 1.2, settle: 0 });
  body.kick(-1, 5, 5, 5);
  run(body, 3);
  assert.ok(body.frozen);
  assert.ok(body.t <= 1.2 + 1 / 30, "stopped at about 1.2 s: " + body.t);
});

test("the shot's direction decides which way it lies, and a bigger push goes further", () => {
  const lie = (vx, vz, y = 0) => { const { body } = make(); body.kick(-1, vx, y, vz); body.kick(RV.IDX.chest, vx, 0, vz); run(body, 8); return P(body, "hip"); };
  const east = lie(3, 0), north = lie(0, -3), weak = lie(1.5, 0), blast = lie(9, 0, 5);
  assert.ok(east[0] > 0.5 && Math.abs(east[2]) < 1, "pushed east it ends east: " + east);
  assert.ok(north[2] < -0.5 && Math.abs(north[0]) < 1, "pushed north it ends north: " + north);
  assert.ok(east[0] > weak[0], "a harder push goes further");
  assert.ok(blast[0] > 2 * east[0], "an explosion sends it far: " + blast[0].toFixed(2) + " vs " + east[0].toFixed(2));
});

test("a wall stops the sideways move, and a step in the floor is stood on", () => {
  // a wall at x = 1; a ledge 0.5 high for x > 3
  const opt = { blocked: (x, z, y) => x > 1 && x < 1.3 && y < 2.5, ground: (x) => (x > 3 ? 0.5 : 0) };
  const { body } = make(opt);
  body.kick(-1, 8, 1, 0);
  run(body, 8);
  for (let i = 0; i < body.n; i++) assert.ok(body.P[3 * i] < 1.3 + 0.01 && (body.P[3 * i] <= 1.001 + body.R[i] || body.P[3 * i] >= 1.3), RV.NAMES[i] + " did not pass through the wall: x " + body.P[3 * i].toFixed(2));
  const { body: b2 } = make({ ground: (x) => (x > 1 ? 0.5 : 0) });
  b2.kick(-1, 3, 0, 0);
  run(b2, 8);
  assert.ok(P(b2, "ftL")[0] > 1 ? P(b2, "ftL")[1] >= 0.5 + b2.R[RV.IDX.ftL] - 1e-6 : true, "feet on the ledge rest on it");
});

test("the map bounds hold a body in", () => {
  const { body } = make({ bounds: { minX: -1, maxX: 1.5, minZ: -1, maxZ: 1 } });
  body.kick(-1, 20, 0, 0);
  run(body, 8);
  for (let i = 0; i < body.n; i++) assert.ok(body.P[3 * i] <= 1.5 + 1e-6, RV.NAMES[i]);
});

test("the corpse cap drops the oldest first", () => {
  assert.deepEqual(RV.overflow([1, 2, 3, 4, 5], 3), [1, 2]);
  assert.deepEqual(RV.overflow([1, 2], 3), []);
  assert.deepEqual(RV.overflow([1, 2, 3], 0), [1, 2, 3]);
});

test("settleNow runs the whole fall at once (a canned death), and nine bodies settle cheaply", () => {
  const { body } = make();
  body.kick(-1, 2, 0, -3);
  body.settleNow();
  assert.ok(body.frozen);
  const t0 = process.hrtime.bigint();
  for (let k = 0; k < 9; k++) { const { body: b } = make(); b.kick(-1, 2, 0, -3); run(b, 8); }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 400, "nine whole falls took " + ms.toFixed(1) + " ms");
});

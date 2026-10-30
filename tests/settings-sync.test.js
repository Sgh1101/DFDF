const test = require("node:test");
const assert = require("node:assert/strict");
const { harness } = require("./api-harness");
const SS = require("../js/settings-sync.js");
const login = (h, id = "player") => h.api("auth", { id, pw: id === "owner" ? "owner-password" : "password", device: "device-123" });
const put = (h, p, o) => h.api("prefs", { token: p.token, set: { opts: o } });

// The settings the account keeps (prefs.o): what the server takes, clamps and drops; the newer time wins one setting at a time.
test("settings are kept, clamped to their sliders and read back from another sign-in", async () => {
  const h = harness(), p = await login(h);
  const r = await put(h, p, { sens: [9, 100], adsSens: [0.01, 100], touchSens: [1.5, 100], volMaster: [0.5, 100], volFx: [3, 100], volSteps: [-2, 100], motion: [2.5, 100], colorblind: ["rg", 100], qualityPc: ["visual", 100], shake: [false, 100] });
  assert.equal(r.status, 200);
  assert.deepEqual(r.prefs.o, { sens: [3, 100], adsSens: [0.2, 100], touchSens: [1.5, 100], volMaster: [0.5, 100], volFx: [1, 100], volSteps: [0, 100], motion: [2, 100], colorblind: ["rg", 100], qualityPc: ["visual", 100], shake: [false, 100] });
  const p2 = await login(h);
  assert.deepEqual((await h.api("prefs", { token: p2.token })).prefs.o.sens, [3, 100], "a second sign-in of the account reads it");
});

test("only known settings with the right kind of value are kept", async () => {
  const h = harness(), p = await login(h);
  const r = await put(h, p, { sens: ["fast", 5], volFx: [null, 5], shake: ["yes", 5], colorblind: ["purple", 5], qualityPc: ["ultra-max", 5], qualityMobile: [3, 5], bogus: [1, 5], __proto__: [1, 5], admin: [true, 5], sfx: [true, "x"], dmgNums: [true], ultCut: [true, -4], slowMo: [true, 5, 6] });
  assert.equal(r.prefs, null, "nothing valid: nothing is stored");
  assert.equal((await h.api("prefs", { token: p.token, set: { opts: "x" } })).status, 200);
  assert.equal((await h.api("prefs", { token: p.token, set: { opts: [1, 2] } })).status, 200);
  assert.deepEqual(h.user("player").prefs && h.user("player").prefs.o || {}, {});
});

test("key bindings: known actions, real key codes, a key on one action, two keys at most", async () => {
  const h = harness(), p = await login(h);
  const r = await put(h, p, { binds: [{ jump: ["KeyJ", "KeyK", "KeyL"], reload: ["KeyJ"], ping: ["KeyP"], quickchat: ["KeyO"], hack: ["KeyH"], use: ["F5", "Escape", "<script>", "KeyU"], shop: "KeyB", map: [1, null, "Digit9"] }, 7] });
  assert.deepEqual(r.prefs.o.binds[0], { jump: ["KeyJ", "KeyK"], ping: ["KeyP"], quickchat: ["KeyO"], use: ["KeyU"], map: ["Digit9"] });
  assert.equal((await put(h, p, { binds: ["no", 8] })).prefs.o.binds[1], 7, "not an object: the old one stays");
});

test("the crosshair is checked field by field", async () => {
  const h = harness(), p = await login(h);
  const r = await put(h, p, { xhair: [{ style: "laser", color: "red", len: 99, thick: 0, gap: -3, alpha: 7, dot: "yes", outline: false, evil: 1 }, 5] });
  assert.deepEqual(r.prefs.o.xhair, [{ style: "cross", color: "#ffffff", len: 14, thick: 1, gap: 0, alpha: 1, dot: false, outline: false, dyn: true }, 5]);
  const g = await put(h, p, { xhair: [{ style: "circle", color: "#FFAA00", len: 6.4, thick: 3, gap: 4, alpha: 0.5, dot: true, outline: true, dyn: false }, 9] });
  assert.deepEqual(g.prefs.o.xhair, [{ style: "circle", color: "#ffaa00", len: 6, thick: 3, gap: 4, alpha: 0.5, dot: true, outline: true, dyn: false }, 9]);
});

test("the newer time wins, one setting at a time; an older or equal one changes nothing", async () => {
  const h = harness(), p = await login(h);
  await put(h, p, { sens: [1.5, 2000], volFx: [0.5, 2000] });
  const r = await put(h, p, { sens: [2, 1000], volFx: [0.2, 3000], volMaster: [0.3, 500], colorblind: ["by", 2000] });
  assert.deepEqual(r.prefs.o.sens, [1.5, 2000], "older: kept");
  assert.deepEqual(r.prefs.o.volFx, [0.2, 3000], "newer: taken");
  assert.deepEqual(r.prefs.o.volMaster, [0.3, 500], "a setting the account did not have: taken at any time");
  const q = await put(h, p, { sens: [2.5, 2000] });
  assert.deepEqual(q.prefs.o.sens, [1.5, 2000], "an equal time keeps the stored one");
});

test("a time from the future is held to a minute ahead", async () => {
  const h = harness(), p = await login(h);
  const r = await put(h, p, { sens: [1.2, 9e15] });
  assert.equal(r.prefs.o.sens[1], h.now() + 6e4);
  assert.equal((await put(h, p, { sens: [2, h.now() + 120e3] })).prefs.o.sens[0], 1.2, "an equal clamped time keeps the stored one");
  h.advance(61e3);
  assert.equal((await put(h, p, { sens: [2, h.now()] })).prefs.o.sens[0], 2, "and a real change a minute later wins");
});

test("the touch layout and the settings do not touch each other", async () => {
  const h = harness(), p = await login(h);
  await h.api("prefs", { token: p.token, set: { touch: { "tb-fire": [0.8, 0.5, 1] } }, t: 2000 });
  await put(h, p, { sens: [1.5, 100] });
  const a = (await h.api("prefs", { token: p.token })).prefs;
  assert.deepEqual(a.touch["tb-fire"], [0.8, 0.5, 1]); assert.equal(a.t, 2000); assert.deepEqual(a.o.sens, [1.5, 100]);
  await h.api("prefs", { token: p.token, set: { touch: { "tb-fire": [0.1, 0.5, 1] } }, t: 3000 });
  const b = (await h.api("prefs", { token: p.token })).prefs;
  assert.equal(b.t, 3000); assert.deepEqual(b.o.sens, [1.5, 100], "a new layout leaves the settings");
});

test("a guest keeps settings too, and a request without a sign-in is refused", async () => {
  const h = harness(), g = await h.api("guest", { device: "guest-device-9" });
  assert.deepEqual((await put(h, g, { sens: [1.4, 10] })).prefs.o.sens, [1.4, 10]);
  assert.equal((await h.api("prefs", { token: "nope", set: { opts: { sens: [1, 1] } } })).status, 401);
});

test("the shared checks the game itself uses agree with the server (same module)", () => {
  assert.equal(SS.clean("sens", 99), 3); assert.equal(SS.clean("sens", NaN), undefined); assert.equal(SS.clean("nope", 1), undefined);
  assert.deepEqual(SS.cleanMap({ sens: [1, 5], nope: [1, 1] }, 1000), { sens: [1, 5] });
  const s = { sens: [1, 5] }; assert.equal(SS.merge(s, { sens: [2, 4] }), false); assert.equal(SS.merge(s, { sens: [2, 6] }), true); assert.deepEqual(s.sens, [2, 6]);
  assert.ok(SS.KEYS.includes("binds") && SS.KEYS.includes("colorblind") && SS.KEYS.includes("xhair"));
  for (const device of ["touch", "dynRes", "showFps", "haptic"]) assert.ok(!SS.KEYS.includes(device), device + " belongs to the device");
});

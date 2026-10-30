const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const engine = fs.readFileSync("js/legacy/03-engine.js", "utf8"), gun = fs.readFileSync("js/legacy/18-gun-effects.js", "utf8");
const C = require("../js/graphics-settings");
// The engine's own effect list, pool, glow shelf and updateFx, run against a stand-in for three.js
function fixture() {
  class Color { constructor() { this.v = 0; } setHex(v) { this.v = v; return this; } set(v) { v === undefined || (this.v = v); return this; } multiplyScalar(k) { this.k = k; return this; } }
  class Obj { constructor() { this.userData = {}; this.position = { set() {} }; this.parent = null; } }
  const made = { sprites: 0, materials: 0, disposed: 0 };
  class SpriteMaterial { constructor() { made.materials++; this.color = new Color(); this.userData = {}; this.opacity = 1; } dispose() { made.disposed++; } }
  class Sprite extends Obj { constructor(m) { super(); made.sprites++; this.material = m; this.scale = { setScalar: (s) => (this.s = s) }; this.isSprite = true; } traverse(f) { f(this); } }
  const scene = { added: 0, removed: 0, add(o) { this.added++; o.parent = this; }, remove(o) { this.removed++; o.parent = null; } };
  const ctx = { T: { Sprite, SpriteMaterial, AdditiveBlending: 2 }, scene, glowTex: () => "tex", tickFxLights() {}, made };
  vm.createContext(ctx);
  vm.runInContext(engine.slice(engine.indexOf("const fx = [];"), engine.indexOf("const FXG = (")) + engine.slice(engine.indexOf("const GLOW_FREE = [];"), engine.indexOf("function glowFlare(")) + engine.slice(engine.indexOf("function updateFx("), engine.indexOf("const POST = {")) + ";this.fx = fx;this.addFx = addFx;this.fxPool = fxPool;this.updateFx = updateFx;this.glowDot = glowDot;this.GLOW_FREE = GLOW_FREE;", ctx);
  return ctx;
}
const part = () => ({ userData: {}, material: { userData: {} }, geometry: { userData: {} } });

test("a pool never grows past its size and hands out the one used longest ago", () => {
  const c = fixture(), pool = c.fxPool(8, part);
  const first = Array.from({ length: 8 }, () => pool.get());
  assert.equal(new Set(first).size, 8);
  for (let i = 0; i < 200; i++) assert.equal(pool.get(), first[i % 8], "the oldest comes round again");
  assert.equal(pool.items.length, 8);
  assert.ok(first.every((o) => o.userData.keep && o.userData.pool && o.material.userData.keep && o.geometry.userData.shared), "never disposed by updateFx");
});
test("a pooled object taken over while it is still playing keeps one entry; its end puts it back without disposing anything", () => {
  const c = fixture(), pool = c.fxPool(1, part), o = pool.get();
  let disposed = 0; o.material.dispose = () => disposed++; o.geometry.dispose = () => disposed++; o.traverse = (f) => f(o);
  c.addFx(o, 0.1, () => {});
  const again = pool.get(); assert.equal(again, o);
  let ran = 0; c.addFx(again, 0.1, () => ran++);
  assert.equal(c.fx.length, 1, "no second entry for the same object");
  c.updateFx(0.05); assert.equal(ran, 1, "the newer play runs");
  c.updateFx(0.06);
  assert.equal(c.fx.length, 0); assert.equal(o.parent, null); assert.equal(o.userData.fxEntry, null); assert.equal(disposed, 0);
  c.addFx(o, 0.1, () => ran++); assert.equal(c.fx.length, 1, "and it plays again");
});
test("other effects are still disposed when they end, as before", () => {
  const c = fixture(); let disposed = 0;
  const o = { userData: {}, material: { userData: {}, dispose: () => disposed++ }, geometry: { userData: {}, dispose: () => disposed++ }, traverse(f) { f(this); } };
  c.addFx(o, 0.1, () => {}); c.updateFx(0.2);
  assert.equal(disposed, 2); assert.equal(c.fx.length, 0);
});
test("glow sprites go back on a shelf and come out again with their colour; no new material per spark", () => {
  const c = fixture(), a = c.glowDot(0xff0000, 0.5, 2);
  c.addFx(a, 0.1, () => {}); c.updateFx(0.2);
  assert.equal(c.GLOW_FREE.length, 1);
  const b = c.glowDot(0x00ff00, 0.25, 1.5);
  assert.equal(b, a, "the same sprite and material"); assert.equal(b.material.color.v, 0x00ff00); assert.equal(b.material.color.k, 1.5); assert.equal(b.s, 0.25);
  assert.equal(c.made.materials, 1); assert.equal(c.made.disposed, 0);
  for (let i = 0; i < 300; i++) { const s = c.glowDot(0xffffff, 1); c.addFx(s, 0.1, () => {}); c.updateFx(0.016); } // each lives for several frames
  assert.ok(c.made.materials < 20, "materials made for 300 sparks: " + c.made.materials);
  const kept = c.glowDot(0xffffff, 1); kept.material.userData.keep = !0; c.addFx(kept, 0.1, () => {}); c.updateFx(1);
  assert.ok(!c.GLOW_FREE.includes(kept), "a sprite whose material was marked keep is not taken back");
  for (let i = 0; i < 900; i++) c.addFx(c.glowDot(0xffffff, 1), 0.1, () => {});
  c.updateFx(1);
  assert.ok(c.GLOW_FREE.length <= 640, "the shelf is capped: " + c.GLOW_FREE.length);
});
test("the effects light pool is 1 on mobile, 2 on perf and visual, 4 on ultra, and every preset says so", () => {
  assert.deepEqual(C.order.map((k) => C.presets[k].fxLights), [1, 2, 2, 4]);
  const src = engine.slice(engine.indexOf("function fxLightPool("), engine.indexOf("function fxFlash("));
  for (const [q, n] of [["mobile", 1], ["perf", 2], ["visual", 2], ["ultra", 4]]) {
    const scene = { children: [], add(o) { o.parent = this; this.children.push(o); }, remove(o) { o.parent = null; this.children = this.children.filter((x) => x !== o); } };
    class PointLight { constructor() { this.userData = {}; } dispose() {} }
    const c = { T: { PointLight }, scene, GFX: { ...C.presets[q] }, FX_LIGHTS: [] };
    vm.createContext(c); vm.runInContext(src.replace("const FX_LIGHTS = [];", "") + ";this.fxLightPool = fxLightPool;", c);
    c.fxLightPool(); assert.equal(c.FX_LIGHTS.length, n, q); assert.equal(scene.children.length, n);
    c.fxLightPool(true); assert.equal(c.FX_LIGHTS.length, n, "a flash does not change the number of lights");
    c.GFX = { ...C.presets.ultra }; c.fxLightPool(true); assert.equal(c.FX_LIGHTS.length, n, "only a preset change (not a flash) resizes it");
    c.fxLightPool(); assert.equal(c.FX_LIGHTS.length, 4, q + " -> ultra"); assert.equal(scene.children.length, 4);
    c.GFX = { ...C.presets.mobile }; c.fxLightPool(); assert.equal(c.FX_LIGHTS.length, 1); assert.equal(scene.children.length, 1);
  }
});
test("the unused MZ_LIGHTS pool is gone and the per-shot effects do not build materials, geometry or lines themselves", () => {
  assert.ok(!/MZ_LIGHTS/.test(engine));
  for (const name of ["addTracer", "worldTracer", "worldMuzzleFlash", "bloodBurst"]) {
    const body = engine.slice(engine.indexOf("function " + name + "("), engine.indexOf("function " + name + "(") + 900).split(/\nfunction /)[0];
    assert.ok(!/new T\.(\w*Material|\w*Geometry|Line|Mesh|Group)\b/.test(body), name + " builds nothing per shot");
  }
  const play = engine.slice(engine.indexOf("case FX.SHOT:"), engine.indexOf("case FX.IMPACT:"));
  assert.ok(!/new T\.(\w*Material|\w*Geometry|Line)\b/.test(play), "a guest's tracer is pooled too");
});
test("another shooter's casings follow GFX.shells (off on mobile and perf); your own follow shellsOn()", () => {
  assert.equal(C.presets.perf.shells, false); assert.equal(C.presets.mobile.shells, false); assert.equal(C.presets.visual.shells, true);
  const wm = gun.slice(gun.indexOf("worldMuzzleFlash = function"), gun.indexOf("const _sr = startReload"));
  assert.ok(/GFX\.shells && Math\.random\(\) < 0\.85/.test(wm) && !/shellsOn\(\)/.test(wm), "third person");
  assert.ok(/shellsOn\(\) && "me" === a\.ctrl/.test(gun) && /ammoOf\(player, k\) < before && shellsOn\(\) && ejectMine\(k\)/.test(gun), "first person is unchanged");
});

const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const devices = fs.readFileSync("js/legacy/06-one-way-teleporters-switch-doors-ziplines.js", "utf8");
const cleanup = devices.slice(devices.indexOf("  function clear()"), devices.indexOf("  const mat ="));
const engine = fs.readFileSync("js/legacy/03-engine.js", "utf8");
const mapCleanup = engine.slice(engine.indexOf("function clearMapGeometry()"), engine.indexOf("function buildMapGeometry("));
function resource() { return { count: 0, dispose() { this.count++; } }; }
function node(children = [], geometry, material) {
  return { children, geometry, material, userData: {}, parent: null, traverse(visit) { visit(this); this.children.forEach((child) => child.traverse(visit)); }, removeFromParent() { if (this.parent) this.parent.remove(this); } };
}
function setup() {
  const sharedTexture = resource(), geometry = resource(), material = Object.assign(resource(), { map: sharedTexture }), unrelatedGeometry = resource(), unrelatedMaterial = resource();
  const root = node([node([], geometry, [material, material]), node([], geometry, material)]);
  const unrelated = node([], unrelatedGeometry, unrelatedMaterial); unrelated.userData.keep = true;
  const scene = { children: [root, unrelated], remove(object) { this.children = this.children.filter((item) => item !== object); object.parent = null; } };
  root.parent = unrelated.parent = scene;
  const G = { key: "pogu", meshes: [root, root], tp: [{}], door: [{}], zip: [{}] };
  const context = { G, _mapMeshes: [root, root.children[0]], window: { MAP_GIMMICKS: G }, scene, COLLIDERS: [{}], CHASH: { dirty: false }, floor: null, DECOR: undefined };
  vm.createContext(context); vm.runInContext(cleanup + mapCleanup, context);
  return { context, G, geometry, material, sharedTexture, unrelatedGeometry, unrelatedMaterial, root };
}
test("device cleanup releases owned child geometry and material once and preserves shared textures", () => {
  const f = setup(); f.G.clear(); f.G.clear();
  assert.equal(f.geometry.count, 1); assert.equal(f.material.count, 1); assert.equal(f.sharedTexture.count, 0);
  assert.equal(f.unrelatedGeometry.count, 0); assert.equal(f.unrelatedMaterial.count, 0);
  assert.equal(f.root.parent, null); assert.equal(f.context._mapMeshes.length, 0);
  for (const key of ["meshes", "tp", "door", "zip"]) assert.equal(f.G[key].length, 0);
  assert.equal(f.G.key, null);
});
test("actual map cleanup releases device children before the generic map pass without double disposal", () => {
  const f = setup(); f.context.clearMapGeometry(); f.context.clearMapGeometry();
  assert.equal(f.geometry.count, 1); assert.equal(f.material.count, 1);
  assert.equal(f.sharedTexture.count, 0); assert.equal(f.unrelatedGeometry.count, 0);
  assert.equal(f.context.COLLIDERS.length, 0); assert.equal(f.context.CHASH.dirty, true);
});


test("site markers release their own geometry and material while keeping the shared gradient texture", () => {
  const source = fs.readFileSync("js/legacy/13-plant-zones-made-visible-a-glowing-ring-and-light-curtain.js", "utf8");
  const clear = source.slice(source.indexOf("  function clearSites()"), source.indexOf("  function build()"));
  const geometry = resource(), texture = resource(), material = Object.assign(resource(), { map: texture });
  const group = node([node([], geometry, material)]), parent = { remove(object) { object.parent = null; } }; group.parent = parent;
  const context = { FX: { list: [{ group }, { group }] } };
  vm.createContext(context); vm.runInContext(clear, context); context.clearSites(); context.clearSites();
  assert.equal(geometry.count, 1); assert.equal(material.count, 1); assert.equal(texture.count, 0);
  assert.equal(group.parent, null); assert.equal(context.FX.list.length, 0);
});

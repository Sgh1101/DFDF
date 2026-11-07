const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), { execFileSync } = require("node:child_process");
const D = require("../js/rgx-firefly-data");
const base = "assets/rgx-firefly/v1";
const geo = () => D.parse(fs.readFileSync(base + "/model.json", "utf8"))["minecraft:geometry"][0];

test("the build script deterministically generates the entire SGH package", () => {
  execFileSync(process.execPath, ["scripts/build-sgh-butterfly.js", "--check"], { stdio: "pipe" });
});

test("the SGH shape surrounds both pins and keeps its existing save key", () => {
  const g = geo(), by = Object.fromEntries(g.bones.map((b) => [b.name, b]));
  assert.equal(g.bones.length, 9);
  assert.equal(by.up.parent, "weapon");
  assert.equal(by.down.parent, "weapon");
  assert.equal(g.description.identifier, "geometry.sgh_butterfly");
  const box = (name) => { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (const c of by[name].cubes) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], c.origin[i]); mx[i] = Math.max(mx[i], c.origin[i] + c.size[i]); } return { mn, mx }; };
  // each handle surrounds the pin it turns on, and the blade runs from the pins to the tip
  for (const name of ["up", "down"]) { const b = box(name), p = by[name].pivot; assert.ok(b.mn[1] < p[1] && p[1] < b.mx[1] && b.mn[2] < p[2] && p[2] < b.mx[2], name + " holds its pin"); }
  const bl = box("blade2");
  assert.ok(bl.mx[2] > -2.6 && bl.mn[2] < -10.8, "blade length " + JSON.stringify(bl));
  for (const name of ["blade2", "up", "down", "blade_illuminated", "bone2_illuminated", "bone3_illuminated"]) assert.ok(by[name].cubes.length > 0, name);
});

test("four colours: the same shape, each its own texture, name and a little of its own motion", () => {
  const manifest = JSON.parse(fs.readFileSync(base + "/manifest.json")), names = manifest.files.map((f) => f.name);
  const tex = { blue: "texture.png", crimson: "texture_crimson.png", emerald: "texture_emerald.png", blackgold: "texture_blackgold.png" };
  for (const n of Object.values(tex)) assert.ok(names.includes(n), n + " is in the manifest");
  assert.equal(new Set(Object.values(tex).map((n) => manifest.files.find((f) => f.name === n).sha256)).size, 4, "four different textures");
  const skins = fs.readFileSync("js/legacy/58-gun-skins.js", "utf8"), api = fs.readFileSync("api/v1.js", "utf8");
  for (const [id, ko] of [["butterfly", "블루"], ["butterfly_crimson", "크림슨"], ["butterfly_emerald", "에메랄드"], ["butterfly_blackgold", "블랙골드"]]) {
    assert.match(skins, new RegExp('id: "' + id + '", ko: "SGH나비칼 ' + ko + '", en: "SGH Butterfly [A-Za-z ]+", rar: 4, only: "knife", model: "rgx_butterfly"'), id + " in the skin list");
    assert.match(api, new RegExp("\\b" + id + ': 4\\b'), id + " is a legendary skin on the server");
    assert.match(api, new RegExp("\\b" + id + ': "knife"'), id + " is a knife skin on the server");
  }
  // each colour plays the same motion a little differently (inspect speed, its own hold); blue plays it as made
  const src = fs.readFileSync("js/rgx-firefly.js", "utf8"), table = /const VARIANT=\{([\s\S]*?)\n  \};/.exec(src)[1];
  const V = Function("return {" + table.replace(/\/\/.*$/gm, "") + "}")();
  assert.deepEqual(V.butterfly, { tex: "", speed: 1, draw: 1, lean: 0, sway: 0, drop: 0 });
  assert.equal(new Set(Object.values(V).map((v) => JSON.stringify({ ...v, tex: 0 }))).size, 4, "no two colours move the same");
  for (const v of Object.values(V)) assert.ok(v.speed >= 0.85 && v.speed <= 1.2 && Math.abs(v.lean) <= 0.1 && Math.abs(v.sway) <= 0.08 && v.drop <= 0.02, "only a little different");
});

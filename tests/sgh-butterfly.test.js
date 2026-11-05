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
  const lbl = fs.readFileSync("js/legacy/58-gun-skins.js", "utf8");
  assert.match(lbl, /id: "butterfly", ko: "SGH나비칼", en: "SGH Butterfly"/);
});

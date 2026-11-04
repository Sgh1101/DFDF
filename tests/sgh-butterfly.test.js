// SGH나비칼: the knife's own shape and texture on the retained butterfly rig. The rig's bones (names, parents, pivots,
// rotations), the animations and the sounds stay exactly as retained, so every motion plays unchanged; only the cubes
// of the blade, the two handles and their glowing parts, and the texture, are the ones scripts/build-sgh-butterfly.js makes.
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), crypto = require("node:crypto"), { execFileSync } = require("node:child_process");
const D = require("../js/rgx-firefly-data");
const base = "assets/rgx-firefly/v1", sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const geo = () => D.parse(fs.readFileSync(base + "/model.json", "utf8"))["minecraft:geometry"][0];

test("model.json and texture.png are what the build script makes", () => {
  execFileSync(process.execPath, ["scripts/build-sgh-butterfly.js", "--check"], { stdio: "pipe" });
});

test("the retained rig's bones, animations and sounds are unchanged", () => {
  const bones = geo().bones.map((b) => ({ ...b, cubes: undefined }));
  assert.equal(sha(JSON.stringify(bones)), "52b60e0612bb594aa54d6fbd4e9aab7ca6804541d5ecf7156aef88209d201813", "the bones (names, parents, pivots, rotations) of the retained rig");
  const manifest = JSON.parse(fs.readFileSync(base + "/manifest.json"));
  assert.equal(manifest.files.find((f) => f.name === "animation.json").sha256, "d415254c87f8310ca4bcc23fea57ecd17e3bc12f3ea010a24862fc320e58bd79", "the retained animations");
  const sounds = manifest.files.filter((f) => f.name.startsWith("sounds/"));
  assert.equal(sounds.length, 8);
  assert.equal(sha(sounds.map((f) => f.name + f.sha256).join()), sha([["draw", "ec3d7414482e7cc0e518f7bff26082e8218e992f03e0fdba3b40f04f657a1849"], ["inspect", "f747a0959437d599439041d61cddf8966ef8c99f2b56148d5bf1687b40a9b701"], ["melee_1", "b9a2342a108cb7bd4c222794b2d5025d258f9e49eeeb7d4ef5718af040b2d814"], ["melee_2", "89718f7b38bca04ee6eb2a1b8fc2f81fbfee74fc462045bec5efa67b98b7fe9b"], ["melee_3", "e35a35b659e33954609cabe43962755bd42358a72327b9623bbfcfbad3326a40"], ["rotate_1", "ff5fb0d353bb5b28fe094fc9e55faa1bba3cf0bf04ac7dbe7c6480991e4c84ab"], ["rotate_2", "b680936fed8dd21da33b420ed9ff19f529944821732b243685f065ffae0e969f"], ["rotate_3", "69dbbc337726d05633ed6306ca8250deda2d2313e63f319400cae1c536c65c07"]].map(([n, h]) => "sounds/future_butterfly_" + n + ".ogg" + h).join()), "the retained sounds");
});

test("the shape is ours: the source model and texture are gone, and the shape keeps to where the rig turns it", () => {
  const manifest = JSON.parse(fs.readFileSync(base + "/manifest.json"));
  assert.notEqual(manifest.files.find((f) => f.name === "model.json").sha256, "e1b4a336d013b8094e776e3094ea1c46d02ae6279320dc25f16cee05c3079d80");
  assert.notEqual(manifest.files.find((f) => f.name === "texture.png").sha256, "414eec0e3075d556ba9e2bdbf48768fd42ced82670606fda00b18b322dadf639");
  const g = geo(), by = Object.fromEntries(g.bones.map((b) => [b.name, b]));
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

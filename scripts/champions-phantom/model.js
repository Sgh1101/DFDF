// Cube-model toolkit for the DFDF Champions Phantom generator.
// Builds bone/cube data in the same JSON shape the game's rig builders read
// (js/bedrock-rig.js for the gun, js/gecko-finisher-rig.js for the finisher),
// packs every face into a texture atlas and paints it from world-space shaders.
"use strict";
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const THREE = require("three");
const { Canvas } = require("./png");
const GECKO = require("../../js/gecko-finisher-rig");

class Model {
  constructor(identifier, size) {
    this.identifier = identifier; this.size = size; this.bones = []; this.cubes = [];
  }
  bone(name, parent, pivot = [0, 0, 0], rotation) {
    if (this.bones.some((b) => b.name === name)) throw Error("duplicate bone " + name);
    const bone = { name, pivot: pivot.map(round) };
    if (parent) bone.parent = parent;
    if (rotation && rotation.some(Boolean)) bone.rotation = rotation.map(round);
    this.bones.push(bone); return name;
  }
  // origin/size in model units (1/16 block). material is a painter key.
  cube(bone, origin, size, material, extra = {}) {
    if (!this.bones.some((b) => b.name === bone)) throw Error("missing bone " + bone);
    if (size.some((n) => !(n > 0))) throw Error("empty cube on " + bone);
    const cube = { bone, origin: origin.map(round), size: size.map(round), material, ...extra };
    this.cubes.push(cube); return cube;
  }
  // Packs every face, density = texels per model unit. Throws when it does not fit.
  layout(density) {
    const [W, H] = this.size, faces = [];
    for (const cube of this.cubes) {
      const [x, y, z] = cube.size, d = cube.density || density;
      const dims = { north: [x, y], south: [x, y], east: [z, y], west: [z, y], up: [x, z], down: [x, z] };
      cube.uv = {};
      for (const [face, [a, b]] of Object.entries(dims)) faces.push({ cube, face, w: Math.max(1, Math.round(a * d)), h: Math.max(1, Math.round(b * d)) });
    }
    faces.sort((a, b) => b.h - a.h || b.w - a.w);
    let x = 0, y = 0, row = 0;
    for (const f of faces) {
      if (x + f.w > W) { x = 0; y += row; row = 0; }
      if (y + f.h > H) throw Error(`atlas overflow at density ${density}`);
      f.cube.uv[f.face] = { uv: [x, y], uv_size: [f.w, f.h] };
      x += f.w; row = Math.max(row, f.h);
    }
    this.atlasHeight = y + row;
    return this;
  }
  fit(start = 4, step = 0.25) {
    for (let d = start; d > 0.5; d -= step) { try { return this.layout(d), this.density = d, this; } catch (e) { /* try a lower density */ } }
    throw Error("model does not fit its atlas");
  }
  json() {
    const bones = this.bones.map((b) => {
      const cubes = this.cubes.filter((c) => c.bone === b.name).map((c) => {
        const out = { origin: c.origin, size: c.size, uv: c.uv };
        if (c.rotation) { out.pivot = c.pivot.map(round); out.rotation = c.rotation.map(round); }
        if (c.inflate) out.inflate = c.inflate;
        return out;
      });
      return cubes.length ? { ...b, cubes } : { ...b };
    });
    return { format_version: "1.12.0", "minecraft:geometry": [{ description: { identifier: this.identifier, texture_width: this.size[0], texture_height: this.size[1] }, bones }] };
  }
}
const round = (n) => Math.round(n * 10000) / 10000;

// The game's own BEDROCK_RIG, evaluated with Node's THREE so the painted atlas
// matches the exact UV orientation the browser uses for the gun.
function bedrock() {
  const context = { window: {}, T: THREE };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../../js/bedrock-rig.js"), "utf8"), context);
  return context.window.BEDROCK_RIG;
}
// Rasterize every cube face of the built rig into the atlas, calling
// shade({material, p, n, u, v, w, h, cube, face}) for each texel.
function paint(model, rigKind, shade, layers) {
  const geo = model.json()["minecraft:geometry"][0], [W, H] = model.size;
  const rig = rigKind === "bedrock" ? bedrock().build(geo, new THREE.MeshBasicMaterial()) : GECKO.build(geo, new THREE.MeshBasicMaterial(), THREE);
  rig.updateMatrixWorld(true);
  const canvases = Object.fromEntries(layers.map((name) => [name, new Canvas(W, H)]));
  const faceOrder = rigKind === "bedrock" ? ["east", "west", "up", "down", "south", "north"] : ["west", "east", "north", "south", "up", "down"];
  rig.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const boneName = mesh.parent.name.replace(/^phantom-bone-/, ""), cubes = model.cubes.filter((c) => c.bone === boneName);
    const pos = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv, nor = mesh.geometry.attributes.normal;
    for (let t = 0; t < pos.count; t += 3) {
      const cube = cubes[Math.floor(t / 36)], face = faceOrder[Math.floor((t % 36) / 6)], rect = cube.uv[face];
      const P = [0, 1, 2].map((i) => new THREE.Vector3().fromBufferAttribute(pos, t + i).applyMatrix4(mesh.matrixWorld));
      const UV = [0, 1, 2].map((i) => [uv.getX(t + i) * W, (1 - uv.getY(t + i)) * H]);
      const n = new THREE.Vector3().fromBufferAttribute(nor, t).transformDirection(mesh.matrixWorld);
      const [a, b, c] = UV, d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(d) < 1e-9) continue;
      const xs = UV.map((q) => q[0]), ys = UV.map((q) => q[1]);
      for (let y = Math.max(0, Math.floor(Math.min(...ys))); y < Math.min(H, Math.ceil(Math.max(...ys))); y++) for (let x = Math.max(0, Math.floor(Math.min(...xs))); x < Math.min(W, Math.ceil(Math.max(...xs))); x++) {
        const px = x + 0.5, py = y + 0.5;
        const l1 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / d, l2 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / d, l3 = 1 - l1 - l2;
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
        const p = P[0].clone().multiplyScalar(l1).addScaledVector(P[1], l2).addScaledVector(P[2], l3);
        const out = shade({ material: cube.material, p: p.toArray(), n: n.toArray(), u: x - rect.uv[0], v: y - rect.uv[1], w: rect.uv_size[0], h: rect.uv_size[1], cube, face });
        for (const name of layers) if (out[name] != null) canvases[name].set(x, y, out[name], out[name + "Alpha"] ?? 255);
      }
    }
  });
  return canvases;
}
module.exports = { Model, paint, bedrock, THREE };

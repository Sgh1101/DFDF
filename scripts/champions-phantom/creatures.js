// The finisher's long dragon and coiled serpent, built from cubes along spline
// paths. Authored directly in the rendered (GeckoLib-converted) space in block
// units ("meters", 16 model units each), then written in the geo JSON the game's
// js/gecko-finisher-rig.js reads. The layout fits the finisher scene's fixed
// points (js/phantom-finisher-motion.js / phantom-finisher-scene.js): the eye
// glows, the hourglass trophy and the two statues.
"use strict";
const { Model, paint, THREE } = require("./model");
const { hash } = require("./png");

const U = 16, deg = 180 / Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const EYES = { dragon: [[-3.9383, 6.9484, 1.2611], [-3.6727, 6.9484, 0.2518]], serpent: [[3.5307, 14.9521, 0.8355], [4.8021, 14.9521, 2.1622]] };

// Bones are placed by world transform (rig space, meters); the JSON stores the
// GeckoLib convention (x-mirrored pivots, parent-relative frames).
class Rig {
  constructor(id, size) {
    this.model = new Model(id, size); this.world = new Map([[null, new THREE.Matrix4()]]); this.p3 = new Map([[null, [0, 0, 0]]]);
    this.bone("root", null, V(0, 0, 0), new THREE.Quaternion());
  }
  bone(name, parent, position, quaternion) {
    const W = new THREE.Matrix4().compose(position.clone().multiplyScalar(U), quaternion, V(1, 1, 1));
    const L = this.world.get(parent).clone().invert().multiply(W), p = V(0, 0, 0), q = new THREE.Quaternion();
    L.decompose(p, q, V(0, 0, 0));
    const e = new THREE.Euler().setFromQuaternion(q, "ZYX"), base = this.p3.get(parent), P = [base[0] + p.x, base[1] + p.y, base[2] + p.z];
    this.model.bone(name, parent, [-P[0], P[1], P[2]], [-e.x * deg, -e.y * deg, e.z * deg]);
    this.world.set(name, W); this.p3.set(name, P);
    return name;
  }
  // Box in the bone's local frame, extents in meters.
  box(bone, [x0, x1], [y0, y1], [z0, z1], material) {
    const P = this.p3.get(bone);
    return this.model.cube(bone, [-(x1 * U + P[0]), y0 * U + P[1], z0 * U + P[2]], [(x1 - x0) * U, (y1 - y0) * U, (z1 - z0) * U], material);
  }
  local(bone, point) { return V(...point).multiplyScalar(U).applyMatrix4(this.world.get(bone).clone().invert()).divideScalar(U); }
}
// Orientation with +X along the body and +Y as close to world up as possible.
function frame(tangent, roll = 0, upHint = V(0, 1, 0)) {
  const x = tangent.clone().normalize(), hint = Math.abs(x.dot(upHint)) > 0.98 ? V(1, 0, 0) : upHint;
  const z = x.clone().cross(hint).normalize(), y = z.clone().cross(x).normalize();
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  return roll ? q.multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), roll)) : q;
}
const yawPitch = (yaw, pitch, roll = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(roll, yaw, pitch, "YZX"));

// A body of n cube segments following the path from tail to neck.
function body(rig, points, n, radius, opts) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => V(...p)), false, "centripetal"), segs = [];
  const length = curve.getLength(), step = length / n;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, p = curve.getPointAt(t), tan = curve.getTangentAt(t), r = radius(t);
    const name = rig.bone(`seg_${String(i).padStart(2, "0")}`, "root", p, frame(tan));
    const half = step / 2 + 0.1;
    rig.box(name, [-half, half], [-r * 0.82, r], [-r, r], "scale");
    rig.box(name, [-half * 0.86, half * 0.86], [-r * 1.02, -r * 0.62], [-r * 0.74, r * 0.74], "belly");
    if (opts.fin(i, t)) rig.box(name, [-half * 0.5, half * 0.3], [r * 0.95, r + opts.finHeight * r], [-0.05, 0.05], "fin");
    if (opts.flank && i % 2 === 0) for (const s of [-1, 1]) rig.box(name, [-half * 0.7, half * 0.5], [-r * 0.2, r * 0.45], s > 0 ? [r, r + 0.05] : [-r - 0.05, -r], "flank");
    segs.push({ name, p, tan, r, t });
  }
  return { curve, segs };
}

function dragonHead(rig, eyes, neck) {
  const [a, b] = eyes.map((e) => V(...e)), side = a.clone().sub(b).normalize(), fwd = V(0, 1, 0).cross(side).normalize();
  const center = a.clone().add(b).multiplyScalar(0.5).addScaledVector(fwd, 0.3).add(V(0, -0.08, 0));
  const head = rig.bone("head", "root", center, frame(fwd));
  rig.box(head, [-0.75, 0.25], [-0.3, 0.38], [-0.48, 0.48], "scale");           // skull
  rig.box(head, [0.25, 1.15], [-0.18, 0.22], [-0.36, 0.36], "scale");           // snout
  rig.box(head, [0.55, 1.2], [0.22, 0.3], [-0.2, 0.2], "horn");                  // nose ridge
  rig.box(head, [1.0, 1.18], [0.05, 0.2], [-0.3, -0.18], "dark"); rig.box(head, [1.0, 1.18], [0.05, 0.2], [0.18, 0.3], "dark"); // nostrils
  rig.box(head, [0.3, 1.1], [-0.24, -0.18], [-0.32, 0.32], "mouth");            // palate
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) rig.box(head, [0.42 + i * 0.2, 0.52 + i * 0.2], [-0.36, -0.18], s > 0 ? [0.22, 0.32] : [-0.32, -0.22], "tooth");
  rig.box(head, [0.95, 1.1], [-0.42, -0.18], [-0.1, 0.1], "tooth");
  for (const e of eyes) { // eye gems sit exactly on the scene's eye glow points
    const l = rig.local(head, e);
    rig.box(head, [l.x - 0.12, l.x + 0.12], [l.y - 0.07, l.y + 0.07], l.z > 0 ? [l.z - 0.06, l.z + 0.03] : [l.z - 0.03, l.z + 0.06], "eye");
    rig.box(head, [l.x - 0.16, l.x + 0.18], [l.y + 0.07, l.y + 0.16], l.z > 0 ? [l.z - 0.1, l.z + 0.04] : [l.z - 0.04, l.z + 0.1], "horn");
  }
  const jaw = rig.bone("head_jaw", head, center.clone().addScaledVector(fwd, -0.35).add(V(0, -0.28, 0)), frame(fwd.clone().add(V(0, -0.5, 0))));
  rig.box(jaw, [0, 1.3], [-0.2, 0], [-0.32, 0.32], "scale");
  rig.box(jaw, [0.1, 1.2], [0, 0.04], [-0.26, 0.26], "mouth");
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) rig.box(jaw, [0.3 + i * 0.22, 0.4 + i * 0.22], [0, 0.16], s > 0 ? [0.18, 0.28] : [-0.28, -0.18], "tooth");
  rig.box(rig.bone("head_jaw_chin0", jaw, center.clone().addScaledVector(fwd, 0.5).add(V(0, -0.75, 0)), frame(fwd.clone().add(V(0, -1.2, 0)))), [0, 0.45], [-0.06, 0.06], [-0.06, 0.06], "mane");
  rig.box(rig.bone("head_jaw_chin1", jaw, center.clone().addScaledVector(fwd, 0.3).add(V(0, -0.65, 0)), frame(fwd.clone().add(V(0, -1.6, 0)))), [0, 0.35], [-0.05, 0.05], [-0.05, 0.05], "mane");
  // Antlers: two forked horns sweeping back.
  for (const [s, tag] of [[1, "r"], [-1, "l"]]) {
    const root = center.clone().addScaledVector(fwd, -0.55).addScaledVector(side, s * 0.3).add(V(0, 0.36, 0));
    const h0 = rig.bone(`head_horn_${tag}0`, head, root, frame(fwd.clone().multiplyScalar(-1).add(V(0, 0.9, 0)).addScaledVector(side, s * 0.25)));
    rig.box(h0, [0, 0.8], [-0.07, 0.07], [-0.07, 0.07], "horn"); rig.box(h0, [0.3, 0.42], [0.07, 0.3], [-0.05, 0.05], "horn");
    const tip = rig.world.get(h0), p1 = V(0.8 * U, 0, 0).applyMatrix4(tip).divideScalar(U);
    const h1 = rig.bone(`head_horn_${tag}1`, h0, p1, frame(fwd.clone().multiplyScalar(-1).add(V(0, 0.35, 0)).addScaledVector(side, s * 0.2)));
    rig.box(h1, [0, 0.62], [-0.055, 0.055], [-0.055, 0.055], "horn");
    const p2 = V(0.62 * U, 0, 0).applyMatrix4(rig.world.get(h1)).divideScalar(U);
    rig.box(rig.bone(`head_horn_${tag}2`, h1, p2, frame(fwd.clone().multiplyScalar(-1).add(V(0, 1.1, 0)))), [0, 0.38], [-0.04, 0.04], [-0.04, 0.04], "horn");
    // whiskers and cheek fins
    rig.box(rig.bone(`head_cheek_${tag}0`, head, center.clone().addScaledVector(fwd, 0.9).addScaledVector(side, s * 0.3).add(V(0, -0.02, 0)), frame(fwd.clone().multiplyScalar(-0.4).addScaledVector(side, s).add(V(0, -0.35, 0)))), [0, 0.95], [-0.03, 0.03], [-0.03, 0.03], "mane");
    rig.box(rig.bone(`head_cheek_${tag}1`, head, center.clone().addScaledVector(fwd, -0.4).addScaledVector(side, s * 0.45).add(V(0, -0.1, 0)), frame(fwd.clone().multiplyScalar(-1).addScaledVector(side, s * 0.8))), [0, 0.55], [-0.14, 0.14], [-0.03, 0.03], "mane");
  }
  // A crest of mane spikes fanning back from the skull.
  for (let i = 0; i < 5; i++) {
    const k = i / 4, s = (k - 0.5) * 2;
    const p = center.clone().addScaledVector(fwd, -0.65).addScaledVector(side, s * 0.4).add(V(0, 0.15 + 0.15 * (1 - Math.abs(s)), 0));
    rig.box(rig.bone(`head_crest_${i}`, head, p, frame(fwd.clone().multiplyScalar(-1).addScaledVector(side, s * 0.7).add(V(0, 0.55 - 0.25 * Math.abs(s), 0)))), [0, 0.9 + 0.3 * (1 - Math.abs(s))], [-0.035, 0.035], [-0.12, 0.12], "mane");
  }
  for (let i = 0; i < 6; i++) {
    const s = (i % 2 ? 1 : -1), k = Math.floor(i / 2);
    const p = center.clone().addScaledVector(fwd, -0.7).addScaledVector(side, s * 0.48).add(V(0, -0.1 - k * 0.12, 0));
    rig.box(rig.bone(`head_mane_${i}`, head, p, frame(fwd.clone().multiplyScalar(-1).addScaledVector(side, s * 0.5).add(V(0, -0.15 - k * 0.2, 0)))), [0, 0.75 - k * 0.12], [-0.03, 0.03], [-0.1, 0.1], "mane");
  }
  return head;
}
// A small arm with three claws on a body segment.
function arm(rig, seg, s, tag) {
  const w = rig.world.get(seg.name), out = V(0, -0.2 * U, s * seg.r * U).applyMatrix4(w).divideScalar(U);
  const sideDir = V(0, 0, s).applyQuaternion(new THREE.Quaternion().setFromRotationMatrix(w)), down = V(0, -1, 0);
  const upper = rig.bone(`${seg.name}_arm_${tag}`, seg.name, out, frame(sideDir.clone().add(down.clone().multiplyScalar(0.6)).add(seg.tan.clone().multiplyScalar(0.4))));
  rig.box(upper, [0, 0.55], [-0.11, 0.11], [-0.11, 0.11], "scale");
  const elbow = V(0.55 * U, 0, 0).applyMatrix4(rig.world.get(upper)).divideScalar(U);
  const fore = rig.bone(`${seg.name}_arm_${tag}_fore`, upper, elbow, frame(seg.tan.clone().add(down.clone().multiplyScalar(0.5)).addScaledVector(sideDir, 0.3)));
  rig.box(fore, [0, 0.5], [-0.09, 0.09], [-0.09, 0.09], "scale");
  const wrist = V(0.5 * U, 0, 0).applyMatrix4(rig.world.get(fore)).divideScalar(U);
  for (let c = 0; c < 3; c++) rig.box(rig.bone(`${seg.name}_arm_${tag}_fore_claw${c}`, fore, wrist, frame(seg.tan.clone().add(down.clone().multiplyScalar(0.3)).addScaledVector(sideDir, (c - 1) * 0.6))), [0, 0.28], [-0.035, 0.035], [-0.035, 0.035], "claw");
}

function dragon() {
  const rig = new Rig("geometry.dfdf_champions_dragon", [512, 512]);
  const eyes = EYES.dragon, neckEnd = [-4.45, 6.75, 0.5];
  const path = [[3.2, 1.0, -4.4], [5.0, 1.15, -2.0], [5.1, 1.3, 1.4], [3.2, 1.5, 3.9], [0.2, 1.7, 4.7], [-2.8, 2.0, 3.9], [-4.6, 2.6, 1.9], [-5.25, 3.7, 0.1], [-5.1, 5.1, -0.35], [-4.85, 6.25, 0.1], neckEnd];
  const { segs } = body(rig, path, 23, (t) => 0.34 + 0.3 * Math.min(1, t * 1.6), { fin: (i) => i % 1 === 0, finHeight: 0.55, flank: true });
  dragonHead(rig, eyes);
  for (const [k, i] of [[0, 15], [1, 7]]) for (const [s, tag] of [[1, "r"], [-1, "l"]]) arm(rig, segs[i], s, tag);
  return rig.model;
}

function serpentHead(rig, eyes, variant) {
  const [a, b] = eyes.map((e) => V(...e)), side = b.clone().sub(a).normalize(), fwd = V(0, 1, 0).cross(side).normalize();
  const center = a.clone().add(b).multiplyScalar(0.5).addScaledVector(fwd, 0.28).add(V(0, -0.06, 0));
  const head = rig.bone("head", "root", center, frame(fwd));
  rig.box(head, [-0.65, 0.3], [-0.26, 0.3], [-0.72, 0.72], "scale");             // broad skull
  rig.box(head, [0.3, 1.25], [-0.16, 0.2], [-0.5, 0.5], "scale");               // flat snout
  rig.box(head, [-0.5, 0.9], [0.3, 0.38], [-0.4, 0.4], "plate");                // brow plate
  rig.box(head, [1.12, 1.27], [0.04, 0.14], [-0.34, -0.22], "dark"); rig.box(head, [1.12, 1.27], [0.04, 0.14], [0.22, 0.34], "dark");
  rig.box(head, [0.3, 1.2], [-0.2, -0.16], [-0.46, 0.46], "mouth");
  for (const s of [-1, 1]) {
    rig.box(head, [0.85, 0.98], [-0.6, -0.16], s > 0 ? [0.28, 0.38] : [-0.38, -0.28], "tooth"); // fangs
    for (let i = 0; i < 3; i++) rig.box(head, [0.35 + i * 0.16, 0.43 + i * 0.16], [-0.3, -0.16], s > 0 ? [0.36, 0.44] : [-0.44, -0.36], "tooth");
  }
  for (const e of eyes) {
    const l = rig.local(head, e);
    rig.box(head, [l.x - 0.13, l.x + 0.13], [l.y - 0.08, l.y + 0.08], l.z > 0 ? [l.z - 0.07, l.z + 0.03] : [l.z - 0.03, l.z + 0.07], "eye");
  }
  const jaw = rig.bone("jaw", head, center.clone().addScaledVector(fwd, -0.3).add(V(0, -0.26, 0)), frame(fwd.clone().add(V(0, -0.85, 0))));
  rig.box(jaw, [0, 1.35], [-0.16, 0], [-0.46, 0.46], "scale");
  rig.box(jaw, [0.1, 1.25], [0, 0.04], [-0.38, 0.38], "mouth");
  rig.box(jaw, [0.3, 1.1], [0.04, 0.08], [-0.08, 0.08], "tongue");
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) rig.box(jaw, [0.45 + i * 0.25, 0.53 + i * 0.25], [0, 0.12], s > 0 ? [0.3, 0.38] : [-0.38, -0.3], "tooth");
  for (const [s, tag] of [[1, "r"], [-1, "l"]]) {
    for (let i = 0; i < 4; i++) rig.box(rig.bone(`jfrill_${tag}${i}`, jaw, center.clone().addScaledVector(fwd, -0.1 + i * 0.25).addScaledVector(side, s * 0.45).add(V(0, -0.5, 0)), frame(fwd.clone().multiplyScalar(-0.6).addScaledVector(side, s).add(V(0, -0.5, 0)))), [0, 0.32 - i * 0.04], [-0.02, 0.02], [-0.07, 0.07], "fan");
    if (variant === "cream") {
      // Hood fans spreading behind the head.
      for (let i = 0; i < 5; i++) {
        const k = i / 4, p = center.clone().addScaledVector(fwd, -0.55).addScaledVector(side, s * 0.62).add(V(0, 0.2 - k * 0.45, 0));
        rig.box(rig.bone(`fan_${tag}${i}`, head, p, frame(fwd.clone().multiplyScalar(-0.75).addScaledVector(side, s * 1.0).add(V(0, 0.9 - k * 1.3, 0)))), [0, 1.0 - Math.abs(k - 0.4) * 0.6], [-0.03, 0.03], [-0.14, 0.14], "fan");
      }
      const h0 = rig.bone(`horn_${tag}0`, head, center.clone().addScaledVector(fwd, -0.4).addScaledVector(side, s * 0.3).add(V(0, 0.36, 0)), frame(fwd.clone().multiplyScalar(-1).add(V(0, 0.7, 0)).addScaledVector(side, s * 0.3)));
      rig.box(h0, [0, 0.55], [-0.08, 0.08], [-0.08, 0.08], "plate");
      rig.box(rig.bone(`horn_${tag}1`, h0, V(0.55 * U, 0, 0).applyMatrix4(rig.world.get(h0)).divideScalar(U), frame(fwd.clone().multiplyScalar(-1).add(V(0, 0.25, 0)))), [0, 0.5], [-0.06, 0.06], [-0.06, 0.06], "plate");
    } else {
      // Swept double horns and spines instead of hood fans.
      for (let i = 0; i < 3; i++) {
        const p = center.clone().addScaledVector(fwd, -0.5 - i * 0.12).addScaledVector(side, s * (0.4 + i * 0.12)).add(V(0, 0.32 - i * 0.18, 0));
        const h = rig.bone(`horn_${tag}${i}`, head, p, frame(fwd.clone().multiplyScalar(-1).add(V(0, 0.55 - i * 0.3, 0)).addScaledVector(side, s * (0.35 + i * 0.25))));
        rig.box(h, [0, 1.1 - i * 0.22], [-0.07, 0.07], [-0.07, 0.07], i ? "fan" : "plate");
      }
    }
  }
  const crest = variant === "cream" ? 5 : 3;
  for (let i = 0; i < crest; i++) {
    const p = center.clone().addScaledVector(fwd, -0.2 - i * 0.22).add(V(0, 0.36, 0));
    rig.box(rig.bone(`crest_${i}`, head, p, frame(fwd.clone().multiplyScalar(-1).add(V(0, 1.6 - i * 0.25, 0)))), [0, 0.42 - i * 0.04], [-0.02, 0.02], [-0.09, 0.09], "fan");
  }
  return head;
}
function serpent(variant) {
  const rig = new Rig("geometry.dfdf_champions_serpent_" + variant, [512, 512]);
  const path = [[-1.6, 12.15, 4.3], [-3.9, 12.3, 2.3], [-4.35, 12.5, -0.7], [-2.6, 12.7, -3.4], [0.4, 12.85, -4.1], [2.6, 12.95, -2.6], [2.45, 12.95, -0.55], [3.6, 13.3, 0.9], [5.5, 13.9, 0.0], [5.6, 14.6, 0.6], [5.0, 14.92, 1.1]];
  body(rig, path, variant === "cream" ? 41 : 36, (t) => 0.36 + 0.4 * Math.min(1, t * 1.2), { fin: (i) => i % 2 === 0, finHeight: variant === "cream" ? 0.25 : 0.45, flank: false });
  serpentHead(rig, EYES.serpent, variant);
  return rig.model;
}

// ── texture painting ──
const PAL = {
  dragon_black: { scale: [0x2a0709, 0x4a0c10, 0x701418, 0x962024, 0xb83234], belly: [0x5e5a5c, 0x7c787a, 0x9c989a, 0xbcb8b8, 0xd6d2cf], fin: [0x16080a, 0x2a0c10, 0x441318, 0x5c1a20, 0x7a242a], flank: [0x2a0a0e, 0x46121a, 0x6a1c24, 0x8e2a30, 0xb03a3e], horn: [0x3c1416, 0x5a2022, 0x7a3030, 0x9c4440, 0xbc5a52], mane: [0x2a0c0e, 0x481416, 0x6a1e20, 0x8e2c2c, 0xb03e3c] },
  dragon_white: { scale: [0x6e5a3e, 0x9c8562, 0xbfa880, 0xd8c6a0, 0xece0c4], belly: [0x8a8070, 0xb2a894, 0xd2c8b4, 0xe8e0d0, 0xf6f2e8], fin: [0x6a5c48, 0x8e7e64, 0xb0a084, 0xcfc0a4, 0xe6dac0], flank: [0x5a3a1e, 0x7a5028, 0x9a6a36, 0xb98648, 0xd2a262], horn: [0x8c8a90, 0xaeacb2, 0xcac8ce, 0xe0dee4, 0xf4f2f8], mane: [0x7e7c84, 0xa2a0a8, 0xc2c0c8, 0xdcdae2, 0xf0eef4] },
  serpent_cream: { scale: [0x8c7450, 0xb49a70, 0xd2bc90, 0xe6d4aa, 0xf4e8c8], belly: [0x9e9078, 0xc4b89e, 0xe0d6be, 0xf0e8d6, 0xfaf6ec], fin: [0xa8a296, 0xc8c2b4, 0xe0dace, 0xf0ece2, 0xfcfaf4], plate: [0xa08a64, 0xc2aa80, 0xdcc69c, 0xece0c0, 0xf8f0dc], fan: [0xaaa49a, 0xcac4b8, 0xe2ddd2, 0xf2eee6, 0xfefcf8], mark: [0x3a2010, 0x52301a, 0x6c4024, 0x84522e, 0x9c6438] },
  serpent_red: { scale: [0x4a0a0a, 0x6c1210, 0x8e1c16, 0xac281e, 0xc8382a], belly: [0x3a1a18, 0x5a2a26, 0x7a3c36, 0x9a5048, 0xb8665c], fin: [0x200606, 0x380a0a, 0x521010, 0x6e1814, 0x8a221c], plate: [0x5a0e0c, 0x7c1814, 0x9c241c, 0xba3024, 0xd4422e], fan: [0x2a0808, 0x440c0c, 0x641412, 0x841c18, 0xa42820], mark: [0x0a0404, 0x140606, 0x200808, 0x2c0a0a, 0x380c0c] },
};
const FIXED = { mouth: [0x4a0c10, 0x6a1418, 0x8c1c20, 0xa82428, 0xc0302e], tongue: [0x6a1020, 0x8c1828, 0xb02434, 0xcc3444, 0xe04656], tooth: [0xa89c88, 0xc8bea8, 0xe2dac8, 0xf2ecde, 0xfffaf0], claw: [0x6c665c, 0x8e887c, 0xb0aa9c, 0xd0cabc, 0xeee8dc], dark: [0x050404, 0x0c0808, 0x140c0c, 0x1c1010, 0x241414] };

function creaturePainter(pal, kind) {
  const eye = kind.startsWith("dragon") ? [0xff6a1c, 0xffb040] : [0xffd040, 0xfff0a0];
  return ({ material, p, n, u, v, w, h }) => {
    if (material === "eye") return { base: (u + v) % 3 ? eye[0] : eye[1] };
    const colors = pal[material] || FIXED[material] || pal.scale;
    const up = n[1] > 0.6, down = n[1] < -0.6, grain = hash(Math.round(p[0] * 2), Math.round(p[1] * 2), Math.round(p[2] * 2));
    let s = up ? 3 : down ? 1 : 2;
    if (v === 0) s++; if (v === h - 1) s--;
    if (grain > 0.985) s++; else if (grain < 0.015) s--;
    if (material === "scale") {
      // overlapping scales: a dark rim under each row, offset every other row
      const row = Math.floor(v / 4), cu = (u + (row % 2) * 3) % 6, cv = v % 4;
      if (cv === 3 && cu !== 0) s -= 2; else if (cv === 0 && (cu === 2 || cu === 3)) s++;
      if (kind === "serpent_cream" || kind === "serpent_red") {
        // saddle marks: diamond patches along the back, read from world position
        const [mx, my, mz] = p.map((c) => c / U), q = Math.sin(mx * 3.1 + mz * 2.3) * Math.cos(mz * 2.6 - mx * 1.1 + my * 1.7);
        if (q > 0.3) return { base: pal.mark[Math.max(0, Math.min(4, s))] };
        if (q > 0.22) return { base: FIXED.tooth[3] };
      }
      if (kind === "dragon_black" && Math.sin((p[0] * 6 + p[1] * 4 + p[2] * 5) / U) > 0.985) return { base: 0xd8a24a };
    }
    if (material === "belly") s = (u % 3 === 0 ? 1 : 3) + (up ? 1 : 0);
    if (material === "fan" || material === "mane" || material === "horn") s = Math.round(4 - (u / Math.max(1, w - 1)) * 2.4) + (v === 0 ? 1 : 0);
    return { base: colors[Math.max(0, Math.min(4, s))] };
  };
}
function build() {
  const out = {};
  const d = dragon().fit(3, 0.125);
  out.dragon_low = { model: d, textures: {} };
  for (const tone of ["black", "white"]) out.dragon_low.textures["dragon_low_" + tone] = paint(d, "gecko", creaturePainter(PAL["dragon_" + tone], "dragon_" + tone), ["base"]).base;
  for (const variant of ["cream", "red"]) {
    const m = serpent(variant).fit(3, 0.125), key = "serpent_" + variant;
    out[key] = { model: m, textures: { [key]: paint(m, "gecko", creaturePainter(PAL[key], key), ["base"]).base } };
  }
  return out;
}
module.exports = { build, EYES };

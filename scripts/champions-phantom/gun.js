// The Champions Phantom gun, modelled by hand in the game's native cube rig.
// Units: 1/16 block. +X is the muzzle; bone names, pivots and muzzle_pos stay
// compatible with animation.js and js/champions-phantom.js.
//
// Materials are colour roles that gun-paint.js resolves per side:
//   frame  - stock, grip, magazine front, muzzle   (attack: pale grey, defense: black)
//   body   - upper receiver, handguard, shroud     (attack: black,     defense: pale grey)
//   lower  - lower receiver and magazine rear      (attack: red-black, defense: dark brown)
//   trim   - gold furniture; dark - unpainted inner parts; glow - emissive accents.
"use strict";
const { Model } = require("./model");

function build() {
  const m = new Model("geometry.dfdf_champions_phantom", [512, 512]);
  m.bone("root", null, [-3.5, -3.25, 0]);
  m.bone("mag_and_lefthand", "root", [6, -5.5, 0]);
  m.bone("magazine", "mag_and_lefthand", [6, -5.5, 0], [0, 0, 28]);
  m.bone("gun_and_righthand", "root", [-3.5, -3.25, 0]);
  m.bone("gun", "gun_and_righthand", [0, 0, 0]);
  for (const name of ["barrel", "handguard", "receiver", "grip", "stock"]) m.bone(name, "gun", [0, 0, 0]);
  m.bone("grip_handle", "grip", [-4.5, -4.25, 0], [0, 0, 24]);
  m.bone("charge_handle", "gun_and_righthand", [17.5, 2.25, 1.25]);
  m.bone("bolt", "gun_and_righthand", [2.5, 0, -1]);
  m.bone("trigger", "gun_and_righthand", [-0.5, -3, 0]);
  m.bone("mag_release", "gun_and_righthand", [2.5, -2.25, -1.25]);
  m.bone("muzzle_pos", "gun_and_righthand", [41.25, 0, 0]);
  m.bone("shell", "gun_and_righthand", [2.5, 0, -1.5]);

  const box = (bone, x0, x1, y0, y1, hz, material, extra, cz = 0) =>
    m.cube(bone, [x0, y0, cz - hz], [x1 - x0, y1 - y0, hz * 2], material, extra);
  // A diagonal cuboid centred on the segment a-b.
  function beam(bone, a, b, thickness, hz, material, extra = {}, cz = 0) {
    const x = (a[0] + b[0]) / 2, y = (a[1] + b[1]) / 2, length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return m.cube(bone, [x - length / 2, y - thickness / 2, cz - hz], [length, thickness, hz * 2], material,
      { ...extra, pivot: [x, y, cz], rotation: [0, 0, Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI] });
  }
  // A cuboid whose outer face lies on a-b and which reaches `depth` to the left of a->b:
  // used to bevel a corner of a larger block.
  function bevel(bone, a, b, depth, hz, material, extra) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / len * depth / 2, ny = (b[0] - a[0]) / len * depth / 2;
    return beam(bone, [a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], depth, hz, material, extra);
  }
  const pair = (fn) => { for (const s of [-1, 1]) fn(s); };
  const rim = { rim: true };

  // ---- Stock: a solid, hooked butt with an angled cut-out under the comb.
  box("stock", -20.9, -7.2, -3.0, 1.0, 1.2, "frame", rim);                 // comb
  box("stock", -22.1, -15.0, -5.6, -1.0, 1.2, "frame");                    // butt
  box("stock", -22.1, -16.2, -6.35, -5.6, 1.2, "frame");
  box("stock", -8.0, -4.4, -3.3, -0.3, 1.2, "frame");                       // runs on into the grip
  box("stock", -22.1, -20.9, -1.1, -0.4, 1.18, "frame");
  bevel("stock", [-20.9, 1.0], [-22.1, -0.6], 1.6, 1.18, "frame");          // rounded heel
  bevel("stock", [-15.0, -4.1], [-14.1, -3.0], 0.9, 1.18, "frame");         // radius of the cut
  bevel("stock", [-16.2, -6.35], [-15.0, -5.6], 0.8, 1.18, "frame");
  box("stock", -22.75, -22.1, -5.5, -0.7, 1.05, "dark");                    // recoil pad
  box("stock", -19.6, -16.6, -6.65, -6.35, 1.05, "frame");                  // lower lip
  box("stock", -22.6, -20.6, -6.6, -5.0, 1.26, "trim");                     // gold toe
  box("stock", -21.2, -15.4, 1.0, 1.3, 1.24, "frame", rim);                 // comb cap
  beam("stock", [-21.6, 0.4], [-20.2, 1.85], 0.55, 1.26, "trim");           // hooked heel
  box("stock", -21.0, -19.6, 1.3, 2.0, 1.0, "trim");
  box("stock", -13.7, -11.0, 1.0, 1.45, 0.95, "trim");
  box("stock", -11.0, -7.4, 1.0, 1.18, 0.9, "frame", { hi: true });
  pair(s => {
    beam("stock", [-20.95, 0.9], [-20.6, -2.3], 0.75, 0.05, "trim", {}, s * 1.23);
    beam("stock", [-20.3, -0.5], [-12.4, -1.05], 0.5, 0.05, "trim", {}, s * 1.23);
    beam("stock", [-12.8, -1.35], [-8.1, -2.15], 0.85, 0.05, "trim", {}, s * 1.23);
    box("stock", -13.6, -12.4, -0.55, 0.15, 0.06, "lower", {}, s * 1.23);   // bolt head
  });

  // ---- Receiver: black upper with a raised hump, lower with the magazine well.
  box("receiver", -6.2, 14.6, 0.3, 3.0, 1.5, "body", rim);
  box("receiver", -7.0, -6.2, 0.3, 1.8, 1.5, "body");
  bevel("receiver", [-6.2, 3.0], [-7.0, 1.8], 0.8, 1.48, "body");
  box("receiver", 3.8, 9.2, 3.0, 3.55, 1.25, "body", rim);
  bevel("receiver", [3.8, 3.55], [3.3, 3.0], 0.4, 1.25, "body");
  bevel("receiver", [9.8, 3.0], [9.2, 3.55], 0.4, 1.25, "body");
  box("receiver", -5.8, 2.4, 3.0, 3.22, 0.6, "frame", { hi: true });       // flat top rail
  box("receiver", -2.7, -1.6, 3.22, 3.9, 0.6, "trim");                      // rear sight
  box("receiver", -3.2, -2.7, 3.22, 3.5, 0.6, "trim");
  box("receiver", -7.0, 3.0, -0.3, 0.3, 1.45, "lower");
  box("receiver", -4.4, 3.0, -3.0, -0.3, 1.45, "lower");
  box("receiver", 2.6, 10.4, -4.6, 0.3, 1.45, "lower");
  box("receiver", 10.4, 14.6, -2.3, 0.3, 1.45, "body");
  bevel("receiver", [10.4, -4.6], [11.6, -2.3], 1.0, 1.42, "body");
  box("receiver", 6.0, 10.7, -5.4, -4.6, 1.35, "trim");                     // flared well lip
  bevel("receiver", [5.4, -4.6], [6.0, -5.4], 0.5, 1.33, "trim");
  pair(s => {
    box("receiver", -1.0, 14.6, 1.95, 2.5, 0.05, "trim", {}, s * 1.53);    // gold belt line
    beam("receiver", [-4.6, 0.05], [0.2, -0.05], 0.5, 0.05, "trim", {}, s * 1.48);
    beam("receiver", [0.2, -0.05], [4.9, -1.25], 0.5, 0.05, "trim", {}, s * 1.48);
    beam("receiver", [4.9, -1.25], [10.0, -1.45], 0.5, 0.05, "trim", {}, s * 1.48);
    beam("receiver", [10.0, -1.45], [11.4, -4.0], 0.5, 0.05, "trim", {}, s * 1.48);
    box("receiver", 3.0, 9.1, -4.1, -1.6, 0.04, "lower", { panel: true }, s * 1.49); // mag-well plate
    box("receiver", 3.3, 4.6, -3.25, -2.5, 0.06, "frame", {}, s * 1.52);   // ejection window
    box("receiver", 9.3, 10.6, 0.05, 0.45, 0.05, "trim", {}, s * 1.53);    // forward bolt catch
  });

  // ---- Grip: gold trigger guard and an angled handle with a dark inset.
  box("grip", -4.6, -0.6, -4.5, -2.6, 1.1, "lower");
  box("grip", -6.6, -4.6, -4.5, -3.2, 1.1, "frame");
  beam("grip", [-2.6, -2.7], [-0.95, -5.95], 0.55, 0.92, "trim");
  box("grip", -1.3, 2.3, -6.2, -5.65, 0.5, "trim");
  beam("grip", [2.05, -5.95], [2.75, -4.4], 0.6, 0.5, "trim");
  box("grip_handle", -5.7, -1.5, -9.4, -2.7, 0.95, "frame");
  box("grip_handle", -5.9, -1.3, -9.95, -9.4, 1.0, "frame");
  box("grip_handle", -4.55, -2.35, -8.2, -5.0, 1.0, "dark", { keepDark: true });
  box("grip_handle", -5.85, -5.55, -9.2, -3.6, 0.98, "lower");              // back strap
  box("trigger", -0.875, 0.25, -5.25, -3.5, 0.3, "trim");
  box("trigger", -0.875, -0.25, -5.75, -5.25, 0.3, "trim");
  box("mag_release", 2.0, 3.0, -2.5, -1.875, 0.35, "trim", {}, -1.5);
  box("bolt", 0.75, 3.75, 0.25, 1.25, 0.15, "dark", {}, -1.6);

  // ---- Magazine on its moving bone: dark spine, pale face, wide gold base.
  box("magazine", 3.7, 6.0, -11.3, -3.0, 0.95, "lower");
  box("magazine", 6.0, 8.6, -11.3, -3.0, 0.95, "frame");
  box("magazine", 3.45, 3.7, -11.1, -4.4, 0.9, "frame");
  box("magazine", 3.4, 9.3, -12.3, -11.3, 1.1, "trim");
  bevel("magazine", [9.3, -12.3], [9.3, -9.7], 1.4, 1.08, "trim");
  bevel("magazine", [9.3, -9.7], [8.6, -9.0], 0.5, 1.06, "trim");
  pair(s => {
    beam("magazine", [7.0, -11.1], [9.2, -10.1], 0.6, 0.05, "trim", {}, s * 1.0);
    box("magazine", 6.0, 6.3, -11.1, -4.5, 0.05, "dark", {}, s * 0.98);
  });

  // ---- Handguard: stepped block with gold sweep, bottom rail and top fin.
  box("handguard", 14.6, 25.6, -2.3, 3.0, 1.45, "body", rim);
  box("handguard", 17.6, 21.0, -3.4, -2.3, 1.2, "trim");
  bevel("handguard", [16.5, -2.3], [17.6, -3.4], 0.6, 1.18, "trim");
  bevel("handguard", [21.0, -3.4], [22.6, -2.3], 0.7, 1.18, "body");
  box("handguard", 21.0, 28.0, 3.0, 3.3, 0.5, "trim");                      // top fin
  box("handguard", 22.0, 24.2, 3.3, 3.75, 0.55, "trim");                    // front sight
  box("handguard", 22.8, 23.4, 3.75, 3.95, 0.25, "frame", { hi: true });
  beam("handguard", [27.2, 2.2], [28.6, 3.15], 0.35, 0.45, "trim");
  box("handguard", 24.8, 25.95, -0.1, 1.0, 1.55, "trim");                   // front block
  pair(s => {
    beam("handguard", [15.2, 1.7], [19.7, -2.6], 0.6, 0.05, "trim", {}, s * 1.48);
    box("handguard", 14.6, 19.2, 1.95, 2.5, 0.05, "trim", {}, s * 1.48);
    box("handguard", 15.4, 23.8, -2.3, -1.9, 0.05, "trim", {}, s * 1.48);
  });

  // ---- Barrel shroud and squared compensator; muzzle position unchanged.
  box("barrel", 25.6, 36.4, -1.5, 1.3, 1.05, "body", rim);
  box("barrel", 31.0, 40.3, -1.6, -1.05, 1.1, "trim");
  box("barrel", 25.6, 31.0, -1.6, -1.1, 1.0, "dark");
  box("barrel", 36.2, 41.25, -1.05, 1.5, 1.0, "frame", rim);
  bevel("barrel", [40.7, -1.6], [41.25, -1.05], 0.4, 0.95, "frame");
  box("barrel", 37.6, 40.0, -1.75, -1.6, 0.7, "dark");
  box("barrel", 35.8, 36.2, -0.8, 1.25, 1.08, "dark");
  pair(s => {
    beam("barrel", [28.6, 0.7], [31.0, 0.35], 0.55, 0.05, "trim", {}, s * 1.08);
    box("barrel", 30.8, 33.6, -0.9, 0.55, 0.05, "trim", { wedge: true }, s * 1.08);
    beam("barrel", [33.4, 0.4], [35.2, 0.1], 0.4, 0.05, "trim", {}, s * 1.08);
  });
  box("charge_handle", 16.5, 19.0, 2.0, 2.8, 0.35, "trim", {}, 1.25);
  box("charge_handle", 18.2, 19.2, 1.9, 2.9, 0.5, "dark", {}, 1.6);
  return m;
}
module.exports = { build };

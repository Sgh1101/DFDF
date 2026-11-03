// The approved Champions concept in the game's native cube rig.
// Units: 1/16 block. +X is the muzzle; animation pivots remain compatible.
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

  const E = { both: { edge: "both" }, top: { edge: "top" }, hi: { hi: true } };
  const box = (bone, x0, x1, y0, y1, hz, material, cz = 0, extra) =>
    m.cube(bone, [x0, y0, cz - hz], [x1 - x0, y1 - y0, hz * 2], material, extra);
  // A real diagonal cuboid, rather than disconnected stair treads.
  function beam(bone, a, b, thickness, hz, material, cz = 0, extra = {}) {
    const x = (a[0] + b[0]) / 2, y = (a[1] + b[1]) / 2;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return m.cube(bone, [x - length / 2, y - thickness / 2, cz - hz], [length, thickness, hz * 2], material,
      { ...extra, pivot: [x, y, cz], rotation: [0, 0, Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI] });
  }
  const pair = (fn) => { for (const sign of [-1, 1]) fn(sign); };

  // Hooked open stock with deliberate, unobstructed central negative space.
  beam("stock", [-22.1, -5.2], [-22.1, 2.0], 1.5, 1.05, "body", 0, E.both);
  beam("stock", [-22.1, 1.9], [-8.0, 1.3], 1.8, 1.08, "body", 0, E.both);
  beam("stock", [-22.0, -5.7], [-17.6, -6.0], 1.55, 1.08, "body", 0, E.both);
  beam("stock", [-17.6, -6.0], [-8.0, -2.5], 1.55, 1.08, "body", 0, E.both);
  beam("stock", [-8.0, -2.5], [-8.0, 1.3], 1.65, 1.13, "dark", 0, E.both);
  box("stock", -23.0, -22.75, -4.9, 1.4, 1.02, "dark");
  pair(s => {
    beam("stock", [-21.7, 2.35], [-8.4, 1.8], .32, .08, "trim", s * 1.16);
    beam("stock", [-21.7, -6.15], [-17.6, -6.45], .32, .08, "trim", s * 1.16);
    beam("stock", [-17.6, -6.45], [-8.1, -2.95], .32, .08, "trim", s * 1.16);
    beam("stock", [-21.5, .95], [-18.0, .8], .16, .06, "glow", s * 1.18);
  });
  box("stock", -22.9, -21.2, 1.5, 2.9, 1.15, "trim");
  box("stock", -9.2, -7.4, -.7, 2.4, 1.25, "trim");
  box("stock", -8.8, -7.0, -2.7, -.7, 1.23, "body", 0, E.both);

  // Slim receiver with raised gold contours and an engraved scale panel.
  box("receiver", -7.5, 10.2, -4.2, 2.3, 1.4, "body", 0, E.both);
  beam("receiver", [9.3, -1.0], [13.4, .15], 4.0, 1.4, "body", 0, E.both);
  pair(s => {
    box("receiver", -5.5, 6.3, -.7, 1.7, .10, "trim", s * 1.52, { scales: true });
    beam("receiver", [-6.7, 2.0], [-2.7, 1.75], .55, .13, "trim", s * 1.57);
    beam("receiver", [-2.7, 1.75], [1.3, -.9], .60, .14, "trim", s * 1.57);
    beam("receiver", [1.3, -.9], [7.0, -1.5], .60, .14, "trim", s * 1.57);
    beam("receiver", [7.0, -1.5], [10.9, -3.15], .6, .14, "trim", s * 1.57);
    beam("receiver", [-6.8, 2.65], [-2.4, 2.65], .45, .12, "trim", s * 1.50);
    box("receiver", -6.1, -2.2, -3.5, -1.4, .13, "dark", s * 1.51, E.both);
    box("receiver", -5.5, -2.9, -2.4, -2.05, .14, "glow", s * 1.67);
    box("receiver", 7.3, 10.4, -.2, 1.25, .13, "dark", s * 1.53, E.both);
    box("receiver", 7.9, 9.7, .35, .58, .14, "glow", s * 1.68);
    for (const x of [-6.4, 10.7]) box("receiver", x, x + .55, -.9, -.35, .14, "shell", s * 1.61);
  });
  box("receiver", -7.5, -6.8, -4.0, 2.7, 1.48, "trim");
  box("receiver", 2.9, 10.3, -5.7, -4.2, 1.55, "body", 0, E.both);
  box("receiver", 10.3, 11.2, -5.3, -3.6, 1.5, "trim");
  box("receiver", -3.75, 2.0, -6.3, -5.7, .5, "trim");
  beam("receiver", [1.7, -6.0], [2.1, -4.2], .6, .5, "dark");
  box("receiver", -3.75, -3.125, -5.7, -4.2, .5, "dark");
  // Low segmented rail and small iron sights keep the unscoped silhouette.
  box("receiver", -6.6, 13.8, 2.3, 2.7, .82, "dark");
  for (let x = -6.2; x < 13.0; x += 2.1) box("receiver", x, x + 1.2, 2.7, 3.0, .77, "shell", 0, E.hi);
  box("receiver", -4.2, -2.7, 3.0, 3.7, .6, "trim");
  box("receiver", -3.8, -3.1, 3.2, 3.85, .3, "dark");

  // Framed angled grip with inset dark rubber.
  box("grip", -6.3, -.7, -4.4, -3.75, 1.18, "body", 0, E.both);
  box("grip_handle", -5.6, -2.4, -10.75, -4.75, .95, "body", 0, E.both);
  pair(s => {
    box("grip_handle", -5.15, -2.9, -10.0, -5.5, .08, "dark", s * 1.0);
    box("grip_handle", -5.55, -5.25, -10.4, -5.2, .08, "trim", s * 1.01);
    box("grip_handle", -2.85, -2.55, -10.4, -5.2, .08, "trim", s * 1.01);
  });
  box("grip_handle", -5.9, -2.2, -11.25, -10.75, 1.05, "trim");
  box("trigger", -.875, .25, -5.25, -3.5, .3, "trim");
  box("trigger", -.875, -.25, -5.75, -5.25, .3, "trim");
  box("mag_release", 2.0, 3.0, -2.5, -1.875, .35, "trim", -1.5);
  box("bolt", .75, 3.75, .25, 1.25, .15, "dark", -1.6);

  // Swept magazine on its unchanged moving bone and pivot.
  box("magazine", 3.75, 8.8, -6.8, -3.0, .95, "body", 0, E.both);
  beam("magazine", [6.25, -6.3], [6.8, -10.1], 4.8, .95, "body", 0, E.both);
  pair(s => {
    beam("magazine", [4.15, -3.7], [4.75, -10.3], .32, .08, "trim", s * 1.03);
    beam("magazine", [8.4, -3.7], [9.0, -10.2], .32, .08, "trim", s * 1.03);
    for (const x of [5.25, 7.0]) beam("magazine", [x, -4.3], [x + .55, -9.8], .28, .08, "dark", s * 1.04);
    beam("magazine", [6.0, -4.6], [6.5, -9.3], .12, .08, "glow", s * 1.05);
  });
  box("magazine", 3.75, 9.8, -11.0, -10.15, 1.1, "trim");
  box("magazine", 4.1, 9.4, -11.35, -11.0, 1.0, "dark");

  // Vented handguard with broad flowing gold ribs and restrained emissive seams.
  box("handguard", 12.0, 27.0, -1.8, 2.1, 1.30, "dark", 0, E.top);
  pair(s => {
    beam("handguard", [11.9, 1.9], [16.3, .75], .85, .12, "trim", s * 1.42);
    beam("handguard", [16.3, .75], [23.4, .75], .85, .12, "trim", s * 1.42);
    beam("handguard", [23.4, .75], [25.4, -1.0], .85, .12, "trim", s * 1.42);
    beam("handguard", [13.0, -1.8], [21.8, -1.8], .65, .11, "body", s * 1.41, E.both);
    for (const x of [15.0, 18.0, 21.0]) {
      box("handguard", x, x + 2.1, -.8, .05, .10, "body", s * 1.43, E.both);
      box("handguard", x + .23, x + 1.85, -.65, -.15, .11, "dark", s * 1.55, { keepDark: true });
    }
    box("handguard", 15.3, 23.6, 1.62, 1.82, .07, "glow", s * 1.38);
  });
  box("handguard", 13.7, 25.5, 2.1, 2.45, .62, "trim");
  box("handguard", 24.0, 25.0, 2.45, 3.1, .65, "trim");
  box("handguard", 24.25, 24.75, 3.0, 3.7, .28, "dark");
  box("handguard", 25.9, 27.2, -1.8, 2.1, 1.4, "trim");

  // Faceted suppressor, with the original muzzle attachment position.
  box("barrel", 27.0, 29.3, -.85, .85, .85, "dark", 0, { keepDark: true });
  function collar(x0, x1, r, material) {
    for (const angle of [0, 45]) m.cube("barrel", [x0, -r * .7071, -r * .7071], [x1 - x0, r * 1.4142, r * 1.4142], material,
      { pivot: [(x0 + x1) / 2, 0, 0], rotation: [angle, 0, 0], keepDark: material === "dark" });
  }
  collar(29.0, 40.8, 1.28, "dark");
  collar(29.0, 29.75, 1.34, "trim");
  collar(31.0, 31.4, 1.32, "trim");
  collar(40.55, 41.25, 1.30, "trim");
  box("barrel", 41.25, 41.32, -.5, .5, .5, "dark");
  pair(s => {
    box("barrel", 32.2, 38.2, -.18, .02, .06, "body", s * 1.29);
    box("barrel", 29.8, 30.8, -.12, .12, .06, "glow", s * 1.30);
  });
  box("charge_handle", 16.5, 19.0, 1.8, 2.5, .5, "trim", 1.1);
  box("charge_handle", 18.25, 19.25, 1.6, 2.7, .6, "dark", 1.75, E.both);
  return m;
}
module.exports = { build };

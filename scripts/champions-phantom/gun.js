// DFDF's own Champions Phantom: a blocky (voxel) rifle modelled in code.
// Units are 1/16 block; +X is the muzzle, +Y up, Z across the gun. The game
// turns +X to its -Z forward axis and scales the rig (js/champions-phantom.js).
// Bones keep the names the game animates (magazine, mag_and_lefthand,
// charge_handle, bolt, trigger, mag_release) and the muzzle attachment point.
"use strict";
const { Model } = require("./model");

function build() {
  const m = new Model("geometry.dfdf_champions_phantom", [512, 512]);
  // ── hierarchy and attachment points ──
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

  // Symmetric box helper: x0..x1, y0..y1, half width hz around z = cz.
  const box = (bone, x0, x1, y0, y1, hz, material, cz = 0, extra) => m.cube(bone, [x0, y0, cz - hz], [x1 - x0, y1 - y0, hz * 2], material, extra);
  // Stepped slope: n slices interpolating the bottom/top from a to b.
  function ramp(bone, x0, x1, bottom0, bottom1, top0, top1, hz, material, n) {
    for (let i = 0; i < n; i++) {
      const a = x0 + (x1 - x0) * i / n, b = x0 + (x1 - x0) * (i + 1) / n, f = (i + 0.5) / n;
      box(bone, a, b, bottom0 + (bottom1 - bottom0) * f, top0 + (top1 - top0) * f, hz, material);
    }
  }

  // ── stock: chunky skeleton stock with a cheek riser and butt plate ──
  box("stock", -22.75, -22.25, -6.75, 1.75, 1.3, "trim");
  box("stock", -22.25, -20.75, -6.5, 1.5, 1.25, "shell");
  ramp("stock", -20.75, -13, -6.25, -3.75, 1.5, 2, 1.2, "shell", 6);
  ramp("stock", -13, -7.5, -3.5, -2.25, 2, 2.25, 1.15, "shell", 4);
  box("stock", -20.25, -9, 2, 2.5, 0.85, "trim");
  box("stock", -19.5, -14.5, -2.5, 0.25, 1.3, "body");
  box("stock", -14, -10, -1.75, 0.75, 1.3, "body");
  box("stock", -18.5, -16, -5.75, -4.5, 1.32, "dark");
  box("stock", -12.5, -8, -1.25, 0, 1.25, "dark");
  box("stock", -8.25, -7.5, -2, 2.25, 1.35, "trim");
  for (let i = 0; i < 3; i++) box("stock", -21.25 + i * 0.6, -21.25 + i * 0.6 + 0.35, -6.9, -6.5, 1.0, "dark");

  // ── receiver: the crimson / ivory body with the crowned top ──
  box("receiver", -7.5, 14.25, -3.75, 2.5, 1.5, "body");
  box("receiver", -7.5, 14.25, 2.5, 3.25, 1.3, "shell");
  box("receiver", -6.75, 13.5, 3.25, 3.625, 1.0, "trim");
  for (let x = -5.5; x < 13; x += 1.5) box("receiver", x, x + 0.75, 3.625, 4.25, 0.9, "dark");
  box("receiver", -6.5, -3.75, 3.625, 4.25, 1.05, "trim");
  box("receiver", 1.75, 6.25, 3.75, 4.25, 1.1, "trim");
  box("receiver", 3.25, 4.75, 4.25, 4.75, 0.6, "glow");
  box("receiver", 2.5, 3.0, 4.25, 4.625, 0.75, "trim");
  box("receiver", 5.0, 5.5, 4.25, 4.625, 0.75, "trim");
  box("receiver", 1.5, 10.5, -5.75, -3.75, 1.4, "body");
  box("receiver", 10.5, 14.25, -5.0, -3.75, 1.35, "body");
  box("receiver", -7.5, 1.5, -4.75, -3.75, 1.35, "body");
  box("receiver", 4.0, 9.0, -0.25, 1.5, 1.55, "dark");
  box("receiver", 4.5, 8.5, 0.25, 1.0, 1.6, "glow");
  box("receiver", -6.75, -2.0, -1.5, 1.25, 1.55, "shell");
  box("receiver", -6.25, -2.5, -1.0, 0.75, 1.6, "trim");
  box("receiver", 10.75, 13.75, -2.75, 1.75, 1.55, "dark");
  box("receiver", 11.25, 13.25, -2.25, 1.25, 1.6, "body");
  box("receiver", -7.75, -7.25, -4.5, 2.75, 1.45, "trim");
  // trigger guard
  box("receiver", -3.75, 2.0, -7.25, -6.625, 0.55, "trim");
  box("receiver", 1.375, 2.0, -6.625, -4.75, 0.55, "trim");
  box("receiver", -3.75, -3.125, -6.625, -5.25, 0.5, "trim");

  // ── grip: angled ribbed pistol grip ──
  box("grip", -6.5, -0.5, -5.25, -3.75, 1.2, "shell");
  box("grip_handle", -6.0, -1.5, -10.25, -4.75, 0.95, "shell");
  box("grip_handle", -6.25, -5.5, -10.0, -5.0, 1.0, "trim");
  for (let i = 0; i < 3; i++) box("grip_handle", -1.75, -1.25, -9.5 + i * 1.6, -8.75 + i * 1.6, 1.0, "dark");
  box("grip_handle", -6.25, -1.25, -10.75, -10.25, 1.05, "trim");

  // ── trigger, magazine release, bolt cover ──
  box("trigger", -0.875, 0.25, -5.25, -3.5, 0.3, "trim");
  box("trigger", -0.875, -0.25, -5.75, -5.25, 0.3, "trim");
  box("mag_release", 2.0, 3.0, -2.5, -1.875, 0.35, "trim", -1.5);
  box("bolt", 0.75, 3.75, 0.25, 1.25, 0.15, "dark", -1.6);

  // ── magazine: ribbed, slightly curved banana magazine ──
  box("magazine", 3.75, 8.75, -10.0, -3.0, 0.95, "shell");
  box("magazine", 8.75, 9.5, -10.0, -3.0, 0.85, "body");
  box("magazine", 3.25, 3.75, -9.5, -3.5, 0.85, "shell");
  for (let i = 0; i < 5; i++) box("magazine", 3.9, 8.6, -9.4 + i * 1.3, -9.0 + i * 1.3, 1.02, "trim");
  box("magazine", 3.25, 9.75, -11.75, -10.0, 1.15, "trim");
  box("magazine", 4.0, 9.0, -12.25, -11.75, 0.9, "dark");

  // ── handguard: long angular guard with vents and a gold zig-zag ──
  box("handguard", 14.25, 26.5, -3.0, 2.75, 1.45, "body");
  box("handguard", 14.25, 26.5, 2.75, 3.25, 1.2, "shell");
  box("handguard", 15.0, 26.0, -3.5, -3.0, 1.1, "dark");
  for (let x = 16.5; x < 25; x += 2) box("handguard", x, x + 1, -1.75, -0.25, 1.5, "dark");
  box("handguard", 26.5, 28.5, -2.5, 2.25, 1.35, "dark");
  box("handguard", 26.75, 27.25, -2.6, 2.35, 1.4, "trim");
  box("handguard", 28.5, 29.0, -2.0, 1.75, 1.2, "dark");
  box("handguard", 14.5, 16.0, 3.25, 3.75, 0.6, "trim");

  // ── barrel: long shroud with silver bands at the muzzle ──
  box("barrel", 29.0, 37.5, -1.5, 1.25, 1.2, "body");
  box("barrel", 37.5, 41.25, -1.625, 1.375, 1.3, "shell");
  for (let x = 37.75; x < 41; x += 1.25) box("barrel", x, x + 0.5, -1.75, 1.5, 1.35, "trim");
  box("barrel", 40.75, 41.3, -0.75, 0.5, 0.65, "dark");
  box("barrel", 29.25, 37.25, 1.25, 1.5, 0.6, "trim");

  // ── charging handle: a gold knob on the right ──
  box("charge_handle", 16.5, 19.0, 2.0, 2.875, 0.5, "trim", 1.1);
  box("charge_handle", 18.25, 19.25, 1.75, 3.0, 0.6, "trim", 1.75);
  return m;
}
module.exports = { build };

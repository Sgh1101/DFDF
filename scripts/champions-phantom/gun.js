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

  // skeleton stock: a butt column, a top beam along the comb and a lower beam hooking down to the grip
  box("stock", -22.75, -22.2, -4.2, 1.9, 0.85, "shell");
  box("stock", -22.2, -19.8, -6.0, 2.7, 0.95, "shell");
  ramp("stock", -19.8, -7.5, 0.3, 0.6, 2.4, 2.2, 1.1, "shell", 10);
  ramp("stock", -19.8, -14.0, -6.8, -6.6, -4.6, -4.4, 1.15, "shell", 5);
  ramp("stock", -14.0, -7.5, -6.6, -3.6, -4.4, -2.2, 1.15, "shell", 7);
  box("stock", -22.75, -22.45, -3.6, 1.4, 0.88, "dark");        // butt pad
  ramp("stock", -19.8, -7.5, -4.6, -2.2, 0.6, 0.3, 0.85, "shell", 8);        // recessed web between the beams
  box("stock", -19.8, -18.8, -6.6, -4.6, 1.1, "shell");
  box("stock", -22.0, -19.6, 2.7, 2.95, 0.7, "trim");           // small gold trim on the butt riser
  box("stock", -8.0, -7.5, -3.9, 2.3, 1.3, "shell");

  // ── receiver: slim crimson/ivory body, lower at the front, with a thin rail ──
  box("receiver", -7.5, 9.5, -4.4, 2.3, 1.45, "body");
  ramp("receiver", 9.5, 14.4, -4.4, -2.3, 2.3, 2.3, 1.45, "body", 5);
  box("receiver", -7.5, 14.4, 2.3, 2.7, 1.0, "dark");
  box("receiver", -7.0, 0.0, 2.7, 3.2, 0.75, "shell");          // rear rail
  box("receiver", -2.6, -1.8, 3.2, 3.7, 0.3, "trim");           // rear sight nib
  box("receiver", 0.0, 13.0, 2.7, 3.0, 0.5, "dark");            // forward rail
  box("receiver", 3.5, 5.0, 3.0, 3.3, 0.4, "glow");
  box("receiver", 3.5, 9.5, -5.6, -4.4, 1.25, "body");          // magazine well
  box("receiver", 4.0, 9.0, -1.0, 0.8, 1.55, "dark");           // side panel
  box("receiver", 4.5, 8.5, -0.5, 0.2, 1.6, "glow");
  box("receiver", -6.0, -2.5, -2.0, 0.2, 1.55, "dark");         // ejection panel
  box("receiver", -7.75, -7.25, -4.2, 2.5, 1.45, "shell");
  box("receiver", 10.75, 13.75, -2.2, 1.0, 1.55, "dark");
  // trigger guard
  box("receiver", -3.75, 2.0, -6.3, -5.7, 0.5, "dark");
  box("receiver", 1.375, 2.0, -5.7, -4.4, 0.5, "dark");
  box("receiver", -3.75, -3.125, -5.7, -4.4, 0.5, "dark");

  // ── grip: angled pistol grip ──
  box("grip", -6.5, -0.5, -4.4, -3.75, 1.2, "shell");
  box("grip_handle", -5.6, -2.4, -10.75, -4.75, 0.95, "shell");
  box("grip_handle", -5.9, -5.2, -10.2, -5.0, 1.0, "shell");
  for (let i = 0; i < 3; i++) box("grip_handle", -2.9, -2.4, -9.5 + i * 1.6, -8.75 + i * 1.6, 1.0, "dark");
  box("grip_handle", -5.9, -2.2, -11.25, -10.75, 1.05, "dark");

  // ── trigger, magazine release, bolt cover ──
  box("trigger", -0.875, 0.25, -5.25, -3.5, 0.3, "trim");
  box("trigger", -0.875, -0.25, -5.75, -5.25, 0.3, "trim");
  box("mag_release", 2.0, 3.0, -2.5, -1.875, 0.35, "trim", -1.5);
  box("bolt", 0.75, 3.75, 0.25, 1.25, 0.15, "dark", -1.6);

  // ── magazine: silver back, dark front, one gold cap ──
  box("magazine", 3.75, 8.75, -10.0, -3.0, 0.95, "shell");
  box("magazine", 8.75, 9.5, -10.0, -3.0, 0.85, "dark");
  box("magazine", 3.25, 3.75, -9.5, -3.5, 0.85, "shell");
  for (let i = 0; i < 4; i++) box("magazine", 3.9, 8.6, -9.0 + i * 1.5, -8.7 + i * 1.5, 1.0, "dark");
  box("magazine", 3.25, 9.75, -11.0, -10.0, 1.1, "trim");
  box("magazine", 4.0, 9.0, -11.5, -11.0, 0.9, "dark");

  // ── handguard: long and low, dark with crimson vents and a small gold wing ──
  ramp("handguard", 14.4, 25.7, -2.3, -1.5, 2.3, 1.5, 1.35, "dark", 8);
  ramp("handguard", 14.4, 20.5, -3.1, -2.3, -0.9, -0.9, 1.3, "body", 6);
  for (let x = 15.5; x < 24.0; x += 2.2) box("handguard", x, x + 1.0, -1.0, 0.7, 1.4, "body");
  box("handguard", 19.0, 27.0, 2.1, 2.45, 0.4, "trim");
  box("handguard", 25.7, 26.3, -1.4, 1.4, 1.2, "dark");

  // ── barrel: a long, low shroud ending in stepped silver bands ──
  box("barrel", 26.3, 37.0, -1.1, 1.0, 0.95, "dark");
  box("barrel", 26.8, 34.0, 1.0, 1.25, 0.5, "shell");
  box("barrel", 35.5, 37.5, -1.5, 1.35, 1.05, "shell");
  box("barrel", 37.5, 39.5, -1.4, 1.25, 1.0, "shell");
  box("barrel", 39.5, 41.25, -1.3, 1.15, 0.95, "shell");
  box("barrel", 38.2, 38.7, -1.45, 1.3, 1.08, "dark");
  box("barrel", 40.75, 41.3, -0.6, 0.35, 0.55, "dark");

  // ── charging handle: a small knob on the right ──
  box("charge_handle", 16.5, 19.0, 1.8, 2.5, 0.5, "trim", 1.1);
  box("charge_handle", 18.25, 19.25, 1.6, 2.7, 0.6, "trim", 1.75);
  return m;
}
module.exports = { build };

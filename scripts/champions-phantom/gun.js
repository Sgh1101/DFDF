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
  function ramp(bone, x0, x1, bottom0, bottom1, top0, top1, hz, material, n, extra) {
    for (let i = 0; i < n; i++) {
      const a = x0 + (x1 - x0) * i / n, b = x0 + (x1 - x0) * (i + 1) / n, f = (i + 0.5) / n;
      box(bone, a, b, bottom0 + (bottom1 - bottom0) * f, top0 + (top1 - top0) * f, hz, material, 0, extra);
    }
  }

  // Edge flags read by gun-paint.js: "top" / "bottom" / "both" paint a thin gold edging on that side of
  // the flank faces; "hi" lays a pale highlight on the up faces.
  const E = { top: { edge: "top" }, both: { edge: "both" }, hi: { hi: true }, topHi: { edge: "top", hi: true } };

  // ── stock: an open frame - butt column, a comb beam and a lower beam that hooks down to the grip ──
  box("stock", -22.75, -21.5, -5.6, 2.6, 0.95, "shell", 0, E.both);                   // butt column
  box("stock", -22.75, -22.5, -3.8, 1.6, 0.98, "dark");                               // butt pad
  ramp("stock", -21.5, -7.5, 0.5, 0.3, 2.5, 2.2, 1.05, "shell", 14, E.both);                    // comb beam (1.5 thick)
  ramp("stock", -21.5, -14.0, -6.9, -7.0, -5.0, -5.1, 1.05, "shell", 6, E.both);          // lower beam, rear half
  ramp("stock", -14.0, -7.5, -7.0, -3.9, -5.1, -2.0, 1.05, "shell", 8, E.both);          // lower beam rising to the grip
  for (let i = 0; i < 10; i++) box("stock", -17.5 + i * 0.72, -17.5 + i * 0.72 + 1.0, -5.2 + i * 0.62, -4.3 + i * 0.62, 0.7, "shell", 0, E.both); // diagonal brace
  box("stock", -8.3, -7.5, -3.9, 2.3, 1.15, "shell", 0, E.both);                       // front post
  box("stock", -22.0, -19.6, 2.6, 2.85, 0.7, "trim");                                  // small gold trim on the butt riser

  // ── receiver: slim crimson/ivory body, lower at the front, with notched rails and a stepped mag well ──
  box("receiver", -7.5, 9.5, -4.4, 2.3, 1.45, "body", 0, E.both);
  ramp("receiver", 9.5, 14.4, -4.4, -2.3, 2.3, 2.3, 1.45, "body", 5);
  for (const [a, b] of [[-7.5, -3.2], [-2.6, 2.0], [2.6, 7.2], [7.8, 11.4], [12.0, 14.4]]) box("receiver", a, b, 2.3, 2.7, 1.0, "dark", 0, E.hi);
  box("receiver", -7.0, 0.0, 2.7, 3.2, 0.75, "shell", 0, E.hi);                         // rear rail
  box("receiver", -2.6, -1.8, 3.2, 3.7, 0.3, "trim");                                  // rear sight nib
  for (const [a, b] of [[0.6, 3.2], [3.8, 8.0], [8.6, 13.0]]) box("receiver", a, b, 2.7, 3.0, 0.5, "dark", 0, E.hi); // forward rail, notched
  box("receiver", 3.5, 5.0, 3.0, 3.3, 0.4, "glow");
  box("receiver", 3.2, 10.2, -5.9, -4.4, 1.5, "body", 0, E.both);                      // magazine well, wider than the body
  box("receiver", 10.2, 11.3, -4.4, -3.2, 1.5, "dark", 0, E.top);                      // well front lip
  box("receiver", 4.0, 9.0, -1.0, 0.8, 1.55, "dark", 0, E.both);                       // side panel
  box("receiver", 4.5, 8.5, -0.5, 0.2, 1.6, "glow");
  box("receiver", 9.5, 11.6, -1.2, 1.6, 1.58, "body", 0, E.both);                      // raised front panel
  box("receiver", -6.0, -2.5, -2.0, 0.2, 1.55, "dark", 0, E.both);                     // ejection panel
  box("receiver", -7.75, -7.25, -4.2, 2.5, 1.45, "shell", 0, E.both);
  box("receiver", 10.75, 13.75, -2.2, 1.0, 1.55, "dark", 0, E.both);
  // trigger guard
  box("receiver", -3.75, 2.0, -6.3, -5.7, 0.5, "dark");
  box("receiver", 1.375, 2.0, -5.7, -4.4, 0.5, "dark");
  box("receiver", -3.75, -3.125, -5.7, -4.4, 0.5, "dark");

  // ── grip: angled pistol grip ──
  box("grip", -6.5, -0.5, -4.4, -3.75, 1.2, "shell");
  box("grip_handle", -5.6, -2.4, -10.75, -4.75, 0.95, "shell", 0, E.both);
  box("grip_handle", -5.9, -5.2, -10.2, -5.0, 1.0, "shell");
  for (let i = 0; i < 3; i++) box("grip_handle", -2.9, -2.4, -9.5 + i * 1.6, -8.75 + i * 1.6, 1.0, "dark");
  box("grip_handle", -5.9, -2.2, -11.25, -10.75, 1.05, "dark");

  // ── trigger, magazine release, bolt cover ──
  box("trigger", -0.875, 0.25, -5.25, -3.5, 0.3, "trim");
  box("trigger", -0.875, -0.25, -5.75, -5.25, 0.3, "trim");
  box("mag_release", 2.0, 3.0, -2.5, -1.875, 0.35, "trim", -1.5);
  box("bolt", 0.75, 3.75, 0.25, 1.25, 0.15, "dark", -1.6);

  // ── magazine: silver back, dark front, one gold cap ──
  box("magazine", 3.75, 8.75, -10.0, -3.0, 0.95, "shell", 0, E.both);
  box("magazine", 8.75, 9.5, -10.0, -3.0, 0.85, "dark");
  box("magazine", 3.25, 3.75, -9.5, -3.5, 0.85, "shell");
  for (let i = 0; i < 4; i++) box("magazine", 3.9, 8.6, -9.0 + i * 1.5, -8.7 + i * 1.5, 1.0, "dark");
  box("magazine", 3.25, 9.75, -11.0, -10.0, 1.1, "trim");
  box("magazine", 4.0, 9.0, -11.5, -11.0, 0.9, "dark");

  // ── handguard: long and low, stepped down toward the muzzle with notches cut in its top ──
  for (let i = 0; i < 5; i++) {
    const x0 = 14.4 + i * 2.26, x1 = x0 + 2.26, top = 2.3 - i * 0.18, bottom = -2.3 + i * 0.16;
    box("handguard", x0, x1 - 0.8, bottom, top, 1.35, "dark", 0, E.topHi);
    box("handguard", x1 - 0.8, x1, bottom, top - 0.7, 1.35, "dark", 0, E.top);       // notch
  }
  ramp("handguard", 14.4, 20.5, -3.1, -2.3, -0.9, -0.9, 1.3, "body", 6);
  for (let x = 15.5; x < 24.0; x += 2.2) box("handguard", x, x + 1.0, -1.0, 0.7, 1.4, "body");
  box("handguard", 19.0, 27.0, 2.1, 2.45, 0.4, "trim");
  box("handguard", 25.7, 26.3, -1.4, 1.4, 1.2, "dark", 0, E.both);

  // ── barrel: a long, low shroud ending in stepped silver bands ──
  box("barrel", 26.3, 37.0, -1.1, 1.0, 0.95, "dark", 0, E.topHi);
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

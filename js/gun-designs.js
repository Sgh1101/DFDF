// Our own gun models, drawn as blocks like the rest of the game. Each one follows the silhouette and proportions
// of the gun it replaces (measured from its side view) and adds the small parts that make a gun read up close:
// rails, ports, screws, vents, sights, ribbed magazines, gripped handles. A design is authored in side-view
// units: z runs from the butt (+) to the muzzle (-), y up, x across, all in metres. Nothing here is wired into
// the game yet: GUN_DESIGNS.build(key) returns the model for review.
(() => {
  if ("undefined" == typeof T) return;
  const mats = new Map();
  // one material per look, shared by every model
  const mat = (key, color, rough, metal, extra) => {
    let m = mats.get(key);
    if (!m) {
      m = new T.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal }, extra || {}));
      m.name = "gd-" + key;
      m.userData.shared = !0;
      mats.set(key, m);
    }
    return m;
  };
  const M = {
    poly: () => mat("poly", 0x24272d, 0.82, 0.06),
    polyLite: () => mat("polyLite", 0x34383f, 0.78, 0.08),
    metal: () => mat("metal", 0x4a4f57, 0.42, 0.62),
    steel: () => mat("steel", 0x6c727b, 0.36, 0.7),
    panel: () => mat("panel", 0x8d939c, 0.5, 0.45),
    dark: () => mat("dark", 0x15171b, 0.6, 0.35),
    rubber: () => mat("rubber", 0x1b1d21, 0.96, 0),
    accent: () => mat("accent", 0xff7a1a, 0.5, 0.15, { emissive: 0x3a1500 }),
    brass: () => mat("brass", 0xc9a248, 0.32, 0.85),
    glow: () => mat("glow", 0x9fd8ff, 0.3, 0.1, { emissive: 0x2a6f9a }),
  };
  const BOX = new T.BoxGeometry(1, 1, 1);
  BOX.userData.shared = !0;

  // a block between two corners; px/py are side-view pixels (S px per metre) so a part can be placed where the
  // reference shows it: px left->right is butt->muzzle, py top->bottom
  function kit(ref) {
    const g = new T.Group();
    const Z = (px) => ref.z0 - (px - ref.px0) / ref.S, Y = (py) => ref.y0 - (py - ref.py0) / ref.S;
    const add = (m, x0, x1, y0, y1, z0, z1, rx, name) => {
      const mesh = new T.Mesh(BOX, m);
      mesh.scale.set(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
      mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      rx && (mesh.rotation.x = rx);
      name && (mesh.name = name);
      mesh.castShadow = !0;
      g.add(mesh);
      return mesh;
    };
    // side-view block: from px a to b, py top to bottom, half width w (symmetrical across x unless x0 given)
    const side = (m, a, b, top, bot, w, o) => {
      o = o || {};
      const cx = o.x || 0;
      return add(m, cx - w, cx + w, Y(bot), Y(top), Z(b), Z(a), o.rx, o.name);
    };
    // a bar from one side-view point to another (a slanted stock bar, a strut), its long axis along the line
    const bar = (m, pxA, pyA, pxB, pyB, thick, w, name) => {
      const zA = Z(pxA), yA = Y(pyA), zB = Z(pxB), yB = Y(pyB), dy = yB - yA, dz = zB - zA;
      const mesh = new T.Mesh(BOX, m);
      mesh.scale.set(2 * w, thick, Math.hypot(dy, dz));
      mesh.position.set(0, (yA + yB) / 2, (zA + zB) / 2);
      mesh.rotation.x = Math.atan2(dy, -dz);
      name && (mesh.name = name);
      mesh.castShadow = !0;
      g.add(mesh);
      return mesh;
    };
    return { g, Z, Y, add, side, bar };
  }

  // ── 밴달 (rifle): the long block stock with its brace, the stepped top cover with four vents, the slanted
  // handguard, tall front post, slotted brake, raked grip and curved ribbed magazine with the orange tips ──
  function vandal() {
    const k = kit({ S: 552, px0: 372, py0: 186, z0: 0.25, y0: 0.23 }), { g, side, add, Z, Y } = k;
    const P = M.poly(), PL = M.polyLite(), ME = M.metal(), ST = M.steel(), PA = M.panel(), D = M.dark(), R = M.rubber(), A = M.accent(), BR = M.brass();

    // stock: a solid block with a rubber butt pad, its underside climbing to the receiver in steps, a groove
    // running corner to corner, and a sling loop
    side(R, 372, 381, 214, 317, 0.029, { name: "butt-pad" });
    for (let i = 0; i < 6; i++) side(D, 371, 373, 222 + i * 15, 228 + i * 15, 0.025);
    side(P, 380, 446, 214, 317, 0.026, { name: "stock" });
    side(PL, 380, 446, 214, 222, 0.0265, { name: "stock-comb" });
    side(D, 384, 442, 306, 309, 0.0265);
    // the underside rises from the foot of the stock to the receiver
    for (let i = 0; i < 6; i++) {
      const a = 446 + i * 9, bot = 316 - (a + 4.5 - 446) * (63 / 51);
      side(P, a, a + 9, 222, Math.min(316, bot), 0.024, { name: "stock-brace" });
    }
    const groove = side(D, 0, 1, 0, 1, 0.0268, { name: "stock-groove" });
    groove.scale.set(0.0536, 0.004, 0.09);
    groove.rotation.x = -0.8;
    groove.position.set(0, Y(286), Z(447));
    side(P, 446, 545, 214, 236, 0.024, { name: "stock-beam" });
    side(ME, 456, 474, 236, 243, 0.026, { name: "sling-loop" });
    side(D, 460, 470, 238, 241, 0.027);

    // receiver: lower body, top cover stepping up from the stock, a pale band along the upper side, ejection
    // port, charging handle, selector, screws
    side(P, 540, 748, 210, 252, 0.027, { name: "receiver" });
    side(ME, 575, 748, 198, 212, 0.025, { name: "top-cover" });
    for (let i = 0; i < 4; i++) side(ME, 540 + i * 9, 549 + i * 9, 214 - i * 4, 214, 0.025, { name: "cover-step" });
    side(PA, 575, 860, 210, 215, 0.0275, { name: "side-band" });
    for (let i = 0; i < 12; i++) side(ST, 580 + i * 13, 586 + i * 13, 194, 199, 0.016, { name: "rail-tooth" });
    side(ST, 576, 742, 197, 199, 0.019, { name: "rail" });
    side(PL, 552, 738, 214, 246, 0.0275, { name: "side-panel" });
    side(D, 560, 730, 229, 231, 0.028);
    side(D, 640, 700, 216, 226, 0.0285, { name: "ejection-port" });
    side(ST, 702, 712, 217, 222, 0.036, { x: 0.012, name: "charging-handle" });
    side(A, 703, 711, 217, 222, 0.0055, { x: 0.044 });
    side(ME, 586, 606, 236, 241, 0.0045, { x: -0.03, name: "selector" });
    for (const [px, py] of [[556, 220], [556, 240], [722, 240], [612, 222]]) side(ST, px, px + 5, py, py + 5, 0.0285, { name: "screw" });
    // rear sight: a base with two ears and the aperture between them
    side(ME, 655, 712, 190, 198, 0.012, { name: "rear-sight" });
    side(ME, 664, 674, 182, 190, 0.012);
    side(ME, 690, 700, 182, 190, 0.012);
    side(D, 674, 690, 186, 190, 0.004);

    // handguard: body, vents on top, side slots, underside rail, slanted nose
    side(P, 745, 862, 200, 254, 0.031, { name: "handguard" });
    // four pale vent windows along the top edge, each with a dark slot in it
    for (let i = 0; i < 4; i++) {
      side(PA, 757 + i * 24, 777 + i * 24, 199, 210, 0.0318, { name: "vent" });
      side(D, 760 + i * 24, 774 + i * 24, 202, 207, 0.0322);
    }
    side(D, 750, 856, 232, 234, 0.0313, { name: "panel-line" });
    side(D, 750, 856, 244, 246, 0.0313);
    for (const px of [758, 846]) side(ST, px, px + 5, 236, 241, 0.0315, { name: "screw" });
    for (let i = 0; i < 6; i++) side(ST, 760 + i * 17, 768 + i * 17, 254, 258, 0.014);
    const nose = side(P, 852, 884, 202, 252, 0.03, { name: "handguard-nose" });
    nose.rotation.x = 0.32;
    side(A, 864, 868, 214, 238, 0.0315, { name: "stripe" });

    // gas block, tube and the tall front post with its guard ears
    side(ME, 862, 928, 205, 215, 0.014, { name: "gas-tube" });
    side(ME, 900, 930, 205, 230, 0.018, { name: "gas-block" });
    side(ST, 911, 917, 184, 205, 0.004, { name: "front-post" });
    side(ME, 905, 909, 190, 205, 0.012);
    side(ME, 919, 923, 190, 205, 0.012);

    // barrel and the slotted brake with its crown
    side(D, 884, 1022, 225, 237, 0.0085, { name: "barrel" });
    side(ME, 950, 1022, 221, 241, 0.014, { name: "brake" });
    for (let i = 0; i < 4; i++) side(D, 962 + i * 13, 970 + i * 13, 223, 239, 0.0145, { name: "brake-slot" });
    side(ST, 1020, 1037, 223, 239, 0.012, { name: "crown" });
    side(D, 1035, 1038, 228, 236, 0.006, { name: "muzzle-bore" });

    // grip: raked back, finger grooves, texture, orange cap
    const grip = new T.Group();
    grip.position.set(0, Y(258), Z(592));
    grip.rotation.x = -0.36;
    g.add(grip);
    const gb = (m, a, b, y0, y1, w) => {
      const mesh = new T.Mesh(BOX, m);
      mesh.scale.set(2 * w, y1 - y0, b - a);
      mesh.position.set(0, (y0 + y1) / 2, (a + b) / 2);
      grip.add(mesh);
      return mesh;
    };
    gb(P, -0.03, 0.035, -0.135, 0, 0.0175).name = "grip";
    for (let i = 0; i < 3; i++) gb(PL, -0.034, -0.026, -0.03 - i * 0.034, -0.012 - i * 0.034, 0.016);
    for (let i = 0; i < 6; i++) gb(D, -0.024, 0.03, -0.022 - i * 0.018, -0.017 - i * 0.018, 0.018);
    gb(A, -0.03, 0.035, -0.142, -0.13, 0.018).name = "grip-cap";

    // trigger and guard
    side(ST, 609, 616, 252, 280, 0.004, { name: "trigger" });
    side(ME, 598, 668, 288, 293, 0.008, { name: "trigger-guard" });
    side(ME, 664, 669, 252, 293, 0.008);

    // magazine: a stack of ribbed segments, each turned a little more, round on top, orange base
    const mag = new T.Group();
    mag.name = "magazine";
    mag.position.set(0, Y(252), Z(694));
    g.add(mag);
    side(BR, 676, 712, 248, 254, 0.006, { name: "round" });
    // twelve segments about 0.24 m in all, bending forward about 30 degrees like the reference
    // Each segment sits on a spine that bends forward as it goes down; a segment's up axis points back along
    // the spine (toward the receiver), so neighbours meet edge to edge instead of fanning apart.
    let y = 0, z = 0, turn = 0.12;
    const h = 0.02;
    const along = (o, t, dy, dz) => [o[0] + dy * Math.cos(t) - dz * Math.sin(t), o[1] + dy * Math.sin(t) + dz * Math.cos(t)];
    for (let i = 0; i < 12; i++) {
      const dy = -h * Math.cos(turn), dz = -h * Math.sin(turn);
      const seg = new T.Mesh(BOX, i % 2 ? P : PL);
      seg.scale.set(0.034, h * 1.08, 0.098);
      seg.position.set(0, y + dy / 2, z + dz / 2);
      seg.rotation.x = turn;
      mag.add(seg);
      const rib = new T.Mesh(BOX, D);
      rib.scale.set(0.036, 0.004, 0.1);
      rib.position.set(0, y + dy, z + dz);
      rib.rotation.x = turn;
      mag.add(rib);
      y += dy;
      z += dz;
      turn += 0.055;
    }
    // the orange base plate and the hook at its front, set on the end of the spine
    const base = new T.Mesh(BOX, A);
    base.scale.set(0.038, 0.012, 0.104);
    const [by, bz] = along([y, z], turn, -0.006, 0);
    base.position.set(0, by, bz);
    base.rotation.x = turn;
    base.name = "mag-base";
    mag.add(base);
    const lip = new T.Mesh(BOX, A);
    lip.scale.set(0.02, 0.03, 0.007);
    const [ly, lz] = along([y, z], turn, 0.008, -0.055);
    lip.position.set(0, ly, lz);
    lip.rotation.x = turn - 0.35;
    mag.add(lip);

    g.name = "dfdf-vandal";
    g.userData.weaponModel = "dfdf-vandal";
    g.userData.design = { key: "rifle", revision: 1 };
    g.userData.anchors = { muzzle: [0, Y(232), Z(1038)] };
    return g;
  }

  // ── 팬텀 (scout): the tall butt with a skeleton stock (top beam, slanted lower bar, pale toe strip), the long
  // top rail with a pale stripe under it, a wide pale charging handle, a vented block up front, the rounded
  // handguard with its bottom rail, and the long suppressor with a collar, two rings and a pale crown ──
  function phantom() {
    const k = kit({ S: 549, px0: 700, py0: 280, z0: -0.3615, y0: 0.03 }), { g, side, bar, Z, Y } = k;
    const P = M.poly(), PL = M.polyLite(), ME = M.metal(), ST = M.steel(), PA = M.panel(), D = M.dark(), R = M.rubber(), BR = M.brass();

    // stock
    side(R, 362, 372, 228, 318, 0.029, { name: "butt-pad" });
    for (let i = 0; i < 7; i++) side(D, 361, 363, 236 + i * 11, 240 + i * 11, 0.025);
    side(P, 372, 396, 228, 318, 0.026, { name: "stock-rear" });
    side(PA, 376, 390, 232, 239, 0.0265, { name: "cheek-mark" });
    side(P, 372, 562, 228, 247, 0.025, { name: "stock-beam" });
    side(PL, 372, 560, 228, 233, 0.0255);
    bar(P, 384, 316, 482, 262, 0.02, 0.022, "stock-bar");
    bar(PA, 400, 308, 456, 280, 0.012, 0.0232, "toe-panel");
    // the wedge between the beam and the lower bar is solid, its underside following the bar
    for (let i = 0; i < 10; i++) {
      const a = 396 + i * 8.6, bot = 316 - (a + 4.3 - 384) * 0.551 - 4;
      side(P, a, a + 8.6, 247, bot, 0.0235, { name: "stock-fill" });
    }
    // the top steps up from the stock to the receiver
    for (let i = 0; i < 3; i++) side(P, 546 + i * 5, 551 + i * 5, 223 - i * 5, 228, 0.025, { name: "cover-step" });
    side(P, 470, 562, 247, 262, 0.024, { name: "stock-lower" });
    side(D, 474, 558, 252, 254, 0.0245);
    side(ME, 540, 556, 262, 268, 0.016, { name: "sling-loop" });

    // receiver: body, rail base and teeth, pale stripe, ejection port, wide charging handle, selector, screws
    side(P, 560, 726, 212, 262, 0.026, { name: "receiver" });
    side(ME, 566, 858, 205, 213, 0.021, { name: "top-rail-base" });
    for (let i = 0; i < 20; i++) side(ST, 572 + i * 14, 579 + i * 14, 200, 205, 0.015, { name: "rail-tooth" });
    side(PA, 590, 772, 215, 222, 0.0265, { name: "side-stripe" });
    side(D, 660, 706, 226, 240, 0.0265, { name: "ejection-port" });
    side(ST, 652, 700, 234, 243, 0.034, { x: 0.014, name: "charging-handle" });
    side(D, 656, 696, 236, 241, 0.004, { x: 0.046 });
    side(ME, 598, 612, 240, 246, 0.004, { x: -0.028, name: "selector" });
    for (const [px, py] of [[568, 222], [568, 250], [716, 222], [716, 250]]) side(ST, px, px + 5, py, py + 5, 0.0265, { name: "screw" });
    side(D, 566, 720, 256, 258, 0.0265);
    side(ME, 574, 600, 196, 205, 0.012, { name: "rear-sight" });
    side(D, 582, 592, 198, 203, 0.013);
    side(ME, 838, 856, 194, 205, 0.008, { name: "front-sight" });
    side(ST, 845, 849, 188, 196, 0.003);
    side(PL, 788, 832, 206, 215, 0.024, { name: "vent-block" });
    for (let i = 0; i < 3; i++) side(D, 793 + i * 13, 800 + i * 13, 207, 214, 0.0245);

    // grip: raked back, a lighter side panel, grooves, a dark cap
    const grip = new T.Group();
    grip.position.set(0, Y(262), Z(574));
    grip.rotation.x = -0.36;
    g.add(grip);
    const gb = (m, a, b, y0, y1, w) => {
      const mesh = new T.Mesh(BOX, m);
      mesh.scale.set(2 * w, y1 - y0, b - a);
      mesh.position.set(0, (y0 + y1) / 2, (a + b) / 2);
      grip.add(mesh);
      return mesh;
    };
    gb(P, -0.03, 0.03, -0.175, 0, 0.0175).name = "grip";
    gb(PL, -0.022, 0.022, -0.15, -0.03, 0.0178);
    for (let i = 0; i < 5; i++) gb(D, -0.03, 0.03, -0.04 - i * 0.025, -0.036 - i * 0.025, 0.018);
    gb(D, -0.031, 0.031, -0.18, -0.172, 0.018).name = "grip-cap";

    // trigger and guard
    side(BR, 626, 632, 254, 270, 0.004, { name: "trigger" });
    side(ME, 598, 650, 270, 275, 0.008, { name: "trigger-guard" });
    side(ME, 646, 651, 262, 275, 0.008);

    // magazine: straight, a touch forward, a lighter inset panel, ribs at the top, a dark base plate
    const mag = new T.Group();
    mag.name = "magazine";
    mag.position.set(0, Y(262), Z(670));
    mag.rotation.x = 0.06;
    g.add(mag);
    const mb = (m, w, h, d, y, z, name) => {
      const mesh = new T.Mesh(BOX, m);
      mesh.scale.set(w, h, d);
      mesh.position.set(0, y, z);
      name && (mesh.name = name);
      mag.add(mesh);
      return mesh;
    };
    side(BR, 650, 690, 258, 263, 0.006, { name: "round" });
    mb(P, 0.034, 0.175, 0.105, -0.0875, 0, "mag-body");
    mb(PL, 0.0345, 0.065, 0.07, -0.105, 0, "mag-panel");
    for (let i = 0; i < 3; i++) mb(D, 0.035, 0.004, 0.107, -0.012 - i * 0.012, 0);
    mb(D, 0.037, 0.012, 0.11, -0.181, 0, "mag-base");
    mb(D, 0.037, 0.008, 0.012, -0.177, -0.06);

    // handguard: two stacked blocks for a rounded section, a pale stripe, side vents, a bottom rail
    side(P, 722, 864, 226, 258, 0.029, { name: "handguard" });
    side(P, 722, 864, 220, 264, 0.021);
    side(PA, 728, 858, 221, 227, 0.0225, { name: "hg-stripe" });
    for (let i = 0; i < 3; i++) side(D, 742 + i * 22, 756 + i * 22, 236, 248, 0.0295, { name: "hg-vent" });
    for (const px of [764, 848]) side(ST, px, px + 5, 250, 255, 0.0295, { name: "screw" });
    side(ME, 730, 850, 262, 268, 0.012, { name: "bottom-rail" });
    for (let i = 0; i < 9; i++) side(ST, 736 + i * 13, 743 + i * 13, 268, 272, 0.011);
    side(ST, 852, 862, 258, 266, 0.01, { name: "qd-socket" });

    // barrel stub, suppressor collar, tube with two rings, cap and pale crown
    side(D, 858, 876, 232, 250, 0.009, { name: "barrel" });
    side(D, 872, 902, 222, 258, 0.033, { name: "sup-collar" });
    side(D, 872, 902, 218, 262, 0.024);
    side(PL, 900, 1012, 224, 256, 0.032, { name: "suppressor" });
    side(PL, 900, 1012, 220, 260, 0.023);
    for (const px of [940, 976]) {
      side(D, px, px + 4, 222, 258, 0.0325, { name: "sup-ring" });
      side(D, px, px + 4, 218, 262, 0.0235);
    }
    side(ST, 1010, 1036, 224, 256, 0.031, { name: "sup-cap" });
    side(ST, 1010, 1036, 220, 260, 0.022);
    side(PA, 1030, 1038, 226, 254, 0.03, { name: "crown" });
    side(PA, 1030, 1038, 222, 258, 0.021);
    side(D, 1036, 1039, 232, 248, 0.009, { name: "muzzle-bore" });

    g.name = "dfdf-phantom";
    g.userData.weaponModel = "dfdf-phantom";
    g.userData.design = { key: "scout", revision: 1 };
    g.userData.anchors = { muzzle: [0, Y(240), Z(1039)] };
    return g;
  }

  const DESIGNS = { rifle: vandal, scout: phantom };
  window.GUN_DESIGNS = { keys: Object.keys(DESIGNS), build: (key) => (DESIGNS[key] ? DESIGNS[key]() : null), materials: M };
})();

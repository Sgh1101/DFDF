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
    mint: () => mat("mint", 0x7fe3ab, 0.45, 0.2, { emissive: 0x0d3a22 }),
    green: () => mat("green", 0x0f6b3c, 0.5, 0.25),
    pink: () => mat("pink", 0xe8a3a3, 0.55, 0.1),
    blue: () => mat("blue", 0x4a7fd0, 0.45, 0.3),
    silver: () => mat("silver", 0x8f969f, 0.4, 0.55),
    chrome: () => mat("chrome", 0xe9edf3, 0.26, 0.38),
    shell: () => mat("shell", 0xa3262b, 0.55, 0.08),
    gold: () => mat("gold", 0xe9c45c, 0.4, 0.3),
    copper: () => mat("copper", 0xe0874a, 0.4, 0.3),
    red: () => mat("red", 0x8f352e, 0.55, 0.2),
    redLite: () => mat("redLite", 0xc65a4e, 0.5, 0.18),
    lens: () => mat("lens", 0x5a2a48, 0.15, 0.4, { emissive: 0x2a0c22 }),
    wood: () => mat("wood", 0x7c4a26, 0.72, 0.04),
    woodLite: () => mat("woodLite", 0x9c6233, 0.68, 0.04),
    tan: () => mat("tan", 0xb39a6c, 0.78, 0.05),
    tanDark: () => mat("tanDark", 0x8c7650, 0.8, 0.05),
    olive: () => mat("olive", 0x75804e, 0.7, 0.1),
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

  // ── 클래식 (pistol): the slide with its pale top strip, rear and front serrations, dark ejection port and gold
  // front sight; the frame with a toothed rail under the muzzle and a beavertail at the back; the big angular
  // trigger guard with a pale blade; the long raked grip with a checkered face and a lighter base plate ──
  function classic() {
    const k = kit({ S: 1562, px0: 700, py0: 280, z0: 0.0355, y0: 0.03 }), { g, side, bar, Z, Y } = k;
    const P = M.poly(), PL = M.polyLite(), ME = M.metal(), ST = M.steel(), PA = M.panel(), D = M.dark(), BR = M.brass(), A = M.accent();

    // slide
    side(PL, 450, 1036, 62, 128, 0.027, { name: "slide" });
    side(PL, 450, 642, 128, 165, 0.027, { name: "slide-rear" });
    side(D, 450, 1036, 126, 130, 0.0282, { name: "slide-joint" });
    side(D, 450, 642, 163, 167, 0.0282);
    side(PA, 725, 1035, 55, 68, 0.022, { name: "slide-top" });
    side(PL, 450, 725, 58, 70, 0.024);
    side(PA, 618, 724, 60, 64, 0.0245);
    side(D, 456, 470, 46, 60, 0.012, { name: "rear-sight" });
    side(D, 486, 500, 46, 60, 0.012);
    side(D, 456, 500, 56, 60, 0.012);
    side(BR, 955, 990, 44, 56, 0.006, { name: "front-sight" });
    for (let i = 0; i < 8; i++) side(PA, 516 + i * 12, 520 + i * 12, 78, 148, 0.0278, { name: "serration" });
    for (let i = 0; i < 6; i++) {
      side(PA, 914 + i * 11, 920 + i * 11, 96, 100, 0.0278, { name: "front-serration" });
      side(PA, 914 + i * 11, 920 + i * 11, 114, 118, 0.0278);
    }
    side(D, 640, 722, 88, 132, 0.0278, { name: "ejection-port" });
    side(ST, 724, 745, 95, 102, 0.0278, { name: "extractor" });
    side(ST, 1028, 1038, 72, 122, 0.016, { name: "muzzle-crown" });
    side(D, 1036, 1039, 84, 110, 0.009, { name: "muzzle-bore" });

    // frame: a lighter upper band under the slide, the dark dust cover, the toothed rail, front face, takedown
    // lever, slide stop, the block behind the guard, beavertail
    side(ME, 640, 1032, 128, 165, 0.0285, { name: "frame-upper" });
    side(P, 640, 1032, 165, 206, 0.029, { name: "frame" });
    side(ME, 812, 1032, 206, 222, 0.026, { name: "rail-base" });
    for (let i = 0; i < 6; i++) side(ST, 820 + i * 34, 840 + i * 34, 222, 236, 0.024, { name: "rail-tooth" });
    side(D, 1028, 1036, 165, 230, 0.026);
    side(ST, 622, 700, 150, 162, 0.0295, { name: "takedown" });
    side(ST, 560, 612, 168, 178, 0.004, { x: -0.028, name: "slide-stop" });
    side(P, 452, 642, 165, 192, 0.029, { name: "frame-rear" });
    bar(P, 384, 128, 450, 162, 0.016, 0.018, "beavertail");
    bar(PL, 392, 134, 446, 160, 0.004, 0.0185);

    // finer slide work: a groove along the side, a bevel line under the top strip, pins, a chamber indicator,
    // a rear sight with white dots, a lightening cut over the front serrations
    side(D, 460, 1030, 140, 143, 0.0275, { name: "slide-groove" });
    side(D, 470, 1030, 70, 72, 0.0275);
    side(PA, 452, 456, 66, 160, 0.0275, { name: "slide-rear-edge" });
    for (const px of [472, 632, 760, 1000]) side(ST, px, px + 6, 150, 156, 0.0278, { name: "slide-pin" });
    side(A, 748, 760, 84, 90, 0.0278, { name: "chamber-indicator" });
    side(PA, 460, 466, 50, 55, 0.013, { name: "sight-dot" });
    side(PA, 490, 496, 50, 55, 0.013);
    side(D, 912, 980, 92, 122, 0.0276, { name: "front-cut" });
    side(ST, 1024, 1030, 72, 122, 0.017, { name: "crown-ring" });
    side(D, 1030, 1036, 78, 116, 0.012);

    // frame work: a thumb pad on the slide stop, the takedown pin, frame pins, vents under the muzzle
    side(ST, 596, 614, 164, 182, 0.004, { x: -0.026, name: "stop-pad" });
    side(ST, 626, 636, 152, 162, 0.031, { name: "takedown-pin" });
    for (const [px, py] of [[664, 180], [1004, 180], [470, 180]]) side(ST, px, px + 6, py, py + 6, 0.0295, { name: "frame-pin" });
    for (let i = 0; i < 3; i++) side(D, 980 + i * 14, 988 + i * 14, 170, 200, 0.0295, { name: "frame-vent" });
    side(D, 640, 1032, 203, 206, 0.0295);

    // trigger guard: front slope, flat bottom, rear slope up to the grip; the pale blade and its pin
    bar(ME, 768, 186, 738, 292, 0.014, 0.009, "guard-front");
    side(ME, 640, 742, 288, 306, 0.009, { name: "guard-bottom" });
    bar(ME, 642, 298, 606, 262, 0.014, 0.009, "guard-rear");
    side(PA, 648, 662, 212, 262, 0.004, { name: "trigger" });
    bar(PA, 655, 262, 668, 282, 0.008, 0.004);
    side(ST, 650, 660, 200, 210, 0.03, { name: "trigger-pin" });

    // grip: raked back, a checkered face, grooves on the front strap, lighter base plate with a forward lip
    const grip = new T.Group();
    grip.position.set(0, Y(172), Z(530));
    grip.rotation.x = -0.3;
    g.add(grip);
    const gb = (m, a, b, y0, y1, w, name) => {
      const mesh = new T.Mesh(BOX, m);
      mesh.scale.set(2 * w, y1 - y0, b - a);
      mesh.position.set(0, (y0 + y1) / 2, (a + b) / 2);
      name && (mesh.name = name);
      grip.add(mesh);
      return mesh;
    };
    gb(P, -0.048, 0.048, -0.185, 0, 0.0275, "grip");
    for (let r = 0; r < 7; r++) for (let c = 0; c < 3; c++) gb(PL, -0.03 + c * 0.022 + (r % 2) * 0.011, -0.018 + c * 0.022 + (r % 2) * 0.011, -0.036 - r * 0.022, -0.024 - r * 0.022, 0.0282, "checker");
    for (let i = 0; i < 4; i++) gb(D, 0.04, 0.05, -0.05 - i * 0.03, -0.045 - i * 0.03, 0.026);
    gb(PL, -0.049, -0.045, -0.175, -0.01, 0.027, "backstrap-line");
    gb(PL, -0.05, 0.052, -0.2, -0.185, 0.028, "mag-base");
    gb(PL, 0.036, 0.056, -0.215, -0.185, 0.026, "mag-lip");
    side(PA, 586, 598, 286, 298, 0.004, { x: -0.026, name: "mag-release" });
    side(D, 586, 600, 284, 300, 0.004, { x: 0.026 });
    // grip work: a bordered panel, backstrap ridges, the magazine seam, a lanyard loop, a seam on the base
    gb(D, -0.034, 0.038, -0.188, -0.018, 0.0282, "panel-border");
    gb(P, -0.032, 0.036, -0.186, -0.02, 0.0284);
    for (let r = 0; r < 7; r++) for (let c = 0; c < 3; c++) gb(PL, -0.03 + c * 0.022 + (r % 2) * 0.011, -0.018 + c * 0.022 + (r % 2) * 0.011, -0.036 - r * 0.022, -0.024 - r * 0.022, 0.0288, "checker");
    for (let i = 0; i < 9; i++) gb(D, -0.049, -0.04, -0.03 - i * 0.017, -0.026 - i * 0.017, 0.028, "backstrap-ridge");
    gb(D, 0.046, 0.05, -0.17, -0.01, 0.0282, "mag-seam");
    gb(ST, -0.056, -0.044, -0.2, -0.19, 0.006, "lanyard-loop");
    gb(D, -0.05, 0.052, -0.187, -0.184, 0.0285, "base-seam");
    gb(PA, -0.012, 0.012, -0.2, -0.186, 0.0285, "base-mark");

    g.name = "dfdf-classic";
    g.userData.weaponModel = "dfdf-classic";
    g.userData.design = { key: "pistol", revision: 1 };
    g.userData.anchors = { muzzle: [0, Y(97), Z(1039)] };
    return g;
  }

  // ── 고스트 (silenced): the tall rear slide with serrations and a mint bevel, the lower front slide with a pale
  // top line, mint panel and stripe and a dark port, the frame with a dark green strip and a short rail, the
  // trigger guard with a pale pink underside, the steeply raked grip with a mint front strap and a blue tip on
  // the base, and the long two-tone suppressor with a grooved collar and a ringed cap ──
  function ghost() {
    const k = kit({ S: 1024, px0: 362, py0: 167, z0: 0.25, y0: 0.141 }), { g, side, bar, Z, Y } = k;
    const P = M.poly(), PL = M.polyLite(), ME = M.metal(), ST = M.steel(), PA = M.panel(), D = M.dark(), SI = M.silver();
    const MI = M.mint(), GR = M.green(), PK = M.pink(), BL = M.blue();

    // rear slide: block, pale top, serrations, mint bevel at the back, rear sight with dots, safety
    side(PL, 366, 515, 175, 225, 0.022, { name: "slide-rear" });
    side(PA, 395, 515, 175, 190, 0.0225, { name: "slide-top" });
    for (let i = 0; i < 9; i++) side(D, 402 + i * 11, 407 + i * 11, 194, 220, 0.0228, { name: "serration" });
    bar(MI, 366, 222, 393, 177, 0.008, 0.0228, "rear-bevel");
    side(D, 396, 412, 166, 176, 0.012, { name: "rear-sight" });
    side(MI, 399, 403, 168, 172, 0.0125);
    side(MI, 405, 409, 168, 172, 0.0125);
    side(ME, 470, 492, 216, 224, 0.004, { x: -0.024, name: "safety" });
    side(D, 366, 515, 223, 226, 0.0228);
    side(PA, 415, 462, 226, 232, 0.0222, { name: "slide-under-strip" });

    // front slide: lower body, pale top line, mint stripe and panel, dark port with a lit edge, front sight
    side(PL, 515, 772, 180, 210, 0.019, { name: "slide-front" });
    side(PA, 515, 772, 180, 184, 0.0195, { name: "slide-line" });
    side(D, 560, 618, 186, 204, 0.0195, { name: "ejection-port" });
    side(PA, 560, 618, 186, 189, 0.02);
    side(ST, 618, 628, 190, 196, 0.0198, { name: "extractor" });
    side(MI, 628, 735, 196, 200, 0.0195, { name: "mint-stripe" });
    side(MI, 735, 772, 186, 206, 0.0195, { name: "mint-panel" });
    side(D, 740, 744, 188, 204, 0.0198);
    side(D, 742, 770, 168, 181, 0.008, { name: "front-sight" });
    side(MI, 754, 758, 170, 174, 0.0085);
    for (const px of [530, 700]) side(ST, px, px + 5, 200, 205, 0.0198, { name: "slide-pin" });

    // frame: body, dark green strip, rail with teeth, takedown lever, slide stop, pins
    side(P, 505, 772, 205, 230, 0.021, { name: "frame" });
    side(GR, 610, 668, 224, 231, 0.0215, { name: "green-strip" });
    side(ME, 668, 768, 228, 236, 0.016, { name: "rail" });
    for (let i = 0; i < 5; i++) side(ST, 674 + i * 19, 684 + i * 19, 236, 241, 0.015, { name: "rail-tooth" });
    side(ST, 560, 600, 208, 214, 0.004, { x: -0.022, name: "takedown" });
    side(ST, 600, 650, 214, 220, 0.004, { x: -0.022, name: "slide-stop" });
    for (const px of [520, 650, 760]) side(ST, px, px + 5, 214, 219, 0.0215, { name: "frame-pin" });

    // trigger guard and trigger
    bar(ME, 516, 228, 528, 272, 0.01, 0.007, "guard-rear");
    side(ME, 526, 642, 265, 274, 0.007, { name: "guard-bottom" });
    side(PK, 565, 630, 273, 279, 0.0075, { name: "guard-pink" });
    bar(ME, 640, 272, 668, 230, 0.01, 0.007, "guard-front");
    side(SI, 530, 540, 234, 262, 0.004, { name: "trigger" });
    bar(SI, 535, 262, 545, 268, 0.006, 0.004);

    // grip: raked, mint front strap, a side panel with ribs, a dark base with a blue tip, mag release
    const grip = new T.Group();
    grip.position.set(0, Y(225), Z(452));
    grip.rotation.x = -0.4;
    g.add(grip);
    const gb = (m, a, b, y0, y1, w, name) => {
      const mesh = new T.Mesh(BOX, m);
      mesh.scale.set(2 * w, y1 - y0, b - a);
      mesh.position.set(0, (y0 + y1) / 2, (a + b) / 2);
      name && (mesh.name = name);
      grip.add(mesh);
      return mesh;
    };
    gb(P, -0.03, 0.024, -0.15, 0, 0.0205, "grip");
    gb(MI, 0.022, 0.028, -0.142, -0.008, 0.0185, "front-strap");
    gb(D, -0.022, 0.016, -0.136, -0.02, 0.0208, "panel-border");
    gb(PL, -0.02, 0.014, -0.134, -0.022, 0.021, "grip-panel");
    for (let i = 0; i < 8; i++) gb(D, -0.017, 0.011, -0.03 - i * 0.013, -0.028 - i * 0.013, 0.0213, "grip-rib");
    for (let i = 0; i < 6; i++) gb(D, -0.034, -0.027, -0.03 - i * 0.019, -0.026 - i * 0.019, 0.019, "backstrap-ridge");
    gb(D, -0.034, 0.03, -0.164, -0.148, 0.0215, "mag-base");
    gb(BL, 0.018, 0.034, -0.17, -0.152, 0.012, "base-tip");
    gb(ST, -0.04, -0.032, -0.162, -0.152, 0.005, "lanyard-loop");
    side(ST, 500, 512, 232, 242, 0.004, { x: -0.022, name: "mag-release" });

    // suppressor: grooved collar, two-tone body stacked for a rounded section, ringed cap, bore
    side(D, 772, 830, 174, 214, 0.019, { name: "sup-collar" });
    side(D, 772, 830, 170, 218, 0.013);
    for (let i = 0; i < 3; i++) side(ME, 793 + i * 8, 797 + i * 8, 172, 216, 0.0195, { name: "collar-groove" });
    side(SI, 830, 996, 172, 196, 0.019, { name: "sup-body" });
    side(SI, 830, 996, 168, 196, 0.013);
    side(D, 830, 996, 196, 216, 0.019);
    side(D, 830, 996, 196, 220, 0.013);
    side(PA, 840, 990, 175, 178, 0.0195, { name: "sup-highlight" });
    for (const px of [870, 930]) side(ST, px, px + 5, 186, 191, 0.0195, { name: "sup-screw" });
    side(ME, 996, 1036, 172, 216, 0.019, { name: "sup-cap" });
    side(ME, 996, 1036, 168, 220, 0.013);
    side(D, 1004, 1018, 170, 218, 0.0195, { name: "cap-ring" });
    side(D, 1004, 1018, 166, 222, 0.0135);
    side(D, 1035, 1039, 186, 202, 0.007, { name: "muzzle-bore" });

    g.name = "dfdf-ghost";
    g.userData.weaponModel = "dfdf-ghost";
    g.userData.design = { key: "silenced", revision: 1 };
    g.userData.anchors = { muzzle: [0, Y(194), Z(1039)] };
    return g;
  }

  // ── 셰리프 (revolver): the chrome fluted cylinder in a pale frame, the hammer and its hump at the back, the long
  // barrel with a pale top rib, a dark band with the silver ejector rod, a slanted shroud and a toothed
  // underlug, a gold front sight, the round trigger guard, and the fat rubber grip with a silver backstrap,
  // finger bumps and a blue tip ──
  function sheriff() {
    const k = kit({ S: 942, px0: 362, py0: 112, z0: 0.25, y0: 0.209 }), { g, side, bar, Z, Y } = k;
    const P = M.poly(), PL = M.polyLite(), ME = M.metal(), ST = M.steel(), PA = M.panel(), D = M.dark(), SI = M.silver(), CH = M.chrome(), BR = M.brass(), BL = M.blue();

    // frame around the cylinder, rear block, top strap with its pale line and rear notch
    side(ME, 512, 690, 120, 262, 0.026, { name: "frame" });
    side(SI, 462, 566, 128, 262, 0.026, { name: "frame-rear" });
    // the rear frame sweeps down and back into the grip, with pale edges along the sweep
    side(SI, 440, 566, 205, 292, 0.0275, { name: "frame-sweep" });
    bar(PA, 420, 214, 530, 298, 0.007, 0.0282, "sweep-edge");
    bar(PA, 430, 204, 470, 140, 0.007, 0.0272, "hump-edge");
    side(D, 456, 548, 248, 252, 0.028);
    side(D, 506, 566, 213, 248, 0.0279, { name: "frame-recess" });
    side(ME, 512, 1036, 118, 130, 0.022, { name: "top-strap" });
    side(PA, 518, 1030, 117, 120, 0.0225);
    side(D, 518, 540, 113, 120, 0.008, { name: "rear-sight" });
    side(D, 526, 532, 113, 117, 0.0085);
    for (const [px, py] of [[478, 145], [478, 240], [540, 240], [668, 252]]) side(ST, px, px + 7, py, py + 7, 0.0265, { name: "frame-screw" });
    side(D, 470, 560, 205, 210, 0.0265, { name: "side-line" });

    // hammer: a hump behind the frame and the spur
    side(SI, 448, 516, 138, 205, 0.022, { name: "hammer-hump" });
    side(PA, 452, 512, 138, 144, 0.0225);
    bar(ME, 470, 160, 424, 182, 0.026, 0.011, "hammer");
    for (let i = 0; i < 4; i++) bar(D, 466 - i * 10, 158 + i * 5, 461 - i * 10, 162 + i * 5, 0.006, 0.0115);
    side(D, 420, 446, 176, 196, 0.011, { name: "hammer-spur" });

    // cylinder: chrome, stacked for a round section, two dark flute bands, dark rims, latch arrow
    side(CH, 566, 686, 142, 250, 0.047, { name: "cylinder" });
    side(CH, 566, 686, 134, 258, 0.033);
    for (const [a, b] of [[174, 190], [227, 242]]) {
      side(D, 568, 684, a, b, 0.0475, { name: "flute" });
      side(D, 568, 684, a - 4, b + 4, 0.0335);
    }
    side(D, 566, 571, 136, 256, 0.0478, { name: "cyl-rim" });
    side(D, 681, 686, 136, 256, 0.0478);
    side(PA, 580, 670, 145, 150, 0.0477, { name: "cyl-shine" });
    side(D, 588, 606, 176, 188, 0.0482, { name: "latch" });
    side(CH, 592, 600, 179, 185, 0.0485);
    side(ST, 686, 700, 186, 200, 0.012, { name: "crane" });

    // barrel: upper with a pale rib and vent slots, dark band with the ejector rod, shroud, underlug, bore, sights
    side(SI, 686, 1040, 128, 182, 0.024, { name: "barrel" });
    side(PA, 686, 1040, 128, 141, 0.0245, { name: "top-rib" });
    for (let i = 0; i < 7; i++) side(D, 712 + i * 40, 730 + i * 40, 125, 128, 0.012, { name: "rib-vent" });
    side(D, 700, 936, 180, 210, 0.025, { name: "dark-band" });
    side(CH, 700, 808, 189, 198, 0.026, { name: "ejector-rod" });
    side(ST, 806, 818, 186, 200, 0.0262);
    side(SI, 930, 1040, 140, 212, 0.026, { name: "shroud" });
    bar(SI, 960, 146, 934, 210, 0.006, 0.0265, "shroud-bevel");
    side(PA, 940, 1036, 141, 145, 0.0262);
    side(D, 700, 1022, 210, 228, 0.022, { name: "underlug" });
    for (let i = 0; i < 7; i++) side(ME, 808 + i * 30, 828 + i * 30, 228, 236, 0.02, { name: "lug-tooth" });
    bar(PA, 700, 272, 745, 228, 0.008, 0.0255, "frame-edge");
    side(ME, 690, 742, 228, 262, 0.024, { name: "frame-front" });
    side(D, 1036, 1041, 148, 174, 0.012, { name: "muzzle-bore" });
    side(ST, 1034, 1040, 142, 180, 0.02, { name: "crown" });
    side(ME, 976, 1030, 115, 128, 0.008, { name: "front-sight" });
    side(BR, 988, 1004, 111, 117, 0.0065);

    // trigger guard and trigger
    bar(SI, 548, 258, 556, 316, 0.012, 0.008, "guard-rear");
    side(SI, 554, 640, 316, 328, 0.008, { name: "guard-bottom" });
    bar(SI, 638, 326, 662, 262, 0.012, 0.008, "guard-front");
    bar(CH, 594, 258, 604, 304, 0.009, 0.004, "trigger");
    side(ST, 588, 600, 252, 260, 0.027);

    // grip: fat rubber, silver backstrap, finger bumps, a stippled panel, a blue tip on the base
    const grip = new T.Group();
    grip.position.set(0, Y(256), Z(500));
    grip.rotation.x = -0.47;
    g.add(grip);
    const gb = (m, a, b, y0, y1, w, name) => {
      const mesh = new T.Mesh(BOX, m);
      mesh.scale.set(2 * w, y1 - y0, b - a);
      mesh.position.set(0, (y0 + y1) / 2, (a + b) / 2);
      name && (mesh.name = name);
      grip.add(mesh);
      return mesh;
    };
    gb(P, -0.055, 0.05, -0.185, 0.01, 0.033, "grip");
    gb(PA, -0.062, -0.052, -0.178, 0.01, 0.03, "backstrap");
    for (let i = 0; i < 3; i++) gb(P, 0.048, 0.06, -0.06 - i * 0.045, -0.032 - i * 0.045, 0.031, "finger-bump");
    gb(D, -0.042, 0.04, -0.158, -0.03, 0.0335, "panel-border");
    gb(PL, -0.04, 0.038, -0.156, -0.032, 0.0338, "grip-panel");
    for (let r = 0; r < 7; r++) for (let c = 0; c < 4; c++) gb(D, -0.034 + c * 0.019 + (r % 2) * 0.009, -0.03 + c * 0.019 + (r % 2) * 0.009, -0.04 - r * 0.016, -0.036 - r * 0.016, 0.0342, "stipple");
    gb(ST, -0.004, 0.006, -0.11, -0.1, 0.0345, "grip-screw");
    gb(D, -0.062, 0.058, -0.2, -0.183, 0.034, "grip-base");
    gb(BL, 0.04, 0.058, -0.196, -0.178, 0.02, "base-tip");

    g.name = "dfdf-sheriff";
    g.userData.weaponModel = "dfdf-sheriff";
    g.userData.design = { key: "revolver", revision: 1 };
    g.userData.anchors = { muzzle: [0, Y(161), Z(1041)] };
    return g;
  }

  // ── 저지 (autoshot): the tall butt with a slanted leg and a long beam rising to the receiver, the upper barrel
  // with four slanted vents and tall sights, the magazine tube under it with a pale top line, the pale muzzle
  // and ring, the raked grip, and the wide box drum showing three rows of brass-and-red shells ──
  function judge() {
    const k = kit({ S: 550, px0: 361, py0: 178, z0: 0.25, y0: 0.215 }), { g, side, bar, Z, Y } = k;
    const P = M.poly(), PL = M.polyLite(), ME = M.metal(), ST = M.steel(), PA = M.panel(), D = M.dark(), R = M.rubber(), SI = M.silver(), BR = M.brass(), SH = M.shell(), GD = M.gold();

    // stock: butt pad, slanted leg, beam with a pale top line, rising to the receiver, sling loop
    side(R, 361, 372, 208, 325, 0.03, { name: "butt-pad" });
    for (let i = 0; i < 8; i++) side(D, 360, 362, 216 + i * 13, 221 + i * 13, 0.026);
    side(P, 372, 390, 208, 270, 0.028, { name: "butt" });
    bar(P, 382, 323, 410, 268, 0.022, 0.024, "stock-leg");
    side(P, 372, 392, 300, 325, 0.026);
    side(P, 388, 572, 213, 268, 0.026, { name: "stock-beam" });
    side(PA, 388, 572, 214, 218, 0.0265, { name: "beam-line" });
    side(D, 400, 560, 248, 251, 0.0265);
    for (const px of [452, 520]) side(D, px, px + 28, 226, 240, 0.0265, { name: "beam-cut" });
    bar(P, 570, 216, 634, 206, 0.02, 0.026, "stock-rise");
    side(P, 570, 634, 214, 268, 0.026);
    side(ME, 540, 560, 268, 276, 0.02, { name: "sling-loop" });

    // receiver: body, pale top line, rear sight, ejection port, bolt handle, selector, screws
    side(PL, 632, 782, 203, 270, 0.03, { name: "receiver" });
    side(ME, 632, 1000, 203, 209, 0.022, { name: "top-strip" });
    side(PA, 632, 1000, 205, 208, 0.0225, { name: "top-line" });
    side(ME, 646, 668, 180, 203, 0.012, { name: "rear-sight" });
    side(D, 652, 662, 184, 192, 0.0125);
    side(D, 690, 760, 214, 232, 0.0302, { name: "ejection-port" });
    side(ST, 760, 774, 218, 228, 0.04, { x: 0.012, name: "bolt-handle" });
    side(ME, 650, 672, 240, 248, 0.004, { x: -0.031, name: "selector" });
    for (const [px, py] of [[640, 212], [640, 256], [772, 256]]) side(ST, px, px + 6, py, py + 6, 0.0303, { name: "screw" });
    side(D, 632, 782, 258, 261, 0.0302);

    // upper barrel: tube with slanted vents, front sight with ears; muzzle cylinder and ring
    side(ME, 685, 1000, 209, 236, 0.022, { name: "upper-barrel" });
    side(ME, 685, 1000, 205, 240, 0.015);
    for (let i = 0; i < 4; i++) bar(PA, 896 + i * 16, 230, 906 + i * 16, 212, 0.004, 0.0225, "vent");
    side(ME, 976, 996, 182, 205, 0.008, { name: "front-sight" });
    side(ST, 984, 988, 178, 186, 0.004);
    side(SI, 998, 1036, 208, 236, 0.016, { name: "muzzle" });
    side(SI, 998, 1036, 204, 240, 0.011);
    side(D, 1008, 1016, 205, 239, 0.0165, { name: "muzzle-ring" });
    side(D, 1034, 1039, 214, 230, 0.008, { name: "muzzle-bore" });

    // magazine tube under the barrel: pale top line, a light stud, rail under, end cap
    side(P, 782, 1000, 237, 280, 0.024, { name: "tube" });
    side(P, 782, 1000, 241, 276, 0.03);
    side(PA, 782, 1000, 237, 243, 0.0245, { name: "tube-line" });
    side(SI, 788, 798, 248, 258, 0.0302, { name: "stud" });
    for (let i = 0; i < 8; i++) side(D, 806 + i * 22, 818 + i * 22, 276, 282, 0.02, { name: "tube-rail" });
    side(ME, 996, 1022, 240, 266, 0.018, { name: "tube-cap" });
    side(ME, 680, 785, 236, 246, 0.0245);

    // grip and trigger guard
    const grip = new T.Group();
    grip.position.set(0, Y(268), Z(566));
    grip.rotation.x = -0.5;
    g.add(grip);
    const gb = (m, a, b, y0, y1, w, name) => {
      const mesh = new T.Mesh(BOX, m);
      mesh.scale.set(2 * w, y1 - y0, b - a);
      mesh.position.set(0, (y0 + y1) / 2, (a + b) / 2);
      name && (mesh.name = name);
      grip.add(mesh);
      return mesh;
    };
    gb(P, -0.034, 0.03, -0.17, 0, 0.021, "grip");
    gb(PL, -0.026, 0.022, -0.152, -0.014, 0.0215, "grip-panel");
    for (let i = 0; i < 8; i++) gb(D, -0.022, 0.018, -0.024 - i * 0.016, -0.021 - i * 0.016, 0.022, "grip-rib");
    for (let i = 0; i < 3; i++) gb(PL, 0.028, 0.036, -0.04 - i * 0.04, -0.02 - i * 0.04, 0.02, "finger-bump");
    gb(D, -0.038, 0.034, -0.182, -0.168, 0.0215, "grip-cap");
    bar(ME, 584, 268, 588, 302, 0.01, 0.008, "guard-rear");
    side(ME, 586, 644, 300, 308, 0.008, { name: "guard-bottom" });
    bar(ME, 644, 306, 656, 270, 0.01, 0.008, "guard-front");
    bar(ST, 608, 272, 616, 296, 0.008, 0.004, "trigger");

    // drum: a cylinder lying along the barrel, round across (stacked slabs whose width follows the circle), rims
    // at both ends, a window on each side showing three round shells (brass back, red front), spokes and a hub
    // on the front face, a pale feed cap on top
    const zb = Z(660), zf = Z(782), cy = Y(323), RD = 0.1, n = 11, h = (2 * RD) / n;
    const box = (m, x0, x1, y0, y1, z0, z1, name) => k.add(m, x0, x1, y0, y1, Math.min(z0, z1), Math.max(z0, z1), 0, name);
    const halfAt = (dy) => RD * Math.sqrt(Math.max(0, 1 - (dy / RD) * (dy / RD)));
    const zs = Z(686), zm = Z(704), ze = Z(752);
    for (let i = 0; i < n; i++) {
      const y0 = cy - RD + i * h, y1 = y0 + h, dy = Math.min(Math.abs(y0 - cy), Math.abs(y1 - cy)), w = halfAt(dy);
      // the middle slabs are set in where the shells show, so the shells sit in a recess on each side
      if (Math.abs((y0 + y1) / 2 - cy) < 0.07) {
        box(D, -w + 0.006, w - 0.006, y0, y1, zs, zb - 0.018, "drum");
        box(D, -w + 0.006, w - 0.006, y0, y1, zf + 0.018, ze, "drum");
        box(D, -w + 0.044, w - 0.044, y0, y1, ze, zs, "drum-recess");
      } else box(D, -w + 0.006, w - 0.006, y0, y1, zf + 0.018, zb - 0.018, "drum");
      box(ME, -w, w, y0, y1, zf, zf + 0.018, "drum-rim");
      box(ME, -w, w, y0, y1, zb - 0.018, zb, "drum-rim");
      box(D, -w + 0.012, w - 0.012, y0, y1, zf - 0.004, zf, "drum-face");
    }
    // the side windows: three shells each, two blocks apiece so they read round, with dark slats between
    for (const sx of [-1, 1]) {
      for (let r = -1; r <= 1; r++) {
        const yc = cy + r * 0.045, w = halfAt(Math.abs(r * 0.045) + 0.02) - 0.004, sr = 0.0205;
        const xi = sx > 0 ? w - 2 * sr : -w, xo = sx > 0 ? w : -w + 2 * sr;
        box(GD, xi, xo, yc - sr * 0.7, yc + sr * 0.7, zm, zs, "shell-base");
        box(GD, xi + 0.004 * sx, xo - 0.004 * sx, yc - sr, yc + sr, zm, zs);
        box(SH, xi, xo, yc - sr * 0.7, yc + sr * 0.7, ze, zm, "shell");
        box(SH, xi + 0.004 * sx, xo - 0.004 * sx, yc - sr, yc + sr, ze, zm);
        box(PA, sx > 0 ? xo - 0.002 : xo - 0.001, sx > 0 ? xo + 0.001 : xo + 0.002, yc + sr * 0.35, yc + sr * 0.55, ze + 0.004, zm - 0.004, "shell-shine");
        if (r < 1) box(D, sx > 0 ? w - 0.03 : -w - 0.001, sx > 0 ? w + 0.001 : -w + 0.03, yc + 0.02, yc + 0.024, ze, zs, "window-slat");
      }
    }
    // spokes and a hub on the front face
    for (let i = 0; i < 6; i++) {
      const sp = new T.Mesh(BOX, ME);
      sp.scale.set(0.008, RD * 0.82, 0.004);
      const a = (i / 6) * Math.PI * 2;
      sp.position.set(Math.sin(a) * RD * 0.41, cy + Math.cos(a) * RD * 0.41, zf - 0.006);
      sp.rotation.z = -a;
      sp.name = "drum-spoke";
      g.add(sp);
    }
    box(ST, -0.016, 0.016, cy - 0.016, cy + 0.016, zf - 0.01, zf - 0.002, "drum-hub");
    box(D, -0.006, 0.006, cy - 0.006, cy + 0.006, zf - 0.012, zf - 0.01);
    // back face ring and the feed cap
    box(D, -0.06, 0.06, cy - 0.06, cy + 0.06, zb, zb + 0.004, "drum-back");
    side(SI, 690, 752, 262, 270, 0.03, { name: "drum-cap" });
    side(ME, 700, 742, 270, 276, 0.025);

    g.name = "dfdf-judge";
    g.userData.weaponModel = "dfdf-judge";
    g.userData.design = { key: "autoshot", revision: 1 };
    g.userData.anchors = { muzzle: [0, Y(222), Z(1039)] };
    return g;
  }

  // ── 오딘 (hmg): the open loop stock with a blue stripe, a deep butt block, the long receiver with a pale top
  // cover and a short rail, an open belt window on the right showing five rounds on their links, a side cover on
  // the left, the slanted lever reaching out and down on the right, a big ammo box under it, the long handguard
  // with slanted ribs in its top channel and a row of slots under, the gas tube and post, and the red brake ──
  function odin() {
    const k = kit({ S: 952, px0: 78, py0: 285, z0: 0.25, y0: 0.03 }), { g, side, bar, Z, Y } = k;
    const P = M.poly(), PL = M.polyLite(), ME = M.metal(), ST = M.steel(), PA = M.panel(), D = M.dark(), BL = M.blue(), SI = M.silver(), GD = M.gold(), CU = M.copper(), RE = M.red(), RL = M.redLite();
    // a block from one 3D point to another
    const bar3 = (m, a, b, sx, sy, name) => {
      const A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), mesh = new T.Mesh(BOX, m);
      mesh.scale.set(sx, sy, d.length());
      mesh.position.copy(A).add(B).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), d.normalize());
      name && (mesh.name = name);
      mesh.castShadow = !0;
      g.add(mesh);
      return mesh;
    };

    // stock: an open loop (top bar, slanted back, upright, slanted foot, bottom bar) with a blue stripe, then a
    // deep butt block whose underside slopes down to the receiver, with a pale inset and a screw
    bar(P, 150, 174, 226, 174, 0.02, 0.0175, "stock-top");
    bar(P, 158, 172, 86, 206, 0.022, 0.0175, "stock-back");
    side(P, 78, 100, 198, 250, 0.0175, { name: "stock-upright" });
    bar(P, 88, 244, 156, 274, 0.02, 0.0175, "stock-foot");
    side(P, 148, 232, 264, 283, 0.0175, { name: "stock-bottom" });
    side(BL, 98, 104, 212, 244, 0.018, { name: "stock-stripe" });
    side(D, 78, 80, 204, 246, 0.016);
    side(P, 222, 336, 160, 262, 0.037, { name: "butt-block" });
    for (let i = 0; i < 4; i++) {
      const a = 226 + i * 27, bot = 266 + (a + 13.5 - 226) * (42 / 108);
      side(P, a, a + 27, 250, bot, 0.035, { name: "butt-slope" });
    }
    side(PL, 246, 304, 180, 195, 0.0375, { name: "butt-inset" });
    side(D, 236, 326, 226, 229, 0.0375);
    side(ST, 302, 309, 165, 171, 0.0375, { name: "screw" });

    // receiver: body, pale top cover with its sloped back, rail and sight block, panel lines, chamfered nose,
    // pale front plate, screws
    side(P, 332, 692, 150, 292, 0.045, { name: "receiver" });
    side(PL, 340, 600, 172, 252, 0.0455, { name: "receiver-panel" });
    side(SI, 380, 612, 141, 158, 0.043, { name: "top-cover" });
    side(ME, 384, 608, 158, 162, 0.0435);
    bar(SI, 336, 160, 384, 146, 0.016, 0.042, "cover-slope");
    side(D, 332, 692, 258, 261, 0.0455);
    side(ST, 426, 524, 130, 141, 0.012, { name: "rail" });
    for (let i = 0; i < 6; i++) side(D, 432 + i * 15, 438 + i * 15, 130, 134, 0.0125, { name: "rail-slot" });
    side(D, 432, 476, 118, 130, 0.014, { name: "sight-block" });
    side(PA, 498, 520, 126, 131, 0.008, { name: "sight-mark" });
    side(P, 612, 692, 178, 292, 0.0445, { name: "receiver-nose" });
    bar(SI, 612, 156, 692, 192, 0.03, 0.044, "nose-slope");
    bar(ME, 618, 168, 690, 200, 0.012, 0.0448);
    side(PL, 620, 684, 206, 282, 0.0452);
    side(PA, 690, 703, 194, 284, 0.041, { name: "front-plate" });
    side(D, 694, 699, 206, 272, 0.0415);
    for (const [px, py] of [[346, 206], [370, 262], [556, 262], [664, 270]]) side(ST, px, px + 6, py, py + 6, 0.046, { name: "screw" });

    // left side cover with ribs and a round knob
    side(P, 398, 584, 166, 270, 0.028, { x: -0.068, name: "side-cover" });
    for (let i = 0; i < 5; i++) side(D, 412 + i * 30, 424 + i * 30, 182, 254, 0.0285, { x: -0.068, name: "cover-rib" });
    side(ST, 532, 556, 150, 172, 0.012, { x: -0.1, name: "knob" });
    side(ME, 538, 550, 172, 182, 0.008, { x: -0.096 });

    // right belt window: a housing with a frame and five rounds on their links, cases out of the window and
    // bullets pointing at the muzzle
    side(D, 396, 566, 162, 300, 0.012, { x: 0.057, name: "feed-back" });
    side(P, 396, 566, 160, 171, 0.035, { x: 0.08, name: "feed-frame" });
    side(P, 396, 566, 293, 302, 0.035, { x: 0.08 });
    side(P, 396, 406, 160, 302, 0.035, { x: 0.08 });
    side(P, 558, 568, 160, 302, 0.035, { x: 0.08 });
    for (let r = 0; r < 5; r++) {
      const py = 183 + r * 25, xc = 0.092, rr = 0.0105;
      side(GD, 408, 500, py - 7, py + 7, rr, { x: xc, name: "round-case" });
      side(GD, 408, 500, py - 10, py + 10, rr * 0.7, { x: xc });
      side(GD, 500, 510, py - 7, py + 7, rr * 0.7, { x: xc });
      side(CU, 510, 548, py - 6, py + 6, rr * 0.6, { x: xc, name: "round-bullet" });
      side(CU, 548, 556, py - 3, py + 3, rr * 0.3, { x: xc });
      side(ME, 424, 436, py - 11, py + 11, rr * 1.05, { x: xc, name: "belt-link" });
      side(ME, 466, 478, py - 11, py + 11, rr * 1.05, { x: xc });
      side(PA, 440, 498, py - 8, py - 6, 0.003, { x: xc + rr - 0.001, name: "round-shine" });
    }

    // right lever: from a hinge on the receiver reaching forward, out and down, with a blue edge and a foot
    side(ME, 566, 592, 170, 194, 0.012, { x: 0.052, name: "lever-hinge" });
    const a = [0.058, Y(180), Z(578)], b = [0.16, Y(316), Z(644)];
    const lv = bar3(PL, a, b, 0.016, 0.034, "lever");
    lv.rotateZ(Math.PI / 2);
    bar3(BL, [a[0] + 0.004, a[1], a[2] - 0.016], [b[0] + 0.004, b[1], b[2] - 0.016], 0.012, 0.006, "lever-stripe");
    const ft = [b[0] + (b[0] - a[0]) * 0.18, b[1] + (b[1] - a[1]) * 0.18, b[2] + (b[2] - a[2]) * 0.18];
    bar3(D, b, ft, 0.03, 0.036, "lever-cap");

    // ammo box: rounded all round. It is stacked from slabs; each slab is four blocks set along a quarter circle so
    // the upright corners read round, and the slabs near the bottom (and less at the top) draw in on every side
    // so the lower edges curve. The lid is rounded the same way; the lowest slabs are dark.
    const bW = 0.105, bz0 = Z(596), bz1 = Z(354), bTop = Y(292), bBot = Y(450), rB = 0.075, rT = 0.028, rV = 0.04;
    const box = (m, x, y0, y1, z0, z1, name) => k.add(m, -x, x, y0, y1, z0, z1, 0, name);
    const inset = (r, d) => (d >= r ? 0 : r - Math.sqrt(r * r - (r - d) * (r - d)));
    const round = (m, w, y0, y1, a, b, name) => {
      for (let j = 0; j < 4; j++) {
        const t = (j / 3) * (Math.PI / 2), ix = rV * (1 - Math.cos(t)), iz = rV * (1 - Math.sin(t));
        box(m, w - ix, y0, y1, a + iz, b - iz, j ? undefined : name);
      }
    };
    const nB = 22, hB = (bTop - bBot) / nB;
    for (let i = 0; i < nB; i++) {
      const y0 = bBot + i * hB, y1 = y0 + hB, mid = (y0 + y1) / 2;
      const ins = Math.max(inset(rB, mid - bBot), inset(rT, bTop - mid));
      round(mid < Y(428) ? D : PL, bW - ins, y0, y1, bz0 + ins, bz1 - ins, i ? "ammo-box" : "box-bottom");
    }
    // lid: a rounded plate a little wider than the box, with a metal lip
    for (const [y0, y1, ins] of [[Y(292), Y(287), 0.004], [Y(287), Y(282), 0], [Y(282), Y(279), 0.006]]) round(P, bW + 0.003 - ins, y0, y1, bz0 - 0.004 + ins, bz1 + 0.004 - ins, "box-lid");
    box(ME, bW + 0.0035, Y(292), Y(289), bz0 + rV, bz1 - rV, "box-lip");
    // inset side panel on the flat of the side, framed by corner plates
    side(P, 398, 552, 308, 376, 0.1055, { name: "box-panel" });
    for (const [px, py] of [[398, 308], [542, 308], [398, 366], [542, 366]]) side(ME, px, px + 10, py, py + 10, 0.1062, { name: "box-corner" });
    side(ME, 596, 606, 316, 384, 0.04, { name: "box-latch" });
    side(ST, 598, 606, 340, 360, 0.02);

    // handguard: rear collar with a slanted plate, body, a dark top channel with slanted ribs, a panel line,
    // a row of slots underneath, slanted nose
    side(P, 700, 792, 174, 292, 0.04, { name: "handguard-collar" });
    bar(ME, 744, 194, 802, 216, 0.012, 0.0405, "collar-plate");
    side(P, 700, 1040, 183, 272, 0.036, { name: "handguard" });
    side(D, 800, 1024, 186, 214, 0.0365, { name: "handguard-channel" });
    for (let i = 0; i < 4; i++) bar(ME, 816 + i * 58, 214, 838 + i * 58, 186, 0.006, 0.0367, "channel-rib");
    side(ME, 800, 1024, 183, 186, 0.034);
    side(D, 792, 1030, 240, 243, 0.0365);
    for (let i = 0; i < 8; i++) side(D, 808 + i * 20, 818 + i * 20, 254, 266, 0.0365, { name: "handguard-slot" });
    const nose = side(P, 1030, 1058, 192, 266, 0.032, { name: "handguard-nose" });
    nose.rotation.x = -0.42;

    // barrel, gas tube with joints, gas block and the front post
    side(ME, 1046, 1182, 196, 216, 0.011, { name: "barrel" });
    side(ST, 1046, 1168, 240, 262, 0.012, { name: "gas-tube" });
    for (const px of [1064, 1142]) side(ST, px, px + 8, 238, 264, 0.0135, { name: "tube-joint" });
    side(ME, 1092, 1128, 196, 262, 0.016, { name: "gas-block" });
    side(ME, 1096, 1126, 172, 196, 0.012, { name: "front-sight" });
    side(ST, 1104, 1118, 152, 172, 0.005);

    // red brake: a narrow neck, a tapered collar, the wide flat brake with two side slots and a dark crown
    side(RE, 1128, 1216, 198, 214, 0.009, { name: "brake-neck" });
    side(RE, 1180, 1214, 194, 222, 0.016, { name: "brake-collar" });
    side(RE, 1214, 1248, 191, 225, 0.026);
    side(RE, 1246, 1330, 188, 228, 0.035, { name: "muzzle-brake" });
    side(RL, 1250, 1330, 187, 192, 0.033, { name: "brake-top" });
    for (const px of [1258, 1292]) side(D, px, px + 22, 198, 220, 0.0355, { name: "brake-slot" });
    side(RE, 1246, 1252, 188, 228, 0.0356);
    side(D, 1328, 1333, 200, 216, 0.012, { name: "muzzle-bore" });

    g.name = "dfdf-odin";
    g.userData.weaponModel = "dfdf-odin";
    g.userData.design = { key: "hmg", revision: 1 };
    g.userData.anchors = { muzzle: [0, Y(208), Z(1333)] };
    return g;
  }

  // ── 아웃로 (marksman): a deep block stock with a rubber pad and a pale comb wedge, the raked wrist and pistol
  // grip, a looped trigger guard, the receiver with a pale band and an emblem, the long forend with its slanted
  // nose, two barrels one over the other with slots at the muzzle, and the scope on a short rail ──
  function outlaw() {
    const k = kit({ S: 829, px0: 52, py0: 281, z0: 0.25, y0: 0.03 }), { g, side, bar, Z, Y } = k;
    const P = M.poly(), PL = M.polyLite(), ME = M.metal(), ST = M.steel(), PA = M.panel(), D = M.dark(), R = M.rubber(), SI = M.silver(), BL = M.blue(), A = M.accent(), LE = M.lens();

    // stock: rubber pad, then slabs whose top climbs a little and whose underside rises steeply toward the
    // wrist, a pale comb wedge, a sling slot and two screws
    side(R, 52, 64, 278, 412, 0.031, { name: "butt-pad" });
    for (let i = 0; i < 6; i++) side(D, 51, 53, 290 + i * 20, 298 + i * 20, 0.028);
    for (let i = 0; i < 9; i++) {
      const a = 64 + i * 19, c = a + 9.5, top = 278 - (c - 64) * (20 / 171), bot = 410 - (c - 64) * (70 / 171);
      side(P, a, a + 19.5, top, bot - 36, 0.03, { name: "stock" });
    }
    // the underside is one long sloped block so it runs straight instead of in steps
    bar(P, 64, 380, 236, 310, 0.06, 0.03, "stock-belly");
    side(PL, 66, 232, 278, 284, 0.0305, { name: "stock-comb" });
    bar(PL, 222, 262, 264, 282, 0.02, 0.026, "comb-wedge");
    side(D, 96, 120, 318, 334, 0.0305, { name: "sling-slot" });
    for (const [px, py] of [[148, 328], [92, 366]]) side(ST, px, px + 6, py, py + 6, 0.031, { name: "screw" });
    side(BL, 64, 67, 300, 400, 0.0302, { name: "pad-line" });

    // wrist: slabs from the stock up to the receiver, the top dipping at the comb then rising, the underside
    // running down into the pistol grip; a pale line along the top; grip with ribs and a cap
    bar(P, 222, 292, 432, 240, 0.06, 0.024, "wrist");
    bar(P, 236, 318, 380, 276, 0.04, 0.023, "wrist-belly");
    bar(PL, 262, 264, 420, 214, 0.008, 0.0245, "wrist-top");
    bar(P, 312, 296, 290, 354, 0.044, 0.021, "grip");
    for (let i = 0; i < 4; i++) bar(D, 280 + i * -2, 306 + i * 11, 318 + i * -6, 306 + i * 11, 0.003, 0.0215, "grip-rib");
    bar(D, 270, 356, 308, 360, 0.012, 0.022, "grip-cap");

    // trigger guard loop, trigger, orange safety dot
    bar(ST, 384, 282, 396, 310, 0.008, 0.008, "guard-rear");
    side(ST, 394, 462, 304, 314, 0.008, { name: "guard-bottom" });
    bar(ST, 460, 312, 470, 278, 0.008, 0.008, "guard-front");
    bar(ST, 414, 280, 420, 300, 0.006, 0.004, "trigger");
    side(A, 452, 458, 282, 288, 0.026, { name: "safety-dot" });

    // receiver: body with a sloped back, pale band, top cover, emblem, a dark seam
    side(P, 410, 600, 210, 284, 0.033, { name: "receiver" });
    bar(P, 404, 232, 460, 210, 0.026, 0.032, "receiver-slope");
    side(SI, 488, 600, 224, 238, 0.0335, { name: "receiver-band" });
    side(D, 500, 590, 229, 233, 0.034);
    side(ME, 456, 600, 206, 212, 0.03, { name: "receiver-top" });
    side(ME, 562, 586, 246, 268, 0.0335, { name: "emblem" });
    side(D, 567, 581, 251, 263, 0.034);
    side(BL, 572, 576, 254, 260, 0.0342);
    side(D, 410, 600, 270, 273, 0.0335);
    for (const [px, py] of [[426, 252], [588, 276]]) side(ST, px, px + 5, py, py + 5, 0.0337, { name: "screw" });

    // forend: body, a seam under the barrels, three vent slots, slanted nose
    side(P, 598, 884, 212, 288, 0.038, { name: "forend" });
    side(D, 600, 882, 232, 235, 0.0385);
    side(D, 650, 870, 262, 264, 0.0385, { name: "forend-line" });
    side(PL, 600, 650, 238, 286, 0.0385, { name: "forend-band" });
    const nose = side(P, 876, 904, 214, 288, 0.034, { name: "forend-nose" });
    nose.rotation.x = 0.5;

    // barrels: upper and lower, each a dark tube with a pale top, a rib between, slots near the muzzle, the
    // front post and two dark bores
    for (const [t, b, name, m] of [[212, 232, "barrel-upper", SI], [240, 262, "barrel-lower", ME]]) {
      side(m, 600, 1340, t + 2, b, 0.014, { name });
      side(SI, 600, 1340, t, t + 5, 0.012);
      side(ST, 1262, 1342, t, b, 0.0155, { name: "muzzle" });
      side(D, 1340, 1344, t + 5, b - 4, 0.008, { name: "muzzle-bore" });
    }
    side(D, 880, 1336, 232, 240, 0.008, { name: "barrel-rib" });
    for (let i = 0; i < 3; i++) {
      side(D, 1270 + i * 17, 1280 + i * 17, 211, 218, 0.0158, { name: "muzzle-slot" });
      side(D, 1270 + i * 17, 1280 + i * 17, 256, 263, 0.0158);
    }
    side(ME, 1318, 1332, 204, 212, 0.004, { name: "front-post" });
    side(A, 1321, 1329, 199, 204, 0.004);

    // scope: rail and two mounts, eyepiece, tube, turret with a knob, objective bell, lens
    side(ME, 518, 706, 198, 210, 0.016, { name: "scope-rail" });
    for (let i = 0; i < 8; i++) side(D, 526 + i * 22, 532 + i * 22, 198, 201, 0.0165, { name: "rail-slot" });
    for (const px of [536, 664]) {
      side(ME, px, px + 18, 188, 200, 0.014, { name: "scope-mount" });
      side(ST, px - 2, px + 20, 184, 192, 0.026, { name: "scope-ring" });
    }
    // a round tube along the barrel: three crossed blocks so it reads round from the front
    const tube = (m, pa, pb, top, bot, name) => {
      const c = (top + bot) / 2, r = (bot - top) / 2;
      side(m, pa, pb, c - r, c + r, (r * 0.55) / 829, { name });
      side(m, pa, pb, c - r * 0.55, c + r * 0.55, r / 829);
      side(m, pa, pb, c - r * 0.85, c + r * 0.85, (r * 0.85) / 829);
    };
    tube(ST, 476, 512, 157, 196, "eyepiece");
    tube(SI, 476, 482, 155, 198);
    tube(D, 473, 477, 164, 188);
    tube(ST, 512, 586, 162, 190, "scope-tube");
    tube(D, 512, 518, 160, 192);
    tube(SI, 584, 614, 158, 194, "turret");
    side(ST, 590, 608, 150, 158, 0.012, { name: "turret-knob" });
    tube(ST, 592, 606, 164, 188);
    side(D, 596, 602, 170, 182, 0.0185);
    tube(ST, 612, 690, 156, 196, "objective");
    tube(D, 612, 618, 154, 198);
    tube(SI, 652, 656, 155, 197);
    const bell = side(SI, 686, 704, 153, 199, 0.0165, { name: "objective-bell" });
    bell.rotation.x = -0.18;
    side(SI, 686, 704, 160, 192, 0.027);
    tube(LE, 703, 706, 160, 192, "lens");

    g.name = "dfdf-outlaw";
    g.userData.weaponModel = "dfdf-outlaw";
    g.userData.design = { key: "marksman", revision: 1 };
    g.userData.anchors = { muzzle: [0, Y(222), Z(1344)] };
    return g;
  }

  // ── 오퍼레이터 (sniper): the tall butt plate, a pale cheek rest with a sloped nose, the open triangle under the
  // stock, the long flat body with a pale facet and a top rail, the bolt on the left, a raked grip, trigger guard,
  // box magazine, the long barrel with a thick end and a slotted brake, and the big scope with its turrets ──
  function operator() {
    const SC = 664, k = kit({ S: SC, px0: 44, py0: 279, z0: 0.25, y0: 0.03 }), { g, side, bar, Z, Y } = k;
    const P = M.poly(), PL = M.polyLite(), ME = M.metal(), ST = M.steel(), PA = M.panel(), D = M.dark(), R = M.rubber(), SI = M.silver(), BL = M.blue(), LE = M.lens();
    const tube = (m, pa, pb, top, bot, name, x) => {
      const c = (top + bot) / 2, r = (bot - top) / 2, o = { name, x: x || 0 };
      side(m, pa, pb, c - r, c + r, (r * 0.55) / SC, o);
      side(m, pa, pb, c - r * 0.55, c + r * 0.55, r / SC, { x: o.x });
      side(m, pa, pb, c - r * 0.85, c + r * 0.85, (r * 0.85) / SC, { x: o.x });
    };

    // butt: a tall plate with a rubber back and pale cap, ribs, a sling slot with a screw
    side(R, 44, 54, 210, 380, 0.04, { name: "butt-pad" });
    for (let i = 0; i < 7; i++) side(D, 43, 45, 222 + i * 22, 230 + i * 22, 0.036);
    side(P, 54, 92, 210, 380, 0.04, { name: "butt-plate" });
    side(SI, 44, 92, 203, 212, 0.039, { name: "butt-cap" });
    side(D, 96, 124, 326, 344, 0.0405, { name: "sling-slot" });
    side(ST, 104, 112, 330, 338, 0.041);

    // cheek rest: pale top with a sloped nose; stock beam under it
    side(SI, 88, 262, 198, 212, 0.036, { name: "cheek-rest" });
    bar(SI, 258, 203, 292, 214, 0.012, 0.035, "cheek-nose");
    side(PL, 88, 262, 212, 228, 0.037);
    side(P, 88, 410, 228, 266, 0.04, { name: "stock" });
    side(D, 100, 400, 246, 248, 0.0405);

    // the open triangle under the stock: top bar, upright, slanted brace, an inset panel and a pale diamond
    side(P, 92, 244, 266, 290, 0.036, { name: "stock-lower" });
    side(P, 92, 128, 290, 378, 0.038, { name: "stock-upright" });
    bar(P, 248, 282, 124, 372, 0.04, 0.036, "stock-brace");
    side(D, 128, 200, 290, 316, 0.03, { name: "stock-web" });
    side(PA, 138, 146, 300, 308, 0.0365, { name: "stock-diamond" });

    // body: long upper with a pale facet, lower section, sloped front, screws; top rail with slots and dots
    side(P, 300, 868, 228, 266, 0.04, { name: "body" });
    side(P, 300, 870, 266, 292, 0.038, { name: "body-lower" });
    bar(PL, 400, 246, 632, 258, 0.01, 0.0405, "body-facet");
    side(PL, 632, 860, 250, 258, 0.0405, { name: "forend-line" });
    side(D, 300, 860, 266, 268, 0.0405);
    const nose = side(P, 852, 880, 232, 292, 0.036, { name: "body-nose" });
    nose.rotation.x = 0.4;
    side(PA, 650, 657, 252, 259, 0.041, { name: "diamond" });
    for (const [px, py] of [[316, 238], [612, 276]]) side(ST, px, px + 5, py, py + 5, 0.0408, { name: "screw" });
    side(ME, 392, 842, 212, 228, 0.03, { name: "top-rail" });
    side(D, 392, 842, 226, 228, 0.0305);
    for (let i = 0; i < 22; i++) side(D, 400 + i * 20, 408 + i * 20, 212, 215, 0.0305, { name: "rail-slot" });
    for (let i = 0; i < 5; i++) side(BL, 600 + i * 18, 606 + i * 18, 206, 211, 0.012, { name: "rail-dot" });
    side(ME, 420, 830, 206, 212, 0.022);

    // bolt on the left: body, a lever reaching out and a round knob
    side(ME, 446, 496, 226, 246, 0.008, { x: -0.046, name: "bolt" });
    bar(ST, 470, 236, 482, 262, 0.01, 0.008, "bolt-lever").position.x = -0.064;
    side(SI, 474, 494, 256, 276, 0.012, { x: -0.07, name: "bolt-knob" });

    // grip: raked, finger bumps on the front, ribs, cap
    bar(P, 344, 294, 318, 404, 0.086, 0.023, "grip");
    for (let i = 0; i < 3; i++) bar(PL, 366 - i * 7, 318 + i * 26, 362 - i * 7, 332 + i * 26, 0.014, 0.022, "finger-bump");
    for (let i = 0; i < 5; i++) bar(D, 322 - i * 5.5, 322 + i * 16, 338 - i * 5.5, 322 + i * 16, 0.002, 0.0232, "grip-rib");
    bar(D, 284, 406, 350, 414, 0.012, 0.024, "grip-cap");

    // trigger guard and trigger
    bar(ST, 382, 292, 390, 334, 0.008, 0.008, "guard-rear");
    side(ST, 388, 446, 330, 340, 0.008, { name: "guard-bottom" });
    side(ST, 440, 448, 292, 340, 0.008, { name: "guard-front" });
    bar(ST, 404, 294, 410, 318, 0.006, 0.004, "trigger");

    // box magazine with ribs and a pale base plate
    side(P, 476, 590, 292, 348, 0.03, { name: "magazine" });
    for (let i = 0; i < 2; i++) side(D, 484, 582, 308 + i * 18, 310 + i * 18, 0.0305, { name: "mag-rib" });
    side(PL, 472, 594, 346, 356, 0.032, { name: "mag-base" });

    // barrel: pale top, a thick end section, and the brake with three slots and a dark bore
    side(ME, 820, 1236, 220, 232, 0.013, { name: "barrel" });
    side(SI, 820, 1236, 212, 222, 0.013);
    side(SI, 840, 1236, 211, 221, 0.0115, { name: "barrel-top" });
    side(D, 880, 1150, 223, 225, 0.0132);
    side(ME, 1160, 1236, 208, 236, 0.017, { name: "barrel-end" });
    side(SI, 1160, 1236, 207, 211, 0.015);
    side(ST, 1232, 1352, 204, 240, 0.024, { name: "muzzle-brake" });
    side(SI, 1232, 1352, 203, 207, 0.022);
    for (let i = 0; i < 3; i++) side(D, 1290 + i * 18, 1302 + i * 18, 210, 234, 0.0245, { name: "brake-slot" });
    side(D, 1350, 1354, 212, 232, 0.012, { name: "muzzle-bore" });

    // scope: two mounts, eyepiece with a pale ring, tube with rings, top and left turrets, objective cone,
    // bell, lens
    for (const px of [484, 694]) {
      side(ME, px, px + 18, 192, 208, 0.016, { name: "scope-mount" });
      side(ST, px - 2, px + 20, 190, 196, 0.03, { name: "scope-ring" });
    }
    tube(ME, 462, 546, 155, 200, "eyepiece");
    tube(SI, 460, 474, 153, 202);
    tube(D, 458, 461, 164, 192);
    tube(D, 540, 548, 160, 196);
    tube(ME, 546, 702, 165, 193, "scope-tube");
    for (const px of [560, 650]) tube(D, px, px + 16, 163, 195, "tube-ring");
    tube(ME, 598, 632, 158, 199, "turret");
    tube(ST, 604, 626, 162, 195);
    side(ST, 606, 626, 146, 158, 0.014, { name: "turret-knob" });
    side(D, 606, 626, 150, 152, 0.0145);
    side(ST, 604, 628, 168, 190, 0.012, { x: -0.034, name: "side-turret" });
    side(D, 604, 628, 176, 182, 0.0125, { x: -0.04 });
    tube(ST, 702, 718, 161, 197, "objective-cone");
    tube(SI, 716, 800, 155, 201, "objective");
    tube(D, 760, 766, 154, 202);
    const bell = side(SI, 796, 812, 155, 201, 0.019, { name: "objective-bell" });
    bell.rotation.x = -0.2;
    tube(LE, 810, 813, 160, 196, "lens");

    g.name = "dfdf-operator";
    g.userData.weaponModel = "dfdf-operator";
    g.userData.design = { key: "sniper", revision: 1 };
    g.userData.anchors = { muzzle: [0, Y(222), Z(1354)] };
    return g;
  }

  // ── 기관권총 (machpist): our own compact machine pistol, kept to the old size (0.06 × 0.33 × 0.37 m). A steel
  // slide with front and rear serrations, a vented top, an open ejection port with a round in it and three-dot
  // sights; a compensator with top ports; a polymer frame with a rail under the dust cover, slide stop and an
  // orange fire selector; a squared trigger guard; a raked, stippled grip with a beavertail; the long magazine
  // with ribs, a witness window and an orange base. Units: px = millimetres from the back of the slide, py =
  // millimetres down from the top of the sights. ──
  function machpist() {
    const k = kit({ S: 1000, px0: 0, py0: 0, z0: 0.093, y0: 0.101 }), { g, side, bar, Z, Y } = k;
    const P = M.poly(), PL = M.polyLite(), ME = M.metal(), ST = M.steel(), PA = M.panel(), D = M.dark(), R = M.rubber(), A = M.accent(), BR = M.brass(), SI = M.silver();

    // slide: body with a chamfered back and nose, a pale line, rear and front serrations, vented top, port
    side(ST, 14, 318, 8, 48, 0.0135, { name: "slide" });
    bar(ST, 8, 14, 16, 46, 0.012, 0.013, "slide-back");
    bar(ST, 316, 12, 326, 44, 0.012, 0.013, "slide-nose");
    side(SI, 14, 318, 7, 10, 0.012, { name: "slide-top" });
    side(PA, 20, 312, 34, 36, 0.0137, { name: "slide-line" });
    for (let i = 0; i < 7; i++) side(D, 24 + i * 8, 28 + i * 8, 14, 44, 0.0138, { name: "slide-serration" });
    for (let i = 0; i < 4; i++) side(D, 262 + i * 8, 266 + i * 8, 18, 44, 0.0138, { name: "slide-serration" });
    for (let i = 0; i < 5; i++) side(D, 214 + i * 9, 220 + i * 9, 6.5, 9, 0.007, { name: "top-vent" });
    side(D, 130, 196, 9, 26, 0.0025, { x: 0.0118, name: "ejection-port" });
    side(BR, 140, 186, 13, 22, 0.0012, { x: 0.0138, name: "chamber-round" });
    side(BR, 186, 192, 15, 20, 0.0008, { x: 0.0138 });
    side(D, 18, 300, 46, 48, 0.0136);

    // sights: rear with two ears and white dots, front post with an orange dot
    side(D, 18, 40, 0, 8, 0.011, { name: "rear-sight" });
    side(D, 26, 32, 0, 5, 0.0112);
    for (const x of [-0.007, 0.007]) side(PA, 40, 41, 2, 5, 0.0015, { x, name: "sight-dot" });
    side(D, 296, 308, 1, 8, 0.004, { name: "front-sight" });
    side(A, 308, 309, 2.5, 5.5, 0.0018, { name: "sight-dot" });

    // compensator: block on the nose with three top ports, side slots, a pale ring and the bore
    side(ME, 318, 364, 12, 46, 0.0145, { name: "compensator" });
    side(SI, 318, 324, 11, 47, 0.015, { name: "comp-ring" });
    for (let i = 0; i < 3; i++) {
      side(D, 330 + i * 10, 336 + i * 10, 11, 14, 0.008, { name: "comp-port" });
      side(D, 330 + i * 10, 336 + i * 10, 18, 40, 0.0146);
    }
    side(D, 363, 366, 22, 36, 0.006, { name: "muzzle-bore" });

    // frame: body under the slide, dust cover with a three-slot rail, slide stop, takedown pin, orange
    // selector at the back, a pale panel line
    side(P, 18, 318, 48, 76, 0.0125, { name: "frame" });
    side(PL, 236, 318, 48, 70, 0.0128, { name: "dust-cover" });
    side(P, 240, 316, 70, 80, 0.011, { name: "accessory-rail" });
    for (let i = 0; i < 3; i++) side(D, 250 + i * 22, 262 + i * 22, 77, 80, 0.0112, { name: "rail-slot" });
    side(D, 236, 318, 62, 63, 0.0129);
    side(ME, 150, 206, 50, 55, 0.0132, { name: "slide-stop" });
    side(ME, 196, 206, 50, 60, 0.0134);
    side(ST, 222, 228, 55, 61, 0.0132, { name: "takedown-pin" });
    side(PL, 60, 226, 52, 74, 0.0128, { name: "frame-panel" });
    side(D, 60, 226, 63, 64, 0.0129);
    for (const px of [72, 214]) side(ST, px, px + 5, 66, 71, 0.013, { name: "frame-pin" });
    side(A, 36, 54, 52, 60, 0.0145, { name: "selector" });
    side(D, 42, 48, 54, 58, 0.015);

    // trigger guard: squared, flat front with grooves; trigger
    side(P, 104, 184, 116, 124, 0.0085, { name: "guard-bottom" });
    side(P, 176, 186, 76, 124, 0.0085, { name: "guard-front" });
    for (let i = 0; i < 3; i++) side(D, 184, 186.5, 86 + i * 10, 90 + i * 10, 0.007, { name: "guard-groove" });
    bar(ME, 136, 76, 142, 106, 0.007, 0.004, "trigger");
    side(ME, 132, 142, 104, 108, 0.004);

    // grip and magazine: raked back, built in the grip's own frame (z forward is minus, y up)
    const grip = new T.Group();
    grip.position.set(0, Y(76), Z(84));
    grip.rotation.x = -0.26;
    g.add(grip);
    const gb = (m, a, b, y0, y1, w, name) => {
      const mesh = new T.Mesh(BOX, m);
      mesh.scale.set(2 * w, y1 - y0, b - a);
      mesh.position.set(0, (y0 + y1) / 2, (a + b) / 2);
      name && (mesh.name = name);
      grip.add(mesh);
      return mesh;
    };
    gb(P, -0.032, 0.03, -0.13, 0, 0.0155, "grip");
    gb(P, 0.026, 0.05, -0.012, 0.02, 0.013, "beavertail");
    // stippled panels and finger grooves on the front
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) gb(R, -0.018 + c * 0.015, -0.009 + c * 0.015, -0.032 - r * 0.018, -0.024 - r * 0.018, 0.0162, "stipple");
    for (let i = 0; i < 3; i++) gb(PL, -0.038, -0.03, -0.035 - i * 0.03, -0.018 - i * 0.03, 0.014, "finger-groove");
    gb(D, -0.028, 0.026, -0.124, -0.118, 0.016, "grip-band");
    // the long magazine below the grip: body, ribs, a witness window with brass behind it, orange base
    gb(ME, -0.026, 0.022, -0.235, -0.128, 0.0115, "extended-magazine");
    for (let i = 0; i < 4; i++) gb(D, -0.027, 0.023, -0.148 - i * 0.022, -0.144 - i * 0.022, 0.0118, "mag-rib");
    gb(D, -0.004, 0.012, -0.226, -0.15, 0.0118, "mag-window");
    gb(BR, -0.001, 0.009, -0.222, -0.154, 0.0119, "mag-rounds");
    gb(A, -0.03, 0.026, -0.25, -0.235, 0.0135, "magazine-floorplate");
    gb(D, -0.03, 0.026, -0.252, -0.249, 0.0138);

    // the old model was twice as thick; the parts are drawn slim and the whole body is widened to match it
    const body = new T.Group();
    body.name = "machpist-body";
    body.scale.x = 1.7;
    while (g.children.length) body.add(g.children[0]);
    g.add(body);

    g.name = "dfdf-machpist";
    g.userData.weaponModel = "dfdf-machpist";
    g.userData.design = { key: "machpist", revision: 1 };
    g.userData.anchors = { muzzle: [0, Y(29), Z(366)] };
    return g;
  }

  // ── 기본 칼 (knife, the stock one; the knife skins keep their own builds): a drop-point combat knife kept to the
  // old size (0.05 × 0.12 × 0.71 m) and the old grip place. A two-tone blade, black-coated above the grind line
  // and bright on the edge bevel, with a fuller, jimping on the spine, serrations by the guard, a choil and an
  // orange mark; a double guard; a shaped handle with a rubber inlay, grooves and a finger guard; a pommel with
  // a glass breaker and an orange lanyard. Units: px = mm from the back of the pommel, py = mm down from the
  // top of the guard. ──
  function knife() {
    const k = kit({ S: 1000, px0: 0, py0: 0, z0: 0.273, y0: 0.05 }), { g, side, Z, Y } = k;
    const P = M.poly(), PL = M.polyLite(), ME = M.metal(), ST = M.steel(), PA = M.panel(), D = M.dark(), R = M.rubber(), A = M.accent(), SI = M.silver(), CH = M.chrome();
    const lerp = (x, pts) => {
      for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) return pts[i - 1][1] + ((x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0])) * (pts[i][1] - pts[i - 1][1]);
      return pts[pts.length - 1][1];
    };

    // blade: slabs across its length; each one is the coated flat from the spine to the grind line and the bright
    // bevel from there to the edge, thinner toward the edge
    const top = (px) => (px < 540 ? 16 : 16 + 44 * Math.pow((px - 540) / 172, 1.6));
    const bot = (px) => (px < 288 ? 70 : px < 296 ? 84 - ((296 - px) / 8) * 14 : px < 500 ? 84 : 84 - 24 * Math.pow((px - 500) / 212, 2.2));
    // slabs whose shape matches their neighbour's are joined into one block, so the flat stretches have no seams
    const runs = [];
    for (let px = 268; px < 712; px += 6) {
      const c = Math.min(px + 3, 711), t = Math.round(top(c)), b = Math.round(bot(c));
      if (b - t < 1) continue;
      const last = runs[runs.length - 1];
      if (last && last.t === t && last.b === b && last.b1 === px) last.b1 = px + 6;
      else runs.push({ a: px, b1: px + 6, t, b });
    }
    for (const r of runs) {
      const gr = r.t + (r.b - r.t) * 0.52, e = r.b1 + 0.5;
      side(ME, r.a, e, r.t, gr, 0.0072, { name: "blade-flat" });
      side(SI, r.a, e, gr, r.b, 0.0042, { name: "blade-bevel" });
      side(CH, r.a, e, r.b - 2, r.b, 0.0016, { name: "blade-edge" });
    }
    side(ST, 268, 540, 16, 18, 0.0068, { name: "blade-spine" });
    // fuller, jimping, serrations, orange mark, the choil's dark notch
    side(ST, 300, 500, 30, 36, 0.0075, { name: "fuller" });
    side(D, 300, 500, 36, 37, 0.0076);
    for (let i = 0; i < 7; i++) side(D, 292 + i * 8, 296 + i * 8, 15, 19, 0.0074, { name: "jimping" });
    for (let i = 0; i < 8; i++) side(D, 300 + i * 11, 305 + i * 11, 78, 84.5, 0.0046, { name: "serration" });
    side(A, 380, 470, 44, 46.5, 0.0074, { name: "blade-mark" });
    side(A, 380, 386, 41, 49, 0.0074);
    side(ST, 268, 296, 16, 70, 0.0078, { name: "ricasso" });
    side(D, 272, 292, 62, 64, 0.0079);

    // double guard: a steel plate with rounded ends and a dark seam
    for (const [t, b, w] of [[6, 114, 0.012], [10, 110, 0.016], [14, 106, 0.018]]) side(ST, 252, 268, t, b, w, { name: "guard" });
    side(D, 258, 262, 14, 106, 0.0182);

    // handle: slabs that follow its shape (a rear swell, a waist, a finger guard), a rubber inlay with grooves, a
    // pale bolster ring by the guard
    const hTop = [[22, 26], [80, 20], [160, 18], [252, 22]], hBot = [[22, 100], [70, 106], [130, 96], [205, 110], [236, 104], [252, 100]];
    for (let px = 22; px < 252; px += 8) {
      const c = px + 4, t = lerp(c, hTop), b = lerp(c, hBot);
      side(PL, px, px + 8.5, t, b, 0.0158, { name: "handle" });
      side(PL, px, px + 8.5, t + 4, b - 4, 0.0168);
      if (px >= 40 && px < 228) side(R, px, px + 8.5, t + 16, b - 16, 0.0174, { name: "handle-inlay" });
    }
    for (let i = 0; i < 9; i++) {
      const px = 46 + i * 20, t = lerp(px, hTop) + 16, b = lerp(px, hBot) - 16;
      side(D, px, px + 4, t, b, 0.0176, { name: "handle-groove" });
    }
    side(PL, 236, 252, 22, 102, 0.0172, { name: "bolster" });
    side(D, 242, 244, 22, 102, 0.0174);

    // pommel: steel cap, a glass-breaker point, the lanyard hole and an orange cord
    side(ST, 4, 22, 22, 104, 0.0165, { name: "pommel" });
    side(ST, 0, 4, 30, 96, 0.0145);
    side(CH, -8, 0, 54, 72, 0.006, { name: "glass-breaker" });
    side(D, 8, 18, 86, 94, 0.017, { name: "lanyard-hole" });
    side(A, 8, 18, 104, 118, 0.004, { name: "lanyard" });
    side(A, 2, 24, 116, 120, 0.004);

    g.name = "dfdf-knife";
    g.userData.weaponModel = "dfdf-knife";
    g.userData.design = { key: "knife", revision: 1 };
    g.userData.anchors = { tip: [0, Y(60), Z(712)] };
    return g;
  }

  // ── 기관단총 (smg) and 소음 기관단총 (whisper) share one body, kept to the old size (0.09 × 0.31 m; 0.71 m long,
  // 0.84 m with the suppressor): a skeleton folding stock with a rubber pad and a hinge, an upper with a full top
  // rail, flip-up sights, an open ejection port with brass, ambidextrous charging tabs, a lower with a flared mag
  // well and an orange selector, a slotted handguard with a short bottom rail, a raked rubber grip, and a straight
  // magazine with ribs, witness holes and an orange base. The smg ends in a ported compensator, the whisper in a
  // long suppressor. Units: px = mm from the back of the stock, py = mm down from the top of the sights. ──
  function smgBody(z0, name) {
    const k = kit({ S: 1000, px0: 0, py0: 0, z0, y0: 0.097 }), { g, side, bar, Z, Y } = k;
    const P = M.poly(), PL = M.polyLite(), ME = M.metal(), ST = M.steel(), PA = M.panel(), D = M.dark(), R = M.rubber(), A = M.accent(), BR = M.brass(), SI = M.silver();

    // stock: butt plate with a rubber pad, upper and lower arms, a cheek pad, the hinge block with its pin
    side(R, 4, 14, 46, 156, 0.019, { name: "butt-pad" });
    for (let i = 0; i < 5; i++) side(D, 3, 5, 56 + i * 20, 64 + i * 20, 0.017);
    side(P, 14, 40, 46, 156, 0.02, { name: "butt-plate" });
    side(D, 20, 34, 120, 146, 0.0205, { name: "sling-slot" });
    side(P, 40, 192, 56, 74, 0.016, { name: "stock-arm" });
    bar(P, 40, 146, 192, 104, 0.016, 0.016, "stock-arm-lower");
    side(PL, 52, 150, 50, 58, 0.017, { name: "cheek-pad" });
    side(ME, 176, 198, 60, 112, 0.019, { name: "stock-hinge" });
    side(ST, 182, 192, 98, 108, 0.021, { name: "hinge-pin" });

    // upper: body, full top rail with slots, ejection port with brass, charging tabs at the back, a pale line,
    // bolt release, screws
    side(PL, 196, 610, 28, 82, 0.024, { name: "upper" });
    side(ME, 200, 606, 22, 30, 0.014, { name: "top-rail" });
    for (let i = 0; i < 20; i++) side(D, 206 + i * 20, 214 + i * 20, 22, 25, 0.0145, { name: "rail-slot" });
    side(D, 330, 410, 40, 60, 0.003, { x: 0.0222, name: "ejection-port" });
    side(BR, 344, 396, 46, 55, 0.0012, { x: 0.0245, name: "chamber-round" });
    for (const x of [-0.029, 0.029]) side(ST, 196, 214, 32, 44, 0.006, { x, name: "charging-tab" });
    side(PA, 214, 600, 64, 66, 0.0243, { name: "upper-line" });
    side(ME, 420, 444, 70, 78, 0.0246, { name: "bolt-release" });
    for (const [px, py] of [[210, 72], [596, 40]]) side(ST, px, px + 5, py, py + 5, 0.0245, { name: "screw" });
    // sights: flip-up rear with an aperture, front post with ears and an orange dot
    side(ME, 226, 262, 12, 22, 0.012, { name: "rear-sight" });
    side(ME, 238, 252, 2, 12, 0.008);
    side(D, 242, 248, 5, 9, 0.0085);
    side(ME, 580, 606, 10, 22, 0.012, { name: "front-sight" });
    side(ME, 582, 588, 0, 10, 0.009);
    side(ME, 598, 604, 0, 10, 0.009);
    side(ST, 591, 595, 2, 10, 0.002);
    side(A, 591, 595, 1, 3, 0.0022);

    // lower: body with a flared mag well, orange selector, a pale panel and pins
    side(P, 210, 482, 82, 120, 0.022, { name: "lower" });
    side(P, 360, 470, 120, 152, 0.022, { name: "mag-well" });
    side(P, 352, 478, 146, 156, 0.0245, { name: "mag-well-flare" });
    side(PL, 226, 340, 90, 112, 0.0225, { name: "lower-panel" });
    side(A, 236, 256, 92, 102, 0.024, { name: "selector" });
    side(D, 243, 249, 94, 100, 0.0245);
    for (const px of [272, 452]) side(ST, px, px + 5, 104, 109, 0.0228, { name: "pin" });

    // handguard: body, three long slots each side, a short bottom rail, a slanted nose
    side(P, 482, 628, 46, 134, 0.026, { name: "handguard" });
    for (let i = 0; i < 3; i++) side(D, 498 + i * 42, 530 + i * 42, 76, 86, 0.0262, { name: "handguard-slot" });
    side(PL, 486, 624, 52, 58, 0.0262, { name: "handguard-line" });
    side(ME, 500, 616, 134, 144, 0.012, { name: "bottom-rail" });
    for (let i = 0; i < 6; i++) side(D, 506 + i * 18, 514 + i * 18, 140, 144, 0.0125, { name: "rail-slot" });
    const nose = side(P, 618, 636, 50, 132, 0.022, { name: "handguard-nose" });
    nose.rotation.x = 0.3;

    // trigger guard and trigger
    side(P, 286, 360, 182, 190, 0.008, { name: "guard-bottom" });
    side(P, 352, 360, 120, 190, 0.008, { name: "guard-front" });
    bar(ME, 318, 120, 324, 156, 0.007, 0.004, "trigger");

    // grip: raked, rubber with grooves, finger bumps on the front, a cap
    const grip = new T.Group();
    grip.position.set(0, Y(120), Z(266));
    grip.rotation.x = -0.32;
    g.add(grip);
    const gb = (m, a, b, y0, y1, w, nm, par) => {
      const mesh = new T.Mesh(BOX, m);
      mesh.scale.set(2 * w, y1 - y0, b - a);
      mesh.position.set(0, (y0 + y1) / 2, (a + b) / 2);
      nm && (mesh.name = nm);
      (par || grip).add(mesh);
      return mesh;
    };
    gb(P, -0.028, 0.026, -0.128, 0, 0.017, "grip");
    gb(R, -0.02, 0.02, -0.112, -0.012, 0.0178, "grip-panel");
    for (let i = 0; i < 6; i++) gb(D, -0.02, 0.02, -0.024 - i * 0.016, -0.021 - i * 0.016, 0.0182, "grip-groove");
    for (let i = 0; i < 3; i++) gb(PL, -0.034, -0.026, -0.04 - i * 0.03, -0.022 - i * 0.03, 0.0155, "finger-bump");
    gb(D, -0.03, 0.028, -0.138, -0.126, 0.0175, "grip-cap");

    // magazine: straight, raked a little forward, with ribs, witness holes and an orange base plate
    const mag = new T.Group();
    mag.name = "magazine";
    mag.position.set(0, Y(150), Z(414));
    mag.rotation.x = 0.1;
    g.add(mag);
    gb(ME, -0.03, 0.03, -0.14, 0, 0.0145, "magazine", mag);
    for (let i = 0; i < 5; i++) gb(D, -0.031, 0.031, -0.02 - i * 0.024, -0.016 - i * 0.024, 0.0148, "mag-rib", mag);
    for (let i = 0; i < 4; i++) gb(BR, 0.012, 0.02, -0.03 - i * 0.024, -0.022 - i * 0.024, 0.0149, "witness-hole", mag);
    gb(A, -0.034, 0.034, -0.156, -0.14, 0.0165, "magazine-floorplate", mag);
    gb(D, -0.034, 0.034, -0.158, -0.155, 0.0168, null, mag);

    // barrel collar out of the handguard
    side(ST, 628, 640, 56, 84, 0.012, { name: "barrel-collar" });
    g.name = name;
    g.userData.weaponModel = name;
    return k;
  }
  function smg() {
    const k = smgBody(0.303, "dfdf-smg"), { g, side, Z, Y } = k, ME = M.metal(), D = M.dark(), SI = M.silver(), A = M.accent();
    // compensator: a block with a pale ring, three top ports, side slots and the bore
    side(ME, 640, 708, 52, 88, 0.017, { name: "compensator" });
    side(SI, 640, 646, 50, 90, 0.0175, { name: "comp-ring" });
    for (let i = 0; i < 3; i++) {
      side(D, 654 + i * 16, 664 + i * 16, 51, 55, 0.01, { name: "comp-port" });
      side(D, 654 + i * 16, 664 + i * 16, 60, 80, 0.0172);
    }
    side(A, 700, 708, 52, 88, 0.0172, { name: "comp-tip" });
    side(D, 707, 711, 62, 78, 0.008, { name: "muzzle-bore" });
    g.userData.design = { key: "smg", revision: 1 };
    g.userData.anchors = { muzzle: [0, Y(70), Z(711)] };
    return g;
  }
  function whisper() {
    const k = smgBody(0.343, "dfdf-whisper"), { g, side, Z, Y } = k, ME = M.metal(), ST = M.steel(), D = M.dark(), SI = M.silver(), P = M.poly(), PL = M.polyLite();
    // suppressor: a mount, a long round can (three crossed blocks) with heat rings, a pale band and an end cap
    const can = (m, a, b, top, bot, nm) => {
      const c = (top + bot) / 2, r = (bot - top) / 2;
      side(m, a, b, c - r, c + r, (r * 0.55) / 1000, { name: nm });
      side(m, a, b, c - r * 0.55, c + r * 0.55, r / 1000);
      side(m, a, b, c - r * 0.85, c + r * 0.85, (r * 0.85) / 1000);
    };
    can(ST, 640, 666, 50, 90, "suppressor-mount");
    can(P, 664, 832, 44, 96, "suppressor");
    for (let i = 0; i < 6; i++) can(D, 690 + i * 22, 694 + i * 22, 43, 97, "suppressor-ring");
    side(PL, 680, 818, 43.5, 48, 0.012, { name: "suppressor-shine" });
    can(SI, 664, 670, 42, 98, "suppressor-band");
    can(ME, 826, 836, 46, 94, "suppressor-cap");
    side(D, 835, 837, 62, 78, 0.008, { name: "muzzle-bore" });
    g.userData.design = { key: "whisper", revision: 1 };
    g.userData.anchors = { muzzle: [0, Y(70), Z(836)] };
    return g;
  }

  // a round rod along the gun (three crossed blocks so it reads round from the front): side-view px a..b, py
  // top..bot, at x
  const roundRod = (k, m, a, b, top, bot, name, x, S) => {
    const c = (top + bot) / 2, r = (bot - top) / 2, s = S || 1000;
    k.side(m, a, b, c - r, c + r, (r * 0.55) / s, { name, x: x || 0 });
    k.side(m, a, b, c - r * 0.55, c + r * 0.55, r / s, { x: x || 0 });
    k.side(m, a, b, c - r * 0.85, c + r * 0.85, (r * 0.85) / s, { x: x || 0 });
  };

  // ── 산탄총 (shotgun): our own pump gun, kept to the old size (0.09 × 0.19 × 0.99 m) and its wood. A wood stock
  // with a rubber pad and spacer, checkering at the wrist and a sling stud; a steel receiver with an ejection port
  // showing a red shell, a loading port, safety and slide release, a ghost-ring sight; a round barrel with a vented
  // rib and a brass bead; the magazine tube with a clamp and cap; a grooved wood pump on its action bars; a side
  // saddle on the left holding four shells. Units: px = mm from the butt, py = mm down from the bead. ──
  function shotgun() {
    const k = kit({ S: 1000, px0: 0, py0: 0, z0: 0.387, y0: 0.073 }), { g, side, bar, Z, Y } = k;
    const P = M.poly(), ME = M.metal(), ST = M.steel(), PA = M.panel(), D = M.dark(), R = M.rubber(), A = M.accent(), BR = M.brass(), SI = M.silver(), SH = M.shell(), GD = M.gold(), W = M.wood(), WL = M.woodLite();

    // stock: rubber pad with a pale spacer, wood slabs whose top climbs to the comb and whose underside rises to the
    // wrist, checkering, a sling stud
    side(R, 0, 16, 78, 188, 0.021, { name: "butt-pad" });
    for (let i = 0; i < 5; i++) side(D, -1, 1, 88 + i * 20, 96 + i * 20, 0.019);
    side(PA, 16, 20, 78, 188, 0.0212, { name: "pad-spacer" });
    // the wood is a core and three long bevelled edges (top, underside, wrist), so it runs smooth with no seams
    side(W, 20, 200, 90, 160, 0.02, { name: "stock" });
    side(W, 198, 272, 64, 120, 0.02);
    side(W, 196, 244, 100, 142, 0.02);
    bar(W, 20, 92, 272, 62, 0.026, 0.02, "stock-top");
    bar(W, 20, 172, 200, 145, 0.028, 0.02, "stock-belly");
    bar(W, 198, 144, 272, 106, 0.028, 0.02, "stock-wrist");
    bar(WL, 22, 82, 270, 53, 0.005, 0.0205, "stock-comb");
    for (let i = 0; i < 5; i++) side(WL, 206 + i * 12, 212 + i * 12, 84, 112, 0.0204, { name: "checkering" });
    side(D, 204, 266, 82, 84, 0.0204);
    side(D, 204, 266, 112, 114, 0.0204);
    side(ME, 120, 130, 170, 178, 0.008, { name: "sling-stud" });

    // receiver: body, a pale engraved line, ejection port with a red shell, loading port under, safety, slide
    // release, pins, ghost-ring sight on top
    side(ST, 266, 532, 20, 112, 0.022, { name: "receiver" });
    bar(ST, 262, 40, 280, 22, 0.02, 0.021, "receiver-back");
    side(PA, 272, 528, 46, 48, 0.0222, { name: "receiver-line" });
    side(D, 300, 520, 96, 98, 0.0222);
    side(D, 384, 470, 54, 84, 0.003, { x: 0.0202, name: "ejection-port" });
    side(SH, 396, 444, 62, 78, 0.0014, { x: 0.0226, name: "port-shell" });
    side(GD, 444, 456, 62, 78, 0.0014, { x: 0.0226 });
    side(D, 330, 470, 110, 114, 0.014, { name: "loading-port" });
    side(A, 300, 316, 22, 28, 0.006, { name: "safety" });
    side(ST, 322, 334, 112, 120, 0.004, { name: "slide-release" });
    for (const px of [318, 470]) side(ST, px, px + 6, 86, 92, 0.0224, { name: "pin" });
    side(ME, 286, 318, 10, 20, 0.012, { name: "ghost-ring" });
    side(ME, 294, 310, 2, 10, 0.009);
    side(D, 299, 305, 4, 8, 0.0095);

    // trigger guard and trigger
    side(ME, 292, 372, 152, 160, 0.008, { name: "guard-bottom" });
    bar(ME, 292, 112, 296, 156, 0.008, 0.008, "guard-rear");
    side(ME, 364, 372, 112, 160, 0.008, { name: "guard-front" });
    bar(ST, 330, 112, 336, 146, 0.007, 0.004, "trigger");

    // barrel: round, a vented rib on top with posts, a brass bead
    roundRod(k, ST, 532, 986, 24, 58, "barrel");
    side(SI, 532, 986, 23, 28, 0.009, { name: "barrel-shine" });
    side(ME, 534, 980, 14, 18, 0.006, { name: "vent-rib" });
    for (let i = 0; i < 12; i++) side(ME, 540 + i * 38, 546 + i * 38, 18, 24, 0.004, { name: "rib-post" });
    side(BR, 970, 980, 6, 14, 0.004, { name: "bead" });
    side(D, 984, 988, 32, 50, 0.008, { name: "muzzle-bore" });

    // magazine tube, barrel clamp, end cap
    roundRod(k, ME, 532, 930, 66, 102, "magazine-tube");
    roundRod(k, ST, 878, 900, 22, 104, "barrel-clamp");
    side(D, 878, 900, 60, 66, 0.0172);
    roundRod(k, ST, 928, 944, 68, 100, "tube-cap");
    side(ME, 936, 944, 80, 88, 0.0172, { name: "cap-stud" });

    // pump: wood with dark grooves, its action bars running back to the receiver
    roundRod(k, W, 604, 804, 56, 118, "pump");
    for (let i = 0; i < 8; i++) roundRod(k, D, 620 + i * 22, 626 + i * 22, 55, 119, "pump-groove");
    roundRod(k, WL, 604, 612, 58, 116, "pump-lip");
    roundRod(k, WL, 796, 804, 58, 116);
    for (const x of [-0.016, 0.016]) side(ST, 532, 604, 96, 100, 0.002, { x, name: "action-bar" });

    // side saddle on the left: a plate with four shells, brass ends toward the back
    side(P, 300, 500, 30, 82, 0.004, { x: -0.025, name: "side-saddle" });
    for (let i = 0; i < 4; i++) {
      const py = 38 + i * 11;
      side(SH, 340, 470, py, py + 9, 0.005, { x: -0.032, name: "saddle-shell" });
      side(GD, 326, 340, py, py + 9, 0.005, { x: -0.032 });
    }

    g.name = "dfdf-shotgun";
    g.userData.weaponModel = "dfdf-shotgun";
    g.userData.design = { key: "shotgun", revision: 1 };
    g.userData.anchors = { muzzle: [0, Y(41), Z(988)] };
    return g;
  }

  // ── 산탄 권총 (pocketshot): a two-shot break-action pistol, kept to the old size (0.09 × 0.25 × 0.42 m): two
  // barrels side by side with a rib and a brass bead, a silver frame with engraving, the hinge pin, a top lever and
  // two hammers, a checkered wood forend with its latch, a guard with two triggers, a raked wood grip with a steel
  // cap and a lanyard ring. Units: px = mm from the back of the grip, py = mm down from the hammer tops. ──
  function pocketshot() {
    const k = kit({ S: 1000, px0: 0, py0: 0, z0: 0.095, y0: 0.07 }), { g, side, bar, Z, Y } = k;
    const P = M.poly(), ME = M.metal(), ST = M.steel(), PA = M.panel(), D = M.dark(), A = M.accent(), BR = M.brass(), SI = M.silver(), W = M.wood(), WL = M.woodLite(), CH = M.chrome();

    // barrels: two round tubes side by side, a pale top shine, the rib between with a brass bead, the bores
    for (const x of [-0.023, 0.023]) {
      roundRod(k, ME, 196, 412, 18, 64, "barrel", x);
      side(SI, 200, 410, 17, 22, 0.012, { x, name: "barrel-shine" });
      roundRod(k, ST, 404, 414, 17, 65, "barrel-crown", x);
      side(D, 413, 416, 30, 52, 0.013, { x, name: "muzzle-bore" });
      roundRod(k, ST, 196, 214, 16, 66, "barrel-breech", x);
    }
    side(ME, 196, 412, 12, 22, 0.01, { name: "rib" });
    side(BR, 400, 408, 6, 12, 0.003, { name: "bead" });

    // frame: silver body with a sloped back, engraving lines, hinge pin, top lever, two hammers and their pins
    side(SI, 30, 200, 14, 104, 0.043, { name: "frame" });
    bar(SI, 14, 70, 40, 16, 0.03, 0.04, "frame-back");
    for (let i = 0; i < 3; i++) side(PA, 60 + i * 8, 180 - i * 8, 40 + i * 14, 42 + i * 14, 0.0432, { name: "engraving" });
    side(D, 60, 186, 90, 92, 0.0432);
    roundRod(k, ST, 184, 210, 74, 100, "hinge-pin", 0.044);
    roundRod(k, ME, 190, 204, 80, 94, null, 0.046);
    bar(ME, 70, 12, 120, 8, 0.008, 0.014, "top-lever");
    side(ME, 112, 124, 4, 14, 0.016);
    for (const x of [-0.022, 0.022]) {
      bar(ST, 24, 0, 52, 30, 0.012, 0.007, "hammer").position.x = x;
      side(CH, 18, 30, 0, 6, 0.008, { x, name: "hammer-spur" });
    }
    for (const px of [44, 150]) side(CH, px, px + 8, 60, 68, 0.0436, { name: "frame-pin" });

    // forend: checkered wood under the barrels, slanted at the front, its latch
    side(W, 206, 350, 66, 114, 0.038, { name: "forend" });
    const fn = side(W, 344, 366, 66, 110, 0.034, { name: "forend-nose" });
    fn.rotation.x = 0.4;
    for (let i = 0; i < 6; i++) side(WL, 224 + i * 18, 232 + i * 18, 76, 104, 0.0383, { name: "forend-checkering" });
    side(ME, 320, 342, 112, 118, 0.012, { name: "forend-latch" });

    // trigger guard and two triggers
    side(ME, 96, 170, 150, 158, 0.009, { name: "guard-bottom" });
    bar(ME, 96, 104, 100, 154, 0.008, 0.009, "guard-rear");
    side(ME, 162, 170, 104, 158, 0.009, { name: "guard-front" });
    bar(CH, 118, 104, 124, 136, 0.006, 0.004, "trigger");
    bar(CH, 138, 104, 144, 132, 0.006, 0.004, "trigger");

    // grip: raked wood with a checkered panel, a steel butt cap and a lanyard ring
    const grip = new T.Group();
    grip.position.set(0, Y(104), Z(66));
    grip.rotation.x = -0.36;
    g.add(grip);
    const gb = (m, a, b, y0, y1, w, nm) => {
      const mesh = new T.Mesh(BOX, m);
      mesh.scale.set(2 * w, y1 - y0, b - a);
      mesh.position.set(0, (y0 + y1) / 2, (a + b) / 2);
      nm && (mesh.name = nm);
      grip.add(mesh);
      return mesh;
    };
    gb(W, -0.03, 0.034, -0.13, 0, 0.019, "grip");
    gb(W, -0.026, 0.03, -0.138, -0.13, 0.017);
    gb(WL, -0.02, 0.022, -0.11, -0.02, 0.0194, "grip-checkering");
    for (let i = 0; i < 6; i++) gb(D, -0.02, 0.022, -0.03 - i * 0.014, -0.028 - i * 0.014, 0.0196, "checker-line");
    gb(ST, -0.032, 0.036, -0.148, -0.136, 0.0195, "butt-cap");
    gb(CH, 0.012, 0.022, -0.162, -0.148, 0.004, "lanyard-ring");

    g.name = "dfdf-pocketshot";
    g.userData.weaponModel = "dfdf-pocketshot";
    g.userData.design = { key: "pocketshot", revision: 1 };
    g.userData.anchors = { muzzle: [0.023, Y(41), Z(416)] };
    return g;
  }

  // a part built in its own tilted frame (grips, magazines): returns the group and a block maker in that frame,
  // where z runs forward as minus and y up from the pivot
  const tilted = (g, y, z, rx, name) => {
    const grp = new T.Group();
    grp.position.set(0, y, z);
    grp.rotation.x = rx;
    name && (grp.name = name);
    g.add(grp);
    const gb = (m, a, b, y0, y1, w, nm) => {
      const mesh = new T.Mesh(BOX, m);
      mesh.scale.set(2 * w, y1 - y0, b - a);
      mesh.position.set(0, (y0 + y1) / 2, (a + b) / 2);
      nm && (mesh.name = nm);
      grp.add(mesh);
      return mesh;
    };
    return gb;
  };

  // ── 정찰 소총 (carbine): a semi-auto marksman carbine with tan furniture, kept to the old size (0.11 × 0.37 ×
  // 0.83 m): a tan stock with a cheek riser, lightening cuts and a rubber pad on its buffer tube; a dark upper
  // with a full rail, dust cover, forward assist and charging handle; a lower with a flared well, bolt catch and
  // orange selector; a long scope on two rings; a tan raked grip; a ribbed magazine; a tan slotted handguard with
  // a top rail; a slotted brake. Units: px = mm from the butt, py = mm down from the scope's turret. ──
  function carbine() {
    const k = kit({ S: 1000, px0: 0, py0: 0, z0: 0.312, y0: 0.148 }), { g, side, bar, Z, Y } = k;
    const P = M.poly(), PL = M.polyLite(), ME = M.metal(), ST = M.steel(), PA = M.panel(), D = M.dark(), R = M.rubber(), A = M.accent(), BR = M.brass(), SI = M.silver(), LE = M.lens(), TN = M.tan(), TD = M.tanDark();

    // stock: rubber pad, tan body with a cheek riser, two lightening cuts, a QD cup, the lever; buffer tube
    side(R, 0, 10, 92, 186, 0.022, { name: "butt-pad" });
    for (let i = 0; i < 4; i++) side(D, -1, 1, 102 + i * 22, 110 + i * 22, 0.02);
    side(TN, 10, 140, 96, 184, 0.021, { name: "stock" });
    bar(TN, 10, 178, 140, 160, 0.02, 0.0205, "stock-belly");
    side(TD, 24, 134, 84, 98, 0.017, { name: "cheek-riser" });
    side(D, 34, 82, 112, 134, 0.0212, { name: "stock-cut" });
    side(D, 92, 128, 112, 134, 0.0212);
    side(ST, 52, 62, 150, 160, 0.0214, { name: "qd-cup" });
    side(D, 128, 144, 154, 160, 0.006, { name: "stock-lever" });
    roundRod(k, ST, 136, 236, 114, 158, "buffer-tube");
    roundRod(k, D, 150, 154, 113, 159);

    // upper: body, rail with slots, ejection port with brass and its dust cover, forward assist, charging handle
    side(ME, 230, 592, 78, 122, 0.024, { name: "upper" });
    side(ME, 234, 590, 70, 80, 0.016, { name: "top-rail" });
    for (let i = 0; i < 17; i++) side(D, 240 + i * 20, 248 + i * 20, 70, 73, 0.0165, { name: "rail-slot" });
    side(D, 380, 452, 92, 112, 0.003, { x: 0.0222, name: "ejection-port" });
    side(BR, 392, 440, 98, 106, 0.0012, { x: 0.0245, name: "chamber-round" });
    side(PL, 372, 460, 112, 116, 0.0248, { name: "dust-cover" });
    roundRod(k, ST, 350, 372, 86, 106, "forward-assist", 0.026);
    side(ST, 220, 240, 80, 92, 0.012, { name: "charging-handle" });
    for (const x of [-0.016, 0.016]) side(ST, 226, 240, 80, 90, 0.004, { x });
    side(PA, 236, 588, 118, 120, 0.0242, { name: "upper-line" });

    // lower: body, flared mag well, bolt catch, orange selector, pins, trigger guard and trigger
    side(P, 236, 430, 122, 176, 0.0235, { name: "lower" });
    side(P, 300, 396, 170, 198, 0.0235, { name: "mag-well" });
    side(P, 294, 402, 192, 200, 0.026, { name: "mag-well-flare" });
    side(ME, 400, 420, 134, 150, 0.025, { name: "bolt-catch" });
    side(A, 254, 274, 132, 142, 0.0245, { name: "selector" });
    side(D, 261, 267, 134, 140, 0.025);
    for (const px of [266, 396]) side(ST, px, px + 5, 156, 161, 0.024, { name: "pin" });
    side(P, 268, 304, 204, 210, 0.009, { name: "guard-bottom" });
    side(P, 296, 304, 176, 210, 0.009);
    bar(ME, 284, 176, 290, 200, 0.006, 0.004, "trigger");

    // scope on two rings: eyepiece, tube, top and side turrets, objective bell, lens
    for (const px of [328, 452]) {
      side(ST, px, px + 20, 44, 72, 0.012, { name: "scope-ring" });
      side(ST, px - 2, px + 22, 40, 50, 0.024);
    }
    roundRod(k, ST, 272, 314, 6, 56, "eyepiece");
    roundRod(k, SI, 270, 278, 4, 58);
    roundRod(k, D, 312, 318, 12, 50);
    roundRod(k, ST, 314, 472, 16, 46, "scope-tube");
    roundRod(k, ST, 378, 404, 12, 50, "turret");
    side(ST, 382, 400, 0, 12, 0.012, { name: "turret-knob" });
    side(D, 382, 400, 4, 6, 0.0125);
    side(ST, 382, 400, 22, 40, 0.012, { x: 0.026, name: "side-turret" });
    roundRod(k, ST, 470, 518, 4, 58, "objective");
    roundRod(k, SI, 512, 518, 3, 59);
    roundRod(k, D, 488, 492, 3, 59);
    roundRod(k, LE, 517, 520, 10, 52, "lens");

    // grip: raked tan with a dark panel and finger bumps
    const gb = tilted(g, Y(176), Z(254), -0.38, "grip");
    gb(TN, -0.03, 0.026, -0.124, 0, 0.0165, "grip");
    gb(TD, -0.02, 0.018, -0.108, -0.016, 0.017, "grip-panel");
    for (let i = 0; i < 5; i++) gb(D, -0.02, 0.018, -0.026 - i * 0.018, -0.023 - i * 0.018, 0.0172, "grip-groove");
    for (let i = 0; i < 3; i++) gb(TD, -0.036, -0.028, -0.04 - i * 0.03, -0.022 - i * 0.03, 0.015, "finger-bump");
    gb(D, -0.032, 0.028, -0.134, -0.122, 0.017, "grip-cap");

    // magazine: polymer with ribs and a window, a tan base
    const mb = tilted(g, Y(196), Z(348), 0.12, "magazine");
    mb(P, -0.044, 0.044, -0.165, 0, 0.0145, "magazine");
    for (let i = 0; i < 6; i++) mb(D, -0.045, 0.045, -0.02 - i * 0.024, -0.016 - i * 0.024, 0.0148, "mag-rib");
    mb(BR, 0.02, 0.032, -0.14, -0.03, 0.0149, "mag-window");
    mb(TN, -0.048, 0.048, -0.18, -0.165, 0.016, "mag-base");

    // handguard: tan with two rows of slots, a top rail, a bevelled nose; barrel and the slotted brake
    side(TN, 592, 776, 100, 164, 0.026, { name: "handguard" });
    for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) side(D, 606 + i * 42, 636 + i * 42, 114 + r * 22, 122 + r * 22, 0.0262, { name: "handguard-slot" });
    side(ME, 594, 776, 90, 100, 0.016, { name: "handguard-rail" });
    for (let i = 0; i < 9; i++) side(D, 600 + i * 20, 608 + i * 20, 90, 93, 0.0165);
    side(TD, 592, 776, 158, 164, 0.0262);
    const nose = side(TN, 770, 786, 102, 162, 0.022, { name: "handguard-nose" });
    nose.rotation.x = 0.3;
    roundRod(k, ME, 776, 800, 120, 146, "barrel");
    side(ST, 796, 832, 114, 152, 0.017, { name: "muzzle-brake" });
    for (let i = 0; i < 3; i++) side(D, 802 + i * 10, 808 + i * 10, 118, 148, 0.0172, { name: "brake-slot" });
    side(D, 830, 834, 126, 140, 0.008, { name: "muzzle-bore" });

    g.name = "dfdf-recon";
    g.userData.weaponModel = "dfdf-recon";
    g.userData.design = { key: "carbine", revision: 1 };
    g.userData.anchors = { muzzle: [0, Y(133), Z(834)] };
    return g;
  }

  // ── 점사소총 (burst): a three-round-burst rifle, kept to the old size (0.09 × 0.38 × 0.97 m): a thumbhole stock
  // with a rubber pad and cheek strip, a carry handle with a rail and rear aperture, a side charging handle, an
  // open port with brass, the orange burst selector with its three marks, a vented handguard with a heat shield
  // and a bottom rail, the tall front sight, a birdcage flash hider, a raked grip and a curved magazine. Units: px
  // = mm from the butt, py = mm down from the front sight's top. ──
  function burst() {
    const k = kit({ S: 1000, px0: 0, py0: 0, z0: 0.358, y0: 0.146 }), { g, side, bar, Z, Y } = k;
    const P = M.poly(), PL = M.polyLite(), ME = M.metal(), ST = M.steel(), PA = M.panel(), D = M.dark(), R = M.rubber(), A = M.accent(), BR = M.brass(), SI = M.silver();

    // stock: pad, upright, beam, the slanted lower bar that closes the thumbhole, a cheek strip, sling slot
    side(R, 0, 16, 86, 246, 0.022, { name: "butt-pad" });
    for (let i = 0; i < 6; i++) side(D, -1, 1, 96 + i * 24, 104 + i * 24, 0.02);
    side(P, 16, 52, 86, 246, 0.022, { name: "stock-upright" });
    side(P, 16, 250, 86, 140, 0.022, { name: "stock-beam" });
    bar(P, 30, 232, 150, 172, 0.034, 0.021, "stock-lower");
    bar(P, 146, 176, 256, 152, 0.03, 0.021);
    side(PL, 22, 236, 82, 92, 0.0205, { name: "cheek-strip" });
    side(D, 24, 44, 196, 220, 0.0225, { name: "sling-slot" });
    side(D, 60, 236, 116, 118, 0.0222);

    // receiver: upper with a pale line, lower, port with brass, side charging slot and handle, burst selector
    side(PL, 234, 590, 84, 150, 0.024, { name: "upper" });
    side(PA, 240, 586, 128, 130, 0.0242, { name: "upper-line" });
    side(P, 250, 452, 150, 202, 0.023, { name: "lower" });
    side(D, 330, 404, 98, 122, 0.003, { x: 0.0222, name: "ejection-port" });
    side(BR, 342, 392, 104, 114, 0.0012, { x: 0.0245, name: "chamber-round" });
    side(D, 420, 560, 96, 102, 0.0244, { name: "charging-slot" });
    side(ST, 540, 552, 92, 106, 0.012, { x: 0.032, name: "charging-handle" });
    side(A, 270, 296, 160, 172, 0.0245, { name: "selector" });
    for (let i = 0; i < 3; i++) side(A, 300 + i * 6, 303 + i * 6, 158, 162, 0.0236, { name: "burst-mark" });
    for (const px of [262, 440]) side(ST, px, px + 5, 186, 191, 0.0235, { name: "pin" });
    side(P, 410, 456, 196, 214, 0.024, { name: "mag-well" });

    // carry handle: two posts, a top bar with a rail, the rear aperture
    side(P, 318, 342, 30, 86, 0.016, { name: "handle-post" });
    side(P, 532, 556, 30, 86, 0.016);
    side(P, 310, 562, 20, 36, 0.017, { name: "carry-handle" });
    side(ME, 340, 540, 14, 20, 0.012, { name: "handle-rail" });
    for (let i = 0; i < 10; i++) side(D, 346 + i * 20, 352 + i * 20, 14, 16, 0.0125);
    side(ME, 312, 336, 4, 20, 0.01, { name: "rear-sight" });
    side(D, 320, 328, 8, 14, 0.0105);

    // handguard: body with a pale heat shield on top, two rows of vents, a bottom rail, bevelled nose
    side(P, 588, 810, 84, 190, 0.026, { name: "handguard" });
    side(PL, 592, 806, 84, 102, 0.0262, { name: "heat-shield" });
    for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) side(D, 604 + i * 32, 622 + i * 32, 116 + r * 30, 128 + r * 30, 0.0262, { name: "handguard-vent" });
    side(ME, 600, 800, 190, 200, 0.012, { name: "bottom-rail" });
    for (let i = 0; i < 10; i++) side(D, 606 + i * 20, 614 + i * 20, 196, 200, 0.0125);
    const nose = side(P, 802, 820, 86, 188, 0.022, { name: "handguard-nose" });
    nose.rotation.x = 0.3;

    // front sight: a tall post on a block, with ears and an orange dot
    side(P, 750, 784, 40, 86, 0.013, { name: "front-sight" });
    side(P, 754, 760, 4, 40, 0.009);
    side(P, 774, 780, 4, 40, 0.009);
    side(ST, 765, 769, 10, 40, 0.002);
    side(A, 765, 769, 8, 12, 0.0022);

    // barrel and the birdcage flash hider
    roundRod(k, ME, 808, 918, 104, 132, "barrel");
    roundRod(k, ST, 914, 970, 98, 138, "flash-hider");
    for (let i = 0; i < 4; i++) side(D, 924 + i * 11, 930 + i * 11, 100, 136, 0.0202, { name: "hider-slot" });
    side(D, 968, 972, 110, 126, 0.008, { name: "muzzle-bore" });

    // trigger guard and trigger
    side(P, 288, 360, 230, 238, 0.009, { name: "guard-bottom" });
    side(P, 352, 360, 202, 238, 0.009);
    bar(ME, 322, 202, 328, 226, 0.006, 0.004, "trigger");

    // grip and a curved magazine (two segments, the lower one turned further)
    const gb = tilted(g, Y(202), Z(270), -0.36, "grip");
    gb(P, -0.03, 0.026, -0.126, 0, 0.017, "grip");
    gb(R, -0.02, 0.018, -0.11, -0.016, 0.0176, "grip-panel");
    for (let i = 0; i < 5; i++) gb(D, -0.02, 0.018, -0.026 - i * 0.018, -0.023 - i * 0.018, 0.018, "grip-groove");
    gb(D, -0.032, 0.028, -0.136, -0.124, 0.0175, "grip-cap");
    const ma = tilted(g, Y(212), Z(432), 0.14, "magazine");
    ma(ME, -0.044, 0.044, -0.09, 0, 0.0145, "magazine");
    for (let i = 0; i < 3; i++) ma(D, -0.045, 0.045, -0.02 - i * 0.026, -0.016 - i * 0.026, 0.0148, "mag-rib");
    const mb = tilted(g, Y(212) - 0.088 * Math.cos(0.14), Z(432) - 0.088 * Math.sin(0.14), 0.3, "magazine-lower");
    mb(ME, -0.044, 0.044, -0.085, 0.002, 0.0145, "magazine");
    for (let i = 0; i < 3; i++) mb(D, -0.045, 0.045, -0.016 - i * 0.024, -0.012 - i * 0.024, 0.0148, "mag-rib");
    mb(PL, -0.048, 0.048, -0.1, -0.085, 0.016, "mag-base");

    g.name = "dfdf-burst";
    g.userData.weaponModel = "dfdf-burst";
    g.userData.design = { key: "burst", revision: 1 };
    g.userData.anchors = { muzzle: [0, Y(118), Z(972)] };
    return g;
  }

  // ── 코멧 소총 (bullpup): a tan bullpup, kept to the old size (0.16 × 0.43 × 0.99 m): an open stock frame with a
  // rubber pad and a cheek rest, the magazine behind the grip, a brass deflector over the port by the cheek, a top
  // rail with a red-dot sight, a dark grip with a long guard, a dark handguard with a tan top and vents, and a
  // ported brake. Units: px = mm from the butt, py = mm down from the sight's hood. ──
  function bullpup() {
    const k = kit({ S: 1000, px0: 0, py0: 0, z0: 0.358, y0: 0.197 }), { g, side, bar, Z, Y } = k;
    const P = M.poly(), PL = M.polyLite(), ME = M.metal(), ST = M.steel(), D = M.dark(), R = M.rubber(), A = M.accent(), BR = M.brass(), LE = M.lens(), TN = M.tan(), TD = M.tanDark(), RE = M.red();

    // stock frame: pad, upright, the top (the body runs on from it), the bottom bar, a cheek rest
    side(R, 0, 14, 160, 328, 0.028, { name: "butt-pad" });
    for (let i = 0; i < 6; i++) side(D, -1, 1, 170 + i * 26, 178 + i * 26, 0.026);
    side(TN, 14, 80, 160, 328, 0.028, { name: "stock-upright" });
    side(TN, 14, 232, 160, 226, 0.028, { name: "stock-top" });
    side(TN, 60, 236, 288, 328, 0.026, { name: "stock-bottom" });
    side(TD, 18, 226, 150, 162, 0.024, { name: "cheek-rest" });
    side(D, 30, 64, 190, 214, 0.0285, { name: "sling-slot" });

    // the magazine in the stock: body with ribs and a window, a release, an orange base
    side(P, 132, 226, 226, 400, 0.017, { name: "magazine" });
    for (let i = 0; i < 6; i++) side(D, 130, 228, 244 + i * 24, 248 + i * 24, 0.0173, { name: "mag-rib" });
    side(BR, 194, 208, 250, 380, 0.0174, { name: "mag-window" });
    side(A, 128, 230, 398, 416, 0.019, { name: "mag-base" });
    side(ME, 236, 250, 300, 316, 0.01, { name: "mag-release" });

    // body: tan, the port with brass under a deflector, seams, a selector, the top rail
    side(TN, 165, 598, 104, 218, 0.03, { name: "body" });
    side(D, 190, 262, 136, 166, 0.003, { x: 0.0282, name: "ejection-port" });
    side(BR, 202, 250, 144, 156, 0.0012, { x: 0.0305, name: "chamber-round" });
    side(TD, 180, 272, 120, 134, 0.034, { name: "brass-deflector" });
    for (const py of [180, 198]) side(D, 270, 590, py, py + 2, 0.0302, { name: "body-seam" });
    side(A, 300, 318, 186, 196, 0.031, { name: "selector" });
    side(ME, 236, 598, 70, 104, 0.02, { name: "top-rail" });
    for (let i = 0; i < 18; i++) side(D, 242 + i * 20, 250 + i * 20, 70, 74, 0.0205, { name: "rail-slot" });
    side(TD, 236, 598, 98, 104, 0.0305);

    // red-dot sight: base, an open hood with a window, the lens and the red dot
    side(ME, 408, 486, 52, 70, 0.018, { name: "sight-base" });
    side(ST, 412, 482, 0, 10, 0.022, { name: "sight-hood" });
    for (const x of [-0.02, 0.02]) side(ST, 412, 482, 0, 52, 0.003, { x });
    side(ST, 476, 482, 0, 52, 0.022);
    side(LE, 474, 477, 10, 50, 0.018, { name: "sight-lens" });
    side(RE, 420, 430, 26, 34, 0.004, { name: "red-dot" });
    side(ST, 440, 452, 52, 60, 0.0215, { name: "sight-knob" });

    // grip, the long guard running forward to the trigger, the trigger
    const gb = tilted(g, Y(218), Z(330), -0.26, "grip");
    gb(P, -0.03, 0.028, -0.13, 0, 0.018, "grip");
    gb(R, -0.022, 0.02, -0.114, -0.016, 0.0186, "grip-panel");
    for (let i = 0; i < 5; i++) gb(D, -0.022, 0.02, -0.028 - i * 0.018, -0.025 - i * 0.018, 0.019, "grip-groove");
    gb(D, -0.032, 0.03, -0.14, -0.128, 0.0185, "grip-cap");
    side(P, 366, 470, 262, 270, 0.012, { name: "guard-bottom" });
    side(P, 462, 470, 218, 270, 0.012);
    bar(ME, 400, 218, 406, 246, 0.007, 0.004, "trigger");

    // handguard: dark with a tan top and vents, bevelled nose; barrel and the ported brake
    side(P, 594, 744, 104, 212, 0.028, { name: "handguard" });
    side(TN, 594, 740, 104, 130, 0.0282, { name: "handguard-top" });
    for (let i = 0; i < 4; i++) side(D, 608 + i * 32, 628 + i * 32, 152, 182, 0.0282, { name: "handguard-vent" });
    const nose = side(P, 736, 754, 108, 208, 0.024, { name: "handguard-nose" });
    nose.rotation.x = 0.3;
    roundRod(k, ST, 744, 916, 142, 178, "barrel");
    roundRod(k, ME, 912, 984, 132, 188, "muzzle-brake");
    for (let i = 0; i < 3; i++) side(D, 924 + i * 18, 934 + i * 18, 136, 184, 0.0222, { name: "brake-port" });
    side(D, 983, 987, 150, 170, 0.01, { name: "muzzle-bore" });

    g.name = "dfdf-comet";
    g.userData.weaponModel = "dfdf-comet";
    g.userData.design = { key: "bullpup", revision: 1 };
    g.userData.anchors = { muzzle: [0, Y(160), Z(987)] };
    return g;
  }

  // ── RPG: kept to the old size (0.17 × 0.27 × 1.53 m): a flared venturi at the back, the launch tube with two
  // wood heat shields held by steel clamps, an olive optic, rear and front sights, a pistol grip with its guard and
  // a front grip, sling swivels, and the olive warhead with its neck, rear cone, a tan band, the front cone and a
  // brass fuse. Units: px = mm from the venturi's end, py = mm down from the optic's top. ──
  function rpg() {
    const k = kit({ S: 1000, px0: 0, py0: 0, z0: 0.426, y0: 0.139 }), { g, side, bar, Z, Y } = k;
    const PA = M.panel(), P = M.poly(), ME = M.metal(), ST = M.steel(), D = M.dark(), A = M.accent(), BR = M.brass(), LE = M.lens(), W = M.wood(), WL = M.woodLite(), OL = M.olive(), TN = M.tan(), SI = M.silver();
    const cy = 84;
    const ring = (m, a, b, r, name) => roundRod(k, m, a, b, cy - r, cy + r, name);

    // venturi: steps from wide at the back to the tube, a steel rim and a dark throat
    for (let i = 0; i < 8; i++) ring(PA, i * 24, i * 24 + 25, 72 - i * 4, "venturi");
    ring(ST, 0, 8, 74, "venturi-rim");
    ring(D, -2, 1, 60, "venturi-throat");

    // tube, two wood heat shields with dark seams and steel clamps
    ring(PA, 186, 1126, 40, "tube");
    side(SI, 190, 1120, 44, 50, 0.012, { name: "tube-shine" });
    for (const [a, b] of [[316, 478], [588, 794]]) {
      ring(W, a, b, 54, "heat-shield");
      for (let x = a + 30; x < b - 10; x += 32) ring(WL, x, x + 3, 55, "shield-seam");
      ring(ST, a - 8, a + 4, 56, "shield-clamp");
      ring(ST, b - 4, b + 8, 56, "shield-clamp");
    }
    ring(ST, 1110, 1128, 46, "tube-mouth");

    // optic and sights
    side(ME, 400, 590, 46, 64, 0.012, { name: "optic-mount" });
    side(OL, 380, 612, 4, 46, 0.017, { name: "optic" });
    roundRod(k, OL, 372, 384, 8, 42, "optic-eyepiece", 0);
    roundRod(k, LE, 610, 614, 10, 40, "optic-lens", 0);
    side(OL, 470, 500, 0, 6, 0.012, { name: "optic-knob" });
    side(ME, 1000, 1012, 30, 46, 0.004, { name: "front-sight" });
    side(A, 1002, 1010, 28, 32, 0.0042);
    side(ME, 340, 356, 30, 46, 0.012, { name: "rear-sight" });

    // grips: the pistol grip with its guard and trigger, the front grip; sling swivels
    const ga = tilted(g, Y(132), Z(400), -0.3, "grip");
    ga(W, -0.024, 0.024, -0.112, 0, 0.017, "grip");
    for (let i = 0; i < 5; i++) ga(D, -0.024, 0.024, -0.02 - i * 0.018, -0.017 - i * 0.018, 0.0175, "grip-groove");
    ga(ME, -0.026, 0.026, -0.122, -0.11, 0.0175, "grip-cap");
    side(ME, 430, 500, 168, 176, 0.008, { name: "guard-bottom" });
    side(ME, 492, 500, 124, 176, 0.008);
    bar(ST, 448, 124, 454, 154, 0.007, 0.004, "trigger");
    const gf = tilted(g, Y(130), Z(720), -0.22, "front-grip");
    gf(W, -0.02, 0.02, -0.1, 0, 0.016, "front-grip");
    for (let i = 0; i < 4; i++) gf(D, -0.02, 0.02, -0.02 - i * 0.02, -0.017 - i * 0.02, 0.0165);
    for (const px of [240, 1040]) {
      side(ST, px, px + 14, 124, 132, 0.006, { name: "sling-swivel" });
      side(ST, px + 2, px + 12, 132, 142, 0.0035);
    }

    // warhead: neck, a rear cone of widening rings, the body with a tan band, the front cone and the fuse
    ring(OL, 1124, 1196, 20, "warhead-neck");
    for (let i = 0; i < 5; i++) ring(OL, 1192 + i * 14, 1207 + i * 14, 26 + i * 9, "warhead-cone");
    ring(OL, 1260, 1362, 64, "warhead");
    ring(TN, 1296, 1310, 65, "warhead-band");
    ring(D, 1258, 1262, 65);
    for (let i = 0; i < 8; i++) ring(OL, 1360 + i * 20, 1381 + i * 20, 62 - i * 7.2, "warhead-nose");
    ring(BR, 1520, 1534, 5, "fuse");

    g.name = "dfdf-rpg";
    g.userData.weaponModel = "dfdf-rpg";
    g.userData.design = { key: "rpg", revision: 1 };
    g.userData.anchors = { muzzle: [0, Y(cy), Z(1534)] };
    return g;
  }

  const DESIGNS = { rifle: vandal, scout: phantom, pistol: classic, silenced: ghost, revolver: sheriff, autoshot: judge, hmg: odin, marksman: outlaw, sniper: operator, machpist, knife, smg, whisper, shotgun, pocketshot, carbine, burst, bullpup, rpg };
  window.GUN_DESIGNS = { keys: Object.keys(DESIGNS), build: (key) => (DESIGNS[key] ? DESIGNS[key]() : null), materials: M };
})();

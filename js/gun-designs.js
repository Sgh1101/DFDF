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

    // ammo box: rounded all round. It is stacked from slabs; each slab is two crossed blocks so the upright
    // corners read round, and the slabs near the bottom (and a little at the top) draw in on every side so the
    // lower edges curve like the original. The lid is rounded the same way; the lowest slabs are dark.
    const bW = 0.105, bz0 = Z(578), bz1 = Z(372), bTop = Y(292), bBot = Y(450), rB = 0.05, rT = 0.012, rV = 0.02;
    const box = (m, x, y0, y1, z0, z1, name) => k.add(m, -x, x, y0, y1, z0, z1, 0, name);
    const inset = (r, d) => (d >= r ? 0 : r - Math.sqrt(r * r - (r - d) * (r - d)));
    const slab = (m, y0, y1, ins, name) => {
      const w = bW - ins, a = bz0 + ins, b = bz1 - ins;
      box(m, w, y0, y1, a + rV, b - rV, name);
      box(m, w - rV, y0, y1, a, b);
      box(m, w - rV * 0.3, y0, y1, a + rV * 0.3, b - rV * 0.3);
    };
    const nB = 18, hB = (bTop - bBot) / nB;
    for (let i = 0; i < nB; i++) {
      const y0 = bBot + i * hB, y1 = y0 + hB, mid = (y0 + y1) / 2;
      const ins = Math.max(inset(rB, mid - bBot), inset(rT, bTop - mid));
      slab(mid < Y(424) ? D : PL, y0, y1, ins, i ? "ammo-box" : "box-bottom");
    }
    // lid: a rounded plate a little wider than the box, with a metal lip
    for (const [y0, y1, ins] of [[Y(292), Y(287), 0.004], [Y(287), Y(282), 0], [Y(282), Y(279), 0.006]]) {
      const w = bW + 0.003 - ins, a = bz0 - 0.004 + ins, b = bz1 + 0.004 - ins;
      box(P, w, y0, y1, a + rV, b - rV, "box-lid");
      box(P, w - rV, y0, y1, a, b);
      box(P, w - rV * 0.3, y0, y1, a + rV * 0.3, b - rV * 0.3);
    }
    box(ME, bW + 0.0035, Y(292), Y(289), bz0 + rV, bz1 - rV, "box-lip");
    // inset side panel framed by corner plates, and a seam where the dark bottom starts
    side(P, 390, 560, 306, 404, 0.1055, { name: "box-panel" });
    for (const [px, py] of [[390, 306], [550, 306], [390, 394], [550, 394]]) side(ME, px, px + 10, py, py + 10, 0.1062, { name: "box-corner" });
    side(ME, 578, 588, 316, 384, 0.04, { name: "box-latch" });
    side(ST, 580, 588, 340, 360, 0.02);

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

  const DESIGNS = { rifle: vandal, scout: phantom, pistol: classic, silenced: ghost, revolver: sheriff, autoshot: judge, hmg: odin };
  window.GUN_DESIGNS = { keys: Object.keys(DESIGNS), build: (key) => (DESIGNS[key] ? DESIGNS[key]() : null), materials: M };
})();

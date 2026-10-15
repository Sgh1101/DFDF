
(() => {
  // Shared body polish for every agent. It runs inside each outfit hook,
  // before buildFighter bakes the parts, so nothing here adds draw calls.
  // Agents in long coats or robes skip the pieces that would poke through.
  const ROBE = new Set(["seorin", "yeonhwa", "baekho", "heuksa", "myeongjong", "hongyeol"]);
  const kindOf = (m) => {
    for (const k in CH_KIND) {
      const v = CH_KIND[k];
      if (Math.abs(v.roughness - m.roughness) < 1e-3 && Math.abs(v.metalness - m.metalness) < 1e-3) return k;
    }
    return "cloth";
  };
  // near-black clothing read as flat silhouettes; lift it a little, keep the hue
  const lift = (hex) => {
    const c = new T.Color(hex),
      h = {};
    c.getHSL(h);
    if (h.l < 0.2) c.setHSL(h.h, Math.min(1, h.s * 1.08), h.l + (0.2 - h.l) * 0.45);
    return c.getHex();
  };
  const _bm = chBaseMats;
  chBaseMats = function () {
    const r = _bm.apply(this, arguments);
    for (const k of ["top", "sleeve", "fore", "pants", "boot"]) if (r[k] && r[k] !== r.skin && r[k].color) r[k] = chMat(lift(r[k].color.getHex()), kindOf(r[k]));
    return r;
  };

  const M = () => ({
    pad: chMat(0x2b3038, "rubber"),
    dark: chMat(0x1b1d22, "rubber"),
    strap: chMat(0x2a2420, "leather"),
    buckle: chMat(0x9aa1ab, "metal"),
    lace: chMat(0x6a707a, "cloth"),
  });
  function detail(x, key) {
    const { add, S, O, hips, chest, neck, legL, legR, armL, armR } = x,
      w = S.w || 1,
      b = S.bulk || 1,
      m = M(),
      robe = ROBE.has(key);
    // rounded pelvis and shoulders instead of the base boxes
    const pel = hips.children.find((c) => c.isMesh && c.material === O.pants && c.geometry.type === "BoxGeometry");
    pel && ((pel.geometry = G_SPH(0.5, 12, 9)), pel.scale.set(0.37 * w, 0.25, 0.255), (pel.position.y = -0.015));
    const sh = chest.children.find((c) => c.isMesh && c.material === O.top && c.geometry.type === "BoxGeometry" && Math.abs(c.position.y - 0.34) < 1e-3);
    sh && ((sh.geometry = G_CAP(0.064, 0.32 * w)), sh.rotation.set(0, 0, Math.PI / 2), (sh.position.y = 0.33));
    // outfit belts are wide flat boxes; make them bands that wrap the rounded hips
    for (const c of hips.children) {
      const g = c.isMesh && c.geometry.type === "BoxGeometry" && c.geometry.parameters;
      if (!g || g.height > 0.09 || g.width < 0.3 || g.depth < 0.22 || Math.abs(c.position.x) > 0.01 || c.rotation.x || c.rotation.z) continue;
      c.geometry = G_CYL(0.5, 0.5, 1, 18);
      c.scale.set(g.width * 0.98, g.height, g.depth * 1.02);
    }
    // the base neck is a short stub under a floating head: run a column from the
    // collar up into the jaw, and slope the shoulders into it
    neck && add(neck, G_CYL(0.056, 0.064, 0.21, 10), O.skin, 0, 0.075, 0.005);
    add(chest, G_SPH(0.5, 10, 8), O.top, 0, 0.372, 0.015, { s: [0.3 * w, 0.12, 0.2] });
    // collar ring where the neck meets the torso
    add(chest, G_TOR(0.078, 0.02, 6, 14), O.top, 0, 0.415, 0, { r: [Math.PI / 2, 0, 0] });
    for (const L of [legL, legR]) {
      // hip and knee joints close the gaps between the leg segments
      add(L.leg, G_SPH(0.088 * b, 10, 8), O.pants, 0, -0.02, 0);
      add(L.shin, G_SPH(0.072 * b, 10, 8), O.pants, 0, 0.005, 0);
      // boots: toe cap, ankle cuff, laces
      add(L.shin, G_SPH(0.5, 10, 8), O.boot, 0, -0.372, -0.13, { s: [0.122, 0.085, 0.13] });
      add(L.shin, G_CYL(0.08, 0.084, 0.05, 10), m.dark, 0, -0.245, 0);
      add(L.shin, G_BOX(0.05, 0.08, 0.012), m.lace, 0, -0.315, -0.084, { r: [-0.25, 0, 0] });
      robe || add(L.shin, G_SPH(0.5, 10, 8), m.pad, 0, -0.015, -0.06, { s: [0.12, 0.135, 0.07] });
    }
    for (const A of [armL, armR]) {
      add(A.fore, G_SPH(0.06 * b, 10, 8), O.sleeve, 0, 0, 0);
      // gloves: fingers, knuckle plate and a wrist cuff
      add(A.fore, G_BOX(0.072, 0.056, 0.042), O.hand, 0, -0.312, -0.014, { r: [0.35, 0, 0] });
      add(A.fore, G_BOX(0.062, 0.03, 0.014), m.dark, 0, -0.232, 0.023);
      add(A.fore, G_CYL(0.058 * b, 0.058 * b, 0.03, 10), m.dark, 0, -0.19, 0);
    }
    if (!robe) {
      // right thigh holster with its straps
      add(legR.leg, G_BOX(0.05, 0.17, 0.11), m.strap, 0.086 * b, -0.2, 0.005, { sh: 1 });
      add(legR.leg, G_BOX(0.032, 0.06, 0.05), m.dark, 0.092 * b, -0.1, 0.02);
      add(legR.leg, G_CYL(0.087 * b, 0.087 * b, 0.022, 10), m.strap, 0, -0.14, 0);
      add(legR.leg, G_CYL(0.084 * b, 0.084 * b, 0.022, 10), m.strap, 0, -0.26, 0);
      // small pouch pair on the belt line at the back
      [-1, 1].forEach((e) => add(hips, G_BOX(0.08, 0.08, 0.05), m.strap, 0.1 * e * w, 0.04, 0.14));
    }
  }
  for (const k of Object.keys(CH_OUTFIT)) {
    const f = CH_OUTFIT[k];
    CH_OUTFIT[k] = function (ctx) {
      const r = f.apply(this, arguments);
      try {
        detail(ctx, k);
      } catch (e) {
        console.warn("chdetail", k, e);
      }
      return r;
    };
  }

  // team markings: slim bands instead of chunky rings
  const _bf = buildFighter;
  buildFighter = function () {
    const m = _bf.apply(this, arguments);
    try {
      [m.armL.arm, m.armR.arm].forEach((g) => g.children.forEach((c) => c.material === m.teamMat && c.scale.set(0.84, 0.45, 0.84)));
    } catch (e) {}
    return m;
  };
})();

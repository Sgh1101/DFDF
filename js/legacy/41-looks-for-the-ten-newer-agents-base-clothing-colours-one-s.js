
(() => {
  // Looks for the ten newer agents: base clothing colours, one signature
  // piece each on the 3D model (hood, hat, visor, flames...) and the same
  // piece painted on their portrait, plus a face (the stock portrait has none).
  const BASE = {
    cheongram: { top: 0x14403c, sleeve: [0x14403c, "cloth"], fore: [0x0f2f2c, "cloth"], hand: [0x1a2422, "leather"], pants: 0x182826, boot: [0x101816, "leather"] },
    jeogwol: { top: 0x3a0c10, sleeve: [0x2a0a0c, "leather"], fore: [0x2a0a0c, "leather"], hand: [0x180808, "leather"], pants: 0x1e1012, boot: [0x140a0a, "leather"] },
    sahyeon: { top: 0x4e3a2e, sleeve: [0x5e4636, "leather"], fore: [0x3a2a20, "leather"], hand: [0x2a1e16, "leather"], pants: 0x3a3026, boot: [0x2a2018, "leather"] },
    unhae: { top: 0x37474f, sleeve: [0x455a64, "cloth"], fore: [0x455a64, "cloth"], hand: [0x263238, "cloth"], pants: 0x2b363c, boot: [0x1c2428, "leather"] },
    jinroe: { top: 0x2e2a10, sleeve: [0x3a3414, "rubber"], fore: [0x3a3414, "rubber"], hand: [0x1a1a10, "rubber"], pants: 0x24220e, boot: [0x141408, "rubber"] },
    mukhyang: { top: 0x2a1d18, sleeve: [0x2a1d18, "cloth"], fore: [0x3a2a22, "cloth"], hand: [0x14100e, "leather"], pants: 0x1e1612, boot: [0x100c0a, "leather"] },
    seohwi: { top: 0x2a1f44, sleeve: [0x332656, "rubber"], fore: [0x221a38, "rubber"], hand: [0x18142a, "rubber"], pants: 0x201a34, boot: [0x141022, "rubber"] },
    haerang: { top: 0x0d2f45, sleeve: [0x10405e, "cloth"], fore: [0x0d2f45, "cloth"], hand: [0x0a1c28, "leather"], pants: 0x0f2636, boot: [0x0a1822, "rubber"] },
    danbi: { top: 0x1f3a22, sleeve: [0x2a4a2c, "cloth"], fore: [0x2a4a2c, "cloth"], hand: [0x3a3020, "leather"], pants: 0x23301e, boot: [0x2a2418, "leather"] },
    hongyeom: { top: 0x40160a, sleeve: [0x2a0e06, "leather"], fore: [0x5a2010, "leather"], hand: [0x1e0c06, "leather"], pants: 0x2a140c, boot: [0x1a0c06, "leather"] },
  };
  const geo = (n, f) => chGeo("ax_" + n, f);
  const cone = (r, h, s = 12) => geo(`cone${r}_${h}_${s}`, () => new T.ConeGeometry(r, h, s));
  const OUT = {
    cheongram({ add, neck, chest, S }) {
      const c = chMat(0x14403c, "cloth"),
        t = chMat(0x26a69a, "paint"),
        g = chGlow(0x64ffda, 1.4);
      add(neck, G_HSPH(0.16, 0.62), c, 0, 0.22, 0.01, { s: [1.05, 1.15, 1.1], sh: 1 }); // hood
      add(chest, G_TOR(0.12, 0.035, 6, 16), t, 0, 0.42, 0, { r: [Math.PI / 2, 0, 0] }); // scarf
      add(chest, G_BOX(0.06, 0.06, 0.02), g, 0.08 * S.w, 0.3, -0.13);
    },
    jeogwol({ add, neck, chest, S }) {
      const h = chMat(0x120404, "hair"),
        r = chGlow(0xff1744, 1.3),
        s = chMat(0xb71c1c, "cloth");
      add(neck, G_CYL(0.05, 0.03, 0.42, 8), h, 0, 0.12, 0.13, { r: [0.25, 0, 0], sh: 1 }); // ponytail
      add(neck, G_TOR(0.06, 0.012, 4, 14, Math.PI), r, 0, 0.36, 0.02, { r: [0, 0, 0.3] }); // crescent pin
      add(chest, G_BOX(0.5 * S.w, 0.07, 0.3), s, 0, 0.05, 0, { r: [0, 0, 0.45] }); // sash
    },
    sahyeon({ add, neck, chest }) {
      const b = chMat(0x5d4037, "leather"),
        d = chMat(0x3e2723, "leather");
      add(neck, G_CYL(0.3, 0.3, 0.02, 24), b, 0, 0.31, 0, { sh: 1 }); // brim
      add(neck, G_CYL(0.12, 0.14, 0.13, 16), b, 0, 0.38, 0, { sh: 1 }); // crown
      add(chest, G_CYL(0.05, 0.05, 0.5, 8), d, 0.1, 0.2, 0.15, { r: [0, 0, 0.5], sh: 1 }); // quiver
    },
    unhae({ add, neck, chest }) {
      const c = chMat(0x546e7a, "cloth"),
        m = chMat(0xeceff1, "cloth", { transparent: !0, opacity: 0.35, depthWrite: !1 });
      add(neck, G_HSPH(0.16, 0.6), c, 0, 0.22, 0.01, { s: [1.05, 1.1, 1.1], sh: 1 });
      add(chest, G_SPH(0.32, 12, 8), m, 0, 0.36, 0, { s: [1.1, 0.35, 1] }); // mist mantle
    },
    jinroe({ add, neck, chest, S }) {
      const y = chGlow(0xffee58, 1.6),
        p = chMat(0x3a3414, "metal");
      for (let i = 0; i < 5; i++) add(neck, cone(0.035, 0.16, 6), y, (i - 2) * 0.045, 0.37, 0.01, { r: [0, 0, (i - 2) * -0.35] });
      [-1, 1].forEach((e) => add(chest, G_SPH(0.1, 10, 8), p, e * 0.22 * S.w, 0.36, 0, { s: [1.2, 0.6, 1], sh: 1 }));
    },
    mukhyang({ add, neck }) {
      const k = chMat(0x0c0806, "hair"),
        m = chMat(0x1a1210, "cloth");
      add(neck, G_SPH(0.06, 10, 8), k, 0, 0.39, 0.03); // topknot
      add(neck, G_BOX(0.2, 0.07, 0.04), m, 0, 0.19, -0.11); // face cloth
    },
    seohwi({ add, neck }) {
      const v = chGlow(0xb388ff, 1.7),
        d = chMat(0x221438, "metal");
      add(neck, G_BOX(0.22, 0.045, 0.05), v, 0, 0.26, -0.105); // visor
      add(neck, G_CYL(0.006, 0.006, 0.2, 4), d, 0.1, 0.4, 0.02, { r: [0, 0, -0.3] }); // antenna
      add(neck, G_SPH(0.016, 6, 6), v, 0.13, 0.5, 0.02);
    },
    haerang({ add, neck, chest }) {
      const b = chMat(0x0288d1, "cloth"),
        w = chGlow(0x81d4fa, 1.2);
      add(neck, G_TOR(0.125, 0.018, 6, 20), b, 0, 0.3, 0, { r: [Math.PI / 2 - 0.12, 0, 0] }); // headband
      add(neck, G_BOX(0.03, 0.18, 0.01), b, 0.04, 0.22, 0.15, { r: [0.4, 0, 0.2] }); // band tails
      add(chest, G_TOR(0.07, 0.012, 4, 14), w, 0, 0.22, -0.14);
    },
    danbi({ add, neck, chest }) {
      const g = chMat(0x7cb342, "cloth"),
        s = chMat(0x6d4c41, "leather");
      add(neck, cone(0.3, 0.16, 18), g, 0, 0.38, 0, { sh: 1 }); // satgat
      add(chest, G_BOX(0.14, 0.12, 0.06), s, -0.14, 0.02, -0.12); // satchel
    },
    hongyeom({ add, neck, chest, armL, armR }) {
      const f = chGlow(0xff6e40, 1.8),
        g = chMat(0x5a2010, "metal");
      for (let i = 0; i < 4; i++) add(neck, cone(0.04, 0.18 - i * 0.02, 6), f, 0, 0.38 - i * 0.015, 0.06 * i - 0.06);
      [armL, armR].forEach((A) => add(A.fore, G_CYL(0.075, 0.08, 0.16, 9), g, 0, -0.2, 0));
    },
  };
  for (const id in BASE) {
    try {
      CH_BASE_EXTRA[id] = BASE[id];
    } catch (e) {}
    CH_OUTFIT[id] = OUT[id];
  }

  // ── portraits: face + the same signature piece, painted over the stock one ──
  const PAINT = {
    cheongram(g, W, H, X, Y, R) {
      g.fillStyle = "#14403c";
      g.beginPath();
      g.moveTo(X - R * 1.5, Y + R * 2.2);
      g.quadraticCurveTo(X - R * 1.6, Y - R * 1.9, X, Y - R * 1.75);
      g.quadraticCurveTo(X + R * 1.6, Y - R * 1.9, X + R * 1.5, Y + R * 2.2);
      g.lineTo(X + R * 1.05, Y + R * 1.6);
      g.quadraticCurveTo(X + R * 1.15, Y - R * 1.1, X, Y - R * 1.15);
      g.quadraticCurveTo(X - R * 1.15, Y - R * 1.1, X - R * 1.05, Y + R * 1.6);
      g.closePath();
      g.fill();
      g.fillStyle = "#26a69a";
      g.fillRect(X - R * 1.2, Y + R * 1.55, R * 2.4, R * 0.35);
    },
    jeogwol(g, W, H, X, Y, R) {
      g.fillStyle = "#140505";
      g.beginPath();
      g.ellipse(X, Y - R * 0.55, R * 1.08, R * 0.75, 0, Math.PI, 0);
      g.fill();
      g.fillRect(X - R * 1.1, Y - R * 0.6, R * 0.35, R * 2.6);
      g.fillRect(X + R * 0.75, Y - R * 0.6, R * 0.35, R * 2.6);
      g.strokeStyle = "#ff1744";
      g.lineWidth = R * 0.12;
      g.beginPath();
      g.arc(X + R * 0.6, Y - R * 0.95, R * 0.28, 0.6, 4.2);
      g.stroke();
    },
    sahyeon(g, W, H, X, Y, R) {
      g.fillStyle = "#5d4037";
      g.beginPath();
      g.ellipse(X, Y - R * 0.95, R * 2.1, R * 0.32, 0, 0, 7);
      g.fill();
      g.fillStyle = "#4e342e";
      g.fillRect(X - R * 0.8, Y - R * 1.75, R * 1.6, R * 0.85);
      g.strokeStyle = "#8d6e63";
      g.lineWidth = R * 0.12;
      g.beginPath();
      g.moveTo(X + R * 1.2, Y + R * 1.8);
      g.lineTo(X + R * 2.2, Y + R * 0.4);
      g.stroke();
    },
    unhae(g, W, H, X, Y, R) {
      g.fillStyle = "#546e7a";
      g.beginPath();
      g.moveTo(X - R * 1.5, Y + R * 2.2);
      g.quadraticCurveTo(X - R * 1.6, Y - R * 1.9, X, Y - R * 1.75);
      g.quadraticCurveTo(X + R * 1.6, Y - R * 1.9, X + R * 1.5, Y + R * 2.2);
      g.lineTo(X + R * 1.05, Y + R * 1.6);
      g.quadraticCurveTo(X + R * 1.15, Y - R * 1.1, X, Y - R * 1.15);
      g.quadraticCurveTo(X - R * 1.15, Y - R * 1.1, X - R * 1.05, Y + R * 1.6);
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(236,239,241,.3)";
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.ellipse(W * (0.15 + i * 0.14), H * 0.9, W * 0.13, H * 0.05, 0, 0, 7);
        g.fill();
      }
    },
    jinroe(g, W, H, X, Y, R) {
      g.fillStyle = "#ffee58";
      g.shadowColor = "#ffee58";
      g.shadowBlur = R * 0.6;
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.moveTo(X + i * R * 0.42 - R * 0.22, Y - R * 0.75);
        g.lineTo(X + i * R * 0.62, Y - R * 1.9 + Math.abs(i) * R * 0.25);
        g.lineTo(X + i * R * 0.42 + R * 0.22, Y - R * 0.75);
        g.fill();
      }
      g.shadowBlur = 0;
    },
    mukhyang(g, W, H, X, Y, R) {
      g.fillStyle = "#0c0806";
      g.beginPath();
      g.ellipse(X, Y - R * 0.6, R * 1.05, R * 0.6, 0, Math.PI, 0);
      g.fill();
      g.beginPath();
      g.arc(X, Y - R * 1.35, R * 0.32, 0, 7);
      g.fill();
      g.fillStyle = "#1a1210";
      g.fillRect(X - R * 0.95, Y + R * 0.15, R * 1.9, R * 0.75);
    },
    seohwi(g, W, H, X, Y, R) {
      g.fillStyle = "#221438";
      g.beginPath();
      g.ellipse(X, Y - R * 0.6, R * 1.05, R * 0.6, 0, Math.PI, 0);
      g.fill();
      g.fillStyle = "#b388ff";
      g.shadowColor = "#b388ff";
      g.shadowBlur = R * 0.7;
      g.fillRect(X - R * 0.95, Y - R * 0.3, R * 1.9, R * 0.32);
      g.shadowBlur = 0;
      g.strokeStyle = "#b388ff";
      g.lineWidth = R * 0.06;
      g.beginPath();
      g.moveTo(X + R * 0.7, Y - R * 0.9);
      g.lineTo(X + R * 1.2, Y - R * 2);
      g.stroke();
    },
    haerang(g, W, H, X, Y, R) {
      g.fillStyle = "#0a2236";
      g.beginPath();
      g.ellipse(X, Y - R * 0.6, R * 1.08, R * 0.65, 0, Math.PI, 0);
      g.fill();
      g.fillStyle = "#0288d1";
      g.fillRect(X - R * 1.05, Y - R * 0.75, R * 2.1, R * 0.26);
      g.beginPath();
      g.moveTo(X + R * 1.0, Y - R * 0.7);
      g.lineTo(X + R * 1.9, Y - R * 0.2);
      g.lineTo(X + R * 1.7, Y + R * 0.05);
      g.lineTo(X + R * 1.0, Y - R * 0.45);
      g.fill();
    },
    danbi(g, W, H, X, Y, R) {
      g.fillStyle = "#7cb342";
      g.beginPath();
      g.moveTo(X - R * 2.2, Y - R * 0.7);
      g.lineTo(X, Y - R * 2.0);
      g.lineTo(X + R * 2.2, Y - R * 0.7);
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(179,229,252,.55)";
      for (let i = 0; i < 9; i++) g.fillRect(W * (0.08 + i * 0.105), H * (0.08 + ((i * 37) % 30) / 100), 2, H * 0.05);
    },
    hongyeom(g, W, H, X, Y, R) {
      g.shadowColor = "#ff6e40";
      g.shadowBlur = R * 0.8;
      g.fillStyle = "#ff6e40";
      g.beginPath();
      g.moveTo(X - R * 0.45, Y - R * 0.7);
      g.quadraticCurveTo(X - R * 0.5, Y - R * 1.8, X, Y - R * 2.4);
      g.quadraticCurveTo(X + R * 0.2, Y - R * 1.6, X + R * 0.45, Y - R * 1.9);
      g.quadraticCurveTo(X + R * 0.6, Y - R * 1.2, X + R * 0.45, Y - R * 0.7);
      g.fill();
      g.fillStyle = "#ffd180";
      g.beginPath();
      g.ellipse(X, Y - R * 1.15, R * 0.18, R * 0.4, 0, 0, 7);
      g.fill();
      g.shadowBlur = 0;
    },
  };
  const face = (g, X, Y, R, eye) => {
    g.fillStyle = "#1b1b1f";
    [-1, 1].forEach((s) => {
      g.beginPath();
      g.ellipse(X + s * R * 0.38, Y, R * 0.13, R * 0.09, 0, 0, 7);
      g.fill();
    });
    g.fillStyle = eye;
    [-1, 1].forEach((s) => {
      g.beginPath();
      g.arc(X + s * R * 0.38 + R * 0.03, Y - R * 0.01, R * 0.045, 0, 7);
      g.fill();
    });
    g.strokeStyle = "rgba(30,20,20,.75)";
    g.lineWidth = R * 0.07;
    [-1, 1].forEach((s) => {
      g.beginPath();
      g.moveTo(X + s * R * 0.2, Y - R * 0.22);
      g.lineTo(X + s * R * 0.58, Y - R * 0.27);
      g.stroke();
    });
    g.strokeStyle = "rgba(90,40,40,.7)";
    g.lineWidth = R * 0.05;
    g.beginPath();
    g.moveTo(X - R * 0.18, Y + R * 0.5);
    g.quadraticCurveTo(X, Y + R * 0.56, X + R * 0.18, Y + R * 0.5);
    g.stroke();
  };
  const _ap = agentPortrait;
  agentPortrait = function (ag, w, h) {
    const id = ag && (ag.id || ag.key);
    if (!PAINT[id]) return _ap.apply(this, arguments);
    const key = id + "_" + (w || 300) + "_" + (h || 380) + "_x";
    if (PORTRAIT_CACHE[key]) return PORTRAIT_CACHE[key];
    // catch the canvas the stock painter draws on, then paint on top of it
    let cv = null;
    const ce = document.createElement;
    document.createElement = function (t) {
      const el = ce.apply(document, arguments);
      "canvas" === String(t).toLowerCase() && !cv && (cv = el);
      return el;
    };
    let url;
    try {
      url = _ap.apply(this, arguments);
    } finally {
      document.createElement = ce;
    }
    if (!cv) return url;
    const g = cv.getContext("2d"),
      W = cv.width,
      H = cv.height,
      X = W * 0.5,
      Y = H * 0.37,
      R = W * 0.12;
    try {
      face(g, X, Y, R, ag.accent || "#ddd");
      PAINT[id](g, W, H, X, Y, R);
      url = cv.toDataURL();
    } catch (e) {}
    return (PORTRAIT_CACHE[key] = url);
  };
  // pictures already handed out before this ran
  try {
    const tr = document.getElementById("title-roster");
    tr &&
      [...tr.children].forEach((c, i) => {
        const a = AGENTS[i],
          im = c.querySelector("img");
        a && PAINT[a.id] && im && (im.src = agentPortrait(a, 120, 150));
      });
    typeof renderSelect == "function" && renderSelect();
  } catch (e) {}
})();

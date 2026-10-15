
(() => {
  // Portraits for the twenty-two agents that got a whole new look: the same
  // card as the first fourteen (role pattern, light in the agent's colour,
  // shoulders up), painted with what each now wears.
  if ("function" != typeof agentPortrait || !window.CH_DESIGN) return;
  const PI = Math.PI;
  const HX = (c) => ("string" == typeof c ? parseInt(c.replace("#", ""), 16) : c);
  // m < 1 darkens, m > 1 mixes toward white
  const rgb = (c, m) => {
    c = HX(c);
    m = null == m ? 1 : m;
    let r = (c >> 16) & 255,
      g = (c >> 8) & 255,
      b = c & 255;
    if (m <= 1) (r *= m), (g *= m), (b *= m);
    else {
      const k = Math.min(1, m - 1);
      (r += (255 - r) * k), (g += (255 - g) * k), (b += (255 - b) * k);
    }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  };
  const rgba = (c, a) => {
    c = HX(c);
    return `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
  };

  function canvasFor(ag, W, H) {
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const r = cv.getContext("2d"),
      st = Object.assign({ w: 1, skin: 0xb58a6e, hair: 0x2a2420, eye: 0x222222, coat: 0x3a4250, trim: 0x8a96ab }, CH_STYLE[ag.id] || {}),
      u = 0.128 * W,
      cx = 0.5 * W,
      hy = 0.34 * H;
    const C = { cv, r, W, H, st, u, cx, hy, ey: hy + 0.02 * u, sh: hy + 1.72 * u, bw: 0.4 * W * Math.min(1.14, st.w || 1), ac: HX(ag.color) };
    // points in units: P from the centre of the head, Q from the middle of the shoulder line
    C.P = (dx, dy) => [cx + dx * u, hy + dy * u];
    C.Q = (dx, dy) => [cx + dx * u, C.sh + dy * u];
    C.ell = (x, y, rx, ry, fill, rot) => {
      r.fillStyle = fill;
      r.beginPath();
      r.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, 2 * PI);
      r.fill();
    };
    C.poly = (pts, fill) => {
      r.fillStyle = fill;
      r.beginPath();
      pts.forEach(([x, y], i) => (i ? r.lineTo(x, y) : r.moveTo(x, y)));
      r.closePath();
      r.fill();
    };
    C.rr = (x, y, w, h, rad, fill) => {
      r.fillStyle = fill;
      r.beginPath();
      r.roundRect(x, y, w, h, rad);
      r.fill();
    };
    C.line = (pts, stroke, width, cap) => {
      r.strokeStyle = stroke;
      r.lineWidth = width;
      r.lineCap = cap || "round";
      r.lineJoin = "round";
      r.beginPath();
      pts.forEach(([x, y], i) => (i ? r.lineTo(x, y) : r.moveTo(x, y)));
      r.stroke();
    };
    C.ring = (x, y, rx, ry, stroke, width, rot) => {
      r.strokeStyle = stroke;
      r.lineWidth = width;
      r.beginPath();
      r.ellipse(x, y, rx, ry, rot || 0, 0, 2 * PI);
      r.stroke();
    };
    C.glow = (c, b) => {
      r.shadowColor = "number" == typeof c ? rgb(c) : c;
      r.shadowBlur = b * u;
    };
    C.noglow = () => (r.shadowBlur = 0);
    return C;
  }

  // ── the card: background and finish, as on the first fourteen ──
  function backdrop(C, ag) {
    const { r, W: t, H: o } = C,
      c = HX(ag.color),
      d = (a) => rgba(c, a),
      h = r.createRadialGradient(0.5 * t, 0.3 * o, 10, 0.5 * t, 0.55 * o, 0.78 * o);
    h.addColorStop(0, d(0.34));
    h.addColorStop(0.45, d(0.1));
    h.addColorStop(1, "rgba(10,13,18,1)");
    r.fillStyle = "#0b0e14";
    r.fillRect(0, 0, t, o);
    r.fillStyle = h;
    r.fillRect(0, 0, t, o);
    r.save();
    r.globalAlpha = 0.16;
    r.strokeStyle = ag.color;
    r.lineWidth = 1.4;
    const p = ag.role;
    if ("타격대" === p)
      for (let e = 0; e < 11; e++) {
        const a = -PI / 2 + 0.2 * (e - 5);
        r.beginPath();
        r.moveTo(t / 2, 0.42 * o);
        r.lineTo(t / 2 + Math.cos(a) * t, 0.42 * o + Math.sin(a) * t);
        r.stroke();
      }
    else if ("감시자" === p)
      for (let e = 1; e <= 6; e++) {
        r.beginPath();
        r.arc(0.5 * t, 0.4 * o, e * t * 0.085, 0, 7);
        r.stroke();
      }
    else if ("척후대" === p)
      for (let e = -6; e < 14; e++) {
        r.beginPath();
        r.moveTo(28 * e, 0);
        r.lineTo(28 * e + 0.7 * o, o);
        r.stroke();
      }
    else
      for (let e = 0; e < 7; e++)
        for (let q = 0; q < 6; q++) {
          const x0 = 54 * q + (e % 2) * 27,
            y0 = 46 * e;
          r.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * PI * 2,
              x = x0 + 22 * Math.cos(a),
              y = y0 + 22 * Math.sin(a);
            k ? r.lineTo(x, y) : r.moveTo(x, y);
          }
          r.closePath();
          r.stroke();
        }
    r.restore();
  }
  function finish(C, ag) {
    const { r, W: t, H: o, cx, hy, u } = C,
      c = HX(ag.color);
    r.save();
    r.globalCompositeOperation = "lighter";
    const R = r.createRadialGradient(cx, hy, 0.8 * u, cx, hy, 2.4 * u);
    R.addColorStop(0, rgba(c, 0));
    R.addColorStop(0.5, rgba(c, 0.14));
    R.addColorStop(1, rgba(c, 0));
    r.fillStyle = R;
    r.fillRect(0, 0, t, o);
    r.restore();
    const D = r.createLinearGradient(0, 0.62 * o, 0, o);
    D.addColorStop(0, "rgba(11,14,20,0)");
    D.addColorStop(1, "rgba(11,14,20,.92)");
    r.fillStyle = D;
    r.fillRect(0, 0.62 * o, t, 0.38 * o);
    r.globalAlpha = 0.06;
    r.fillStyle = "#000";
    for (let e = 0; e < o; e += 3) r.fillRect(0, e, t, 1);
    r.globalAlpha = 1;
  }

  // ── the figure ──
  function shoulders(C, col) {
    const { r, cx, sh, u, bw, W, H } = C,
      L = new Path2D();
    L.moveTo(cx - bw - 0.05 * W, H);
    L.quadraticCurveTo(cx - bw, sh + 0.15 * u, cx - 0.95 * u, sh - 0.2 * u);
    L.lineTo(cx + 0.95 * u, sh - 0.2 * u);
    L.quadraticCurveTo(cx + bw, sh + 0.15 * u, cx + bw + 0.05 * W, H);
    L.closePath();
    const N = r.createLinearGradient(0, sh - 0.3 * u, 0, H);
    N.addColorStop(0, rgb(col, 1.08));
    N.addColorStop(1, rgb(col, 0.38));
    r.fillStyle = N;
    r.fill(L);
    return L;
  }
  // paint inside the shoulders only
  const inside = (C, L, fn) => {
    C.r.save();
    C.r.clip(L);
    fn();
    C.r.restore();
  };
  const neck = (C) => C.rr(C.cx - 0.34 * C.u, C.hy + 0.62 * C.u, 0.68 * C.u, 0.95 * C.u, 0.18 * C.u, rgb(C.st.skin, 0.74));
  function head(C) {
    const { r, cx, hy, u, st } = C,
      O = r.createRadialGradient(cx - 0.3 * u, hy - 0.4 * u, 0.1 * u, cx, hy, 1.2 * u);
    O.addColorStop(0, rgb(st.skin, 1.12));
    O.addColorStop(1, rgb(st.skin, 0.78));
    [-1, 1].forEach((s) => C.ell(cx + s * 0.9 * u, hy + 0.08 * u, 0.13 * u, 0.22 * u, rgb(st.skin, 0.74)));
    // a jaw that narrows to the chin, like the head in the game
    r.fillStyle = O;
    r.beginPath();
    r.moveTo(...C.P(0, -1.06));
    r.bezierCurveTo(...C.P(0.62, -1.06), ...C.P(0.92, -0.6), ...C.P(0.9, 0.05));
    r.bezierCurveTo(...C.P(0.88, 0.62), ...C.P(0.46, 1.06), ...C.P(0, 1.08));
    r.bezierCurveTo(...C.P(-0.46, 1.06), ...C.P(-0.88, 0.62), ...C.P(-0.9, 0.05));
    r.bezierCurveTo(...C.P(-0.92, -0.6), ...C.P(-0.62, -1.06), ...C.P(0, -1.06));
    r.fill();
  }
  // o: { eyes: false, brows: false, nose: false, mouth: false, skip: side whose eye is covered }
  function face(C, o) {
    o = o || {};
    const { r, cx, hy, u, ey, st } = C;
    if (!1 !== o.eyes)
      [-1, 1].forEach((s) => {
        if (o.skip === s) return;
        C.ell(cx + s * 0.36 * u, ey, 0.15 * u, 0.085 * u, "#f3efe9");
        C.ell(cx + s * 0.34 * u, ey, 0.078 * u, 0.078 * u, rgb(st.eye));
        C.ell(cx + s * 0.34 * u, ey, 0.036 * u, 0.036 * u, "#0b0b0e");
        C.ell(cx + s * 0.34 * u - 0.026 * u, ey - 0.026 * u, 0.017 * u, 0.017 * u, "rgba(255,255,255,.9)");
        C.line([[cx + s * 0.2 * u, ey - 0.08 * u], [cx + s * 0.36 * u, ey - 0.1 * u], [cx + s * 0.52 * u, ey - 0.07 * u]], "#1a1412", 0.035 * u);
      });
    if (!1 !== o.brows)
      [-1, 1].forEach((s) => {
        if (o.skip === s) return;
        C.line([[cx + s * 0.16 * u, ey - 0.2 * u], [cx + s * 0.56 * u, ey - 0.27 * u]], rgb(st.hair, 0.62), 0.065 * u);
      });
    if (!1 !== o.nose) C.line([[cx, ey + 0.08 * u], [cx - 0.06 * u, ey + 0.36 * u], [cx + 0.05 * u, ey + 0.39 * u]], rgb(st.skin, 0.72), 0.045 * u);
    if (!1 !== o.mouth) {
      r.strokeStyle = rgb(st.skin, 0.55);
      r.lineWidth = 0.05 * u;
      r.lineCap = "round";
      r.beginPath();
      r.moveTo(cx - 0.2 * u, hy + 0.6 * u);
      r.quadraticCurveTo(cx, hy + 0.67 * u, cx + 0.2 * u, hy + 0.6 * u);
      r.stroke();
    }
  }

  // ── hair ──
  // a cap over the top of the head down to lo at the sides
  function cap(C, col, lo) {
    const { r } = C;
    lo = null == lo ? 0.15 : lo;
    r.fillStyle = rgb(col);
    r.beginPath();
    r.moveTo(...C.P(-0.95, lo));
    r.bezierCurveTo(...C.P(-1.07, -1.34), ...C.P(1.07, -1.34), ...C.P(0.95, lo));
    r.quadraticCurveTo(...C.P(0.86, -0.42), ...C.P(0.32, -0.6));
    r.quadraticCurveTo(...C.P(0, -0.68), ...C.P(-0.32, -0.6));
    r.quadraticCurveTo(...C.P(-0.86, -0.42), ...C.P(-0.95, lo));
    r.closePath();
    r.fill();
    C.line([C.P(-0.55, -0.92), C.P(-0.1, -1.08), C.P(0.35, -1.02)], "rgba(255,255,255,.13)", 0.1 * C.u);
  }
  // bangs: pointed (zig), straight, or swept by tilt
  function bangs(C, col, o) {
    o = o || {};
    const n = o.n || 8,
      x0 = null == o.x0 ? -0.9 : o.x0,
      x1 = null == o.x1 ? 0.9 : o.x1,
      lo = null == o.lo ? -0.3 : o.lo,
      hi = null == o.hi ? -0.5 : o.hi,
      tilt = o.tilt || 0;
    const pts = [C.P(x0, -0.8), C.P((x0 + x1) / 2, -0.98), C.P(x1, -0.8)];
    for (let i = n; i >= 0; i--) {
      const t = i / n,
        y = (o.zig && i % 2 ? hi : lo) + tilt * (t - 0.5);
      pts.push(C.P(x0 + (x1 - x0) * t, y));
    }
    C.poly(pts, rgb(col));
  }
  // long hair behind the head and shoulders
  function hairBack(C, col, len, wd) {
    const { r } = C;
    wd = wd || 1.15;
    r.fillStyle = rgb(col, 0.8);
    r.beginPath();
    r.moveTo(...C.P(-wd, len));
    r.lineTo(...C.P(-wd, -0.1));
    r.bezierCurveTo(...C.P(-1.14, -1.42), ...C.P(1.14, -1.42), ...C.P(wd, -0.1));
    r.lineTo(...C.P(wd, len));
    for (let i = 1; i < 10; i++) r.lineTo(...C.P(wd - (2 * wd * i) / 10, len + (i % 2 ? -0.3 : 0)));
    r.closePath();
    r.fill();
  }
  // locks falling in front of the shoulders
  function locks(C, col, len, sides) {
    (sides || [-1, 1]).forEach((s) =>
      C.poly([C.P(s * 0.72, -0.55), C.P(s * 1.04, -0.2), C.P(s * 1.12, len), C.P(s * 0.98, len + 0.3), C.P(s * 0.84, len - 0.05), C.P(s * 0.8, 0.3)], rgb(col)),
    );
  }

  // ── on the head ──
  function hoodRing(C, col) {
    const { r, u } = C;
    r.fillStyle = rgb(col);
    r.beginPath();
    r.ellipse(...C.P(0, -0.08), 1.34 * u, 1.46 * u, 0, 0, 2 * PI);
    r.ellipse(...C.P(0, 0.1), 0.86 * u, 1.0 * u, 0, 0, 2 * PI);
    r.fill("evenodd");
    C.ring(...C.P(0, 0.1), 0.88 * u, 1.02 * u, rgb(col, 0.55), 0.08 * u);
  }
  const cowl = (C, col) => C.poly([C.P(-1.2, 0.5), C.P(1.2, 0.5), C.Q(2.3, 0.7), C.Q(-2.3, 0.7)], rgb(col, 0.85));
  function lowerMask(C, col, top) {
    const { r } = C;
    top = null == top ? 0.2 : top;
    r.fillStyle = rgb(col);
    r.beginPath();
    r.moveTo(...C.P(-0.93, top));
    r.quadraticCurveTo(...C.P(0, top - 0.1), ...C.P(0.93, top));
    r.bezierCurveTo(...C.P(0.9, 0.72), ...C.P(0.46, 1.12), ...C.P(0, 1.14));
    r.bezierCurveTo(...C.P(-0.46, 1.12), ...C.P(-0.9, 0.72), ...C.P(-0.93, top));
    r.fill();
    C.line([C.P(-0.6, top + 0.12), C.P(0.6, top + 0.12)], "rgba(255,255,255,.08)", 0.06 * C.u);
  }
  function pauldron(C, s, col, k, trim) {
    const { r, u } = C,
      [x, y] = C.Q(s * 2.05, 0.3),
      g = r.createRadialGradient(x - s * 0.3 * u, y - 0.35 * u, 0.1 * u, x, y, 1.05 * u * k);
    g.addColorStop(0, rgb(col, 1.4));
    g.addColorStop(1, rgb(col, 0.55));
    C.ell(x, y, 0.95 * u * k, 0.62 * u * k, g, -s * 0.28);
    trim && C.ring(x, y + 0.05 * u, 0.9 * u * k, 0.56 * u * k, rgb(trim), 0.08 * u, -s * 0.28);
  }
  function plate(C, col, L) {
    const { r, u } = C,
      g = r.createLinearGradient(C.cx - 1.8 * u, 0, C.cx + 1.8 * u, 0);
    g.addColorStop(0, rgb(col, 0.55));
    g.addColorStop(0.42, rgb(col, 1.3));
    g.addColorStop(1, rgb(col, 0.5));
    inside(C, L, () => {
      r.fillStyle = g;
      r.beginPath();
      r.moveTo(...C.Q(-1.8, 0.1));
      r.quadraticCurveTo(...C.Q(-2, 2.8), ...C.Q(0, 3.6));
      r.quadraticCurveTo(...C.Q(2, 2.8), ...C.Q(1.8, 0.1));
      r.quadraticCurveTo(...C.Q(0, -0.5), ...C.Q(-1.8, 0.1));
      r.fill();
      C.line([C.Q(-1.2, 0.5), C.Q(-0.5, 0.15)], "rgba(255,255,255,.25)", 0.08 * u);
    });
  }
  // an open jacket: shirt between the lapels, trim down the edges
  function jacket(C, o) {
    const { u } = C;
    o.shirt && C.poly([C.Q(-0.44, -0.25), C.Q(0.44, -0.25), C.Q(0.34, 5), C.Q(-0.34, 5)], rgb(o.shirt));
    [-1, 1].forEach((s) => C.poly([C.Q(s * 0.42, -0.25), C.Q(s * 1.1, -0.18), C.Q(s * 0.44, 1.7)], rgb(o.lapel)));
    if (o.trim) {
      o.glow && C.glow(o.trim, 0.5);
      [-1, 1].forEach((s) => C.line([C.Q(s * 0.44, -0.2), C.Q(s * 0.38, 5)], rgb(o.trim), 0.07 * u));
      C.noglow();
    }
  }
  const collar = (C, col, h) => C.rr(C.cx - 0.6 * C.u, C.sh - 0.55 * C.u, 1.2 * C.u, (h || 0.5) * C.u, 0.2 * C.u, rgb(col));
  const glowDot = (C, x, y, rad, col, b) => {
    C.glow(col, b || 0.6);
    C.ell(x, y, rad, rad, rgb(col, 1.25));
    C.noglow();
  };
  const star4 = (C, x, y, s, col) => {
    C.glow(col, 0.8);
    C.poly([[x, y - s], [x + 0.25 * s, y - 0.25 * s], [x + s, y], [x + 0.25 * s, y + 0.25 * s], [x, y + s], [x - 0.25 * s, y + 0.25 * s], [x - s, y], [x - 0.25 * s, y - 0.25 * s]], rgb(col, 1.3));
    C.noglow();
  };

  // ── the twenty-two ──
  // back: behind the figure, body: on the shoulders, collar: over the neck,
  // hair, head: headwear and masks, front: in front of it all, face: what shows
  const PAINT = {
    baram: {
      back(C) {
        // the scarf streams out in the wind
        [
          [0, 0.46, 1],
          [0.42, 0.34, 0.86],
        ].forEach(([dy, wd, k]) => {
          C.line([C.P(0.3, 1.5 + dy), C.P(1.6, 1.15 + dy), C.P(2.8 * k + 0.2, 0.6 + dy), C.P(3.95, 0.45 + dy * 1.4)], rgb(0x26c6da, 0.85 - dy * 0.4), wd * C.u, "butt");
          C.glow(0x84ffff, 0.4);
          C.line([C.P(1.6, 0.94 + dy), C.P(2.8 * k + 0.2, 0.4 + dy), C.P(3.95, 0.24 + dy * 1.4)], rgb(0x84ffff), 0.05 * C.u);
          C.noglow();
        });
      },
      body(C) {
        jacket(C, { shirt: 0x263238, lapel: 0x23727c, trim: 0x4dd0e1, glow: !0 });
      },
      collar(C) {
        C.rr(C.cx - 0.95 * C.u, C.sh - 0.62 * C.u, 1.9 * C.u, 0.66 * C.u, 0.33 * C.u, rgb(0x26c6da));
        C.line([C.Q(-0.6, -0.45), C.Q(0.5, -0.12)], rgb(0x26c6da, 0.7), 0.06 * C.u);
      },
      hair(C) {
        const c = 0xe6f2f6;
        // swept back: spikes thrown up and to the side
        [
          [-0.7, -0.8, -1.5, -1.6],
          [-0.3, -1.0, -0.6, -1.95],
          [0.15, -1.05, 0.5, -1.95],
          [0.55, -0.9, 1.45, -1.55],
          [0.85, -0.5, 1.6, -0.75],
        ].forEach(([a, b, x, y]) => C.poly([C.P(a - 0.35, b + 0.25), C.P(x, y), C.P(a + 0.35, b + 0.15)], rgb(c, 0.92)));
        cap(C, c);
        bangs(C, c, { zig: 1, tilt: 0.2, n: 7 });
      },
      head(C) {
        const u = C.u;
        C.line([C.P(-0.98, -0.5), C.P(0, -0.68), C.P(0.98, -0.5)], "#2a2d33", 0.14 * u);
        [-1, 1].forEach((s) => {
          const [x, y] = C.P(s * 0.38, -0.66);
          C.ell(x, y, 0.27 * u, 0.25 * u, "#2a2d33");
          C.glow(0x4dd0e1, 0.6);
          C.ell(x, y, 0.19 * u, 0.17 * u, rgb(0x4dd0e1, 1.15));
          C.noglow();
          C.ell(x - 0.06 * u, y - 0.06 * u, 0.05 * u, 0.04 * u, "rgba(255,255,255,.7)");
        });
      },
    },
    geomi: {
      face: { brows: !1, nose: !1, mouth: !1 },
      back(C) {
        const u = C.u,
          m = rgb(0x3a3a40, 1.1);
        [
          [-1, 0.0],
          [1, 0.0],
          [-1, 0.9],
          [1, 0.9],
        ].forEach(([s, k]) => {
          const a = C.Q(s * (0.8 + k * 0.3), -0.1 + k * 0.6),
            b = C.Q(s * (2.4 + k * 0.5), -2.2 + k * 1.1),
            c = C.Q(s * (3.5 + k * 0.3), 1.2 + k * 1.2);
          C.line([a, b, c], m, (0.2 - k * 0.04) * u);
          C.line([a, b, c], "rgba(255,255,255,.12)", 0.05 * u);
          glowDot(C, b[0], b[1], 0.12 * u, 0xff3d3d);
        });
      },
      body(C, L) {
        inside(C, L, () => {
          const [x, y] = C.Q(0, 1.6),
            u = C.u;
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * PI * 2;
            C.line([[x, y], [x + Math.cos(a) * 1.5 * u, y + Math.sin(a) * 1.5 * u]], "rgba(200,205,212,.55)", 0.04 * u);
          }
          [0.55, 1.05, 1.45].forEach((R) => {
            const pts = [];
            for (let i = 0; i <= 8; i++) {
              const a = (i / 8) * PI * 2;
              pts.push([x + Math.cos(a) * R * u, y + Math.sin(a) * R * u]);
            }
            C.line(pts, "rgba(200,205,212,.5)", 0.035 * u);
          });
        });
      },
      collar(C) {
        cowl(C, 0x3a2a24);
      },
      head(C) {
        const u = C.u;
        hoodRing(C, 0x3a2a24);
        // the brow band with six eyes, the jaw plate
        C.poly([C.P(-0.88, -0.5), C.P(0, -0.66), C.P(0.88, -0.5), C.P(0.86, -0.18), C.P(0, -0.26), C.P(-0.86, -0.18)], rgb(0x2a1e1a));
        [
          [-0.5, -0.42, 0.08],
          [-0.18, -0.5, 0.08],
          [0.18, -0.5, 0.08],
          [0.5, -0.42, 0.08],
          [-0.32, -0.3, 0.11],
          [0.32, -0.3, 0.11],
        ].forEach(([x, y, s]) => glowDot(C, ...C.P(x, y), s * u, 0xff3d3d, 0.5));
        lowerMask(C, 0x2a1e1a, 0.24);
      },
    },
    byeolbit: {
      back(C) {
        const { r, u } = C;
        // the star cape, and silver hair behind
        r.fillStyle = rgb(0x141833);
        r.beginPath();
        r.moveTo(...C.Q(-1.3, -0.3));
        r.lineTo(...C.Q(1.3, -0.3));
        r.quadraticCurveTo(...C.Q(3.4, 1.2), ...C.Q(4.2, 6));
        r.lineTo(...C.Q(-4.2, 6));
        r.quadraticCurveTo(...C.Q(-3.4, 1.2), ...C.Q(-1.3, -0.3));
        r.fill();
        for (let i = 0; i < 26; i++) {
          const x = (((i * 37) % 23) / 23 - 0.5) * 7.6,
            y = ((i * 53) % 19) / 19 * 4.2 - 0.2;
          if (Math.abs(x) < 1.6 && y < 2) continue;
          glowDot(C, ...C.Q(x, y), (i % 5 ? 0.035 : 0.07) * u, 0xc5cbff, 0.4);
        }
        hairBack(C, 0xdfe3f5, 2.3, 1.12);
      },
      body(C) {
        jacket(C, { shirt: 0x1a1f3d, lapel: 0x2a3366, trim: 0x9fa8ff, glow: !0 });
      },
      collar(C) {
        collar(C, 0x2a3366, 0.45);
      },
      hair(C) {
        const c = 0xdfe3f5;
        cap(C, c, 0.3);
        // parted in the middle
        C.poly([C.P(-0.02, -0.98), C.P(-0.92, -0.3), C.P(-0.95, 0.2), C.P(-0.62, -0.38), C.P(-0.1, -0.7)], rgb(c));
        C.poly([C.P(0.02, -0.98), C.P(0.92, -0.3), C.P(0.95, 0.2), C.P(0.62, -0.38), C.P(0.1, -0.7)], rgb(c));
        locks(C, c, 1.9);
      },
      head(C) {
        C.line([C.P(-0.86, -0.42), C.P(0, -0.6), C.P(0.86, -0.42)], rgb(0xc5cae9, 1.1), 0.06 * C.u);
        star4(C, ...C.P(0, -0.6), 0.2 * C.u, 0xb3bcff);
      },
      front(C) {
        const [x, y] = C.Q(2.5, -1.5),
          u = C.u;
        glowDot(C, x, y, 0.28 * u, 0xc5cbff, 1);
        C.glow(0xc5cbff, 0.4);
        C.ring(x, y, 0.55 * u, 0.16 * u, rgb(0xc5cbff, 1.2), 0.04 * u, -0.35);
        C.noglow();
      },
    },
    kallal: {
      face: { nose: !1, mouth: !1 },
      back(C) {
        const u = C.u;
        // two hilts over the shoulders; a ponytail behind
        [-1, 1].forEach((s) => {
          const a = C.Q(s * 1.1, 0.2),
            b = C.Q(s * 2.1, -1.5);
          C.line([a, b], rgb(0x1b1d22), 0.16 * u);
          C.line([C.Q(s * 1.5, -0.45), C.Q(s * 1.1, -0.75)], rgb(0xb0bec5), 0.1 * u);
          C.line([C.Q(s * 1.35, -0.7), C.Q(s * 1.75, -0.4)], rgb(0xb0bec5), 0.1 * u);
          C.ell(...b, 0.11 * u, 0.11 * u, rgb(0xb0bec5));
        });
        C.poly([C.P(0.6, -0.6), C.P(1.1, -0.3), C.P(1.35, 1.6), C.P(1.15, 2.1), C.P(0.95, 1.5), C.P(0.8, 0.2)], rgb(0x15151a));
      },
      body(C) {
        [-1, 1].forEach((s) => C.line([C.Q(s * 1.0, -0.2), C.Q(0, 1.5)], rgb(0x5b6470), 0.2 * C.u, "butt"));
        pauldron(C, 1, 0x8d99a3, 0.85, 0x5b6470);
      },
      hair(C) {
        cap(C, 0x15151a);
        bangs(C, 0x15151a, { zig: 1, n: 9, lo: -0.25, hi: -0.48 });
      },
      head(C) {
        C.line([C.P(-0.95, -0.52), C.P(0, -0.66), C.P(0.95, -0.52)], rgb(0xcfd8dc, 1.15), 0.07 * C.u);
        lowerMask(C, 0x2b2f36, 0.2);
      },
    },
    deonggul: {
      body(C) {
        jacket(C, { shirt: 0x6b8e4e, lapel: 0x4e3b2a });
      },
      collar(C) {
        collar(C, 0x4e3b2a, 0.42);
      },
      hair(C) {
        cap(C, 0x5b3d24);
        bangs(C, 0x5b3d24, { zig: 1 });
      },
      head(C) {
        const u = C.u;
        C.line([C.P(-0.98, -0.42), C.P(0, -0.62), C.P(0.98, -0.42)], rgb(0x33691e), 0.08 * u);
        for (let i = 0; i < 9; i++) {
          const t = i / 8 - 0.5,
            [x, y] = C.P(t * 1.9, -0.55 - (0.25 - t * t) * 0.3);
          C.ell(x, y, 0.17 * u, 0.07 * u, rgb(i % 2 ? 0x7cb342 : 0x8bc34a), t * 1.4 + (i % 2 ? 0.5 : -0.5));
        }
      },
      front(C) {
        const u = C.u;
        // the vine round the shoulder and over the chest, the leaf on the other shoulder
        C.line([C.Q(-2.4, 0.9), C.Q(-1.7, 0.1), C.Q(-0.8, 0.7), C.Q(0.2, 1.8), C.Q(1.0, 3.2)], rgb(0x33691e), 0.13 * u);
        [
          [-2.1, 0.35],
          [-1.3, 0.25],
          [-0.5, 1.0],
          [0.2, 1.75],
          [0.7, 2.6],
        ].forEach(([x, y], i) => C.ell(...C.Q(x, y), 0.24 * u, 0.1 * u, rgb(0x7cb342), i % 2 ? 0.6 : -0.6));
        C.ell(...C.Q(2.2, 0.2), 0.9 * u, 0.32 * u, rgb(0x7cb342), -0.35);
        C.line([C.Q(1.5, 0.45), C.Q(2.9, -0.05)], rgb(0x558b2f), 0.04 * u);
      },
    },
    neupji: {
      face: { eyes: !1, brows: !1, nose: !1, mouth: !1 },
      back(C) {
        C.line([C.Q(-1.6, 1.0), C.Q(-2.2, -0.2), C.P(-0.9, 0.95)], rgb(0x2a2d22), 0.14 * C.u);
      },
      collar(C) {
        cowl(C, 0x3a4a2c);
      },
      head(C) {
        const { u } = C;
        C.poly([C.P(-0.5, -1.25), C.P(0.95, -2.05), C.P(0.55, -1.05)], rgb(0x3a4a2c, 0.9));
        hoodRing(C, 0x3a4a2c);
        // the respirator over the whole face
        C.ell(...C.P(0, 0.12), 0.84 * u, 0.98 * u, rgb(0x2a2d26));
        [-1, 1].forEach((s) => {
          const [x, y] = C.P(s * 0.36, -0.02);
          C.ell(x, y, 0.27 * u, 0.27 * u, "#15170f");
          C.glow(0xb2ff59, 0.9);
          C.ell(x, y, 0.2 * u, 0.2 * u, rgb(0xb2ff59, 1.2));
          C.noglow();
          C.ell(...C.P(s * 0.55, 0.72), 0.24 * u, 0.3 * u, rgb(0x5a5f48), s * 0.5);
          C.ring(...C.P(s * 0.55, 0.72), 0.17 * u, 0.22 * u, rgb(0x3a3f30), 0.04 * u, s * 0.5);
        });
        C.ell(...C.P(0, 0.62), 0.2 * u, 0.2 * u, rgb(0x1d1f19));
      },
    },
    deungbul: {
      back(C) {
        const u = C.u;
        // the lantern on its pole over the shoulder
        C.line([C.Q(-1.2, 1.5), C.P(-2.4, -1.9), C.P(-2.95, -1.45)], rgb(0x5d4037), 0.12 * u);
        C.line([C.P(-2.95, -1.45), C.P(-2.95, -1.15)], rgb(0x3a2a20), 0.03 * u);
        const [x, y] = C.P(-2.95, -0.55);
        C.glow(0xffb74d, 1.6);
        C.rr(x - 0.42 * u, y - 0.55 * u, 0.84 * u, 1.1 * u, 0.32 * u, rgb(0xffcc80, 1.15));
        C.noglow();
        [-0.58, 0.5].forEach((dy) => C.rr(x - 0.34 * u, y + dy * u, 0.68 * u, 0.1 * u, 0.04 * u, rgb(0x3e2723)));
        [-0.2, 0.2].forEach((dx) => C.line([[x + dx * u, y - 0.45 * u], [x + dx * u, y + 0.45 * u]], "rgba(140,80,30,.35)", 0.03 * u));
      },
      body(C) {
        const u = C.u;
        // a crossed collar and the ribbon (goreum)
        C.line([C.Q(-0.9, -0.2), C.Q(0.35, 1.4)], rgb(0xffb74d), 0.2 * u, "butt");
        C.line([C.Q(0.9, -0.2), C.Q(0.1, 0.9)], rgb(0xe8d8bd), 0.16 * u, "butt");
        C.ell(...C.Q(0.45, 1.45), 0.26 * u, 0.13 * u, rgb(0xff8f00), 0.5);
        C.ell(...C.Q(0.75, 1.5), 0.26 * u, 0.13 * u, rgb(0xff8f00), -0.4);
        C.line([C.Q(0.55, 1.5), C.Q(0.3, 2.6)], rgb(0xff8f00), 0.12 * u);
        C.line([C.Q(0.6, 1.5), C.Q(0.8, 2.4)], rgb(0xff8f00), 0.12 * u);
      },
      collar(C) {
        collar(C, 0xffb74d, 0.42);
      },
      hair(C) {
        const c = 0x4a2c1a,
          { r } = C;
        // a bob to the jaw with straight bangs
        r.fillStyle = rgb(c);
        r.beginPath();
        r.moveTo(...C.P(-1.06, 0.75));
        r.bezierCurveTo(...C.P(-1.2, -1.45), ...C.P(1.2, -1.45), ...C.P(1.06, 0.75));
        r.lineTo(...C.P(0.82, 0.78));
        r.lineTo(...C.P(0.82, -0.32));
        r.lineTo(...C.P(-0.82, -0.32));
        r.lineTo(...C.P(-0.82, 0.78));
        r.closePath();
        r.fill();
        C.line([C.P(-0.5, -0.95), C.P(0.3, -1.05)], "rgba(255,255,255,.12)", 0.1 * C.u);
      },
      head(C) {
        C.line([C.P(0.62, -0.75), C.P(1.25, -1.05)], rgb(0xd4af37, 1.2), 0.05 * C.u);
        glowDot(C, ...C.P(1.3, -1.08), 0.11 * C.u, 0xffb74d, 0.8);
      },
    },
    hwanyeong: {
      back(C) {
        hairBack(C, 0xb388d6, 2.2, 1.12);
      },
      body(C) {
        jacket(C, { shirt: 0xf3f0f5, lapel: 0x2a1838, trim: 0xce93d8, glow: !0 });
        C.poly([C.Q(-0.2, 0.0), C.Q(0.2, 0.0), C.Q(0, 0.45)], rgb(0x7b1fa2));
      },
      collar(C) {
        collar(C, 0x2a1838, 0.42);
      },
      hair(C) {
        const c = 0xb388d6;
        cap(C, c, 0.3);
        // swept across the forehead to one side
        C.poly([C.P(-0.95, -0.25), C.P(-0.6, -0.95), C.P(0.3, -1.0), C.P(0.95, -0.45), C.P(1.0, 0.25), C.P(0.55, -0.2), C.P(0.1, -0.42), C.P(-0.5, -0.45)], rgb(c));
        locks(C, c, 1.7);
      },
      head(C) {
        const { r, u } = C;
        // a white mask over one half of the face
        r.fillStyle = "#f3f0f5";
        r.beginPath();
        r.moveTo(...C.P(0, -0.62));
        r.bezierCurveTo(...C.P(-0.6, -0.66), ...C.P(-0.93, -0.4), ...C.P(-0.93, 0.05));
        r.bezierCurveTo(...C.P(-0.9, 0.62), ...C.P(-0.46, 1.02), ...C.P(0, 1.06));
        r.closePath();
        r.fill();
        C.glow(0xe040fb, 0.7);
        C.line([C.P(-0.55, -0.02), C.P(-0.16, 0.04)], rgb(0xe040fb, 1.2), 0.07 * u);
        C.noglow();
        C.line([C.P(-0.42, 0.2), C.P(-0.46, 0.7)], rgb(0x7b1fa2), 0.04 * u);
      },
      front(C) {
        [
          [2.3, -2.2, 0.4],
          [2.75, -1.4, -0.3],
          [2.1, -0.8, 0.9],
        ].forEach(([x, y, a]) => {
          const [px, py] = C.Q(x, y),
            s = 0.3 * C.u;
          C.glow(0xe1bee7, 0.8);
          C.poly([[px + Math.sin(a) * s, py - Math.cos(a) * s], [px + Math.cos(a) * s * 0.4, py + Math.sin(a) * s * 0.4], [px - Math.sin(a) * s, py + Math.cos(a) * s], [px - Math.cos(a) * s * 0.4, py - Math.sin(a) * s * 0.4]], rgb(0xf3e5f5, 1.1));
          C.noglow();
        });
      },
    },
    ullim: {
      back(C) {
        C.line([C.Q(1.6, 0.4), C.Q(2.0, -2.0)], "#222", 0.05 * C.u);
        glowDot(C, ...C.Q(2.0, -2.05), 0.1 * C.u, 0x4db6ac, 0.8);
      },
      body(C) {
        const u = C.u;
        jacket(C, { shirt: 0x1c2124, lapel: 0x263238 });
        [-1, 1].forEach((s) => {
          const [x, y] = C.Q(s * 1.15, 1.3);
          C.ell(x, y, 0.36 * u, 0.36 * u, "#111417");
          C.glow(0x4db6ac, 0.6);
          C.ring(x, y, 0.3 * u, 0.3 * u, rgb(0x4db6ac, 1.1), 0.06 * u);
          C.noglow();
          C.ell(x, y, 0.1 * u, 0.1 * u, "#2a3236");
        });
      },
      collar(C) {
        collar(C, 0x263238, 0.42);
      },
      hair(C) {
        cap(C, 0x1d2b2a);
        bangs(C, 0x1d2b2a, { zig: 1, tilt: 0.3 });
        C.poly([C.P(-0.55, -0.95), C.P(-0.05, -0.9), C.P(-0.2, -0.32), C.P(-0.35, -0.55), C.P(-0.5, -0.3)], rgb(0x4db6ac, 1.1));
      },
      head(C) {
        const u = C.u;
        C.line([C.P(-1.0, -0.1), C.P(-0.9, -1.0), C.P(0, -1.32), C.P(0.9, -1.0), C.P(1.0, -0.1)], "#22262b", 0.16 * u);
        [-1, 1].forEach((s) => {
          const [x, y] = C.P(s * 1.0, 0.1);
          C.rr(x - 0.24 * u, y - 0.42 * u, 0.48 * u, 0.84 * u, 0.2 * u, "#22262b");
          C.glow(0x4db6ac, 0.7);
          C.ring(x + s * 0.04 * u, y, 0.13 * u, 0.3 * u, rgb(0x4db6ac, 1.2), 0.05 * u);
          C.noglow();
        });
        C.line([C.P(1.0, 0.3), C.P(0.75, 0.75), C.P(0.3, 0.68)], "#22262b", 0.05 * u);
        C.ell(...C.P(0.28, 0.68), 0.08 * u, 0.08 * u, "#22262b");
      },
    },
    hwasan: {
      face: {},
      body(C, L) {
        plate(C, 0x5a4a44, L);
        const u = C.u;
        // magma showing through the cracks
        C.glow(0xff6e40, 0.7);
        [
          [[-0.9, 0.5], [-0.5, 1.2], [-0.7, 1.9]],
          [[0.6, 0.4], [0.95, 1.1], [0.55, 1.6], [0.8, 2.4]],
          [[-0.1, 1.5], [0.25, 2.1], [0.05, 2.8]],
        ].forEach((pts) => C.line(pts.map(([x, y]) => C.Q(x, y)), rgb(0xff8a50, 1.2), 0.08 * u));
        C.noglow();
        [-1, 1].forEach((s) => {
          pauldron(C, s, 0x4a3c37, 1.15);
          [0, 1].forEach((i) => C.poly([C.Q(s * (1.6 + i * 0.6), -0.05 - i * 0.05), C.Q(s * (1.85 + i * 0.6), -1.0 - i * 0.2), C.Q(s * (2.05 + i * 0.6), -0.1)], rgb(0x3a2e2a, 1.1)));
          C.glow(0xff6e40, 0.5);
          C.line([C.Q(s * 1.5, 0.6), C.Q(s * 2.3, 0.4), C.Q(s * 2.7, 0.8)], rgb(0xff8a50), 0.05 * u);
          C.noglow();
        });
      },
      hair(C) {
        const u = C.u;
        cap(C, 0x2a1a12, 0.0);
        // a crest of flame down the middle
        C.glow(0xff7043, 0.9);
        C.poly([C.P(-0.28, -0.75), C.P(-0.45, -1.45), C.P(-0.15, -1.15), C.P(0, -1.85), C.P(0.15, -1.2), C.P(0.42, -1.55), C.P(0.3, -0.75)], rgb(0xff7043, 1.1));
        C.poly([C.P(-0.15, -0.8), C.P(0, -1.45), C.P(0.15, -0.8)], rgb(0xffcc80, 1.1));
        C.noglow();
        C.line([C.P(-0.25, -0.75), C.P(0.25, -0.75)], rgb(0x1a0f0a), 0.1 * u);
      },
    },
    suho: {
      back(C) {
        const u = C.u,
          [x, y] = C.Q(0, 1.3);
        C.ell(x, y, 3.0 * u, 3.0 * u, rgb(0xb0bec5, 0.85));
        C.ell(x, y, 2.75 * u, 2.75 * u, rgb(0x2e6b32));
        C.glow(0x69f0ae, 0.6);
        C.ring(x, y, 1.75 * u, 1.75 * u, rgb(0x69f0ae), 0.08 * u);
        C.noglow();
      },
      body(C, L) {
        const u = C.u;
        plate(C, 0xb0bec5, L);
        inside(C, L, () => C.poly([C.Q(-0.55, 0.2), C.Q(0.55, 0.2), C.Q(0.6, 5), C.Q(-0.6, 5)], rgb(0x2e6b32)));
        C.glow(0x69f0ae, 0.8);
        const [x, y] = C.Q(0, 1.2),
          hex = [];
        for (let i = 0; i < 6; i++) hex.push([x + Math.cos((i / 6) * PI * 2) * 0.28 * u, y + Math.sin((i / 6) * PI * 2) * 0.28 * u]);
        C.poly(hex, rgb(0x69f0ae, 1.1));
        C.noglow();
        [-1, 1].forEach((s) => pauldron(C, s, 0xb0bec5, 1.1, 0x2e7d32));
      },
      collar(C) {
        collar(C, 0x9ea7b0, 0.5);
      },
      head(C) {
        const { r, u } = C,
          g = r.createLinearGradient(...C.P(-1, -1), ...C.P(1, 0));
        g.addColorStop(0, rgb(0xb0bec5, 1.35));
        g.addColorStop(1, rgb(0xb0bec5, 0.6));
        // crest, dome, brow and cheek guards
        C.poly([C.P(-0.12, -1.0), C.P(0.0, -1.95), C.P(0.95, -1.6), C.P(0.25, -0.95)], rgb(0x2e7d32));
        r.fillStyle = g;
        r.beginPath();
        r.moveTo(...C.P(-1.0, -0.2));
        r.bezierCurveTo(...C.P(-1.1, -1.42), ...C.P(1.1, -1.42), ...C.P(1.0, -0.2));
        r.lineTo(...C.P(0.95, -0.38));
        r.quadraticCurveTo(...C.P(0, -0.62), ...C.P(-0.95, -0.38));
        r.closePath();
        r.fill();
        [-1, 1].forEach((s) => C.rr(...C.P(s > 0 ? 0.74 : -1.04, -0.35), 0.3 * u, 1.0 * u, 0.12 * u, g));
        C.line([C.P(-0.9, -0.42), C.P(0, -0.6), C.P(0.9, -0.42)], rgb(0x78868f), 0.06 * u);
      },
    },
    hyeollang: {
      back(C) {
        const u = C.u;
        // the mane out of the hood
        const pts = [C.P(-1.2, -0.6)];
        for (let i = 0; i <= 8; i++) {
          const t = i / 8;
          pts.push(C.P(-1.2 - Math.sin(t * PI) * 0.6, -0.4 + t * 2.4 + (i % 2) * 0.25));
        }
        pts.push(C.P(1.2, 2.0));
        for (let i = 8; i >= 0; i--) {
          const t = i / 8;
          pts.push(C.P(1.2 + Math.sin(t * PI) * 0.6, -0.4 + t * 2.4 + (i % 2) * 0.25));
        }
        C.poly(pts, rgb(0xcfd2d6, 0.85));
      },
      body(C, L) {
        const u = C.u;
        // an open leather vest with fur edges
        inside(C, L, () => {
          [-1, 1].forEach((s) => C.poly([C.Q(s * 0.55, -0.3), C.Q(s * 4.5, -0.3), C.Q(s * 4.5, 6), C.Q(s * 0.75, 6)], rgb(0x1b1215, 1.15)));
          [-1, 1].forEach((s) => C.line([C.Q(s * 0.55, -0.2), C.Q(s * 0.75, 6)], rgb(0x6d6f75), 0.14 * u));
        });
        [-1, 1].forEach((s) => [0, 0.22].forEach((d) => C.line([C.Q(s * (2.3 + d), 0.7), C.Q(s * (2.7 + d), 1.4)], rgb(0xb71c1c), 0.08 * u)));
      },
      collar(C) {
        const u = C.u;
        for (let i = 0; i < 11; i++) {
          const t = i / 10 - 0.5;
          C.ell(...C.Q(t * 3.0, -0.25 + Math.abs(t) * 0.6), 0.42 * u, 0.32 * u, rgb(i % 2 ? 0x6d6f75 : 0x7e8087));
        }
      },
      head(C) {
        const u = C.u,
          fur = 0x5f6168;
        // the wolf's head as a hood: ears, brow and muzzle, eyes, fangs
        [-1, 1].forEach((s) => {
          C.poly([C.P(s * 0.4, -1.2), C.P(s * 0.95, -2.15), C.P(s * 1.15, -0.9)], rgb(fur));
          C.poly([C.P(s * 0.6, -1.15), C.P(s * 0.93, -1.85), C.P(s * 1.02, -1.05)], rgb(0x880e4f));
        });
        hoodRing(C, fur);
        C.ell(...C.P(0, -0.95), 0.9 * u, 0.5 * u, rgb(fur, 1.12));
        C.ell(...C.P(0, -0.62), 0.22 * u, 0.13 * u, rgb(0x2a2b2f));
        [-1, 1].forEach((s) => {
          glowDot(C, ...C.P(s * 0.4, -1.08), 0.07 * u, 0xff1744, 0.6);
          C.poly([C.P(s * 0.3, -0.56), C.P(s * 0.22, -0.3), C.P(s * 0.14, -0.56)], "#f3ead8");
        });
        // mane locks out of the hood
        locks(C, 0xcfd2d6, 1.1);
      },
      front(C) {
        const u = C.u;
        // war paint under the eyes
        [-1, 1].forEach((s) => C.line([C.P(s * 0.22, 0.2), C.P(s * 0.5, 0.26)], rgb(0xb71c1c), 0.05 * u));
      },
    },
    songgol: {
      back(C) {
        const u = C.u;
        // the quiver over the shoulder
        C.line([C.Q(-1.0, 1.2), C.Q(-2.0, -1.0)], rgb(0x5d4037), 0.42 * u);
        [-0.15, 0, 0.15].forEach((d, i) => {
          C.line([C.Q(-1.95 + d, -0.95), C.Q(-2.15 + d * 1.5, -1.9)], rgb(0x6d4c41), 0.03 * u);
          C.poly([C.Q(-2.15 + d * 1.5, -1.9), C.Q(-2.3 + d * 1.5, -1.6 + i * 0.05), C.Q(-2.05 + d * 1.5, -1.65)], "#efebe9");
        });
      },
      body(C) {
        const u = C.u;
        jacket(C, { shirt: 0x8d7a5c, lapel: 0x5a3d2b });
        // a mantle of feathers
        for (let i = 0; i < 15; i++) {
          const t = i / 14 - 0.5;
          C.ell(...C.Q(t * 4.6, 0.25 + Math.abs(t) * 0.6), 0.2 * u, 0.48 * u, rgb(i % 2 ? 0xd7ccc8 : 0x8d6e63), t * 1.1);
        }
      },
      collar(C) {
        collar(C, 0xd7ccc8, 0.45);
      },
      hair(C) {
        bangs(C, 0x5a3d2b, { n: 6, lo: -0.38, hi: -0.48, zig: 1 });
      },
      head(C) {
        const { r, u } = C,
          m = rgb(0x6b4a36);
        r.fillStyle = m;
        r.beginPath();
        r.moveTo(...C.P(-0.98, 0.1));
        r.bezierCurveTo(...C.P(-1.08, -1.4), ...C.P(1.08, -1.4), ...C.P(0.98, 0.1));
        r.lineTo(...C.P(0.9, -0.38));
        r.quadraticCurveTo(...C.P(0, -0.66), ...C.P(-0.9, -0.38));
        r.closePath();
        r.fill();
        [-1, 1].forEach((s) => C.rr(...C.P(s > 0 ? 0.7 : -1.06, -0.3), 0.36 * u, 1.05 * u, 0.16 * u, m));
        C.line([C.P(-0.9, -0.42), C.P(0, -0.64), C.P(0.9, -0.42)], rgb(0x4e342e), 0.06 * u);
        C.poly([C.P(-0.75, -0.75), C.P(-1.35, -1.95), C.P(-1.1, -1.85), C.P(-0.62, -0.85)], "#efebe9");
      },
      front(C) {
        const u = C.u,
          [x, y] = C.Q(2.2, -0.75);
        // the falcon on the shoulder
        C.ell(x + 0.15 * u, y + 0.25 * u, 0.42 * u, 0.62 * u, rgb(0x5d4037), -0.15);
        C.ell(x, y + 0.2 * u, 0.36 * u, 0.6 * u, rgb(0x6d4c41));
        C.ell(x - 0.05 * u, y + 0.3 * u, 0.22 * u, 0.42 * u, rgb(0xd7ccc8));
        C.ell(x - 0.02 * u, y - 0.48 * u, 0.24 * u, 0.24 * u, rgb(0x6d4c41));
        C.poly([[x - 0.22 * u, y - 0.5 * u], [x - 0.42 * u, y - 0.4 * u], [x - 0.2 * u, y - 0.36 * u]], rgb(0xffc107));
        C.ell(x - 0.1 * u, y - 0.54 * u, 0.045 * u, 0.045 * u, "#111");
      },
    },
    haerang: {
      back(C) {
        hairBack(C, 0x1565c0, 5.5, 1.2);
      },
      body(C) {
        const u = C.u;
        [0.9, 1.5].forEach((y) => C.line([C.Q(-1.0, y + 0.2), C.Q(-0.3, y), C.Q(0.4, y + 0.2), C.Q(1.0, y)], rgb(0xb3e5fc), 0.05 * u));
        // the capelet: sea blue, a band of foam, crests at the hem
        C.poly([C.Q(-0.95, -0.25), C.Q(0.95, -0.25), C.Q(2.75, 1.25), C.Q(-2.75, 1.25)], rgb(0x1976d2));
        C.poly([C.Q(-2.75, 1.2), C.Q(2.75, 1.2), C.Q(2.95, 1.55), C.Q(-2.95, 1.55)], rgb(0xe3f2fd));
        for (let i = 0; i < 9; i++) {
          const [x, y] = C.Q(-2.6 + i * 0.65, 1.62);
          C.r.strokeStyle = rgb(0xb3e5fc);
          C.r.lineWidth = 0.05 * u;
          C.r.beginPath();
          C.r.arc(x, y, 0.16 * u, PI, PI * 2.2);
          C.r.stroke();
        }
      },
      collar(C) {
        collar(C, 0x0d2a4a, 0.42);
      },
      hair(C) {
        const c = 0x1565c0;
        cap(C, c, 0.3);
        bangs(C, c, { zig: 1, n: 9 });
        locks(C, c, 2.6);
      },
      head(C) {
        const [x, y] = C.P(0.95, -0.55),
          u = C.u;
        C.poly([[x, y + 0.2 * u], [x - 0.25 * u, y - 0.15 * u], [x, y - 0.25 * u], [x + 0.25 * u, y - 0.15 * u]], "#fff8e1");
        [-0.12, 0, 0.12].forEach((d) => C.line([[x, y + 0.18 * u], [x + d * u * 1.6, y - 0.2 * u]], "rgba(180,150,110,.6)", 0.025 * u));
      },
    },
    mukhyang: {
      back(C) {
        const u = C.u;
        // the great brush: its head over the shoulder, the handle behind
        C.line([C.Q(2.4, 3.0), C.Q(-1.9, -1.6)], rgb(0x5d4037), 0.2 * u);
        C.line([C.Q(-1.75, -1.42), C.Q(-1.95, -1.65)], rgb(0xd4af37), 0.26 * u, "butt");
        C.poly([C.Q(-1.85, -1.75), C.Q(-2.15, -1.5), C.Q(-2.9, -2.6), C.Q(-2.75, -2.75)], "#101010");
        C.ell(...C.Q(-2.95, -2.35), 0.07 * u, 0.1 * u, "#101010");
      },
      body(C) {
        const u = C.u;
        // the robe's collar crosses left over right
        C.line([C.Q(-1.0, -0.2), C.Q(0.55, 2.0)], "#1b1b1b", 0.32 * u, "butt");
        C.line([C.Q(1.0, -0.2), C.Q(0.2, 1.2)], "#1b1b1b", 0.26 * u, "butt");
        [
          [-1.6, 1.3, 0.22],
          [1.5, 0.9, 0.15],
          [-0.9, 2.4, 0.12],
        ].forEach(([x, y, s]) => {
          C.ell(...C.Q(x, y), s * u, s * u * 0.8, "#1b1b1b");
          C.ell(...C.Q(x + s * 1.3, y - s * 0.6), s * 0.3 * u, s * 0.3 * u, "#1b1b1b");
        });
      },
      hair(C) {
        cap(C, 0x0d0d0d, 0.05);
      },
      head(C) {
        const { r, u } = C;
        r.save();
        r.globalAlpha = 0.93;
        C.rr(...C.P(-0.55, -1.95), 1.1 * u, 1.35 * u, 0.25 * u, "#141414");
        C.ell(...C.P(0, -0.62), 2.75 * u, 0.3 * u, "#141414");
        r.restore();
        C.line([C.P(-0.55, -0.8), C.P(0.55, -0.8)], rgb(0x3a2a20), 0.12 * u);
        C.line([C.P(-1.6, -0.65), C.P(1.4, -0.75)], "rgba(255,255,255,.1)", 0.04 * u);
        for (let i = 0; i < 13; i++) {
          const a = PI * (0.08 + (0.84 * i) / 12);
          C.ell(C.cx + Math.cos(a) * 0.98 * u, C.hy - 0.45 * u + Math.sin(a) * 1.75 * u, 0.055 * u, 0.055 * u, rgb(0xd9b77a));
        }
      },
    },
    yeongwol: {
      back(C) {
        const u = C.u,
          [x, y] = C.P(0, -0.2);
        C.glow(0xd1c4e9, 1.4);
        C.ring(x, y, 2.35 * u, 2.35 * u, rgb(0xd1c4e9, 0.9), 0.04 * u);
        C.r.strokeStyle = rgb(0xede7f6, 1.1);
        C.r.lineWidth = 0.28 * u;
        C.r.beginPath();
        C.r.arc(x, y, 1.9 * u, PI * 0.15, PI * 1.25);
        C.r.stroke();
        C.noglow();
        hairBack(C, 0x120b18, 5.5, 1.18);
      },
      body(C) {
        [-1, 1].forEach((s) => C.line([C.Q(s * 0.95, -0.2), C.Q(-s * 0.2, 1.7)], "#f3eef8", 0.26 * C.u, "butt"));
      },
      collar(C) {
        collar(C, 0x5e1fa0, 0.38);
      },
      hair(C) {
        const c = 0x120b18;
        cap(C, c, 0.3);
        bangs(C, c, { n: 10, lo: -0.32, hi: -0.36 });
        locks(C, c, 2.9);
      },
      head(C) {
        const u = C.u;
        C.line([C.P(-0.9, -0.45), C.P(0, -0.63), C.P(0.9, -0.45)], rgb(0xd4af37, 1.1), 0.06 * u);
        const [x, y] = C.P(0, -1.6);
        C.glow(0xd1c4e9, 1);
        C.r.fillStyle = rgb(0xede7f6, 1.15);
        C.r.beginPath();
        C.r.arc(x, y, 0.36 * u, PI * 0.3, PI * 1.7);
        C.r.arc(x + 0.16 * u, y - 0.04 * u, 0.3 * u, PI * 1.62, PI * 0.38, !0);
        C.r.fill();
        C.noglow();
      },
    },
    danbi: {
      back(C) {
        const { r, W, H } = C;
        r.save();
        r.strokeStyle = "rgba(179,229,252,.22)";
        r.lineWidth = 1;
        for (let i = 0; i < 26; i++) {
          const x = ((i * 47) % 97) / 97 * W,
            y = ((i * 31) % 89) / 89 * H * 0.8;
          r.beginPath();
          r.moveTo(x, y);
          r.lineTo(x - 4, y + 14);
          r.stroke();
        }
        r.restore();
      },
      body(C, L) {
        const u = C.u;
        // the poncho over the shoulders
        inside(C, L, () => {
          C.poly([C.Q(-0.9, -0.3), C.Q(0.9, -0.3), C.Q(4.6, 2.6), C.Q(-4.6, 2.6)], rgb(0x66bb6a));
          C.poly([C.Q(-2.1, 0.75), C.Q(2.1, 0.75), C.Q(2.6, 1.1), C.Q(-2.6, 1.1)], rgb(0xb3e5fc));
          C.poly([C.Q(-4.6, 2.5), C.Q(4.6, 2.5), C.Q(4.6, 2.8), C.Q(-4.6, 2.8)], rgb(0x2e7d32));
        });
        C.line([C.Q(0, -0.1), C.Q(0, 0.6)], rgb(0x2e7d32), 0.06 * u);
      },
      collar(C) {
        collar(C, 0xf1f8e9, 0.4);
      },
      hair(C) {
        const c = 0x22301f,
          { r } = C;
        r.fillStyle = rgb(c);
        r.beginPath();
        r.moveTo(...C.P(-1.05, 0.72));
        r.bezierCurveTo(...C.P(-1.2, -1.4), ...C.P(1.2, -1.4), ...C.P(1.05, 0.72));
        r.lineTo(...C.P(0.8, 0.75));
        r.lineTo(...C.P(0.82, -0.3));
        r.lineTo(...C.P(-0.82, -0.3));
        r.lineTo(...C.P(-0.8, 0.75));
        r.closePath();
        r.fill();
      },
      head(C) {
        const { r, u } = C,
          g = r.createLinearGradient(...C.P(0, -1.9), ...C.P(0, -0.5));
        g.addColorStop(0, rgb(0xc8a96e, 1.2));
        g.addColorStop(1, rgb(0xc8a96e, 0.75));
        // the straw hat, rain on strings round its brim
        C.poly([C.P(0, -1.95), C.P(2.3, -0.62), C.P(2.1, -0.45), C.P(-2.1, -0.45), C.P(-2.3, -0.62)], g);
        for (let i = -4; i <= 4; i++) C.line([C.P(0, -1.9), C.P(i * 0.5, -0.5)], "rgba(90,60,30,.35)", 0.03 * u);
        C.line([C.P(-2.3, -0.55), C.P(2.3, -0.55)], rgb(0x8a6d3b), 0.07 * u);
        [-2.0, -1.45, -0.95, 0.95, 1.45, 2.0].forEach((x, i) => {
          const L = 0.5 + (i % 3) * 0.35;
          C.line([C.P(x, -0.5), C.P(x, -0.5 + L)], "rgba(207,232,255,.7)", 0.025 * u);
          C.glow(0x81d4fa, 0.6);
          C.ell(...C.P(x, -0.45 + L), 0.07 * u, 0.1 * u, rgb(0x81d4fa, 1.3));
          C.noglow();
        });
      },
    },
    cheolhyeol: {
      face: { eyes: !1, brows: !1, nose: !1, mouth: !1 },
      body(C, L) {
        const u = C.u;
        plate(C, 0x7a7f8a, L);
        C.line([C.Q(0, 0.1), C.Q(0, 4)], rgb(0xb71c1c), 0.1 * u);
        C.glow(0xff1744, 0.9);
        const [x, y] = C.Q(0, 1.25),
          hex = [];
        for (let i = 0; i < 6; i++) hex.push([x + Math.cos((i / 6) * PI * 2 + PI / 6) * 0.3 * u, y + Math.sin((i / 6) * PI * 2 + PI / 6) * 0.3 * u]);
        C.poly(hex, rgb(0xff5252));
        C.noglow();
        [-1, 1].forEach((s) => {
          const [px, py] = C.Q(s * 2.3, 0.75);
          C.ell(px, py, 1.0 * u, 0.62 * u, rgb(0x6c717c, 0.8), -s * 0.4);
          pauldron(C, s, 0x6c717c, 1.3, 0xb71c1c);
        });
      },
      collar(C) {
        C.rr(C.cx - 0.75 * C.u, C.sh - 0.9 * C.u, 1.5 * C.u, 0.85 * C.u, 0.2 * C.u, rgb(0x5a5e68));
      },
      head(C) {
        const { r, u } = C;
        // horns, the great helm, its glowing slit
        [-1, 1].forEach((s) => {
          r.fillStyle = rgb(0xd7ccc8);
          r.beginPath();
          r.moveTo(...C.P(s * 0.95, -0.3));
          r.quadraticCurveTo(...C.P(s * 1.9, -0.6), ...C.P(s * 1.75, -1.85));
          r.quadraticCurveTo(...C.P(s * 1.55, -0.95), ...C.P(s * 0.95, -0.75));
          r.closePath();
          r.fill();
        });
        const g = r.createLinearGradient(...C.P(-1.1, 0), ...C.P(1.1, 0));
        g.addColorStop(0, rgb(0x7a7f8a, 0.55));
        g.addColorStop(0.4, rgb(0x7a7f8a, 1.25));
        g.addColorStop(1, rgb(0x7a7f8a, 0.5));
        C.rr(...C.P(-1.05, -1.3), 2.1 * u, 2.45 * u, 0.55 * u, g);
        C.rr(...C.P(-1.05, 0.85), 2.1 * u, 0.22 * u, 0.06 * u, rgb(0xb71c1c));
        C.rr(...C.P(-0.85, -0.12), 1.7 * u, 0.24 * u, 0.06 * u, "#111");
        C.glow(0xff1744, 0.9);
        C.rr(...C.P(-0.78, -0.07), 1.56 * u, 0.12 * u, 0.04 * u, rgb(0xff1744, 1.1));
        C.noglow();
        C.line([C.P(0, -0.2), C.P(0, 0.85)], rgb(0x7a7f8a, 0.7), 0.12 * u);
      },
    },
    chujeok: {
      body(C) {
        const u = C.u;
        jacket(C, { shirt: 0x3b4033, lapel: 0x4e3424 });
        // the bandolier with its rounds
        C.line([C.Q(-1.9, 0.2), C.Q(1.2, 3.6)], rgb(0x3e2723), 0.32 * u, "butt");
        for (let i = 0; i < 6; i++) {
          const t = i / 5,
            [x, y] = C.Q(-1.7 + t * 2.6, 0.45 + t * 2.85);
          C.line([[x, y], [x + 0.12 * u, y - 0.1 * u]], rgb(0x9aa1ab), 0.1 * u);
          glowDot(C, x + 0.16 * u, y - 0.14 * u, 0.05 * u, 0xff9800, 0.4);
        }
      },
      collar(C) {
        const u = C.u;
        for (let i = 0; i < 9; i++) {
          const t = i / 8 - 0.5;
          C.ell(...C.Q(t * 2.6, -0.25 + Math.abs(t) * 0.5), 0.4 * u, 0.3 * u, rgb(i % 2 ? 0x3e2a20 : 0x4a3428));
        }
      },
      hair(C) {
        cap(C, 0x2d1f16, 0.1);
        // the beard round the jaw, the mouth left clear
        const { r } = C,
          b = rgb(0x3a2a1e);
        r.fillStyle = b;
        r.beginPath();
        r.moveTo(...C.P(-0.9, 0.05));
        r.bezierCurveTo(...C.P(-0.92, 0.78), ...C.P(-0.5, 1.28), ...C.P(0, 1.3));
        r.bezierCurveTo(...C.P(0.5, 1.28), ...C.P(0.92, 0.78), ...C.P(0.9, 0.05));
        r.lineTo(...C.P(0.7, 0.3));
        r.quadraticCurveTo(...C.P(0.45, 0.85), ...C.P(0, 0.8));
        r.quadraticCurveTo(...C.P(-0.45, 0.85), ...C.P(-0.7, 0.3));
        r.closePath();
        r.fill();
        C.poly([C.P(-0.35, 0.5), C.P(0, 0.44), C.P(0.35, 0.5), C.P(0.3, 0.58), C.P(0, 0.53), C.P(-0.3, 0.58)], b);
      },
      head(C) {
        const { r, u } = C,
          m = rgb(0x5d4037);
        r.fillStyle = m;
        r.beginPath();
        r.moveTo(...C.P(-0.78, -0.62));
        r.lineTo(...C.P(-0.66, -1.6));
        r.quadraticCurveTo(...C.P(0, -1.38), ...C.P(0.66, -1.6));
        r.lineTo(...C.P(0.78, -0.62));
        r.closePath();
        r.fill();
        C.rr(...C.P(-0.8, -0.95), 1.6 * u, 0.24 * u, 0.04 * u, rgb(0x3e2723));
        C.ell(...C.P(0, -0.62), 2.45 * u, 0.34 * u, m);
        C.line([C.P(-2.2, -0.68), C.P(2.2, -0.68)], "rgba(255,255,255,.1)", 0.05 * u);
      },
    },
    hoero: {
      back(C) {
        C.line([C.Q(-1.6, 0.3), C.Q(-2.1, -2.1)], "#222", 0.05 * C.u);
        glowDot(C, ...C.Q(-2.1, -2.15), 0.1 * C.u, 0xffd740, 0.8);
      },
      body(C) {
        const u = C.u;
        jacket(C, { shirt: 0x15161a, lapel: 0x1a1c20 });
        C.glow(0xffd740, 0.5);
        [
          [[-1.6, 0.6], [-1.0, 0.6], [-1.0, 1.6], [-0.6, 2.0]],
          [[1.7, 0.9], [1.1, 0.9], [1.1, 2.2]],
          [[-2.0, 2.4], [-1.2, 2.4], [-1.2, 3.2]],
        ].forEach((pts) => {
          C.line(pts.map(([x, y]) => C.Q(x, y)), rgb(0xffd740), 0.05 * u, "butt");
          C.ell(...C.Q(...pts[pts.length - 1]), 0.07 * u, 0.07 * u, rgb(0xffd740));
        });
        C.noglow();
      },
      collar(C) {
        collar(C, 0x1a1c20, 0.42);
      },
      hair(C) {
        cap(C, 0x15151a);
        bangs(C, 0x15151a, { zig: 1, tilt: -0.3 });
        C.poly([C.P(0.15, -1.0), C.P(0.6, -0.92), C.P(0.45, -0.38), C.P(0.32, -0.6), C.P(0.2, -0.36)], rgb(0xffd740, 1.05));
      },
      head(C) {
        const u = C.u;
        C.line([C.P(-0.98, -0.12), C.P(0, -0.2), C.P(0.98, -0.12)], "#1d2026", 0.06 * u);
        C.glow(0xffd740, 0.7);
        C.rr(...C.P(-0.78, -0.2), 0.7 * u, 0.36 * u, 0.06 * u, rgba(0xffd740, 0.78));
        C.noglow();
        C.rr(...C.P(-1.06, -0.15), 0.2 * u, 0.32 * u, 0.06 * u, "#1d2026");
      },
      front(C) {
        const u = C.u,
          [x, y] = C.Q(-2.35, -1.3);
        C.rr(x - 0.4 * u, y - 0.08 * u, 0.8 * u, 0.16 * u, 0.06 * u, rgb(0x2a2d33));
        [-1, 1].forEach((s) => C.ell(x + s * 0.48 * u, y - 0.14 * u, 0.26 * u, 0.05 * u, "rgba(60,64,72,.9)"));
        glowDot(C, x, y + 0.02 * u, 0.06 * u, 0xffd740, 0.6);
      },
    },
    yakcho: {
      back(C) {
        const u = C.u;
        // the herb basket over the shoulder
        [
          [1.5, -1.9, 0x7cb342, -0.2],
          [1.9, -2.2, 0x8bc34a, 0.15],
          [2.3, -1.85, 0x7cb342, 0.4],
          [2.05, -1.6, 0xffd54f, 0],
          [1.7, -1.55, 0xffd54f, 0],
        ].forEach(([x, y, c, a], i) => (i < 3 ? C.ell(...C.Q(x, y), 0.14 * u, 0.5 * u, rgb(c), a) : C.ell(...C.Q(x, y), 0.12 * u, 0.12 * u, rgb(c))));
        C.rr(...C.Q(1.2, -1.45), 1.5 * u, 1.2 * u, 0.15 * u, rgb(0xa1887f));
        for (let i = 0; i < 4; i++) C.line([C.Q(1.25, -1.3 + i * 0.3), C.Q(2.65, -1.3 + i * 0.3)], rgb(0x7a6258), 0.05 * u);
      },
      body(C) {
        const u = C.u;
        C.rr(...C.Q(-1.0, 0.45), 2.0 * u, 5 * u, 0.12 * u, rgb(0x66bb6a));
        [-1, 1].forEach((s) => C.line([C.Q(s * 0.9, 0.5), C.Q(s * 0.75, -0.25)], rgb(0x4caf50), 0.12 * u));
        C.rr(...C.Q(-0.6, 1.5), 1.2 * u, 0.6 * u, 0.08 * u, rgb(0x4caf50));
      },
      collar(C) {
        collar(C, 0xe8dcc0, 0.4);
      },
      hair(C) {
        const u = C.u,
          c = 0x8b6a3e;
        bangs(C, c, { n: 6, lo: -0.4, hi: -0.48, zig: 1 });
        // the braid over the shoulder
        for (let i = 0; i < 7; i++) C.ell(...C.P(-0.95 - i * 0.07, 0.35 + i * 0.36), 0.2 * u, 0.22 * u, rgb(c, i % 2 ? 0.85 : 1));
        C.rr(...C.P(-1.6, 2.75), 0.32 * u, 0.22 * u, 0.06 * u, rgb(0x81c784));
      },
      head(C) {
        const { r, u } = C;
        r.fillStyle = rgb(0x66bb6a);
        r.beginPath();
        r.moveTo(...C.P(-0.98, -0.1));
        r.bezierCurveTo(...C.P(-1.08, -1.4), ...C.P(1.08, -1.4), ...C.P(0.98, -0.1));
        r.quadraticCurveTo(...C.P(0, -0.72), ...C.P(-0.98, -0.1));
        r.fill();
        C.poly([C.P(0.85, -0.55), C.P(1.55, -0.95), C.P(1.45, -0.6)], rgb(0x4caf50));
        C.poly([C.P(0.85, -0.45), C.P(1.5, -0.25), C.P(1.35, 0.0)], rgb(0x4caf50));
        C.ell(...C.P(0.9, -0.5), 0.16 * u, 0.16 * u, rgb(0x5aa85e));
        C.ell(...C.P(-0.45, -0.95), 0.28 * u, 0.1 * u, rgb(0x33691e), -0.6);
      },
    },
    cheolbyeok: {
      back(C) {
        const u = C.u;
        // the mortar tube over the shoulder
        C.line([C.Q(-1.2, 0.8), C.Q(-2.3, -2.0)], rgb(0x607d8b), 0.5 * u, "butt");
        C.ell(...C.Q(-2.33, -2.05), 0.28 * u, 0.12 * u, "#1d2226", -0.38);
        C.line([C.Q(-2.15, -1.6), C.Q(-1.7, -1.75)], rgb(0x37474f), 0.1 * u);
      },
      body(C, L) {
        const u = C.u;
        // the high-visibility vest
        inside(C, L, () => {
          C.poly([C.Q(-0.7, -0.25), C.Q(-1.7, -0.25), C.Q(-2.6, 0.6), C.Q(-2.6, 6), C.Q(2.6, 6), C.Q(2.6, 0.6), C.Q(1.7, -0.25), C.Q(0.7, -0.25), C.Q(0, 1.0)], rgb(0xff8f00));
          [1.6, 2.6].forEach((y) => C.rr(...C.Q(-3, y), 6 * u, 0.24 * u, 0, rgb(0xe0f7fa)));
          [-1.4, -0.45, 0.5].forEach((x) => C.rr(...C.Q(x, 3.1), 0.8 * u, 0.6 * u, 0.06 * u, rgb(0x4e3b2a)));
        });
      },
      hair(C) {
        cap(C, 0x2b2b2b, -0.1);
        const { r } = C,
          b = rgb(0x2b2b2b);
        r.fillStyle = b;
        r.beginPath();
        r.moveTo(...C.P(-0.9, 0.1));
        r.bezierCurveTo(...C.P(-0.9, 0.8), ...C.P(-0.5, 1.3), ...C.P(0, 1.32));
        r.bezierCurveTo(...C.P(0.5, 1.3), ...C.P(0.9, 0.8), ...C.P(0.9, 0.1));
        r.lineTo(...C.P(0.68, 0.35));
        r.quadraticCurveTo(...C.P(0.42, 0.85), ...C.P(0, 0.8));
        r.quadraticCurveTo(...C.P(-0.42, 0.85), ...C.P(-0.68, 0.35));
        r.closePath();
        r.fill();
        C.poly([C.P(-0.35, 0.5), C.P(0, 0.44), C.P(0.35, 0.5), C.P(0.3, 0.58), C.P(0, 0.53), C.P(-0.3, 0.58)], b);
      },
      head(C) {
        const { r, u } = C,
          g = r.createLinearGradient(...C.P(-1, -1.4), ...C.P(1, -0.4));
        g.addColorStop(0, rgb(0xffcf33, 1.25));
        g.addColorStop(1, rgb(0xffcf33, 0.7));
        r.fillStyle = g;
        r.beginPath();
        r.moveTo(...C.P(-1.0, -0.5));
        r.bezierCurveTo(...C.P(-1.05, -1.55), ...C.P(1.05, -1.55), ...C.P(1.0, -0.5));
        r.closePath();
        r.fill();
        C.ell(...C.P(0, -0.5), 1.3 * u, 0.2 * u, rgb(0xffcf33, 0.85));
        C.line([C.P(0, -1.32), C.P(0, -0.55)], rgb(0xffcf33, 1.3), 0.14 * u);
        C.line([C.P(-1.0, -0.72), C.P(1.0, -0.72)], "#2a2d33", 0.1 * u);
        [-1, 1].forEach((s) => {
          C.ell(...C.P(s * 0.38, -0.82), 0.24 * u, 0.2 * u, "#2a2d33");
          glowDot(C, ...C.P(s * 0.38, -0.82), 0.16 * u, 0xffca28, 0.5);
        });
      },
    },
  };

  window.CH_PAINTKIT = { PAINT, HX, rgb, rgba, cap, bangs, hairBack, locks, hoodRing, cowl, lowerMask, pauldron, plate, jacket, collar, glowDot, star4, inside };
  const base = agentPortrait;
  agentPortrait = function (ag, t, o) {
    const id = ag && (ag.id || ag.key),
      D = id && PAINT[id];
    if (!D || !window.CH_DESIGN[id]) return base.apply(this, arguments);
    t = t || 300;
    o = o || 380;
    const key = id + "_" + t + "x" + o + "_v3";
    if (PORTRAIT_CACHE[key]) return PORTRAIT_CACHE[key];
    const C = canvasFor(ag, t, o);
    backdrop(C, ag);
    D.back && D.back(C);
    const L = shoulders(C, C.st.coat);
    D.body && D.body(C, L);
    neck(C);
    D.collar && D.collar(C);
    head(C);
    face(C, D.face);
    D.hair && D.hair(C);
    D.head && D.head(C);
    D.front && D.front(C);
    finish(C, ag);
    const url = C.cv.toDataURL("image/webp", 0.82);
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
    "function" == typeof renderSelect && renderSelect();
  } catch (e) {}
  // what's new on the title screen: the new looks first, three items at most
  try {
    const ul = document.querySelector(".tt-news ul"),
      en = "undefined" != typeof LANG && "en" === LANG;
    if (ul) {
      const li = document.createElement("li");
      li.innerHTML = en
        ? "<b>New looks for 22 agents</b><span>Hair, clothes and something on the back for each one. New faces for all 36</span>"
        : "<b>요원 22명 새 옷차림</b><span>머리, 옷, 등에 멘 것까지 요원마다 다릅니다. 36명 모두 얼굴도 새로 그렸습니다</span>";
      ul.prepend(li);
      while (ul.children.length > 3) ul.lastElementChild.remove();
    }
  } catch (e) {}
})();

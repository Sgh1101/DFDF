(() => {
  // 폐병원 (5 v 5) — a whole abandoned hospital, three floors, built as a maze.
  //  · Ground: three entrances from the ambulance lot (ER, main lobby, loading dock),
  //    two ward mazes of 5 m rooms, a 30 m atrium in the middle, the operating suite (A)
  //    and the pharmacy store (B) at the back, the ICU between them where the
  //    defenders start.
  //  · Second floor: more wards, a balcony ring around the atrium (you can shoot down),
  //    two stairs up from the ground, two more up to the third floor.
  //  · Third floor: two wing mazes under a roof, open roof decks around them, a bridge
  //    across the atrium shaft.
  // The floor plan is baked in js/hospital-plan.js (scripts/gen-hospital.js makes it).
  // Floors are real slabs (y0..h colliders): you can walk, shoot and see under them, the
  // bots keep to the ground floor. Everything is merged by material: a few dozen draw calls.
  if ("undefined" == typeof MAPS || "undefined" == typeof MAP_LIST || "undefined" == typeof THEMES || "undefined" == typeof MOODS || !window.HOSPITAL_PLAN || MAPS.hospital) return;
  const P = window.HOSPITAL_PLAN,
    C = P.cols,
    R = P.rows,
    CELL = P.cell,
    OX = P.origin[0],
    OZ = P.origin[1],
    FH = P.floorH,
    SL = P.slab;
  const ex = (c) => OX + c * CELL,
    ez = (r) => OZ + r * CELL,
    cx = (c) => ex(c + 0.5),
    cz = (r) => ez(r + 0.5);
  const hex = (s) => parseInt(String(s).replace("#", ""), 16);
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko);
  const hash = (a, b, c) => {
    const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
    return x - Math.floor(x);
  };

  // ── the plan ──
  const LV = P.levels;
  const zoneAt = (n, c, r) => (n < 0 || n > 2 || c < 0 || r < 0 || c >= C || r >= R ? " " : LV[n].f[r][c]);
  // '0' a hole open to the sky (the atrium), '9' a stair well (roofed), ' ' nothing
  const slabAt = (n, c, r) => {
    const z = zoneAt(n, c, r);
    return " " !== z && "0" !== z && "9" !== z;
  };
  const eH = (n, r, c) => (r < 0 || r > R || c < 0 || c >= C ? 0 : +LV[n].H[r][c]);
  const eV = (n, r, c) => (r < 0 || r >= R || c < 0 || c > C ? 0 : +LV[n].V[r][c]);
  const baseOf = (n) => n * FH;

  // ── the map record ──
  const N = P.nodes;
  const nodes = {};
  for (const k in N) nodes[k] = { x: N[k][0], z: N[k][1] };
  const DATA = {
    key: "hospital",
    name: "폐병원",
    theme: "hospital",
    size: 5,
    blockout: 1,
    sky: hex("#1a232b"),
    fog: 0.0068,
    sunColor: hex("#9db4c4"),
    sunInt: 0.55,
    ambient: 0.9,
    bounds: { minX: OX, maxX: OX + C * CELL, minZ: OZ, maxZ: OZ + R * CELL },
    attackSpawn: { x: P.attackSpawn[0], z: P.attackSpawn[1] },
    defendSpawn: { x: P.defendSpawn[0], z: P.defendSpawn[1] },
    sites: P.sites.map((s) => ({ id: s.id, x: s.x, z: s.z, r: s.r, label: s.id })),
    nodes,
    walls: [],
  };
  MAPS.hospital = DATA;

  // ── the look ──
  const tex = (draw, w, h, rx, ry, srgb) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(rx || 1, ry || 1);
    t.anisotropy = 4;
    srgb !== !1 && "colorSpace" in t && T.SRGBColorSpace && (t.colorSpace = T.SRGBColorSpace);
    return t;
  };
  // the same stream for every texture bank, so a sharper bank paints the same stains in the same places
  let seedV = 7041;
  const rnd = () => ((seedV = (seedV * 1664525 + 1013904223) >>> 0) / 4294967296);
  // one storey of interior wall: tile skirting, plaster with water stains, coving
  const drawWall = (g, w, h) => {
    g.fillStyle = "#c9cdc6";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = rnd() * w,
        y = rnd() * h * 0.7,
        r = 14 + rnd() * 46,
        gr = g.createRadialGradient(x, y, 1, x, y, r);
      gr.addColorStop(0, `rgba(70,64,48,${0.1 + rnd() * 0.16})`);
      gr.addColorStop(1, "rgba(70,64,48,0)");
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    // streaks running down from the ceiling
    for (let i = 0; i < 14; i++) {
      const x = rnd() * w,
        l = 20 + rnd() * 90;
      const gr = g.createLinearGradient(0, 0, 0, l);
      gr.addColorStop(0, "rgba(60,58,44,.28)");
      gr.addColorStop(1, "rgba(60,58,44,0)");
      g.fillStyle = gr;
      g.fillRect(x, 0, 2 + rnd() * 5, l);
    }
    // the tile skirting: lower 28 %
    const th = h * 0.28;
    g.fillStyle = "#6f8c82";
    g.fillRect(0, h - th, w, th);
    g.strokeStyle = "rgba(20,36,32,.55)";
    g.lineWidth = 1.5;
    for (let x = 0; x <= w; x += w / 8) {
      g.beginPath();
      g.moveTo(x, h - th);
      g.lineTo(x, h);
      g.stroke();
    }
    for (let y = h - th; y <= h; y += th / 4) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(${rnd() < 0.5 ? "25,45,40" : "170,190,180"},${0.1 + rnd() * 0.12})`;
      g.fillRect(rnd() * w, h - th + rnd() * th, w / 8 - 2, th / 4 - 2);
    }
    g.fillStyle = "rgba(235,238,230,.9)";
    g.fillRect(0, h - th - 3, w, 5);
    // grime near the floor and a dark cove up top
    const gr = g.createLinearGradient(0, h - th - 40, 0, h);
    gr.addColorStop(0, "rgba(30,28,20,0)");
    gr.addColorStop(1, "rgba(30,28,20,.45)");
    g.fillStyle = gr;
    g.fillRect(0, h - th - 40, w, th + 40);
    g.fillStyle = "rgba(30,34,36,.35)";
    g.fillRect(0, 0, w, h * 0.035);
    // damp patches where the paint has lifted: soft in the middle, a thin shadow along the edge
    for (let i = 0; i < 6; i++) {
      const x = rnd() * w,
        y = rnd() * h * 0.5,
        rr = 9 + rnd() * 15,
        n = 11;
      g.beginPath();
      for (let k = 0; k < n; k++) {
        const an = (k / n) * 6.283,
          r = rr * (0.55 + rnd() * 0.7),
          px = x + Math.cos(an) * r * 1.4,
          py = y + Math.sin(an) * r;
        k ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath();
      const gr = g.createRadialGradient(x, y, 1, x, y, rr * 1.5);
      gr.addColorStop(0, "rgba(104,98,82,.3)");
      gr.addColorStop(1, "rgba(104,98,82,.08)");
      g.fillStyle = gr;
      g.fill();
      g.strokeStyle = "rgba(40,38,30,.22)";
      g.lineWidth = 1;
      g.stroke();
    }
  };
  // the outside: stained concrete with a boarded window every cell (the cracks of light are the glow map)
  const drawExt = (glow) => (g, w, h) => {
      g.fillStyle = glow ? "#000" : "#8e9188";
      g.fillRect(0, 0, w, h);
      if (!glow) {
        for (let i = 0; i < 900; i++) {
          const v = 118 + rnd() * 50;
          g.fillStyle = `rgba(${v},${v + 2},${v - 4},.5)`;
          g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 3, 2 + rnd() * 3);
        }
        for (let i = 0; i < 24; i++) {
          const x = rnd() * w,
            l = 20 + rnd() * 120;
          const gr = g.createLinearGradient(0, 0, 0, l);
          gr.addColorStop(0, "rgba(40,40,34,.4)");
          gr.addColorStop(1, "rgba(40,40,34,0)");
          g.fillStyle = gr;
          g.fillRect(x, 0, 3 + rnd() * 6, l);
        }
      }
      // the window: x 0.2..0.8 of the cell, y 0.3..0.74 of the storey
      const wx = w * 0.2,
        ww = w * 0.6,
        wy = h * 0.3,
        wh = h * 0.44;
      g.fillStyle = glow ? "#000" : "#262a2c";
      g.fillRect(wx, wy, ww, wh);
      const planks = 7;
      for (let i = 0; i < planks; i++) {
        const y = wy + (wh / planks) * i,
          ph = wh / planks - 3 - rnd() * 2,
          gap = rnd() < 0.55;
        if (glow) {
          if (gap) {
            g.fillStyle = "#cfe3ff";
            g.fillRect(wx, y + ph, ww, 3);
          }
        } else {
          g.fillStyle = `rgb(${88 + rnd() * 30},${70 + rnd() * 20},${50 + rnd() * 16})`;
          g.fillRect(wx + (rnd() < 0.3 ? 6 : 0), y, ww - (rnd() < 0.3 ? 8 : 0), ph);
        }
      }
      if (!glow) {
        g.strokeStyle = "#555a5e";
        g.lineWidth = 5;
        g.strokeRect(wx, wy, ww, wh);
      }
  };
  const drawFloor = (g, w, h) => {
    g.fillStyle = "#cfcdc4";
    g.fillRect(0, 0, w, h);
    const n = 4,
      s = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = 190 + rnd() * 40;
      g.fillStyle = `rgb(${v},${v - 2},${v - 10})`;
      g.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
      if (rnd() < 0.12) {
        g.fillStyle = "rgba(40,36,28,.22)";
        g.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
      }
    }
    g.strokeStyle = "rgba(30,30,24,.55)";
    g.lineWidth = 1.4;
    for (let i = 0; i <= n; i++) {
      g.beginPath();
      g.moveTo(i * s, 0);
      g.lineTo(i * s, h);
      g.moveTo(0, i * s);
      g.lineTo(w, i * s);
      g.stroke();
    }
    for (let i = 0; i < 6; i++) {
      g.strokeStyle = "rgba(20,18,14,.5)";
      g.lineWidth = 1;
      g.beginPath();
      let x = rnd() * w,
        y = rnd() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) g.lineTo((x += (rnd() - 0.5) * 34), (y += (rnd() - 0.5) * 34));
      g.stroke();
    }
    for (let i = 0; i < 30; i++) {
      const x = rnd() * w,
        y = rnd() * h,
        r = 6 + rnd() * 24,
        gr = g.createRadialGradient(x, y, 1, x, y, r);
      gr.addColorStop(0, "rgba(40,34,22,.25)");
      gr.addColorStop(1, "rgba(40,34,22,0)");
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
  };
  const drawCeil = (g, w, h) => {
    g.fillStyle = "#c6c4b8";
    g.fillRect(0, 0, w, h);
    const n = 4,
      s = w / n;
    g.strokeStyle = "rgba(60,60,52,.7)";
    g.lineWidth = 3;
    for (let i = 0; i <= n; i++) {
      g.beginPath();
      g.moveTo(i * s, 0);
      g.lineTo(i * s, h);
      g.moveTo(0, i * s);
      g.lineTo(w, i * s);
      g.stroke();
    }
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(60,56,46,${rnd() * 0.14})`;
      g.fillRect(rnd() * w, rnd() * h, 3, 3);
    }
    for (let i = 0; i < 12; i++) {
      const x = rnd() * w,
        y = rnd() * h,
        r = 16 + rnd() * 34,
        gr = g.createRadialGradient(x, y, 1, x, y, r);
      gr.addColorStop(0, "rgba(70,58,30,.38)");
      gr.addColorStop(1, "rgba(70,58,30,0)");
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
  };
  const drawConc = (g, w, h) => {
    g.fillStyle = "#9a9c98";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      const v = 120 + rnd() * 60;
      g.fillStyle = `rgba(${v},${v},${v - 4},.5)`;
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3);
    }
    g.strokeStyle = "rgba(30,30,28,.35)";
    g.lineWidth = 2;
    g.strokeRect(1, 1, w - 2, h - 2);
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      let x = rnd() * w,
        y = rnd() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 5; k++) g.lineTo((x += (rnd() - 0.5) * 40), (y += (rnd() - 0.5) * 40));
      g.stroke();
    }
  };
  const fenceTex = tex((g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = "rgba(170,176,182,.95)";
    g.lineWidth = 2;
    for (let i = -h; i < w + h; i += 16) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + h, h);
      g.moveTo(i + h, 0);
      g.lineTo(i, h);
      g.stroke();
    }
  }, 128, 128, 1, 1);
  const drawDecal = (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const hs = w / 2;
    const blob = (x, y, r, col, a) => {
      const gr = g.createRadialGradient(x, y, 1, x, y, r);
      gr.addColorStop(0, `rgba(${col},${a})`);
      gr.addColorStop(0.6, `rgba(${col},${a * 0.7})`);
      gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, 2 * r, 2 * r);
    };
    // tile 0: a blood pool with splatter
    blob(hs / 2, hs / 2, 34, "96,16,16", 0.85);
    for (let i = 0; i < 16; i++) blob(hs / 2 + (rnd() - 0.5) * 80, hs / 2 + (rnd() - 0.5) * 80, 3 + rnd() * 9, "104,18,18", 0.8);
    // tile 1: a drag mark
    g.save();
    g.translate(hs + hs / 2, hs / 2);
    for (let i = 0; i < 24; i++) blob((i - 12) * 4, Math.sin(i * 0.5) * 9, 8 + rnd() * 4, "92,16,14", 0.7);
    g.restore();
    // tile 2: grime
    blob(hs / 2, hs + hs / 2, 44, "20,18,12", 0.5);
    for (let i = 0; i < 8; i++) blob(hs / 2 + (rnd() - 0.5) * 70, hs + hs / 2 + (rnd() - 0.5) * 70, 10 + rnd() * 14, "26,22,14", 0.4);
    // tile 3: scattered paper
    for (let i = 0; i < 9; i++) {
      g.save();
      g.translate(hs + 20 + rnd() * 90, hs + 20 + rnd() * 90);
      g.rotate(rnd() * 6);
      g.fillStyle = `rgba(${220 + rnd() * 30},${218 + rnd() * 30},${205 + rnd() * 30},.92)`;
      g.fillRect(-10, -7, 20, 14);
      g.strokeStyle = "rgba(60,60,60,.5)";
      g.beginPath();
      g.moveTo(-8, -2);
      g.lineTo(8, -2);
      g.moveTo(-8, 3);
      g.lineTo(5, 3);
      g.stroke();
      g.restore();
    }
  };
  const beamTex = tex((g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "rgba(255,255,255,.0)");
    gr.addColorStop(0.15, "rgba(255,255,255,.55)");
    gr.addColorStop(1, "rgba(255,255,255,.05)");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    const gx = g.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, "rgba(0,0,0,1)");
    gx.addColorStop(0.5, "rgba(0,0,0,0)");
    gx.addColorStop(1, "rgba(0,0,0,1)");
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = gx;
    g.fillRect(0, 0, w, h);
  }, 64, 256, 1, 1);

  // ── texture banks: the same paintings, painted again larger with fine detail on top ──
  // tier 0 = 256 px as before; 1 = 512 px with grain, bevels and hairline cracks; 2 = 1024 px, and a relief
  // (normal) map and a gloss (roughness) map made from the painting, so the lights have something to play on.
  // The tier follows the graphics preset (lamps), and a change of preset reloads the map: nothing here costs a polygon.
  const QSCALE = [1, 2, 4],
    ANISO = [4, 8, 16];
  const tierNow = () => ("undefined" == typeof GFX ? 1 : GFX.lamps >= 12 ? 2 : GFX.lamps >= 4 ? 1 : 0);
  const maxAniso = () => {
    try {
      return renderer.capabilities.getMaxAnisotropy() || 4;
    } catch (e) {
      return 4;
    }
  };
  let fseed = 1;
  const fr = () => ((fseed = (fseed * 1664525 + 1013904223) >>> 0) / 4294967296);
  // the context is made here, with the hint that the pixels will be read back: a GPU canvas answers a
  // read with a stall that cost seconds, a software one answers at once
  const canvasOf = (w, h) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d", { willReadFrequently: !0 });
    return c;
  };
  const texOf = (c, q, srgb) => {
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = Math.min(ANISO[q], maxAniso());
    srgb && "colorSpace" in t && T.SRGBColorSpace && (t.colorSpace = T.SRGBColorSpace);
    return t;
  };
  // fine detail, in the pixels of the large canvas (k = its scale over the 256 px painting)
  const specks = (g, W, H, n, size, amax) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = fr() < 0.55 ? `rgba(24,22,16,${(fr() * amax).toFixed(3)})` : `rgba(255,252,240,${(fr() * amax * 0.8).toFixed(3)})`;
      const s = (0.5 + fr() * size) * (W / 256) * 0.5 + 0.5;
      g.fillRect(fr() * W, fr() * H, s, s);
    }
  };
  const crack = (g, k, x, y, steps, step, depth) => {
    const pts = [[x, y]];
    let a = fr() * 6.28;
    for (let i = 0; i < steps; i++) {
      a += (fr() - 0.5) * 1.1;
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      pts.push([x, y]);
      depth < 2 && fr() < 0.13 && crack(g, k, x, y, Math.max(2, (steps - i) >> 1), step * 0.8, depth + 1);
    }
    for (const [dx, col, w] of [[0, "rgba(30,26,20,.55)", 0.7], [1, "rgba(255,255,255,.1)", 0.5]]) {
      g.strokeStyle = col;
      g.lineWidth = w * k;
      g.beginPath();
      pts.forEach(([px, py], i) => (i ? g.lineTo(px + dx * k * 0.6, py + dx * k * 0.6) : g.moveTo(px + dx * k * 0.6, py + dx * k * 0.6)));
      g.stroke();
    }
  };
  // a tile with a lit upper-left edge, a dark lower-right edge and a patch of glaze
  const bevel = (g, x, y, w, h, k, lit, glaze) => {
    g.lineWidth = 1.3 * k;
    g.strokeStyle = `rgba(255,255,255,${lit})`;
    g.beginPath();
    g.moveTo(x + 1, y + h - 1);
    g.lineTo(x + 1, y + 1);
    g.lineTo(x + w - 1, y + 1);
    g.stroke();
    g.strokeStyle = "rgba(0,0,0,.28)";
    g.beginPath();
    g.moveTo(x + w - 1, y + 1);
    g.lineTo(x + w - 1, y + h - 1);
    g.lineTo(x + 1, y + h - 1);
    g.stroke();
    if (glaze) {
      const gr = g.createLinearGradient(x, y, x + w, y + h);
      gr.addColorStop(0, `rgba(255,255,255,${glaze})`);
      gr.addColorStop(0.5, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.fillRect(x, y, w, h);
    }
  };
  const FINE = {
    wall(g, W, H, k) {
      specks(g, W, H, (W * H) / 55, 1.4, 0.07);
      for (let i = 0; i < 4; i++) crack(g, k, fr() * W, fr() * H * 0.6, 9, 12 * k, 0);
      for (let i = 0; i < 3; i++) {
        const x = fr() * W,
          y = fr() * H * 0.4,
          r = (60 + fr() * 70) * k,
          gr = g.createRadialGradient(x, y, r * 0.2, x, y, r);
        gr.addColorStop(0, "rgba(70,64,44,.09)");
        gr.addColorStop(0.85, "rgba(70,64,44,.07)");
        gr.addColorStop(1, "rgba(70,64,44,0)");
        g.fillStyle = gr;
        g.fillRect(x - r, y - r, 2 * r, 2 * r);
        g.strokeStyle = "rgba(90,78,44,.1)";
        g.lineWidth = 1.5 * k;
        g.beginPath();
        g.arc(x, y, r * 0.8, 0.3, 4.4);
        g.stroke();
      }
      // the skirting tiles: bevels, glaze, a few chipped corners
      const th = H * 0.28,
        tw = W / 8,
        thh = th / 4;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) bevel(g, c * tw, H - th + r * thh, tw, thh, k, 0.16, 0.1);
      for (let i = 0; i < 7; i++) {
        g.fillStyle = "rgba(20,26,24,.55)";
        const s = (2 + fr() * 3) * k;
        g.fillRect(Math.floor(fr() * 8) * tw + (fr() < 0.5 ? 0 : tw - s), H - th + Math.floor(fr() * 4) * thh + (fr() < 0.5 ? 0 : thh - s), s, s);
      }
    },
    floor(g, W, H, k) {
      const s = W / 4;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) bevel(g, c * s, r * s, s, s, k, 0.2, 0.1);
      specks(g, W, H, (W * H) / 40, 1.6, 0.08);
      g.strokeStyle = "rgba(20,18,12,.4)";
      g.lineWidth = 2.4 * k;
      for (let i = 0; i <= 4; i++) {
        g.beginPath();
        g.moveTo(i * s, 0);
        g.lineTo(i * s, H);
        g.moveTo(0, i * s);
        g.lineTo(W, i * s);
        g.stroke();
      }
      // scuffs from boots and trolleys
      for (let i = 0; i < 46; i++) {
        const x = fr() * W,
          y = fr() * H,
          a = fr() * 6.28,
          l = (8 + fr() * 34) * k;
        g.strokeStyle = fr() < 0.5 ? "rgba(255,255,255,.08)" : "rgba(10,10,6,.1)";
        g.lineWidth = (0.8 + fr() * 1.4) * k;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + fr() * 6, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
        g.stroke();
      }
      for (let i = 0; i < 3; i++) crack(g, k, fr() * W, fr() * H, 8, 14 * k, 0);
    },
    ceil(g, W, H, k) {
      const s = W / 4;
      // acoustic tiles: pin holes in a grid, a lit edge and a dark edge, rings where the roof leaks
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        bevel(g, c * s, r * s, s, s, k, 0.1, 0);
        g.fillStyle = "rgba(40,36,28,.34)";
        for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) fr() < 0.82 && g.fillRect(c * s + (x + 0.7) * (s / 11.5), r * s + (y + 0.7) * (s / 11.5), 0.9 * k, 0.9 * k);
      }
      for (let i = 0; i < 3; i++) {
        const x = fr() * W,
          y = fr() * H;
        for (let j = 0; j < 4; j++) {
          g.strokeStyle = `rgba(86,66,32,${0.18 - j * 0.035})`;
          g.lineWidth = (1.6 - j * 0.25) * k;
          g.beginPath();
          g.arc(x, y, (14 + j * 9 + fr() * 4) * k, 0, 6.28);
          g.stroke();
        }
      }
    },
    conc(g, W, H, k) {
      for (let i = 0; i < W * H / 220; i++) {
        const v = 100 + fr() * 90;
        g.fillStyle = `rgba(${v},${v},${v - 6},${0.18 + fr() * 0.3})`;
        const s = (1.5 + fr() * 3.5) * (W / 256) * 0.5;
        g.fillRect(fr() * W, fr() * H, s, s);
      }
      // formwork joints and the tie holes
      g.strokeStyle = "rgba(20,20,18,.22)";
      g.lineWidth = 1.4 * k;
      g.beginPath();
      g.moveTo(0, H * 0.5);
      g.lineTo(W, H * 0.5);
      g.moveTo(W * 0.5, 0);
      g.lineTo(W * 0.5, H);
      g.stroke();
      g.fillStyle = "rgba(20,20,18,.5)";
      for (const [x, y] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        g.beginPath();
        g.arc(W * x, H * y, 2.4 * k, 0, 6.28);
        g.fill();
      }
      for (let i = 0; i < 9; i++) {
        const x = fr() * W,
          l = (30 + fr() * 120) * k,
          gr = g.createLinearGradient(0, 0, 0, l);
        gr.addColorStop(0, "rgba(40,40,34,.22)");
        gr.addColorStop(1, "rgba(40,40,34,0)");
        g.fillStyle = gr;
        g.fillRect(x, fr() * H * 0.3, (2 + fr() * 5) * k, l);
      }
      for (let i = 0; i < 3; i++) crack(g, k, fr() * W, fr() * H, 8, 15 * k, 0);
    },
    ext(g, W, H, k) {
      specks(g, W, H, (W * H) / 50, 1.6, 0.07);
      // moss at the foot, rust from under the window
      const gr = g.createLinearGradient(0, H * 0.82, 0, H);
      gr.addColorStop(0, "rgba(62,84,50,0)");
      gr.addColorStop(1, "rgba(62,84,50,.32)");
      g.fillStyle = gr;
      g.fillRect(0, H * 0.82, W, H * 0.18);
      for (let i = 0; i < 7; i++) {
        const x = W * (0.22 + fr() * 0.56),
          l = (24 + fr() * 70) * k,
          rg = g.createLinearGradient(0, H * 0.74, 0, H * 0.74 + l);
        rg.addColorStop(0, "rgba(112,62,30,.3)");
        rg.addColorStop(1, "rgba(112,62,30,0)");
        g.fillStyle = rg;
        g.fillRect(x, H * 0.74, (2 + fr() * 4) * k, l);
      }
      for (let i = 0; i < 3; i++) crack(g, k, fr() * W, fr() * H, 8, 12 * k, 0);
    },
  };
  // a normal map from the lightness of the painting (grout, cracks, stains sink; clean tile stays up), a
  // roughness map from the same (dirt is dull, glaze is glossy), and a few wet patches that are mirrors.
  // Made at 512 px: shrinking the painting is the blur, and a quarter of the pixels is a quarter of the wait.
  function reliefOf(c, k, o) {
    const W = 512,
      H = 512,
      sc = canvasOf(W, H),
      sg = sc.getContext("2d");
    sg.drawImage(c, 0, 0, W, H);
    const src = sg.getImageData(0, 0, W, H).data,
      L = new Float32Array(W * H);
    for (let i = 0, j = 0; i < src.length; i += 4, j++) L[j] = (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114) / 255;
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) lut[i] = Math.max(0, Math.min(1, o.rLo + (o.rHi - o.rLo) * Math.pow(1 - Math.min(1, (i / 255) * 1.05), o.gam || 1))) * 255;
    const nc = canvasOf(W, H),
      rc = canvasOf(W, H),
      ng = nc.getContext("2d"),
      rg = rc.getContext("2d"),
      ni = ng.createImageData(W, H),
      ri = rg.createImageData(W, H),
      nd = ni.data,
      rd = ri.data,
      bump = o.bump;
    for (let y = 0; y < H; y++) {
      const ym = (y ? y - 1 : H - 1) * W,
        y0 = y * W,
        yp = (y < H - 1 ? y + 1 : 0) * W;
      for (let x = 0; x < W; x++) {
        const xm = x ? x - 1 : W - 1,
          xp = x < W - 1 ? x + 1 : 0,
          nx = (L[y0 + xm] - L[y0 + xp]) * bump,
          ny = (L[yp + x] - L[ym + x]) * bump,
          inv = 1 / Math.sqrt(nx * nx + ny * ny + 1),
          i = (y0 + x) * 4,
          rv = lut[(L[y0 + x] * 255) | 0];
        nd[i] = (nx * inv * 0.5 + 0.5) * 255;
        nd[i + 1] = (ny * inv * 0.5 + 0.5) * 255;
        nd[i + 2] = (inv * 0.5 + 0.5) * 255;
        nd[i + 3] = 255;
        rd[i] = rd[i + 1] = rd[i + 2] = rv;
        rd[i + 3] = 255;
      }
    }
    // wet patches: smooth to a mirror and flat to the light, inside a soft-edged ellipse
    for (let n = 0; n < (o.wet || []).length; n++) {
      const wx = 0.2 + fr() * 0.6,
        wy = 0.2 + fr() * 0.6,
        rx = 0.1 + fr() * 0.07,
        ry = 0.07 + fr() * 0.05;
      for (let y = Math.max(0, ((wy - ry) * H) | 0); y < Math.min(H, ((wy + ry) * H + 1) | 0); y++)
        for (let x = Math.max(0, ((wx - rx) * W) | 0); x < Math.min(W, ((wx + rx) * W + 1) | 0); x++) {
          const d = Math.hypot((x / W - wx) / rx, (y / H - wy) / ry);
          if (d >= 1) continue;
          const t = Math.min(1, (1 - d) * 3),
            i = (y * W + x) * 4;
          rd[i] = rd[i + 1] = rd[i + 2] = rd[i] + (15 - rd[i]) * t;
          nd[i] += (128 - nd[i]) * t;
          nd[i + 1] += (128 - nd[i + 1]) * t;
          nd[i + 2] += (255 - nd[i + 2]) * t;
        }
    }
    ng.putImageData(ni, 0, 0);
    rg.putImageData(ri, 0, 0);
    return [nc, rc];
  }
  const BANKS = [null, null, null];
  function makeBank(q) {
    const k = QSCALE[q],
      b = {};
    seedV = 7041;
    const paint = (draw, w, h, fine, seed) => {
      const c = canvasOf(w * k, h * k),
        g = c.getContext("2d");
      g.save();
      g.scale(k, k);
      draw(g, w, h);
      g.restore();
      if (q >= 1 && fine) {
        fseed = seed;
        fine(g, c.width, c.height, k);
      }
      return c;
    };
    const full = (name, c, rel) => {
      b[name] = texOf(c, q, !0);
      if (q >= 2 && rel) {
        const t0 = performance.now();
        const [n, r] = reliefOf(c, k, rel);
        S.reliefMs = (S.reliefMs || 0) + Math.round(performance.now() - t0);
        b[name + "N"] = texOf(n, q, !1);
        b[name + "R"] = texOf(r, q, !1);
      }
    };
    // the same order as the first version, so the stains stay where they were
    full("wall", paint(drawWall, 256, 256, FINE.wall, 9101), { bump: 2.4, rLo: 0.55, rHi: 0.98, gam: 1.2 });
    full("ext", paint(drawExt(!1), 256, 256, FINE.ext, 9102), { bump: 3, rLo: 0.7, rHi: 1, gam: 1 });
    b.extG = texOf(paint(drawExt(!0), 256, 256, null, 0), q, !0);
    full("floor", paint(drawFloor, 256, 256, FINE.floor, 9103), { bump: 3.4, rLo: 0.3, rHi: 0.92, gam: 1.3, wet: [1, 2] });
    full("ceil", paint(drawCeil, 256, 256, FINE.ceil, 9104), { bump: 2.2, rLo: 0.8, rHi: 1, gam: 1 });
    full("conc", paint(drawConc, 256, 256, FINE.conc, 9105), { bump: 3.2, rLo: 0.72, rHi: 1, gam: 1 });
    b.decal = texOf(paint(drawDecal, 256, 256, null, 0), q, !0);
    // the parking lot is the concrete again, repeated
    const rep = ((C * CELL + 12) / 5) | 0,
      repz = ((R * CELL + 12) / 5) | 0;
    for (const n of ["conc", "concN", "concR"]) {
      if (!b[n]) continue;
      b["lot" + n.slice(4)] = b[n].clone();
      b["lot" + n.slice(4)].repeat.set(rep, repz);
      b["lot" + n.slice(4)].needsUpdate = !0;
    }
    return b;
  }
  const disposeBank = (b) => b && Object.values(b).forEach((t) => t && t.dispose && t.dispose());

  const M = (o) => new T.MeshStandardMaterial(o);
  const MT = {
    wall: M({ vertexColors: !0, roughness: 0.93, metalness: 0 }),
    ext: M({ emissive: 0xbad4ff, emissiveIntensity: 0.85, vertexColors: !0, roughness: 0.95, metalness: 0 }),
    floor: M({ vertexColors: !0, roughness: 0.5, metalness: 0.08 }),
    ceil: M({ vertexColors: !0, roughness: 0.96, metalness: 0 }),
    conc: M({ vertexColors: !0, roughness: 0.95, metalness: 0.02 }),
    fence: new T.MeshStandardMaterial({ map: fenceTex, transparent: !0, alphaTest: 0.4, side: T.DoubleSide, roughness: 0.6, metalness: 0.5, color: 0xaab0b6 }),
    decal: new T.MeshBasicMaterial({ transparent: !0, depthWrite: !1, polygonOffset: !0, polygonOffsetFactor: -3, polygonOffsetUnits: -3, fog: !0, vertexColors: !0 }),
    beam: new T.MeshBasicMaterial({ map: beamTex, transparent: !0, depthWrite: !1, blending: T.AdditiveBlending, side: T.DoubleSide, color: 0xbcd8ff, opacity: 0.5, fog: !0 }),
    matte: M({ vertexColors: !0, roughness: 0.92, metalness: 0 }),
    metal: M({ vertexColors: !0, roughness: 0.42, metalness: 0.75 }),
    gloss: M({ vertexColors: !0, roughness: 0.28, metalness: 0.25 }),
    glow: new T.MeshBasicMaterial({ vertexColors: !0, fog: !0 }),
  };
  // the ceiling tubes: steady, flickering and dying ones share a material per behaviour
  const TUBE = {
    steady: [0xe8f2ff, 0xc2dcff, 0xffe2b0, 0xff8a7a].map((c) => new T.MeshBasicMaterial({ color: c, fog: !0 })),
    flick: new T.MeshBasicMaterial({ color: 0xe8f2ff, fog: !0 }),
    dying: new T.MeshBasicMaterial({ color: 0x6a7480, fog: !0 }),
  };
  THEMES.hospital = {
    floor: M({ color: 0x62666b, roughness: 0.9, metalness: 0.02 }),
    wall: MT.wall,
    strut: MT.conc,
    trim: MT.conc,
    crate: MT.matte,
    glow: 0xbad4ff,
  };
  MOODS.hospital = {
    top: "#161d24", mid: "#2f3d48", hor: "#6f8391", fog: hex("#3e4b54"),
    hemiSky: hex("#b7c9d6"), hemiGnd: hex("#4a4d4a"), hemi: 1.18, exp: 1.08, env: 0.25,
    sun: hex("#9db4c4"), sunInt: 0.5, glow: "#bcd2e4",
    tint: [0.97, 1.02, 1.01], lift: [0, 0.006, 0.01], sat: 0.9, con: 1.09, vig: 0.4, bloom: 1.3,
  };

  // ── the tier in use: maps onto the materials, the prop shapes ──
  const TIER = { q: -1 };
  function useTier(q) {
    TIER.q = q;
    for (let i = 0; i < 3; i++) i !== q && BANKS[i] && (disposeBank(BANKS[i]), (BANKS[i] = null));
    if (!BANKS[q]) {
      const t0 = performance.now();
      BANKS[q] = makeBank(q);
      S.bankMs = Math.round(performance.now() - t0);
    }
    const b = BANKS[q];
    const set = (m, o, ns) => {
      for (const key in o) m[key] = o[key];
      m.normalMap && m.normalScale && m.normalScale.set(ns || 0.8, ns || 0.8);
      m.needsUpdate = !0;
    };
    const rough = (m, map, base) => ({ roughnessMap: map || null, roughness: map ? 1 : base });
    set(MT.wall, { map: b.wall, normalMap: b.wallN || null, ...rough(MT.wall, b.wallR, 0.93) });
    set(MT.ext, { map: b.ext, emissiveMap: b.extG, normalMap: b.extN || null, ...rough(MT.ext, b.extR, 0.95) });
    set(MT.floor, { map: b.floor, normalMap: b.floorN || null, ...rough(MT.floor, b.floorR, 0.5) }, 0.9);
    set(MT.ceil, { map: b.ceil, normalMap: b.ceilN || null, ...rough(MT.ceil, b.ceilR, 0.96) }, 0.6);
    set(MT.conc, { map: b.conc, normalMap: b.concN || null, ...rough(MT.conc, b.concR, 0.95) });
    set(THEMES.hospital.floor, { map: b.lot, normalMap: b.lotN || null, ...rough(THEMES.hospital.floor, b.lotR, 0.9) });
    MT.decal.map = b.decal;
    MT.decal.needsUpdate = !0;
    // the props: round things are rounder on the strong presets
    geoCyl = new T.CylinderGeometry(1, 1, 1, 2 === q ? 12 : 8);
    geoSph = new T.SphereGeometry(1, 2 === q ? 10 : 8, 2 === q ? 8 : 6);
  }

  // zone colours: wall tint, floor tint
  const ZC = {
    o: ["#a9d0cc", "#86adb0"], i: ["#aebdd0", "#7f8da3"], p: ["#dccf9f", "#aa9d70"], h: ["#cfccbc", "#aaa89b"], w: ["#bcd5bd", "#94b198"],
    a: ["#dcd6bf", "#cdc3a4"], l: ["#e4d8bf", "#c3b492"], e: ["#e2b9b3", "#bd8c86"], d: ["#b9bbbf", "#80838a"], s: ["#b4bccc", "#8c98ae"],
    t: ["#aab0b6", "#9aa0a6"], b: ["#a0b8a4", "#9cc0a0"], x: ["#8a8d92", "#6e7176"],
  };
  const colOf = (hexs, k) => {
    const c = new T.Color(hexs);
    return [c.r * k, c.g * k, c.b * k];
  };
  const GREY = colOf("#aaaaaa", 1);

  // ── geometry batches ──
  // Geometry is cut into chunks of 40 x 40 m per floor, so the renderer can skip what is behind the
  // camera and the building can switch whole floors off (a merged map is one huge, never-culled mesh).
  const CHUNK = 40;
  class Geo {
    constructor() {
      this.b = new Map();
    }
    bucket(x, y, z) {
      const lv = Math.max(0, Math.min(2, Math.floor((y + 0.05) / FH))),
        k = lv + ":" + Math.floor((x - OX) / CHUNK) + ":" + Math.floor((z - OZ) / CHUNK);
      let b = this.b.get(k);
      b || this.b.set(k, (b = { lv, p: [], n: [], u: [], c: [] }));
      return b;
    }
    quad(a, b, c, d, n, uv, col) {
      const t = this.bucket((a[0] + c[0]) / 2, Math.min(a[1], c[1]), (a[2] + c[2]) / 2);
      for (const k of [0, 1, 2, 0, 2, 3]) {
        const v = [a, b, c, d][k];
        t.p.push(v[0], v[1], v[2]);
        t.n.push(n[0], n[1], n[2]);
        t.u.push(uv[k][0], uv[k][1]);
        t.c.push(col[0], col[1], col[2]);
      }
    }
    // a primitive transformed into place (props)
    prim(geo, m4, col) {
      const g = geo.index ? geo.toNonIndexed() : geo;
      g.applyMatrix4(m4);
      const nm = new T.Matrix3().getNormalMatrix(m4),
        pa = g.attributes.position,
        na = g.attributes.normal,
        ua = g.attributes.uv,
        v = new T.Vector3();
      const t = this.bucket(pa.getX(0), pa.getY(0), pa.getZ(0));
      for (let i = 0; i < pa.count; i++) {
        t.p.push(pa.getX(i), pa.getY(i), pa.getZ(i));
        v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize();
        t.n.push(v.x, v.y, v.z);
        t.u.push(ua ? ua.getX(i) : 0, ua ? ua.getY(i) : 0);
        t.c.push(col[0], col[1], col[2]);
      }
      g.dispose();
    }
    // one mesh per chunk
    mesh(mat) {
      const out = [];
      for (const t of this.b.values()) {
        if (!t.p.length) continue;
        const g = new T.BufferGeometry();
        g.setAttribute("position", new T.Float32BufferAttribute(t.p, 3));
        g.setAttribute("normal", new T.Float32BufferAttribute(t.n, 3));
        g.setAttribute("uv", new T.Float32BufferAttribute(t.u, 2));
        g.setAttribute("color", new T.Float32BufferAttribute(t.c, 3));
        g.computeBoundingSphere();
        const m = new T.Mesh(g, mat);
        m.userData.noMerge = !0;
        m.userData.lv = t.lv;
        out.push(m);
      }
      return out;
    }
  }
  // an axis-aligned box into a Geo; `faces` picks which sides ("nx px ny py nz pz"), uv in metres / `us`
  function boxTo(g, x0, x1, y0, y1, z0, z1, col, o = {}) {
    const f = o.faces || "nx px ny py nz pz",
      us = o.us || CELL,
      vb = o.vBase || 0,
      vs = o.vs || FH,
      uo = o.uo || 0;
    const has = (k) => f.indexOf(k) >= 0;
    has("pz") && g.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [[x0 / us + uo, (y0 - vb) / vs], [x1 / us + uo, (y0 - vb) / vs], [x1 / us + uo, (y1 - vb) / vs], [x0 / us + uo, (y1 - vb) / vs]], col);
    has("nz") && g.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [[x1 / us + uo, (y0 - vb) / vs], [x0 / us + uo, (y0 - vb) / vs], [x0 / us + uo, (y1 - vb) / vs], [x1 / us + uo, (y1 - vb) / vs]], col);
    has("px") && g.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [[z1 / us + uo, (y0 - vb) / vs], [z0 / us + uo, (y0 - vb) / vs], [z0 / us + uo, (y1 - vb) / vs], [z1 / us + uo, (y1 - vb) / vs]], col);
    has("nx") && g.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [[z0 / us + uo, (y0 - vb) / vs], [z1 / us + uo, (y0 - vb) / vs], [z1 / us + uo, (y1 - vb) / vs], [z0 / us + uo, (y1 - vb) / vs]], col);
    has("py") && g.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [[x0 / us, z1 / us], [x1 / us, z1 / us], [x1 / us, z0 / us], [x0 / us, z0 / us]], col);
    has("ny") && g.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [[x0 / us, z0 / us], [x1 / us, z0 / us], [x1 / us, z1 / us], [x0 / us, z1 / us]], col);
  }

  const G = { wall: new Geo(), ext: new Geo(), floor: new Geo(), ceil: new Geo(), conc: new Geo(), fence: new Geo() };
  const PG = { matte: new Geo(), metal: new Geo(), gloss: new Geo(), glow: new Geo() };
  const colliders = [];
  const col = (minX, maxX, minZ, maxZ, y0, h, kind) => colliders.push({ minX, maxX, minZ, maxZ, y0: y0 > 0 ? y0 : void 0, h, kind });
  const T0 = 0.2; // half wall thickness

  // ── walls: runs of closed edges ──
  // each run is cut into one piece per cell so each face takes the tint of the room it looks into
  const runs = (n, dir, kinds) => {
    const out = [],
      lines = dir === "H" ? R + 1 : C + 1,
      len = dir === "H" ? C : R;
    for (let l = 0; l < lines; l++) {
      let s = -1,
        k0 = 0;
      for (let i = 0; i <= len; i++) {
        const k = i < len ? (dir === "H" ? eH(n, l, i) : eV(n, i, l)) : 0,
          want = kinds.includes(k) ? k : 0;
        if (s >= 0 && want !== k0) {
          out.push({ l, a: s, b: i, kind: k0 });
          s = -1;
        }
        if (want && s < 0) {
          s = i;
          k0 = want;
        }
      }
    }
    return out;
  };
  const zoneTint = (n, c, r, side) => {
    const z = zoneAt(n, c, r),
      j = 0.9 + 0.2 * hash(c + n * 3, r, side);
    return " " === z || "0" === z ? null : colOf((ZC[z] || ZC.h)[0], j);
  };
  function buildWalls() {
    for (let n = 0; n < 3; n++) {
      const b = baseOf(n),
        top = b + FH;
      for (const dir of ["H", "V"]) {
        for (const { l, a, b: e, kind } of runs(n, dir, [1])) {
          // collider
          if ("H" === dir) col(ex(a) - T0, ex(e) + T0, ez(l) - T0, ez(l) + T0, b, top, "wall");
          else col(ex(l) - T0, ex(l) + T0, ez(a) - T0, ez(e) + T0, b, top, "wall");
          // faces, per cell
          for (let i = a; i < e; i++) {
            const lo = i === a ? -T0 : 0,
              hi = i === e - 1 ? T0 : 0;
            if ("H" === dir) {
              const x0 = ex(i) + lo,
                x1 = ex(i + 1) + hi,
                z = ez(l);
              // north face looks into cell (i, l-1), south face into (i, l)
              for (const [side, rr, zz, nz] of [[0, l - 1, z - T0, -1], [1, l, z + T0, 1]]) {
                const tint = zoneTint(n, i, rr, side),
                  g = tint ? G.wall : G.ext;
                const cc = tint || colOf("#b9bab4", 0.9 + 0.2 * hash(i, l, n));
                boxTo(g, x0, x1, b, top, zz, zz, cc, { faces: nz < 0 ? "nz" : "pz", vBase: b, uo: Math.floor(hash(i, l, n * 2 + side) * 8) / 8 });
              }
            } else {
              const z0 = ez(i) + lo,
                z1 = ez(i + 1) + hi,
                x = ex(l);
              for (const [side, cc2, xx, nx] of [[0, l - 1, x - T0, -1], [1, l, x + T0, 1]]) {
                const tint = zoneTint(n, cc2, i, side + 2),
                  g = tint ? G.wall : G.ext;
                const cc = tint || colOf("#b9bab4", 0.9 + 0.2 * hash(l, i, n));
                boxTo(g, xx, xx, b, top, z0, z1, cc, { faces: nx < 0 ? "nx" : "px", vBase: b, uo: Math.floor(hash(l, i, n * 2 + side + 7) * 8) / 8 });
              }
            }
          }
          // end caps
          const capc = colOf("#8f918c", 1);
          if ("H" === dir) {
            boxTo(G.conc, ex(a) - T0, ex(a) - T0, b, top, ez(l) - T0, ez(l) + T0, capc, { faces: "nx", vBase: b });
            boxTo(G.conc, ex(e) + T0, ex(e) + T0, b, top, ez(l) - T0, ez(l) + T0, capc, { faces: "px", vBase: b });
          } else {
            boxTo(G.conc, ex(l) - T0, ex(l) + T0, b, top, ez(a) - T0, ez(a) - T0, capc, { faces: "nz", vBase: b });
            boxTo(G.conc, ex(l) - T0, ex(l) + T0, b, top, ez(e) + T0, ez(e) + T0, capc, { faces: "pz", vBase: b });
          }
        }
      }
    }
  }

  // ── low walls: balustrades (2), deck parapets (3), the lot fence (4) ──
  function buildLow() {
    const spec = { 2: [0.15, 1.1], 3: [0.15, 1.3], 4: [0.05, 2.4] };
    for (let n = 0; n < 3; n++) {
      const b = baseOf(n);
      for (const dir of ["H", "V"]) {
        for (const { l, a, b: e, kind } of runs(n, dir, [2, 3, 4])) {
          const [t, h] = spec[kind];
          const x0 = "H" === dir ? ex(a) - t : ex(l) - t,
            x1 = "H" === dir ? ex(e) + t : ex(l) + t,
            z0 = "H" === dir ? ez(l) - t : ez(a) - t,
            z1 = "H" === dir ? ez(l) + t : ez(e) + t;
          col(x0, x1, z0, z1, b, b + h, 4 === kind ? "fence" : "rail");
          if (4 === kind) {
            // a chain-link panel, drawn on both sides by the double-sided material
            const px = "H" === dir;
            const len = px ? x1 - x0 : z1 - z0;
            const g = G.fence;
            const u = len / 2,
              v = h / 2;
            px
              ? g.quad([x0, b, (z0 + z1) / 2], [x1, b, (z0 + z1) / 2], [x1, b + h, (z0 + z1) / 2], [x0, b + h, (z0 + z1) / 2], [0, 0, 1], [[0, 0], [u, 0], [u, v], [0, v]], [1, 1, 1])
              : g.quad([(x0 + x1) / 2, b, z0], [(x0 + x1) / 2, b, z1], [(x0 + x1) / 2, b + h, z1], [(x0 + x1) / 2, b + h, z0], [1, 0, 0], [[0, 0], [u, 0], [u, v], [0, v]], [1, 1, 1]);
            // posts every 5 m
            for (let p = 0; p <= len; p += 5) {
              const [px0, pz0] = px ? [x0 + p, (z0 + z1) / 2] : [(x0 + x1) / 2, z0 + p];
              boxTo(G.conc, px0 - 0.06, px0 + 0.06, b, b + h + 0.15, pz0 - 0.06, pz0 + 0.06, colOf("#5d6368", 1), { faces: "nx px nz pz py" });
            }
          } else {
            const cc = colOf(3 === kind ? "#8d8f8c" : "#a3a6a1", 1);
            boxTo(G.conc, x0, x1, b, b + h, z0, z1, cc, { faces: "nx px nz pz py", vBase: b, vs: 1.5 });
            // a rusty handrail on top of balustrades
            2 === kind && boxTo(PG.metal, x0 - 0.02, x1 + 0.02, b + h, b + h + 0.06, z0 - 0.02, z1 + 0.02, colOf("#59504a", 1), { faces: "nx px nz pz py" });
          }
        }
      }
    }
  }

  // ── lintels over doors: a door is a short opening in a wall line; fill the top 1.4 m ──
  function buildLintels() {
    for (let n = 0; n < 3; n++) {
      const b = baseOf(n);
      for (const dir of ["H", "V"]) {
        const lines = "H" === dir ? R + 1 : C + 1,
          len = "H" === dir ? C : R;
        for (let l = 0; l < lines; l++) {
          let i = 0;
          const k = (q) => ("H" === dir ? eH(n, l, q) : eV(n, q, l));
          while (i < len) {
            if (k(i) !== 0) { i++; continue; }
            let j = i;
            while (j < len && k(j) === 0) j++;
            const wallL = i > 0 && 1 === k(i - 1),
              wallR = j < len && 1 === k(j);
            // every cell along the opening has a real room on both sides (no stairs, no holes)
            let real = !0;
            for (let q = i; q < j && real; q++) {
              const a = "H" === dir ? [q, l - 1] : [l - 1, q],
                z = "H" === dir ? [q, l] : [l, q];
              real = slabLike(n, a[0], a[1]) && slabLike(n, z[0], z[1]);
            }
            if (wallL && wallR && real && j - i <= 4) {
              const y0 = b + 2.7,
                y1 = b + FH;
              if ("H" === dir) {
                col(ex(i) - 0.01, ex(j) + 0.01, ez(l) - T0, ez(l) + T0, y0, y1, "wall");
                for (let q = i; q < j; q++) for (const [rr, zz, f] of [[l - 1, ez(l) - T0, "nz"], [l, ez(l) + T0, "pz"]]) boxTo(G.wall, ex(q), ex(q + 1), y0, y1, zz, zz, zoneTint(n, q, rr, 5) || GREY, { faces: f, vBase: b });
                boxTo(G.conc, ex(i), ex(j), y0 - 0.1, y0, ez(l) - T0, ez(l) + T0, colOf("#4a4c4c", 1), { faces: "ny nx px nz pz" });
              } else {
                col(ex(l) - T0, ex(l) + T0, ez(i) - 0.01, ez(j) + 0.01, y0, y1, "wall");
                for (let q = i; q < j; q++) for (const [cc2, xx, f] of [[l - 1, ex(l) - T0, "nx"], [l, ex(l) + T0, "px"]]) boxTo(G.wall, xx, xx, y0, y1, ez(q), ez(q + 1), zoneTint(n, cc2, q, 6) || GREY, { faces: f, vBase: b });
                boxTo(G.conc, ex(l) - T0, ex(l) + T0, y0 - 0.1, y0, ez(i), ez(j), colOf("#4a4c4c", 1), { faces: "ny nx px nz pz" });
              }
            }
            i = j;
          }
        }
      }
    }
  }
  // a door only joins two rooms: stair runs and holes have their own openings
  const slabLike = (n, c, r) => " " !== zoneAt(n, c, r) && "s" !== zoneAt(n, c, r) && "9" !== zoneAt(n, c, r) && "0" !== zoneAt(n, c, r);

  // ── floors, ceilings, slabs ──
  const roofAt = (c, r) => {
    const z = zoneAt(2, c, r);
    return " " !== z && "0" !== z && "t" !== z && "b" !== z;
  };
  function buildSlabs() {
    // ground: tiled floor quads (the lot keeps the engine's floor)
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const z = zoneAt(0, c, r);
      if (" " === z || "x" === z) continue;
      const cc = colOf((ZC[z] || ZC.h)[1], 0.88 + 0.24 * hash(c, r, 1)),
        x0 = ex(c),
        x1 = ex(c + 1),
        z0 = ez(r),
        z1 = ez(r + 1);
      G.floor.quad([x0, 0.012, z1], [x1, 0.012, z1], [x1, 0.012, z0], [x0, 0.012, z0], [0, 1, 0], [[x0 / CELL, z1 / CELL], [x1 / CELL, z1 / CELL], [x1 / CELL, z0 / CELL], [x0 / CELL, z0 / CELL]], cc);
    }
    // the floors above: a slab per cell, merged into rectangles for the colliders
    const slabs = (n, has) => {
      const top = n * FH,
        bot = top - SL;
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        if (!has(c, r)) continue;
        const z = 3 === n ? "t" : zoneAt(n, c, r),
          x0 = ex(c),
          x1 = ex(c + 1),
          z0 = ez(r),
          z1 = ez(r + 1);
        const deck = "t" === z || "b" === z;
        const tint = colOf((ZC[z] || ZC.h)[1], 0.88 + 0.24 * hash(c, r, n));
        // top (the floor of this level; the roof slab is plain concrete)
        const gTop = 3 === n || deck ? G.conc : G.floor;
        gTop.quad([x0, top, z1], [x1, top, z1], [x1, top, z0], [x0, top, z0], [0, 1, 0], [[x0 / CELL, z1 / CELL], [x1 / CELL, z1 / CELL], [x1 / CELL, z0 / CELL], [x0 / CELL, z0 / CELL]], 3 === n ? colOf("#7d8085", 1) : tint);
        // underside: the ceiling of the level below
        G.ceil.quad([x0, bot, z0], [x1, bot, z0], [x1, bot, z1], [x0, bot, z1], [0, -1, 0], [[x0 / CELL, z0 / CELL], [x1 / CELL, z0 / CELL], [x1 / CELL, z1 / CELL], [x0 / CELL, z1 / CELL]], colOf("#d2d0c4", 0.85 + 0.2 * hash(c, r, n + 5)));
        // edges that face a hole or the outside
        const cc = colOf("#8a8c88", 1);
        !has(c, r - 1) && boxTo(G.conc, x0, x1, bot, top, z0, z0, cc, { faces: "nz", vBase: bot, vs: SL });
        !has(c, r + 1) && boxTo(G.conc, x0, x1, bot, top, z1, z1, cc, { faces: "pz", vBase: bot, vs: SL });
        !has(c - 1, r) && boxTo(G.conc, x0, x0, bot, top, z0, z1, cc, { faces: "nx", vBase: bot, vs: SL });
        !has(c + 1, r) && boxTo(G.conc, x1, x1, bot, top, z0, z1, cc, { faces: "px", vBase: bot, vs: SL });
      }
      // colliders: rows of cells joined, then rows with equal spans joined
      const rects = [];
      for (let r = 0; r < R; r++) {
        let s = -1;
        for (let c = 0; c <= C; c++) {
          const on = c < C && has(c, r);
          if (on && s < 0) s = c;
          if (!on && s >= 0) {
            const prev = rects.find((q) => q.r1 === r && q.c0 === s && q.c1 === c);
            prev ? (prev.r1 = r + 1) : rects.push({ c0: s, c1: c, r0: r, r1: r + 1 });
            s = -1;
          }
        }
      }
      for (const q of rects) col(ex(q.c0), ex(q.c1), ez(q.r0), ez(q.r1), bot, top, "slab");
    };
    slabs(1, (c, r) => slabAt(1, c, r));
    slabs(2, (c, r) => slabAt(2, c, r));
    slabs(3, (c, r) => roofAt(c, r));
  }

  // ── stairs: 8 steps of 0.5 m over 10 m, 5 m wide ──
  function buildStairs() {
    for (const [from, c, r] of P.stairs) {
      const b = baseOf(from),
        x0 = ex(c) + T0,
        x1 = ex(c + 2) - T0,
        zs = ez(r + 1);
      for (let s = 1; s <= 8; s++) {
        const top = b + 0.5 * s,
          z1 = zs - 1.25 * (s - 1),
          z0 = zs - 1.25 * s;
        col(x0, x1, z0, z1, b, top, "stair");
        const cc = colOf("#9a9c98", 0.85 + 0.2 * hash(c, s, from));
        // the riser faces the low end, the tread the sky; the sides are against the walls
        boxTo(G.conc, x0, x1, b + 0.5 * (s - 1), top, z1, z1, cc, { faces: "pz", vBase: b, vs: 0.5 });
        boxTo(G.conc, x0, x1, top, top, z0, z1, cc, { faces: "py" });
        boxTo(PG.metal, x0, x1, top - 0.03, top, z1 - 0.08, z1, colOf("#4a4f55", 1), { faces: "py pz" });
      }
    }
  }

  // ── props ──
  const DIM = {
    bed: [1, 2.1, 0.9], gurney: [0.9, 2, 0.95], table: [1.1, 2.2, 1.05], cabinet: [0.7, 2, 2.1], shelf: [0.7, 4.6, 2.3], desk: [2.6, 1, 1.1],
    bench: [2.4, 0.7, 0.8], crate: [1.3, 1.3, 1.3], wheelchair: [0.7, 0.9, 0.9], mri: [2.6, 3.4, 2.4], vending: [1.1, 0.9, 1.9], ambulance: [2.4, 5.8, 2.5],
    car: [2.0, 4.3, 1.5], rubble: [2.2, 2.2, 1.0], ac: [2.2, 1.6, 1.4], tank: [2.6, 2.6, 3.0], dumpster: [1.9, 1.3, 1.4], counter: [3.6, 0.9, 1.1], pillar: [0.5, 0.5, 4.0],
  };
  let geoCyl, geoSph;
  const geoBox = new T.BoxGeometry(1, 1, 1),
    geoCone = new T.ConeGeometry(1, 1, 8);
  const _m = new T.Matrix4(),
    _q = new T.Quaternion(),
    _e = new T.Euler(),
    _v = new T.Vector3(),
    _s = new T.Vector3(),
    _w = new T.Matrix4(),
    _l = new T.Matrix4();
  // a builder bound to a prop's place: local coordinates in metres, x across, z along, +y up
  function frame(x, y, z, turn) {
    const base = new T.Matrix4().compose(_v.set(x, y, z), _q.setFromAxisAngle(new T.Vector3(0, 1, 0), turn), _s.set(1, 1, 1));
    const put = (cls, geo, sx, sy, sz, lx, ly, lz, colr, rx, ry, rz) => {
      _l.compose(_v.set(lx, ly, lz), _q.setFromEuler(_e.set(rx || 0, ry || 0, rz || 0)), _s.set(sx, sy, sz));
      _w.multiplyMatrices(base, _l);
      PG[cls].prim(geo, _w, colOf(colr, 1));
    };
    return {
      box: (cls, w, h, d, lx, ly, lz, colr, rx, ry, rz) => put(cls, geoBox, w, h, d, lx, ly, lz, colr, rx, ry, rz),
      cyl: (cls, rt, h, lx, ly, lz, colr, rx, ry, rz) => put(cls, geoCyl, rt, h, rt, lx, ly, lz, colr, rx, ry, rz),
      sph: (cls, rx_, ry_, rz_, lx, ly, lz, colr) => put(cls, geoSph, rx_, ry_, rz_, lx, ly, lz, colr),
      cone: (cls, r, h, lx, ly, lz, colr, rx, ry, rz) => put(cls, geoCone, r, h, r, lx, ly, lz, colr, rx, ry, rz),
    };
  }
  const SHEETS = ["#c9d3d6", "#b7c7c0", "#d6cfbf", "#aebdc9", "#cbbcb4"];
  const pick = (a, h) => a[Math.floor(h * a.length) % a.length];
  const PROP = {
    bed(f, h) {
      const bw = 0.9;
      for (const sx of [-1, 1]) f.box("metal", 0.04, 0.1, 1.95, sx * (bw / 2), 0.5, 0, "#b9c0c4");
      for (const sx of [-1, 1]) for (const sz of [-0.9, 0.9]) {
        f.cyl("metal", 0.025, 0.42, sx * (bw / 2), 0.23, sz, "#9aa0a4");
        f.cyl("matte", 0.06, 0.05, sx * (bw / 2), 0.05, sz, "#2a2c2e", 0, 0, Math.PI / 2);
      }
      f.box("matte", 0.86, 0.16, 1.9, 0, 0.6, 0, pick(["#7d9a98", "#8a9a7d", "#9a8d7d", "#8d9aa6"], h));
      f.box("matte", 0.88, 0.07, 1.25 + h * 0.5, 0, 0.72, 0.2 - h * 0.15, pick(SHEETS, h * 7.3), 0, (h - 0.5) * 0.25, 0);
      h > 0.6 && f.box("matte", 0.5, 0.012, 0.6, 0.1, 0.762, 0.2, "#5a1713", 0, 0.3, 0);
      f.box("matte", 0.5, 0.12, 0.4, 0, 0.75, -0.7, "#cfd6d8");
      f.box("metal", 0.92, 0.55, 0.05, 0, 0.8, -1.0, "#c3c9cc");
      f.box("metal", 0.92, 0.35, 0.05, 0, 0.7, 1.0, "#c3c9cc");
      h < 0.55 && (f.cyl("metal", 0.016, 1.9, bw / 2 + 0.12, 0.95, -0.7, "#a9aeb2"), f.box("matte", 0.16, 0.26, 0.05, bw / 2 + 0.12, 1.5, -0.7, "#d6d2a0"));
    },
    gurney(f, h) {
      for (const sx of [-1, 1]) f.box("metal", 0.04, 0.06, 1.9, sx * 0.4, 0.62, 0, "#aeb4b8");
      for (const sx of [-1, 1]) for (const sz of [-0.8, 0.8]) {
        f.cyl("metal", 0.022, 0.55, sx * 0.38, 0.3, sz, "#8e9498");
        f.cyl("matte", 0.075, 0.06, sx * 0.38, 0.075, sz, "#25272a", 0, 0, Math.PI / 2);
      }
      f.box("matte", 0.78, 0.1, 1.86, 0, 0.7, 0, "#6f8f93");
      f.box("matte", 0.8, 0.06, 1.0 + h * 0.5, 0, 0.79, 0.3 - h * 0.1, h > 0.5 ? "#8a2e2a" : "#cfd6d8", 0, (h - 0.5) * 0.3, 0);
      f.box("matte", 0.78, 0.18, 0.5, 0, 0.82, -0.7, "#cfd6d8", -0.25, 0, 0);
      for (const sx of [-1, 1]) f.box("metal", 0.03, 0.2, 1.1, sx * 0.42, 0.82, 0.1, "#b8bec2");
    },
    table(f, h) {
      f.box("metal", 0.7, 0.07, 1.3, 0, 0.04, 0, "#7a8084");
      f.cyl("metal", 0.12, 0.8, 0, 0.45, 0, "#a9aeb2");
      f.box("matte", 1.0, 0.1, 1.5, 0, 0.88, 0.1, "#bcc9c6");
      f.box("matte", 0.9, 0.09, 0.6, 0, 0.95, -0.9, "#bcc9c6", 0.35, 0, 0);
      f.box("matte", 0.9, 0.09, 0.5, 0, 0.84, 1.05, "#bcc9c6", -0.15, 0, 0);
      for (const sx of [-1, 1]) f.box("metal", 0.04, 0.05, 1.5, sx * 0.55, 0.9, 0.1, "#9aa0a4");
      h > 0.4 && f.box("matte", 0.5, 0.012, 0.8, 0.05, 0.935, 0.1, "#541512", 0, 0.2, 0);
      // the lamp over it: a pole from the ceiling, an arm, the dish
      f.cyl("metal", 0.04, 0.9, 0.2, 3.05, 0.1, "#9aa0a4");
      f.box("metal", 0.7, 0.05, 0.05, 0, 2.6, 0.1, "#9aa0a4");
      f.cyl("metal", 0.5, 0.12, 0, 2.45, 0.1, "#b4babe");
      f.cyl("glow", 0.42, 0.02, 0, 2.38, 0.1, "#ffe9b8");
    },
    cabinet(f, h) {
      f.box("metal", 0.6, 2.1, 1.95, -0.05, 1.05, 0, pick(["#9db3ab", "#a6aeb4", "#b2b6a4"], h));
      for (let i = 0; i < 4; i++) f.box("metal", 0.012, 0.98, 0.46, 0.255, 1.05 + (i % 2 ? 0.52 : -0.52), -0.72 + i * 0.48, "#79857f");
      for (let i = 0; i < 4; i++) f.box("metal", 0.03, 0.12, 0.02, 0.27, 1.05, -0.5 + i * 0.48, "#5e6468");
      h > 0.7 && f.box("matte", 0.012, 0.9, 0.5, 0.262, 1.55, 0.5, "#2c2f31", 0, 0, 0.0);
    },
    shelf(f, h) {
      for (const sz of [-2.3, -1.15, 0, 1.15, 2.3]) f.box("metal", 0.64, 2.3, 0.05, -0.03, 1.15, sz, "#79828a");
      for (let i = 0; i < 5; i++) f.box("metal", 0.6, 0.04, 4.6, -0.03, 0.2 + i * 0.5, 0, "#8b949b");
      f.box("metal", 0.03, 2.2, 4.5, -0.34, 1.1, 0, "#6c747a");
      // stock: little boxes and bottles, some missing
      for (let lvl = 0; lvl < 4; lvl++) for (let k = 0; k < 8; k++) {
        const q = hash(h * 100 + lvl, k, 4);
        if (q < 0.45) continue;
        const z = -2.1 + k * 0.58;
        q < 0.7
          ? f.box("matte", 0.32, 0.2 + q * 0.16, 0.34, 0.02, 0.2 + lvl * 0.5 + 0.12 + q * 0.04, z, pick(["#e4e0d2", "#d9c9a4", "#9cc0c8", "#e1b5a8"], q * 9))
          : f.box("gloss", 0.14, 0.26, 0.14, 0.05, 0.2 + lvl * 0.5 + 0.15, z, pick(["#b57b2c", "#3d7d5a", "#cfd3d6"], q * 7));
      }
    },
    desk(f, h) {
      f.box("matte", 2.55, 0.06, 0.9, 0, 1.06, 0, "#8a8f93");
      f.box("matte", 2.5, 1.04, 0.08, 0, 0.52, 0.4, "#6d7478");
      f.box("matte", 0.9, 1.0, 0.8, -0.85, 0.5, -0.0, "#767d82");
      f.box("matte", 0.5, 0.36, 0.05, 0.4, 1.28, -0.1, "#222628", -0.15, 0.2, 0);
      f.box("glow", 0.44, 0.3, 0.01, 0.4, 1.28, -0.07, h > 0.5 ? "#16313a" : "#0c0f10", -0.15, 0.2, 0);
    },
    counter(f, h) {
      f.box("matte", 3.55, 0.07, 0.9, 0, 1.08, 0, "#9a9a92");
      f.box("matte", 3.5, 1.04, 0.5, 0, 0.52, 0.2, "#7c817f");
      f.box("matte", 3.5, 0.5, 0.06, 0, 1.0, -0.35, "#70756f");
      for (let i = 0; i < 4; i++) f.box("matte", 0.8, 0.9, 0.012, -1.3 + i * 0.87, 0.5, 0.46, "#6a706c");
      h > 0.5 && f.box("matte", 0.5, 0.08, 0.35, 0.8, 1.16, 0, "#d8d4c4");
    },
    bench(f, h) {
      f.box("matte", 2.4, 0.07, 0.5, 0, 0.46, 0, "#7d6a54");
      f.box("matte", 2.4, 0.4, 0.06, 0, 0.7, -0.27, "#7d6a54", -0.15, 0, 0);
      for (const sx of [-1.1, 0, 1.1]) f.box("metal", 0.05, 0.46, 0.5, sx, 0.23, 0, "#555b60");
    },
    crate(f, h) {
      const c = pick(["#7a5f3a", "#6f5a40", "#8a6f48"], h);
      f.box("matte", 1.2, 1.2, 1.2, 0, 0.62, 0, c);
      for (const y of [0.12, 0.62, 1.12]) f.box("matte", 1.3, 0.1, 1.3, 0, y + 0.02, 0, "#4f3f2a");
      for (const sx of [-0.6, 0.6]) for (const sz of [-0.6, 0.6]) f.box("matte", 0.1, 1.3, 0.1, sx, 0.65, sz, "#4f3f2a");
      h > 0.5 && f.box("matte", 0.4, 0.4, 0.01, 0.0, 0.7, 0.66, "#a8302a");
    },
    wheelchair(f, h) {
      f.box("matte", 0.5, 0.06, 0.5, 0, 0.5, 0.0, "#2c3034");
      f.box("matte", 0.5, 0.5, 0.05, 0, 0.78, -0.25, "#2c3034", -0.12, 0, 0);
      for (const sx of [-1, 1]) {
        f.cyl("matte", 0.3, 0.04, sx * 0.34, 0.32, 0.05, "#1d2023", 0, 0, Math.PI / 2);
        f.cyl("metal", 0.26, 0.02, sx * 0.34, 0.32, 0.05, "#7b8288", 0, 0, Math.PI / 2);
        f.cyl("matte", 0.07, 0.04, sx * 0.27, 0.07, 0.38, "#1d2023", 0, 0, Math.PI / 2);
        f.box("metal", 0.03, 0.03, 0.4, sx * 0.27, 0.65, 0.05, "#7b8288");
        f.box("metal", 0.03, 0.35, 0.03, sx * 0.27, 0.9, -0.28, "#7b8288");
      }
    },
    mri(f, h) {
      f.cyl("matte", 1.2, 2.4, 0, 1.2, -0.55, "#dcdfe0", Math.PI / 2, 0, 0);
      f.cyl("matte", 0.62, 2.45, 0, 1.2, -0.55, "#14181a", Math.PI / 2, 0, 0);
      f.box("matte", 2.6, 0.5, 1.5, 0, 0.25, -1.4, "#c8ccce", 0, 0, 0);
      f.box("matte", 0.8, 0.15, 2.6, 0, 0.82, 0.65, "#cfd6d8");
      f.box("matte", 0.45, 0.5, 1.9, 0, 0.5, 0.9, "#8a9296");
      f.box("matte", 0.2, 0.06, 0.2, 1.1, 2.46, -0.55, "#ffcf3a");
    },
    vending(f, h) {
      f.box("matte", 1.05, 1.9, 0.85, 0, 0.95, 0, "#a83a34");
      f.box("glow", 0.72, 1.3, 0.01, 0, 1.1, 0.43, h > 0.5 ? "#7fb6c8" : "#1e2a30");
      f.box("matte", 0.28, 0.5, 0.01, 0.37, 0.55, 0.43, "#1a1c1e");
    },
    ambulance(f, h) {
      f.box("gloss", 2.3, 1.7, 3.9, 0, 1.55, -0.85, "#dfe1e0");
      f.box("gloss", 2.3, 1.3, 1.8, 0, 1.15, 1.9, "#dfe1e0");
      f.box("gloss", 2.0, 0.55, 0.04, 0, 1.55, 2.82, "#27343c", -0.35, 0, 0);
      f.box("gloss", 2.32, 0.18, 5.7, 0, 0.8, 0, "#b3262a");
      f.box("gloss", 2.32, 0.5, 5.7, 0, 0.35, 0, "#8a8d90");
      for (const sx of [-1, 1]) for (const sz of [-1.8, 1.9]) {
        f.cyl("matte", 0.42, 0.28, sx * 1.15, 0.42, sz, "#1b1c1e", 0, 0, Math.PI / 2);
        f.cyl("metal", 0.2, 0.3, sx * 1.15, 0.42, sz, "#8c9298", 0, 0, Math.PI / 2);
      }
      f.box("glow", 0.45, 0.14, 0.2, -0.5, 2.46, 0.9, "#e8383a");
      f.box("glow", 0.45, 0.14, 0.2, 0.5, 2.46, 0.9, "#3a78e8");
      f.box("gloss", 0.9, 0.9, 0.01, 1.16, 1.6, -0.8, "#b3262a");
      f.box("gloss", 0.9, 0.24, 0.01, 1.165, 1.6, -0.8, "#dfe1e0");
      f.box("gloss", 0.24, 0.9, 0.01, 1.165, 1.6, -0.8, "#dfe1e0");
    },
    car(f, h) {
      const c = pick(["#8a8f93", "#7a2a2a", "#2d3b52", "#52583e", "#a29a8a"], h);
      f.box("gloss", 1.9, 0.6, 4.2, 0, 0.62, 0, c);
      f.box("gloss", 1.6, 0.55, 2.2, 0, 1.14, -0.15, c);
      f.box("gloss", 1.5, 0.45, 2.0, 0, 1.15, -0.15, "#1b2428");
      for (const sx of [-1, 1]) for (const sz of [-1.35, 1.35]) f.cyl("matte", 0.36, 0.26, sx * 0.9, 0.36, sz, "#17181a", 0, 0, Math.PI / 2);
      h > 0.5 && f.box("matte", 1.8, 0.04, 1.4, 0, 0.94, 1.2, "#5e3a28", -0.1, 0, 0.05);
    },
    rubble(f, h) {
      for (let i = 0; i < 9; i++) {
        const q = hash(h * 50, i, 8),
          q2 = hash(i, h * 20, 3);
        f.box("matte", 0.4 + q * 0.9, 0.3 + q2 * 0.5, 0.4 + q2 * 0.8, (q - 0.5) * 1.5, 0.2 + q2 * 0.2, (q2 - 0.5) * 1.5, pick(["#8b8c86", "#797b76", "#9a9a92"], q * 5), q * 1.4, q2 * 3, q2);
      }
      f.cyl("metal", 0.015, 1.0, 0.3, 0.7, 0.2, "#6b4a33", 0.5, 0, 0.3);
    },
    ac(f, h) {
      f.box("metal", 2.1, 1.1, 1.4, 0, 0.7, 0, "#a8aeb2");
      f.box("metal", 2.2, 0.08, 1.5, 0, 1.3, 0, "#8d9397");
      f.cyl("metal", 0.5, 0.06, 0.5, 1.3, 0, "#3c4146");
      f.cyl("metal", 0.5, 0.06, -0.5, 1.3, 0, "#3c4146");
      for (const sx of [-0.9, 0.9]) f.box("metal", 0.1, 0.25, 1.3, sx, 0.12, 0, "#585e63");
    },
    tank(f, h) {
      f.cyl("metal", 1.2, 2.2, 0, 1.9, 0, "#7d8d92");
      f.cone("metal", 1.25, 0.7, 0, 3.3, 0, "#6f7f84");
      for (const sx of [-0.9, 0.9]) for (const sz of [-0.9, 0.9]) f.box("metal", 0.12, 1.2, 0.12, sx, 0.6, sz, "#5a6166");
      f.box("metal", 2.0, 0.08, 0.08, 0, 1.0, 0.9, "#5a6166");
    },
    dumpster(f, h) {
      f.box("metal", 1.8, 1.1, 1.2, 0, 0.7, 0, "#3f5c48");
      f.box("metal", 1.85, 0.06, 1.25, 0, 1.28, -0.1, "#2f4a38", 0.12, 0, 0);
      for (const sx of [-0.8, 0.8]) f.cyl("matte", 0.1, 0.06, sx, 0.1, 0.55, "#1a1c1e", 0, 0, Math.PI / 2);
    },
    pillar(f) {
      f.box("matte", 0.5, 4.0, 0.5, 0, 2.0, 0, "#a9a79a");
    },
  };
  function buildProps() {
    const cols = [];
    for (const [n, kind, x, z, rot, tag] of P.props) {
      const base = baseOf(n),
        [w, d, hh] = DIM[kind],
        swap = rot & 1,
        hw = (swap ? d : w) / 2,
        hd = (swap ? w : d) / 2;
      const h = hash(x, z, n + 1);
      PROP[kind] && PROP[kind](frame(x, base, z, (rot * Math.PI) / 2), h);
      if ("pillar" === kind) {
        // the atrium columns run the whole height of the building
        const top = n === 0 && "a" === zoneAt(0, Math.floor((x - OX) / CELL), Math.floor((z - OZ) / CELL)) ? 3 * FH : hh;
        if (top > hh) {
          const f = frame(x, base, z, 0);
          f.box("matte", 0.5, top - hh, 0.5, 0, hh + (top - hh) / 2, 0, "#a9a79a");
          f.box("matte", 0.62, 0.3, 0.62, 0, 0.15, 0, "#8d8b80");
          f.box("matte", 0.62, 0.3, 0.62, 0, top - 0.15, 0, "#8d8b80");
        }
        col(x - 0.25, x + 0.25, z - 0.25, z + 0.25, base, base + top, "pillar");
        continue;
      }
      col(x - hw, x + hw, z - hd, z + hd, base, base + hh, "prop");
    }
  }

  // ── lights, signs, decals, the shaft of daylight ──
  const tubes = { steady: [new Geo(), new Geo(), new Geo(), new Geo()], flick: new Geo(), dying: new Geo() };
  function buildLights() {
    for (const [n, x, z, flick, c] of P.lights) {
      const y = baseOf(n) + FH - SL - 0.05,
        g = 2 === flick ? tubes.dying : 1 === flick ? tubes.flick : tubes.steady[c];
      boxTo(g, x - 0.65, x + 0.65, y - 0.06, y, z - 0.14, z + 0.14, [1, 1, 1], { faces: "nx px ny nz pz" });
      boxTo(PG.metal, x - 0.7, x + 0.7, y, y + 0.03, z - 0.18, z + 0.18, colOf("#3a3f44", 1), { faces: "nx px nz pz ny" });
    }
  }
  const signTex = {};
  function signMesh(text, x, y, z, ry) {
    const c = document.createElement("canvas"),
      g = c.getContext("2d"),
      px = 56;
    g.font = `800 ${px}px "Noto Sans KR", system-ui, sans-serif`;
    const w = Math.ceil(g.measureText(text).width) + 44;
    c.width = w;
    c.height = px + 30;
    g.fillStyle = "#1f3a33";
    g.fillRect(0, 0, w, c.height);
    g.strokeStyle = "#cfd8d2";
    g.lineWidth = 5;
    g.strokeRect(5, 5, w - 10, c.height - 10);
    g.font = `800 ${px}px "Noto Sans KR", system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#e9efe8";
    g.fillText(text, w / 2, c.height / 2 + 2);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    const hh = 0.5,
      m = new T.Mesh(new T.PlaneGeometry((hh * c.width) / c.height, hh), new T.MeshBasicMaterial({ map: t, fog: !0 }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.userData.noMerge = !0;
    return m;
  }
  // ── the front: floor lines and a cornice round the building, a canopy over each entrance, the sign ──
  // The outside was one long blank wall. These are thin boxes and one flat sign: a few hundred triangles,
  // no collider (all of it is above head height or flush with the wall).
  let SIGN = null;
  function signBoard() {
    if (SIGN) return SIGN;
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#1b2126";
    g.fillRect(0, 0, 1024, 256);
    g.strokeStyle = "#4b555c";
    g.lineWidth = 8;
    g.strokeRect(8, 8, 1008, 240);
    // the cross, its red gone to rust
    g.fillStyle = "#c9ccc6";
    g.fillRect(36, 36, 184, 184);
    g.fillStyle = "#8f3a33";
    g.fillRect(96, 52, 64, 152);
    g.fillRect(52, 96, 152, 64);
    // the name: a few letters still lit, the rest dead glass; both lines are fitted to the room left of the cross
    const name = "ELMWOOD",
      lit = [1, 1, 0, 1, 1, 0, 1],
      room = 730;
    g.textBaseline = "middle";
    g.textAlign = "left";
    let px = 150;
    g.font = `900 ${px}px "Orbitron", "Noto Sans KR", sans-serif`;
    const nameW = () => [...name].reduce((w, ch) => w + g.measureText(ch).width + 6, 0);
    px = Math.floor(px * Math.min(1, room / nameW()));
    g.font = `900 ${px}px "Orbitron", "Noto Sans KR", sans-serif`;
    let x = 258;
    for (let i = 0; i < name.length; i++) {
      g.fillStyle = lit[i] ? "#d7e8ff" : "#3a4248";
      g.fillText(name[i], x, 92);
      x += g.measureText(name[i]).width + 6;
    }
    const sub = "GENERAL HOSPITAL  ·  응급 24시";
    let sp = 62;
    g.font = `800 ${sp}px "Noto Sans KR", sans-serif`;
    sp = Math.floor(sp * Math.min(1, room / g.measureText(sub).width));
    g.font = `800 ${sp}px "Noto Sans KR", sans-serif`;
    g.fillStyle = "#9fb0bd";
    g.fillText(sub, 258, 200);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 8;
    SIGN = { t, mat: new T.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.34, roughness: 0.8, metalness: 0.05 }) };
    return SIGN;
  }
  function buildFacade() {
    const W = C * CELL,
      stone = colOf("#8f918c", 1),
      pale = colOf("#a9aba5", 1),
      dark = colOf("#3d4247", 1);
    const x0 = OX,
      x1 = OX + W,
      zN = ez(0),
      zS = ez(P.buildingRows);
    // a band at each floor line (a shallow ledge) and a deeper cornice under the roof
    // (the walls are 0.4 thick and centred on the line, so a ledge starts 0.2 out)
    for (const [y, h, d0, col] of [[FH, 0.3, 0.2, pale], [2 * FH, 0.55, 0.42, stone]]) {
      const d = d0 + 0.2;
      boxTo(G.conc, x0 - d, x1 + d, y - h / 2, y + h / 2, zS, zS + d, col);
      boxTo(G.conc, x0 - d, x1 + d, y - h / 2, y + h / 2, zN - d, zN, col);
      boxTo(G.conc, x0 - d, x0, y - h / 2, y + h / 2, zN, zS, col);
      boxTo(G.conc, x1, x1 + d, y - h / 2, y + h / 2, zN, zS, col);
    }
    // a dark band under the cornice: the shadow it throws
    boxTo(G.conc, x0, x1, 2 * FH - 0.95, 2 * FH - 0.6, zS + 0.21, zS + 0.21, dark, { faces: "pz" });
    // the canopies: the same gaps the barriers close
    const gaps = [];
    let s = -1;
    for (let c = 0; c <= C; c++) {
      const open = c < C && 0 === eH(0, P.buildingRows, c);
      open && s < 0 && (s = c);
      if (!open && s >= 0) (gaps.push([s, c]), (s = -1));
    }
    const tints = ["#a8433c", "#2f7f86", "#59636d"];
    gaps.forEach(([a, b], i) => {
      const xa = ex(a) - 1.4,
        xb = ex(b) + 1.4;
      boxTo(G.conc, xa, xb, 3.42, 3.62, zS, zS + 3.4, stone);
      // the fascia in the entrance's colour, and two struts back to the wall
      boxTo(PG.matte, xa, xb, 3.62, 4.05, zS + 3.3, zS + 3.4, colOf(tints[i % tints.length], 1));
      for (const x of [xa + 0.6, xb - 0.6]) boxTo(PG.metal, x - 0.06, x + 0.06, 3.0, 3.42, zS + 0.05, zS + 2.6, dark, { faces: "nx px py" });
    });
    // the sign over the middle entrance, just proud of the wall
    const mid = gaps[Math.floor(gaps.length / 2)] || [C / 2 - 2, C / 2 + 2],
      sb = signBoard(),
      m = new T.Mesh(new T.PlaneGeometry(13.2, 3.3), sb.mat);
    m.position.set((ex(mid[0]) + ex(mid[1])) / 2, 6.15, zS + 0.24);
    m.userData.noMerge = !0;
    m.userData.lv = 1;
    FRONT.push(m);
  }
  const FRONT = [];

  function buildDecals() {
    const g = new Geo();
    let k = 0;
    const R2 = (() => {
      let s = 991;
      return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    })();
    for (let n = 0; n < 3; n++) for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const z = zoneAt(n, c, r);
      if (" " === z || "0" === z || "9" === z || "x" === z) continue;
      const q = R2();
      if (q > ("o" === z || "e" === z ? 0.32 : 0.14)) continue;
      const tile = Math.floor(R2() * 4),
        size = 1.1 + R2() * 1.7,
        px = cx(c) + (R2() - 0.5) * 1.6,
        pz = cz(r) + (R2() - 0.5) * 1.6,
        y = baseOf(n) + 0.02 + (n ? 0.005 : 0),
        ang = R2() * 6.283,
        u0 = (tile % 2) * 0.5,
        v0 = (tile >> 1) * 0.5,
        s = size / 2,
        cs = Math.cos(ang) * s,
        sn = Math.sin(ang) * s,
        pt = (dx, dz) => [px + dx * cs - dz * sn, y, pz + dx * sn + dz * cs],
        a = 0.7 + R2() * 0.3;
      g.quad(pt(-1, 1), pt(1, 1), pt(1, -1), pt(-1, -1), [0, 1, 0], [[u0, v0 + 0.5], [u0 + 0.5, v0 + 0.5], [u0 + 0.5, v0], [u0, v0]], [a, a, a]);
      k++;
    }
    return g.mesh(MT.decal);
  }
  function buildBeams() {
    const out = [];
    const g = new Geo();
    // the atrium is open to the sky: a few slanted shafts of daylight reach the floor
    const x0 = ex(20),
      x1 = ex(28),
      zA = ez(14),
      zB = ez(22);
    for (let i = 0; i < 5; i++) {
      const bx = x0 + ((x1 - x0) * (i + 0.5)) / 5 + (hash(i, 2, 9) - 0.5) * 2,
        bz = zA + (zB - zA) * (0.2 + 0.6 * hash(i, 5, 3)),
        w = 1.4 + hash(i, 1, 1) * 1.6,
        sh = 5 + hash(i, 4, 2) * 2,
        top = 3 * FH - 0.3;
      g.quad([bx - w / 2 + sh, top, bz], [bx + w / 2 + sh, top, bz], [bx + w / 2, 0.05, bz], [bx - w / 2, 0.05, bz], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]], [1, 1, 1]);
      g.quad([bx + sh, top, bz - w / 2], [bx + sh, top, bz + w / 2], [bx, 0.05, bz + w / 2], [bx, 0.05, bz - w / 2], [1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], [1, 1, 1]);
    }
    out.push(...g.mesh(MT.beam));
    return out;
  }

  // ── building everything ──
  const S = { key: null, lights: [], tick: [], meshes: [], chunks: [], buy: null };
  window.HOSPITAL = S;
  const KEEP = (o) => (S.meshes.push(o), "undefined" != typeof _mapMeshes && _mapMeshes.push(o), scene.add(o), o);
  const MESHOF = {};
  function clear() {
    for (const l of S.lights) {
      l.target && l.target.removeFromParent();
      l.removeFromParent();
      l.dispose && l.dispose();
    }
    S.key = null;
    S.lights = [];
    S.tick = [];
    S.meshes = [];
    S.chunks = [];
  }
  function build() {
    clear();
    useTier(tierNow());
    S.key = "hospital";
    colliders.length = 0;
    for (const k in G) G[k] = new Geo();
    for (const k in PG) PG[k] = new Geo();
    tubes.steady = [new Geo(), new Geo(), new Geo(), new Geo()];
    tubes.flick = new Geo();
    tubes.dying = new Geo();
    DATA.walls.length = 0;
    buildWalls();
    buildLow();
    buildLintels();
    buildSlabs();
    buildStairs();
    buildProps();
    buildLights();
    FRONT.length = 0;
    buildFacade();
    // meshes: one per chunk
    const add = (g, mat, key) => {
      const ms = g.mesh(mat);
      for (const m of ms) {
        m.castShadow = m.receiveShadow = !1;
        KEEP(m);
        S.chunks.push(m);
      }
      ms.length && key && (MESHOF[key] = ms[0]);
      return ms;
    };
    add(G.wall, MT.wall, "wall");
    add(G.ext, MT.ext, "ext");
    add(G.floor, MT.floor, "floor");
    add(G.ceil, MT.ceil, "ceil");
    add(G.conc, MT.conc, "conc");
    add(G.fence, MT.fence, "fence");
    for (const k of ["matte", "metal", "gloss", "glow"]) add(PG[k], MT[k], "p" + k);
    tubes.steady.forEach((g, i) => add(g, TUBE.steady[i]));
    add(tubes.flick, TUBE.flick);
    add(tubes.dying, TUBE.dying);
    for (const [text, x, y, z, ry] of P.signs) {
      const m = KEEP(signMesh(text, x, y, z, ry));
      m.userData.lv = Math.max(0, Math.min(2, Math.floor(y / FH)));
      S.chunks.push(m);
    }
    for (const m of FRONT) (KEEP(m), S.chunks.push(m));
    for (const m of buildDecals()) (KEEP(m), S.chunks.push(m));
    for (const m of buildBeams()) (KEEP(m), S.chunks.push(m));
    // colliders
    const meshFor = (k) => ("wall" === k || "pillar" === k ? MESHOF.wall : "slab" === k ? MESHOF.floor : "prop" === k ? MESHOF.pmatte : "fence" === k ? MESHOF.fence : MESHOF.conc);
    for (const c of colliders) {
      const o = { minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ, h: c.h, mesh: meshFor(c.kind) || MESHOF.conc, hp: 1 / 0, destructible: !1, temp: !1 };
      c.y0 && (o.y0 = c.y0);
      COLLIDERS.push(o);
    }
    // the ground-floor walls for what reads MAP.walls (the minimap, the bots' cover)
    for (const { l, a, b, kind } of runs(0, "H", [1])) DATA.walls.push({ x: (ex(a) + ex(b)) / 2, z: ez(l), w: ex(b) - ex(a) + 0.4, d: 0.4, h: FH });
    for (const { l, a, b, kind } of runs(0, "V", [1])) DATA.walls.push({ x: ex(l), z: (ez(a) + ez(b)) / 2, w: 0.4, d: ez(b) - ez(a) + 0.4, h: FH });
    CHASH.dirty = !0;
    chashBuild();
    try {
      relocateBlockedNodes(DATA);
      buildGrid();
      "function" == typeof rebuildNavGrid && rebuildNavGrid();
    } catch (e) {
      console.warn("hospital grid", e);
    }
    // a few real lights: cold daylight in the atrium, a colour in each big room
    const lamp = (color, int, dist, x, y, z) => {
      const l = new T.PointLight(color, int, dist, 1.6);
      l.position.set(x, y, z);
      S.lights.push(l);
      scene.add(l);
      return l;
    };
    // every light is paid for on every pixel of every standard material: four on the default setting, fewer
    // on the weak ones, up to nine on the strongest (the ER, the dock, the ICU and the two wards come last)
    const LAMPS = [
      [0xcfe3ff, 2.6, 46, 0, 8, ez(18)],
      [0x9ad8d2, 1.6, 28, P.sites[0].x, 3, P.sites[0].z],
      [0xffd9a0, 1.6, 28, P.sites[1].x, 3, P.sites[1].z],
      [0xffd9b0, 1.5, 34, 0, 3, cz(29)],
      [0xffb8a8, 1.3, 26, nodes.er.x, 3, nodes.er.z],
      [0xbcd0ff, 1.3, 26, nodes.dock.x, 3, nodes.dock.z],
      [0xaec4ff, 1.4, 26, nodes.icuF.x, 3, nodes.icuF.z],
      [0xd8f0d0, 1.2, 24, nodes.wardW.x, 7, nodes.wardW.z],
      [0xd8f0d0, 1.2, 24, nodes.wardE.x, 7, nodes.wardE.z],
    ];
    const want = "undefined" == typeof GFX ? 4 : GFX.lamps >= 20 ? 9 : GFX.lamps >= 12 ? 7 : GFX.lamps >= 4 ? 4 : GFX.lamps > 0 ? 3 : 2;
    for (const l of LAMPS.slice(0, want)) lamp(...l);
    // the tubes that flicker, the dying ones stay dim
    // while you stand in a roofed room on the ground floor the third floor cannot be seen, and the other
    // way round: those chunks are not drawn (never near the atrium, the stairs, the decks or outside)
    const open = "tba09xs ";
    let lastHide = -1;
    S.tick.push(() => {
      const cp = camera.position,
        c = Math.floor((cp.x - OX) / CELL),
        r = Math.floor((cp.z - OZ) / CELL),
        lvC = Math.max(0, Math.min(2, Math.floor((cp.y - 0.3) / FH)));
      let hide = -1;
      if (0 === lvC || 2 === lvC) {
        const z = zoneAt(lvC, c, r),
          nearAtrium = c >= 13 && c <= 34 && r >= 7 && r <= 28;
        " " !== z && !open.includes(z) && !nearAtrium && (hide = 2 - lvC);
      }
      if (hide !== lastHide) {
        lastHide = hide;
        for (const m of S.chunks) m.visible = m.userData.lv !== hide;
      }
    });
    const tubeOn = new T.Color(0xe8f2ff);
    S.tick.push((dt, t) => {
      const q = Math.sin(t * 29) * Math.sin(t * 7.3) > 0.15 ? 1 : 0.18;
      TUBE.flick.color.copy(tubeOn).multiplyScalar(0.3 + 0.7 * q);
    });
  }

  // ── barriers: the three entrances stay closed while buying ──
  const BAR = { list: null, mat: null };
  function barriersUp() {
    BAR.mat = BAR.mat || new T.MeshBasicMaterial({ color: 0x5eead4, transparent: !0, opacity: 0.25, depthWrite: !1, side: T.DoubleSide });
    const gaps = [];
    const r = 32;
    let s = -1;
    for (let c = 0; c <= C; c++) {
      const open = c < C && 0 === eH(0, r, c);
      open && s < 0 && (s = c);
      if (!open && s >= 0) {
        gaps.push([s, c]);
        s = -1;
      }
    }
    BAR.list = gaps.map(([a, b]) => addBox((ex(a) + ex(b)) / 2, ez(r), ex(b) - ex(a) - 0.4, 0.6, 6, BAR.mat, { temp: !0 }));
    try {
      buildGrid();
    } catch (e) {}
  }
  function barriersDown() {
    (BAR.list || []).forEach((c) => COLLIDERS.includes(c) && destroyCollider(c));
    BAR.list = null;
    try {
      buildGrid();
    } catch (e) {}
  }
  S.barriers = BAR;
  setInterval(() => {
    try {
      const want = "hospital" === CUR_MAP_KEY && "buy" === world.phase && world.actors && world.actors.length > 0;
      const live = BAR.list && BAR.list.every((c) => COLLIDERS.includes(c));
      want && !live ? (BAR.list && barriersDown(), barriersUp()) : !want && BAR.list && barriersDown();
    } catch (e) {}
  }, 100);

  // ── registration (the pool, the lists) ──
  const reg = (data, at) => {
    (window.MAP_EXTRA = window.MAP_EXTRA || []).push({ key: data.key, name: data.name });
    if (window.POGU && POGU.pool) {
      POGU.pool.includes(data.key) || POGU.pool.splice(Math.min(POGU.pool.length, at), 0, data.key);
      POGU.setPool();
    } else MAP_LIST.some((m) => m.key === data.key) || MAP_LIST.push({ key: data.key, name: data.name });
  };
  reg(DATA, 12);

  // ── the horizon ──
  // the engine rings every map with 26 same-sized pyramids; here a tree line of dark pines instead
  const _sd = skyDome;
  skyDome = function () {
    const n = scene.children.length,
      r = _sd.apply(this, arguments);
    if ("hospital" !== CUR_MAP_KEY) return r;
    for (let i = scene.children.length - 1; i >= n; i--) {
      const o = scene.children[i];
      if (o.isMesh && o.geometry && "ConeGeometry" === o.geometry.type) {
        scene.remove(o);
        o.geometry.dispose();
        o.material.dispose();
      }
    }
    // two rows of pines, the far row taller: wide and lumpy so they read as a forest, not spikes
    const pos = [],
      mid = new T.Vector3(0, 0, 10);
    for (const [trees, rad, h0, hv, k] of [[110, 138, 9, 11, 1], [90, 152, 14, 14, 2]]) {
      for (let i = 0; i < trees; i++) {
        const a0 = (i / trees) * Math.PI * 2,
          a1 = ((i + 1.9) / trees) * Math.PI * 2,
          h = h0 + hv * hash(i, 3, 9 + k),
          rr = rad + (hash(i, 8, 2 + k) - 0.5) * 14,
          p = (a, y, d) => [mid.x + Math.cos(a) * (rr + d), y, mid.z + Math.sin(a) * (rr + d)];
        // three stacked boughs per tree
        for (let b = 0; b < 3; b++) {
          const y0 = -8 + b * (h * 0.3),
            wid = 1 - b * 0.28,
            am = (a0 + a1) / 2,
            ha = (a1 - a0) / 2 * wid,
            top = -8 + h * (0.55 + b * 0.22);
          pos.push(...p(am - ha, y0, 0), ...p(am + ha, y0, 0), ...p(am, top, 0));
        }
      }
    }
    // dark forest floor out to the pines, so the edge of the map is land and not a void
    const gnd = new T.Mesh(new T.CircleGeometry(160, 48), new T.MeshBasicMaterial({ color: new T.Color(MOODS.hospital.fog).multiplyScalar(0.42), fog: !1 }));
    gnd.rotation.x = -Math.PI / 2;
    gnd.position.set(0, -0.05, 10);
    gnd.userData.noMerge = !0;
    scene.add(gnd);
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    const col = new T.Color(MOODS.hospital.fog).lerp(new T.Color(MOODS.hospital.top), 0.45).multiplyScalar(0.55);
    const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: col, fog: !1, side: T.DoubleSide }));
    m.userData.noMerge = !0;
    scene.add(m);
    return r;
  };

  // ── in the frame ──
  const on = () => !!S.key && "hospital" === CUR_MAP_KEY;
  const _ns = netStep;
  netStep = function (dt) {
    const r = _ns.apply(this, arguments);
    if (!on()) return r;
    const t = performance.now() / 1e3;
    for (const f of S.tick) f(dt || 0.016, t);
    return r;
  };
  const _lm = loadMap;
  loadMap = function (key) {
    "hospital" === key && (DATA.walls.length = 0);
    const r = _lm.apply(this, arguments);
    try {
      "hospital" === key && !1 !== r ? build() : (clear(), BANKS.forEach((b, i) => b && (disposeBank(b), (BANKS[i] = null))));
    } catch (e) {
      console.warn("hospital", e);
    }
    return r;
  };
  window.HOSPITAL_API = { data: DATA, build, clear, colliders, zoneAt, plan: P };
})();

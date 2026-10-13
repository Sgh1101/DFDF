
(() => {
  // Real materials. The maps used to be painted with patterns drawn in code;
  // now their floors, walls and cover wear photographed surfaces (ambientCG
  // and Poly Haven, both CC0): a colour map, a normal map for the relief and
  // one map for ambient occlusion and roughness (and metalness where it is
  // metal), laid on in metres in world space, so bricks stay brick-sized on a
  // wall of any length and line up from one wall to the next. Each map keeps
  // its palette: the photo is tinted to the average colour of the pattern it
  // replaces. The light comes from photographed skies (HDRI) instead of a
  // painted gradient, turned so their sun stands where the game's sun is; the
  // night maps get their neon or lanterns painted into that sky so wet floors
  // still reflect them. Phones load half-size textures; the lowest graphics
  // preset keeps the old look; anything that fails to load leaves it too.
  if ("undefined" == typeof THEMES || "undefined" == typeof T || "undefined" == typeof scene || "undefined" == typeof renderer) return;
  const BASE = "assets/";
  const SETS = {"snow":{"tile":3.2,"ns":1,"metal":false,"rough":0.4266,"avg":[0.2135,0.221,0.2287],"size":1024},"sand":{"tile":3.2,"ns":1,"metal":false,"rough":0.4266,"avg":[0.2467,0.2162,0.1789],"size":1024},"stoneblock":{"tile":2.2,"ns":1.1,"metal":false,"rough":0.7314,"avg":[0.2278,0.2204,0.1933],"size":1024},"concrete":{"tile":4,"ns":1,"metal":false,"rough":0.5289,"avg":[0.2188,0.2199,0.2241],"size":1024},"container":{"tile":2.6,"ns":1,"metal":true,"rough":0.5903,"avg":[0.2354,0.2165,0.2089],"size":1024},"asphalt":{"tile":3,"ns":0.9,"metal":false,"rough":0.1439,"avg":[0.217,0.2204,0.2244],"size":1024},"deckplate":{"tile":1.4,"ns":1,"metal":true,"rough":0.2958,"avg":[0.2132,0.2216,0.2244],"size":512},"glasswall":{"tile":2.4,"ns":0.6,"metal":false,"rough":0.5567,"avg":[0.1613,0.1622,0.1665],"size":512},"plaster":{"tile":3,"ns":0.7,"metal":false,"rough":0.0889,"avg":[0.2145,0.2208,0.2282],"size":512},"planks":{"tile":2,"ns":1,"metal":false,"rough":0.6038,"avg":[0.2827,0.2086,0.148],"size":512},"paving":{"tile":2.4,"ns":1,"metal":false,"rough":0.4734,"avg":[0.2297,0.217,0.2214],"size":512},"siding":{"tile":2.4,"ns":1,"metal":false,"rough":0.6637,"avg":[0.3169,0.1982,0.1506],"size":512},"brick":{"tile":1.3,"ns":1.1,"metal":false,"rough":0.6661,"avg":[0.2559,0.2118,0.1959],"size":512},"rust":{"tile":2,"ns":1,"metal":true,"rough":0.6925,"avg":[0.2464,0.2135,0.2072],"size":512},"ruin":{"tile":1.6,"ns":1,"metal":false,"rough":0.838,"avg":[0.269,0.2099,0.1762],"size":512},"gravel":{"tile":2.6,"ns":1,"metal":false,"rough":0.8772,"avg":[0.2531,0.2145,0.1773],"size":1024},"basalt":{"tile":3,"ns":1,"metal":false,"rough":0.888,"avg":[0.2753,0.2092,0.1646],"size":1024},"groundmoss":{"tile":3.4,"ns":1,"metal":false,"rough":0.9039,"avg":[0.2475,0.2187,0.1522],"size":1024}};
  const ENVS = {"alpine":{"sunU":0.5996,"sunV":0.6992,"mean":0.6072},"park":{"sunU":0.5993,"sunV":0.5605,"mean":0.7556},"city":{"sunU":0.3575,"sunV":0.6383,"mean":0.5583},"dawn":{"sunU":0.6328,"sunV":0.5238,"mean":0.8391},"forest":{"sunU":0.6104,"sunV":0.7227,"mean":0.4887},"warehouse":{"sunU":0.6611,"sunV":0.7569,"mean":0.7746},"studio":{"sunU":0.2258,"sunV":0.7352,"mean":2.2192}};
  // what each theme wears and which sky lights it
  // what each theme wears (a set, or [set, metres per tile]) and which
  // photographed sky lights it; the night maps keep their painted sky, made
  // for the neon and the lanterns their wet floors reflect
  const BY_THEME = {
    glacier: { floor: "snow", wall: "concrete", crate: ["concrete", 2.6], env: "alpine", sat: 0.35 },
    dunes: { floor: "sand", wall: "stoneblock", crate: "planks", env: "dawn", sat: 0.7 },
    freighter: { floor: ["deckplate", 2.2], wall: "container", crate: "rust", env: "city", sat: 0.6 },
    neon: { floor: "asphalt", wall: "glasswall", crate: ["deckplate", 2.2], env: null },
    garden: { floor: "gravel", wall: "plaster", crate: "planks", env: "dawn", sat: 0.7 },
    market: { floor: "paving", wall: "siding", crate: "planks", env: null },
    temple: { floor: ["concrete", 6], wall: "ruin", crate: "planks", env: "forest", sat: 0.5 },
    harbor: { floor: "concrete", wall: "brick", crate: "container", env: "park", sat: 0.55 },
    forge: { floor: "basalt", wall: ["ruin", 1.9], crate: "rust", env: "warehouse", sat: 0.45 },
    jungle: { floor: "groundmoss", wall: "stoneblock", crate: "planks", env: "forest", sat: 0.75 },
  };
  const ROLES = ["floor", "wall", "crate"];
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const coarse = (() => {
    try {
      return matchMedia("(pointer: coarse)").matches && !matchMedia("(pointer: fine)").matches;
    } catch (e) {
      return !1;
    }
  })();
  const quality = () => ("undefined" != typeof SETTINGS && SETTINGS.quality) || "balance";
  const allowed = () => !window.RM_OFF && !("file:" === location.protocol && !window.RM_FILE) && "min" !== quality();
  const texSize = () => (window.IS_MOBILE || coarse || ("undefined" != typeof IS_TOUCH && IS_TOUCH) || "perf" === quality() ? 512 : 1024);
  const ST = { theme: "", applied: "", tok: 0, envTok: 0, env: "", loads: 0, fails: 0, last: null };

  // ── textures ──
  const TEX = new Map();
  function loadImg(url) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => res(im);
      im.onerror = () => rej(new Error("load " + url));
      im.src = url;
    });
  }
  function texOf(set, kind, size, tile) {
    tile = tile || SETS[set].tile;
    const key = set + "|" + kind + "|" + size + "|" + tile;
    if (TEX.has(key)) return TEX.get(key);
    const S = SETS[set];
    const p = loadImg(BASE + "mat/" + set + "_" + kind + ".webp").then((im) => {
      let src = im;
      if (im.width > size) {
        const c = document.createElement("canvas");
        c.width = c.height = size;
        c.getContext("2d").drawImage(im, 0, 0, size, size);
        src = c;
      }
      const t = src === im ? new T.Texture(im) : new T.CanvasTexture(src);
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.colorSpace = "c" === kind ? T.SRGBColorSpace : T.NoColorSpace;
      t.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy() || 1, size > 512 ? 8 : 4);
      t.repeat.set(1 / tile, 1 / tile);
      t.needsUpdate = !0;
      ST.loads++;
      return t;
    });
    p.catch(() => {
      TEX.delete(key);
      ST.fails++;
    });
    TEX.set(key, p);
    return p;
  }
  const setTex = (set, size, tile) => Promise.all(["c", "n", "o"].map((k) => texOf(set, k, size, tile))).then(([c, n, o]) => ({ c, n, o }));
  // keep the textures of the last two themes, let the rest go
  const keepSets = [];
  function retire(sets) {
    keepSets.unshift(sets.join(","));
    keepSets.length = Math.min(keepSets.length, 2);
    const keep = new Set(keepSets.join(",").split(","));
    for (const [key, p] of TEX) {
      if (keep.has(key.split("|")[0])) continue;
      TEX.delete(key);
      p.then((t) => t.dispose()).catch(() => {});
    }
  }

  // ── the colour a material used to show, in linear light ──
  function avgOf(tex) {
    if (tex.userData.rmAvg) return tex.userData.rmAvg;
    let a = [0.5, 0.5, 0.5];
    try {
      const img = tex.image;
      const w = img.width,
        h = img.height,
        c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, w, h).data,
        srgb = tex.colorSpace === T.SRGBColorSpace,
        dec = (v) => (srgb ? (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)) : v);
      const s = [0, 0, 0];
      let n = 0;
      for (let i = 0; i < d.length; i += 16) {
        s[0] += dec(d[i] / 255);
        s[1] += dec(d[i + 1] / 255);
        s[2] += dec(d[i + 2] / 255);
        n++;
      }
      a = s.map((v) => v / n);
    } catch (e) {}
    return (tex.userData.rmAvg = a);
  }
  function target(o) {
    const c = o.color;
    if (o.map && o.map.image) {
      const a = avgOf(o.map);
      return [a[0] * c.r, a[1] * c.g, a[2] * c.b];
    }
    return [c.r, c.g, c.b];
  }

  // ── a material wears a set ──
  const LIVE = new Set();
  function patch(mat, set, tx) {
    const o =
      mat.userData.rmOrig ||
      (mat.userData.rmOrig = { map: mat.map, normalMap: mat.normalMap, roughnessMap: mat.roughnessMap, aoMap: mat.aoMap, metalnessMap: mat.metalnessMap, color: mat.color.clone(), roughness: mat.roughness, metalness: mat.metalness, ns: mat.normalScale.clone(), ao: mat.aoMapIntensity });
    const S = SETS[set],
      t = target(o);
    mat.color.setRGB(clamp(t[0] / Math.max(0.004, S.avg[0]), 0.05, 6), clamp(t[1] / Math.max(0.004, S.avg[1]), 0.05, 6), clamp(t[2] / Math.max(0.004, S.avg[2]), 0.05, 6));
    mat.map = tx.c;
    mat.normalMap = tx.n;
    mat.normalScale.set(S.ns, S.ns);
    mat.roughnessMap = tx.o;
    mat.aoMap = tx.o;
    mat.aoMapIntensity = 0.9;
    mat.metalnessMap = S.metal ? tx.o : null;
    mat.roughness = Math.min(4, o.roughness / Math.max(0.05, S.rough));
    mat.userData.rmSet = set;
    mat.needsUpdate = !0;
    LIVE.add(mat);
  }
  function unpatch(mat) {
    const o = mat.userData.rmOrig;
    if (!o) return;
    mat.map = o.map;
    mat.normalMap = o.normalMap;
    mat.roughnessMap = o.roughnessMap;
    mat.aoMap = o.aoMap;
    mat.metalnessMap = o.metalnessMap;
    mat.color.copy(o.color);
    mat.roughness = o.roughness;
    mat.metalness = o.metalness;
    mat.normalScale.copy(o.ns);
    mat.aoMapIntensity = o.ao;
    delete mat.userData.rmSet;
    mat.needsUpdate = !0;
    LIVE.delete(mat);
  }

  // ── world-space uv in metres, one projection per triangle ──
  const _p = [new T.Vector3(), new T.Vector3(), new T.Vector3()],
    _a = new T.Vector3(),
    _b = new T.Vector3();
  function worldUV(mesh, users) {
    let g = mesh.geometry;
    if (!g || !g.attributes.position || mesh.isInstancedMesh || mesh.isSkinnedMesh) return 0;
    if (g.userData.rmFor === mesh.id) return 0;
    if (g.index || void 0 !== g.userData.rmFor || (users && users.get(g) > 1)) {
      const ng = g.index ? g.toNonIndexed() : g.clone();
      users && 1 === users.get(g) && g.dispose();
      mesh.geometry = g = ng;
    }
    mesh.updateMatrixWorld(!0);
    const pos = g.attributes.position,
      n = pos.count - (pos.count % 3),
      uv = new Float32Array(pos.count * 2),
      m = mesh.matrixWorld;
    for (let i = 0; i < n; i += 3) {
      for (let k = 0; k < 3; k++) _p[k].fromBufferAttribute(pos, i + k).applyMatrix4(m);
      _a.subVectors(_p[1], _p[0]).cross(_b.subVectors(_p[2], _p[0]));
      const ax = Math.abs(_a.x),
        ay = Math.abs(_a.y),
        az = Math.abs(_a.z);
      for (let k = 0; k < 3; k++) {
        const p = _p[k];
        let u, v;
        if (ay >= ax && ay >= az) (u = p.x), (v = _a.y > 0 ? -p.z : p.z);
        else if (ax >= az) (u = _a.x > 0 ? -p.z : p.z), (v = p.y);
        else (u = _a.z > 0 ? p.x : -p.x), (v = p.y);
        uv[2 * (i + k)] = u;
        uv[2 * (i + k) + 1] = v;
      }
    }
    g.setAttribute("uv", new T.BufferAttribute(uv, 2));
    g.userData.rmFor = mesh.id;
    return 1;
  }
  function uvPass() {
    const users = new Map(),
      list = [];
    scene.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      users.set(o.geometry, (users.get(o.geometry) || 0) + 1);
      !Array.isArray(o.material) && LIVE.has(o.material) && list.push(o);
    });
    let n = 0;
    for (const o of list) n += worldUV(o, users);
    return n;
  }

  // ── a theme ──
  function apply(key) {
    const cfg = BY_THEME[key],
      th = THEMES[key];
    if (!cfg || !th) return;
    if (!allowed()) return revertAll();
    const size = texSize(),
      tok = ++ST.tok,
      roles = ROLES.map((r) => (Array.isArray(cfg[r]) ? cfg[r] : [cfg[r], 0])),
      sets = roles.map((x) => x[0]);
    ST.theme = key;
    retire(sets);
    Promise.all(roles.map(([s, tile]) => setTex(s, size, tile)))
      .then((tx) => {
        if (tok !== ST.tok || THEME.key !== key || !allowed()) return;
        for (const m of [...LIVE]) ROLES.some((r) => th[r] === m) || unpatch(m);
        ROLES.forEach((r, i) => th[r] && patch(th[r], sets[i], tx[i]));
        const n = uvPass();
        ST.applied = key;
        ST.last = { key, size, meshes: n };
        try {
          "function" == typeof applyEnvIntensity && applyEnvIntensity();
        } catch (e) {}
      })
      .catch(() => {});
  }
  function revertAll() {
    ST.tok++;
    for (const m of [...LIVE]) unpatch(m);
    ST.applied = "";
  }
  const _lm = loadMap;
  loadMap = function () {
    const r = _lm.apply(this, arguments);
    try {
      r && apply(THEME.key);
    } catch (e) {}
    return r;
  };
  // a box added later in a material that already wears a set
  const _ab = addBox;
  addBox = function (x, z, w, d, h, mat) {
    const r = _ab.apply(this, arguments);
    try {
      r && r.mesh && LIVE.has(mat) && worldUV(r.mesh);
    } catch (e) {}
    return r;
  };

  // ── the sky ──
  const HDR = new Map();
  function getBuf(url) {
    return new Promise((res, rej) => {
      const x = new XMLHttpRequest();
      x.open("GET", url);
      x.responseType = "arraybuffer";
      x.onload = () => (x.status && 200 !== x.status ? rej(new Error(x.status)) : x.response ? res(x.response) : rej(new Error("empty")));
      x.onerror = () => rej(new Error("net"));
      x.send();
    });
  }
  function parseHDR(buf) {
    const b = new Uint8Array(buf);
    let i = 0;
    const line = () => {
      let s = "";
      while (i < b.length && 10 !== b[i]) s += String.fromCharCode(b[i++]);
      i++;
      return s;
    };
    while (line().length && i < b.length);
    const m = /-Y (\d+) \+X (\d+)/.exec(line());
    if (!m) throw new Error("hdr");
    const H = +m[1],
      W = +m[2],
      row = new Uint8Array(4 * W),
      data = new Float32Array(W * H * 3);
    for (let y = 0; y < H; y++) {
      if (2 === b[i] && 2 === b[i + 1] && ((b[i + 2] << 8) | b[i + 3]) === W) {
        i += 4;
        for (let c = 0; c < 4; c++) {
          let x = 0;
          while (x < W) {
            let n = b[i++];
            if (n > 128) {
              n -= 128;
              const v = b[i++];
              while (n--) row[4 * x++ + c] = v;
            } else while (n--) row[4 * x++ + c] = b[i++];
          }
        }
      } else row.set(b.subarray(i, i + 4 * W)), (i += 4 * W);
      const o = (H - 1 - y) * W * 3;
      for (let x = 0; x < W; x++) {
        const e = row[4 * x + 3];
        if (!e) continue;
        const f = Math.pow(2, e - 136);
        data[o + 3 * x] = row[4 * x] * f;
        data[o + 3 * x + 1] = row[4 * x + 1] * f;
        data[o + 3 * x + 2] = row[4 * x + 2] * f;
      }
    }
    return { w: W, h: H, data };
  }
  function hdrOf(name) {
    if (HDR.has(name)) return HDR.get(name);
    const p = getBuf(BASE + "env/" + name + ".hdr").then(parseHDR);
    p.catch(() => {
      HDR.delete(name);
      ST.fails++;
    });
    HDR.set(name, p);
    return p;
  }
  // the colour the painted sky averaged (linear), over the sphere: a band in
  // y is a band of equal area, so the gradient's stops weigh by their height
  function paintedMean(m) {
    const C = (v) => new T.Color(v),
      top = C(m.top),
      mid = C(m.mid),
      hor = C(m.hor),
      gnd = C(m.hemiGnd).multiplyScalar(0.7),
      sun = C(m.sun).multiplyScalar(m.stars ? 3 : 12),
      acc = [0, 0, 0],
      add = (c, w) => ((acc[0] += c.r * w), (acc[1] += c.g * w), (acc[2] += c.b * w));
    add(gnd, 0.88);
    add(hor.clone().lerp(gnd, 0.5), 0.12);
    add(hor.clone().lerp(mid, 0.5), 0.35);
    add(mid.clone().lerp(top, 0.5), 0.65);
    add(sun, 0.0116);
    return acc.map((v) => v / 2);
  }
  // the photo, turned so its sun stands where the game's sun is, its colour
  // calmed, and matched channel by channel to the painted sky's average so
  // the map keeps its mood and its brightness
  function skyFrom(src, cfg, meta, mood) {
    const { w, h } = src,
      d = new Float32Array(src.data.length),
      so = "undefined" != typeof _SUN_OFF ? _SUN_OFF : { x: -55, y: 95, z: 45 },
      tu = Math.atan2(so.z, so.x) / (2 * Math.PI) + 0.5,
      shift = Math.round((((tu - meta.sunU) % 1) + 1) * w) % w,
      sat = null == cfg.sat ? 1 : cfg.sat,
      acc = [0, 0, 0];
    let wsum = 0;
    for (let y = 0; y < h; y++) {
      const cw = Math.cos(((y + 0.5) / h - 0.5) * Math.PI);
      wsum += cw * w;
      for (let x = 0; x < w; x++) {
        const s = 3 * (y * w + x),
          t = 3 * (y * w + ((x + shift) % w));
        const r = src.data[s],
          g = src.data[s + 1],
          b = src.data[s + 2],
          l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        d[t] = l + (r - l) * sat;
        d[t + 1] = l + (g - l) * sat;
        d[t + 2] = l + (b - l) * sat;
        acc[0] += d[t] * cw;
        acc[1] += d[t + 1] * cw;
        acc[2] += d[t + 2] * cw;
      }
    }
    const want = mood ? paintedMean(mood) : [0.3, 0.3, 0.3],
      k = acc.map((v, i) => clamp(want[i] / Math.max(1e-4, v / wsum), 0.01, 50));
    // half floats, RGBA
    const hf = new Uint16Array(w * h * 4),
      toHalf = T.DataUtils.toHalfFloat,
      one = toHalf(1);
    for (let j = 0, q = 0; j < d.length; j += 3, q += 4) {
      hf[q] = toHalf(Math.min(d[j] * k[0], 6e4));
      hf[q + 1] = toHalf(Math.min(d[j + 1] * k[1], 6e4));
      hf[q + 2] = toHalf(Math.min(d[j + 2] * k[2], 6e4));
      hf[q + 3] = one;
    }
    const tex = new T.DataTexture(hf, w, h, T.RGBAFormat, T.HalfFloatType);
    tex.mapping = T.EquirectangularReflectionMapping;
    tex.colorSpace = T.LinearSRGBColorSpace;
    tex.magFilter = tex.minFilter = T.LinearFilter;
    tex.generateMipmaps = !1;
    tex.needsUpdate = !0;
    return tex;
  }
  function useSky(key, mood, src) {
    const cfg = BY_THEME[key],
      tex = skyFrom(src, cfg, ENVS[cfg.env], mood);
    const pm = new T.PMREMGenerator(renderer),
      rt = pm.fromEquirectangular(tex);
    pm.dispose();
    tex.dispose();
    try {
      _envRT && _envRT.dispose();
    } catch (e) {}
    _envRT = rt;
    scene.environment = rt.texture;
    ENV_INT.v = (mood && mood.env) || 1;
    applyEnvIntensity();
    ST.env = key;
  }
  const _bem = buildEnvMap;
  buildEnvMap = function (mood) {
    const r = _bem.apply(this, arguments);
    try {
      const key = THEME.key,
        cfg = BY_THEME[key],
        tok = ++ST.envTok;
      ST.env = "";
      if (cfg && cfg.env && allowed())
        hdrOf(cfg.env)
          .then((src) => {
            tok === ST.envTok && THEME.key === key && allowed() && useSky(key, mood, src);
          })
          .catch(() => {});
    } catch (e) {}
    return r;
  };

  // the armoury turntable: a photographed studio, softboxes and all, instead
  // of a few coloured panels, so a skin shows how it takes the light
  let studioBusy = !1;
  setInterval(() => {
    try {
      const G = window.GUN_SKINS;
      if (studioBusy || !G || !G.isOpen() || !allowed()) return;
      const pv = G._pv && G._pv();
      if (!pv || !pv.r || !pv.sc || pv.rmStudio) return;
      studioBusy = !0;
      hdrOf("studio")
        .then((src) => {
          const tex = skyFrom(src, { sat: 0.9 }, ENVS.studio, { top: "#5b6472", mid: "#8a929e", hor: "#c9ced6", hemiGnd: 0x30343c, sun: 0xffffff, stars: !1 }),
            pm = new T.PMREMGenerator(pv.r),
            rt = pm.fromEquirectangular(tex);
          pm.dispose();
          tex.dispose();
          pv.sc.environment = rt.texture;
          pv.rmStudio = rt;
          ST.studio = !0;
          G._show && G._show();
        })
        .catch(() => {})
        .then(() => (studioBusy = !1));
    } catch (e) {
      studioBusy = !1;
    }
  }, 700);

  window.REALMAT = { sets: SETS, envs: ENVS, themes: BY_THEME, state: ST, live: LIVE, apply, revert: revertAll, uvPass, allowed, texSize, worldUV };
})();

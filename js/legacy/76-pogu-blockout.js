
(() => {
  // 포구 — the first map built from a level design (steps 1–2: three lanes, two
  // sites with two entrances each, 3–5 m chokes, timed routes), here as a
  // blockout: grey buildings, orange cover, blue stairs, violet upper floors,
  // floors tinted by kind of zone with their names on them. Two heavens are
  // real second floors: you can walk, shoot and see under them. Barriers close
  // both spawns while buying; a shutter in the B link opens and closes (F).
  // The map pool is cut to 7 · 5 · 3; the owner can bring maps back.
  if ("undefined" == typeof MAPS || "undefined" == typeof MAP_LIST || "undefined" == typeof THEMES || "undefined" == typeof MOODS) return;
  const DATA = {"key":"pogu","name":"포구","theme":"pogu","size":5,"blockout":1,"bounds":{"minX":-74,"maxX":74,"minZ":-80,"maxZ":80},"attackSpawn":{"x":0,"z":72},"defendSpawn":{"x":0,"z":-73},"sites":[{"id":"A","x":-54,"z":-49,"r":9},{"id":"B","x":57,"z":-44,"r":9}],"nodes":{"aSite":{"x":-54,"z":-49},"aFront":{"x":-65,"z":-22},"aBack":{"x":-53,"z":-70},"aLink":{"x":-30,"z":-40},"bSite":{"x":57,"z":-44},"bFront":{"x":64,"z":-22},"bBack":{"x":60,"z":-76},"bLink":{"x":34,"z":-30},"midL":{"x":-22,"z":-4},"midR":{"x":18,"z":-12},"mid":{"x":0,"z":0},"rotate":{"x":0,"z":-76}},"walls":[],"bo":{"walls":[[-6,6,-48,-40,3.0,"raised"],[-6,0,-52,-48,3.0,"raised"],[55,72,-72,-68,4.4,"raised"],[-62,-56,-80,-72,4.4,"raised"],[-74,-62,-80,-64,8.0,"wall"],[72,74,-80,80,8.0,"wall"],[-48,-14,-72,-64,8.0,"wall"],[14,48,-72,-68,8.0,"wall"],[54,55,-72,-68,8.0,"wall"],[14,42,-68,-56,8.0,"wall"],[-74,-72,-64,80,8.0,"wall"],[-36,-6,-64,-56,8.0,"wall"],[0,14,-64,-56,8.0,"wall"],[-36,-34,-56,-52,8.0,"wall"],[-26,-6,-56,-40,8.0,"wall"],[12,30,-56,-40,8.0,"wall"],[38,42,-56,-52,8.0,"wall"],[-36,-34,-48,32,8.0,"wall"],[38,42,-47.5,4,8.0,"wall"],[-26,-8,-40,-20,8.0,"wall"],[14,30,-40,-16,8.0,"wall"],[-72,-70,-36,-28,8.0,"wall"],[-66,-36,-36,-28,8.0,"wall"],[42,62,-36,-28,8.0,"wall"],[66,72,-36,-28,8.0,"wall"],[-58,-36,-28,8,8.0,"wall"],[42,56,-28,4,8.0,"wall"],[-8,-6,-24,4,8.0,"wall"],[6,14,-24,-16,8.0,"wall"],[-18,-8,-20,4,8.0,"wall"],[-62,-58,-16,8,8.0,"wall"],[56,60,-16,4,8.0,"wall"],[-34,-26,-12,32,8.0,"wall"],[6,38,-8,24,8.0,"wall"],[38,40,4,24,8.0,"wall"],[-38,-36,8,32,8.0,"wall"],[-72,-62,12,80,8.0,"wall"],[-26,-6,12,24,8.0,"wall"],[56,72,12,80,8.0,"wall"],[-62,-56,16,80,8.0,"wall"],[-26,-14,24,32,8.0,"wall"],[14,40,32,40,8.0,"wall"],[50,56,32,80,8.0,"wall"],[-56,-50,40,80,8.0,"wall"],[-40,-14,40,64,8.0,"wall"],[22,40,40,64,8.0,"wall"],[-14,14,48,64,8.0,"wall"],[-50,-16,72,80,8.0,"wall"],[16,50,72,80,8.0,"wall"],[-75,75,-81,-80,8.0,"wall"],[-75,75,80,81,8.0,"wall"],[-75,-74,-80,80,8.0,"wall"],[74,75,-80,80,8.0,"wall"],[-66,-54,-60,-55,3.2,"cover"],[-50,-47,-46,-43,1.2,"cover"],[-50,-47,-43,-40,2.4,"cover"],[-44,-42,-52,-50,9,"landmark"],[-70,-64,-44,-41,2.6,"cover"],[-60,-54,-38,-37,1.0,"cover"],[-42,-39,-40,-37,1.6,"cover"],[54,60,-54,-48,12,"landmark"],[64,67,-44,-41,1.2,"cover"],[64,67,-47,-44,2.4,"cover"],[44,50,-60,-57,2.6,"cover"],[46,52,-40,-39,1.0,"cover"],[66,69,-64,-61,1.6,"cover"],[-5,5,32,38,2.8,"cover"],[-3,3,-1,0,1.0,"cover"],[4,8,-34,-30,1.6,"cover"],[-34,-30,-36,-32,2.4,"cover"],[30,33.7,-30,-26,2.6,"cover"],[33.3,38,-42,-38,2.6,"cover"],[-66,-63,-24,-21,1.4,"cover"],[66,69,-24,-21,1.4,"cover"],[-52,-44,24,26,1.0,"cover"],[-46,-42,14,18,1.4,"cover"],[-70,-66,0,4,2.4,"cover"],[44,52,16,19,2.6,"cover"],[44,47,19,22,1.3,"cover"],[64,68,-6,0,2.6,"cover"],[55,72,-68.3,-68,5.4,"parapet"],[-60.0,-59.2,-61.0,-60.2,4.0,"pillar"],[-48.8,-48.0,-61.0,-60.2,4.0,"pillar"],[-49.0,-48.0,-80,-77,0.49,"stair"],[-50.0,-49.0,-80,-77,0.98,"stair"],[-51.0,-50.0,-80,-77,1.47,"stair"],[-52.0,-51.0,-80,-77,1.96,"stair"],[-53.0,-52.0,-80,-77,2.44,"stair"],[-54.0,-53.0,-80,-77,2.93,"stair"],[-55.0,-54.0,-80,-77,3.42,"stair"],[-56.0,-55.0,-80,-77,3.91,"stair"],[-57.0,-56.0,-80,-77,4.4,"stair"],[47.0,47.89,-80,-77,0.49,"stair"],[47.89,48.78,-80,-77,0.98,"stair"],[48.78,49.67,-80,-77,1.47,"stair"],[49.67,50.56,-80,-77,1.96,"stair"],[50.56,51.44,-80,-77,2.44,"stair"],[51.44,52.33,-80,-77,2.93,"stair"],[52.33,53.22,-80,-77,3.42,"stair"],[53.22,54.11,-80,-77,3.91,"stair"],[54.11,55.0,-80,-77,4.4,"stair"],[5.0,6.0,-52,-48,0.5,"stair"],[4.0,5.0,-52,-48,1.0,"stair"],[3.0,4.0,-52,-48,1.5,"stair"],[2.0,3.0,-52,-48,2.0,"stair"],[1.0,2.0,-52,-48,2.5,"stair"],[0.0,1.0,-52,-48,3.0,"stair"],[-6,6,-40.4,-40,4.0,"parapet"],[-1,1,-40.4,-40,8.0,"wall"],[6,6.5,-48,-40,8.0,"wall"]],"slabs":[[-62,-46,-72,-60,4.0,4.4,"floor2"],[55,72,-80,-72,4.0,4.4,"floor2"],[-62,-46,-60.3,-60,4.4,5.4,"parapet"],[-6,6,-40.4,-40,5.6,8.0,"wall"]],"floors":[[-14,14,-80,-64,"#2f5f63"],[-48,-14,-80,-72,"#3d4b5e"],[-58,-48,-80,-64,"#3d4b5e"],[14,46,-80,-72,"#3d4b5e"],[46,72,-80,-72,"#3d4b5e"],[48,54,-72,-68,"#3d4b5e"],[-6,0,-64,-56,"#3d4b5e"],[-6,12,-56,-52,"#3d4b5e"],[6,12,-52,-40,"#3d4b5e"],[-8,14,-40,-24,"#5a6170"],[-72,-36,-64,-36,"#7a3a3a"],[42,72,-68,-36,"#7a3a3a"],[-70,-66,-36,-28,"#86762e"],[-72,-58,-28,-16,"#5c4673"],[-72,-62,-16,12,"#4b525d"],[-62,-56,8,16,"#4b525d"],[-56,-38,8,40,"#3f5e46"],[-38,-14,32,40,"#4b525d"],[-50,-40,36,72,"#4b525d"],[-50,-16,64,72,"#4b525d"],[-18,-6,4,12,"#4b525d"],[-26,-18,-20,12,"#4b525d"],[-34,-26,-56,-12,"#4b525d"],[-36,-34,-52,-48,"#86762e"],[-16,16,64,80,"#7a5a3a"],[14,22,40,64,"#4b525d"],[-14,14,24,48,"#5a6170"],[-6,6,-24,24,"#5a6170"],[6,30,-16,-8,"#4b525d"],[30,38,-56,-8,"#4b525d"],[38,42,-52,-48,"#86762e"],[62,66,-36,-28,"#86762e"],[56,72,-28,-16,"#5c4673"],[60,72,-16,12,"#4b525d"],[56,60,4,12,"#4b525d"],[40,56,4,32,"#3f5e46"],[14,40,24,32,"#4b525d"],[40,50,32,72,"#4b525d"],[16,50,64,72,"#4b525d"],[-62,-58,-72,-64,"#7a3a3a"],[0,6,-52,-48,"#405a73"]],"labels":[["수비 스폰 · 세관",0,-74,14,"#7ff3e6"],["A 수비 통로",-30,-76,12,"#ffffff"],["크레인 밑 (헤븐 아래)",-53,-78,10,"#ffffff"],["B 수비 통로",30,-76,12,"#ffffff"],["창고 1층",52,-74,11,"#ffffff"],["세관 통로",3,-54,11,"#ffffff"],["세관 2층 창",0,-44,11,"#e9d5ff"],["세관 마당",3,-28,13,"#ffffff"],["A 헤븐 · 크레인실",-54,-62,11,"#e9d5ff"],["B 헤븐 · 창고 2층",64,-78,11,"#e9d5ff"],["A 사이트",-54,-49,22,"#ffefe0"],["조선소 도크",-60,-41,11,"#ffffff"],["B 사이트",57,-42,22,"#ffefe0"],["등대 부두",50,-38,11,"#ffffff"],["선체 뒤",-69,-62,10,"#ffffff"],["등대",57,-51,10,"#ffffff"],["A 메인 문",-68,-31,10,"#ffe066"],["A 연결 문",-35,-55,10,"#ffe066"],["B 메인 문",64,-31,10,"#ffe066"],["B 연결 문",40,-55,10,"#ffe066"],["냉동창고 앞",-65,-22,11,"#ffb3a8"],["그물 골목",-67,-2,12,"#ffffff"],["(A 메인)",-67,2,10,"#ffffff"],["어판장",-47,28,13,"#ffffff"],["(A 로비)",-47,32,10,"#ffffff"],["어판장 골목",-26,36,11,"#ffffff"],["수로",-30,-34,12,"#ffffff"],["(A 연결)",-30,-30,10,"#ffffff"],["수로 꺾임",-22,-4,11,"#ffffff"],["수로 입구",-12,8,10,"#ffffff"],["운하 거리",0,-6,12,"#ffffff"],["(미드)",0,-2,10,"#ffffff"],["매표소",0,43,13,"#ffffff"],["(미드 하단)",0,46,10,"#ffffff"],["셔터 통로",18,-20,11,"#ffffff"],["(B 연결)",18,-3.5,10,"#ffffff"],["B 연결 골목",34,-17,10,"#ffb3a8"],["어구창고 앞",64,-22,11,"#ffb3a8"],["컨테이너 골목",66,-10,11,"#ffffff"],["(B 메인)",66,-6,10,"#ffffff"],["야적장",48,26,13,"#ffffff"],["(B 로비)",48,30,10,"#ffffff"],["야적장 골목",26,28,11,"#ffffff"],["서쪽 부두길",-45,54,11,"#ffffff"],["동쪽 부두길",45,54,11,"#ffffff"],["터미널 북문",18,52,10,"#ffffff"],["공격 스폰 · 여객 터미널",0,72,14,"#ffd0c8"],["터미널 서문",-33,68,11,"#ffffff"],["터미널 동문",33,68,11,"#ffffff"]],"barriers":[[14,16,63.6,64],[-16.4,-16,64,72],[16,16.4,64,72],[-6,0,-64,-63.6],[-14.4,-14,-80,-72],[14,14.4,-80,-72]],"door":{"x":18,"z":-12,"w":0.6,"d":8,"h":6,"sw":[[15.5,-9.5],[20.5,-14.5]]}}};
  const base = MAPS.harbor || MAPS.glacier;
  for (const k of ["sky", "fog", "sunColor", "sunInt", "ambient"]) base && null != base[k] && (DATA[k] = base[k]);
  MAPS.pogu = DATA;

  // ── the blockout look ──
  // every surface wears a 2 m grid (distances read at a glance); boxes of a
  // kind are merged into one mesh (a handful of draw calls for the whole map)
  function gridTex(base, line) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = line;
    g.lineWidth = 4;
    g.strokeRect(0, 0, 128, 128);
    g.lineWidth = 1.5;
    g.globalAlpha = 0.5;
    g.beginPath();
    g.moveTo(64, 0);
    g.lineTo(64, 128);
    g.moveTo(0, 64);
    g.lineTo(128, 64);
    g.stroke();
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 2;
    return t;
  }
  const GRID_T = gridTex("#d8d8d8", "#8a8a8a");
  const M = (o) => new T.MeshStandardMaterial(Object.assign({ roughness: 0.9, metalness: 0, map: GRID_T }, o));
  const FLOOR_TEX = gridTex("#5d6169", "#3c4047");
  THEMES.pogu = { floor: new T.MeshStandardMaterial({ map: FLOOR_TEX, roughness: 0.95, metalness: 0 }), wall: M({ color: 0x7a808a }), strut: M({ color: 0x5c626c }), trim: M({ color: 0x8c939d }), crate: M({ color: 0xc98f2e }), glow: 0xffc849 };
  MOODS.pogu = Object.assign({}, MOODS.harbor || MOODS.glacier, { exp: 0.82, env: 0.6 });
  const MAT = {
    wall: () => THEMES.pogu.wall,
    cover: () => THEMES.pogu.crate,
    landmark: () => M({ color: 0x9aa3b0 }),
    floor2: () => M({ color: 0x7a6cc4 }),
    raised: () => M({ color: 0x7a6cc4 }),
    parapet: () => M({ color: 0x939aa5 }),
    stair: () => M({ color: 0x4f88bf }),
    pillar: () => M({ color: 0x666d78 }),
  };
  const mats = {};
  const matOf = (k) => mats[k] || (mats[k] = (MAT[k] || MAT.wall)());
  const keep = (o) => (_mapMeshes.push(o), o);
  // boxes [x0, x1, y0, y1, z0, z1] → one geometry, uvs from world metres (2 m a tile).
  // With a theme, each box gets vertex colours: long faces are cut into 6 m
  // pieces and each piece takes the colour of the zone it looks into
  // (tint(box, face, x, z) → [r, g, b]), darker toward the ground.
  function boxesGeo(list, tint) {
    const P = [],
      N = [],
      U = [],
      I = [],
      C = [];
    const shade = (y, top) => (top ? 1.1 : 0.7 + 0.3 * Math.min(1, Math.max(0, y / 2.6)));
    const quad = (v, n, uv, col) => {
      const k = P.length / 3;
      v.forEach((p) => {
        P.push(...p);
        if (col) {
          const f = shade(p[1], n[1] > 0);
          C.push(col[0] * f, col[1] * f, col[2] * f);
        }
      });
      for (let i = 0; i < 4; i++) N.push(...n);
      uv.forEach((q) => U.push(q[0] / 2, q[1] / 2));
      I.push(k, k + 1, k + 2, k, k + 2, k + 3);
    };
    const cut = (a, b) => {
      const n = tint ? Math.max(1, Math.ceil((b - a) / 6)) : 1;
      return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
    };
    for (const box of list) {
      const [x0, x1, y0, y1, z0, z1] = box;
      const xs = cut(x0, x1),
        zs = cut(z0, z1),
        mx = (x0 + x1) / 2,
        mz = (z0 + z1) / 2;
      const c = (f, x, z) => (tint ? tint(box, f, x, z) : null);
      for (let i = 0; i < xs.length - 1; i++) {
        const a = xs[i],
          b = xs[i + 1],
          m = (a + b) / 2;
        quad([[a, y0, z1], [b, y0, z1], [b, y1, z1], [a, y1, z1]], [0, 0, 1], [[a, y0], [b, y0], [b, y1], [a, y1]], c(0, m, z1 + 1.5));
        quad([[b, y0, z0], [a, y0, z0], [a, y1, z0], [b, y1, z0]], [0, 0, -1], [[b, y0], [a, y0], [a, y1], [b, y1]], c(1, m, z0 - 1.5));
      }
      for (let i = 0; i < zs.length - 1; i++) {
        const a = zs[i],
          b = zs[i + 1],
          m = (a + b) / 2;
        quad([[x1, y0, b], [x1, y0, a], [x1, y1, a], [x1, y1, b]], [1, 0, 0], [[b, y0], [a, y0], [a, y1], [b, y1]], c(2, x1 + 1.5, m));
        quad([[x0, y0, a], [x0, y0, b], [x0, y1, b], [x0, y1, a]], [-1, 0, 0], [[a, y0], [b, y0], [b, y1], [a, y1]], c(3, x0 - 1.5, m));
      }
      quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], [[x0, z1], [x1, z1], [x1, z0], [x0, z0]], c(4, mx, mz));
      y0 > 0 && quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], c(5, mx, mz));
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(P, 3));
    g.setAttribute("normal", new T.Float32BufferAttribute(N, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(U, 2));
    tint && g.setAttribute("color", new T.Float32BufferAttribute(C, 3));
    g.setIndex(I);
    g.computeBoundingSphere();
    return g;
  }

  function floorText(text, size, color) {
    const c = document.createElement("canvas"),
      g = c.getContext("2d"),
      px = 48;
    g.font = `800 ${px}px "Noto Sans KR", system-ui, sans-serif`;
    const w = Math.ceil(g.measureText(text).width) + 20;
    c.width = w;
    c.height = px + 18;
    g.font = `800 ${px}px "Noto Sans KR", system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 7;
    g.strokeStyle = "rgba(0,0,0,.6)";
    g.strokeText(text, w / 2, c.height / 2);
    g.fillStyle = color || "#fff";
    g.fillText(text, w / 2, c.height / 2);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    const hgt = size / 6,
      m = new T.Mesh(new T.PlaneGeometry((hgt * c.width) / c.height, hgt), new T.MeshBasicMaterial({ map: t, transparent: !0, depthWrite: !1, polygonOffset: !0, polygonOffsetFactor: -4 }));
    m.rotation.x = -Math.PI / 2;
    return m;
  }

  // the zone names on the floor: a design aid, off once the map is dressed
  // (the dressed map has signs on its walls); localStorage lgp_pogu_floor = "1" brings them back
  const LABELS = [];
  const floorNames = () => {
    try {
      return "1" === localStorage.getItem("lgp_pogu_floor");
    } catch (e) {
      return !1;
    }
  };
  function build() {
    const bo = DATA.bo,
      ao = [],
      byKind = {},
      cols = [];
    const TH = window.POGU_THEME;
    // with a theme the boxes are grouped by the look of their material
    // (brick, plaster, corrugated…), without it by kind
    const add = (k, b) => {
      const g = TH ? TH.group(k, b) : k;
      TH && b.push(k);
      (byKind[g] || (byKind[g] = [])).push(b);
      KINDG[k] || (KINDG[k] = g);
    };
    const KINDG = {};
    for (const [x0, x1, z0, z1, h, k] of bo.walls) {
      add(k, [x0, x1, 0, h, z0, z1]);
      cols.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, h, kind: k });
      "wall" !== k && "stair" !== k && ao.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h });
    }
    // floors you can walk under: a slab from y0 to h
    for (const [x0, x1, z0, z1, y0, h, k] of bo.slabs) {
      add(k, [x0, x1, y0, h, z0, z1]);
      cols.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, y0, h, kind: k });
    }
    const meshOf = {};
    for (const k in byKind) {
      const m = new T.Mesh(boxesGeo(byKind[k], TH && TH.tint(k)), TH ? TH.material(k) : matOf(k));
      m.castShadow = m.receiveShadow = !0;
      scene.add(keep(m));
      meshOf[k] = m;
    }
    for (const c of cols) COLLIDERS.push(Object.assign(c, { mesh: meshOf[KINDG[c.kind]] || meshOf[c.kind], hp: 1 / 0, destructible: !1, temp: !1 }));
    // the zones' floors: one opaque mesh, coloured by kind of zone
    {
      const P = [],
        C = [],
        U = [],
        I = [],
        col = new T.Color();
      for (const [x0, x1, z0, z1, hex] of bo.floors) {
        const k = P.length / 3;
        col.set(TH ? TH.floorColor(hex, (x0 + x1) / 2, (z0 + z1) / 2) : hex);
        [[x0, z1], [x1, z1], [x1, z0], [x0, z0]].forEach(([x, z]) => (P.push(x, 0.012, z), C.push(col.r, col.g, col.b), U.push(x / 4, z / 4)));
        I.push(k, k + 1, k + 2, k, k + 2, k + 3);
      }
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(P, 3));
      g.setAttribute("color", new T.Float32BufferAttribute(C, 3));
      g.setAttribute("uv", new T.Float32BufferAttribute(U, 2));
      g.setIndex(I);
      g.computeVertexNormals();
      const m = new T.Mesh(g, TH ? TH.floorMat() : new T.MeshStandardMaterial({ vertexColors: !0, map: GRID_T, roughness: 0.95, metalness: 0, polygonOffset: !0, polygonOffsetFactor: -1 }));
      m.receiveShadow = !0;
      scene.add(keep(m));
    }
    LABELS.length = 0;
    for (const [text, x, z, size, color] of bo.labels) {
      const m = floorText(text, size, color);
      m.position.set(x, 0.03, z);
      m.visible = !TH || floorNames();
      LABELS.push(m);
      scene.add(keep(m));
    }
    try {
      const a = buildWallAO(ao);
      a && scene.add(keep(a));
    } catch (e) {}
    const B = DATA.bounds;
    for (const [x0, x1, z0, z1, h, k] of bo.walls) "wall" === k && x0 >= B.minX && x1 <= B.maxX && z0 >= B.minZ && z1 <= B.maxZ && DATA.walls.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h });
    CHASH.dirty = !0;
    chashBuild();
    try {
      relocateBlockedNodes(DATA);
      buildGrid();
      "function" == typeof rebuildNavGrid && rebuildNavGrid();
    } catch (e) {
      console.warn("pogu grid", e);
    }
    BAR.list = null;
    try {
      TH && TH.decorate({ bo, DATA, keep });
    } catch (e) {
      console.warn("pogu theme", e);
    }
  }
  const _lm = loadMap;
  loadMap = function (key) {
    // the game builds MAP.walls itself: keep it empty while loading (the
    // blockout is built here), then list the buildings for what reads them
    // later (the bots' cover)
    "pogu" === key && (DATA.walls.length = 0);
    const r = _lm.apply(this, arguments);
    if (r !== !1 && "pogu" === key)
      try {
        build();
      } catch (e) {
        console.warn("pogu", e);
      }
    return r;
  };

  // ── barriers: both spawns stay closed while buying ──
  const BAR = { list: null, mat: null };
  function barriersUp() {
    BAR.mat || (BAR.mat = new T.MeshBasicMaterial({ color: 0x5eead4, transparent: !0, opacity: 0.28, depthWrite: !1, side: T.DoubleSide }));
    BAR.list = DATA.bo.barriers.map(([x0, x1, z0, z1]) => addBox((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, 6, BAR.mat, { temp: !0 }));
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
  setInterval(() => {
    try {
      const want = "pogu" === CUR_MAP_KEY && "buy" === world.phase && world.actors && world.actors.length > 0;
      const live = BAR.list && BAR.list.every((c) => COLLIDERS.includes(c));
      want && !live ? (BAR.list && barriersDown(), barriersUp()) : !want && BAR.list && barriersDown();
    } catch (e) {}
  }, 100);

  // ── the map pool: 7 for 5v5, 5 small, 3 duels; the rest wait in MAPS ──
  const POOL = ["pogu", "garden", "market", "glacier", "neon", "dunes", "jungle", "s02", "s03", "s04", "s05", "s06", "d01", "d03", "d04"];
  const ALL = MAP_LIST.slice();
  ALL.some((m) => "pogu" === m.key) || ALL.unshift({ key: "pogu", name: DATA.name });
  function setPool() {
    let extra = "";
    try {
      extra = String((window.SERVER_CFG && SERVER_CFG.game && SERVER_CFG.game.extraMaps) || "");
    } catch (e) {}
    const more = "all" === extra.trim() ? ALL.concat(window.MAP_EXTRA || []).map((m) => m.key) : extra.split(/[\s,]+/).filter(Boolean);
    // the map of the week (the server picks it by the week number: js/map-week.js) joins the list, first, for the week
    let week = "";
    try {
      week = String((window.SERVER_CFG && SERVER_CFG.weekMap && SERVER_CFG.weekMap.key) || "");
    } catch (e) {}
    window.WEEK_MAP_KEY = week;
    const on = new Set(POOL.concat(more, week ? [week] : []));
    // maps added by later modules (the open field) join the same list
    const all = ALL.concat((window.MAP_EXTRA || []).filter((m) => !ALL.some((a) => a.key === m.key)));
    const list = all.filter((m) => on.has(m.key) && MAPS[m.key]).sort((a, b) => (a.key === week ? -1 : POOL.indexOf(a.key) + 1 || 99) - (b.key === week ? -1 : POOL.indexOf(b.key) + 1 || 99));
    if (list.map((m) => m.key).join() === MAP_LIST.map((m) => m.key).join()) return;
    MAP_LIST.length = 0;
    list.forEach((m) => MAP_LIST.push(m));
    window.MAP_COUNT = MAP_LIST.length;
    MAP_LIST.some((m) => m.key === room.map) || (room.map = "pogu");
    // the home screen counts maps once at load: tell it (and anything else that counts) the list changed
    dispatchEvent(new CustomEvent("maps-changed", { detail: { count: MAP_LIST.length } }));
    // agent select opened while the page was still loading: redraw its chips
    try {
      const box = document.getElementById("sel-maps");
      box && box.childElementCount && "function" == typeof paintSelMaps && paintSelMaps();
    } catch (e) {}
  }
  setPool();
  // the owner's setting arrives with the server config
  let tries = 0;
  const poll = setInterval(() => {
    try {
      setPool();
    } catch (e) {}
    ++tries > 40 && clearInterval(poll);
  }, 500);
  window.POGU = { data: DATA, barriers: BAR, pool: POOL, setPool, labels: LABELS, floorNames: (on) => LABELS.forEach((m) => (m.visible = !!on)) };
})();

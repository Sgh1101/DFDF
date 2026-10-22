const T = THREE,
  $ = (e) => document.getElementById(e),
  clamp = (e, t, o) => (e < t ? t : e > o ? o : e),
  rnd = (e, t) => e + Math.random() * (t - e),
  dist2 = (e, t, o, a) => {
    const n = e - o,
      r = t - a;
    return n * n + r * r;
  },
  canvas = $("cv"),
  renderer = new T.WebGLRenderer({
    canvas: canvas,
    antialias: !1, // Visual modes use the post target's MSAA; low modes avoid permanent canvas MSAA.
    powerPreference: "high-performance",
  });
(renderer.setPixelRatio(Math.min(devicePixelRatio, 2)),
  renderer.setSize(innerWidth, innerHeight),
  (renderer.shadowMap.enabled = !0),
  (renderer.shadowMap.type = T.PCFSoftShadowMap),
  (renderer.toneMapping = T.ACESFilmicToneMapping),
  (renderer.toneMappingExposure = 0.98),
  (renderer.outputColorSpace = T.SRGBColorSpace));
const scene = new T.Scene();
((scene.background = new T.Color(1186344)),
  (scene.fog = new T.FogExp2(1318187, 0.007)));
const camera = new T.PerspectiveCamera(80, innerWidth / innerHeight, 0.1, 500),
  viewFOV = { base: 80, now: 80, target: 80 };
addEventListener("resize", () => {
  ((camera.aspect = innerWidth / innerHeight),
    camera.updateProjectionMatrix(),
    renderer.setSize(innerWidth, innerHeight));
});
const hemi = new T.HemisphereLight(10335960, 3291716, 1.15);
(scene.add(hemi), scene.add(new T.AmbientLight(7174792, 0.26)));
const sun = new T.DirectionalLight(16768180, 1.62);
(sun.position.set(-55, 95, 45),
  (sun.castShadow = !0),
  sun.shadow.mapSize.set(2048, 2048));
const sc = sun.shadow.camera,
  SHADOW_R = 46;
((sc.left = -46),
  (sc.right = 46),
  (sc.top = 46),
  (sc.bottom = -46),
  (sc.near = 1),
  (sc.far = 200),
  scene.add(sun),
  sun.target.position.set(0, 0, 0),
  scene.add(sun.target));
const _SUN_OFF = { x: -55, y: 95, z: 45 };
function followSun() {
  if (!sun.castShadow) return;
  const e = camera.position.x - 14 * Math.sin(camera.rotation.y || 0),
    t = camera.position.z - 14 * Math.cos(camera.rotation.y || 0),
    o = 92 / (sun.shadow.mapSize.width || 1024),
    a = Math.round(e / o) * o,
    n = Math.round(t / o) * o;
  (sun.target.position.set(a, 0, n),
    sun.position.set(a + _SUN_OFF.x, _SUN_OFF.y, n + _SUN_OFF.z),
    sun.target.updateMatrixWorld(),
    sun.shadow.camera.updateProjectionMatrix());
}
const SITE_LIGHTS = [],
  matFloor = MAT.floor,
  floor = new T.Mesh(new T.PlaneGeometry(148, 188), matFloor);
((floor.rotation.x = -Math.PI / 2),
  (floor.receiveShadow = !0),
  scene.add(floor),
  MAP.sites.forEach((e) => {
    const t = new T.Mesh(
      new T.RingGeometry(e.r - 0.5, e.r, 48),
      new T.MeshBasicMaterial({
        color: 16726862,
        transparent: !0,
        opacity: 0.32,
        side: T.DoubleSide,
      }),
    );
    ((t.rotation.x = -Math.PI / 2),
      t.position.set(e.x, 0.06, e.z),
      scene.add(t));
    const o = new T.Mesh(
      new T.CircleGeometry(e.r, 40),
      new T.MeshBasicMaterial({
        color: 16726862,
        transparent: !0,
        opacity: 0.06,
        side: T.DoubleSide,
      }),
    );
    ((o.rotation.x = -Math.PI / 2),
      o.position.set(e.x, 0.04, e.z),
      scene.add(o));
  }),
  [
    [MAP.attackSpawn, 16739146],
    [MAP.defendSpawn, 3718648],
  ].forEach(([e, t]) => {
    const o = new T.Mesh(
      new T.CircleGeometry(9, 32),
      new T.MeshBasicMaterial({
        color: t,
        transparent: !0,
        opacity: 0.14,
        side: T.DoubleSide,
      }),
    );
    ((o.rotation.x = -Math.PI / 2),
      o.position.set(e.x, 0.05, e.z),
      scene.add(o));
  }));
const COLLIDERS = [],
  CHASH = {
    cell: 8,
    cols: 0,
    rows: 0,
    minX: 0,
    minZ: 0,
    buckets: null,
    dirty: !0,
  },
  matWall = () => TH().wall,
  matCover = () => TH().crate,
  matWin = () => TH().strut;
function ejectActorsFrom(e) {
  const t = world.actors && world.actors.length ? world.actors : [];
  for (const o of t) {
    if (!o.alive || !o.pos) continue;
    if ((o.y || 0) >= e.h - 0.05) continue;
    const t = PR + 0.05;
    if (
      o.pos.x + t <= e.minX ||
      o.pos.x - t >= e.maxX ||
      o.pos.z + t <= e.minZ ||
      o.pos.z - t >= e.maxZ
    )
      continue;
    const a = o.pos.x + t - e.minX,
      n = e.maxX - (o.pos.x - t),
      r = o.pos.z + t - e.minZ,
      s = e.maxZ - (o.pos.z - t),
      i = Math.min(a, n, r, s);
    i === a
      ? (o.pos.x -= a)
      : i === n
        ? (o.pos.x += n)
        : i === r
          ? (o.pos.z -= r)
          : (o.pos.z += s);
  }
}
function addBox(e, t, o, a, n, r, s = {}) {
  const baseY = s.y ?? (s.temp ? abilityGroundY(e, t) : 0);
  const i = new T.Mesh(new T.BoxGeometry(o, n, a), r);
  (i.position.set(e, baseY + n / 2, t),
    (i.castShadow = !0),
    (i.receiveShadow = !0),
    scene.add(i));
  const l = {
    minX: e - o / 2,
    maxX: e + o / 2,
    minZ: t - a / 2,
    maxZ: t + a / 2,
    h: baseY + n,
    y0: baseY,
    mesh: i,
    hp: s.hp || 1 / 0,
    destructible: !!s.hp,
    temp: !!s.temp,
  };
  if ((COLLIDERS.push(l), CHASH.buckets && !CHASH.dirty && chashAdd(l), s.temp))
    try {
      ejectActorsFrom(l);
    } catch (e) {}
  return l;
}
MAP.walls.forEach((e) => {
  const t = e.cover ? matCover() : e.window ? matWin() : matWall();
  addBox(e.x, e.z, e.w, e.d, e.h, t);
});
let CUR_MAP_KEY = "glacier";
const _mapMeshes = [];
function clearMapGeometry() {
  // Device groups contain owned child resources; clean them before removing
  // top-level map meshes so their resources are released exactly once.
  if (window.MAP_GIMMICKS) window.MAP_GIMMICKS.clear();
  for (const e of _mapMeshes)
    (scene.remove(e), e.geometry && e.geometry.dispose());
  if (
    ((_mapMeshes.length = 0),
    (COLLIDERS.length = 0),
    (CHASH.dirty = !0),
    "object" == typeof LAMP_LIT && (LAMP_LIT.n = 0),
    void 0 !== DECOR)
  ) {
    for (let e = DECOR.children.length - 1; e >= 0; e--) {
      const t = DECOR.children[e];
      (DECOR.remove(t),
        t.traverse &&
          t.traverse((e) => {
            e.geometry && e.geometry.dispose();
          }),
        t.geometry && t.geometry.dispose());
    }
    DECOR.parent || scene.add(DECOR);
  }
  for (let e = scene.children.length - 1; e >= 0; e--) {
    const t = scene.children[e];
    (t.userData && t.userData.keep) ||
      t.isLight ||
      t === floor ||
      (t.userData && t.userData.actor) ||
      (scene.remove(t), t.geometry && t.geometry.dispose());
  }
}
function buildMapGeometry(e) {
  (clearMapGeometry(),
    e.walls.forEach((e) => {
      const t = e.cover ? matCover() : e.window ? matWin() : matWall(),
        o = addBox(e.x, e.z, e.w, e.d, e.h, t);
      o && o.mesh && _mapMeshes.push(o.mesh);
    }));
  try {
    const t = buildWallAO(e.walls);
    t && (scene.add(t), _mapMeshes.push(t));
  } catch (e) {
    console.warn("ao", e);
  }
}
function buildWallAO(e) {
  const t = [],
    o = [],
    a = [];
  if (
    (e.forEach((e) => {
      if (!(e.h > 0.35)) return;
      const n = e.w / 2,
        r = e.d / 2,
        s = Math.min(0.42, 0.2 + 0.04 * e.h),
        i = t.length / 3,
        l = [
          [-n, -r],
          [n, -r],
          [n, r],
          [-n, r],
        ];
      (l.forEach(([a, n]) => {
        (t.push(e.x + a, 0.025, e.z + n), o.push(0, 0, 0, s));
      }),
        l.forEach(([a, n]) => {
          (t.push(
            e.x + a + 1.25 * Math.sign(a),
            0.025,
            e.z + n + 1.25 * Math.sign(n),
          ),
            o.push(0, 0, 0, 0));
        }));
      for (let e = 0; e < 4; e++) {
        const t = (e + 1) % 4;
        a.push(i + e, i + 4 + e, i + t, i + t, i + 4 + e, i + 4 + t);
      }
    }),
    !t.length)
  )
    return null;
  const n = new T.BufferGeometry();
  (n.setAttribute("position", new T.Float32BufferAttribute(t, 3)),
    n.setAttribute("color", new T.Float32BufferAttribute(o, 4)),
    n.setIndex(a));
  const r = new T.Mesh(
    n,
    new T.MeshBasicMaterial({
      vertexColors: !0,
      transparent: !0,
      depthWrite: !1,
      side: T.DoubleSide,
      polygonOffset: !0,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  return ((r.renderOrder = -1), r);
}
function applyMapData(e) {
  ((MAP.name = e.name),
    (MAP.bounds = e.bounds),
    (MAP.attackSpawn = e.attackSpawn),
    (MAP.defendSpawn = e.defendSpawn),
    (MAP.sites = e.sites),
    (MAP.nodes = e.nodes),
    (MAP.walls = e.walls),
    (MAP.theme = e.theme || e.key || "glacier"));
}
const MOODS = {
  glacier: {
    top: "#4f86c2",
    mid: "#9fc3e2",
    hor: "#dde9f3",
    fog: 13229290,
    hemiSky: 13953279,
    hemiGnd: 5662585,
    hemi: 0.45,
    exp: 0.86,
    env: 0.9,
    sun: 16773338,
    sunInt: 1.45,
    glow: "#fff6e6",
    tint: [0.98, 1, 1.04],
    lift: [0, 0.006, 0.02],
    sat: 1.08,
    con: 1.07,
    vig: 0.3,
    bloom: 1,
  },
  dunes: {
    top: "#3f78b8",
    mid: "#98bcd6",
    hor: "#f0cf98",
    fog: 14928024,
    hemiSky: 16770238,
    hemiGnd: 8806460,
    hemi: 0.45,
    exp: 0.92,
    env: 0.9,
    sun: 16765068,
    sunInt: 1.6,
    glow: "#ffe2b0",
    tint: [1.05, 1, 0.94],
    lift: [0.02, 0.008, 0],
    sat: 1.1,
    con: 1.08,
    vig: 0.34,
    bloom: 1,
  },
  freighter: {
    top: "#1d2b3d",
    mid: "#43596f",
    hor: "#a3a7a6",
    fog: 8227476,
    hemiSky: 11978456,
    hemiGnd: 3814962,
    hemi: 0.7,
    exp: 1.18,
    env: 1.1,
    sun: 16766630,
    sunInt: 1.3,
    glow: "#ffcf96",
    tint: [1, 0.99, 1.02],
    lift: [0.004, 0.008, 0.02],
    sat: 1.06,
    con: 1.1,
    vig: 0.38,
    bloom: 1.1,
  },
  neon: {
    top: "#04060e",
    mid: "#10183a",
    hor: "#43204e",
    fog: 1840178,
    hemiSky: 9083104,
    hemiGnd: 4860504,
    hemi: 1.6,
    exp: 1.3,
    env: 1.1,
    sun: 11846911,
    sunInt: 1.05,
    glow: null,
    stars: !0,
    tint: [1, 0.97, 1.06],
    lift: [0.02, 0, 0.04],
    sat: 1.16,
    con: 1.08,
    vig: 0.4,
    bloom: 1.35,
  },
  garden: {
    top: "#1d2d52",
    mid: "#7a6f94",
    hor: "#f2b27a",
    fog: 14264450,
    hemiSky: 16766640,
    hemiGnd: 4866100,
    hemi: 0.62,
    exp: 1,
    env: 0.9,
    sun: 16756848,
    sunInt: 1.35,
    glow: "#ffd29a",
    tint: [1.05, 0.99, 0.94],
    lift: [0.02, 0.008, 0],
    sat: 1.12,
    con: 1.08,
    vig: 0.34,
    bloom: 1.1,
  },
  market: {
    top: "#03050c",
    mid: "#0c1430",
    hor: "#2a2440",
    fog: 1317420,
    hemiSky: 8425672,
    hemiGnd: 3813416,
    hemi: 1.2,
    exp: 1.25,
    env: 1,
    sun: 10466559,
    sunInt: 0.55,
    glow: null,
    stars: !0,
    tint: [1.04, 0.98, 0.96],
    lift: [0.02, 0.01, 0.03],
    sat: 1.12,
    con: 1.08,
    vig: 0.42,
    bloom: 1.4,
  },
  temple: {
    top: "#5a6a7e",
    mid: "#8e9aa8",
    hor: "#c9d0d4",
    fog: 11187386,
    hemiSky: 14213352,
    hemiGnd: 4870208,
    hemi: 0.8,
    exp: 0.98,
    env: 0.95,
    sun: 15263960,
    sunInt: 1,
    glow: "#eef0f0",
    tint: [0.98, 1, 1.02],
    lift: [0.01, 0.012, 0.02],
    sat: 0.92,
    con: 1.04,
    vig: 0.32,
    bloom: 0.9,
  },
  harbor: {
    top: "#2f6fb0",
    mid: "#86b8dc",
    hor: "#dcebf2",
    fog: 12113122,
    hemiSky: 14741759,
    hemiGnd: 5920336,
    hemi: 0.5,
    exp: 0.92,
    env: 0.95,
    sun: 16774870,
    sunInt: 1.55,
    glow: "#fff6e6",
    tint: [1, 1, 1.02],
    lift: [0, 0.006, 0.02],
    sat: 1.1,
    con: 1.08,
    vig: 0.3,
    bloom: 1,
  },
  forge: {
    top: "#0e0606",
    mid: "#3a1810",
    hor: "#8a3a18",
    fog: 3809304,
    hemiSky: 16756864,
    hemiGnd: 2759188,
    hemi: 1.1,
    exp: 1.2,
    env: 1,
    sun: 16752736,
    sunInt: 0.95,
    glow: "#ff8a40",
    tint: [1.08, 0.97, 0.9],
    lift: [0.03, 0.008, 0],
    sat: 1.12,
    con: 1.1,
    vig: 0.42,
    bloom: 1.45,
  },
  jungle: {
    top: "#3a7a9a",
    mid: "#96c0b0",
    hor: "#e0e6b8",
    fog: 11059360,
    hemiSky: 14743248,
    hemiGnd: 3426854,
    hemi: 0.7,
    exp: 0.96,
    env: 0.9,
    sun: 16773312,
    sunInt: 1.4,
    glow: "#fff4d0",
    tint: [0.98, 1.04, 0.96],
    lift: [0, 0.012, 0],
    sat: 1.14,
    con: 1.06,
    vig: 0.34,
    bloom: 1.05,
  },
};
let _envRT = null;
function buildEnvMap(e) {
  const t = new T.Scene(),
    o = new T.SphereGeometry(10, 48, 24),
    a = o.attributes.position,
    n = [],
    r = new T.Color(e.top),
    s = new T.Color(e.mid),
    i = new T.Color(e.hor),
    l = new T.Color(e.hemiGnd).multiplyScalar(0.7),
    c = new T.Color();
  for (let e = 0; e < a.count; e++) {
    const t = a.getY(e) / 10;
    (t > 0.35
      ? c.copy(s).lerp(r, (t - 0.35) / 0.65)
      : t > 0
        ? c.copy(i).lerp(s, t / 0.35)
        : t > -0.12
          ? c.copy(i).lerp(l, -t / 0.12)
          : c.copy(l),
      n.push(c.r, c.g, c.b));
  }
  (o.setAttribute("color", new T.Float32BufferAttribute(n, 3)),
    t.add(
      new T.Mesh(
        o,
        new T.MeshBasicMaterial({ vertexColors: !0, side: T.BackSide }),
      ),
    ));
  const d = new T.Vector3(_SUN_OFF.x, _SUN_OFF.y, _SUN_OFF.z).normalize(),
    h = new T.Mesh(
      new T.SphereGeometry(1.3, 16, 8),
      new T.MeshBasicMaterial({
        color: new T.Color(e.sun).multiplyScalar(e.stars ? 3 : 12),
      }),
    );
  (h.position.copy(d.multiplyScalar(8.5)),
    t.add(h),
    e.stars &&
      [
        [16723320, 0],
        [3006719, 2.1],
        [11561983, 4.2],
      ].forEach(([e, o]) => {
        const a = new T.Mesh(
          new T.PlaneGeometry(4, 1.6),
          new T.MeshBasicMaterial({
            color: new T.Color(e).multiplyScalar(2.2),
            side: T.DoubleSide,
          }),
        );
        (a.position.set(8.5 * Math.cos(o), 1.2, 8.5 * Math.sin(o)),
          a.lookAt(0, 1.2, 0),
          t.add(a));
      }));
  const p = new T.PMREMGenerator(renderer),
    u = p.fromScene(t, 0.02);
  (p.dispose(),
    t.traverse((e) => {
      (e.geometry && e.geometry.dispose(), e.material && e.material.dispose());
    }),
    _envRT && _envRT.dispose(),
    (_envRT = u),
    (scene.environment = u.texture),
    (ENV_INT.v = e.env || 1),
    applyEnvIntensity());
}
const ENV_INT = { v: 1 };
function applyEnvIntensity() {
  const e = new Set();
  scene.traverse((t) => {
    const o = t.material
      ? Array.isArray(t.material)
        ? t.material
        : [t.material]
      : [];
    for (const t of o)
      t &&
        t.isMeshStandardMaterial &&
        !e.has(t) &&
        (e.add(t), (t.envMapIntensity = ENV_INT.v * (t.userData.envK || 1)));
  });
}
const curMood = () => MOODS[(MAP && MAP.theme) || CUR_MAP_KEY] || MOODS.glacier;
function applyMapMood(e) {
  const t = MOODS[e.theme || e.key] || null;
  if (t) {
    ((e = Object.assign({}, e, {
      sky: t.fog,
      sunColor: t.sun,
      sunInt: t.sunInt,
      ambient: t.hemi,
    })),
      hemi.color.setHex(t.hemiSky),
      hemi.groundColor.setHex(t.hemiGnd),
      (POST.tint = t.tint),
      (POST.lift = t.lift),
      (POST.sat = t.sat),
      (POST.contrast = t.con),
      (POST.vignette = t.vig),
      (POST.bloom = 0.45 * t.bloom),
      (renderer.toneMappingExposure = t.exp || 0.98));
    try {
      buildEnvMap(t);
    } catch (e) {
      console.warn("env", e);
    }
  }
  try {
    const t = [
      ...(e.sites || []).map((e) => [e.x, 8.5, e.z]),
      e.attackSpawn ? [e.attackSpawn.x, 8, e.attackSpawn.z] : null,
      e.defendSpawn ? [e.defendSpawn.x, 8, e.defendSpawn.z] : null,
    ].filter(Boolean);
    SITE_LIGHTS.forEach((e, o) => {
      const a = t[o];
      a
        ? (e.position.set(a[0], a[1], a[2]), (e.visible = !0))
        : (e.intensity = 0);
    });
  } catch (e) {}
  (void 0 !== e.sky &&
    ((scene.background = new T.Color(e.sky)),
    scene.fog && scene.fog.color.setHex(e.sky)),
    void 0 !== e.fog && scene.fog && (scene.fog.density = e.fog),
    void 0 !== e.sunColor && sun.color.setHex(e.sunColor),
    void 0 !== e.sunInt && (sun.intensity = e.sunInt),
    void 0 !== e.ambient &&
      void 0 !== hemi &&
      hemi &&
      (hemi.intensity = e.ambient));
}
function mergeStatic() {
  const e = new Set();
  for (const t of COLLIDERS)
    t.mesh && (t.destructible || t.temp) && e.add(t.mesh);
  const t = new Map();
  for (const o of scene.children) {
    if (!o.isMesh || o === floor || e.has(o) || !o.visible) continue;
    if (
      o.userData &&
      (o.userData.keep ||
        o.userData.actor ||
        o.userData.noMerge ||
        o.userData.merged)
    )
      continue;
    const a = o.material;
    if (
      !a ||
      Array.isArray(a) ||
      a.transparent ||
      !o.geometry ||
      !o.geometry.attributes.position
    )
      continue;
    if (!a.isMeshStandardMaterial && !a.isMeshBasicMaterial) continue;
    if (o.geometry.attributes.position.count > 2e4) continue;
    const n =
      a.isMeshBasicMaterial && !a.map
        ? "b|" + a.color.getHex() + "|" + a.fog + "|" + a.side
        : a.uuid;
    let r = t.get(n);
    (r || ((r = { mat: a, list: [] }), t.set(n, r)), r.list.push(o));
  }
  let o = 0,
    a = 0;
  for (const e of t.values()) {
    if (e.list.length < 2) continue;
    const t = [];
    let n = 0,
      r = !1,
      s = !1,
      i = !0;
    for (const o of e.list) {
      o.updateMatrix();
      const e = o.geometry.index
        ? o.geometry.toNonIndexed()
        : o.geometry.clone();
      (e.applyMatrix4(o.matrix),
        e.attributes.normal || e.computeVertexNormals(),
        e.attributes.uv || (i = !1),
        t.push(e),
        (n += e.attributes.position.count),
        (r = r || o.castShadow),
        (s = s || o.receiveShadow));
    }
    const l = new Float32Array(3 * n),
      c = new Float32Array(3 * n),
      d = i ? new Float32Array(2 * n) : null;
    let h = 0;
    for (const e of t) {
      const t = e.attributes.position.count;
      (l.set(e.attributes.position.array, 3 * h),
        c.set(e.attributes.normal.array, 3 * h),
        d && d.set(e.attributes.uv.array, 2 * h),
        (h += t),
        e.dispose());
    }
    const p = new T.BufferGeometry();
    (p.setAttribute("position", new T.BufferAttribute(l, 3)),
      p.setAttribute("normal", new T.BufferAttribute(c, 3)),
      d && p.setAttribute("uv", new T.BufferAttribute(d, 2)),
      p.computeBoundingSphere(),
      p.computeBoundingBox());
    const u = new T.Mesh(p, e.mat);
    ((u.castShadow = r), (u.receiveShadow = s), (u.userData.merged = !0));
    for (const t of e.list) scene.remove(t);
    (scene.add(u), _mapMeshes.push(u), (o += e.list.length), a++);
  }
  return o - a;
}
function warmShaders() {
  const e = new T.Group(),
    t = new T.BoxGeometry(0.1, 0.1, 0.1),
    o = [],
    a = (a, n) => {
      const r = new T.Mesh(t, a);
      return (e.add(r), n || o.push(a), r);
    },
    n = 16777215;
  (a(new T.MeshBasicMaterial({ color: n, transparent: !0, depthWrite: !1 })),
    a(
      new T.MeshBasicMaterial({
        color: n,
        transparent: !0,
        side: T.DoubleSide,
        depthWrite: !1,
      }),
    ),
    a(
      new T.MeshBasicMaterial({
        color: n,
        transparent: !0,
        wireframe: !0,
        depthWrite: !1,
      }),
    ),
    a(new T.MeshBasicMaterial({ color: n })),
    a(new T.MeshBasicMaterial({ color: n, side: T.DoubleSide })),
    a(
      new T.MeshBasicMaterial({
        vertexColors: !0,
        transparent: !0,
        depthWrite: !1,
        side: T.DoubleSide,
      }),
    ),
    a(
      new T.MeshStandardMaterial({
        color: n,
        emissive: n,
        emissiveIntensity: 1,
        roughness: 0.3,
      }),
    ),
    a(
      new T.MeshStandardMaterial({
        color: n,
        metalness: 0.85,
        roughness: 0.35,
      }),
    ),
    a(
      new T.MeshStandardMaterial({
        color: n,
        transparent: !0,
        opacity: 0.5,
        depthWrite: !1,
        side: T.DoubleSide,
      }),
    ));
  try {
    (a(chMat(16777215, "cloth"), !0),
      a(chGlow("#ffffff", 1), !0),
      void 0 !== CH_VC && a(CH_VC, !0));
  } catch (e) {}
  const r = glowDot(n, 0.1, 1);
  (e.add(r), o.push(r.material));
  const s = new T.SpriteMaterial({ color: n, transparent: !0, depthWrite: !1 });
  (e.add(new T.Sprite(s)), o.push(s));
  const i = new T.BufferGeometry().setFromPoints([
      new T.Vector3(),
      new T.Vector3(0, 1, 0),
    ]),
    l = new T.LineBasicMaterial({ color: n, transparent: !0 }),
    c = new T.LineBasicMaterial({ color: n });
  (e.add(new T.Line(i, l)), e.add(new T.Line(i, c)), o.push(l, c));
  const d = new T.BufferGeometry();
  d.setAttribute("position", new T.Float32BufferAttribute([0, 0, 0], 3));
  const h = new T.PointsMaterial({
    color: n,
    size: 1,
    sizeAttenuation: !1,
    depthWrite: !1,
  });
  (e.add(new T.Points(d, h)),
    o.push(h),
    e.position.copy(camera.position),
    scene.add(e));
  try {
    renderer.compile(scene, camera);
  } catch (e) {}
  (scene.remove(e), (o.length = 0), i.dispose(), d.dispose(), t.dispose());
}
function loadMap(e) {
  const t = MAPS[e];
  if (!t) return (console.warn("알 수 없는 맵:", e), !1);
  CUR_MAP_KEY = e;
  const o = t.theme || t.key || "glacier";
  (THEMES[o] && ((THEME.cur = THEMES[o]), (THEME.key = o)), applyMapData(t));
  try {
    floor.material = TH().floor;
    const e = t.bounds.maxX - t.bounds.minX + 12,
      o = t.bounds.maxZ - t.bounds.minZ + 12;
    (floor.geometry.dispose(),
      (floor.geometry = new T.PlaneGeometry(e, o)),
      floor.position.set(
        (t.bounds.minX + t.bounds.maxX) / 2,
        0,
        (t.bounds.minZ + t.bounds.maxZ) / 2,
      ));
  } catch (e) {
    console.warn("floor", e);
  }
  (buildMapGeometry(t), applyMapMood(t));
  try {
    void 0 !== VM && VM.root && !VM.root.parent && scene.add(VM.root);
  } catch (e) {}
  try {
    void 0 !== world &&
      world.spike &&
      (world.spike.mesh
        ? world.spike.mesh.parent || scene.add(world.spike.mesh)
        : (world.spike.mesh = makeSpikeMesh()));
  } catch (e) {}
  try {
    fxLightPool();
  } catch (e) {
    console.warn("lights", e);
  }
  if ("function" == typeof dressMap)
    try {
      dressMap();
    } catch (e) {}
  try {
    addDecorColliders();
  } catch (e) {
    console.warn("decor col", e);
  }
  try {
    const e = mergeDecor();
    e > 0 && console.log("소품 병합:", e, "개 감소");
  } catch (e) {
    console.warn("merge", e);
  }
  relocateBlockedNodes(t);
  try {
    ((CHASH.dirty = !0),
      chashBuild(),
      (GRID.minX = MAP.bounds.minX),
      (GRID.minZ = MAP.bounds.minZ),
      (GRID.cols = Math.ceil((MAP.bounds.maxX - MAP.bounds.minX) / GRID.cell)),
      (GRID.rows = Math.ceil((MAP.bounds.maxZ - MAP.bounds.minZ) / GRID.cell)),
      (GRID.walk = new Uint8Array(GRID.cols * GRID.rows)),
      buildGrid());
  } catch (e) {
    console.warn("격자", e);
  }
  if ("function" == typeof rebuildNavGrid)
    try {
      rebuildNavGrid();
    } catch (e) {}
  try {
    const e = mergeStatic();
    e > 0 && console.log("맵 메시 병합:", e, "개 감소");
  } catch (e) {
    console.warn("mergeStatic", e);
  }
  try {
    warmShaders();
  } catch (e) {
    console.warn("warm", e);
  }
  return !0;
}
function addDecorColliders() {
  if (void 0 === DECOR) return 0;
  DECOR.updateMatrixWorld(!0);
  const e = new T.Box3();
  let t = 0;
  return (
    DECOR.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.material || Array.isArray(o.material))
        return;
      if (
        o.material.transparent ||
        (o.userData && o.userData.noCollide) ||
        ((e) => {
          for (let t = e; t; t = t.parent) if (!t.visible) return !0;
          return !1;
        })(o)
      )
        return;
      if ((e.setFromObject(o), e.min.y > 0.9 || e.max.y < 1)) return;
      const a = o.geometry.type;
      if ("SphereGeometry" === a && e.max.y < 1.4) return;
      let n = e.max.x - e.min.x,
        r = e.max.z - e.min.z;
      if (n < 0.22 || r < 0.22 || n > 60 || r > 60) return;
      /Cylinder|Cone|Capsule|Sphere/.test(a) && ((n *= 0.82), (r *= 0.82));
      const s = (e.min.x + e.max.x) / 2,
        i = (e.min.z + e.max.z) / 2;
      let l = 0;
      const c = [
        [s, i],
        [s - 0.3 * n, i - 0.3 * r],
        [s + 0.3 * n, i + 0.3 * r],
        [s - 0.3 * n, i + 0.3 * r],
        [s + 0.3 * n, i - 0.3 * r],
      ];
      for (const [e, t] of c) collideXZ(e, t, 0.9, 0.02) && l++;
      l >= 3 ||
        (COLLIDERS.push({
          minX: s - n / 2,
          maxX: s + n / 2,
          minZ: i - r / 2,
          maxZ: i + r / 2,
          h: e.max.y,
          mesh: null,
          hp: 1 / 0,
          destructible: !1,
          temp: !1,
          decor: !0,
        }),
        (CHASH.dirty = !0),
        t++);
    }),
    t
  );
}
function relocateBlockedNodes(e) {
  let t = 0;
  const o = (e, t) => !collideXZ(e, t, 0.9, 1);
  for (const a in e.nodes) {
    const n = e.nodes[a];
    if (
      (void 0 === n._ox && ((n._ox = n.x), (n._oz = n.z)),
      (n.x = n._ox),
      (n.z = n._oz),
      o(n.x, n.z))
    )
      continue;
    let r = !1;
    for (let e = 1; e <= 16 && !r; e += 1)
      for (let a = 0; a < 16; a++) {
        const s = (a / 16) * Math.PI * 2,
          i = n._ox + Math.cos(s) * e,
          l = n._oz + Math.sin(s) * e;
        if (o(i, l)) {
          ((n.x = i), (n.z = l), (r = !0), t++);
          break;
        }
      }
  }
  return t;
}
function clearBlockedPaths(e) {
  const t = [];
  for (const o in e.nodes) t.push(e.nodes[o]);
  for (const o of e.sites) t.push(o);
  for (let e = 0; e < TEAM_SIZE; e++)
    (t.push(spawnPointFor("atk", e)), t.push(spawnPointFor("def", e)));
  const o = 1.1;
  let a = 0;
  for (let e = COLLIDERS.length - 1; e >= 0; e--) {
    const n = COLLIDERS[e];
    if (!(n.h <= 0.4))
      for (const r of t)
        if (
          r.x > n.minX - o &&
          r.x < n.maxX + o &&
          r.z > n.minZ - o &&
          r.z < n.maxZ + o
        ) {
          (COLLIDERS.splice(e, 1), (CHASH.dirty = !0), a++);
          break;
        }
  }
  return a;
}
function currentMapName() {
  return MAP.name;
}
const PR = 0.75,
  ADMIN_DEF = {
    run: 9,
    walk: 3.8,
    crouch: 4.2,
    adsMul: 0.58,
    jumpV: 6.1,
    gravity: 13.5,
    airCtrl: 1,
    infAbil: !1,
    infAmmo: !1,
    noRecoil: !1,
    god: !1,
    oneShot: !1,
    fastFire: 1,
    aiSpeed: 1,
    freezeAI: !1,
  },
  ADMIN = Object.assign({}, ADMIN_DEF);
let ADMIN_UNLOCKED = !1;
const ADMIN_PASS = "";
function loadAdmin() {
  try {
    const e = localStorage.getItem("lgp_admin");
    if (e) {
      const t = JSON.parse(e);
      for (const e in ADMIN_DEF) void 0 !== t[e] && (ADMIN[e] = t[e]);
    }
    ADMIN_UNLOCKED = "1" === localStorage.getItem("lgp_admin_ok");
  } catch (e) {}
}
function saveAdmin() {
  try {
    (localStorage.setItem("lgp_admin", JSON.stringify(ADMIN)),
      localStorage.setItem("lgp_admin_ok", ADMIN_UNLOCKED ? "1" : "0"));
  } catch (e) {}
}
function adminReset() {
  (Object.assign(ADMIN, ADMIN_DEF), saveAdmin());
}
function adminActive() {
  for (const e in ADMIN_DEF) if (ADMIN[e] !== ADMIN_DEF[e]) return !0;
  return !1;
}
function GRAVITY_NOW() {
  return ADMIN.gravity;
}
function JUMP_NOW() {
  return ADMIN.jumpV;
}
loadAdmin();
const EYE = 1.68 * BODY_K,
  CROUCH_EYE = 1.12 * BODY_K,
  STEP_H = 0.68;
function chashBuild() {
  const e =
    "object" == typeof MAP && MAP.bounds
      ? MAP.bounds
      : { minX: -160, maxX: 160, minZ: -160, maxZ: 160 };
  ((CHASH.minX = e.minX - 4),
    (CHASH.minZ = e.minZ - 4),
    (CHASH.cols = Math.max(1, Math.ceil((e.maxX - e.minX + 8) / CHASH.cell))),
    (CHASH.rows = Math.max(1, Math.ceil((e.maxZ - e.minZ + 8) / CHASH.cell))));
  const t = CHASH.cols * CHASH.rows;
  CHASH.buckets = new Array(t);
  for (let e = 0; e < t; e++) CHASH.buckets[e] = null;
  for (const e of COLLIDERS) chashAdd(e);
  CHASH.dirty = !1;
}
function chashAdd(e) {
  if (!CHASH.buckets) return;
  const t = Math.max(0, Math.floor((e.minX - CHASH.minX) / CHASH.cell)),
    o = Math.min(
      CHASH.cols - 1,
      Math.floor((e.maxX - CHASH.minX) / CHASH.cell),
    ),
    a = Math.max(0, Math.floor((e.minZ - CHASH.minZ) / CHASH.cell)),
    n = Math.min(
      CHASH.rows - 1,
      Math.floor((e.maxZ - CHASH.minZ) / CHASH.cell),
    );
  for (let r = a; r <= n; r++)
    for (let a = t; a <= o; a++) {
      const t = r * CHASH.cols + a;
      (CHASH.buckets[t] || (CHASH.buckets[t] = [])).push(e);
    }
}
function collideXZ(e, t, o, a) {
  (!CHASH.dirty && CHASH.buckets) || chashBuild();
  const n = Math.floor((e - a - CHASH.minX) / CHASH.cell),
    r = Math.floor((e + a - CHASH.minX) / CHASH.cell),
    s = Math.floor((t - a - CHASH.minZ) / CHASH.cell),
    i = Math.floor((t + a - CHASH.minZ) / CHASH.cell);
  for (let l = s; l <= i; l++)
    if (!(l < 0 || l >= CHASH.rows))
      for (let s = n; s <= r; s++) {
        if (s < 0 || s >= CHASH.cols) continue;
        const n = CHASH.buckets[l * CHASH.cols + s];
        if (n)
          for (let r = 0; r < n.length; r++) {
            const s = n[r];
            if (
              !(o >= s.h - 0.05) &&
              !(s.y0 && o + 2.3 <= s.y0) &&
              e + a > s.minX &&
              e - a < s.maxX &&
              t + a > s.minZ &&
              t - a < s.maxZ
            )
              return s;
          }
      }
  return null;
}
function blockerTopAt(e, t, o, a) {
  (!CHASH.dirty && CHASH.buckets) || chashBuild();
  let n = -1;
  const r = Math.floor((e - a - CHASH.minX) / CHASH.cell),
    s = Math.floor((e + a - CHASH.minX) / CHASH.cell),
    i = Math.floor((t - a - CHASH.minZ) / CHASH.cell),
    l = Math.floor((t + a - CHASH.minZ) / CHASH.cell);
  for (let c = i; c <= l; c++)
    if (!(c < 0 || c >= CHASH.rows))
      for (let i = r; i <= s; i++) {
        if (i < 0 || i >= CHASH.cols) continue;
        const r = CHASH.buckets[c * CHASH.cols + i];
        if (r)
          for (let s = 0; s < r.length; s++) {
            const i = r[s];
            o >= i.h - 0.05 ||
              (i.y0 && o + 2.3 <= i.y0) ||
              (e + a > i.minX &&
                e - a < i.maxX &&
                t + a > i.minZ &&
                t - a < i.maxZ &&
                i.h > n &&
                (n = i.h));
          }
      }
  return n;
}
function stepTo(e, t, o, a) {
  const n = blockerTopAt(e, t, o, a);
  return n < 0
    ? o
    : n - o > STEP_H || blockerTopAt(e, t, n + 0.06, a) >= 0
      ? null
      : n;
}
function moveWithSlide(e, t, o, a, n) {
  const r = Math.abs(t) + Math.abs(o);
  if (r > 0.45) {
    const s = Math.min(40, Math.ceil(r / 0.35));
    let i = a;
    for (let a = 0; a < s; a++) i = moveWithSlide(e, t / s, o / s, i, n);
    return i;
  }
  let s = a,
    i = stepTo(e.x + t, e.z, s, n);
  (null !== i && ((e.x += t), (s = i)),
    (i = stepTo(e.x, e.z + o, s, n)),
    null !== i && ((e.z += o), (s = i)));
  const l = MAP.bounds;
  return (
    (e.x = clamp(e.x, l.minX + n, l.maxX - n)),
    (e.z = clamp(e.z, l.minZ + n, l.maxZ - n)),
    s
  );
}
// All maps use the same supporting surface as movement. Hospital floors and
// procedural rooftops must not silently fall back to the ground floor.
function abilityGroundY(x, z, reference = player.y || 0) {
  return groundAt(x, z, Number.isFinite(reference) ? reference : 0);
}
function abilityOnFloor(actor, y, height = 2.4) {
  return (actor.y || 0) + 1.8 > y && (actor.y || 0) < y + height;
}
function groundAt(e, t, o) {
  let a = 0;
  for (const n of COLLIDERS)
    e > n.minX - PR &&
      e < n.maxX + PR &&
      t > n.minZ - PR &&
      t < n.maxZ + PR &&
      n.h <= o + STEP_H &&
      n.h > a &&
      (a = n.h);
  return a;
}
function rayBlocked(e, t, o, a, n, r, s) {
  const i = a - e,
    l = n - t,
    c = r - o,
    d = Math.hypot(i, l, c);
  if (d < 0.001) return !1;
  const h = Math.min(90, Math.ceil(d / 1.1));
  for (let a = 1; a < h; a++) {
    const n = a / h,
      r = e + i * n,
      d = t + l * n,
      p = o + c * n;
    for (const e of COLLIDERS)
      if (
        e !== s &&
        d < e.h &&
        d >= (e.y0 || 0) &&
        r > e.minX &&
        r < e.maxX &&
        p > e.minZ &&
        p < e.maxZ
      )
        return !0;
    for (const e of world.smokes)
      if (e.blocksVision && d < e.y + e.r && dist2(r, p, e.x, e.z) < e.r * e.r)
        return !0;
  }
  return !1;
}
const INFINITE_CREDITS = 999999,
  INFINITE_AMMO = 999999;
function topUpReserve(e) {
  if (e && e.reserve) {
    if (e.weapons)
      for (const t in e.weapons) {
        const o = e.weapons[t];
        o && WEAPONS[o] && (e.reserve[o] = 999999);
      }
    for (const t in e.reserve) WEAPONS[t] && (e.reserve[t] = 999999);
  }
}
const world = {
  phase: "buy",
  roundTime: 0,
  round: 1,
  scoreAtk: 0,
  scoreDef: 0,
  playerTeam: "atk",
  entities: [],
  actors: [],
  bullets: [],
  smokes: [],
  zones: [],
  props: [],
  tracers: [],
  spike: {
    state: "carried",
    x: 0,
    z: 0,
    timer: 0,
    planterSite: null,
    mesh: null,
    halfDefused: !1,
    beepT: 0,
    defTick: 0,
    carrier: null,
  },
  stats: { kills: 0, deaths: 0, dmg: 0, shots: 0, hits: 0 },
  over: !1,
};
let player = {
  pos: new T.Vector3(0, 0, 78),
  vel: new T.Vector3(),
  yaw: 0,
  pitch: 0,
  y: 0,
  vy: 0,
  onGround: !0,
  hp: 100,
  armor: 0,
  alive: !0,
  crouch: !1,
  credits: 999999,
  agent: null,
  weapons: { primary: null, secondary: "pistol", knife: "knife" },
  slot: "secondary",
  ammo: {},
  reserve: {},
  reloading: 0,
  fireCd: 0,
  ads: !1,
  recoil: 0,
  recoilY: 0,
  sway: 0,
  bob: 0,
  burstLeft: 0,
  abilities: [],
  ultCharge: 0,
  ultMax: 5,
  blind: 0,
  slow: 1,
  root: 0,
  shielded: 0,
  invuln: 0,
  revealed: 0,
  hasSpike: !1,
  planting: 0,
  defusing: 0,
  plantAnchor: null,
  spectate: null,
  spectateT: 0,
  deathCamYaw: 0,
};
function agentAccent() {
  return player.agent ? player.agent.color : "#ffffff";
}
function giveWeapon(e, t) {
  player.weapons[t] = e;
  const o = WEAPONS[e];
  ((player.ammo[e] = o.mag), (player.reserve[e] = 999999));
}
function curWeaponKey() {
  return player.weapons[player.slot] || "pistol";
}
function curWeapon() {
  return WEAPONS[curWeaponKey()];
}
const keys = {};
let locked = !1;
(addEventListener("keydown", (e) => {
  const t = e.key.toLowerCase();
  if (
    ((keys[t] = !0),
    "Space" === e.code && ((keys.space = !0), FLY.on && e.preventDefault()),
    "menu" !== world.phase)
  )
    return "escape" === t
      ? $("admin").hidden
        ? FLY.on
          ? void exitFly()
          : void togglePause()
        : void closeAdmin()
      : FLY.on
        ? "c" === t
          ? ((FLY.locked = !FLY.locked),
            void banner(FLY.locked ? "시점 고정" : "시점 해제", "#ffc849"))
          : "r" === t
            ? (flyReset(), void banner("시작 지점", "#4ade80"))
            : "ArrowRight" === e.code || "ArrowDown" === e.code
              ? (e.preventDefault(), void flyStepMap(1))
              : "ArrowLeft" === e.code || "ArrowUp" === e.code
                ? (e.preventDefault(), void flyStepMap(-1))
                : void 0
        : void (
            locked &&
            ("b" === t && toggleShop(),
            "r" === t && startReload(),
            "1" === t && player.weapons.primary && switchSlot("primary"),
            "2" === t && switchSlot("secondary"),
            "q" === t && useAbility(0),
            "e" === t && useAbility(1),
            "c" === t && useAbility(2),
            "x" === t && useAbility(3),
            "Space" === e.code && jump())
          );
}),
  addEventListener("keyup", (e) => {
    ((keys[e.key.toLowerCase()] = !1), "Space" === e.code && (keys.space = !1));
  }),
  addEventListener(
    "wheel",
    (e) => {
      FLY.on &&
        (FLY.speed = clamp(FLY.speed * (e.deltaY > 0 ? 0.88 : 1.14), 3, 160));
    },
    { passive: !0 },
  ),
  canvas.addEventListener("mousedown", (e) => {
    if (locked || IS_TOUCH)
      if (player.alive)
        (0 === e.button && (keys.fire = !0),
          2 === e.button && ((keys.ads = !0), (player.ads = !0)));
      else {
        if (player.spectateT > 0) return void (player.spectateT = 0);
        if (world.actors && world.actors.length && 0 === e.button) {
          const e = player.spectate;
          return e && e.alive && isAI(e)
            ? void takeOverAlly(e)
            : void takeOverAlly(null);
        }
        nextSpectate(2 === e.button ? -1 : 1);
      }
    else tryLock();
  }),
  addEventListener("mouseup", (e) => {
    (0 === e.button && (keys.fire = !1),
      2 === e.button && ((keys.ads = !1), (player.ads = !1)));
  }),
  canvas.addEventListener("contextmenu", (e) => e.preventDefault()),
  document.addEventListener("pointerlockchange", () => {
    const e = locked;
    ((locked = document.pointerLockElement === canvas),
      e && !locked && (lockCooldown = performance.now() + 1400),
      updateLockHint(),
      locked ||
        IS_TOUCH ||
        FLY.on ||
        "menu" === world.phase ||
        world.over ||
        !$("pause").hidden ||
        !$("shop").hidden ||
        !$("lobby").hidden ||
        !$("admin").hidden ||
        lockPending ||
        togglePause(!0));
  }),
  document.addEventListener("pointerlockerror", () => {
    ((locked = !1), (lockPending = !1), updateLockHint());
  }),
  document.addEventListener("mousedown", (e) => {
    IS_TOUCH ||
      locked ||
      "menu" === world.phase ||
      world.over ||
      ($("pause").hidden &&
        $("shop").hidden &&
        $("lobby").hidden &&
        $("admin").hidden &&
        (e.target.closest("button, a, input, select") || tryLock()));
  }),
  document.addEventListener("mousemove", (e) => {
    if (!locked) return;
    if (FLY.on) {
      if (FLY.locked) return;
      const t = BASE_SENS * SETTINGS.sens;
      return (
        (FLY.yaw -= e.movementX * t),
        (FLY.pitch -= e.movementY * t),
        void (FLY.pitch = clamp(FLY.pitch, -1.52, 1.52))
      );
    }
    const t = ("function" == typeof myActor && myActor()) || player;
    if (!t) return;
    const o = BASE_SENS * SETTINGS.sens * (t.ads ? SETTINGS.adsSens : 1);
    ((t.yaw -= e.movementX * o),
      (t.pitch -= e.movementY * o),
      (t.pitch = clamp(t.pitch, -1.52, 1.52)),
      t.input && ((t.input.yaw = t.yaw), (t.input.pitch = t.pitch)));
  }));
const AUTO_TOUCH =
  matchMedia("(pointer: coarse)").matches &&
  !matchMedia("(pointer: fine)").matches;
function loadTouchPref() {
  try {
    const e =
      localStorage.getItem("lgp_touch_mode") ??
      localStorage.getItem("lgp_touch_pick") ??
      localStorage.getItem("lgp_touch");
    if ("1" === e) return !0;
    if ("0" === e) return !1;
  } catch (e) {}
  return AUTO_TOUCH;
}
let IS_TOUCH = loadTouchPref();
function saveTouchPref(e) {
  try {
    localStorage.setItem("lgp_touch_mode", e ? "1" : "0");
  } catch (e) {}
}
const touch = {
    on: !1,
    move: { x: 0, y: 0 },
    stickId: null,
    lookId: null,
    lookX: 0,
    lookY: 0,
    sens: 0.0042,
  },
  SET_DEF = {
    sens: 1,
    adsSens: 0.62,
    touchSens: 1,
    shake: !0,
    sfx: !0,
    quality: GRAPHICS_SETTINGS.defaultMode(AUTO_TOUCH || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)),
    showFps: !1,
    dynRes: !0,
    dmgNums: !0,
    motion: 1,
    ultCut: !0,
    slowMo: !1,
  },
  SETTINGS = Object.assign({}, SET_DEF);
function loadSettings() {
  try {
    const e = localStorage.getItem("lgp_set");
    if (e) {
      const t = JSON.parse(e);
      for (const e in SET_DEF) void 0 !== t[e] && (SETTINGS[e] = t[e]);
    }
  } catch (e) {}
  SETTINGS.quality = GRAPHICS_SETTINGS.normalize(SETTINGS.quality, SET_DEF.quality === 'mobile');
}
function saveSettings() {
  try {
    localStorage.setItem("lgp_set", JSON.stringify(SETTINGS));
  } catch (e) {}
}
loadSettings();
const BASE_SENS = 0.0021,
  BASE_TOUCH_SENS = 0.0042;
const touchFireIds = new Set();
function beginTouchFire(event) {
  if (!touch.on) return;
  for (const point of event.changedTouches) touchFireIds.add(point.identifier);
  keys.fire = touchFireIds.size > 0;
}
function endTouchFire(event) {
  if (!touch.on) return;
  for (const point of event.changedTouches) touchFireIds.delete(point.identifier);
  keys.fire = touchFireIds.size > 0;
}
function resetTouchInput() {
  touchFireIds.clear();
  keys.fire = keys.f = false;
  touch.stickId = touch.lookId = null;
  touch.move.x = touch.move.y = 0;
  const knob = $("stick-knob"), stick = $("stick");
  if (knob) knob.style.transform = "translate(0px,0px)";
  if (stick) { stick.style.left = stick.style.top = stick.style.bottom = ""; stick.classList.remove("float"); }
}
addEventListener("blur", resetTouchInput);
addEventListener("visibilitychange", () => { if (document.hidden) resetTouchInput(); });
function disableTouchUI() {
  resetTouchInput();
  ((touch.on = !1),
    (touch.stickId = null),
    (touch.lookId = null),
    (touch.move.x = 0),
    (touch.move.y = 0));
  const e = $("touch");
  e && (e.hidden = !0);
}
function setTouchMode(e) {
  if (
    ((IS_TOUCH = !!e),
    saveTouchPref(IS_TOUCH),
    document.body.classList.toggle("touching", IS_TOUCH),
    IS_TOUCH)
  )
    (document.exitPointerLock(), enableTouch());
  else {
    disableTouchUI();
    const e = !$("pause").hidden || !$("shop").hidden || !$("lobby").hidden;
    "menu" === world.phase || world.over || e || tryLock();
  }
  (updateTouchBtn(), updateLockHint());
}
function toggleTouchMode() {
  setTouchMode(!IS_TOUCH);
}
function updateTouchBtn() {
  const e = $("st-touch");
  e && e.classList.toggle("on", IS_TOUCH);
}
let lockPending = !1,
  lockCooldown = 0;
function tryLock() {
  if (IS_TOUCH) return;
  if (document.pointerLockElement === canvas) return;
  if (performance.now() < lockCooldown) return;
  lockPending = !0;
  const e = () => {
    try {
      const e = canvas.requestPointerLock();
      e &&
        e.catch &&
        e.catch(() => {
          ((lockPending = !1), updateLockHint());
        });
    } catch (e) {
      ((lockPending = !1), updateLockHint());
    }
  };
  let t;
  try {
    t = canvas.requestPointerLock({ unadjustedMovement: !0 });
  } catch (t) {
    e();
  }
  (t && "function" == typeof t.catch && t.catch(e),
    setTimeout(() => {
      ((lockPending = !1), updateLockHint());
    }, 700));
}
function updateLockHint() {
  const e = $("lockhint");
  if (!e) return;
  const t =
    !IS_TOUCH &&
    !locked &&
    (FLY.on || "menu" !== world.phase) &&
    !world.over &&
    $("pause").hidden &&
    $("shop").hidden &&
    $("lobby").hidden &&
    $("admin").hidden;
  e.hidden = !t;
}
let touchBound = false;
function enableTouch() {
  if (!IS_TOUCH || touch.on) return;
  touch.on = !0;
  $("touch").hidden = !1;
  if (touchBound) return;
  touchBound = true;
  const e = $("stick"),
    t = $("stick-knob");
  let o = { x: 0, y: 0 };
  const a = (e, o) => (t.style.transform = `translate(${e}px,${o}px)`);
  (e.addEventListener(
    "touchstart",
    (t) => {
      if (!touch.on || touch.stickId !== null) return;
      t.preventDefault();
      const a = t.changedTouches[0];
      touch.stickId = a.identifier;
      const n = e.getBoundingClientRect();
      o = { x: n.left + n.width / 2, y: n.top + n.height / 2 };
    },
    { passive: !1 },
  ),
    addEventListener(
      "touchmove",
      (e) => {
        if (!touch.on) return;
        for (const t of e.changedTouches)
          if (t.identifier === touch.stickId) {
            let e = t.clientX - o.x,
              n = t.clientY - o.y;
            const r = Math.hypot(e, n);
            (r > 44 && ((e = (e / r) * 44), (n = (n / r) * 44)),
              a(e, n),
              (touch.move.x = e / 44),
              (touch.move.y = n / 44));
          } else if (t.identifier === touch.lookId) {
            const e = t.clientX - touch.lookX,
              o = t.clientY - touch.lookY;
            ((touch.lookX = t.clientX), (touch.lookY = t.clientY));
            const a = ("function" == typeof myActor && myActor()) || player,
              n = 0.0042 * SETTINGS.touchSens * (a.ads ? SETTINGS.adsSens : 1);
            ((a.yaw -= e * n),
              (a.pitch -= o * n),
              (a.pitch = clamp(a.pitch, -1.52, 1.52)),
              a.input && ((a.input.yaw = a.yaw), (a.input.pitch = a.pitch)));
          }
      },
      { passive: !1 },
    ));
  const n = (e) => {
    if (!touch.on) return;
    endTouchFire(e);
    for (const t of e.changedTouches)
      (t.identifier === touch.stickId &&
        ((touch.stickId = null),
        (touch.move.x = 0),
        (touch.move.y = 0),
        a(0, 0)),
        t.identifier === touch.lookId && (touch.lookId = null));
  };
  (addEventListener("touchend", n, { passive: !1 }),
    addEventListener("touchcancel", n, { passive: !1 }),
    canvas.addEventListener(
      "touchstart",
      (e) => {
        if (!touch.on || FLY.on) return;
        e.preventDefault();
        const t = e.changedTouches[0];
        if (!player.alive)
          return (
            nextSpectate(1),
            void (player.spectateT > 0 && (player.spectateT = 0))
          );
        null === touch.lookId &&
          ((touch.lookId = t.identifier),
          (touch.lookX = t.clientX),
          (touch.lookY = t.clientY));
      },
      { passive: !1 },
    ));
  const r = (e, t, o) => {
    e &&
      (e.addEventListener(
        "touchstart",
        (e) => {
          if (touch.on) { e.preventDefault(); t(e); }
        },
        { passive: !1 },
      ),
      e.addEventListener(
        "touchend",
        (e) => {
          (e.preventDefault(), o && o(e));
        },
        { passive: !1 },
      ),
      e.addEventListener(
        "touchcancel",
        (e) => {
          o && o(e);
        },
        { passive: !1 },
      ));
  };
  (r(
    $("tb-fire"),
    beginTouchFire,
    endTouchFire,
  ),
    r(
      $("tb-use"),
      () => {
        keys.f = !0;
      },
      () => {
        keys.f = !1;
      },
    ),
    r($("tb-ads"), () => {
      ((keys.ads = !keys.ads), (player.ads = keys.ads));
    }),
    r($("tb-jump"), () => jump()),
    r($("tb-rel"), () => startReload()),
    r($("tb-shop"), () => toggleShop()),
    r($("tb-menu"), () => togglePause()),
    document.querySelectorAll("#tabil .tab").forEach((e) => {
      r(e, () => useAbility(+e.dataset.a));
    }),
    setInterval(paintTouchAbil, 400),
    paintTouchAbil());
}
function paintTouchAbil() {
  if (!player || !player.abilities) return;
  document.querySelectorAll("#tabil .tab").forEach((e, t) => {
    const o = player.abilities[t],
      a = e.querySelector("b"),
      n = e.querySelector("i");
    if (!o) return void (e.style.display = "none");
    ((e.style.display = ""),
      e.style.setProperty("--ac", agentAccent()),
      (e.title = o.def.name),
      a && (a.textContent = o.def.key),
      n &&
        (o.def.ult
          ? (n.textContent = player.ultCharge + "/" + player.ultMax)
          : (n.textContent = o.cd > 0 ? Math.ceil(o.cd) + "초" : o.charges)));
    const r = o.def.ult
      ? player.ultCharge < player.ultMax
      : o.charges <= 0 || o.cd > 0;
    e.classList.toggle("off", r);
  });
}
function touchLockBypass() {
  return IS_TOUCH;
}
function jump() {
  player.onGround &&
    player.alive &&
    player.root <= 0 &&
    ((player.vy = ADMIN.jumpV), (player.onGround = !1));
}
function switchSlot(e) {
  player.slot !== e &&
    ((player.slot = e), (player.reloading = 0), (player.fireCd = 0.28));
}
function startReload() {
  const e = curWeaponKey(),
    t = WEAPONS[e];
  player.reloading > 0 ||
    player.ammo[e] >= t.mag ||
    (0 | player.reserve[e]) <= 0 ||
    (player.reloading = "sniper" === e ? 2.6 : 1.9);
}
function finishReload() {
  const e = curWeaponKey(),
    t = WEAPONS[e].mag - player.ammo[e],
    o = Math.min(t, player.reserve[e]);
  ((player.ammo[e] += o),
    player.reserve[e] < 999999
      ? (player.reserve[e] -= o)
      : (player.reserve[e] = 999999));
}
function fire() {
  if (
    !player.alive ||
    player.reloading > 0 ||
    player.fireCd > 0 ||
    "end" === world.phase
  )
    return;
  const e = curWeaponKey(),
    t = WEAPONS[e];
  if ("knife" === e) {
    player.fireCd = 60 / t.rpm / (ADMIN.fastFire || 1);
    const e = forwardVec();
    return (
      otherFighters().forEach((o) => {
        if (!o.alive || o.team === player.team) return;
        const a = o.pos.x - player.pos.x,
          n = o.pos.z - player.pos.z,
          r = Math.hypot(a, n);
        r > t.range ||
          (a / r) * e.x + (n / r) * e.z < 0.55 ||
          (damageEntity(o, t.dmg, !1, "player"), hitMarker(!1));
      }),
      world.stats.shots++,
      void viewmodelFireKick()
    );
  }
  if (player.ammo[e] <= 0) return void startReload();
  (player.ammo[e]--,
    (player.fireCd = 60 / t.rpm / (ADMIN.fastFire || 1)),
    world.stats.shots++);
  const o = Math.hypot(player.vel.x, player.vel.z);
  let a = t.spread * (player.ads ? 0.42 : 1);
  a *= 1 + 0.34 * o + (player.onGround ? 0 : 1.5) + 0.7 * player.recoil;
  const n = t.pellets || 1,
    r = new T.Vector3(player.pos.x, player.y + eyeHeight(), player.pos.z);
  for (let o = 0; o < n; o++) {
    const o = player.yaw + rnd(-a, a),
      n = player.pitch + rnd(-a, a);
    hitscan(
      r,
      new T.Vector3(
        -Math.sin(o) * Math.cos(n),
        Math.sin(n),
        -Math.cos(o) * Math.cos(n),
      ),
      t,
      e,
    );
  }
  ((player.recoil = Math.min(
    player.recoil +
      ("sniper" === e || "antimat" === e ? 0.9 : "rifle" === e ? 0.16 : 0.1),
    1.2,
  )),
    (player.pitch +=
      "sniper" === e || "antimat" === e
        ? 0.045
        : "rifle" === e
          ? 0.012
          : 0.008),
    addTracer(r, player.yaw, player.pitch, t.range),
    muzzleFlash(),
    viewmodelFireKick());
}
function hitscan(e, t, o, a) {
  let n = null,
    r = o.range;
  for (const o of otherFighters()) {
    if (!o.alive || o.team === player.team) continue;
    const a = new T.Vector3(o.pos.x - e.x, o.y + 0.95 - e.y, o.pos.z - e.z).dot(
      t,
    );
    if (a < 0 || a > r) continue;
    const s = t.clone().multiplyScalar(a).add(e),
      i = s.y - (o.y + (o.crouch ? 0.74 : 0.95)),
      l = Math.hypot(s.x - o.pos.x, s.z - o.pos.z),
      c = o.y + (o.crouch ? 1.47 : 1.86);
    let d = Math.hypot(s.x - o.pos.x, s.y - c, s.z - o.pos.z) < 0.17;
    (d || (l < 0.56 && Math.abs(i) < (o.crouch ? 0.64 : 0.75))) &&
      (rayBlocked(e.x, e.y, e.z, o.pos.x, o.y + 1, o.pos.z) ||
        ((n = { e: o, head: d, t: a }), (r = a)));
  }
  t.clone().multiplyScalar(r).add(e);
  let s = r,
    i = null;
  const l = Math.ceil(r / 0.75);
  for (let o = 1; o <= l; o++) {
    const a = (o / l) * r,
      n = e.x + t.x * a,
      c = e.y + t.y * a,
      d = e.z + t.z * a;
    if (c < 0) {
      s = a;
      break;
    }
    let h = null;
    for (const e of COLLIDERS)
      if (
        c < e.h &&
        c >= (e.y0 || 0) &&
        n > e.minX &&
        n < e.maxX &&
        d > e.minZ &&
        d < e.maxZ
      ) {
        h = e;
        break;
      }
    if (h) {
      ((s = a), (i = h));
      break;
    }
  }
  if (s < r - 0.15)
    return (
      i && i.destructible && ((i.hp -= o.dmg), i.hp <= 0 && destroyCollider(i)),
      void impactSpark(e.x + t.x * s, e.y + t.y * s, e.z + t.z * s, 10135480)
    );
  if (n) {
    const e = n.t > 0.62 * o.range ? 0.72 : 1;
    let t = o.dmg * e * (n.head ? o.hs : 1);
    (damageEntity(n.e, t, n.head, "player"),
      world.stats.hits++,
      impactSpark(
        n.e.pos.x,
        n.e.y + (n.head ? 1.86 * BODY_K : 1),
        n.e.pos.z,
        n.head ? 16726862 : 16757575,
      ),
      hitMarker(n.head));
  }
}
function destroyCollider(e) {
  (scene.remove(e.mesh), e.mesh.geometry.dispose());
  const t = COLLIDERS.indexOf(e);
  t >= 0 && (COLLIDERS.splice(t, 1), (CHASH.dirty = !0));
}
function eyeHeight() {
  return player.crouch ? CROUCH_EYE : EYE;
}
const fx = [];
function addFx(e, t, o) {
  e.userData.t = 0;
  const a = e.material;
  (a &&
    a.isLineBasicMaterial &&
    !a.userData.hdr &&
    (a.color.multiplyScalar(1.6), (a.userData.hdr = 1)),
    fx.push({ mesh: e, life: t, fn: o }),
    scene.add(e));
}
const FXG = (() => {
    const e = (e) => ((e.userData.shared = !0), e);
    return {
      blood: e(new T.SphereGeometry(0.1, 5, 4)),
      flash: e(new T.PlaneGeometry(0.46, 0.3)),
      shell: e(new T.CylinderGeometry(0.012, 0.012, 0.042, 6)),
    };
  })(),
  SHELL_MAT = new T.MeshStandardMaterial({
    color: 14197577,
    metalness: 0.85,
    roughness: 0.35,
  });
SHELL_MAT.userData.keep = !0;
let _glowTex = null;
const _v3a = new T.Vector3();
function glowTex() {
  if (_glowTex) return _glowTex;
  const e = document.createElement("canvas");
  e.width = e.height = 64;
  const t = e.getContext("2d"),
    o = t.createRadialGradient(32, 32, 0, 32, 32, 32);
  return (
    o.addColorStop(0, "rgba(255,255,255,1)"),
    o.addColorStop(0.18, "rgba(255,255,255,.85)"),
    o.addColorStop(0.45, "rgba(255,255,255,.28)"),
    o.addColorStop(1, "rgba(255,255,255,0)"),
    (t.fillStyle = o),
    t.fillRect(0, 0, 64, 64),
    (_glowTex = new T.CanvasTexture(e)),
    _glowTex
  );
}
function glowDot(e, t, o) {
  const a = new T.SpriteMaterial({
    map: glowTex(),
    color: e,
    transparent: !0,
    depthWrite: !1,
    blending: T.AdditiveBlending,
  });
  a.color.multiplyScalar(o || 1.8);
  const n = new T.Sprite(a);
  return (n.scale.setScalar(t), n);
}
function glowFlare(e, t, o, a, n, r) {
  if (camera.position.distanceTo(_v3a.set(e, t, o)) < 1.3 * n + 2) return;
  const s = glowDot(a, 0.4 * n, 1.5);
  (s.position.set(e, t, o),
    addFx(s, r || 0.35, (e, t) => {
      (e.scale.setScalar(n * (0.4 + 0.9 * t)),
        (e.material.opacity = 0.7 * (1 - t) * (1 - t)));
    }));
}
let _runeTex = null,
  _cloudTex = null;
function runeTex() {
  if (_runeTex) return _runeTex;
  const e = document.createElement("canvas");
  e.width = e.height = 256;
  const t = e.getContext("2d");
  (t.translate(128, 128),
    (t.strokeStyle = "#fff"),
    (t.fillStyle = "#fff"),
    (t.lineCap = "round"));
  const o = (e, o, a) => {
    ((t.globalAlpha = a),
      (t.lineWidth = o),
      t.beginPath(),
      t.arc(0, 0, e, 0, 2 * Math.PI),
      t.stroke());
  };
  (o(122, 4, 0.95), o(112, 1.5, 0.6), o(76, 2.5, 0.7), o(40, 1.5, 0.45));
  for (let e = 0; e < 36; e++) {
    const o = (e / 36) * Math.PI * 2,
      a = e % 3 == 0;
    ((t.globalAlpha = a ? 0.9 : 0.5),
      (t.lineWidth = a ? 3 : 1.5),
      t.beginPath(),
      t.moveTo(Math.cos(o) * (a ? 96 : 102), Math.sin(o) * (a ? 96 : 102)),
      t.lineTo(110 * Math.cos(o), 110 * Math.sin(o)),
      t.stroke());
  }
  ((t.globalAlpha = 0.7), (t.lineWidth = 2), t.beginPath());
  for (let e = 0; e <= 6; e++) {
    const o = (e / 6) * Math.PI * 2 + Math.PI / 6,
      a = 74 * Math.cos(o),
      n = 74 * Math.sin(o);
    e ? t.lineTo(a, n) : t.moveTo(a, n);
  }
  t.stroke();
  for (let e = 0; e < 6; e++) {
    const o = (e / 6) * Math.PI * 2;
    ((t.globalAlpha = 0.4),
      (t.lineWidth = 1.2),
      t.beginPath(),
      t.moveTo(40 * Math.cos(o), 40 * Math.sin(o)),
      t.lineTo(74 * Math.cos(o), 74 * Math.sin(o)),
      t.stroke());
  }
  return ((_runeTex = new T.CanvasTexture(e)), _runeTex);
}
function cloudTex() {
  if (_cloudTex) return _cloudTex;
  const e = 128,
    t = document.createElement("canvas");
  t.width = t.height = e;
  const o = t.getContext("2d");
  for (let t = 0; t < 22; t++) {
    const t = 14 + 30 * Math.random(),
      a = 64 + 48 * (Math.random() - 0.5),
      n = 64 + 48 * (Math.random() - 0.5),
      r = o.createRadialGradient(a, n, 0, a, n, t);
    (r.addColorStop(0, "rgba(255,255,255,.55)"),
      r.addColorStop(0.6, "rgba(255,255,255,.2)"),
      r.addColorStop(1, "rgba(255,255,255,0)"),
      (o.fillStyle = r),
      o.fillRect(0, 0, e, e));
  }
  o.globalCompositeOperation = "destination-in";
  const a = o.createRadialGradient(64, 64, 25.6, 64, 64, 64);
  return (
    a.addColorStop(0, "rgba(0,0,0,1)"),
    a.addColorStop(1, "rgba(0,0,0,0)"),
    (o.fillStyle = a),
    o.fillRect(0, 0, e, e),
    (_cloudTex = new T.CanvasTexture(t)),
    _cloudTex
  );
}
const FX_LIGHTS = [];
function fxLightPool() {
  if (FX_LIGHTS.length)
    for (const e of FX_LIGHTS) e.parent !== scene && scene.add(e);
  else
    for (let e = 0; e < 4; e++) {
      const e = new T.PointLight(16777215, 0, 10, 2);
      ((e.userData.keep = !0),
        (e._life = 0),
        (e._t = 0),
        (e._peak = 0),
        (e._pow = 2),
        scene.add(e),
        FX_LIGHTS.push(e));
    }
}
function fxFlash(e, t, o, a, n, r, s, i) {
  fxLightPool();
  let l = null,
    c = 1 / 0;
  for (const e of FX_LIGHTS) {
    const t = e._life > 0 ? e._peak * Math.pow(1 - e._t / e._life, e._pow) : -1;
    t < c && ((c = t), (l = e));
  }
  const d = Math.hypot(camera.position.x - a, camera.position.z - r);
  return (
    d < 5 && (t *= 0.3 + 0.14 * d),
    l.color.setHex(e),
    (l.distance = o),
    l.position.set(a, n, r),
    (l._peak = t),
    (l._life = s),
    (l._t = 0),
    (l._pow = null == i ? 2 : i),
    (l._peak = 3 * t),
    (l.intensity = l._peak),
    l
  );
}
function tickFxLights(e) {
  for (const t of FX_LIGHTS) {
    if (t._life <= 0) continue;
    t._t += e;
    const o = t._t / t._life;
    o >= 1
      ? ((t._life = 0), (t.intensity = 0))
      : (t.intensity = t._peak * Math.pow(1 - o, t._pow));
  }
}
function impactSpark(e, t, o, a) {
  const n = glowDot(a, 0.55);
  (n.position.set(e, t, o),
    addFx(n, 0.22, (e, t) => {
      ((e.material.opacity = 1 - t), e.scale.setScalar(0.55 * (1 + 1.4 * t)));
    }));
}
function addTracer(e, t, o, a) {
  const n = new T.Vector3(
      -Math.sin(t) * Math.cos(o),
      Math.sin(o),
      -Math.cos(t) * Math.cos(o),
    ),
    r = new T.BufferGeometry().setFromPoints([
      e.clone().add(n.clone().multiplyScalar(1.4)),
      e.clone().add(n.clone().multiplyScalar(Math.min(a, 70))),
    ]);
  addFx(
    new T.Line(
      r,
      new T.LineBasicMaterial({
        color: 16773312,
        transparent: !0,
        opacity: 0.7,
      }),
    ),
    0.07,
    (e, t) => {
      e.material.opacity = 0.7 * (1 - t);
    },
  );
}
let flashLight = null;
function muzzleFlash() {
  fxFlash(
    16766602,
    0.9,
    14,
    player.pos.x,
    player.y + eyeHeight(),
    player.pos.z,
    0.07,
    1,
  );
}
const MZ_LIGHTS = [];
let _mzIdx = 0;
function muzzleLightPool() {
  if (MZ_LIGHTS.length < 3) {
    const e = new T.PointLight(16762992, 0, 9);
    return (scene.add(e), MZ_LIGHTS.push(e), e);
  }
  return ((_mzIdx = (_mzIdx + 1) % MZ_LIGHTS.length), MZ_LIGHTS[_mzIdx]);
}
function worldMuzzleFlash(e) {
  if (!e || !e.model) return;
  const t = e.model.muzzle,
    o = new T.Vector3();
  t ? t.getWorldPosition(o) : o.set(e.pos.x, e.y + 1.35, e.pos.z);
  const a = new T.MeshBasicMaterial({
      color: 16768922,
      transparent: !0,
      opacity: 0.95,
      side: T.DoubleSide,
      depthWrite: !1,
    }),
    n = new T.Group();
  for (let e = 0; e < 2; e++) {
    const t = new T.Mesh(FXG.flash, a);
    ((t.rotation.z = (e * Math.PI) / 2), n.add(t));
  }
  (n.position.copy(o), n.lookAt(camera.position));
  const r = 0.7 + 0.5 * Math.random();
  (addFx(n, 0.055, (e, t) => {
    (e.scale.setScalar(r * (1 + 1.3 * t)), (a.opacity = 0.95 * (1 - t)));
  }),
    fxFlash(16762992, 0.75, 9, o.x, o.y, o.z, 0.07, 1),
    GFX.shells && Math.random() < 0.8 * (GFX.fx || 1) && ejectShell(o, e.yaw));
}
function ejectShell(e, t) {
  const o = new T.Mesh(FXG.shell, SHELL_MAT);
  o.position.copy(e);
  const a = new T.Vector3(Math.cos(t), 0, -Math.sin(t)).multiplyScalar(
    1.9 + 1.1 * Math.random(),
  );
  ((a.y = 2.1 + 0.9 * Math.random()),
    addFx(o, 0.55, (e, t, o) => {
      const n = o || 0.016;
      (e.position.addScaledVector(a, n),
        (a.y -= 11 * n),
        (e.rotation.x += 13 * n),
        (e.rotation.z += 9 * n));
    }));
}
function worldTracer(e, t, o) {
  const a = e.model && e.model.muzzle,
    n = new T.Vector3();
  a ? a.getWorldPosition(n) : n.set(e.pos.x, e.y + 1.35, e.pos.z);
  const r = new T.BufferGeometry().setFromPoints([
    n.clone(),
    n.clone().add(t.clone().multiplyScalar(Math.min(o, 75))),
  ]);
  addFx(
    new T.Line(
      r,
      new T.LineBasicMaterial({
        color: 16771504,
        transparent: !0,
        opacity: 0.55,
      }),
    ),
    0.06,
    (e, t) => {
      e.material.opacity = 0.55 * (1 - t);
    },
  );
}
function hitMarker(e) {
  const t = $("cross");
  ((t.style.filter = e
    ? "drop-shadow(0 0 5px #ff3b4e)"
    : "drop-shadow(0 0 4px #fff)"),
    clearTimeout(t._t),
    (t._t = setTimeout(() => {
      t.style.filter = "";
    }, 110)));
}
function bloodBurst(e, t, o, a) {
  const n = Math.max(2, Math.round(7 * (GFX.fx || 1)));
  for (let r = 0; r < n; r++) {
    const n = new T.Mesh(
      FXG.blood,
      new T.MeshBasicMaterial({ color: a, transparent: !0 }),
    );
    n.position.set(e, t, o);
    const r = new T.Vector3(rnd(-3, 3), rnd(1, 4.5), rnd(-3, 3));
    addFx(n, 0.62, (e, t, o) => {
      ((r.y -= 12 * o),
        e.position.addScaledVector(r, o),
        (e.material.opacity = 1 - t));
    });
  }
}
function allFighters() {
  return world.actors && world.actors.length ? world.actors : world.entities;
}
function otherFighters() {
  const e = allFighters();
  return world.actors && world.actors.length
    ? e.filter((e) => e !== player)
    : e;
}
function enemyFighters(e) {
  const t = e || (player ? player.team : "atk");
  return otherFighters().filter((e) => e.team !== t);
}
function allyFighters(e) {
  const t = e || (player ? player.team : "atk");
  return otherFighters().filter((e) => e.team === t);
}
function hurtFighter(e, t, o, a) {
  e &&
    (world.actors && world.actors.length && world.actors.indexOf(e) >= 0
      ? dealDamage(e, t, o, a || player)
      : damageEntity(e, t, o, a));
}
function stunFighter(e, t) {
  e &&
    (e.ai && e.ai.skill
      ? (e.ai.skill.cd = Math.max(e.ai.skill.cd || 0, t))
      : e.skill && (e.skill.cd = Math.max(e.skill.cd || 0, t)));
}
const CH_STYLE = {
    hwaryeong: {
      w: 1,
      bulk: 0.98,
      skin: 13209452,
      hair: 13185567,
      eye: 3808786,
      coat: 5904922,
      trim: 16747066,
    },
    seorin: {
      w: 0.96,
      bulk: 0.92,
      skin: 15521480,
      hair: 13952756,
      eye: 3828362,
      coat: 1911364,
      trim: 10478591,
    },
    muyeong: {
      w: 0.92,
      bulk: 0.9,
      skin: 12094060,
      hair: 1774626,
      eye: 14257407,
      coat: 2234923,
      trim: 13073919,
    },
    gangcheol: {
      w: 1.18,
      bulk: 1.22,
      skin: 10777434,
      hair: 2760988,
      eye: 2759184,
      coat: 14712862,
      trim: 15909166,
    },
    yeonhwa: {
      w: 0.94,
      bulk: 0.9,
      skin: 14464663,
      hair: 1779232,
      eye: 2760728,
      coat: 3107658,
      trim: 10868391,
    },
    noeun: {
      w: 0.95,
      bulk: 0.96,
      skin: 14068104,
      hair: 14726458,
      eye: 3811864,
      coat: 13210910,
      trim: 16766287,
    },
    baekho: {
      w: 1.02,
      bulk: 0.96,
      skin: 13609359,
      hair: 15132394,
      eye: 2763312,
      coat: 15132392,
      trim: 1710620,
    },
    _default: {
      w: 1,
      bulk: 1,
      skin: 11897454,
      hair: 2761760,
      eye: 2236962,
      coat: 3818064,
      trim: 9082795,
    },
  },
  CH_MAT = new Map(),
  CH_KIND = {
    skin: { roughness: 0.72, metalness: 0 },
    hair: { roughness: 0.6, metalness: 0.04 },
    cloth: { roughness: 0.93, metalness: 0 },
    leather: { roughness: 0.46, metalness: 0.08 },
    metal: { roughness: 0.3, metalness: 0.85 },
    paint: { roughness: 0.44, metalness: 0.3 },
    rubber: { roughness: 0.96, metalness: 0 },
    glass: { roughness: 0.1, metalness: 0.35 },
    fur: { roughness: 1, metalness: 0 },
  },
  CH_RIM = { value: new T.Color(10467544).multiplyScalar(0.55) };
function chRim(e) {
  return (
    (e.onBeforeCompile = (e) => {
      ((e.uniforms.uRim = CH_RIM),
        (e.fragmentShader =
          "uniform vec3 uRim;\n" +
          e.fragmentShader.replace(
            "#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n  { float fr = 1.0 - saturate(dot(normal, normalize(vViewPosition)));\n    totalEmissiveRadiance += uRim * diffuseColor.rgb * 1.6 * fr*fr*fr + uRim * 0.35 * fr*fr*fr*fr; }",
          )));
    }),
    (e.customProgramCacheKey = () => "chrim"),
    (e.userData.envK = 1.25),
    (e.envMapIntensity = 1.2),
    e
  );
}
function chMat(e, t, o) {
  const a = e + "|" + t + (o ? "|x" : "");
  let n = CH_MAT.get(a);
  return (
    n ||
    ((n = chRim(
      new T.MeshStandardMaterial(
        Object.assign({ color: e }, CH_KIND[t] || CH_KIND.cloth, o || {}),
      ),
    )),
    (n.userData.chv = !0),
    CH_MAT.set(a, n),
    n)
  );
}
function chGlow(e, t) {
  const o = e + "|glow|" + (t || 1);
  let a = CH_MAT.get(o);
  return (
    a ||
    ((a = new T.MeshStandardMaterial({
      color: e,
      emissive: e,
      emissiveIntensity: 1.9 * (t || 1.1),
      roughness: 0.4,
    })),
    (a.userData.chv = !0),
    CH_MAT.set(o, a),
    a)
  );
}
const CH_GEO = new Map();
function chGeo(e, t) {
  let o = CH_GEO.get(e);
  return (o || ((o = t()), CH_GEO.set(e, o)), o);
}
const G_BOX = (e, t, o) =>
    chGeo(`b${e},${t},${o}`, () => new T.BoxGeometry(e, t, o)),
  G_SPH = (e, t, o) =>
    chGeo(
      `s${e},${t || 10},${o || 8}`,
      () => new T.SphereGeometry(e, t || 10, o || 8),
    ),
  G_HSPH = (e, t) =>
    chGeo(
      `h${e},${t}`,
      () => new T.SphereGeometry(e, 14, 9, 0, 2 * Math.PI, 0, Math.PI * t),
    ),
  G_CAP = (e, t) =>
    chGeo(`c${e},${t}`, () => new T.CapsuleGeometry(e, t, 3, 9)),
  G_CYL = (e, t, o, a) =>
    chGeo(
      `y${e},${t},${o},${a || 8}`,
      () => new T.CylinderGeometry(e, t, o, a || 8),
    ),
  G_CONE = (e, t, o) =>
    chGeo(`k${e},${t},${o || 6}`, () => new T.ConeGeometry(e, t, o || 6)),
  G_TOR = (e, t, o, a) =>
    chGeo(
      `t${e},${t},${o || 6},${a || 16}`,
      () => new T.TorusGeometry(e, t, o || 6, a || 16),
    ),
  G_HOOD = () =>
    chGeo(
      "hood",
      () =>
        new T.SphereGeometry(
          0.162,
          14,
          10,
          1.5 * Math.PI + 0.95,
          2 * Math.PI - 1.9,
          0,
          0.74 * Math.PI,
        ),
    ),
  CH_VC = (() => {
    const e = new T.MeshStandardMaterial({
      vertexColors: !0,
      roughness: 1,
      metalness: 1,
    });
    return (
      (e.onBeforeCompile = (e) => {
        ((e.uniforms.uRim = CH_RIM),
          (e.vertexShader =
            "attribute vec2 chrm;\nattribute vec3 chem;\nvarying vec2 vRM;\nvarying vec3 vEM;\n" +
            e.vertexShader.replace(
              "#include <begin_vertex>",
              "#include <begin_vertex>\n  vRM = chrm; vEM = chem;",
            )),
          (e.fragmentShader =
            "uniform vec3 uRim;\nvarying vec2 vRM;\nvarying vec3 vEM;\n" +
            e.fragmentShader
              .replace(
                "float roughnessFactor = roughness;",
                "float roughnessFactor = vRM.x;",
              )
              .replace(
                "float metalnessFactor = metalness;",
                "float metalnessFactor = vRM.y;",
              )
              .replace(
                "#include <emissivemap_fragment>",
                "#include <emissivemap_fragment>\n  totalEmissiveRadiance += vEM;\n  { float fr = 1.0 - saturate(dot(normal, normalize(vViewPosition)));\n    totalEmissiveRadiance += uRim * diffuseColor.rgb * 1.6 * fr*fr*fr + uRim * 0.35 * fr*fr*fr*fr; }",
              )));
      }),
      (e.customProgramCacheKey = () => "chvc"),
      (e.envMapIntensity = 1.2),
      (e.userData.keep = !0),
      e
    );
  })();
let _chVCGhost = null;
function chVCGhost() {
  if (_chVCGhost) return _chVCGhost;
  const e = CH_VC.clone();
  return (
    (e.onBeforeCompile = CH_VC.onBeforeCompile),
    (e.customProgramCacheKey = CH_VC.customProgramCacheKey),
    (e.transparent = !0),
    (e.opacity = 0.8),
    (e.envMapIntensity = CH_VC.envMapIntensity),
    (e.userData.keep = !0),
    (_chVCGhost = e)
  );
}
const DECOY_POOL = {};
function chBakeVC(e) {
  const t = [];
  for (const o of e.children) {
    if (!o.isMesh || o.userData.live) continue;
    const e = o.material;
    e &&
      e.userData &&
      e.userData.chv &&
      !e.transparent &&
      e.side === T.FrontSide &&
      t.push(o);
  }
  if (t.length < 2) return;
  const o = [];
  let a = 0,
    n = !1;
  for (const r of t) {
    r.updateMatrix();
    const t = r.geometry.index ? r.geometry.toNonIndexed() : r.geometry.clone();
    (t.applyMatrix4(r.matrix),
      o.push([t, r.material]),
      (a += t.attributes.position.count),
      r.userData.cast && (n = !0),
      e.remove(r));
  }
  const r = new Float32Array(3 * a),
    s = new Float32Array(3 * a),
    i = new Float32Array(3 * a),
    l = new Float32Array(2 * a),
    c = new Float32Array(3 * a);
  let d = 0;
  for (const [e, t] of o) {
    const o = e.attributes.position.count;
    (r.set(e.attributes.position.array, 3 * d),
      s.set(e.attributes.normal.array, 3 * d));
    const a = t.emissiveIntensity || 0,
      n = t.emissive ? t.emissive.r * a : 0,
      h = t.emissive ? t.emissive.g * a : 0,
      p = t.emissive ? t.emissive.b * a : 0;
    for (let e = 0; e < o; e++) {
      const o = 3 * (d + e),
        a = 2 * (d + e);
      ((i[o] = t.color.r),
        (i[o + 1] = t.color.g),
        (i[o + 2] = t.color.b),
        (l[a] = t.roughness),
        (l[a + 1] = t.metalness),
        (c[o] = n),
        (c[o + 1] = h),
        (c[o + 2] = p));
    }
    ((d += o), e.dispose());
  }
  const h = new T.BufferGeometry();
  (h.setAttribute("position", new T.BufferAttribute(r, 3)),
    h.setAttribute("normal", new T.BufferAttribute(s, 3)),
    h.setAttribute("color", new T.BufferAttribute(i, 3)),
    h.setAttribute("chrm", new T.BufferAttribute(l, 2)),
    h.setAttribute("chem", new T.BufferAttribute(c, 3)),
    h.computeBoundingSphere());
  const p = new T.Mesh(h, CH_VC);
  ((p.userData.cast = n),
    (p.castShadow = n),
    (p.userData.baked = !0),
    e.add(p));
}
function chBake(e) {
  chBakeVC(e);
  const t = new Map();
  for (const o of e.children) {
    if (!o.isMesh || o.userData.live) continue;
    const e = o.material.uuid;
    let a = t.get(e);
    (a || ((a = []), t.set(e, a)), a.push(o));
  }
  for (const o of t.values()) {
    if (o.length < 2) continue;
    const t = [];
    let a = 0,
      n = !1;
    for (const r of o) {
      r.updateMatrix();
      const o = r.geometry.index
        ? r.geometry.toNonIndexed()
        : r.geometry.clone();
      (o.applyMatrix4(r.matrix),
        t.push(o),
        (a += o.attributes.position.count),
        r.userData.cast && (n = !0),
        e.remove(r));
    }
    const r = new Float32Array(3 * a),
      s = new Float32Array(3 * a),
      i = new Float32Array(2 * a);
    let l = 0;
    for (const e of t) {
      const t = e.attributes.position.count;
      (r.set(e.attributes.position.array, 3 * l),
        s.set(e.attributes.normal.array, 3 * l),
        e.attributes.uv && i.set(e.attributes.uv.array, 2 * l),
        (l += t),
        e.dispose());
    }
    const c = new T.BufferGeometry();
    (c.setAttribute("position", new T.BufferAttribute(r, 3)),
      c.setAttribute("normal", new T.BufferAttribute(s, 3)),
      c.setAttribute("uv", new T.BufferAttribute(i, 2)),
      c.computeBoundingSphere());
    const d = new T.Mesh(c, o[0].material);
    ((d.userData.cast = n),
      (d.castShadow = n),
      (d.userData.baked = !0),
      e.add(d));
  }
}
function chDispose(group) {
  if (!group) return;
  const geometries = new Set();
  group.traverse((node) => {
    if (node.isMesh && node.userData.baked && node.geometry) geometries.add(node.geometry);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of group.userData.ownedMaterials || []) material.dispose();
  group.userData.ownedMaterials = [];
}
const TP_GUN = {
    body: new T.BoxGeometry(0.075, 0.115, 0.46),
    barrel: new T.CylinderGeometry(0.022, 0.022, 0.3, 6),
    mag: new T.BoxGeometry(0.055, 0.17, 0.075),
    stock: new T.BoxGeometry(0.06, 0.1, 0.2),
    grip: new T.BoxGeometry(0.05, 0.14, 0.06),
    mBody: new T.MeshStandardMaterial({
      color: 3818062,
      roughness: 0.55,
      metalness: 0.6,
    }),
    mDark: new T.MeshStandardMaterial({
      color: 2238511,
      roughness: 0.6,
      metalness: 0.5,
    }),
  },
  CH_OUTFIT = {
    hwaryeong(e) {
      const {
          add: t,
          S: o,
          hips: a,
          chest: n,
          neck: r,
          armL: s,
          armR: i,
          legL: l,
          legR: c,
        } = e,
        d = o.w,
        h = chMat(5904922, "leather"),
        p = chMat(16747066, "paint"),
        u = chMat(1776159, "cloth"),
        m = chMat(o.hair, "hair"),
        f = chGlow(16742956, 1.25),
        y = chGlow(16757575, 1.4),
        M = chMat(13214282, "metal"),
        w = chMat(2759186, "leather"),
        T = chMat(2763310, "metal");
      (t(n, G_SPH(0.225, 12, 10), h, 0, 0.28, 0, {
        s: [1.05 * d, 0.78, 0.74],
        sh: 1,
      }),
        t(n, G_BOX(0.1, 0.22, 0.02), u, 0, 0.24, -0.166),
        t(n, G_BOX(0.44 * d, 0.035, 0.25), h, 0, 0.12, 0),
        [-1, 1].forEach((e) => {
          (t(n, G_BOX(0.012, 0.22, 0.012), p, 0.057 * e, 0.24, -0.172),
            t(n, G_BOX(0.1, 0.09, 0.03), h, 0.1 * e, 0.43, -0.09, {
              r: [-0.5, 0, 0.38 * e],
            }));
        }),
        t(n, G_BOX(0.24, 0.1, 0.03), h, 0, 0.45, 0.08, { r: [0.35, 0, 0] }),
        t(a, G_BOX(0.4 * d, 0.05, 0.27), w, 0, 0.09, 0),
        t(a, G_BOX(0.07, 0.05, 0.02), M, 0, 0.09, -0.142),
        t(a, G_BOX(0.08, 0.1, 0.06), w, 0.21 * d, -0.02, -0.02),
        [l, c].forEach((e) =>
          t(
            e.leg,
            G_BOX(0.11, 0.11, 0.06),
            chMat(9314070, "paint"),
            0,
            -0.4,
            -0.075,
          ),
        ),
        t(i.fore, G_CYL(0.07, 0.08, 0.2, 9), T, 0, -0.13, 0, { sh: 1 }));
      for (let e = 0; e < 3; e++)
        t(i.fore, G_BOX(0.076, 0.012, 0.03), f, 0, -0.075 - 0.045 * e, -0.072);
      (t(i.fore, G_TOR(0.078, 0.01, 4, 14), f, 0, -0.035, 0, {
        r: [Math.PI / 2, 0, 0],
      }),
        t(
          s.fore,
          G_CYL(0.061, 0.061, 0.16, 9),
          chMat(14208964, "cloth"),
          0,
          -0.13,
          0,
        ),
        t(r, G_HSPH(0.128, 0.56), m, 0, 0.235, 0.008, {
          s: [0.96, 1.05, 1.08],
          sh: 1,
        }),
        t(r, G_SPH(0.075, 10, 8), m, 0.025, 0.295, -0.085, {
          s: [1.55, 0.55, 0.95],
          r: [0.25, 0, -0.28],
        }),
        t(r, G_SPH(0.05, 8, 6), m, -0.07, 0.285, -0.075, {
          s: [1.1, 0.6, 0.9],
          r: [0.2, 0, 0.3],
        }),
        [-1, 1].forEach((e) =>
          t(r, G_CAP(0.022, 0.05), m, 0.112 * e, 0.215, -0.03),
        ),
        t(r, G_SPH(0.05), m, 0, 0.34, 0.08),
        t(r, G_CONE(0.052, 0.21, 7), m, 0, 0.4, 0.15, {
          r: [1.05, 0, 0],
          sh: 1,
        }),
        t(r, G_CONE(0.044, 0.19, 7), m, 0, 0.43, 0.27, {
          r: [1.45, 0, 0],
          sh: 1,
        }),
        [
          [-0.35, 0],
          [0, 0.03],
          [0.35, 0],
        ].forEach(([e, o]) =>
          t(r, G_CONE(0.028, 0.11, 5), y, 0.08 * e, 0.44 + o, 0.37, {
            r: [1.35, 0, e],
          }),
        ));
    },
    seorin(e) {
      const {
          add: t,
          S: o,
          hips: a,
          chest: n,
          neck: r,
          armR: s,
          legL: i,
          legR: l,
        } = e,
        c = o.w,
        d = chMat(1911364, "cloth"),
        h = chMat(1450298, "cloth"),
        p = chGlow(10478591, 0.75),
        u = chGlow(12578815, 1.25),
        m = chMat(o.hair, "hair"),
        f = chMat(11061472, "metal"),
        y = chMat(14674159, "leather");
      (t(n, G_SPH(0.22, 12, 10), d, 0, 0.25, 0, {
        s: [1.02 * c, 0.95, 0.75],
        sh: 1,
      }),
        t(n, G_CYL(0.1, 0.12, 0.14, 12), d, 0, 0.45, 0),
        t(n, G_TOR(0.105, 0.012, 5, 16), p, 0, 0.52, 0, {
          r: [Math.PI / 2, 0, 0],
        }),
        [-1, 1].forEach((e) =>
          t(n, G_BOX(0.012, 0.36, 0.012), p, 0.05 * e, 0.22, -0.166),
        ),
        t(a, G_BOX(0.36 * c, 0.05, 0.25), y, 0, 0.12, 0),
        t(a, G_BOX(0.06, 0.05, 0.02), f, 0, 0.12, -0.13),
        t(a, G_BOX(0.34, 0.62, 0.03), h, 0, -0.24, 0.13, {
          r: [0.08, 0, 0],
          sh: 1,
        }),
        [-1, 1].forEach((e) => {
          (t(a, G_BOX(0.15, 0.58, 0.03), h, 0.12 * e, -0.22, -0.12, {
            r: [-0.08, 0.1 * e, 0],
            sh: 1,
          }),
            t(a, G_BOX(0.03, 0.58, 0.2), h, 0.19 * e, -0.22, 0, {
              r: [0, 0, 0.08 * e],
            }));
        }),
        t(a, G_BOX(0.34, 0.015, 0.035), p, 0, -0.55, 0.145),
        t(n, G_SPH(0.09), f, 0.27 * c, 0.37, 0, { s: [1.1, 0.6, 1.1], sh: 1 }),
        t(n, G_CONE(0.05, 0.26, 4), u, 0.3 * c, 0.48, -0.02, {
          r: [0, 0.7, -0.5],
          sh: 1,
        }),
        t(n, G_CONE(0.04, 0.2, 4), u, 0.34 * c, 0.43, 0.07, {
          r: [0.3, 0.2, -0.85],
        }),
        t(n, G_CONE(0.034, 0.16, 4), u, 0.25 * c, 0.46, 0.06, {
          r: [-0.25, 0.5, -0.3],
        }),
        t(s.fore, G_CYL(0.064, 0.064, 0.06, 10), y, 0, -0.18, 0),
        t(e.armL.fore, G_CYL(0.064, 0.064, 0.06, 10), y, 0, -0.18, 0),
        [i, l].forEach((e) =>
          t(e.shin, G_CAP(0.074, 0.26), chMat(13620957, "leather"), 0, -0.2, 0),
        ),
        t(r, G_HSPH(0.13, 0.56), m, 0, 0.235, 0.01, {
          s: [0.97, 1.04, 1.1],
          sh: 1,
        }),
        t(r, G_SPH(0.09, 12, 8), m, 0, 0.29, -0.092, {
          s: [1.42, 0.42, 0.78],
          r: [0.2, 0, 0],
        }),
        [-1, 1].forEach((e) =>
          t(r, G_CAP(0.032, 0.17), m, 0.112 * e, 0.15, -0.025, {
            s: [1, 1, 1.5],
          }),
        ),
        t(r, G_CAP(0.1, 0.3), m, 0, -0.03, 0.1, {
          s: [1.18, 1, 0.42],
          r: [0.14, 0, 0],
          sh: 1,
        }),
        t(r, G_BOX(0.19, 0.018, 0.02), u, 0, 0.238, -0.114));
    },
    muyeong(e) {
      const {
          add: t,
          S: o,
          hips: a,
          chest: n,
          neck: r,
          armL: s,
          armR: i,
          legL: l,
          legR: c,
        } = e,
        d = o.w,
        h = chMat(2234923, "cloth"),
        p = chMat(3878216, "cloth"),
        u = chMat(1774626, "cloth", { side: T.DoubleSide }),
        m = chMat(3811914, "cloth"),
        f = chMat(2957114, "cloth", { side: T.DoubleSide }),
        y = chMat(5909880, "cloth"),
        M = chMat(9080729, "metal"),
        w = chGlow(13073919, 1),
        g = chMat(1709080, "leather");
      (t(n, G_SPH(0.205, 12, 10), h, 0, 0.25, 0, { s: [d, 0.95, 0.74], sh: 1 }),
        t(n, G_BOX(0.05, 0.36, 0.02), p, -0.02, 0.24, -0.155, {
          r: [0, 0, 0.45],
        }),
        t(r, G_HOOD(), u, 0, 0.245, 0.02, { s: [1, 1.08, 1.12], sh: 1 }),
        t(r, G_CONE(0.07, 0.17, 6), u, 0, 0.37, 0.13, { r: [1, 0, 0], sh: 1 }),
        t(r, G_SPH(0.1), m, 0, 0.17, -0.035, { s: [1.02, 0.75, 1.05] }),
        t(n, G_BOX(0.07, 0.36, 0.015), m, 0.06, 0.3, 0.17, {
          r: [0.35, 0, 0.15],
        }),
        t(n, G_BOX(0.06, 0.28, 0.015), m, -0.02, 0.24, 0.18, {
          r: [0.25, 0, -0.08],
        }),
        t(n, G_SPH(0.09), f, -0.25 * d, 0.37, 0, { s: [1.25, 0.7, 1.25] }),
        t(n, G_BOX(0.26, 0.46, 0.02), f, -0.14, 0.14, 0.16, {
          r: [0.12, 0, 0.18],
          sh: 1,
        }),
        [
          [-0.22, -0.1],
          [-0.14, -0.12],
          [-0.06, -0.09],
        ].forEach(([e, o]) =>
          t(n, G_CONE(0.04, 0.1, 4), f, e, o, 0.17, { r: [Math.PI, 0, 0] }),
        ),
        t(a, G_BOX(0.37 * d, 0.07, 0.26), y, 0, 0.1, 0),
        t(a, G_BOX(0.05, 0.18, 0.02), y, 0.12, -0.02, -0.135, {
          r: [0, 0, 0.1],
        }),
        [-1, 1].forEach((e) => {
          (t(a, G_BOX(0.03, 0.5, 0.012), M, 0, 0.14, 0.165, {
            r: [0, 0, 0.62 * e],
            sh: 1,
          }),
            t(a, G_BOX(0.008, 0.48, 0.014), w, 0, 0.14, 0.172, {
              r: [0, 0, 0.62 * e],
            }),
            t(a, G_CYL(0.018, 0.018, 0.12, 6), g, 0.18 * e, 0.33, 0.165, {
              r: [0, 0, 0.62 * e],
            }));
        }),
        [s, i].forEach((e) => {
          (t(e.fore, G_CYL(0.058, 0.058, 0.14, 9), p, 0, -0.14, 0),
            t(e.fore, G_TOR(0.06, 0.007, 4, 12), w, 0, -0.06, 0, {
              r: [Math.PI / 2, 0, 0],
            }));
        }),
        [l, c].forEach((e) =>
          t(e.shin, G_CYL(0.072, 0.072, 0.18, 9), p, 0, -0.17, 0),
        ));
    },
    gangcheol(e) {
      const {
          add: t,
          S: o,
          hips: a,
          chest: n,
          neck: r,
          armL: s,
          armR: i,
          legL: l,
          legR: c,
        } = e,
        d = o.w,
        h = chMat(14712862, "paint"),
        p = chMat(15909166, "paint"),
        u = chMat(1447450, "paint"),
        m = chMat(6975867, "metal"),
        f = chMat(3817287, "metal"),
        y = chMat(12633806, "metal"),
        M = chMat(2762272, "leather"),
        w = chMat(o.hair, "hair"),
        T = chGlow(16754470, 0.9);
      (t(n, G_BOX(0.4 * d, 0.3, 0.08), h, 0, 0.28, -0.15, { sh: 1 }),
        t(n, G_BOX(0.4 * d, 0.05, 0.012), p, 0, 0.155, -0.192));
      for (let e = 0; e < 5; e++)
        t(
          n,
          G_BOX(0.018, 0.07, 0.013),
          u,
          (0.08 * e - 0.16) * d,
          0.155,
          -0.196,
          { r: [0, 0, 0.6] },
        );
      (t(n, G_BOX(0.42 * d, 0.34, 0.08), h, 0, 0.26, 0.15, { sh: 1 }),
        [-1, 1].forEach((e) =>
          t(n, G_BOX(0.04, 0.3, 0.3), M, 0.2 * e * d, 0.27, 0),
        ),
        t(n, G_SPH(0.17, 12, 9), h, 0.33 * d, 0.4, 0, {
          s: [1.15, 0.72, 1.15],
          sh: 1,
        }),
        t(n, G_BOX(0.3, 0.05, 0.3), m, 0.34 * d, 0.36, 0, { r: [0, 0, -0.35] }),
        t(n, G_BOX(0.3, 0.02, 0.31), p, 0.35 * d, 0.335, 0, {
          r: [0, 0, -0.35],
        }),
        t(n, G_SPH(0.12), m, -0.3 * d, 0.39, 0, { s: [1.1, 0.6, 1.1], sh: 1 }),
        t(n, G_BOX(0.3, 0.26, 0.12), f, 0, 0.28, 0.23, { sh: 1 }),
        [-1, 1].forEach((e) => {
          (t(n, G_CYL(0.035, 0.04, 0.3, 8), m, 0.09 * e, 0.5, 0.25, { sh: 1 }),
            t(n, G_CYL(0.03, 0.03, 0.02, 8), T, 0.09 * e, 0.655, 0.25));
        }),
        [
          [s, -1],
          [i, 1],
        ].forEach(([e, o]) => {
          (t(e.fore, G_CYL(0.078, 0.092, 0.22, 9), m, 0, -0.12, 0, { sh: 1 }),
            t(e.fore, G_CYL(0.012, 0.012, 0.18, 6), y, 0.075 * o, -0.12, 0.02),
            t(e.fore, G_BOX(0.095, 0.04, 0.06), h, 0, -0.25, -0.02));
        }),
        t(a, G_BOX(0.42 * d, 0.07, 0.29), M, 0, 0.09, 0),
        t(a, G_BOX(0.1, 0.07, 0.02), m, 0, 0.09, -0.155),
        [-1, 1].forEach((e) =>
          t(a, G_BOX(0.09, 0.12, 0.08), M, 0.21 * e * d, -0.02, -0.02),
        ),
        [l, c].forEach((e) =>
          t(e.leg, G_BOX(0.13, 0.13, 0.07), m, 0, -0.4, -0.075),
        ),
        t(r, G_HSPH(0.121, 0.5), w, 0, 0.232, 0.004, { s: [0.93, 0.98, 1.03] }),
        t(r, G_SPH(0.092), w, 0, 0.155, -0.035, { s: [1, 0.85, 1] }),
        t(r, G_BOX(0.07, 0.015, 0.02), w, 0, 0.18, -0.108));
    },
    yeonhwa(e) {
      const { add: t, S: o, hips: a, chest: n, neck: r, armL: s, armR: i } = e,
        l = o.w,
        c = chMat(3107658, "cloth"),
        d = chMat(2382396, "cloth"),
        h = chMat(15921126, "cloth"),
        p = chMat(10868391, "cloth"),
        u = chMat(13939290, "paint"),
        m = chMat(6965808, "leather"),
        f = chMat(o.hair, "hair"),
        y = chGlow(8191130, 1),
        M = chGlow(16301008, 0.8);
      (t(n, G_SPH(0.215, 12, 10), c, 0, 0.27, 0, { s: [l, 0.9, 0.74], sh: 1 }),
        t(n, G_BOX(0.03, 0.22, 0.015), h, -0.04, 0.32, -0.163, {
          r: [0, 0, -0.5],
        }),
        t(n, G_BOX(0.03, 0.22, 0.015), h, 0.04, 0.32, -0.163, {
          r: [0, 0, 0.5],
        }),
        t(n, G_BOX(0.05, 0.05, 0.02), p, 0.03, 0.22, -0.17),
        t(n, G_BOX(0.03, 0.26, 0.012), p, 0.05, 0.08, -0.168, {
          r: [0, 0, 0.08],
        }),
        t(n, G_BOX(0.03, 0.22, 0.012), p, 0.01, 0.09, -0.168, {
          r: [0, 0, -0.06],
        }),
        [s, i].forEach((e) => {
          (t(e.fore, G_CONE(0.1, 0.19, 10), c, 0, -0.14, 0, { sh: 1 }),
            t(e.fore, G_TOR(0.092, 0.011, 4, 14), h, 0, -0.23, 0, {
              r: [Math.PI / 2, 0, 0],
            }));
        }),
        t(a, G_BOX(0.36 * l, 0.08, 0.25), p, 0, 0.1, 0),
        t(a, G_BOX(0.16, 0.08, 0.04), p, 0, 0.11, 0.15),
        [-1, 1].forEach((e) =>
          t(a, G_BOX(0.05, 0.3, 0.015), p, 0.04 * e, -0.06, 0.16),
        ),
        t(a, G_BOX(0.3, 0.42, 0.025), d, 0, -0.17, -0.13, {
          r: [-0.1, 0, 0],
          sh: 1,
        }),
        t(a, G_BOX(0.3, 0.42, 0.025), d, 0, -0.17, 0.13, {
          r: [0.1, 0, 0],
          sh: 1,
        }),
        [-1, 1].forEach((e) =>
          t(a, G_BOX(0.025, 0.4, 0.18), d, 0.18 * e, -0.16, 0, {
            r: [0, 0, 0.12 * e],
          }),
        ),
        t(a, G_BOX(0.3, 0.02, 0.03), u, 0, -0.375, -0.15),
        t(a, G_BOX(0.12, 0.12, 0.07), m, -0.21 * l, -0.03, -0.01),
        t(n, G_BOX(0.03, 0.5, 0.02), m, 0.02, 0.22, -0.167, {
          r: [0, 0, -0.62],
        }));
      for (let e = 0; e < 3; e++)
        t(
          a,
          G_CYL(0.012, 0.012, 0.06, 6),
          y,
          -0.24 * l + 0.025 * e,
          0.05,
          -0.05,
        );
      (t(r, G_HSPH(0.127, 0.56), f, 0, 0.235, 0.012, {
        s: [0.95, 1.04, 1.07],
        sh: 1,
      }),
        [-1, 1].forEach((e) =>
          t(r, G_SPH(0.05, 8, 6), f, 0.055 * e, 0.295, -0.088, {
            s: [1.3, 0.55, 0.8],
            r: [0.3, 0, 0.3 * e],
          }),
        ),
        t(r, G_SPH(0.072), f, 0, 0.36, 0.07, { sh: 1 }),
        t(r, G_CYL(0.006, 0.006, 0.24, 5), y, 0, 0.37, 0.07, {
          r: [0, 0, 1.1],
        }),
        t(r, G_SPH(0.018), y, 0.1, 0.415, 0.07),
        t(r, G_SPH(0.03), M, -0.06, 0.39, 0.11));
    },
    noeun(e) {
      const {
          add: t,
          S: o,
          hips: a,
          chest: n,
          neck: r,
          armL: s,
          armR: i,
          legL: l,
          legR: c,
        } = e,
        d = o.w,
        h = chMat(13210910, "cloth"),
        p = chMat(11566866, "cloth"),
        u = chMat(1842206, "cloth"),
        m = chMat(1842206, "paint"),
        f = chMat(2763308, "paint"),
        y = chMat(16766287, "paint"),
        M = chMat(9080985, "metal"),
        w = chMat(o.hair, "hair"),
        T = chGlow(16766287, 1.1),
        g = chGlow(16732754, 1.3),
        x = chMat(3355443, "metal"),
        b = chMat(7328767, "glass");
      (t(n, G_SPH(0.235, 12, 10), h, 0, 0.24, 0, {
        s: [1.05 * d, 0.95, 0.82],
        sh: 1,
      }),
        [-1, 1].forEach((e) => {
          (t(n, G_BOX(0.02, 0.3, 0.22), u, 0.235 * e * d, 0.22, 0),
            t(
              n,
              G_CYL(0.006, 0.006, 0.14, 4),
              chMat(15658734, "cloth"),
              0.04 * e,
              0.36,
              -0.18,
            ),
            t(n, G_BOX(0.04, 0.36, 0.04), y, 0.12 * e, 0.26, -0.17));
        }),
        t(n, G_BOX(0.22, 0.1, 0.03), p, 0, 0.06, -0.18),
        t(n, G_SPH(0.12), h, 0, 0.44, 0.12, { s: [1.2, 0.6, 0.9], sh: 1 }),
        [s, i].forEach((e) => {
          (t(e.fore, G_TOR(0.066, 0.022, 5, 12), p, 0, -0.03, 0, {
            r: [Math.PI / 2, 0, 0],
          }),
            t(e.fore, G_BOX(0.08, 0.015, 0.05), T, 0, -0.22, -0.03));
        }),
        t(a, G_BOX(0.37 * d, 0.18, 0.26), chMat(2829099, "cloth"), 0, -0.06, 0),
        [l, c].forEach((e) => {
          (t(
            e.leg,
            G_CAP(0.092 * o.bulk, 0.1),
            chMat(2829099, "cloth"),
            0,
            -0.1,
            0,
          ),
            t(
              e.shin,
              G_BOX(0.135, 0.05, 0.28),
              chMat(16766287, "rubber"),
              0,
              -0.4,
              -0.045,
            ),
            t(e.shin, G_CYL(0.08, 0.08, 0.08, 10), u, 0, -0.3, 0));
        }),
        t(n, G_BOX(0.3, 0.34, 0.16), f, 0, 0.18, 0.22, { sh: 1 }),
        t(n, G_BOX(0.16, 0.08, 0.01), T, 0, 0.24, 0.305),
        t(n, G_CYL(0.01, 0.01, 0.5, 5), M, -0.1, 0.54, 0.24, {
          r: [0, 0, 0.15],
        }),
        t(n, G_SPH(0.025), g, -0.137, 0.79, 0.24),
        t(r, G_TOR(0.142, 0.014, 5, 20), m, 0, 0.23, 0),
        [-1, 1].forEach((e) => {
          (t(r, G_CYL(0.055, 0.055, 0.045, 12), m, 0.127 * e, 0.225, 0, {
            r: [0, 0, Math.PI / 2],
          }),
            t(r, G_TOR(0.045, 0.008, 4, 14), T, 0.152 * e, 0.225, 0, {
              r: [0, Math.PI / 2, 0],
            }));
        }),
        [-1, 1].forEach((e) => {
          (t(r, G_CYL(0.034, 0.034, 0.03, 12), x, 0.045 * e, 0.31, -0.095, {
            r: [Math.PI / 2 - 0.4, 0, 0],
          }),
            t(r, G_CYL(0.027, 0.027, 0.034, 12), b, 0.045 * e, 0.312, -0.1, {
              r: [Math.PI / 2 - 0.4, 0, 0],
            }));
        }),
        t(r, G_HSPH(0.128, 0.55), w, 0, 0.235, 0.01, {
          s: [0.97, 1.02, 1.05],
          sh: 1,
        }),
        [
          [-0.07, 0.34, -0.03, -0.3, 0.5],
          [0, 0.36, -0.02, -0.2, 0],
          [0.07, 0.34, -0.03, -0.3, -0.5],
          [-0.04, 0.35, 0.06, 0.4, 0.3],
          [0.05, 0.35, 0.07, 0.5, -0.3],
          [0, 0.32, 0.12, 1, 0],
          [-0.1, 0.3, 0.05, 0.3, 0.9],
          [0.1, 0.3, 0.05, 0.3, -0.9],
        ].forEach(([e, o, a, n, s]) =>
          t(r, G_CONE(0.035, 0.095, 5), w, e, o, a, { r: [n, 0, s] }),
        ));
    },
    baekho(e) {
      const { add: t, S: o, hips: a, chest: n, neck: r, armL: s, armR: i } = e,
        l = o.w,
        c = chMat(15132392, "cloth"),
        d = chMat(1710620, "cloth"),
        h = chMat(1315862, "cloth"),
        p = chMat(1184276, "leather"),
        u = chMat(14277081, "fur"),
        m = chMat(8026746, "fur"),
        f = chMat(2763824, "paint"),
        y = chMat(3816514, "metal"),
        M = chMat(12106948, "metal"),
        w = chMat(o.hair, "hair"),
        T = chGlow(16731469, 1.3);
      (t(n, G_SPH(0.22, 12, 10), c, 0, 0.25, 0, {
        s: [1.04 * l, 0.95, 0.76],
        sh: 1,
      }),
        t(n, G_BOX(0.09, 0.34, 0.02), h, 0, 0.23, -0.168),
        t(n, G_CYL(0.066, 0.07, 0.1, 10), h, 0, 0.46, 0),
        [-1, 1].forEach((e) =>
          t(n, G_BOX(0.07, 0.18, 0.02), c, 0.07 * e, 0.33, -0.155, {
            r: [0, 0.3 * e, 0.2 * e],
          }),
        ));
      let g = 0;
      for (let e = -2.3; e <= 2.31; e += 0.46)
        t(
          n,
          G_SPH(0.058, 8, 6),
          g++ % 2 ? m : u,
          0.14 * Math.sin(e),
          0.44,
          0.105 * Math.cos(e),
          { s: [1.2, 0.8, 1.2] },
        );
      (t(a, G_BOX(0.36, 0.78, 0.03), c, 0, -0.32, 0.14, {
        r: [0.06, 0, 0],
        sh: 1,
      }),
        [-1, 1].forEach((e) => {
          (t(a, G_BOX(0.16, 0.74, 0.03), c, 0.12 * e, -0.3, -0.13, {
            r: [-0.05, 0.12 * e, 0],
            sh: 1,
          }),
            t(a, G_BOX(0.03, 0.74, 0.22), c, 0.195 * e, -0.3, 0, {
              r: [0, 0, 0.06 * e],
            }));
          for (let o = 0; o < 4; o++)
            t(
              a,
              G_BOX(0.08, 0.018, 0.012),
              d,
              0.14 * e,
              -0.14 - 0.13 * o,
              -0.149,
              { r: [-0.05, 0.12 * e, 0.4 * -e] },
            );
        }));
      for (let e = 0; e < 5; e++) {
        const o = e % 2 ? 1 : -1;
        t(a, G_BOX(0.14, 0.022, 0.012), d, 0.08 * o, -0.1 - 0.12 * e, 0.158, {
          r: [0.06, 0, 0.35 * o],
        });
      }
      (t(a, G_BOX(0.36, 0.03, 0.035), d, 0, -0.7, 0.155),
        t(a, G_BOX(0.38 * l, 0.05, 0.27), p, 0, 0.1, 0),
        t(a, G_BOX(0.06, 0.05, 0.02), M, 0, 0.1, -0.14),
        [s, i].forEach((e) =>
          t(e.fore, G_CYL(0.066, 0.066, 0.05, 10), d, 0, -0.2, 0),
        ),
        t(n, G_BOX(0.1, 0.95, 0.07), f, 0.08, 0.08, 0.21, {
          r: [0, 0, -0.28],
          sh: 1,
        }),
        t(n, G_BOX(0.03, 0.03, 0.01), chGlow(16777215, 0.6), 0.12, 0.2, 0.25, {
          r: [0, 0, -0.28],
        }),
        t(n, G_BOX(0.03, 0.52, 0.02), p, -0.02, 0.22, -0.17, {
          r: [0, 0, 0.55],
        }),
        t(r, G_HSPH(0.126, 0.54), w, 0, 0.238, 0.02, {
          s: [0.95, 1, 1.14],
          sh: 1,
        }),
        t(r, G_SPH(0.09), w, 0, 0.22, 0.09, { s: [1.1, 0.8, 1] }),
        t(r, G_CAP(0.008, 0.07), w, 0.03, 0.28, -0.11, { r: [0.2, 0, -0.3] }),
        t(r, G_BOX(0.03, 0.03, 0.02), w, 0, 0.138, -0.095),
        t(r, G_CYL(0.028, 0.028, 0.06, 12), y, 0.042, 0.235, -0.13, {
          r: [Math.PI / 2, 0, 0],
        }),
        t(r, G_CYL(0.022, 0.022, 0.012, 12), T, 0.042, 0.235, -0.162, {
          r: [Math.PI / 2, 0, 0],
        }),
        t(r, G_BOX(0.08, 0.012, 0.012), y, 0.085, 0.24, -0.08, {
          r: [0, 0.9, 0],
        }));
    },
    _default(e) {
      const { add: t, S: o, hips: a, chest: n, neck: r } = e,
        s = chMat(4871526, "paint");
      (t(n, G_BOX(0.38 * o.w, 0.3, 0.1), s, 0, 0.26, -0.13, { sh: 1 }),
        t(
          a,
          G_BOX(0.38 * o.w, 0.05, 0.26),
          chMat(2236962, "leather"),
          0,
          0.09,
          0,
        ),
        t(r, G_HSPH(0.13, 0.55), chMat(3818064, "paint"), 0, 0.24, 0, {
          sh: 1,
        }));
    },
  };
function chBaseMats(e, t) {
  const o = chMat(t.skin, "skin"),
    a = {
      hwaryeong: {
        top: 1776159,
        sleeve: [5904922, "leather"],
        fore: null,
        hand: [2759960, "leather"],
        pants: 2829105,
        boot: [1578522, "leather"],
      },
      seorin: {
        top: 1911364,
        sleeve: [1911364, "cloth"],
        fore: [1911364, "cloth"],
        hand: [15331059, "leather"],
        pants: 1712949,
        boot: [13620957, "leather"],
      },
      muyeong: {
        top: 2234923,
        sleeve: [2234923, "cloth"],
        fore: [2234923, "cloth"],
        hand: [1380888, "leather"],
        pants: 1841186,
        boot: [2761264, "cloth"],
      },
      gangcheol: {
        top: 4012595,
        sleeve: null,
        fore: null,
        hand: [3817287, "metal"],
        pants: 4868668,
        boot: [2236444, "leather"],
      },
      yeonhwa: {
        top: 3107658,
        sleeve: [3107658, "cloth"],
        fore: [15394524, "cloth"],
        hand: null,
        pants: 2767408,
        boot: [3812900, "leather"],
      },
      noeun: {
        top: 13210910,
        sleeve: [13210910, "cloth"],
        fore: null,
        hand: [2829099, "rubber"],
        pants: 1381653,
        boot: [15790320, "rubber"],
      },
      baekho: {
        top: 1315862,
        sleeve: [15132392, "cloth"],
        fore: [15132392, "cloth"],
        hand: [1184276, "leather"],
        pants: 1974052,
        boot: [921104, "leather"],
      },
      _default: {
        top: 2831168,
        sleeve: [2831168, "cloth"],
        fore: [2831168, "cloth"],
        hand: [1514791, "leather"],
        pants: 2831168,
        boot: [1514791, "leather"],
      },
    }[e] ||
      (void 0 !== CH_BASE_EXTRA && CH_BASE_EXTRA[e]) ||
      null || {
        top: 2831168,
        sleeve: [2831168, "cloth"],
        fore: [2831168, "cloth"],
        hand: [1514791, "leather"],
        pants: 2831168,
        boot: [1514791, "leather"],
      },
    n = (e) => (e ? chMat(e[0], e[1]) : o);
  return {
    skin: o,
    top: chMat(a.top, "cloth"),
    sleeve: n(a.sleeve),
    fore: n(a.fore),
    hand: n(a.hand),
    pants: chMat(a.pants, "cloth"),
    boot: n(a.boot),
    sole: chMat(921104, "rubber"),
  };
}
function buildFighter(e, t) {
  const o = t ? t.id || t.key : "_default",
    a = CH_STYLE[o] || CH_STYLE._default,
    n = chBaseMats(CH_OUTFIT[o] ? o : "_default", a),
    r = a.w,
    s = a.bulk,
    i = new T.Group(),
    l = new T.MeshBasicMaterial({ color: e }),
    c = (e, t, o, a, n, r, s) => {
      const i = new T.Mesh(t, o);
      return (
        i.position.set(a, n, r),
        s &&
          (s.r && i.rotation.set(s.r[0] || 0, s.r[1] || 0, s.r[2] || 0),
          s.s &&
            i.scale.set(
              s.s[0],
              void 0 === s.s[1] ? s.s[0] : s.s[1],
              void 0 === s.s[2] ? s.s[0] : s.s[2],
            ),
          s.sh && ((i.castShadow = !0), (i.userData.cast = !0)),
          s.live && (i.userData.live = !0)),
        i.userData.cast || (i.userData.cast = !1),
        e.add(i),
        i
      );
    },
    d = new T.Group();
  i.userData.ownedMaterials = [l];
  ((d.position.y = 0.92), i.add(d));
  const h = new T.Group();
  ((h.position.y = 0.22), d.add(h));
  const p = new T.Group();
  ((p.position.y = 0.44),
    h.add(p),
    c(d, G_BOX(0.36 * r, 0.2, 0.24), n.pants, 0, 0, 0, { sh: 1 }),
    c(h, G_CAP(0.165 * r, 0.2), n.top, 0, 0.1, 0, { s: [1, 1, 0.78], sh: 1 }),
    c(h, G_SPH(0.21, 12, 10), n.top, 0, 0.27, -0.01, {
      s: [1.05 * r, 0.9, 0.72],
    }),
    c(h, G_BOX(0.46 * r, 0.12, 0.2), n.top, 0, 0.34, 0));
  const u = "muyeong" === o ? chGlow(a.eye, 1.6) : chMat(a.eye, "glass"),
    m = chMat(new T.Color(a.skin).multiplyScalar(0.72).getHex(), "skin"),
    f = chMat(a.hair, "hair");
  (c(p, G_CYL(0.058, 0.066, 0.12, 9), n.skin, 0, 0, 0),
    c(p, G_SPH(0.118, 14, 12), n.skin, 0, 0.22, -0.005, {
      s: [0.92, 1.08, 1],
      sh: 1,
    }));
  const y = new T.Object3D();
  function M(e) {
    const t = new T.Group();
    (t.position.set(0.245 * e * r, 0.33, 0),
      h.add(t),
      c(t, G_SPH(0.075 * s), n.sleeve, 0, 0, 0),
      c(t, G_CAP(0.062 * s, 0.18), n.sleeve, 0, -0.14, 0, { sh: 1 }));
    const o = new T.Group();
    return (
      (o.position.y = -0.28),
      t.add(o),
      c(o, G_CAP(0.054 * s, 0.17), n.fore, 0, -0.11, 0, { sh: 1 }),
      c(o, G_BOX(0.075, 0.095, 0.045), n.hand, 0, -0.245, -0.005),
      c(o, G_BOX(0.03, 0.05, 0.03), n.hand, 0.035 * -e, -0.23, -0.03),
      { arm: t, fore: o }
    );
  }
  (y.position.set(0, 0.22, 0),
    p.add(y),
    c(p, G_SPH(0.09), n.skin, 0, 0.16, -0.03, { s: [0.95, 0.8, 1] }),
    c(p, G_BOX(0.022, 0.045, 0.03), n.skin, 0, 0.212, -0.118),
    [-1, 1].forEach((e) => {
      (c(p, G_SPH(0.026, 6, 5), n.skin, 0.108 * e, 0.22, 0, {
        s: [0.5, 1, 0.8],
      }),
        c(p, G_SPH(0.017, 7, 6), u, 0.042 * e, 0.235, -0.103),
        c(p, G_BOX(0.046, 0.012, 0.015), f, 0.043 * e, 0.262, -0.107, {
          r: [0, 0, 0.12 * -e],
        }));
    }),
    c(p, G_BOX(0.042, 0.008, 0.01), m, 0, 0.165, -0.107));
  const w = M(-1),
    g = M(1);
  function x(e) {
    const t = new T.Group();
    (t.position.set(0.11 * e * r, -0.06, 0),
      d.add(t),
      c(t, G_CAP(0.082 * s, 0.26), n.pants, 0, -0.19, 0, { sh: 1 }));
    const o = new T.Group();
    return (
      (o.position.y = -0.41),
      t.add(o),
      c(o, G_CAP(0.066 * s, 0.24), n.pants, 0, -0.17, 0, { sh: 1 }),
      c(o, G_CAP(0.072, 0.12), n.boot, 0, -0.29, 0),
      c(o, G_BOX(0.12, 0.09, 0.25), n.boot, 0, -0.37, -0.045, { sh: 1 }),
      c(o, G_BOX(0.125, 0.025, 0.26), n.sole, 0, -0.41, -0.045),
      { leg: t, shin: o, foot: null }
    );
  }
  const b = x(-1),
    S = x(1);
  try {
    (CH_OUTFIT[o] || CH_OUTFIT._default)({
      add: c,
      S: a,
      O: n,
      hips: d,
      chest: h,
      neck: p,
      armL: w,
      armR: g,
      legL: b,
      legR: S,
    });
  } catch (e) {
    console.warn("outfit", o, e);
  }
  const v = c(w.arm, G_CYL(0.084 * s, 0.084 * s, 0.05, 12), l, 0, -0.1, 0, {
    live: 1,
  });
  (c(g.arm, G_CYL(0.084 * s, 0.084 * s, 0.05, 12), l, 0, -0.1, 0, { live: 1 }),
    c(h, G_BOX(0.3 * r, 0.03, 0.02), l, 0, 0.36, 0.185, { live: 1 }),
    c(h, G_BOX(0.05, 0.03, 0.02), l, -0.1 * r, 0.36, -0.19, { live: 1 }));
  const k = new T.Group();
  let _ = !1;
  if (void 0 !== GFX && GFX.detailGun)
    try {
      const e = ["rifle", "carbine", "smg", "battle", "marksman"][
          Math.floor(5 * Math.random())
        ],
        t = void 0 !== GUN_BUILD && GUN_BUILD[e] ? GUN_BUILD[e]() : null;
      if (t) {
        t.scale.setScalar(0.88);
        let e = 0;
        (t.traverse((t) => {
          t.isMesh &&
            (e++ < 3
              ? ((t.castShadow = !0), (t.userData.cast = !0))
              : (t.userData.cast = !1));
        }),
          k.add(t),
          (_ = !0));
      }
    } catch (e) {}
  if (!_) {
    const e = new T.Mesh(TP_GUN.body, TP_GUN.mBody);
    (e.position.set(0, 0, -0.06),
      (e.castShadow = !0),
      (e.userData.cast = !0),
      k.add(e));
    const t = new T.Mesh(TP_GUN.barrel, TP_GUN.mDark);
    ((t.rotation.x = Math.PI / 2),
      t.position.set(0, 0.012, -0.46),
      (t.userData.cast = !1),
      k.add(t));
    const o = new T.Mesh(TP_GUN.mag, TP_GUN.mDark);
    (o.position.set(0, -0.13, -0.02), (o.userData.cast = !1), k.add(o));
    const a = new T.Mesh(TP_GUN.stock, TP_GUN.mDark);
    (a.position.set(0, -0.01, 0.22), (a.userData.cast = !1), k.add(a));
    const n = new T.Mesh(TP_GUN.grip, TP_GUN.mDark);
    (n.position.set(0, -0.1, 0.1),
      (n.rotation.x = 0.28),
      (n.userData.cast = !1),
      k.add(n));
  }
  (k.position.set(0.02, -0.22, -0.055), (k.rotation.x = -1.1), g.fore.add(k));
  const A = new T.Object3D();
  return (
    A.position.set(0, 0.02, -0.42),
    k.add(A),
    [
      i,
      d,
      h,
      p,
      w.arm,
      w.fore,
      g.arm,
      g.fore,
      b.leg,
      b.shin,
      S.leg,
      S.shin,
    ].forEach(chBake),
    g.arm.rotation.set(1.32, 0, -0.16),
    g.fore.rotation.set(-0.22, 0, 0),
    w.arm.rotation.set(1.2, 0, 0.34),
    w.fore.rotation.set(-0.55, 0.42, 0),
    {
      group: i,
      torso: null,
      head: y,
      visor: v,
      helm: null,
      teamMat: l,
      hips: d,
      chest: h,
      neck: p,
      armL: w,
      armR: g,
      legL: b,
      legR: S,
      gun: k,
      muzzle: A,
    }
  );
}
Object.assign(CH_STYLE, {
  noeha: {
    w: 1,
    bulk: 0.95,
    skin: 13803642,
    hair: 14674175,
    eye: 3820216,
    coat: 4147880,
    trim: 12962815,
  },
  gyeongyeon: {
    w: 0.93,
    bulk: 0.88,
    skin: 15782596,
    hair: 15907023,
    eye: 6957642,
    coat: 2760493,
    trim: 16301008,
  },
  heuksa: {
    w: 1.02,
    bulk: 0.96,
    skin: 10251086,
    hair: 1840916,
    eye: 2759184,
    coat: 4075301,
    trim: 14142664,
  },
  myeongjong: {
    w: 1.08,
    bulk: 1.1,
    skin: 12882032,
    hair: 2038295,
    eye: 2760472,
    coat: 2055253,
    trim: 13214247,
  },
  jacheol: {
    w: 0.97,
    bulk: 0.95,
    skin: 14727322,
    hair: 2764600,
    eye: 3029578,
    coat: 5533306,
    trim: 10139903,
  },
  hongyeol: {
    w: 1,
    bulk: 0.97,
    skin: 13211002,
    hair: 1182732,
    eye: 9116186,
    coat: 4853524,
    trim: 16732754,
  },
  gunbong: {
    w: 0.98,
    bulk: 0.96,
    skin: 12157026,
    hair: 3811866,
    eye: 2759184,
    coat: 2829088,
    trim: 12634675,
  },
});
const CH_BASE_EXTRA = {
    noeha: {
      top: 1842990,
      sleeve: [4147880, "leather"],
      fore: [4147880, "leather"],
      hand: [1710626, "rubber"],
      pants: 2237754,
      boot: [15264498, "rubber"],
    },
    gyeongyeon: {
      top: 2760493,
      sleeve: [2760493, "cloth"],
      fore: [2760493, "cloth"],
      hand: [1709084, "leather"],
      pants: 2760493,
      boot: [1709084, "leather"],
    },
    heuksa: {
      top: 4075301,
      sleeve: [4075301, "cloth"],
      fore: [7035461, "cloth"],
      hand: [7035461, "cloth"],
      pants: 3023643,
      boot: [2760729, "leather"],
    },
    myeongjong: {
      top: 15262420,
      sleeve: [15262420, "cloth"],
      fore: [15262420, "cloth"],
      hand: null,
      pants: 2764588,
      boot: [2760729, "leather"],
    },
    jacheol: {
      top: 5533306,
      sleeve: [5533306, "cloth"],
      fore: [5533306, "cloth"],
      hand: [2237996, "rubber"],
      pants: 4545124,
      boot: [2760729, "leather"],
    },
    hongyeol: {
      top: 1314834,
      sleeve: null,
      fore: null,
      hand: null,
      pants: 1708564,
      boot: [1182732, "leather"],
    },
    gunbong: {
      top: 2829088,
      sleeve: [2829088, "cloth"],
      fore: [2829088, "cloth"],
      hand: [15260856, "leather"],
      pants: 3815980,
      boot: [4075301, "leather"],
    },
  },
  G_HALFTOR = () =>
    chGeo("horseshoe", () => new T.TorusGeometry(0.16, 0.05, 8, 20, Math.PI));
function animateFighter(e, t) {
  const o = e.model;
  if (!o || !o.hips || !e.alive) return;
  const a = e.vel ? e.vel.x : 0,
    n = e.vel ? e.vel.z : 0,
    r = Math.hypot(a, n),
    s = r > 0.6,
    i = -(a * Math.sin(e.yaw) + n * Math.cos(e.yaw)),
    l = a * Math.cos(e.yaw) - n * Math.sin(e.yaw),
    c = s
      ? Math.min(1, (Math.abs(l) / (Math.abs(i) + Math.abs(l) + 0.001)) * 1.4)
      : 0,
    d = s && i < -0.4 && c < 0.6;
  e._gait =
    (e._gait || 0) +
    t * (s ? Math.min(13, 4.5 + 1.15 * r) * (e.crouch ? 0.75 : 1) : 0);
  const h = e._gait,
    p = Math.min(0.62, 0.2 + 0.055 * r) * (e.crouch ? 0.6 : 1),
    u = s ? Math.sin(d ? -h : h) * p * (1 - 0.7 * c) : 0,
    m = s ? 0.3 * Math.max(0, Math.cos(h)) : 0;
  ((o.legL.leg.rotation.x = u),
    (o.legR.leg.rotation.x = -u),
    (o.legL.shin.rotation.x =
      0.85 * -Math.max(0, u) - 0.25 * m - c * Math.max(0, Math.sin(h)) * 0.35),
    (o.legR.shin.rotation.x =
      0.85 * -Math.max(0, -u) -
      0.25 * m -
      c * Math.max(0, -Math.sin(h)) * 0.35));
  const f = s ? 0.28 * Math.sin(h) * c * Math.sign(l || 1) : 0;
  ((o.legL.leg.rotation.z = -Math.max(0, f)),
    (o.legR.leg.rotation.z = Math.max(0, -f)));
  const y =
    ((e.yaw - (e._lastYaw ?? e.yaw) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
  if (
    ((e._lastYaw = e.yaw),
    !s && Math.abs(y) > 0.012
      ? (e._turnT = Math.min(1, (e._turnT || 0) + 6 * Math.abs(y)))
      : (e._turnT = Math.max(0, (e._turnT || 0) - 3 * t)),
    !s && e._turnT > 0.05)
  ) {
    e._turnPh = (e._turnPh || 0) + 11 * t;
    const a = 0.22 * Math.sin(e._turnPh) * e._turnT;
    ((o.legL.leg.rotation.x = a),
      (o.legR.leg.rotation.x = -a),
      (o.legL.shin.rotation.x = 1.2 * -Math.max(0, a)),
      (o.legR.shin.rotation.x = 1.2 * -Math.max(0, -a)));
  }
  const M = (e.y || 0) > 0.12 || !e.onGround;
  (e._wasAir && !M && (e._airPeak || 0) > 0.35 && (e._landT = 0.28),
    (e._airPeak = M ? Math.max(e._airPeak || 0, e.y || 0) : 0),
    (e._wasAir = M));
  const w = e._landT > 0 ? Math.sin((e._landT / 0.28) * Math.PI) : 0;
  e._landT > 0 && (e._landT -= t);
  const T = s ? 0.035 * Math.abs(Math.sin(h)) : 0;
  e._idleT = (e._idleT || 6 * Math.random()) + t;
  const g = e._idleT,
    x = s ? 0 : 0.012 * Math.sin(1.7 * g),
    b = s ? 0 : 0.018 * Math.sin(0.45 * g);
  ((o.hips.position.y = 0.92 - T - (e.crouch ? 0.3 : 0) + 0.4 * x - 0.16 * w),
    w > 0 &&
      ((o.legL.shin.rotation.x -= 0.6 * w),
      (o.legR.shin.rotation.x -= 0.6 * w),
      (o.legL.leg.rotation.x += 0.35 * w),
      (o.legR.leg.rotation.x += 0.35 * w)),
    (o.hips.rotation.z = s ? 0.035 * Math.sin(h) : b),
    (o.chest.rotation.y = s ? 0.07 * Math.sin(h) : 0.03 * Math.sin(0.6 * g)),
    (o.chest.rotation.z = s ? 0 : 0.8 * -b));
  const S = s ? Math.min(0.14, 0.018 * r) * (d ? -0.6 : 1) * (1 - 0.6 * c) : 0;
  if (
    ((o.chest.rotation.x = (e.crouch ? 0.22 : 0) + S + x + 0.18 * w),
    (o.hips.rotation.y = s ? -Math.sign(l) * c * 0.22 : 0),
    (o.chest.rotation.y += s ? Math.sign(l) * c * 0.18 : 0),
    e._hitT > 0)
  ) {
    const a = Math.sin((e._hitT / 0.2) * Math.PI);
    ((o.chest.rotation.x -= 0.32 * a),
      (o.chest.rotation.z += 0.12 * a * (e._hitSide || 1)),
      (e._hitT -= t));
  }
  e.crouch &&
    ((o.legL.leg.rotation.x += 0.55),
    (o.legR.leg.rotation.x += 0.55),
    (o.legL.shin.rotation.x -= 1),
    (o.legR.shin.rotation.x -= 1));
  const v = clamp(e.pitch || 0, -0.9, 0.9);
  ((o.chest.rotation.x += 0.42 * v), o.neck && (o.neck.rotation.x = 0.3 * -v));
  const k = e.recoil || 0;
  if (
    ((o.armR.arm.rotation.x = 1.32 + 0.3 * k - 0.3 * v),
    (o.armL.arm.rotation.x = 1.2 + 0.22 * k - 0.3 * v),
    e.reloading > 0)
  ) {
    const t = 0.5 * Math.sin((performance.now() / 1e3) * Math.PI * 2.4) + 0.5;
    ((o.armL.arm.rotation.x = 0.75 + 0.42 * t),
      (o.armL.fore.rotation.x = 0.55 * t - 1.05));
  } else o.armL.fore.rotation.x = -0.55;
  {
    const t = world.spike,
      a = (e.planting || 0) > 0 && e.hasSpike && "carried" === t.state,
      n = (e.defusing || 0) > 0 && "planted" === t.state;
    if (a || n) {
      ((o.hips.position.y = 0.52),
        (o.hips.rotation.z = 0),
        (o.legL.leg.rotation.x = 1.35),
        (o.legL.shin.rotation.x = -1.4),
        (o.legR.leg.rotation.x = -0.15),
        (o.legR.shin.rotation.x = -1.55),
        (o.chest.rotation.x = 0.5));
      const t = 0.05 * Math.sin((world._clock || 0) * (a ? 6 : 14));
      ((o.armR.arm.rotation.x = 0.55 + t),
        (o.armR.fore.rotation.x = -0.35),
        (o.armL.arm.rotation.x = 0.6 - t),
        (o.armL.fore.rotation.x = -0.4),
        o.gun && (o.gun.visible = !1),
        actorPlantProp(
          e,
          a ? "plant" : "defuse",
          clamp(a ? e.planting / SPIKE.PLANT : e.defusing / SPIKE.DEFUSE, 0, 1),
        ),
        (e._kneel = !0));
    } else
      e._kneel &&
        ((e._kneel = !1),
        o.gun && !e.ultW && (o.gun.visible = !0),
        actorPlantProp(e, "none", 0));
  }
  castPose(e, o, t);
  if (
    (e.ultW &&
      ((o.armL.arm.rotation.x = 1.45),
      (o.armL.fore.rotation.x = -0.15),
      (o.armR.arm.rotation.x = 1.45 - 0.3 * v)),
    (e.y || 0) > 0.12)
  ) {
    const t = Math.min(1, 2.2 * (e.y - 0.12));
    ((o.legL.leg.rotation.x = -0.35 * t + u * (1 - t)),
      (o.legR.leg.rotation.x = 0.15 * t - u * (1 - t)),
      (o.legL.shin.rotation.x = -0.95 * t),
      (o.legR.shin.rotation.x = -0.55 * t));
  }
}
function spawnBot(e, t, o, a) {
  const n = buildFighter("atk" === e ? 16739146 : 3718648, t);
  scene.add(n.group);
  const r = {
    team: e,
    agent: t,
    model: n,
    group: n.group,
    pos: new T.Vector3(o, 0, a),
    y: 0,
    vy: 0,
    hp: 100,
    armor: 25,
    alive: !0,
    yaw: 0,
    target: null,
    state: "advance",
    path: [],
    pathIdx: 0,
    repathCd: 0,
    fireCd: 0,
    burst: 0,
    reactCd: 0,
    accuracy: 0.055,
    slow: 1,
    blind: 0,
    root: 0,
    revealed: 0,
    hasSpike: !1,
    plantCd: 0,
    strafe: rnd(-1, 1),
    strafeCd: 0,
    skill: { cd: rnd(4, 14) },
    lastSeen: null,
    alertT: 0,
    weaponName: ["돌격소총", "카빈", "기관단총", "전투소총", "지정사수총"][
      Math.floor(5 * Math.random())
    ],
  };
  return (world.entities.push(r), r);
}
function damageEntity(e, t, o, a) {
  if (e.alive) {
    if ((e.shielded > 0 && (t *= 0.4), e.armor > 0)) {
      const o = Math.min(e.armor, 0.5 * t);
      ((e.armor -= o), (t -= o));
    }
    ((e.hp -= t),
      "player" === a && (world.stats.dmg += Math.round(t)),
      (e.alertT = 5),
      (e.lastSeen = { x: player.pos.x, z: player.pos.z }),
      bloodBurst(
        e.pos.x,
        e.y + (o ? 1.86 : 1.1) * BODY_K,
        e.pos.z,
        o ? 16726862 : 13386820,
      ),
      e.hp <= 0 && killEntity(e, a));
  }
}
function killEntity(e, t) {
  ((e.alive = !1),
    (e.group.visible = !1),
    "player" === t
      ? (world.stats.kills++,
        (player.credits += 200),
        chargeUlt(1),
        pushKill(player.agent.name, e.agent.name))
      : pushKill(e.agent ? e.agent.name : "적", "아군"),
    e.hasSpike && spikeDropOnDeath(e));
}
function damagePlayer(e, t, o) {
  if (CASTER && "function" == typeof dealDamage)
    return void dealDamage(player, e, !1, player);
  if (!player.alive || player.invuln > 0 || "end" === world.phase) return;
  if ((player.shielded > 0 && (e *= 0.4), player.armor > 0)) {
    const t = Math.min(player.armor, 0.5 * e);
    ((player.armor -= t), (e -= t));
  }
  player.hp -= e;
  const a = $("dmg");
  (a.classList.add("hit"),
    clearTimeout(a._t),
    (a._t = setTimeout(() => a.classList.remove("hit"), 190)),
    player.hp <= 0 && killPlayer());
}
function killPlayer() {
  ((player.alive = !1),
    (player.hp = 0),
    world.stats.deaths++,
    banner("사망 · 아군 시점으로 전환", "#ff3b4e"),
    player.hasSpike && spikeDropOnDeath(player),
    (player.spectateT = 1.6),
    (player.spectate = null),
    (player.deathCamYaw = player.yaw),
    document.getElementById("spectate").classList.add("on"),
    updateSpectateUI());
}
function onLocalDeath() {
  const e = player;
  if ((banner("사망 · 아군 인계 대기", "#ff3b4e"), e.hasSpike))
    try {
      spikeDropOnDeath(e);
    } catch (e) {}
  ((e.spectateT = 1.6), (e.spectate = null), (e.deathCamYaw = e.yaw));
  const t = document.getElementById("spectate");
  (t && t.classList.add("on"),
    updateSpectateUI(),
    setTimeout(() => {
      world.over ||
        "live" !== world.phase ||
        player !== e ||
        player.alive ||
        takeOverAlly(null);
    }, 1700));
}
function takeOverAlly(e) {
  const t = player;
  if (!world.actors || !world.actors.length) return !1;
  let o = world.actors.filter(
    (e) => e.alive && e.team === t.team && e !== t && isAI(e),
  );
  if (!o.length) return (updateSpectateUI(), !1);
  let a = e && o.indexOf(e) >= 0 ? e : null;
  (a || (o.sort((e, t) => t.hp - e.hp), (a = o[0])),
    (t.ctrl = "dead"),
    (t.spectate = null),
    (t.spectateT = 0),
    takeOver(a.id, "me"),
    (a.name = t.name || myName()),
    bindLocalPlayer(a),
    a.agent &&
      document.documentElement.style.setProperty("--ac", a.agent.color));
  try {
    updateViewmodel(!0);
  } catch (e) {}
  const n = document.getElementById("spectate");
  if (
    (n && n.classList.remove("on"),
    document.getElementById("hud").classList.remove("dead"),
    banner(`${a.agent ? a.agent.name : "아군"} 인계 — 조작 가능`, "#4ade80"),
    "object" == typeof SFX && SFX.beep)
  )
    try {
      SFX.beep(!1);
    } catch (e) {}
  rosterKey = "";
  const r = $("skills");
  r && (r.dataset.key = "");
  try {
    paintTouchAbil();
  } catch (e) {}
  return (
    updateHUD(),
    !IS_TOUCH && $("pause").hidden && $("shop").hidden && tryLock(),
    !0
  );
}
function livingAllies() {
  return world.actors && world.actors.length
    ? world.actors.filter(
        (e) => e.alive && e.team === player.team && e !== player,
      )
    : world.entities.filter((e) => e.alive && e.team === player.team);
}
function nextSpectate(e) {
  const t = livingAllies();
  if (!t.length) return ((player.spectate = null), void updateSpectateUI());
  const o = t.indexOf(player.spectate),
    a = o < 0 ? 0 : (o + (e || 1) + t.length) % t.length;
  ((player.spectate = t[a]), updateSpectateUI());
}
function updateSpectateUI() {
  const e = document.getElementById("sp-name");
  if (!e) return;
  if (livingAllies().length)
    if (player.spectate) {
      const t = player.spectate.agent,
        o =
          world.actors &&
          world.actors.length &&
          player.spectate.alive &&
          "function" == typeof isAI &&
          isAI(player.spectate);
      ((e.textContent =
        `${t ? t.name : "아군"} 시점` + (o ? " · 클릭하면 조종" : "")),
        (e.style.color = t ? t.color : "#4ade80"));
    } else ((e.textContent = "관전 준비 중"), (e.style.color = "#8a97ab"));
  else
    ((e.textContent = "아군 전원 사망 — 라운드 종료 대기"),
      (e.style.color = "#8a97ab"));
}
function initAbilities(e) {
  ((player.abilities = e.abilities.map((e) => ({
    def: e,
    charges: e.ult || e.cost ? 0 : e.charges,
    cd: 0,
    bought: !e.cost,
  }))),
    (player.ultMax = e.abilities.find((e) => e.ult).ult),
    (player.ultCharge = 0));
}
function chargeUlt(e) {
  player.ultCharge = Math.min(player.ultMax, player.ultCharge + e);
}
function aimPoint(e) {
  const t = new T.Vector3(player.pos.x, player.y + eyeHeight(), player.pos.z),
    o = new T.Vector3(
      -Math.sin(player.yaw) * Math.cos(player.pitch),
      Math.sin(player.pitch),
      -Math.cos(player.yaw) * Math.cos(player.pitch),
    ),
    a = Math.ceil(e / 0.6);
  let n = { x: t.x, y: t.y, z: t.z };
  for (let r = 1; r <= a; r++) {
    const s = (r / a) * e,
      i = { x: t.x + o.x * s, y: t.y + o.y * s, z: t.z + o.z * s };
    if (i.y <= 0.05) return { x: i.x, y: 0, z: i.z, hit: !0 };
    if ("function" == typeof otherFighters)
      for (const e of otherFighters())
        if (
          e.alive &&
          e.team &&
          (!player || e.team !== player.team) &&
          Math.abs(i.y - (e.y + 1)) < 1.25 &&
          dist2(i.x, i.z, e.pos.x, e.pos.z) < 0.9
        )
          return { x: e.pos.x, y: e.y || 0, z: e.pos.z, hit: !0, target: e };
    for (const e of COLLIDERS)
      if (
        i.y < e.h &&
        i.y >= (e.y0 || 0) &&
        i.x > e.minX &&
        i.x < e.maxX &&
        i.z > e.minZ &&
        i.z < e.maxZ
      )
        return { x: n.x, y: Math.max(0, n.y), z: n.z, hit: !0 };
    n = i;
  }
  return { x: n.x, y: Math.max(0, n.y), z: n.z, hit: !1 };
}
function forwardVec() {
  return new T.Vector3(
    -Math.sin(player.yaw),
    0,
    -Math.cos(player.yaw),
  ).normalize();
}
function useAbility(e) {
  const t = player.abilities[e];
  if (t && player.alive && "end" !== world.phase) {
    if ((player.silenced || 0) > 0 && !ADMIN.infAbil)
      return (
        banner("능력 봉인됨", "#ffd54f"),
        void ("object" == typeof SFX && SFX.silenced && SFX.silenced())
      );
    if (ADMIN.infAbil)
      return (
        (t.cd = 0),
        (t.charges = Math.max(t.charges, t.def.charges || 1)),
        void ("client" === NET.mode
          ? sendAction({ t: "abil", i: e })
          : castAbility(t.def.type, t.def))
      );
    if (t.def.ult) {
      if (player.ultCharge < player.ultMax)
        return void banner("궁극기 충전 부족", "#8a97ab");
      player.ultCharge = 0;
    } else {
      if (t.cd > 0) return;
      if (t.charges <= 0) return void banner("사용 가능 횟수 없음", "#8a97ab");
      (t.charges--, t.def.cd && (t.cd = t.def.cd));
    }
    try {
      const t = $("skills") && $("skills").children[e];
      t && (t.classList.remove("fire"), t.offsetWidth, t.classList.add("fire"));
    } catch (e) {}
    ((CAST_REFUND = !1),
      "client" === NET.mode
        ? sendAction({ t: "abil", i: e })
        : castAbility(t.def.type, t.def),
      CAST_REFUND && !t.def.ult && (t.charges++, (t.cd = 0)),
      (CAST_REFUND = !1));
  }
}
Object.assign(CH_OUTFIT, {
  noeha(e) {
    const {
        add: t,
        S: o,
        hips: a,
        chest: n,
        neck: r,
        armL: s,
        armR: i,
        legL: l,
        legR: c,
      } = e,
      d = o.w,
      h = chMat(4147880, "leather"),
      p = chMat(2765696, "leather"),
      u = chGlow(12962815, 1.3),
      m = chGlow(8162559, 1.1),
      f = chMat(1710626, "rubber"),
      y = chMat(o.hair, "hair"),
      M = chMat(9080985, "metal");
    (t(n, G_SPH(0.225, 12, 10), h, 0, 0.27, 0, {
      s: [1.06 * d, 0.86, 0.78],
      sh: 1,
    }),
      t(n, G_CYL(0.105, 0.13, 0.12, 12), p, 0, 0.46, 0),
      t(n, G_BOX(0.44 * d, 0.05, 0.25), p, 0, 0.115, 0),
      [
        [-0.07, 0.33, 0.5],
        [-0.03, 0.26, -0.5],
        [-0.07, 0.19, 0.5],
      ].forEach(([e, o, a]) =>
        t(n, G_BOX(0.013, 0.085, 0.012), u, e, o, -0.174, { r: [0, 0, a] }),
      ),
      [-1, 1].forEach((e) =>
        t(n, G_BOX(0.012, 0.22, 0.012), m, 0.215 * e * d, 0.26, -0.06),
      ),
      t(r, G_TOR(0.075, 0.012, 4, 14), f, 0, 0.02, -0.02, {
        r: [Math.PI / 2, 0, 0],
      }),
      [-1, 1].forEach((e) =>
        t(
          r,
          G_CYL(0.03, 0.03, 0.025, 10),
          chMat(8162559, "glass"),
          0.04 * e,
          0.03,
          -0.088,
          { r: [Math.PI / 2, 0, 0] },
        ),
      ),
      [s, i].forEach((e) => {
        (t(e.fore, G_CYL(0.06, 0.068, 0.12, 9), f, 0, -0.19, 0),
          t(e.fore, G_TOR(0.064, 0.008, 4, 12), u, 0, -0.12, 0, {
            r: [Math.PI / 2, 0, 0],
          }));
      }),
      t(n, G_CYL(0.018, 0.018, 0.9, 6), M, 0.06, 0.3, 0.19, {
        r: [0, 0, -0.35],
        sh: 1,
      }),
      t(n, G_SPH(0.045), u, 0.215, 0.72, 0.19),
      t(a, G_BOX(0.38 * d, 0.05, 0.26), f, 0, 0.09, 0),
      t(a, G_BOX(0.06, 0.05, 0.02), m, 0, 0.09, -0.135),
      [l, c].forEach((e) => {
        (t(e.leg, G_BOX(0.11, 0.11, 0.06), f, 0, -0.4, -0.075),
          t(e.shin, G_BOX(0.13, 0.02, 0.27), m, 0, -0.395, -0.045));
      }),
      t(r, G_HSPH(0.128, 0.5), y, 0, 0.235, 0.01, {
        s: [0.96, 1, 1.04],
        sh: 1,
      }),
      [
        [0, 0.4, -0.02, -0.15, 0, 0.17],
        [-0.07, 0.37, -0.01, -0.3, 0.45, 0.15],
        [0.07, 0.37, -0.01, -0.3, -0.45, 0.15],
        [-0.03, 0.39, 0.07, 0.35, 0.2, 0.16],
        [0.04, 0.39, 0.07, 0.35, -0.25, 0.16],
        [0, 0.36, 0.12, 0.8, 0, 0.13],
        [-0.1, 0.33, 0.05, 0.2, 0.9, 0.12],
        [0.1, 0.33, 0.05, 0.2, -0.9, 0.12],
      ].forEach(([e, o, a, n, s, i]) =>
        t(r, G_CONE(0.038, i, 5), y, e, o, a, { r: [n, 0, s], sh: 1 }),
      ),
      t(r, G_CONE(0.02, 0.1, 4), u, 0.02, 0.48, -0.03, { r: [-0.1, 0, -0.1] }));
  },
  gyeongyeon(e) {
    const {
        add: t,
        S: o,
        hips: a,
        chest: n,
        neck: r,
        armL: s,
        armR: i,
        legL: l,
        legR: c,
      } = e,
      d = o.w,
      h = chMat(2760493, "cloth"),
      p = chMat(14162784, "paint"),
      u = chMat(14673646, "glass"),
      m = chGlow(16573676, 0.6),
      f = chGlow(15753874, 1.4),
      y = chMat(o.hair, "hair"),
      M = chMat(3811904, "cloth", { side: T.DoubleSide }),
      w = chMat(12633806, "metal"),
      g = chMat(1709084, "leather");
    (t(n, G_SPH(0.205, 12, 10), h, 0, 0.26, 0, { s: [d, 0.95, 0.74], sh: 1 }),
      t(n, G_BOX(0.05, 0.34, 0.015), p, 0.02, 0.25, -0.156, {
        r: [0, 0, -0.35],
      }),
      t(n, G_BOX(0.3 * d, 0.03, 0.015), w, 0, 0.36, -0.15),
      t(n, G_BOX(0.28, 0.62, 0.02), M, 0.12, 0.02, 0.16, {
        r: [0.1, 0, -0.12],
        sh: 1,
      }));
    for (let e = 0; e < 4; e++)
      t(
        n,
        G_BOX(0.09, 0.12, 0.01),
        u,
        0.05 + (e % 2) * 0.12,
        0.22 - 0.14 * e,
        0.176,
        { r: [0.1, 0, e % 2 ? 0.1 : -0.2] },
      );
    ([
      [-0.3, 0.52, -0.02, 0.4],
      [-0.36, 0.44, 0.08, -0.3],
      [-0.24, 0.56, 0.08, 0.9],
      [-0.38, 0.58, -0.04, -0.8],
    ].forEach(([e, o, a, r]) =>
      t(n, G_BOX(0.07, 0.11, 0.008), m, e * d, o, a, { r: [0.2, r, 0.3] }),
    ),
      t(a, G_BOX(0.36 * d, 0.05, 0.25), w, 0, 0.1, 0),
      [s, i].forEach((e) =>
        t(e.fore, G_TOR(0.058, 0.009, 4, 12), p, 0, -0.16, 0, {
          r: [Math.PI / 2, 0, 0],
        }),
      ),
      [l, c].forEach((e) => {
        (t(e.shin, G_CAP(0.072, 0.28), g, 0, -0.18, 0),
          t(e.leg, G_CAP(0.087, 0.12), g, 0, -0.32, 0));
      }),
      t(r, G_HSPH(0.13, 0.62), y, 0, 0.225, 0.01, {
        s: [1.02, 1.02, 1.08],
        sh: 1,
      }),
      t(r, G_SPH(0.09, 12, 8), y, 0.02, 0.29, -0.09, { s: [1.4, 0.42, 0.8] }),
      t(r, G_SPH(0.122, 12, 10), u, -0.05, 0.225, -0.012, {
        s: [0.55, 1.06, 1],
      }),
      t(r, G_BOX(0.045, 0.009, 0.01), f, -0.048, 0.238, -0.126));
  },
  heuksa(e) {
    const { add: t, S: o, hips: a, chest: n, neck: r, armR: s } = e,
      i = o.w,
      l = chMat(4075301, "cloth"),
      c = chMat(3023643, "cloth"),
      d = chMat(13215339, "cloth"),
      h = chMat(7035461, "cloth"),
      p = chMat(11569726, "metal"),
      u = chMat(4863270, "leather"),
      m = chGlow(14729344, 0.9);
    (t(n, G_SPH(0.225, 12, 10), l, 0, 0.25, 0, {
      s: [1.05 * i, 0.95, 0.8],
      sh: 1,
    }),
      t(n, G_SPH(0.25, 12, 8), d, 0, 0.36, 0, {
        s: [1.1 * i, 0.45, 0.85],
        sh: 1,
      }),
      t(n, G_BOX(0.04, 0.5, 0.02), h, 0, 0.22, -0.172, { r: [0, 0, 0.5] }),
      t(n, G_CONE(0.03, 0.05, 6), p, -0.07, 0.3, -0.185, {
        r: [Math.PI, 0, 0],
      }),
      t(n, G_CONE(0.03, 0.05, 6), p, -0.07, 0.255, -0.185),
      t(a, G_BOX(0.42, 0.8, 0.03), c, 0, -0.36, 0.14, {
        r: [0.07, 0, 0],
        sh: 1,
      }),
      [-1, 1].forEach((e) => {
        (t(a, G_BOX(0.18, 0.78, 0.03), c, 0.12 * e, -0.35, -0.14, {
          r: [-0.07, 0.12 * e, 0],
          sh: 1,
        }),
          t(a, G_BOX(0.03, 0.78, 0.26), c, 0.21 * e, -0.35, 0, {
            r: [0, 0, 0.08 * e],
          }));
      }),
      t(a, G_BOX(0.4 * i, 0.08, 0.28), h, 0, 0.08, 0),
      t(r, G_SPH(0.14, 12, 10), h, 0, 0.27, 0.01, {
        s: [1.02, 0.8, 1.1],
        sh: 1,
      }),
      t(r, G_TOR(0.125, 0.035, 6, 16), d, 0, 0.24, 0, {
        r: [Math.PI / 2, 0, 0],
      }),
      t(r, G_SPH(0.105, 10, 8), d, 0, 0.135, -0.03, { s: [1.05, 0.72, 1.08] }),
      t(r, G_BOX(0.05, 0.22, 0.015), d, 0.06, 0.08, 0.1, { r: [0.3, 0, 0.1] }),
      t(n, G_CYL(0.022, 0.022, 1.5, 6), u, -0.08, 0.25, 0.2, {
        r: [0, 0, 0.3],
        sh: 1,
      }),
      t(n, G_SPH(0.05), m, -0.3, 0.97, 0.2),
      t(s.fore, G_CYL(0.064, 0.07, 0.14, 9), p, 0, -0.13, 0));
  },
  myeongjong(e) {
    const {
        add: t,
        S: o,
        hips: a,
        chest: n,
        neck: r,
        armL: s,
        armR: i,
        legL: l,
        legR: c,
      } = e,
      d = o.w,
      h = chMat(2055253, "cloth"),
      p = chMat(15262420, "cloth"),
      u = chMat(11569726, "metal"),
      m = chMat(4885118, "metal"),
      f = chMat(3813154, "cloth"),
      y = chMat(5913122, "leather"),
      M = chGlow(16765286, 0.7),
      w = chMat(o.hair, "hair"),
      T = chMat(2762272, "leather");
    (t(n, G_BOX(0.16, 0.34, 0.03), h, -0.12 * d, 0.25, -0.15, {
      r: [0, 0.2, 0],
    }),
      t(n, G_BOX(0.16, 0.34, 0.03), h, 0.12 * d, 0.25, -0.15, {
        r: [0, -0.2, 0],
      }),
      t(n, G_BOX(0.44 * d, 0.4, 0.04), h, 0, 0.24, 0.15, { sh: 1 }),
      [-1, 1].forEach((e) =>
        t(n, G_BOX(0.04, 0.4, 0.26), h, 0.22 * e * d, 0.24, 0),
      ));
    for (let e = 0; e < 2 * Math.PI; e += 0.36)
      t(
        n,
        G_SPH(0.022, 6, 5),
        y,
        0.15 * Math.sin(e),
        0.42 + 0.035 * Math.cos(e),
        0.12 * Math.cos(e),
      );
    (t(n, G_CONE(0.035, 0.06, 10), u, 0, 0.3, -0.19),
      t(a, G_BOX(0.4 * d, 0.07, 0.28), T, 0, 0.09, 0),
      [-0.15, -0.05, 0.05, 0.15].forEach((e) => {
        (t(a, G_CONE(0.03, 0.06, 10), u, e * d, -0.01, -0.15),
          t(a, G_SPH(0.012, 5, 4), u, e * d, 0.028, -0.15));
      }),
      t(a, G_BOX(0.4, 0.5, 0.03), h, 0, -0.22, 0.14, {
        r: [0.06, 0, 0],
        sh: 1,
      }),
      [-1, 1].forEach((e) =>
        t(a, G_BOX(0.16, 0.46, 0.03), h, 0.11 * e, -0.2, -0.13, {
          r: [-0.06, 0.1 * e, 0],
        }),
      ),
      [s, i].forEach((e) =>
        t(e.fore, G_CYL(0.064, 0.064, 0.06, 10), m, 0, -0.17, 0),
      ),
      [l, c].forEach((e) =>
        t(e.shin, G_CYL(0.072, 0.072, 0.16, 9), p, 0, -0.2, 0),
      ),
      t(r, G_HSPH(0.124, 0.5), w, 0, 0.235, 0.01, { s: [0.93, 0.95, 1.02] }),
      t(r, G_BOX(0.06, 0.012, 0.02), w, 0, 0.182, -0.108),
      t(r, G_CONE(0.34, 0.16, 24), f, 0, 0.37, 0, { sh: 1 }),
      t(r, G_TOR(0.335, 0.012, 4, 32), u, 0, 0.29, 0, {
        r: [Math.PI / 2, 0, 0],
      }));
    for (let e = 0; e < 6; e++) {
      const o = (e / 6) * Math.PI * 2;
      (t(
        r,
        G_CYL(0.003, 0.003, 0.06, 3),
        u,
        0.32 * Math.cos(o),
        0.26,
        0.32 * Math.sin(o),
      ),
        t(
          r,
          G_CONE(0.022, 0.035, 8),
          u,
          0.32 * Math.cos(o),
          0.215,
          0.32 * Math.sin(o),
        ));
    }
    t(r, G_SPH(0.02), M, 0, 0.46, 0);
  },
  jacheol(e) {
    const {
        add: t,
        S: o,
        hips: a,
        chest: n,
        neck: r,
        armL: s,
        armR: i,
        legL: l,
        legR: c,
      } = e,
      d = o.w,
      h = chMat(5533306, "cloth"),
      p = chMat(6111287, "leather"),
      u = chMat(4862504, "leather"),
      m = chMat(9080985, "metal"),
      f = chMat(14172995, "paint"),
      y = chMat(4157400, "paint"),
      M = chGlow(10139903, 1.1),
      w = chMat(2237996, "rubber"),
      T = chMat(o.hair, "hair"),
      g = chMat(3029578, "glass"),
      x = chMat(4075301, "leather");
    (t(n, G_SPH(0.215, 12, 10), h, 0, 0.26, 0, {
      s: [1.03 * d, 0.94, 0.76],
      sh: 1,
    }),
      t(n, G_BOX(0.3 * d, 0.34, 0.02), p, 0, 0.2, -0.166),
      t(n, G_BOX(0.1, 0.07, 0.02), u, 0, 0.14, -0.179),
      [-1, 1].forEach((e) =>
        t(n, G_BOX(0.025, 0.26, 0.015), p, 0.11 * e, 0.4, -0.12, {
          r: [0.4, 0, 0],
        }),
      ),
      t(a, G_BOX(0.32 * d, 0.42, 0.02), p, 0, -0.16, -0.14, {
        r: [-0.05, 0, 0],
        sh: 1,
      }),
      t(a, G_BOX(0.4 * d, 0.06, 0.28), x, 0, 0.1, 0),
      [
        [-0.2, -0.02],
        [0.2, -0.02],
        [0.13, -0.03],
      ].forEach(([e, o]) => t(a, G_BOX(0.07, 0.1, 0.06), x, e * d, o, -0.03)),
      t(a, G_CYL(0.012, 0.012, 0.18, 6), m, 0.22 * d, -0.06, -0.09),
      t(n, G_BOX(0.26, 0.24, 0.1), m, 0, 0.24, 0.2, { sh: 1 }),
      t(n, G_HALFTOR(), m, 0, 0.4, 0.22, { sh: 1 }),
      t(n, G_BOX(0.1, 0.07, 0.1), f, -0.16, 0.37, 0.22),
      t(n, G_BOX(0.1, 0.07, 0.1), y, 0.16, 0.37, 0.22),
      t(n, G_SPH(0.035), M, 0, 0.44, 0.22),
      [s, i].forEach((e) =>
        t(e.fore, G_CYL(0.066, 0.072, 0.11, 9), w, 0, -0.2, 0),
      ),
      [l, c].forEach((e) =>
        t(e.leg, G_BOX(0.12, 0.12, 0.06), w, 0, -0.4, -0.075),
      ),
      t(r, G_HSPH(0.128, 0.55), T, 0, 0.235, 0.01, {
        s: [0.96, 1.02, 1.06],
        sh: 1,
      }),
      t(r, G_SPH(0.07, 10, 8), T, 0, 0.3, -0.085, {
        s: [1.45, 0.45, 0.8],
        r: [0.2, 0, 0.1],
      }),
      t(r, G_CAP(0.035, 0.1), T, 0, 0.19, 0.13, { r: [0.5, 0, 0] }),
      t(r, G_TOR(0.135, 0.012, 4, 20), w, 0, 0.29, 0, {
        r: [Math.PI / 2, 0, 0],
      }),
      [-1, 1].forEach((e) => {
        (t(r, G_CYL(0.035, 0.035, 0.035, 12), w, 0.045 * e, 0.3, -0.11, {
          r: [Math.PI / 2 - 0.3, 0, 0],
        }),
          t(r, G_CYL(0.028, 0.028, 0.038, 12), g, 0.045 * e, 0.302, -0.115, {
            r: [Math.PI / 2 - 0.3, 0, 0],
          }));
      }),
      t(r, G_BOX(0.035, 0.018, 0.015), f, -0.1, 0.29, -0.07),
      t(r, G_BOX(0.035, 0.018, 0.015), y, -0.1, 0.27, -0.07));
  },
  hongyeol(e) {
    const { add: t, S: o, hips: a, chest: n, neck: r, armL: s, armR: i } = e,
      l = o.w,
      c = chMat(4853524, "leather"),
      d = chMat(2754571, "leather"),
      h = chMat(10165019, "cloth", { side: T.DoubleSide }),
      p = chGlow(16726843, 1.2),
      u = chMat(14208964, "cloth"),
      m = chMat(1314834, "cloth"),
      f = chMat(o.hair, "hair"),
      y = chMat(12106948, "metal");
    (t(n, G_SPH(0.22, 12, 10), c, 0, 0.25, 0, {
      s: [1.03 * l, 0.95, 0.76],
      sh: 1,
    }),
      t(n, G_BOX(0.08, 0.34, 0.02), m, 0, 0.22, -0.168),
      t(a, G_BOX(0.36, 0.7, 0.03), d, 0, -0.3, 0.14, {
        r: [0.07, 0, 0],
        sh: 1,
      }),
      [-1, 1].forEach((e) =>
        t(a, G_BOX(0.15, 0.66, 0.03), d, 0.12 * e, -0.28, -0.13, {
          r: [-0.06, 0.12 * e, 0],
        }),
      ),
      t(n, G_TOR(0.11, 0.045, 6, 16), h, 0, 0.46, 0, {
        r: [Math.PI / 2, 0, 0],
      }),
      t(n, G_BOX(0.1, 0.7, 0.02), h, 0.07, 0.1, 0.19, {
        r: [0.25, 0, 0.12],
        sh: 1,
      }),
      t(n, G_BOX(0.08, 0.55, 0.02), h, -0.04, 0.16, 0.2, {
        r: [0.18, 0, -0.08],
      }),
      [s, i].forEach((e) => {
        (t(e.arm, G_BOX(0.012, 0.2, 0.012), p, 0, -0.13, -0.062),
          t(e.fore, G_BOX(0.01, 0.16, 0.01), p, 0.01, -0.11, -0.055, {
            r: [0, 0, 0.2],
          }),
          t(e.fore, G_CYL(0.058, 0.058, 0.08, 9), u, 0, -0.2, 0));
      }),
      t(a, G_BOX(0.38 * l, 0.05, 0.27), m, 0, 0.1, 0),
      t(a, G_BOX(0.06, 0.05, 0.02), y, 0, 0.1, -0.14),
      t(r, G_HSPH(0.13, 0.56), f, 0, 0.235, 0.012, {
        s: [0.96, 1.04, 1.08],
        sh: 1,
      }),
      t(r, G_SPH(0.07, 10, 8), f, -0.03, 0.28, -0.09, {
        s: [1.4, 0.5, 0.9],
        r: [0.25, 0, 0.3],
      }),
      t(r, G_CAP(0.04, 0.34), f, 0, -0.02, 0.12, { r: [0.12, 0, 0], sh: 1 }),
      t(r, G_TOR(0.042, 0.012, 4, 10), p, 0, 0.14, 0.118, {
        r: [Math.PI / 2 + 0.12, 0, 0],
      }));
  },
  gunbong(e) {
    const {
        add: t,
        S: o,
        hips: a,
        chest: n,
        neck: r,
        armL: s,
        armR: i,
        legL: l,
        legR: c,
      } = e,
      d = o.w,
      h = chMat(2829088, "cloth"),
      p = chMat(12634675, "paint"),
      u = chMat(16757504, "paint"),
      m = chMat(3815980, "cloth", {
        transparent: !0,
        opacity: 0.26,
        side: T.DoubleSide,
        depthWrite: !1,
      }),
      f = chMat(14272928, "cloth"),
      y = chMat(11566866, "leather"),
      M = chGlow(16761095, 1),
      w = chMat(15260856, "leather"),
      g = chMat(o.hair, "hair");
    t(n, G_SPH(0.225, 12, 10), h, 0, 0.25, 0, {
      s: [1.05 * d, 0.95, 0.8],
      sh: 1,
    });
    for (let e = 0; e < 3; e++)
      t(n, G_CYL(0.24 * d, 0.24 * d, 0.035, 16), p, 0, 0.14 + 0.1 * e, 0, {
        s: [1, 1, 0.78],
      });
    (t(n, G_CYL(0.17, 0.17, 0.12, 6), y, 0, 0.24, 0.22, {
      r: [Math.PI / 2, 0, 0],
      sh: 1,
    }),
      t(n, G_CYL(0.1, 0.1, 0.13, 6), u, 0, 0.24, 0.23, {
        r: [Math.PI / 2, 0, 0],
      }),
      t(n, G_CYL(0.05, 0.05, 0.14, 6), M, 0, 0.24, 0.236, {
        r: [Math.PI / 2, 0, 0],
      }),
      [s, i].forEach((e) =>
        t(e.fore, G_CYL(0.066, 0.074, 0.14, 9), w, 0, -0.19, 0),
      ),
      [l, c].forEach((e) =>
        t(e.shin, G_CYL(0.074, 0.074, 0.12, 9), p, 0, -0.27, 0),
      ),
      t(a, G_BOX(0.38 * d, 0.06, 0.27), chMat(4075301, "leather"), 0, 0.1, 0),
      [-0.1, 0.1].forEach((e) =>
        t(a, G_CYL(0.02, 0.02, 0.08, 6), M, e * d, 0.02, -0.14),
      ),
      t(r, G_HSPH(0.126, 0.5), g, 0, 0.235, 0.01, { s: [0.95, 0.95, 1.02] }),
      t(r, G_CYL(0.3, 0.3, 0.015, 28), f, 0, 0.33, 0, { sh: 1 }),
      t(r, G_CYL(0.13, 0.14, 0.12, 20), f, 0, 0.39, 0, { sh: 1 }),
      t(r, G_TOR(0.135, 0.014, 4, 20), u, 0, 0.35, 0, {
        r: [Math.PI / 2, 0, 0],
      }),
      t(
        r,
        chGeo(
          "veil",
          () => new T.CylinderGeometry(0.28, 0.29, 0.26, 24, 1, !0),
        ),
        m,
        0,
        0.2,
        0,
      ),
      [-1, 1].forEach((e) =>
        t(r, G_CYL(0.026, 0.026, 0.02, 10), M, 0.042 * e, 0.238, -0.11, {
          r: [Math.PI / 2, 0, 0],
        }),
      ));
  },
});
var CASTER = null;
function casterDist() {
  return CASTER && player && player.pos && CASTER.pos
    ? Math.hypot(CASTER.pos.x - player.pos.x, CASTER.pos.z - player.pos.z)
    : 0;
}
function casterWeight() {
  if (!CASTER) return 1;
  const e = casterDist();
  return e > 40 ? 0 : Math.max(0, 1 - e / 40);
}
function castAbility(e, t) {
  "host" === NET.mode &&
    player &&
    null != player.id &&
    sendEventAll({
      t: "cast",
      a: player.id,
      ty: e,
      x: Q.pos(player.pos.x),
      y: Q.pos(player.y || 0),
      z: Q.pos(player.pos.z),
      yw: Q.ang(player.yaw || 0),
      pt: Q.ang(player.pitch || 0),
    });
  const o = forwardVec(),
    a = player.pos,
    n = (player.agent && player.agent.color) || "#ffffff",
    r = parseInt(String(n).replace("#", ""), 16) || 16777215,
    s = MOT(),
    i = !CASTER,
    l = casterWeight();
  if (t && t.ult) {
    if (i) {
      try {
        ultCutIn(player.agent, t.name);
      } catch (e) {}
      try {
        SFX.ultCast();
      } catch (e) {}
    } else if (l > 0) {
      try {
        SFX.ultCast();
      } catch (e) {}
      edgeFlash(n, 0.5 * l);
    }
    s > 0 && castBurst(a.x, a.z, r, 2);
  } else if (
    (i && edgeFlash(n, 0.42),
    screenShake(0.16),
    s > 0 && castBurst(a.x, a.z, r, 0.85),
    i || l > 0)
  )
    try {
      SFX.abilityCast(e);
    } catch (e) {}
  if (
    ((player._castS = castStyle(e, t)),
    (player._castD = player._castT = CAST_DUR[player._castS]),
    i && !ULTW_OF[e])
  )
    try {
      vmCast(player._castS);
    } catch (e) {}
  if (CAST_EXT[e]) CAST_EXT[e](t, o, a);
  else
    switch (e) {
      case "wall_fire": {
        const e = aimPoint(24),
          t = new T.Vector3(-o.z, 0, o.x);
        for (let o = -3; o <= 3; o++) {
          makeZone(
            e.x + t.x * o * 2.1,
            e.z + t.z * o * 2.1,
            1.9,
            4.2,
            11,
            16734780,
            { y: abilityGroundY(e.x, e.z, e.y), dps: 12, name: "불꽃 장막" },
          );
        }
        banner("불꽃 장막", "#ff5a3c");
        break;
      }
      case "proj_fire":
        throwProjectile(16742956, 22, (e, t, o) => {
          (explode(e, o, 7.5, 55, 30, 16734780),
            makeZone(e, o, 7, 1.2, 3, 16734780, { y: abilityGroundY(e, o, t), dps: 20, name: "화염" }));
        });
        break;
      case "smoke_fire":
        makeSmoke(aimPoint(30), 7.5, 12, 16747100);
        break;
      case "ult_fire":
        startUltW(player, "flame", t);
        break;
      case "trap_slow": {
        const e = aimPoint(20);
        makeTrap(e.x, e.z, 7.6, 5227511, (t) => {
          ((t.slow = 0.32),
            (t.slowT = 5),
            (t.revealed = 5),
            t.ai && (t.ai.crouchT = 0));
          const o = makeMire(e.x, e.z, 7.6, 5227511, 0.38, 6, e.y);
          (o && (o.team = (player && player.team) || "atk"),
            endBurst(e.x, e.z, 5227511, 7.6),
            screenShake(0.22));
          try {
            SFX.abilityHit();
          } catch (e) {}
        }, undefined, e.y);
        break;
      }
      case "wall_ice": {
        const e = aimPoint(18),
          t =
            (new T.Vector3(-o.z, 0, o.x),
            addBox(
              e.x,
              e.z,
              1.4,
              11,
              4.2,
              new T.MeshStandardMaterial({
                color: 10476799,
                transparent: !0,
                opacity: 0.7,
                roughness: 0.2,
                metalness: 0.4,
              }),
              { hp: 400, temp: !0, y: abilityGroundY(e.x, e.z, e.y) },
            ));
        t.mesh.rotation.y = player.yaw;
        const a = Math.abs(o.x) > Math.abs(o.z);
        ((t.minX = e.x - (a ? 0.7 : 5.5)),
          (t.maxX = e.x + (a ? 0.7 : 5.5)),
          (t.minZ = e.z - (a ? 5.5 : 0.7)),
          (t.maxZ = e.z + (a ? 5.5 : 0.7)),
          t.mesh.geometry.dispose(),
          (t.mesh.geometry = new T.BoxGeometry(
            t.maxX - t.minX,
            4.2,
            t.maxZ - t.minZ,
          )),
          (t.mesh.rotation.y = 0),
          t.mesh.position.set(e.x, (t.y0 || 0) + 2.1, e.z),
          (CHASH.dirty = true),
          setTimeout(() => {
            COLLIDERS.includes(t) && destroyCollider(t);
          }, 3e4),
          banner("빙벽", "#4fc3f7"));
        break;
      }
      case "smoke_ice":
        makeSmoke(aimPoint(30), 8, 14, 10476799).slowZone = !0;
        break;
      case "ult_ice": {
        banner("빙결", "#4fc3f7");
        const e = aimPoint(26);
        (makeZone(e.x, e.z, 14, 5, 2.4, 10476799, { y: abilityGroundY(e.x, e.z, e.y), freeze: !0, name: "빙결" }),
          shardErupt(e.x, e.z, 14, 10476799, 22),
          otherFighters().forEach((t) => {
            t.alive &&
              t.team !== player.team &&
              dist2(t.pos.x, t.pos.z, e.x, e.z) <
                196 * (window.AB_R || 1) * (window.AB_R || 1) &&
              ((t.root = 2), (t.revealed = 4));
          }),
          screenShake(0.35));
        break;
      }
      case "recon_dart":
        throwProjectile(11225020, 30, (e, t, o) => {
          (revealArea(e, o, 14, 3),
            makeZone(e, o, 14, 0.4, 3, 11225020, { y: abilityGroundY(e, o, t), name: "탐지" }));
        });
        break;
      case "dash": {
        const e = a.x,
          t = a.z,
          n = o.clone().multiplyScalar(9 * (window.AB_D || 1)),
          r = player.y;
        for (let o = 1; o <= 12; o++) {
          const s = e + n.x * (o / 12),
            i = t + n.z * (o / 12);
          if (collideXZ(s, i, r, PR)) break;
          ((a.x = s), (a.z = i));
        }
        ((player.invuln = 0.4), banner("잔영", "#ab47bc"));
        break;
      }
      case "flash": {
        const e = aimPoint(28);
        makeFlash(e.x, e.z);
        break;
      }
      case "ult_recon":
        (banner("그림자 사냥", "#ab47bc"),
          empWave(a.x, a.z, 11225020),
          markPillars(11225020),
          otherFighters().forEach((e) => {
            e.team !== player.team && (e.revealed = 8);
          }),
          (player.speedBuff = 1.3),
          (player.speedBuffT = 8));
        break;
      case "nade":
        throwProjectile(16754470, 20, (e, t, o) => {
          (explode(e, o, 9, 65, 25, 16754470), screenShake(0.3));
        });
        break;
      case "shield":
        ((player.shielded = 8), banner("전선 방패", "#ffa726"));
        break;
      case "charge": {
        const e = a.x,
          t = a.z,
          n = o.clone().multiplyScalar(13 * (window.AB_D || 1)),
          r = new Set();
        for (let o = 1; o <= 26; o++) {
          const s = e + n.x * (o / 26),
            i = t + n.z * (o / 26);
          if (collideXZ(s, i, player.y, PR)) break;
          if (((a.x = s), (a.z = i), o % 2 == 0)) {
            const e = glowDot(16754470, 0.6, 1.8);
            (e.position.set(s, (player.y || 0) + 1.1, i),
              addFx(e, 0.35, (e, t) => {
                e.material.opacity = 0.7 * (1 - t);
              }));
          }
          let l = !1;
          for (const e of otherFighters())
            e.alive &&
              e.team !== player.team &&
              dist2(e.pos.x, e.pos.z, s, i) < 2.3 &&
              (r.add(e), (l = !0));
          if (l) break;
        }
        (otherFighters().forEach((e) => {
          e.alive &&
            e.team !== player.team &&
            dist2(e.pos.x, e.pos.z, a.x, a.z) <
              12 * (window.AB_R || 1) * (window.AB_R || 1) &&
            r.add(e);
        }),
          r.forEach((e) => {
            hurtFighter(e, 40, !1, player);
            const t = Math.atan2(e.pos.z - a.z, e.pos.x - a.x);
            ((e.y = moveWithSlide(
              e.pos,
              4 * Math.cos(t),
              4 * Math.sin(t),
              e.y || 0,
              0.35,
            )),
              applyConcuss(e, 0.6));
          }),
          r.size &&
            (fxRing(a.x, a.z, 3.5, 16754470, 0.4), viewerShake(a.x, a.z, 0.45)),
          screenShake(0.25),
          banner("돌진", "#ffa726"));
        break;
      }
      case "ult_smash":
        (i || shardErupt(a.x, a.z, 4, 16754470, 8),
          startUltW(player, "fist", t));
        break;
      case "heal": {
        const e = aimPoint(16);
        (makeZone(e.x, e.z, 8, 1.5, 8, 6732650, { y: abilityGroundY(e.x, e.z, e.y), heal: 15, name: "회복" }),
          banner("회복의 씨앗", "#66bb6a"));
        break;
      }
      case "root": {
        let e = null,
          t = 1e9;
        (otherFighters().forEach((o) => {
          if (!o.alive || o.team === player.team) return;
          const n = dist2(o.pos.x, o.pos.z, a.x, a.z);
          n < 900 &&
            n < t &&
            !rayBlocked(a.x, player.y + 1.5, a.z, o.pos.x, o.y + 1, o.pos.z) &&
            ((t = n), (e = o));
        }),
          e
            ? ((e.root = 2.5),
              (e.revealed = 3),
              makeZone(e.pos.x, e.pos.z, 2, 2.5, 2.5, 6732650, {
                y: abilityGroundY(e.pos.x, e.pos.z, e.y),
                name: "결박",
              }),
              banner("뿌리 결박", "#66bb6a"))
            : banner("대상 없음", "#8a97ab"));
        break;
      }
      case "smoke":
        makeSmoke(aimPoint(34), 8, 16, 10135480);
        break;
      case "ult_res": {
        (banner("재생", "#66bb6a"),
          (player.hp = Math.min(100, player.hp + 60)));
        const e = otherFighters().find(
          (e) => !e.alive && e.team === player.team,
        );
        if (e) {
          ((e.alive = !0),
            (e.hp = 100),
            (e.armor = 0),
            e.group && (e.group.visible = !0),
            "function" == typeof isAI &&
              "ai" === e.ctrl &&
              "function" == typeof freshAIState &&
              (e.ai = freshAIState()));
          const t = "atk" === player.team ? MAP.attackSpawn : MAP.defendSpawn;
          e.pos.set(t.x + rnd(-4, 4), 0, t.z + rnd(-4, 4));
          for (let o = 0; o < 24 && collideXZ(e.pos.x, e.pos.z, 0.9, PR); o++) {
            const a = 2.4 * o,
              n = 1 + 0.5 * o;
            e.pos.set(t.x + Math.cos(a) * n, 0, t.z + Math.sin(a) * n);
          }
          revivePillar(e.pos.x, e.pos.z, 6732650);
        }
        revivePillar(a.x, a.z, 6732650);
        break;
      }
      case "emp": {
        const e = aimPoint(24);
        (makeZone(e.x, e.z, 10, 3, 6, 16766287, { y: abilityGroundY(e.x, e.z, e.y), silence: !0, name: "교란" }),
          otherFighters().forEach((t) => {
            t.alive &&
              t.team !== player.team &&
              dist2(t.pos.x, t.pos.z, e.x, e.z) <
                100 * (window.AB_R || 1) * (window.AB_R || 1) &&
              stunFighter(t, 6);
          }),
          banner("전자 교란", "#ffd54f"));
        break;
      }
      case "drone":
        (makeDrone(), banner("감시 드론", "#ffd54f"));
        break;
      case "mine": {
        const e = aimPoint(18);
        makeTrap(e.x, e.z, 7, 16766287, (t) => {
          (hurtFighter(t, 45, !1, "player"),
            (t.blind = 3),
            (t.revealed = 4),
            (t.slow = 0.42),
            (t.slowT = 4));
          const o = makeMire(e.x, e.z, 7, 16766287, 0.45, 5, e.y);
          (o && (o.team = (player && player.team) || "atk"),
            explode(e.x, e.z, 7, 55, 22, 16766287),
            screenShake(0.55));
          try {
            SFX.abilityHit();
          } catch (e) {}
        }, undefined, e.y);
        break;
      }
      case "ult_emp":
        (banner("정전", "#ffd54f"),
          empWave(a.x, a.z, 16766287),
          markPillars(16766287),
          otherFighters().forEach((e) => {
            e.team !== player.team && (stunFighter(e, 10), (e.revealed = 10));
          }),
          screenShake(0.3));
        break;
      case "pierce": {
        const e = new T.Vector3(a.x, player.y + eyeHeight(), a.z),
          t = new T.Vector3(
            -Math.sin(player.yaw) * Math.cos(player.pitch),
            Math.sin(player.pitch),
            -Math.cos(player.yaw) * Math.cos(player.pitch),
          );
        let o = !1;
        (otherFighters().forEach((a) => {
          if (!a.alive || a.team === player.team) return;
          const n = new T.Vector3(
            a.pos.x - e.x,
            a.y + 1.1 - e.y,
            a.pos.z - e.z,
          ).dot(t);
          if (n < 0 || n > 120) return;
          const r = t.clone().multiplyScalar(n).add(e);
          Math.hypot(r.x - a.pos.x, r.y - (a.y + 1.1), r.z - a.pos.z) < 1.1 &&
            (hurtFighter(a, 80, !1, "player"), (o = !0));
        }),
          addTracer(e, player.yaw, player.pitch, 120),
          banner(o ? "관통 명중" : "관통 사격", o ? "#e0e0e0" : "#5b6879"));
        break;
      }
      case "sensor": {
        const e = aimPoint(20);
        makeTrap(
          e.x,
          e.z,
          13,
          14737632,
          (e) => {
            ((e.revealed = 6),
              (e.slow = 0.6),
              (e.slowT = 2.5),
              banner("적 감지됨", "#e0e0e0"),
              endBurst(e.pos.x, e.pos.z, 14737632, 3));
            try {
              SFX.abilityHit();
            } catch (e) {}
          },
          !0,
        );
        break;
      }
      case "ult_snipe":
        (markPillars(14737632),
          i || shardErupt(a.x, a.z, 7, 14737632, 8),
          otherFighters().forEach((e) => {
            e.team !== player.team && (e.revealed = 8);
          }),
          startUltW(player, "bow", t));
    }
}
function makeZone(e, t, o, a, n, r, s) {
  const i = new T.Group();
  const groundY = s?.y ?? abilityGroundY(e, t);
  i.position.set(e, groundY, t);
  const l = new T.Mesh(
    new T.CylinderGeometry(o, o, a, 32, 1, !0),
    new T.MeshBasicMaterial({
      color: r,
      transparent: !0,
      opacity: 0.2,
      side: T.DoubleSide,
      depthWrite: !1,
    }),
  );
  ((l.position.y = a / 2), i.add(l));
  const c = new T.Mesh(
    new T.CylinderGeometry(0.82 * o, 0.9 * o, 0.92 * a, 26, 1, !0),
    new T.MeshBasicMaterial({
      color: r,
      transparent: !0,
      opacity: 0.13,
      side: T.DoubleSide,
      depthWrite: !1,
    }),
  );
  ((c.position.y = 0.46 * a), i.add(c));
  const d = new T.Mesh(
    new T.RingGeometry(0.93 * o, o, 44),
    new T.MeshBasicMaterial({
      color: r,
      transparent: !0,
      opacity: 0.85,
      side: T.DoubleSide,
      depthWrite: !1,
    }),
  );
  ((d.rotation.x = -Math.PI / 2), (d.position.y = 0.05), i.add(d));
  const h = new T.Mesh(
    new T.CircleGeometry(o, 40),
    new T.MeshBasicMaterial({
      color: r,
      transparent: !0,
      opacity: 0.14,
      side: T.DoubleSide,
      depthWrite: !1,
    }),
  );
  ((h.rotation.x = -Math.PI / 2), (h.position.y = 0.03), i.add(h));
  const p = new T.Mesh(
    new T.CircleGeometry(0.97 * o, 48),
    new T.MeshBasicMaterial({
      map: runeTex(),
      color: new T.Color(r).multiplyScalar(1.6),
      transparent: !0,
      opacity: 0.55,
      depthWrite: !1,
      blending: T.AdditiveBlending,
    }),
  );
  ((p.rotation.x = -Math.PI / 2), (p.position.y = 0.045), i.add(p));
  const u = [],
    m = new T.SpriteMaterial({
      map: glowTex(),
      color: new T.Color(r).multiplyScalar(2),
      transparent: !0,
      opacity: 0.75,
      depthWrite: !1,
      blending: T.AdditiveBlending,
    }),
    f = Math.round(
      Math.min(34, 10 + 2.2 * o) * Math.max(0.4, void 0 !== GFX ? GFX.fx : 1),
    );
  for (let e = 0; e < f; e++) {
    const e = new T.Sprite(m),
      t = Math.random() * Math.PI * 2,
      n = Math.sqrt(Math.random()) * o * 0.92;
    (e.position.set(Math.cos(t) * n, Math.random() * a, Math.sin(t) * n),
      e.scale.setScalar(0.18 + 0.2 * Math.random()),
      (e.userData.sp = 0.5 + 1.1 * Math.random()),
      (e.userData.sw = 6.28 * Math.random()),
      i.add(e),
      u.push(e));
  }
  (fxFlash(r, 2.2, 2.6 * o, e, groundY + 0.5 * a, t, 0.7, 1.5), scene.add(i));
  const y = {
    x: e,
    y: groundY,
    z: t,
    r: o,
    h: a,
    life: n,
    maxLife: n,
    mesh: i,
    owner: "player",
    team: (player && player.team) || "atk",
    _ring: d,
    _motes: u,
    _rune: p,
    _lit: null,
    _t: 0,
    ...s,
  };
  return (world.zones.push(y), y);
}
function animateZone(e, t) {
  if (!e.mesh) return;
  e._t = (e._t || 0) + t;
  const o = e._t,
    a = clamp(e.life / Math.max(0.001, e.maxLife), 0, 1);
  if (e._ring) {
    const n = 1 + 0.035 * Math.sin(3.4 * o);
    (e._ring.scale.set(n, n, 1),
      (e._ring.rotation.z += 0.55 * t),
      (e._ring.material.opacity = (0.55 + 0.25 * Math.sin(4.2 * o)) * a));
  }
  if (
    (e._lit && (e._lit.intensity = (0.85 + 0.35 * Math.sin(5.1 * o)) * a),
    e._motes && e._motes.length)
  ) {
    for (const a of e._motes)
      ((a.position.y += a.userData.sp * t),
        (a.position.x += Math.sin(1.7 * o + a.userData.sw) * t * 0.15),
        a.position.y > e.h && (a.position.y = 0));
    e._motes[0].material.opacity = 0.75 * a;
  }
  (e._rune &&
    ((e._rune.rotation.z += 0.35 * t),
    (e._rune.material.opacity =
      (0.42 + 0.12 * Math.sin(2.6 * o)) * a * Math.min(1, 3 * o))),
    e.mesh.children.forEach((t) => {
      t.material &&
        t.material.transparent &&
        t !== e._ring &&
        t !== e._rune &&
        !t.isSprite &&
        (t.material.opacity = Math.min(t.material.opacity, 0.22 * a));
    }));
}
function makeSmoke(e, t, o, a) {
  const n = e.x - player.pos.x,
    r = e.z - player.pos.z;
  if (Math.hypot(n, r) < 6) {
    const t = forwardVec();
    e = { x: player.pos.x + 8 * t.x, z: player.pos.z + 8 * t.z };
  }
  const s = new T.Group();
  for (let e = 0; e < 14; e++) {
    const e = new T.Mesh(
      new T.SphereGeometry(t * rnd(0.5, 0.82), 12, 9),
      new T.MeshBasicMaterial({
        color: a,
        transparent: !0,
        opacity: 0.46,
        depthWrite: !1,
      }),
    );
    (e.position.set(
      rnd(0.55 * -t, 0.55 * t),
      rnd(0.5, 0.8 * t),
      rnd(0.55 * -t, 0.55 * t),
    ),
      e.scale.setScalar(0.05),
      s.add(e));
  }
  const i = new T.SpriteMaterial({
    map: cloudTex(),
    color: new T.Color(a).lerp(new T.Color(16777215), 0.25),
    transparent: !0,
    opacity: 0.6,
    depthWrite: !1,
  });
  i.userData.cloud = !0;
  const l = Math.round(10 * Math.max(0.5, void 0 !== GFX ? GFX.fx : 1));
  for (let e = 0; e < l; e++) {
    const o = new T.Sprite(i),
      a = (e / l) * Math.PI * 2,
      n = t * rnd(0.55, 0.95);
    (o.position.set(Math.cos(a) * n, rnd(0.6, 1.05 * t), Math.sin(a) * n),
      (o.userData.base = t * rnd(1.1, 1.6)),
      o.scale.setScalar(0.05),
      s.add(o));
  }
  (s.position.set(e.x, abilityGroundY(e.x, e.z, e.y ?? player.y), e.z), scene.add(s));
  const c = {
    x: e.x,
    z: e.z,
    r: t,
    y: s.position.y,
    life: o,
    maxLife: o,
    mesh: s,
    blocksVision: !0,
  };
  return (world.smokes.push(c), banner("연막 전개", "#8a97ab"), c);
}
function withCaster(e, t) {
  if (!e) return t();
  const o = "function" == typeof myActor ? myActor() : null;
  if (!(e !== player || CASTER || (o && e !== o))) return t();
  const a = player,
    n = CASTER;
  try {
    ((CASTER = o && e === o ? null : e), (player = e));
    try {
      window.player = e;
    } catch (e) {}
    return t();
  } finally {
    player = a;
    try {
      window.player = a;
    } catch (e) {}
    CASTER = n;
  }
}
const ABIL_ENTS = [],
  DOMES = [],
  SHOOTABLES = [];
let _revTex = null;
function revTex() {
  if (_revTex) return _revTex;
  const e = document.createElement("canvas");
  e.width = e.height = 64;
  const t = e.getContext("2d");
  return (
    t.translate(32, 32),
    t.rotate(Math.PI / 4),
    (t.fillStyle = "#ff3b4e"),
    (t.strokeStyle = "#fff"),
    (t.lineWidth = 5),
    t.fillRect(-14, -14, 28, 28),
    t.strokeRect(-14, -14, 28, 28),
    (_revTex = new T.CanvasTexture(e)),
    _revTex
  );
}
function deployFx(e, t, o) {
  const a = o || 10479871;
  (fxRing(e, t, 2.2, a, 0.45), glowFlare(e, abilityGroundY(e, t) + 0.5, t, a, 1.6, 0.3));
  const n = new T.Mesh(
    new T.CylinderGeometry(0.05, 0.12, 3.2, 8, 1, !0),
    new T.MeshBasicMaterial({
      color: new T.Color(a).multiplyScalar(1.8),
      transparent: !0,
      depthWrite: !1,
      side: T.DoubleSide,
    }),
  );
  (n.position.set(e, abilityGroundY(e, t) + 1.6, t),
    addFx(n, 0.45, (e, t) => {
      ((e.material.opacity = 0.6 * (1 - t)),
        e.scale.set(1 - 0.6 * t, 1 + 0.4 * t, 1 - 0.6 * t));
    }));
}
SHOOTABLES.push = function (...e) {
  for (const t of e)
    try {
      t && isFinite(t.x) && deployFx(t.x, t.z, t.color);
    } catch (e) {}
  return Array.prototype.push.apply(this, e);
};
let CAST_REFUND = !1;
function abilSpawn(e) {
  return (ABIL_ENTS.push(e), e);
}
function abilTick(e) {
  for (let t = ABIL_ENTS.length - 1; t >= 0; t--) {
    const o = ABIL_ENTS[t];
    let a = !0;
    try {
      a = !1 !== o.update(e);
    } catch (e) {
      ((a = !1), console.warn("abil", e));
    }
    if (!a) {
      try {
        o.dispose && o.dispose();
      } catch (e) {}
      ABIL_ENTS.splice(t, 1);
    }
  }
}
function abilClear() {
  for (const e of ABIL_ENTS)
    try {
      e.dispose && e.dispose();
    } catch (e) {}
  ((ABIL_ENTS.length = 0), (DOMES.length = 0), (SHOOTABLES.length = 0));
}
function later(e, t) {
  const o = player;
  let a = e;
  abilSpawn({
    update(e) {
      if (((a -= e), a <= 0)) return (withCaster(o, t), !1);
    },
  });
}
function actorList() {
  return world.actors && world.actors.length ? world.actors : allFighters();
}
function foesOf(e) {
  const t = e && e.team;
  return actorList().filter(
    (o) => o && o.alive && o.team && o.team !== t && o !== e,
  );
}
function statusOn(e, t, o) {
  e && (e[t] = Math.max(e[t] || 0, o));
}
function areaHit(e, t, o, a, n) {
  for (const r of foesOf(a)) {
    const a = Math.hypot(r.pos.x - e, r.pos.z - t);
    a < o && n(r, 1 - a / o, a);
  }
}
function localActor() {
  return ("function" == typeof myActor && myActor()) || player;
}
function bannerMe(e, t) {
  const o = CASTER;
  CASTER = null;
  try {
    banner(e, t);
  } finally {
    CASTER = o;
  }
}
function tellTeam(e, t, o) {
  const a = localActor();
  a && e && a.team === e.team && bannerMe(t, o);
}
function viewerShake(e, t, o) {
  const a = localActor();
  if (!a || !a.pos || !SETTINGS.shake) return;
  const n = Math.hypot(a.pos.x - e, a.pos.z - t);
  if (n > 45) return;
  const r = MOT();
  r <= 0 || (shake = Math.max(shake, o * r * (1 - n / 45)));
}
function applyConcuss(e, t) {
  if ((statusOn(e, "concuss", t), e && "me" === e.ctrl)) {
    bannerMe("뇌진탕", "#b39ddb");
    try {
      SFX.silenced();
    } catch (e) {}
  }
}
function applyDecay(e, t, o) {
  if (!e || !e.alive) return;
  const a = Math.min(t, Math.max(0, e.hp - 1));
  if (
    ((e.hp -= a),
    (e.decayAmt = (e.decayAmt || 0) + a),
    (e.decayT = Math.max(e.decayT || 0, o)),
    "me" === e.ctrl)
  ) {
    bannerMe("부패 — 체력 일시 감소", "#ff6b6b");
    try {
      SFX.hurt();
    } catch (e) {}
  }
}
function raySphereT(e, t, o, a, n, r) {
  const s = e.x - o,
    i = e.y - a,
    l = e.z - n,
    c = s * t.x + i * t.y + l * t.z,
    d = s * s + i * i + l * l - r * r,
    h = c * c - d;
  if (h < 0) return 1 / 0;
  const p = Math.sqrt(h),
    u = -c - p,
    m = -c + p;
  return d < 0 ? (m > 0 ? m : 1 / 0) : u > 0 ? u : 1 / 0;
}
function domeBlockT(e, t, o) {
  let a = 1 / 0,
    n = null;
  for (const r of DOMES) {
    const s = raySphereT(e, t, r.x, r.y, r.z, r.r);
    s < a && s < o && e.y + t.y * s >= r.y - 0.05 && ((a = s), (n = r));
  }
  if (n) {
    n.hitT = 0.15;
    const o = e.x + t.x * a,
      r = e.y + t.y * a,
      s = e.z + t.z * a;
    try {
      impactSpark(o, r, s, 16769162);
    } catch (e) {}
  }
  return a;
}
function shootableHit(e, t, o, a, n) {
  let r = 1 / 0,
    s = null;
  for (const n of SHOOTABLES) {
    if (a && n.team === a.team) continue;
    const i = raySphereT(e, t, n.x, n.y, n.z, n.r);
    i < r && i < o && ((r = i), (s = n));
  }
  if (!s) return !1;
  s.hp -= n;
  try {
    impactSpark(e.x + t.x * r, e.y + t.y * r, e.z + t.z * r, 16777215);
  } catch (e) {}
  if (s.hp <= 0 && s.onBreak) {
    const e = s.onBreak;
    ((s.onBreak = null), e());
  }
  return !0;
}
function fxRing(e, t, o, a, n, r) {
  const s = new T.Mesh(
    new T.RingGeometry(0.9, 1, 56),
    new T.MeshBasicMaterial({
      color: a,
      transparent: !0,
      side: T.DoubleSide,
      depthWrite: !1,
    }),
  );
  ((s.rotation.x = -Math.PI / 2), s.position.set(e, r || abilityGroundY(e, t) + 0.1, t));
  const i = MOT();
  addFx(s, n || 0.6, (e, t) => {
    const a = 0.3 + t * o;
    (e.scale.set(a, a, 1),
      (e.material.opacity = (1 - t) * (0.5 + 0.4 * Math.min(1, i))));
  });
}
function fxBolt(e, t, o, a, n, r, s, i) {
  const l = [];
  for (let s = 0; s <= 12; s++) {
    const i = s / 12,
      c = 0 === s || 12 === s ? 0 : 0.45;
    l.push(
      new T.Vector3(
        e + (a - e) * i + rnd(-c, c),
        t + (n - t) * i + rnd(0.4 * -c, 0.4 * c),
        o + (r - o) * i + rnd(-c, c),
      ),
    );
  }
  addFx(
    new T.Line(
      new T.BufferGeometry().setFromPoints(l),
      new T.LineBasicMaterial({ color: s, transparent: !0 }),
    ),
    i || 0.25,
    (e, t) => {
      e.material.opacity = 1 - t;
    },
  );
}
function fxTracer(e, t, o, a, n, r, s) {
  addFx(
    new T.Line(
      new T.BufferGeometry().setFromPoints([
        new T.Vector3(e, t, o),
        new T.Vector3(a, n, r),
      ]),
      new T.LineBasicMaterial({ color: s, transparent: !0, opacity: 0.9 }),
    ),
    0.07,
    (e, t) => {
      e.material.opacity = 0.9 * (1 - t);
    },
  );
}
function fxColumn(e, t, o, a, n) {
  const groundY = abilityGroundY(e, t);
  const r = new T.Mesh(
    new T.CylinderGeometry(0.35, 0.35, a || 7, 12, 1, !0),
    new T.MeshBasicMaterial({
      color: o,
      transparent: !0,
      opacity: 0.5,
      side: T.DoubleSide,
      depthWrite: !1,
    }),
  );
  (r.position.set(e, groundY + ((a || 7) / 2), t),
    addFx(r, n || 1, (e, t) => {
      ((e.material.opacity = 0.5 * (1 - t)),
        e.scale.set(1 + 0.6 * t, 1, 1 + 0.6 * t));
    }));
}
function fxShatter(e, t, o) {
  const groundY = abilityGroundY(e, t);
  const a = Math.max(4, Math.round(14 * Math.max(0.3, MOT())));
  for (let n = 0; n < a; n++) {
    const a = new T.Mesh(
      new T.TetrahedronGeometry(rnd(0.06, 0.16)),
      new T.MeshBasicMaterial({ color: o, transparent: !0, depthWrite: !1 }),
    );
    a.position.set(e, groundY + (rnd(0.6, 1.8)), t);
    const n = Math.random() * Math.PI * 2,
      r = rnd(2, 6);
    let s = rnd(1, 4);
    const i = Math.cos(n) * r,
      l = Math.sin(n) * r;
    addFx(a, 0.7, (e, t, o) => {
      const a = o || 0.016;
      ((e.position.x += i * a),
        (e.position.z += l * a),
        (e.position.y += s * a),
        (s -= 9 * a),
        (e.rotation.x += 8 * a),
        (e.rotation.y += 6 * a),
        (e.material.opacity = 1 - t));
    });
  }
}
function fxArc(e, t, o, a, n) {
  const groundY = abilityGroundY(e, t);
  const r = new T.Mesh(
    new T.RingGeometry(
      0.93,
      1,
      40,
      1,
      o + Math.PI / 2 - Math.PI / 3,
      (2 * Math.PI) / 3,
    ),
    new T.MeshBasicMaterial({
      color: n,
      transparent: !0,
      side: T.DoubleSide,
      depthWrite: !1,
    }),
  );
  ((r.rotation.x = -Math.PI / 2),
    r.position.set(e, groundY + 0.15, t),
    addFx(r, 0.7, (e, t) => {
      const o = 1 + t * a;
      (e.scale.set(o, o, 1), (e.material.opacity = 0.8 * (1 - t)));
    }));
}
function fxPuff(e, t, o, a, n) {
  const r = 0.42 * (n || 1),
    s = glowDot(a, r);
  (s.position.set(e, t, o),
    addFx(s, 0.35, (e, t) => {
      (e.scale.setScalar(r * (1 + 1.5 * t)),
        (e.material.opacity = 0.8 * (1 - t)));
    }));
}
function auraFx(e, t, o) {
  const a = new T.Mesh(
    new T.RingGeometry(0.55, 0.72, 32),
    new T.MeshBasicMaterial({
      color: t,
      transparent: !0,
      opacity: 0.7,
      side: T.DoubleSide,
      depthWrite: !1,
    }),
  );
  ((a.rotation.x = -Math.PI / 2), scene.add(a));
  let n = 0;
  abilSpawn({
    update: (r) => (
      (n += r),
      !!e.alive &&
        (a.position.set(e.pos.x, (e.y || 0) + 0.06, e.pos.z),
        a.scale.setScalar(1 + 0.12 * Math.sin(6 * n)),
        (a.material.opacity = 0.7 * Math.min(1, 2 * (o - n))),
        Math.random() < 0.25 &&
          fxPuff(
            e.pos.x + rnd(-0.4, 0.4),
            (e.y || 0) + rnd(0.2, 1.6),
            e.pos.z + rnd(-0.4, 0.4),
            t,
            0.8,
          ),
        n < o)
    ),
    dispose() {
      (scene.remove(a), a.geometry.dispose(), a.material.dispose());
    },
  });
}
function beeCloud(e, t, o, a, n) {
  const r = new T.Group();
  scene.add(r);
  const s = new T.MeshBasicMaterial({ color: n }),
    i = new T.SphereGeometry(0.05, 5, 4),
    l = [],
    c = Math.round(18 + 3 * o);
  for (let e = 0; e < c; e++) {
    const e = new T.Mesh(i, s);
    ((e.userData = {
      a: 6.28 * Math.random(),
      r: Math.sqrt(Math.random()) * o,
      h: rnd(0.4, 2.2),
      s: rnd(1.5, 3.5) * (Math.random() < 0.5 ? -1 : 1),
    }),
      r.add(e),
      l.push(e));
  }
  r.position.set(e, abilityGroundY(e, t), t);
  let d = 0;
  abilSpawn({
    update(e) {
      d += e;
      for (const t of l) {
        const o = t.userData;
        ((o.a += (e * o.s) / Math.max(0.6, 0.4 * o.r)),
          t.position.set(
            Math.cos(o.a) * o.r,
            o.h + 0.2 * Math.sin(6 * d + o.a),
            Math.sin(o.a) * o.r,
          ));
      }
      return d < a;
    },
    dispose() {
      (scene.remove(r), i.dispose(), s.dispose());
    },
  });
}
function animateFake(e, t) {
  const o = 0.55 * Math.sin(t);
  ((e.legL.leg.rotation.x = o),
    (e.legR.leg.rotation.x = -o),
    (e.legL.shin.rotation.x = 0.8 * -Math.max(0, o)),
    (e.legR.shin.rotation.x = 0.8 * -Math.max(0, -o)),
    (e.hips.position.y = 0.92 - 0.03 * Math.abs(Math.sin(t))));
}
function spawnSeeker(e, t, o) {
  const a = new T.Group(),
    n = new T.MeshStandardMaterial({
      color: o.color,
      emissive: o.color,
      emissiveIntensity: 1.3,
      roughness: 0.3,
    }),
    r = new T.Mesh(new T.OctahedronGeometry(o.big ? 0.3 : 0.22), n);
  a.add(r);
  const s = -Math.sin(e.yaw),
    i = -Math.cos(e.yaw);
  let l = 2.2;
  try {
    rayBlocked(
      e.pos.x,
      1.4,
      e.pos.z,
      e.pos.x + 2.4 * s,
      1.4,
      e.pos.z + 2.4 * i,
    ) && (l = 0.9);
  } catch (e) {}
  const c = new T.Vector3(e.pos.x + s * l, 0, e.pos.z + i * l);
  (a.position.set(c.x, (e.y || 0) + 2.1, c.z), scene.add(a));
  let d = o.life || 7,
    h = o.delay || 0,
    p = t,
    u = null,
    m = 0,
    f = 0,
    y = 0;
  return abilSpawn({
    update(t) {
      if (((y += t), h > 0))
        return ((h -= t), (a.position.y = (e.y || 0) + 2.1 + 0.8 * y), !0);
      if (((d -= t), !p || !p.alive)) {
        p = null;
        let o = 1e9;
        for (const t of foesOf(e)) {
          const e = dist2(t.pos.x, t.pos.z, c.x, c.z);
          e < o && ((o = e), (p = t));
        }
        if (((u = null), !p)) return ((a.position.y += 0.5 * t), y < 1.5);
      }
      if (((f -= t), f <= 0)) {
        f = 0.5;
        try {
          ((u = findPath(c.x, c.z, p.pos.x, p.pos.z)), (m = 0));
        } catch (e) {
          u = null;
        }
      }
      let n = p.pos.x,
        s = p.pos.z;
      if (
        !!rayBlocked(c.x, abilityGroundY(c.x, c.z, e.y) + 1.2, c.z, p.pos.x, p.y + 1.1, p.pos.z) &&
        u &&
        u.length
      ) {
        for (
          ;
          m < u.length - 1 && Math.hypot(u[m].x - c.x, u[m].z - c.z) < 1.3;

        )
          m++;
        ((n = u[m].x), (s = u[m].z));
      }
      const i = n - c.x,
        l = s - c.z,
        M = Math.hypot(i, l) || 1,
        w = o.speed || 9;
      moveWithSlide(c, (i / M) * w * t, (l / M) * w * t, abilityGroundY(c.x, c.z, e.y), 0.25);
      const T = abilityGroundY(c.x, c.z, e.y) + (o.fly ? 1.35 : 0.45) + 0.08 * Math.sin(9 * y);
      return (
        a.position.set(
          c.x,
          a.position.y + (T - a.position.y) * Math.min(1, 5 * t),
          c.z,
        ),
        (r.rotation.y += 8 * t),
        (r.rotation.x += 5 * t),
        Math.random() < 0.45 &&
          fxPuff(
            a.position.x,
            a.position.y,
            a.position.z,
            o.color,
            o.big ? 1.3 : 1,
          ),
        Math.hypot(p.pos.x - c.x, p.pos.z - c.z) < 1.3
          ? (withCaster(e, () => {
              o.onHit(p);
              try {
                SFX.abilityHit();
              } catch (e) {}
              fxShatter(c.x, c.z, o.color);
            }),
            !1)
          : d > 0
      );
    },
    dispose() {
      (scene.remove(a), r.geometry.dispose(), n.dispose());
    },
  });
}
function teamHex(e) {
  return e && "def" === e.team ? 3718648 : 16739146;
}
const CAST_EXT = {
    bolt_jump(e, t, o) {
      const a = player;
      ((a.vy = 12.5),
        (a.onGround = !1),
        (a._boltJump = !0),
        (a._airT = 0),
        fxRing(o.x, o.z, 3.5, 8162559, 0.5),
        fxBolt(o.x, 0.1, o.z, o.x, 5.5, o.z, 12962815, 0.3));
    },
    blink(e, t, o) {
      const a = player,
        n = aimPoint(window.BLINK_RANGE / (window.AB_D || 1));
      let r = n.x - 0.7 * t.x,
        s = n.z - 0.7 * t.z;
      for (let e = 0; e < 12 && collideXZ(r, s, a.y || 0, PR); e++)
        ((r -= 0.6 * t.x), (s -= 0.6 * t.z));
      const i = o.x,
        l = o.z;
      (fxShatter(i, l, 10135295),
        (o.x = r),
        (o.z = s),
        a.vel && a.vel.set(0, 0, 0),
        fxBolt(i, 1.2, l, r, 1.2, s, 12962815, 0.35),
        fxBolt(i, 0.6, l, r, 1.6, s, 8162559, 0.3),
        fxRing(r, s, 3, 8162559, 0.45),
        (a.invuln = Math.max(a.invuln || 0, 0.15)));
    },
    static_orb(e, t, o) {
      const a = player;
      throwProjectile(10135295, 22, (e, t, o) => {
        (fxRing(e, o, 6, 10135295, 0.5), fxRing(e, o, 3.5, 15264767, 0.35));
        for (let t = 0; t < 6; t++) {
          const t = 6.28 * Math.random(),
            a = rnd(1.5, 5.5);
          fxBolt(
            e,
            1.2,
            o,
            e + Math.cos(t) * a,
            0.15,
            o + Math.sin(t) * a,
            12962815,
            0.3,
          );
        }
        (areaHit(e, o, 6, a, (e) => {
          (hurtFighter(e, 15, !1, a), applyConcuss(e, 3));
        }),
          viewerShake(e, o, 0.25));
        try {
          SFX.abilityHit();
        } catch (e) {}
      });
    },
    ult_lightning(e, t, o) {
      startUltW(player, "beam", e);
    },
    decoy(e, t, o) {
      const a = player,
        n = ((a.agent && a.agent.id) || "_") + "|" + teamHex(a),
        r = (DECOY_POOL[n] = DECOY_POOL[n] || []);
      let s = r.pop();
      (s ||
        ((s = buildFighter(teamHex(a), a.agent)),
        s.group.traverse((e) => {
          if (e.isMesh && e.material) {
            if (e.material === CH_VC) return void (e.material = chVCGhost());
            ((e.material = e.material.clone()),
              (e.material.transparent = !0),
              (e.material.opacity = 0.8));
          }
        })),
        (s.group.visible = !0),
        scene.add(s.group));
      const i = new T.Vector3(o.x + 1.2 * t.x, 0, o.z + 1.2 * t.z),
        l = a.yaw,
        c = 5.4 * t.x,
        d = 5.4 * t.z;
      let h = 6,
        p = 0,
        u = !1,
        m = 0;
      const f = () => {
        if (!u) {
          ((u = !0),
            fxShatter(i.x, i.z, 14808574),
            fxRing(i.x, i.z, 5, 14808574, 0.4));
          for (const e of foesOf(a)) {
            Math.hypot(e.pos.x - i.x, e.pos.z - i.z) <
              28 * (window.AB_R || 1) &&
              !rayBlocked(e.pos.x, e.y + 1.5, e.pos.z, i.x, 1.2, i.z) &&
              (statusOn(e, "blind", 1.6), statusOn(e, "revealed", 4));
          }
          tellTeam(a, "거울상 깨짐 — 적 노출", "#e1f5fe");
        }
      };
      abilSpawn({
        update(e) {
          if (((h -= e), (p += e), !u)) {
            if (
              (moveWithSlide(i, c * e, d * e, 0, 0.45),
              s.group.position.set(i.x, abilityGroundY(i.x, i.z), i.z),
              (s.group.rotation.y = l),
              (m += 9 * e),
              animateFake(s, m),
              p > 0.4)
            )
              for (const e of foesOf(a)) {
                const t = i.x - e.pos.x,
                  o = i.z - e.pos.z,
                  n = Math.hypot(t, o);
                if (n > 30 * (window.AB_R || 1) || n < 0.5) continue;
                if (
                  (t * -Math.sin(e.yaw) + o * -Math.cos(e.yaw)) / n >
                    ("me" === e.ctrl ? 0.96 : 0.85) &&
                  !rayBlocked(e.pos.x, e.y + 1.5, e.pos.z, i.x, 1.2, i.z)
                ) {
                  withCaster(a, f);
                  break;
                }
              }
            h <= 0 && !u && ((u = !0), fxShatter(i.x, i.z, 14808574));
          }
          return !u;
        },
        dispose() {
          if ((scene.remove(s.group), r.length < 2)) r.push(s);
          else
            try {
              chDispose(s.group);
            } catch (e) {}
        },
      });
    },
    rift_wave(e, t, o) {
      const a = player,
        n = o.x,
        r = o.z,
        s = t.x,
        i = t.z;
      for (let e = 1; e <= 12; e++)
        later(0.045 * e, () =>
          shardErupt(
            n + (s * e * 30 * (window.AB_D || 1)) / 12,
            r + (i * e * 30 * (window.AB_D || 1)) / 12,
            1.1,
            14808574,
            3,
          ),
        );
      later(0.35, () => {
        for (const e of foesOf(a)) {
          const t = e.pos.x - n,
            o = e.pos.z - r,
            l = t * s + o * i;
          l < 0 ||
            l > 30 * (window.AB_D || 1) ||
            Math.abs(t * i - o * s) > 1.9 ||
            (applyConcuss(e, 3.5),
            hurtFighter(e, 10, !1, a),
            statusOn(e, "revealed", 2));
        }
        viewerShake(n + 8 * s, r + 8 * i, 0.3);
        try {
          SFX.abilityHit();
        } catch (e) {}
      });
    },
    mirror_pulse(e, t, o) {
      const a = player,
        n = o.x,
        r = o.z,
        s = t.x,
        i = t.z,
        l = a.yaw;
      for (let e = 0; e < 3; e++)
        later(0.12 * e, () =>
          fxArc(n, r, l, 42 * (window.AB_D || 1), 14808574),
        );
      later(0.3, () => {
        let e = 0;
        for (const t of foesOf(a)) {
          const o = t.pos.x - n,
            a = t.pos.z - r,
            l = Math.hypot(o, a);
          l > 42 * (window.AB_D || 1) ||
            l < 0.1 ||
            (o * s + a * i) / l < 0.5 ||
            (statusOn(t, "revealed", 4),
            fxColumn(t.pos.x, t.pos.z, 14808574, 6, 1.2),
            e++);
        }
        tellTeam(
          a,
          e ? `은빛 파동 — ${e}명 탐지` : "은빛 파동 — 없음",
          "#e1f5fe",
        );
      });
    },
    ult_mirror(e, t, o) {
      startUltW(player, "blades", e);
    },
    sand_smoke(e, t, o) {
      makeSmoke(aimPoint(40), 8.5, 18, 7035461);
    },
    quicksand(e, t, o) {
      const a = player,
        n = aimPoint(26),
        r = n.x,
        s = n.z;
      makeZone(r, s, 7, 1.2, 2.8, 5916210, { name: "유사" });
      const i = new T.Mesh(
        new T.CircleGeometry(7, 40),
        new T.MeshBasicMaterial({
          color: 1709070,
          transparent: !0,
          opacity: 0.5,
          depthWrite: !1,
        }),
      );
      ((i.rotation.x = -Math.PI / 2), i.position.set(r, abilityGroundY(r, s) + 0.06, s), scene.add(i));
      let l = 2.6;
      abilSpawn({
        update(e) {
          ((l -= e), (i.rotation.z += 2.4 * e));
          for (const t of foesOf(a)) {
            const o = r - t.pos.x,
              a = s - t.pos.z,
              n = Math.hypot(o, a);
            n > 7 ||
              n < 0.4 ||
              (moveWithSlide(
                t.pos,
                (o / n) * 4.2 * e,
                (a / n) * 4.2 * e,
                t.y || 0,
                0.4,
              ),
              (t.slow = Math.min(t.slow || 1, 0.5)),
              (t.slowT = Math.max(t.slowT || 0, 0.3)));
          }
          return (
            !(l <= 0) ||
            (withCaster(a, () => {
              (areaHit(r, s, 7, a, (e) => {
                (statusOn(e, "vuln", 5), hurtFighter(e, 10, !1, a));
              }),
                fxRing(r, s, 7, 13215339, 0.5),
                shardErupt(r, s, 4.2, 13215339, 8));
            }),
            !1)
          );
        },
        dispose() {
          (scene.remove(i), i.geometry.dispose(), i.material.dispose());
        },
      });
    },
    sand_wall(e, t, o) {
      const a = player,
        n = -t.z,
        r = t.x,
        s = o.x + 3 * t.x,
        i = o.z + 3 * t.z,
        l = [];
      for (let e = -2; e <= 2; e++) {
        const t = new T.Group();
        for (let e = 0; e < 5; e++) {
          const o = new T.Mesh(
            new T.SphereGeometry(rnd(1.6, 2.3), 10, 8),
            new T.MeshBasicMaterial({
              color: e % 2 ? 9073747 : 7035461,
              transparent: !0,
              opacity: 0.5,
              depthWrite: !1,
            }),
          );
          (o.position.set(rnd(-0.8, 0.8), rnd(0.8, 3.2), rnd(-0.6, 0.6)),
            t.add(o));
        }
        const o = s + n * e * 2.3,
          a = i + r * e * 2.3;
        (t.position.set(o, abilityGroundY(o, a), a), scene.add(t));
        const c = {
          x: o,
          z: a,
          r: 2.4,
          y: t.position.y,
          life: 6.5,
          maxLife: 6.5,
          mesh: t,
          blocksVision: !0,
        };
        (world.smokes.push(c), l.push(c));
      }
      let c = 0;
      abilSpawn({
        update(e) {
          c += e;
          const o = c < 5 ? 6 * e : 0;
          for (const e of l)
            (o &&
              !collideXZ(e.x + t.x * o, e.z + t.z * o, e.y, 0.4) &&
              ((e.x += t.x * o), (e.z += t.z * o)),
              e.mesh.position.set(e.x, e.y = abilityGroundY(e.x, e.z, e.y), e.z));
          for (const e of foesOf(a))
            for (const t of l)
              if (dist2(e.pos.x, e.pos.z, t.x, t.z) < 2.6 * 2.6) {
                ((e.slow = Math.min(e.slow || 1, 0.6)),
                  (e.slowT = Math.max(e.slowT || 0, 1.2)));
                break;
              }
          return c < 6.5;
        },
      });
    },
    ult_tomb(e, t, o) {
      const a = player,
        n = o.x,
        r = o.z,
        s = 13;
      (shardErupt(n, r, s, 13215339, 22),
        makeZone(n, r, s, 5, 14, 5916210, { dps: 7, name: "모래 무덤" }));
      const i = new T.Group();
      for (let e = 0; e < 16; e++) {
        const t = 6.28 * Math.random(),
          o = Math.sqrt(Math.random()) * s * 0.8,
          a = new T.Mesh(
            new T.SphereGeometry(rnd(3.2, 4.6), 10, 8),
            new T.MeshBasicMaterial({
              color: e % 2 ? 7035461 : 4865326,
              transparent: !0,
              opacity: 0.38,
              depthWrite: !1,
            }),
          );
        (a.position.set(Math.cos(t) * o, rnd(1, 4), Math.sin(t) * o), i.add(a));
      }
      (i.position.set(n, abilityGroundY(n, r), r),
        scene.add(i),
        world.smokes.push({
          x: n,
          z: r,
          r: 0.9 * s,
          y: i.position.y,
          life: 14,
          maxLife: 14,
          mesh: i,
          blocksVision: !0,
        }));
      let l = 14;
      (abilSpawn({
        update(e) {
          l -= e;
          for (const e of foesOf(a))
            dist2(e.pos.x, e.pos.z, n, r) <
              169 * (window.AB_R || 1) * (window.AB_R || 1) &&
              statusOn(e, "nearsight", 0.4);
          return l > 0;
        },
      }),
        viewerShake(n, r, 0.5));
    },
    tripwire(e, t, o) {
      const a = player,
        n = aimPoint(18),
        r = n.x - 0.3 * t.x,
        s = n.z - 0.3 * t.z,
        i = -t.z,
        l = t.x,
        c = (e) => {
          let t = 0;
          for (
            ;
            t < 7 * (window.AB_R || 1) &&
            !collideXZ(r + i * e * t, s + l * e * t, abilityGroundY(r, s) + 0.5, 0.1);
            t += 0.25
          );
          return Math.max(0.8, t);
        },
        d = c(-1),
        h = c(1),
        p = r - i * d,
        u = s - l * d,
        m = r + i * h,
        f = s + l * h,
        y = Math.hypot(m - p, f - u),
        M = new T.MeshBasicMaterial({
          color: 16765286,
          transparent: !0,
          opacity: 0.55,
        }),
        w = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, y, 5), M);
      (w.position.set((p + m) / 2, abilityGroundY(r, s) + 0.55, (u + f) / 2),
        w.rotation.set(0, -Math.atan2(f - u, m - p), Math.PI / 2),
        scene.add(w));
      const g = new T.MeshStandardMaterial({
          color: 3817287,
          emissive: 16765286,
          emissiveIntensity: 0.5,
        }),
        x = new T.BoxGeometry(0.12, 0.3, 0.12),
        b = [
          [p, u],
          [m, f],
        ].map(([e, t]) => {
          const o = new T.Mesh(x, g);
          return (o.position.set(e, abilityGroundY(e, t) + 0.55, t), scene.add(o), o);
        });
      let S = 60,
        v = 0.8;
      const k = (m - p) ** 2 + (f - u) ** 2 || 1;
      abilSpawn({
        update(e) {
          if (
            ((S -= e),
            (v -= e),
            (M.opacity = 0.35 + 0.15 * Math.sin(4 * S)),
            v > 0)
          )
            return !0;
          for (const e of foesOf(a)) {
            const t = clamp(
                ((e.pos.x - p) * (m - p) + (e.pos.z - u) * (f - u)) / k,
                0,
                1,
              ),
              o = p + (m - p) * t,
              n = u + (f - u) * t;
            if (abilityOnFloor(e, w.position.y - .55) && Math.hypot(e.pos.x - o, e.pos.z - n) < 0.5)
              return (
                withCaster(a, () => {
                  (statusOn(e, "revealed", 5),
                    applyConcuss(e, 3),
                    (e.slow = Math.min(e.slow || 1, 0.5)),
                    (e.slowT = Math.max(e.slowT || 0, 2)),
                    fxRing(o, n, 3, 16765286, 0.5),
                    fxColumn(o, n, 16765286, 5, 0.8),
                    tellTeam(a, "경종 — 인계철선 작동", "#ffd166"));
                  try {
                    SFX.beep(!0);
                  } catch (e) {}
                }),
                !1
              );
          }
          return S > 0;
        },
        dispose() {
          (scene.remove(w),
            w.geometry.dispose(),
            M.dispose(),
            b.forEach((e) => scene.remove(e)),
            x.dispose(),
            g.dispose());
        },
      });
    },
    sound_sensor(e, t, o) {
      const a = player,
        n = aimPoint(16),
        r = n.x - 0.3 * t.x,
        s = n.z - 0.3 * t.z,
        i = new T.MeshStandardMaterial({
          color: 3817287,
          metalness: 0.7,
          roughness: 0.3,
        }),
        l = new T.MeshStandardMaterial({
          color: 13939290,
          emissive: 16765286,
          emissiveIntensity: 0.45,
          metalness: 0.8,
          roughness: 0.3,
          side: T.DoubleSide,
        }),
        c = new T.Mesh(new T.CylinderGeometry(0.14, 0.18, 0.14, 10), i),
        d = new T.Mesh(new T.ConeGeometry(0.14, 0.22, 10, 1, !0), l);
      d.position.y = 0.17;
      const h = new T.Group();
      (h.add(c, d), h.position.set(r, abilityGroundY(r, s) + 0.08, s), scene.add(h));
      const p = new T.Mesh(
        new T.RingGeometry(8.92, 9, 60),
        new T.MeshBasicMaterial({
          color: 16765286,
          transparent: !0,
          opacity: 0.12,
          side: T.DoubleSide,
          depthWrite: !1,
        }),
      );
      ((p.rotation.x = -Math.PI / 2), p.position.set(r, abilityGroundY(r, s) + 0.06, s), scene.add(p));
      let u = 45,
        m = 0;
      const f = {
        x: r,
        y: abilityGroundY(r, s) + 0.25,
        z: s,
        r: 0.35,
        team: a.team,
        hp: 40,
        onBreak() {
          ((u = 0), fxShatter(r, s, 16765286));
        },
      };
      (SHOOTABLES.push(f),
        abilSpawn({
          update(e) {
            if (((u -= e), (m -= e), (d.rotation.y += 1.5 * e), m <= 0))
              for (const e of foesOf(a)) {
                if (
                  dist2(e.pos.x, e.pos.z, r, s) >
                  81 * (window.AB_R || 1) * (window.AB_R || 1)
                )
                  continue;
                const t = e.vel ? Math.hypot(e.vel.x, e.vel.z) : 0,
                  o = e.input && e.input.btn & BTN.WALK;
                if (
                  (t > 3.4 && !e.crouch && !o) ||
                  (e._shotT && (world._clock || 0) - e._shotT < 0.25)
                ) {
                  ((m = 4),
                    withCaster(a, () => {
                      (areaHit(r, s, 9, a, (e) => {
                        (statusOn(e, "root", 1.1),
                          applyConcuss(e, 3),
                          statusOn(e, "revealed", 3));
                      }),
                        fxRing(r, s, 9, 16765286, 0.6),
                        fxRing(r, s, 4.95, 16774084, 0.45),
                        tellTeam(a, "종소리 센서 작동", "#ffd166"));
                      try {
                        SFX.beep(!0);
                      } catch (e) {}
                    }));
                  break;
                }
              }
            return (
              (p.material.opacity =
                m > 0 ? 0.04 : 0.12 + 0.04 * Math.sin(3 * u)),
              u > 0
            );
          },
          dispose() {
            const e = SHOOTABLES.indexOf(f);
            (e >= 0 && SHOOTABLES.splice(e, 1),
              scene.remove(h),
              scene.remove(p),
              c.geometry.dispose(),
              d.geometry.dispose(),
              p.geometry.dispose(),
              i.dispose(),
              l.dispose(),
              p.material.dispose());
          },
        }));
    },
    ripple_dome(e, t, o) {
      const a = aimPoint(14),
        n = a.x - 0.4 * t.x,
        r = a.z - 0.4 * t.z,
        s = 4.2,
        i = new T.MeshStandardMaterial({
          color: 16771496,
          emissive: 16765286,
          emissiveIntensity: 0.35,
          transparent: !0,
          opacity: 0.22,
          roughness: 0.1,
          metalness: 0.2,
          side: T.DoubleSide,
          depthWrite: !1,
        }),
        l = new T.Mesh(
          new T.SphereGeometry(s, 28, 14, 0, 2 * Math.PI, 0, Math.PI / 2),
          i,
        );
      (l.position.set(n, abilityGroundY(n, r), r), scene.add(l));
      const c = new T.Mesh(
        new T.TorusGeometry(s, 0.05, 6, 56),
        new T.MeshBasicMaterial({ color: 16765286 }),
      );
      ((c.rotation.x = Math.PI / 2), c.position.set(n, abilityGroundY(n, r) + 0.05, r), scene.add(c));
      const d = { x: n, y: abilityGroundY(n, r), z: r, r: 0.2 * s, hitT: 0 };
      DOMES.push(d);
      let h = 9,
        p = 0;
      abilSpawn({
        update(e) {
          ((h -= e), (p = Math.min(1, p + 3 * e)));
          const t = 0.2 + 0.8 * p;
          return (
            l.scale.setScalar(t),
            c.scale.setScalar(t),
            (d.r = s * t),
            d.hitT > 0 && (d.hitT -= e),
            (i.opacity =
              (0.16 + 0.04 * Math.sin(5 * h) + (d.hitT > 0 ? 0.22 : 0)) *
              Math.min(1, h / 0.6)),
            h > 0
          );
        },
        dispose() {
          const e = DOMES.indexOf(d);
          (e >= 0 && DOMES.splice(e, 1),
            scene.remove(l),
            scene.remove(c),
            l.geometry.dispose(),
            i.dispose(),
            c.geometry.dispose(),
            c.material.dispose());
        },
      });
    },
    ult_bell(e, t, o) {
      const a = player,
        n = o.x,
        r = o.z,
        s = new T.MeshStandardMaterial({
          color: 11569726,
          metalness: 0.85,
          roughness: 0.28,
          emissive: 5914128,
          emissiveIntensity: 0.35,
          side: T.DoubleSide,
        }),
        i = new T.Mesh(new T.CylinderGeometry(1.2, 2.3, 3.2, 20, 1, !0), s),
        l = new T.Mesh(new T.TorusGeometry(2.3, 0.16, 8, 32), s);
      ((l.rotation.x = Math.PI / 2), (l.position.y = -1.6));
      const c = new T.Mesh(
        new T.SphereGeometry(1.2, 16, 8, 0, 2 * Math.PI, 0, Math.PI / 2),
        s,
      );
      c.position.y = 1.6;
      const d = new T.Group();
      (d.add(i, l, c), d.position.set(n, 26, r), scene.add(d));
      let h = 0,
        p = !1;
      abilSpawn({
        update: (e) => (
          (h += e),
          p
            ? ((d.rotation.z = 0.06 * Math.sin(14 * h) * Math.max(0, 1.4 - h)),
              h > 3.2 && (d.position.y -= 7 * e))
            : ((d.position.y = Math.max(1.7, 26 - h * h * 42)),
              d.position.y <= 1.7 &&
                ((p = !0),
                withCaster(a, () => {
                  for (let e = 0; e < 4; e++)
                    later(0.18 * e, () =>
                      fxRing(n, r, 18, e % 2 ? 16774084 : 16765286, 0.9),
                    );
                  (areaHit(n, r, 18, a, (e) => {
                    (statusOn(e, "suppress", 4.5),
                      applyConcuss(e, 3),
                      statusOn(e, "revealed", 4));
                  }),
                    viewerShake(n, r, 1));
                  try {
                    SFX.boom();
                  } catch (e) {}
                  tellTeam(a, "대종 — 반경 18m 무기 봉인", "#ffd166");
                }))),
          h < 4.2
        ),
        dispose() {
          (scene.remove(d),
            i.geometry.dispose(),
            l.geometry.dispose(),
            c.geometry.dispose(),
            s.dispose());
        },
      });
    },
    mag_turret(e, t, o) {
      const a = player;
      a._turret && (a._turret.kill = !0);
      const n = aimPoint(8),
        r = n.x - 0.5 * t.x,
        s = n.z - 0.5 * t.z,
        i = new T.MeshStandardMaterial({
          color: 5923179,
          metalness: 0.8,
          roughness: 0.3,
        }),
        l = new T.MeshStandardMaterial({
          color: 2237996,
          metalness: 0.6,
          roughness: 0.4,
        }),
        c = new T.MeshBasicMaterial({ color: teamHex(a) }),
        d = new T.Group();
      for (let e = 0; e < 3; e++) {
        const t = (e / 3) * Math.PI * 2,
          o = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.72, 6), i);
        (o.position.set(0.18 * Math.cos(t), 0.32, 0.18 * Math.sin(t)),
          o.rotation.set(0.4 * Math.sin(t), 0, 0.4 * -Math.cos(t)),
          d.add(o));
      }
      const h = new T.Group();
      ((h.position.y = 0.72), d.add(h));
      const p = new T.Mesh(new T.BoxGeometry(0.34, 0.24, 0.42), i);
      h.add(p);
      const u = new T.Mesh(
        new T.TorusGeometry(0.13, 0.03, 6, 14),
        new T.MeshStandardMaterial({
          color: 10139903,
          emissive: 6990079,
          emissiveIntensity: 0.9,
        }),
      );
      ((u.position.z = 0.05), h.add(u));
      const m = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.46, 8), l);
      ((m.rotation.x = Math.PI / 2), (m.position.z = -0.4), h.add(m));
      const f = new T.Mesh(new T.SphereGeometry(0.05, 8, 6), c);
      (f.position.set(0, 0.06, -0.21),
        h.add(f),
        d.position.set(r, abilityGroundY(r, s), s),
        scene.add(d));
      const y = a.yaw;
      h.rotation.y = y;
      const M = { kill: !1 };
      a._turret = M;
      const w = {
        x: r,
        y: abilityGroundY(r, s) + 0.75,
        z: s,
        r: 0.4,
        team: a.team,
        hp: 90,
        onBreak() {
          ((M.kill = !0), fxShatter(r, s, 10139903));
        },
      };
      SHOOTABLES.push(w);
      let g = 30,
        x = 0;
      abilSpawn({
        update(e) {
          if (((g -= e), (x -= e), M.kill)) return !1;
          let t = null,
            o = 1296;
          const n = -Math.sin(y),
            i = -Math.cos(y);
          for (const e of foesOf(a)) {
            const a = e.pos.x - r,
              l = e.pos.z - s,
              c = a * a + l * l;
            c > o ||
              a * n + l * i < 0 ||
              rayBlocked(r, w.y + .25, s, e.pos.x, e.y + 1.2, e.pos.z) ||
              ((t = e), (o = c));
          }
          if (t) {
            const n =
              ((Math.atan2(-(t.pos.x - r), -(t.pos.z - s)) -
                h.rotation.y +
                3 * Math.PI) %
                (2 * Math.PI)) -
              Math.PI;
            if (
              ((h.rotation.y += clamp(n, -6 * e, 6 * e)),
              Math.abs(n) < 0.15 && x <= 0)
            ) {
              x = 0.27;
              const e = Math.sqrt(o);
              (fxTracer(
                r - 0.62 * Math.sin(h.rotation.y),
                w.y + .01,
                s - 0.62 * Math.cos(h.rotation.y),
                t.pos.x + rnd(-0.3, 0.3),
                t.y + 1.1 + rnd(-0.3, 0.3),
                t.pos.z + rnd(-0.3, 0.3),
                12375295,
              ),
                Math.random() < clamp(0.75 - e / 60, 0.3, 0.75) &&
                  withCaster(a, () => hurtFighter(t, 5, !1, a)));
              const n = localActor();
              if (n)
                try {
                  SFX.gun(
                    "smg",
                    clamp(Math.hypot(n.pos.x - r, n.pos.z - s) / 60, 0, 1),
                  );
                } catch (e) {}
            }
          } else h.rotation.y = y + 0.9 * Math.sin(1.1 * g);
          return ((u.rotation.z += 4 * e), g > 0);
        },
        dispose() {
          const e = SHOOTABLES.indexOf(w);
          (e >= 0 && SHOOTABLES.splice(e, 1),
            a._turret === M && (a._turret = null),
            scene.remove(d),
            d.traverse((e) => {
              e.isMesh && e.geometry.dispose();
            }),
            i.dispose(),
            l.dispose(),
            c.dispose(),
            u.material.dispose());
        },
      });
    },
    mag_anchor(e, t, o) {
      const a = player;
      if (a._anchor && a._anchor.alive) {
        const e = a._anchor;
        return Math.hypot(e.x - a.pos.x, e.z - a.pos.z) >
          34 * (window.AB_D || 1)
          ? ("me" === a.ctrl && bannerMe("닻이 너무 멀다 (34m)", "#8a97ab"),
            void (CAST_REFUND = !0))
          : void e.teleport();
      }
      const n = o.x,
        r = o.z,
        s = a.y || 0,
        i = new T.MeshBasicMaterial({
          color: 10139903,
          transparent: !0,
          opacity: 0.7,
          side: T.DoubleSide,
          depthWrite: !1,
        }),
        l = new T.Mesh(new T.RingGeometry(0.5, 0.62, 32), i);
      ((l.rotation.x = -Math.PI / 2), l.position.set(n, s + 0.05, r));
      const c = new T.Mesh(
        new T.OctahedronGeometry(0.18),
        new T.MeshStandardMaterial({
          color: 10139903,
          emissive: 6990079,
          emissiveIntensity: 1.1,
        }),
      );
      (c.position.set(n, s + 0.6, r), scene.add(l), scene.add(c));
      const d = {
        alive: !0,
        x: n,
        z: r,
        y: s,
        teleport() {
          if (!d.alive) return;
          const e = a.pos.x,
            t = a.pos.z;
          (fxShatter(e, t, 10139903),
            (a.pos.x = n),
            (a.pos.z = r),
            (a.y = s),
            a.vel && a.vel.set(0, 0, 0),
            (a.vy = 0),
            (a.invuln = Math.max(a.invuln || 0, 0.2)),
            fxBolt(e, 1.2, t, n, 1.2, r, 10139903, 0.35),
            fxColumn(n, r, 10139903, 5, 0.6),
            (d.alive = !1));
        },
      };
      ((a._anchor = d),
        (CAST_REFUND = !0),
        "me" === a.ctrl &&
          bannerMe("자기 닻 설치 — E를 다시 눌러 귀환", "#9ab8ff"));
      let h = 40,
        p = 0;
      abilSpawn({
        update: (e) => (
          (h -= e),
          (p += e),
          (c.rotation.y += 2 * e),
          (c.position.y = s + 0.6 + 0.08 * Math.sin(3 * p)),
          d.alive &&
            a.alive &&
            "function" == typeof isAI &&
            isAI(a) &&
            a.hp < 45 &&
            Math.hypot(n - a.pos.x, r - a.pos.z) < 34 &&
            p > 1 &&
            withCaster(a, () => d.teleport()),
          a.alive || (d.alive = !1),
          d.alive && h > 0
        ),
        dispose() {
          ((d.alive = !1),
            a._anchor === d && (a._anchor = null),
            scene.remove(l),
            scene.remove(c),
            l.geometry.dispose(),
            i.dispose(),
            c.geometry.dispose(),
            c.material.dispose());
        },
      });
    },
    mag_net(e, t, o) {
      const a = player;
      throwProjectile(10139903, 19, (e, t, o) => {
        const n = new T.Mesh(
          new T.CircleGeometry(6, 24, 0, 2 * Math.PI),
          new T.MeshBasicMaterial({
            color: 10139903,
            wireframe: !0,
            transparent: !0,
            depthWrite: !1,
          }),
        );
        ((n.rotation.x = -Math.PI / 2),
          n.position.set(e, abilityGroundY(e, o, t) + 0.12, o),
          addFx(n, 1.1, (e, t) => {
            ((e.material.opacity = 0.8 * (1 - t)),
              (e.rotation.z += 0.02),
              e.scale.setScalar(0.4 + 0.6 * Math.min(1, 4 * t)));
          }),
          fxRing(e, o, 6, 10139903, 0.5),
          areaHit(e, o, 6, a, (e) => {
            (statusOn(e, "forceCrouch", 4),
              (e.slow = Math.min(e.slow || 1, 0.45)),
              (e.slowT = Math.max(e.slowT || 0, 4)),
              "me" === e.ctrl && bannerMe("자성 그물 — 강제 앉기", "#9ab8ff"));
          }));
        try {
          SFX.abilityHit();
        } catch (e) {}
      });
    },
    ult_polarity(e, t, o) {
      const a = player;
      empWave(o.x, o.z, 6990079);
      for (let e = 0; e < 3; e++)
        later(0.2 * e, () => fxRing(o.x, o.z, 32, 10139903, 1.1));
      let n = 0;
      (areaHit(o.x, o.z, 32, a, (e) => {
        (statusOn(e, "vuln", 8),
          statusOn(e, "revealed", 8),
          fxColumn(e.pos.x, e.pos.z, 10139903, 8, 1.4),
          n++,
          "me" === e.ctrl && bannerMe("취약 — 받는 피해 1.5배", "#9ab8ff"));
      }),
        tellTeam(a, `자장 역전 — ${n}명 취약`, "#9ab8ff"));
    },
    blood_drain(e, t, o) {
      const a = player;
      (statusOn(a, "lifesteal", 8),
        (a.speedBuff = Math.max(a.speedBuff || 1, 1.2)),
        (a.speedBuffT = Math.max(a.speedBuffT || 0, 8)),
        auraFx(a, 13840175, 8));
    },
    blood_eye(e, t, o) {
      const a = player;
      ((a.invuln = Math.max(a.invuln || 0, 1.6)),
        (a.speedBuff = Math.max(a.speedBuff || 1, 1.35)),
        (a.speedBuffT = Math.max(a.speedBuffT || 0, 1.6)),
        auraFx(a, 16717636, 1.6),
        fxColumn(o.x, o.z, 16717636, 4, 0.5),
        "me" === a.ctrl && edgeFlash("#ff1744", 0.6));
    },
    blood_orb(e, t, o) {
      const a = player;
      throwProjectile(12000284, 21, (e, t, o) => {
        (fxRing(e, o, 5, 13840175, 0.5),
          fxShatter(e, o, 12000284),
          areaHit(e, o, 5, a, (e) => {
            (applyDecay(e, 40, 6), statusOn(e, "revealed", 2));
          }));
        try {
          SFX.abilityHit();
        } catch (e) {}
      });
    },
    ult_undying(e, t, o) {
      const a = player;
      (statusOn(a, "undying", 12),
        "me" !== a.ctrl && revivePillar(o.x, o.z, 13840175),
        auraFx(a, 16717636, 12),
        startUltW(a, "whip", e));
    },
    scout_swarm(e, t, o) {
      const a = player;
      throwProjectile(16761095, 20, (e, t, o) => {
        (beeCloud(e, o, 12, 5.5, 16761095), fxRing(e, o, 12, 16761095, 0.7));
        let n = 5.5,
          r = !1;
        abilSpawn({
          update: (t) => (
            (n -= t),
            areaHit(e, o, 12, a, (e) => {
              (statusOn(e, "revealed", 0.5),
                r ||
                  ((r = !0),
                  withCaster(a, () =>
                    tellTeam(a, "정찰 벌떼 — 적 발견", "#ffc107"),
                  )));
            }),
            n > 0
          ),
        });
      });
    },
    hunt_bee(e, t, o) {
      const a = player,
        n = foesOf(a)
          .filter(
            (e) =>
              dist2(e.pos.x, e.pos.z, o.x, o.z) <
              2025 * (window.AB_D || 1) * (window.AB_D || 1),
          )
          .sort(
            (e, t) =>
              dist2(e.pos.x, e.pos.z, o.x, o.z) -
              dist2(t.pos.x, t.pos.z, o.x, o.z),
          );
      spawnSeeker(a, n[0] || null, {
        color: 16761095,
        speed: 10,
        fly: !0,
        life: 7,
        onHit(e) {
          (hurtFighter(e, 30, !1, a), applyConcuss(e, 3));
        },
      });
    },
    hive_trap(e, t, o) {
      const a = player,
        n = aimPoint(18),
        r = n.x - 0.3 * t.x,
        s = n.z - 0.3 * t.z,
        i = new T.MeshStandardMaterial({
          color: 11566866,
          emissive: 5914112,
          emissiveIntensity: 0.4,
          roughness: 0.7,
        }),
        l = new T.Mesh(new T.CylinderGeometry(0.22, 0.3, 0.42, 6), i);
      (l.position.set(r, abilityGroundY(r, s) + 0.21, s), scene.add(l));
      let c = 60,
        d = 1;
      const h = {
        x: r,
        y: abilityGroundY(r, s) + 0.25,
        z: s,
        r: 0.35,
        team: a.team,
        hp: 40,
        onBreak() {
          ((c = 0), fxShatter(r, s, 16761095));
        },
      };
      (SHOOTABLES.push(h),
        abilSpawn({
          update(e) {
            if (((c -= e), (d -= e), (l.rotation.y += 0.3 * e), d <= 0))
              for (const e of foesOf(a))
                if (
                  dist2(e.pos.x, e.pos.z, r, s) <
                  16 * (window.AB_R || 1) * (window.AB_R || 1)
                )
                  return (
                    withCaster(a, () => {
                      (makeZone(r, s, 5, 2.2, 5, 16757504, {
                        dps: 16,
                        slow: 0.7,
                        name: "벌집",
                      }),
                        beeCloud(r, s, 5, 5, 16757504),
                        tellTeam(a, "벌집 함정 작동", "#ffc107"));
                      try {
                        SFX.abilityHit();
                      } catch (e) {}
                    }),
                    !1
                  );
            return c > 0;
          },
          dispose() {
            const e = SHOOTABLES.indexOf(h);
            (e >= 0 && SHOOTABLES.splice(e, 1),
              scene.remove(l),
              l.geometry.dispose(),
              i.dispose());
          },
        }));
    },
    ult_queen(e, t, o) {
      const a = player,
        n = foesOf(a)
          .sort(
            (e, t) =>
              dist2(e.pos.x, e.pos.z, o.x, o.z) -
              dist2(t.pos.x, t.pos.z, o.x, o.z),
          )
          .slice(0, 4);
      (beeCloud(o.x, o.z, 4, 1.5, 16761095),
        empWave(o.x, o.z, 16761095),
        n.forEach((e, t) =>
          spawnSeeker(a, e, {
            color: 16757504,
            speed: 12,
            fly: !0,
            life: 14,
            delay: 0.12 * t,
            big: !0,
            onHit(e) {
              (hurtFighter(e, 25, !1, a),
                applyDecay(e, 20, 6),
                statusOn(e, "revealed", 6),
                applyConcuss(e, 2));
            },
          }),
        ),
        tellTeam(a, `여왕벌 — ${n.length}마리 추적`, "#ffc107"));
    },
  },
  ULTW = {
    beam: {
      name: "뇌격",
      color: 10135295,
      glow: "#9aa6ff",
      dur: 6,
      ammo: 0,
      rate: 0.08,
      auto: !0,
      aiRange: 40,
    },
    blades: {
      name: "만화경",
      color: 16748480,
      glow: "#ff8fc0",
      dur: 12,
      ammo: 5,
      rate: 0.3,
      auto: !1,
      aiRange: 55,
    },
    whip: {
      name: "혈편",
      color: 16722493,
      glow: "#ff2a3d",
      dur: 10,
      ammo: 0,
      rate: 0.6,
      auto: !1,
      aiRange: 14,
    },
    flame: {
      name: "업화",
      color: 16742956,
      glow: "#ff7a2c",
      dur: 7,
      ammo: 0,
      rate: 0.07,
      auto: !0,
      aiRange: 10,
    },
    bow: {
      name: "응시",
      color: 15397631,
      glow: "#eaf2ff",
      dur: 12,
      ammo: 3,
      rate: 0.8,
      auto: !1,
      aiRange: 90,
    },
    fist: {
      name: "파쇄",
      color: 16754470,
      glow: "#ffa726",
      dur: 9,
      ammo: 3,
      rate: 0.85,
      auto: !1,
      aiRange: 11,
    },
  },
  ULTW_OF = {
    ult_lightning: "beam",
    ult_mirror: "blades",
    ult_undying: "whip",
    ult_fire: "flame",
    ult_snipe: "bow",
    ult_smash: "fist",
  };
function startUltW(e, t, o) {
  const a = ULTW[t];
  if (
    e &&
    a &&
    ((e.ultW = {
      kind: t,
      t: a.dur,
      ammo: a.ammo,
      cd: 0.4,
      endT: 0,
      sfxT: 0,
      zoneT: 0,
      lash: 0,
      name: (o && o.name) || a.name,
    }),
    (e.reloading = 0),
    (e.burstLeft = 0),
    (e._held = !0),
    ultwModelOn(e, !0),
    "me" === e.ctrl)
  ) {
    try {
      updateViewmodel(!0);
    } catch (e) {}
    bannerMe(
      `${e.ultW.name} — ${a.ammo ? "남은 " + a.ammo + "발" : a.dur + "초"}${"blades" === t ? " · 우클릭 일제 투척" : ""}`,
      a.glow,
    );
  }
}
function endUltW(e) {
  if (e && e.ultW && ((e.ultW = null), ultwModelOn(e, !1), "me" === e.ctrl))
    try {
      (updateViewmodel(!0), SFX.abilityEnd());
    } catch (e) {}
}
function tickUltW(e, t) {
  const o = e.ultW;
  if (!o) return;
  if (!e.alive || "end" === world.phase) return void endUltW(e);
  if (((o.t -= t), (o.cd -= t), (o.lash = Math.max(0, o.lash - t)), o.endT > 0))
    return ((o.endT -= t), void (o.endT <= 0 && endUltW(e)));
  if (o.t <= 0) return void endUltW(e);
  const a = !!e.ads;
  ("blades" === o.kind && a && !o._ads && o.ammo > 0 && ultwFire(e, !0),
    (o._ads = a));
}
function ultwModelOn(e, t) {
  const o = e && e.model;
  if (o && o.gun)
    if (((o.gun.visible = !t), t)) {
      const t = ULTW[e.ultW.kind];
      (e._ultGlow ||
        ((e._ultGlow = glowDot(t.color, 0.55, 2.2)),
        (e._ultGlow.material.userData.keep = !0),
        (o.gun.parent || o.group).add(e._ultGlow)),
        e._ultGlow.material.color.setHex(t.color).multiplyScalar(2.2),
        e._ultGlow.position.copy(o.gun.position),
        (e._ultGlow.visible = !0));
    } else e._ultGlow && (e._ultGlow.visible = !1);
}
const _uwV = new T.Vector3(),
  _uwQ = new T.Vector3();
function ultwAim(e, t, o) {
  const a = e.yaw + (t || 0),
    n = (e.pitch || 0) + (o || 0),
    r = new T.Vector3(
      -Math.sin(a) * Math.cos(n),
      Math.sin(n),
      -Math.cos(a) * Math.cos(n),
    ),
    s = new T.Vector3(e.pos.x, actorEye(e), e.pos.z);
  let i;
  const l = ("me" === e.ctrl && VM.current && VM.current.userData.tip) || null;
  if (l && VM.root.visible) ((i = new T.Vector3()), l.getWorldPosition(i));
  else {
    const t = Math.cos(e.yaw),
      o = -Math.sin(e.yaw);
    i = new T.Vector3(
      e.pos.x + 0.28 * t + 0.5 * r.x,
      actorEye(e) - 0.32,
      e.pos.z + 0.28 * o + 0.5 * r.z,
    );
  }
  return { o: s, dir: r, hand: i };
}
function ultwRay(e, t, o, a, n, r, s) {
  let i = a;
  if (!n) {
    for (let e = 0.6; e <= a; e += 0.6) {
      if (collideXZ(t.x + o.x * e, t.z + o.z * e, t.y + o.y * e, 0.05)) {
        i = e;
        break;
      }
      if (t.y + o.y * e < 0) {
        i = e;
        break;
      }
    }
    if (DOMES.length) {
      const e = domeBlockT(t, o, i);
      e < i && (i = e);
    }
  }
  const l = s || 0,
    c = [];
  for (const a of world.actors) {
    if (!a.alive || a.team === e.team || a === e) continue;
    const n = a.pos.x - t.x,
      r = a.y + 0.95 * BODY_K - t.y,
      s = a.pos.z - t.z,
      d = n * o.x + r * o.y + s * o.z;
    if (d < 0 || d > i) continue;
    const h = t.x + o.x * d,
      p = t.y + o.y * d,
      u = t.z + o.z * d,
      m = a.y + (a.crouch ? 1.47 : 1.86) * BODY_K,
      f = Math.hypot(h - a.pos.x, p - m, u - a.pos.z) < 0.17 * BODY_K + 0.5 * l,
      y =
        Math.hypot(h - a.pos.x, u - a.pos.z) < 0.56 * BODY_K + l &&
        Math.abs(p - (a.y + (a.crouch ? 0.74 : 0.95) * BODY_K)) <
          (a.crouch ? 0.64 : 0.75) * BODY_K + l;
    (f || y) && c.push({ e: a, head: f, t: d });
  }
  c.sort((e, t) => e.t - t.t);
  const d = r ? c : c.slice(0, 1);
  return { hits: d, endT: !r && d.length ? d[0].t : i };
}
function ultwHurt(e, t, o, a) {
  if ((dealDamage(t, o * (isAI(e) ? 0.7 : 1), a, e), "me" === e.ctrl)) {
    (world.stats.hits++, hitMarker(a));
    try {
      SFX.hit(a);
    } catch (e) {}
  }
}
function ultwSfx(e, t, o) {
  const a = e.ultW,
    n = world._clock || 0;
  if (o && n - (a.sfxT || 0) < o) return;
  a.sfxT = n;
  const r = localActor && localActor();
  if (
    "me" === e.ctrl ||
    (r && Math.hypot(r.pos.x - e.pos.x, r.pos.z - e.pos.z) < 40)
  )
    try {
      SFX.abilityCast(t);
    } catch (e) {}
}
const _uwP = (e, t, o) =>
  new T.Vector3(e.x + t.x * o, e.y + t.y * o, e.z + t.z * o);
function ultwFire(e, t) {
  const o = e.ultW;
  if (!o || o.endT > 0 || !e.alive) return;
  if (!t && o.cd > 0) return;
  if (e.suppress > 0) return;
  const a = ULTW[o.kind];
  ((o.cd = a.rate), (e._shotT = world._clock || 0));
  const n = "me" === e.ctrl;
  switch (o.kind) {
    case "beam": {
      const {
          o: t,
          dir: o,
          hand: a,
        } = ultwAim(e, rnd(-0.006, 0.006), rnd(-0.006, 0.006)),
        n = ultwRay(e, t, o, 42, !1, !1, 0.12),
        r = _uwP(t, o, n.endT);
      if (n.hits.length) {
        const t = n.hits[0];
        (ultwHurt(e, t.e, 9 * (t.head ? 1.5 : 1), t.head),
          statusOn(t.e, "concuss", 0.7),
          r.set(t.e.pos.x, t.e.y + (t.head ? 1.8 : 1.1), t.e.pos.z));
      }
      (fxBolt(a.x, a.y, a.z, r.x, r.y, r.z, 15264767, 0.07),
        fxBolt(a.x, a.y, a.z, r.x, r.y, r.z, 8162559, 0.1));
      const s = glowDot(12108543, n.hits.length ? 0.9 : 0.55, 2);
      (s.position.copy(r),
        addFx(s, 0.12, (e, t) => {
          e.material.opacity = 1 - t;
        }),
        Math.random() < 0.3 && fxFlash(9214975, 3, 10, r.x, r.y, r.z, 0.1, 1),
        ultwSfx(e, "ultw_beam", 0.14));
      break;
    }
    case "blades": {
      if (o.ammo <= 0) return;
      const r = t ? o.ammo : 1;
      let s = !1;
      for (let o = 0; o < r; o++) {
        const n = t ? 0.032 * (o - (r - 1) / 2) : 0,
          {
            o: i,
            dir: l,
            hand: c,
          } = ultwAim(e, n + rnd(-0.004, 0.004), rnd(-0.004, 0.004)),
          d = ultwRay(e, i, l, 80, !1, !1, 0.04),
          h = _uwP(i, l, d.endT);
        if (d.hits.length) {
          const o = d.hits[0],
            a = t ? (o.head ? 100 : 40) : o.head ? 160 : 55;
          (ultwHurt(e, o.e, a, o.head), o.e.alive || (s = !0));
        }
        flyBlade(c, h, a.color, 0.03 * o);
      }
      ((o.ammo -= r),
        s && ((o.ammo = a.ammo), n && bannerMe("만화경 — 칼날 재충전", a.glow)),
        o.ammo <= 0 && (o.endT = 0.5),
        ultwSfx(e, "ultw_blade"));
      break;
    }
    case "whip": {
      const { o: t, dir: n, hand: r } = ultwAim(e, 0, 0);
      let s,
        i = null,
        l = 0.982;
      for (const o of foesOf(e)) {
        const e = o.pos.x - t.x,
          a = o.y + 1.1 - t.y,
          r = o.pos.z - t.z,
          s = Math.hypot(e, a, r);
        if (s > 16) continue;
        const c = (e * n.x + a * n.y + r * n.z) / s;
        c < l ||
          rayBlocked(t.x, t.y, t.z, o.pos.x, o.y + 1.1, o.pos.z) ||
          ((l = c), (i = o));
      }
      if (i) {
        if (
          ((s = new T.Vector3(i.pos.x, i.y + 1.2, i.pos.z)),
          ultwHurt(e, i, 60, !1),
          i.alive)
        ) {
          const t = e.pos.x - i.pos.x,
            o = e.pos.z - i.pos.z,
            a = Math.hypot(t, o) || 1,
            n = 0.6 * Math.max(0, a - 2);
          ((i.y = moveWithSlide(
            i.pos,
            (t / a) * n,
            (o / a) * n,
            i.y || 0,
            0.35,
          )),
            applyConcuss(i, 0.9));
        }
        e.hp = Math.min(100, e.hp + 25);
      } else {
        const o = ultwRay(e, t, n, 16, !1, !1);
        s = _uwP(t, n, o.endT);
      }
      (whipLash(r, s, a.color, !!i), (o.lash = 0.25), ultwSfx(e, "ultw_whip"));
      break;
    }
    case "flame": {
      const { o: t, dir: n, hand: r } = ultwAim(e, 0, 0);
      for (const o of foesOf(e)) {
        const a = o.pos.x - t.x,
          r = o.y + 1 - t.y,
          s = o.pos.z - t.z,
          i = Math.hypot(a, r, s);
        i > 11 ||
          (a * n.x + r * n.y + s * n.z) / i < 0.955 ||
          rayBlocked(t.x, t.y, t.z, o.pos.x, o.y + 1, o.pos.z) ||
          (ultwHurt(e, o, 4.4, !1),
          (o.slow = Math.min(o.slow || 1, 0.75)),
          (o.slowT = Math.max(o.slowT || 0, 0.3)));
      }
      const s = Math.max(2, Math.round(3 * (GFX.fx || 1)));
      for (let e = 0; e < s; e++) {
        const t = glowDot([16769162, 16751164, 16734748][e % 3], 0.25, 2);
        t.position.copy(r);
        const o = new T.Vector3(
          n.x + rnd(-0.13, 0.13),
          n.y + rnd(-0.1, 0.13),
          n.z + rnd(-0.13, 0.13),
        )
          .normalize()
          .multiplyScalar(rnd(14, 19));
        addFx(t, rnd(0.38, 0.5), (e, t, a) => {
          (e.position.addScaledVector(o, a || 0.016),
            collideXZ(e.position.x, e.position.z, e.position.y, 0.05) &&
              o.multiplyScalar(0.3),
            e.scale.setScalar(0.25 + 1.6 * t),
            (e.material.opacity = 0.85 * (1 - t)));
        });
      }
      if (((o.zoneT = (o.zoneT || 0) - a.rate), o.zoneT <= 0)) {
        o.zoneT = 0.45;
        const a = ultwRay(e, t, n, 10, !1, !1),
          r = _uwP(t, n, Math.min(9, a.endT));
        withCaster(e, () =>
          makeZone(r.x, r.z, 1.7, 1.2, 2.6, 16730652, {
            dps: 16,
            name: "업화",
          }),
        );
      }
      (Math.random() < 0.35 &&
        fxFlash(16742956, 2.5, 9, r.x + 2 * n.x, r.y, r.z + 2 * n.z, 0.12, 1),
        ultwSfx(e, "ultw_flame", 0.12));
      break;
    }
    case "bow": {
      if (o.ammo <= 0) return;
      const { o: t, dir: r, hand: s } = ultwAim(e, 0, 0);
      (ultwRay(e, t, r, 140, !0, !0, 0.05).hits.forEach((t) => {
        (ultwHurt(e, t.e, t.head ? 200 : 130, t.head),
          statusOn(t.e, "revealed", 4),
          fxRing(t.e.pos.x, t.e.pos.z, 2.2, a.color, 0.4, t.e.y + 0.1));
      }),
        lightArrow(s, _uwP(t, r, 140), a.color),
        glowFlare(s.x + 1.2 * r.x, s.y, s.z + 1.2 * r.z, a.color, 1.6, 0.25),
        o.ammo--,
        o.ammo <= 0 && (o.endT = 0.6));
      try {
        SFX.gun("sniper", "me" === e.ctrl ? 0 : shotDistance(e));
      } catch (e) {}
      (ultwSfx(e, "ultw_bow"), n && (e.pitch += 0.03));
      break;
    }
    case "fist": {
      if (o.ammo <= 0) return;
      const { o: t, dir: n, hand: r } = ultwAim(e, 0, 0),
        s = Math.hypot(n.x, n.z) || 1,
        i = n.x / s,
        l = n.z / s;
      for (const o of foesOf(e)) {
        const a = o.pos.x - e.pos.x,
          n = o.pos.z - e.pos.z,
          r = Math.hypot(a, n);
        r > 11 ||
          r < 0.01 ||
          (a * i + n * l) / r < 0.8 ||
          rayBlocked(t.x, t.y, t.z, o.pos.x, o.y + 1, o.pos.z) ||
          (ultwHurt(e, o, 80 - 3 * r, !1),
          o.alive &&
            ((o.y = moveWithSlide(
              o.pos,
              (a / r) * 3.2,
              (n / r) * 3.2,
              o.y || 0,
              0.35,
            )),
            (o.slow = 0.4),
            (o.slowT = 2.5),
            applyConcuss(o, 1.2)));
      }
      for (let t = 1; t <= 5; t++) {
        const o = e.pos.x + i * t * 2,
          n = e.pos.z + l * t * 2;
        later(0.035 * t, () => {
          (fxRing(o, n, 1.6 + 0.35 * t, a.color, 0.4),
            fxPuff(o, 0.4, n, 16764032, 3));
        });
      }
      (shardErupt(e.pos.x + 6 * i, e.pos.z + 6 * l, 3.5, a.color, 7),
        viewerShake(e.pos.x, e.pos.z, 0.7));
      try {
        SFX.boom();
      } catch (e) {}
      (o.ammo--, o.ammo <= 0 && (o.endT = 0.6));
      break;
    }
  }
  (n &&
    (viewmodelFireKick(),
    (VM.kick = Math.min(
      VM.kick,
      "beam" === o.kind || "flame" === o.kind ? 0.25 : 1,
    ))),
    pushFX(FX.SHOT, e.pos.x, actorEye(e), e.pos.z, Math.round(100 * e.yaw)));
}
function flyBlade(e, t, o, a) {
  const n = e.distanceTo(t),
    r = new T.Mesh(
      new T.OctahedronGeometry(0.07),
      new T.MeshBasicMaterial({ color: new T.Color(o).multiplyScalar(2.2) }),
    );
  (r.scale.set(0.5, 0.5, 3.4), r.position.copy(e));
  const s = glowDot(o, 0.35, 2);
  r.add(s);
  const i = Math.max(0.05, n / 85),
    l = new T.Quaternion().setFromUnitVectors(
      new T.Vector3(0, 0, 1),
      t.clone().sub(e).normalize(),
    );
  (r.quaternion.copy(l),
    addFx(r, i + (a || 0) + 0.05, (o, n, r) => {
      const s = clamp((n * (i + (a || 0) + 0.05) - (a || 0)) / i, 0, 1);
      (o.position.lerpVectors(e, t, s),
        (o.visible = s > 0),
        s >= 1 && o.scale.multiplyScalar(0.8));
    }),
    later((a || 0) + i, () => {
      fxShatter(t.x, t.z, o);
    }));
}
function whipLash(e, t, o, a) {
  const n = e.clone().lerp(t, 0.5);
  n.y += 0.9 + 0.06 * e.distanceTo(t);
  const r = new T.QuadraticBezierCurve3(e.clone(), n, t.clone()).getPoints(24);
  for (let e = 0; e < 2; e++) {
    const t = new T.BufferGeometry().setFromPoints(
      r.map((t) => t.clone().add(new T.Vector3(0, 0.03 * e, 0))),
    );
    addFx(
      new T.Line(
        t,
        new T.LineBasicMaterial({ color: e ? 16757688 : o, transparent: !0 }),
      ),
      0.24,
      (e, t) => {
        e.material.opacity = 1 - t;
      },
    );
  }
  for (let e = 0; e < r.length; e += 4) {
    const t = glowDot(o, 0.22, 2);
    (t.position.copy(r[e]),
      addFx(t, 0.22, (e, t) => {
        e.material.opacity = 1 - t;
      }));
  }
  if (a) {
    const e = glowDot(16732256, 1.2, 2.2);
    (e.position.copy(t),
      addFx(e, 0.2, (e, t) => {
        ((e.material.opacity = 1 - t), e.scale.setScalar(1.2 + t));
      }));
  }
}
function lightArrow(e, t, o) {
  const a = t.clone().sub(e),
    n = a.length();
  a.normalize();
  const r = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), a);
  [
    [0.035, 2.6, 0.5],
    [0.14, 1.4, 0.6],
  ].forEach(([t, s, i]) => {
    const l = new T.Mesh(
      new T.CylinderGeometry(t, t, n, 8, 1, !0),
      new T.MeshBasicMaterial({
        color: new T.Color(o).multiplyScalar(s),
        transparent: !0,
        depthWrite: !1,
        side: T.DoubleSide,
      }),
    );
    (l.quaternion.copy(r),
      l.position.copy(e).addScaledVector(a, n / 2),
      addFx(l, i, (e, o) => {
        ((e.material.opacity = (1 - o) * (t > 0.1 ? 0.35 : 1)),
          (e.scale.x = e.scale.z = 1 - 0.7 * o));
      }));
  });
}
function buildUltVM(e) {
  const t = ULTW[e],
    o = new T.Group(),
    a = (player && player.agent) || null,
    n = new T.Color(a && a.color ? a.color : "#8aa0b8"),
    r = (e, t) => {
      const o = "vm|" + e;
      return (
        CH_MAT.has(o) ||
          CH_MAT.set(
            o,
            new T.MeshStandardMaterial(Object.assign({ color: e }, t)),
          ),
        CH_MAT.get(o)
      );
    },
    s = r("#" + n.clone().lerp(new T.Color(2830393), 0.66).getHexString(), {
      roughness: 0.9,
      metalness: 0,
    }),
    i = r("#262a31", { roughness: 0.5, metalness: 0.1 }),
    l = chGlow("#" + n.getHexString(), 0.7),
    c = (e) =>
      new T.MeshBasicMaterial({
        color: new T.Color(t.color).multiplyScalar(e || 2.4),
      }),
    d = (e, t, o) => new T.Vector3(e - 0.3, t + 0.24, o + 0.66),
    h = (e, t, a) =>
      vmArm(
        o,
        e,
        a || e.clone().add(new T.Vector3(t ? -0.14 : 0.12, -0.3, 0.4)),
        s,
        i,
        l,
        t,
      ),
    p = new T.Object3D();
  o.add(p);
  const u = [];
  if ("beam" === e) {
    (h(d(0.11, -0.19, -0.5), !1), h(d(-0.11, -0.19, -0.5), !0));
    const e = d(0, -0.15, -0.56);
    p.position.copy(e);
    const a = new T.Mesh(new T.SphereGeometry(0.035, 16, 12), c(3));
    (a.position.copy(e), o.add(a));
    const n = glowDot(t.color, 0.28, 2.2);
    (n.position.copy(e), o.add(n));
    const r = [];
    for (let t = 0; t < 3; t++) {
      const t = new T.BufferGeometry().setFromPoints(
          new Array(6).fill(0).map(() => e.clone()),
        ),
        a = new T.Line(
          t,
          new T.LineBasicMaterial({
            color: new T.Color(14672895).multiplyScalar(2),
          }),
        );
      (o.add(a), r.push(a));
    }
    u.push((t) => {
      (a.scale.setScalar(1 + 0.15 * Math.sin(40 * t)),
        n.scale.setScalar(0.26 + 0.05 * Math.sin(23 * t)),
        r.forEach((t, o) => {
          const a = t.geometry.attributes.position,
            n = o % 2 ? 1 : -1;
          for (let t = 0; t < 6; t++) {
            const o = t / 5;
            a.setXYZ(
              t,
              e.x + 0.11 * n * o + rnd(-0.015, 0.015),
              e.y - 0.04 * o + rnd(-0.02, 0.02),
              e.z + 0.06 * o + rnd(-0.015, 0.015),
            );
          }
          a.needsUpdate = !0;
        }));
    });
  } else if ("blades" === e) {
    (h(d(0.14, -0.22, -0.47), !1), h(d(-0.2, -0.3, -0.42), !0));
    const e = d(0.14, -0.11, -0.52);
    p.position.copy(e);
    const a = [];
    for (let e = 0; e < 5; e++) {
      const e = new T.Mesh(new T.OctahedronGeometry(0.018), c(2.2));
      (e.scale.set(0.6, 0.6, 3.6), o.add(e), a.push(e));
    }
    const n = glowDot(t.color, 0.16, 1.6);
    (n.position.copy(e),
      o.add(n),
      u.push((t, o) => {
        const n = o ? o.ammo : 5;
        a.forEach((o, a) => {
          o.visible = a < n;
          const r = 2.2 * t + (a / Math.max(1, n)) * Math.PI * 2;
          (o.position.set(
            e.x + 0.075 * Math.cos(r),
            e.y + 0.012 * Math.sin(3 * t + a),
            e.z + 0.05 * Math.sin(r),
          ),
            o.rotation.set(0, -r, 0),
            o.rotateX(-0.35));
        });
      }));
  } else if ("whip" === e) {
    const e = d(0.16, -0.2, -0.47);
    (h(e, !1), h(d(-0.2, -0.3, -0.42), !0));
    const a = new T.Mesh(new T.CylinderGeometry(0.012, 0.015, 0.14, 8), i);
    (a.position.copy(e).add(new T.Vector3(0, 0.04, -0.05)),
      (a.rotation.x = -0.9),
      o.add(a));
    const n = e.clone().add(new T.Vector3(0, 0.09, -0.11));
    p.position.copy(n);
    const r = 18,
      s = new T.BufferGeometry().setFromPoints(
        new Array(r).fill(0).map(() => n.clone()),
      ),
      l = new T.Line(
        s,
        new T.LineBasicMaterial({
          color: new T.Color(t.color).multiplyScalar(2.2),
        }),
      );
    o.add(l);
    const c = [];
    for (let e = 1; e < r; e += 2) {
      const a = glowDot(t.color, 0.055 - 0.0015 * e, 2.2);
      (o.add(a), c.push([e, a]));
    }
    u.push((e, t) => {
      const o = t ? t.lash / 0.25 : 0,
        a = s.attributes.position;
      for (let t = 0; t < r; t++) {
        const s = t / (r - 1),
          i = n.x - 0.16 * s + 0.035 * Math.sin(3 * e + 5 * s) * s,
          l =
            n.y + 0.06 * s - 0.3 * s * s + 0.025 * Math.sin(4 * e + 6 * s) * s,
          c = n.z - 0.32 * s,
          d = n.x,
          h = n.y + 0.02 * s,
          p = n.z - 1.4 * s;
        a.setXYZ(t, i + (d - i) * o, l + (h - l) * o, c + (p - c) * o);
      }
      ((a.needsUpdate = !0),
        c.forEach(([e, t]) => t.position.set(a.getX(e), a.getY(e), a.getZ(e))));
    });
  } else if ("flame" === e) {
    const e = d(0.1, -0.17, -0.52);
    (h(e, !1), h(d(-0.02, -0.24, -0.46), !0));
    const t = e.clone().add(new T.Vector3(-0.01, 0.015, -0.06));
    p.position.copy(t);
    const a = [16769162, 16751164, 16734748].map((e, a) => {
      const n = glowDot(e, 0.12 + 0.05 * a, 2.2);
      return (n.position.copy(t), o.add(n), n);
    });
    u.push((e) => {
      a.forEach((o, a) => {
        (o.scale.setScalar(
          (0.1 + 0.05 * a) * (1 + 0.18 * Math.sin(e * (21 + 7 * a))),
        ),
          o.position.set(
            t.x + 0.006 * Math.sin(13 * e + a),
            t.y + 0.012 * a + 0.006 * Math.sin(17 * e + a),
            t.z,
          ));
      });
    });
  } else if ("bow" === e) {
    const e = d(-0.06, -0.14, -0.58),
      a = d(0.03, -0.15, -0.36);
    (h(e, !0, e.clone().add(new T.Vector3(-0.12, -0.28, 0.38))), h(a, !1));
    const n = new T.Mesh(new T.TorusGeometry(0.24, 0.008, 6, 40, 2.3), c(2.4));
    (n.position.copy(e).add(new T.Vector3(0.22, 0, 0)),
      (n.rotation.z = Math.PI - 1.15),
      (n.rotation.y = Math.PI / 2),
      o.add(n));
    const r = e.clone().add(new T.Vector3(0, 0.22, 0.05)),
      s = e.clone().add(new T.Vector3(0, -0.22, 0.05)),
      i = new T.BufferGeometry().setFromPoints([r, a.clone(), s]),
      l = new T.Line(
        i,
        new T.LineBasicMaterial({
          color: new T.Color(16777215).multiplyScalar(1.6),
        }),
      );
    o.add(l);
    const m = e.clone().sub(a).normalize(),
      f = new T.Mesh(
        new T.CylinderGeometry(0.004, 0.004, e.distanceTo(a) + 0.1, 6),
        c(2.2),
      );
    (f.position.copy(a).lerp(e, 0.5),
      f.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), m),
      o.add(f));
    const y = glowDot(t.color, 0.09, 2.6);
    (y.position.copy(e).addScaledVector(m, 0.06),
      o.add(y),
      p.position.copy(y.position),
      u.push((e, t) => {
        const o = !t || (t.ammo > 0 && t.cd <= 0);
        ((f.visible = y.visible = o),
          y.scale.setScalar(0.09 * (1 + 0.12 * Math.sin(9 * e))));
      }));
  } else if ("fist" === e) {
    const e = d(0.14, -0.2, -0.46),
      a = d(-0.14, -0.22, -0.44);
    (h(e, !1),
      h(a, !0),
      [e, a].forEach((e, t) => {
        const a = new T.Mesh(
          new T.BoxGeometry(0.085, 0.08, 0.11),
          r("#3a3f47", { roughness: 0.35, metalness: 0.8 }),
        );
        (a.position.copy(e).add(new T.Vector3(0, 0.005, -0.02)), o.add(a));
        const n = new T.Mesh(new T.BoxGeometry(0.09, 0.018, 0.02), c(2.2));
        (n.position.copy(e).add(new T.Vector3(0, 0.03, -0.08)), o.add(n));
      }),
      p.position.copy(e).add(new T.Vector3(0, 0, -0.1)));
    const n = glowDot(t.color, 0.18, 1.8);
    (n.position.copy(p.position),
      o.add(n),
      u.push((e) => {
        n.scale.setScalar(0.16 + 0.03 * Math.sin(7 * e));
      }));
  }
  return (
    (o.userData.tip = p),
    (o.userData.anim = (e, t) => {
      ((o.userData._t = (o.userData._t || 0) + e),
        u.forEach((e) => e(o.userData._t, t)));
    }),
    o.traverse((e) => {
      e.isMesh && ((e.castShadow = !1), (e.receiveShadow = !1));
    }),
    o
  );
}
const VM_CAST = { t: 0, dur: 0.5, grp: null, orb: null, aid: null, big: !1 };
function vmCastModel() {
  const e = (player && player.agent && player.agent.id) || "";
  if (VM_CAST.grp && VM_CAST.aid === e) return VM_CAST.grp;
  VM_CAST.grp && VM.root.remove(VM_CAST.grp);
  const t = new T.Group(),
    o = (player && player.agent) || null,
    a = new T.Color(o && o.color ? o.color : "#8aa0b8"),
    n = (e, t) => {
      const o = "vm|" + e;
      return (
        CH_MAT.has(o) ||
          CH_MAT.set(
            o,
            new T.MeshStandardMaterial(Object.assign({ color: e }, t)),
          ),
        CH_MAT.get(o)
      );
    },
    r = new T.Vector3(-0.1, -0.12, -0.5);
  vmArm(
    t,
    r,
    r.clone().add(new T.Vector3(-0.16, -0.3, 0.38)),
    n("#" + a.clone().lerp(new T.Color(2830393), 0.66).getHexString(), {
      roughness: 0.9,
      metalness: 0,
    }),
    n("#262a31", { roughness: 0.5, metalness: 0.1 }),
    chGlow("#" + a.getHexString(), 0.7),
    !0,
  );
  const s = glowDot(a.getHex(), 0.12, 2.4);
  return (
    s.position.copy(r).add(new T.Vector3(0.02, 0.03, -0.07)),
    t.add(s),
    t.traverse((e) => {
      e.isMesh &&
        ((e.castShadow = !1), (e.renderOrder = 999), (e.frustumCulled = !1));
    }),
    (t.visible = !1),
    VM.root.add(t),
    (VM_CAST.grp = t),
    (VM_CAST.orb = s),
    (VM_CAST.aid = e),
    (VM_CAST.hand = r.clone()),
    t
  );
}
function vmCast(e) {
  "boolean" == typeof e && (e = e ? "ult" : "throw");
  try {
    vmCastModel();
  } catch (e) {
    return;
  }
  ((VM_CAST.style = e),
    (VM_CAST.t = VM_CAST.dur = CAST_DUR[e] || 0.5),
    (VM_CAST.big = "ult" === e));
}
const CAST_STYLE_OF = (() => {
  const m = {};
  const put = (s, l) => l.split(" ").forEach((k) => (m[k] = s));
  put(
    "throw",
    "proj_fire nade smoke_fire smoke_ice smoke sand_smoke flash emp static_orb blood_orb hunt_bee scout_swarm drone mag_net",
  );
  put(
    "place",
    "trap_slow mine sensor tripwire sound_sensor mag_turret mag_anchor hive_trap quicksand heal",
  );
  put("sweep", "wall_fire wall_ice sand_wall shield rift_wave");
  put("dash", "dash charge blink bolt_jump");
  put("aura", "mirror_pulse blood_drain blood_eye decoy ripple_dome");
  put("point", "recon_dart pierce root");
  return m;
})();
const CAST_DUR = {
  throw: 0.55,
  place: 0.6,
  sweep: 0.6,
  dash: 0.38,
  aura: 0.75,
  point: 0.45,
  ult: 0.95,
};
function castStyle(e, t) {
  return t && t.ult ? "ult" : CAST_STYLE_OF[e] || "throw";
}
const _ez01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x),
  _ezG = (o, a, b) => _ez01((o - a) / (b - a)),
  _ezS = (x) => x * x * (3 - 2 * x),
  _ezO = (x) => 1 - (1 - x) * (1 - x) * (1 - x);
// hand keyframes: [x, y, z, rx, rz]
const VMK = {
  low: [-0.06, -0.35, 0.1, -0.3, 0.25],
  rest: [0, 0, 0, 0, 0],
  windup: [0.04, 0.07, 0.12, -0.7, -0.2],
  release: [-0.03, 0.02, -0.16, 0.55, 0.1],
  follow: [0.02, -0.3, -0.05, 0.7, 0],
  lift: [0, 0.06, -0.02, -0.35, 0],
  slam: [0.02, -0.2, -0.06, 0.9, 0.1],
  sweepA: [0.2, -0.06, 0, -0.1, -0.55],
  sweepB: [-0.3, 0.02, -0.08, 0.05, 0.55],
  brace: [0, -0.04, 0.12, -0.2, 0],
  thrust: [-0.02, 0, -0.3, 0.15, 0],
  chest: [0.1, -0.08, 0.08, 0.2, 0.45],
  aim: [-0.02, 0.03, -0.18, -0.12, 0],
  raise: [0.05, 0.08, -0.04, -0.45, 0.2],
  push: [-0.02, -0.02, -0.3, 0.5, 0],
};
function _vmMix(a, b, k) {
  a = VMK[a];
  b = VMK[b];
  return a.map((v, i) => v + (b[i] - v) * k);
}
// piecewise path: [[until, from, to, ease], ...]
function _vmPath(o, segs) {
  let s0 = 0;
  for (const [until, a, b, ez] of segs) {
    if (o <= until) return _vmMix(a, b, ez(_ezG(o, s0, until)));
    s0 = until;
  }
  const l = segs[segs.length - 1];
  return _vmMix(l[1], l[2], 1);
}
function castVmPose(s, o) {
  // orb: f = follow hand, else camera-space offset from the resting hand
  let p,
    orb = { f: 1, x: 0, y: 0, z: 0, sx: 1, sy: 1, sz: 1, op: 1 },
    dip = 0.25 * Math.sin(Math.min(1, 1.25 * o) * Math.PI);
  if ("throw" === s) {
    p = _vmPath(o, [
      [0.42, "low", "windup", _ezS],
      [0.56, "windup", "release", _ezO],
      [1, "release", "follow", _ezS],
    ]);
    if (o > 0.47) {
      const t = _ezG(o, 0.47, 1);
      orb = {
        f: 0,
        x: -0.02,
        y: 0.22 * Math.sin(t * Math.PI) - 0.35 * t * t,
        z: -0.2 - 2.4 * t,
        sx: 1 - 0.6 * t,
        sy: 1 - 0.6 * t,
        sz: 1,
        op: 1 - t,
      };
    }
    dip = 0.3 * Math.sin(Math.min(1, 1.3 * o) * Math.PI);
  } else if ("place" === s) {
    p = _vmPath(o, [
      [0.3, "low", "lift", _ezS],
      [0.45, "lift", "slam", _ezO],
      [0.7, "slam", "slam", _ezS],
      [1, "slam", "low", _ezS],
    ]);
    if (o > 0.4) {
      const t = _ezG(o, 0.4, 0.9);
      orb = {
        f: 0,
        x: 0.02,
        y: -0.28 - 0.45 * t,
        z: -0.12,
        sx: 1 + 1.6 * t,
        sy: 0.5 * (1 - t) + 0.25,
        sz: 1,
        op: 1 - t,
      };
    }
    dip = 0.34 * Math.sin(Math.min(1, 1.15 * o) * Math.PI);
  } else if ("sweep" === s) {
    p = _vmPath(o, [
      [0.25, "low", "sweepA", _ezS],
      [0.62, "sweepA", "sweepB", _ezS],
      [1, "sweepB", "low", _ezS],
    ]);
    const k = Math.sin(_ezG(o, 0.25, 0.62) * Math.PI);
    orb.sx = 1 + 2.6 * k;
    orb.sy = 1 - 0.35 * k;
    orb.op = 1 - _ezG(o, 0.62, 0.85);
  } else if ("dash" === s) {
    p = _vmPath(o, [
      [0.18, "low", "brace", _ezS],
      [0.42, "brace", "thrust", _ezO],
      [1, "thrust", "low", _ezS],
    ]);
    if (o > 0.2) {
      const t = _ezG(o, 0.2, 0.6);
      orb = {
        f: 0,
        x: -0.02,
        y: 0,
        z: -0.3 - 3 * t,
        sx: 0.6,
        sy: 1 + 1.5 * t,
        sz: 1,
        op: 1 - t,
      };
    }
    dip = 0.16 * Math.sin(Math.min(1, 1.6 * o) * Math.PI);
  } else if ("aura" === s) {
    p = _vmPath(o, [
      [0.3, "low", "chest", _ezS],
      [0.75, "chest", "chest", _ezS],
      [1, "chest", "low", _ezS],
    ]);
    p[0] += 0.006 * Math.sin(55 * o);
    p[1] += 0.006 * Math.cos(47 * o);
    const g =
        1 +
        1.8 * _ezS(_ezG(o, 0.2, 0.65)) +
        0.25 * Math.sin(40 * o) * _ezG(o, 0.2, 0.3),
      b = _ezG(o, 0.65, 1);
    orb.sx = orb.sy = orb.sz = g * (1 + 3 * b);
    orb.op = 1 - b;
    dip = 0.3 * Math.sin(Math.min(1, 1.1 * o) * Math.PI);
  } else if ("point" === s) {
    p = _vmPath(o, [
      [0.25, "low", "aim", _ezO],
      [0.6, "aim", "aim", _ezS],
      [1, "aim", "low", _ezS],
    ]);
    if (o > 0.25) {
      const t = _ezG(o, 0.25, 0.55);
      orb = {
        f: 0,
        x: -0.02,
        y: 0.03,
        z: -0.25 - 3.5 * t,
        sx: 1 - 0.4 * t,
        sy: 1 - 0.4 * t,
        sz: 1,
        op: 1 - t,
      };
    }
    dip = 0.2 * Math.sin(Math.min(1, 1.3 * o) * Math.PI);
  } else {
    p = _vmPath(o, [
      [0.55, "low", "raise", _ezS],
      [0.72, "raise", "push", _ezO],
      [1, "push", "low", _ezS],
    ]);
    const sh = 0.012 * _ezG(o, 0.2, 0.55) * (1 - _ezG(o, 0.55, 0.6));
    p[0] += sh * Math.sin(70 * o);
    p[1] += sh * Math.cos(63 * o);
    const g = 1 + 2.2 * _ezG(o, 0, 0.55);
    orb.sx = orb.sy = orb.sz = g;
    if (o > 0.6) {
      const t = _ezG(o, 0.6, 1);
      orb = {
        f: 0,
        x: -0.02,
        y: 0,
        z: -0.3 - 2 * t,
        sx: g * (1 + 2 * t),
        sy: g * (1 + 2 * t),
        sz: 1,
        op: 1 - t,
      };
    }
    dip = 0.36 * Math.sin(Math.min(1, 1.1 * o) * Math.PI);
  }
  return { p, orb, dip };
}
const _VMM = { m: null, v: null };
function tickVmCast(e) {
  const g = VM_CAST.grp;
  if (!g) return 0;
  if (VM_CAST.t <= 0) return ((g.visible = !1), 0);
  VM_CAST.t -= e;
  const o = 1 - Math.max(0, VM_CAST.t) / VM_CAST.dur;
  g.visible = VM_CAST.t > 0;
  const { p, orb, dip } = castVmPose(VM_CAST.style || "throw", o);
  const r = VM_CAST.orb,
    h = VM_CAST.hand;
  _VMM.m || ((_VMM.m = new T.Matrix4()), (_VMM.v = new T.Vector3()));
  // pivot the tilt around the hand so it turns the wrist instead of swinging the whole arm
  g.rotation.set(p[3], p[5] || 0, p[4]);
  _VMM.v.copy(h).applyEuler(g.rotation);
  g.position.set(
    p[0] + h.x - _VMM.v.x,
    p[1] + h.y - _VMM.v.y,
    p[2] + h.z - _VMM.v.z,
  );
  const k = (VM_CAST.big ? 0.2 : 0.12) * 1.1;
  if (orb.f) r.position.set(h.x + 0.02, h.y + 0.03, h.z - 0.07);
  else {
    g.updateMatrix();
    _VMM.v
      .set(h.x + 0.02 + orb.x, h.y + 0.03 + orb.y, h.z - 0.07 + orb.z)
      .applyMatrix4(_VMM.m.copy(g.matrix).invert());
    r.position.copy(_VMM.v);
  }
  r.scale.set(k * orb.sx, k * orb.sy, k * orb.sz);
  r.material && (r.material.opacity = Math.max(0, orb.op));
  return dip;
}
// third-person body pose for a cast; blends over the aiming pose already set this frame
function castPose(e, o, t) {
  const A = o.armL.arm,
    B = o.armR.arm;
  void 0 === A.userData.bz &&
    ((A.userData.bz = A.rotation.z), (B.userData.bz = B.rotation.z));
  A.rotation.z = A.userData.bz;
  B.rotation.z = B.userData.bz;
  if (!(e._castT > 0)) return;
  e._castT -= t;
  const d = e._castD || 0.5,
    p = 1 - Math.max(0, e._castT) / d,
    s = e._castS || "throw",
    w = _ezS(Math.min(1, p / 0.15, (1 - p) / 0.2)),
    F = o.armL.fore,
    C = o.chest,
    set = (ax, fx, az, cx, cy) => {
      A.rotation.x += (ax - A.rotation.x) * w;
      F.rotation.x += (fx - F.rotation.x) * w;
      A.rotation.z += az * w;
      C.rotation.x += cx * w;
      C.rotation.y += cy * w;
    };
  if ("throw" === s) {
    const a = _ezS(_ezG(p, 0, 0.42)),
      b = _ezO(_ezG(p, 0.42, 0.56)),
      c = _ezS(_ezG(p, 0.56, 1));
    set(
      1.2 + 1.5 * a - 1.8 * b - 0.3 * c,
      -0.55 - 0.95 * a + 1.4 * b - 0.2 * c,
      0,
      0.1 * b,
      0.35 * a - 0.65 * b + 0.3 * c,
    );
  } else if ("place" === s) {
    const a = _ezS(_ezG(p, 0, 0.3)),
      b = _ezO(_ezG(p, 0.3, 0.45));
    set(1.2 + 0.7 * a - 1.45 * b, -0.55 + 0.4 * b, 0, 0.42 * b, 0);
  } else if ("sweep" === s) {
    const k = _ezS(_ezG(p, 0.25, 0.62));
    set(1.35, -0.2, 0.9 - 1.5 * k, 0.05, -0.35 + 0.7 * k);
  } else if ("dash" === s) {
    const k = _ezO(_ezG(p, 0.1, 0.35));
    set(1.2 - 1.6 * k, -0.55 + 0.35 * k, 0, 0.45 * k, 0);
  } else if ("aura" === s) {
    const k = _ezS(_ezG(p, 0, 0.3)),
      q = 0.08 * Math.sin(30 * p) * k;
    set(0.8 + q, -0.9, 1.1 * k, -0.18 * k, 0);
  } else if ("point" === s) {
    set(1.58, 0, 0, 0, 0.12);
  } else {
    const a = _ezS(_ezG(p, 0, 0.55)),
      b = _ezO(_ezG(p, 0.55, 0.72));
    set(1.2 + 1.7 * a - 1.9 * b, -0.55 + 0.25 * a, 0, -0.2 * a + 0.5 * b, 0);
    e.ultW ||
      ((B.rotation.x += (1.2 + 1.7 * a - 1.9 * b - B.rotation.x) * w),
      (B.rotation.z -= 0.25 * a * w));
  }
}
function replayCast(e) {
  const t = actorById(e.a);
  if (!t || !t.agent || !t.agent.abilities) return;
  const o = t.agent.abilities.find((o) => o.type === e.ty);
  if (!o) return;
  const a = [t.pos.x, t.pos.z, t.y, t.yaw, t.pitch];
  t.pos.x = Q.unpos(e.x);
  t.pos.z = Q.unpos(e.z);
  t.y = Q.unpos(e.y);
  t.yaw = Q.unang(e.yw);
  t.pitch = Q.unang(e.pt);
  try {
    withCaster(t, () => castAbility(e.ty, o));
  } catch (e) {
    console.warn("cast", e);
  }
  t.pos.x = a[0];
  t.pos.z = a[1];
  t.y = a[2];
  t.yaw = a[3];
  t.pitch = a[4];
}
const STATUS_KEYS = [
  "concuss",
  "vuln",
  "suppress",
  "nearsight",
  "lifesteal",
  "forceCrouch",
  "undying",
];
function tickStatus(e, t) {
  e.ultW && tickUltW(e, t);
  for (let o = 0; o < STATUS_KEYS.length; o++) {
    const a = STATUS_KEYS[o];
    e[a] > 0 && (e[a] -= t);
  }
  (e._supT > 0 && (e._supT -= t),
    e.decayT > 0 &&
      ((e.decayT -= t),
      e.decayT <= 0 &&
        (e.alive && e.decayAmt > 0 && (e.hp = Math.min(100, e.hp + e.decayAmt)),
        (e.decayAmt = 0))),
    e._undyHeal > 0 &&
      ((e._undyHeal -= t), e._undyHeal <= 0 && e.alive && (e.hp = 100)),
    e._boltJump &&
      ((e._airT = (e._airT || 0) + t),
      e.onGround && e._airT > 0.25
        ? ((e._boltJump = !1),
          withCaster(e, () => {
            fxRing(e.pos.x, e.pos.z, 5, 8162559, 0.5);
            for (let t = 0; t < 5; t++) {
              const t = 6.28 * Math.random(),
                o = rnd(1, 5);
              fxBolt(
                e.pos.x,
                0.2,
                e.pos.z,
                e.pos.x + Math.cos(t) * o,
                0.1,
                e.pos.z + Math.sin(t) * o,
                12962815,
                0.3,
              );
            }
            (areaHit(e.pos.x, e.pos.z, 5, e, (t) => {
              (hurtFighter(t, 15, !1, e), applyConcuss(t, 2.5));
            }),
              viewerShake(e.pos.x, e.pos.z, 0.3));
          }))
        : e._airT > 4 && (e._boltJump = !1)));
}
const STATUS_LABEL = [
  ["concuss", "뇌진탕", "#b39ddb"],
  ["vuln", "취약", "#9ab8ff"],
  ["suppress", "무기 봉인", "#ffd166"],
  ["nearsight", "근시", "#c9a66b"],
  ["decayT", "부패", "#ff6b6b"],
  ["lifesteal", "흡혈", "#ff5252"],
  ["undying", "불사", "#ff1744"],
  ["forceCrouch", "강제 앉기", "#9ab8ff"],
];
let _statKey = "",
  _fogBase = null;
function updateStatusHud(e) {
  if (!e) return;
  let t = "",
    o = "";
  for (const [a, n, r] of STATUS_LABEL)
    e[a] > 0 &&
      ((t += a), (o += `<i style="--sc:${r}">${n} ${Math.ceil(e[a])}</i>`));
  const a = t + "|" + o;
  if (a !== _statKey) {
    _statKey = a;
    const e = document.getElementById("statfx");
    e && (e.innerHTML = o);
  }
  scene.fog &&
    void 0 !== scene.fog.density &&
    (e.nearsight > 0
      ? (null === _fogBase && (_fogBase = scene.fog.density),
        (scene.fog.density += 0.2 * (0.09 - scene.fog.density)))
      : null !== _fogBase &&
        ((scene.fog.density += 0.2 * (_fogBase - scene.fog.density)),
        Math.abs(scene.fog.density - _fogBase) < 5e-4 &&
          ((scene.fog.density = _fogBase), (_fogBase = null))));
}
function clearStatus(e) {
  for (const t of STATUS_KEYS) e[t] = 0;
  ((e.decayAmt = 0),
    (e.decayT = 0),
    (e._undyHeal = 0),
    (e._boltJump = !1),
    (e._anchor = null),
    (e._turret = null),
    e.ultW && endUltW(e));
}
function makeMire(e, t, o, a, n, r, reference) {
  const groundY = abilityGroundY(e, t, reference);
  const s = makeZone(e, t, o, 1.1, r || 5, a, { y: groundY, slow: n || 0.45 });
  s && ((s.team = "atk"), s._lit && (s._lit.intensity = 0.7));
  for (let n = 0; n < 10; n++) {
    const n = Math.random() * Math.PI * 2,
      r = Math.sqrt(Math.random()) * o * 0.9,
      s = new T.Mesh(
        new T.SphereGeometry(0.16 + 0.2 * Math.random(), 7, 6),
        new T.MeshBasicMaterial({
          color: a,
          transparent: !0,
          opacity: 0.55,
          depthWrite: !1,
        }),
      );
    (s.position.set(e + Math.cos(n) * r, groundY + 0.12, t + Math.sin(n) * r),
      addFx(s, 0.6 + 0.5 * Math.random(), (e, t) => {
        ((e.position.y = groundY + 0.12 + 0.5 * Math.sin(t * Math.PI)),
          (e.material.opacity = 0.55 * (1 - t)));
      }));
  }
  return s;
}
function makeTrap(e, t, o, a, n, r, reference) {
  const groundY = abilityGroundY(e, t, reference);
  const s = new T.Mesh(
    new T.CylinderGeometry(0.34, 0.22, 0.5, 8),
    new T.MeshStandardMaterial({
      color: a,
      emissive: a,
      emissiveIntensity: 0.6,
    }),
  );
  (s.position.set(e, groundY + 0.25, t), scene.add(s));
  const i = new T.Mesh(
    new T.RingGeometry(o - 0.16, o, 40),
    new T.MeshBasicMaterial({
      color: a,
      transparent: !0,
      opacity: 0.3,
      side: T.DoubleSide,
      depthWrite: !1,
    }),
  );
  ((i.rotation.x = -Math.PI / 2), i.position.set(e, groundY + 0.07, t), scene.add(i));
  const l = new T.Mesh(
    new T.CircleGeometry(0.96 * o, 40),
    new T.MeshBasicMaterial({
      map: runeTex(),
      color: new T.Color(a).multiplyScalar(1.2),
      transparent: !0,
      opacity: 0.28,
      depthWrite: !1,
      blending: T.AdditiveBlending,
    }),
  );
  ((l.position.z = 0.005), i.add(l));
  try {
    deployFx(e, t, a);
  } catch (e) {}
  world.props.push({
    type: "trap",
    y: groundY,
    x: e,
    z: t,
    r: o,
    mesh: s,
    ring: i,
    onTrigger: n,
    persistent: r,
    armed: !0,
    life: 45,
    team: (player && player.team) || "atk",
  });
}
function makeFlash(e, t) {
  const o = new T.Mesh(
    new T.SphereGeometry(0.4, 14, 12),
    new T.MeshBasicMaterial({
      color: 16777215,
      transparent: !0,
      depthWrite: !1,
    }),
  );
  (o.position.set(e, 1.6, t),
    addFx(o, 0.34, (e, t) => {
      (e.scale.setScalar(1 + 9 * t), (e.material.opacity = 0.95 * (1 - t)));
    }));
  for (let o = 0; o < 2; o++) {
    const a = new T.Mesh(
      new T.RingGeometry(0.3, 0.46, 40),
      new T.MeshBasicMaterial({
        color: 16774096,
        transparent: !0,
        side: T.DoubleSide,
        depthWrite: !1,
      }),
    );
    (a.position.set(e, 1.6, t),
      (a.rotation.x = 0 === o ? -Math.PI / 2 : 0),
      addFx(a, 0.42, (e, t) => {
        const o = 1 + 16 * t;
        (e.scale.set(o, o, o), (e.material.opacity = 0.8 * (1 - t)));
      }));
  }
  fxFlash(16774880, 9, 34, e, 1.7, t, 0.3, 2);
  const a = e - player.pos.x,
    n = t - player.pos.z,
    r = Math.hypot(a, n);
  if (
    r < 30 &&
    !rayBlocked(player.pos.x, player.y + 1.6, player.pos.z, e, 1.6, t)
  ) {
    const e = forwardVec(),
      t = (e.x * a + e.z * n) / (r || 1);
    t > 0.18 && (player.blind = Math.max(player.blind, 2 * t));
  }
  (otherFighters().forEach((o) => {
    o.alive &&
      dist2(o.pos.x, o.pos.z, e, t) < 900 &&
      !rayBlocked(o.pos.x, o.y + 1.6, o.pos.z, e, 1.6, t) &&
      (o.blind = 2);
  }),
    banner("섬광", "#ab47bc"));
}
function makeDrone() {
  const e = new T.Mesh(
    new T.OctahedronGeometry(0.45),
    new T.MeshStandardMaterial({
      color: 16766287,
      emissive: 16766287,
      emissiveIntensity: 0.5,
    }),
  );
  (e.position.set(player.pos.x, 4.5, player.pos.z),
    scene.add(e),
    world.props.push({
      type: "drone",
      mesh: e,
      life: 10,
      x: player.pos.x,
      z: player.pos.z,
      hp: 60,
    }));
}
function throwProjectile(e, t, o) {
  const a = new T.Mesh(
      PROJ_GEO,
      new T.MeshStandardMaterial({
        color: e,
        emissive: e,
        emissiveIntensity: 1.6,
        roughness: 0.3,
        metalness: 0.2,
      }),
    ),
    n = glowDot(e, 0.9, 2);
  a.add(n);
  const r = new T.Mesh(
    PROJ_BAND,
    new T.MeshBasicMaterial({ color: new T.Color(e).multiplyScalar(2) }),
  );
  ((r.rotation.x = Math.PI / 2), a.add(r));
  const s = Math.cos(player.yaw),
    i = -Math.sin(player.yaw),
    l = -Math.sin(player.yaw),
    c = -Math.cos(player.yaw),
    d = new T.Vector3(
      player.pos.x + 0.28 * s + 0.5 * l,
      player.y + eyeHeight() / BODY_K - 0.22,
      player.pos.z + 0.28 * i + 0.5 * c,
    );
  (a.position.copy(d), scene.add(a));
  const h = new T.Vector3(
      -Math.sin(player.yaw) * Math.cos(player.pitch),
      Math.sin(player.pitch) + 0.12,
      -Math.cos(player.yaw) * Math.cos(player.pitch),
    ),
    p = player;
  world.props.push({
    type: "proj",
    mesh: a,
    vel: h.multiplyScalar(t),
    life: 4,
    onHit: (e, t, a) => withCaster(p, () => o(e, t, a)),
    color: e,
    trailT: 0,
  });
}
const PROJ_GEO = new T.SphereGeometry(0.15, 14, 10);
PROJ_GEO.userData.shared = !0;
const PROJ_BAND = new T.TorusGeometry(0.22, 0.018, 6, 24);
function explode(e, t, o, a, n, r) {
  const groundY = abilityGroundY(e, t);
  const s = o > 9 ? 26 : 16,
    i = new T.Mesh(
      new T.SphereGeometry(0.3 * o, s, s - 4),
      new T.MeshBasicMaterial({ color: r, transparent: !0, depthWrite: !1 }),
    );
  (i.position.set(e, groundY + 1.2, t),
    addFx(i, 0.5, (e, t) => {
      (e.scale.setScalar(1 + 1.5 * t),
        (e.material.opacity = (1 - t) * (1 - t) * 0.85));
    }));
  const l = new T.Mesh(
    new T.SphereGeometry(0.16 * o, s - 6, s - 8),
    new T.MeshBasicMaterial({
      color: 16773836,
      transparent: !0,
      depthWrite: !1,
    }),
  );
  (l.position.set(e, groundY + 1.2, t),
    addFx(l, 0.22, (e, t) => {
      (e.scale.setScalar(1 + 2.2 * t), (e.material.opacity = 0.95 * (1 - t)));
    }));
  for (let a = 0; a < 2; a++) {
    const n = new T.Mesh(
      new T.RingGeometry(0.16 * o, 0.22 * o, 52),
      new T.MeshBasicMaterial({
        color: a ? 16777215 : r,
        transparent: !0,
        side: T.DoubleSide,
        depthWrite: !1,
      }),
    );
    ((n.rotation.x = -Math.PI / 2),
      n.position.set(e, groundY + (0.12 + 0.05 * a), t),
      addFx(n, 0.55 + 0.12 * a, (e, t) => {
        const o = 1 + t * (4.4 - 1.2 * a);
        (e.scale.set(o, o, 1),
          (e.material.opacity = (1 - t) * (a ? 0.5 : 0.8)));
      }));
  }
  const c = new T.Mesh(
    new T.CylinderGeometry(0.2 * o, 0.34 * o, 0.55 * o, 20, 1, !0),
    new T.MeshBasicMaterial({
      color: r,
      transparent: !0,
      side: T.DoubleSide,
      depthWrite: !1,
    }),
  );
  (c.position.set(e, groundY + (0.28 * o), t),
    addFx(c, 0.6, (e, t) => {
      (e.scale.set(1 + 0.9 * t, 1 + 1.5 * t, 1 + 0.9 * t),
        (e.material.opacity = 0.34 * (1 - t)));
    }));
  const d = Math.max(3, Math.round(26 * (GFX.fx || 1) * Math.max(0.15, MOT())));
  for (let o = 0; o < d; o++) {
    const o = glowDot(
      Math.random() < 0.3 ? 16773836 : r,
      0.32 + 0.3 * Math.random(),
    );
    o.position.set(e, groundY + 1.1, t);
    const a = Math.random() * Math.PI * 2,
      n = 2.6 + 4.2 * Math.random(),
      s = 5 + 9 * Math.random(),
      i = Math.cos(a) * s,
      l = Math.sin(a) * s;
    let c = n;
    addFx(o, 0.55, (e, t, o) => {
      const a = o || 0.016;
      ((e.position.x += i * a),
        (e.position.z += l * a),
        (e.position.y += c * a),
        (c -= 15 * a),
        (e.material.opacity = 1 - t));
    });
  }
  (fxFlash(r, 6, 3 * o, e, 1.3, t, 0.38, 2),
    glowFlare(e, 1.3, t, r, 1.5 * o, 0.4),
    screenShake(0.35),
    otherFighters().forEach((r) => {
      if (!r.alive || r.team === player.team) return;
      const s = Math.sqrt(dist2(r.pos.x, r.pos.z, e, t));
      if (s < o) {
        hurtFighter(r, n + (a - n) * (1 - s / o), !1, player);
      }
    }));
  const h = Math.sqrt(dist2(player.pos.x, player.pos.z, e, t));
  h < 0.8 * o && damagePlayer(0.42 * (n + (a - n) * (1 - h / o)));
}
function revealArea(e, t, o, a) {
  otherFighters().forEach((n) => {
    n.team !== player.team &&
      dist2(n.pos.x, n.pos.z, e, t) < o * o &&
      (n.revealed = a);
  });
}
PROJ_BAND.userData.shared = !0;
let shake = 0;
function MOT() {
  const e = SETTINGS.motion;
  return void 0 === e ? 1 : e;
}
function screenShake(e) {
  if (!SETTINGS.shake) return;
  const t = MOT();
  if (t <= 0) return;
  const o = casterWeight();
  o <= 0 || (shake = Math.max(shake, e * t * o));
}
let _edgeT = 0;
function edgeFlash(e, t) {
  const o = $("edgefx");
  if (!o) return;
  const a = MOT();
  if (a <= 0) return (o.classList.remove("on"), void (o.style.opacity = "0"));
  const n = Math.min(0.95, (t || 0.6) * a);
  (o.style.setProperty("--efc", e || "#ffffff"),
    (o.style.opacity = String(n)),
    o.classList.add("on"),
    (_edgeT = 0.3 * n + 0.12));
}
function tickEdge(e) {
  if (!(_edgeT <= 0) && ((_edgeT -= e), _edgeT <= 0)) {
    const e = $("edgefx");
    e && (e.classList.remove("on"), (e.style.opacity = "0"));
  }
}
const TIMEFX = { scale: 1, t: 0 };
function slowMo(e, t) {
  if (!1 === SETTINGS.slowMo || MOT() <= 0) return;
  const o = Math.min(1, MOT());
  ((TIMEFX.scale = 1 - (1 - e) * o), (TIMEFX.t = t * o));
}
function tickTimeFx(e) {
  TIMEFX.t > 0 && ((TIMEFX.t -= e), TIMEFX.t <= 0 && (TIMEFX.scale = 1));
}
let _ultCutT = 0;
function ultCutIn(e, t) {
  const o = $("ultcut");
  if (!1 === SETTINGS.ultCut)
    return (o && o.classList.remove("on"), void (_ultCutT = 0));
  const a = o;
  if (!a) return;
  const n = (e && e.color) || "#ffc849";
  a.style.setProperty("--uc", n);
  const r = $("uc-agent"),
    s = $("uc-name"),
    i = $("uc-quote");
  (r && (r.textContent = (e && e.name) || ""),
    s && (s.textContent = t || ""),
    i && (i.textContent = (e && e.quote) || ""),
    a.classList.add("on"),
    (_ultCutT = 0.9),
    edgeFlash(n, 0.45),
    screenShake(0.35));
}
function tickUltCut(e) {
  if (!(_ultCutT <= 0) && ((_ultCutT -= e), _ultCutT <= 0)) {
    const e = $("ultcut");
    e && e.classList.remove("on");
  }
}
function castBurst(e, t, o, a) {
  const groundY = abilityGroundY(e, t);
  const n =
      (a || 1) *
      (void 0 !== GFX ? Math.max(0.5, GFX.fx) : 1) *
      Math.max(0.15, MOT()),
    r = Math.hypot(camera.position.x - e, camera.position.z - t) < 3 * n + 4,
    s = r ? 0.3 : 1.6,
    i = r ? 0.45 : 1;
  for (let a = 0; a < 3; a++) {
    const r = new T.Mesh(
      new T.RingGeometry(0.5, 0.95, 44),
      new T.MeshBasicMaterial({
        color: o,
        transparent: !0,
        side: T.DoubleSide,
        depthWrite: !1,
      }),
    );
    ((r.rotation.x = -Math.PI / 2), r.position.set(e, groundY + (0.12 + 0.1 * a), t));
    const l = (5 + 3.5 * a) * n;
    addFx(r, 0.55 + 0.12 * a, (e, t) => {
      const o = 1 + t * l;
      (e.scale.set(o, o, o),
        (e.material.opacity = (1 - t) * (0.85 - 0.2 * a) * i),
        (e.position.y = groundY + 0.12 + 0.1 * a + t * s));
    });
  }
  if (!r) {
    const a = new T.Mesh(
      new T.CylinderGeometry(1.5 * n, 2.2 * n, 7 * n, 26, 1, !0),
      new T.MeshBasicMaterial({
        color: o,
        transparent: !0,
        side: T.DoubleSide,
        depthWrite: !1,
      }),
    );
    (a.position.set(e, groundY + (3.4 * n), t),
      addFx(a, 0.45, (e, t) => {
        ((e.material.opacity = 0.4 * (1 - t)),
          e.scale.set(1 + 0.7 * t, 1 + 0.5 * t, 1 + 0.7 * t));
      }));
  }
  const l = Math.round(20 * n),
    c = 1.8;
  for (let a = 0; a < l; a++) {
    const r = glowDot(o, 0.45 + 0.35 * Math.random()),
      s = (a / l) * Math.PI * 2 + 0.4 * Math.random(),
      i = (3.5 + 7 * Math.random()) * n,
      d = 2.2 + 4 * Math.random();
    (r.position.set(e + Math.cos(s) * c, groundY + 0.6, t + Math.sin(s) * c),
      addFx(r, 0.6 + 0.3 * Math.random(), (o, a) => {
        ((o.position.x = e + Math.cos(s) * (c + i * a)),
          (o.position.z = t + Math.sin(s) * (c + i * a)),
          (o.position.y = groundY + 0.6 + d * a - 9 * a * a),
          (o.material.opacity = 1 - a));
      }));
  }
  (fxFlash(o, 7 * n, 22 * n, e, 1.8, t, 0.35, 2),
    glowFlare(e, 1.6, t, o, 3 * n, 0.38));
}
function shardErupt(e, t, o, a, n) {
  const groundY = abilityGroundY(e, t);
  const r =
      (void 0 !== GFX ? Math.max(0.5, GFX.fx) : 1) * Math.max(0.15, MOT()),
    s = Math.round((n || 16) * r);
  for (let n = 0; n < s; n++) {
    const r = (n / s) * Math.PI * 2 + 0.5 * Math.random(),
      i = o * (0.25 + 0.75 * Math.random()),
      l = 2.4 + 4.2 * Math.random(),
      c = new T.Mesh(
        new T.ConeGeometry(0.28 + 0.3 * Math.random(), l, 5),
        new T.MeshBasicMaterial({
          color: a,
          transparent: !0,
          opacity: 0.75,
          depthWrite: !1,
        }),
      ),
      d = e + Math.cos(r) * i,
      h = t + Math.sin(r) * i;
    (c.position.set(d, groundY + (-l), h),
      c.rotation.set(
        0.4 * (Math.random() - 0.5),
        3 * Math.random(),
        0.4 * (Math.random() - 0.5),
      ));
    const p = 0.18 * Math.random();
    addFx(c, 1.5, (e, t) => {
      const o = Math.max(0, (t - p) / (1 - p)),
        a = Math.min(1, 4.5 * o);
      ((e.position.y = groundY + 1.32 * l * a - l),
        (e.material.opacity = 0.78 * (1 - Math.max(0, (o - 0.55) / 0.45))));
    });
  }
  const i = new T.Mesh(
    new T.SphereGeometry(0.92 * o, 26, 14, 0, 6.3, 0, 1.15),
    new T.MeshBasicMaterial({
      color: a,
      transparent: !0,
      opacity: 0.22,
      side: T.DoubleSide,
      depthWrite: !1,
    }),
  );
  (i.position.set(e, groundY + 0, t),
    addFx(i, 1.1, (e, t) => {
      (e.scale.setScalar(0.35 + 0.75 * t),
        (e.material.opacity = 0.28 * (1 - t)));
    }));
}
function empWave(e, t, o) {
  const groundY = abilityGroundY(e, t);
  const a =
      (void 0 !== GFX ? Math.max(0.5, GFX.fx) : 1) * Math.max(0.15, MOT()),
    n = Math.hypot(camera.position.x - e, camera.position.z - t) < 6;
  for (let a = 0; a < 4; a++) {
    const r = new T.Mesh(
      new T.RingGeometry(1, 1.5, 64),
      new T.MeshBasicMaterial({
        color: o,
        transparent: !0,
        side: T.DoubleSide,
        depthWrite: !1,
      }),
    );
    ((r.rotation.x = -Math.PI / 2),
      r.position.set(e, groundY + (n ? 0.12 + 0.07 * a : 0.2 + 0.5 * a), t));
    const s = 0.09 * a;
    addFx(r, 1.3, (e, t) => {
      const o = Math.max(0, t - s),
        a = 1 + 46 * o;
      (e.scale.set(a, a, 1),
        (e.material.opacity = Math.max(0, 0.75 - 1 * o) * (n ? 0.45 : 1)));
    });
  }
  const r = Math.round(14 * a);
  for (let a = 0; a < r; a++) {
    const n = (a / r) * Math.PI * 2,
      s = 4 + 10 * Math.random(),
      i = new T.Mesh(
        new T.BoxGeometry(0.1, 9, 0.1),
        new T.MeshBasicMaterial({ color: o, transparent: !0, depthWrite: !1 }),
      );
    (i.position.set(e + Math.cos(n) * s, groundY + 4.5, t + Math.sin(n) * s),
      addFx(i, 0.7, (e, t) => {
        ((e.material.opacity = (1 - t) * (Math.random() < 0.5 ? 0.9 : 0.35)),
          (e.scale.y = 1 + 0.5 * t));
      }));
  }
}
function markPillars(e) {
  try {
    otherFighters().forEach((t) => {
      if (!t.alive || t.team === player.team) return;
      const o = new T.Mesh(
        new T.CylinderGeometry(0.55, 0.9, 16, 12, 1, !0),
        new T.MeshBasicMaterial({
          color: e,
          transparent: !0,
          opacity: 0.45,
          side: T.DoubleSide,
          depthWrite: !1,
        }),
      );
      (o.position.set(t.pos.x, 8, t.pos.z),
        addFx(o, 1.6, (e, t) => {
          ((e.material.opacity =
            0.5 * (1 - t) * (0.6 + 0.4 * Math.sin(22 * t))),
            e.scale.set(1 + 0.25 * t, 1, 1 + 0.25 * t));
        }));
    });
  } catch (e) {}
}
function revivePillar(e, t, o) {
  const groundY = abilityGroundY(e, t);
  const a = new T.Mesh(
    new T.CylinderGeometry(1.1, 1.8, 18, 22, 1, !0),
    new T.MeshBasicMaterial({
      color: o,
      transparent: !0,
      opacity: 0.6,
      side: T.DoubleSide,
      depthWrite: !1,
    }),
  );
  (a.position.set(e, groundY + 9, t),
    addFx(a, 1.5, (e, t) => {
      ((e.material.opacity = 0.65 * (1 - t)),
        e.scale.set(1 - 0.35 * t, 1, 1 - 0.35 * t));
    }));
  const n =
      (void 0 !== GFX ? Math.max(0.5, GFX.fx) : 1) * Math.max(0.15, MOT()),
    r = Math.round(22 * n);
  for (let a = 0; a < r; a++) {
    const a = 7 * Math.random(),
      n = 0.6 + 2.4 * Math.random(),
      r = glowDot(o, 0.5);
    r.position.set(e + Math.cos(a) * n, groundY + 0.2, t + Math.sin(a) * n);
    const s = 4 + 7 * Math.random();
    addFx(r, 1.2, (e, t) => {
      ((e.position.y = groundY + 0.2 + s * t), (e.material.opacity = 1 - t));
    });
  }
  fxFlash(o, 6, 26, e, 3, t, 0.9, 1);
}
function endBurst(e, t, o, a) {
  const groundY = abilityGroundY(e, t);
  const n = new T.Mesh(
    new T.RingGeometry(Math.max(0.4, 0.8 * a), a, 40),
    new T.MeshBasicMaterial({
      color: o,
      transparent: !0,
      side: T.DoubleSide,
      depthWrite: !1,
    }),
  );
  ((n.rotation.x = -Math.PI / 2),
    n.position.set(e, groundY + 0.14, t),
    addFx(n, 0.42, (e, t) => {
      const o = 1 - 0.55 * t;
      (e.scale.set(o, o, o), (e.material.opacity = 0.6 * (1 - t)));
    }));
  const r = Math.round(
    8 * (void 0 !== GFX ? Math.max(0.4, GFX.fx) : 1) * Math.max(0.15, MOT()),
  );
  for (let n = 0; n < r; n++) {
    const s = glowDot(o, 0.5, 1.8),
      i = (n / r) * 7,
      l = 0.7 * a;
    (s.position.set(e + Math.cos(i) * l, groundY + 0.4, t + Math.sin(i) * l),
      addFx(s, 0.5, (e, t) => {
        ((e.position.y = groundY + 0.4 + 1.8 * t), (e.material.opacity = 0.7 * (1 - t)));
      }));
  }
}
const NAV = Object.values(MAP.nodes);
function nearestNode(e, t) {
  let o = NAV[0],
    a = 1e9;
  for (const n of NAV) {
    const r = dist2(e, t, n.x, n.z);
    r < a && ((a = r), (o = n));
  }
  return o;
}
const GRID = { cell: 2.5, minX: MAP.bounds.minX, minZ: MAP.bounds.minZ };
function gx(e) {
  return clamp(Math.floor((e - GRID.minX) / GRID.cell), 0, GRID.cols - 1);
}
function gz(e) {
  return clamp(Math.floor((e - GRID.minZ) / GRID.cell), 0, GRID.rows - 1);
}
function cellCenter(e, t) {
  return {
    x: GRID.minX + (e + 0.5) * GRID.cell,
    z: GRID.minZ + (t + 0.5) * GRID.cell,
  };
}
function buildGrid() {
  for (let e = 0; e < GRID.rows; e++)
    for (let t = 0; t < GRID.cols; t++) {
      const o = cellCenter(t, e);
      GRID.walk[e * GRID.cols + t] =
        blockerTopAt(o.x, o.z, 0, 0.95) > STEP_H ? 0 : 1;
    }
}
function nearestWalkable(e, t) {
  if (GRID.walk[t * GRID.cols + e]) return [e, t];
  for (let o = 1; o <= 14; o++)
    for (let a = -o; a <= o; a++)
      for (let n = -o; n <= o; n++) {
        if (Math.abs(a) !== o && Math.abs(n) !== o) continue;
        const r = e + a,
          s = t + n;
        if (
          !(r < 0 || s < 0 || r >= GRID.cols || s >= GRID.rows) &&
          GRID.walk[s * GRID.cols + r]
        )
          return [r, s];
      }
  return [e, t];
}
((GRID.cols = Math.ceil((MAP.bounds.maxX - MAP.bounds.minX) / GRID.cell)),
  (GRID.rows = Math.ceil((MAP.bounds.maxZ - MAP.bounds.minZ) / GRID.cell)),
  (GRID.walk = new Uint8Array(GRID.cols * GRID.rows)),
  buildGrid());
const NB = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.414],
    [1, -1, 1.414],
    [-1, 1, 1.414],
    [-1, -1, 1.414],
  ],
  _PF = { n: 0 };
function _pfWork(e) {
  return (
    _PF.n !== e &&
      ((_PF.n = e),
      (_PF.gen = 0),
      (_PF.g = new Float32Array(e)),
      (_PF.f = new Float32Array(e)),
      (_PF.prev = new Int32Array(e)),
      (_PF.stamp = new Uint32Array(e)),
      (_PF.closed = new Uint8Array(e)),
      (_PF.heap = [])),
    _PF
  );
}
const PATH_BUDGET = { n: 3 };
function findPath(e, t, o, a) {
  let [n, r] = nearestWalkable(gx(e), gz(t)),
    [s, i] = nearestWalkable(gx(o), gz(a));
  const l = GRID.cols,
    c = GRID.rows,
    d = r * l + n,
    h = i * l + s;
  if (d === h) return [{ x: o, z: a }];
  const p = _pfWork(l * c),
    u = ++p.gen,
    m = p.g,
    f = p.f,
    y = p.prev,
    M = p.stamp,
    w = p.closed,
    T = (e) => {
      M[e] !== u &&
        ((M[e] = u), (m[e] = 1 / 0), (f[e] = 1 / 0), (y[e] = -1), (w[e] = 0));
    },
    g = (e, t) => {
      const o = e > s ? e - s : s - e,
        a = t > i ? t - i : i - t;
      return o + a - 0.5857864 * (o < a ? o : a);
    };
  (T(d), T(h), (m[d] = 0), (f[d] = g(n, r)));
  const x = p.heap;
  x.length = 0;
  const b = (e) => {
      x.push(e);
      let t = x.length - 1;
      for (; t > 0; ) {
        const e = (t - 1) >> 1;
        if (f[x[e]] <= f[x[t]]) break;
        const o = x[e];
        ((x[e] = x[t]), (x[t] = o), (t = e));
      }
    },
    S = () => {
      const e = x[0],
        t = x.pop();
      if (x.length) {
        x[0] = t;
        let e = 0;
        const o = x.length;
        for (;;) {
          const t = 2 * e + 1,
            a = t + 1;
          let n = e;
          if (
            (t < o && f[x[t]] < f[x[n]] && (n = t),
            a < o && f[x[a]] < f[x[n]] && (n = a),
            n === e)
          )
            break;
          const r = x[n];
          ((x[n] = x[e]), (x[e] = r), (e = n));
        }
      }
      return e;
    };
  b(d);
  let v = 0;
  for (; x.length && v++ < l * c; ) {
    const e = S();
    if (w[e]) continue;
    if (((w[e] = 1), e === h)) break;
    const t = e % l,
      o = (e - t) / l;
    for (let a = 0; a < NB.length; a++) {
      const n = NB[a],
        r = n[0],
        s = n[1],
        i = n[2],
        d = t + r,
        h = o + s;
      if (d < 0 || h < 0 || d >= l || h >= c) continue;
      const p = h * l + d;
      if (!GRID.walk[p]) continue;
      if (r && s && (!GRID.walk[o * l + d] || !GRID.walk[h * l + t])) continue;
      if ((T(p), w[p])) continue;
      const u = m[e] + i;
      u < m[p] && ((m[p] = u), (f[p] = u + g(d, h)), (y[p] = e), b(p));
    }
  }
  if (M[h] !== u || (-1 === y[h] && d !== h)) return [{ x: o, z: a }];
  const k = [];
  let _ = h;
  for (; -1 !== _ && _ !== d; ) (k.unshift(_), (_ = y[_]));
  const A = k.map((e) => {
      const t = e % l;
      return cellCenter(t, (e - t) / l);
    }),
    E = (e, t) => {
      const o = Math.ceil(Math.hypot(t.x - e.x, t.z - e.z) / 1);
      for (let a = 0; a <= o; a++) {
        const n = a / o;
        if (collideXZ(e.x + (t.x - e.x) * n, e.z + (t.z - e.z) * n, 0, 0.85))
          return !1;
      }
      return !0;
    },
    z = [];
  let P = { x: e, z: t },
    G = 0;
  for (; G < A.length; ) {
    let e = G,
      t = 1;
    for (let o = G + 1; o < A.length && E(P, A[o]); )
      ((e = o), (o += t), (t *= 2));
    if (e > G && e < A.length - 1 && t > 2) {
      for (let o = Math.min(A.length - 1, e + (t >> 1)); o > e; o--)
        if (E(P, A[o])) {
          e = o;
          break;
        }
    }
    (z.push(A[e]), (P = A[e]), e === G ? G++ : (G = e + 1));
  }
  return (
    E(z.length ? z[z.length - 1] : { x: e, z: t }, { x: o, z: a }) &&
      z.push({ x: o, z: a }),
    z
  );
}
function botTarget(e) {
  let t = null,
    o = 1e9;
  if (player.alive && e.team !== player.team) {
    const a = dist2(e.pos.x, e.pos.z, player.pos.x, player.pos.z);
    if (
      a < 6400 &&
      !rayBlocked(
        e.pos.x,
        e.y + 1.6,
        e.pos.z,
        player.pos.x,
        player.y + 1.2,
        player.pos.z,
      )
    ) {
      const n = Math.atan2(
        -(player.pos.x - e.pos.x),
        -(player.pos.z - e.pos.z),
      );
      (Math.abs(((n - e.yaw + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) < 1.35 ||
        e.alertT > 0) &&
        ((t = { kind: "player" }), (o = a));
    }
  }
  for (const a of world.entities) {
    if (!a.alive || a.team === e.team) continue;
    const n = dist2(e.pos.x, e.pos.z, a.pos.x, a.pos.z);
    n < o &&
      n < 4900 &&
      !rayBlocked(e.pos.x, e.y + 1.6, e.pos.z, a.pos.x, a.y + 1.2, a.pos.z) &&
      ((t = { kind: "bot", ref: a }), (o = n));
  }
  return t;
}
function updateBot(e, t) {
  if (!e.alive) return;
  (e.blind > 0 && (e.blind -= t),
    e.root > 0 && (e.root -= t),
    e.revealed > 0 && (e.revealed -= t),
    e.silenced > 0 && (e.silenced -= t),
    e.alertT > 0 && (e.alertT -= t),
    e.slowT > 0 && ((e.slowT -= t), e.slowT <= 0 && (e.slow = 1)),
    e.shielded > 0 && (e.shielded -= t),
    (e.fireCd -= t),
    (e.repathCd -= t),
    (e.strafeCd -= t),
    (e.skill.cd -= t),
    handleBotSpike(e, t));
  const o = e.blind > 0 ? null : botTarget(e);
  if (o) {
    const a =
      "player" === o.kind
        ? { x: player.pos.x, y: player.y + 1.15, z: player.pos.z }
        : { x: o.ref.pos.x, y: o.ref.y + 1.15, z: o.ref.pos.z };
    ((e.state = "fight"), (e.lastSeen = { x: a.x, z: a.z }));
    let n =
      ((Math.atan2(-(a.x - e.pos.x), -(a.z - e.pos.z)) - e.yaw + 3 * Math.PI) %
        (2 * Math.PI)) -
      Math.PI;
    e.yaw += clamp(n, -7 * t, 7 * t);
    const r = Math.sqrt(dist2(e.pos.x, e.pos.z, a.x, a.z));
    if (Math.abs(n) < 0.13 && e.fireCd <= 0 && r < 75) {
      ((e.fireCd = rnd(0.11, 0.2)),
        e.burst <= 0 &&
          ((e.burst = Math.floor(rnd(3, 7))), (e.fireCd = rnd(0.35, 0.7))),
        e.burst--);
      const t = e.accuracy * (1 + 0.012 * r),
        a = clamp(0.55 - 0.0045 * r, 0.14, 0.55) * (e.slow < 1 ? 0.6 : 1);
      if (Math.random() < a) {
        const t = Math.random() < 0.14,
          a = (t ? 45 : 13) * rnd(0.85, 1.15);
        "player" === o.kind
          ? damagePlayer(a, e.pos.x, e.pos.z)
          : damageEntity(o.ref, a, t, "bot");
      }
      addTracer(
        new T.Vector3(e.pos.x, e.y + 1.55, e.pos.z),
        e.yaw + rnd(-t, t),
        rnd(-0.02, 0.02),
        r,
      );
      {
        const t = Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
        SFX.shot("rifle", clamp(t / 70, 0, 1));
      }
    }
    e.strafeCd <= 0 && ((e.strafe = rnd(-1, 1)), (e.strafeCd = rnd(0.5, 1.3)));
    const s = -Math.sin(e.yaw),
      i = -Math.cos(e.yaw);
    let l = 0,
      c = 0;
    return (
      r > 26 ? ((l += s), (c += i)) : r < 11 && ((l -= s), (c -= i)),
      (l += -i * e.strafe),
      (c += s * e.strafe),
      botMove(e, l, c, t, 4.1),
      void (
        e.skill.cd <= 0 &&
        r < 34 &&
        Math.random() < 0.4 &&
        ((e.skill.cd = rnd(11, 22)), botUseSkill(e, a))
      )
    );
  }
  let a = botGoal(e);
  (e.repathCd <= 0 || !e.path.length) &&
    ((e.path = findPath(e.pos.x, e.pos.z, a.x, a.z)),
    (e.pathIdx = 0),
    (e.repathCd = rnd(1.4, 2.6)));
  const n = e.path[e.pathIdx];
  if (n) {
    if (dist2(e.pos.x, e.pos.z, n.x, n.z) < 30)
      (e.pathIdx++,
        (e.stuckT = 0),
        e.pathIdx >= e.path.length && ((e.path = []), (e.repathCd = 0)));
    else {
      const o = Math.atan2(n.x - e.pos.x, n.z - e.pos.z);
      let a = Math.sin(o),
        r = Math.cos(o);
      const s = dist2(e.pos.x, e.pos.z, e.lastX || 0, e.lastZ || 0);
      if (
        ((e.stuckT =
          s < 0.02
            ? (e.stuckT || 0) + t
            : Math.max(0, (e.stuckT || 0) - 0.6 * t)),
        (e.lastX = e.pos.x),
        (e.lastZ = e.pos.z),
        e.stuckT > 0.35)
      ) {
        (void 0 === e.avoidDir || e.stuckT > 1.6) &&
          ((e.avoidDir = Math.random() < 0.5 ? 1 : -1),
          e.stuckT > 1.6 &&
            ((e.stuckT = 0.4), (e.path = []), (e.repathCd = 0)));
        const t = 1.15 * e.avoidDir,
          o = a * Math.cos(t) - r * Math.sin(t),
          n = a * Math.sin(t) + r * Math.cos(t);
        ((a = o), (r = n));
      } else e.avoidDir = void 0;
      botMove(e, a, r, t, 4.6);
      let i =
        ((Math.atan2(-a, -r) - e.yaw + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
      e.yaw += clamp(i, -4 * t, 4 * t);
    }
  } else ((e.path = []), (e.repathCd = 0));
}
function botMove(e, t, o, a, n) {
  if (e.root > 0) return;
  const r = Math.hypot(t, o) || 1,
    s = n * e.slow * a,
    i = (t / r) * s,
    l = (o / r) * s;
  ((e.y = moveWithSlide(e.pos, i, l, e.y, PR)),
    (e.y = groundAt(e.pos.x, e.pos.z, e.y)));
}
function botCast(e, t, o, a) {
  const n = player,
    r = e.yaw,
    s = e.pitch;
  if (a) {
    const t = a.x - e.pos.x,
      o = a.z - e.pos.z;
    Math.abs(t) + Math.abs(o) > 0.01 &&
      ((e.yaw = Math.atan2(-t, -o)), (e.pitch = 0));
  }
  try {
    ((CASTER = e), (player = e));
    try {
      window.player = e;
    } catch (e) {}
    castAbility(t, o);
  } catch (e) {
  } finally {
    player = n;
    try {
      window.player = n;
    } catch (e) {}
    ((CASTER = null), (e.yaw = r), (e.pitch = s));
  }
}
function botUseSkill(e, t) {
  const o = e.agent;
  if (!o) return;
  const a = e.abilities && e.abilities.length ? e.abilities : null;
  if (a) {
    const o = [];
    for (const e of a) e && e.def && (e.def.ult || o.push(e));
    if (o.length) {
      const a = o[Math.floor(Math.random() * o.length)];
      return void botCast(e, a.def.type, a.def, t);
    }
  }
  const n = Math.random();
  n < 0.4
    ? makeFlashAt(t.x, t.z, e)
    : n < 0.72
      ? makeSmokeAt(
          t.x + rnd(-4, 4),
          t.z + rnd(-4, 4),
          7,
          9,
          parseInt(o.color.slice(1), 16),
        )
      : explodeAt(t.x + rnd(-2, 2), t.z + rnd(-2, 2), 7, 45, 18, e);
}
function makeFlashAt(e, t, o) {
  const a = new T.Mesh(
    new T.SphereGeometry(0.4, 10, 8),
    new T.MeshBasicMaterial({ color: 16777215 }),
  );
  (a.position.set(e, 1.6, t),
    addFx(a, 0.3, (e, t) => {
      (e.scale.setScalar(1 + 7 * t),
        (e.material.transparent = !0),
        (e.material.opacity = 1 - t));
    }));
  const n = e - player.pos.x,
    r = t - player.pos.z,
    s = Math.hypot(n, r);
  if (
    s < 28 * (window.AB_R || 1) &&
    !rayBlocked(player.pos.x, player.y + 1.6, player.pos.z, e, 1.6, t)
  ) {
    const e = forwardVec(),
      t = (e.x * n + e.z * r) / (s || 1);
    t > 0.2 && (player.blind = Math.max(player.blind, 1.6 * t));
  }
}
function makeSmokeAt(e, t, o, a, n) {
  const r = new T.Group();
  for (let e = 0; e < 7; e++) {
    const e = new T.Mesh(
      new T.SphereGeometry(o * rnd(0.55, 0.8), 9, 7),
      new T.MeshBasicMaterial({
        color: n,
        transparent: !0,
        opacity: 0.4,
        depthWrite: !1,
      }),
    );
    (e.position.set(
      rnd(0.5 * -o, 0.5 * o),
      rnd(0.6, 0.7 * o),
      rnd(0.5 * -o, 0.5 * o),
    ),
      r.add(e));
  }
  (r.position.set(e, abilityGroundY(e, t), t), scene.add(r));
  const s = {
    x: e,
    z: t,
    r: o,
    y: r.position.y,
    life: a,
    maxLife: a,
    mesh: r,
    blocksVision: !0,
  };
  return (world.smokes.push(s), s);
}
function explodeAt(e, t, o, a, n, r) {
  const s = new T.Mesh(
    new T.SphereGeometry(0.4 * o, 12, 10),
    new T.MeshBasicMaterial({ color: 16747068, transparent: !0 }),
  );
  (s.position.set(e, 1.2, t),
    addFx(s, 0.4, (e, t) => {
      (e.scale.setScalar(1 + 2.2 * t), (e.material.opacity = 0.8 * (1 - t)));
    }));
  const i = Math.sqrt(dist2(player.pos.x, player.pos.z, e, t));
  i < o && damagePlayer(n + (a - n) * (1 - i / o), e, t);
}
const GUNMAT = {
  steel: () =>
    new T.MeshStandardMaterial({
      color: 7240328,
      roughness: 0.44,
      metalness: 0.62,
    }),
  gunmetal: () =>
    new T.MeshStandardMaterial({
      color: 5397610,
      roughness: 0.5,
      metalness: 0.58,
    }),
  blued: () =>
    new T.MeshStandardMaterial({
      color: 2831424,
      roughness: 0.3,
      metalness: 0.8,
    }),
  black: () =>
    new T.MeshStandardMaterial({
      color: 3357252,
      roughness: 0.64,
      metalness: 0.4,
    }),
  polymer: () =>
    new T.MeshStandardMaterial({
      color: 4673112,
      roughness: 0.84,
      metalness: 0.05,
    }),
  darkpoly: () =>
    new T.MeshStandardMaterial({
      color: 3093821,
      roughness: 0.9,
      metalness: 0.03,
    }),
  rubber: () =>
    new T.MeshStandardMaterial({
      color: 2237996,
      roughness: 0.98,
      metalness: 0,
    }),
  tan: () =>
    new T.MeshStandardMaterial({
      color: 11047532,
      roughness: 0.8,
      metalness: 0.05,
    }),
  olive: () =>
    new T.MeshStandardMaterial({
      color: 7172944,
      roughness: 0.86,
      metalness: 0.04,
    }),
  wood: () =>
    new T.MeshStandardMaterial({
      color: 9067571,
      roughness: 0.72,
      metalness: 0.03,
    }),
  woodDark: () =>
    new T.MeshStandardMaterial({
      color: 6175776,
      roughness: 0.66,
      metalness: 0.04,
    }),
  chrome: () =>
    new T.MeshStandardMaterial({
      color: 14213868,
      roughness: 0.18,
      metalness: 0.9,
    }),
  brass: () =>
    new T.MeshStandardMaterial({
      color: 13214282,
      roughness: 0.3,
      metalness: 0.85,
    }),
  copper: () =>
    new T.MeshStandardMaterial({
      color: 11692604,
      roughness: 0.34,
      metalness: 0.82,
    }),
  blade: () =>
    new T.MeshStandardMaterial({
      color: 14542318,
      roughness: 0.1,
      metalness: 1,
    }),
  glass: () =>
    new T.MeshStandardMaterial({
      color: 858658,
      roughness: 0.08,
      metalness: 0.4,
      transparent: !0,
      opacity: 0.85,
    }),
  glow: (e) =>
    new T.MeshStandardMaterial({
      color: e,
      emissive: e,
      emissiveIntensity: 0.9,
      roughness: 0.35,
    }),
};
function GunBuilder() {
  const e = new T.Group(),
    t = {
      group: e,
      box(t, o, a, n, r, s, i, l, c, d) {
        const h = new T.Mesh(new T.BoxGeometry(o, a, n), t);
        return (
          h.position.set(r, s, i),
          (l || c || d) && h.rotation.set(l || 0, c || 0, d || 0),
          e.add(h),
          h
        );
      },
      cyl(t, o, a, n, r, s, i, l, c, d, h) {
        const p = new T.Mesh(new T.CylinderGeometry(o, a, n, r || 10), t);
        return (
          p.position.set(s, i, l),
          p.rotation.set(c || 0, d || 0, h || 0),
          e.add(p),
          p
        );
      },
      barrel: (e, o, a, n, r, s) =>
        t.cyl(e, o, o, a, 12, n, r, s, Math.PI / 2, 0, 0),
      cone(t, o, a, n, r, s, i, l) {
        const c = new T.Mesh(new T.ConeGeometry(o, a, n || 10), t);
        return (
          c.position.set(r, s, i),
          c.rotation.set(void 0 !== l ? l : Math.PI / 2, 0, 0),
          e.add(c),
          c
        );
      },
      torus(t, o, a, n, r, s, i, l, c, d) {
        const h = new T.Mesh(new T.TorusGeometry(o, a, 8, n || 16), t);
        return (
          h.position.set(r, s, i),
          h.rotation.set(l || 0, c || 0, d || 0),
          e.add(h),
          h
        );
      },
      grip: (e, o, a, n, r, s, i, l) =>
        t.box(e, o, a, n, r, s, i, l || 0.3, 0, 0),
      mag: (e, o, a, n, r, s, i, l) => t.box(e, o, a, n, r, s, i, l || 0, 0, 0),
      stock: (e, o, a, n, r, s, i) => t.box(e, o, a, n, r, s, i),
      screw(e, o, a, n, r, s) {
        const i =
          "x" === s
            ? [0, 0, Math.PI / 2]
            : "z" === s
              ? [Math.PI / 2, 0, 0]
              : [0, 0, 0];
        t.cyl(e, o, o, 0.006, 8, a, n, r, i[0], i[1], i[2]);
        const l = GUNMAT.blued();
        "x" === s
          ? (t.box(l, 0.008, 1.6 * o, 0.004, a, n, r),
            t.box(l, 0.008, 0.004, 1.6 * o, a, n, r))
          : "z" === s
            ? (t.box(l, 1.6 * o, 0.004, 0.008, a, n, r),
              t.box(l, 0.004, 1.6 * o, 0.008, a, n, r))
            : (t.box(l, 1.6 * o, 0.008, 0.004, a, n, r),
              t.box(l, 0.004, 0.008, 1.6 * o, a, n, r));
      },
      pin(e, o, a, n, r) {
        t.cyl(e, o, o, 0.01, 8, a, n, r, 0, 0, Math.PI / 2);
      },
      ejPort(e, o, a, n, r, s, i, l) {
        const c = void 0 === l ? 1 : l;
        (t.box(GUNMAT.blued(), o, a, n, r, s, i),
          t.box(
            e,
            0.5 * o,
            0.22 * a,
            1.04 * n,
            r + c * o * 0.3,
            s + 0.55 * a,
            i,
          ),
          t.box(
            e,
            0.5 * o,
            0.22 * a,
            1.04 * n,
            r + c * o * 0.3,
            s - 0.55 * a,
            i,
          ),
          t.box(e, 0.9 * o, 0.85 * a, 0.01, r + c * o * 0.25, s, i + 0.52 * n),
          t.box(
            e,
            1.1 * o,
            0.9 * a,
            0.03,
            r + c * o * 0.55,
            s + 0.25 * a,
            i + 0.3 * n,
            0,
            0,
            0.5 * -c,
          ));
      },
      chargeHandle(e, o, a, n, r) {
        const s = void 0 === r ? 1 : r;
        (t.box(e, 0.022, 0.014, 0.052, o + 0.004 * s, a, n),
          t.box(
            e,
            0.012,
            0.026,
            0.022,
            o + 0.014 * s,
            a,
            n - 0.012,
            0,
            0,
            0.25 * s,
          ),
          t.cyl(
            e,
            0.005,
            0.005,
            0.03,
            6,
            o + 0.02 * s,
            a,
            n + 0.01,
            0,
            0,
            Math.PI / 2,
          ));
      },
      selector(e, o, a, n, r) {
        const s = void 0 === r ? 1 : r;
        (t.cyl(e, 0.011, 0.011, 0.012, 10, o, a, n, 0, 0, Math.PI / 2),
          t.box(
            e,
            0.01,
            0.008,
            0.03,
            o + 0.008 * s,
            a - 0.006,
            n - 0.008,
            0,
            0,
            0,
          ));
        const i = GUNMAT.glow(16739132);
        (t.box(i, 0.003, 0.003, 0.003, o + 0.012 * s, a + 0.016, n - 0.012),
          t.box(i, 0.003, 0.003, 0.003, o + 0.012 * s, a + 0.016, n),
          t.box(i, 0.003, 0.003, 0.003, o + 0.012 * s, a + 0.016, n + 0.012));
      },
      magRelease(e, o, a, n, r) {
        const s = void 0 === r ? 1 : r;
        (t.box(e, 0.01, 0.018, 0.018, o + 0.002 * s, a, n),
          t.box(GUNMAT.blued(), 0.006, 0.012, 0.012, o + 0.008 * s, a, n));
      },
      boltCatch(e, o, a, n, r) {
        const s = void 0 === r ? 1 : r;
        (t.box(e, 0.01, 0.016, 0.044, o + 0.003 * s, a, n),
          t.box(e, 0.012, 0.022, 0.014, o + 0.004 * s, a - 0.006, n + 0.018));
      },
      mlok(e, o, a, n, r, s, i, l) {
        const c = a / (o + 1);
        for (let d = 0; d < o; d++) {
          const o = s - a / 2 + c * (d + 1);
          (t.box(e, i + 0.004, 0.01, 0.026, n, r - 0.5 * l, o),
            t.box(e, 0.01, 0.024, 0.026, n - 0.5 * i, r, o),
            t.box(e, 0.01, 0.024, 0.026, n + 0.5 * i, r, o));
        }
      },
      ventRow(e, o, a, n, r, s, i, l, c, d) {
        for (let h = 0; h < o; h++) {
          const p = (-c * (o - 1)) / 2 + h * c;
          "x" === d
            ? t.box(e, a, n, r, s + p, i, l)
            : t.box(e, a, n, r, s, i, l + p);
        }
      },
      flashHider(e, o, a, n, r, s, i) {
        t.cyl(e, o, 1.1 * o, 0.4 * a, 12, n, r, s + 0.3 * a, Math.PI / 2, 0, 0);
        const l = i || 4;
        for (let i = 0; i < l; i++) {
          const c = (i / l) * Math.PI * 2 + Math.PI / l;
          t.box(
            e,
            0.008,
            0.008,
            0.7 * a,
            n + Math.cos(c) * o * 0.8,
            r + Math.sin(c) * o * 0.8,
            s - 0.15 * a,
            0,
            0,
            -c,
          );
        }
        t.torus(e, 0.85 * o, 0.006, 12, n, r, s - 0.48 * a, 0, 0, 0);
      },
      brake(e, o, a, n, r, s, i, l) {
        t.box(e, o, a, n, r, s, i);
        const c = l || 3;
        for (let e = 0; e < c; e++) {
          const l = i - n / 2 + (n * (e + 0.5)) / c;
          (t.box(
            GUNMAT.blued(),
            1.06 * o,
            0.42 * a,
            0.13 * n,
            r,
            s + 0.16 * a,
            l,
          ),
            t.box(GUNMAT.blued(), 0.42 * o, 1.06 * a, 0.13 * n, r, s, l));
        }
        t.cyl(
          GUNMAT.blued(),
          0.3 * o,
          0.3 * o,
          1.04 * n,
          12,
          r,
          s,
          i,
          Math.PI / 2,
          0,
          0,
        );
      },
      buttPad(e, o, a, n, r, s, i) {
        t.box(GUNMAT.rubber(), o, a, n, r, s, i);
        const l = Math.max(3, Math.round(a / 0.018));
        for (let c = 0; c < l; c++)
          t.box(
            e,
            1.02 * o,
            0.005,
            0.5 * n,
            r,
            s - a / 2 + (a * (c + 0.5)) / l,
            i + 0.26 * n,
          );
      },
      cheek(e, o, a, n, r, s, i) {
        (t.box(e, o, a, n, r, s, i),
          t.box(
            GUNMAT.rubber(),
            0.9 * o,
            0.22 * a,
            0.85 * n,
            r,
            s + 0.5 * a,
            i,
          ),
          t.cyl(
            GUNMAT.blued(),
            0.006,
            0.006,
            1.3 * a,
            8,
            r - 0.3 * o,
            s,
            i - 0.3 * n,
            0,
            0,
            0,
          ),
          t.cyl(
            GUNMAT.blued(),
            0.006,
            0.006,
            1.3 * a,
            8,
            r + 0.3 * o,
            s,
            i - 0.3 * n,
            0,
            0,
            0,
          ));
      },
      qd(e, o, a, n, r) {
        (t.cyl(e, 0.011, 0.011, 0.012, 10, o, a, n, 0, 0, Math.PI / 2),
          t.torus(e, 0.013, 0.004, 10, o, a, n, r || 0, Math.PI / 2, 0));
      },
      gasSystem(e, o, a, n, r) {
        (t.box(e, 0.03, 0.036, 0.048, o, a, n),
          t.cyl(e, 0.012, 0.012, 0.03, 10, o, a + 0.022, n, 0, 0, 0),
          t.screw(GUNMAT.blued(), 0.006, o + 0.016, a, n, "x"),
          t.cyl(
            GUNMAT.gunmetal(),
            0.007,
            0.007,
            r || 0.14,
            8,
            o,
            a + 0.024,
            n + (r || 0.14) / 2,
            Math.PI / 2,
            0,
            0,
          ));
      },
      opticMount(e, o, a, n, r, s, i) {
        (t.box(e, o, a, n, r, s, i),
          t.screw(GUNMAT.blued(), 0.007, r, s + 0.5 * a, i - 0.28 * n, "y"),
          t.screw(GUNMAT.blued(), 0.007, r, s + 0.5 * a, i + 0.28 * n, "y"),
          t.box(
            e,
            0.012,
            0.7 * a,
            0.5 * n,
            r + 0.55 * o,
            s - 0.1 * a,
            i,
            0,
            0,
            0.35,
          ));
      },
      engrave(e, o, a, n, r, s) {
        const i = void 0 === s ? 1 : s;
        t.box(e, 0.004, 0.016, o, a, n, r);
        for (let e = 0; e < 5; e++)
          t.box(
            GUNMAT.blued(),
            0.006,
            0.004,
            0.008,
            a + 0.002 * i,
            n + 0.004,
            r - o / 2 + (o * (e + 0.5)) / 5,
          );
      },
      gripPanel(e, o, a, n, r, s, i, l, c) {
        const d = c || 5;
        for (let c = 0; c < d; c++) {
          const h = -a / 2 + (a * (c + 0.5)) / d;
          t.box(
            e,
            o,
            (a / d) * 0.62,
            n,
            r,
            s + h * Math.cos(l || 0),
            i - h * Math.sin(l || 0),
            l || 0,
            0,
            0,
          );
        }
      },
      trigger(e, o, a, n, r, s) {
        (t.torus(e, o, 0.007, 12, a, n, r, 0, 0, 0),
          t.box(e, 0.01, 0.026, 0.01, a, n - 0.01, r, s || 0, 0, 0),
          t.box(e, 0.012, 0.006, 0.014, a, n - 0.024, r + 0.004),
          t.box(e, 0.014, 0.01, 0.018, a, n + 0.92 * o, r - 0.5 * o));
      },
      bipod(e, o, a, n, r, s) {
        const i = s || 0.4,
          l = r || 0.19;
        (t.box(e, 0.03, 0.032, 0.05, o, a + 0.016, n),
          t.cyl(e, 0.01, 0.01, 0.052, 10, o, a, n, 0, 0, Math.PI / 2));
        for (const r of [-1, 1]) {
          const s = r * Math.sin(i),
            c = -Math.cos(i),
            d = o + 0.022 * r,
            h = a;
          (t.box(
            e,
            0.013,
            l,
            0.013,
            d + s * l * 0.5,
            h + c * l * 0.5,
            n,
            0,
            0,
            r * i,
          ),
            t.cyl(
              GUNMAT.chrome(),
              0.0095,
              0.0095,
              0.26 * l,
              8,
              d + s * l * 0.66,
              h + c * l * 0.66,
              n,
              0,
              0,
              r * i,
            ),
            t.box(
              GUNMAT.rubber(),
              0.02,
              0.013,
              0.032,
              d + s * l * 1,
              h + c * l * 1,
              n,
              0,
              0,
              r * i,
            ),
            t.screw(GUNMAT.blued(), 0.007, d, h, n, "x"));
        }
      },
      belt(e, o, a, n, r, s) {
        for (let i = 0; i < e; i++) {
          const l = (-r * (e - 1)) / 2 + i * r,
            c = "z" === s ? o : o + l,
            d = "z" === s ? n + l : n;
          (t.cyl(GUNMAT.brass(), 0.0065, 0.0065, 0.026, 8, c, a, d, 0, 0, 0),
            t.cone(GUNMAT.copper(), 0.006, 0.014, 8, c, a + 0.02, d, 0),
            t.torus(
              GUNMAT.blued(),
              0.009,
              0.0025,
              8,
              c,
              a - 0.01,
              d,
              Math.PI / 2,
              0,
              0,
            ));
        }
      },
      magCurved(e, o, a, n, r, s, i, l, c) {
        const d = c || 4;
        for (let c = 0; c < d; c++) {
          const h = -a / 2 + (a * (c + 0.5)) / d,
            p = 0.05 * (c / (d - 1) - 0.5);
          t.box(
            e,
            o,
            (a / d) * 1.02,
            n * (1 - 0.02 * c),
            r,
            s + h,
            i + h * Math.tan(l || 0) * -1 + 0.4 * p,
            (l || 0) + p,
            0,
            0,
          );
        }
        for (let e = 0; e < 3; e++)
          t.box(
            GUNMAT.blued(),
            1.04 * o,
            0.006,
            0.016,
            r,
            s - 0.2 * a + e * a * 0.2,
            i,
          );
        (t.box(e, 1.12 * o, 0.014, 1.06 * n, r, s - 0.52 * a, i, l || 0, 0, 0),
          t.box(
            e,
            1.06 * o,
            0.02,
            0.5 * n,
            r,
            s + 0.5 * a,
            i - 0.2 * n,
            l || 0,
            0,
            0,
          ));
      },
      fluting(e, o, a, n, r, s, i) {
        const l = i || 6;
        for (let i = 0; i < l; i++) {
          const c = (i / l) * Math.PI * 2;
          t.box(
            e,
            0.008,
            0.008,
            a,
            n + Math.cos(c) * o,
            r + Math.sin(c) * o,
            s,
            0,
            0,
            -c,
          );
        }
      },
      laser(e, o, a, n, r) {
        (t.box(e, 0.028, 0.026, 0.06, a, n, r),
          t.cyl(
            GUNMAT.blued(),
            0.01,
            0.01,
            0.012,
            10,
            a,
            n,
            r - 0.034,
            Math.PI / 2,
            0,
            0,
          ),
          t.cyl(
            GUNMAT.glow(o),
            0.007,
            0.007,
            0.004,
            10,
            a,
            n,
            r - 0.04,
            Math.PI / 2,
            0,
            0,
          ),
          t.box(GUNMAT.blued(), 0.01, 0.008, 0.014, a, n + 0.016, r + 0.014));
      },
      scope(e, o, a, n, r, s, i) {
        (t.cyl(e, o, o, a, 14, n, r, s, Math.PI / 2, 0, 0),
          t.cyl(
            e,
            1.25 * o,
            1.25 * o,
            0.12 * a,
            14,
            n,
            r,
            s - 0.42 * a,
            Math.PI / 2,
            0,
            0,
          ),
          t.cyl(
            e,
            1.15 * o,
            1.15 * o,
            0.12 * a,
            14,
            n,
            r,
            s + 0.4 * a,
            Math.PI / 2,
            0,
            0,
          ),
          t.cyl(
            e,
            1.3 * o,
            1.3 * o,
            0.1 * a,
            14,
            n,
            r,
            s + 0.12 * a,
            Math.PI / 2,
            0,
            0,
          ));
        for (let e = 0; e < 6; e++) {
          const i = (e / 6) * Math.PI * 2;
          t.box(
            GUNMAT.blued(),
            0.005,
            0.005,
            0.11 * a,
            n + Math.cos(i) * o * 1.3,
            r + Math.sin(i) * o * 1.3,
            s + 0.12 * a,
          );
        }
        (t.cyl(
          e,
          0.55 * o,
          0.55 * o,
          0.026,
          10,
          n + 1.05 * o,
          r,
          s + 0.02 * a,
          0,
          0,
          Math.PI / 2,
        ),
          t.cyl(
            e,
            0.55 * o,
            0.55 * o,
            0.026,
            10,
            n,
            r + 1.05 * o,
            s + 0.02 * a,
            0,
            0,
            0,
          ));
        const l = t.cyl(
          GUNMAT.glass(),
          0.88 * o,
          0.88 * o,
          0.012,
          14,
          n,
          r,
          s - 0.49 * a,
          Math.PI / 2,
          0,
          0,
        );
        return (
          t.cyl(
            GUNMAT.glass(),
            0.78 * o,
            0.78 * o,
            0.01,
            14,
            n,
            r,
            s + 0.49 * a,
            Math.PI / 2,
            0,
            0,
          ),
          i &&
            t.torus(
              GUNMAT.glow(i),
              0.95 * o,
              0.006,
              16,
              n,
              r,
              s - 0.5 * a,
              0,
              0,
              0,
            ),
          l
        );
      },
      rail(e, o, a, n, r) {
        const s = Math.max(3, Math.round(o / 0.032));
        t.box(e, 0.03, 0.006, o, a, n - 0.007, r);
        for (let i = 0; i < s; i++)
          t.box(e, 0.034, 0.012, 0.016, a, n, r - o / 2 + i * (o / s) + 0.008);
      },
      ironSights(e, o, a, n, r) {
        (t.box(e, 0.008, 0.03, 0.01, o, a + 0.016, n),
          t.box(e, 0.026, 0.008, 0.014, o, a + 0.002, n),
          t.box(e, 0.006, 0.026, 0.008, o - 0.013, a + 0.014, n),
          t.box(e, 0.006, 0.026, 0.008, o + 0.013, a + 0.014, n),
          t.box(e, 0.03, 0.008, 0.01, o, a + 0.014, r),
          t.box(e, 0.008, 0.022, 0.01, o - 0.011, a + 0.02, r),
          t.box(e, 0.008, 0.022, 0.01, o + 0.011, a + 0.02, r),
          t.torus(e, 0.01, 0.004, 10, o, a + 0.022, r, 0, 0, 0));
      },
      heatShroud(e, o, a, n, r, s, i) {
        const l = i || 5;
        for (let i = 0; i < l; i++)
          t.torus(
            e,
            o,
            0.01,
            14,
            n,
            r,
            s - a / 2 + i * (a / (l - 1 || 1)),
            0,
            0,
            0,
          );
      },
      swivel(e, o, a, n) {
        t.torus(e, 0.014, 0.005, 10, o, a, n, 0, Math.PI / 2, 0);
      },
    };
  return t;
}
const GUN_BUILD = {
    knife: () => {
      const e = GunBuilder(),
        t = GUNMAT.blade(),
        o = GUNMAT.black(),
        a = GUNMAT.rubber(),
        n = GUNMAT.glow(16734760);
      (e.box(t, 0.026, 0.085, 0.4, 0, 0.012, -0.2),
        e.box(t, 0.014, 0.03, 0.4, 0, 0.048, -0.2, 0, 0, 0),
        e.cone(t, 0.052, 0.15, 4, 0, 0.012, -0.46, Math.PI / 2),
        e.box(t, 0.02, 0.046, 0.1, 0, 0.006, -0.4, 0.18, 0, 0));
      for (let o = 0; o < 7; o++)
        e.box(t, 0.028, 0.02, 0.022, 0, 0.056, 0.042 * o - 0.34);
      for (let t = 0; t < 7; t++)
        e.box(GUNMAT.blued(), 0.03, 0.008, 0.012, 0, 0.05, 0.042 * t - 0.32);
      (e.box(n, 0.006, 0.004, 0.26, 0.014, 0.012, -0.2),
        e.box(n, 0.006, 0.004, 0.26, -0.014, 0.012, -0.2),
        e.engrave(GUNMAT.chrome(), 0.09, 0.014, 0.038, -0.1, 1),
        e.box(o, 0.034, 0.03, 0.055, 0, -0.006, 0.03),
        e.box(o, 0.046, 0.014, 0.026, 0, 0.014, 0.026),
        e.box(o, 0.046, 0.014, 0.026, 0, -0.026, 0.026),
        e.box(o, 0.04, 0.058, 0.19, 0, -0.04, 0.13, 0.12, 0, 0));
      for (let t = 0; t < 9; t++)
        e.torus(
          a,
          0.026,
          0.0085,
          10,
          0,
          -0.044 - 0.0022 * t,
          0.055 + 0.02 * t,
          0,
          Math.PI / 2,
          0,
        );
      for (let t = 0; t < 4; t++)
        e.torus(
          o,
          0.025,
          0.008,
          10,
          0,
          -0.046 - 0.004 * t,
          0.06 + 0.042 * t,
          0,
          Math.PI / 2,
          0,
        );
      return (
        e.box(o, 0.034, 0.034, 0.03, 0, -0.062, 0.235),
        e.cone(
          GUNMAT.chrome(),
          0.011,
          0.026,
          6,
          0,
          -0.062,
          0.256,
          -Math.PI / 2,
        ),
        e.torus(o, 0.011, 0.004, 10, 0, -0.078, 0.238, 0, 0, 0),
        e.group
      );
    },
    pistol: () => {
      const e = GunBuilder(),
        t = GUNMAT.gunmetal(),
        o = GUNMAT.polymer(),
        a = GUNMAT.black(),
        n = GUNMAT.glow(16739132);
      (e.box(t, 0.052, 0.078, 0.3, 0, 0.03, -0.09),
        e.box(t, 0.04, 0.018, 0.3, 0, 0.068, -0.09));
      for (let t = 0; t < 7; t++)
        e.box(a, 0.056, 0.05, 0.007, 0, 0.03, 0.018 + 0.013 * t);
      for (let t = 0; t < 4; t++)
        e.box(a, 0.056, 0.044, 0.007, 0, 0.028, 0.013 * t - 0.186);
      return (
        e.barrel(GUNMAT.chrome(), 0.017, 0.07, 0, 0.03, -0.255),
        e.cyl(a, 0.023, 0.023, 0.02, 12, 0, 0.03, -0.226, Math.PI / 2, 0, 0),
        e.barrel(GUNMAT.blued(), 0.01, 0.06, 0, -0.002, -0.235),
        e.ejPort(t, 0.034, 0.03, 0.075, 0.02, 0.04, -0.02, 1),
        e.box(a, 0.014, 0.022, 0.03, 0, 0.062, 0.06),
        e.selector(a, -0.026, 0.048, 0.06, -1),
        e.magRelease(a, 0.026, 0.002, 0.036, 1),
        e.boltCatch(a, -0.026, 0.01, 0.01, -1),
        e.box(o, 0.05, 0.045, 0.16, 0, -0.02, -0.01),
        e.rail(a, 0.06, 0, -0.044, -0.1),
        e.box(o, 0.046, 0.028, 0.05, 0, -0.004, -0.088),
        e.grip(o, 0.046, 0.135, 0.075, 0, -0.095, 0.055, 0.28),
        e.gripPanel(a, 0.049, 0.11, 0.07, 0, -0.09, 0.05, 0.28, 6),
        e.box(GUNMAT.blued(), 0.054, 0.03, 0.014, 0, -0.026, 0.086),
        e.box(o, 0.05, 0.02, 0.055, 0, -0.155, 0.085),
        e.box(a, 0.044, 0.01, 0.05, 0, -0.146, 0.082),
        e.trigger(a, 0.026, 0, -0.028, 0.012, 0.1),
        e.ironSights(a, 0, 0.068, -0.21, 0.05),
        e.engrave(GUNMAT.chrome(), 0.08, 0.027, 0.03, -0.12, 1),
        e.box(n, 0.004, 0.005, 0.05, 0.027, 0.01, -0.02),
        e.screw(GUNMAT.blued(), 0.006, -0.026, -0.02, -0.04, "x"),
        e.screw(GUNMAT.blued(), 0.006, 0.026, -0.02, -0.04, "x"),
        e.group
      );
    },
    silenced: () => {
      const e = GunBuilder(),
        t = GUNMAT.black(),
        o = GUNMAT.polymer(),
        a = GUNMAT.blued(),
        n = GUNMAT.glow(5227511);
      e.box(t, 0.05, 0.074, 0.31, 0, 0.03, -0.1);
      for (let t = 0; t < 6; t++)
        e.box(a, 0.054, 0.048, 0.007, 0, 0.03, 0.02 + 0.013 * t);
      (e.box(GUNMAT.gunmetal(), 0.054, 0.048, 0.09, 0, 0.03, 0.03),
        e.barrel(t, 0.034, 0.3, 0, 0.03, -0.4),
        e.heatShroud(GUNMAT.gunmetal(), 0.036, 0.26, 0, 0.03, -0.4, 7),
        e.ventRow(a, 5, 0.074, 0.008, 0.01, 0, 0.03, -0.4, 0.046),
        e.cyl(
          GUNMAT.gunmetal(),
          0.036,
          0.036,
          0.02,
          14,
          0,
          0.03,
          -0.552,
          Math.PI / 2,
          0,
          0,
        ),
        e.cyl(a, 0.028, 0.028, 0.014, 14, 0, 0.03, -0.56, Math.PI / 2, 0, 0),
        e.cyl(
          GUNMAT.gunmetal(),
          0.03,
          0.03,
          0.03,
          14,
          0,
          0.03,
          -0.244,
          Math.PI / 2,
          0,
          0,
        ));
      for (let t = 0; t < 5; t++)
        e.torus(a, 0.029, 0.0026, 12, 0, 0.03, 0.006 * t - 0.256, 0, 0, 0);
      return (
        e.ejPort(GUNMAT.gunmetal(), 0.032, 0.028, 0.07, 0.019, 0.04, -0.03, 1),
        e.box(o, 0.048, 0.044, 0.16, 0, -0.02, -0.01),
        e.rail(a, 0.05, 0, -0.042, -0.1),
        e.grip(o, 0.044, 0.14, 0.072, 0, -0.098, 0.055, 0.28),
        e.gripPanel(
          GUNMAT.rubber(),
          0.047,
          0.116,
          0.068,
          0,
          -0.094,
          0.05,
          0.28,
          7,
        ),
        e.box(o, 0.048, 0.018, 0.052, 0, -0.16, 0.085),
        e.trigger(t, 0.026, 0, -0.028, 0.012, 0.1),
        e.magRelease(t, 0.025, 0, 0.034, 1),
        e.selector(t, -0.025, 0.046, 0.058, -1),
        e.box(n, 0.007, 0.007, 0.007, 0, 0.07, -0.22),
        e.box(t, 0.01, 0.024, 0.012, 0, 0.062, -0.22),
        e.box(n, 0.007, 0.007, 0.007, -0.012, 0.068, 0.05),
        e.box(n, 0.007, 0.007, 0.007, 0.012, 0.068, 0.05),
        e.box(t, 0.036, 0.01, 0.014, 0, 0.06, 0.05),
        e.laser(t, 5227511, 0, -0.052, -0.11),
        e.group
      );
    },
    revolver: () => {
      const e = GunBuilder(),
        t = GUNMAT.steel(),
        o = GUNMAT.wood(),
        a = GUNMAT.black(),
        n = GUNMAT.blued();
      (e.barrel(t, 0.02, 0.3, 0, 0.03, -0.21),
        e.box(t, 0.03, 0.04, 0.3, 0, 0.01, -0.21),
        e.box(a, 0.03, 0.012, 0.3, 0, 0.05, -0.21),
        e.ventRow(n, 6, 0.034, 0.014, 0.012, 0, 0.056, -0.21, 0.042),
        e.cyl(t, 0.05, 0.05, 0.095, 6, 0, 0.022, -0.02, Math.PI / 2, 0, 0));
      for (let t = 0; t < 6; t++) {
        const o = (t / 6) * Math.PI * 2;
        (e.cyl(
          a,
          0.013,
          0.013,
          0.1,
          8,
          0.032 * Math.cos(o),
          0.022 + 0.032 * Math.sin(o),
          -0.02,
          Math.PI / 2,
          0,
          0,
        ),
          e.cyl(
            GUNMAT.brass(),
            0.011,
            0.011,
            0.016,
            8,
            0.032 * Math.cos(o),
            0.022 + 0.032 * Math.sin(o),
            0.026,
            Math.PI / 2,
            0,
            0,
          ));
      }
      for (let t = 0; t < 6; t++) {
        const o = ((t + 0.5) / 6) * Math.PI * 2;
        e.box(
          n,
          0.012,
          0.012,
          0.08,
          0.047 * Math.cos(o),
          0.022 + 0.047 * Math.sin(o),
          -0.02,
          0,
          0,
          -o,
        );
      }
      (e.cyl(t, 0.012, 0.012, 0.13, 10, 0, 0.022, -0.02, Math.PI / 2, 0, 0),
        e.cyl(t, 0.01, 0.01, 0.16, 8, 0, -0.008, -0.1, Math.PI / 2, 0, 0),
        e.box(t, 0.022, 0.018, 0.03, 0, -0.008, -0.185),
        e.box(t, 0.034, 0.055, 0.1, 0, 0.004, 0.055),
        e.box(t, 0.02, 0.035, 0.05, 0, 0.05, 0.06));
      for (let t = 0; t < 4; t++)
        e.box(n, 0.024, 0.006, 0.008, 0, 0.062, 0.042 + 0.01 * t);
      return (
        e.box(a, 0.016, 0.022, 0.04, -0.02, 0.022, 0.036),
        e.grip(o, 0.042, 0.13, 0.085, 0, -0.07, 0.1, 0.34),
        e.box(GUNMAT.woodDark(), 0.044, 0.1, 0.07, 0, -0.07, 0.1, 0.34, 0, 0),
        e.gripPanel(
          GUNMAT.woodDark(),
          0.045,
          0.1,
          0.072,
          0,
          -0.07,
          0.1,
          0.34,
          6,
        ),
        e.box(o, 0.044, 0.03, 0.06, 0, -0.13, 0.135, 0.34, 0, 0),
        e.cyl(
          GUNMAT.chrome(),
          0.01,
          0.01,
          0.006,
          10,
          0.022,
          -0.072,
          0.098,
          0,
          0,
          Math.PI / 2,
        ),
        e.trigger(a, 0.026, 0, -0.022, 0.036, 0.12),
        e.ironSights(a, 0, 0.052, -0.34, 0.055),
        e.screw(n, 0.007, 0.018, 0.004, 0.07, "x"),
        e.screw(n, 0.007, -0.018, 0.004, 0.07, "x"),
        e.group
      );
    },
    machpist: () => {
      const e = GunBuilder(),
        t = GUNMAT.polymer(),
        o = GUNMAT.black(),
        a = GUNMAT.blued(),
        n = GUNMAT.glow(16766287);
      return (
        e.box(o, 0.056, 0.09, 0.26, 0, 0.02, -0.07),
        e.box(t, 0.06, 0.036, 0.1, 0, 0.062, -0.02),
        e.rail(a, 0.09, 0, 0.084, -0.04),
        e.barrel(GUNMAT.gunmetal(), 0.015, 0.11, 0, 0.02, -0.245),
        e.box(o, 0.028, 0.026, 0.06, 0, 0.02, -0.225),
        e.ventRow(a, 3, 0.032, 0.01, 0.01, 0, 0.034, -0.225, 0.018),
        e.flashHider(a, 0.018, 0.045, 0, 0.02, -0.3, 3),
        e.ejPort(o, 0.03, 0.028, 0.06, 0.021, 0.034, -0.02, 1),
        e.chargeHandle(a, -0.03, 0.048, -0.02, -1),
        e.selector(a, 0.03, 0.002, 0.058, 1),
        e.magCurved(o, 0.036, 0.235, 0.065, 0, -0.13, -0.01, 0.05, 5),
        e.box(n, 0.038, 0.006, 0.01, 0, -0.215, -0.01),
        e.magRelease(a, -0.022, -0.03, -0.01, -1),
        e.grip(t, 0.044, 0.115, 0.07, 0, -0.07, 0.075, 0.26),
        e.gripPanel(
          GUNMAT.rubber(),
          0.047,
          0.096,
          0.066,
          0,
          -0.068,
          0.07,
          0.26,
          6,
        ),
        e.box(t, 0.05, 0.022, 0.16, 0, -0.055, -0.13, 0.55, 0, 0),
        e.box(
          GUNMAT.rubber(),
          0.052,
          0.014,
          0.11,
          0,
          -0.062,
          -0.15,
          0.55,
          0,
          0,
        ),
        e.trigger(o, 0.024, 0, -0.02, 0.035, 0.1),
        e.box(o, 0.046, 0.03, 0.09, 0, 0.02, 0.115),
        e.box(a, 0.012, 0.012, 0.16, -0.022, 0.02, 0.19),
        e.box(a, 0.012, 0.012, 0.16, 0.022, 0.02, 0.19),
        e.box(o, 0.056, 0.012, 0.012, 0, 0.02, 0.265),
        e.buttPad(o, 0.052, 0.046, 0.014, 0, 0.02, 0.274),
        e.ironSights(o, 0, 0.084, -0.19, 0.04),
        e.laser(o, 16766287, 0, -0.014, -0.2),
        e.qd(a, -0.028, -0.006, 0.1, 0),
        e.group
      );
    },
    handcan: () => {
      const e = GunBuilder(),
        t = GUNMAT.steel(),
        o = GUNMAT.black(),
        a = GUNMAT.blued(),
        n = GUNMAT.glow(16726862);
      (e.box(t, 0.066, 0.095, 0.34, 0, 0.034, -0.11),
        e.box(o, 0.07, 0.03, 0.3, 0, 0.078, -0.09),
        e.ventRow(a, 7, 0.074, 0.012, 0.012, 0, 0.09, -0.09, 0.036));
      for (let t = 0; t < 6; t++)
        e.box(o, 0.07, 0.06, 0.008, 0, 0.034, 0.02 + 0.015 * t);
      return (
        e.barrel(GUNMAT.chrome(), 0.024, 0.1, 0, 0.034, -0.3),
        e.brake(o, 0.062, 0.062, 0.09, 0, 0.034, -0.33, 3),
        e.box(n, 0.05, 0.006, 0.012, 0, 0.034, -0.375),
        e.ejPort(t, 0.042, 0.036, 0.09, 0.026, 0.046, -0.03, 1),
        e.box(GUNMAT.polymer(), 0.06, 0.05, 0.17, 0, -0.022, -0.02),
        e.rail(a, 0.07, 0, -0.05, -0.1),
        e.grip(GUNMAT.polymer(), 0.054, 0.15, 0.086, 0, -0.105, 0.062, 0.28),
        e.gripPanel(
          GUNMAT.rubber(),
          0.057,
          0.126,
          0.082,
          0,
          -0.102,
          0.058,
          0.28,
          7,
        ),
        e.box(o, 0.058, 0.022, 0.062, 0, -0.176, 0.095),
        e.trigger(o, 0.03, 0, -0.03, 0.014, 0.1),
        e.ironSights(o, 0, 0.096, -0.24, 0.06),
        e.engrave(GUNMAT.chrome(), 0.1, 0.034, 0.034, -0.14, 1),
        e.selector(a, -0.033, 0.052, 0.062, -1),
        e.magRelease(a, 0.032, 0.004, 0.04, 1),
        e.screw(a, 0.007, 0.033, -0.024, -0.05, "x"),
        e.screw(a, 0.007, -0.033, -0.024, -0.05, "x"),
        e.group
      );
    },
    smg: () => {
      const e = GunBuilder(),
        t = GUNMAT.polymer(),
        o = GUNMAT.black(),
        a = GUNMAT.blued();
      return (
        e.box(t, 0.062, 0.1, 0.4, 0, 0.014, -0.13),
        e.box(o, 0.066, 0.024, 0.4, 0, 0.058, -0.13),
        e.rail(o, 0.22, 0, 0.078, -0.16),
        e.barrel(GUNMAT.gunmetal(), 0.016, 0.16, 0, 0.014, -0.4),
        e.heatShroud(o, 0.03, 0.13, 0, 0.014, -0.38, 5),
        e.mlok(a, 3, 0.12, 0, 0.014, -0.38, 0.058, 0.056),
        e.flashHider(a, 0.02, 0.052, 0, 0.014, -0.478, 4),
        e.magCurved(o, 0.04, 0.185, 0.075, 0, -0.115, -0.1, 0.1, 5),
        e.magRelease(a, 0.024, -0.024, -0.06, 1),
        e.grip(t, 0.046, 0.12, 0.072, 0, -0.068, 0.03, 0.26),
        e.gripPanel(
          GUNMAT.rubber(),
          0.049,
          0.1,
          0.068,
          0,
          -0.066,
          0.026,
          0.26,
          6,
        ),
        e.box(t, 0.048, 0.04, 0.13, 0, -0.05, -0.27, 0.2, 0, 0),
        e.gripPanel(
          GUNMAT.rubber(),
          0.051,
          0.034,
          0.11,
          0,
          -0.054,
          -0.28,
          0.2,
          4,
        ),
        e.trigger(o, 0.026, 0, -0.018, -0.008, 0.1),
        e.ejPort(t, 0.034, 0.032, 0.08, 0.033, 0.03, -0.09, 1),
        e.chargeHandle(a, -0.034, 0.044, -0.13, -1),
        e.selector(a, 0.033, -0.004, 0.01, 1),
        e.box(o, 0.05, 0.07, 0.1, 0, 0.01, 0.115),
        e.box(a, 0.014, 0.014, 0.14, -0.02, 0.03, 0.16),
        e.box(a, 0.014, 0.014, 0.14, 0.02, 0.03, 0.16),
        e.box(o, 0.056, 0.075, 0.03, 0, 0.014, 0.245),
        e.buttPad(o, 0.054, 0.072, 0.016, 0, 0.014, 0.258),
        e.qd(a, -0.032, -0.01, 0.1, 0),
        e.qd(a, 0.032, -0.01, 0.1, 0),
        e.engrave(GUNMAT.chrome(), 0.09, -0.032, 0.02, -0.02, -1),
        e.group
      );
    },
    vector: () => {
      const e = GunBuilder(),
        t = GUNMAT.polymer(),
        o = GUNMAT.black(),
        a = GUNMAT.blued(),
        n = GUNMAT.glow(2282478);
      return (
        e.box(t, 0.058, 0.13, 0.36, 0, 0.03, -0.11),
        e.box(o, 0.062, 0.03, 0.34, 0, 0.098, -0.11),
        e.rail(o, 0.18, 0, 0.118, -0.14),
        e.box(t, 0.05, 0.04, 0.1, 0, 0.03, -0.28, 0, 0, 0),
        e.barrel(GUNMAT.gunmetal(), 0.014, 0.1, 0, 0.006, -0.33),
        e.brake(a, 0.03, 0.03, 0.045, 0, 0.006, -0.385, 2),
        e.mlok(a, 2, 0.09, 0, 0.006, -0.3, 0.052, 0.05),
        e.magCurved(o, 0.034, 0.175, 0.06, 0, -0.105, -0.055, -0.06, 4),
        e.box(n, 0.036, 0.005, 0.008, 0, -0.186, -0.055),
        e.magRelease(a, 0.021, -0.028, -0.02, 1),
        e.grip(t, 0.044, 0.115, 0.068, 0, -0.062, 0.055, 0.34),
        e.gripPanel(
          GUNMAT.rubber(),
          0.047,
          0.096,
          0.064,
          0,
          -0.06,
          0.05,
          0.34,
          6,
        ),
        e.box(t, 0.046, 0.034, 0.11, 0, -0.038, -0.22, 0.28, 0, 0),
        e.trigger(o, 0.024, 0, -0.016, 0.018, 0.12),
        e.ejPort(t, 0.03, 0.028, 0.07, 0.031, 0.046, -0.06, 1),
        e.chargeHandle(a, -0.032, 0.07, -0.16, -1),
        e.selector(a, 0.031, -0.006, 0.034, 1),
        e.box(o, 0.052, 0.06, 0.055, 0, 0.03, 0.105),
        e.box(o, 0.048, 0.014, 0.15, 0, 0.058, 0.165),
        e.box(a, 0.016, 0.016, 0.15, -0.018, 0.04, 0.165),
        e.box(a, 0.016, 0.016, 0.15, 0.018, 0.04, 0.165),
        e.box(o, 0.05, 0.055, 0.024, 0, 0.044, 0.245),
        e.buttPad(o, 0.048, 0.052, 0.014, 0, 0.044, 0.256),
        e.box(n, 0.004, 0.026, 0.004, 0.03, 0.03, -0.02),
        e.box(n, 0.004, 0.026, 0.004, -0.03, 0.03, -0.02),
        e.laser(o, 2282478, 0, -0.026, -0.29),
        e.qd(a, -0.029, 0, 0.08, 0),
        e.group
      );
    },
    pdw: () => {
      const e = GunBuilder(),
        t = GUNMAT.tan(),
        o = GUNMAT.black(),
        a = GUNMAT.blued(),
        n = GUNMAT.glow(4906624);
      return (
        e.box(t, 0.06, 0.105, 0.44, 0, 0.016, -0.08),
        e.cyl(t, 0.052, 0.052, 0.42, 12, 0, 0.05, -0.08, Math.PI / 2, 0, 0),
        e.rail(o, 0.16, 0, 0.1, -0.14),
        e.barrel(GUNMAT.gunmetal(), 0.014, 0.13, 0, 0.01, -0.36),
        e.cone(o, 0.026, 0.05, 10, 0, 0.01, -0.44, Math.PI / 2),
        e.heatShroud(a, 0.026, 0.1, 0, 0.01, -0.36, 4),
        e.mlok(a, 2, 0.1, 0, 0.01, -0.34, 0.05, 0.048),
        e.magCurved(o, 0.036, 0.13, 0.07, 0, -0.075, 0.085, 0, 3),
        e.magRelease(a, 0.022, -0.024, 0.085, 1),
        e.grip(t, 0.044, 0.11, 0.066, 0, -0.06, -0.085, 0.24),
        e.gripPanel(
          GUNMAT.rubber(),
          0.047,
          0.092,
          0.062,
          0,
          -0.058,
          -0.089,
          0.24,
          6,
        ),
        e.trigger(o, 0.024, 0, -0.014, -0.12, 0.1),
        e.ejPort(t, 0.03, 0.028, 0.07, 0.032, 0.03, 0.02, 1),
        e.chargeHandle(a, -0.034, 0.06, -0.2, -1),
        e.selector(a, 0.032, -0.012, -0.06, 1),
        e.box(t, 0.056, 0.08, 0.07, 0, 0.01, 0.165),
        e.cheek(t, 0.046, 0.03, 0.13, 0, 0.068, 0.09),
        e.buttPad(o, 0.054, 0.076, 0.016, 0, 0.01, 0.204),
        e.box(o, 0.05, 0.02, 0.05, 0, -0.03, 0.155),
        e.box(n, 0.03, 0.005, 0.01, 0, -0.14, 0.085),
        e.qd(a, -0.03, -0.02, 0.14, 0),
        e.engrave(GUNMAT.chrome(), 0.08, -0.031, 0.02, -0.14, -1),
        e.group
      );
    },
    shotgun: () => {
      const e = GunBuilder(),
        t = GUNMAT.wood(),
        o = GUNMAT.black(),
        a = GUNMAT.gunmetal(),
        n = GUNMAT.blued();
      (e.barrel(a, 0.026, 0.52, 0, 0.04, -0.26),
        e.barrel(o, 0.022, 0.44, 0, -0.006, -0.24),
        e.cyl(
          n,
          0.024,
          0.024,
          0.026,
          12,
          0,
          -0.006,
          -0.452,
          Math.PI / 2,
          0,
          0,
        ));
      for (let t = 0; t < 3; t++)
        e.torus(
          n,
          0.034,
          0.005,
          12,
          0,
          0.016,
          -0.16 - 0.14 * t,
          Math.PI / 2,
          0,
          0,
        );
      e.box(t, 0.048, 0.052, 0.16, 0, -0.006, -0.2);
      for (let t = 0; t < 6; t++)
        e.box(n, 0.05, 0.008, 0.012, 0, -0.006, 0.026 * t - 0.26);
      return (
        e.box(GUNMAT.woodDark(), 0.05, 0.014, 0.15, 0, -0.03, -0.2),
        e.box(a, 0.056, 0.085, 0.24, 0, 0.026, 0.01),
        e.box(o, 0.058, 0.02, 0.2, 0, 0.072, 0),
        e.ejPort(a, 0.038, 0.032, 0.075, 0.03, 0.016, -0.03, 1),
        e.box(o, 0.04, 0.02, 0.07, 0, -0.024, 0.02),
        e.cyl(
          GUNMAT.brass(),
          0.012,
          0.012,
          0.02,
          10,
          0,
          -0.028,
          -0.01,
          Math.PI / 2,
          0,
          0,
        ),
        e.box(o, 0.014, 0.014, 0.03, -0.028, 0.008, 0.07),
        e.grip(t, 0.046, 0.1, 0.075, 0, -0.055, 0.115, 0.3),
        e.box(t, 0.052, 0.09, 0.22, 0, -0.02, 0.235, 0.06, 0, 0),
        e.gripPanel(
          GUNMAT.woodDark(),
          0.054,
          0.06,
          0.2,
          0,
          -0.03,
          0.235,
          0.06,
          4,
        ),
        e.buttPad(o, 0.054, 0.095, 0.025, 0, -0.026, 0.35),
        e.trigger(o, 0.026, 0, -0.016, 0.07, 0.1),
        e.box(o, 0.014, 0.012, 0.02, 0.024, -0.02, 0.09),
        e.box(o, 0.008, 0.02, 0.01, 0, 0.09, -0.5),
        e.cyl(
          GUNMAT.glow(16739132),
          0.004,
          0.004,
          0.008,
          8,
          0,
          0.098,
          -0.502,
          Math.PI / 2,
          0,
          0,
        ),
        e.swivel(o, 0, -0.03, -0.44),
        e.swivel(o, 0, -0.062, 0.3),
        e.engrave(GUNMAT.chrome(), 0.1, 0.029, 0.036, 0.01, 1),
        e.group
      );
    },
    autoshot: () => {
      const e = GunBuilder(),
        t = GUNMAT.black(),
        o = GUNMAT.polymer(),
        a = GUNMAT.blued(),
        n = GUNMAT.glow(16739132);
      (e.box(o, 0.068, 0.11, 0.36, 0, 0.024, -0.08),
        e.box(t, 0.072, 0.026, 0.34, 0, 0.086, -0.08),
        e.rail(t, 0.2, 0, 0.104, -0.12),
        e.barrel(GUNMAT.gunmetal(), 0.026, 0.26, 0, 0.024, -0.36),
        e.heatShroud(t, 0.04, 0.22, 0, 0.024, -0.35, 5),
        e.ventRow(a, 5, 0.086, 0.012, 0.014, 0, 0.024, -0.35, 0.044),
        e.box(t, 0.05, 0.05, 0.06, 0, 0.024, -0.5),
        e.ventRow(a, 3, 0.054, 0.012, 0.01, 0, 0.048, -0.5, 0.018),
        e.cyl(o, 0.115, 0.115, 0.08, 20, 0, -0.08, -0.03, 0, 0, Math.PI / 2),
        e.cyl(t, 0.118, 0.118, 0.03, 20, 0, -0.08, -0.03, 0, 0, Math.PI / 2),
        e.torus(n, 0.092, 0.009, 20, 0.044, -0.08, -0.03, 0, 0, Math.PI / 2),
        e.cyl(
          GUNMAT.gunmetal(),
          0.034,
          0.034,
          0.09,
          12,
          0,
          -0.08,
          -0.03,
          0,
          0,
          Math.PI / 2,
        ),
        e.cyl(t, 0.014, 0.014, 0.1, 10, 0, -0.08, -0.03, 0, 0, Math.PI / 2));
      for (let o = 0; o < 6; o++) {
        const n = (o / 6) * Math.PI * 2;
        (e.box(
          t,
          0.018,
          0.07,
          0.014,
          0.046,
          0.07 * Math.sin(n) - 0.08,
          0.07 * Math.cos(n) - 0.03,
          0,
          0,
          -n,
        ),
          e.screw(
            a,
            0.007,
            0.047,
            0.098 * Math.sin(n) - 0.08,
            0.098 * Math.cos(n) - 0.03,
            "x",
          ));
      }
      return (
        e.box(t, 0.046, 0.04, 0.07, 0, 0, -0.03),
        e.grip(o, 0.048, 0.12, 0.074, 0, -0.062, 0.075, 0.26),
        e.gripPanel(
          GUNMAT.rubber(),
          0.051,
          0.1,
          0.07,
          0,
          -0.06,
          0.071,
          0.26,
          6,
        ),
        e.box(o, 0.05, 0.044, 0.12, 0, -0.046, -0.24, 0.22, 0, 0),
        e.gripPanel(
          GUNMAT.rubber(),
          0.053,
          0.038,
          0.1,
          0,
          -0.05,
          -0.25,
          0.22,
          4,
        ),
        e.trigger(t, 0.026, 0, -0.014, 0.038, 0.1),
        e.ejPort(o, 0.038, 0.034, 0.08, 0.036, 0.036, -0.02, 1),
        e.chargeHandle(a, -0.038, 0.052, -0.1, -1),
        e.selector(a, 0.037, -0.002, 0.048, 1),
        e.box(t, 0.058, 0.075, 0.09, 0, 0.018, 0.155),
        e.box(t, 0.052, 0.08, 0.028, 0, 0.014, 0.235),
        e.buttPad(t, 0.054, 0.078, 0.016, 0, 0.014, 0.248),
        e.qd(a, -0.036, -0.014, 0.13, 0),
        e.group
      );
    },
    slugger: () => {
      const e = GunBuilder(),
        t = GUNMAT.steel(),
        o = GUNMAT.black(),
        a = GUNMAT.polymer(),
        n = GUNMAT.blued();
      (e.barrel(t, 0.028, 0.46, -0.03, 0.034, -0.24),
        e.barrel(t, 0.028, 0.46, 0.03, 0.034, -0.24),
        e.box(o, 0.095, 0.02, 0.44, 0, 0.034, -0.24),
        e.box(o, 0.095, 0.016, 0.44, 0, 0.008, -0.24));
      for (let t = 0; t < 4; t++)
        e.box(n, 0.1, 0.03, 0.012, 0, 0.034, -0.06 - 0.12 * t);
      return (
        e.cyl(n, 0.03, 0.03, 0.02, 12, -0.03, 0.034, -0.462, Math.PI / 2, 0, 0),
        e.cyl(n, 0.03, 0.03, 0.02, 12, 0.03, 0.034, -0.462, Math.PI / 2, 0, 0),
        e.box(t, 0.1, 0.09, 0.2, 0, 0.02, 0.02),
        e.box(o, 0.104, 0.024, 0.16, 0, 0.07, 0.01),
        e.box(o, 0.04, 0.03, 0.04, 0, 0.06, 0.09),
        e.box(n, 0.05, 0.01, 0.014, 0, 0.076, 0.095),
        e.cyl(
          GUNMAT.brass(),
          0.016,
          0.016,
          0.022,
          10,
          -0.03,
          0.034,
          0.1,
          Math.PI / 2,
          0,
          0,
        ),
        e.cyl(
          GUNMAT.brass(),
          0.016,
          0.016,
          0.022,
          10,
          0.03,
          0.034,
          0.1,
          Math.PI / 2,
          0,
          0,
        ),
        e.grip(a, 0.048, 0.105, 0.078, 0, -0.056, 0.115, 0.3),
        e.gripPanel(
          GUNMAT.rubber(),
          0.051,
          0.086,
          0.074,
          0,
          -0.054,
          0.111,
          0.3,
          5,
        ),
        e.box(a, 0.054, 0.07, 0.17, 0, -0.03, 0.235, 0.04, 0, 0),
        e.box(o, 0.03, 0.044, 0.14, 0, -0.006, 0.23, 0.04, 0, 0),
        e.buttPad(o, 0.056, 0.078, 0.026, 0, -0.034, 0.33),
        e.box(a, 0.06, 0.046, 0.15, 0, -0.01, -0.22, 0.14, 0, 0),
        e.gripPanel(
          GUNMAT.rubber(),
          0.063,
          0.038,
          0.13,
          0,
          -0.014,
          -0.23,
          0.14,
          5,
        ),
        e.trigger(o, 0.026, 0, -0.014, 0.074, 0.1),
        e.box(o, 0.01, 0.026, 0.01, 0, -0.024, 0.096),
        e.ironSights(o, 0, 0.062, -0.44, 0.06),
        e.qd(n, 0, -0.02, -0.4, Math.PI / 2),
        e.engrave(GUNMAT.chrome(), 0.09, 0.051, 0.03, 0.02, 1),
        e.group
      );
    },
    rifle: () => {
      const e = GunBuilder(),
        t = GUNMAT.black(),
        o = GUNMAT.polymer(),
        a = GUNMAT.blued(),
        n = GUNMAT.glow(16739132);
      (e.box(t, 0.058, 0.105, 0.42, 0, 0.02, -0.12),
        e.box(t, 0.062, 0.046, 0.22, 0, 0.086, -0.1),
        e.box(t, 0.014, 0.05, 0.03, -0.024, 0.054, -0.19),
        e.box(t, 0.014, 0.05, 0.03, 0.024, 0.054, -0.01),
        e.box(a, 0.056, 0.014, 0.2, 0, 0.06, -0.1),
        e.rail(GUNMAT.gunmetal(), 0.17, 0, 0.112, -0.11),
        e.barrel(GUNMAT.gunmetal(), 0.016, 0.3, 0, 0.014, -0.46),
        e.cyl(t, 0.038, 0.038, 0.2, 12, 0, 0.014, -0.4, Math.PI / 2, 0, 0));
      for (let t = 0; t < 5; t++)
        e.box(
          GUNMAT.gunmetal(),
          0.078,
          0.01,
          0.014,
          0,
          0.014,
          0.036 * t - 0.46,
        );
      return (
        e.mlok(a, 3, 0.16, 0, 0.014, -0.4, 0.076, 0.074),
        e.gasSystem(t, 0, 0.04, -0.545, 0.1),
        e.flashHider(a, 0.022, 0.058, 0, 0.014, -0.625, 4),
        e.magCurved(t, 0.042, 0.2, 0.08, 0, -0.125, -0.045, 0.13, 5),
        e.box(n, 0.044, 0.005, 0.012, 0, -0.222, -0.052),
        e.magRelease(a, 0.026, -0.032, 0, 1),
        e.boltCatch(a, -0.03, -0.026, -0.03, -1),
        e.grip(o, 0.048, 0.125, 0.074, 0, -0.072, 0.065, 0.28),
        e.gripPanel(
          GUNMAT.rubber(),
          0.051,
          0.104,
          0.07,
          0,
          -0.07,
          0.061,
          0.28,
          6,
        ),
        e.box(o, 0.056, 0.086, 0.2, 0, -0.006, 0.215, 0.03, 0, 0),
        e.box(a, 0.026, 0.026, 0.12, 0, 0.008, 0.15),
        e.buttPad(t, 0.058, 0.092, 0.026, 0, -0.01, 0.32),
        e.trigger(t, 0.027, 0, -0.02, 0.02, 0.1),
        e.ejPort(t, 0.036, 0.03, 0.08, 0.031, 0.036, -0.06, 1),
        e.chargeHandle(a, 0, 0.07, 0.085, 1),
        e.box(t, 0.034, 0.03, 0.05, 0, 0.052, 0.1),
        e.selector(a, 0.03, -0.01, 0.052, 1),
        e.pin(a, 0.008, 0, -0.018, -0.03),
        e.pin(a, 0.008, 0, -0.018, 0.09),
        e.qd(a, -0.03, -0.012, 0.108, 0),
        e.engrave(GUNMAT.chrome(), 0.1, -0.03, 0.02, -0.04, -1),
        e.group
      );
    },
    carbine: () => {
      const e = GunBuilder(),
        t = GUNMAT.black(),
        o = GUNMAT.tan(),
        a = GUNMAT.blued(),
        n = GUNMAT.glow(2282478);
      (e.box(t, 0.056, 0.1, 0.36, 0, 0.02, -0.1),
        e.rail(t, 0.24, 0, 0.076, -0.13),
        e.opticMount(t, 0.05, 0.03, 0.07, 0, 0.088, -0.11),
        e.box(t, 0.05, 0.055, 0.075, 0, 0.108, -0.11),
        e.cyl(
          GUNMAT.glass(),
          0.028,
          0.028,
          0.012,
          14,
          0,
          0.112,
          -0.148,
          Math.PI / 2,
          0,
          0,
        ),
        e.torus(t, 0.03, 0.006, 14, 0, 0.112, -0.15, 0, 0, 0),
        e.box(n, 0.006, 0.006, 0.006, 0, 0.112, -0.152),
        e.cyl(t, 0.01, 0.01, 0.018, 10, 0.026, 0.108, -0.08, 0, 0, Math.PI / 2),
        e.barrel(GUNMAT.gunmetal(), 0.015, 0.2, 0, 0.014, -0.38),
        e.box(o, 0.052, 0.052, 0.2, 0, 0.014, -0.36));
      for (let o = 0; o < 4; o++)
        e.box(t, 0.056, 0.008, 0.016, 0, -0.01, 0.04 * o - 0.42);
      (e.mlok(a, 3, 0.17, 0, 0.014, -0.36, 0.05, 0.05),
        e.gasSystem(t, 0, 0.038, -0.452, 0.08),
        e.brake(a, 0.03, 0.03, 0.048, 0, 0.014, -0.495, 3),
        e.magCurved(t, 0.04, 0.185, 0.076, 0, -0.115, -0.035, 0.12, 5),
        e.magRelease(a, 0.025, -0.024, 0.01, 1),
        e.grip(o, 0.046, 0.118, 0.072, 0, -0.066, 0.058, 0.27),
        e.gripPanel(
          GUNMAT.rubber(),
          0.049,
          0.098,
          0.068,
          0,
          -0.064,
          0.054,
          0.27,
          6,
        ),
        e.box(t, 0.03, 0.03, 0.2, 0, 0.01, 0.185));
      for (let t = 0; t < 5; t++)
        e.box(a, 0.034, 0.008, 0.01, 0, -0.004, 0.12 + 0.03 * t);
      return (
        e.box(o, 0.052, 0.075, 0.09, 0, 0.002, 0.245),
        e.cheek(o, 0.04, 0.024, 0.1, 0, 0.046, 0.23),
        e.buttPad(t, 0.054, 0.08, 0.024, 0, -0.002, 0.3),
        e.trigger(t, 0.026, 0, -0.018, 0.014, 0.1),
        e.ejPort(t, 0.034, 0.03, 0.076, 0.03, 0.034, -0.04, 1),
        e.chargeHandle(a, 0, 0.062, 0.09, 1),
        e.selector(a, 0.029, -0.008, 0.046, 1),
        e.laser(t, 2282478, 0, -0.02, -0.42),
        e.qd(a, -0.029, -0.008, 0.098, 0),
        e.group
      );
    },
    battle: () => {
      const e = GunBuilder(),
        t = GUNMAT.wood(),
        o = GUNMAT.gunmetal(),
        a = GUNMAT.black(),
        n = GUNMAT.blued();
      (e.box(o, 0.062, 0.115, 0.46, 0, 0.022, -0.1),
        e.box(a, 0.066, 0.022, 0.42, 0, 0.078, -0.1),
        e.box(t, 0.066, 0.06, 0.3, 0, -0.012, -0.36),
        e.gripPanel(
          GUNMAT.woodDark(),
          0.068,
          0.05,
          0.28,
          0,
          -0.012,
          -0.36,
          0,
          6,
        ),
        e.box(GUNMAT.woodDark(), 0.068, 0.014, 0.28, 0, -0.04, -0.36),
        e.barrel(o, 0.019, 0.4, 0, 0.026, -0.52),
        e.brake(n, 0.036, 0.036, 0.06, 0, 0.026, -0.72, 3),
        e.cyl(o, 0.026, 0.026, 0.22, 10, 0, 0.062, -0.42, Math.PI / 2, 0, 0),
        e.gasSystem(a, 0, 0.056, -0.545, 0.1));
      for (let t = 0; t < 4; t++)
        e.torus(n, 0.028, 0.005, 12, 0, 0.062, -0.34 - 0.055 * t, 0, 0, 0);
      return (
        e.magCurved(a, 0.048, 0.215, 0.09, 0, -0.135, -0.03, 0.15, 5),
        e.magRelease(n, 0.028, -0.036, 0.02, 1),
        e.grip(t, 0.05, 0.13, 0.078, 0, -0.078, 0.085, 0.26),
        e.gripPanel(
          GUNMAT.woodDark(),
          0.053,
          0.108,
          0.074,
          0,
          -0.076,
          0.081,
          0.26,
          6,
        ),
        e.box(t, 0.058, 0.1, 0.26, 0, -0.012, 0.255, 0.04, 0, 0),
        e.gripPanel(
          GUNMAT.woodDark(),
          0.06,
          0.07,
          0.24,
          0,
          -0.02,
          0.255,
          0.04,
          4,
        ),
        e.buttPad(a, 0.06, 0.104, 0.028, 0, -0.016, 0.395),
        e.trigger(a, 0.028, 0, -0.022, 0.038, 0.1),
        e.ejPort(o, 0.04, 0.034, 0.09, 0.033, 0.038, -0.04, 1),
        e.chargeHandle(n, -0.034, 0.052, -0.16, -1),
        e.selector(n, 0.032, -0.006, 0.06, 1),
        e.ironSights(a, 0, 0.086, -0.6, 0.05),
        e.swivel(a, 0, -0.046, -0.5),
        e.swivel(a, 0, -0.058, 0.3),
        e.engrave(GUNMAT.chrome(), 0.11, 0.032, 0.026, -0.04, 1),
        e.screw(n, 0.008, 0.033, -0.016, -0.23, "x"),
        e.screw(n, 0.008, -0.033, -0.016, -0.23, "x"),
        e.group
      );
    },
    burst: () => {
      const e = GunBuilder(),
        t = GUNMAT.polymer(),
        o = GUNMAT.black(),
        a = GUNMAT.blued(),
        n = GUNMAT.glow(16766287);
      return (
        e.box(t, 0.06, 0.12, 0.5, 0, 0.018, -0.02),
        e.box(t, 0.064, 0.055, 0.34, 0, 0.098, -0.1),
        e.box(o, 0.018, 0.048, 0.03, -0.026, 0.062, -0.24),
        e.box(o, 0.018, 0.048, 0.03, 0.026, 0.062, 0.04),
        e.box(a, 0.05, 0.016, 0.3, 0, 0.078, -0.1),
        e.cyl(
          GUNMAT.glass(),
          0.02,
          0.02,
          0.01,
          12,
          0,
          0.1,
          -0.268,
          Math.PI / 2,
          0,
          0,
        ),
        e.torus(o, 0.022, 0.005, 12, 0, 0.1, -0.272, 0, 0, 0),
        e.cyl(
          GUNMAT.glass(),
          0.018,
          0.018,
          0.008,
          12,
          0,
          0.1,
          0.062,
          Math.PI / 2,
          0,
          0,
        ),
        e.barrel(GUNMAT.gunmetal(), 0.015, 0.22, 0, 0.008, -0.38),
        e.box(o, 0.046, 0.046, 0.16, 0, 0.008, -0.35),
        e.mlok(a, 3, 0.14, 0, 0.008, -0.35, 0.044, 0.044),
        e.gasSystem(o, 0, 0.032, -0.452, 0.08),
        e.flashHider(a, 0.02, 0.052, 0, 0.008, -0.492, 3),
        e.magCurved(o, 0.04, 0.15, 0.072, 0, -0.078, 0.125, 0, 4),
        e.magRelease(a, 0.023, -0.03, 0.125, 1),
        e.grip(t, 0.046, 0.118, 0.07, 0, -0.062, -0.105, 0.24),
        e.gripPanel(
          GUNMAT.rubber(),
          0.049,
          0.098,
          0.066,
          0,
          -0.06,
          -0.109,
          0.24,
          6,
        ),
        e.trigger(o, 0.025, 0, -0.016, -0.142, 0.1),
        e.ejPort(t, 0.032, 0.03, 0.074, 0.032, 0.03, 0.06, 1),
        e.chargeHandle(a, -0.034, 0.058, -0.22, -1),
        e.selector(a, 0.032, -0.014, -0.08, 1),
        e.box(t, 0.058, 0.095, 0.06, 0, 0.01, 0.225),
        e.cheek(t, 0.042, 0.026, 0.14, 0, 0.062, 0.12),
        e.buttPad(o, 0.06, 0.1, 0.024, 0, 0.008, 0.268),
        e.box(n, 0.005, 0.03, 0.005, 0.032, 0.02, 0.06),
        e.qd(a, -0.031, -0.016, 0.18, 0),
        e.engrave(GUNMAT.chrome(), 0.09, -0.031, 0.014, -0.1, -1),
        e.group
      );
    },
    lmg: () => {
      const e = GunBuilder(),
        t = GUNMAT.black(),
        o = GUNMAT.gunmetal(),
        a = GUNMAT.blued(),
        n = GUNMAT.glow(16726862);
      (e.box(t, 0.072, 0.125, 0.5, 0, 0.02, -0.1),
        e.box(t, 0.076, 0.04, 0.26, 0, 0.092, -0.12),
        e.box(a, 0.07, 0.012, 0.22, 0, 0.114, -0.12),
        e.screw(a, 0.008, 0, 0.114, -0.22, "y"),
        e.screw(a, 0.008, 0, 0.114, -0.02, "y"),
        e.rail(o, 0.14, 0, 0.126, -0.16),
        e.barrel(o, 0.02, 0.42, 0, 0.02, -0.54),
        e.cyl(o, 0.033, 0.033, 0.3, 14, 0, 0.02, -0.5, Math.PI / 2, 0, 0));
      for (let t = 0; t < 6; t++) {
        const o = 0.048 * t - 0.62;
        (e.box(a, 0.072, 0.018, 0.022, 0, 0.02, o),
          e.box(a, 0.018, 0.072, 0.022, 0, 0.02, o));
      }
      return (
        e.torus(a, 0.035, 0.006, 14, 0, 0.02, -0.64, 0, 0, 0),
        e.torus(a, 0.035, 0.006, 14, 0, 0.02, -0.36, 0, 0, 0),
        e.fluting(a, 0.022, 0.28, 0, 0.02, -0.5, 6),
        e.brake(a, 0.04, 0.04, 0.06, 0, 0.02, -0.76, 3),
        e.box(t, 0.034, 0.09, 0.13, 0, 0.075, -0.3, 0, 0, 0.3),
        e.gripPanel(GUNMAT.rubber(), 0.036, 0.074, 0.11, 0, 0.075, -0.3, 0, 5),
        e.gasSystem(t, 0, -0.012, -0.56, 0.12),
        e.box(t, 0.105, 0.115, 0.14, 0, -0.08, -0.02),
        e.box(a, 0.108, 0.02, 0.14, 0, -0.02, -0.02),
        e.box(a, 0.024, 0.08, 0.014, 0.054, -0.086, -0.02),
        e.belt(7, -0.04, -0.016, -0.055, 0.013, "x"),
        e.box(n, 0.04, 0.006, 0.01, 0, -0.145, -0.02),
        e.grip(GUNMAT.polymer(), 0.05, 0.13, 0.078, 0, -0.076, 0.098, 0.26),
        e.gripPanel(
          GUNMAT.rubber(),
          0.053,
          0.108,
          0.074,
          0,
          -0.074,
          0.094,
          0.26,
          6,
        ),
        e.box(GUNMAT.polymer(), 0.06, 0.1, 0.22, 0, -0.01, 0.255, 0.03, 0, 0),
        e.cheek(GUNMAT.polymer(), 0.046, 0.028, 0.13, 0, 0.046, 0.23),
        e.buttPad(t, 0.062, 0.105, 0.026, 0, -0.014, 0.375),
        e.trigger(t, 0.028, 0, -0.022, 0.052, 0.1),
        e.ejPort(t, 0.042, 0.036, 0.09, 0.038, 0.024, -0.06, 1),
        e.chargeHandle(a, 0.04, 0.03, -0.16, 1),
        e.bipod(t, 0, -0.07, -0.45, 0.19, 0.42),
        e.qd(a, -0.038, -0.024, 0.14, 0),
        e.engrave(GUNMAT.chrome(), 0.12, -0.037, 0.02, -0.06, -1),
        e.group
      );
    },
    hmg: () => {
      const e = GunBuilder(),
        t = GUNMAT.black(),
        o = GUNMAT.steel(),
        a = GUNMAT.blued(),
        n = GUNMAT.glow(16726862);
      (e.box(t, 0.088, 0.145, 0.56, 0, 0.02, -0.08),
        e.box(o, 0.092, 0.046, 0.3, 0, 0.104, -0.1),
        e.box(a, 0.086, 0.014, 0.26, 0, 0.13, -0.1),
        e.rail(o, 0.16, 0, 0.14, -0.14),
        e.barrel(o, 0.026, 0.5, 0, 0.02, -0.6),
        e.cyl(o, 0.042, 0.042, 0.38, 14, 0, 0.02, -0.56, Math.PI / 2, 0, 0));
      for (let t = 0; t < 7; t++) {
        const o = 0.055 * t - 0.72;
        (e.box(a, 0.09, 0.02, 0.024, 0, 0.02, o),
          e.box(a, 0.02, 0.09, 0.024, 0, 0.02, o));
      }
      (e.torus(a, 0.044, 0.007, 14, 0, 0.02, -0.74, 0, 0, 0),
        e.torus(a, 0.044, 0.007, 14, 0, 0.02, -0.38, 0, 0, 0),
        e.fluting(a, 0.028, 0.36, 0, 0.02, -0.56, 8),
        e.cyl(t, 0.052, 0.052, 0.1, 12, 0, 0.02, -0.84, Math.PI / 2, 0, 0));
      for (let t = 0; t < 4; t++)
        e.box(o, 0.058, 0.016, 0.012, 0, 0.05, -0.8 - 0.022 * t);
      for (let t = 0; t < 4; t++)
        e.box(o, 0.016, 0.058, 0.012, 0, 0.02, -0.8 - 0.022 * t);
      return (
        e.box(t, 0.13, 0.14, 0.17, 0, -0.09, 0),
        e.box(a, 0.134, 0.022, 0.17, 0, -0.022, 0),
        e.torus(n, 0.06, 0.008, 16, 0, -0.09, -0.088, 0, 0, 0),
        e.belt(8, -0.05, -0.008, -0.075, 0.014, "x"),
        e.box(a, 0.03, 0.09, 0.016, 0.068, -0.096, 0),
        e.grip(GUNMAT.polymer(), 0.054, 0.14, 0.082, 0, -0.082, 0.135, 0.24),
        e.gripPanel(
          GUNMAT.rubber(),
          0.057,
          0.116,
          0.078,
          0,
          -0.08,
          0.131,
          0.24,
          7,
        ),
        e.box(t, 0.044, 0.12, 0.09, 0, -0.07, -0.3, 0.1, 0, 0),
        e.gripPanel(
          GUNMAT.rubber(),
          0.047,
          0.1,
          0.08,
          0,
          -0.072,
          -0.302,
          0.1,
          6,
        ),
        e.box(t, 0.07, 0.11, 0.1, 0, 0.01, 0.265),
        e.buttPad(t, 0.072, 0.115, 0.028, 0, 0.008, 0.33),
        e.trigger(t, 0.03, 0, -0.024, 0.09, 0.1),
        e.box(t, 0.05, 0.026, 0.03, 0, 0, 0.14),
        e.ejPort(t, 0.048, 0.04, 0.1, 0.046, 0.008, -0.04, 1),
        e.chargeHandle(a, 0.048, 0.04, -0.2, 1),
        e.bipod(t, 0, -0.082, -0.5, 0.22, 0.4),
        e.gasSystem(t, 0, -0.028, -0.64, 0.14),
        e.engrave(GUNMAT.chrome(), 0.13, -0.045, 0.016, -0.04, -1),
        e.group
      );
    },
    marksman: () => {
      const e = GunBuilder(),
        t = GUNMAT.black(),
        o = GUNMAT.polymer(),
        a = GUNMAT.gunmetal(),
        n = GUNMAT.blued();
      (e.box(t, 0.058, 0.11, 0.48, 0, 0.018, -0.1),
        e.rail(n, 0.34, 0, 0.078, -0.16),
        e.box(o, 0.056, 0.056, 0.26, 0, 0.01, -0.4));
      for (let o = 0; o < 5; o++)
        e.box(t, 0.06, 0.008, 0.014, 0, -0.014, 0.042 * o - 0.48);
      return (
        e.mlok(n, 4, 0.22, 0, 0.01, -0.4, 0.054, 0.054),
        e.barrel(a, 0.017, 0.34, 0, 0.016, -0.56),
        e.fluting(n, 0.019, 0.3, 0, 0.016, -0.56, 6),
        e.brake(n, 0.034, 0.034, 0.07, 0, 0.016, -0.74, 3),
        e.gasSystem(t, 0, 0.04, -0.54, 0.1),
        e.scope(t, 0.042, 0.3, 0, 0.118, -0.2, 14737632),
        e.opticMount(t, 0.02, 0.052, 0.035, 0, 0.082, -0.31),
        e.opticMount(t, 0.02, 0.052, 0.035, 0, 0.082, -0.09),
        e.magCurved(t, 0.044, 0.195, 0.082, 0, -0.122, -0.03, 0.13, 5),
        e.magRelease(n, 0.026, -0.032, 0.02, 1),
        e.grip(o, 0.048, 0.126, 0.076, 0, -0.074, 0.072, 0.27),
        e.gripPanel(
          GUNMAT.rubber(),
          0.051,
          0.106,
          0.072,
          0,
          -0.072,
          0.068,
          0.27,
          6,
        ),
        e.box(o, 0.056, 0.095, 0.24, 0, -0.008, 0.245, 0.03, 0, 0),
        e.buttPad(t, 0.058, 0.1, 0.026, 0, -0.012, 0.375),
        e.cheek(o, 0.056, 0.042, 0.07, 0, 0.052, 0.175),
        e.trigger(t, 0.027, 0, -0.02, 0.026, 0.1),
        e.ejPort(t, 0.036, 0.032, 0.084, 0.031, 0.034, -0.04, 1),
        e.chargeHandle(n, -0.032, 0.048, -0.18, -1),
        e.selector(n, 0.03, -0.01, 0.058, 1),
        e.bipod(t, 0, -0.052, -0.46, 0.17, 0.4),
        e.qd(n, -0.03, -0.014, 0.12, 0),
        e.engrave(GUNMAT.chrome(), 0.1, -0.03, 0.016, -0.02, -1),
        e.group
      );
    },
    sniper: () => {
      const e = GunBuilder(),
        t = GUNMAT.black(),
        o = GUNMAT.steel(),
        a = GUNMAT.polymer(),
        n = GUNMAT.blued();
      (e.box(t, 0.06, 0.105, 0.44, 0, 0.014, -0.06),
        e.box(n, 0.064, 0.02, 0.4, 0, 0.062, -0.06),
        e.barrel(o, 0.022, 0.62, 0, 0.018, -0.58),
        e.barrel(o, 0.03, 0.3, 0, 0.018, -0.44),
        e.cyl(o, 0.034, 0.03, 0.04, 12, 0, 0.018, -0.29, Math.PI / 2, 0, 0),
        e.fluting(n, 0.024, 0.5, 0, 0.018, -0.58, 8),
        e.brake(n, 0.046, 0.046, 0.11, 0, 0.018, -0.92, 4),
        e.scope(t, 0.05, 0.4, 0, 0.128, -0.14, 14737632),
        e.opticMount(t, 0.024, 0.06, 0.038, 0, 0.086, -0.29),
        e.opticMount(t, 0.024, 0.06, 0.038, 0, 0.086, 0),
        e.cyl(t, 0.02, 0.02, 0.05, 10, 0.04, 0.128, -0.02, 0, 0, Math.PI / 2),
        e.cyl(t, 0.02, 0.02, 0.05, 10, 0, 0.168, -0.02, 0, 0, 0));
      for (let t = 0; t < 8; t++) {
        const o = (t / 8) * Math.PI * 2;
        e.box(
          n,
          0.004,
          0.004,
          0.05,
          0.04 + 0.021 * Math.cos(o),
          0.128 + 0.021 * Math.sin(o),
          -0.02,
          0,
          0,
          Math.PI / 2,
        );
      }
      return (
        e.box(t, 0.034, 0.03, 0.05, 0.046, 0.02, 0.06),
        e.cyl(o, 0.014, 0.014, 0.09, 8, 0.07, 0.02, 0.06, 0, 0, Math.PI / 2),
        e.cyl(o, 0.016, 0.016, 0.026, 10, 0.108, 0.02, 0.06, 0, 0, Math.PI / 2),
        e.cyl(o, 0.024, 0.024, 0.14, 10, 0.01, 0.02, 0.02, Math.PI / 2, 0, 0),
        e.magCurved(t, 0.044, 0.15, 0.085, 0, -0.1, -0.02, 0.08, 3),
        e.magRelease(n, 0.026, -0.024, 0.02, 1),
        e.grip(a, 0.05, 0.132, 0.078, 0, -0.076, 0.1, 0.26),
        e.gripPanel(
          GUNMAT.rubber(),
          0.053,
          0.11,
          0.074,
          0,
          -0.074,
          0.096,
          0.26,
          6,
        ),
        e.box(a, 0.058, 0.1, 0.28, 0, -0.006, 0.27, 0.03, 0, 0),
        e.box(n, 0.03, 0.048, 0.16, 0, 0.016, 0.25, 0.03, 0, 0),
        e.buttPad(t, 0.06, 0.106, 0.028, 0, -0.01, 0.42),
        e.cheek(a, 0.058, 0.048, 0.09, 0, 0.058, 0.2),
        e.box(t, 0.03, 0.04, 0.06, 0, -0.06, 0.35),
        e.cyl(n, 0.01, 0.01, 0.05, 8, 0, -0.09, 0.35, 0, 0, 0),
        e.trigger(t, 0.027, 0, -0.022, 0.054, 0.1),
        e.ejPort(t, 0.038, 0.032, 0.086, 0.032, 0.028, -0.02, 1),
        e.bipod(t, 0, -0.07, -0.52, 0.22, 0.38),
        e.box(t, 0.04, 0.016, 0.05, 0, -0.052, -0.5),
        e.qd(n, -0.032, -0.02, 0.15, 0),
        e.engrave(GUNMAT.chrome(), 0.11, -0.032, 0.014, -0.02, -1),
        e.group
      );
    },
  },
  VM = {
    root: new T.Group(),
    current: null,
    cache: {},
    glb: null,
    glbReady: !1,
    sway: { x: 0, y: 0 },
    bobT: 0,
    kick: 0,
    kickRot: 0,
    swapT: 0,
  };
function buildProcWeapon(e) {
  const t = GUN_BUILD[e];
  let o;
  if (t)
    try {
      o = t();
    } catch (e) {
      o = null;
    }
  if (!o) {
    o = new T.Group();
    const e = GunBuilder();
    (e.box(GUNMAT.gunmetal(), 0.06, 0.1, 0.4, 0, 0.01, -0.12),
      e.barrel(GUNMAT.black(), 0.016, 0.2, 0, 0.01, -0.4),
      e.grip(GUNMAT.polymer(), 0.046, 0.12, 0.072, 0, -0.07, 0.05, 0.27),
      (o = e.group));
  }
  return (
    o.scale.setScalar(0.62),
    o.traverse((e) => {
      e.isMesh && ((e.castShadow = !1), (e.receiveShadow = !1));
    }),
    o
  );
}
((VM.root.userData.keep = !0), scene.add(VM.root));
const RIFLE_GLB_URL = "";
function loadWeaponGLB(e) {
  e &&
    void 0 !== THREE.GLTFLoader &&
    new THREE.GLTFLoader().load(
      e,
      (e) => {
        const t = e.scene,
          o = new T.Box3().setFromObject(t).getSize(new T.Vector3()),
          a = Math.max(o.x, o.y, o.z) || 1;
        t.scale.setScalar(0.42 / a);
        const n = new T.Box3().setFromObject(t).getCenter(new T.Vector3());
        (t.position.sub(n),
          t.traverse((e) => {
            e.isMesh &&
              ((e.castShadow = !1),
              (e.receiveShadow = !1),
              (e.frustumCulled = !1),
              (e.renderOrder = 999),
              e.material && (e.material.side = T.FrontSide));
          }));
        const r = new T.Group();
        ((t.rotation.y = Math.PI / 2),
          r.add(t),
          (VM.glb = r),
          (VM.glbReady = !0),
          (VM.cache = {}),
          (VM.current = null),
          updateViewmodel(!0));
      },
      void 0,
      () => {
        VM.glbReady = !1;
      },
    );
}
function bakeDeep(e) {
  e.updateMatrixWorld(!0);
  const t = new T.Matrix4().copy(e.matrixWorld).invert(),
    o = new Map();
  e.traverse((e) => {
    if (
      !e.isMesh ||
      e.userData.live ||
      !e.geometry ||
      Array.isArray(e.material)
    )
      return;
    const t = e.material.uuid;
    let a = o.get(t);
    (a || ((a = []), o.set(t, a)), a.push(e));
  });
  const a = new T.Matrix4();
  for (const n of o.values()) {
    if (n.length < 2) continue;
    const o = [];
    let r = 0,
      s = !0;
    for (const e of n) {
      const n = e.geometry.index
        ? e.geometry.toNonIndexed()
        : e.geometry.clone();
      (a.multiplyMatrices(t, e.matrixWorld),
        n.applyMatrix4(a),
        n.attributes.normal || n.computeVertexNormals(),
        n.attributes.uv || (s = !1),
        o.push(n),
        (r += n.attributes.position.count),
        e.parent.remove(e));
    }
    const i = new Float32Array(3 * r),
      l = new Float32Array(3 * r),
      c = s ? new Float32Array(2 * r) : null;
    let d = 0;
    for (const e of o) {
      const t = e.attributes.position.count;
      (i.set(e.attributes.position.array, 3 * d),
        l.set(e.attributes.normal.array, 3 * d),
        c && c.set(e.attributes.uv.array, 2 * d),
        (d += t),
        e.dispose());
    }
    const h = new T.BufferGeometry();
    (h.setAttribute("position", new T.BufferAttribute(i, 3)),
      h.setAttribute("normal", new T.BufferAttribute(l, 3)),
      c && h.setAttribute("uv", new T.BufferAttribute(c, 2)),
      h.computeBoundingSphere(),
      e.add(new T.Mesh(h, n[0].material)));
  }
  return e;
}
function vmArm(e, t, o, a, n, r, s) {
  const i = new T.Vector3().subVectors(o, t),
    l = i.length();
  i.normalize();
  const c = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), i),
    d = new T.Mesh(new T.CylinderGeometry(0.06, 0.05, l, 14), a);
  (d.position.copy(t).addScaledVector(i, 0.5 * l + 0.03),
    d.quaternion.copy(c),
    e.add(d));
  const h = new T.Mesh(new T.CylinderGeometry(0.054, 0.054, 0.016, 16), r);
  (h.position.copy(t).addScaledVector(i, 0.075),
    h.quaternion.copy(c),
    e.add(h));
  const p = new T.Mesh(new T.CylinderGeometry(0.043, 0.047, 0.055, 12), n);
  (p.position.copy(t).addScaledVector(i, 0.045),
    p.quaternion.copy(c),
    e.add(p));
  const u = new T.Mesh(new T.SphereGeometry(0.043, 12, 9), n);
  (u.scale.set(0.95, 1.15, 1.25), u.position.copy(t), e.add(u));
  const m = new T.Mesh(new T.CapsuleGeometry(0.017, 0.05, 4, 8), n);
  ((m.rotation.z = Math.PI / 2),
    m.position.set(t.x + (s ? 0.018 : -0.018), t.y - 0.005, t.z - 0.03),
    e.add(m));
  const f = new T.Mesh(new T.CapsuleGeometry(0.012, 0.035, 4, 8), n);
  ((f.rotation.x = -1.1),
    f.position.set(t.x + (s ? -0.02 : 0.022), t.y + 0.03, t.z - 0.02),
    e.add(f));
  const y = new T.Mesh(new T.BoxGeometry(0.05, 0.016, 0.03), r);
  (y.position.set(t.x + (s ? 0.026 : -0.026), t.y + 0.012, t.z - 0.01),
    e.add(y));
}
function vmWithHands(e, t) {
  const o = new T.Group();
  o.add(e);
  const a = WEAPONS[t] || {},
    n = (player && player.agent) || null,
    r = new T.Color(n && n.color ? n.color : "#8aa0b8"),
    s = (e, t) => {
      const o = "vm|" + e;
      return (
        CH_MAT.has(o) ||
          CH_MAT.set(
            o,
            new T.MeshStandardMaterial(Object.assign({ color: e }, t)),
          ),
        CH_MAT.get(o)
      );
    },
    i = s("#" + r.clone().lerp(new T.Color(2830393), 0.66).getHexString(), {
      roughness: 0.9,
      metalness: 0,
    }),
    l = s("#262a31", { roughness: 0.5, metalness: 0.1 }),
    c = chGlow("#" + r.getHexString(), 0.7);
  e.updateMatrixWorld(!0);
  const anchors = e.userData.anchors;
  const d = new T.Box3().setFromObject(e),
    h = d.min,
    p = d.max,
    u = p.z - h.z,
    m = p.y - h.y;
  let f = 0,
    y = 0,
    M = 1 / 0;
  const w = new T.Vector3();
  e.traverse((e) => {
    if (!e.isMesh || !e.geometry || !e.geometry.attributes.position) return;
    const t = e.geometry.attributes.position;
    for (let o = 0; o < t.count; o += 2)
      (w.fromBufferAttribute(t, o).applyMatrix4(e.matrixWorld),
        w.y < h.y + 0.3 * m && w.z > (h.z + p.z) / 2 && ((f += w.z), y++),
        w.z > h.z + 0.22 * u && w.z < h.z + 0.42 * u && (M = Math.min(M, w.y)));
  });
  const g = (h.x + p.x) / 2,
    x = y ? f / y : p.z - 0.25 * u,
    b = new T.Vector3(
      g + 0.004,
      h.y + m * ("knife" === t ? 0.45 : 0.34),
      x + 0.006,
    );
  if (anchors?.right) b.fromArray(anchors.right).applyMatrix4(e.matrixWorld);
  vmArm(o, b, new T.Vector3(b.x + 0.1, b.y - 0.3, b.z + 0.44), i, l, c, !1);
  if (!["보조", "근접"].includes(a.cls)) {
    const e = new T.Vector3(
      g - 0.006,
      (isFinite(M) ? M : h.y + 0.45 * m) - 0.012,
      h.z + 0.33 * u,
    );
    if (anchors?.left) e.fromArray(anchors.left);
    vmArm(o, e, new T.Vector3(e.x - 0.22, e.y - 0.3, e.z + 0.4), i, l, c, !0);
  } else if ("knife" !== t) {
    const e = b.clone().add(new T.Vector3(-0.03, -0.018, -0.006));
    vmArm(o, e, new T.Vector3(e.x - 0.2, e.y - 0.3, e.z + 0.38), i, l, c, !0);
  }
  return (
    o.traverse((e) => {
      e.isMesh && ((e.castShadow = !1), (e.receiveShadow = !1));
    }),
    o
  );
}
function getVMFor(e) {
  const t = e + "|" + ((player && player.agent && player.agent.id) || "");
  if (VM.cache[t]) return VM.cache[t];
  if (String(e).startsWith("ultw:")) {
    const o = buildUltVM(e.slice(5));
    return (
      o.traverse((e) => {
        (e.isMesh || e.isSprite || e.isLine) &&
          ((e.renderOrder = 999), (e.frustumCulled = !1));
      }),
      (VM.cache[t] = o),
      o
    );
  }
  const o = WEAPONS[e];
  let a;
  if (VM.glbReady && o && ["소총", "기관총", "기관단총"].includes(o.cls)) {
    a = VM.glb.clone(!0);
    const e = "기관단총" === o.cls ? 0.86 : "기관총" === o.cls ? 1.12 : 1;
    a.scale.multiplyScalar(e);
  } else a = buildProcWeapon(e);
  try {
    a = vmWithHands(a, e);
  } catch (e) {
    console.warn("hands", e);
  }
  try {
    const e = a.position.clone(),
      t = a.rotation.clone();
    (a.position.set(0, 0, 0),
      a.rotation.set(0, 0, 0),
      bakeDeep(a),
      a.position.copy(e),
      a.rotation.copy(t));
  } catch (e) {
    console.warn("vm bake", e);
  }
  return (
    a.traverse((e) => {
      e.isMesh &&
        ((e.renderOrder = 999),
        (e.frustumCulled = !1),
        e.material && (e.material.depthTest = !0));
    }),
    (VM.cache[t] = a),
    a
  );
}
function updateViewmodel(e) {
  const t = player && player.ultW ? "ultw:" + player.ultW.kind : curWeaponKey(),
    o = (player && player.agent && player.agent.id) || "";
  if (
    !e &&
    VM.current &&
    VM.current.userData.key === t &&
    VM.current.userData.aid === o
  )
    return;
  VM.current && VM.root.remove(VM.current);
  const a = getVMFor(t);
  ((a.userData.key = t),
    (a.userData.aid = o),
    (VM.current = a),
    VM.root.add(a),
    (VM.swapT = 0.28));
}
const SCOPE_FOV = { sniper: 28, antimat: 18, marksman: 46, scout: 38 };
function isScoped() {
  if (player && player.ultW) return !1;
  const e = WEAPONS[curWeaponKey()];
  return player.ads && e && !!SCOPE_FOV[curWeaponKey()];
}
function tickViewmodel(e) {
  if (!player.alive) return void (VM.root.visible = !1);
  updateViewmodel(!1);
  const t = isScoped();
  VM.root.visible = !t;
  const o = document.getElementById("scope");
  if ((o && o.classList.toggle("on", t), t)) return;
  (VM.root.position.copy(camera.position),
    VM.root.quaternion.copy(camera.quaternion));
  const a = VM.current;
  if (!a) return;
  if (tickVmSpike(e)) return void (a.visible = !1);
  a.visible = !0;
  const n = player.ads && !player.ultW,
    r = n ? 0 : 0.3,
    s = n ? -0.075 : -0.24,
    i = n ? -0.72 : -0.66,
    l = Math.hypot(player.vel.x, player.vel.z);
  VM.bobT += e * (2.2 + 1.1 * l);
  const c = (n ? 0.1 : 1) * Math.min(l / 7, 1),
    d = 0.014 * Math.cos(VM.bobT) * c,
    h = 0.012 * Math.abs(Math.sin(VM.bobT)) * c;
  ((VM.sway.x +=
    (2.2 * (player.yaw - (VM.lastYaw ?? player.yaw)) - VM.sway.x) *
    Math.min(1, 9 * e)),
    (VM.sway.y +=
      (2.2 * (player.pitch - (VM.lastPitch ?? player.pitch)) - VM.sway.y) *
      Math.min(1, 9 * e)),
    (VM.lastYaw = player.yaw),
    (VM.lastPitch = player.pitch));
  const p = clamp(VM.sway.x, -0.06, 0.06) * (n ? 0.3 : 1),
    u = clamp(VM.sway.y, -0.06, 0.06) * (n ? 0.3 : 1);
  ((VM.kick = Math.max(0, VM.kick - 5.5 * e)),
    (VM.kickRot = Math.max(0, VM.kickRot - 6.5 * e)),
    (VM.swapT = Math.max(0, VM.swapT - 3.4 * e)));
  const m = 0.5 * VM.swapT;
  let f = 0,
    y = 0;
  if (player.reloading > 0 && "function" == typeof window.VM_RELOAD) {
    const e = window.VM_RELOAD();
    ((f = e[0]), (y = e[1]));
  } else if (player.reloading > 0) {
    curWeaponKey();
    const e = "sniper" === curWeaponKey() ? 2.6 : 1.9,
      t = 1 - player.reloading / e,
      o = Math.sin(Math.min(1, t) * Math.PI);
    ((f = 0.22 * o), (y = 0.6 * o));
  }
  const M = tickVmCast(e),
    w = player.ultW ? 1 : 0,
    T =
      clamp(-0.006 * (player.vy || 0), -0.035, 0.045) *
      (player.onGround ? 0 : 1),
    g = 0.6 * ((void 0 !== FPCAM && FPCAM.dip) || 0);
  (a.position.set(
    r + d + p,
    s + h + u - m - f - M - T - g,
    i + VM.kick * (w ? -0.09 : 0.07),
  ),
    a.rotation.set(
      VM.kickRot * (w ? 0.15 : 0.5) + y + 1.6 * u - 1.4 * M,
      -2.2 * p + (n ? 0 : 0.04) + (VM.kickSide || 0) * VM.kickRot * 0.07,
      1.1 * p + 0.4 * y + 0.6 * M,
    ),
    a.userData.anim && a.userData.anim(e, player.ultW));
}
const VM_KICK = {
  저격총: [1.6, 0.95],
  산탄총: [1.4, 0.8],
  보조: [0.85, 0.5],
  기관단총: [0.5, 0.24],
  소총: [0.8, 0.38],
  기관총: [0.6, 0.3],
  근접: [0.6, 0.2],
};
function viewmodelFireKick() {
  const e = WEAPONS[curWeaponKey()],
    t = (e && VM_KICK[e.cls]) || [1, 0.5];
  ((VM.kick = Math.min(1.8, Math.max(0.5 * VM.kick, t[0]))),
    (VM.kickRot = Math.min(1.2, Math.max(0.5 * VM.kickRot, t[1]))),
    (VM.kickSide = 2 * (Math.random() - 0.5)));
}
const _rnd = (e, t) => e + Math.random() * (t - e),
  GFX = {...GRAPHICS_SETTINGS.presets[SETTINGS.quality]},
  GFX_PRESETS = GRAPHICS_SETTINGS.presets,
  GFX_ORDER = GRAPHICS_SETTINGS.order,
  LAMP_LIT = { n: 0, max: 6 },
  DECOR = new T.Group();
((DECOR.userData.keep = !0), scene.add(DECOR));
const deco = (e) => (DECOR.add(e), e);
function mergeDecor() {
  if (!DECOR) return 0;
  const e = new Map(),
    t = [];
  DECOR.updateMatrixWorld(!0);
  const o = (e) => {
    for (const n of e.children.slice())
      if (
        !(n.isMesh && n.geometry && n.material) ||
        Array.isArray(n.material) ||
        (n.userData && n.userData.noMerge)
      )
        n.children && n.children.length
          ? (o(n), n.isMesh && t.push(n))
          : (n.isMesh || n.isLight) && t.push(n);
      else {
        const e = n.geometry.clone();
        e.applyMatrix4(n.matrixWorld);
        const t = ["position", "normal"];
        for (const o in e.attributes) t.indexOf(o) < 0 && e.deleteAttribute(o);
        if ((e.attributes.normal || e.computeVertexNormals(), e.index)) {
          const t = e.toNonIndexed();
          (e.dispose(), a(t, n));
        } else a(e, n);
      }
  };
  function a(t, o) {
    const a = o.material.uuid;
    let n = e.get(a);
    (n || ((n = { mat: o.material, geos: [], shadow: !1 }), e.set(a, n)),
      n.geos.push(t),
      o.castShadow && (n.shadow = !0));
  }
  if ((o(DECOR), !e.size)) return 0;
  const n = new T.Group();
  n.userData.merged = !0;
  let r = 0,
    s = 0;
  for (const [, t] of e) {
    r += t.geos.length;
    let e = 0;
    for (const o of t.geos) e += o.attributes.position.count;
    const o = new Float32Array(3 * e),
      a = new Float32Array(3 * e);
    let i = 0;
    for (const e of t.geos) {
      const t = e.attributes.position.array,
        n = e.attributes.normal.array;
      (o.set(t, 3 * i),
        a.set(n, 3 * i),
        (i += e.attributes.position.count),
        e.dispose());
    }
    const l = new T.BufferGeometry();
    (l.setAttribute("position", new T.BufferAttribute(o, 3)),
      l.setAttribute("normal", new T.BufferAttribute(a, 3)),
      l.computeBoundingSphere());
    const c = new T.Mesh(l, t.mat),
      d = void 0 !== GFX && !!GFX.decorShadow;
    ((c.castShadow = t.shadow && d),
      (c.receiveShadow = !0),
      (c.matrixAutoUpdate = !1),
      n.add(c),
      s++);
  }
  const i = [];
  for (const e of t)
    (e.isLight || (e.isMesh && !e.children.length)) &&
      i.push({ light: e, wp: e.matrixWorld.clone() });
  for (let e = DECOR.children.length - 1; e >= 0; e--)
    DECOR.remove(DECOR.children[e]);
  for (const { light: e, wp: t } of i)
    (DECOR.add(e), t.decompose(e.position, e.quaternion, e.scale));
  return (DECOR.add(n), r - s);
}
function pillar(e, t, o) {
  const a = new T.Group(),
    n = new T.Mesh(new T.CylinderGeometry(0.62, 0.72, 0.3, 10), MAT.panel);
  ((n.position.y = 0.15), (n.castShadow = !0), a.add(n));
  const r = new T.Mesh(new T.CylinderGeometry(0.46, 0.52, o, 12), MAT.beamRed);
  ((r.position.y = o / 2 + 0.3), (r.castShadow = !0), a.add(r));
  const s = new T.Mesh(new T.BoxGeometry(1.5, 0.28, 1.5), MAT.wood);
  ((s.position.y = o + 0.32), (s.castShadow = !0), a.add(s));
  const i = new T.Mesh(new T.BoxGeometry(1.05, 0.22, 1.05), MAT.beamRed);
  return (
    (i.position.y = o + 0.14),
    a.add(i),
    [0.28 * o, 0.72 * o].forEach((e) => {
      const t = new T.Mesh(
        new T.CylinderGeometry(0.535, 0.535, 0.16, 12),
        MAT.jade,
      );
      ((t.position.y = e + 0.3), a.add(t));
    }),
    a.position.set(e, 0, t),
    deco(a)
  );
}
function eave(e, t, o, a, n) {
  const r = new T.Group(),
    s = new T.Mesh(new T.BoxGeometry(o, 0.34, 0.34), MAT.wood);
  (s.position.set(0, n, -a / 2), r.add(s));
  const i = s.clone();
  ((i.position.z = a / 2), r.add(i));
  const l = new T.BoxGeometry(o + 1.6, 0.22, 0.62 * a),
    c = new T.Mesh(l, MAT.tile);
  (c.position.set(0, n + 0.5, 0.28 * -a),
    (c.rotation.x = -0.26),
    (c.castShadow = !0),
    r.add(c));
  const d = new T.Mesh(l, MAT.tile);
  (d.position.set(0, n + 0.5, 0.28 * a),
    (d.rotation.x = 0.26),
    (d.castShadow = !0),
    r.add(d));
  const h = new T.Mesh(new T.BoxGeometry(o + 1.8, 0.2, 0.26), MAT.panel);
  (h.position.set(0, n + 0.66, 0), r.add(h));
  for (let e = 0; e < Math.floor(o / 1.1); e++) {
    const t = new T.Mesh(new T.BoxGeometry(0.12, 0.12, a + 0.5), MAT.wood);
    (t.position.set(-o / 2 + 0.55 + 1.1 * e, n + 0.3, 0), r.add(t));
  }
  return (r.position.set(e, 0, t), deco(r));
}
function lantern(e, t, o) {
  const a = new T.Group(),
    n = new T.Mesh(new T.CylinderGeometry(0.34, 0.44, 0.34, 8), MAT.panel);
  ((n.position.y = 0.17), a.add(n));
  const r = new T.Mesh(new T.CylinderGeometry(0.14, 0.16, 0.9, 8), MAT.panel);
  ((r.position.y = 0.78), a.add(r));
  const s = new T.Mesh(
    new T.BoxGeometry(0.56, 0.52, 0.56),
    new T.MeshStandardMaterial({
      color: o || 16763528,
      emissive: o || 16758881,
      emissiveIntensity: 1.3,
      transparent: !0,
      opacity: 0.92,
    }),
  );
  ((s.position.y = 1.48), a.add(s));
  const i = new T.Mesh(new T.ConeGeometry(0.58, 0.36, 4), MAT.tile);
  ((i.position.y = 1.92), (i.rotation.y = Math.PI / 4), a.add(i));
  const l = new T.Mesh(new T.SphereGeometry(0.09, 8, 6), MAT.panel);
  ((l.position.y = 2.14), a.add(l));
  const c = new T.Mesh(
    new T.SphereGeometry(0.16, 8, 6),
    new T.MeshBasicMaterial({ color: o || 16758881 }),
  );
  if (
    ((c.position.y = 1.5),
    (c.userData.noMerge = !0),
    a.add(c),
    LAMP_LIT.n < (void 0 !== GFX ? GFX.lamps : LAMP_LIT.max))
  ) {
    LAMP_LIT.n++;
    const e = new T.PointLight(o || 16758881, 9, 16, 2);
    ((e.position.y = 1.5), a.add(e));
  }
  return (a.position.set(e, 0, t), deco(a));
}
function pond(e, t, o) {
  const a = new T.Group(),
    n = new T.Mesh(new T.TorusGeometry(o, 0.34, 8, 32), MAT.panel);
  ((n.rotation.x = -Math.PI / 2), (n.position.y = 0.14), a.add(n));
  const r = new T.Mesh(new T.CircleGeometry(o, 36), MAT.water);
  ((r.rotation.x = -Math.PI / 2), (r.position.y = 0.1), a.add(r));
  for (let e = 0; e < 9; e++) {
    const e = 7 * Math.random(),
      t = Math.random() * (o - 1.2),
      n = new T.Mesh(
        new T.CircleGeometry(0.42 + 0.3 * Math.random(), 10),
        MAT.moss,
      );
    ((n.rotation.x = -Math.PI / 2),
      n.position.set(Math.cos(e) * t, 0.14, Math.sin(e) * t),
      a.add(n));
  }
  return (a.position.set(e, 0, t), deco(a));
}
function gate(e, t, o, a) {
  const n = new T.Group();
  [-o / 2, o / 2].forEach((e) => {
    const t = new T.Mesh(
      new T.CylinderGeometry(0.24, 0.28, 5.2, 8),
      MAT.beamRed,
    );
    (t.position.set(e, 2.6, 0), (t.castShadow = !0), n.add(t));
  });
  const r = new T.Mesh(new T.BoxGeometry(o + 1.2, 0.3, 0.42), MAT.wood);
  ((r.position.y = 5), (r.castShadow = !0), n.add(r));
  const s = new T.Mesh(new T.BoxGeometry(o + 0.7, 0.22, 0.32), MAT.beamRed);
  ((s.position.y = 4.64), n.add(s));
  const i = new T.Mesh(new T.BoxGeometry(1.5, 0.52, 0.1), MAT.paper);
  return (
    i.position.set(0, 4.28, 0.22),
    n.add(i),
    n.position.set(e, 0, t),
    (n.rotation.y = a || 0),
    deco(n)
  );
}
function bamboo(e, t, o) {
  const a = new T.Group();
  for (let e = 0; e < (o || 5); e++) {
    const e = 4.5 + 3 * Math.random(),
      t = new T.Mesh(
        new T.CylinderGeometry(0.09, 0.11, e, 6),
        new T.MeshStandardMaterial({ color: 6061375, roughness: 0.8 }),
      );
    (t.position.set(_rnd(-1.4, 1.4), e / 2, _rnd(-1.4, 1.4)),
      (t.rotation.z = _rnd(-0.06, 0.06)),
      (t.castShadow = !0),
      a.add(t));
    for (let o = 1; o < 4; o++) {
      const n = new T.Mesh(
        new T.TorusGeometry(0.1, 0.022, 6, 8),
        new T.MeshStandardMaterial({ color: 4481070 }),
      );
      (n.position.set(t.position.x, o * (e / 4), t.position.z),
        (n.rotation.x = Math.PI / 2),
        a.add(n));
    }
  }
  return (a.position.set(e, 0, t), deco(a));
}
function crate(e, t, o) {
  const a = new T.Group(),
    n = new T.Mesh(new T.BoxGeometry(o, 0.85 * o, o), MAT.wood);
  ((n.position.y = 0.42 * o),
    (n.castShadow = !0),
    (n.receiveShadow = !0),
    a.add(n));
  const r = new T.Mesh(new T.BoxGeometry(o + 0.04, 0.1, o + 0.04), MAT.panel);
  return (
    (r.position.y = 0.42 * o),
    a.add(r),
    a.position.set(e, 0, t),
    deco(a)
  );
}
function siteMarker(e) {
  new T.Group();
  const t = document.createElement("canvas");
  t.width = t.height = 256;
  const o = t.getContext("2d");
  ((o.fillStyle = "rgba(0,0,0,0)"),
    o.fillRect(0, 0, 256, 256),
    (o.strokeStyle = "#ff3b4e"),
    (o.lineWidth = 10),
    o.strokeRect(18, 18, 220, 220),
    (o.fillStyle = "#ff3b4e"),
    (o.font = "bold 150px Orbitron, sans-serif"),
    (o.textAlign = "center"),
    (o.textBaseline = "middle"),
    o.fillText(e.id, 128, 138));
  const a = new T.CanvasTexture(t),
    n = new T.Mesh(
      new T.PlaneGeometry(6, 6),
      new T.MeshBasicMaterial({ map: a, transparent: !0, opacity: 0.55 }),
    );
  return (
    (n.rotation.x = -Math.PI / 2),
    n.position.set(e.x, 0.09, e.z),
    deco(n)
  );
}
function skyDome() {
  const e = curMood(),
    t = document.createElement("canvas");
  ((t.width = 8), (t.height = 256));
  const o = t.getContext("2d"),
    a = o.createLinearGradient(0, 0, 0, 256),
    n = "#" + e.fog.toString(16).padStart(6, "0");
  (a.addColorStop(0, e.top),
    a.addColorStop(0.36, e.mid),
    a.addColorStop(0.47, e.hor),
    a.addColorStop(0.53, n),
    a.addColorStop(1, n),
    (o.fillStyle = a),
    o.fillRect(0, 0, 8, 256));
  const r = new THREE.CanvasTexture(t);
  r.colorSpace = THREE.SRGBColorSpace;
  const s = MAP.bounds || { minX: -100, maxX: 100, minZ: -100, maxZ: 100 },
    i = Math.max(s.maxX - s.minX, s.maxZ - s.minZ) / 2,
    l = Math.max(240, 1.9 * i),
    c = new THREE.Mesh(
      new THREE.SphereGeometry(l, 24, 16),
      new THREE.MeshBasicMaterial({
        map: r,
        side: THREE.BackSide,
        fog: !1,
        depthWrite: !1,
      }),
    );
  if (((c.position.y = -10), scene.add(c), e.glow)) {
    const t = document.createElement("canvas");
    t.width = t.height = 128;
    const o = t.getContext("2d"),
      a = o.createRadialGradient(64, 64, 0, 64, 64, 64);
    (a.addColorStop(0, "rgba(255,255,255,1)"),
      a.addColorStop(0.12, e.glow),
      a.addColorStop(0.3, "rgba(255,240,210,.35)"),
      a.addColorStop(1, "rgba(255,240,210,0)"),
      (o.fillStyle = a),
      o.fillRect(0, 0, 128, 128));
    const n = new THREE.CanvasTexture(t);
    n.colorSpace = THREE.SRGBColorSpace;
    const r = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: n,
        color: 16777215,
        fog: !1,
        depthWrite: !1,
        transparent: !0,
        blending: THREE.AdditiveBlending,
      }),
    );
    r.material.color.multiplyScalar(2.2);
    const s = new THREE.Vector3(_SUN_OFF.x, 0.42 * _SUN_OFF.y, _SUN_OFF.z)
      .normalize()
      .multiplyScalar(0.92 * l);
    (r.position.copy(s), r.scale.setScalar(0.22 * l), scene.add(r));
  }
  if (e.stars) {
    const e = 700,
      t = new Float32Array(3 * e);
    for (let o = 0; o < e; o++) {
      const e = Math.random() * Math.PI * 2,
        a = Math.acos(0.92 * Math.random());
      ((t[3 * o] = Math.sin(a) * Math.cos(e) * l * 0.95),
        (t[3 * o + 1] = Math.cos(a) * l * 0.95 - 10),
        (t[3 * o + 2] = Math.sin(a) * Math.sin(e) * l * 0.95));
    }
    const o = new THREE.BufferGeometry();
    o.setAttribute("position", new THREE.BufferAttribute(t, 3));
    const a = new THREE.Points(
      o,
      new THREE.PointsMaterial({
        color: 13621503,
        size: 1.4,
        sizeAttenuation: !1,
        fog: !1,
        depthWrite: !1,
      }),
    );
    scene.add(a);
  }
  const d = new THREE.Color(e.fog)
    .lerp(new THREE.Color(e.top), 0.35)
    .multiplyScalar(0.62);
  for (let e = 0; e < 26; e++) {
    const t = (e / 26) * Math.PI * 2,
      o = 14 + 26 * Math.random(),
      a = 0.79 * l,
      n = new THREE.Mesh(
        new THREE.ConeGeometry(18 + 22 * Math.random(), o, 4),
        new THREE.MeshBasicMaterial({ color: d, fog: !1 }),
      );
    (n.position.set(Math.cos(t) * a, o / 2 - 6, Math.sin(t) * a),
      (n.rotation.y = 3 * Math.random()),
      scene.add(n));
  }
}
const STRUCT = [];
function sBox(e, t, o, a, n, r) {
  const s = addBox(e, t, o, a, n, r);
  return (STRUCT.push(s), s);
}
function stairs(e, t, o, a, n, r) {
  const s = r || Math.max(2, Math.round(a / 0.55)),
    i = 1.5;
  for (let r = 0; r < s; r++) {
    const l = (a * (r + 1)) / s,
      c = (r - (s - 1) / 2) * i;
    "N" === n
      ? sBox(e, t - c, o, i, l, MAT.panel)
      : "S" === n
        ? sBox(e, t + c, o, i, l, MAT.panel)
        : sBox("E" === n ? e + c : e - c, t, i, o, l, MAT.panel);
  }
}
function platform(e, t, o, a, n, r) {
  sBox(e, t, o, a, n, MAT.wood);
  const s = o / 2 - 0.6,
    i = a / 2 - 0.6;
  [
    [-s, -i],
    [s, -i],
    [-s, i],
    [s, i],
  ].forEach(([o, a]) => {
    const r = new T.Mesh(new T.CylinderGeometry(0.26, 0.3, n, 8), MAT.beamRed);
    (r.position.set(e + o, n / 2, t + a), (r.castShadow = !0), DECOR.add(r));
  });
  const l = (e, t, o, a) => {
    const r = new T.Mesh(new T.BoxGeometry(o, 0.12, a), MAT.beamRed);
    (r.position.set(e, n + 1, t), DECOR.add(r));
    const s = new T.Mesh(new T.BoxGeometry(o, 0.1, a), MAT.wood);
    (s.position.set(e, n + 0.52, t), DECOR.add(s));
    const i = Math.max(2, Math.round((o > a ? o : a) / 1.6));
    for (let r = 0; r < i; r++) {
      const s = r / (i - 1) - 0.5,
        l = new T.Mesh(new T.BoxGeometry(0.13, 1.05, 0.13), MAT.beamRed);
      (l.position.set(
        e + (o > a ? s * o : 0),
        n + 0.52,
        t + (o > a ? 0 : s * a),
      ),
        DECOR.add(l));
    }
  };
  (r || "").split("").forEach((n) => {
    ("N" === n && l(e, t - a / 2 + 0.1, o, 0.16),
      "S" === n && l(e, t + a / 2 - 0.1, o, 0.16),
      "W" === n && l(e - o / 2 + 0.1, t, 0.16, a),
      "E" === n && l(e + o / 2 - 0.1, t, 0.16, a));
  });
}
function crateStack(e, t, o) {
  if ((sBox(e, t, 2.2, 2.2, 1.2, MAT.wood), o)) {
    sBox(e + 1, t + 0.6, 1.6, 1.6, 2.1, MAT.wood);
    const o = new T.Mesh(new T.BoxGeometry(1.66, 0.1, 1.66), MAT.panel);
    (o.position.set(e + 1, 2.12, t + 0.6), DECOR.add(o));
  }
  const a = new T.Mesh(new T.BoxGeometry(2.26, 0.12, 2.26), MAT.panel);
  (a.position.set(e, 0.72, t), DECOR.add(a));
}
function sandbags(e, t, o, a) {
  const n = new T.Group(),
    r = Math.max(2, Math.round(o / 1.1));
  for (let e = 0; e < 2; e++)
    for (let t = 0; t < r - e; t++) {
      const o = new T.Mesh(
        new T.CapsuleGeometry(0.3, 0.62, 4, 8),
        mat1(
          "bag" + e,
          () =>
            new T.MeshStandardMaterial({
              color: e ? 7168848 : 8023897,
              roughness: 0.95,
            }),
        ),
      );
      ((o.rotation.z = Math.PI / 2),
        o.position.set(
          1.06 * (t - (r - e - 1) / 2) + (e ? 0.5 : 0),
          0.3 + 0.52 * e,
          0,
        ),
        (o.castShadow = !0),
        n.add(o));
    }
  (n.position.set(e, 0, t), (n.rotation.y = a || 0), DECOR.add(n));
  (Math.abs(Math.sin(a || 0)) > 0.5
    ? sBox(e, t, 1.2, o, 1.05, MAT.panel)
    : sBox(e, t, o, 1.2, 1.05, MAT.panel)
  ).mesh.visible = !1;
}
function mast(e, t, o) {
  const a = new T.Group(),
    n = TH(),
    r = new T.Mesh(new T.CylinderGeometry(0.18, 0.26, o, 8), n.strut);
  ((r.position.y = o / 2), (r.castShadow = !0), a.add(r));
  for (let e = 1; e <= 3; e++) {
    const t = new T.Mesh(new T.BoxGeometry(3.2 - 0.5 * e, 0.1, 0.1), n.strut);
    ((t.position.y = o * (0.45 + 0.16 * e)),
      (t.rotation.y = 1.1 * e),
      a.add(t));
  }
  const s = new T.Mesh(
    new T.SphereGeometry(0.9, 12, 8, 0, 6.3, 0, 1.1),
    n.trim,
  );
  ((s.position.y = o - 0.4), (s.rotation.x = -0.7), a.add(s));
  const i = new T.Mesh(
    new T.SphereGeometry(0.2, 8, 6),
    new T.MeshBasicMaterial({ color: n.glow }),
  );
  return (
    (i.position.y = o + 0.2),
    (i.userData.noMerge = !0),
    a.add(i),
    a.position.set(e, 0, t),
    deco(a)
  );
}
function pine(e, t, o) {
  const a = new T.Group(),
    n = new T.Mesh(
      new T.CylinderGeometry(0.16, 0.26, 0.4 * o, 6),
      mat1(
        "pineTrunk",
        () => new T.MeshStandardMaterial({ color: 4865072, roughness: 0.95 }),
      ),
    );
  ((n.position.y = 0.2 * o), a.add(n));
  const r = mat1(
    "pineSnow",
    () => new T.MeshStandardMaterial({ color: 14674418, roughness: 0.8 }),
  );
  for (let e = 0; e < 3; e++) {
    const t = new T.Mesh(new T.ConeGeometry(1.5 - 0.36 * e, 0.34 * o, 7), r);
    ((t.position.y = o * (0.38 + 0.22 * e)), (t.castShadow = !0), a.add(t));
  }
  return (a.position.set(e, 0, t), deco(a));
}
function obelisk(e, t, o) {
  const a = new T.Group(),
    n = TH(),
    r = new T.Mesh(new T.BoxGeometry(1.9, 0.5, 1.9), n.wall);
  ((r.position.y = 0.25), a.add(r));
  const s = new T.Mesh(new T.CylinderGeometry(0.58, 0.72, o, 8), n.wall);
  ((s.position.y = o / 2 + 0.4), (s.castShadow = !0), a.add(s));
  for (let e = 0; e < 3; e++) {
    const t = new T.Mesh(new T.TorusGeometry(0.62, 0.07, 6, 12), n.trim);
    ((t.rotation.x = Math.PI / 2),
      (t.position.y = o * (0.25 + 0.25 * e)),
      a.add(t));
  }
  const i = new T.Mesh(new T.ConeGeometry(0.82, 1, 4), n.trim);
  return (
    (i.position.y = o + 0.9),
    (i.rotation.y = Math.PI / 4),
    a.add(i),
    a.position.set(e, 0, t),
    deco(a)
  );
}
function palm(e, t, o) {
  const a = new T.Group(),
    n = new T.Mesh(
      new T.CylinderGeometry(0.2, 0.32, o, 7),
      mat1(
        "palmTrunk",
        () => new T.MeshStandardMaterial({ color: 8020546, roughness: 0.92 }),
      ),
    );
  ((n.position.y = o / 2), (n.rotation.z = 0.07), a.add(n));
  const r = mat1(
    "palmLeaf",
    () =>
      new T.MeshStandardMaterial({
        color: 5143096,
        roughness: 0.85,
        side: T.DoubleSide,
      }),
  );
  for (let e = 0; e < 7; e++) {
    const t = new T.Mesh(new T.PlaneGeometry(3.4, 0.95), r);
    ((t.position.y = o),
      (t.rotation.y = 0.9 * e),
      (t.rotation.z = -0.5),
      (t.position.x = 1.5 * Math.cos(0.9 * e)),
      (t.position.z = 1.5 * Math.sin(0.9 * e)),
      a.add(t));
  }
  return (a.position.set(e, 0, t), deco(a));
}
const _MC = {};
function mat1(e, t) {
  return _MC[e] || (_MC[e] = t());
}
const CONTAINER_COLORS = [
    3107706, 11027244, 4156218, 11569708, 5521515, 9058898,
  ],
  CONTAINER_MATS = [];
let RIB_MAT = null;
function containerMat(e) {
  const t = e % CONTAINER_COLORS.length;
  return (
    CONTAINER_MATS[t] ||
      (CONTAINER_MATS[t] = new T.MeshStandardMaterial({
        color: CONTAINER_COLORS[t],
        roughness: 0.74,
        metalness: 0.42,
      })),
    CONTAINER_MATS[t]
  );
}
function container(e, t, o, a) {
  const n = new T.Group();
  RIB_MAT ||
    (RIB_MAT = new T.MeshStandardMaterial({
      color: 0,
      transparent: !0,
      opacity: 0.16,
    }));
  const r = (e, t, o, a, r) => {
    const s = new T.Mesh(new T.BoxGeometry(t, a, o), containerMat(r));
    ((s.position.y = e + a / 2), (s.castShadow = !0), n.add(s));
    for (let r = -2; r <= 2; r++) {
      const s = new T.Mesh(new T.BoxGeometry(0.1, 0.9 * a, 1.01 * o), RIB_MAT);
      (s.position.set(r * (t / 5.5), e + a / 2, 0), n.add(s));
    }
  };
  return (
    r(0, 6, 2.4, 2.6, Math.floor(Math.abs(e + t)) % 6),
    a && r(2.6, 6, 2.4, 2.6, Math.floor(Math.abs(2 * e + t)) % 6),
    n.position.set(e, 0, t),
    (n.rotation.y = o || 0),
    deco(n)
  );
}
function crane(e, t, o) {
  const a = new T.Group(),
    n = TH();
  [
    [-1.6, -1.6],
    [1.6, -1.6],
    [-1.6, 1.6],
    [1.6, 1.6],
  ].forEach(([e, t]) => {
    const r = new T.Mesh(new T.CylinderGeometry(0.16, 0.2, o, 6), n.strut);
    (r.position.set(e, o / 2, t), a.add(r));
  });
  const r = new T.Mesh(new T.BoxGeometry(16, 0.5, 0.7), n.strut);
  ((r.position.y = o), a.add(r));
  const s = new T.Mesh(new T.BoxGeometry(2.2, 1.6, 2), n.trim);
  (s.position.set(0, o - 1, 0), a.add(s));
  const i = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 4, 6), n.strut);
  return (
    i.position.set(6, o - 2.2, 0),
    a.add(i),
    a.position.set(e, 0, t),
    deco(a)
  );
}
const NEON_WORDS = ["夜", "電", "龍", "雨", "星", "刃", "焰", "影"];
function neonSign(e, t, o, a) {
  const n = new T.Group(),
    r = [16723320, 3006719, 11561983, 16765501][Math.floor(4 * Math.random())],
    s = document.createElement("canvas");
  ((s.width = 128), (s.height = 256));
  const i = s.getContext("2d");
  ((i.fillStyle = "#07090f"),
    i.fillRect(0, 0, 128, 256),
    (i.font = "bold 84px serif"),
    (i.textAlign = "center"),
    (i.textBaseline = "middle"),
    (i.fillStyle = "#" + r.toString(16).padStart(6, "0")),
    (i.shadowColor = i.fillStyle),
    (i.shadowBlur = 26));
  for (let e = 0; e < 3; e++)
    i.fillText(NEON_WORDS[Math.floor(8 * Math.random())], 64, 52 + 76 * e);
  const l = new T.CanvasTexture(s),
    c = new T.Mesh(
      new T.PlaneGeometry(2.2, 4.4),
      new T.MeshBasicMaterial({ map: l }),
    );
  ((c.userData.noMerge = !0), n.add(c));
  const d = new T.Mesh(new T.BoxGeometry(0.14, 4.6, 0.14), TH().strut);
  if (
    ((d.position.x = -1.2),
    n.add(d),
    LAMP_LIT.n < (void 0 !== GFX ? GFX.lamps : LAMP_LIT.max))
  ) {
    LAMP_LIT.n++;
    const e = new T.PointLight(r, 12, 18, 2);
    ((e.position.z = 1.4), n.add(e));
  }
  return (n.position.set(e, o || 5, t), (n.rotation.y = a || 0), deco(n));
}
function acUnit(e, t) {
  const o = new T.Group(),
    a = TH(),
    n = new T.Mesh(new T.BoxGeometry(2.6, 1.5, 2.2), a.crate);
  ((n.position.y = 0.75), (n.castShadow = !0), o.add(n));
  const r = new T.Mesh(new T.CylinderGeometry(0.75, 0.75, 0.14, 12), a.strut);
  ((r.position.y = 1.54), o.add(r));
  for (let e = 0; e < 4; e++) {
    const t = new T.Mesh(new T.BoxGeometry(1.3, 0.05, 0.22), a.strut);
    ((t.position.y = 1.6), (t.rotation.y = 0.8 * e), o.add(t));
  }
  return (o.position.set(e, 0, t), deco(o));
}
function themeLight(e, t, o) {
  const a = new T.Group(),
    n = TH(),
    r = o || n.glow,
    s = new T.Mesh(new T.CylinderGeometry(0.13, 0.17, 3, 8), n.strut);
  ((s.position.y = 1.5), a.add(s));
  const i = new T.Mesh(
    new T.BoxGeometry(0.5, 0.34, 0.5),
    new T.MeshStandardMaterial({
      color: r,
      emissive: r,
      emissiveIntensity: 1.4,
    }),
  );
  ((i.position.y = 3.1), a.add(i));
  const l = new T.Mesh(
    new T.SphereGeometry(0.15, 8, 6),
    new T.MeshBasicMaterial({ color: r }),
  );
  if (
    ((l.position.y = 3.1),
    (l.userData.noMerge = !0),
    a.add(l),
    LAMP_LIT.n < (void 0 !== GFX ? GFX.lamps : LAMP_LIT.max))
  ) {
    LAMP_LIT.n++;
    const e = new T.PointLight(r, 11, 16, 2);
    ((e.position.y = 3), a.add(e));
  }
  return (a.position.set(e, 0, t), deco(a));
}
function buildStructures() {
  const e = MAP.theme || CUR_MAP_KEY || "glacier";
  {
    const t = {
      glacier: buildGlacier,
      dunes: buildDunes,
      freighter: buildFreighter,
      neon: buildNeon,
      garden: buildGarden,
      market: buildMarket,
      temple: buildTemple,
      harbor: buildHarbor,
      forge: buildForge,
      jungle: buildJungle,
    }[e];
    t && t();
  }
}
function buildGlacier() {
  (platform(124.8, -75.4, 14, 16, 3.4, "WN"),
    stairs(113.3, -75.4, 10, 3.4, "E", 6),
    platform(85.8, -52, 11, 11, 1.8, ""),
    stairs(78.1, -48.5, 8, 1.8, "E", 3),
    crateStack(80.6, -85.8, !0),
    crateStack(114.4, -44.2, !1),
    sandbags(91, -46.8, 9, 0),
    sandbags(119.6, -88.4, 8, Math.PI / 2),
    platform(130, 72.8, 15, 18, 2.8, "WS"),
    stairs(124.5, 60.1, 10, 2.8, "S", 5),
    platform(93.6, 44.2, 11, 11, 1.8, ""),
    stairs(101.4, 47.7, 8, 1.8, "W", 3),
    crateStack(109.2, 49.4, !1),
    crateStack(80.6, 85.8, !0),
    sandbags(78, 59.8, 10, Math.PI / 2),
    platform(5.2, 0, 15, 15, 2, ""),
    void 0,
    void 0,
    sandbags(-18.2, 0, 7, Math.PI / 2),
    sandbags(28.6, 0, 7, Math.PI / 2),
    platform(-109.2, -72.8, 13, 13, 2.6, "ES"),
    stairs(-109.2, -83, 9, 2.6, "S", 5),
    crateStack(-85.8, -88.4, !0),
    sandbags(-98.8, -41.6, 8, 0),
    crateStack(-44.2, -62.4, !1),
    crateStack(-75.4, -33.8, !0),
    sandbags(-78, -23.4, 8, 0),
    sandbags(-26, -70.2, 7, Math.PI / 2),
    crateStack(-59.8, 46.8, !1),
    crateStack(-15.6, 85.8, !1),
    sandbags(-28.6, 26, 6, Math.PI / 2),
    sandbags(2.6, 54.6, 7, 0),
    sandbags(-57.2, 75.4, 7, 0),
    crateStack(44.2, -57.2, !1),
    crateStack(44.2, 57.2, !1),
    crateStack(-130, -33.8, !1),
    crateStack(-130, 33.8, !1),
    crateStack(145.6, -26, !1),
    crateStack(145.6, 26, !1));
}
function buildDunes() {
  (platform(-83.2, -96.2, 18, 12, 3, "N"),
    stairs(-95.9, -92.2, 9, 3, "E", 5),
    platform(-104, -59.8, 10, 10, 1.6, ""),
    crateStack(-101.4, -70.2, !0),
    sandbags(-62.4, -85.8, 8, Math.PI / 2),
    sandbags(-91, -52, 8, 0),
    platform(83.2, -93.6, 15, 11, 2.6, "N"),
    stairs(83.2, -84.4, 8, 2.6, "N", 5),
    platform(67.6, -65, 8, 8, 1.4, ""),
    platform(101.4, -62.4, 8, 8, 1.4, ""),
    crateStack(91, -88.4, !1),
    sandbags(59.8, -80.6, 7, Math.PI / 2),
    platform(-23.4, -26, 7, 22, 1.2, ""),
    platform(23.4, -26, 7, 22, 1.2, ""),
    sandbags(0, -46.8, 10, 0),
    crateStack(-20.8, -44.2, !1),
    crateStack(20.8, -44.2, !1),
    void 0,
    platform(0, 65, 12, 10, 2.8, "S"),
    void 0,
    platform(0, 26, 11, 9, 1.6, ""),
    stairs(-84.6, 56, 9, 2.4, "W", 4),
    platform(-93.6, 52, 12, 12, 2.4, "E"),
    void 0,
    stairs(91.6, 37.3, 10, 2.2, "S", 4),
    platform(93.6, 46.8, 13, 13, 2.2, "W"),
    void 0,
    crateStack(-106.6, 78, !1),
    crateStack(78, 85.8, !1),
    crateStack(-85.8, 31.2, !0),
    crateStack(85.8, 28.6, !0),
    crateStack(-52, -57.2, !1),
    crateStack(52, -57.2, !1),
    sandbags(-44.2, -72.8, 7, 0),
    sandbags(44.2, -72.8, 7, 0),
    crateStack(-41.6, 124.8, !1),
    crateStack(41.6, 124.8, !1),
    crateStack(-39, -127.4, !1),
    crateStack(39, -127.4, !1));
}
function buildFreighter() {
  (platform(0, -4.5, 18, 14, 2, ""),
    stairs(0, 5.5, 8, 2, "N", 4),
    sandbags(0, -31.2, 10, 0),
    crateStack(-20.8, -28.6, !1),
    crateStack(20.8, -28.6, !1),
    platform(0, -135.2, 28, 14, 3.8, "S"),
    stairs(-12, -123.7, 8, 3.8, "N", 6),
    stairs(12, -123.7, 8, 3.8, "N", 6),
    platform(0, -104, 12, 8, 1.8, ""),
    crateStack(-23.4, -104, !1),
    crateStack(23.4, -104, !1),
    crateStack(-59.8, 78, !0),
    crateStack(-57.2, 26, !1),
    crateStack(-59.8, -26, !0),
    crateStack(-54.6, -80.6, !1),
    crateStack(57.2, 101.4, !1),
    crateStack(62.4, 46.8, !0),
    crateStack(54.6, -10.4, !1),
    crateStack(59.8, -65, !0),
    platform(-11.7, 114.4, 9, 9, 3, ""),
    platform(13, 88.4, 9, 9, 3, ""),
    platform(-13, 62.4, 9, 9, 3, ""),
    platform(11.7, 39, 9, 9, 3, ""),
    platform(-10.4, 18.2, 9, 9, 3, ""),
    sandbags(0, -59.8, 8, 0),
    platform(-44.2, -88.4, 11, 11, 2.6, "E"),
    platform(44.2, -88.4, 11, 11, 2.6, "W"),
    void 0,
    void 0,
    crateStack(-26, 137.8, !1),
    crateStack(26, 137.8, !1),
    sandbags(0, 122.2, 9, 0));
}
function buildNeon() {
  (platform(101.4, 111.8, 18, 14, 2.6, "S"),
    void 0,
    platform(80.6, 80.6, 10, 10, 1.6, ""),
    crateStack(85.8, 85.8, !1),
    crateStack(119.6, 111.8, !1),
    sandbags(104, 78, 9, 0),
    platform(-101.4, -111.8, 17, 13, 2.8, "N"),
    void 0,
    platform(-78, -80.6, 10, 10, 1.6, ""),
    crateStack(-85.8, -83.2, !0),
    crateStack(-117, -109.2, !0),
    sandbags(-101.4, -75.4, 9, 0),
    platform(-111.8, 23.4, 12, 12, 2.2, "ES"),
    stairs(-102.8, 19.4, 8, 2.2, "W", 4),
    platform(111.8, -23.4, 12, 12, 2.2, "WN"),
    stairs(102.8, -19.4, 8, 2.2, "E", 4),
    crateStack(-93.6, 15.6, !1),
    crateStack(93.6, -15.6, !1),
    sandbags(-72.8, 7.8, 7, 0),
    sandbags(0, 72.8, 7, 0),
    sandbags(0, -78, 7, 0),
    sandbags(72.8, -7.8, 7, 0),
    platform(0, 0, 12, 12, 1.8, ""),
    crateStack(-114.4, 104, !1),
    crateStack(-96.2, 119.6, !1),
    crateStack(114.4, -104, !1),
    crateStack(96.2, -119.6, !1));
}
function dressMap() {
  skyDome();
  try {
    (buildStructures(), buildGrid());
  } catch (e) {
    console.warn("structures", e);
  }
  const e = MAP.theme || CUR_MAP_KEY || "glacier";
  (MAP.sites.forEach((e) => siteMarker(e)),
    (
      {
        glacier: dressGlacier,
        dunes: dressDunes,
        freighter: dressFreighter,
        neon: dressNeon,
        garden: dressGarden,
        market: dressMarket,
        temple: dressTemple,
        harbor: dressHarbor,
        forge: dressForge,
        jungle: dressJungle,
      }[e] || (() => {})
    )(),
    MAP.walls
      .filter((e) => e.cover)
      .forEach((e) => {
        if (Math.random() < 0.55) {
          const t = new T.Mesh(new T.BoxGeometry(1.3, 1.3, 1.3), TH().crate);
          (t.position.set(
            e.x + _rnd(-1.2, 1.2),
            e.h + 0.65,
            e.z + _rnd(-1.2, 1.2),
          ),
            (t.rotation.y = 3 * Math.random()),
            (t.castShadow = !0),
            deco(t));
        }
      }));
}
function dressGlacier() {
  (mast(5.2, 0, 20),
    mast(-119.6, -72.8, 13),
    mast(135.2, 57.2, 14),
    mast(-59.8, 52, 11),
    [
      [-93.6, -93.6],
      [-67.6, -26],
      [-124.8, 44.2],
      [-39, 83.2],
      [23.4, -96.2],
      [67.6, 20.8],
      [-166.4, -59.8],
      [-161.2, 75.4],
      [-13, -101.4],
      [85.8, -15.6],
      [143, -91],
      [153.4, 85.8],
      [-52, 104],
      [52, 101.4],
      [-145.6, -10.4],
      [166.4, -10.4],
    ].forEach(([e, t]) => pine(e, t, _rnd(5, 9))),
    [
      [-140.4, 0],
      [-75.4, -57.2],
      [-57.2, 0],
      [-75.4, 59.8],
      [13, 52],
      [-20.8, -59.8],
      [101.4, -67.6],
      [109.2, 65],
      [140.4, 0],
      [39, -26],
      [-109.2, -67.6],
      [44.2, 52],
      [-33.8, 44.2],
      [80.6, -93.6],
      [85.8, 91],
      [161.2, 0],
    ].forEach(([e, t]) => themeLight(e, t, 8319231)));
  for (let e = 0; e < 64; e++) {
    const e = new T.Mesh(
      new T.SphereGeometry(_rnd(0.9, 2.8), 8, 6),
      mat1(
        "snowPile",
        () => new T.MeshStandardMaterial({ color: 15266554, roughness: 0.9 }),
      ),
    );
    (e.position.set(
      _rnd(-187.2, 187.2),
      _rnd(-0.4, -0.05),
      _rnd(-109.2, 109.2),
    ),
      (e.scale.y = 0.24),
      deco(e));
  }
}
function dressDunes() {
  ([
    [-83.2, -98.8],
    [-83.2, -57.2],
    [83.2, -96.2],
    [83.2, -54.6],
    [-96.2, 20.8],
    [96.2, 20.8],
    [0, 72.8],
    [0, -62.4],
    [-52, -78],
    [52, -75.4],
    [-111.8, -91],
    [111.8, -88.4],
  ].forEach(([e, t]) => obelisk(e, t, _rnd(6, 10))),
    [
      [-109.2, 114.4],
      [109.2, 114.4],
      [-39, 57.2],
      [39, 57.2],
      [-117, -135.2],
      [117, -135.2],
      [0, 104],
      [-70.2, -10.4],
      [70.2, -10.4],
      [-124.8, 67.6],
      [124.8, 67.6],
      [0, 156],
    ].forEach(([e, t]) => palm(e, t, _rnd(6, 10))),
    [
      [0, 145.6],
      [-91, 91],
      [91, 91],
      [-98.8, 33.8],
      [98.8, 33.8],
      [0, 39],
      [0, -26],
      [-83.2, -80.6],
      [83.2, -75.4],
      [0, -143],
      [-52, -62.4],
      [52, -59.8],
      [-119.6, 0],
      [119.6, 0],
    ].forEach(([e, t]) => themeLight(e, t, 16752700)));
  for (let e = 0; e < 70; e++) {
    const e = new T.Mesh(
      new T.SphereGeometry(_rnd(1, 3.4), 8, 6),
      mat1(
        "sandPile",
        () => new T.MeshStandardMaterial({ color: 14204300, roughness: 1 }),
      ),
    );
    (e.position.set(_rnd(-130, 130), _rnd(-0.8, -0.12), _rnd(-166.4, 166.4)),
      (e.scale.y = 0.26),
      deco(e));
  }
}
function dressFreighter() {
  (crane(-49.4, 59.8, 15),
    crane(49.4, -52, 15),
    crane(-49.4, -130, 13),
    [
      [-72.8, 143, 0],
      [-72.8, 85.8, 0],
      [-72.8, 26, 0],
      [-72.8, -33.8, 0],
      [-72.8, -91, 0],
      [-72.8, -145.6, 0],
      [72.8, 143, 0],
      [72.8, 85.8, 0],
      [72.8, 26, 0],
      [72.8, -33.8, 0],
      [72.8, -91, 0],
      [72.8, -145.6, 0],
    ].forEach(([e, t, o]) => container(e, t, o, Math.random() < 0.55)),
    [
      [0, 150.8],
      [-57.2, 109.2],
      [57.2, 109.2],
      [-57.2, 26],
      [57.2, 26],
      [0, -13],
      [-54.6, -67.6],
      [54.6, -67.6],
      [0, -119.6],
      [0, -166.4],
      [-31.2, 62.4],
      [31.2, 62.4],
      [0, 52],
    ].forEach(([e, t]) => themeLight(e, t, 16761421)));
  for (let e = 0; e < 50; e++) {
    const e = new T.Mesh(
      new T.CircleGeometry(_rnd(1, 3), 10),
      mat1(
        "oil",
        () =>
          new T.MeshStandardMaterial({
            color: 1316892,
            roughness: 0.45,
            metalness: 0.5,
            transparent: !0,
            opacity: 0.42,
          }),
      ),
    );
    ((e.rotation.x = -Math.PI / 2),
      e.position.set(_rnd(-78, 78), 0.03, _rnd(-189.8, 189.8)),
      deco(e));
  }
}
function dressNeon() {
  ([
    [-119.6, 78, 0],
    [-78, 132.6, 1.2],
    [39, 119.6, 2.4],
    [119.6, 59.8, 3.1],
    [140.4, -39, 4.2],
    [59.8, -119.6, 5],
    [-59.8, -132.6, 0.6],
    [-135.2, -59.8, 1.9],
    [15.6, 36.4, 2.2],
    [-28.6, -20.8, 4.6],
    [-124.8, 13, 0.4],
    [124.8, -13, 3.5],
    [78, 39, 2],
    [-78, -39, 5.3],
  ].forEach(([e, t, o]) => neonSign(e, t, _rnd(5, 10), o)),
    [
      [-114.4, 106.6],
      [-91, 75.4],
      [91, 106.6],
      [119.6, 91],
      [-93.6, -91],
      [-119.6, -106.6],
      [75.4, -93.6],
      [106.6, -114.4],
      [-41.6, 20.8],
      [41.6, -20.8],
      [-109.2, 28.6],
      [109.2, -28.6],
      [62.4, 75.4],
      [-62.4, -75.4],
    ].forEach(([e, t]) => acUnit(e, t)),
    [
      [-124.8, 124.8],
      [-67.6, 15.6],
      [0, 80.6],
      [0, -85.8],
      [101.4, 98.8],
      [-98.8, -98.8],
      [124.8, -124.8],
      [62.4, 85.8],
      [-78, -54.6],
      [85.8, -41.6],
      [-111.8, 18.2],
      [111.8, -18.2],
      [0, 0],
    ].forEach(([e, t]) => themeLight(e, t, 16731540)));
  for (let e = 0; e < 46; e++) {
    const e = new T.Mesh(
      new T.CircleGeometry(_rnd(1.4, 4), 12),
      mat1(
        "puddle",
        () =>
          new T.MeshStandardMaterial({
            color: 1054760,
            roughness: 0.06,
            metalness: 0.85,
            transparent: !0,
            opacity: 0.55,
          }),
      ),
    );
    ((e.rotation.x = -Math.PI / 2),
      e.position.set(_rnd(-153.4, 153.4), 0.03, _rnd(-153.4, 153.4)),
      deco(e));
  }
}
function _sm(k, o) {
  return mat1(k, () => new T.MeshStandardMaterial(o));
}
function _glowLight(g, col, y, i, d) {
  if (LAMP_LIT.n < (void 0 !== GFX ? GFX.lamps : LAMP_LIT.max)) {
    LAMP_LIT.n++;
    const l = new T.PointLight(col, i || 10, d || 16, 2);
    l.position.y = y;
    g.add(l);
  }
}
function tree(x, z, h, col) {
  const g = new T.Group(),
    tr = new T.Mesh(
      new T.CylinderGeometry(0.22, 0.38, 0.55 * h, 7),
      _sm("treeTrunk", { color: 0x4a3526, roughness: 0.95 }),
    );
  tr.position.y = 0.275 * h;
  tr.castShadow = !0;
  g.add(tr);
  const lf = _sm("leaf" + (col || 0x3f6b35), {
    color: col || 0x3f6b35,
    roughness: 0.85,
  });
  [
    [0, 0.72, 0, 0.3],
    [0.45, 0.6, 0.2, 0.22],
    [-0.4, 0.62, -0.25, 0.24],
    [0.1, 0.86, -0.3, 0.2],
  ].forEach(([a, b, c, r]) => {
    const s = new T.Mesh(new T.IcosahedronGeometry(r * h, 1), lf);
    s.position.set(a * h * 0.4, b * h, c * h * 0.4);
    s.castShadow = !0;
    g.add(s);
  });
  g.position.set(x, 0, z);
  g.rotation.y = 6 * Math.random();
  return deco(g);
}
function pineTree(x, z, h) {
  const g = new T.Group(),
    tr = new T.Mesh(
      new T.CylinderGeometry(0.16, 0.28, 0.45 * h, 6),
      _sm("treeTrunk", { color: 0x4a3526, roughness: 0.95 }),
    );
  tr.position.y = 0.22 * h;
  g.add(tr);
  const lf = _sm("pineGreen", { color: 0x2f4f36, roughness: 0.9 });
  for (let i = 0; i < 3; i++) {
    const c = new T.Mesh(new T.ConeGeometry(1.7 - 0.4 * i, 0.36 * h, 7), lf);
    c.position.y = h * (0.4 + 0.2 * i);
    c.castShadow = !0;
    g.add(c);
  }
  g.position.set(x, 0, z);
  return deco(g);
}
function fern(x, z, s) {
  const g = new T.Group(),
    m = _sm("fern", { color: 0x4f8a3a, roughness: 0.9, side: T.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const p = new T.Mesh(
      new T.PlaneGeometry(0.5 * (s || 1), 1.9 * (s || 1)),
      m,
    );
    p.position.y = 0.55 * (s || 1);
    p.rotation.y = 1.05 * i;
    p.rotation.x = 0.55;
    g.add(p);
  }
  g.position.set(x, 0, z);
  return deco(g);
}
function rock(x, z, r, col) {
  const s = new T.Mesh(
    new T.DodecahedronGeometry(r, 0),
    _sm("rock" + (col || 0x6b6f72), {
      color: col || 0x6b6f72,
      roughness: 0.95,
    }),
  );
  s.position.set(x, 0.35 * r, z);
  s.rotation.set(Math.random(), Math.random(), 0);
  s.scale.y = 0.7;
  s.castShadow = !0;
  return deco(s);
}
function pagoda(x, z, n) {
  const g = new T.Group(),
    w = TH().wall,
    roof = MAT.tile;
  for (let i = 0; i < n; i++) {
    const s = 7 - 1.05 * i,
      b = new T.Mesh(new T.BoxGeometry(s * 0.72, 2.6, s * 0.72), w);
    b.position.y = 1.3 + 3.1 * i;
    b.castShadow = !0;
    g.add(b);
    const r = new T.Mesh(new T.ConeGeometry(s * 0.78, 1.1, 4), roof);
    r.position.y = 3.05 + 3.1 * i;
    r.rotation.y = Math.PI / 4;
    r.castShadow = !0;
    g.add(r);
  }
  const sp = new T.Mesh(new T.CylinderGeometry(0.08, 0.14, 3, 6), MAT.jade);
  sp.position.y = 3.1 * n + 1.6;
  g.add(sp);
  g.position.set(x, 0, z);
  return deco(g);
}
function bellPavilion(x, z) {
  [
    [-3.2, -3.2],
    [3.2, -3.2],
    [-3.2, 3.2],
    [3.2, 3.2],
  ].forEach(([a, b]) => pillar(x + a, z + b, 4.6));
  eave(x, z, 8, 8, 5);
  const b = new T.Mesh(
    new T.CylinderGeometry(1.05, 1.35, 2.3, 14),
    _sm("bronze", { color: 0x5c6b4a, roughness: 0.4, metalness: 0.8 }),
  );
  b.position.set(x, 3.3, z);
  b.castShadow = !0;
  return deco(b);
}
function stall(x, z, w, rot, col) {
  const g = new T.Group(),
    cloth = _sm("cloth" + col, {
      color: col,
      roughness: 0.9,
      side: T.DoubleSide,
    });
  [
    [-w / 2 + 0.2, -1.1],
    [w / 2 - 0.2, -1.1],
    [-w / 2 + 0.2, 1.1],
    [w / 2 - 0.2, 1.1],
  ].forEach(([a, b]) => {
    const p = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 3, 5), MAT.wood);
    p.position.set(a, 1.5, b);
    g.add(p);
  });
  const aw = new T.Mesh(new T.PlaneGeometry(w + 0.6, 3), cloth);
  aw.rotation.x = -Math.PI / 2 + 0.22;
  aw.position.y = 3.05;
  aw.castShadow = !0;
  g.add(aw);
  for (let i = 0; i < Math.floor(w / 1.3); i++) {
    const b = new T.Mesh(
      new T.BoxGeometry(0.8, 0.45, 0.6),
      _sm("goods" + (i % 3), {
        color: [0xb5532e, 0xd8b04c, 0x6f8f3b][i % 3],
        roughness: 0.8,
      }),
    );
    b.position.set(-w / 2 + 0.8 + 1.3 * i, 1.42, 0);
    g.add(b);
  }
  g.position.set(x, 0, z);
  g.rotation.y = rot || 0;
  return deco(g);
}
function lanternString(x1, z1, x2, z2, h, col) {
  const g = new T.Group(),
    n = Math.max(3, Math.round(Math.hypot(x2 - x1, z2 - z1) / 2.4)),
    m = mat1("strLamp" + col, () => new T.MeshBasicMaterial({ color: col }));
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      s = new T.Mesh(new T.SphereGeometry(0.2, 8, 6), m);
    s.position.set(
      x1 + (x2 - x1) * t,
      h - 0.9 * Math.sin(Math.PI * t),
      z1 + (z2 - z1) * t,
    );
    g.add(s);
  }
  _glowLight(g, col, h - 1, 6, 12);
  const L = g.children.find((c) => c.isLight);
  L && L.position.set((x1 + x2) / 2, h - 1, (z1 + z2) / 2);
  return deco(g);
}
function bollard(x, z) {
  const b = new T.Mesh(
    new T.CylinderGeometry(0.34, 0.42, 0.9, 10),
    _sm("bollard", { color: 0x2b2f33, roughness: 0.5, metalness: 0.7 }),
  );
  b.position.set(x, 0.45, z);
  return deco(b);
}
function boat(x, z, rot, len) {
  const g = new T.Group(),
    L = len || 10,
    hull = new T.Mesh(
      new T.BoxGeometry(L, 1.6, L * 0.32),
      _sm("hull", { color: 0x7d2f25, roughness: 0.7 }),
    );
  hull.position.y = 0.4;
  g.add(hull);
  const bow = new T.Mesh(
    new T.ConeGeometry(L * 0.16, L * 0.3, 4),
    _sm("hull", { color: 0x7d2f25, roughness: 0.7 }),
  );
  bow.rotation.z = -Math.PI / 2;
  bow.rotation.x = Math.PI / 4;
  bow.position.set(L * 0.63, 0.4, 0);
  g.add(bow);
  const cab = new T.Mesh(
    new T.BoxGeometry(L * 0.28, 1.8, L * 0.24),
    _sm("cabin", { color: 0xe8e2d4, roughness: 0.6 }),
  );
  cab.position.set(-L * 0.2, 2.1, 0);
  g.add(cab);
  g.position.set(x, -0.2, z);
  g.rotation.y = rot || 0;
  return deco(g);
}
function seaPlane(x, z, w, d) {
  const s = new T.Mesh(
    new T.PlaneGeometry(w, d),
    _sm("sea", { color: 0x1b5a7c, roughness: 0.38, metalness: 0.12 }),
  );
  s.rotation.x = -Math.PI / 2;
  s.position.set(x, -0.05, z);
  s.userData.noMerge = !0;
  return deco(s);
}
function chimney(x, z, h) {
  const g = new T.Group(),
    c = new T.Mesh(new T.CylinderGeometry(1.1, 1.6, h, 12), TH().strut);
  c.position.y = h / 2;
  c.castShadow = !0;
  g.add(c);
  const r = new T.Mesh(new T.TorusGeometry(1.15, 0.16, 6, 14), TH().trim);
  r.rotation.x = Math.PI / 2;
  r.position.y = h - 0.4;
  g.add(r);
  const e = new T.Mesh(
    new T.CircleGeometry(0.95, 14),
    mat1("ember", () => new T.MeshBasicMaterial({ color: 0xff7a2a })),
  );
  e.rotation.x = -Math.PI / 2;
  e.position.y = h + 0.02;
  e.userData.noMerge = !0;
  g.add(e);
  g.position.set(x, 0, z);
  return deco(g);
}
function lavaPool(x, z, w, d) {
  const g = new T.Group(),
    p = new T.Mesh(
      new T.PlaneGeometry(w, d),
      mat1(
        "lava",
        () =>
          new T.MeshStandardMaterial({
            color: 0xff5a1a,
            emissive: 0xff4a10,
            emissiveIntensity: 2.2,
            roughness: 0.6,
          }),
      ),
    );
  p.rotation.x = -Math.PI / 2;
  p.position.y = 0.05;
  g.add(p);
  for (let i = 0; i < 5; i++) {
    const c = new T.Mesh(
      new T.CircleGeometry(_rnd(0.4, 1.2), 8),
      mat1(
        "crust",
        () => new T.MeshStandardMaterial({ color: 0x2a1a14, roughness: 1 }),
      ),
    );
    c.rotation.x = -Math.PI / 2;
    c.position.set(_rnd(-w / 2.6, w / 2.6), 0.07, _rnd(-d / 2.6, d / 2.6));
    g.add(c);
  }
  _glowLight(g, 0xff6a2a, 1.4, 14, 18);
  g.position.set(x, 0, z);
  return deco(g);
}
function crucible(x, z) {
  const g = new T.Group(),
    b = new T.Mesh(new T.CylinderGeometry(1.6, 1.1, 2.2, 12), TH().strut);
  b.position.y = 1.1;
  b.castShadow = !0;
  g.add(b);
  const m = new T.Mesh(
    new T.CircleGeometry(1.4, 12),
    mat1(
      "lava",
      () =>
        new T.MeshStandardMaterial({
          color: 0xff5a1a,
          emissive: 0xff4a10,
          emissiveIntensity: 2.2,
          roughness: 0.6,
        }),
    ),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 2.15;
  g.add(m);
  g.position.set(x, 0, z);
  return deco(g);
}
function ruinColumn(x, z, h) {
  const g = new T.Group(),
    w = TH().wall,
    b = new T.Mesh(new T.BoxGeometry(1.9, 0.5, 1.9), w);
  b.position.y = 0.25;
  g.add(b);
  const c = new T.Mesh(new T.CylinderGeometry(0.62, 0.7, h, 10), w);
  c.position.y = h / 2 + 0.5;
  c.rotation.z = _rnd(-0.05, 0.05);
  c.castShadow = !0;
  g.add(c);
  const v = new T.Mesh(
    new T.CylinderGeometry(0.74, 0.74, 0.5 * h, 10, 1, !0),
    _sm("vine", {
      color: 0x3f6f2f,
      roughness: 0.9,
      transparent: !0,
      opacity: 0.85,
    }),
  );
  v.position.y = 0.35 * h;
  g.add(v);
  g.position.set(x, 0, z);
  return deco(g);
}

function buildGarden() {
  platform(0, 4, 16, 14, 2.2, "");
  stairs(0, 14, 8, 2.2, "N", 4);
  stairs(0, -6, 8, 2.2, "S", 4);
  platform(-106, -96, 16, 14, 3, "NS");
  stairs(-94.2, -96, 9, 3, "W", 5);
  platform(104, -50, 12, 16, 2.8, "EW");
  stairs(104, -38.2, 9, 2.8, "N", 5);
  crateStack(-54, -30, !0);
  sandbags(-72, -28, 8, 0);
  crateStack(-106, -40, !1);
  sandbags(-98, -64, 7, Math.PI / 2);
  crateStack(56, -84, !0);
  sandbags(96, -100, 8, 0);
  crateStack(106, -80, !1);
  sandbags(60, -24, 7, 0);
  crateStack(-40, 70, !1);
  crateStack(40, 58, !0);
  sandbags(-18, 34, 8, 0);
  crateStack(-30, -46, !0);
  crateStack(30, -30, !1);
  sandbags(-28, -100, 7, Math.PI / 2);
  crateStack(28, -78, !1);
  crateStack(-40, 124, !1);
  crateStack(40, 124, !1);
  crateStack(-62, 76, !0);
  crateStack(62, 72, !0);
  crateStack(-100, 96, !1);
  crateStack(100, 96, !1);
  [
    [-9, -81],
    [9, -81],
    [-9, -99],
    [9, -99],
  ].forEach(([x, z]) => {
    sBox(x, z, 1.3, 1.3, 6.4, MAT.beamRed).mesh.visible = !1;
  });
}
function dressGarden() {
  pond(0, 68, 9);
  pond(-100, -18, 6);
  pond(96, 118, 5);
  [
    [-9, -81],
    [9, -81],
    [-9, -99],
    [9, -99],
  ].forEach(([x, z]) => pillar(x, z, 6.1));
  eave(0, -90, 20, 20, 6.6);
  [
    [-46, 92],
    [46, 92],
    [-46, 30],
    [46, 28],
    [-110, 58],
    [110, 58],
    [-36, -30],
    [36, -52],
    [-110, -120],
    [110, -120],
    [-58, 132],
    [58, 132],
  ].forEach(([x, z]) => bamboo(x, z, 6));
  gate(-75, 106, 22);
  gate(75, 106, 22);
  gate(0, 106, 20);
  gate(-79, -2, 26);
  gate(79, -2, 26);
  gate(0, -22, 24);
  gate(-42, -3, 14, Math.PI / 2);
  gate(42, -3, 14, Math.PI / 2);
  [
    [-104, 132],
    [104, 132],
    [-20, 138],
    [20, 138],
    [-108, 4],
    [108, 4],
    [-24, 96],
    [24, 96],
    [-110, -38],
    [110, -30],
    [-60, -132],
    [60, -132],
    [-24, -132],
    [24, -132],
    [-86, 22],
    [86, 22],
  ].forEach(([x, z]) =>
    tree(
      x,
      z,
      _rnd(7, 10),
      [0x5d7a3a, 0x7a8a3c, 0x8a4a5a][Math.floor(3 * Math.random())],
    ),
  );
  [
    [-63, 103],
    [-87, 103],
    [63, 103],
    [87, 103],
    [-11, 103],
    [11, 103],
    [-66, -4],
    [66, -4],
    [-20, -24],
    [20, -24],
    [-60, -60],
    [60, -60],
    [-18, -62],
    [18, -62],
    [0, 40],
    [-92, 70],
    [92, 70],
    [-60, -104],
    [60, -104],
  ].forEach(([x, z]) => lantern(x, z, 16763528));
  [
    [-20, 120],
    [20, 120],
  ].forEach(([x, z]) => lantern(x, z, 16739146));
  [
    [-30, -124],
    [30, -124],
  ].forEach(([x, z]) => lantern(x, z, 3718648));
  MAP.sites.forEach((s) => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const x = c.getContext("2d");
    x.fillStyle = "#1a1410";
    x.fillRect(0, 0, 512, 128);
    x.strokeStyle = "#c9a227";
    x.lineWidth = 6;
    x.strokeRect(8, 8, 496, 112);
    x.fillStyle = "#f0e0b8";
    x.font = 'bold 66px "Noto Sans KR", sans-serif';
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(s.label, 256, 68);
    const m = new T.Mesh(
      new T.PlaneGeometry(7, 1.75),
      new T.MeshStandardMaterial({
        map: new T.CanvasTexture(c),
        emissive: 16777215,
        emissiveIntensity: 0.18,
      }),
    );
    m.position.set(s.x, 7.4, s.z + 10.2);
    m.userData.noMerge = !0;
    deco(m);
  });
  for (let i = 0; i < 60; i++) {
    const p = new T.Mesh(
      new T.CircleGeometry(_rnd(0.8, 2.6), 9),
      mat1(
        "petal",
        () =>
          new T.MeshStandardMaterial({
            color: 0xe6a3b4,
            roughness: 1,
            transparent: !0,
            opacity: 0.5,
          }),
      ),
    );
    p.rotation.x = -Math.PI / 2;
    p.position.set(_rnd(-112, 112), 0.03, _rnd(-144, 144));
    deco(p);
  }
}

function buildMarket() {
  platform(-84, -96, 14, 10, 2.6, "NW");
  stairs(-73.2, -96, 8, 2.6, "W", 5);
  platform(84, -102, 14, 10, 2.6, "SE");
  stairs(73.2, -102, 8, 2.6, "E", 5);
  sBox(0, 18, 3.4, 3.4, 1.1, MAT.panel);
  crateStack(-14, -40, !1);
  crateStack(14, -70, !0);
  sandbags(0, -92, 8, 0);
  crateStack(-40, -4, !1);
  crateStack(40, 22, !1);
  crateStack(-84, 90, !1);
  crateStack(84, 88, !0);
  crateStack(-18, 104, !1);
  crateStack(18, 104, !1);
  crateStack(-60, -30, !0);
  crateStack(60, -34, !1);
  sandbags(-80, -60, 7, Math.PI / 2);
  sandbags(40, -100, 7, 0);
  crateStack(-66, 44, !1);
  crateStack(66, 40, !1);
}
function dressMarket() {
  eave(-44, 62, 38, 58, 8);
  eave(44, 62, 38, 58, 8);
  eave(-88, 44, 14, 10, 7);
  eave(88, 44, 14, 10, 7);
  eave(-82, 10, 20, 14, 7);
  eave(82, 10, 20, 14, 7);
  eave(-86, -40, 14, 14, 8);
  eave(86, -84, 14, 16, 8);
  const cols = [0xb33a3a, 0x2f6f9a, 0xd8a23a, 0x5b8a3a, 0x8a3a8a];
  [
    [-89, 90, Math.PI / 2],
    [-89, 56, Math.PI / 2],
    [89, 92, Math.PI / 2],
    [89, 58, Math.PI / 2],
    [-20, 88, Math.PI / 2],
    [20, 76, Math.PI / 2],
    [-20, 50, Math.PI / 2],
    [20, 40, Math.PI / 2],
    [-60, 24, 0],
    [60, 24, 0],
    [-30, -6, 0],
    [30, 26, 0],
    [-60, -24, 0],
    [60, -24, 0],
    [-18, -60, Math.PI / 2],
    [18, -30, Math.PI / 2],
  ].forEach(([x, z, r], i) => stall(x, z, 5, r, cols[i % cols.length]));
  [
    [-24, 94, 24, 94],
    [-24, 76, 24, 76],
    [-24, 58, 24, 58],
    [-24, 40, 24, 40],
    [-96, 70, -64, 70],
    [64, 70, 96, 70],
    [-70, 26, 70, 26],
    [-70, -8, 70, -8],
    [-22, -30, 22, -30],
    [-22, -66, 22, -66],
    [-96, -20, -22, -20],
    [22, -20, 96, -20],
  ].forEach(([a, b, c, d], i) =>
    lanternString(a, b, c, d, 6.2, [16758881, 16739146, 16763528][i % 3]),
  );
  [
    [-64, 98],
    [-82, 98],
    [64, 98],
    [82, 98],
    [-9, 98],
    [9, 98],
    [-70, -14],
    [-48, -14],
    [48, -14],
    [70, -14],
    [-25, -36],
    [25, -36],
    [0, 0],
    [-40, -90],
    [40, -96],
  ].forEach(([x, z]) => lantern(x, z, 16763528));
  [
    [-30, -128],
    [30, -128],
  ].forEach(([x, z]) => lantern(x, z, 3718648));
  [
    [-40, 128],
    [40, 128],
  ].forEach(([x, z]) => lantern(x, z, 16739146));
  gate(-73, 98, 18);
  gate(73, 98, 18);
  gate(0, 98, 18);
  gate(-59, -14, 22);
  gate(59, -14, 22);
  const w = new T.Mesh(new T.TorusGeometry(1.6, 0.35, 8, 20), MAT.panel);
  w.rotation.x = Math.PI / 2;
  w.position.set(0, 1.1, 18);
  deco(w);
  [
    [-90, 130],
    [90, 130],
    [-90, -130],
    [90, -130],
  ].forEach(([x, z]) => tree(x, z, 8, 0x3b5a36));
  for (let i = 0; i < 40; i++) {
    const p = new T.Mesh(
      new T.CircleGeometry(_rnd(1.2, 3.6), 10),
      mat1(
        "puddleM",
        () =>
          new T.MeshStandardMaterial({
            color: 0x0e141c,
            roughness: 0.08,
            metalness: 0.8,
            transparent: !0,
            opacity: 0.5,
          }),
      ),
    );
    p.rotation.x = -Math.PI / 2;
    p.position.set(_rnd(-92, 92), 0.03, _rnd(-134, 134));
    deco(p);
  }
}

function buildTemple() {
  platform(-118, -66, 14, 14, 2.8, "NW");
  stairs(-107.2, -66, 9, 2.8, "W", 5);
  platform(-118, 66, 14, 14, 2.8, "SW");
  stairs(-107.2, 66, 9, 2.8, "W", 5);
  platform(0, 0, 14, 14, 2, "");
  stairs(0, -10, 8, 2, "S", 4);
  stairs(0, 10, 8, 2, "N", 4);
  sBox(-84, -12, 5.2, 5.2, 13, MAT.panel).mesh.visible = !1;
  [
    [-3.2, -3.2],
    [3.2, -3.2],
    [-3.2, 3.2],
    [3.2, 3.2],
  ].forEach(([a, b]) => {
    sBox(-66 + a, 98 + b, 1.2, 1.2, 5, MAT.panel).mesh.visible = !1;
  });
  crateStack(84, -60, !1);
  crateStack(84, 62, !0);
  sandbags(66, -30, 8, 0);
  sandbags(66, 28, 8, 0);
  crateStack(20, -96, !0);
  crateStack(-20, 100, !1);
  crateStack(-24, -34, !1);
  crateStack(24, 36, !1);
  sandbags(-50, -34, 7, 0);
  sandbags(-104, -80, 7, Math.PI / 2);
  crateStack(-100, 84, !1);
  crateStack(-52, -4, !0);
  crateStack(124, -100, !1);
  crateStack(124, 100, !1);
}
function dressTemple() {
  pagoda(-84, -12, 4);
  bellPavilion(-66, 98);
  eave(-66, -104, 26, 10, 8);
  [
    [-73, -104],
    [-59, -104],
    [-66, -104],
  ].forEach(([x, z]) => lantern(x, z + 7, 16763528));
  [
    [130, -104],
    [130, 104],
    [108, -96],
    [108, 96],
    [88, -46],
    [88, 46],
    [52, -70],
    [52, 70],
    [20, -106],
    [20, 106],
    [-20, -56],
    [-20, 56],
    [-138, -104],
    [-138, 104],
    [-120, -20],
    [-120, 20],
    [70, -106],
    [70, 106],
    [-44, -106],
    [-44, 106],
  ].forEach(([x, z]) => pineTree(x, z, _rnd(8, 12)));
  [
    [92, -22],
    [52, 22],
    [44, -80],
    [80, 104],
    [-6, -100],
    [6, 60],
    [-90, -50],
    [-96, 50],
    [120, 50],
    [120, -50],
  ].forEach(([x, z]) => rock(x, z, _rnd(1.2, 2.4)));
  [
    [40, -30],
    [40, 30],
    [96, -60],
    [96, 60],
    [-40, -60],
    [-40, 60],
    [-40, -20],
    [-40, 20],
    [60, -96],
    [60, 96],
    [-104, -58],
    [-104, 58],
  ].forEach(([x, z]) => ruinColumn(x, z, _rnd(2.5, 6)));
  [
    [102, -68, 20],
    [102, 68, 20],
    [102, 0, 20],
    [34, -75, 22],
    [34, 75, 22],
    [34, 0, 28],
    [-34, -87, 18],
    [-34, 0, 28],
    [-34, 87, 18],
  ].forEach(([x, z, w]) => gate(x, z, w, Math.PI / 2));
  [
    [118, -12],
    [118, 12],
    [70, -44],
    [70, 44],
    [10, -40],
    [10, 40],
    [-50, -40],
    [-50, 40],
    [-80, -30],
    [-80, 30],
    [-120, 0],
    [-40, -96],
    [-40, 96],
  ].forEach(([x, z]) => lantern(x, z, 16757350));
  for (let i = 0; i < 56; i++) {
    const p = new T.Mesh(
      new T.CircleGeometry(_rnd(1.2, 3.4), 10),
      mat1(
        "mossPatch",
        () =>
          new T.MeshStandardMaterial({
            color: 0x4d6b3a,
            roughness: 1,
            transparent: !0,
            opacity: 0.45,
          }),
      ),
    );
    p.rotation.x = -Math.PI / 2;
    p.position.set(_rnd(-140, 140), 0.03, _rnd(-108, 108));
    deco(p);
  }
}

function buildHarbor() {
  const K = (x, z, r, two) => {
    container(x, z, r, two);
    sBox(
      x,
      z,
      r ? 2.4 : 6,
      r ? 6 : 2.4,
      two ? 5.2 : 2.6,
      MAT.panel,
    ).mesh.visible = !1;
  };
  const q = Math.PI / 2;
  [
    [-24, 86, 0, 1],
    [8, 92, q, 0],
    [24, 74, 0, 1],
    [-10, 66, q, 1],
    [-28, 48, 0, 0],
    [12, 44, 0, 1],
    [30, 28, q, 0],
    [-16, 24, q, 1],
    [4, 8, 0, 0],
    [-28, -2, 0, 1],
    [22, -8, q, 1],
    [-6, -20, 0, 0],
    [76, 86, 0, 1],
    [100, 70, q, 1],
    [70, 50, q, 0],
    [94, 34, 0, 1],
    [80, 14, 0, 0],
    [106, -4, q, 1],
    [66, -14, 0, 1],
    [56, -86, q, 1],
    [106, -80, 0, 0],
    [-110, -84, q, 1],
    [100, 124, 0, 0],
  ].forEach(([x, z, r, t]) => K(x, z, r, t));
  platform(-104, -98, 12, 10, 2.6, "E");
  stairs(-104, -89.2, 8, 2.6, "N", 5);
  platform(104, -100, 12, 12, 2.6, "WS");
  stairs(92.2, -100, 8, 2.6, "E", 5);
  crateStack(-60, -38, !0);
  crateStack(-112, 16, !1);
  crateStack(-52, 104, !1);
  sandbags(-86, -60, 7, Math.PI / 2);
  crateStack(40, -40, !1);
  sandbags(82, -40, 8, 0);
  crateStack(-20, -64, !1);
  crateStack(20, -96, !0);
  crateStack(-90, 100, !1);
  crateStack(40, 100, !1);
}
function dressHarbor() {
  const q = Math.PI / 2;
  seaPlane(250, 0, 260, 520);
  boat(150, -40, 0.3, 14);
  boat(168, 40, -0.2, 11);
  boat(146, 110, 0.1, 9);
  boat(190, -120, 0.6, 18);
  crane(-80, -130, 16);
  crane(90, 130, 15);
  for (let z = -140; z <= 140; z += 14) bollard(117, z);
  [
    [-105, 70, 30, 40, 10],
    [-52, 68, 24, 56, 10],
    [48, 74, 16, 44, 10],
    [-100, -50, 14, 12, 7],
    [0, -78, 20, 14, 8],
    [-98, -8, 14, 10, 6],
  ].forEach(([x, z, w, d, h]) => {
    const r = new T.Mesh(
      new T.BoxGeometry(w + 0.6, 0.5, d + 0.6),
      _sm("harborRoof", { color: 0x5f6f78, roughness: 0.6, metalness: 0.5 }),
    );
    r.position.set(x, h + 0.25, z);
    deco(r);
  });
  const cols = [0xb33a3a, 0x2f6f9a, 0xd8a23a];
  [
    [-86, 36, 0],
    [-62, 36, 0],
    [-110, 0, q],
    [-60, -80, 0],
    [-88, -68, q],
    [-46, -76, q],
  ].forEach(([x, z, r], i) => stall(x, z, 5, r, cols[i % 3]));
  [
    [-91, 104],
    [53, 104],
    [-15, 104],
    [-107, -27],
    [111, -27],
    [-33, -47],
    [33, -41],
    [-110, 40],
    [-60, 12],
    [-36, 30],
    [36, 64],
    [84, 60],
    [110, 20],
    [70, -60],
    [-70, -60],
    [0, -100],
    [-30, -124],
    [30, -124],
  ].forEach(([x, z]) => themeLight(x, z));
  [
    [-116, 140],
    [-116, -146],
    [60, 140],
  ].forEach(([x, z]) => tree(x, z, 7, 0x4f7a3a));
  for (let i = 0; i < 34; i++) {
    const p = new T.Mesh(
      new T.CircleGeometry(_rnd(1, 3), 10),
      mat1(
        "oil",
        () =>
          new T.MeshStandardMaterial({
            color: 1316892,
            roughness: 0.45,
            metalness: 0.5,
            transparent: !0,
            opacity: 0.42,
          }),
      ),
    );
    p.rotation.x = -Math.PI / 2;
    p.position.set(_rnd(-116, 116), 0.03, _rnd(-146, 146));
    deco(p);
  }
}

function buildForge() {
  platform(-66, -60, 14, 12, 2.6, "S");
  stairs(-66, -49.2, 8, 2.6, "N", 5);
  platform(-66, 60, 14, 12, 2.6, "N");
  stairs(-66, 49.2, 8, 2.6, "S", 5);
  platform(106, 88, 16, 14, 3, "N");
  stairs(94.2, 88, 9, 3, "E", 5);
  [
    [56, 78],
    [98, 84],
  ].forEach(([x, z]) => {
    sBox(x, z, 3, 3, 2.2, MAT.panel).mesh.visible = !1;
  });
  crateStack(-90, -30, !1);
  crateStack(-90, 30, !0);
  crateStack(-20, -80, !0);
  crateStack(-20, 80, !1);
  sandbags(-54, -46, 7, 0);
  sandbags(-54, 46, 7, 0);
  crateStack(30, -100, !1);
  crateStack(30, 100, !1);
  crateStack(76, -76, !1);
  sandbags(68, -100, 8, 0);
  crateStack(112, -36, !0);
  crateStack(66, 88, !1);
  sandbags(112, 34, 7, Math.PI / 2);
  crateStack(84, -14, !1);
  crateStack(134, -90, !1);
  crateStack(134, 90, !1);
  crateStack(-134, -90, !1);
  crateStack(-134, 90, !1);
}
function dressForge() {
  lavaPool(0, -83, 14, 40);
  lavaPool(0, -28, 14, 42);
  lavaPool(0, 28, 14, 42);
  lavaPool(0, 83, 14, 40);
  [-56, 0, 56].forEach((z) => {
    const p = new T.Mesh(new T.BoxGeometry(17, 0.12, 12), TH().strut);
    p.position.set(0, 0.06, z);
    p.receiveShadow = !0;
    deco(p);
    [-5.6, 5.6].forEach((dz) => {
      const r = new T.Mesh(new T.BoxGeometry(17, 0.3, 0.3), TH().trim);
      r.position.set(0, 1.2, z + dz);
      deco(r);
    });
  });
  chimney(90, -94, 26);
  chimney(104, -82, 22);
  chimney(-66, -92, 20);
  chimney(-66, 92, 20);
  chimney(138, 0, 24);
  crucible(56, 78);
  crucible(98, 84);
  const fm = new T.Mesh(
    new T.BoxGeometry(6, 5, 0.4),
    mat1("mouth", () => new T.MeshBasicMaterial({ color: 0xff6a1a })),
  );
  fm.position.set(96, 3, -79.7);
  fm.userData.noMerge = !0;
  deco(fm);
  const fl = new T.PointLight(0xff6a2a, 30, 30, 2);
  fl.position.set(96, 3, -76);
  LAMP_LIT.n < (void 0 !== GFX ? GFX.lamps : LAMP_LIT.max) &&
    (LAMP_LIT.n++, deco(fl));
  [
    [-107, -73],
    [-107, 12],
    [-107, 73],
    [-47, -35],
    [-47, 35],
    [24, -64],
    [24, 64],
    [37, -83],
    [37, 83],
    [57, -27],
    [61, 27],
    [106, 0],
    [117, -73],
    [117, 73],
    [-80, -60],
    [-80, 60],
    [-60, 16],
    [80, -58],
    [80, 60],
  ].forEach(([x, z]) => themeLight(x, z));
  for (let i = 0; i < 50; i++) {
    const p = new T.Mesh(
      new T.CircleGeometry(_rnd(1, 3), 10),
      mat1(
        "soot",
        () =>
          new T.MeshStandardMaterial({
            color: 0x0c0a0a,
            roughness: 1,
            transparent: !0,
            opacity: 0.5,
          }),
      ),
    );
    p.rotation.x = -Math.PI / 2;
    p.position.set(_rnd(-142, 142), 0.03, _rnd(-100, 100));
    deco(p);
  }
  for (let i = 0; i < 12; i++) {
    const p = new T.Mesh(
      new T.PlaneGeometry(_rnd(0.2, 0.4), _rnd(2, 4)),
      mat1("crack", () => new T.MeshBasicMaterial({ color: 0xff5a1a })),
    );
    p.rotation.x = -Math.PI / 2;
    p.rotation.z = Math.random() * 3;
    p.position.set(_rnd(-142, 142), 0.035, _rnd(-100, 100));
    p.userData.noMerge = !0;
    deco(p);
  }
}

function buildJungle() {
  platform(-100, -92, 18, 14, 3.2, "");
  stairs(-100, -80.5, 12, 3.2, "N", 6);
  platform(0, -2, 14, 12, 1.8, "");
  stairs(0, 6.5, 8, 1.8, "N", 3);
  stairs(0, -10.5, 8, 1.8, "S", 3);
  sBox(0, -98, 8, 4, 1.6, MAT.panel);
  const TR = (x, z, h) => {
    tree(x, z, h, 0x2f6b2a);
    sBox(x, z, 1.4, 1.4, 8, MAT.panel).mesh.visible = !1;
  };
  [
    [-88, 88],
    [-56, 64],
    [-110, 10],
    [-20, 92],
    [22, 44],
    [60, 88],
    [110, 58],
    [-40, -8],
    [40, 10],
    [-104, -64],
    [62, -70],
    [-12, -104],
    [110, -96],
  ].forEach(([x, z]) => TR(x, z, _rnd(10, 14)));
  crateStack(-60, 96, !1);
  crateStack(60, 30, !0);
  crateStack(-26, 20, !1);
  sandbags(-70, -30, 7, 0);
  sandbags(70, -34, 7, 0);
  crateStack(-54, -96, !1);
  crateStack(40, -76, !1);
  crateStack(-110, 120, !1);
  crateStack(110, 120, !1);
}
function dressJungle() {
  const st = new T.Mesh(new T.PlaneGeometry(14, 280), MAT.water);
  st.rotation.x = -Math.PI / 2;
  st.position.set(114, 0.05, 0);
  st.userData.noMerge = !0;
  deco(st);
  const wf = new T.Mesh(
    new T.PlaneGeometry(16, 13),
    mat1(
      "fall",
      () =>
        new T.MeshStandardMaterial({
          color: 0xbfe6ff,
          emissive: 0x3a7aa0,
          emissiveIntensity: 0.6,
          transparent: !0,
          opacity: 0.8,
          side: T.DoubleSide,
        }),
    ),
  );
  wf.rotation.y = -Math.PI / 2;
  wf.position.set(122.2, 6.5, -80);
  wf.userData.noMerge = !0;
  deco(wf);
  pond(104, -92, 7);
  [
    [-116, 132],
    [-60, 128],
    [60, 128],
    [116, 132],
    [-118, 90],
    [-30, 70],
    [30, 90],
    [100, 100],
    [-72, 36],
    [8, 30],
    [80, 36],
    [-112, -30],
    [-40, -30],
    [40, -36],
    [112, -30],
    [-116, -130],
    [-70, -130],
    [70, -130],
    [116, -130],
    [-10, -130],
  ].forEach(([x, z]) =>
    tree(
      x,
      z,
      _rnd(9, 15),
      [0x2f6b2a, 0x3d7a31, 0x4a8a3a][Math.floor(3 * Math.random())],
    ),
  );
  for (let i = 0; i < 70; i++)
    fern(_rnd(-120, 120), _rnd(-136, 136), _rnd(0.8, 1.5));
  [
    [-48, 67],
    [48, 67],
    [-90, -24],
    [-66, -24],
    [66, -24],
    [90, -24],
    [-10, -24],
    [10, -24],
    [-80, -76],
    [-72, -76],
    [-30, -110],
    [30, -110],
    [-110, -112],
    [0, 20],
    [-20, -60],
    [20, -60],
  ].forEach(([x, z]) => ruinColumn(x, z, _rnd(3, 7)));
  [
    [100, 76],
    [104, 50],
    [92, -10],
    [118, 20],
    [-88, 66],
    [-80, 12],
    [10, 60],
    [-10, -44],
  ].forEach(([x, z]) => rock(x, z, _rnd(1.4, 2.8), 0x5f6a5a));
  [
    [-88, 103],
    [88, 103],
    [14, 103],
    [-98, -21],
    [12, -21],
    [98, -21],
    [-34, -36],
    [34, -40],
    [-100, -80],
    [0, -90],
    [90, -60],
    [-60, 10],
    [60, 10],
    [-26, 52],
  ].forEach(([x, z]) => themeLight(x, z));
  for (let i = 0; i < 60; i++) {
    const p = new T.Mesh(
      new T.CircleGeometry(_rnd(1.4, 4), 10),
      mat1(
        "jmoss",
        () =>
          new T.MeshStandardMaterial({
            color: 0x2f5a26,
            roughness: 1,
            transparent: !0,
            opacity: 0.5,
          }),
      ),
    );
    p.rotation.x = -Math.PI / 2;
    p.position.set(_rnd(-120, 120), 0.03, _rnd(-136, 136));
    deco(p);
  }
}
const SFX = (() => {
    let e = null,
      t = null;
    function o() {
      if ("object" == typeof SETTINGS && SETTINGS && !SETTINGS.sfx) return null;
      if (e) return ("suspended" === e.state && e.resume(), e);
      try {
        const o = window.AudioContext || window.webkitAudioContext;
        if (!o) return null;
        ((e = GAME_AUDIO.context()),
          (t = e.createGain()),
          (t.gain.value = 0.22),
          t.connect(GAME_AUDIO.output));
      } catch (t) {
        e = null;
      }
      return e;
    }
    function a(e, a, n, r, s) {
      const i = o();
      if (!i) return;
      const l = i.createOscillator(),
        c = i.createGain();
      ((l.type = n || "square"),
        l.frequency.setValueAtTime(e, i.currentTime),
        s &&
          l.frequency.exponentialRampToValueAtTime(
            Math.max(20, s),
            i.currentTime + a,
          ),
        c.gain.setValueAtTime(1e-4, i.currentTime),
        c.gain.exponentialRampToValueAtTime(r || 0.3, i.currentTime + 0.008),
        c.gain.exponentialRampToValueAtTime(1e-4, i.currentTime + a),
        l.connect(c),
        c.connect(t),
        l.start(),
        l.stop(i.currentTime + a + 0.02));
    }
    function n(e, a, n, r) {
      const s = o();
      if (!s) return;
      const i = Math.max(1, Math.floor(s.sampleRate * e)),
        l = s.createBuffer(1, i, s.sampleRate),
        c = l.getChannelData(0);
      for (let e = 0; e < i; e++)
        c[e] = (2 * Math.random() - 1) * Math.pow(1 - e / i, 2.4);
      const d = s.createBufferSource();
      d.buffer = l;
      const h = s.createBiquadFilter();
      ((h.type = r || "lowpass"), (h.frequency.value = n || 2e3));
      const p = s.createGain();
      ((p.gain.value = a || 0.4),
        d.connect(h),
        h.connect(p),
        p.connect(t),
        d.start());
    }
    function r(e, a, n) {
      const r = o();
      if (!r) return;
      const s = Math.floor(r.sampleRate * e),
        i = r.createBuffer(1, s, r.sampleRate),
        l = i.getChannelData(0);
      for (let e = 0; e < s; e++)
        l[e] = (2 * Math.random() - 1) * Math.pow(1 - e / s, 1.8);
      const c = r.createBufferSource();
      c.buffer = i;
      const d = r.createBiquadFilter();
      ((d.type = "lowpass"), (d.frequency.value = n || 700));
      const h = r.createGain();
      ((h.gain.value = a || 0.6),
        c.connect(d),
        d.connect(h),
        h.connect(t),
        c.start());
    }
    return (
      addEventListener("pointerdown", o, { passive: !0 }),
      addEventListener("keydown", o, { passive: !0 }),
      {
        beep(e) {
          a(e ? 1720 : 1180, 0.06, "square", 0.26);
        },
        pick() {
          (a(620, 0.07, "triangle", 0.3),
            setTimeout(() => a(930, 0.09, "triangle", 0.3), 70));
        },
        drop() {
          a(420, 0.14, "triangle", 0.26, 210);
        },
        plantStart() {
          a(340, 0.09, "sawtooth", 0.2);
        },
        planted() {
          (a(300, 0.1, "square", 0.3),
            setTimeout(() => a(450, 0.1, "square", 0.3), 100),
            setTimeout(() => a(680, 0.26, "square", 0.32), 200),
            setTimeout(() => r(0.5, 0.35, 400), 200));
        },
        defuseTick() {
          a(880, 0.04, "sine", 0.16);
        },
        half() {
          (a(700, 0.1, "sine", 0.28),
            setTimeout(() => a(1040, 0.14, "sine", 0.28), 90));
        },
        defused() {
          (a(980, 0.12, "sine", 0.32),
            setTimeout(() => a(1320, 0.12, "sine", 0.32), 110),
            setTimeout(() => a(1760, 0.34, "sine", 0.3), 220));
        },
        boom() {
          (r(1.5, 0.95, 240),
            a(90, 0.9, "sawtooth", 0.4, 28),
            setTimeout(() => r(0.9, 0.5, 1600), 40));
        },
        shot(e, t) {
          if (!o()) return;
          const r = clamp(t || 0, 0, 1),
            s = 1 - 0.82 * r;
          if (s < 0.06) return;
          const i = 9e3 - 7600 * r;
          switch (e) {
            case "sniper":
              (n(0.16, 0.95 * s, 0.55 * i, "lowpass"),
                a(120, 0.2, "sawtooth", 0.42 * s, 42),
                setTimeout(() => n(0.3, 0.3 * s, 900), 40));
              break;
            case "shotgun":
              (n(0.13, 0.9 * s, 0.5 * i, "lowpass"),
                a(160, 0.13, "square", 0.34 * s, 55));
              break;
            case "heavy":
              (n(0.07, 0.7 * s, 0.62 * i, "lowpass"),
                a(190, 0.06, "sawtooth", 0.26 * s, 90));
              break;
            case "pistol":
              (n(0.05, 0.55 * s, 0.95 * i, "highpass"),
                a(420, 0.04, "square", 0.2 * s, 160));
              break;
            case "quiet":
              (n(0.045, 0.26 * s, 1500, "lowpass"),
                a(240, 0.035, "sine", 0.1 * s, 120));
              break;
            default:
              (n(0.055, 0.66 * s, 0.85 * i),
                a(300, 0.045, "sawtooth", 0.24 * s, 120));
          }
          r < 0.6 && setTimeout(() => n(0.12, 0.1 * s, 1100), 55);
        },
        hit(e) {
          e
            ? (a(1500, 0.045, "square", 0.3),
              setTimeout(() => a(2100, 0.05, "square", 0.26), 38))
            : a(1080, 0.04, "square", 0.22);
        },
        hurt() {
          (n(0.09, 0.42, 700, "lowpass"), a(150, 0.1, "sawtooth", 0.22, 70));
        },
        kill(e) {
          (n(0.06, 0.5, 2600),
            a(660, 0.055, "square", 0.3),
            setTimeout(() => a(990, 0.07, "square", 0.3), 55),
            setTimeout(() => a(1320, 0.13, "triangle", 0.26), 115),
            e &&
              (setTimeout(() => a(1980, 0.16, "triangle", 0.24), 190),
              setTimeout(() => n(0.1, 0.22, 5200), 190)));
        },
        multi(e) {
          const t = 520 + 130 * Math.min(e, 5);
          (a(t, 0.09, "triangle", 0.28),
            setTimeout(() => a(1.5 * t, 0.13, "triangle", 0.26), 85),
            setTimeout(() => a(2 * t, 0.18, "sine", 0.22), 175));
        },
        reload() {
          (a(200, 0.05, "square", 0.16),
            setTimeout(() => a(150, 0.06, "square", 0.14), 130),
            setTimeout(() => a(320, 0.05, "square", 0.16), 260));
        },
        gun(e, t) {
          if (!o()) return;
          const r = GUN_SFX[e];
          if (!r) return void this.shot(shotKindOf(e), t);
          const s = clamp(t || 0, 0, 1),
            i = 1 - 0.82 * s;
          if (i < 0.06) return;
          const l = 9e3 - 7600 * s;
          (n(r.nd, r.nv * i, Math.min(l * r.nc, 18e3), r.nf || "lowpass"),
            a(r.f, r.d, r.w, r.v * i, r.slide),
            r.f2 &&
              setTimeout(
                () =>
                  a(r.f2, 0.7 * r.d, r.w2 || "square", 0.5 * r.v * i, r.slide2),
                r.gap || 8,
              ),
            r.tail && setTimeout(() => n(r.tail, 0.28 * i, 800 + 200 * s), 40),
            s < 0.6 && setTimeout(() => n(0.11, 0.09 * i, 1100), 55));
        },
        abilityCast(e) {
          if (!o()) return;
          const t = ABIL_SFX[e] || ABIL_SFX._default;
          (a(t.f, t.d, t.w, 0.26, t.slide),
            n(t.nd || 0.1, 0.28, t.nc || 2400, t.nf || "lowpass"),
            t.f2 &&
              setTimeout(() => a(t.f2, 0.8 * t.d, t.w, 0.22, t.slide2), 80));
        },
        abilityHit() {
          (a(880, 0.06, "triangle", 0.24),
            setTimeout(() => a(1240, 0.08, "sine", 0.2), 55),
            n(0.07, 0.3, 3200));
        },
        abilityEnd() {
          (a(420, 0.16, "sine", 0.16, 240), n(0.14, 0.14, 900, "lowpass"));
        },
        ultCast() {
          o() &&
            (r(1.1, 0.7, 320),
            a(70, 0.7, "sawtooth", 0.34, 190),
            setTimeout(() => {
              a(300, 0.3, "triangle", 0.28, 900);
            }, 120),
            setTimeout(() => {
              (a(600, 0.4, "sine", 0.26, 1500), n(0.32, 0.28, 5200));
            }, 250),
            setTimeout(() => r(0.7, 0.4, 1400), 300));
        },
        silenced() {
          (a(300, 0.09, "square", 0.2, 140),
            setTimeout(() => a(190, 0.12, "square", 0.18, 90), 80));
        },
        step(e, t, r) {
          if (!o()) return;
          const s = clamp(r || 0, 0, 1),
            i = (1 - s) * (1 - s);
          if (i < 0.04) return;
          const l = STEP_SFX[t] || STEP_SFX.stone,
            c = "run" === e ? 1 : "crouch" === e ? 0.34 : 0.6;
          (n(l.d, l.v * c * i, l.cut * (1 - 0.55 * s), l.filt || "lowpass"),
            l.f &&
              a(
                l.f * (0.92 + 0.16 * Math.random()),
                0.035,
                "triangle",
                0.09 * c * i,
                0.7 * l.f,
              ));
        },
      }
    );
  })(),
  GUN_SFX = {
    knife: {
      f: 1400,
      d: 0.05,
      w: "triangle",
      v: 0.16,
      slide: 600,
      nd: 0.04,
      nv: 0.3,
      nc: 1.6,
      nf: "highpass",
    },
    pistol: {
      f: 430,
      d: 0.045,
      w: "square",
      v: 0.22,
      slide: 170,
      nd: 0.05,
      nv: 0.55,
      nc: 0.95,
      nf: "highpass",
    },
    silenced: {
      f: 250,
      d: 0.04,
      w: "sine",
      v: 0.11,
      slide: 120,
      nd: 0.045,
      nv: 0.24,
      nc: 0.18,
    },
    revolver: {
      f: 300,
      d: 0.1,
      w: "sawtooth",
      v: 0.34,
      slide: 80,
      nd: 0.09,
      nv: 0.78,
      nc: 0.7,
      tail: 0.22,
    },
    machpist: {
      f: 520,
      d: 0.03,
      w: "square",
      v: 0.18,
      slide: 240,
      nd: 0.04,
      nv: 0.48,
      nc: 1.1,
      nf: "highpass",
    },
    handcan: {
      f: 210,
      d: 0.14,
      w: "sawtooth",
      v: 0.4,
      slide: 55,
      nd: 0.11,
      nv: 0.88,
      nc: 0.55,
      tail: 0.28,
    },
    smg: {
      f: 360,
      d: 0.035,
      w: "sawtooth",
      v: 0.24,
      slide: 150,
      nd: 0.05,
      nv: 0.6,
      nc: 0.9,
    },
    vector: {
      f: 430,
      d: 0.028,
      w: "square",
      v: 0.2,
      slide: 200,
      nd: 0.04,
      nv: 0.52,
      nc: 1.05,
    },
    pdw: {
      f: 330,
      d: 0.04,
      w: "sawtooth",
      v: 0.25,
      slide: 130,
      nd: 0.055,
      nv: 0.62,
      nc: 0.85,
    },
    shotgun: {
      f: 165,
      d: 0.14,
      w: "square",
      v: 0.36,
      slide: 52,
      nd: 0.14,
      nv: 0.92,
      nc: 0.48,
      tail: 0.26,
    },
    autoshot: {
      f: 190,
      d: 0.1,
      w: "square",
      v: 0.3,
      slide: 65,
      nd: 0.11,
      nv: 0.8,
      nc: 0.52,
      tail: 0.18,
    },
    slugger: {
      f: 140,
      d: 0.17,
      w: "sawtooth",
      v: 0.4,
      slide: 44,
      nd: 0.15,
      nv: 0.95,
      nc: 0.44,
      tail: 0.3,
    },
    rifle: {
      f: 300,
      d: 0.05,
      w: "sawtooth",
      v: 0.28,
      slide: 120,
      nd: 0.06,
      nv: 0.7,
      nc: 0.85,
      f2: 900,
      gap: 10,
    },
    carbine: {
      f: 340,
      d: 0.042,
      w: "sawtooth",
      v: 0.25,
      slide: 145,
      nd: 0.055,
      nv: 0.64,
      nc: 0.92,
      f2: 1050,
      gap: 8,
    },
    battle: {
      f: 250,
      d: 0.07,
      w: "sawtooth",
      v: 0.33,
      slide: 95,
      nd: 0.075,
      nv: 0.8,
      nc: 0.75,
      f2: 760,
      gap: 12,
      tail: 0.2,
    },
    burst: {
      f: 380,
      d: 0.038,
      w: "square",
      v: 0.26,
      slide: 165,
      nd: 0.05,
      nv: 0.62,
      nc: 0.98,
      f2: 1150,
      gap: 7,
    },
    lmg: {
      f: 200,
      d: 0.065,
      w: "sawtooth",
      v: 0.3,
      slide: 80,
      nd: 0.075,
      nv: 0.76,
      nc: 0.62,
      tail: 0.22,
    },
    hmg: {
      f: 165,
      d: 0.08,
      w: "sawtooth",
      v: 0.34,
      slide: 62,
      nd: 0.09,
      nv: 0.85,
      nc: 0.55,
      tail: 0.28,
    },
    marksman: {
      f: 175,
      d: 0.16,
      w: "sawtooth",
      v: 0.4,
      slide: 50,
      nd: 0.15,
      nv: 0.92,
      nc: 0.55,
      tail: 0.34,
    },
    sniper: {
      f: 115,
      d: 0.24,
      w: "sawtooth",
      v: 0.46,
      slide: 38,
      nd: 0.18,
      nv: 1,
      nc: 0.5,
      tail: 0.42,
    },
  },
  ABIL_SFX = {
    ultw_beam: {
      f: 180,
      d: 0.09,
      w: "sawtooth",
      slide: 1400,
      nd: 0.08,
      nc: 7e3,
      nf: "highpass",
    },
    ultw_blade: {
      f: 1500,
      d: 0.1,
      w: "triangle",
      slide: 2600,
      nd: 0.06,
      nc: 8e3,
      nf: "highpass",
    },
    ultw_whip: { f: 900, d: 0.12, w: "square", slide: 160, nd: 0.12, nc: 3500 },
    ultw_flame: { f: 90, d: 0.1, w: "sawtooth", slide: 60, nd: 0.12, nc: 900 },
    ultw_bow: { f: 700, d: 0.3, w: "sine", slide: 2400, f2: 1400, slide2: 3e3 },
    _default: { f: 520, d: 0.16, w: "triangle", slide: 880 },
    bolt_jump: {
      f: 220,
      d: 0.18,
      w: "sawtooth",
      slide: 1600,
      nd: 0.18,
      nc: 6e3,
      nf: "highpass",
    },
    blink: {
      f: 1400,
      d: 0.1,
      w: "square",
      slide: 300,
      nd: 0.12,
      nc: 7e3,
      nf: "highpass",
    },
    static_orb: { f: 520, d: 0.16, w: "square", slide: 1400 },
    ult_lightning: {
      f: 90,
      d: 0.6,
      w: "sawtooth",
      slide: 1800,
      nd: 0.5,
      nc: 7e3,
      nf: "highpass",
    },
    decoy: { f: 880, d: 0.18, w: "sine", slide: 1320, f2: 1320, slide2: 880 },
    rift_wave: { f: 140, d: 0.34, w: "sawtooth", slide: 60, nd: 0.34, nc: 700 },
    mirror_pulse: {
      f: 1760,
      d: 0.2,
      w: "sine",
      slide: 880,
      f2: 2640,
      slide2: 1320,
    },
    ult_mirror: {
      f: 660,
      d: 0.5,
      w: "sine",
      slide: 2600,
      f2: 990,
      slide2: 3e3,
    },
    sand_smoke: { f: 180, d: 0.3, w: "sine", slide: 90, nd: 0.36, nc: 600 },
    quicksand: { f: 110, d: 0.4, w: "triangle", slide: 40, nd: 0.4, nc: 400 },
    sand_wall: { f: 90, d: 0.45, w: "sawtooth", slide: 60, nd: 0.5, nc: 500 },
    ult_tomb: { f: 60, d: 0.7, w: "sawtooth", slide: 30, nd: 0.6, nc: 500 },
    tripwire: { f: 1200, d: 0.08, w: "triangle", slide: 1800 },
    sound_sensor: {
      f: 988,
      d: 0.3,
      w: "sine",
      slide: 980,
      f2: 1480,
      slide2: 1470,
    },
    ripple_dome: {
      f: 440,
      d: 0.4,
      w: "sine",
      slide: 660,
      f2: 880,
      slide2: 1320,
    },
    ult_bell: { f: 196, d: 0.9, w: "sine", slide: 190, f2: 392, slide2: 388 },
    mag_turret: { f: 320, d: 0.2, w: "square", slide: 640 },
    mag_anchor: { f: 260, d: 0.22, w: "triangle", slide: 780 },
    mag_net: { f: 700, d: 0.14, w: "square", slide: 350, nd: 0.1, nc: 3e3 },
    ult_polarity: {
      f: 100,
      d: 0.6,
      w: "square",
      slide: 1600,
      nd: 0.3,
      nc: 2400,
    },
    blood_drain: {
      f: 180,
      d: 0.3,
      w: "sawtooth",
      slide: 120,
      nd: 0.2,
      nc: 900,
    },
    blood_eye: { f: 620, d: 0.16, w: "sine", slide: 200 },
    blood_orb: { f: 260, d: 0.18, w: "triangle", slide: 520 },
    ult_undying: {
      f: 80,
      d: 0.8,
      w: "sawtooth",
      slide: 260,
      nd: 0.4,
      nc: 1200,
    },
    scout_swarm: {
      f: 210,
      d: 0.4,
      w: "sawtooth",
      slide: 230,
      nd: 0.4,
      nc: 2e3,
      nf: "bandpass",
    },
    hunt_bee: {
      f: 240,
      d: 0.3,
      w: "sawtooth",
      slide: 300,
      nd: 0.25,
      nc: 2400,
      nf: "bandpass",
    },
    hive_trap: { f: 300, d: 0.16, w: "triangle", slide: 200 },
    ult_queen: {
      f: 120,
      d: 0.7,
      w: "sawtooth",
      slide: 260,
      nd: 0.6,
      nc: 1800,
      nf: "bandpass",
    },
    wall_fire: {
      f: 180,
      d: 0.26,
      w: "sawtooth",
      slide: 520,
      nd: 0.22,
      nc: 1800,
    },
    proj_fire: { f: 300, d: 0.14, w: "sawtooth", slide: 900 },
    smoke_fire: { f: 240, d: 0.3, w: "sine", slide: 140, nd: 0.3, nc: 900 },
    ult_fire: { f: 120, d: 0.5, w: "sawtooth", slide: 1400, nd: 0.4, nc: 2600 },
    trap_slow: { f: 900, d: 0.1, w: "sine", slide: 1500 },
    wall_ice: {
      f: 400,
      d: 0.3,
      w: "sine",
      slide: 1700,
      nd: 0.2,
      nc: 5200,
      nf: "highpass",
    },
    smoke_ice: {
      f: 700,
      d: 0.26,
      w: "sine",
      slide: 300,
      nd: 0.26,
      nc: 4200,
      nf: "highpass",
    },
    ult_ice: {
      f: 280,
      d: 0.5,
      w: "sine",
      slide: 2400,
      nd: 0.34,
      nc: 6200,
      nf: "highpass",
    },
    recon_dart: { f: 1100, d: 0.09, w: "square", slide: 2e3 },
    dash: {
      f: 600,
      d: 0.14,
      w: "sine",
      slide: 180,
      nd: 0.14,
      nc: 3400,
      nf: "highpass",
    },
    flash: {
      f: 1500,
      d: 0.1,
      w: "sine",
      slide: 3e3,
      nd: 0.12,
      nc: 8e3,
      nf: "highpass",
    },
    ult_recon: { f: 420, d: 0.45, w: "triangle", slide: 1800 },
    nade: { f: 420, d: 0.08, w: "square", slide: 260 },
    shield: { f: 260, d: 0.22, w: "square", slide: 520 },
    charge: { f: 170, d: 0.2, w: "sawtooth", slide: 760, nd: 0.18, nc: 1500 },
    ult_smash: {
      f: 90,
      d: 0.55,
      w: "sawtooth",
      slide: 300,
      nd: 0.45,
      nc: 1200,
    },
    heal: { f: 600, d: 0.26, w: "sine", slide: 1100 },
    root: { f: 200, d: 0.24, w: "triangle", slide: 520, nd: 0.16, nc: 1300 },
    smoke: { f: 320, d: 0.28, w: "sine", slide: 160, nd: 0.28, nc: 1e3 },
    ult_res: { f: 520, d: 0.5, w: "sine", slide: 1900 },
    emp: {
      f: 1300,
      d: 0.18,
      w: "square",
      slide: 200,
      nd: 0.16,
      nc: 6e3,
      nf: "highpass",
    },
    drone: { f: 820, d: 0.2, w: "triangle", slide: 1250 },
    mine: { f: 700, d: 0.09, w: "square", slide: 1300 },
    ult_emp: {
      f: 1600,
      d: 0.5,
      w: "square",
      slide: 120,
      nd: 0.4,
      nc: 7e3,
      nf: "highpass",
    },
    pierce: {
      f: 230,
      d: 0.18,
      w: "sawtooth",
      slide: 60,
      nd: 0.16,
      nc: 900,
      tail: 0.3,
    },
    sensor: { f: 1e3, d: 0.1, w: "sine", slide: 1700 },
    ult_snipe: { f: 200, d: 0.5, w: "sawtooth", slide: 820 },
  },
  STEP_SFX = {
    stone: { d: 0.055, v: 0.3, cut: 2200, f: 170 },
    metal: { d: 0.045, v: 0.34, cut: 5200, f: 520, filt: "highpass" },
    snow: { d: 0.075, v: 0.22, cut: 1300, f: 0 },
    sand: { d: 0.07, v: 0.2, cut: 1100, f: 0 },
    wood: { d: 0.05, v: 0.28, cut: 2600, f: 240 },
    water: { d: 0.09, v: 0.26, cut: 1800, f: 0 },
  },
  THEME_SURF = {
    glacier: "snow",
    dunes: "sand",
    freighter: "metal",
    neon: "water",
    garden: "stone",
    market: "stone",
    temple: "stone",
    harbor: "stone",
    forge: "metal",
    jungle: "sand",
  };
function surfaceAt(e) {
  try {
    return e && e.y > 0.6
      ? "wood"
      : THEME_SURF[(MAP && MAP.theme) || CUR_MAP_KEY] || "stone";
  } catch (e) {
    return "stone";
  }
}
const SPIKE = {
    PLANT: 4,
    DEFUSE: 7,
    HALF: 3.5,
    FUSE: 45,
    DEFUSE_R2: 12,
    PICK_R2: 6,
    MOVE_CANCEL: 1.1,
  },
  spikeMat = new T.MeshStandardMaterial({
    color: 16726862,
    emissive: 16726862,
    emissiveIntensity: 0.55,
  }),
  SPK_MAT = {
    shell: new T.MeshStandardMaterial({
      color: 2830392,
      roughness: 0.42,
      metalness: 0.75,
    }),
    plate: new T.MeshStandardMaterial({
      color: 4870492,
      roughness: 0.35,
      metalness: 0.8,
    }),
    glow: new T.MeshBasicMaterial({
      color: new T.Color(16726862).multiplyScalar(2.2),
    }),
    core: new T.MeshBasicMaterial({
      color: new T.Color(16765140).multiplyScalar(2.6),
    }),
  };
function buildSpikeRig(e) {
  const t = new T.Group(),
    o = e || 1,
    a = new T.Mesh(
      new T.CylinderGeometry(0.24 * o, 0.32 * o, 0.74 * o, 6),
      SPK_MAT.shell,
    );
  ((a.position.y = 0.42 * o), t.add(a));
  const n = new T.Mesh(
    new T.CylinderGeometry(0.16 * o, 0.24 * o, 0.14 * o, 6),
    SPK_MAT.plate,
  );
  ((n.position.y = 0.86 * o), t.add(n));
  const r = new T.Mesh(
    new T.ConeGeometry(0.16 * o, 0.34 * o, 6),
    SPK_MAT.shell,
  );
  ((r.position.y = 1.1 * o), t.add(r));
  const s = [];
  for (let e = 0; e < 6; e++) {
    const a = (e / 6) * Math.PI * 2 + Math.PI / 6,
      n = new T.Mesh(
        new T.BoxGeometry(0.035 * o, 0.5 * o, 0.02 * o),
        SPK_MAT.glow,
      );
    (n.position.set(0.265 * Math.cos(a) * o, 0.44 * o, 0.265 * Math.sin(a) * o),
      (n.rotation.y = -a + Math.PI / 2),
      (n.rotation.z = 0.06),
      t.add(n),
      s.push(n));
  }
  const i = new T.Mesh(new T.SphereGeometry(0.12 * o, 14, 10), SPK_MAT.core);
  ((i.position.y = 0.72 * o), t.add(i));
  const l = glowDot(16726862, 0.7 * o, 2);
  ((l.position.y = 0.72 * o), t.add(l));
  const c = [];
  for (let e = 0; e < 3; e++) {
    const a = (e / 3) * Math.PI * 2,
      n = new T.Group();
    (n.position.set(0.2 * Math.cos(a) * o, 0.2 * o, 0.2 * Math.sin(a) * o),
      (n.rotation.y = -a));
    const r = new T.Mesh(
      new T.BoxGeometry(0.07 * o, 0.46 * o, 0.07 * o),
      SPK_MAT.plate,
    );
    (r.position.set(0, -0.2 * o, 0), n.add(r));
    const s = new T.Mesh(
      new T.BoxGeometry(0.12 * o, 0.03 * o, 0.12 * o),
      SPK_MAT.shell,
    );
    (s.position.set(0, -0.43 * o, 0), n.add(s), t.add(n), c.push(n));
  }
  return { g: t, legs: c, core: i, halo: l, strips: s };
}
function spikeLegs(e, t) {
  for (const o of e.legs) o.rotation.z = -(0.08 + 0.62 * t);
}
function makeSpikeMesh() {
  const e = buildSpikeRig(1),
    t = e.g;
  (spikeLegs(e, 1), (t.userData.rig = e), (t.userData.core = e.core));
  const o = new T.Mesh(
    new T.RingGeometry(0.72, 0.98, 40),
    new T.MeshBasicMaterial({
      color: 16726862,
      transparent: !0,
      opacity: 0.45,
      side: T.DoubleSide,
      depthWrite: !1,
    }),
  );
  ((o.rotation.x = -Math.PI / 2),
    (o.position.y = 0.05),
    t.add(o),
    (t.userData.ring = o));
  const a = new T.Mesh(
    new T.RingGeometry(1.15, 1.28, 48, 1, 0, 1.6 * Math.PI),
    new T.MeshBasicMaterial({
      color: new T.Color(16726862).multiplyScalar(1.6),
      transparent: !0,
      opacity: 0.5,
      side: T.DoubleSide,
      depthWrite: !1,
    }),
  );
  ((a.rotation.x = -Math.PI / 2),
    (a.position.y = 0.06),
    t.add(a),
    (t.userData.tick = a));
  const n = new T.Mesh(
    new T.CylinderGeometry(0.06, 0.06, 26, 8, 1, !0),
    new T.MeshBasicMaterial({
      color: new T.Color(16726862).multiplyScalar(1.4),
      transparent: !0,
      opacity: 0.25,
      depthWrite: !1,
      side: T.DoubleSide,
    }),
  );
  return (
    (n.position.y = 13),
    (n.visible = !1),
    t.add(n),
    (t.userData.beam = n),
    (t.userData.light = { intensity: 0 }),
    (t.userData.keep = !0),
    (t.visible = !1),
    t.traverse((e) => {
      e.isMesh && (e.castShadow = !0);
    }),
    (o.castShadow = a.castShadow = n.castShadow = !1),
    scene.add(t),
    t
  );
}
function spikeDeployFx(e) {
  if (!e || !e.userData.rig) return;
  e.userData.rig;
  e.userData.deployT = 0;
  const t = e.position.x,
    o = e.position.z;
  (fxRing(t, o, 5, 16726862, 0.6),
    fxRing(t, o, 2.4, 16765140, 0.4),
    glowFlare(t, 0.8, o, 16726862, 3.2, 0.5),
    fxFlash(16726862, 3, 16, t, 1, o, 0.6, 1.5));
  for (let e = 0; e < 10; e++) {
    const a = glowDot(16739194, 0.22, 2),
      n = (e / 10) * Math.PI * 2,
      r = 2 + 2 * Math.random();
    (a.position.set(t, 0.3, o),
      addFx(a, 0.5, (e, a) => {
        (e.position.set(
          t + Math.cos(n) * r * a,
          0.3 + 2.2 * a - 3 * a * a,
          o + Math.sin(n) * r * a,
        ),
          (e.material.opacity = 1 - a));
      }));
  }
}
function tickSpikeMesh(e, t) {
  const o = t.mesh;
  if (!o || !o.visible) return;
  const a = o.userData.rig;
  if (void 0 !== o.userData.deployT && o.userData.deployT < 1) {
    o.userData.deployT = Math.min(1, o.userData.deployT + e / 0.7);
    const t = o.userData.deployT,
      n = 1 - Math.pow(1 - t, 3);
    (spikeLegs(a, n),
      o.scale.set(1, 0.6 + 0.4 * n, 1),
      (o.position.y = 0.25 * (1 - n)));
  }
  const n = o.userData.beam;
  (n &&
    ((n.visible = "planted" === t.state),
    n.visible &&
      (n.material.opacity =
        0.14 + 0.18 * Math.abs(Math.sin(3 * (world._clock || 0))))),
    o.userData.tick &&
      (o.userData.tick.rotation.z += e * ("planted" === t.state ? 1.8 : 0.4)),
    a && "planted" === t.state && t.halfDefused
      ? a.strips.forEach((e, t) => {
          e.visible = t % 2 == 0;
        })
      : a &&
        a.strips.forEach((e) => {
          e.visible = !0;
        }));
}
function actorPlantProp(e, t, o) {
  const a = e.model;
  if (!a) return;
  if (
    (e._plantProp && e._plantProp.m !== a && (e._plantProp = null),
    "none" === t && !e._plantProp)
  )
    return;
  if (!e._plantProp) {
    const t = buildSpikeRig(0.42);
    spikeLegs(t, 0);
    const o = new T.Group(),
      n = new T.Mesh(new T.BoxGeometry(0.16, 0.06, 0.24), SPK_MAT.shell);
    o.add(n);
    const r = new T.Mesh(
      new T.PlaneGeometry(0.12, 0.08),
      new T.MeshBasicMaterial({
        color: new T.Color(3718648).multiplyScalar(2.2),
      }),
    );
    ((r.rotation.x = -Math.PI / 2), (r.position.y = 0.032), o.add(r));
    const s = new T.Mesh(
      new T.CylinderGeometry(0.006, 0.006, 0.16, 5),
      SPK_MAT.plate,
    );
    (s.position.set(0.05, 0.08, 0.08),
      o.add(s),
      (e._plantProp = { spike: t, tool: o, m: a }),
      a.group.add(t.g),
      a.group.add(o));
  }
  const n = e._plantProp;
  ((n.spike.g.visible = "plant" === t),
    (n.tool.visible = "defuse" === t),
    "plant" === t
      ? (n.spike.g.position.set(0, 0.55 - 0.55 * o, -0.55),
        spikeLegs(n.spike, o))
      : "defuse" === t &&
        n.tool.position.set(
          0.08,
          0.42 + 0.01 * Math.sin(18 * (world._clock || 0)),
          -0.5,
        ));
}
Object.values(SPK_MAT).forEach((e) => {
  e.userData.keep = !0;
});
const VM_SPK = { grp: null, rig: null, tool: null, scr: null, aid: null };
function vmSpikeModel() {
  const e = (player && player.agent && player.agent.id) || "";
  if (VM_SPK.grp && VM_SPK.aid === e) return VM_SPK;
  VM_SPK.grp && VM.root.remove(VM_SPK.grp);
  const t = new T.Group(),
    o = (player && player.agent) || null,
    a = new T.Color(o && o.color ? o.color : "#8aa0b8"),
    n = (e, t) => {
      const o = "vm|" + e;
      return (
        CH_MAT.has(o) ||
          CH_MAT.set(
            o,
            new T.MeshStandardMaterial(Object.assign({ color: e }, t)),
          ),
        CH_MAT.get(o)
      );
    },
    r = n("#" + a.clone().lerp(new T.Color(2830393), 0.66).getHexString(), {
      roughness: 0.9,
      metalness: 0,
    }),
    s = n("#262a31", { roughness: 0.5, metalness: 0.1 }),
    i = chGlow("#" + a.getHexString(), 0.7),
    l = new T.Group();
  t.add(l);
  const c = buildSpikeRig(0.2);
  (c.g.position.set(0, -0.22, -0.5), l.add(c.g));
  const d = new T.Vector3(0.07, -0.12, -0.48),
    h = new T.Vector3(-0.07, -0.12, -0.48);
  (vmArm(l, d, d.clone().add(new T.Vector3(0.14, -0.26, 0.4)), r, s, i, !1),
    vmArm(l, h, h.clone().add(new T.Vector3(-0.14, -0.26, 0.4)), r, s, i, !0));
  const p = new T.Group();
  t.add(p);
  const u = new T.Group(),
    m = new T.Mesh(new T.BoxGeometry(0.1, 0.035, 0.15), SPK_MAT.shell);
  u.add(m);
  const f = new T.Mesh(
    new T.PlaneGeometry(0.075, 0.05),
    new T.MeshBasicMaterial({
      color: new T.Color(3718648).multiplyScalar(2.4),
    }),
  );
  ((f.rotation.x = -Math.PI / 2), (f.position.y = 0.019), u.add(f));
  const y = new T.Mesh(
    new T.CylinderGeometry(0.004, 0.004, 0.1, 5),
    SPK_MAT.plate,
  );
  (y.position.set(0.03, 0.05, 0.05), u.add(y));
  const M = glowDot(3718648, 0.05, 2.4);
  (M.position.set(0.03, 0.1, 0.05),
    u.add(M),
    u.position.set(0.05, -0.17, -0.42),
    (u.rotation.x = 0.95),
    (u.rotation.z = -0.15),
    p.add(u));
  const w = new T.Vector3(0.08, -0.21, -0.39),
    g = new T.Vector3(-0.09, -0.24, -0.45);
  return (
    vmArm(p, w, w.clone().add(new T.Vector3(0.14, -0.26, 0.4)), r, s, i, !1),
    vmArm(p, g, g.clone().add(new T.Vector3(-0.14, -0.26, 0.4)), r, s, i, !0),
    t.traverse((e) => {
      (e.isMesh || e.isSprite) &&
        ((e.castShadow = !1), (e.renderOrder = 999), (e.frustumCulled = !1));
    }),
    (t.visible = !1),
    VM.root.add(t),
    Object.assign(VM_SPK, {
      grp: t,
      plantG: l,
      defG: p,
      rig: c,
      tool: u,
      scr: f,
      led: M,
      aid: e,
    }),
    VM_SPK
  );
}
function tickVmSpike(e) {
  const t = world.spike,
    o =
      player.alive &&
      player.hasSpike &&
      "carried" === t.state &&
      (player.planting || 0) > 0,
    a = player.alive && "planted" === t.state && (player.defusing || 0) > 0;
  if (!o && !a) return (VM_SPK.grp && (VM_SPK.grp.visible = !1), !1);
  let n;
  try {
    n = vmSpikeModel();
  } catch (e) {
    return !1;
  }
  n.grp.visible = !0;
  const r = world._clock || 0;
  if (o) {
    ((n.plantG.visible = !0), (n.defG.visible = !1));
    const e = clamp(player.planting / SPIKE.PLANT, 0, 1),
      t = Math.min(1, 1.6 * e);
    (n.plantG.position.set(0, -0.06 * t, -0.04 * t),
      (n.plantG.rotation.x = -0.18 * t),
      spikeLegs(n.rig, Math.max(0, (e - 0.4) / 0.6)));
    const o = Math.abs(Math.sin(r * (4 + 14 * e)));
    (n.rig.core.scale.setScalar(0.8 + 0.5 * o),
      n.rig.halo.scale.setScalar(0.24 * (0.6 + 0.8 * o)));
  } else {
    ((n.plantG.visible = !1), (n.defG.visible = !0));
    const e = clamp(player.defusing / SPIKE.DEFUSE, 0, 1);
    (n.defG.position.set(
      0.004 * Math.sin(9 * r),
      -0.008 * Math.abs(Math.sin(14 * r)),
      0,
    ),
      n.scr.material.color
        .setHex(e >= 0.5 ? 4906624 : 3718648)
        .multiplyScalar(2.4),
      (n.led.visible = Math.sin(20 * r) > 0));
  }
  return !0;
}
function setCarrierMark(e, t) {
  if (e)
    if (t) {
      if (!e.spikeMark) {
        const t = new T.Mesh(
          new T.ConeGeometry(0.24, 0.46, 4),
          new T.MeshBasicMaterial({ color: 16726862 }),
        );
        ((t.position.y = 2.42),
          (t.rotation.x = Math.PI),
          e.group.add(t),
          (e.spikeMark = t));
      }
      e.spikeMark.visible = !0;
    } else e.spikeMark && (e.spikeMark.visible = !1);
}
function siteAt(e, t) {
  for (const o of MAP.sites) if (dist2(e, t, o.x, o.z) < o.r * o.r) return o;
  return null;
}
function spikeDropOnDeath(e) {
  if (!e || !e.hasSpike) return;
  e.hasSpike = !1;
  try {
    setCarrierMark(e, !1);
  } catch (e) {}
  const t = (world.actors || []).filter(
    (t) => t !== e && t.alive && "atk" === t.team && t.hasSpike,
  );
  if (t.length)
    return (
      (world.spike.state = "carried"),
      void (world.spike.carrier = t.find((e) => !isAI(e)) || t[0])
    );
  dropSpike(e.pos.x, e.pos.z);
}
function dropSpike(e, t) {
  const o = world.spike;
  ((o.state = "dropped"),
    (o.x = e),
    (o.z = t),
    (o.carrier = null),
    o.mesh || (o.mesh = makeSpikeMesh()),
    o.mesh.parent || scene.add(o.mesh),
    (o.mesh.visible = !0),
    o.mesh.position.set(e, 0, t),
    o.mesh.scale.set(1, 1, 1),
    (o.mesh.userData.deployT = 1));
  try {
    spikeLegs(o.mesh.userData.rig, 0);
  } catch (e) {}
  ((o.mesh.userData.light.intensity = 0.8),
    o.mesh.userData.core && o.mesh.userData.core.scale.setScalar(1),
    SFX.drop(),
    banner("스파이크 낙하", "#ff9a3c"));
}
function pickupSpike(e) {
  const t = world.spike;
  ((t.state = "carried"),
    setTimeout(() => {
      try {
        (world.actors || []).forEach((e) => {
          if (e.alive && "atk" === e.team) {
            e.hasSpike = !0;
            try {
              setCarrierMark(e, !0);
            } catch (e) {}
          }
        });
      } catch (e) {}
    }, 0),
    t.mesh && ((t.mesh.visible = !1), (t.mesh.userData.light.intensity = 0)),
    "player" === e
      ? ((player.hasSpike = !0),
        (t.carrier = "player"),
        SFX.pick(),
        banner("스파이크 회수", "#ff3b4e"))
      : ((e.hasSpike = !0),
        (e.plantCd = 0),
        (t.carrier = e),
        setCarrierMark(e, !0)));
}
function plantSpike(e, t, o, a) {
  const n = world.spike;
  ((n.state = "planted"),
    (n.x = e),
    (n.z = t),
    (n.timer = SPIKE.FUSE),
    (n.planterSite = o ? o.id : "?"),
    (n.halfDefused = !1),
    (n.beepT = 0),
    (n.defTick = 0),
    (n.carrier = null),
    n.mesh || (n.mesh = makeSpikeMesh()),
    n.mesh.parent || scene.add(n.mesh),
    (n.mesh.visible = !0),
    n.mesh.position.set(e, 0, t));
  try {
    spikeDeployFx(n.mesh);
  } catch (e) {}
  ((player.hasSpike = !1),
    (player.planting = 0),
    (player.plantAnchor = null),
    world.entities.forEach((e) => {
      e.hasSpike && ((e.hasSpike = !1), setCarrierMark(e, !1));
    }),
    world.actors &&
      world.actors.forEach((e) => {
        if (e.hasSpike) {
          e.hasSpike = !1;
          try {
            setCarrierMark(e, !1);
          } catch (e) {}
        }
        ((e.planting = 0), (e.plantAnchor = null));
      }),
    a && ((player.credits += 300), chargeUlt(2)),
    SFX.planted(),
    banner(`${n.planterSite} 사이트 설치 완료`, "#ff3b4e"),
    world.entities.forEach((e) => {
      "def" === e.team &&
        ((e.alertT = 10), (e.path = []), (e.repathCd = 0), (e.defuseT = 0));
    }),
    world.actors &&
      world.actors.forEach((e) => {
        "def" === e.team &&
          e.ai &&
          ((e.ai.alertT = 10),
          (e.ai.path = []),
          (e.ai.repathCd = 0),
          (e.ai.defuseT = 0));
      }));
}
function defuseDone(e) {
  const t = world.spike;
  world.over ||
    ((t.state = "defused"),
    t.mesh && ((t.mesh.visible = !1), (t.mesh.userData.light.intensity = 0)),
    (player.defusing = 0),
    world.entities.forEach((e) => (e.defuseT = 0)),
    world.actors &&
      world.actors.forEach((e) => {
        ((e.defusing = 0), e.ai && (e.ai.defuseT = 0));
      }),
    SFX.defused(),
    "player" === e && chargeUlt(2),
    endRound("def", "player" === e ? "스파이크 해제" : "스파이크 해제됨"));
}
function detonate() {
  const e = world.spike;
  if (world.over) return;
  const t = e.x,
    o = e.z;
  ((e.state = "boom"),
    e.mesh && ((e.mesh.visible = !1), (e.mesh.userData.light.intensity = 0)),
    SFX.boom(),
    screenShake(1.8),
    fxFlash(16760954, 55, 110, t, 5, o, 0.8, 1.4));
  const a = new T.Mesh(
    new T.SphereGeometry(5.5, 20, 16),
    new T.MeshBasicMaterial({ color: 16765066, transparent: !0 }),
  );
  (a.position.set(t, 3, o),
    addFx(a, 0.95, (e, t) => {
      (e.scale.setScalar(1 + 5.4 * t), (e.material.opacity = 0.92 * (1 - t)));
    }));
  const n = new T.Mesh(
    new T.RingGeometry(1, 2.4, 44),
    new T.MeshBasicMaterial({
      color: 16758881,
      transparent: !0,
      side: T.DoubleSide,
    }),
  );
  ((n.rotation.x = -Math.PI / 2),
    n.position.set(t, 0.25, o),
    addFx(n, 1.15, (e, t) => {
      (e.scale.setScalar(1 + 26 * t), (e.material.opacity = 0.8 * (1 - t)));
    }));
  for (let e = 0; e < 28; e++) {
    const a = new T.Mesh(
      new T.SphereGeometry(rnd(0.18, 0.5), 6, 5),
      new T.MeshBasicMaterial({
        color: e % 3 ? 16747068 : 16765066,
        transparent: !0,
      }),
    );
    a.position.set(t, 1.4, o);
    const n = new T.Vector3(rnd(-17, 17), rnd(7, 21), rnd(-17, 17));
    addFx(a, 1.35, (e, t, o) => {
      ((n.y -= 23 * o),
        e.position.addScaledVector(n, o),
        (e.material.opacity = 1 - t));
    });
  }
  endRound("atk", "스파이크 폭발");
}
function spikeUI(e, t, o, a, n) {
  $("spike").classList.add("on");
  const r = $("sp-txt");
  ((r.textContent = e), (r.style.color = t));
  const s = $("sp-bar").firstElementChild;
  ((s.style.width = 100 * clamp(o, 0, 1) + "%"), (s.style.background = a));
  const i = $("sp-mark");
  i && (i.style.display = n ? "block" : "none");
}
function handleSpike(e) {
  const t = world.spike,
    o = "live" === world.phase,
    a =
      player &&
      "function" == typeof isAI &&
      void 0 !== player.ctrl &&
      isAI(player);
  try {
    tickSpikeMesh(e, t);
  } catch (e) {}
  if ("planted" === t.state) {
    if (o && !world.over) {
      t.timer -= e;
      const o =
        t.timer > 25 ? 1 : t.timer > 12 ? 0.55 : t.timer > 5 ? 0.3 : 0.16;
      ((t.beepT -= e),
        t.beepT <= 0 &&
          ((t.beepT = o),
          SFX.beep(t.timer < 12),
          fxFlash(
            16726862,
            t.timer < 12 ? 1.6 : 1,
            14,
            t.x,
            0.9,
            t.z,
            Math.min(0.3, 0.6 * o),
            2,
          )));
    }
    if (t.mesh) {
      const o = 1 - clamp(t.timer / SPIKE.FUSE, 0, 1),
        a = Math.abs(Math.sin(t.timer * (2.2 + 10 * o)));
      ((t.mesh.rotation.y += 1.5 * e),
        t.mesh.userData.core &&
          t.mesh.userData.core.scale.setScalar(0.85 + 0.75 * a),
        (t.mesh.userData.light.intensity = 1.1 + 3.6 * a));
      const n = t.mesh.userData.ring;
      n &&
        ((n.material.opacity = 0.22 + 0.5 * a),
        n.scale.setScalar(1 + 0.55 * o));
    }
  }
  if (!o)
    return void ("planted" !== t.state && $("spike").classList.remove("on"));
  const n = !!keys.f;
  if (
    (!a &&
      "dropped" === t.state &&
      player.alive &&
      "atk" === player.team &&
      dist2(player.pos.x, player.pos.z, t.x, t.z) < SPIKE.PICK_R2 &&
      pickupSpike("player"),
    !a && "carried" === t.state && player.hasSpike && player.alive)
  ) {
    const t = siteAt(player.pos.x, player.pos.z);
    if (!t)
      return (
        (player.planting = 0),
        (player.plantAnchor = null),
        void spikeUI(
          "스파이크 소지 · 사이트 안에서 4 또는 F를 눌러 설치",
          "#8a97ab",
          0,
          "#5b6879",
        )
      );
    // planting is never automatic: 4 or F must be held, in place, inside the site; letting go stops it
    if (!(keys.f || keys["4"]))
      return (
        (player.planting = 0),
        (player.plantAnchor = null),
        void spikeUI(
          `${t.id} 사이트 · 4 또는 F를 누르고 있으면 설치`,
          "#ffc849",
          0,
          "#ffc849",
        )
      );
    if (player.plantAnchor) {
      if (
        dist2(
          player.pos.x,
          player.pos.z,
          player.plantAnchor.x,
          player.plantAnchor.z,
        ) >
        SPIKE.MOVE_CANCEL * SPIKE.MOVE_CANCEL
      )
        return (
          (player.plantAnchor = { x: player.pos.x, z: player.pos.z }),
          void spikeUI(
            `${t.id} 사이트 · 멈추면 설치 진행`,
            "#ffc849",
            player.planting / SPIKE.PLANT,
            "#ffc849",
          )
        );
    } else
      ((player.plantAnchor = { x: player.pos.x, z: player.pos.z }),
        SFX.plantStart());
    return (
      (player.planting += e),
      player.planting >= SPIKE.PLANT
        ? void plantSpike(player.pos.x, player.pos.z, t, !0)
        : void spikeUI(
            `${t.id} 사이트 설치 중 · ${(SPIKE.PLANT - player.planting).toFixed(1)}초`,
            "#ff3b4e",
            player.planting / SPIKE.PLANT,
            "#ff3b4e",
          )
    );
  }
  if ("planted" === t.state) {
    const o =
      player.alive &&
      "def" === player.team &&
      dist2(player.pos.x, player.pos.z, t.x, t.z) < SPIKE.DEFUSE_R2;
    if (o && n) {
      player.defusing <= 0 &&
        (player.defusing = t.halfDefused ? SPIKE.HALF : 0);
      const o = player.defusing;
      return (
        (player.defusing += e),
        o < SPIKE.HALF &&
          player.defusing >= SPIKE.HALF &&
          !t.halfDefused &&
          ((t.halfDefused = !0),
          SFX.half(),
          banner("절반 해제 — 여기서 재개됩니다", "#38bdf8")),
        (t.defTick -= e),
        t.defTick <= 0 && ((t.defTick = 0.26), SFX.defuseTick()),
        player.defusing >= SPIKE.DEFUSE
          ? void defuseDone("player")
          : void spikeUI(
              `해제 중 · ${(SPIKE.DEFUSE - player.defusing).toFixed(1)}초 남음`,
              "#38bdf8",
              player.defusing / SPIKE.DEFUSE,
              "#38bdf8",
              !0,
            )
      );
    }
    player.defusing > 0 &&
      ((player.defusing = 0),
      banner(
        t.halfDefused ? "해제 중단 · 절반 지점 유지" : "해제 중단",
        "#ffc849",
      ));
    const a = Math.max(0, t.timer),
      r = a < 10;
    return (
      spikeUI(
        "def" === player.team && player.alive && !o
          ? `스파이크 작동 중 · ${a.toFixed(1)}초 — 접근해 F`
          : `스파이크 작동 중 · ${a.toFixed(1)}초`,
        r ? "#ff3b4e" : "#ff6b4a",
        a / SPIKE.FUSE,
        r ? "#ff3b4e" : "#ff6b4a",
        t.halfDefused,
      ),
      void (t.timer <= 0 && detonate())
    );
  }
  "dropped" !== t.state || "atk" !== player.team
    ? $("spike").classList.remove("on")
    : spikeUI("스파이크 낙하 — 회수 필요", "#ff9a3c", 0, "#ff9a3c");
}
function handleBotSpike(e, t) {
  const o = world.spike;
  if ("live" === world.phase && e.alive && !world.over)
    if ("atk" !== e.team) {
      if ("planted" === o.state)
        if (dist2(e.pos.x, e.pos.z, o.x, o.z) < SPIKE.DEFUSE_R2 + 5) {
          e.defuseT || (e.defuseT = o.halfDefused ? SPIKE.HALF : 0);
          const a = e.defuseT;
          ((e.defuseT += t),
            a < SPIKE.HALF && e.defuseT >= SPIKE.HALF && (o.halfDefused = !0),
            e.defuseT >= SPIKE.DEFUSE + 1.2 && defuseDone("bot"));
        } else e.defuseT = 0;
    } else {
      if (
        "dropped" === o.state &&
        dist2(e.pos.x, e.pos.z, o.x, o.z) < SPIKE.PICK_R2 + 3
      )
        return void pickupSpike(e);
      if (e.hasSpike && "carried" === o.state) {
        const o = siteAt(e.pos.x, e.pos.z);
        o
          ? ((e.plantCd += t),
            e.plantCd >= SPIKE.PLANT + 0.8 &&
              plantSpike(e.pos.x, e.pos.z, o, !1))
          : (e.plantCd = 0);
      }
    }
}
function botGoal(e) {
  const t = world.spike;
  return "atk" === e.team
    ? "planted" === t.state
      ? { x: t.x, z: t.z }
      : e.hasSpike
        ? e.assignedSite
        : "dropped" === t.state
          ? { x: t.x, z: t.z }
          : t.carrier && "player" !== t.carrier && t.carrier.alive
            ? { x: t.carrier.pos.x, z: t.carrier.pos.z }
            : e.assignedSite
    : "planted" === t.state
      ? { x: t.x, z: t.z }
      : e.alertT > 0 && e.lastSeen
        ? e.lastSeen
        : e.assignedSite;
}
const BUY_TIME = 14,
  ROUND_TIME = 100;
function resetActorsForRound() {
  const e = MAP.sites,
    t = e[Math.floor(Math.random() * e.length)],
    o = { atk: 0, def: 0 };
  for (const a of world.actors) {
    const n = o[a.team]++,
      r = spawnPointFor(a.team, n);
    (a.pos.set(r.x + rnd(-2.5, 2.5), 0, r.z + rnd(-2, 2)),
      collideXZ(a.pos.x, a.pos.z, 0.3, PR + 0.1) && a.pos.set(r.x, 0, r.z),
      (a.y = 0),
      (a.vy = 0),
      (a.onGround = !0),
      a.vel && a.vel.set(0, 0, 0),
      (a.hp = 100),
      (a.armor = 0),
      (a.alive = !0),
      (a.blind = 0),
      (a.root = 0),
      (a.shielded = 0),
      (a.invuln = 0),
      (a.slow = 1),
      (a.silenced = 0),
      clearStatus(a),
      (a.revealed = 0),
      (a.reloading = 0),
      (a.fireCd = 0),
      (a.burstLeft = 0),
      (a.recoil = 0),
      (a.recoilY = 0),
      (a.crouch = !1),
      (a.ads = !1),
      (a.planting = 0),
      (a.defusing = 0),
      (a.plantAnchor = null),
      (a.hasSpike = !1),
      (a.yaw = r.yaw),
      (a.pitch = 0),
      a.input &&
        ((a.input.mv = [0, 0]),
        (a.input.btn = 0),
        (a.input.yaw = a.yaw),
        (a.input.pitch = 0)),
      a.group && (a.group.visible = !0),
      delete a._deadT,
      a.model &&
        a.model.hips &&
        ((a.model.hips.rotation.x = 0), (a.model.hips.position.y = 0.92)),
      a.group && ((a.group.rotation.x = 0), (a.group.rotation.z = 0)),
      a.model && a.model.gun && (a.model.gun.visible = !0),
      (a._landT = 0),
      (a._hitT = 0));
    for (const e in a.ammo)
      WEAPONS[e] && ((a.ammo[e] = WEAPONS[e].mag), (a.reserve[e] = 999999));
    topUpReserve(a);
    const s = (a.credits || 0) >= 999999;
    if (
      (a.abilities &&
        a.abilities.forEach((e) => {
          ((e.cd = 0),
            (e.charges = e.def.ult
              ? 0
              : s || !e.def.cost
                ? e.def.charges || 1
                : 0));
        }),
      isAI(a))
    )
      if (((a.ai = freshAIState()), "atk" === a.team))
        a.ai.site = { x: t.x + rnd(-5, 5), z: t.z + rnd(-5, 5) };
      else {
        const t = e[n % e.length];
        a.ai.site = { x: t.x + rnd(-6, 6), z: t.z + rnd(-6, 6) };
      }
    if ("function" == typeof setCarrierMark)
      try {
        setCarrierMark(a, !1);
      } catch (e) {}
    "function" == typeof syncActorModel && syncActorModel(a);
  }
  const a = world.actors.filter((e) => "atk" === e.team && e.alive);
  if (a.length) {
    a.forEach((e) => {
      if (((e.hasSpike = !0), "function" == typeof setCarrierMark))
        try {
          setCarrierMark(e, !0);
        } catch (e) {}
    });
    const e = a.find((e) => !isAI(e));
    world.spike.carrier = e || a[0];
  }
  ("object" == typeof SWEEP &&
    ((SWEEP.on = !1), (SWEEP.t = 0), (SWEEP.check = 0)),
    "function" == typeof intelClear && intelClear());
  try {
    aiBuyAll();
  } catch (e) {
    console.warn("aiBuy", e);
  }
}
let roundEndTimer = null;
function cancelRoundEnd() {
  if (roundEndTimer !== null) clearTimeout(roundEndTimer);
  roundEndTimer = null;
}
function scheduleMatchFinish(ms = 2600) {
  cancelRoundEnd();
  const actors = world.actors, round = world.round, map = CUR_MAP_KEY, mode = room.mode;
  roundEndTimer = setTimeout(() => {
    roundEndTimer = null;
    if (NET.mode !== 'client' && world.actors === actors && world.round === round && CUR_MAP_KEY === map && room.mode === mode && world.over && world.phase === 'end') gameOver();
  }, ms);
}
function startRound() {
  cancelRoundEnd();
  world.championsFinishUntil = 0;
  ((world.phase = "buy"),
    (world.roundTime = 14),
    (world.over = !1),
    world.zones.forEach((e) => scene.remove(e.mesh)),
    (world.zones = []),
    world.smokes.forEach((e) => scene.remove(e.mesh)),
    (world.smokes = []),
    world.props.forEach((e) => {
      (scene.remove(e.mesh), e.ring && scene.remove(e.ring));
    }),
    (world.props = []),
    abilClear(),
    COLLIDERS.filter((e) => e.temp).forEach(destroyCollider));
  const e = world.spike;
  ((e.state = "carried"),
    (e.timer = 0),
    (e.planterSite = null),
    (e.halfDefused = !1),
    (e.beepT = 0),
    (e.defTick = 0),
    (e.carrier = null),
    e.mesh && ((e.mesh.visible = !1), (e.mesh.userData.light.intensity = 0)),
    $("spike").classList.remove("on"));
  const t = world.actors && world.actors.length > 0;
  t && resetActorsForRound();
  const o = "atk" === player.team ? MAP.attackSpawn : MAP.defendSpawn;
  (t || player.pos.set(o.x + rnd(-4, 4), 0, o.z + rnd(-3, 3)),
    (player.y = 0),
    (player.vy = 0),
    (player.hp = 100),
    (player.alive = !0),
    (player.blind = 0),
    (player.root = 0),
    (player.shielded = 0),
    (player.invuln = 0),
    (player.silenced = 0),
    (player.slow = 1),
    (player.speedBuff = 1),
    (player.speedBuffT = 0),
    (player.planting = 0),
    (player.defusing = 0),
    (player.ultSnipe = 0),
    (player.plantAnchor = null),
    t ||
      ((player.hasSpike = "atk" === player.team),
      player.hasSpike && (e.carrier = "player")),
    (player.reloading = 0),
    (player.spectate = null),
    (player.spectateT = 0));
  const a = document.getElementById("spectate");
  a && a.classList.remove("on");
  const n = document.getElementById("scope");
  (n && n.classList.remove("on"),
    (player.ads = !1),
    (keys.ads = !1),
    document.getElementById("hud").classList.remove("dead"),
    touch.on &&
      ((touch.move.x = 0), (touch.move.y = 0), (keys.fire = !1), (keys.f = !1)),
    t ||
      ((player.yaw = "atk" === player.team ? Math.PI : 0), (player.pitch = 0)),
    Object.keys(player.ammo).forEach((e) => {
      ((player.ammo[e] = WEAPONS[e].mag), (player.reserve[e] = 999999));
    }),
    topUpReserve(player),
    t ||
      player.abilities.forEach((e) => {
        ((e.cd = 0),
          e.def.cost ? (e.charges = 0) : (e.charges = e.def.charges));
      }));
  const r = MAP.sites;
  let s = r[Math.floor(Math.random() * r.length)];
  if (
    (t ||
      world.entities.forEach((e, t) => {
        ((e.alive = !0),
          (e.hp = 100),
          (e.armor = 25),
          (e.group.visible = !0),
          (e.blind = 0),
          (e.root = 0),
          (e.slow = 1),
          (e.slowT = 0),
          (e.revealed = 0),
          (e.alertT = 0),
          (e.shielded = 0),
          (e.plantCd = 0),
          (e.path = []),
          (e.repathCd = 0),
          (e.burst = 0),
          (e.skill.cd = rnd(6, 16)),
          (e.hasSpike = !1),
          (e.lastSeen = null),
          (e.defuseT = 0),
          setCarrierMark(e, !1));
        const o = "atk" === e.team ? MAP.attackSpawn : MAP.defendSpawn;
        if (
          (e.pos.set(o.x + rnd(-7, 7), 0, o.z + rnd(-4, 4)),
          (e.y = 0),
          "atk" === e.team)
        )
          e.assignedSite = { x: s.x + rnd(-5, 5), z: s.z + rnd(-5, 5) };
        else {
          const o = r[t % r.length];
          e.assignedSite = { x: o.x + rnd(-6, 6), z: o.z + rnd(-6, 6) };
        }
      }),
    !t && "def" === player.team)
  ) {
    const t = world.entities.find((e) => "atk" === e.team);
    t && ((t.hasSpike = !0), (e.carrier = t), setCarrierMark(t, !0));
  }
  (openShop(),
    banner(`${world.round} 라운드 · 구매 단계`, "#ffc849"),
    updateHUD());
}
function endRound(e, t) {
  if (world.over) return;
  ((world.over = !0),
    (world.phase = "end"),
    closeShop(),
    "atk" === e ? world.scoreAtk++ : world.scoreDef++);
  const o = e === player.team;
  ((player.credits = 999999),
    chargeUlt(o ? 2 : 1),
    banner(
      o ? `라운드 승리 · ${t}` : `라운드 패배 · ${t}`,
      o ? "#4ade80" : "#ff3b4e",
    ),
    updateHUD());
  const endedRound = world.round;
  const delay = Math.max(3600, (world.championsFinishUntil || 0) - performance.now());
  roundEndTimer = setTimeout(() => {
      roundEndTimer = null;
      if (world.phase !== "end" || world.round !== endedRound || NET.mode === "client") return;
      const e = winRounds();
      if (world.scoreAtk >= e || world.scoreDef >= e) gameOver();
      else {
        if ((world.round++, world.round === halfTime())) {
          const e = (e) => ("atk" === e ? "def" : "atk"),
            t = (e, t) => {
              if (!e) return;
              const o = "atk" === t ? 16739146 : 3718648;
              (e.torso &&
                (e.torso.material = new T.MeshStandardMaterial({
                  color: o,
                  roughness: 0.62,
                  metalness: 0.22,
                })),
                e.visor && e.visor.material.color.setHex(o));
            };
          if (world.actors && world.actors.length) {
            world.actors.forEach((o) => {
              ((o.team = e(o.team)), t(o.model, o.team));
            });
            const o = room.slots.atk.slice(),
              a = room.slots.def.slice();
            ((room.slots.atk = a), (room.slots.def = o));
            for (const [, t] of room.members) t.team = e(t.team);
            rosterKey = "";
          } else
            ((player.team = e(player.team)),
              world.entities.forEach((o) => {
                ((o.team = e(o.team)), t(o.model, o.team));
              }));
          {
            const __s = world.scoreAtk;
            ((world.scoreAtk = world.scoreDef), (world.scoreDef = __s));
          }
          "host" === NET.mode &&
            sendEventAll({ t: "half", sa: world.scoreAtk, sd: world.scoreDef });
          banner("진영 교대", "#ffc849");
        }
        startRound();
      }
    }, delay);
}
function checkRoundEnd() {
  if (world.over || "live" !== world.phase) return;
  let e, t;
  world.actors && world.actors.length
    ? ((e = world.actors.filter((e) => e.alive && "atk" === e.team).length),
      (t = world.actors.filter((e) => e.alive && "def" === e.team).length))
    : ((e =
        ("atk" === player.team && player.alive ? 1 : 0) +
        world.entities.filter((e) => e.alive && "atk" === e.team).length),
      (t =
        ("def" === player.team && player.alive ? 1 : 0) +
        world.entities.filter((e) => e.alive && "def" === e.team).length));
  const o = "planted" === world.spike.state;
  0 !== e || o
    ? 0 === t
      ? endRound("atk", "수비팀 전멸")
      : world.roundTime <= 0 && !o && endRound("def", "시간 초과")
    : endRound("def", "공격팀 전멸");
}
function winRounds() {
  const e =
    "object" == typeof room && room && room.rounds ? 0 | room.rounds : 13;
  return e >= 1 && e <= 30 ? e : 13;
}
function halfTime() {
  return Math.max(2, Math.ceil((12 * winRounds()) / 13));
}
function gameOver() {
  cancelRoundEnd();
  ((world.phase = "over"), document.exitPointerLock());
  const e =
    ("atk" === player.team ? world.scoreAtk : world.scoreDef) >= winRounds();
  (($("ov-head").textContent = e ? "승리" : "패배"),
    ($("ov-head").style.color = e ? "#4ade80" : "#ff3b4e"));
  const t = "atk" === player.team ? world.scoreAtk : world.scoreDef,
    o = "atk" === player.team ? world.scoreDef : world.scoreAtk;
  (($("ov-score").textContent = `${t} : ${o}`),
    ($("ov-k").textContent = world.stats.kills),
    ($("ov-d").textContent = world.stats.deaths),
    ($("ov-dmg").textContent = world.stats.dmg),
    ($("ov-acc").textContent = world.stats.shots
      ? Math.round((world.stats.hits / world.stats.shots) * 100) + "%"
      : "0%"),
    show("s-over"));
}
let bannerT = 0;
function banner(e, t) {
  if (CASTER) return;
  const o = $("banner");
  ((o.textContent = e),
    (o.style.color = t || "#fff"),
    o.classList.add("show"),
    (bannerT = 1.9));
}
function pushKill(e, t) {
  const o = document.createElement("div");
  o.className = "kl";
  const a = document.createElement("span");
  ((a.style.color = "#ff6b4a"), (a.textContent = String(null == e ? "" : e)));
  const n = document.createElement("span");
  ((n.style.cssText = "color:#5b6879;margin:0 7px"), (n.textContent = "▸"));
  const r = document.createElement("span");
  for (
    r.style.color = "#8a97ab",
      r.textContent = String(null == t ? "" : t),
      o.append(a, " ", n, " ", r),
      $("klog").prepend(o),
      setTimeout(() => o.remove(), 5200);
    $("klog").children.length > 5;

  )
    $("klog").lastElementChild.remove();
}
let shopOpen = !1;
function toggleShop() {
  shopOpen ? closeShop() : openShop();
}
function openShop() {
  "buy" === world.phase &&
    player.alive &&
    ((shopOpen = !0),
    ($("shop").hidden = !1),
    document.exitPointerLock(),
    renderShop());
}
function closeShop() {
  ((shopOpen = !1),
    ($("shop").hidden = !0),
    ["buy", "live"].includes(world.phase) && !world.over && $("pause").hidden && $("admin").hidden && $("lobby").hidden && tryLock());
}
const TEAM_SIZE = 5;
function normalizeActor(e, t, o, a) {
  return (
    (e.id = t),
    (e.team = o),
    (e.ctrl = a),
    void 0 === e.weapons &&
      (e.weapons = { primary: null, secondary: "pistol" }),
    void 0 === e.ammo && (e.ammo = {}),
    void 0 === e.reserve && (e.reserve = {}),
    void 0 === e.slot && (e.slot = "secondary"),
    void 0 === e.credits && (e.credits = 999999),
    void 0 === e.abilities && (e.abilities = []),
    void 0 === e.ultCharge && (e.ultCharge = 0),
    void 0 === e.pitch && (e.pitch = 0),
    void 0 === e.reloading && (e.reloading = 0),
    void 0 === e.fireCd && (e.fireCd = 0),
    void 0 === e.crouch && (e.crouch = !1),
    void 0 === e.slow && (e.slow = 1),
    void 0 === e.slowT && (e.slowT = 0),
    void 0 === e.speedBuff && (e.speedBuff = 1),
    void 0 === e.speedBuffT && (e.speedBuffT = 0),
    void 0 === e.silenced && (e.silenced = 0),
    void 0 === e.ultSnipe && (e.ultSnipe = 0),
    void 0 === e.ultSnipeT && (e.ultSnipeT = 0),
    void 0 === e.blind && (e.blind = 0),
    void 0 === e.root && (e.root = 0),
    void 0 === e.shielded && (e.shielded = 0),
    void 0 === e.invuln && (e.invuln = 0),
    void 0 === e.revealed && (e.revealed = 0),
    void 0 === e.hasSpike && (e.hasSpike = !1),
    (e.input = e.input || { mv: [0, 0], yaw: 0, pitch: 0, btn: 0, seq: 0 }),
    e
  );
}
const isAI = (e) => "ai" === e.ctrl,
  isLocal = (e) => "me" === e.ctrl,
  isHuman = (e) => "ai" !== e.ctrl;
function allActors() {
  return world.actors;
}
function actorById(e) {
  return world.actors.find((t) => t.id === e);
}
function teamActors(e) {
  return world.actors.filter((t) => t.team === e);
}
function livingOf(e) {
  return world.actors.filter((t) => t.team === e && t.alive);
}
function humanCount(e) {
  return world.actors.filter((t) => t.team === e && isHuman(t)).length;
}
function takeOver(e, t) {
  const o = actorById(e);
  return o && isAI(o)
    ? ((o.ctrl = t),
      (o.ai = null),
      (o.input = {
        mv: [0, 0],
        yaw: o.yaw,
        pitch: o.pitch || 0,
        btn: 0,
        seq: 0,
      }),
      o)
    : null;
}
function releaseToAI(e) {
  const t = actorById(e);
  return t ? ((t.ctrl = "ai"), (t.ai = freshAIState()), t) : null;
}
function freshAIState() {
  return {
    target: null,
    state: "advance",
    path: [],
    pathIdx: 0,
    repathCd: 0,
    burst: 0,
    reactCd: 0,
    accuracy: 0.055,
    strafe: rnd(-1, 1),
    strafeCd: 0,
    skill: { cd: rnd(4, 14) },
    lastSeen: null,
    alertT: 0,
  };
}
function canJoinTeam(e) {
  const t = "atk" === e ? "def" : "atk";
  return (
    !(teamActors(e).filter((e) => isHuman(e)).length >= TEAM_SIZE) &&
    humanCount(e) - humanCount(t) < 1
  );
}
function autoTeam() {
  return humanCount("atk") <= humanCount("def") ? "atk" : "def";
}
function freeSlotIn(e) {
  const t = world.actors.filter((t) => t.team === e && isAI(t));
  return t.find((e) => e.alive) || t[0] || null;
}
function spawnPointFor(e, t) {
  const o = "atk" === e ? MAP.attackSpawn : MAP.defendSpawn,
    a = "atk" === e ? MAP.defendSpawn : MAP.attackSpawn,
    n = Math.atan2(-(a.x - o.x), -(a.z - o.z)),
    r = Math.cos(n),
    s = -Math.sin(n),
    i = 4.2 * (t - (TEAM_SIZE - 1) / 2);
  let l = o.x + r * i,
    c = o.z + s * i;
  if ("function" == typeof collideXZ) {
    const e = -Math.sin(n),
      t = -Math.cos(n);
    let o = !collideXZ(l, c, 0, 0.5);
    for (let a = 1; a <= 8 && !o; a++) {
      const n = (a % 2 ? 1 : -1) * Math.ceil(a / 2) * 1.6,
        r = l + e * n,
        s = c + t * n;
      collideXZ(r, s, 0, 0.5) || ((l = r), (c = s), (o = !0));
    }
    const a = PR + 0.15;
    if (collideXZ(l, c, 0.3, a)) {
      let e = !1;
      for (let t = 1; t <= 14 && !e; t += 0.75)
        for (let o = 0; o < 20; o++) {
          const n = (o / 20) * Math.PI * 2,
            r = l + Math.cos(n) * t,
            s = c + Math.sin(n) * t;
          if (!collideXZ(r, s, 0.3, a)) {
            ((l = r), (c = s), (e = !0));
            break;
          }
        }
    }
  }
  return { x: l, z: c, yaw: n };
}
function createActor(e, t, o, a, n) {
  const r = buildFighter("atk" === t ? 16739146 : 3718648, a);
  ((r.group.userData.actor = !0), scene.add(r.group));
  const s = {
    id: e,
    team: t,
    ctrl: o,
    agent: a,
    model: r,
    group: r.group,
    name: "",
    pos: new T.Vector3(n.x, 0, n.z),
    vel: new T.Vector3(),
    y: 0,
    vy: 0,
    onGround: !0,
    yaw: n.yaw,
    pitch: 0,
    hp: 100,
    armor: 0,
    alive: !0,
    crouch: !1,
    ads: !1,
    credits: "ai" === o ? 800 : 999999,
    weapons: { primary: null, secondary: "pistol", knife: "knife" },
    ammo: {},
    reserve: {},
    slot: "secondary",
    reloading: 0,
    fireCd: 0,
    burstLeft: 0,
    recoil: 0,
    recoilY: 0,
    sway: 0,
    bob: 0,
    abilities: [],
    ultCharge: 0,
    ultMax: 5,
    blind: 0,
    slow: 1,
    root: 0,
    shielded: 0,
    invuln: 0,
    revealed: 0,
    slowT: 0,
    speedBuff: 1,
    speedBuffT: 0,
    silenced: 0,
    ultSnipe: 0,
    ultSnipeT: 0,
    hasSpike: !1,
    planting: 0,
    defusing: 0,
    plantAnchor: null,
    ai: null,
    input: { mv: [0, 0], yaw: n.yaw, pitch: 0, btn: 0, seq: 0 },
    net: null,
  };
  if (
    ((s.ammo.pistol = WEAPONS.pistol.mag),
    (s.reserve.pistol = 999999),
    a && a.abilities)
  ) {
    s.abilities = a.abilities.map((e) => ({
      def: e,
      cd: 0,
      charges: e.charges || 1,
    }));
    const e = a.abilities.find((e) => e.ult);
    e && (s.ultMax = e.ult);
  }
  return (world.actors.push(s), s);
}
function spawnRemoteActor(e) {
  const t = e < TEAM_SIZE ? "atk" : "def";
  return createActor(e, t, "remote", null, spawnPointFor(t, e % TEAM_SIZE));
}
function respawnAll() {
  for (const e of world.actors) {
    const t = world.actors.filter((t) => t.team === e.team).indexOf(e),
      o = spawnPointFor(e.team, t);
    (e.pos.set(o.x, 0, o.z),
      e.vel.set(0, 0, 0),
      (e.y = 0),
      (e.vy = 0),
      (e.yaw = o.yaw),
      (e.pitch = 0),
      (e.hp = 100),
      (e.alive = !0),
      (e.blind = 0),
      (e.root = 0),
      (e.slow = 1),
      (e.shielded = 0),
      (e.invuln = 0),
      (e.revealed = 0),
      (e.hasSpike = !1),
      (e.planting = 0),
      (e.defusing = 0),
      (e.reloading = 0),
      (e.fireCd = 0),
      (e.burstLeft = 0),
      e.group && (e.group.visible = !0));
    for (const t in e.ammo) e.ammo[t] = WEAPONS[t] ? WEAPONS[t].mag : e.ammo[t];
    e.ai && (e.ai = freshAIState());
  }
}
const Q = {
    pos: (e) => Math.round(100 * e),
    unpos: (e) => e / 100,
    ang: (e) => Math.round(1e3 * e),
    unang: (e) => e / 1e3,
  },
  AF = {
    ALIVE: 1,
    CROUCH: 2,
    ADS: 4,
    RELOAD: 8,
    SPIKE: 16,
    PLANT: 32,
    DEFUSE: 64,
    BLIND: 128,
  },
  WKEYS = Object.keys(WEAPONS);
function packActor(e) {
  let t = 0;
  (e.alive && (t |= AF.ALIVE),
    e.crouch && (t |= AF.CROUCH),
    e.ads && (t |= AF.ADS),
    e.reloading > 0 && (t |= AF.RELOAD),
    e.hasSpike && (t |= AF.SPIKE),
    e.planting > 0 && (t |= AF.PLANT),
    e.defusing > 0 && (t |= AF.DEFUSE),
    e.blind > 0 && (t |= AF.BLIND));
  const o = (e.weapons && e.weapons[e.slot]) || "pistol";
  return [
    e.id,
    Q.pos(e.pos.x),
    Q.pos(e.y),
    Q.pos(e.pos.z),
    Q.ang(e.yaw),
    Q.ang(e.pitch || 0),
    Math.max(0, Math.round(e.hp)),
    Math.round(e.armor || 0),
    t,
    WKEYS.indexOf(o),
    Math.round((e.ammo && e.ammo[o]) || 0),
    Math.round(e.ultCharge || 0),
  ];
}
function applyActor(e, t, o) {
  const a = Q.unpos(t[1]),
    n = Q.unpos(t[2]),
    r = Q.unpos(t[3]);
  (o
    ? ((e.net = e.net || {}),
      (e.net.px = e.pos.x),
      (e.net.py = e.y),
      (e.net.pz = e.pos.z),
      (e.net.tx = a),
      (e.net.ty = n),
      (e.net.tz = r),
      (e.net.pyaw = e.yaw),
      (e.net.tyaw = Q.unang(t[4])),
      (e.net.t = 0))
    : ((e.pos.x = a), (e.y = n), (e.pos.z = r), (e.yaw = Q.unang(t[4]))),
    (e.pitch = Q.unang(t[5])),
    (e.hp = t[6]),
    (e.armor = t[7]));
  const s = t[8];
  ((e.alive = !!(s & AF.ALIVE)),
    (e.crouch = !!(s & AF.CROUCH)),
    (e.ads = !!(s & AF.ADS)),
    (e.reloading = s & AF.RELOAD ? 0.5 : 0),
    (e.hasSpike = !!(s & AF.SPIKE)),
    (e.planting = s & AF.PLANT ? 1 : 0),
    (e.defusing = s & AF.DEFUSE ? 1 : 0),
    e.weapons || (e.weapons = { primary: null, secondary: "pistol" }));
  const i = WKEYS[t[9]] || "pistol";
  ((e.netWeapon = i), e.ammo || (e.ammo = {}), (e.ammo[i] = t[10]));
}
function buildSnapshot(includeEffects = true) {
  const e = world.spike;
  return {
    t: "s",
    k: ++NET.tick,
    ph: world.phase,
    rt: Math.round(10 * world.roundTime),
    sa: world.scoreAtk,
    sd: world.scoreDef,
    rd: world.round,
    sk: [
      "carried" === e.state
        ? 0
        : "dropped" === e.state
          ? 1
          : "planted" === e.state
            ? 2
            : 3,
      Q.pos(e.x),
      Q.pos(e.z),
      Math.round(10 * (e.timer || 0)),
      e.halfDefused ? 1 : 0,
    ],
    a: world.actors.map(packActor),
    fx: includeEffects ? drainFX() : [],
  };
}
const SPIKE_STATES = ["carried", "dropped", "planted", "defused"];
function applySnapshot(e) {
  ((world.phase = e.ph),
    (world.roundTime = e.rt / 10),
    (world.scoreAtk = e.sa),
    (world.scoreDef = e.sd),
    (world.round = e.rd));
  const t = world.spike;
  ((t.state = SPIKE_STATES[e.sk[0]] || "carried"),
    (t.x = Q.unpos(e.sk[1])),
    (t.z = Q.unpos(e.sk[2])),
    (t.timer = e.sk[3] / 10),
    (t.halfDefused = !!e.sk[4]));
  const o = new Set();
  for (const t of e.a) {
    let e = actorById(t[0]);
    (e || (e = spawnRemoteActor(t[0])),
      o.add(t[0]),
      "me" === e.ctrl ? reconcileLocal(e, t) : applyActor(e, t, !0),
      null != t[11] && (e.ultCharge = t[11]));
  }
  for (const e of world.actors)
    !o.has(e.id) && e.group && (e.group.visible = !1);
  e.fx && e.fx.length && playRemoteFX(e.fx);
}
let _fx = [];
function pushFX(e, t, o, a, n) {
  _fx.push([e, Q.pos(t), Q.pos(o), Q.pos(a), 0 | n]);
}
function drainFX() {
  const e = _fx;
  return ((_fx = []), e);
}
function playRemoteFX(e) {
  for (const t of e) {
    const e = t[0],
      o = Q.unpos(t[1]),
      a = Q.unpos(t[2]),
      n = Q.unpos(t[3]),
      r = t[4] || 0;
    try {
      switch (e) {
        case FX.SHOT: {
          const e = r / 100,
            t = new T.Vector3(-Math.sin(e), 0, -Math.cos(e)),
            s = new T.Vector3(o, a, n),
            i = new T.BufferGeometry().setFromPoints([
              s.clone().add(t.clone().multiplyScalar(0.8)),
              s.clone().add(t.clone().multiplyScalar(60)),
            ]);
          addFx(
            new T.Line(
              i,
              new T.LineBasicMaterial({
                color: 16771504,
                transparent: !0,
                opacity: 0.55,
              }),
            ),
            0.06,
            (e, t) => {
              e.material.opacity = 0.55 * (1 - t);
            },
          );
          break;
        }
        case FX.IMPACT:
          impactSpark(o, a, n, 16767392);
          break;
        case FX.BLOOD:
          bloodBurst(o, a, n, 13386820);
          break;
        case FX.BLOOD_HEAD:
          bloodBurst(o, a, n, 16726862);
          break;
        case FX.SMOKE:
          makeSmokeAt(o, n, 6, 14, 12568532);
          break;
        case FX.FLASH:
          makeFlash(o, n);
      }
    } catch (e) {}
  }
}
const BTN = {
  FIRE: 1,
  ADS: 2,
  RELOAD: 4,
  JUMP: 8,
  CROUCH: 16,
  WALK: 32,
  Q: 64,
  E: 128,
  C: 256,
  X: 512,
  USE: 1024,
  W1: 2048,
  W2: 4096,
};
function gatherInput() {
  let e = 0,
    t = 0;
  (keys.w && (t -= 1),
    keys.s && (t += 1),
    keys.a && (e -= 1),
    keys.d && (e += 1),
    touch.on && ((e += touch.move.x), (t += touch.move.y)));
  let o = 0;
  (keys.fire && (o |= BTN.FIRE),
    keys.ads && (o |= BTN.ADS),
    keys.r && (o |= BTN.RELOAD),
    keys.space && (o |= BTN.JUMP),
    (keys.control || keys.shift) && (o |= BTN.CROUCH));
  {
    const e = world.spike;
    (((player.planting || 0) > 0 && player.hasSpike && "carried" === e.state) ||
      ((player.defusing || 0) > 0 && "planted" === e.state)) &&
      (o |= BTN.CROUCH);
  }
  keys.use && (o |= BTN.USE);
  const a = ("function" == typeof myActor && myActor()) || player;
  return { mv: [e, t], yaw: a.yaw, pitch: a.pitch, btn: o };
}
function simMove(e, t) {
  const o = e.input;
  e.crouch = !!(o.btn & BTN.CROUCH) || e.forceCrouch > 0;
  const a = !!(o.btn & BTN.WALK);
  e.ads = !!(o.btn & BTN.ADS);
  let n = o.mv[0],
    r = o.mv[1],
    s = ADMIN.run;
  (a && (s = ADMIN.walk),
    e.crouch && (s = ADMIN.crouch),
    e.ads && (s *= ADMIN.adsMul),
    (s *= (e.slow || 1) * (e.speedBuff || 1)),
    e.concuss > 0 && (s *= 0.72),
    (e._stepMode = e.crouch ? "crouch" : o.btn & BTN.WALK ? "walk" : "run"),
    isAI(e) && (ADMIN.freezeAI ? (s = 0) : (s *= ADMIN.aiSpeed)),
    e.root > 0 && (s = 0));
  const i = Math.hypot(n, r);
  if (i > 0 && e.root <= 0) {
    ((n /= i), (r /= i));
    const t = -Math.sin(e.yaw),
      o = -Math.cos(e.yaw),
      a = Math.cos(e.yaw),
      l = -Math.sin(e.yaw),
      c = -r,
      d = n;
    ((e.vel.x = (t * c + a * d) * s), (e.vel.z = (o * c + l * d) * s));
  } else ((e.vel.x *= 0.76), (e.vel.z *= 0.76));
  const l = moveWithSlide(e.pos, e.vel.x * t, e.vel.z * t, e.y, PR);
  (e.onGround && l > e.y && ((e.y = l), (e.vy = 0)),
    o.btn & BTN.JUMP &&
      e.onGround &&
      e.root <= 0 &&
      ((e.vy = ADMIN.jumpV), (e.onGround = !1)),
    (e.vy -= ADMIN.gravity * t),
    (e.y += e.vy * t));
  const c = groundAt(e.pos.x, e.pos.z, e.y);
  if (
    (e.y <= c ? ((e.y = c), (e.vy = 0), (e.onGround = !0)) : (e.onGround = !1),
    "me" === e.ctrl)
  ) {
    const o = Math.hypot(e.vel.x, e.vel.z);
    e.bob = (e.bob || 0) + t * o * 1.5;
  }
  if (e.onGround && e.alive) {
    const o = Math.hypot(e.vel.x, e.vel.z);
    if (o > 0.4) {
      const a = e._stepMode || "run",
        n = "run" === a ? 2 : "walk" === a ? 2.6 : 2.2;
      if (
        ((e._stepAcc = (e._stepAcc || 0) + o * t),
        e._stepAcc >= n &&
          ((e._stepAcc = 0), !("crouch" === a && Math.random() < 0.55)))
      ) {
        let t = 0;
        "me" !== e.ctrl &&
          player &&
          player.pos &&
          ((t = clamp(
            Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z) / 34,
            0,
            1,
          )),
          t < 1 &&
            rayBlocked(
              player.pos.x,
              player.y + 1.4,
              player.pos.z,
              e.pos.x,
              e.y + 1,
              e.pos.z,
            ) &&
            (t = Math.min(1, t + 0.3)));
        try {
          SFX.step(a, surfaceAt(e), t);
        } catch (e) {}
      }
    } else e._stepAcc = 0;
  }
}
const FPCAM = { eye: null, roll: 0, land: 0, landK: 0, wasAir: !1, fallV: 0 };
function followCamera(e, t) {
  const o = Math.hypot(e.vel.x, e.vel.z),
    a = Math.max(0, Math.min(1, MOT())),
    n = eyeHeight();
  ((null === FPCAM.eye || Math.abs(FPCAM.eye - n) > 1) && (FPCAM.eye = n),
    (FPCAM.eye += (n - FPCAM.eye) * Math.min(1, 14 * t)));
  const r = e.vel.x * Math.cos(e.yaw) - e.vel.z * Math.sin(e.yaw);
  FPCAM.roll += ((-r / 9) * 0.022 * a - FPCAM.roll) * Math.min(1, 8 * t);
  const s = !e.onGround;
  (s && (FPCAM.fallV = Math.min(FPCAM.fallV, e.vy || 0)),
    FPCAM.wasAir &&
      !s &&
      FPCAM.fallV < -3 &&
      ((FPCAM.land = 0.32), (FPCAM.landK = Math.min(1, -FPCAM.fallV / 11))),
    s || (FPCAM.fallV = 0),
    (FPCAM.wasAir = s));
  let i = 0;
  (FPCAM.land > 0 &&
    ((FPCAM.land -= t),
    (i =
      0.13 *
      Math.sin((Math.max(0, FPCAM.land) / 0.32) * Math.PI) *
      FPCAM.landK *
      a)),
    (FPCAM.dip = i));
  const l = e.onGround ? 0.035 * Math.sin(e.bob || 0) * Math.min(o / 7, 1) : 0,
    c = e.onGround
      ? 0.025 * Math.cos(0.5 * (e.bob || 0)) * Math.min(o / 7, 1)
      : 0;
  let d = 0,
    h = 0;
  if (
    (shake > 0 &&
      ((d = 0.09 * rnd(-shake, shake)),
      (h = 0.09 * rnd(-shake, shake)),
      (shake = Math.max(0, shake - 2.2 * t))),
    camera.position.set(e.pos.x + c + d, e.y + FPCAM.eye + l + h - i, e.pos.z),
    (camera.rotation.order = "YXZ"),
    (camera.rotation.y = e.yaw),
    (camera.rotation.x = e.pitch - 0.05 * (e.recoil || 0) - 0.35 * i),
    (camera.rotation.z = 0.4 * c + FPCAM.roll),
    e.concuss > 0)
  ) {
    const t = Math.min(1, e.concuss) * Math.max(0.3, MOT()),
      o = world._clock || 0;
    ((camera.rotation.z += 0.05 * Math.sin(6.3 * o) * t),
      (camera.rotation.x += 0.025 * Math.sin(4.1 * o) * t),
      (camera.rotation.y += 0.03 * Math.sin(3.3 * o) * t));
  }
}
const LERP_TIME = 0.05;
function interpRemote(e, t) {
  const o = e.net;
  if (!o) return;
  o.t = Math.min(1, (o.t || 0) + t / 0.05);
  const a = o.t;
  ((e.pos.x = o.px + (o.tx - o.px) * a),
    (e.y = o.py + (o.ty - o.py) * a),
    (e.pos.z = o.pz + (o.tz - o.pz) * a));
  let n = ((o.tyaw - o.pyaw + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
  e.yaw = o.pyaw + n * a;
}
function reconcileLocal(e, t) {
  const o = t[1] / 100,
    a = t[2] / 100,
    n = t[3] / 100,
    r = Math.hypot(e.pos.x - o, e.pos.z - n);
  (r > 2.5
    ? ((e.pos.x = o), (e.y = a), (e.pos.z = n))
    : r > 0.05 &&
      ((e.pos.x += 0.18 * (o - e.pos.x)),
      (e.y += 0.18 * (a - e.y)),
      (e.pos.z += 0.18 * (n - e.pos.z))),
    (e.hp = t[6]),
    (e.armor = t[7]));
  const s = t[8];
  ((e.alive = !!(s & AF.ALIVE)), (e.hasSpike = !!(s & AF.SPIKE)));
}
function shotKindOf(e) {
  const t = WEAPONS[e];
  return t
    ? t.quiet
      ? "quiet"
      : "저격총" === t.cls
        ? "sniper"
        : "산탄총" === t.cls
          ? "shotgun"
          : "기관총" === t.cls
            ? "heavy"
            : "보조" === t.cls || "근접" === t.cls
              ? "pistol"
              : "rifle"
    : "rifle";
}
function shotDistance(e) {
  const t = ("function" == typeof myActor && myActor()) || player;
  if (!t || e === t) return 0;
  const o = Math.hypot(e.pos.x - t.pos.x, e.pos.z - t.pos.z);
  return clamp(o / 70, 0, 1);
}
function actorWeaponKey(e) {
  return (e.weapons && e.weapons[e.slot]) || "pistol";
}
function actorWeapon(e) {
  return WEAPONS[actorWeaponKey(e)];
}
function actorEye(e) {
  return e.y + (e.crouch ? CROUCH_EYE : EYE);
}
function actorFire(e) {
  if (e.ultW) return void ultwFire(e, !1);
  if (!e.alive || e.reloading > 0 || e.fireCd > 0 || "end" === world.phase)
    return;
  if (e.suppress > 0) {
    if ("me" === e.ctrl && !(e._supT > 0)) {
      ((e._supT = 0.6), bannerMe("무기 봉인", "#ffd166"));
      try {
        SFX.silenced();
      } catch (e) {}
    }
    return;
  }
  e._shotT = world._clock || 0;
  const t = actorWeaponKey(e),
    o = WEAPONS[t];
  if ("knife" === t) {
    e.fireCd = 60 / o.rpm / (("me" === e.ctrl && ADMIN.fastFire) || 1);
    const t = -Math.sin(e.yaw),
      a = -Math.cos(e.yaw);
    for (const n of world.actors) {
      if (!n.alive || n.team === e.team || n === e) continue;
      const r = n.pos.x - e.pos.x,
        s = n.pos.z - e.pos.z,
        i = Math.hypot(r, s);
      i > o.range ||
        (r / i) * t + (s / i) * a < 0.55 ||
        (dealDamage(
          n,
          o.dmg * ("function" == typeof isAI && isAI(e) ? 0.5 : 1),
          !1,
          e,
        ),
        "me" === e.ctrl && hitMarker(!1));
    }
    return void ("me" === e.ctrl && (world.stats.shots++, viewmodelFireKick()));
  }
  if ((e.ammo[t] || 0) <= 0)
    return void ("me" === e.ctrl ? startReload() : actorReload(e));
  (e.ammo[t]--,
    (e.fireCd = 60 / o.rpm / (("me" === e.ctrl && ADMIN.fastFire) || 1)),
    "me" === e.ctrl && world.stats.shots++);
  const a = Math.hypot(e.vel.x, e.vel.z);
  let n = o.spread * (e.ads ? 0.42 : 1);
  ((n *= 1 + 0.34 * a + (e.onGround ? 0 : 1.5) + 0.7 * (e.recoil || 0)),
    isAI(e) && (n += (e.ai && e.ai.accuracy) || 0.055),
    e.concuss > 0 && (n = 1.8 * n + 0.03));
  const r = o.pellets || 1,
    s = new T.Vector3(e.pos.x, actorEye(e), e.pos.z);
  for (let a = 0; a < r; a++) {
    const a = e.yaw + rnd(-n, n),
      r = (e.pitch || 0) + rnd(-n, n);
    actorHitscan(
      e,
      s,
      new T.Vector3(
        -Math.sin(a) * Math.cos(r),
        Math.sin(r),
        -Math.cos(a) * Math.cos(r),
      ),
      o,
      t,
    );
  }
  if (
    (SFX.gun(t, shotDistance(e)),
    (e.recoil = Math.min(
      (e.recoil || 0) +
        ("sniper" === t || "antimat" === t ? 0.9 : "rifle" === t ? 0.16 : 0.1),
      1.2,
    )),
    "me" === e.ctrl &&
      ((e.pitch +=
        "sniper" === t || "antimat" === t
          ? 0.045
          : "rifle" === t
            ? 0.012
            : 0.008),
      addTracer(s, e.yaw, e.pitch, o.range),
      muzzleFlash(),
      viewmodelFireKick()),
    "me" !== e.ctrl)
  )
    try {
      (worldMuzzleFlash(e), GFX.tracer && worldTracer(e, dir, o.range));
    } catch (e) {}
  pushFX(FX.SHOT, e.pos.x, actorEye(e), e.pos.z, Math.round(100 * e.yaw));
}
function actorHitscan(e, t, o, a, n) {
  let r = null,
    s = a.range;
  for (const a of world.actors) {
    if (!a.alive || a.team === e.team || a === e) continue;
    const n = new T.Vector3(a.pos.x - t.x, a.y + 0.95 - t.y, a.pos.z - t.z).dot(
      o,
    );
    if (n < 0 || n > s) continue;
    const i = o.clone().multiplyScalar(n).add(t),
      l = i.y - (a.y + (a.crouch ? 0.74 : 0.95)),
      c = Math.hypot(i.x - a.pos.x, i.z - a.pos.z),
      d = a.y + (a.crouch ? 1.47 : 1.86),
      h = Math.hypot(i.x - a.pos.x, i.y - d, i.z - a.pos.z) < 0.17;
    (h || (c < 0.56 && Math.abs(l) < (a.crouch ? 0.64 : 0.75))) &&
      (rayBlocked(t.x, t.y, t.z, a.pos.x, a.y + 1, a.pos.z) ||
        ((r = { e: a, head: h, t: n }), (s = n)));
  }
  if (DOMES.length) {
    const e = domeBlockT(t, o, s);
    e < s && ((r = null), (s = e));
  }
  SHOOTABLES.length && shootableHit(t, o, s, e, a.dmg) && (r = null);
  const i = Math.ceil(s / 0.75);
  for (let e = 1; e <= i; e++) {
    const a = 0.75 * e;
    if (a > s) break;
    const n = t.x + o.x * a,
      i = t.y + o.y * a;
    if (collideXZ(n, t.z + o.z * a, i, 0.05)) {
      ((r = null), (s = a));
      break;
    }
  }
  if (r) {
    let t = a.dmg * (r.head ? a.hs : 1);
    const o = Math.max(0.55, 1 - (r.t / a.range) * 0.45),
      n = "function" == typeof isAI && isAI(e) ? 0.5 * diffTune().dmg : 1;
    (dealDamage(r.e, t * o * n, r.head, e),
      "me" === e.ctrl &&
        (world.stats.hits++, hitMarker(r.head), SFX.hit(r.head)));
  } else {
    const a = t.x + o.x * s,
      n = t.y + o.y * s,
      r = t.z + o.z * s;
    (pushFX(FX.IMPACT, a, n, r, 0),
      "me" === e.ctrl && impactSpark(a, n, r, 16767392));
  }
}
function dealDamage(e, t, o, a) {
  if ("client" === NET.mode) return;
  if (
    (!ADMIN.god || !e || "me" !== e.ctrl) &&
    (ADMIN.oneShot && a && "me" === a.ctrl && (t = 9999),
    e.alive && !(e.invuln > 0) && "end" !== world.phase)
  ) {
    e._lastArmorBlocked = 0;
    if ((e.shielded > 0 && (t *= 0.4), e.vuln > 0 && (t *= 1.5), e.armor > 0)) {
      const o = Math.min(e.armor, 0.5 * t);
      e._lastArmorBlocked = o;
      ((e.armor -= o), (t -= o));
    }
    if (
      ((e.hp -= t),
      (e._lastHead = !!o),
      (e._hitT = 0.2),
      (e._hitSide = Math.random() < 0.5 ? -1 : 1),
      a &&
        a.pos &&
        (e._lastHitFrom = Math.atan2(
          -(a.pos.x - e.pos.x),
          -(a.pos.z - e.pos.z),
        )),
      a && "me" === a.ctrl && e !== a && e.team !== a.team)
    )
      try {
        dmgNumber(e, t, o);
      } catch (e) {}
    if (
      (a &&
        a !== e &&
        a.lifesteal > 0 &&
        a.alive &&
        a.team !== e.team &&
        (a.hp = Math.min(100, a.hp + 0.45 * t)),
      (e.planting > 0 || e.defusing > 0) &&
        (e.plantAnchor && (e.plantAnchor = { x: e.pos.x, z: e.pos.z }),
        (e !== player && "me" !== e.ctrl) ||
          (player.plantAnchor &&
            (player.plantAnchor = { x: player.pos.x, z: player.pos.z }))),
      a && "me" === a.ctrl && (world.stats.dmg += Math.round(t)),
      a && a.team && e.team && a.team !== e.team)
    )
      for (a._dmgUlt = (a._dmgUlt || 0) + t; a._dmgUlt >= 150; )
        ((a._dmgUlt -= 150),
          "me" === a.ctrl
            ? chargeUlt(1)
            : a.abilities &&
              (a.ultCharge = Math.min(a.ultMax || 5, (a.ultCharge || 0) + 1)));
    if (
      (e.ai &&
        a &&
        a.pos &&
        ((e.ai.alertT = 5), (e.ai.lastSeen = { x: a.pos.x, z: a.pos.z })),
      a &&
        a.pos &&
        a.team &&
        e.team &&
        "function" == typeof intelOnHit &&
        intelOnHit(e, a),
      pushFX(
        o ? FX.BLOOD_HEAD : FX.BLOOD,
        e.pos.x,
        e.y + (o ? 1.86 : 1.1) * BODY_K,
        e.pos.z,
        0,
      ),
      bloodBurst(
        e.pos.x,
        e.y + (o ? 1.86 : 1.1) * BODY_K,
        e.pos.z,
        o ? 16726862 : 13386820,
      ),
      "me" === e.ctrl)
    ) {
      const e = $("dmg");
      (e &&
        (e.classList.add("hit"),
        clearTimeout(e._t),
        (e._t = setTimeout(() => e.classList.remove("hit"), 190))),
        SFX.hurt());
    }
    if (e.hp <= 0 && e.undying > 0) {
      ((e.undying = 0), (e.hp = 1), (e.invuln = 1.4), (e._undyHeal = 1.4));
      try {
        (revivePillar(e.pos.x, e.pos.z, 16717636),
          fxShatter(e.pos.x, e.pos.z, 16717636));
      } catch (e) {}
      "me" === e.ctrl && bannerMe("불사 발동 — 되살아난다", "#ff1744");
    } else e.hp <= 0 && killActor(e, a);
    // Only the death committed by this hit may use its absorbed armor amount.
    e._lastArmorBlocked = 0;
  }
}
let killStreak = 0,
  streakTimer = 0,
  killFxT = 0;
const STREAK_NAMES = ["", "", "더블 킬", "트리플 킬", "쿼드라 킬", "에이스"];
function playKillFx(e, t) {
  killStreak++;
  streakTimer = 4.5;
  const genericKillSound = SFX.kill(t) !== false;
  genericKillSound && killStreak >= 2 && setTimeout(() => SFX.multi(killStreak), 230);
  const o = $("killfx"),
    a = $("kf-main"),
    n = $("kf-sub"),
    r = $("kf-streak");
  ((a.textContent = t ? "헤드샷" : "처치"), (n.textContent = e || ""));
  const s = STREAK_NAMES[Math.min(killStreak, 5)];
  (s ? ((r.textContent = s), (r.hidden = !1)) : (r.hidden = !0),
    (o.hidden = !1));
  const i = $("kf-badge");
  ((i.style.animation = "none"),
    i.offsetWidth,
    (i.style.animation = ""),
    r.hidden ||
      ((r.style.animation = "none"), r.offsetWidth, (r.style.animation = "")),
    (killFxT = 1.8));
  const l = $("killflash");
  (l.classList.add("on"),
    setTimeout(() => l.classList.remove("on"), 70),
    (shake = Math.max(shake, t ? 0.5 : 0.3)));
}
function tickKillFx(e) {
  (killFxT > 0 && ((killFxT -= e), killFxT <= 0 && ($("killfx").hidden = !0)),
    streakTimer > 0 &&
      ((streakTimer -= e), streakTimer <= 0 && (killStreak = 0)));
}
function killActor(e, t) {
  if (((e.alive = !1), (e.hp = 0), (e._deadT = 0), e.group)) {
    const t =
      void 0 !== e._lastHitFrom
        ? ((e._lastHitFrom - e.yaw + 3 * Math.PI) % (2 * Math.PI)) - Math.PI
        : 0;
    ((e._deathBack = Math.abs(t) < Math.PI / 2),
      (e._deathSide = 0.5 * (Math.random() - 0.5)),
      (e._deathHead = !!e._lastHead),
      e.model && e.model.gun && (e.model.gun.visible = !1));
    try {
      e.ultW && endUltW(e);
    } catch (e) {}
  }
  (t &&
    ((t.credits = Math.min(999999, t.credits + 200)),
    "me" === t.ctrl
      ? (world.stats.kills++,
        chargeUlt(1),
        playKillFx(e.name || (e.agent ? e.agent.name : "적"), !!e._lastHead))
      : t.abilities && (t.ultCharge = Math.min(t.ultMax, t.ultCharge + 1))),
    "me" === e.ctrl && world.stats.deaths++);
  const o = t ? t.name || (t.agent ? t.agent.name : "적") : "월드",
    a = e.name || (e.agent ? e.agent.name : "적");
  (pushKill(o, a),
    "host" === NET.mode && sendEventAll({ t: "kill", k: o, v: a }),
    e.hasSpike && spikeDropOnDeath(e),
    "me" === e.ctrl && onLocalDeath());
}
function actorReload(e) {
  const t = actorWeaponKey(e),
    o = WEAPONS[t];
  !o ||
    e.reloading > 0 ||
    (e.ammo[t] || 0) >= o.mag ||
    (e.reserve[t] || 0) <= 0 ||
    ((e.reloading = o.reload || 2), "me" === e.ctrl && SFX.reload());
}
function finishActorReload(e) {
  const t = actorWeaponKey(e),
    o = WEAPONS[t].mag - (e.ammo[t] || 0),
    a = Math.min(o, e.reserve[t] || 0);
  ((e.ammo[t] = (e.ammo[t] || 0) + a),
    (e.reserve[t] || 0) < 999999
      ? (e.reserve[t] = (e.reserve[t] || 0) - a)
      : (e.reserve[t] = 999999));
}
function resolveActions(e, t) {
  if (
    (e.fireCd > 0 && (e.fireCd -= t),
    e.reloading > 0 &&
      ((e.reloading -= t), e.reloading <= 0 && finishActorReload(e)),
    (e.recoil = Math.max(0, (e.recoil || 0) - 2.6 * t)),
    e.blind > 0 && (e.blind -= t),
    e.root > 0 && (e.root -= t),
    e.invuln > 0 && (e.invuln -= t),
    e.shielded > 0 && (e.shielded -= t),
    e.revealed > 0 && (e.revealed -= t),
    e.silenced > 0 && (e.silenced -= t),
    e.slowT > 0
      ? ((e.slowT -= t), e.slowT <= 0 && (e.slow = 1))
      : void 0 !== e.slow && 1 !== e.slow && (e.slow = 1),
    e.speedBuffT > 0 &&
      ((e.speedBuffT -= t), e.speedBuffT <= 0 && (e.speedBuff = 1)),
    e.ultSnipeT > 0 &&
      ((e.ultSnipeT -= t), e.ultSnipeT <= 0 && (e.ultSnipe = 0)),
    tickStatus(e, t),
    e.abilities &&
      e.abilities.forEach((e) => {
        e.cd > 0 && ((e.cd -= t), e.cd < 0 && (e.cd = 0));
      }),
    isAI(e))
  )
    return;
  const o = e.input.btn;
  if (e.ultW)
    return void (o & BTN.FIRE
      ? ((!ULTW[e.ultW.kind].auto && e._held) || ultwFire(e, !1),
        (e._held = !0))
      : (e._held = !1));
  const a = actorWeapon(e);
  (o & BTN.RELOAD && actorReload(e),
    o & BTN.FIRE
      ? a.burst
        ? e._held || ((e._held = !0), (e.burstLeft = a.burst))
        : a.auto
          ? actorFire(e)
          : e._held || (actorFire(e), (e._held = !0))
      : (e._held = !1),
    e.burstLeft > 0 && e.fireCd <= 0 && (actorFire(e), e.burstLeft--));
}
const FX = { SHOT: 1, IMPACT: 2, BLOOD: 3, BLOOD_HEAD: 4, SMOKE: 5, FLASH: 6 },
  TEAM_INTEL = { atk: new Map(), def: new Map() },
  INTEL_LIFE = 6;
function intelTick(e) {
  for (const t of ["atk", "def"]) {
    const o = TEAM_INTEL[t];
    for (const [t, a] of o) ((a.t -= e), a.t <= 0 && o.delete(t));
  }
}
function intelReport(e, t) {
  TEAM_INTEL[e.team].set(t.id, {
    x: t.pos.x,
    z: t.pos.z,
    t: INTEL_LIFE,
    seen: !0,
  });
}
function intelOnHit(e, t) {
  if (!t || !t.pos || t.team === e.team) return;
  TEAM_INTEL[e.team].set(t.id, {
    x: t.pos.x,
    z: t.pos.z,
    t: INTEL_LIFE,
    seen: !1,
  });
}
function intelNearest(e) {
  const t = TEAM_INTEL[e.team];
  let o = null,
    a = 1e9;
  for (const [n, r] of t) {
    const s = actorById(n);
    if (!s || !s.alive || s.team === e.team) {
      t.delete(n);
      continue;
    }
    const i = Math.hypot(r.x - e.pos.x, r.z - e.pos.z);
    i < a && ((a = i), (o = { id: n, x: r.x, z: r.z, e: s, d: i }));
  }
  return o;
}
function intelClear() {
  (TEAM_INTEL.atk.clear(), TEAM_INTEL.def.clear());
}
const SWEEP = { on: !1, t: 0, check: 0 };
function humansAlive() {
  for (const e of world.actors)
    if (e.alive && "function" == typeof isAI && !isAI(e)) return !0;
  return !1;
}
function sweepUpdate(e) {
  if (((SWEEP.check -= e), SWEEP.check <= 0)) {
    SWEEP.check = 0.5;
    const e =
      "live" === world.phase && world.actors.length > 0 && !humansAlive();
    e !== SWEEP.on &&
      ((SWEEP.on = e),
      (SWEEP.t = 0),
      e && "function" == typeof banner && banner("소탕 모드", "#ff9f43"));
  }
  if (SWEEP.on && ((SWEEP.t += e), SWEEP.t > 25)) {
    const t = world.actors.filter((e) => e.alive && "atk" === e.team).length,
      o = world.actors.filter((e) => e.alive && "def" === e.team).length;
    if (t > 0 && o > 0) {
      const t = 0.9 * (SWEEP.t - 25) * e * 10;
      for (const e of world.actors) e.alive && dealDamage(e, t, !1, null);
    }
  }
}
function sweepTarget(e) {
  let t = null,
    o = 1e9;
  for (const a of world.actors) {
    if (!a.alive || a.team === e.team) continue;
    const n = Math.hypot(a.pos.x - e.pos.x, a.pos.z - e.pos.z);
    n < o && ((t = a), (o = n));
  }
  return t ? { e: t, d: o } : null;
}
function actorSpike(e, t) {
  const o = world.spike;
  if ("live" === world.phase && e.alive && !world.over && e.ai)
    if ("atk" !== e.team) {
      if ("planted" === o.state)
        if (dist2(e.pos.x, e.pos.z, o.x, o.z) < SPIKE.DEFUSE_R2 + 5) {
          e.ai.defuseT || (e.ai.defuseT = o.halfDefused ? SPIKE.HALF : 0);
          const a = e.ai.defuseT;
          ((e.ai.defuseT += t),
            (e.defusing = e.ai.defuseT),
            a < SPIKE.HALF &&
              e.ai.defuseT >= SPIKE.HALF &&
              (o.halfDefused = !0),
            e.ai.defuseT >= SPIKE.DEFUSE && defuseDone("bot"));
        } else ((e.ai.defuseT = 0), (e.defusing = 0));
    } else {
      if (
        "dropped" === o.state &&
        dist2(e.pos.x, e.pos.z, o.x, o.z) < SPIKE.PICK_R2 + 14
      ) {
        ((e.hasSpike = !0),
          (o.state = "carried"),
          (o.carrier = e),
          o.mesh && (o.mesh.visible = !1));
        try {
          setCarrierMark(e, !0);
        } catch (e) {}
        return;
      }
      if (e.hasSpike && "carried" === o.state) {
        const o = siteAt(e.pos.x, e.pos.z);
        if (
          (!o && e._plantSite
            ? ((e._siteHold = (e._siteHold || 0) + t),
              e._siteHold > 20 && ((e._siteHold = 0), (e._plantSite = null)))
            : (e._siteHold = 0),
          o)
        ) {
          if (!(e.planting > 0)) {
            e.plantAnchor = { x: e.pos.x, z: e.pos.z };
            try {
              SFX.plantStart();
            } catch (e) {}
            "function" == typeof banner &&
              player &&
              "def" === player.team &&
              !e._plantWarned &&
              ((e._plantWarned = 1), banner("적이 설치를 시작했다", "#ffc849"));
          }
          ((e.planting = (e.planting || 0) + t),
            e.planting >= SPIKE.PLANT &&
              (plantSpike(e.pos.x, e.pos.z, o, !1),
              "function" == typeof banner &&
                player &&
                "def" === player.team &&
                banner("스파이크 설치됨", "#ff3b4e")));
        } else ((e.planting = 0), (e.plantAnchor = null), (e._plantWarned = 0));
      }
    }
}
function actorBusy(e) {
  if (!e.ai) return !1;
  const t = world.spike;
  return (
    !!(
      "atk" === e.team &&
      e.hasSpike &&
      (e.planting || 0) > 0 &&
      "carried" === t.state
    ) ||
    ("def" === e.team && "planted" === t.state && (e.ai.defuseT || 0) > 0)
  );
}
function segBlocked(e, t, o, a, n) {
  const r = void 0 === n ? 0.55 : n,
    s = Math.hypot(o - e, a - t),
    i = Math.max(2, Math.ceil(s / 1));
  for (let n = 1; n < i; n++) {
    const s = n / i;
    if (collideXZ(e + (o - e) * s, t + (a - t) * s, 0, r)) return !0;
  }
  return !1;
}
function navNext(e, t, o, a) {
  const n = e.ai;
  if (
    ((n.losCd = (n.losCd || 0) - a),
    n.losCd <= 0 ||
      null == n.losGoal ||
      Math.hypot(n.losGoal.x - t, n.losGoal.z - o) > 6)
  ) {
    ((n.losCd = 0.1 + 0.04 * Math.random()), (n.losGoal = { x: t, z: o }));
    const a = Math.hypot(t - e.pos.x, o - e.pos.z) > 45;
    n.losOpen = !a && !segBlocked(e.pos.x, e.pos.z, t, o, 0.8);
  }
  if (n.losOpen) return ((n.path = null), (n.pathIdx = 0), { x: t, z: o });
  n.repathCd = (n.repathCd2 || 0) - a;
  const r = !n.pathGoal || Math.hypot(n.pathGoal.x - t, n.pathGoal.z - o) > 10;
  if (
    (!n.path || !n.path.length || r || n.repathCd <= 0) &&
    PATH_BUDGET.n <= 0
  ) {
    if (((n.repathCd2 = rnd(0.02, 0.12)), !n.path || !n.path.length))
      return { x: t, z: o };
  } else
    (!n.path || !n.path.length || r || n.repathCd <= 0) &&
      (PATH_BUDGET.n--,
      (n.path = findPath(e.pos.x, e.pos.z, t, o) || []),
      (n.pathIdx = 0),
      (n.pathGoal = { x: t, z: o }),
      (n.repathCd2 = rnd(1.4, 2.6)));
  if (!n.path.length) return { x: t, z: o };
  let s = n.path[n.pathIdx];
  for (; s && dist2(e.pos.x, e.pos.z, s.x, s.z) < 30; )
    (n.pathIdx++, (s = n.path[n.pathIdx]));
  return s || ((n.path = null), (n.pathIdx = 0), { x: t, z: o });
}
const AVOID_FAN = [
  0, 0.3, -0.3, 0.6, -0.6, 0.95, -0.95, 1.3, -1.3, 1.7, -1.7, 2.1, -2.1, 2.6,
  -2.6, 3,
];
function probeDist(e, t, o) {
  let a = 0;
  for (; a < o; ) {
    a += 0.8;
    const o = e.pos.x - Math.sin(t) * a,
      n = e.pos.z - Math.cos(t) * a;
    if (collideXZ(o, n, e.y, 0.8)) return a - 0.8;
    if (
      o < MAP.bounds.minX + 1 ||
      o > MAP.bounds.maxX - 1 ||
      n < MAP.bounds.minZ + 1 ||
      n > MAP.bounds.maxZ - 1
    )
      return a - 0.8;
  }
  return o;
}
function pathClear(e, t, o) {
  const a = Math.max(2, Math.ceil(o / 1.6));
  for (let n = 1; n <= a; n++) {
    const r = o * (n / a),
      s = e.pos.x - Math.sin(t) * r,
      i = e.pos.z - Math.cos(t) * r;
    if (collideXZ(s, i, e.y, 0.8)) return !1;
    if (
      s < MAP.bounds.minX + 1 ||
      s > MAP.bounds.maxX - 1 ||
      i < MAP.bounds.minZ + 1 ||
      i > MAP.bounds.maxZ - 1
    )
      return !1;
  }
  return !0;
}
function steerToward(e, t, o, a, n) {
  const r = e.ai;
  r.detour && !r.path && ((t = r.detour.x), (o = r.detour.z));
  const s = Math.atan2(-(t - e.pos.x), -(o - e.pos.z));
  r.avoidCd = (r.avoidCd || 0) - a;
  let i = s;
  if (
    ((r.steerCd = (r.steerCd || 0) - a), r.steerCd > 0 && null != r.steerYaw)
  ) {
    let t = ((r.steerYaw - e.yaw + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
    return ((e.yaw += clamp(t, -n * a, n * a)), Math.abs(t));
  }
  if (
    ((r.steerCd = 0.05 + 0.02 * Math.random()),
    null != r.avoidYaw && r.avoidCd > 0 && probeDist(e, r.avoidYaw, 6) >= 5.5)
  )
    i = r.avoidYaw;
  else {
    r.avoidYaw = null;
    let a = null,
      n = -1e9;
    for (const r of AVOID_FAN) {
      const i = s + r,
        l = probeDist(e, i, 7);
      if (l < 1.2) continue;
      const c = e.pos.x - Math.sin(i) * l,
        d = e.pos.z - Math.cos(i) * l,
        h =
          3 *
            (Math.hypot(t - e.pos.x, o - e.pos.z) - Math.hypot(t - c, o - d)) +
          0.35 * l -
          0.6 * Math.abs(r);
      h > n && ((n = h), (a = i));
    }
    null !== a
      ? ((i = a),
        Math.abs(((a - s + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) > 0.2 &&
          ((r.avoidYaw = a), (r.avoidCd = 0.55)))
      : ((i = s + Math.PI * (Math.random() < 0.5 ? 0.6 : -0.6)),
        (r.avoidYaw = i),
        (r.avoidCd = 0.9));
  }
  r.steerYaw = i;
  let l = ((i - e.yaw + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return ((e.yaw += clamp(l, -n * a, n * a)), Math.abs(l));
}
function stuckCheck(e, t, o, a) {
  const n = e.ai;
  if (
    (n.lastP || (n.lastP = { x: e.pos.x, z: e.pos.z, t: 0, gd: 1 / 0 }),
    (n.lastP.t += t),
    n.lastP.t >= 1.2)
  ) {
    const t = Math.hypot(e.pos.x - n.lastP.x, e.pos.z - n.lastP.z);
    let r = !0;
    if (void 0 !== o) {
      const t = Math.hypot(o - e.pos.x, a - e.pos.z);
      ((r = t < n.lastP.gd - 1), (n.lastP.gd = t));
    }
    if (t < 1 || (!r && !n.path)) {
      n.stuck = (n.stuck || 0) + 1;
      const t = n.stuck % 2 ? 1 : -1,
        o = Math.min(2.6, 1 + 0.45 * n.stuck);
      ((n.avoidYaw = e.yaw + t * o),
        (n.avoidCd = 1.4 + Math.min(2, 0.3 * n.stuck)),
        (n.detour = {
          x: e.pos.x - 16 * Math.sin(n.avoidYaw),
          z: e.pos.z - 16 * Math.cos(n.avoidYaw),
          t: 2.5,
        }));
    } else ((n.stuck = 0), (n.detour = null));
    ((n.lastP.x = e.pos.x), (n.lastP.z = e.pos.z), (n.lastP.t = 0));
  }
  return (
    n.detour && ((n.detour.t -= t), n.detour.t <= 0 && (n.detour = null)),
    n.stuck || 0
  );
}
const AI_LOADOUT = {
  strike: {
    match: "타격대",
    guns: ["rifle", "carbine", "autoshot", "shotgun", "burst", "vector"],
  },
  watch: {
    match: "감시자",
    guns: ["marksman", "sniper", "battle", "rifle", "burst"],
  },
  scout: {
    match: "척후대",
    guns: ["vector", "smg", "pdw", "carbine", "slugger", "rifle"],
  },
  brain: {
    match: "전략가",
    guns: ["rifle", "carbine", "battle", "burst", "lmg", "smg"],
  },
  base: {
    match: null,
    guns: ["rifle", "carbine", "battle", "burst", "smg", "shotgun"],
  },
};
function aiPickLoadout(e) {
  const t = e.agent && e.agent.role ? e.agent.role : "";
  let o = AI_LOADOUT.base.guns;
  for (const e in AI_LOADOUT) {
    const a = AI_LOADOUT[e];
    if (a.match && t.indexOf(a.match) >= 0) {
      o = a.guns;
      break;
    }
  }
  const a = o.filter((t) => WEAPONS[t] && WEAPONS[t].cost <= e.credits);
  if (!a.length) return o;
  const n = [];
  a.forEach((e, t) => {
    const o = Math.max(1, a.length - t);
    for (let t = 0; t < o; t++) n.push(e);
  });
  const r = n[Math.floor(Math.random() * n.length)];
  return [r].concat(a.filter((e) => e !== r));
}
function aiBuy(e) {
  if (!e || !isAI(e) || e._bought) return;
  e._bought = !0;
  const t = diffTune();
  e.credits = Math.max(
    e.credits,
    (t.budget || 4200) + Math.round(rnd(-400, 400)),
  );
  const o = t.dmg < 1 && Math.random() < 0.45,
    a = aiPickLoadout(e),
    n = o ? ["smg", "shotgun", "pdw", "carbine"] : a;
  let r = !1;
  for (const t of n) {
    const o = WEAPONS[t];
    if (o && e.credits >= o.cost) {
      (applyPurchase(e, "weapon", t), (r = !0));
      break;
    }
  }
  if (!r)
    for (const t of ["smg", "pdw", "shotgun", "machpist", "silenced"]) {
      const o = WEAPONS[t];
      if (o && e.credits >= o.cost) {
        applyPurchase(e, "weapon", t);
        break;
      }
    }
  if (
    (e.credits >= 1e3 && !o
      ? applyPurchase(e, "armor", "heavy")
      : e.credits >= 400 && applyPurchase(e, "armor", "light"),
    e.abilities)
  )
    for (let t = 0; t < e.abilities.length; t++) {
      const o = e.abilities[t];
      if (o.def.cost && !o.def.ult)
        for (; o.charges < o.def.charges && e.credits >= o.def.cost; ) {
          const a = o.charges;
          if ((applyPurchase(e, "ability", t), o.charges === a)) break;
        }
    }
  e.weapons.primary && (e.slot = "primary");
}
function aiBuyAll() {
  for (const e of world.actors)
    isAI(e) && e.alive && ((e._bought = !1), aiBuy(e));
}
function aiUseSkill(e, t) {
  if ((e.silenced || 0) > 0) return;
  const o = e.ai;
  if (!e.abilities || !e.abilities.length) return !1;
  const a = [];
  for (let t = 0; t < e.abilities.length; t++) {
    const o = e.abilities[t];
    if (!(o.cd > 0)) {
      if (o.def.ult) {
        if ((e.ultCharge || 0) < (e.ultMax || 5)) continue;
      } else if (o.charges <= 0) continue;
      a.push(t);
    }
  }
  if (!a.length) return !1;
  const n = a[Math.floor(Math.random() * a.length)],
    r = e.abilities[n],
    s = t
      ? { x: t.pos.x, z: t.pos.z }
      : {
          x: e.pos.x - 12 * Math.sin(e.yaw),
          z: e.pos.z - 12 * Math.cos(e.yaw),
        };
  CAST_REFUND = !1;
  try {
    botCast(e, r.def.type, r.def, s);
  } catch (e) {
    return ((CAST_REFUND = !1), !1);
  }
  const i = CAST_REFUND;
  return (
    (CAST_REFUND = !1),
    r.def.ult ? (e.ultCharge = 0) : i || r.charges--,
    (r.cd = i ? 3 : r.def.cd || rnd(10, 20)),
    (o.skill.cd = rnd(8, 18)),
    !0
  );
}
function aiThink(e, t) {
  if (!e.alive || !e.ai) return;
  const o = e.ai;
  if (
    (o.alertT > 0 && (o.alertT -= t),
    (o.repathCd -= t),
    (o.strafeCd -= t),
    o.skill && (o.skill.cd -= t),
    actorSpike(e, t),
    actorBusy(e))
  )
    return ((e.input.mv = [0, 0]), void (e.input.btn = 0));
  let a = 0,
    n = 0,
    r = 0;
  const s = SWEEP.on,
    i = diffTune(),
    l = s ? Math.max(12, i.turn) : i.turn,
    c = e.ultW ? ULTW[e.ultW.kind].aiRange : s ? 160 : i.range,
    d = s ? 0.2 : i.tol;
  let h = !1;
  if ("atk" === e.team) {
    const t = world.spike;
    if (e.hasSpike && "carried" === t.state) {
      const t = nearestSite(e.pos.x, e.pos.z);
      if (t) {
        Math.hypot(t.x - e.pos.x, t.z - e.pos.z) < t.r + 16 && (h = !0);
      }
    } else if ("dropped" === t.state) {
      Math.hypot(t.x - e.pos.x, t.z - e.pos.z) < 22 && (h = !0);
    }
  }
  let p = e.blind > 0 || h ? null : aiPickTarget(e),
    u = null,
    m = null;
  if (!p && e.blind <= 0 && !h)
    if (s) {
      const t = sweepTarget(e);
      t && ((u = t.e), (m = { x: t.e.pos.x, z: t.e.pos.z }));
    } else {
      const t = intelNearest(e);
      t && ((u = t.e), (m = { x: t.x, z: t.z }));
    }
  if (p) {
    ((o.state = "fight"), (o.lastSeen = { x: p.pos.x, z: p.pos.z }));
    let h =
      ((Math.atan2(-(p.pos.x - e.pos.x), -(p.pos.z - e.pos.z)) -
        e.yaw +
        3 * Math.PI) %
        (2 * Math.PI)) -
      Math.PI;
    e.yaw += clamp(h, -l * t, l * t);
    const u = Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
    (void 0 === o.aimT || (o.aimT -= t) <= 0) &&
      ((o.aimT = rnd(0.35, 0.8)),
      (o.aimHead = Math.random() < (i.hs || 0.18)),
      (o.aimJit = rnd(-(i.err || 0.26), i.err || 0.26)));
    const m = (p.y || 0) + (o.aimHead ? 1.86 : 1.02) * BODY_K + (o.aimJit || 0),
      f = Math.atan2(m - actorEye(e), Math.max(0.6, u)) - (e.pitch || 0);
    ((e.pitch = clamp((e.pitch || 0) + clamp(f, -l * t, l * t), -1.2, 1.2)),
      Math.abs(h) < d &&
        u < c &&
        !(e.concuss > 0 && Math.random() < 0.55) &&
        (r |= BTN.FIRE),
      o.strafeCd <= 0 &&
        ((o.strafe = rnd(-1, 1)), (o.strafeCd = rnd(0.5, 1.4))),
      (a = o.strafe * (s ? 0.35 : 0.7)),
      s ? u > 10 && (n = -1) : u > 22 && (n = -1),
      e.ultW && u > 0.75 * ULTW[e.ultW.kind].aiRange
        ? (n = -1)
        : u < 8 && (n = 1),
      n < 0 &&
        !pathClear(e, e.yaw, 3) &&
        ((n = 0), (a = o.strafe >= 0 ? 1 : -1)));
    const y = actorWeaponKey(e),
      M = (WEAPONS[y] && WEAPONS[y].mag) || 12,
      w = e.ammo[y] || 0;
    (w <= 0 || (w <= Math.max(2, 0.2 * M) && u > 26)) && (r |= BTN.RELOAD);
    (WEAPONS[y] &&
      ("저격총" === WEAPONS[y].cls || "소총" === WEAPONS[y].cls) &&
      u > 26 &&
      !e.ultW &&
      (r |= BTN.ADS),
      u < 18 && Math.random() < 0.02 && (o.crouchT = rnd(0.6, 1.6)),
      (o.crouchT = Math.max(0, (o.crouchT || 0) - t)) > 0 && (r |= BTN.CROUCH),
      o.skill &&
        o.skill.cd <= 0 &&
        u < 40 &&
        Math.random() < 0.035 &&
        aiUseSkill(e, p));
  } else if (m) {
    ((o.state = s ? "sweep" : "hunt"),
      (e.pitch = (e.pitch || 0) * Math.max(0, 1 - 3 * t)));
    const a = Math.hypot(m.x - e.pos.x, m.z - e.pos.z),
      i = navNext(e, m.x, m.z, t);
    (stuckCheck(e, t, i.x, i.z),
      steerToward(e, i.x, i.z, t, l),
      (n = -1),
      !s && a < 4 && u && TEAM_INTEL[e.team].delete(u.id));
    const c = actorWeaponKey(e);
    (e.ammo[c] || 0) <= 0 && (r |= BTN.RELOAD);
  } else {
    ((o.state = "advance"),
      (e.pitch = (e.pitch || 0) * Math.max(0, 1 - 3 * t)));
    const a = aiGoal(e);
    if (a) {
      const s = navNext(e, a.x, a.z, t);
      (stuckCheck(e, t, s.x, s.z), steerToward(e, s.x, s.z, t, 5.5), (n = -1));
      const i = Math.hypot(a.x - e.pos.x, a.z - e.pos.z);
      (e.hasSpike && i < 1.2 && (n = 0),
        o.skill &&
          o.skill.cd <= 0 &&
          i < 26 &&
          i > 8 &&
          Math.random() < 0.02 &&
          aiUseSkill(e, null));
      const l = actorWeaponKey(e),
        c = (WEAPONS[l] && WEAPONS[l].mag) || 12;
      (e.ammo[l] || 0) < c && (r |= BTN.RELOAD);
    }
  }
  if (((e.input.mv = [a, n]), (e.input.btn = r), r & BTN.FIRE)) {
    actorWeapon(e);
    e.fireCd <= 0 && e.reloading <= 0 && actorFire(e);
  }
  r & BTN.RELOAD && actorReload(e);
}
function aiPickTarget(e) {
  let t = null,
    o = 1e9,
    a = ("function" == typeof diffTune ? diffTune().range : 80) + 20;
  e.nearsight > 0 && (a = Math.min(a, 10));
  for (const n of world.actors) {
    if (!n.alive || n.team === e.team) continue;
    const r = Math.hypot(n.pos.x - e.pos.x, n.pos.z - e.pos.z);
    r > a ||
      rayBlocked(e.pos.x, e.y + 1.5, e.pos.z, n.pos.x, n.y + 1.1, n.pos.z) ||
      (intelReport(e, n), r < o && ((t = n), (o = r)));
  }
  return t;
}
function aiGoal(e) {
  const t = world.spike,
    o = e.ai && e.ai.site ? e.ai.site : MAP.sites[e.id % MAP.sites.length];
  if ("atk" === e.team) {
    if ("planted" === t.state) return { x: t.x, z: t.z };
    if ("dropped" === t.state) return { x: t.x, z: t.z };
    if (e.hasSpike) {
      (e._plantSite && MAP.sites.some((t) => t.id === e._plantSite.id)) ||
        (e._plantSite = nearestSite(e.pos.x, e.pos.z) || MAP.sites[0]);
      const t = e._plantSite;
      return { x: t.x, z: t.z };
    }
    const a = world.actors.find(
      (e) => e.alive && "atk" === e.team && e.hasSpike,
    );
    if (a && a !== e) {
      if (Math.hypot(a.pos.x - e.pos.x, a.pos.z - e.pos.z) > 14)
        return { x: a.pos.x, z: a.pos.z };
    }
    return { x: o.x, z: o.z };
  }
  return "planted" === t.state ? { x: t.x, z: t.z } : { x: o.x, z: o.z };
}
function nearestSite(e, t) {
  let o = null,
    a = 1e9;
  for (const n of MAP.sites) {
    const r = dist2(e, t, n.x, n.z);
    r < a && ((a = r), (o = n));
  }
  return o;
}
const NET = {
    mode: "solo",
    peer: null,
    id: null,
    room: null,
    conns: new Map(),
    up: null,
    tick: 0,
    lastSnap: null,
    prevSnap: null,
    snapT: 0,
    latency: 0,
    onLobby: null,
    onEvent: null,
    onSnapshot: null,
    onPeerGone: null,
    status: "idle",
    error: null,
  },
  PEER_PREFIX = "lgp7",
  roomToPeerId = (e) => `lgp7-${e}`;
function makeRoomCode() {
  const e = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let t = "";
  for (let o = 0; o < 6; o++) t += e[Math.floor(32 * Math.random())];
  return t;
}
function peerOpts() {
  return {
    debug: 0,
    config: {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:global.stun.twilio.com:3478" },
      ],
    },
  };
}
// Retire a transport before closing it: PeerJS can emit close/data synchronously.
function netCloseTransport() {
  const peer = NET.peer, cancel = NET.cancelConnect;
  NET.peer = null;
  NET.up = null;
  NET.cancelConnect = null;
  cancel && cancel();
  if (peer) {
    peer._stopSignaling && peer._stopSignaling();
    try { peer.destroy(); } catch (e) {}
  }
}
function netAbortError() {
  const error = new Error("연결 요청이 취소되었습니다");
  error.name = "AbortError";
  return error;
}
function netWatchSignaling(peer) {
  let timer = null, delay = 500, stopped = false;
  const current = () => !stopped && NET.peer === peer && !peer.destroyed;
  const schedule = () => {
    if (!current() || timer !== null || !peer.disconnected) return;
    timer = setTimeout(() => {
      timer = null;
      if (!current() || !peer.disconnected) return;
      try { peer.reconnect(); } catch (e) {}
      delay = Math.min(delay * 2, 8000);
      schedule();
    }, delay);
  };
  peer.on("disconnected", schedule);
  peer.on("error", schedule);
  peer.on("open", () => { clearTimeout(timer); timer = null; delay = 500; });
  peer._stopSignaling = () => { stopped = true; clearTimeout(timer); timer = null; };
}
function netHost(code) {
  return new Promise((resolve, reject) => {
    if (typeof Peer === "undefined") return reject(new Error("네트워크 모듈을 불러오지 못했습니다"));
    netCloseTransport();
    NET.conns.clear();
    NET.room = code || makeRoomCode();
    NET.mode = "host";
    NET.status = "connecting";
    NET.error = null;
    const peer = new Peer(roomToPeerId(NET.room), peerOpts());
    NET.peer = peer;
    let settled = false;
    const cancel = () => { if (!settled) { settled = true; clearTimeout(timer); reject(netAbortError()); } };
    const finish = (error) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (NET.cancelConnect === cancel) NET.cancelConnect = null;
      if (error) {
        if (NET.peer === peer) { NET.status = "error"; NET.error = error; netCloseTransport(); }
        reject(error);
      } else resolve(NET.room);
    };
    const timer = setTimeout(() => finish(new Error("방 생성 시간이 초과되었습니다")), 25000);
    NET.cancelConnect = cancel;
    netWatchSignaling(peer);
    peer.on("open", (id) => {
      if (NET.peer !== peer || peer.destroyed) return;
      NET.id = id; NET.status = "open"; finish();
    });
    peer.on("error", (error) => {
      if (NET.peer !== peer || settled) return;
      if (error.type === "unavailable-id") {
        settled = true; clearTimeout(timer); NET.cancelConnect = null;
        netHost(makeRoomCode()).then(resolve, reject);
      } else finish(error);
    });
    peer.on("close", () => {
      if (NET.peer !== peer) return;
      if (!settled) finish(new Error("방 연결이 닫혔습니다"));
      else NET.status = "closed";
    });
    peer.on("connection", (channel) => {
      if (NET.peer === peer && NET.mode === "host") hostAccept(channel);
      else channel.close();
    });
  });
}
function hostAccept(e) {
  const t = e.label;
  (e.on("open", () => {
    let o = NET.conns.get(e.peer);
    (o || ((o = {}), NET.conns.set(e.peer, o)),
      (o[t] = e),
      "event" === t && NET.onPeerJoin && NET.onPeerJoin(e.peer));
  }),
    e.on("data", (t) => hostRecv(e.peer, t)),
    e.on("close", () => hostDrop(e.peer)),
    e.on("error", () => hostDrop(e.peer)));
}
function hostDrop(e) {
  NET.conns.has(e) &&
    (NET.conns.delete(e), NET.onPeerGone && NET.onPeerGone(e));
}
function netJoin(e) {
  return new Promise((t, o) => {
    if ("undefined" == typeof Peer)
      return void o(new Error("네트워크 모듈을 불러오지 못했습니다"));
    ((NET.room = e), (NET.mode = "client"), (NET.status = "connecting"));
    const a = new Peer(null, peerOpts());
    NET.peer = a;
    const n = setTimeout(() => {
      "open" !== NET.status &&
        ((NET.status = "error"), o(new Error("방을 찾지 못했습니다")));
    }, 12e3);
    (a.on("open", () => {
      const r = roomToPeerId(e),
        s = a.connect(r, {
          label: "state",
          reliable: !1,
          serialization: "json",
        }),
        i = a.connect(r, {
          label: "event",
          reliable: !0,
          serialization: "json",
        });
      ((NET.up = { state: s, event: i }),
        i.on("open", () => {
          (clearTimeout(n), (NET.status = "open"), t(!0));
        }),
        s.on("data", (e) => clientRecv(e)),
        i.on("data", (e) => clientRecv(e)),
        i.on("close", () => {
          ((NET.status = "closed"), NET.onHostGone && NET.onHostGone());
        }),
        i.on("error", (e) => {
          (clearTimeout(n), (NET.status = "error"), o(e));
        }));
    }),
      a.on("error", (e) => {
        (clearTimeout(n), (NET.status = "error"), o(e));
      }));
  });
}
function sendSnapshot(e) {
  if ("host" === NET.mode)
    for (const [, t] of NET.conns)
      if (t.state && t.state.open)
        try {
          t.state.send(e);
        } catch (e) {}
}
function sendEventAll(e) {
  if ("host" === NET.mode)
    for (const [, t] of NET.conns)
      if (t.event && t.event.open)
        try {
          t.event.send(e);
        } catch (e) {}
}
function sendEventTo(e, t) {
  const o = NET.conns.get(e);
  if (o && o.event && o.event.open)
    try {
      o.event.send(t);
    } catch (e) {}
}
function sendInput(e) {
  if ("client" !== NET.mode || !NET.up) return;
  const t = NET.up.state;
  if (t && t.open)
    try {
      t.send(e);
    } catch (e) {}
}
function sendAction(e) {
  if ("client" !== NET.mode || !NET.up) return;
  const t = NET.up.event;
  if (t && t.open)
    try {
      t.send(e);
    } catch (e) {}
}
function hostRecv(e, t) {
  t &&
    t.t &&
    ("in" !== t.t
      ? NET.onAction && NET.onAction(e, t)
      : NET.onInput && NET.onInput(e, t));
}
function clientRecv(e) {
  if (e && e.t)
    return "s" === e.t
      ? ((NET.prevSnap = NET.lastSnap),
        (NET.lastSnap = e),
        (NET.snapT = 0),
        void (NET.onSnapshot && NET.onSnapshot(e)))
      : void (NET.onEvent && NET.onEvent(e));
}
function netShutdown() {
  cancelRoundEnd();
  NET.intent = (NET.intent || 0) + 1;
  netCloseTransport();
  NET.conns.clear();
  NET.mode = "solo";
  NET.status = "idle";
  NET.room = null;
  NET.id = null;
  NET.lastSnap = NET.prevSnap = null;
}
function peerCount() {
  return "host" === NET.mode ? NET.conns.size : "client" === NET.mode ? 1 : 0;
}
const room = {
    code: null,
    hostPeer: null,
    started: !1,
    map: "glacier",
    rounds: 13,
    diff: "normal",
    members: new Map(),
    slots: {
      atk: new Array(TEAM_SIZE).fill(null),
      def: new Array(TEAM_SIZE).fill(null),
    },
  },
  ROUND_OPTS = [
    { v: 13, n: "13선취" },
    { v: 7, n: "7선취" },
    { v: 3, n: "3선취" },
  ],
  DIFF_OPTS = [
    { v: "easy", n: "순한맛" },
    { v: "normal", n: "보통" },
    { v: "hard", n: "빡셈" },
  ],
  DIFF_TUNE = {
    easy: {
      turn: 4.5,
      tol: 0.1,
      range: 60,
      dmg: 0.7,
      budget: 2200,
      hs: 0.05,
      err: 0.42,
    },
    normal: {
      turn: 7,
      tol: 0.13,
      range: 80,
      dmg: 1,
      budget: 4200,
      hs: 0.18,
      err: 0.26,
    },
    hard: {
      turn: 11,
      tol: 0.17,
      range: 120,
      dmg: 1.35,
      budget: 6500,
      hs: 0.35,
      err: 0.14,
    },
  };
function diffTune() {
  return DIFF_TUNE[room.diff] || DIFF_TUNE.normal;
}
const BOT_NAMES = [
  "이준",
  "서윤",
  "도현",
  "하늘",
  "민석",
  "지우",
  "태양",
  "세인",
  "은별",
  "한결",
];
function lobbyReset(e, t) {
  ((room.code = e),
    (room.hostPeer = t),
    (room.started = !1),
    room.members.clear(),
    room.slots.atk.fill(null),
    room.slots.def.fill(null));
}
function lobbyAdd(e, t) {
  let o = lobbyHumans("atk") <= lobbyHumans("def") ? "atk" : "def",
    a = room.slots[o].indexOf(null);
  if ((a < 0 && (a = room.slots[o].indexOf("ai")), a < 0)) {
    const e = "atk" === o ? "def" : "atk";
    ((a = room.slots[e].indexOf(null)),
      a < 0 && (a = room.slots[e].indexOf("ai")),
      a >= 0 && (o = e));
  }
  return a < 0
    ? null
    : ((room.slots[o][a] = e),
      room.members.set(e, {
        name: t || "플레이어",
        team: o,
        slot: a,
        agentKey: null,
        ready: !1,
      }),
      { team: o, slot: a });
}
function lobbyRemove(e) {
  const t = room.members.get(e);
  t && ((room.slots[t.team][t.slot] = null), room.members.delete(e));
}
function lobbyMove(e, t, o) {
  const a = room.members.get(e);
  return (
    !!a &&
    !(o < 0 || o >= TEAM_SIZE) &&
    null === room.slots[t][o] &&
    (t !== a.team &&
      a.agentKey &&
      lobbyAgentTaken(t, a.agentKey, e) &&
      (a.agentKey = null),
    (room.slots[a.team][a.slot] = null),
    (room.slots[t][o] = e),
    (a.team = t),
    (a.slot = o),
    !0)
  );
}
function lobbyHumans(e) {
  return room.slots[e].filter((e) => e && "ai" !== e).length;
}
function lobbyAgentTaken(e, t, o) {
  for (const a of room.slots[e]) {
    if (!a || "ai" === a || a === o) continue;
    const e = room.members.get(a);
    if (e && e.agentKey === t) return !0;
  }
  return !1;
}
function lobbyPickAgent(e, t) {
  const o = room.members.get(e);
  return !!o && !lobbyAgentTaken(o.team, t, e) && ((o.agentKey = t), !0);
}
function lobbyToggleAI(e, t) {
  if (!room.slots[e]) return !1;
  if (t < 0 || t >= TEAM_SIZE) return !1;
  const o = room.slots[e][t];
  return (
    (!o || "ai" === o) && ((room.slots[e][t] = "ai" === o ? null : "ai"), !0)
  );
}
function lobbyFillAI(e) {
  for (const t of ["atk", "def"])
    for (let o = 0; o < TEAM_SIZE; o++) {
      const a = room.slots[t][o];
      (a && "ai" !== a) || (room.slots[t][o] = e ? "ai" : null);
    }
  return !0;
}
function lobbySetOpt(e, t) {
  return "map" === e
    ? ((room.map = t), !0)
    : "rounds" === e
      ? ((room.rounds = 0 | t), !0)
      : "diff" === e && ((room.diff = t), !0);
}
function lobbyCanStart() {
  const e = (e) => room.slots[e].filter((e) => null !== e).length;
  return e("atk") > 0 && e("def") > 0;
}
function lobbySnapshot() {
  const e = (e) =>
    room.slots[e].map((e, t) => {
      if (!e) return null;
      if ("ai" === e) return { ai: !0 };
      const o = room.members.get(e);
      return o
        ? { peer: e, name: o.name, agent: o.agentKey, ready: o.ready }
        : null;
    });
  return {
    t: "lobby",
    code: room.code,
    map: room.map,
    started: room.started,
    rounds: room.rounds,
    diff: room.diff,
    atk: e("atk"),
    def: e("def"),
    host: room.hostPeer,
  };
}
function lobbyStart() {
  ((room.started = !0), (world.actors = []));
  let e = 0;
  for (const t of ["atk", "def"])
    for (let o = 0; o < TEAM_SIZE; o++) {
      const a = room.slots[t][o],
        n = spawnPointFor(t, o);
      if (a && "ai" !== a) {
        const o = room.members.get(a),
          r = agentByKey(o.agentKey) || pickFreeAgent(t),
          s = createActor(e++, t, a === NET.id ? "me" : a, r, n);
        ((s.name = o.name), (o.actorId = s.id));
      } else if ("ai" === a) {
        const o = createActor(e++, t, "ai", pickFreeAgent(t), n);
        ((o.name = BOT_NAMES[e % BOT_NAMES.length]), (o.ai = freshAIState()));
      }
    }
  return world.actors;
}
function pickFreeAgent(e) {
  const t = new Set(
      world.actors
        .filter((t) => t.team === e)
        .map((e) => e.agent && e.agent.key),
    ),
    o = AGENTS.filter((e) => !t.has(e.key));
  return (o.length ? o : AGENTS)[
    Math.floor(Math.random() * (o.length || AGENTS.length))
  ];
}
function agentByKey(e) {
  return AGENTS.find((t) => t.key === e || t.id === e) || null;
}
function takeoverCandidates() {
  const e = autoTeam();
  return world.actors
    .filter((t) => t.team === e && isAI(t))
    .map((e) => ({
      id: e.id,
      team: e.team,
      name: e.name,
      agent: e.agent ? e.agent.name : "",
      alive: e.alive,
    }));
}
function joinInProgress(e, t, o) {
  let a = null != o ? actorById(o) : null;
  if (!a || !isAI(a)) {
    const e = autoTeam();
    a = freeSlotIn(e);
  }
  if (a && !a.alive && "live" === world.phase) {
    const e = world.actors.find((e) => e.team === a.team && isAI(e) && e.alive);
    e && (a = e);
  }
  if (!a) return null;
  (takeOver(a.id, e === NET.id ? "me" : e), (a.name = t || "플레이어"));
  const n = room.slots[a.team].indexOf("ai");
  return (
    n >= 0 &&
      ((room.slots[a.team][n] = e),
      room.members.set(e, {
        name: a.name,
        team: a.team,
        slot: n,
        agentKey: a.agent ? a.agent.key : null,
        ready: !0,
        actorId: a.id,
      })),
    a
  );
}
function leaveInProgress(e) {
  const t = room.members.get(e);
  (t && null != t.actorId && releaseToAI(t.actorId), lobbyRemove(e));
}
let lobbyState = null;
function renderLobby(e) {
  ((lobbyState = e),
    ($("lobby").hidden = !1),
    ($("lb-code").textContent = e.code || "------"));
  const t = "client" !== NET.mode;
  $("lb-start").style.display = t ? "" : "none";
  const o = lobbyCanStart();
  (($("lb-start").disabled = !o),
    ($("lb-start").textContent = o ? "교전 시작" : "양 팀에 최소 1명"));
  const a = "client" === NET.mode ? NET.peer.id : NET.id,
    n = (o, n) => {
      const r = $(n);
      ((r.innerHTML = ""),
        e[o].forEach((n, s) => {
          const i = document.createElement("button");
          if (n)
            if (n.ai)
              ((i.className = "lb-slot ai"),
                (i.innerHTML =
                  '<div class="lb-av">AI</div><div><div class="lb-nm">AI 봇</div>\n          <div class="lb-ag">요원 자동 배정</div></div>\n          ' +
                  (t
                    ? '<span class="lb-x" data-ai="1">빼기</span>'
                    : '<span class="lb-tag">봇</span>')),
                (i.onclick = (e) => {
                  t && e.target.closest("[data-ai]") && requestAI(o, s);
                }));
            else {
              const t = n.peer === a;
              i.className = "lb-slot" + (t ? " me" : "");
              const o = n.agent ? agentByKey(n.agent)?.name || "—" : "미선택";
              ((i.innerHTML = `<div class="lb-av">${String((n.name || "?")[0]).replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";")}</div>\n          <div><div class="lb-nm">${String(n.name || "플레이어").replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";")}${t ? " (나)" : ""}</div>\n          <div class="lb-ag">${o}</div></div>\n          ${n.peer === e.host ? '<span class="lb-tag">방장</span>' : ""}`),
                (i.disabled = !0));
            }
          else
            ((i.className = "lb-slot empty"),
              (i.innerHTML =
                '<div class="lb-av">+</div><div><div class="lb-nm">빈 자리</div>\n          <div class="lb-ag">눌러서 이 자리로 이동</div></div>\n          ' +
                (t ? '<span class="lb-x" data-ai="1">+ AI</span>' : "")),
              (i.onclick = (e) => {
                t && e.target.closest("[data-ai]")
                  ? requestAI(o, s)
                  : requestMove(o, s);
              }));
          r.appendChild(i);
        }));
    };
  (n("atk", "lb-atk"),
    n("def", "lb-def"),
    paintAgents(e, a),
    paintMaps(e, t),
    paintOpts(e, t));
}
function paintOpts(e, t) {
  const o = (e, o, a, n) => {
    const r = $(e);
    r &&
      ((r.innerHTML = ""),
      o.forEach((e) => {
        const o = document.createElement("button");
        ((o.className = "lb-obtn" + (a === e.v ? " on" : "")),
          (o.textContent = e.n),
          (o.disabled = !t),
          (o.onclick = () => requestOpt(n, e.v)),
          r.appendChild(o));
      }));
  };
  (o("lb-rounds", ROUND_OPTS, e.rounds || 13, "rounds"),
    o("lb-diff", DIFF_OPTS, e.diff || "normal", "diff"));
  const a = $("lb-fill"),
    n = $("lb-clear");
  (a && ((a.disabled = !t), (a.onclick = () => requestFill(!0))),
    n && ((n.disabled = !t), (n.onclick = () => requestFill(!1))));
}
function myLobbyEntry(e, t) {
  for (const o of ["atk", "def"])
    for (const a of e[o]) if (a && a.peer === t) return { ...a, team: o };
  return null;
}
function paintAgents(e, t) {
  const o = myLobbyEntry(e, t),
    a = $("lb-agents");
  a.innerHTML = "";
  const n = new Set();
  (o &&
    e[o.team].forEach((e) => {
      e && !e.ai && e.peer !== t && e.agent && n.add(e.agent);
    }),
    AGENTS.forEach((e) => {
      const t = document.createElement("button");
      ((t.className = "lb-agent" + (o && o.agent === e.key ? " on" : "")),
        (t.disabled = n.has(e.key)),
        (t.innerHTML = `<b style="color:${e.color}">${e.name}</b><em>${e.role}</em>`),
        (t.onclick = () => requestAgent(e.key)),
        a.appendChild(t));
    }));
}
const MAP_LIST = [
  { key: "glacier", name: "빙하 관측소" },
  { key: "dunes", name: "모래무덤" },
  { key: "freighter", name: "강철 항로" },
  { key: "neon", name: "네온 정점" },
  { key: "garden", name: "연화원" },
  { key: "market", name: "한옥 시장" },
  { key: "temple", name: "폐사찰" },
  { key: "harbor", name: "해안 포구" },
  { key: "forge", name: "용암 제련소" },
  { key: "jungle", name: "밀림 유적" },
];
function paintSelMaps() {
  const e = $("sel-maps");
  e &&
    ((e.innerHTML = ""),
    MAP_LIST.forEach((t) => {
      const o = document.createElement("button");
      ((o.className = "lb-map" + (room.map === t.key ? " on" : "")),
        (o.textContent = t.name),
        (o.onclick = () => {
          ((room.map = t.key), paintSelMaps());
        }),
        e.appendChild(o));
    }));
}
function paintMaps(e, t) {
  const o = $("lb-maps");
  ((o.innerHTML = ""),
    MAP_LIST.forEach((a) => {
      const n = document.createElement("button");
      ((n.className = "lb-map" + (e.map === a.key ? " on" : "")),
        (n.textContent = a.name),
        (n.disabled = !t),
        (n.onclick = () => requestOpt("map", a.key)),
        o.appendChild(n));
    }));
}
function requestMove(e, t) {
  "client" === NET.mode
    ? sendAction({ t: "move", team: e, slot: t })
    : lobbyMove(NET.id, e, t) &&
      (sendEventAll(lobbySnapshot()), renderLobby(lobbySnapshot()));
}
function requestAgent(e) {
  "client" === NET.mode
    ? sendAction({ t: "agent", key: e })
    : lobbyPickAgent(NET.id, e) &&
      (sendEventAll(lobbySnapshot()), renderLobby(lobbySnapshot()));
}
function requestAI(e, t) {
  "client" !== NET.mode &&
    lobbyToggleAI(e, t) &&
    (sendEventAll(lobbySnapshot()), renderLobby(lobbySnapshot()));
}
function requestFill(e) {
  "client" !== NET.mode &&
    (lobbyFillAI(e),
    sendEventAll(lobbySnapshot()),
    renderLobby(lobbySnapshot()));
}
function requestOpt(e, t) {
  "client" !== NET.mode &&
    lobbySetOpt(e, t) &&
    (sendEventAll(lobbySnapshot()), renderLobby(lobbySnapshot()));
}
const SNAP_HZ = 20,
  INPUT_HZ = 60;
let _snapAcc = 0,
  _inputAcc = 0;
function isHost() {
  return "client" !== NET.mode;
}
function netStep(e) {
  world._adt = e;
  const t = myActor();
  if (isHost()) {
    (intelTick(e), sweepUpdate(e));
    try {
      (camera.updateMatrixWorld(), updateFrustum());
    } catch (e) {}
    PATH_BUDGET.n = 3;
    for (const t of world.actors) isAI(t) && t.alive && aiThink(t, e);
    if (t && t.alive) {
      const e = gatherInput();
      ((t.input.mv = e.mv), (t.input.btn = e.btn));
    }
    for (const t of world.actors) (t.alive && simMove(t, e), syncActorModel(t));
    for (const t of world.actors) t.alive && resolveActions(t, e);
    "host" === NET.mode &&
      ((_snapAcc += e),
      _snapAcc >= 0.05 && ((_snapAcc = 0), sendSnapshot(buildSnapshot())));
  } else {
    if (((_inputAcc += e), _inputAcc >= 1 / 60)) {
      _inputAcc = 0;
      const e = gatherInput();
      ((e.t = "in"), (e.seq = ++_inputSeq), sendInput(e));
    }
    if (t && t.alive) {
      {
        const e = gatherInput();
        ((t.input.mv = e.mv),
          (t.input.btn = e.btn),
          (t.input.yaw = t.yaw),
          (t.input.pitch = t.pitch));
      }
      simMove(t, e);
    }
    try {
      (camera.updateMatrixWorld(), updateFrustum());
    } catch (e) {}
    for (const o of world.actors)
      (o !== t && interpRemote(o, e), syncActorModel(o));
  }
  t && t.alive && followCamera(t, e);
}
let _inputSeq = 0;
function myActor() {
  return (
    (world.actors &&
      world.actors.length &&
      world.actors.find((e) => "me" === e.ctrl)) ||
    null
  );
}
const _v3tmp = new T.Vector3(),
  _frustum = new T.Frustum(),
  _fmat = new T.Matrix4();
let _frustumT = 0;
function updateFrustum() {
  (_fmat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    _frustum.setFromProjectionMatrix(_fmat));
}
function tickDeath(e, t) {
  const o = e.model,
    a = e.group;
  if (!o || !a || !o.hips) return !1;
  e._deadT = (e._deadT || 0) + t;
  const n = e._deadT;
  if ((e._revMark && (e._revMark.visible = !1), n > 2.3))
    return ((a.visible = !1), !1);
  a.rotation.order = "YXZ";
  const r = Math.min(1, n / 0.25),
    s = n < 0.2 ? 0 : Math.min(1, (n - 0.2) / 0.55),
    i = s < 1 ? 1 - Math.pow(1 - s, 3) : 1,
    l =
      s >= 1
        ? 0.06 * Math.max(0, Math.sin(Math.min(1, (n - 0.75) / 0.2) * Math.PI))
        : 0,
    c = e._deathBack ? -1 : 1,
    d = e._deathHead;
  ((a.rotation.x = c * (1.42 * i - l) * (d ? 0.95 : 1)),
    (a.rotation.z = e._deathSide * i),
    (o.hips.position.y = 0.92 - 0.2 * r - 0.12 * i),
    (o.legL.leg.rotation.x = 0.35 * r * (1 - 0.5 * i)),
    (o.legR.leg.rotation.x = 0.1 * r),
    (o.legL.shin.rotation.x = -0.9 * r * (1 - 0.6 * i)),
    (o.legR.shin.rotation.x = -0.5 * r * (1 - 0.6 * i)),
    (o.chest.rotation.x = (d ? -0.35 : 0.25) * r * (1 - 0.6 * i)),
    (o.armR.arm.rotation.x = 1.3 - 1.9 * i),
    (o.armR.fore.rotation.x = -0.2),
    (o.armL.arm.rotation.x = 1.2 - 2.1 * i),
    (o.armL.fore.rotation.x = -0.35),
    o.neck && (o.neck.rotation.x = -0.3 * c * i));
  const h = n > 1.7 ? (n - 1.7) / 0.6 : 0;
  return ((a.position.y = e.y - 0.55 * h), !0);
}
function syncActorModel(e) {
  if (!e.group) return;
  const t = myActor();
  if (
    (e.group.position.set(e.pos.x, e.y, e.pos.z),
    (e.group.rotation.y = e.yaw),
    !e.alive && void 0 !== e._deadT && "me" !== e.ctrl)
  ) {
    const t = tickDeath(e, world._adt || 0.016);
    return void (e.group.visible = t);
  }
  (0 === e.group.rotation.x && 0 === e.group.rotation.z) ||
    ((e.group.rotation.x = 0), (e.group.rotation.z = 0));
  let o = e.alive && "me" !== e.ctrl,
    a = !0;
  if (o && t && e !== t) {
    const n = e.pos.x - t.pos.x,
      r = e.pos.z - t.pos.z,
      s = n * n + r * r;
    (_frustum.containsPoint(e.group.position) ||
      (_v3tmp.set(e.pos.x, e.y + 1, e.pos.z),
      _frustum.containsPoint(_v3tmp) || (o = !1)),
      s > 4900 && (a = !1),
      s < 1.15 * 1.15 && (o = !1));
    const i = o && s < 2025;
    e._shadowOn !== i &&
      ((e._shadowOn = i),
      e.group.traverse((e) => {
        e.isMesh && e.userData.cast && (e.castShadow = i);
      }));
  }
  if (((e.group.visible = o), "me" !== e.ctrl && o && a))
    try {
      animateFighter(e, world._adt || 0.016);
    } catch (e) {}
  if (!o) return;
  if (!t || !e.model || !e.model.visor) return;
  const n = e.team !== t.team,
    r = n && e.revealed > 0;
  if (r || e._revMark) {
    if (!e._revMark) {
      const t = glowDot(16726862, 0.7, 2.4);
      ((t.material.depthTest = !1),
        (t.material.userData.keep = !0),
        (t.renderOrder = 998));
      const o = new T.Sprite(
        new T.SpriteMaterial({
          map: revTex(),
          color: 16777215,
          depthTest: !1,
          depthWrite: !1,
          transparent: !0,
        }),
      );
      (o.scale.setScalar(0.38),
        (o.renderOrder = 999),
        t.add(o),
        (t.position.y = 2.45),
        e.group.add(t),
        (e._revMark = t));
    }
    if (((e._revMark.visible = r), r)) {
      const t = 0.62 + 0.12 * Math.sin(8 * (world._clock || 0));
      e._revMark.scale.setScalar(t);
    }
  }
  (e.model.visor.material.color.setHex(
    r ? 16726862 : "atk" === e.team ? 16739146 : 3718648,
  ),
    e.group.children.forEach((e) => {
      e.material && (e.material.depthTest = !r);
    }),
    e.spikeMark && (e.spikeMark.visible = e.hasSpike && e.alive && (!n || r)));
}
function hostHandleBuy(e, t) {
  const o = world.actors.find((t) => t.ctrl === e);
  o &&
    "buy" === world.phase &&
    (applyPurchase(o, t.kind, t.key),
    sendEventTo(e, {
      t: "wallet",
      c: o.credits,
      w: o.weapons,
      am: o.ammo,
      ar: o.armor,
      s: o.slot,
    }));
}
function applyPurchase(e, t, o) {
  const a = e.credits >= 999999,
    n = (t) => {
      if (!a) {
        if (e.credits < t) return !1;
        e.credits -= t;
      }
      return !0;
    };
  if ("armor" === t) {
    const t = "heavy" === o ? 1e3 : 400,
      a = "heavy" === o ? 50 : 25;
    if (e.armor >= a) return;
    n(t) && (e.armor = a);
  } else if ("weapon" === t) {
    const t = WEAPONS[o];
    if (!t) return;
    if (!n(t.cost)) return;
    const a = "보조" === t.cls || "근접" === t.cls ? "secondary" : "primary";
    ((e.weapons[a] = o),
      (e.ammo[o] = t.mag),
      (e.reserve[o] = 999999),
      (e.slot = a));
  } else if ("ability" === t) {
    const t = e.abilities[0 | o];
    if (!t || !t.def.cost) return;
    if (t.charges >= t.def.charges) return;
    n(t.def.cost) && t.charges++;
  }
}
function myName() {
  let e = null;
  try {
    e = localStorage.getItem("lgp_name");
  } catch (e) {}
  return e || "플레이어" + Math.floor(900 * Math.random() + 100);
}
function setMyName(e) {
  try {
    localStorage.setItem("lgp_name", e);
  } catch (e) {}
}
async function createRoom() {
  const intent = NET.intent = (NET.intent || 0) + 1;
  netLoading("방을 만드는 중…");
  try {
    await ensurePeerLib();
    if (NET.intent !== intent) return;
    const code = await netHost();
    if (NET.intent !== intent) return;
    (lobbyReset(code, NET.id),
      lobbyAdd(NET.id, myName()),
      lobbyFillAI(!0),
      netLoadingDone(),
      hideAll(),
      renderLobby(lobbySnapshot()));
  } catch (e) {
    if (NET.intent !== intent || e.name === "AbortError") return;
    (netLoadingDone(),
      netAlert("방을 만들지 못했습니다. " + (e.message || "")));
  }
}
async function joinRoom(e) {
  if (6 !== (e = (e || "").trim().toUpperCase()).length) return netAlert("방 코드는 6자리입니다.");
  const intent = NET.intent = (NET.intent || 0) + 1;
  netLoading("방에 접속하는 중…");
  try {
    await ensurePeerLib();
    if (NET.intent !== intent) return;
    await netJoin(e);
    if (NET.intent !== intent) return;
    sendAction({ t: "hello", name: myName() });
    netLoadingDone();
    hideAll();
  } catch (e) {
    if (NET.intent !== intent || e.name === "AbortError") return;
    netLoadingDone();
    netShutdown();
    netAlert("접속하지 못했습니다. 코드를 확인해 주세요.");
  }
}
function hostStartMatch() {
  for (const [e, t] of room.members)
    if (!t.agentKey) {
      const e = new Set();
      for (const o of room.slots[t.team]) {
        const t = room.members.get(o);
        t && t.agentKey && e.add(t.agentKey);
      }
      const o = AGENTS.filter((t) => !e.has(t.key));
      t.agentKey = (o[0] || AGENTS[0]).key;
    }
  try {
    "function" == typeof loadMap &&
      CUR_MAP_KEY !== room.map &&
      loadMap(room.map);
  } catch (e) {
    console.warn("loadMap", e);
  }
  (clearActors(), lobbyStart());
  const e = myActor();
  (e &&
    (bindLocalPlayer(e),
    document.documentElement.style.setProperty("--ac", e.agent.color)),
    (world.scoreAtk = 0),
    (world.scoreDef = 0),
    (world.round = 1),
    (world.stats = { kills: 0, deaths: 0, dmg: 0, shots: 0, hits: 0 }),
    sendEventAll({
      t: "begin",
      map: room.map,
      rounds: room.rounds,
      diff: room.diff,
      actors: actorManifest(),
    }),
    enterMatch());
}
function actorManifest() {
  return world.actors.map((e) => ({
    id: e.id,
    team: e.team,
    agent: e.agent ? e.agent.key : null,
    name: e.name,
    ctrl: "me" === e.ctrl ? NET.id : e.ctrl,
  }));
}
function clientBeginMatch(e) {
  room.started = true;
  ((room.map = e.map),
    e.rounds && (room.rounds = 0 | e.rounds),
    e.diff && (room.diff = e.diff));
  try {
    "function" == typeof loadMap &&
      CUR_MAP_KEY !== room.map &&
      loadMap(room.map);
  } catch (e) {
    console.warn("loadMap", e);
  }
  clearActors();
  const t = NET.peer.id;
  let o = 0;
  for (const a of e.actors) {
    const n = a.team,
      r = spawnPointFor(n, o % TEAM_SIZE);
    a.team !== (e.actors[o - 1] || {}).team && (o = 0);
    const s = a.ctrl === t ? "me" : a.ctrl;
    ((createActor(a.id, n, s, agentByKey(a.agent), r).name = a.name), o++);
  }
  const a = myActor();
  (a &&
    (bindLocalPlayer(a),
    a.agent &&
      document.documentElement.style.setProperty("--ac", a.agent.color)),
    enterMatch());
}
function clientEnterMatch(e) {
  if (!e.started) return;
  // A fresh join needs the same manifest/map setup as the original match start.
  // A reconnect to the same body keeps its round and local state intact.
  const local = world.actors.find((a) => a.ctrl === "me");
  if (Array.isArray(e.actors) && (!local || local.id !== e.actorId || CUR_MAP_KEY !== e.map || world.phase === "menu")) clientBeginMatch(e);
  room.started = true;
  if (e.snapshot) NET.onSnapshot(e.snapshot);
  banner("교전에 합류했습니다", "#4ade80");
}
function clearActors() {
  (world.actors &&
    world.actors.forEach((e) => {
      if (e.group) { scene.remove(e.group); chDispose(e.group); }
    }),
    (world.actors = []),
    world.entities &&
      world.entities.forEach((e) => {
        e.group && scene.remove(e.group);
      }),
    (world.entities = []));
}
function bindLocalPlayer(e) {
  player = e;
  try {
    window.player = e;
  } catch (e) {}
  ((e.credits = 999999),
    topUpReserve(e),
    (e.spectate = null),
    (e.spectateT = 0),
    (e.deathCamYaw = e.yaw),
    (e.stats = world.stats));
}
function enterMatch() {
  (($("lobby").hidden = !0),
    hideAll(),
    buildCross(),
    enableTouch(),
    (teamBuilt = 0));
  const e = $("team");
  (e && (e.innerHTML = ""), startRound(), updateLockHint());
}
function hostLeftNotice() {
  (netAlert("방장이 나갔습니다. 대기실로 돌아갑니다."),
    netShutdown(),
    (world.phase = "menu"),
    ($("lobby").hidden = !0),
    hideAll(),
    show("s-title"));
}
((NET.onInput = (e, t) => {
  if (!GAME_RULES.validInput(t)) return;
  const o = world.actors.find((t) => t.ctrl === e);
  o &&
    (t.seq <= (o.input.seq || 0) ||
      ((o.input.seq = t.seq),
      (o.input.mv = t.mv),
      (o.input.btn = t.btn),
      (o.yaw = t.yaw),
      (o.pitch = t.pitch)));
}),
  (NET.onAction = (e, t) => {
    switch (t.t) {
      case "hello":
        if (room.started) {
          const o = joinInProgress(e, t.name, t.actorId);
          sendEventTo(e, {
            t: "joined",
            actorId: o ? o.id : null,
            started: !0,
            map: room.map,
            rounds: room.rounds,
            diff: room.diff,
            actors: actorManifest(),
            snapshot: buildSnapshot(false),
            cand: takeoverCandidates(),
          });
          if (o) {
            sendEventAll({ t: "ctrl", id: o.id, ctrl: e, name: o.name });
            sendEventTo(e, { t: "wallet", c: o.credits, w: o.weapons, am: o.ammo, ar: o.armor, s: o.slot });
          }
        } else (lobbyAdd(e, t.name), sendEventAll(lobbySnapshot()));
        break;
      case "abil": {
        const o = world.actors.find((t) => t.ctrl === e),
          a = o && o.abilities && Number.isInteger(t.i) && o.abilities[t.i];
        const flags = window.ADMIN2 && ADMIN2.flagsFor(o),
          unlimited = !!(flags && flags.infAbil);
        const ready =
          GAME_RULES.abilityReady(o, a, world.phase, unlimited) &&
          !(
            window.GAME_MODES &&
            GAME_MODES[room.mode] &&
            GAME_MODES[room.mode].noAbil
          );
        if (ready) {
          CAST_REFUND = !1;
          if (!unlimited) {
            if (a.def.ult) o.ultCharge = 0;
            else {
              a.charges--;
              a.cd = a.def.cd || 0;
            }
          }
          try {
            withCaster(o, () => castAbility(a.def.type, a.def));
            if (CAST_REFUND && !a.def.ult && !unlimited) {
              a.charges++;
              a.cd = 0;
            }
          } finally {
            CAST_REFUND = !1;
          }
        }
        if (o && a)
          sendEventTo(e, {
            t: "ability-state",
            i: t.i,
            ok: !!ready,
            charges: a.charges,
            cd: a.cd,
            ult: o.ultCharge,
          });
        break;
      }
      case "move":
        lobbyMove(e, t.team, t.slot) && sendEventAll(lobbySnapshot());
        break;
      case "agent":
        lobbyPickAgent(e, t.key) && sendEventAll(lobbySnapshot());
        break;
      case "buy":
        hostHandleBuy(e, t);
        break;
      case "start":
        e === room.hostPeer && hostStartMatch();
    }
  }),
  (NET.onPeerGone = (e) => {
    room.started
      ? leaveInProgress(e)
      : (lobbyRemove(e), sendEventAll(lobbySnapshot()));
  }),
  (NET.onPeerJoin = (e) => {}),
  (NET.onEvent = (e) => {
    switch (e.t) {
      case "cast":
        replayCast(e);
        break;
      case "lobby":
        renderLobby(e);
        break;
      case "joined":
        clientEnterMatch(e);
        break;
      case "begin":
        clientBeginMatch(e);
        break;
      case "kill":
        pushKill(e.k, e.v);
        break;
      case "round":
        banner(e.msg, e.color);
        break;
      case "bye":
        hostLeftNotice();
    }
  }),
  (NET.onHostGone = () => hostLeftNotice()),
  (NET.onSnapshot = (e) => applySnapshot(e)));
let _peerLibPromise = null;
function ensurePeerLib() {
  return "undefined" != typeof Peer
    ? Promise.resolve()
    : _peerLibPromise ||
        ((_peerLibPromise = new Promise((e, t) => {
          const o = document.createElement("script");
          ((o.src =
            "https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js"),
            (o.onload = () => e()),
            (o.onerror = () => {
              _peerLibPromise = null;
              o.remove();
              t(new Error("네트워크 모듈을 불러오지 못했습니다"));
            }),
            document.head.appendChild(o));
        })),
        _peerLibPromise);
}
function netLoading(e) {
  let t = $("netload");
  (t ||
    ((t = document.createElement("div")),
    (t.id = "netload"),
    (t.style.cssText =
      "position:fixed;inset:0;z-index:90;display:grid;place-items:center;background:rgba(10,13,18,.86);color:#8a97ab;font:500 12px/1.7 system-ui;letter-spacing:.22em"),
    document.body.appendChild(t)),
    (t.textContent = e),
    (t.style.display = "grid"));
}
function netLoadingDone() {
  const e = $("netload");
  e && (e.style.display = "none");
}
function netAlert(e) {
  (banner(e, "#ff3b4e"), netLoadingDone());
}
const SHOP_COLS = [
  { title: "장비", armor: !0, abil: !0 },
  { title: "근접 · 보조", cls: ["근접", "보조"] },
  { title: "기관단총 · 산탄총", cls: ["기관단총", "산탄총"] },
  { title: "소총", cls: ["소총"] },
  { title: "기관총 · 저격총", cls: ["기관총", "저격총"] },
];
function renderShop() {
  const e = myActor() || player,
    t = e.credits >= 999999;
  $("shop-cr").textContent = t
    ? "경기 크레딧 무제한"
    : "₩ " + e.credits.toLocaleString();
  const o = $("shop-grid");
  o.innerHTML = "";
  const a = (o) => t || e.credits >= o,
    n = (t, o) => {
      ("client" === NET.mode
        ? sendAction({ t: "buy", kind: t, key: o })
        : applyPurchase(e, t, o),
        renderShop(),
        updateHUD());
    },
    r = {};
  (Object.entries(WEAPONS).forEach(([e, t]) => {
    (r[t.cls] = r[t.cls] || []).push([e, t]);
  }),
    SHOP_COLS.forEach((s) => {
      const i = document.createElement("div");
      i.className = "shop-col";
      const l = document.createElement("div");
      ((l.className = "shop-sec"),
        (l.textContent = s.title),
        i.appendChild(l),
        s.armor &&
          [
            ["light", 25, 400, "경량 방어구"],
            ["heavy", 50, 1e3, "중형 방어구"],
          ].forEach(([o, r, s, l]) => {
            const c = document.createElement("button");
            ((c.className = "sitem"),
              (c.disabled = !a(s) || e.armor >= r),
              (c.innerHTML = `<b>${l}</b><span>${t ? "무료" : "₩ " + s.toLocaleString()}</span>\n          <em>방어구 ${r}${e.armor >= r ? " · 보유중" : ""}</em>`),
              (c.onclick = () => n("armor", o)),
              i.appendChild(c));
          }),
        (s.cls || []).forEach((o) => {
          (r[o] || []).forEach(([o, r]) => {
            const s = document.createElement("button");
            s.className = "sitem";
            const l = e.weapons.primary === o || e.weapons.secondary === o;
            ((s.disabled = !a(r.cost) || l),
              (s.innerHTML = `<b>${r.name}</b>\n          <span>${0 === r.cost ? "기본" : t ? "무료" : "₩ " + r.cost.toLocaleString()}</span>\n          <em>피해 ${r.dmg}${r.pellets ? "×" + r.pellets : ""} · 연사 ${r.rpm} · 탄창 ${r.mag}${l ? " · 보유중" : ""}</em>`),
              (s.onclick = () => n("weapon", o)),
              i.appendChild(s));
          });
        }),
        s.abil &&
          (e.abilities || []).forEach((e, o) => {
            if (!e.def.cost) return;
            const r = document.createElement("button");
            r.className = "sitem";
            const s = e.charges >= e.def.charges;
            ((r.disabled = !a(e.def.cost) || s),
              (r.innerHTML = `<b>${e.def.key} · ${e.def.name}</b>\n          <span>${t ? "무료" : "₩ " + e.def.cost}</span>\n          <em>보유 ${e.charges}/${e.def.charges}</em>`),
              (r.onclick = () => n("ability", o)),
              i.appendChild(r));
          }),
        o.appendChild(i));
    }));
}
function togglePause(e) {
  const t = $("pause");
  "menu" !== world.phase &&
    "over" !== world.phase &&
    (t.hidden || e
      ? ((t.hidden = !1),
        paintSettings(),
        document.exitPointerLock(),
        "function" == typeof updateLockHint && updateLockHint())
      : ((t.hidden = !0),
        IS_TOUCH || tryLock(),
        "function" == typeof updateLockHint && updateLockHint()));
}
$("shop-close").onclick = closeShop;
const MOTION_LABEL = [
  [0, "최소", "흔들림·번쩍임 없음, 능력 효과만 표시"],
  [0.35, "아주 약하게", "멀미가 있거나 화면이 어지러울 때"],
  [0.7, "약하게", "차분하게"],
  [1, "보통", "기본값"],
  [1.4, "강하게", "입자와 번쩍임이 크게"],
  [2, "최대", "과하게 화려 — 시야를 가릴 수 있음"],
];
function paintMotion() {
  const e = void 0 === SETTINGS.motion ? 1 : SETTINGS.motion,
    t = $("st-motion");
  t && (t.value = Math.round(100 * e));
  let o = MOTION_LABEL[0];
  for (const t of MOTION_LABEL) e >= t[0] && (o = t);
  const a = $("st-motion-v");
  a && (a.textContent = o[1] + " (" + Math.round(100 * e) + "%)");
  const n = $("st-motion-d");
  n && (n.textContent = o[2]);
}
function previewMotion() {
  try {
    const e = player && player.agent ? player.agent.color : "#ffc849",
      t = parseInt(String(e).replace("#", ""), 16) || 16762953;
    (edgeFlash(e, 0.55),
      screenShake(0.32),
      "menu" !== world.phase &&
        player &&
        player.pos &&
        castBurst(player.pos.x, player.pos.z, t, 0.9),
      "object" == typeof SFX && SFX.abilityCast && SFX.abilityCast("_default"));
  } catch (e) {}
}
function paintSettings() {
  const e = (e, t) => {
      const o = $(e);
      o && (o.value = t);
    },
    t = (e, t) => {
      const o = $(e);
      o && (o.textContent = t);
    },
    o = (e, t) => {
      const o = $(e);
      o && o.classList.toggle("on", !!t);
    };
  (e("st-sens", Math.round(100 * SETTINGS.sens)),
    t("st-sens-v", SETTINGS.sens.toFixed(2)),
    e("st-ads", Math.round(100 * SETTINGS.adsSens)),
    t("st-ads-v", SETTINGS.adsSens.toFixed(2)),
    e("st-tsens", Math.round(100 * SETTINGS.touchSens)),
    t("st-tsens-v", SETTINGS.touchSens.toFixed(2)));
  const a = $("st-trow");
  (a && (a.hidden = !IS_TOUCH),
    o("st-touch", IS_TOUCH),
    o("st-shake", SETTINGS.shake),
    o("st-ultcut", !1 !== SETTINGS.ultCut),
    paintMotion(),
    o("st-sfx", SETTINGS.sfx),
    o("st-fps", SETTINGS.showFps),
    o("st-dynres", !1 !== SETTINGS.dynRes),
    o("st-dmgnums", !1 !== SETTINGS.dmgNums),
    paintQuality());
}
function paintQuality() {
  const e = $("st-quality");
  if (!e) return;
  e.innerHTML = "";
  GFX_ORDER.map((e) => [e, GFX_PRESETS[e].name, GFX_PRESETS[e].desc])
    .forEach(([t, o, a]) => {
      const n = document.createElement("button");
      ((n.className = "pz-q" + (SETTINGS.quality === t ? " on" : "")),
        (n.textContent = o),
        (n.title = a),
        (n.dataset.quality = t),
        n.setAttribute('aria-pressed', SETTINGS.quality === t ? 'true' : 'false'),
        (n.onclick = () => {
          (setQuality(t), paintQuality(), paintSettings());
        }),
        e.appendChild(n));
    });
  const t = $("st-q-desc");
  if (t) {
    const e = GFX_PRESETS[SETTINGS.quality]?.desc || "";
    t.textContent = e;
  }
  updateGfxLabel();
}
const FLY = {
  on: !1,
  speed: 22,
  yaw: 0,
  pitch: -0.25,
  pos: { x: 0, y: 30, z: 95 },
  vy: 0,
  locked: !1,
  last: 0,
};
function enterFly() {
  ((FLY.on = !0),
    (world.phase = "fly"),
    (world.over = !1),
    hideAll(),
    ($("flyui").hidden = !1),
    ($("hud").hidden = !0));
  const e = $("shop");
  (e && (e.hidden = !0),
    void 0 !== VM && VM.root && (VM.root.visible = !1),
    world.actors &&
      world.actors.forEach((e) => {
        e.group && (e.group.visible = !1);
      }),
    flyReset(),
    paintFlyMaps(),
    (FLY.last = performance.now()),
    IS_TOUCH || tryLock(),
    updateLockHint());
}
function exitFly() {
  ((FLY.on = !1),
    (FLY.locked = !1),
    ($("flyui").hidden = !0),
    document.exitPointerLock(),
    (world.phase = "menu"),
    camera.rotation.set(0, 0, 0),
    camera.position.set(0, 12, 62),
    (camera.fov = 70),
    camera.updateProjectionMatrix(),
    show("s-title"));
}
function flyReset() {
  const e = MAP.bounds;
  ((FLY.pos = { x: 0, y: 34, z: e ? e.maxZ - 8 : 90 }),
    (FLY.yaw = 0),
    (FLY.pitch = -0.3),
    (FLY.speed = 22));
}
function flyGoMap(e, t) {
  try {
    loadMap(e);
  } catch (e) {
    console.warn(e);
  }
  (world.actors &&
    world.actors.forEach((e) => {
      e.group && (e.group.visible = !1);
    }),
    flyReset(),
    paintFlyMaps());
  const o = MAP_LIST.find((t) => t.key === e);
  (o && "function" == typeof banner && banner(o.name, "#ffc849"),
    !t || IS_TOUCH || FLY.locked || tryLock());
}
function flyStepMap(e) {
  const t = MAP_LIST.findIndex((e) => e.key === CUR_MAP_KEY),
    o = MAP_LIST.length,
    a = MAP_LIST[((t < 0 ? 0 : t) + e + o) % o];
  a && flyGoMap(a.key, !1);
}
function paintFlyMaps() {
  const e = $("fly-maps");
  e &&
    (e.children.length !== MAP_LIST.length
      ? ((e.innerHTML = ""),
        MAP_LIST.forEach((t) => {
          const o = document.createElement("button");
          ((o.className = "fly-map" + (CUR_MAP_KEY === t.key ? " on" : "")),
            (o.textContent = t.name),
            o.addEventListener("pointerup", (e) => {
              (e.preventDefault(), e.stopPropagation(), flyGoMap(t.key, !1));
            }),
            e.appendChild(o));
        }))
      : MAP_LIST.forEach((t, o) => {
          e.children[o].classList.toggle("on", CUR_MAP_KEY === t.key);
        }));
}
function flyStep(e) {
  if (!FLY.on) return;
  const t = keys;
  let o = 0,
    a = 0,
    n = 0;
  (t.w && (o += 1),
    t.s && (o -= 1),
    t.a && (a -= 1),
    t.d && (a += 1),
    t.space && (n += 1),
    t.shift && (n -= 1));
  const r = FLY.speed * (t.control ? 2.6 : 1),
    s = Math.cos(FLY.yaw),
    i = Math.sin(FLY.yaw),
    l = Math.cos(FLY.pitch),
    c = -i * l,
    d = -s * l,
    h = Math.sin(FLY.pitch),
    p = s,
    u = -i;
  ((FLY.pos.x += (c * o + p * a) * r * e),
    (FLY.pos.z += (d * o + u * a) * r * e),
    (FLY.pos.y += (h * o + n) * r * e));
  const m = MAP.bounds;
  (m &&
    ((FLY.pos.x = clamp(FLY.pos.x, m.minX - 40, m.maxX + 40)),
    (FLY.pos.z = clamp(FLY.pos.z, m.minZ - 40, m.maxZ + 40))),
    (FLY.pos.y = clamp(FLY.pos.y, 0.6, 300)),
    (camera.rotation.order = "YXZ"),
    camera.position.set(FLY.pos.x, FLY.pos.y, FLY.pos.z),
    camera.rotation.set(FLY.pitch, FLY.yaw, 0),
    (camera.fov = 75),
    camera.updateProjectionMatrix());
  const f = $("fly-info");
  f &&
    (f.innerHTML =
      MAP.name +
      "<br>높이 <b>" +
      Math.round(FLY.pos.y) +
      "m</b> · 속도 <b>" +
      Math.round(FLY.speed) +
      "</b>");
}
const ADMIN_SLIDERS = [
    [
      "run",
      "달리기 속도",
      0.5,
      60,
      0.1,
      "m/s",
      "기본 9. 30이면 자동차, 60이면 순간이동 수준",
    ],
    [
      "walk",
      "걷기 속도",
      0.1,
      40,
      0.1,
      "m/s",
      "SHIFT를 누른 채 이동하는 속도. 기본 3.8",
    ],
    [
      "crouch",
      "앉기 속도",
      0.1,
      40,
      0.1,
      "m/s",
      "앉은 상태 이동 속도. 기본 4.2",
    ],
    [
      "adsMul",
      "조준 속도 배율",
      0.05,
      3,
      0.01,
      "배",
      "조준(우클릭) 중 속도. 기본 0.58 = 42% 감속",
    ],
    [
      "jumpV",
      "점프 힘",
      0.5,
      40,
      0.1,
      "m/s",
      "기본 6.1 → 1.4m. 20이면 건물 위로 날아간다",
    ],
    [
      "gravity",
      "중력",
      0.2,
      60,
      0.1,
      "m/s²",
      "기본 13.5. 낮출수록 오래 뜬다. 2 이하는 달나라",
    ],
    [
      "fastFire",
      "연사 배율",
      0.1,
      20,
      0.1,
      "배",
      "내 총의 발사 속도. 10이면 기관총처럼 쏟아진다",
    ],
    [
      "aiSpeed",
      "봇 속도 배율",
      0,
      5,
      0.05,
      "배",
      "봇 이동 속도. 0이면 제자리, 2면 두 배로 달린다",
    ],
  ],
  ADMIN_TOGGLES = [
    ["infAbil", "능력 무제한", "충전·쿨다운 없이 Q E C X 계속 사용"],
    ["infAmmo", "탄약 무제한", "재장전 없이 탄창이 항상 가득"],
    ["god", "무적", "어떤 피해도 받지 않는다"],
    ["oneShot", "한 방 처치", "내가 맞히면 무조건 즉사"],
    ["noRecoil", "반동 없음", "쏴도 조준선이 흔들리지 않는다"],
    ["freezeAI", "봇 정지", "봇이 움직이지 않는다 (사격은 한다)"],
  ],
  ADMIN_PRESETS = [
    ["기본값", {}],
    ["달나라", { gravity: 2.6, jumpV: 7 }],
    ["슈퍼 점프", { jumpV: 17, gravity: 11 }],
    ["번개", { run: 22, walk: 9, crouch: 10 }],
    ["무중력", { gravity: 0.8, jumpV: 4.5, run: 12 }],
    [
      "전능",
      {
        infAbil: !0,
        infAmmo: !0,
        god: !0,
        noRecoil: !0,
        run: 14,
        jumpV: 10,
        gravity: 9,
      },
    ],
    ["연습장", { freezeAI: !0, infAmmo: !0, infAbil: !0, god: !0 }],
  ];
function openAdmin() {
  (($("admin").hidden = !1),
    document.exitPointerLock(),
    ADMIN_UNLOCKED
      ? showAdminPanel()
      : (($("ad-lock").hidden = !1),
        ($("ad-panel").hidden = !0),
        ($("ad-err").hidden = !0),
        ($("ad-pass").value = ""),
        setTimeout(() => {
          try {
            $("ad-pass").focus();
          } catch (e) {}
        }, 60)));
}
function closeAdmin() {
  (($("admin").hidden = !0),
    updateAdminMark(),
    !IS_TOUCH &&
      $("pause").hidden &&
      $("shop").hidden &&
      "menu" !== world.phase &&
      tryLock());
}
function showAdminPanel() {
  (($("ad-lock").hidden = !0), ($("ad-panel").hidden = !1), buildAdminUI());
}
function tryAdminPass() {
  adminPassOk(($("ad-pass").value || "").trim())
    ? ((ADMIN_UNLOCKED = !0),
      saveAdmin(),
      ($("ad-err").hidden = !0),
      showAdminPanel())
    : (($("ad-err").hidden = !1),
      ($("ad-pass").value = ""),
      $("ad-pass").focus());
}
function buildAdminUI() {
  const e = $("ad-presets");
  ((e.innerHTML = ""),
    ADMIN_PRESETS.forEach(([t, o]) => {
      const a = document.createElement("button");
      ((a.className = "ad-preset"),
        (a.textContent = t),
        (a.onclick = () => {
          (Object.assign(ADMIN, ADMIN_DEF),
            Object.assign(ADMIN, o),
            saveAdmin(),
            buildAdminUI(),
            updateAdminMark(),
            banner(t, "#ffc849"));
        }),
        e.appendChild(a));
    }));
  const t = $("ad-grid");
  t.innerHTML = "";
  for (const [e, o, a, n, r, s, i] of ADMIN_SLIDERS) {
    const l = document.createElement("div");
    l.className = "ad-item" + (ADMIN[e] !== ADMIN_DEF[e] ? " changed" : "");
    const c = r < 1 ? (String(r).split(".")[1] || "").length : 0;
    l.innerHTML = `\n      <div class="ad-top">\n        <span class="ad-name">${o}</span>\n        <span class="ad-val">\n          <input class="ad-num" type="number" min="${a}" max="${n}" step="${r}">\n          <span class="ad-unit">${s}</span>\n        </span>\n      </div>\n      <div class="ad-desc">${i}</div>\n      <input type="range" min="${a}" max="${n}" step="${r}">\n      <div class="ad-range"><span>${a}</span><span>기본 ${ADMIN_DEF[e]}</span><span>${n}</span></div>`;
    const d = l.querySelector("input[type=range]"),
      h = l.querySelector(".ad-num"),
      p = () => {
        ((d.value = ADMIN[e]),
          (h.value = (+ADMIN[e]).toFixed(c)),
          l.classList.toggle("changed", ADMIN[e] !== ADMIN_DEF[e]),
          updateAdminState());
      },
      u = (t) => {
        ((t = Math.max(a, Math.min(n, isFinite(t) ? t : ADMIN_DEF[e]))),
          (ADMIN[e] = +t.toFixed(c + 2)),
          saveAdmin(),
          p(),
          updateAdminMark());
      };
    (d.addEventListener("input", () => u(+d.value)),
      h.addEventListener("input", () => {
        const e = +h.value;
        "" !== h.value && u(e);
      }),
      h.addEventListener("blur", p),
      (l.querySelector(".ad-name").style.cursor = "pointer"),
      (l.querySelector(".ad-name").title = "두 번 누르면 기본값"),
      (l.querySelector(".ad-name").ondblclick = () => u(ADMIN_DEF[e])),
      p(),
      t.appendChild(l));
  }
  const o = $("ad-toggles");
  o.innerHTML = "";
  for (const [e, t, a] of ADMIN_TOGGLES) {
    const n = document.createElement("div");
    ((n.className = "ad-tg" + (ADMIN[e] ? " on" : "")),
      (n.innerHTML = `<div><div class="ad-tgname">${t}</div><div class="ad-tgdesc">${a}</div></div>\n                   <span class="ad-dot"><i></i></span>`),
      (n.onclick = () => {
        ((ADMIN[e] = !ADMIN[e]),
          n.classList.toggle("on", ADMIN[e]),
          saveAdmin(),
          updateAdminState(),
          updateAdminMark());
      }),
      o.appendChild(n));
  }
  updateAdminState();
}
function updateAdminState() {
  const e = $("ad-state");
  if (!e) return;
  const t = Object.keys(ADMIN_DEF).filter(
    (e) => ADMIN[e] !== ADMIN_DEF[e],
  ).length;
  ((e.textContent = t ? t + "개 항목이 기본값과 다릅니다" : "전부 기본값"),
    (e.style.color = t ? "var(--gold)" : "var(--steel-dim)"));
}
function updateAdminMark() {
  const e = $("admin-mark");
  e &&
    (e.hidden = !(window.ADMIN_GRANTED || window.IS_OWNER) || !adminActive());
}
(($("pz-admin").onclick = () => openAdmin()),
  ($("ad-enter").onclick = () => tryAdminPass()),
  ($("ad-cancel").onclick = () => closeAdmin()),
  ($("ad-close").onclick = () => closeAdmin()),
  ($("ad-default").onclick = () => {
    (adminReset(),
      buildAdminUI(),
      updateAdminMark(),
      banner("기본값으로 되돌렸습니다", "#4ade80"));
  }),
  ($("ad-lockout").onclick = () => {
    ((ADMIN_UNLOCKED = !1),
      saveAdmin(),
      closeAdmin(),
      banner("관리자 모드를 잠갔습니다", "#8a97ab"));
  }),
  $("ad-pass").addEventListener("keydown", (e) => {
    "Enter" === e.key && tryAdminPass();
  }),
  $("ad-pass").addEventListener("input", () => {
    $("ad-err").hidden = !0;
  }),
  addEventListener("keydown", (e) => {
    "F9" === e.key &&
      (e.preventDefault(), $("admin").hidden ? openAdmin() : closeAdmin());
  }),
  updateAdminMark(),
  ($("pz-resume").onclick = () => {
    (($("pause").hidden = !0), IS_TOUCH || tryLock(), updateLockHint());
  }),
  ($("pz-quit").onclick = () => {
    (($("pause").hidden = !0),
      (world.phase = "menu"),
      document.exitPointerLock(),
      "function" == typeof netShutdown && "solo" !== NET.mode && netShutdown(),
      show("s-title"));
  }),
  ($("pz-reset").onclick = () => {
    (Object.assign(SETTINGS, SET_DEF),
      setQuality(SETTINGS.quality),
      ($("fps").hidden = !SETTINGS.showFps),
      paintSettings(),
      banner("설정을 기본값으로 되돌렸습니다", "#4ade80"));
  }),
  (function () {
    const e = (e, t, o, a) => {
      const n = $(e);
      if (!n) return;
      const r = () => {
        SETTINGS[t] = +n.value / a;
        const e = $(o);
        (e && (e.textContent = SETTINGS[t].toFixed(2)), saveSettings());
      };
      (n.addEventListener("input", r), n.addEventListener("change", r));
    };
    (e("st-sens", "sens", "st-sens-v", 100),
      e("st-ads", "adsSens", "st-ads-v", 100),
      (function () {
        const e = $("st-motion");
        if (!e) return;
        const t = (t) => {
          ((SETTINGS.motion = +e.value / 100),
            paintMotion(),
            saveSettings(),
            t && previewMotion());
        };
        (e.addEventListener("input", () => t(!1)),
          e.addEventListener("change", () => t(!0)));
      })(),
      e("st-tsens", "touchSens", "st-tsens-v", 100));
    const t = (e, t) => {
      const o = $(e);
      o &&
        (o.onclick = () => {
          (t(), saveSettings(), paintSettings());
        });
    };
    (t("st-touch", () => {
      setTouchMode(!IS_TOUCH);
      try {
        localStorage.setItem("lgp_touch_pick", IS_TOUCH ? "1" : "0");
      } catch (e) {}
    }),
      t("st-shake", () => {
        ((SETTINGS.shake = !SETTINGS.shake), SETTINGS.shake || (shake = 0));
      }),
      t("st-ultcut", () => {
        SETTINGS.ultCut = !SETTINGS.ultCut;
      }),
      $("st-slowmo") &&
        t("st-slowmo", () => {
          ((SETTINGS.slowMo = !SETTINGS.slowMo),
            SETTINGS.slowMo || ((TIMEFX.scale = 1), (TIMEFX.t = 0)));
        }),
      t("st-sfx", () => {
        SETTINGS.sfx = !SETTINGS.sfx;
      }),
      t("st-dmgnums", () => {
        SETTINGS.dmgNums = !1 === SETTINGS.dmgNums;
      }),
      t("st-dynres", () => {
        ((SETTINGS.dynRes = !1 === SETTINGS.dynRes),
          !1 === SETTINGS.dynRes &&
            1 !== DYNRES.scale &&
            ((DYNRES.scale = 1),
            renderer.setPixelRatio(
              Math.min(devicePixelRatio || 1, GFX.pixel),
            )));
      }),
      t("st-fps", () => {
        SETTINGS.showFps = !SETTINGS.showFps;
        const e = $("fps");
        e && (e.hidden = !SETTINGS.showFps);
      }));
  })());
let _hudTick = 0;
function _hT(e, t) {
  e && e._t !== t && ((e._t = t), (e.textContent = t));
}
function _hH(e, t) {
  e && e._h !== t && ((e._h = t), (e.innerHTML = t));
}
function _hW(e, t) {
  e && e._w !== t && ((e._w = t), (e.style.width = t));
}
function _hS(e, t, o) {
  if (!e) return;
  const a = "_s" + t;
  e[a] !== o && ((e[a] = o), (e.style[t] = o));
}
function updateHUD() {
  ($("hud").classList.toggle("dead", !player.alive),
    $("tips").classList.toggle("show", "buy" === world.phase),
    updateTeam());
  try {
    updateRoster();
  } catch (e) {}
  ($("hud").classList.toggle(
    "scoped",
    "function" == typeof isScoped && isScoped(),
  ),
    _hT($("v-hp"), Math.max(0, Math.ceil(player.hp))),
    _hW($("v-hpb"), clamp(player.hp, 0, 100) + "%"));
  {
    const e = $("vitals"),
      t = player.hp;
    (e.classList.toggle("low", player.alive && t <= 30),
      e.classList.toggle("mid", player.alive && t > 30 && t <= 60));
  }
  const e = performance.now();
  if (
    (0 === _hudTick || e - _hudTick > 2e3) &&
    !document.body.classList.contains("touching")
  ) {
    _hudTick = e;
    const t = $("topwrap"),
      o = $("spike");
    if (t && o) {
      const e = t.getBoundingClientRect();
      e.height > 0 && (o.style.top = Math.round(e.bottom + 8) + "px");
    }
  }
  (_hT($("v-ar"), Math.max(0, Math.ceil(player.armor))),
    _hW($("v-arb"), 2 * clamp(player.armor, 0, 50) + "%"));
  const t = curWeaponKey(),
    o = WEAPONS[t],
    a = player.reserve[t] || 0,
    n = player.ultW;
  if (($("ammo").classList.toggle("ultw", !!n), n)) {
    const e = ULTW[n.kind];
    ($("ammo").style.setProperty("--uwc", e.glow),
      _hH(
        $("am-count"),
        e.ammo
          ? `${n.ammo}<small>/${e.ammo}</small>`
          : `${Math.max(0, n.t).toFixed(1)}<small>초</small>`,
      ),
      _hT(
        $("am-name"),
        n.name +
          (e.ammo ? ` · ${Math.max(0, n.t).toFixed(0)}초` : "") +
          ("blades" === n.kind ? " · 우클릭 일제" : ""),
      ));
  } else
    (_hH(
      $("am-count"),
      `${player.ammo[t] || 0}<small>/${a >= 999999 ? "∞" : a}</small>`,
    ),
      _hT($("am-name"), o.name + (player.reloading > 0 ? " · 재장전" : "")));
  (_hT(
    $("am-credit"),
    player.credits >= 999999
      ? "경기 크레딧 무제한"
      : "₩ " + player.credits.toLocaleString(),
  ),
    _hT($("tb-atk"), world.scoreAtk),
    _hT($("tb-def"), world.scoreDef));
  const r = Math.max(0, world.roundTime);
  (_hT(
    $("tb-time"),
    `${Math.floor(r / 60)}:${String(Math.floor(r % 60)).padStart(2, "0")}`,
  ),
    _hT(
      $("tb-phase"),
      "buy" === world.phase
        ? "구매 단계"
        : "end" === world.phase
          ? "라운드 종료"
          : `${world.round} 라운드 · ${"atk" === player.team ? "공격" : "수비"}`,
    ));
  const s = $("skills"),
    i = (player.agent ? player.agent.id : "?") + ":" + player.abilities.length;
  (s.dataset.key !== i &&
    ((s.dataset.key = i),
    (s.innerHTML = ""),
    player.abilities.forEach((e) => {
      const t = document.createElement("div");
      ((t.className = "sk" + (e.def.ult ? " ult" : "")),
        t.style.setProperty("--ac", agentAccent()),
        (t.innerHTML = `${abIcon(e.def.type, "sk-ic")}<div class="sk-key">${e.def.key}</div>\n        <div class="sk-nm">${e.def.name}</div>\n        <div class="sk-ct"></div><div class="sk-cool"></div><div class="sk-chg"></div>${e.def.ult ? '<div class="sk-ultbar"></div>' : ""}`),
        s.appendChild(t));
    })),
    player.abilities.forEach((e, t) => {
      const o = s.children[t];
      if (!o) return;
      const a =
          o._r ||
          (o._r = {
            ct: o.querySelector(".sk-ct"),
            cool: o.querySelector(".sk-cool"),
            chg: o.querySelector(".sk-chg"),
            bar: o.querySelector(".sk-ultbar"),
          }),
        n = a.ct,
        r = a.cool,
        i = a.chg,
        l = o.classList.contains("off");
      if (e.def.ult) {
        if (
          (_hT(n, `${player.ultCharge}/${player.ultMax}`),
          o.classList.toggle("ready", player.ultCharge >= player.ultMax),
          o.classList.toggle("off", player.ultCharge < player.ultMax),
          _hS(r, "height", "0"),
          i)
        ) {
          if (i.childElementCount !== player.ultMax) {
            i.innerHTML = "";
            for (let e = 0; e < player.ultMax; e++)
              i.appendChild(document.createElement("i"));
          }
          [...i.children].forEach((e, t) =>
            e.classList.toggle("spent", t >= player.ultCharge),
          );
        }
        a.bar &&
          _hW(
            a.bar,
            Math.min(100, (player.ultCharge / player.ultMax) * 100) + "%",
          );
      } else if (
        (_hT(n, e.cd > 0 ? Math.ceil(e.cd) + "초" : e.charges),
        o.classList.toggle("off", e.charges <= 0 || e.cd > 0),
        _hS(
          r,
          "height",
          e.cd > 0 ? Math.round((e.cd / (e.def.cd || 1)) * 200) / 2 + "%" : "0",
        ),
        i)
      ) {
        const t = e.def.charges || 0;
        if (t > 1) {
          if (i.childElementCount !== t) {
            i.innerHTML = "";
            for (let e = 0; e < t; e++)
              i.appendChild(document.createElement("i"));
          }
          [...i.children].forEach((t, o) =>
            t.classList.toggle("spent", o >= e.charges),
          );
        } else i.childElementCount && (i.innerHTML = "");
      }
      l &&
        !o.classList.contains("off") &&
        (o.classList.remove("just-ready"),
        requestAnimationFrame(() => o.classList.add("just-ready")));
    }));
}
addEventListener("resize", () => {
  _hudTick = 0;
});
const tac = $("tac"),
  tctx = tac && tac.getContext("2d"),
  TAC_RANGE = 52;
// Both maps reuse their terrain image. The imported map has 44,380 boxes:
// repainting them on the corner minimap every third step stalls the main thread.
// Compare the exact painted bounds and tactical colour, including in-place door
// and wall edits. A shared revision invalidates both images, even at equal counts.
const MAP_WALLS = { key: null, bounds: [], boxes: new Float64Array(0), revision: 0 };
function mapWallRevision() {
  const b = MAP.bounds, state = MAP_WALLS;
  let changed = state.key !== CUR_MAP_KEY || state.boxes.length !== COLLIDERS.length * 5 ||
    state.bounds[0] !== b.minX || state.bounds[1] !== b.minZ || state.bounds[2] !== b.maxX || state.bounds[3] !== b.maxZ;
  if (!changed) {
    for (let i = 0, p = 0; i < COLLIDERS.length; i++, p += 5) {
      const c = COLLIDERS[i], a = state.boxes;
      if (a[p] !== c.minX || a[p + 1] !== c.minZ || a[p + 2] !== c.maxX || a[p + 3] !== c.maxZ || a[p + 4] !== (c.h > STEP_H ? 1 : 0)) {
        changed = true; break;
      }
    }
  }
  if (changed) {
    state.key = CUR_MAP_KEY; state.bounds = [b.minX, b.minZ, b.maxX, b.maxZ];
    if (state.boxes.length !== COLLIDERS.length * 5) state.boxes = new Float64Array(COLLIDERS.length * 5);
    for (let i = 0, p = 0; i < COLLIDERS.length; i++, p += 5) {
      const c = COLLIDERS[i], a = state.boxes;
      a[p] = c.minX; a[p + 1] = c.minZ; a[p + 2] = c.maxX; a[p + 3] = c.maxZ; a[p + 4] = c.h > STEP_H ? 1 : 0;
    }
    state.revision++;
  }
  return state.revision;
}
const TACW = { cv: null, sig: "", minX: 0, minZ: 0, w: 0, h: 0, k: 3 };
function drawTacWalls(r, s) {
  const B = MAP.bounds,
    sig = mapWallRevision() + ":" + TACW.k;
  if (!TACW.cv || TACW.sig !== sig) {
    const k = TACW.k,
      w = Math.ceil((B.maxX - B.minX + 8) * k),
      h = Math.ceil((B.maxZ - B.minZ + 8) * k);
    TACW.cv || (TACW.cv = document.createElement("canvas"));
    TACW.cv.width = w;
    TACW.cv.height = h;
    TACW.minX = B.minX - 4;
    TACW.minZ = B.minZ - 4;
    TACW.w = w / k;
    TACW.h = h / k;
    TACW.sig = sig;
    const g = TACW.cv.getContext("2d");
    for (const c of COLLIDERS) {
      g.fillStyle = c.h > STEP_H ? "rgba(86,100,120,.85)" : "rgba(70,82,98,.5)";
      g.fillRect((c.minX - TACW.minX) * k, (c.minZ - TACW.minZ) * k, (c.maxX - c.minX) * k, (c.maxZ - c.minZ) * k);
    }
  }
  tctx.drawImage(TACW.cv, r(TACW.minX), s(TACW.minZ), r(TACW.w), s(TACW.h));
}
function drawTac() {
  // the second map (top left) is no longer shown: one map on screen, the one at the top right
  if (!tctx || !tac.offsetWidth) return;
  const e = tac.width,
    t = tac.height,
    o = e / 2,
    a = t / 2,
    n = e / 2 / 52;
  (tctx.clearRect(0, 0, e, t),
    (tctx.fillStyle = "#0b0f16"),
    tctx.fillRect(0, 0, e, t),
    tctx.save(),
    tctx.translate(o, a),
    tctx.rotate(player.yaw),
    tctx.translate(-player.pos.x * n, -player.pos.z * n));
  const r = (e) => e * n,
    s = (e) => e * n;
  drawTacWalls(r, s);
  (MAP.sites.forEach((e) => {
    ((tctx.strokeStyle = "rgba(255,59,78,.6)"),
      (tctx.lineWidth = 2.5),
      tctx.beginPath(),
      tctx.arc(r(e.x), s(e.z), e.r * n, 0, 7),
      tctx.stroke(),
      tctx.save(),
      tctx.translate(r(e.x), s(e.z)),
      tctx.rotate(-player.yaw),
      (tctx.fillStyle = "rgba(255,90,105,.95)"),
      (tctx.font = "bold 22px Orbitron, sans-serif"),
      (tctx.textAlign = "center"),
      (tctx.textBaseline = "middle"),
      tctx.fillText(e.id, 0, 0),
      tctx.restore());
  }),
    (tctx.fillStyle = "rgba(150,165,185,.42)"),
    world.smokes.forEach((e) => {
      (tctx.beginPath(), tctx.arc(r(e.x), s(e.z), e.r * n, 0, 7), tctx.fill());
    }));
  const i = world.spike;
  if (
    ("planted" === i.state || "dropped" === i.state) &&
    ((tctx.fillStyle = "planted" === i.state ? "#ff3b4e" : "#ff9a3c"),
    tctx.beginPath(),
    tctx.arc(r(i.x), s(i.z), 7, 0, 7),
    tctx.fill(),
    "planted" === i.state)
  ) {
    ((tctx.strokeStyle = "rgba(255,59,78,.55)"), (tctx.lineWidth = 2));
    const e = 9 + 5 * Math.sin(performance.now() / 160);
    (tctx.beginPath(), tctx.arc(r(i.x), s(i.z), e, 0, 7), tctx.stroke());
  }
  (world.entities.forEach((e) => {
    if (!e.alive) return;
    const t = e.team === player.team;
    if (!t && e.revealed <= 0) return;
    const o = r(e.pos.x),
      a = s(e.pos.z);
    (tctx.save(),
      tctx.translate(o, a),
      tctx.rotate(-e.yaw),
      (tctx.fillStyle = t ? "rgba(74,222,128,.16)" : "rgba(255,59,78,.18)"),
      tctx.beginPath(),
      tctx.moveTo(0, 0),
      tctx.arc(0, 0, 26, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55),
      tctx.closePath(),
      tctx.fill(),
      tctx.restore(),
      (tctx.fillStyle = t ? "#4ade80" : "#ff3b4e"),
      tctx.beginPath(),
      tctx.arc(o, a, 6, 0, 7),
      tctx.fill(),
      (tctx.strokeStyle = "rgba(0,0,0,.6)"),
      (tctx.lineWidth = 1.5),
      tctx.stroke(),
      e.hasSpike &&
        ((tctx.strokeStyle = "#ff3b4e"),
        (tctx.lineWidth = 2),
        tctx.beginPath(),
        tctx.arc(o, a, 11, 0, 7),
        tctx.stroke()));
  }),
    tctx.restore(),
    tctx.save(),
    tctx.translate(o, a),
    (tctx.fillStyle = "rgba(255,255,255,.14)"),
    tctx.beginPath(),
    tctx.moveTo(0, 0),
    tctx.arc(0, 0, 46, -Math.PI / 2 - 0.62, -Math.PI / 2 + 0.62),
    tctx.closePath(),
    tctx.fill(),
    (tctx.fillStyle = "#fff"),
    tctx.beginPath(),
    tctx.moveTo(0, -9),
    tctx.lineTo(7, 7),
    tctx.lineTo(-7, 7),
    tctx.closePath(),
    tctx.fill(),
    tctx.restore());
  const l = tctx.createRadialGradient(o, a, 0.3 * e, o, a, 0.5 * e);
  (l.addColorStop(0, "rgba(11,15,22,0)"),
    l.addColorStop(1, "rgba(11,15,22,.92)"),
    (tctx.fillStyle = l),
    tctx.fillRect(0, 0, e, t));
}
let rosterKey = "";
function updateRoster() {
  const e = $("rs-mine"),
    t = $("rs-foe");
  if (!e || !t) return;
  let o;
  o =
    world.actors && world.actors.length
      ? world.actors
      : world.entities.concat(player ? [player] : []);
  const a = player ? player.team : "atk",
    n = o.filter((e) => e.team === a),
    r = o.filter((e) => e.team !== a),
    s =
      n.map((e) => e.id).join(",") +
      "|" +
      r.map((e) => e.id).join(",") +
      "|" +
      a;
  if (s !== rosterKey) {
    rosterKey = s;
    const o = (e, t, o) => {
      ((e.innerHTML = ""),
        t.forEach((t) => {
          const a = t.agent || { name: "요원", color: "#8a97ab" },
            n = document.createElement("div");
          ((n.className = "rs-p"),
            n.style.setProperty("--pc", o ? a.color : "#7a4650"),
            (n.title = (t.name || a.name) + " · " + a.name));
          let r = "";
          try {
            r = agentPortrait(a, 80, 100);
          } catch (e) {}
          ((n.innerHTML =
            (r ? `<img alt="" src="${r}">` : "") +
            '<div class="rs-hp"><i></i></div>'),
            e.appendChild(n),
            (t._rsEl = n));
        }));
    };
    (o(e, n, !0), o(t, r, !1));
  }
  let i = 0,
    l = 0;
  const c = (e, t) => {
    const o = e._rsEl;
    if (!o) return;
    const a = !!e.alive;
    (a && (t ? i++ : l++),
      o.classList.toggle("down", !a),
      o.classList.toggle("me", e === player),
      o.classList.toggle("spike", !!e.hasSpike));
    const n = o.querySelector(".rs-hp");
    if (n) {
      const o = t && a ? clamp(e.hp, 0, 100) : a ? 100 : 0;
      ((n.firstElementChild.style.width = o + "%"),
        n.classList.toggle("low", t && o <= 35),
        (n.style.opacity = t ? 1 : 0));
    }
  };
  (n.forEach((e) => c(e, !0)),
    r.forEach((e) => c(e, !1)),
    ($("rs-n-mine").textContent = i),
    ($("rs-n-foe").textContent = l));
}
const ARROWS = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
let teamBuilt = 0;
function updateTeam() {
  const e = $("team");
  if (!e) return;
  if (world.actors && world.actors.length)
    return void (e.style.display = "none");
  e.style.display = "";
  const t = world.entities.filter((e) => e.team === player.team);
  (teamBuilt !== t.length &&
    ((teamBuilt = t.length),
    (e.innerHTML = ""),
    t.forEach((t) => {
      const o = t.agent || { name: "아군", color: "#8a97ab", role: "" },
        a = document.createElement("div");
      ((a.className = "tm"),
        a.style.setProperty("--ac", o.color),
        (a.innerHTML = `\n        <img class="tm-img" alt="" src="${agentPortrait(o, 120, 150)}">\n        <div>\n          <div class="tm-top">\n            <span class="tm-name">${o.name}</span>\n            <span class="tm-stat tm-hpn"></span>\n          </div>\n          <div class="tm-bar"><i></i></div>\n          <div class="tm-sub"><span class="tm-wep">${t.weaponName || ""}</span>\n            <span class="tm-dist"></span></div>\n          <div class="tm-ult"><i></i><i></i><i></i><i></i></div>\n        </div>`),
        e.appendChild(a),
        (t._row = a));
    })),
    t.forEach((e) => {
      const t = e._row;
      if (!t) return;
      const o = Math.max(0, Math.round(e.hp));
      (t.classList.toggle("down", !e.alive),
        t.classList.toggle("spike", !!e.hasSpike));
      const a = t.querySelector(".tm-stat"),
        n = t.querySelector(".tm-bar"),
        r = n.firstElementChild;
      e.alive
        ? ((a.textContent = o),
          (a.className = "tm-stat tm-hpn"),
          (r.style.width = o + "%"),
          (n.className =
            "tm-bar" + (o <= 30 ? " crit" : o <= 60 ? " low" : "")))
        : ((a.textContent = "전사"),
          (a.className = "tm-stat tm-dead"),
          (r.style.width = "0%"));
      const s = t.querySelector(".tm-wep");
      s &&
        (e.hasSpike
          ? ((s.textContent = "스파이크 소지"), (s.className = "tm-wep tm-spk"))
          : ((s.textContent = e.weaponName || ""), (s.className = "tm-wep")));
      const i = t.querySelector(".tm-dist");
      if (e.alive) {
        const t = e.pos.x - player.pos.x,
          o = e.pos.z - player.pos.z,
          a = Math.hypot(t, o),
          n = Math.atan2(t, -o) - (player.yaw + Math.PI),
          r = ((Math.round(n / (Math.PI / 4)) % 8) + 8) % 8;
        i.textContent = `${ARROWS[r]} ${Math.round(a)}m`;
      } else i.textContent = "";
      const l = t.querySelectorAll(".tm-ult i"),
        c = e.alive ? clamp(1 - e.skill.cd / 18, 0, 1) : 0;
      l.forEach((e, t) => e.classList.toggle("on", c >= (t + 1) / 4));
    }));
}
function buildCross() {
  const e = $("cross");
  e.innerHTML = "";
  for (let t = 0; t < 4; t++) e.appendChild(document.createElement("i"));
}
function updateCross() {
  const e = $("cross");
  if (!e) return;
  if (e.children.length < 4) {
    e.innerHTML = "";
    for (let t = 0; t < 4; t++) e.appendChild(document.createElement("i"));
  }
  const t = player.vel || { x: 0, z: 0 },
    o =
      3 +
      1.5 * Math.hypot(t.x, t.z) +
      9 * (player.recoil || 0) +
      (player.ads ? -1.5 : 0),
    a = e.children,
    n = (e, t, o, a, n) => {
      ((e.style.width = a + "px"),
        (e.style.height = n + "px"),
        (e.style.left = 13 + t + "px"),
        (e.style.top = 13 + o + "px"));
    };
  (n(a[0], -1, -o - 5, 2, 5),
    n(a[1], -1, o, 2, 5),
    n(a[2], -o - 5, -1, 5, 2),
    n(a[3], o, -1, 5, 2));
}
const mini = $("mini"),
  mctx = mini.getContext("2d");
const MINIW = { cv: null, sig: "" };
function drawMiniWalls() {
  const e = mini.width, t = mini.height,
    sig = mapWallRevision() + ":" + e + ":" + t;
  if (!MINIW.cv || MINIW.sig !== sig) {
    const b = MAP.bounds, x = e / (b.maxX - b.minX), z = t / (b.maxZ - b.minZ);
    MINIW.cv || (MINIW.cv = document.createElement("canvas"));
    MINIW.cv.width = e; MINIW.cv.height = t;
    const g = MINIW.cv.getContext("2d");
    g.fillStyle = "#2a3444";
    for (const c of COLLIDERS) g.fillRect((c.minX - b.minX) * x, (c.minZ - b.minZ) * z, (c.maxX - c.minX) * x, (c.maxZ - c.minZ) * z);
    MINIW.sig = sig;
  }
  mctx.drawImage(MINIW.cv, 0, 0);
}
function drawMini() {
  const e = mini.width,
    t = mini.height,
    o = MAP.bounds,
    a = e / (o.maxX - o.minX),
    n = t / (o.maxZ - o.minZ),
    r = (e) => (e - o.minX) * a,
    s = (e) => (e - o.minZ) * n;
  (mctx.clearRect(0, 0, e, t),
    (mctx.fillStyle = "#0d1118"),
    mctx.fillRect(0, 0, e, t),
    (mctx.fillStyle = "#2a3444"));
  drawMiniWalls();
  (MAP.sites.forEach((e) => {
    ((mctx.strokeStyle = "rgba(255,59,78,.55)"),
      (mctx.lineWidth = 2),
      mctx.beginPath(),
      mctx.arc(r(e.x), s(e.z), e.r * a, 0, 7),
      mctx.stroke(),
      (mctx.fillStyle = "rgba(255,59,78,.85)"),
      (mctx.font = "bold 17px Orbitron, sans-serif"),
      (mctx.textAlign = "center"),
      (mctx.textBaseline = "middle"),
      mctx.fillText(e.id, r(e.x), s(e.z)));
  }),
    (mctx.fillStyle = "rgba(150,165,185,.4)"),
    world.smokes.forEach((e) => {
      (mctx.beginPath(), mctx.arc(r(e.x), s(e.z), e.r * a, 0, 7), mctx.fill());
    }));
  const i = world.spike;
  if ("planted" === i.state || "dropped" === i.state) {
    if ("planted" === i.state) {
      const e = (performance.now() / 1e3) % 1;
      ((mctx.strokeStyle = `rgba(255,59,78,${0.85 * (1 - e)})`),
        (mctx.lineWidth = 2.5),
        mctx.beginPath(),
        mctx.arc(r(i.x), s(i.z), 7 + 17 * e, 0, 7),
        mctx.stroke());
    }
    ((mctx.fillStyle = "planted" === i.state ? "#ff3b4e" : "#ff9a3c"),
      mctx.beginPath(),
      mctx.arc(r(i.x), s(i.z), 6, 0, 7),
      mctx.fill());
  }
  world.entities.forEach((e) => {
    if (!e.alive) return;
    const t = e.team === player.team;
    (!t && e.revealed <= 0) ||
      ((mctx.fillStyle = t ? "#4ade80" : "#ff3b4e"),
      mctx.beginPath(),
      mctx.arc(r(e.pos.x), s(e.pos.z), 5, 0, 7),
      mctx.fill());
  });
  const l = r(player.pos.x),
    c = s(player.pos.z);
  (mctx.save(),
    mctx.translate(l, c),
    mctx.rotate(-player.yaw),
    (mctx.fillStyle = "rgba(255,255,255,.16)"),
    mctx.beginPath(),
    mctx.moveTo(0, 0),
    mctx.arc(0, 0, 42, -Math.PI / 2 - 0.7, -Math.PI / 2 + 0.7),
    mctx.closePath(),
    mctx.fill(),
    (mctx.fillStyle = "#fff"),
    mctx.beginPath(),
    mctx.moveTo(0, -8),
    mctx.lineTo(6, 6),
    mctx.lineTo(-6, 6),
    mctx.closePath(),
    mctx.fill(),
    mctx.restore());
}
let last = performance.now(),
  respawnT = 0;
const perf = {
  fps: 60,
  fpsT: 0,
  frames: 0,
};
function autoQuality(e, r) {
  if ((perf.frames++, (perf.fpsT += null != r ? r : e), perf.fpsT >= 0.5)) {
    ((perf.fps = Math.round(perf.frames / perf.fpsT)),
      (perf.frames = 0),
      (perf.fpsT = 0));
    const e = $("fps");
    e &&
      !e.hidden &&
      ((e.textContent = perf.fps + " FPS"),
      (e.style.color =
        perf.fps >= 50 ? "#4ade80" : perf.fps >= 30 ? "#ffc849" : "#ff6b6b"));
  }
}
function setShadowRes(e) {
  try {
    sun &&
      sun.shadow &&
      sun.shadow.mapSize.width !== e &&
      (sun.shadow.mapSize.set(e, e),
      sun.shadow.map && (sun.shadow.map.dispose(), (sun.shadow.map = null)));
  } catch (e) {}
}
function applyGfx(e, t) {
  const o = GFX.detailGun,
    a = GFX.lamps;
  for (const t in GFX) void 0 !== e[t] && (GFX[t] = e[t]);
  try {
    (matchMedia("(pointer:coarse)").matches ||
      /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) &&
      (GFX.msaa = 0);
  } catch (e) {}
  if (
    (renderer.setPixelRatio(Math.min(devicePixelRatio || 1, GFX.pixel)),
    void 0 !== DYNRES && ((DYNRES.scale = 1), (DYNRES.cool = 2)),
    (renderer.shadowMap.enabled = GFX.shadow),
    setShadowRes(GFX.shadowRes),
    renderer.setSize(innerWidth, innerHeight),
    world.actors)
  )
    for (const e of world.actors)
      e.group &&
        e.group.traverse((e) => {
          e.isMesh &&
            (e.castShadow =
              GFX.shadow &&
              GFX.charShadow &&
              !(!e.userData || !e.userData.cast));
        });
  if (!GFX.shadow && sun.shadow.map) {
    sun.shadow.map.dispose(); sun.shadow.map = null;
  }
  if (!GFX.post && POST.ok) {
    for (const target of [POST.rt, POST.hA, POST.hB, POST.qA, POST.qB]) target.setSize(4, 4);
    POST.w = POST.h = 0;
  }
  if (
    (o !== GFX.detailGun && rebuildActorModels(),
    a !== GFX.lamps && "function" == typeof loadMap && CUR_MAP_KEY && !MAPS[CUR_MAP_KEY]?.graphicsStatic)
  )
    try {
      loadMap(CUR_MAP_KEY);
    } catch (e) {}
  if (window.ASCENT_TRIAL?.active) window.ASCENT_TRIAL.applyGraphics(SETTINGS.quality);
  (scene.traverse((e) => {
    e.material && (e.material.needsUpdate = !0);
  }),
    t || updateGfxLabel());
}
function rebuildActorModels() {
  if (world.actors && world.actors.length)
    for (const e of world.actors) {
      const t = !e.group || e.group.visible;
      if (e.group) {
        scene.remove(e.group);
        try {
          chDispose(e.group);
        } catch (e) {}
      }
      const o = buildFighter("atk" === e.team ? 16739146 : 3718648, e.agent);
      if (
        ((o.group.userData.actor = !0),
        scene.add(o.group),
        (e.model = o),
        (e.group = o.group),
        (e.group.visible = t),
        (e.spikeMark = null),
        e.hasSpike && "function" == typeof setCarrierMark)
      )
        try {
          setCarrierMark(e, !0);
        } catch (e) {}
      try {
        syncActorModel(e);
      } catch (e) {}
    }
}
function setQuality(e) {
  e = GRAPHICS_SETTINGS.normalize(e, SET_DEF.quality === 'mobile');
  ((SETTINGS.quality = e),
    saveSettings(),
    applyGfx(GFX_PRESETS[e], !1),
    updateGfxLabel());
  Object.assign(DYNRES, {scale:1,ema:1/60,cool:2,good:0});
}
function updateGfxLabel() {
  const e = $("st-q-now");
  if (e) e.textContent = window.ASCENT_TRIAL?.active ? window.ASCENT_TRIAL.graphicsMessage || "" : "";
}
const DYNRES = { scale: 1, ema: 1 / 60, cool: 2, good: 0 };
function dynRes(e) {
  if (!1 === SETTINGS.dynRes || navigator.webdriver) return;
  if (["menu", "over"].includes(world.phase) || document.hidden || shopOpen || !$("pause").hidden || !$("admin").hidden) return;
  if (GRAPHICS_SETTINGS.advanceResolution(DYNRES, e, GFX.minScale)) {
    const e = Math.min(
      devicePixelRatio || 1,
      (void 0 !== GFX && GFX.pixel) || 1,
    );
    renderer.setPixelRatio(e * DYNRES.scale);
  }
}
const TICK_STEP = 0.05,
  TICK_MAX_STEPS = 5;
function tick(e) {
  requestAnimationFrame(tick);
  const r = Math.max(0, (e - last) / 1e3);
  let t = Math.min(TICK_STEP, r);
  ((last = e), autoQuality(t, r));
  try {
    dynRes(r);
  } catch (e) {}
  const n =
      r > TICK_STEP
        ? Math.min(TICK_MAX_STEPS, Math.ceil(r / TICK_STEP - 1e-9))
        : 1,
    u = r > TICK_STEP ? Math.min(r, TICK_STEP * TICK_MAX_STEPS) / n : t;
  if ((1 !== TIMEFX.scale && (t *= TIMEFX.scale), FLY.on))
    ($("admin").hidden && flyStep(t), render());
  else if ("menu" !== world.phase && "over" !== world.phase) {
    if (
      !("solo" === NET.mode) ||
      ($("pause").hidden && !shopOpen && $("admin").hidden)
    ) {
      const s = 1 !== TIMEFX.scale ? u * TIMEFX.scale : u;
      for (
        let i = 0;
        i < n && "menu" !== world.phase && "over" !== world.phase;
        i++
      )
        step(s);
    }
    render();
  } else "over" === world.phase && render();
}
function step(e) {
  "buy" === world.phase
    ? ((world.roundTime -= e),
      world.roundTime <= 0 &&
        ((world.phase = "live"),
        (world.roundTime = 100),
        closeShop(),
        banner("교전 개시", "#4ade80")))
    : "live" === world.phase && (world.roundTime -= e);
  if (
    (!(world.actors && world.actors.length) &&
      (player.blind > 0 && (player.blind -= e),
      player.root > 0 && (player.root -= e),
      player.invuln > 0 && (player.invuln -= e),
      player.shielded > 0 && (player.shielded -= e),
      player.reloading > 0 &&
        ((player.reloading -= e), player.reloading <= 0 && finishReload()),
      player.fireCd > 0 && (player.fireCd -= e),
      (player.recoil = Math.max(0, player.recoil - 2.6 * e)),
      player.abilities.forEach((t) => {
        t.cd > 0 && ((t.cd -= e), t.cd < 0 && (t.cd = 0));
      })),
    ADMIN.infAbil &&
      player.abilities &&
      (player.abilities.forEach((e) => {
        ((e.cd = 0), (e.charges = e.def.charges || 1));
      }),
      (player.ultCharge = player.ultMax)),
    ADMIN.infAmmo && player.ammo)
  ) {
    const e = (player.weapons && player.weapons[player.slot]) || "pistol";
    (WEAPONS[e] &&
      ((player.ammo[e] = WEAPONS[e].mag), (player.reserve[e] = 999999)),
      (player.reloading = 0));
  }
  (ADMIN.noRecoil && ((player.recoil = 0), (player.recoilY = 0)),
    _hS(
      $("blind"),
      "opacity",
      player.blind > 0
        ? String(Math.round(50 * clamp(player.blind / 1.4, 0, 0.94)) / 50)
        : "0",
    ));
  const t = !(
    world.actors &&
    world.actors.length &&
    world.actors.indexOf(player) >= 0
  );
  try {
    updateStatusHud(localActor());
  } catch (e) {}
  (t &&
    (player.speedBuffT > 0 &&
      ((player.speedBuffT -= e),
      player.speedBuffT <= 0 && (player.speedBuff = 1)),
    player.ultSnipeT > 0 &&
      ((player.ultSnipeT -= e), player.ultSnipeT <= 0 && (player.ultSnipe = 0)),
    player.slowT > 0
      ? ((player.slowT -= e), player.slowT <= 0 && (player.slow = 1))
      : 1 !== player.slow && (player.slow = 1)),
    player.alive ||
      ((respawnT += e),
      player.spectateT > 0
        ? ((player.spectateT -= e),
          deathCam(e),
          player.spectateT <= 0 && nextSpectate(1))
        : ((player.spectate && player.spectate.alive) || nextSpectate(1),
          spectateCam(e)),
      checkRoundEnd()));
  const o = !(world.actors && world.actors.length);
  o && player.alive && movePlayer(e);
  const a = curWeapon();
  (o &&
    (keys.fire &&
      player.alive &&
      (a.burst
        ? keys._fired || ((keys._fired = !0), (player.burstLeft = a.burst))
        : a.auto
          ? fire()
          : keys._fired || (fire(), (keys._fired = !0))),
    keys.fire || (keys._fired = !1),
    player.burstLeft > 0 && player.fireCd <= 0 && (fire(), player.burstLeft--)),
    (viewFOV.target = player.ads
      ? SCOPE_FOV[curWeaponKey()] || 58
      : viewFOV.base),
    (viewFOV.now += (viewFOV.target - viewFOV.now) * Math.min(1, 13 * e)),
    (camera.fov = viewFOV.now),
    camera.updateProjectionMatrix(),
    world.actors && world.actors.length
      ? netStep(e)
      : world.entities.forEach((t) => {
          (t.alive && updateBot(t, e),
            t.group.position.set(t.pos.x, t.y, t.pos.z),
            (t.group.rotation.y = t.yaw));
          const o = t.team !== player.team && t.revealed > 0;
          (t.model.visor.material.color.setHex(
            o ? 16726862 : "atk" === t.team ? 16739146 : 3718648,
          ),
            t.group.children.forEach((e) => {
              e.material && (e.material.depthTest = !o);
            }),
            t.spikeMark &&
              (t.spikeMark.visible =
                t.hasSpike && t.alive && (t.team === player.team || o)));
        }),
    handleSpike(e),
    "live" === world.phase && checkRoundEnd(),
    updateZones(e),
    updateProps(e),
    (world._clock = (world._clock || 0) + e),
    abilTick(e),
    updateFx(e),
    bannerT > 0 &&
      ((bannerT -= e), bannerT <= 0 && $("banner").classList.remove("show")),
    flashLight && (flashLight.intensity *= 0.82));
  for (const e of MZ_LIGHTS) e.intensity > 0.01 && (e.intensity *= 0.74);
  (tickViewmodel(e),
    tickKillFx(e),
    tickDmgNums(e),
    tickEdge(e),
    tickUltCut(e),
    tickTimeFx(e),
    updateLockHint(),
    updateHUD(),
    updateCross(),
    (_mapF = (_mapF + 1) % 6),
    1 & _mapF || drawTac(),
    _mapF % 3 == 0 && drawMini());
}
let _mapF = 0;
const DMGN = { pool: [], live: [], v: new T.Vector3() };
function dmgNumber(e, t, o) {
  if (!1 === SETTINGS.dmgNums || !(t > 0)) return;
  const a = $("dmgnums");
  if (!a) return;
  const n = world._clock || 0;
  let r = null;
  for (const t of DMGN.live)
    if (t.e === e && n - t.t0 < 0.35) {
      r = t;
      break;
    }
  if (r)
    ((r.val += t), (r.head = r.head || o), (r.age = Math.min(r.age, 0.05)));
  else {
    let s = DMGN.pool.pop();
    (s ||
      ((s = document.createElement("div")),
      (s.className = "dn"),
      a.appendChild(s)),
      (s.style.display = "block"),
      (r = {
        e: e,
        el: s,
        val: t,
        head: !!o,
        age: 0,
        t0: n,
        ox: 0.5 * (Math.random() - 0.5),
      }),
      DMGN.live.push(r));
  }
  ((r.el.textContent = Math.round(r.val)),
    r.el.classList.toggle("head", !!r.head));
}
function tickDmgNums(e) {
  for (let t = DMGN.live.length - 1; t >= 0; t--) {
    const o = DMGN.live[t];
    if (((o.age += e), o.age > 0.95 || !o.e || !o.e.pos)) {
      ((o.el.style.display = "none"),
        DMGN.pool.push(o.el),
        DMGN.live.splice(t, 1));
      continue;
    }
    const a = DMGN.v
      .set(o.e.pos.x + o.ox, (o.e.y || 0) + 2.1 + 0.7 * o.age, o.e.pos.z)
      .project(camera);
    if (a.z > 1) {
      o.el.style.opacity = "0";
      continue;
    }
    const n = (0.5 * a.x + 0.5) * innerWidth,
      r = (0.5 * -a.y + 0.5) * innerHeight,
      s = o.age < 0.12 ? 1.4 - 3.3 * o.age : 1;
    ((o.el.style.transform = `translate(${0 | n}px,${0 | r}px) translate(-50%,-50%) scale(${s.toFixed(2)})`),
      (o.el.style.opacity =
        o.age < 0.6 ? "1" : (1 - (o.age - 0.6) / 0.35).toFixed(2)));
  }
}
function movePlayer(e) {
  player.crouch;
  player.crouch = !!(keys.control || keys.shift);
  let o = 0,
    a = 0;
  (keys.w && (a -= 1),
    keys.s && (a += 1),
    keys.a && (o -= 1),
    keys.d && (o += 1),
    touch.on && ((o += touch.move.x), (a += touch.move.y)));
  let n = ADMIN.run;
  (player.crouch && (n = ADMIN.crouch),
    player.ads && (n *= ADMIN.adsMul),
    (n *= player.slow * (player.speedBuff || 1)),
    player.root > 0 && (n = 0));
  const r = Math.hypot(o, a);
  if (r > 0 && player.root <= 0) {
    ((o /= r), (a /= r));
    const e = -Math.sin(player.yaw),
      t = -Math.cos(player.yaw),
      s = Math.cos(player.yaw),
      i = -Math.sin(player.yaw),
      l = -a,
      c = o;
    ((player.vel.x = (e * l + s * c) * n),
      (player.vel.z = (t * l + i * c) * n));
  } else ((player.vel.x *= 0.76), (player.vel.z *= 0.76));
  const s = moveWithSlide(
    player.pos,
    player.vel.x * e,
    player.vel.z * e,
    player.y,
    PR,
  );
  (player.onGround && s > player.y && ((player.y = s), (player.vy = 0)),
    (player.vy -= ADMIN.gravity * e),
    (player.y += player.vy * e));
  const i = groundAt(player.pos.x, player.pos.z, player.y);
  player.y <= i
    ? ((player.y = i), (player.vy = 0), (player.onGround = !0))
    : (player.onGround = !1);
  const l = Math.hypot(player.vel.x, player.vel.z);
  player.bob += e * l * 1.5;
  const c = player.onGround
      ? 0.035 * Math.sin(player.bob) * Math.min(l / 7, 1)
      : 0,
    d = player.onGround
      ? 0.025 * Math.cos(0.5 * player.bob) * Math.min(l / 7, 1)
      : 0;
  let h = 0,
    p = 0;
  (shake > 0 &&
    ((h = 0.09 * rnd(-shake, shake)),
    (p = 0.09 * rnd(-shake, shake)),
    (shake = Math.max(0, shake - 2.2 * e))),
    camera.position.set(
      player.pos.x + d + h,
      player.y + eyeHeight() + c + p,
      player.pos.z,
    ),
    (camera.rotation.order = "YXZ"),
    (camera.rotation.y = player.yaw),
    (camera.rotation.x = player.pitch - 0.05 * player.recoil),
    (camera.rotation.z = 0.4 * d));
}
function deathCam(e) {
  player.deathCamYaw += 0.55 * e;
  (camera.position.set(
    player.pos.x + 5.5 * Math.sin(player.deathCamYaw),
    player.y + 3.2,
    player.pos.z + 5.5 * Math.cos(player.deathCamYaw),
  ),
    camera.lookAt(player.pos.x, player.y + 0.8, player.pos.z));
}
function spectateCam(e) {
  const t = player.spectate;
  if (!t) {
    const e = "planted" === world.spike.state ? world.spike : MAP.sites[1];
    return (
      camera.position.set(e.x, 34, e.z + 24),
      void camera.lookAt(e.x, 0, e.z)
    );
  }
  const o = t.pos.x + 4.4 * Math.sin(t.yaw),
    a = t.pos.z + 4.4 * Math.cos(t.yaw),
    n = new T.Vector3(o, t.y + 2.5, a);
  (camera.position.lerp(n, Math.min(1, 4.5 * e)),
    camera.lookAt(t.pos.x, t.y + 1.5, t.pos.z));
}
function updateZones(e) {
  for (let t = world.zones.length - 1; t >= 0; t--) {
    const o = world.zones[t];
    if (((o.life -= e), animateZone(o, e), o.life <= 0)) {
      try {
        endBurst(
          o.x,
          o.z,
          (o._ring && o._ring.material.color.getHex()) || 16777215,
          o.r,
        );
      } catch (e) {}
      (scene.remove(o.mesh),
        o.mesh.traverse((e) => {
          e.geometry && e.geometry.dispose();
        }),
        world.zones.splice(t, 1));
      continue;
    }
    const a = o.team || "atk",
      n = (e) => abilityOnFloor(e, o.y || 0, Math.max(1.5, o.h || 0)) &&
        dist2(e.pos ? e.pos.x : e.x, e.pos ? e.pos.z : e.z, o.x, o.z) <
        o.r * o.r,
      r = abilityOnFloor(player, o.y || 0, Math.max(1.5, o.h || 0)) && dist2(player.pos.x, player.pos.z, o.x, o.z) < o.r * o.r,
      s = player.team !== a;
    (o.dps &&
      (r && s && damagePlayer(o.dps * e),
      otherFighters().forEach((t) => {
        t.alive &&
          t.team !== a &&
          n(t) &&
          hurtFighter(t, o.dps * e, !1, player);
      })),
      o.heal &&
        (r && !s && (player.hp = Math.min(100, player.hp + o.heal * e)),
        otherFighters().forEach((t) => {
          t.alive &&
            t.team === a &&
            n(t) &&
            (t.hp = Math.min(100, (t.hp || 0) + o.heal * e));
        })),
      o.freeze &&
        (r && s && (player.root = Math.max(player.root || 0, 0.3)),
        otherFighters().forEach((e) => {
          e.alive &&
            e.team !== a &&
            n(e) &&
            (e.root = Math.max(e.root || 0, 0.3));
        })),
      o.slow &&
        (r &&
          s &&
          ((player.slow = Math.min(player.slow || 1, o.slow)),
          (player.slowT = Math.max(player.slowT || 0, 0.35))),
        otherFighters().forEach((e) => {
          e.alive &&
            e.team !== a &&
            n(e) &&
            ((e.slow = Math.min(e.slow || 1, o.slow)),
            (e.slowT = Math.max(e.slowT || 0, 0.35)));
        })),
      o.silence &&
        (r && s && (player.silenced = Math.max(player.silenced || 0, 0.4)),
        otherFighters().forEach((e) => {
          e.alive &&
            e.team !== a &&
            n(e) &&
            ((e.silenced = Math.max(e.silenced || 0, 0.4)),
            e.ai &&
              e.ai.skill &&
              (e.ai.skill.cd = Math.max(e.ai.skill.cd || 0, 0.6)));
        })));
  }
  for (let t = world.smokes.length - 1; t >= 0; t--) {
    const o = world.smokes[t];
    o.life -= e;
    const a = clamp(o.life / 1.5, 0, 1),
      n = clamp((o.maxLife - o.life) / 0.6, 0, 1);
    ((o._t = (o._t || 0) + e),
      o.mesh.children.forEach((t, r) => {
        const s = 1.7 * r,
          i = 0.82 + 0.07 * Math.sin(0.9 * o._t + s);
        (t.isSprite
          ? ((r !== o.mesh.children.length - 1 && t.material.userData._f) ||
              (t.material.opacity = 0.6 * a),
            (t.material.rotation += 0.05 * e),
            t.scale.setScalar((t.userData.base || 1) * n * i))
          : ((t.material.opacity = 0.4 * a),
            (t.rotation.y += 0.25 * e),
            t.scale.setScalar(n * i)),
          (t.position.y += Math.sin(0.7 * o._t + s) * e * 0.12));
      }),
      o.slowZone &&
        (dist2(player.pos.x, player.pos.z, o.x, o.z) < o.r * o.r &&
          ((player.slow = Math.min(player.slow || 1, 0.75)),
          (player.slowT = Math.max(player.slowT || 0, 0.3))),
        otherFighters().forEach((e) => {
          e.alive &&
            dist2(e.pos.x, e.pos.z, o.x, o.z) < o.r * o.r &&
            ((e.slow = 0.75), (e.slowT = 0.3));
        })),
      o.life <= 0 && (scene.remove(o.mesh), world.smokes.splice(t, 1)));
  }
}
function updateProps(e) {
  for (let t = world.props.length - 1; t >= 0; t--) {
    const o = world.props[t];
    if (((o.life -= e), "proj" === o.type)) {
      ((o.vel.y -= 17 * e),
        (o.mesh.rotation.x += 8 * e),
        (o.mesh.rotation.y += 5 * e));
      const a = o.mesh.position,
        n = Math.max(1, Math.ceil((o.vel.length() * e) / 0.3));
      let r = !1;
      for (let t = 0; t < n && !r; t++) {
        if ((a.addScaledVector(o.vel, e / n), a.y <= 0.2)) {
          r = !0;
          break;
        }
        if (collideXZ(a.x, a.z, a.y, 0.05)) {
          r = !0;
          break;
        }
      }
      if (((o.trailT -= e), o.trailT <= 0 && void 0 !== o.color)) {
        o.trailT = 0.025;
        const e = glowDot(o.color, 0.32, 1.8);
        (e.position.copy(a),
          addFx(e, 0.35, (e, t) => {
            ((e.material.opacity = 0.8 * (1 - t)),
              e.scale.setScalar(0.32 * (1 - 0.6 * t)));
          }));
      }
      if (r || o.life <= 0) {
        o.onHit(a.x, Math.max(0, a.y), a.z);
        try {
          glowFlare(
            a.x,
            Math.max(0.3, a.y),
            a.z,
            void 0 !== o.color ? o.color : 16777215,
            2.2,
            0.25,
          );
        } catch (e) {}
        (scene.remove(o.mesh),
          o.mesh.traverse((e) => {
            ((e.material && !e.isSprite) || e.isSprite) && e.material.dispose();
          }),
          world.props.splice(t, 1));
        continue;
      }
    } else if ("trap" === o.type) {
      if (
        ((o.mesh.rotation.y += 1.4 * e),
        (o.mesh.position.y = (o.y || 0) + 0.25 + 0.06 * Math.sin(3 * o.life)),
        o.ring)
      ) {
        const e = 0.78 + 0.22 * Math.sin(4.2 * o.life);
        ((o.ring.material.opacity = o.armed ? 0.2 + 0.22 * e : 0.08),
          o.ring.scale.setScalar(o.armed ? 0.97 + 0.05 * e : 0.9));
      }
      if (o.armed) {
        const e = o.team || "atk",
          a =
            world.actors && world.actors.length ? world.actors : world.entities;
        for (const n of a)
          if (
            n.alive &&
            n.team &&
            n.team !== e &&
            abilityOnFloor(n, o.y || 0) &&
            dist2(n.pos.x, n.pos.z, o.x, o.z) < o.r * o.r
          ) {
            (o.onTrigger(n),
              o.persistent
                ? ((o.armed = !1), setTimeout(() => (o.armed = !0), 2500))
                : (scene.remove(o.mesh),
                  scene.remove(o.ring),
                  world.props.splice(t, 1)));
            break;
          }
      }
      if (o.life <= 0) {
        (scene.remove(o.mesh), scene.remove(o.ring), world.props.splice(t, 1));
        continue;
      }
    } else if ("drone" === o.type) {
      let a = null,
        n = 1e9;
      if (
        (world.entities.forEach((e) => {
          if (!e.alive || e.team === player.team) return;
          const t = dist2(
            o.mesh.position.x,
            o.mesh.position.z,
            e.pos.x,
            e.pos.z,
          );
          t < n && ((n = t), (a = e));
        }),
        a)
      ) {
        const t = new T.Vector3(a.pos.x, 4.5, a.pos.z);
        (o.mesh.position.lerp(t, 0.55 * e), n < 400 && (a.revealed = 1.5));
      }
      if (((o.mesh.rotation.y += 2.4 * e), o.life <= 0)) {
        (scene.remove(o.mesh), world.props.splice(t, 1));
        continue;
      }
    }
  }
}
function updateFx(e) {
  tickFxLights(e);
  for (let t = fx.length - 1; t >= 0; t--) {
    const o = fx[t];
    o.mesh.userData.t += e;
    const a = o.mesh.userData.t / o.life;
    a >= 1
      ? (scene.remove(o.mesh),
        o.mesh.traverse((e) => {
          !e.geometry ||
            e.isSprite ||
            (e.geometry.userData && e.geometry.userData.shared) ||
            e.geometry.dispose();
          const t = e.material;
          !t ||
            (t.userData && t.userData.keep) ||
            (Array.isArray(t) ? t.forEach((e) => e.dispose()) : t.dispose());
        }),
        fx.splice(t, 1))
      : o.fn(o.mesh, a, e);
  }
}
const POST = {
    on: !0,
    ok: null,
    w: 0,
    h: 0,
    bloom: 0.45,
    threshold: 1.15,
    knee: 0.5,
    sat: 1.1,
    contrast: 1.06,
    vignette: 0.32,
    tint: [1, 1, 1],
    lift: [0, 0, 0],
  },
  _pq = {};
function postInit() {
  if (null !== POST.ok) return POST.ok;
  try {
    const e = renderer.capabilities.isWebGL2,
      t = T.HalfFloatType,
      o = (e) =>
        new T.WebGLRenderTarget(4, 4, {
          type: t,
          samples: e || 0,
          minFilter: T.LinearFilter,
          magFilter: T.LinearFilter,
          depthBuffer: !!e || void 0 === e,
        });
    ((POST.rt = new T.WebGLRenderTarget(4, 4, {
      type: t,
      samples: e ? 4 : 0,
      depthBuffer: !0,
      minFilter: T.LinearFilter,
      magFilter: T.LinearFilter,
    })),
      (POST.hA = o(0)),
      (POST.hB = o(0)),
      (POST.qA = o(0)),
      (POST.qB = o(0)),
      [POST.hA, POST.hB, POST.qA, POST.qB].forEach((e) => {
        e.depthBuffer = !1;
      }),
      (_pq.cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1)),
      (_pq.geo = new T.PlaneGeometry(2, 2)));
    const a =
      "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
    ((_pq.bright = new T.ShaderMaterial({
      uniforms: {
        tSrc: { value: null },
        uTh: { value: 1 },
        uKnee: { value: 0.45 },
      },
      vertexShader: a,
      fragmentShader:
        "uniform sampler2D tSrc; uniform float uTh, uKnee; varying vec2 vUv;\n        void main(){\n          vec3 c = texture2D(tSrc, vUv).rgb;\n          float br = max(c.r, max(c.g, c.b));\n          float soft = clamp(br - uTh + uKnee, 0.0, 2.0*uKnee);\n          soft = soft*soft / (4.0*uKnee + 1e-4);\n          float w = max(soft, br - uTh) / max(br, 1e-4);\n          gl_FragColor = vec4(min(c * w, vec3(24.0)), 1.0);\n        }",
      depthTest: !1,
      depthWrite: !1,
      toneMapped: !1,
    })),
      (_pq.blur = new T.ShaderMaterial({
        uniforms: {
          tSrc: { value: null },
          uDir: { value: new T.Vector2(1, 0) },
        },
        vertexShader: a,
        fragmentShader:
          "uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;\n        void main(){\n          // 9탭 가우시안 (선형 보간을 이용해 5회 샘플)\n          vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;\n          vec2 o1 = uDir * 1.3846153846, o2 = uDir * 3.2307692308;\n          c += texture2D(tSrc, vUv + o1).rgb * 0.3162162162;\n          c += texture2D(tSrc, vUv - o1).rgb * 0.3162162162;\n          c += texture2D(tSrc, vUv + o2).rgb * 0.0702702703;\n          c += texture2D(tSrc, vUv - o2).rgb * 0.0702702703;\n          gl_FragColor = vec4(c, 1.0);\n        }",
        depthTest: !1,
        depthWrite: !1,
        toneMapped: !1,
      })),
      // Fuse the quarter-size copy with its horizontal blur. Reconstruct the
      // copied texels before filtering (including the old RGBA16F rounding).
      (_pq.downBlur = new T.ShaderMaterial({
        uniforms: { tSrc: { value: null }, uSize: { value: new T.Vector2() } },
        vertexShader: a,
        fragmentShader: `
          uniform sampler2D tSrc; uniform vec2 uSize; varying vec2 vUv;
          vec3 halfStore(vec3 c) {
            vec3 stepSize = exp2(max(floor(log2(max(c, vec3(1e-20)))) - 10.0, vec3(-24.0)));
            vec3 n = c / stepSize, lo = floor(n), f = n - lo;
            return (lo + step(vec3(0.5), f) * (vec3(1.0) - step(f, vec3(0.5)) * (vec3(1.0) - mod(lo, 2.0)))) * stepSize;
          }
          vec3 copied(vec2 pixel) {
            pixel = clamp(pixel, vec2(0.0), uSize - 1.0);
            return halfStore(texture2D(tSrc, (pixel + 0.5) / uSize).rgb);
          }
          vec3 sampleCopy(float offset) {
            vec2 p = vUv * uSize - 0.5 + vec2(offset, 0.0);
            vec2 base = vec2(floor(p.x), floor(vUv.y * uSize.y));
            return mix(copied(base), copied(base + vec2(1.0, 0.0)), fract(p.x));
          }
          void main() {
            vec3 c = sampleCopy(0.0) * 0.2270270270;
            c += sampleCopy(1.6 * 1.3846153846) * 0.3162162162;
            c += sampleCopy(-1.6 * 1.3846153846) * 0.3162162162;
            c += sampleCopy(1.6 * 3.2307692308) * 0.0702702703;
            c += sampleCopy(-1.6 * 3.2307692308) * 0.0702702703;
            gl_FragColor = vec4(c, 1.0);
          }`,
        depthTest: !1, depthWrite: !1, toneMapped: !1,
      })),
      (_pq.copy = new T.ShaderMaterial({
        uniforms: { tSrc: { value: null } },
        vertexShader: a,
        fragmentShader:
          "uniform sampler2D tSrc; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb, 1.0); }",
        depthTest: !1,
        depthWrite: !1,
        toneMapped: !1,
      })),
      (_pq.comp = new T.ShaderMaterial({
        uniforms: {
          tScene: { value: null },
          tB1: { value: null },
          tB2: { value: null },
          uBloom: { value: 0.6 },
          uSat: { value: 1.1 },
          uCon: { value: 1.06 },
          uVig: { value: 0.3 },
          uTint: { value: new T.Vector3(1, 1, 1) },
          uLift: { value: new T.Vector3(0, 0, 0) },
          uAspect: { value: 1.7 },
          uTime: { value: 0 },
        },
        vertexShader: a,
        fragmentShader:
          "uniform sampler2D tScene, tB1, tB2; uniform float uBloom, uSat, uCon, uVig, uAspect, uTime;\n        uniform vec3 uTint, uLift; varying vec2 vUv;\n        void main(){\n          vec3 c = texture2D(tScene, vUv).rgb;\n          vec3 b = texture2D(tB1, vUv).rgb * 0.55 + texture2D(tB2, vUv).rgb * 0.75;\n          c += b * uBloom;\n          c *= uTint;\n          c += uLift * (1.0 - clamp(dot(c, vec3(.333)), 0.0, 1.0));\n          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));\n          c = max(mix(vec3(l), c, uSat), 0.0);\n          c = pow(c / 0.18, vec3(uCon)) * 0.18;          // 중간 회색 기준 대비\n          gl_FragColor = vec4(c, 1.0);\n          #include <tonemapping_fragment>\n          vec2 q = vUv - 0.5; q.x *= uAspect * 0.62;\n          float v = smoothstep(0.95, 0.25, length(q));\n          gl_FragColor.rgb *= mix(1.0 - uVig, 1.0, v);\n          // 미세 필름 그레인 — 계조 띠를 없앤다\n          float n = fract(sin(dot(vUv * (uTime + 1.7), vec2(12.9898, 78.233))) * 43758.5453);\n          gl_FragColor.rgb += (n - 0.5) / 255.0;\n          #include <colorspace_fragment>\n        }",
        depthTest: !1,
        depthWrite: !1,
        toneMapped: !0,
      })),
      (_pq.mesh = new T.Mesh(_pq.geo, _pq.copy)),
      (_pq.mesh.frustumCulled = !1),
      (_pq.scene = new T.Scene()),
      _pq.scene.add(_pq.mesh),
      (POST.ok = !0));
  } catch (e) {
    (console.warn("후처리 비활성:", e), (POST.ok = !1));
  }
  return POST.ok;
}
function postSize() {
  const e = new T.Vector2();
  renderer.getDrawingBufferSize(e);
  const t = Math.max(4, 0 | e.x),
    o = Math.max(4, 0 | e.y),
    a = renderer.capabilities.isWebGL2
      ? void 0 !== GFX && null != GFX.msaa
        ? GFX.msaa
        : 2
      : 0;
  if (
    (POST.rt.samples !== a &&
      (POST.rt.dispose(),
      (POST.rt = new T.WebGLRenderTarget(4, 4, {
        type: T.HalfFloatType,
        samples: a,
        depthBuffer: !0,
        minFilter: T.LinearFilter,
        magFilter: T.LinearFilter,
      })),
      (POST.w = 0)),
    t === POST.w && o === POST.h)
  )
    return;
  ((POST.w = t), (POST.h = o), POST.rt.setSize(t, o));
  const n = Math.max(2, t >> 1),
    r = Math.max(2, o >> 1),
    s = Math.max(2, t >> 2),
    i = Math.max(2, o >> 2);
  (POST.hA.setSize(n, r),
    POST.hB.setSize(n, r),
    POST.qA.setSize(s, i),
    POST.qB.setSize(s, i),
    (POST._hs = [1 / n, 1 / r]),
    (POST._qs = [1 / s, 1 / i]));
}
function _pass(e, t) {
  ((_pq.mesh.material = e),
    renderer.setRenderTarget(t),
    renderer.render(_pq.scene, _pq.cam));
}
let _postT = 0;
function postRender() {
  postSize();
  const e = renderer.autoClear;
  (renderer.setRenderTarget(POST.rt),
    renderer.render(scene, camera),
    (renderer.autoClear = !0),
    (_pq.bright.uniforms.tSrc.value = POST.rt.texture),
    (_pq.bright.uniforms.uTh.value = POST.threshold),
    (_pq.bright.uniforms.uKnee.value = POST.knee),
    _pass(_pq.bright, POST.hA));
  const t = _pq.blur.uniforms;
  ((t.tSrc.value = POST.hA.texture),
    t.uDir.value.set(POST._hs[0], 0),
    _pass(_pq.blur, POST.hB),
    (t.tSrc.value = POST.hB.texture),
    t.uDir.value.set(0, POST._hs[1]),
    _pass(_pq.blur, POST.hA),
    (_pq.downBlur.uniforms.tSrc.value = POST.hA.texture),
    _pq.downBlur.uniforms.uSize.value.set(POST.qA.width, POST.qA.height),
    _pass(_pq.downBlur, POST.qB),
    (t.tSrc.value = POST.qB.texture),
    t.uDir.value.set(0, 1.6 * POST._qs[1]),
    _pass(_pq.blur, POST.qA));
  const o = _pq.comp.uniforms;
  ((o.tScene.value = POST.rt.texture),
    (o.tB1.value = POST.hA.texture),
    (o.tB2.value = POST.qA.texture),
    (o.uBloom.value =
      POST.bloom * (void 0 !== GFX && null != GFX.bloom ? GFX.bloom : 1)),
    (o.uSat.value = POST.sat),
    (o.uCon.value = POST.contrast),
    (o.uVig.value = POST.vignette),
    o.uTint.value.set(POST.tint[0], POST.tint[1], POST.tint[2]),
    o.uLift.value.set(POST.lift[0], POST.lift[1], POST.lift[2]),
    (o.uAspect.value = POST.w / POST.h),
    (_postT = (_postT + 0.61) % 97),
    (o.uTime.value = _postT),
    _pass(_pq.comp, null),
    (renderer.autoClear = e));
}
function postActive() {
  return !!POST.on && (void 0 === GFX || !1 !== GFX.post) && postInit();
}
// Keep the existing shadow texture until a shadow-producing input changes.
let _shadowInputs = new Map();
function shadowInputsChanged() {
  scene.updateMatrixWorld();
  const next = new Map();
  let changed = false;
  scene.traverseVisible((object) => {
    if (!object.castShadow) return;
    const values = [...object.matrixWorld.elements, object.layers.mask, camera.layers.mask, renderer.shadowMap.type];
    if (object.isLight && object.shadow) {
      const sh = object.shadow;
      object.target?.updateWorldMatrix(true, false);
      values.push(...(object.target?.matrixWorld.elements || []),
        ...sh.camera.projectionMatrix.elements, sh.mapSize.x, sh.mapSize.y,
        sh.bias, sh.normalBias, sh.radius, object.distance, object.angle,
        !!sh.map);
    } else {
      const geometry = object.geometry;
      values.push(geometry?.id, geometry?.index?.version,
        ...Object.values(geometry?.attributes || {}).map(a => a.version),
        object.instanceMatrix?.version, ...(object.morphTargetInfluences || []));
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const m of materials) if (m) values.push(m.id, m.version, m.visible, m.side,
        m.alphaTest, m.opacity, m.map?.version, m.alphaMap?.version, m.displacementMap?.version,
        m.displacementScale, m.displacementBias);
      // Bones and custom vertex shaders may deform without changing matrixWorld.
      if (object.isSkinnedMesh || object.customDepthMaterial || object.customDistanceMaterial ||
          materials.some(m => m?.isShaderMaterial || m?.displacementMap)) changed = true;
    }
    const previous = _shadowInputs.get(object);
    if (!previous || previous.length !== values.length || values.some((v, i) => v !== previous[i])) changed = true;
    next.set(object, values);
  });
  if (next.size !== _shadowInputs.size) changed = true;
  _shadowInputs = next;
  return changed;
}
function render() {
  renderer.shadowMap.autoUpdate = !1;
  if (renderer.shadowMap.enabled) {
    followSun();
    if (shadowInputsChanged()) renderer.shadowMap.needsUpdate = !0;
  } else _shadowInputs.clear();
  if (postActive())
    try {
      return void postRender();
    } catch (e) {
      (console.warn("후처리 오류 — 끔", e),
        (POST.ok = !1),
        renderer.setRenderTarget(null));
    }
  renderer.render(scene, camera);
}
const SCREENS = ["s-title", "s-select", "s-over"];
function show(e) {
  if (e) {
    closeShop();
    if (document.pointerLockElement) document.exitPointerLock();
    $("pause").hidden = true;
    $("admin").hidden = true;
    $("lobby").hidden = true;
    if (window.GUN_SKINS && GUN_SKINS.isOpen()) GUN_SKINS.close();
    if (window.TOUCHLAY && TOUCHLAY.editing()) TOUCHLAY.close(false);
  }
  (SCREENS.forEach((t) => ($(t).hidden = t !== e)), ($("hud").hidden = !!e));
}
function hideAll() {
  (SCREENS.forEach((e) => ($(e).hidden = !0)), ($("hud").hidden = !1));
}
let picked = AGENTS[0];
const AB_ICON_PATH = {
    cloud: "M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 9.3 4.4 4.4 0 0 0 7 18z",
    wall: "M3 6h18v12H3zM3 12h18M9 6v6M15 12v6",
    shield: "M12 3l7 3v6c0 4.4-3 7.4-7 9-4-1.6-7-4.6-7-9V6z",
    burst:
      "M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5L19 19M19 5l-3.5 3.5M8.5 15.5L5 19",
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
    cross: "M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z",
    heart:
      "M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z",
    move: "M4 6l6 6-6 6M12 6l6 6-6 6",
    trap: "M12 3l9.5 17h-19zM12 10v4.5M12 17.2v.3",
    radar:
      "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zM12 12l6.5-6.5",
    orb: "M12 16.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zM2.5 12c0-2.2 4.3-4 9.5-4s9.5 1.8 9.5 4-4.3 4-9.5 4-9.5-1.8-9.5-4z",
    bolt: "M13 2L4.5 13.5h6.5L10 22l9-12h-6.5z",
    flame:
      "M12 22c4 0 7-2.9 7-6.9 0-4-3-6.2-4.2-9.1-.9 2.7-2.7 3.9-3.8 2-1.3 2.9-6 4.3-6 7.1 0 4 3 6.9 7 6.9z",
    snow: "M12 2v20M3.3 7l17.4 10M20.7 7L3.3 17M9 3.5l3 2 3-2M9 20.5l3-2 3 2",
    impact:
      "M12 2l2.4 6.3L21 9l-5 4.4L17.5 21 12 17.2 6.5 21 8 13.4 3 9l6.6-.7z",
    diamond: "M12 2l8 10-8 10-8-10zM4 12h16",
    hourglass:
      "M6 3h12M6 21h12M7 3c0 5.5 10 5.5 10 9s-10 3.5-10 9M17 3c0 5.5-10 5.5-10 9s10 3.5 10 9",
    bell: "M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 20.5a2 2 0 0 0 4 0",
    magnet:
      "M5 3.5v8.5a7 7 0 0 0 14 0V3.5h-4.5V12a2.5 2.5 0 0 1-5 0V3.5zM5 8h4.5M14.5 8H19",
    crown: "M3 18l1.8-11 5.2 5 2-7 2 7 5.2-5L21 18zM3 21h18",
  },
  AB_ICON_OF = {
    smoke: "cloud",
    smoke_fire: "cloud",
    smoke_ice: "cloud",
    sand_smoke: "cloud",
    wall_fire: "wall",
    wall_ice: "wall",
    sand_wall: "wall",
    shield: "shield",
    ripple_dome: "shield",
    flash: "burst",
    blood_eye: "eye",
    heal: "cross",
    ult_res: "cross",
    ult_undying: "heart",
    blood_drain: "heart",
    dash: "move",
    blink: "move",
    bolt_jump: "move",
    charge: "move",
    mag_anchor: "move",
    trap: "trap",
    trap_slow: "trap",
    mine: "trap",
    tripwire: "trap",
    hive_trap: "trap",
    mag_turret: "trap",
    root: "trap",
    sensor: "radar",
    sound_sensor: "radar",
    recon_dart: "radar",
    drone: "radar",
    mirror_pulse: "radar",
    scout_swarm: "radar",
    mag_net: "magnet",
    quicksand: "hourglass",
    ult_recon: "eye",
    ult_snipe: "eye",
    decoy: "diamond",
    nade: "orb",
    proj: "orb",
    static_orb: "orb",
    blood_orb: "orb",
    proj_fire: "flame",
    pierce: "bolt",
    hunt_bee: "bolt",
    rift_wave: "bolt",
    emp: "bolt",
    ult_fire: "flame",
    ult_ice: "snow",
    ult_smash: "impact",
    ult_emp: "bolt",
    ult_lightning: "bolt",
    ult_mirror: "diamond",
    ult_tomb: "hourglass",
    ult_bell: "bell",
    ult_polarity: "magnet",
    ult_queen: "crown",
  };
function abIcon(e, t) {
  const o = AB_ICON_OF[e] || (String(e).startsWith("ult") ? "impact" : "orb");
  return `<svg class="${t || "ab-ic"}" viewBox="0 0 24 24" aria-hidden="true"><path d="${AB_ICON_PATH[o]}"/></svg>`;
}
function renderTitleRoster() {
  if (document.documentElement.dataset.gameLoading) return;
  const e = document.getElementById("title-roster");
  e &&
    !e.childElementCount &&
    AGENTS.forEach((t, o) => {
      const a = document.createElement("div");
      ((a.className = "tr-chip"),
        a.style.setProperty("--ac", t.color),
        (a.style.animationDelay = 45 * o + "ms"),
        (a.title = t.name + " · " + t.role),
        (a.innerHTML = `<img alt=""><span>${t.name}</span>`),
        GAME_PORTRAITS.set(a.querySelector("img"), t, 80, 100),
        e.appendChild(a));
    });
}
function renderSelect() {
  if (document.documentElement.dataset.gameLoading) return;
  const e = $("sel-grid");
  GAME_PORTRAITS.clear(e);
  ((e.innerHTML = ""),
    AGENTS.forEach((t) => {
      const o = document.createElement("button");
      ((o.className = "acard"),
        o.style.setProperty("--ac", t.color),
        o.setAttribute("aria-pressed", t === picked),
        (o.innerHTML = `<img class="acard-img" alt="">\n      <div class="acard-body">\n        <div class="acard-role">${t.role}</div>\n        <div class="acard-name">${t.name}</div>\n        <div class="acard-q">${t.quote}</div>\n      </div>`),
        GAME_PORTRAITS.set(o.querySelector("img"), t, 300, 380),
        (o.onclick = () => {
          ((picked = t), renderSelect());
        }),
        e.appendChild(o));
    }));
  const t = $("sel-detail");
  GAME_PORTRAITS.clear(t);
  (t.style.setProperty("--ac", picked.color),
    (t.innerHTML = `\n    <div class="det-hero">\n      <img class="det-img" alt="">\n      <div class="det-hero-txt">\n        <div class="det-name">${picked.name}</div>\n        <div class="det-role">${picked.role} · ${picked.id.toUpperCase()}</div>\n      </div>\n    </div>\n    <p class="det-desc">${picked.desc}</p>\n    ${picked.abilities.map((e) => `\n      <div class="ab">\n        <div class="ab-key">${abIcon(e.type)}<b>${e.key}</b></div>\n        <div>\n          <div class="ab-name">${e.name}</div>\n          <div class="ab-meta">${e.ult ? `궁극기 · 충전 ${e.ult}` : e.cost ? `최대 ${e.charges}회` : `재사용 ${e.cd}초`}</div>\n          <div class="ab-desc">${e.desc}${e.counterplay ? '<br><strong>대응</strong> '+e.counterplay : ''}</div>\n        </div>\n      </div>`).join("")}\n  `));
  GAME_PORTRAITS.set(t.querySelector(".det-img"), picked, 420, 520, true);
}
function startGame(e, t) {
  ((NET.mode = "solo"),
    NET.id || (NET.id = "solo"),
    world.entities.forEach((e) => scene.remove(e.group)),
    (world.entities = []),
    (teamBuilt = 0));
  const o = document.getElementById("team");
  (o && ((o.innerHTML = ""), (o.style.display = "none")),
    lobbyReset("SOLO", NET.id),
    lobbyAdd(NET.id, myName()),
    lobbyPickAgent(NET.id, e.key || e.id),
    lobbyFillAI(!0),
    (room.rounds = 13),
    (room.diff = t ? "easy" : room.diff || "normal"));
  try {
    "function" == typeof loadMap &&
      CUR_MAP_KEY !== room.map &&
      loadMap(room.map);
  } catch (e) {
    console.warn("loadMap", e);
  }
  (clearActors(), lobbyStart());
  const a = myActor();
  (a &&
    (bindLocalPlayer(a),
    (a.credits = 999999),
    document.documentElement.style.setProperty(
      "--ac",
      (a.agent && a.agent.color) || e.color,
    )),
    (world.scoreAtk = 0),
    (world.scoreDef = 0),
    (world.round = 1),
    (world.over = !1),
    (world.stats = { kills: 0, deaths: 0, dmg: 0, shots: 0, hits: 0 }),
    (rosterKey = ""),
    hideAll(),
    buildCross(),
    document.body.classList.toggle("touching", IS_TOUCH),
    IS_TOUCH && enableTouch());
  try {
    setQuality(SETTINGS.quality);
    const e = $("fps");
    e && (e.hidden = !SETTINGS.showFps);
  } catch (e) {}
  (startRound(), updateLockHint());
}
(($("go-play").onclick = () => {
  (delete $("sel-go").dataset.practice,
    renderSelect(),
    paintSelMaps(),
    show("s-select"));
}),
  ($("go-range").onclick = () => {
    (renderSelect(),
      paintSelMaps(),
      show("s-select"),
      ($("sel-go").dataset.practice = "1"));
  }),
  ($("go-fly").onclick = () => enterFly()),
  ($("fly-exit").onclick = () => exitFly()),
  ($("lh-touch").onclick = (e) => {
    (e.stopPropagation(), setTouchMode(!0));
  }),
  $("lockhint").addEventListener("mousedown", (e) => {
    e.target.closest("button") || ((lockCooldown = 0), tryLock());
  }),
  addEventListener("keydown", (e) => {
    "m" === e.key.toLowerCase() && "menu" !== world.phase && toggleTouchMode();
  }),
  updateTouchBtn(),
  IS_TOUCH && enableTouch(),
  ($("go-host").onclick = () => createRoom()));
const jc = $("join-code");
function joinErr(e) {
  const t = $("join-err");
  ((t.textContent = e || ""), (t.hidden = !e));
}
function tryJoinFromInput() {
  const e = jc.value.trim().toUpperCase();
  6 === e.length ? (joinErr(""), joinRoom(e)) : joinErr("코드는 6자리입니다");
}
function inviteLink() {
  const e = $("lb-code").textContent;
  try {
    const t = new URL(location.href);
    return ((t.hash = ""), t.searchParams.set("room", e), t.toString());
  } catch (t) {
    return location.href.split("?")[0] + "?room=" + e;
  }
}
function copyText(e, t) {
  const o = () => banner(t, "#4ade80");
  try {
    navigator.clipboard && navigator.clipboard.writeText
      ? navigator.clipboard.writeText(e).then(o, () => fallbackCopy(e, o))
      : fallbackCopy(e, o);
  } catch (t) {
    fallbackCopy(e, o);
  }
}
function fallbackCopy(e, t) {
  try {
    const o = document.createElement("textarea");
    ((o.value = e),
      (o.style.position = "fixed"),
      (o.style.opacity = "0"),
      document.body.appendChild(o),
      o.select(),
      document.execCommand("copy"),
      o.remove(),
      t());
  } catch (e) {
    banner("복사하지 못했습니다", "#ffc849");
  }
}
(jc.addEventListener("input", () => {
  ((jc.value = jc.value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6)),
    joinErr(""),
    6 === jc.value.length && tryJoinFromInput());
}),
  jc.addEventListener("keydown", (e) => {
    "Enter" === e.key && tryJoinFromInput();
  }),
  ($("go-join").onclick = () => tryJoinFromInput()),
  ($("lb-leave").onclick = () => {
    (netShutdown(),
      ($("lobby").hidden = !0),
      (world.phase = "menu"),
      show("s-title"));
  }),
  ($("lb-start").onclick = () => {
    "client" === NET.mode ? sendAction({ t: "start" }) : hostStartMatch();
  }),
  ($("lb-copy").onclick = () =>
    copyText($("lb-code").textContent, "초대 코드를 복사했습니다")),
  ($("lb-link").onclick = () =>
    copyText(inviteLink(), "초대 링크를 복사했습니다")),
  ($("sel-back").onclick = () => show("s-title")),
  ($("sel-go").onclick = (e) =>
    startGame(picked, "1" === e.currentTarget.dataset.practice)),
  ($("ov-again").onclick = () => startGame(player.agent, !1)),
  ($("ov-menu").onclick = () => {
    ((world.phase = "menu"), show("s-title"));
  }));
try {
  loadMap(CUR_MAP_KEY);
} catch (e) {
  console.warn("loadMap", e);
  try {
    dressMap();
  } catch (e) {
    console.warn("dressMap", e);
  }
  try {
    mergeDecor();
  } catch (e) {
    console.warn("mergeDecor", e);
  }
}
((world.phase = "menu"), show("s-title"));
try {
  GAME_BOOT.ready.then(() => { setQuality(SETTINGS.quality); renderTitleRoster(); });
} catch (e) {
  console.warn("roster", e);
}
(camera.position.set(0, 12, 62),
  (function () {
    let e = null;
    try {
      e = new URLSearchParams(location.search).get("room");
    } catch (e) {}
    if (!e) return;
    if (
      ((e = e
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6)),
      6 !== e.length)
    )
      return;
    const t = $("join-code");
    (t && (t.value = e),
      GAME_BOOT.ready.then(() => setTimeout(() => joinRoom(e), 400)));
  })(),
  camera.lookAt(0, 3, -20));
let titleAngle = 0;
function titleCam(e) {
  "menu" === world.phase &&
    ((titleAngle += 0.055 * e),
    camera.position.set(
      78 * Math.sin(titleAngle),
      46,
      78 * Math.cos(titleAngle),
    ),
    camera.lookAt(0, 0, -12));
}
const _origTick = tick;
let tlast = performance.now();
function boot(e) {
  requestAnimationFrame(boot);
  const t = Math.min(0.05, (e - tlast) / 1e3);
  ((tlast = e), "menu" === world.phase && (titleCam(t), render()));
}
(requestAnimationFrame(boot),
  requestAnimationFrame(tick),
  Object.assign(window, {
    AGENTS: AGENTS,
    WEAPONS: WEAPONS,
    MAP: MAP,
    COLLIDERS: COLLIDERS,
    NAV: NAV,
    world: world,
    player: player,
    DECOR: DECOR,
    MAT: MAT,
    dressMap: dressMap,
    buildProcWeapon: buildProcWeapon,
    GUN_BUILD: GUN_BUILD,
    GunBuilder: GunBuilder,
    GUNMAT: GUNMAT,
    VM: VM,
    movePlayer: movePlayer,
    forwardVec: forwardVec,
    keys: keys,
    startGame: startGame,
    useAbility: useAbility,
    initAbilities: initAbilities,
    fire: fire,
    findPath: findPath,
    closeShop: closeShop,
    banner: banner,
    SPIKE: SPIKE,
    SFX: SFX,
    handleSpike: handleSpike,
    plantSpike: plantSpike,
    defuseDone: defuseDone,
    detonate: detonate,
    dropSpike: dropSpike,
    pickupSpike: pickupSpike,
    STRUCT: STRUCT,
    buildStructures: buildStructures,
    buildGrid: buildGrid,
    GRID: GRID,
    stepTo: stepTo,
    blockerTopAt: blockerTopAt,
    STEP_H: STEP_H,
    updateTeam: updateTeam,
    drawTac: drawTac,
    agentPortrait: agentPortrait,
  }));

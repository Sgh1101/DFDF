/* 사막 마을: map7 of the Kour.io public client, through the owner's kouor project. It is loaded only when it is picked
   (like js/ascent-trial.js). The meshes, UVs, textures, materials and the world-space grid shader are the original's;
   the sites, team spawns, bot routes and the collision boxes are this game's (scripts/import-kour-map.js made the boxes). */
(() => {
  'use strict';
  const KEY = 'desert_town', NAME = '사막 마을', BASE = './assets/maps/kour/', VERSION = 'k1';
  const S = window.KOUR_MAP = { status: 'idle', active: false, meshes: [], meta: null, key: KEY };
  // Kour's camera is 2.5 units high, this game's eye is EYE metres: one unit is EYE / 2.5 m (kouor does the same with 1.65 m)
  const SC = EYE / 2.5, OX = 53, OY = -4.5, OZ = 50;        // the source point that is x 0, y 0 (the lowest floor), z 0 here
  const gx = x => (x - OX) * SC, gz = z => -(z - OZ) * SC, gy = y => (y - OY) * SC;   // Unity (+Z forward) to this game (-Z forward)
  const P = (x, z) => ({ x: gx(x), z: gz(z) });
  // the layout in source units (x, z): the attackers start where the source's T spawns are, the defenders where the CT's are
  const LAYOUT = {
    atk: [27, -40], def: [74, 113],
    sites: [['A', 133, 100], ['B', -4, 100]],
    nodes: { mid: [60, 40] },
  };
  const bounds = { minX: gx(-57), maxX: gx(163), minZ: gz(151), maxZ: gz(-51) };
  const node = a => P(a[0], a[1]);
  const makeEntry = () => ({
    key: KEY, name: NAME, size: 5, theme: 'dunes', fog: .0012, graphicsStatic: true, bounds,
    attackSpawn: node(LAYOUT.atk), defendSpawn: node(LAYOUT.def),
    sites: LAYOUT.sites.map(([id, x, z]) => ({ id, label: id + ' 거점', ...P(x, z), r: 8 })),
    nodes: Object.fromEntries([['atk', LAYOUT.atk], ['def', LAYOUT.def], ...LAYOUT.sites.map(s => [s[0], s.slice(1)]), ...Object.entries(LAYOUT.nodes)].map(([k, v]) => [k, node(v)])),
    walls: [],
  });
  MAPS[KEY] = makeEntry();
  const entry = { key: KEY, name: NAME, size: 5 };
  (window.MAP_EXTRA ||= []).push(entry);
  if (window.POGU) { if (!POGU.pool.includes(KEY)) POGU.pool.push(KEY); POGU.setPool(); } else { MAP_LIST.push(entry); dispatchEvent(new CustomEvent('maps-changed', { detail: { count: MAP_LIST.length } })); }

  // ── the loading strip: a slim notice on top while the map comes; it only takes taps to offer a retry ──
  let strip = null, pending = null, startRevision = 0, loadRevision = 0, flows = new Map();
  const L = (ko, en) => window.GAME_LANG === 'en' ? en : ko;
  function stripEl() {
    if (strip) return strip;
    strip = document.createElement('section');strip.id = 'kour-notice';strip.setAttribute('role', 'status');strip.hidden = true;
    strip.style.cssText = 'position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 6px);transform:translateX(-50%);z-index:10020;max-width:calc(100vw - 32px);padding:4px 12px;font:12px/1.5 sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:#101c29d9;color:#eef6ff;border:1px solid #64b8b0;border-radius:999px;box-shadow:0 4px 14px #0006;pointer-events:none';
    strip.append(document.createElement('span'), document.createElement('button'));
    const b = strip.lastChild;b.className = 'btn';b.textContent = '다시 불러오기';b.style.cssText = 'display:none;margin-left:10px;min-height:32px';b.onclick = () => { b.style.display = 'none'; strip.style.pointerEvents = 'none'; load(); };
    document.body.append(strip);return strip;
  }
  function say(text, retry) {
    const el = stripEl();el.firstChild.textContent = text;el.hidden = !text;
    el.style.pointerEvents = retry ? 'auto' : 'none';el.style.whiteSpace = retry ? 'normal' : 'nowrap';el.style.borderRadius = retry ? '12px' : '999px';el.lastChild.style.display = retry ? '' : 'none';
    // on the select screen the strip sits just above the map picker that was used; elsewhere at the top
    const anchor = ['sel-pick', 'sel-maps'].map(id => document.getElementById(id)).find(e => e && e.offsetParent && !e.closest('[hidden]')), r = anchor && anchor.getBoundingClientRect();
    if (r && r.width) Object.assign(el.style, { left: Math.max(8, Math.round(r.left)) + 'px', top: 'auto', bottom: Math.round(innerHeight - r.top + 8) + 'px', transform: 'none' });
    else Object.assign(el.style, { left: '50%', top: 'calc(env(safe-area-inset-top,0px) + 6px)', bottom: 'auto', transform: 'translateX(-50%)' });
  }

  // ── reading the source ──
  const T = THREE;
  const T_ARRAY = { f32: Float32Array, u32: Uint32Array, u16: Uint16Array, u8: Uint8Array };
  const unpack = v => {
    if (!v) return [];
    if (Array.isArray(v) || ArrayBuffer.isView(v)) return v;
    const t = T_ARRAY[String(v.type).toLowerCase()], s = atob(v.data || v.base64), b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return new t(b.buffer);
  };
  async function readJSON(url, gz) {
    const r = await fetch(url);if (!r.ok) throw Error(L('맵 파일을 불러오지 못했어', 'Could not load the map file'));
    if (!gz) return r.json();
    if (typeof DecompressionStream === 'undefined') throw Error(L('이 브라우저는 압축된 맵을 풀 수 없어', 'This browser cannot unpack the map'));
    return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json();
  }
  const sha = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  const list = v => Array.isArray(v) ? v : v ? Object.values(v) : [];
  const col = (v, f = [1, 1, 1]) => { const a = list(v); return new T.Color().setRGB(a[0] ?? f[0], a[1] ?? f[1], a[2] ?? f[2], T.SRGBColorSpace); };

  // The source's triangles, moved to this game's coordinates and sorted by material and by 56 m square, so that the map is a
  // few dozen draws that the camera can still cull. Unity's winding and left-handedness are undone as kouor's loader does:
  // the z reflection flips every triangle, a mirrored matrix (negative determinant) flips it back.
  function bake(src, chunk) {
    const geos = new Map(), parts = new Map(), M = new T.Matrix4(), NM = new T.Matrix3(), v = new T.Vector3(), n = new T.Vector3();
    const geo = id => {
      let g = geos.get(id);if (g) return g;
      const d = src.geometries[id];if (!d) throw Error('map geometry ' + id + ' is missing');
      const pos = unpack(d.positions || d.vertices), nor = unpack(d.normals), uv = unpack(d.uvs || d.uv), idx = unpack(d.indices || d.triangles);
      g = { pos, nor, uv, idx: idx.length ? idx : Array.from({ length: pos.length / 3 }, (_, i) => i), groups: d.groups || [] };
      geos.set(id, g);return g;
    };
    const flat = [];
    (function walk(ns) { for (const k of ns || []) { flat.push(k); walk(k.children); } })(src.nodes);
    for (const nd of flat) {
      if (nd.geometry === undefined || nd.geometry === null) continue;
      const g = geo(nd.geometry), groups = g.groups.length ? g.groups : [{ start: 0, count: g.idx.length, materialIndex: 0 }], ids = nd.materials || [nd.material];
      const first = nd.subMeshes?.start ?? 0, count = nd.subMeshes?.count ?? groups.length, sel = groups.slice(first, first + count), m = nd.worldMatrix || nd.matrix;
      for (let l = 0; l < sel.length; l++) {
        const r = sel[l], mid = ids[nd.subMeshes ? l : r.materialIndex] ?? (ids.length === 1 ? ids[0] : null);
        if (mid === null || mid === undefined) continue;
        // equal transforms of one material read the same sub-mesh range once, however many renderers point at it
        const key = JSON.stringify([nd.geometry, String(mid), m]);
        let p = parts.get(key);if (!p) parts.set(key, p = { g, mid: String(mid), m, ranges: new Map() });
        p.ranges.set(r.start + ':' + r.count, [r.start, r.count]);
      }
    }
    const out = new Map();
    for (const p of parts.values()) {
      const ranges = [...p.ranges.values()].sort((a, b) => a[0] - b[0]), merged = [];
      for (const [s, c] of ranges) { const q = merged[merged.length - 1];if (q && s <= q[0] + q[1]) q[1] = Math.max(q[0] + q[1], s + c) - q[0];else merged.push([s, c]); }
      M.fromArray(p.m);NM.getNormalMatrix(M);const mirror = M.determinant() < 0, e = M.elements, g = p.g;
      const world = (i, o) => {               // vertex i of the geometry: Unity world, then to this game
        v.set(g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2]).applyMatrix4(M);
        o.push(gx(v.x), gy(v.y), gz(v.z));
      };
      for (const [s, c] of merged) for (let t = s; t + 2 < s + c; t += 3) {
        const tri = mirror ? [0, 1, 2] : [0, 2, 1], vs = tri.map(k => g.idx[t + k]);
        let cx = 0, cz = 0;const pos = [];
        for (const i of vs) { world(i, pos);cx += pos[pos.length - 3];cz += pos[pos.length - 1]; }
        const ck = Math.floor(cx / 3 / chunk) + ',' + Math.floor(cz / 3 / chunk), bk = p.mid + '|' + ck;
        let b = out.get(bk);if (!b) out.set(bk, b = { mid: p.mid, pos: [], nor: [], uv: [] });
        b.pos.push(...pos);
        for (const i of vs) {
          if (g.nor.length) n.set(g.nor[i * 3], g.nor[i * 3 + 1], g.nor[i * 3 + 2]).applyMatrix3(NM).normalize();else n.set(0, 1, 0);
          b.nor.push(n.x, n.y, -n.z);
          if (g.uv.length) b.uv.push(g.uv[i * 2], g.uv[i * 2 + 1]);else b.uv.push(0, 0);
        }
      }
    }
    return [...out.values()].map(b => ({ mid: b.mid, pos: new Float32Array(b.pos), nor: new Float32Array(b.nor), uv: new Float32Array(b.uv) }));
  }

  // ── the look: the original's materials, and its Grid shader (the texture projected from three sides in world units) ──
  const textures = new Map();
  function texture(path, d) {
    const key = JSON.stringify([path, d.offset, d.repeat, d.wrap, d.filter, d.flipY]);
    let t = textures.get(key);if (t) return t;
    const base = S.images.get(path), tex = new T.Texture(base);
    tex.colorSpace = T.SRGBColorSpace;tex.flipY = d.flipY !== false;
    tex.wrapS = tex.wrapT = d.wrap === 'clamp' ? T.ClampToEdgeWrapping : T.RepeatWrapping;
    tex.offset.fromArray(d.offset || [0, 0]);tex.repeat.fromArray(d.repeat || [1, 1]);
    if (d.filter === 'nearest') { tex.magFilter = T.NearestFilter;tex.minFilter = T.NearestMipmapNearestFilter; }
    tex.anisotropy = SETTINGS.quality === 'mobile' ? 1 : 4;tex.needsUpdate = true;
    textures.set(key, tex);return tex;
  }
  function material(id, d) {
    const rgba = list(d.color), opacity = d.opacity ?? rgba[3] ?? 1, map = d.texture ? texture(d.texture, d) : null;
    const params = { name: d.name || id, color: col(d.color), map, opacity, transparent: d.transparent === true || opacity < 1, alphaTest: d.alphaTest ?? 0, side: d.doubleSided ? T.DoubleSide : T.FrontSide, toneMapped: false };
    const m = d.unlit ? new T.MeshBasicMaterial(params) : new T.MeshStandardMaterial({ ...params, roughness: d.roughness ?? 1, metalness: d.metalness ?? 0, emissive: col(d.emissive, [0, 0, 0]) });
    m.userData.envK = .25;      // the original is lit by its own ambient and sun; the engine's sky reflection stays a hint
    if (d.triplanar && map) {
      // Shader Graphs/Grid: _Grid read along x, y and z in world units (the source's, not this game's metres) and blended by
      // the normal, times _MultiColor, plus _AddColor. The geometry is already in world space, so no model matrix is needed.
      const u = { sourceGridScale: { value: d.projectionScale ?? 1 }, sourceGridAdd: { value: new T.Vector3(...(d.addColor || [0, 0, 0])) }, sourceGridTransform: { value: new T.Vector4(...(d.repeat || [1, 1]), ...(d.offset || [0, 0])) } };
      m.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, u);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vKourPos;\nvarying vec3 vKourNormal;')
          .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\nvKourNormal = normalize( normal );')
          .replace('#include <project_vertex>', `#include <project_vertex>\nvKourPos = vec3( transformed.x / ${SC.toFixed(8)} + ${OX.toFixed(4)}, transformed.y / ${SC.toFixed(8)} + ${OY.toFixed(4)}, -transformed.z / ${SC.toFixed(8)} + ${OZ.toFixed(4)} );`);
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vKourPos;\nvarying vec3 vKourNormal;\nuniform float sourceGridScale;\nuniform vec3 sourceGridAdd;\nuniform vec4 sourceGridTransform;')
          .replace('#include <map_fragment>', `#ifdef USE_MAP
          vec3 gw = abs( normalize( vKourNormal ) ); gw /= max( dot( gw, vec3( 1.0 ) ), 0.0001 );
          vec3 gp = vKourPos * sourceGridScale;
          vec4 gX = texture2D( map, gp.zy * sourceGridTransform.xy + sourceGridTransform.zw );
          vec4 gY = texture2D( map, gp.xz * sourceGridTransform.xy + sourceGridTransform.zw );
          vec4 gZ = texture2D( map, gp.xy * sourceGridTransform.xy + sourceGridTransform.zw );
          diffuseColor *= gX * gw.x + gY * gw.y + gZ * gw.z;
          diffuseColor.rgb += sourceGridAdd;
        #endif`);
      };
      m.customProgramCacheKey = () => 'kour-grid-v1';
    }
    return m;
  }

  // ── turning the source into the scene ──
  let mats = new Map(), renderChunk = 0;
  function buildMeshes(chunkSize) {
    const src = S.src;
    mats = new Map();
    for (const [id, d] of Object.entries(src.materials || {})) mats.set(id, material(id, d));
    let tris = 0;
    for (const b of S.baked(chunkSize)) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(b.pos, 3));g.setAttribute('normal', new T.BufferAttribute(b.nor, 3));g.setAttribute('uv', new T.BufferAttribute(b.uv, 2));
      g.computeBoundingSphere();
      const m = mats.get(b.mid), mesh = new T.Mesh(g, m);
      mesh.castShadow = !m.transparent && !m.isMeshBasicMaterial;mesh.receiveShadow = !m.isMeshBasicMaterial;mesh.userData.kour = true;mesh.matrixAutoUpdate = false;mesh.updateMatrix();
      scene.add(mesh);S.meshes.push(mesh);tris += b.pos.length / 9;
    }
    renderChunk = chunkSize;
    S.renderStats = { meshes: S.meshes.length, triangles: tris, materials: mats.size, textures: textures.size, chunk: chunkSize };
  }
  function clearMeshes() {
    for (const m of S.meshes) { scene.remove(m);m.geometry.dispose(); }
    S.meshes.length = 0;
    for (const m of mats.values()) m.dispose();
    mats = new Map();
    for (const t of textures.values()) t.dispose();     // the GPU copy only: the decoded pictures stay for the next visit
    textures.clear();renderChunk = 0;
  }

  // ── the boxes the engine collides against ──
  function boxes() {
    const c = S.collision;
    for (const [x0, x1, z0, z1, y0, y1, k] of c.boxes) {
      const a = gz(z0), b = gz(z1), bottom = Math.max(0, gy(y0));
      COLLIDERS.push({ minX: gx(x0), maxX: gx(x1), minZ: Math.min(a, b), maxZ: Math.max(a, b), y0: bottom < .02 ? 0 : bottom, h: gy(y1), mesh: null, hp: Infinity, destructible: false, temp: false, kour: k });
    }
    CHASH.dirty = true;chashBuild();
  }
  const on = () => S.active && CUR_MAP_KEY === KEY;
  S.on = on;

  let savedSun = null;
  function clear() {
    clearMeshes();
    if (S.active) { floor.visible = true;if (savedSun) { Object.assign(_SUN_OFF, savedSun);savedSun = null; } }
    S.active = false;flows.clear();S.nav = null;
  }
  const oldClear = clearMapGeometry;
  clearMapGeometry = function () { clear();return oldClear.apply(this, arguments); };

  const oldLoad = loadMap;
  loadMap = function (key) {
    const revision = ++loadRevision;
    if (key !== KEY) return oldLoad.apply(this, arguments);
    if (S.status !== 'ready') { S.ensure().then(ok => { if (ok && revision === loadRevision) loadMap(KEY); });return false; }
    clearMapGeometry();CUR_MAP_KEY = KEY;S.active = true;
    applyMapData(MAPS[KEY]);THEME.cur = THEMES.dunes;THEME.key = 'dunes';applyMapMood(MAPS[KEY]);
    // the original's own light: its sun and its ambient, over a neutral screen
    const env = S.src.environment || {}, amb = env.ambient || {}, sunL = (S.src.lights || [])[0];
    POST.tint = [1, 1, 1];POST.lift = [0, 0, 0];POST.sat = 1;POST.contrast = 1;POST.vignette = .1;renderer.toneMappingExposure = 1;
    hemi.color.copy(col(amb.sky, [.8, .8, .8]));hemi.groundColor.copy(col(amb.ground, [.4, .4, .4]));hemi.intensity = Math.PI * (amb.intensity ?? .62) * .7;
    if (sunL) { sun.color.copy(col(sunL.color));sun.intensity = Math.PI * (sunL.intensity ?? .7) * .8; }
    scene.background = new T.Color(0xaed6da);if (scene.fog) { scene.fog.color.set(0xaed6da);scene.fog.density = .0012; }
    // the sun stands where the source's directional light points from (Unity +Z forward becomes -Z here)
    savedSun = { ..._SUN_OFF };
    if (sunL) { const m = sunL.matrix, d = new T.Vector3(-m[8], -m[9], m[10]).normalize().multiplyScalar(118);Object.assign(_SUN_OFF, { x: d.x, y: d.y, z: d.z }); }
    buildMeshes(chunkFor(SETTINGS.quality));floor.visible = false;
    boxes();S.buildNav();
    NAV.length = 0;NAV.push(...Object.values(MAP.nodes));
    if (VM.root && !VM.root.parent) scene.add(VM.root);
    if (world.spike.mesh && !world.spike.mesh.parent) scene.add(world.spike.mesh);
    S.loads = (S.loads || 0) + 1;
    return true;
  };
  const chunkFor = q => q === 'mobile' ? 90 : 56;
  S.applyGraphics = () => {
    if (!on() || S.status !== 'ready') return;
    const c = chunkFor(SETTINGS.quality);
    if (c !== renderChunk) { clearMeshes();buildMeshes(c); }
  };
  const oldApply = applyGfx;
  applyGfx = function () { const r = oldApply.apply(this, arguments);try { S.applyGraphics(); } catch (e) {}return r; };

  // ── bots: the walkable cells, the links between them and the paths over them ──
  S.buildNav = () => { S.nav = null; };

  // ── loading ──
  async function load() {
    S.status = 'loading';say(L('사막 마을을 불러오는 중…', 'Loading Desert Town…'));
    try {
      const [src, collision] = await Promise.all([readJSON(BASE + 'map7.json.gz?v=' + VERSION, true), readJSON(BASE + 'map7-collision.json?v=' + VERSION)]);
      const paths = [...new Set(Object.values(src.materials || {}).map(m => m.texture).filter(Boolean))];
      S.images = new Map();
      await Promise.all(paths.map(async p => {
        const r = await fetch(BASE + p + '?v=' + VERSION);if (!r.ok) throw Error(L('텍스처를 불러오지 못했어', 'Could not load a texture'));
        const url = URL.createObjectURL(await r.blob());
        try { S.images.set(p, await new Promise((ok, no) => { const i = new Image();i.onload = () => ok(i);i.onerror = () => no(Error(L('텍스처를 읽지 못했어', 'Could not read a texture')));i.src = url; })); } finally { URL.revokeObjectURL(url); }
      }));
      S.src = src;S.collision = collision;S.meta = { sourceSha256: collision.source.sha256, boxes: collision.boxes.length, textures: paths.length };
      const cache = new Map();S.baked = c => { if (!cache.has(c)) cache.set(c, bake(src, c));return cache.get(c); };
      S.status = 'ready';say('');return true;
    } catch (e) { S.status = 'error';say(e.message, true);return false; }
  }
  S.ensure = () => {
    if (S.status === 'ready') return Promise.resolve(true);
    if (!pending) pending = load().finally(() => { pending = null; });
    return pending;
  };
  // a match started on this map waits for it to come
  function prepare(fn, args, key) {
    const revision = ++startRevision;
    if (key !== KEY || S.status === 'ready') return fn.apply(null, args);
    const screen = fn === solo ? document.getElementById('s-select') : fn === hostStart ? document.getElementById('lobby') : null, visible = screen && !screen.hidden;
    return S.ensure().then(ok => { if (ok && revision === startRevision && room.map === KEY && !(visible && screen.hidden)) return fn.apply(null, args); });
  }
  const solo = startGame, hostStart = hostStartMatch, clientStart = clientBeginMatch;
  startGame = function () { return prepare(solo, arguments, room.map); };
  hostStartMatch = function () { return prepare(hostStart, arguments, room.map); };
  clientBeginMatch = function (message) { if (message.map === KEY) room.map = KEY;return prepare(clientStart, arguments, message.map); };
  const selectMaps = paintSelMaps, lobbyMaps = paintMaps;
  paintSelMaps = function () { const r = selectMaps.apply(this, arguments);if (room.map === KEY) S.ensure();return r; };
  paintMaps = function (snapshot) { const r = lobbyMaps.apply(this, arguments);if (snapshot.map === KEY) S.ensure();return r; };
})();

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
  // the layout in source units (x, z): the attackers start where the source's T spawns are (t0 to t3, a fifth beside them), the
  // defenders where the CT's are (ct0 to ct3, a fifth beside them); the sites sit in the defended half, one on each flank
  const LAYOUT = {
    // [x, z, y]: the y of the source's own spawns (the T's stand on a deck over a yard, the CT's in the pit)
    spawns: { atk: [[25.3, -36.4, 6.6], [30.2, -40.2, 6.6], [23.5, -44.2, 6.6], [29.3, -44, 6.6], [26.5, -48, 6.6]], def: [[70.6, 111.6, -2.1], [80.1, 116.2, -2.1], [74.9, 110.4, -2.1], [67.3, 115.2, -2.1], [77, 106, -2.1]] },
    // [id, x, z, y]: A on the main level east of the pit, B at the pit's west end
    sites: [['A', 126, 66, .9], ['B', 30, 104, -3.1]],
    nodes: { mid: [60, 40, .9], plazaE: [95, -30, .9], plazaW: [60, -10, .9], west: [-30, 40, .9], westS: [-26, 100, .9], pitE: [96, 104, -3.1], eastS: [126, 20, .9], lane: [86, 8, .9] },
  };
  const bounds = { minX: gx(-57), maxX: gx(163), minZ: gz(151), maxZ: gz(-51) };
  const node = a => P(a[0], a[1]), centre = l => P(l.reduce((t, p) => t + p[0], 0) / l.length, l.reduce((t, p) => t + p[1], 0) / l.length);
  const makeEntry = () => ({
    key: KEY, name: NAME, size: 5, theme: 'dunes', fog: .0012, graphicsStatic: true, bounds,
    attackSpawn: centre(LAYOUT.spawns.atk), defendSpawn: centre(LAYOUT.spawns.def),
    sites: LAYOUT.sites.map(([id, x, z]) => ({ id, label: id + ' 거점', ...P(x, z), r: 8 })),
    nodes: Object.fromEntries([['atk', centre(LAYOUT.spawns.atk)], ['def', centre(LAYOUT.spawns.def)], ...LAYOUT.sites.map(s => [s[0], P(s[1], s[2])]), ...Object.entries(LAYOUT.nodes).map(([k, v]) => [k, node(v)])]),
    walls: [],
  });
  MAPS[KEY] = makeEntry();
  (window.MAP_EXTRA ||= []).push({ key: KEY, name: NAME, size: 5 });
  // an event map: not in the pool (POGU.pool); js/legacy/76 puts it in the list while the server announces it (EVENT_MAP_KEY)
  window.POGU && POGU.setPool();

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
      mesh.castShadow = !m.transparent && !m.isMeshBasicMaterial;mesh.receiveShadow = !m.isMeshBasicMaterial;mesh.userData.kour = true;mesh.userData.mapDetail = 1;mesh.matrixAutoUpdate = false;mesh.updateMatrix();   // mapDetail: the engine's ghost scan (js/legacy/11) leaves it alone, the boxes are made from the source
      scene.add(mesh);S.meshes.push(mesh);tris += b.pos.length / 9;
    }
    renderChunk = chunkSize;
    S.renderStats = { meshes: S.meshes.length, triangles: tris, materials: mats.size, textures: textures.size, chunk: chunkSize };
  }
  function clearMeshes() {
    for (const m of S.meshes) { scene.remove(m);m.geometry.dispose(); }
    S.meshes.length = 0;
    for (const m of marks) { scene.remove(m);m.geometry.dispose();m.material.dispose(); }
    marks = [];
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
    S.active = false;flows.clear();S.nav = null;S.spawns = null;G = null;window.MAP_WALLS_PAINT = null;
    if (prevNav) { NAV.length = 0;NAV.push(...prevNav);GRID.cell = prevCell;prevNav = null; }
  }
  const oldClear = clearMapGeometry;
  clearMapGeometry = function () { clear();return oldClear.apply(this, arguments); };

  const oldLoad = loadMap;
  loadMap = function (key) {
    const revision = ++loadRevision;
    if (key !== KEY) return oldLoad.apply(this, arguments);
    // the title screen's changing background does not fetch the town: only a match, or the picker with it chosen, does
    if (S.status !== 'ready' && world.phase === 'menu' && room.map !== KEY) return false;
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
    boxes();S.buildNav();buildMini();markSites();window.MAP_WALLS_PAINT = paintBig;
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

  // ── bots: the places a body can stand, the links between them and the paths over them (the design of js/ascent-trial.js,
  // with every cell holding all the heights a body can stand at: the ground, a deck, a ramp over a street) ──
  let G = null, prevNav = null, prevCell = 0;
  function nearby(x, z, r = PR) {
    if (CHASH.dirty || !CHASH.buckets) chashBuild();
    const found = new Set(), out = [];
    for (let iz = Math.max(0, Math.floor((z - r - CHASH.minZ) / CHASH.cell)); iz <= Math.min(CHASH.rows - 1, Math.floor((z + r - CHASH.minZ) / CHASH.cell)); iz++)
      for (let ix = Math.max(0, Math.floor((x - r - CHASH.minX) / CHASH.cell)); ix <= Math.min(CHASH.cols - 1, Math.floor((x + r - CHASH.minX) / CHASH.cell)); ix++)
        for (const c of CHASH.buckets[iz * CHASH.cols + ix] || []) if (!found.has(c)) { found.add(c); out.push(c); }
    return out;
  }
  S.nearby = nearby;
  // the heights a body of radius r can stand at on (x, z): the ground and the top of each box under the body with nothing in
  // the way at body height, lowest first
  function levels(x, z, r = PR) {
    const tops = [0];
    for (const c of nearby(x, z, r)) if (c.h > .05 && c.h < 40 && x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) tops.push(c.h);
    tops.sort((a, b) => a - b);
    const out = [];
    for (const h of tops) { if (out.length && h - out[out.length - 1] < .2) continue;if (!collideXZ(x, z, h + .02, r) && (h === 0 || groundTop(x, z, h + .02, r, STEP_H) >= h - .01)) out.push(h); }
    return out;
  }
  S.levels = levels;
  const lowestFree = (x, z, r) => { const l = levels(x, z, r);return l.length ? l[0] : NaN; };
  S.floorAt = lowestFree;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  S.buildNav = () => {
    if (!prevNav) { prevNav = NAV.slice();prevCell = GRID.cell; }
    const cell = GRID.cell = 1;GRID.minX = MAP.bounds.minX;GRID.minZ = MAP.bounds.minZ;
    const cols = GRID.cols = Math.ceil((MAP.bounds.maxX - GRID.minX) / cell), rows = GRID.rows = Math.ceil((MAP.bounds.maxZ - GRID.minZ) / cell);
    const first = new Int32Array(cols * rows + 1), H = [];
    for (let z = 0; z < rows; z++) for (let x = 0; x < cols; x++) { const p = cellCenter(x, z);first[z * cols + x] = H.length;for (const h of levels(p.x, p.z, .8)) H.push(h); }
    first[cols * rows] = H.length;
    const N = H.length, to = new Int32Array(N * 4).fill(-1), cellOf = new Int32Array(N);
    for (let i = 0; i < cols * rows; i++) for (let n = first[i]; n < first[i + 1]; n++) cellOf[n] = i;
    // a link: the body's own movement and step solver from this height into the next cell; it ends on a level there (a step up
    // or along), or, when nothing in the way stops it, drops to the highest level below within 2.2 m
    for (let n = 0; n < N; n++) {
      const i = cellOf[n], x = i % cols, z = (i / cols) | 0, p = cellCenter(x, z);
      for (let d = 0; d < 4; d++) {
        const X = x + DIRS[d][0], Z = z + DIRS[d][1];if (X < 0 || Z < 0 || X >= cols || Z >= rows) continue;
        const j = Z * cols + X;if (first[j] === first[j + 1]) continue;
        const pos = { x: p.x, z: p.z }, y = moveWithSlide(pos, DIRS[d][0] * cell, DIRS[d][1] * cell, H[n], PR);
        if (Math.hypot(pos.x - p.x - DIRS[d][0] * cell, pos.z - p.z - DIRS[d][1] * cell) > .01) continue;
        let best = -1, bd = 1e9;
        for (let m = first[j]; m < first[j + 1]; m++) {
          const dh = H[m] - y;if (dh > .12 || H[n] - H[m] > 2.2) continue;
          const dd = Math.abs(dh);if (dd < bd) { bd = dd;best = m; }
        }
        if (best >= 0 && (bd <= .12 || y <= H[n] + .001)) to[n * 4 + d] = best;
      }
    }
    // the largest set of places that can all be walked to and from is the town's: spawns and objectives stay on it
    const reverse = Array.from({ length: N }, () => []), order = [], seen = new Uint8Array(N), comp = new Int32Array(N).fill(-1), sizes = [];
    for (let n = 0; n < N; n++) for (let d = 0; d < 4; d++) { const m = to[n * 4 + d];if (m >= 0) reverse[m].push(n); }
    for (let s0 = 0; s0 < N; s0++) {
      if (seen[s0]) continue;
      const st = [[s0, 0]];seen[s0] = 1;
      while (st.length) {
        const t = st[st.length - 1];
        if (t[1] < 4) { const m = to[t[0] * 4 + t[1]++];if (m >= 0 && !seen[m]) { seen[m] = 1;st.push([m, 0]); } } else { order.push(t[0]);st.pop(); }
      }
    }
    for (let k = N - 1; k >= 0; k--) {
      const s0 = order[k];if (comp[s0] >= 0) continue;
      const id = sizes.length, st = [s0];comp[s0] = id;let c = 0;
      while (st.length) { const n = st.pop();c++;for (const m of reverse[n]) if (comp[m] < 0) { comp[m] = id;st.push(m); } }
      sizes.push(c);
    }
    let main = 0;sizes.forEach((c, i) => { if (c > sizes[main]) main = i; });
    // the cells: any place there, a place of the town's, the lowest of those (for the minimaps)
    GRID.walk = new Uint8Array(cols * rows);const low = new Float32Array(cols * rows).fill(NaN);
    for (let i = 0; i < cols * rows; i++) for (let n = first[i]; n < first[i + 1]; n++) if (comp[n] === main) { GRID.walk[i] = 1;if (!(low[i] <= H[n])) low[i] = H[n]; }
    G = { cols, rows, first, H: Float32Array.from(H), to, cellOf, comp, main, N, low, rev: reverse };
    S.nav = { cols, rows, nodes: N, levels: Float32Array.from(H), edges: to, component: comp, mainId: main, main: GRID.walk, low, groups: sizes.slice().sort((a, b) => b - a) };
    // a place of the layout (x, z, and the height it is meant to be at) moves to the nearest place of the town
    S.snap = (p, y) => {
      let best = null, d = Infinity;
      const cx0 = gridX(p.x), cz0 = gridZ(p.z);
      for (let r = 0; r < 40 && !best; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const X = cx0 + dx, Z = cz0 + dz;if (X < 0 || Z < 0 || X >= cols || Z >= rows) continue;
        for (let n = first[Z * cols + X]; n < first[Z * cols + X + 1]; n++) {
          if (comp[n] !== main) continue;
          const c = cellCenter(X, Z), dist = (p.x - c.x) ** 2 + (p.z - c.z) ** 2 + (Number.isFinite(y) ? (H[n] - y) ** 2 * 4 : 0);
          if (dist < d) { d = dist;best = { ...c, y: H[n] }; }
        }
      }
      return best;
    };
    const place = (a) => ({ ...P(a[0], a[1]), y: a[2] === undefined ? undefined : gy(a[2]) });
    const at = a => { const q = place(a);return S.snap(q, q.y); };
    for (const p of [...MAP.sites]) { const l = LAYOUT.sites.find(s => s[0] === p.id), b = at([l[1], l[2], l[3]]);if (b) Object.assign(p, b); }
    S.spawns = { atk: LAYOUT.spawns.atk.map(at), def: LAYOUT.spawns.def.map(at) };
    const mean = l => ({ x: l.reduce((t, p) => t + p.x, 0) / l.length, z: l.reduce((t, p) => t + p.z, 0) / l.length });
    for (const [k, l] of [['atk', S.spawns.atk], ['def', S.spawns.def]]) { const m = mean(l), b = S.snap(m, l[0].y);Object.assign(k === 'atk' ? MAP.attackSpawn : MAP.defendSpawn, b);MAP.nodes[k] = { ...b }; }
    for (const s of MAP.sites) MAP.nodes[s.id] = { x: s.x, z: s.z, y: s.y };
    for (const [k, v] of Object.entries(LAYOUT.nodes)) { const b = at(v);if (b) MAP.nodes[k] = b; }
  };
  // the places of a cell, ring by ring out to 12 cells when it has none
  function cellNodes(cx, cz) {
    for (let r = 0; r <= 12; r++) {
      const out = [];
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const X = cx + dx, Z = cz + dz;if (X < 0 || Z < 0 || X >= G.cols || Z >= G.rows) continue;
        for (let n = G.first[Z * G.cols + X]; n < G.first[Z * G.cols + X + 1]; n++) if (G.comp[n] === G.main) out.push(n);
      }
      if (out.length) return out;
    }
    return [];
  }
  const gridX = x => Math.max(0, Math.min(GRID.cols - 1, Math.floor((x - GRID.minX) / GRID.cell))), gridZ = z => Math.max(0, Math.min(GRID.rows - 1, Math.floor((z - GRID.minZ) / GRID.cell)));
  // steps to the goal cell from every place that can walk there, by one search from the goal back along the links
  function flow(cx, cz) {
    const key = cz * G.cols + cx;
    let f = flows.get(key);if (f) return f;
    f = { dist: new Int32Array(G.N).fill(-1), goal: cellNodes(cx, cz) };
    const q = f.goal.slice();for (const n of q) f.dist[n] = 0;
    for (let head = 0; head < q.length; head++) { const n = q[head];for (const m of G.rev[n]) if (f.dist[m] < 0) { f.dist[m] = f.dist[n] + 1;q.push(m); } }
    if (flows.size >= 12) flows.delete(flows.keys().next().value);flows.set(key, f);return f;
  }
  const oldFind = findPath;
  findPath = function (x, z, X, Z, y) {
    if (!on() || !G) return oldFind.apply(this, arguments);
    const f = flow(gridX(X), gridZ(Z)), here = cellNodes(gridX(x), gridZ(z)), h = Number.isFinite(y) ? y : Number.isFinite(S.fromY) ? S.fromY : 0;
    let start = -1, bd = Infinity;
    for (const n of here) { const d = Math.abs(G.H[n] - h);if (f.dist[n] >= 0 && d < bd) { bd = d;start = n; } }
    if (start < 0) return [];
    const path = [];
    for (let n = start; f.dist[n] > 0;) {
      let next = -1;
      for (let d = 0; d < 4; d++) { const m = G.to[n * 4 + d];if (m >= 0 && f.dist[m] === f.dist[n] - 1) { next = m;break; } }
      if (next < 0) break;
      const i = G.cellOf[next], c = cellCenter(i % G.cols, Math.floor(i / G.cols));path.push({ ...c, y: G.H[next] });n = next;
    }
    return path;
  };
  const oldNext = navNext;
  navNext = function (a, x, z, dt) {
    if (!on()) return oldNext.apply(this, arguments);
    const n = a.ai;n.repathCd2 = (n.repathCd2 || 0) - dt;
    if (!n.path || n.repathCd2 <= 0 || !n.pathGoal || Math.hypot(n.pathGoal.x - x, n.pathGoal.z - z) > 3) { n.path = findPath(a.pos.x, a.pos.z, x, z, a.y);n.pathIdx = 0;n.pathGoal = { x, z };n.repathCd2 = 2; }
    while (n.pathIdx < n.path.length && Math.hypot(a.pos.x - n.path[n.pathIdx].x, a.pos.z - n.path[n.pathIdx].z) < .3) n.pathIdx++;
    return n.path[n.pathIdx] || { x, z };
  };
  const oldSteer = steerToward;
  steerToward = function (a, x, z, dt, rate) {
    if (!on()) return oldSteer.apply(this, arguments);
    a.yaw = Math.atan2(-(x - a.pos.x), -(z - a.pos.z));return 0;
  };

  // ── where the teams start, and where a body that ends up in a block is put ──
  function safe(p) {
    const b = G && S.snap(p, p.y);
    if (b) return b;
    throw Error('안전한 시작 위치를 찾지 못했어');
  }
  const oldSpawn = spawnPointFor;
  spawnPointFor = function (team, index) {
    if (!on() || !S.spawns) return oldSpawn.apply(this, arguments);
    const list = S.spawns[team === 'atk' ? 'atk' : 'def'], p = list[((index % list.length) + list.length) % list.length], q = team === 'atk' ? MAP.defendSpawn : MAP.attackSpawn;
    return { x: p.x, z: p.z, y: p.y, yaw: Math.atan2(-(q.x - p.x), -(q.z - p.z)) };
  };
  function placeActors() {
    const counts = { atk: 0, def: 0 };
    for (const a of world.actors) { const p = spawnPointFor(a.team, counts[a.team]++);a.pos.set(p.x, p.y, p.z);a.y = p.y;a.vy = 0;a.onGround = true;a.yaw = p.yaw;syncActorModel(a); }
  }
  const oldReset = resetActorsForRound;
  resetActorsForRound = function () { const r = oldReset.apply(this, arguments);if (on()) placeActors();return r; };
  const oldRespawn = respawnAll;
  respawnAll = function () { const r = oldRespawn.apply(this, arguments);if (on()) placeActors();return r; };
  const oldRound = startRound;
  startRound = function () { const r = oldRound.apply(this, arguments);if (on()) placeActors();return r; };
  const oldCreate = createActor;
  createActor = function () { const a = oldCreate.apply(this, arguments);if (on() && G) { const p = safe({ x: a.pos.x, z: a.pos.z });a.y = p.y;a.pos.y = p.y; }return a; };
  // a body the modes placed at ground level (a respawn in a free-for-all) inside a block stands on the block instead; and
  // jumping under a floor stops at its underside
  const oldMove = simMove;
  simMove = function (a, dt) {
    const oldY = a.y;
    const r = oldMove.apply(this, arguments);
    if (on() && a.y > oldY) for (const c of nearby(a.pos.x, a.pos.z)) {
      if (c.y0 > 0 && oldY + 2.3 <= c.y0 + .001 && a.y + 2.3 > c.y0 && a.pos.x + PR > c.minX && a.pos.x - PR < c.maxX && a.pos.z + PR > c.minZ && a.pos.z - PR < c.maxZ) { a.y = Math.max(oldY, c.y0 - 2.3);a.vy = 0; }
    }
    if (on() && a.alive && a.pos && collideXZ(a.pos.x, a.pos.z, a.y, PR * .8)) {
      const h = lowestFree(a.pos.x, a.pos.z, PR * .8);
      if (Number.isFinite(h)) { a.y = h;a.pos.y = h;a.vy = 0; } else { const p = spawnPointFor(a.team, 0);a.pos.set(p.x, p.y, p.z);a.y = p.y;a.vy = 0; }
    }
    return r;
  };


  // ── the minimaps: the town's layout (the ground is a block nearly everywhere, so the boxes themselves would be a grey sheet) ──
  const MK = 3;
  function buildMini() {
    const B = MAP.bounds, w = Math.ceil((B.maxX - B.minX + 8) * MK), h = Math.ceil((B.maxZ - B.minZ + 8) * MK), cv = S.mapCv || (S.mapCv = document.createElement('canvas'));
    cv.width = w;cv.height = h;
    const g = cv.getContext('2d'), X = x => (x - B.minX + 4) * MK, Z = z => (z - B.minZ + 4) * MK;
    S.mapBox = { minX: B.minX - 4, minZ: B.minZ - 4, w: w / MK, h: h / MK };
    g.fillStyle = '#3b485c';g.fillRect(0, 0, w, h);
    for (let i = 0; i < GRID.walk.length; i++) if (GRID.walk[i] || G.first[i] < G.first[i + 1]) {
      const c = cellCenter(i % GRID.cols, Math.floor(i / GRID.cols));
      g.fillStyle = GRID.walk[i] ? '#161e2b' : '#27334a';g.fillRect(X(c.x - GRID.cell / 2), Z(c.z - GRID.cell / 2), GRID.cell * MK + .5, GRID.cell * MK + .5);
    }
    // walls and boxes that stand on the floor of their place (not the lintels over a door, not the ground itself)
    for (const c of COLLIDERS) {
      if (c.kour !== 'w' && c.kour !== 's') continue;
      const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2, i = gridZ(cz) * GRID.cols + gridX(cx), f = Number.isFinite(G.low[i]) ? G.low[i] : 0;
      if (c.y0 > f + 1 || c.h < f + STEP_H) continue;
      g.fillStyle = c.kour === 'w' ? '#a9b9d2' : '#7c8ea8';g.fillRect(X(c.minX), Z(c.minZ), Math.max(2, (c.maxX - c.minX) * MK), Math.max(2, (c.maxZ - c.minZ) * MK));
    }
  }
  const oldTac = drawTacWalls;
  drawTacWalls = function (r, s) {
    if (!on() || !S.mapCv) return oldTac.apply(this, arguments);
    const b = S.mapBox;tctx.drawImage(S.mapCv, r(b.minX), s(b.minZ), r(b.w), s(b.h));
  };
  const oldMini = drawMiniWalls;
  drawMiniWalls = function () {
    if (!on() || !S.mapCv) return oldMini.apply(this, arguments);
    const B = MAP.bounds;mctx.drawImage(S.mapCv, 4 * MK, 4 * MK, (B.maxX - B.minX) * MK, (B.maxZ - B.minZ) * MK, 0, 0, mini.width, mini.height);
  };
  // the big map (M): js/legacy/28-1 asks this first
  const paintBig = (g, X, Z, scale) => { const b = S.mapBox;g.drawImage(S.mapCv, X(b.minX), Z(b.minZ), b.w * scale, b.h * scale);return true; };

  // ── the sites: a ring and a disc on the floor, like the ones the engine puts on its first map ──
  let marks = [];
  function markSites() {
    for (const s of MAP.sites) {
      const ring = new T.Mesh(new T.RingGeometry(s.r - .5, s.r, 48), new T.MeshBasicMaterial({ color: 0xff3b4e, transparent: true, opacity: .4, side: T.DoubleSide, depthWrite: false, toneMapped: false })),
        disc = new T.Mesh(new T.CircleGeometry(s.r, 40), new T.MeshBasicMaterial({ color: 0xff3b4e, transparent: true, opacity: .07, side: T.DoubleSide, depthWrite: false, toneMapped: false }));
      for (const m of [ring, disc]) { m.rotation.x = -Math.PI / 2;m.position.set(s.x, (s.y || 0) + (m === ring ? .08 : .06), s.z);scene.add(m);marks.push(m); }
    }
  }

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

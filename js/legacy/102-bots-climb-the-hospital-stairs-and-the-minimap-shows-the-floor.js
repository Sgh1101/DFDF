(() => {
  // The hospital has three floors but the engine's bots only knew the ground one: their path grid is
  // flat and they steer by what is taller than their feet, which reads a stair as a wall. Three things:
  //  · a path over the floor plan itself (cells, wall edges, the four stairs as links), used whenever a
  //    bot or its goal is above the ground; on the ground the engine's own paths are kept;
  //  · some bots take a post on the ring round the atrium or on the bridge, and hold it;
  //  · the two maps (the corner minimap and the round tactical one) draw the floor you stand on (they drew
  //    every wall and slab of every floor on top of each other), and the minimap names the floor and the room.
  const API = window.HOSPITAL_API;
  if (!API || "function" != typeof navNext || "function" != typeof aiGoal || "function" != typeof steerToward || "function" != typeof aiThink || "function" != typeof drawMini || "function" != typeof intelNearest) return;
  const P = API.plan,
    C = P.cols,
    R = P.rows,
    CELL = P.cell,
    OX = P.origin[0],
    OZ = P.origin[1],
    FH = P.floorH,
    LV = P.levels;
  const ex = (c) => OX + c * CELL,
    ez = (r) => OZ + r * CELL,
    cx = (c) => ex(c + 0.5),
    cz = (r) => ez(r + 0.5);
  const colOf = (x) => Math.floor((x - OX) / CELL),
    rowOf = (z) => Math.floor((z - OZ) / CELL);
  const zone = (n, c, r) => (n < 0 || n > 2 || c < 0 || r < 0 || c >= C || r >= R ? " " : LV[n].f[r][c]);
  // edges: 0 open, anything else (wall, balustrade, parapet, fence) shuts it; outside the plan is shut
  const wallH = (n, r, c) => (r < 0 || r > R || c < 0 || c >= C ? 1 : +LV[n].H[r][c]);
  const wallV = (n, r, c) => (r < 0 || r >= R || c < 0 || c > C ? 1 : +LV[n].V[r][c]);
  const idOf = (n, c, r) => (n * R + r) * C + c;
  const on = () => "hospital" === CUR_MAP_KEY && !!window.HOSPITAL && !!HOSPITAL.key;
  const lvOf = (y) => Math.max(0, Math.min(2, Math.round(y / FH)));
  
  // ── the graph: free cells, and the stairs as links between two cells ──
  let GR = null;
  function graph() {
    if (GR) return GR;
    const free = new Uint8Array(3 * R * C);
    for (let n = 0; n < 3; n++)
      for (let r = 0; r < R; r++)
        for (let c = 0; c < C; c++) {
          if (" 09s".includes(zone(n, c, r))) continue;
          free[idOf(n, c, r)] = collideXZ(cx(c), cz(r), n * FH, PR) ? 0 : 1;
        }
    // a stair: 8 steps of 0.5 m, 1.25 m deep, from the low end (south) to the north; both cells of its width
    const por = new Map();
    const add = (a, link) => (por.get(a) || por.set(a, []).get(a)).push(link);
    for (const [from, c, r] of P.stairs) {
      const b = from * FH,
        xs = ex(c + 1),
        zs = ez(r + 1),
        up = [{ x: xs, z: zs + 0.5, y: b, st: 1 }];
      for (const s of [1, 3, 5, 7, 8]) up.push({ x: xs, z: zs - 1.25 * (s - 0.5), y: b + 0.5 * s, st: 1 });
      for (const w of [0, 1]) {
        const lo = idOf(from, c + w, r + 1),
          hi = idOf(from + 1, c + w, r - 4);
        add(lo, { to: hi, cost: 14, wps: up });
        add(hi, { to: lo, cost: 14, wps: up.slice().reverse() });
      }
    }
    GR = { free, por, reach: null };
    // what the attackers' side can reach: a post nobody can walk to is never handed out
    const seen = new Uint8Array(free.length),
      q = [];
    const start = nearest(0, P.attackSpawn[0], P.attackSpawn[1]);
    if (start >= 0) {
      seen[start] = 1;
      q.push(start);
    }
    while (q.length) {
      const k = q.pop(),
        n = Math.floor(k / (R * C)),
        r = Math.floor((k % (R * C)) / C),
        c = k % C;
      for (const [k2] of steps(n, c, r)) !seen[k2] && ((seen[k2] = 1), q.push(k2));
      for (const l of por.get(k) || []) !seen[l.to] && free[l.to] && ((seen[l.to] = 1), q.push(l.to));
    }
    GR.reach = seen;
    return GR;
  }
  // the free neighbours of a cell, as [id, cost]; a corner is only cut when both ways round are open
  const NB = [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]];
  function can(n, c, r, dc, dr) {
    const c2 = c + dc,
      r2 = r + dr;
    if (c2 < 0 || r2 < 0 || c2 >= C || r2 >= R || !GR.free[idOf(n, c2, r2)]) return false;
    return dc === 1 ? 0 === wallV(n, r, c + 1) : dc === -1 ? 0 === wallV(n, r, c) : dr === 1 ? 0 === wallH(n, r + 1, c) : 0 === wallH(n, r, c);
  }
  function steps(n, c, r) {
    const out = [];
    for (const [dc, dr] of NB) {
      if (dc && dr) {
        if (!(can(n, c, r, dc, 0) && can(n, c, r, 0, dr) && can(n, c + dc, r, 0, dr) && can(n, c, r + dr, dc, 0))) continue;
        out.push([idOf(n, c + dc, r + dr), 1.414 * CELL]);
      } else if (can(n, c, r, dc, dr)) out.push([idOf(n, c + dc, r + dr), CELL]);
    }
    return out;
  }
  // the free cell nearest a point on a floor
  function nearest(n, x, z) {
    const g = GR || (graph(), GR),
      c0 = Math.max(0, Math.min(C - 1, colOf(x))),
      r0 = Math.max(0, Math.min(R - 1, rowOf(z)));
    let best = -1,
      bd = 1e9;
    for (let d = 0; d <= 6 && best < 0; d++)
      for (let dr = -d; dr <= d; dr++)
        for (let dc = -d; dc <= d; dc++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== d) continue;
          const c = c0 + dc,
            r = r0 + dr;
          if (c < 0 || r < 0 || c >= C || r >= R || !g.free[idOf(n, c, r)]) continue;
          const h = Math.hypot(cx(c) - x, cz(r) - z);
          h < bd && ((bd = h), (best = idOf(n, c, r)));
        }
    return best;
  }
  function lineClear(n, x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0),
      m = Math.max(1, Math.ceil(len / 0.7));
    for (let i = 1; i < m; i++) {
      const t = i / m;
      if (collideXZ(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, n * FH, 0.8)) return false;
    }
    return true;
  }

  // ── the search ──
  const W = { n: 0, gen: 0, g: null, f: null, prev: null, via: null, stamp: null, closed: null, heap: [] };
  function route(from, goal) {
    const g = graph(),
      N = g.free.length;
    if (W.n !== N) Object.assign(W, { n: N, g: new Float32Array(N), f: new Float32Array(N), prev: new Int32Array(N), via: new Array(N), stamp: new Uint32Array(N), closed: new Uint8Array(N) });
    const s = from.id,
      t = goal.id,
      u = ++W.gen,
      gc = t % C,
      gr = Math.floor((t % (R * C)) / C),
      h = (k) => Math.hypot(cx(k % C) - cx(gc), cz(Math.floor((k % (R * C)) / C)) - cz(gr));
    const touch = (k) => {
      if (W.stamp[k] !== u) {
        W.stamp[k] = u;
        W.g[k] = 1e9;
        W.f[k] = 1e9;
        W.prev[k] = -1;
        W.via[k] = null;
        W.closed[k] = 0;
      }
    };
    const heap = W.heap;
    heap.length = 0;
    const push = (k) => {
      heap.push(k);
      for (let i = heap.length - 1; i > 0; ) {
        const p = (i - 1) >> 1;
        if (W.f[heap[p]] <= W.f[heap[i]]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0],
        last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        for (let i = 0; ; ) {
          const a = 2 * i + 1,
            b = a + 1;
          let m = i;
          a < heap.length && W.f[heap[a]] < W.f[heap[m]] && (m = a);
          b < heap.length && W.f[heap[b]] < W.f[heap[m]] && (m = b);
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    touch(s);
    W.g[s] = 0;
    W.f[s] = h(s);
    push(s);
    let guard = 0;
    while (heap.length && guard++ < N) {
      const k = pop();
      if (W.closed[k]) continue;
      W.closed[k] = 1;
      if (k === t) break;
      const n = Math.floor(k / (R * C)),
        r = Math.floor((k % (R * C)) / C),
        c = k % C;
      const relax = (k2, cost, via) => {
        touch(k2);
        if (W.closed[k2]) return;
        const v = W.g[k] + cost;
        v < W.g[k2] && ((W.g[k2] = v), (W.f[k2] = v + h(k2)), (W.prev[k2] = k), (W.via[k2] = via), push(k2));
      };
      for (const [k2, cost] of steps(n, c, r)) relax(k2, cost, null);
      for (const l of g.por.get(k) || []) g.free[l.to] && relax(l.to, l.cost, l);
    }
    if (W.stamp[t] !== u || (W.prev[t] < 0 && s !== t)) return null;
    const chain = [];
    for (let k = t; k !== -1; k = W.prev[k]) chain.push(k);
    chain.reverse();
    const pts = [];
    chain.forEach((k, i) => {
      i && W.via[k] && pts.push(...W.via[k].wps);
      const n = Math.floor(k / (R * C)),
        r = Math.floor((k % (R * C)) / C),
        c = k % C;
      pts.push({ x: cx(c), z: cz(r), y: n * FH, n });
    });
    // pull the string tight along each stretch of one floor (the stair points stay)
    const out = [];
    for (let i = 0; i < pts.length; ) {
      out.push(pts[i]);
      if (pts[i].st) {
        i++;
        continue;
      }
      let best = i + 1;
      for (let k = i + 2; k < pts.length && !pts[k].st && pts[k].n === pts[i].n; k++) lineClear(pts[i].n, pts[i].x, pts[i].z, pts[k].x, pts[k].z) && (best = k);
      i = best;
    }
    const last = out[out.length - 1];
    if (last && !last.st && Math.hypot(goal.x - last.x, goal.z - last.z) > 0.3 && lineClear(goal.n, last.x, last.z, goal.x, goal.z)) out.push({ x: goal.x, z: goal.z, y: goal.n * FH, n: goal.n });
    return out;
  }
  // where a bot starts from: its own cell, or, midway up a stair, the end it is nearer to
  function startOf(e) {
    const g = graph(),
      y = e.y || 0,
      n = Math.max(0, Math.min(2, Math.floor((y + 0.3) / FH))),
      c = colOf(e.pos.x),
      r = rowOf(e.pos.z);
    if ("s" === zone(n, c, r)) {
      for (const [from, sc, sr] of P.stairs)
        if (from === n && c >= sc && c <= sc + 1 && r >= sr - 3 && r <= sr) {
          const w = Math.max(0, Math.min(1, c - sc));
          return y - n * FH >= FH / 2 ? { id: idOf(n + 1, sc + w, sr - 4) } : { id: idOf(n, sc + w, sr + 1) };
        }
    }
    const id = nearest(n, e.pos.x, e.pos.z);
    return id < 0 ? null : { id };
  }
  function pathTo(e, tx, tz, gl) {
    const a = startOf(e),
      b = nearest(gl, tx, tz);
    if (!a || b < 0) return null;
    return route(a, { id: b, x: tx, z: tz, n: gl });
  }

  // ── bots: follow the path, steer straight on the stairs ──
  const goalLv = (ai, x, z) => (ai._gl && Math.hypot(ai._gl.x - x, ai._gl.z - z) < 0.6 ? ai._gl.lv : 0);
  const _nav = navNext;
  navNext = function (e, tx, tz, dt) {
    const ai = e.ai;
    if (!on() || !ai) return _nav.apply(this, arguments);
    const gl = goalLv(ai, tx, tz);
    if (!ai._hp && 0 === lvOf(e.y || 0) && 0 === gl) return _nav.apply(this, arguments);
    let h = ai._hp;
    h && (h.cd -= dt);
    if (!h || h.gl !== gl || Math.hypot(h.gx - tx, h.gz - tz) > 6 || h.cd <= 0) {
      if (PATH_BUDGET.n <= 0 && h) h.cd = 0.1;
      else if (PATH_BUDGET.n <= 0) return { x: tx, z: tz };
      else {
        PATH_BUDGET.n--;
        ai._hp = h = { gx: tx, gz: tz, gl, wps: pathTo(e, tx, tz, gl) || [], i: 0, cd: 2.2 + 1.4 * Math.random(), stair: false };
      }
    }
    const w = h.wps;
    while (h.i < w.length) {
      const p = w[h.i];
      if (Math.hypot(p.x - e.pos.x, p.z - e.pos.z) < (p.st ? 1.2 : 1.7) && Math.abs(p.y - (e.y || 0)) < (p.st ? 0.9 : 1.4)) h.i++;
      else break;
    }
    if (h.i >= w.length) {
      h.stair = false;
      // home on the ground again: the engine's paths take over
      if (0 === gl && 0 === lvOf(e.y || 0)) {
        ai._hp = null;
        return _nav.apply(this, arguments);
      }
      return { x: tx, z: tz };
    }
    h.stair = !!w[h.i].st;
    return { x: w[h.i].x, z: w[h.i].z };
  };
  // the fan of probes reads the next step as a wall: on a stair (or in the air) turn straight at the point
  const _steer = steerToward;
  steerToward = function (e, tx, tz, dt, turn) {
    // on a post the bot is already where it is going: the engine's turn toward that very point only jitters
    if (e.ai && e.ai._hold && on()) return 0;
    const h = e.ai && e.ai._hp,
      f = (e.y || 0) % FH;
    if (!on() || !h || !(h.stair || (f > 0.25 && f < FH - 0.25))) return _steer.apply(this, arguments);
    const want = Math.atan2(-(tx - e.pos.x), -(tz - e.pos.z)),
      d = ((want - e.yaw + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
    e.yaw += clamp(d, -turn * dt, turn * dt);
    return Math.abs(d);
  };

  // where an enemy was seen is also a floor
  const _ir = intelReport,
    _io = intelOnHit,
    _in = intelNearest,
    _sw = "function" == typeof sweepTarget ? sweepTarget : null;
  const tag = (e, t) => {
    try {
      const m = TEAM_INTEL[e.team].get(t.id);
      m && (m.lv = lvOf(t.y || 0));
    } catch (x) {}
  };
  intelReport = function (e, t) {
    const r = _ir.apply(this, arguments);
    tag(e, t);
    return r;
  };
  intelOnHit = function (e, t) {
    const r = _io.apply(this, arguments);
    t && t.pos && tag(e, t);
    return r;
  };
  intelNearest = function (e) {
    const o = _in.apply(this, arguments);
    if (o && e.ai && on()) {
      const m = TEAM_INTEL[e.team].get(o.id);
      e.ai._gl = { x: o.x, z: o.z, lv: (m && m.lv) || 0 };
    }
    return o;
  };
  _sw &&
    (sweepTarget = function (e) {
      const o = _sw.apply(this, arguments);
      o && e.ai && on() && (e.ai._gl = { x: o.e.pos.x, z: o.e.pos.z, lv: lvOf(o.e.y || 0) });
      return o;
    });

  // ── posts: a share of the bots take the ring round the atrium or the bridge ──
  // regions [floor, first column, last column, first row, last row]: the ring is one floor up and looks down
  // on the atrium; a post is a free cell nobody else has taken, picked in a region
  const RINGS = [[1, 16, 17, 13, 22], [1, 30, 31, 13, 22], [1, 18, 29, 24, 25]];
  const BRIDGE = [[2, 19, 28, 17, 18]];
  const used = { round: -1, set: new Set() };
  const look = (x, z) => Math.atan2(-(cx(24) - x), -(cz(17) - z));
  function cellsOf(reg) {
    const g = graph(),
      [n, c0, c1, r0, r1] = reg,
      out = [];
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) g.free[idOf(n, c, r)] && g.reach[idOf(n, c, r)] && out.push([n, c, r]);
    return out;
  }
  const SETTINGS_ = { posts: true };
  function pickPost(e) {
    if (e.hasSpike || !SETTINGS_.posts) return null;
    const atk = "atk" === e.team,
      r = Math.random();
    const pool = r < (atk ? 0.1 : 0.14) ? BRIDGE : r < (atk ? 0.5 : 0.48) ? RINGS : null;
    if (!pool) return null;
    used.round !== world.round && ((used.round = world.round), used.set.clear());
    const cells = cellsOf(pool[Math.floor(Math.random() * pool.length)]).filter(([n, c, rr]) => !used.set.has(idOf(n, c, rr)));
    if (!cells.length) return null;
    const [n, c, rr] = cells[Math.floor(Math.random() * cells.length)];
    used.set.add(idOf(n, c, rr));
    const x = cx(c) + (Math.random() - 0.5) * 0.8,
      z = cz(rr) + (Math.random() - 0.5) * 0.8;
    return { lv: n, x, z, look: look(x, z), dwell: atk ? 5 + 5 * Math.random() : 1e9, born: -1, t: -1, done: false };
  }
  function postOf(e, ai) {
    if (window.room && room.mode && "std" !== room.mode) return null;
    let s = ai._hs;
    if (void 0 === s) s = ai._hs = pickPost(e);
    if (!s || s.done) return (ai._hold = false), null;
    const sp = world.spike;
    if ("planted" === sp.state || ("atk" === e.team && ("dropped" === sp.state || e.hasSpike)) || ("def" === e.team && ai.alertT > 0)) {
      s.done = true;
      ai._hold = false;
      return null;
    }
    if ("live" !== world.phase) return null;
    // time is the bot's own clock (its think steps), so a fast replay and a slow machine agree
    const clk = ai._clk || 0;
    s.born < 0 && (s.born = clk);
    const near = Math.hypot(s.x - e.pos.x, s.z - e.pos.z) < 3 && lvOf(e.y || 0) === s.lv;
    if (near) {
      s.t < 0 && (s.t = clk);
      ai._hold = true;
      ai._look = s.look;
      clk - s.t > s.dwell && ((s.done = true), (ai._hold = false));
    } else {
      ai._hold = false;
      // not there after 80 s: give the post up rather than walk into the same wall for the whole round
      clk - s.born > 80 && (s.done = true);
    }
    return s.done ? null : s;
  }
  const _goal = aiGoal;
  aiGoal = function (e) {
    const g = _goal.apply(this, arguments),
      ai = e.ai;
    if (!on() || !g || !ai) return g;
    const s = postOf(e, ai),
      out = s ? { x: s.x, z: s.z } : g;
    ai._gl = { x: out.x, z: out.z, lv: s ? s.lv : 0 };
    return out;
  };
  // on a post the bot stands and looks across the atrium
  const _think = aiThink;
  aiThink = function (e, t) {
    e.ai && (e.ai._clk = (e.ai._clk || 0) + t);
    const r = _think.apply(this, arguments),
      ai = e.ai;
    if (ai && ai._hold && e.alive && "advance" === ai.state && on()) {
      e.input.mv = [0, 0];
      ai.stuck = 0;
      ai.detour = null;
      const d = (((ai._look || 0) - e.yaw + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
      e.yaw += clamp(d, -2 * t, 2 * t);
    }
    return r;
  };

  // ── the minimap: the floor you stand on ──
  const FLOOR = [null, null, null];
  function floorImage(n) {
    if (FLOOR[n]) return FLOOR[n];
    const cv = document.createElement("canvas");
    cv.width = mini.width;
    cv.height = mini.height;
    const x = cv.getContext("2d"),
      b = MAP.bounds,
      sx = cv.width / (b.maxX - b.minX),
      sz = cv.height / (b.maxZ - b.minZ),
      X = (v) => (v - b.minX) * sx,
      Z = (v) => (v - b.minZ) * sz;
    // the rooms, lighter than the void; the atrium's hole and the stair wells left dark
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++) {
        const z = zone(n, c, r);
        if (" " === z || "0" === z || "9" === z || (0 === n && "x" === z)) continue;
        x.fillStyle = "s" === z ? "#33445c" : "t" === z ? "#1c2531" : "#1a2230";
        x.fillRect(X(ex(c)), Z(ez(r)), (ex(c + 1) - ex(c)) * sx + 0.6, (ez(r + 1) - ez(r)) * sz + 0.6);
      }
    // the stairs: steps drawn across the run, an arrow at the end that goes up
    for (const [from, c, r] of P.stairs) {
      if (from !== n) continue;
      x.strokeStyle = "#5d7391";
      x.lineWidth = 1;
      for (let s = 0; s <= 8; s++) {
        const zz = ez(r + 1) - 1.25 * s;
        x.beginPath();
        x.moveTo(X(ex(c)), Z(zz));
        x.lineTo(X(ex(c + 2)), Z(zz));
        x.stroke();
      }
      x.fillStyle = "#9fb6d4";
      x.font = "bold 13px Orbitron, sans-serif";
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillText("▲", X(ex(c + 1)), Z(ez(r - 1)));
    }
    for (const [from, c, r] of P.stairs) {
      if (from + 1 !== n) continue;
      x.fillStyle = "#6c83a3";
      x.font = "bold 12px Orbitron, sans-serif";
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillText("▼", X(ex(c + 1)), Z(ez(r - 4) + CELL / 2));
    }
    // the walls, then the low rails and fences thinner
    const line = (dir, nn, kinds, w, col) => {
      x.strokeStyle = col;
      x.lineWidth = w;
      x.beginPath();
      const lines = "H" === dir ? R + 1 : C + 1,
        len = "H" === dir ? C : R;
      for (let l = 0; l < lines; l++)
        for (let i = 0; i < len; i++) {
          const k = "H" === dir ? wallH(nn, l, i) : wallV(nn, i, l);
          if (!kinds.includes(k)) continue;
          if ("H" === dir) (x.moveTo(X(ex(i)), Z(ez(l))), x.lineTo(X(ex(i + 1)), Z(ez(l))));
          else (x.moveTo(X(ex(l)), Z(ez(i))), x.lineTo(X(ex(l)), Z(ez(i + 1))));
        }
      x.stroke();
    };
    for (const d of ["H", "V"]) (line(d, n, [2, 3, 4], 1.2, "#4a5b73"), line(d, n, [1], 2.6, "#8195b0"));
    return (FLOOR[n] = cv);
  }
  const viewLv = () => lvOf((player && player.y) || 0);
  const _mw = drawMiniWalls;
  drawMiniWalls = function () {
    if (!on()) return _mw.apply(this, arguments);
    mctx.drawImage(floorImage(viewLv()), 0, 0);
  };
  const _dm = drawMini;
  drawMini = function () {
    if (!on()) return _dm.apply(this, arguments);
    const n = viewLv(), r = _dm.apply(this, arguments);
    // the floor and the room in the dark strip under the building (the lot), where nothing else is drawn
    mctx.save();
    mctx.fillStyle = "rgba(255,255,255,.6)";
    mctx.font = "bold 26px Orbitron, sans-serif";
    mctx.textAlign = "right";
    mctx.textBaseline = "alphabetic";
    mctx.fillText(n + 1 + "F", mini.width - 10, mini.height - 10);
    mctx.fillStyle = "rgba(159,179,200,.85)";
    mctx.font = "bold 19px 'Noto Sans KR', sans-serif";
    mctx.textAlign = "left";
    mctx.fillText(roomName(n), 10, mini.height - 10);
    mctx.restore();
    return r;
  };

  // ── the room you stand in ──
  const NAME = { h: "복도", w: "병동", o: "수술실", i: "중환자실", p: "약제실", a: "아트리움", l: "로비", e: "응급실", d: "하역장", s: "계단", t: "옥상 데크", b: "구름다리", x: "주차장", 0: "아트리움", 9: "계단" };
  const roomName = (n) => NAME[zone(n, colOf(player.pos.x), rowOf(player.pos.z))] || "건물 밖";
  const whereTag = () => viewLv() + 1 + "층 · " + roomName(viewLv());

  // ── the round tactical map: only the walls on your floor, not the slabs and the floors above and below ──
  let slice = { n: -1, len: -1, list: [] };
  const onFloor = (n) => {
    if (slice.n !== n || slice.len !== COLLIDERS.length) {
      const y = n * FH;
      slice = { n, len: COLLIDERS.length, list: Array.prototype.filter.call(COLLIDERS, (c) => (c.y0 || 0) < y + 2 && c.h > y + STEP_H) };
    }
    return slice.list;
  };
  // the engine paints the map's walls once into one picture and draws that; in the hospital the picture is made for the
  // floor you stand on (the same look, the colliders of that floor only) and kept for each floor
  const _dw = "function" == typeof drawTacWalls ? drawTacWalls : null;
  const TACF = [null, null, null];
  _dw &&
    (drawTacWalls = function (r, s) {
      if (!on()) return _dw.apply(this, arguments);
      const n = viewLv(),
        list = onFloor(n),
        B = MAP.bounds,
        sig = CUR_MAP_KEY + ":" + COLLIDERS.length + ":" + list.length;
      let P = TACF[n];
      if (!P || P.sig !== sig) {
        const k = TACW.k,
          w = Math.ceil((B.maxX - B.minX + 8) * k),
          h = Math.ceil((B.maxZ - B.minZ + 8) * k);
        P = TACF[n] = { cv: (P && P.cv) || document.createElement("canvas"), sig, minX: B.minX - 4, minZ: B.minZ - 4, w: w / k, h: h / k };
        P.cv.width = w;
        P.cv.height = h;
        const g = P.cv.getContext("2d");
        for (const c of list) {
          g.fillStyle = c.h > STEP_H ? "rgba(86,100,120,.85)" : "rgba(70,82,98,.5)";
          g.fillRect((c.minX - P.minX) * k, (c.minZ - P.minZ) * k, (c.maxX - c.minX) * k, (c.maxZ - c.minZ) * k);
        }
      }
      tctx.drawImage(P.cv, r(P.minX), s(P.minZ), r(P.w), s(P.h));
    });

  // a new map, a new graph
  const _lm = loadMap;
  loadMap = function () {
    GR = null;
    FLOOR[0] = FLOOR[1] = FLOOR[2] = null;
    const r = _lm.apply(this, arguments);
    GR = null;
    return r;
  };
  window.HOSPITAL_NAV = { opts: SETTINGS_, graph, route: pathTo, startOf, nearest, floorImage, posts: { RINGS, BRIDGE }, tacFloor: (n) => TACF[n] && TACF[n].cv, cellsOf, zone, lvOf, tag: whereTag };
})();

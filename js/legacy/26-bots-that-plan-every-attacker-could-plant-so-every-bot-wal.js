
(() => {
  // Bots that plan. Every attacker could plant, so every bot walked to the
  // site nearest its first spawn (almost always A) and stopped shooting near
  // it. Now each round the host draws up a plan for each side:
  //  · attack: pick a site from what worked or failed before, then rush it,
  //    split (two bots hold near another site and join late) or play a slow
  //    default and collapse. Rotate mid-round if the site is stacked or two
  //    teammates die there. One bot is the planter; the rest fight.
  //  · defence: a different spread each round (2-2-1, 3-1-1 …) with a flex
  //    in the middle; when attackers show up at a site, help rotates there.
  // Human players on the attacking side get a one-line callout of the plan.
  const respawnMode = () => !!(window.GAME_MODES && GAME_MODES[room.mode] && GAME_MODES[room.mode].respawn);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const lerp = (a, b, f) => ({ x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f });
  function snap(p) {
    try {
      const cx = Math.max(0, Math.min(GRID.cols - 1, Math.floor((p.x - GRID.minX) / GRID.cell))),
        cz = Math.max(0, Math.min(GRID.rows - 1, Math.floor((p.z - GRID.minZ) / GRID.cell))),
        [nx, nz] = nearestWalkable(cx, cz);
      return cellCenter(nx, nz);
    } catch (e) {
      return { x: p.x, z: p.z };
    }
  }
  const around = (s, k) => snap({ x: s.x + rnd(-k, k), z: s.z + rnd(-k, k) });

  const PLAN = {
    on: !1,
    t: 0,
    target: null,
    kind: "",
    role: new Map(), // id → "main" | "side"
    hold: new Map(), // id → waypoint before the collapse
    spot: new Map(), // id → where on the site to go
    def: new Map(), // defender id → holding spot
    defSite: new Map(), // defender id → site
    collapseT: 0,
    rotated: !1,
    deaths: 0,
    planter: null,
    hist: [],
    defHelped: new Set(),
    callout: "",
  };
  window.AIPLAN = PLAN;

  function chooseSite() {
    const S = MAP.sites,
      last = PLAN.hist[PLAN.hist.length - 1],
      prev = PLAN.hist[PLAN.hist.length - 2];
    const w = S.map((s) => {
      let v = 1;
      if (last && last.site === s.id) v *= last.won ? 1.35 : 0.4;
      if (last && prev && last.site === s.id && prev.site === s.id) v *= 0.45;
      return v;
    });
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < S.length; i++) if ((r -= w[i]) <= 0) return S[i];
    return S[S.length - 1];
  }
  const siteMid = () => {
    const S = MAP.sites;
    return snap({ x: S.reduce((a, s) => a + s.x, 0) / S.length, z: S.reduce((a, s) => a + s.z, 0) / S.length });
  };
  const bots = (team) => world.actors.filter((a) => a.team === team && isAI(a) && a.alive);

  function makePlan() {
    PLAN.on = !1;
    if (!isHost() || respawnMode() || !world.actors || !world.actors.length || !MAP.sites || !MAP.sites.length) return;
    const S = MAP.sites,
      atkSpawn = MAP.attackSpawn;
    PLAN.t = 0;
    PLAN.rotated = !1;
    PLAN.deaths = 0;
    PLAN.defHelped = new Set();
    PLAN.role.clear();
    PLAN.hold.clear();
    PLAN.spot.clear();
    PLAN.def.clear();
    PLAN.defSite.clear();
    PLAN.target = chooseSite();
    const others = S.filter((s) => s !== PLAN.target);
    const r = Math.random();
    PLAN.kind = S.length < 2 ? "rush" : r < 0.42 ? "rush" : r < 0.72 ? "split" : "default";
    PLAN.collapseT = "rush" === PLAN.kind ? 0 : "split" === PLAN.kind ? rnd(16, 24) : rnd(24, 34);
    // attackers
    const A = bots("atk").sort(() => Math.random() - 0.5);
    A.forEach((a, i) => {
      let role = "main";
      if ("split" === PLAN.kind && i < 2) role = "side";
      if ("default" === PLAN.kind && i < Math.min(3, A.length - 1)) role = "side";
      PLAN.role.set(a.id, role);
      PLAN.spot.set(a.id, around(PLAN.target, PLAN.target.r * 0.55));
      if ("side" === role) {
        // wait short of another site (split) or spread across the map (default)
        const s = "split" === PLAN.kind ? pick(others) : S[i % S.length];
        PLAN.hold.set(a.id, snap(lerp(atkSpawn, s, rnd(0.55, 0.7))));
      }
    });
    PLAN.planter = (A.find((a) => "main" === PLAN.role.get(a.id)) || A[0] || {}).id ?? null;
    // defenders: a different spread each round, one flex in the middle
    const D = bots("def").sort(() => Math.random() - 0.5),
      mid = siteMid();
    const order = S.slice().sort(() => Math.random() - 0.5);
    const counts = order.map(() => 0);
    const heavy = Math.random() < 0.45 ? 0 : -1; // sometimes stack one site
    D.forEach((a, i) => {
      if (i === D.length - 1 && D.length >= 4 && S.length === 2 && Math.random() < 0.7) {
        PLAN.def.set(a.id, mid);
        PLAN.defSite.set(a.id, null);
        return;
      }
      let k = i % order.length;
      heavy >= 0 && i === order.length && (k = heavy);
      counts[k]++;
      const s = order[k];
      PLAN.defSite.set(a.id, s);
      PLAN.def.set(a.id, around(s, s.r * 0.7));
    });
    const name = { rush: "러시", split: "스플릿", default: "기본 운영 후 합류" }[PLAN.kind];
    PLAN.callout = `작전: ${PLAN.target.id} ${name}`;
    PLAN.on = !0;
    for (const a of A) a._plantSite = PLAN.target;
  }

  // where each bot should head right now
  const _ag = aiGoal;
  aiGoal = function (e) {
    if (!PLAN.on || !e || !isAI(e) || respawnMode()) return _ag.apply(this, arguments);
    const sp = world.spike;
    if ("planted" === sp.state || "dropped" === sp.state) return _ag.apply(this, arguments);
    if ("atk" === e.team) {
      const role = PLAN.role.get(e.id);
      if (!role) return _ag.apply(this, arguments);
      if ("side" === role && PLAN.t < PLAN.collapseT && PLAN.hold.has(e.id)) return PLAN.hold.get(e.id);
      e._plantSite = PLAN.target;
      return PLAN.spot.get(e.id) || PLAN.target;
    }
    return PLAN.def.get(e.id) || _ag.apply(this, arguments);
  };

  // only the planter walks in with the spike as its priority; the rest fight
  const _at = aiThink;
  aiThink = function (e) {
    if (PLAN.on && e && "atk" === e.team && e.hasSpike && e.id !== PLAN.planter && "carried" === world.spike.state && !respawnMode()) {
      e.hasSpike = !1;
      try {
        return _at.apply(this, arguments);
      } finally {
        e.hasSpike = !0;
      }
    }
    return _at.apply(this, arguments);
  };

  function rotateTo(site, why) {
    if (!site || site === PLAN.target) return;
    PLAN.target = site;
    PLAN.rotated = !0;
    PLAN.collapseT = 0;
    for (const a of bots("atk")) {
      PLAN.role.set(a.id, "main");
      PLAN.spot.set(a.id, around(site, site.r * 0.55));
      a._plantSite = site;
      a.ai && Object.assign(a.ai, { path: [], pathIdx: 0, repathCd: 0 });
    }
    const any = world.actors.find((a) => "atk" === a.team);
    try {
      any && tellTeam(any, `작전 변경: ${site.id}로 이동 (${why})`, "#ffc849");
    } catch (e) {}
  }
  function tick(dt) {
    if (!PLAN.on || "live" !== world.phase) return;
    PLAN.t += dt;
    const sp = world.spike;
    // planter died: hand the job to another bot
    const planter = world.actors.find((a) => a.id === PLAN.planter);
    if (!planter || !planter.alive) {
      const main = bots("atk").filter((a) => "main" === PLAN.role.get(a.id));
      PLAN.planter = (main[0] || bots("atk")[0] || {}).id ?? null;
    }
    if ("carried" === sp.state && !PLAN.rotated && MAP.sites.length > 1) {
      const others = MAP.sites.filter((s) => s !== PLAN.target);
      // the site looks stacked: three defenders spotted on it early
      const intel = TEAM_INTEL && TEAM_INTEL.atk;
      if (intel && PLAN.t < 30) {
        let n = 0;
        for (const [, v] of intel) Math.hypot(v.x - PLAN.target.x, v.z - PLAN.target.z) < PLAN.target.r + 14 && n++;
        n >= 3 && rotateTo(pick(others), "수비 몰림");
      }
      // two of us died there without a plant
      !PLAN.rotated && PLAN.deaths >= 2 && bots("atk").length >= 2 && world.roundTime > 35 && rotateTo(pick(others), "진입 실패");
    }
    // defence: attackers spotted at a site pull the flex and one helper there
    const dIntel = TEAM_INTEL && TEAM_INTEL.def;
    if (dIntel && "carried" === sp.state)
      for (const s of MAP.sites) {
        if (PLAN.defHelped.has(s.id)) continue;
        let n = 0;
        for (const [, v] of dIntel) Math.hypot(v.x - s.x, v.z - s.z) < s.r + 18 && n++;
        if (n < 2) continue;
        PLAN.defHelped.add(s.id);
        const D = bots("def");
        const flex = D.filter((a) => null === PLAN.defSite.get(a.id));
        const others = D.filter((a) => PLAN.defSite.get(a.id) && PLAN.defSite.get(a.id) !== s);
        // keep one anchor on every other site
        const bySite = new Map();
        for (const a of others) {
          const k = PLAN.defSite.get(a.id).id;
          bySite.has(k) ? bySite.get(k).push(a) : bySite.set(k, [a]);
        }
        const helpers = [...flex];
        for (const [, list] of bySite) list.length > 1 && helpers.push(list[list.length - 1]);
        for (const a of helpers.slice(0, 2)) {
          PLAN.defSite.set(a.id, s);
          PLAN.def.set(a.id, around(s, s.r * 0.6));
          a.ai && Object.assign(a.ai, { path: [], pathIdx: 0, repathCd: 0 });
        }
      }
  }

  const _sr = startRound;
  startRound = function () {
    const r = _sr.apply(this, arguments);
    try {
      makePlan();
    } catch (e) {
      PLAN.on = !1;
      console.warn("aiplan", e);
    }
    return r;
  };
  const _er = endRound;
  endRound = function (winner) {
    const was = world.over;
    const r = _er.apply(this, arguments);
    try {
      if (!was && PLAN.on && PLAN.target) {
        PLAN.hist.push({ site: PLAN.target.id, won: "atk" === winner });
        PLAN.hist.length > 6 && PLAN.hist.shift();
      }
    } catch (e) {}
    return r;
  };
  const _ka = killActor;
  killActor = function (e) {
    const r = _ka.apply(this, arguments);
    try {
      PLAN.on && e && "atk" === e.team && PLAN.target && Math.hypot(e.pos.x - PLAN.target.x, e.pos.z - PLAN.target.z) < PLAN.target.r + 22 && PLAN.deaths++;
    } catch (x) {}
    return r;
  };
  let lastPhase = null;
  const _ns = netStep;
  netStep = function (dt) {
    const r = _ns.apply(this, arguments);
    try {
      if (isHost()) {
        tick(dt || 0.016);
        // tell the human attackers the plan when the round goes live
        if ("buy" === lastPhase && "live" === world.phase && PLAN.on && PLAN.callout) {
          const any = world.actors.find((a) => "atk" === a.team);
          any && tellTeam(any, PLAN.callout, "#7dd3fc");
          "host" === NET.mode && sendEventAll({ t: "aiplan", c: PLAN.callout });
        }
      }
      lastPhase = world.phase;
    } catch (e) {}
    return r;
  };
  // guests on the attacking side see the callout too
  const _oe = NET.onEvent;
  NET.onEvent = (e) => {
    if (e && "aiplan" === e.t) {
      try {
        const me = myActor();
        me && "atk" === me.team && bannerMe(e.c, "#7dd3fc");
      } catch (x) {}
      return;
    }
    return _oe(e);
  };
  const _lm = loadMap;
  loadMap = function () {
    PLAN.hist = [];
    PLAN.on = !1;
    return _lm.apply(this, arguments);
  };
})();

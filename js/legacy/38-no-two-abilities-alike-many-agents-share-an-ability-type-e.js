
(() => {
  // No two abilities alike. Many agents share an ability type; each copy now
  // has its own numbers (reach, how long it lasts, how hard it hits, cooldown,
  // charges) and the agent's own colour, and the description says how it
  // differs. Smokes also differ in kind: some slow, burn, heal, reveal, block
  // abilities or blur sight inside. The first agent with a type keeps it as is.
  // big steps: a copy is clearly bigger/smaller, longer/shorter, stronger/weaker
  const STEP_R = [1.5, 0.65, 1.6, 0.7, 1.4, 0.6, 1.55, 0.75],
    STEP_D = [0.6, 1.5, 0.7, 1.6, 0.65, 1.45, 1.55, 0.75],
    STEP_P = [1.45, 0.7, 0.6, 1.55, 1.4, 1.6, 0.65, 1.5],
    STEP_C = [-8, 6, -5, 9, -10, 5, 8, -6];
  // and one extra effect of its own, never the same twice within a type
  const near = (list, at, r) => list.filter((a) => a && a.alive && a.pos && Math.hypot(a.pos.x - at.x, a.pos.z - at.z) < r);
  const people = () => (world.actors && world.actors.length ? world.actors : world.entities || []);
  const foes = (c) => people().filter((a) => a.team !== c.team);
  const mates = (c) => people().filter((a) => a.team === c.team);
  const push = (a, at, d) => {
    const dx = a.pos.x - at.x,
      dz = a.pos.z - at.z,
      L = Math.hypot(dx, dz) || 1;
    for (let i = 1; i <= 8; i++) {
      const x = a.pos.x + ((dx / L) * d) / 8,
        z = a.pos.z + ((dz / L) * d) / 8;
      if (collideXZ(x, z, a.y || 0, 0.4)) break;
      a.pos.x = x;
      a.pos.z = z;
    }
  };
  const TW = [
    ["lifesteal", "쓰면 내 체력 20 회복", (c) => (c.hp = Math.min(100, c.hp + 20))],
    ["haste", "쓰면 3초간 이동 속도 +35%", (c) => { const b = c.speedBuff || 1; if (b >= 1.35) return; c.speedBuff = 1.35; setTimeout(() => c.speedBuff === 1.35 && (c.speedBuff = b), 3000); }],
    ["blast", "1초 뒤 조준 지점에 작은 폭발 (최대 35 피해)", (c, at) => setTimeout(() => withCaster(c, () => explode(at.x, at.z, 4.5, 35, 10, 0xffab40)), 1000)],
    ["mark", "조준 지점 반경 14m 적 4초간 위치 노출", (c, at) => near(foes(c), at, 14).forEach((a) => (a.revealed = Math.max(a.revealed || 0, 4)))],
    ["chill", "조준 지점 반경 9m 적 3초간 둔화", (c, at) => near(foes(c), at, 9).forEach((a) => ((a.slow = Math.min(a.slow || 1, 0.55)), (a.slowT = Math.max(a.slowT || 0, 3))))],
    ["dazzle", "조준 지점 반경 10m 적 3초간 시야 흐림", (c, at) => near(foes(c), at, 10).forEach((a) => statusOn(a, "nearsight", 3))],
    ["mend", "쓰면 주변 10m 아군 체력 25 회복", (c) => near(mates(c), c.pos, 10).forEach((a) => (a.hp = Math.min(100, a.hp + 25)))],
    ["plate", "쓰면 방어구 +25", (c) => (c.armor = Math.min(50, (c.armor || 0) + 25))],
    ["shove", "조준 지점 반경 7m 적을 4m 밀쳐냄", (c, at) => near(foes(c), at, 7).forEach((a) => push(a, at, 4))],
    ["pull", "조준 지점 반경 10m 적을 중심으로 3m 끌어당김", (c, at) => near(foes(c), at, 10).forEach((a) => push(a, at, -Math.min(3, Math.hypot(a.pos.x - at.x, a.pos.z - at.z))))],
    ["hush", "조준 지점 반경 8m 적 3초간 능력 봉쇄", (c, at) => near(foes(c), at, 8).forEach((a) => (a.silenced = Math.max(a.silenced || 0, 3)))],
    ["expose", "조준 지점 반경 9m 적 5초간 받는 피해 증가", (c, at) => near(foes(c), at, 9).forEach((a) => statusOn(a, "vuln", 5))],
    ["shake", "조준 지점 반경 9m 적 2초간 조준 흔들림", (c, at) => near(foes(c), at, 9).forEach((a) => statusOn(a, "concuss", 2))],
    ["cower", "조준 지점 반경 8m 적 2초간 강제로 앉음", (c, at) => near(foes(c), at, 8).forEach((a) => statusOn(a, "forceCrouch", 2))],
    ["thirst", "4초간 내가 준 피해의 일부를 체력으로 흡수", (c) => statusOn(c, "lifesteal", 4)],
    ["ward", "쓰고 0.8초간 무적", (c) => (c.invuln = Math.max(c.invuln || 0, 0.8))],
    ["ammo", "쓰면 지금 총 탄창 가득", (c) => { const k = typeof actorWeaponKey === "function" ? actorWeaponKey(c) : null; k && c.ammo && WEAPONS[k] && (c.ammo[k] = WEAPONS[k].mag); }],
    ["charge", "쓰면 궁극기 1점 충전", (c) => (c.ultCharge = Math.min(c.ultMax || 5, (c.ultCharge || 0) + 1))],
    ["hop", "쓰면 높이 뛰어오름", (c) => ((c.vy = Math.max(c.vy || 0, 7.5)), (c.onGround = !1))],
    ["sear", "조준 지점 반경 7m 적 즉시 15 피해", (c, at) => near(foes(c), at, 7).forEach((a) => withCaster(c, () => dealDamage(a, 15, !1, c)))],
    ["bind", "조준 지점에서 가장 가까운 적 1.2초 속박", (c, at) => { const f = near(foes(c), at, 10).sort((p, q) => Math.hypot(p.pos.x - at.x, p.pos.z - at.z) - Math.hypot(q.pos.x - at.x, q.pos.z - at.z))[0]; f && (f.root = Math.max(f.root || 0, 1.2)); }],
    ["refund", "40% 확률로 충전 1회 돌려받음", (c, at, v, d) => { if (Math.random() < 0.4) { const x = c.abilities && c.abilities.find((y) => y.def === d); x && !d.ult && (x.charges = Math.min((x.charges || 0) + 1, (d.charges || 1) + 1)); } }],
  ];
  const TWI = {};
  TW.forEach((t) => (TWI[t[0]] = t));
  // smoke kinds, by agent
  const SMOKE = {
    angae: { kind: "thick", col: 0xe0e6ea, r: 1.35, dur: 1.3, txt: "크고 오래가는 짙은 안개" },
    yakcho: { kind: "heal", col: 0x9ccc65, r: 0.9, dur: 1, txt: "안에 있는 아군 체력 회복 (초당 6)" },
    deonggul: { kind: "slow", col: 0x6d8b3a, r: 1, dur: 1, txt: "안에 들어온 적 둔화" },
    yeonkkot: { kind: "reveal", col: 0xf8bbd0, r: 0.85, dur: 0.9, txt: "꽃가루: 안에 들어온 적 위치 노출" },
    deungbul: { kind: "warm", col: 0xffcc80, r: 0.75, dur: 1.45, txt: "작지만 아주 오래가는 등불 연기" },
    unhae: { kind: "thick", col: 0xb0bec5, r: 1.5, dur: 0.85, txt: "아주 넓은 구름, 대신 짧게" },
    mukhyang: { kind: "blind", col: 0x2b2420, r: 1, dur: 1, txt: "먹물: 안에 들어온 적 시야 흐림" },
    jeongjeon: { kind: "silence", col: 0x37474f, r: 0.95, dur: 0.9, txt: "전파 차단: 안에 있는 적 능력 봉쇄" },
    morae: { kind: "slow", col: 0xd7b98a, r: 1.15, dur: 1, txt: "모래 먼지: 안에 들어온 적 둔화" },
    seori: { kind: "slow", col: 0xe1f5fe, r: 0.8, dur: 1.2, txt: "작지만 강하게 얼리는 서리" },
    hwasan: { kind: "burn", col: 0x8d6e63, r: 1, dur: 0.9, txt: "화산재: 안에 있는 적 초당 8 피해" },
  };
  const SMOKE_TYPES = new Set(["smoke", "smoke_fire", "smoke_ice", "sand_smoke"]);
  const num = (c) => (typeof c === "number" ? c : parseInt(String(c || "#ffffff").replace("#", ""), 16) || 0xffffff);
  const pct = (x) => (x > 1 ? "+" : "") + Math.round((x - 1) * 100) + "%";
  const seen = {}, TWU = {};
  for (const a of AGENTS)
    a.abilities.forEach((d, slot) => {
      const k = (seen[d.type] = (seen[d.type] || 0) + 1) - 1;
      if (!k) return; // the original keeps its numbers
      const i = (k - 1 + slot * 3 + a.id.length) % 8;
      const v = { r: STEP_R[i], dur: STEP_D[(i + k) % 8], pow: STEP_P[(i + 2 * k) % 8], col: num(a.color) };
      let th = 0;
      for (const ch of d.type) th = (th * 31 + ch.charCodeAt(0)) >>> 0;
      const usedTw = (TWU[d.type] = TWU[d.type] || new Set());
      for (let j = 0; j < TW.length; j++) {
        const id = TW[(th + k - 1 + j) % TW.length][0];
        if (usedTw.has(id) || (d.ult && (id === "refund" || id === "charge"))) continue;
        v.tw = id;
        break;
      }
      usedTw.add(v.tw);
      const sm = SMOKE_TYPES.has(d.type) && SMOKE[a.id];
      if (sm) Object.assign(v, { r: sm.r, dur: sm.dur, pow: 1, smoke: sm.kind, smokeCol: sm.col });
      d.v = v;
      const parts = [];
      Math.abs(v.r - 1) > 0.01 && parts.push("범위 " + pct(v.r));
      Math.abs(v.dur - 1) > 0.01 && parts.push("지속 " + pct(v.dur));
      Math.abs(v.pow - 1) > 0.01 && parts.push("위력 " + pct(v.pow));
      if (d.cd > 0) {
        const c = STEP_C[(i + k) % 8];
        d.cd = Math.max(6, d.cd + c);
        parts.push("재사용 " + d.cd + "초");
      } else if (!d.ult && (d.charges || 1) >= 2 && k % 3 === 1) {
        d.charges = d.charges - 1;
        parts.push("충전 " + d.charges + "회");
      } else if (!d.ult && (d.charges || 1) === 1 && k % 3 === 2) {
        d.charges = 2;
        parts.push("충전 2회");
      }
      if (d.ult && d.ult > 0) {
        d.ult = Math.max(4, Math.min(8, d.ult + (k % 2 ? 1 : -1)));
        parts.push("궁극기 " + d.ult + "점");
      }
      d.desc = String(d.desc || "") + (sm ? `\n· ${sm.txt}` : "") + `\n· 추가 효과: ${TWI[v.tw][1]}` + (parts.length ? `\n· ${parts.join(" · ")}` : "");
    });

  // ── applying the numbers while the ability runs ──
  let CUR = null;
  const tint = (c, v) => (v ? new T.Color(c).lerp(new T.Color(v.col), 0.55).getHex() : c);
  const _ca = castAbility;
  castAbility = function (type, def) {
    let d = def;
    if (!d || !d.v) {
      const ag = player && player.agent;
      d = (ag && ag.abilities && ag.abilities.find((x) => x.type === type)) || def;
    }
    const v = d && d.v;
    if (!v) return _ca.apply(this, arguments);
    const pr = CUR,
      r0 = window.AB_R,
      d0 = window.AB_D;
    CUR = v;
    window.AB_R = (r0 || 1) * v.r;
    window.AB_D = (d0 || 1) * v.r;
    let at = null;
    try {
      at = aimPoint(20);
    } catch (e) {}
    try {
      return _ca.apply(this, arguments);
    } finally {
      // the extra effect: decided on the host (or alone), seen by everyone
      try {
        const tw = v.tw && TWI[v.tw];
        if (tw && at && !window.__ABX_NOTW && !(typeof CAST_REFUND !== "undefined" && CAST_REFUND)) {
          "function" == typeof fxRing && fxRing(at.x, at.z, 3, v.col, 0.5);
          "client" !== NET.mode && player && player.alive && tw[2](player, at, v, d);
        }
      } catch (e) {}
      CUR = pr;
      window.AB_R = r0;
      window.AB_D = d0;
    }
  };
  // a projectile lands later: carry the numbers with it
  const _tp = throwProjectile;
  throwProjectile = function (col, speed, onHit) {
    const v = CUR;
    if (!v) return _tp.apply(this, arguments);
    return _tp.call(this, tint(col, v), speed, function () {
      const pr = CUR,
        r0 = window.AB_R;
      CUR = v;
      window.AB_R = (r0 || 1) * v.r;
      try {
        return onHit.apply(this, arguments);
      } finally {
        CUR = pr;
        window.AB_R = r0;
      }
    });
  };
  const _mz = makeZone;
  makeZone = function (x, z, r, h, dur, col, opts) {
    const v = CUR;
    if (!v) return _mz.apply(this, arguments);
    const o = opts ? Object.assign({}, opts) : opts;
    o && o.dps && (o.dps = Math.round(o.dps * v.pow));
    o && o.heal && (o.heal = Math.round(o.heal * v.pow));
    return _mz.call(this, x, z, r * v.r, h, dur * v.dur, tint(col, v), o);
  };
  const _ex = explode;
  explode = function (x, z, r, dmg, min, col) {
    const v = CUR;
    if (!v) return _ex.apply(this, arguments);
    return _ex.call(this, x, z, r * v.r, Math.round(dmg * v.pow), Math.round((min || 0) * v.pow), tint(col, v));
  };
  // smokes: size, time, colour, and what the cloud does
  const CLOUDS = [];
  const _ms = makeSmoke;
  makeSmoke = function (p, r, dur, col) {
    const v = CUR;
    if (!v) return _ms.apply(this, arguments);
    const s = _ms.call(this, p, r * v.r, dur * v.dur, v.smokeCol || tint(col, v));
    try {
      if (v.smoke && s) {
        CLOUDS.push({ x: s.x, z: s.z, r: s.r, until: performance.now() / 1000 + dur * v.dur, kind: v.smoke, team: player && player.team, by: player });
      }
    } catch (e) {}
    return s;
  };
  // what each kind of cloud does to whoever stands in it (on the host / solo)
  let acc = 0;
  const _st = step;
  step = function (dt) {
    const r = _st.apply(this, arguments);
    try {
      if (!CLOUDS.length || "client" === NET.mode) return r;
      acc += dt || 0;
      if (acc < 0.25) return r;
      const tick = acc;
      acc = 0;
      const now = performance.now() / 1000;
      for (let i = CLOUDS.length - 1; i >= 0; i--) {
        const c = CLOUDS[i];
        if (now > c.until) {
          CLOUDS.splice(i, 1);
          continue;
        }
        for (const a of world.actors && world.actors.length ? world.actors : world.entities || []) {
          if (!a || !a.alive || !a.pos || Math.hypot(a.pos.x - c.x, a.pos.z - c.z) > c.r) continue;
          const foe = a.team !== c.team;
          if (foe && "slow" === c.kind) (a.slow = Math.min(a.slow || 1, 0.6)), (a.slowT = Math.max(a.slowT || 0, 0.6));
          if (foe && "burn" === c.kind) withCaster(c.by, () => dealDamage(a, 8 * tick, !1, c.by));
          if (foe && "reveal" === c.kind) a.revealed = Math.max(a.revealed || 0, 2);
          if (foe && "silence" === c.kind) a.silenced = Math.max(a.silenced || 0, 0.6);
          if (foe && "blind" === c.kind) statusOn(a, "nearsight", 0.8);
          if (!foe && "heal" === c.kind) a.hp = Math.min(100, a.hp + 6 * tick);
        }
      }
    } catch (e) {}
    return r;
  };
  // the banner shows this agent's name for the ability, not the original's
  const NAMES = {};
  for (const a of AGENTS) for (const d of a.abilities) NAMES[d.type] || (NAMES[d.type] = d.name);
  const _bn = banner;
  banner = function (text) {
    try {
      if (CUR && player && player.agent) {
        const d = player.agent.abilities.find((x) => x.v === CUR);
        d && NAMES[d.type] === text && (arguments[0] = d.name);
      }
    } catch (e) {}
    return _bn.apply(this, arguments);
  };
  window.ABV = { CLOUDS, SMOKE };
})();

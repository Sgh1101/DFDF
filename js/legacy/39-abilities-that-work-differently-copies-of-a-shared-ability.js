
(() => {
  // Abilities that work differently. Copies of a shared ability type used to
  // differ only in numbers and one extra effect. Now every copy also has its
  // own way of being cast: a fan of three, a ring around you, a line, at your
  // feet, far away, aimed at the nearest enemy, behind you, cast twice, held
  // and then released stronger, or a rain of small ones. Movement abilities
  // dash twice, zig-zag, go backwards, leave a trail, land with a shockwave;
  // abilities used on yourself send out a pulse when used. Never the same way
  // twice within one type.
  // A cast is sent over the network once; every screen then plays the same
  // form (same def, same numbers), and only the host deals the damage.
  if ("undefined" == typeof castAbility || !window.ABV) return;
  const isClient = () => "undefined" != typeof NET && "client" === NET.mode;
  const CAT = {
    move: ["dash", "charge", "blink", "bolt_jump"],
    proj: ["nade", "proj_fire", "recon_dart", "flash", "pierce", "rift_wave"],
    single: ["drone", "decoy", "scout_swarm", "root", "mag_turret", "mag_anchor"],
    self: ["shield", "blood_drain", "ult_res", "ult_bell", "ult_emp", "ult_recon", "ult_fire", "ult_smash", "ult_snipe", "ult_lightning", "ult_mirror", "ult_undying"],
  };
  const catOf = (t) => {
    for (const k in CAT) if (CAT[k].includes(t)) return k;
    return "area";
  };
  // steps: y yaw offset, p pitch offset, D aim distance ×, R range ×, P power ×, t delay (s)
  const F = {
    fan: { n: "부채꼴", d: "세 방향으로 동시에 (각각 작게)", s: [{ y: -0.34, R: 0.7, P: 0.55 }, { R: 0.7, P: 0.55 }, { y: 0.34, R: 0.7, P: 0.55 }] },
    line: { n: "일렬", d: "앞으로 세 개가 줄지어", s: [{ D: 0.45, R: 0.6, P: 0.5 }, { D: 0.75, R: 0.6, P: 0.5, t: 0.15 }, { D: 1.05, R: 0.6, P: 0.5, t: 0.3 }] },
    ring: { n: "원진", d: "내 주위 네 방향에 작게", s: [0, 1, 2, 3].map((i) => ({ y: (i * Math.PI) / 2, D: 0.3, R: 0.55, P: 0.45 })) },
    feet: { n: "발밑", d: "내 발밑에 크고 강하게", s: [{ D: 0.05, R: 1.35, P: 1.25 }] },
    long: { n: "원거리", d: "두 배 멀리 (조금 작게)", s: [{ D: 2.1, R: 0.8, P: 0.9 }] },
    lock: { n: "자동 조준", d: "가장 가까운 적을 향해 자동으로", s: [{ lock: 1, R: 0.85 }] },
    back: { n: "후방", d: "내 뒤쪽으로 (퇴각용, 조금 크게)", s: [{ y: Math.PI, R: 1.15, P: 1.1 }] },
    echo: { n: "메아리", d: "2초 뒤 같은 곳에 한 번 더", s: [{ P: 0.75 }, { t: 2, P: 0.75, same: 1 }] },
    hold: { n: "충전", d: "1.2초 모았다가 훨씬 크고 강하게", s: [{ t: 1.2, R: 1.45, P: 1.7, same: 1 }] },
    rain: { n: "흩뿌리기", d: "작은 것 다섯 개가 흩어져 떨어짐", s: [-0.4, 0.25, -0.1, 0.4, 0.05].map((y, i) => ({ y, D: [0.7, 1.2, 0.95, 0.8, 1.1][i], R: 0.42, P: 0.35, t: i * 0.3 })) },
    burst: { n: "연사", d: "같은 방향으로 세 번 연달아", s: [0, 0.25, 0.5].map((t) => ({ t, P: 0.5, R: 0.8 })) },
    // movement
    double: { n: "이단", d: "0.45초 뒤 한 번 더 이어서", s: [{}, { t: 0.45, cur: 1 }] },
    zig: { n: "지그재그", d: "왼쪽 앞, 오른쪽 앞으로 꺾어서 두 번", s: [{ y: 0.65, D: 0.7 }, { y: -0.65, D: 0.7, t: 0.4, cur: 1 }] },
    retreat: { n: "후퇴", d: "뒤로 (거리 +30%)", s: [{ y: Math.PI, D: 1.3 }] },
    far: { n: "장거리", d: "거리 +70%", s: [{ D: 1.7 }] },
    shock: { n: "착지 충격", d: "도착하면 주변에 충격파 (최대 35 피해)", s: [{}], after: "shock" },
    trail: { n: "잔상", d: "떠난 자리에 불길 (초당 10 피해)", s: [{}], before: "trail" },
    soar: { n: "도약", d: "높이 뛰어오르며", s: [{ p: 0.35 }], pre: "hop" },
    // used on yourself: a pulse goes out
    nova: { n: "폭발", d: "쓰면 내 주위가 폭발 (최대 35 피해)", s: [{}], after: "nova" },
    haven: { n: "가호", d: "주변 아군 체력 30 · 방어구 25", s: [{}], after: "haven" },
    veil: { n: "연막", d: "내 자리에 연막", s: [{}], after: "veil" },
    rally: { n: "질주", d: "주변 아군 5초간 이동 속도 +30%", s: [{}], after: "rally" },
    sight: { n: "탐지", d: "30m 안 적 4초간 위치 노출", s: [{}], after: "sight" },
    frost: { n: "냉기", d: "주변 9m 적 3초간 둔화", s: [{}], after: "frost" },
    surge: { n: "순환", d: "다른 능력 재사용 대기가 바로 끝남", s: [{}], after: "surge" },
    leap: { n: "도약", d: "쓰면서 앞으로 뛰어오름", s: [{}], pre: "leap" },
  };
  const LIST = {
    area: ["fan", "line", "ring", "feet", "long", "lock", "back", "echo", "hold", "rain"],
    proj: ["fan", "ring", "lock", "back", "echo", "hold", "rain", "burst"],
    single: ["feet", "long", "lock", "back", "hold"],
    move: ["double", "zig", "retreat", "far", "shock", "trail", "soar"],
    self: ["nova", "haven", "veil", "rally", "sight", "frost", "surge", "leap"],
  };
  // mag_anchor is placed, then used again to come back: only one-shot forms
  const ONLY = { mag_anchor: ["long", "back", "lock"], decoy: ["long", "back", "lock"] };
  // helping abilities aim their auto-aim at the nearest teammate
  const ALLY = new Set(["heal"]);

  const seen = {};
  for (const a of AGENTS)
    a.abilities.forEach((d) => {
      const k = (seen[d.type] = (seen[d.type] || 0) + 1) - 1;
      if (!k || !d.v) return;
      let h = 7;
      for (const ch of d.type) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
      const list = ONLY[d.type] || LIST[catOf(d.type)];
      d.v.form = list[(h + k - 1) % list.length];
      const f = F[d.v.form];
      const fd = "lock" === d.v.form && ALLY.has(d.type) ? "가장 가까운 아군에게 자동으로" : f.d;
      d.desc = String(d.desc || "").replace(/\n· 추가 효과:/, `\n· 방식: ${f.n} — ${fd}\n· 추가 효과:`);
    });

  // ── the follow-ups ──
  const foes = (c) => (world.actors || []).filter((a) => a.alive && a !== c && (!c.team || a.team !== c.team || "dm" === (window.room && room.mode)));
  const mates = (c) => (world.actors || []).filter((a) => a.alive && a.team === c.team);
  const near = (list, x, z, r) => list.filter((a) => Math.hypot(a.pos.x - x, a.pos.z - z) <= r);
  const host = () => !isClient();
  const DO = {
    shock: (c, v) => explode(c.pos.x, c.pos.z, 5, 35, 10, v.col),
    nova: (c, v) => explode(c.pos.x, c.pos.z, 6, 35, 10, v.col),
    haven: (c, v) => {
      "function" == typeof fxRing && fxRing(c.pos.x, c.pos.z, 10, 0x66bb6a, 0.7);
      host() && near(mates(c), c.pos.x, c.pos.z, 10).forEach((a) => ((a.hp = Math.min(100, a.hp + 30)), (a.armor = Math.min(50, (a.armor || 0) + 25))));
    },
    veil: (c, v) => makeSmoke({ x: c.pos.x, z: c.pos.z }, 6, 8, v.col),
    rally: (c, v) => {
      "function" == typeof fxRing && fxRing(c.pos.x, c.pos.z, 12, 0xffd54f, 0.6);
      host() &&
        near(mates(c), c.pos.x, c.pos.z, 12).forEach((a) => {
          const b = a.speedBuff || 1;
          if (b >= 1.3) return;
          a.speedBuff = 1.3;
          setTimeout(() => a.speedBuff === 1.3 && (a.speedBuff = b), 5000);
        });
    },
    sight: (c, v) => {
      "function" == typeof fxRing && fxRing(c.pos.x, c.pos.z, 30, v.col, 0.9);
      host() && near(foes(c), c.pos.x, c.pos.z, 30).forEach((a) => (a.revealed = Math.max(a.revealed || 0, 4)));
    },
    frost: (c, v) => {
      "function" == typeof fxRing && fxRing(c.pos.x, c.pos.z, 9, 0x81d4fa, 0.6);
      host() && near(foes(c), c.pos.x, c.pos.z, 9).forEach((a) => ((a.slow = Math.min(a.slow || 1, 0.5)), (a.slowT = Math.max(a.slowT || 0, 3))));
    },
    surge: (c) => host() && (c.abilities || []).forEach((x) => x.def && !x.def.ult && (x.cd = 0)),
    trail: (c, v, at0) => makeZone(at0.x, at0.z, 4, 0.6, 4, v.col, { dps: 10, name: "잔상" }),
    hop: (c) => ((c.vy = Math.max(c.vy || 0, 8.5)), (c.onGround = !1)),
    leap: (c) => {
      c.vy = Math.max(c.vy || 0, 9);
      c.onGround = !1;
      const fx = -Math.sin(c.yaw),
        fz = -Math.cos(c.yaw);
      for (let i = 1; i <= 8; i++) {
        const x = c.pos.x + fx * 0.75,
          z = c.pos.z + fz * 0.75;
        if ("function" == typeof collideXZ && collideXZ(x, z, c.y || 0, 0.4)) break;
        c.pos.x = x;
        c.pos.z = z;
      }
    },
  };

  // ── casting in a form ──
  let SUB = 0; // inside a form: casts are not sent again
  const _se = sendEventAll;
  sendEventAll = function (m) {
    if (SUB && m && "cast" === m.t) return;
    return _se.apply(this, arguments);
  };
  window.__ABX_NOTW = !1;
  const nearestFoe = (c, ally) => {
    let best = null,
      bd = 45;
    for (const a of ally ? mates(c).filter((m) => m !== c) : foes(c)) {
      const dd = Math.hypot(a.pos.x - c.pos.x, a.pos.z - c.pos.z);
      dd < bd && ((bd = dd), (best = a));
    }
    return best;
  };
  // thrown things fall (gravity 17): the angle that lands at that distance
  let lockDist = 0;
  function lobPitch(speed, dist) {
    let best = 0,
      err = 1e9;
    for (let p = -0.4; p <= 1.2; p += 0.01) {
      let x = 0,
        y = 1.4,
        vx = speed * Math.cos(p),
        vy = speed * (Math.sin(p) + 0.12);
      for (let t = 0; t < 4 && y > 0.2; t += 1 / 60) (vy -= 17 / 60), (x += vx / 60), (y += vy / 60);
      const e = Math.abs(x - dist);
      e < err && ((err = e), (best = p));
    }
    return best;
  }
  const _tp = throwProjectile;
  throwProjectile = function (col, speed) {
    if (lockDist && player) player.pitch = lobPitch(+speed || 20, lockDist);
    return _tp.apply(this, arguments);
  };
  function one(self, type, d, v, c, st, o, first) {
    const save = { yaw: c.yaw, pitch: c.pitch, x: c.pos.x, z: c.pos.z, y: c.y, v: d.v, R: window.AB_R, D: window.AB_D };
    try {
      if (o && !st.cur) {
        c.pos.x = o.x;
        c.pos.z = o.z;
        c.y = o.y;
      }
      c.yaw = (o ? o.yaw : c.yaw) + (st.y || 0);
      c.pitch = (o ? o.pitch : c.pitch) + (st.p || 0);
      if (st.lock) {
        const f = nearestFoe(c, ALLY.has(type));
        if (f) {
          const dist = Math.hypot(f.pos.x - c.pos.x, f.pos.z - c.pos.z);
          c.yaw = Math.atan2(-(f.pos.x - c.pos.x), -(f.pos.z - c.pos.z));
          // at the chest: aimed abilities stop on the body
          c.pitch = Math.atan2((f.y || 0) + 1.1 - ((c.y || 0) + 1.6), Math.max(1, dist));
          lockDist = dist;
        }
      }
      st.D && (window.AB_D = (window.AB_D || 1) * st.D);
      st.R && (window.AB_R = (window.AB_R || 1) * st.R);
      d.v = Object.assign({}, v, { pow: (v.pow || 1) * (st.P || 1), form: null });
      window.__ABX_NOTW = !first;
      SUB++;
      return withCaster(c, () => _ca.call(self, type, d));
    } finally {
      SUB--;
      lockDist = 0;
      window.__ABX_NOTW = !1;
      d.v = save.v;
      window.AB_R = save.R;
      window.AB_D = save.D;
      c.yaw = save.yaw;
      c.pitch = save.pitch;
      if (o && !st.cur) {
        // a later cast from where it was first used: the body stays where it is now
        c.pos.x = save.x;
        c.pos.z = save.z;
        c.y = save.y;
      }
    }
  }
  const _ca = castAbility;
  castAbility = function (type, def) {
    let d = def;
    if (!d || !d.v) {
      const ag = player && player.agent;
      d = (ag && ag.abilities && ag.abilities.find((x) => x.type === type)) || def;
    }
    const v = d && d.v,
      f = v && v.form && F[v.form];
    if (!f || SUB || window.ABX_OFF) return _ca.apply(this, arguments);
    const c = player,
      self = this;
    // one network message for the whole form, from where it was used
    if ("host" === NET.mode && c && null != c.id)
      _se({ t: "cast", a: c.id, ty: type, x: Q.pos(c.pos.x), y: Q.pos(c.y || 0), z: Q.pos(c.pos.z), yw: Q.ang(c.yaw || 0), pt: Q.ang(c.pitch || 0) });
    const o = { x: c.pos.x, z: c.pos.z, y: c.y, yaw: c.yaw, pitch: c.pitch };
    const round = world.round,
      at0 = { x: c.pos.x, z: c.pos.z };
    f.pre && DO[f.pre] && DO[f.pre](c, v);
    f.before && DO[f.before] && DO[f.before](c, v, at0);
    let ret,
      first = !0,
      failed = !1;
    for (const st of f.s) {
      const go = () => {
        if (failed || !c.alive || "menu" === world.phase || world.round !== round) return;
        const r = one(self, type, d, v, c, st, st.t ? o : null, first);
        first = !1;
        "undefined" != typeof CAST_REFUND && CAST_REFUND && (failed = !0);
        return r;
      };
      if (st.t) setTimeout(go, st.t * 1000);
      else {
        const r = go();
        void 0 === ret && (ret = r);
      }
    }
    if (f.after && DO[f.after]) {
      const last = Math.max(0, ...f.s.map((s) => s.t || 0));
      const run = () => !failed && c.alive && world.round === round && withCaster(c, () => DO[f.after](c, v));
      "shock" === f.after ? setTimeout(run, 350 + last * 1000) : last ? setTimeout(run, last * 1000) : run();
    }
    return ret;
  };
  // a cast message that arrives twice (a link that was redialled) plays once
  if ("function" == typeof replayCast) {
    const recent = new Map();
    const _rc = replayCast;
    replayCast = function (e) {
      const k = e ? [e.a, e.ty, e.x, e.y, e.z, e.yw, e.pt].join("|") : "";
      const now = performance.now();
      if (k && recent.has(k) && now - recent.get(k) < 500) return;
      recent.set(k, now);
      recent.size > 60 && recent.delete(recent.keys().next().value);
      return _rc.apply(this, arguments);
    };
  }
  window.ABX = { F, LIST, CAT, catOf };
})();

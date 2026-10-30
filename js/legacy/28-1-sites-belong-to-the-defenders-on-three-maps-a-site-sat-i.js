
(() => {
  // 1. Sites belong to the defenders. On three maps a site sat in the middle
  //    (Neon: both sites equally far from either spawn). Move those zones
  //    into the defender half, and move the bots' site waypoints with them.
  const MOVE = {
    neon: { A: { x: 70, z: -25, r: 13, label: "A 동관 광장" }, B: { x: 45, z: -68, r: 13, label: "B 북관 통로" } },
    freighter: { B: { x: 0, z: -60, r: 13 } },
    dunes: { C: { x: 0, z: -34, r: 12 } },
  };
  for (const k in MOVE) {
    const m = MAPS[k];
    if (!m || !m.sites) continue;
    for (const s of m.sites) {
      const to = MOVE[k][s.id];
      if (!to) continue;
      Object.assign(s, to);
      const n = m.nodes && m.nodes[s.id.toLowerCase() + "Site"];
      n && ((n.x = to.x), (n.z = to.z));
    }
  }
  try {
    MAPS[CUR_MAP_KEY] && MOVE[CUR_MAP_KEY] && "menu" === world.phase && loadMap(CUR_MAP_KEY);
  } catch (e) {}

  const $ = (id) => document.getElementById(id);
  const me = () => ("function" == typeof myActor && myActor()) || player;
  const modeDef = () => (window.GAME_MODES && typeof room != "undefined" && GAME_MODES[room.mode]) || {};
  const spikeMode = () => !modeDef().respawn;
  const carrierOf = (sp) => {
    if (sp.carrier && sp.carrier.pos) return sp.carrier;
    return (world.actors || world.entities || []).find((a) => a.alive && a.hasSpike) || null;
  };
  // where the spike is right now, and who may know it
  function spikeInfo() {
    const sp = world.spike,
      m = me();
    if (!sp || !m || !spikeMode() || !("live" === world.phase || "planted" === sp.state)) return null;
    if ("planted" === sp.state) {
      const s = siteAt(sp.x, sp.z) || MAP.sites.reduce((b, s) => (!b || Math.hypot(s.x - sp.x, s.z - sp.z) < Math.hypot(b.x - sp.x, b.z - sp.z) ? s : b), null);
      return { kind: "planted", x: sp.x, z: sp.z, site: s && s.id, all: !0 };
    }
    if ("atk" !== m.team) return null;
    if ("dropped" === sp.state) return { kind: "dropped", x: sp.x, z: sp.z };
    if ("carried" === sp.state) {
      const c = carrierOf(sp);
      if (c && c !== m) return { kind: "carried", x: c.pos.x, z: c.pos.z, who: c.name };
    }
    return null;
  }

  // 2. the spike box under the timer names the site and the distance, and a
  //    marker sits on the spike itself (at the screen edge when it is off
  //    screen or behind you, pointing the way)
  const _sui = spikeUI;
  spikeUI = function (txt) {
    try {
      const inf = spikeInfo(),
        m = me();
      if (inf && m && typeof txt == "string" && /^스파이크 (작동 중|낙하)/.test(txt)) {
        const d = Math.round(Math.hypot(inf.x - m.pos.x, inf.z - m.pos.z));
        const a = [...arguments];
        a[0] = inf.kind === "planted" ? txt.replace(/^스파이크 작동 중/, `${inf.site || "?"} 사이트 · 스파이크 작동 중`) + ` · ${d}m` : txt + ` · ${d}m`;
        return _sui.apply(this, a);
      }
    } catch (e) {}
    return _sui.apply(this, arguments);
  };
  const mark = document.createElement("div");
  mark.id = "spk-mark";
  mark.hidden = !0;
  mark.innerHTML = "<i></i><b></b>";
  ($("hud") || document.body).append(mark);
  const v = new THREE.Vector3(),
    fw = new THREE.Vector3();
  function paintHud() {
    const inf = spikeInfo(),
      m = me();
    const show = !!(inf && inf.kind !== "carried" && m);
    mark.hidden = !show;
    if (!show) return;
    const d = Math.round(Math.hypot(inf.x - m.pos.x, inf.z - m.pos.z));
    mark.classList.toggle("drop", inf.kind === "dropped");
    const W = innerWidth,
      H = innerHeight;
    v.set(inf.x, 0.9, inf.z).project(camera);
    let x = (v.x * 0.5 + 0.5) * W,
      y = (-v.y * 0.5 + 0.5) * H;
    const on = v.z < 1 && x > 40 && x < W - 40 && y > 90 && y < H - 170;
    if (!on) {
      // bearing from where the camera looks, placed on an ellipse
      camera.getWorldDirection(fw);
      const dx = inf.x - camera.position.x,
        dz = inf.z - camera.position.z;
      const f = fw.x * dx + fw.z * dz,
        r = -fw.z * dx + fw.x * dz;
      const ang = Math.atan2(r, f);
      x = W / 2 + Math.sin(ang) * W * 0.4;
      y = H / 2 - Math.cos(ang) * H * 0.3;
    }
    mark.style.transform = `translate(${x.toFixed(0)}px,${y.toFixed(0)}px)`;
    mark.classList.toggle("edge", !on);
    mark.lastChild.textContent = d + "m";
  }

  // 3. M: the whole map, north up, like the corner minimap but big
  const ov = document.createElement("div");
  ov.id = "bigmap";
  ov.hidden = !0;
  ov.innerHTML = '<div class="bm-card"><div class="bm-head"><b id="bm-name"></b><span id="bm-spk"></span><em id="bm-hint">M · 닫기</em></div><canvas id="bm-c" width="900" height="900"></canvas></div>';
  document.body.appendChild(ov);
  const cv = ov.querySelector("canvas"),
    g = cv.getContext("2d");
  const open = () => !ov.hidden;
  function toggle(on) {
    on = on === undefined ? ov.hidden : on;
    if (on && ("menu" === world.phase || !MAP || !MAP.bounds)) return;
    ov.hidden = !on;
    on && (($("bm-hint").textContent = document.body.classList.contains("touching") ? "화면을 누르면 닫힘" : KEYMAP.name("map") + " · 닫기"), draw());
  }
  window.toggleBigMap = toggle;
  addEventListener(
    "keydown",
    (e) => {
      if (!KEYMAP.is(e, "map") || e.repeat) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      // M used to switch touch controls; that lives in settings now
      e.stopImmediatePropagation();
      e.preventDefault();
      toggle();
    },
    !0
  );
  // and whatever path a key event takes, M never flips touch controls again
  const _ttm = toggleTouchMode;
  toggleTouchMode = function () {
    const ev = window.event;
    if (ev && "keydown" === ev.type && "m" === (ev.key || "").toLowerCase()) return;
    return _ttm.apply(this, arguments);
  };
  ov.addEventListener("click", () => toggle(!1));
  const mini = $("mini");
  if (mini) {
    mini.addEventListener("click", (e) => (e.stopPropagation(), toggle()));
    mini.addEventListener("touchend", (e) => (e.stopPropagation(), e.preventDefault(), toggle()), { passive: !1 });
  }

  function draw() {
    const b = MAP.bounds,
      m = me(),
      bw = b.maxX - b.minX,
      bh = b.maxZ - b.minZ;
    const S = Math.min(cv.width / bw, cv.height / bh),
      ox = (cv.width - bw * S) / 2,
      oz = (cv.height - bh * S) / 2;
    const X = (x) => ox + (x - b.minX) * S,
      Z = (z) => oz + (z - b.minZ) * S;
    g.clearRect(0, 0, cv.width, cv.height);
    g.fillStyle = "#0d1118";
    g.fillRect(ox, oz, bw * S, bh * S);
    for (const c of COLLIDERS) {
      g.fillStyle = c.h > STEP_H ? "#3a4658" : "#26303e";
      g.fillRect(X(c.minX), Z(c.minZ), (c.maxX - c.minX) * S, (c.maxZ - c.minZ) * S);
    }
    // high ground: decks you can stand on, and their stairs
    for (const w of MAP.walls || []) {
      if (!w.deck && !w.stair) continue;
      g.fillStyle = w.deck ? "rgba(255,200,73,.5)" : "rgba(255,200,73,.22)";
      g.fillRect(X(w.x - w.w / 2), Z(w.z - w.d / 2), w.w * S, w.d * S);
      if (w.deck) {
        g.strokeStyle = "rgba(255,200,73,.9)";
        g.lineWidth = 1.5;
        g.strokeRect(X(w.x - w.w / 2), Z(w.z - w.d / 2), w.w * S, w.d * S);
      }
    }
    // spawns
    const spn = (p, col, t) => {
      if (!p) return;
      g.fillStyle = col;
      g.globalAlpha = 0.18;
      g.beginPath();
      g.arc(X(p.x), Z(p.z), 14 * S, 0, 7);
      g.fill();
      g.globalAlpha = 1;
      g.font = "bold 15px 'Noto Sans KR', sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(t, X(p.x), Z(p.z));
    };
    spawnsOn() && (spn(MAP.attackSpawn, "#ff6b4a", "공격 시작"), spn(MAP.defendSpawn, "#38bdf8", "수비 시작"));
    const inf = spikeInfo();
    // sites
    if (spikeMode())
      for (const s of MAP.sites) {
        const hot = inf && inf.kind === "planted" && inf.site === s.id;
        g.fillStyle = hot ? "rgba(255,59,78,.22)" : "rgba(255,59,78,.08)";
        g.beginPath();
        g.arc(X(s.x), Z(s.z), s.r * S, 0, 7);
        g.fill();
        g.strokeStyle = hot ? "#ff3b4e" : "rgba(255,59,78,.6)";
        g.lineWidth = hot ? 3 : 2;
        g.stroke();
        g.fillStyle = "#ff5a69";
        g.font = "900 34px Orbitron, sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(s.id, X(s.x), Z(s.z) - 4);
        s.label &&
          ((g.font = "600 13px 'Noto Sans KR', sans-serif"), (g.fillStyle = "rgba(255,200,205,.8)"), g.fillText(s.label.replace(/^[A-C]\s*/, ""), X(s.x), Z(s.z) + 24));
      }
    // smokes
    g.fillStyle = "rgba(150,165,185,.35)";
    (world.smokes || []).forEach((s) => (g.beginPath(), g.arc(X(s.x), Z(s.z), s.r * S, 0, 7), g.fill()));
    // people: teammates like the minimap (dot, facing, name), enemies only
    // while revealed. Matches keep everyone in world.actors.
    const me0 = m || player;
    const crowd = world.actors && world.actors.length ? world.actors : world.entities || [];
    const holder = world.spike && "carried" === world.spike.state ? carrierOf(world.spike) : null;
    crowd.forEach((e) => {
      if (!e || !e.alive || e === me0 || !e.pos) return;
      const mate = me0 && e.team === me0.team && !M_ffa();
      if (!mate && !(e.revealed > 0)) return;
      const x = X(e.pos.x),
        z = Z(e.pos.z);
      if (mate) {
        g.save();
        g.translate(x, z);
        g.rotate(-(e.yaw || 0));
        g.fillStyle = CB.rgba("mapAlly", 0.22);
        g.beginPath();
        g.moveTo(0, 0);
        g.arc(0, 0, 34, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5);
        g.closePath();
        g.fill();
        g.fillStyle = CB.get("mapAlly");
        g.beginPath();
        g.moveTo(0, -10);
        g.lineTo(7, 7);
        g.lineTo(-7, 7);
        g.closePath();
        g.fill();
        g.restore();
        g.font = "600 12px 'Noto Sans KR', sans-serif";
        g.fillStyle = "rgba(220,255,230,.9)";
        g.textAlign = "center";
        g.textBaseline = "alphabetic";
        g.fillText((e === holder ? "◆ " : "") + (e.name || (e.agent && e.agent.name) || ""), x, z - 14);
      } else {
        g.fillStyle = CB.get("mapEnemy");
        CB.dot(g, x, z, 7, !0);
      }
    });
    // spike
    if (inf) {
      const x = X(inf.x),
        z = Z(inf.z),
        t = performance.now() / 1000;
      const col = inf.kind === "planted" ? "#ff3b4e" : "#ff9a3c";
      if (inf.kind === "planted") {
        const k = t % 1;
        g.strokeStyle = `rgba(255,59,78,${0.9 * (1 - k)})`;
        g.lineWidth = 3;
        g.beginPath();
        g.arc(x, z, 10 + 26 * k, 0, 7);
        g.stroke();
      }
      g.save();
      g.translate(x, z);
      g.rotate(Math.PI / 4);
      g.fillStyle = col;
      g.fillRect(-8, -8, 16, 16);
      g.strokeStyle = "#fff";
      g.lineWidth = 2;
      g.strokeRect(-8, -8, 16, 16);
      g.restore();
    }
    // me
    const P = me0;
    if (P && P.alive !== !1 && P.pos) {
      const x = X(P.pos.x),
        z = Z(P.pos.z);
      g.save();
      g.translate(x, z);
      g.rotate(-P.yaw);
      g.fillStyle = "rgba(255,255,255,.14)";
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, 70, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6);
      g.closePath();
      g.fill();
      g.fillStyle = "#fff";
      g.beginPath();
      g.moveTo(0, -12);
      g.lineTo(9, 9);
      g.lineTo(-9, 9);
      g.closePath();
      g.fill();
      g.restore();
    }
    $("bm-name").textContent = MAP.name || CUR_MAP_KEY || "";
    const sEl = $("bm-spk"),
      st = !inf ? "" : inf.kind === "planted" ? `스파이크: ${inf.site || "?"} 사이트에 설치됨` : inf.kind === "dropped" ? "스파이크: 떨어져 있음" : `스파이크: ${inf.who || "아군"} 소지`;
    sEl.textContent = st;
    sEl.className = inf ? inf.kind : "";
  }
  const M_ffa = () => !!modeDef().ffa;
  function spawnsOn() {
    return spikeMode();
  }

  let acc = 0;
  let lastT = performance.now();
  (function loop() {
    requestAnimationFrame(loop);
    const now = performance.now(),
      dt = (now - lastT) / 1000;
    lastT = now;
    try {
      if ("menu" === world.phase) {
        mark.hidden = !0;
        open() && toggle(!1);
        return;
      }
      paintHud();
      if (open() && (acc += dt) > 0.1) (acc = 0), draw();
    } catch (e) {}
  })();

  const st = document.createElement("style");
  st.textContent = `
#spk-mark[hidden]{display:none}
#spk-mark{position:fixed;left:0;top:0;margin:-14px 0 0 -11px;display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none;z-index:7}
#spk-mark i{width:16px;height:16px;transform:rotate(45deg);background:#ff3b4e;border:2px solid #fff;box-shadow:0 0 12px #ff3b4e;animation:spkp 1s infinite}
#spk-mark.drop i{background:#ff9a3c;box-shadow:0 0 12px #ff9a3c;animation:none}
#spk-mark b{font-size:10.5px;font-weight:700;color:#fff;text-shadow:0 1px 3px #000,0 0 6px #000}
#spk-mark.edge{opacity:.9}
#spk-mark.edge i{width:13px;height:13px}
@keyframes spkp{50%{box-shadow:0 0 22px 4px #ff3b4e}}
#bigmap{position:fixed;inset:0;z-index:60;display:grid;place-items:center;background:rgba(4,6,10,.55);backdrop-filter:blur(2px)}
#bigmap[hidden]{display:none}
#bigmap .bm-card{padding:12px;border-radius:16px;background:rgba(10,13,18,.92);border:1px solid var(--line,#2a3444);box-shadow:0 24px 60px -20px #000}
#bigmap .bm-head{display:flex;align-items:center;gap:12px;padding:0 4px 8px;color:#e8edf4;font-size:13px}
#bigmap .bm-head b{font-size:15px}
#bigmap .bm-head span{color:#ff9aa4;font-weight:700}
#bigmap .bm-head span.dropped,#bigmap .bm-head span.carried{color:#ffc27a}
#bigmap .bm-head em{margin-left:auto;font-style:normal;color:#5b6879;font-size:11px}
#bigmap canvas{display:block;width:min(86vh,92vw);height:min(86vh,92vw);max-height:calc(100vh - 70px);max-width:calc(100vh - 70px);border-radius:10px}
#hud #mini{pointer-events:auto;cursor:pointer}
`;
  document.head.appendChild(st);
})();

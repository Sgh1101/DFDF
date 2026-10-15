
(() => {
  // Change agent during a match from the pause menu. The switch happens right
  // away in the buy phase or while dead; mid-fight it waits for the next round
  // (or respawn). An agent a human teammate is playing is locked; if a bot
  // teammate has it, the two of you trade.
  const $ = (id) => document.getElementById(id);
  const inMatch = () => world.actors && world.actors.length > 0 && "menu" !== world.phase;
  const byKey = (k) => AGENTS.find((a) => a.key === k || a.id === k);

  function applyAgent(a, ag) {
    if (!a || !ag || a.agent === ag) return;
    try {
      a.ultW && endUltW(a);
    } catch (e) {}
    a.agent = ag;
    a.abilities = ag.abilities.map((d) => ({ def: d, cd: 0, charges: d.ult ? 0 : d.charges || 1 }));
    const u = ag.abilities.find((d) => d.ult);
    a.ultMax = u ? u.ult : 5;
    a.ultCharge = Math.min(a.ultCharge || 0, a.ultMax);
    const old = a.model;
    const m = buildFighter("atk" === (a._baseTeam || a.team) ? 16739146 : 3718648, ag);
    m.group.userData.actor = !0;
    scene.add(m.group);
    if (old && old.group) {
      m.group.position.copy(old.group.position);
      m.group.rotation.y = old.group.rotation.y;
      m.group.visible = old.group.visible;
      scene.remove(old.group);
      try {
        chDispose(old.group);
      } catch (e) {}
    }
    a.model = m;
    a.group = m.group;
    try {
      syncActorModel(a);
    } catch (e) {}
    if ("me" === a.ctrl) {
      document.documentElement.style.setProperty("--ac", ag.color);
      try {
        updateViewmodel(!0);
      } catch (e) {}
      $("skills") && ($("skills").dataset.key = "");
      try {
        paintTouchAbil();
      } catch (e) {}
    }
    rosterKey = "";
    // keep the lobby record in step so a rejoin gets the same agent
    try {
      for (const [, mem] of room.members) mem.actorId === a.id && (mem.agentKey = ag.key);
    } catch (e) {}
  }

  // host: validate, maybe trade with a bot, then apply now or queue
  function hostRequest(a, key) {
    const ag = byKey(key);
    if (!a || !ag || a.agent === ag) return "same";
    const mate = world.actors.find((o) => o !== a && o.agent === ag && (o._baseTeam || o.team) === (a._baseTeam || a.team));
    if (mate && !isAI(mate)) return "taken";
    a._pendingAgent = ag;
    a._tradeWith = mate || null;
    flush(a);
    return a._pendingAgent ? "queued" : "done";
  }
  function flush(a) {
    if (!a._pendingAgent) return;
    if (!("buy" === world.phase || !a.alive)) return;
    const ag = a._pendingAgent,
      prev = a.agent,
      mate = a._tradeWith;
    a._pendingAgent = null;
    a._tradeWith = null;
    // the bot may have been switched away meanwhile; only trade if it still holds it
    mate && mate.agent === ag && prev && (applyAgent(mate, prev), broadcast(mate));
    applyAgent(a, ag);
    broadcast(a);
    "me" === a.ctrl && banner(`${ag.name}(으)로 변경`, ag.color);
  }
  function broadcast(a) {
    "host" === NET.mode && sendEventAll({ t: "agentswap", id: a.id, key: a.agent.key });
  }

  const _ns = netStep;
  netStep = function () {
    const r = _ns.apply(this, arguments);
    try {
      if (isHost()) for (const a of world.actors) a._pendingAgent && flush(a);
    } catch (e) {}
    return r;
  };
  const _oa = NET.onAction;
  NET.onAction = (peer, msg) => {
    if (msg && "agent2" === msg.t) {
      const a = world.actors.find((o) => o.ctrl === peer),
        res = hostRequest(a, msg.key);
      sendEventTo(peer, { t: "agentres", res, key: msg.key });
      return;
    }
    return _oa(peer, msg);
  };
  const _oe = NET.onEvent;
  NET.onEvent = (e) => {
    if (e && "agentswap" === e.t) {
      const a = actorById(e.id),
        ag = byKey(e.key);
      a && ag && (applyAgent(a, ag), "me" === a.ctrl && banner(`${ag.name}(으)로 변경`, ag.color));
      return;
    }
    if (e && "agentres" === e.t) return void notify(e.res, byKey(e.key));
    return _oe(e);
  };
  function notify(res, ag) {
    if (!ag) return;
    "taken" === res
      ? banner("아군이 이미 쓰는 요원입니다", "#ff3b4e")
      : "queued" === res
        ? banner(`다음 라운드부터 ${ag.name}`, ag.color)
        : void 0;
  }
  function request(key) {
    const me = myActor();
    if (!me) return;
    if ("client" === NET.mode) return void sendAction({ t: "agent2", key });
    notify(hostRequest(me, key), byKey(key));
  }
  window.SWITCH_AGENT = request;

  // ── picker UI in the pause menu ──
  const btns = document.querySelector("#pause .pz-btns");
  if (!btns) return;
  const b = document.createElement("button");
  b.className = "btn";
  b.id = "pz-agent";
  b.textContent = "요원 변경";
  btns.insertBefore(b, $("pz-quit") || null);
  const ov = document.createElement("div");
  ov.id = "agent-swap";
  ov.hidden = !0;
  ov.innerHTML =
    '<div class="as-card"><div class="as-head"><b>요원 변경</b><button class="btn" id="as-close">닫기</button></div><div class="as-grid" id="as-grid"></div><p class="as-note">구매 단계나 쓰러져 있을 때는 바로 바뀝니다. 교전 중에 고르면 다음 라운드(부활)부터 바뀝니다. 아군이 쓰는 요원은 고를 수 없고, 아군 AI가 쓰고 있으면 서로 바꿉니다.</p></div>';
  document.body.appendChild(ov);
  const st = document.createElement("style");
  st.textContent = `
#pause.from-menu #pz-agent{display:none}
#agent-swap{position:fixed;inset:0;z-index:95;display:grid;place-items:center;background:rgba(5,7,10,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);padding:16px}
#agent-swap[hidden]{display:none}
.as-card{width:min(760px,100%);max-height:92vh;overflow:auto;padding:18px;border-radius:18px;border:1px solid rgba(255,255,255,.1);background:linear-gradient(180deg,rgba(24,29,38,.96),rgba(14,17,23,.96))}
.as-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.as-head b{font-size:17px;letter-spacing:.04em}
.as-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}
.as-a{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 6px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);cursor:pointer;color:var(--ink);font-family:inherit;transition:border-color .15s,background .15s}
.as-a:hover:not(:disabled){border-color:var(--ac);background:color-mix(in srgb,var(--ac) 14%,transparent)}
.as-a img{width:64px;height:78px;object-fit:cover;border-radius:8px}
.as-a b{font-size:12.5px}
.as-a small{font-size:10px;color:var(--steel)}
.as-a.cur{border-color:var(--ac);box-shadow:0 0 0 1px var(--ac) inset}
.as-a.pend::after{content:"다음 라운드";position:absolute;top:6px;right:6px;font-size:9px;padding:2px 5px;border-radius:6px;background:var(--gold);color:#111}
.as-a:disabled{opacity:.38;cursor:default}
.as-note{margin-top:12px;font-size:11.5px;line-height:1.6;color:var(--steel)}
@media (max-width:520px){.as-grid{grid-template-columns:repeat(4,1fr)}.as-a img{width:52px;height:64px}}`;
  document.head.appendChild(st);
  const PIC = {};
  function paint() {
    const me = myActor(),
      grid = $("as-grid");
    if (!me || !grid) return;
    const team = me._baseTeam || me.team;
    grid.innerHTML = "";
    for (const ag of AGENTS) {
      const holder = world.actors.find((o) => o !== me && o.agent === ag && (o._baseTeam || o.team) === team);
      const locked = holder && !isAI(holder);
      const el = document.createElement("button");
      el.className = "as-a" + (me.agent === ag ? " cur" : "") + (me._pendingAgent === ag ? " pend" : "");
      el.style.setProperty("--ac", ag.color);
      el.disabled = !!locked || me.agent === ag;
      PIC[ag.key] || (PIC[ag.key] = agentPortrait(ag, 120, 146));
      el.innerHTML = `<img src="${PIC[ag.key]}" alt=""><b>${ag.name}</b><small>${locked ? "아군 사용 중" : me.agent === ag ? "사용 중" : holder ? "AI와 교체" : ag.role}</small>`;
      el.onclick = () => {
        request(ag.key);
        ov.hidden = !0;
      };
      grid.appendChild(el);
    }
  }
  b.onclick = () => {
    if (!inMatch()) return;
    paint();
    ov.hidden = !1;
  };
  ov.addEventListener("click", (e) => {
    (e.target === ov || e.target.id === "as-close") && (ov.hidden = !0);
  });
  addEventListener(
    "keydown",
    (e) => {
      "Escape" === e.key && !ov.hidden && ((ov.hidden = !0), e.stopImmediatePropagation());
    },
    !0
  );
})();

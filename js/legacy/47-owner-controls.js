
(() => {
  // The owner account. Signing in with the owner's id (checked on the server,
  // with the master password) opens the whole admin panel: every cheat with no
  // limits, room-wide settings even as a guest, and a 플레이어 tab to set any
  // player's health, kill them, make them unkillable, pin them in place, give
  // or take back cheats, move them to the other team, kick or ban them.
  // The host runs everything; a guest owner is confirmed through the server
  // before the host takes orders from it.
  const X = window.HUNTX,
    A2 = window.ADMIN2,
    AC = window.ACCOUNT;
  if (!X || !A2 || !AC || "undefined" == typeof NET) return;
  const $ = (id) => document.getElementById(id);
  const E = X.E;
  const isClient = () => "client" === NET.mode;
  const sess = () => AC.session() || {};
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const OWN = { god: new Set(), bind: new Set() };

  // ── becoming the owner ──
  let was = !1;
  setInterval(() => {
    const on = !!window.IS_OWNER;
    if (on && !was) {
      window.ADMIN_GRANTED = !0;
      X.relock();
      addTab();
    }
    was = on;
    on && hello();
  }, 1000);

  // a guest owner says who it is; the host asks the server
  let helloKey = "", helloBusy = false, helloExp = 0;
  async function hello() {
    if (!isClient() || "open" !== NET.status || !sess().token) return;
    const k = NET.room + "|" + (NET.peer && NET.peer.id);
    if (helloBusy || (k === helloKey && Date.now() < helloExp - 60000)) return;
    helloBusy = true;
    try {
      const j = await AC.api("owner_ticket", { token: sess().token, room: NET.room, p: NET.peer.id });
      if (j.ticket && k === NET.room + "|" + (NET.peer && NET.peer.id) && isClient()) {
        sendAction({ t: "own-hi", ticket: j.ticket });
        helloKey = k;
        helloExp = j.exp;
      }
    } catch (e) { helloKey = ""; }
    finally { helloBusy = false; }
  }

  // ── host: what each op does ──
  const actorById = (id) => (world.actors || []).find((a) => String(a.id) === String(id));
  const memberName = (a) => (a && ((a.ctrl && room.members && room.members.get && room.members.get(a.ctrl) && room.members.get(a.ctrl).name) || a.name)) || "";
  // cheats given by name, so they survive a dropped and redialled link
  const GRANTN = new Set();
  setInterval(() => {
    if (isClient() || !GRANTN.size) return;
    for (const a of world.actors || []) {
      if (!a.ctrl || "me" === a.ctrl || "ai" === a.ctrl || X.GRANT.has(a.ctrl) || !GRANTN.has(memberName(a))) continue;
      X.GRANT.add(a.ctrl);
      sendEventTo(a.ctrl, { t: "own-grant", on: !0 });
    }
  }, 1000);
  function run(m, from) {
    const a = null != m.id ? actorById(m.id) : null;
    switch (m.op) {
      case "hp":
        a && a.alive && ((a._ownForce = 1), (a.hp = Math.max(1, Math.min(999, +m.v || 100))), (a._ownForce = 0));
        break;
      case "armor":
        a && a.alive && (a.armor = Math.max(0, Math.min(200, +m.v || 0)));
        break;
      case "kill":
        if (a && a.alive) {
          a._ownForce = 1;
          try {
            killActor(a, from || null);
          } finally {
            a._ownForce = 0;
          }
        }
        break;
      case "god":
        a && (m.v ? OWN.god.add(a.id) : OWN.god.delete(a.id));
        break;
      case "bind":
        a && (m.v ? OWN.bind.add(a.id) : (OWN.bind.delete(a.id), (a.root = 0)));
        break;
      case "cheat":
        if (!a || !a.ctrl || "me" === a.ctrl || "ai" === a.ctrl) break;
        if (m.v) X.GRANT.add(a.ctrl), GRANTN.add(memberName(a));
        else {
          GRANTN.delete(memberName(a));
          X.GRANT.delete(a.ctrl);
          X.OK.delete(a.ctrl);
          A2.PEERS.delete(a.ctrl);
          a._kit && a.agent && A2.setKit(a, a.agent);
        }
        sendEventTo(a.ctrl, { t: "own-grant", on: !!m.v });
        break;
      case "team":
        AC.runCmd({ cmd: "move", name: memberName(a), team: m.v });
        break;
      case "kick":
        a && "me" !== a.ctrl && AC.runCmd({ cmd: "kick", name: memberName(a) });
        break;
      case "msg":
        m.text && AC.runCmd({ cmd: "msg", text: String(m.text).slice(0, 120) });
        break;
      case "g": {
        const g = m.g || {};
        for (const k of ["run", "walk", "crouch", "jumpV", "gravity", "aiSpeed"]) null != g[k] && isFinite(g[k]) && (ADMIN[k] = +g[k]);
        null != g.freezeAI && (ADMIN.freezeAI = !!g.freezeAI);
        null != g.infAll && (A2.G.infAll = !!g.infAll);
        for (const k of ["roundT", "buyT", "matchT"]) null != g[k] && isFinite(g[k]) && (A2.G[k] = +g[k]);
        A2.afterChange();
        break;
      }
    }
  }
  const order = (m) => (isClient() ? sendAction(Object.assign({ t: "own" }, m)) : run(m, myActor && myActor()));

  // unkillable and pinned players, kept up by the host
  const _dd = dealDamage;
  dealDamage = function (e) {
    if (e && OWN.god.has(e.id) && "client" !== NET.mode) return;
    return _dd.apply(this, arguments);
  };
  const _st = step;
  step = function () {
    const r = _st.apply(this, arguments);
    if (OWN.bind.size && "client" !== NET.mode) for (const a of world.actors || []) OWN.bind.has(a.id) && a.alive && (a.root = Math.max(a.root || 0, 0.3));
    return r;
  };

  const ownerRequests = new Map(), ownerExpiry = new Map();
  const _goneOwner = NET.onPeerGone;
  NET.onPeerGone = function (peer) {
    X.OWNP.delete(peer); ownerExpiry.delete(peer); ownerRequests.delete(peer);
    return _goneOwner.apply(this, arguments);
  };
  const _shutdownOwner = netShutdown;
  netShutdown = function () {
    X.OWNP.clear(); ownerExpiry.clear(); ownerRequests.clear(); helloKey = ""; helloExp = 0;
    return _shutdownOwner.apply(this, arguments);
  };
  setInterval(() => {
    for (const [peer, exp] of ownerExpiry) if (Date.now() >= exp) { X.OWNP.delete(peer); ownerExpiry.delete(peer); }
  }, 1000);
  const _oa = NET.onAction;
  NET.onAction = (peer, msg) => {
    if (msg && "own-hi" === msg.t) {
      const scope = NET.room, host = NET.peer, conn = NET.conns.get(peer), channel = conn && conn.event, request = {};
      if (isClient() || !conn || !msg.ticket) return;
      ownerRequests.set(peer, request);
      AC.api("owner_check", { ticket: msg.ticket, room: scope, p: peer })
        .then((j) => {
          if (!j.owner || j.exp <= Date.now() || NET.room !== scope || NET.peer !== host || NET.conns.get(peer) !== conn || conn.event !== channel || ownerRequests.get(peer) !== request) return;
          X.OWNP.add(peer);
          ownerExpiry.set(peer, j.exp);
          sendEventTo(peer, { t: "own-ok" });
        })
        .catch(() => {});
      return;
    }
    if (msg && "own" === msg.t) {
      X.OWNP.has(peer) && ownerExpiry.get(peer) > Date.now() && run(msg, world.actors.find((a) => a.ctrl === peer));
      return;
    }
    return _oa(peer, msg);
  };
  const _oe = NET.onEvent;
  NET.onEvent = (e) => {
    if (e && "own-ok" === e.t) {
      OWNP_ME = !0;
      try {
        A2.afterChange();
      } catch (er) {}
      banner(E("운영자로 확인됨 · 방장이 명령을 받습니다", "Confirmed as owner · the host takes your orders"), "#ffc849");
      return;
    }
    if (e && "own-grant" === e.t) {
      X.HUNT.granted = !!e.on;
      if (e.on) {
        const again = X.HUNT.unlocked;
        X.HUNT.unlocked = !0;
        X.refresh(!0);
        try {
          A2.afterChange(); // tell the host my switches (again, after a redial)
        } catch (er) {}
        if (again) return;
        banner(E("운영자가 치트를 열어 주었습니다", "The owner gave you cheats"), "#ffc849");
      } else {
        X.relock();
        banner(E("운영자가 치트를 거두었습니다", "The owner took your cheats back"), "#8a97ab");
      }
      return;
    }
    return _oe(e);
  };
  let OWNP_ME = !1;

  // ── the panel ──
  let ON = !1; // the 플레이어 tab is showing
  let V1 = !1; // the 원래 관리자 tab (the very first panel) is showing
  let tabsEl = null;
  function addTab() {
    tabsEl = document.querySelector("#ad-panel .ad-tabs");
    if (!tabsEl || tabsEl.querySelector('[data-t="own"]')) return;
    const b = document.createElement("button");
    b.dataset.t = "own";
    b.innerHTML = E("플레이어 <small>운영자</small>", "Players <small>owner</small>");
    b.onclick = () => ((ON = !0), (V1 = !1), buildAdminUI());
    tabsEl.appendChild(b);
    if ("function" == typeof window.__ADMIN_V1) {
      const v = document.createElement("button");
      v.dataset.t = "v1";
      v.innerHTML = E("원래 관리자 <small>처음 그대로</small>", "Classic <small>original</small>");
      v.onclick = () => ((V1 = !0), (ON = !1), buildAdminUI());
      tabsEl.appendChild(v);
    }
    // any other tab closes this one (capture: before their own handlers)
    tabsEl.addEventListener("click", (e) => {
      const t = e.target.closest("button");
      t && ((ON = "own" === t.dataset.t), (V1 = "v1" === t.dataset.t));
    }, !0);
  }
  const _bui = buildAdminUI;
  buildAdminUI = function () {
    const r = _bui.apply(this, arguments);
    try {
      if (!window.IS_OWNER) return r;
      tabsEl = tabsEl || document.querySelector("#ad-panel .ad-tabs");
      if (tabsEl) {
        const me = tabsEl.querySelector('[data-t="me"]'),
          gl = tabsEl.querySelector('[data-t="global"]');
        me && (me.innerHTML = E("개인 설정 <small>나만</small>", "Personal <small>me</small>"));
        gl && (gl.innerHTML = E("전체 설정 <small>방 전체</small>", "Room <small>everyone</small>"));
      }
      if (ON) {
        tabsEl && tabsEl.querySelectorAll("button").forEach((b) => b.classList.toggle("on", "own" === b.dataset.t));
        renderPlayers(!0);
      } else if (V1) {
        tabsEl && tabsEl.querySelectorAll("button").forEach((b) => b.classList.toggle("on", "v1" === b.dataset.t));
        $("ad-panel").classList.remove("ad-locked");
        $("ad-presets").hidden = !1;
        window.__ADMIN_V1();
        const note = document.querySelector("#ad-panel .ad-note");
        note && (note.innerHTML = E("<b>처음 만든 관리자 모드 그대로</b> · 프리셋과 모든 수치. " + (isClient() ? "방장에게 보내 방 전체에 적용합니다." : "방 전체에 적용됩니다."), "<b>The original admin mode</b> · presets and every value. " + (isClient() ? "Sent to the host for the whole room." : "Applies to the whole room.")));
      } else if (isClient() && tabsEl && tabsEl.querySelector('[data-t="global"].on')) {
        // a guest owner can change the room too: the host gets the values
        $("ad-panel").classList.remove("ad-locked");
        document.querySelectorAll("#ad-grid input, #ad-toggles .ad-tg").forEach((x) => ((x.disabled = !1), x.classList.remove("locked")));
        const note = document.querySelector("#ad-panel .ad-note");
        note && (note.innerHTML = E("<b>운영자</b> · 방장에게 보내 방 전체에 적용합니다.", "<b>Owner</b> · sent to the host and applied to the whole room."));
      }
    } catch (e) {}
    return r;
  };
  // classic panel → the rebuilt panel's state, then out to the room
  let v1Dirty = 0;
  const v1Mark = (e) => V1 && window.IS_OWNER && e.target.closest && e.target.closest("#ad-presets, #ad-grid, #ad-toggles") && (v1Dirty = Date.now());
  document.addEventListener("input", v1Mark, !0);
  document.addEventListener("click", v1Mark, !0);
  setInterval(() => {
    if (!v1Dirty || Date.now() - v1Dirty < 200) return;
    v1Dirty = 0;
    try {
      for (const k of ["god", "oneShot", "infAmmo", "noRecoil", "fastFire"]) null != ADMIN[k] && k in A2.P && (A2.P[k] = ADMIN[k]);
      A2.G.infAll = !!ADMIN.infAbil;
      A2.afterChange();
      if (isClient()) {
        const g = {};
        for (const k of ["run", "walk", "crouch", "jumpV", "gravity", "aiSpeed", "freezeAI"]) g[k] = ADMIN[k];
        g.infAll = A2.G.infAll;
        sendAction({ t: "own", op: "g", g });
      }
    } catch (er) {}
  }, 120);
  // guest owner: room settings go to the host after each change
  let dirty = 0;
  const markDirty = (e) => window.IS_OWNER && isClient() && !ON && e.target.closest("#ad-grid, #ad-toggles") && document.querySelector('#ad-panel .ad-tabs [data-t="global"].on') && (dirty = Date.now());
  document.addEventListener("input", markDirty, !0);
  document.addEventListener("click", markDirty, !0);
  setInterval(() => {
    if (!dirty || Date.now() - dirty < 250) return;
    dirty = 0;
    const g = {};
    for (const k of ["run", "walk", "crouch", "jumpV", "gravity", "aiSpeed", "freezeAI"]) g[k] = ADMIN[k];
    for (const k of ["infAll", "roundT", "buyT", "matchT"]) g[k] = A2.G[k];
    sendAction({ t: "own", op: "g", g });
  }, 150);

  const teamName = (t) => ("atk" === t ? E("공격", "ATK") : "def" === t ? E("수비", "DEF") : t || "");
  function rowHTML(a) {
    const human = a.ctrl && "ai" !== a.ctrl,
      guest = human && "me" !== a.ctrl,
      nm = a.name || (a.agent && a.agent.name) || "#" + a.id,
      hp = Math.max(0, Math.round(a.hp || 0));
    const b = (op, label, v, cls) => `<button data-op="${op}" data-id="${esc(a.id)}"${null != v ? ` data-v="${esc(v)}"` : ""} class="${cls || ""}">${label}</button>`;
    return (
      `<div class="ow-row${a.alive ? "" : " dead"}" data-id="${esc(a.id)}">` +
      `<div class="ow-who"><b class="ow-${esc(a.team)}">${esc(nm)}</b><small>${esc(teamName(a.team))} · ${esc(a.agent ? a.agent.name : "")} · ${"me" === a.ctrl ? E("나", "me") : guest ? E("플레이어", "player") : E("봇", "bot")}</small></div>` +
      `<div class="ow-hp"><span class="ow-hpv">${a.alive ? hp : E("사망", "dead")}</span><i style="width:${Math.min(100, hp)}%"></i></div>` +
      `<div class="ow-ctl">` +
      `<input type="number" min="1" max="999" value="${hp || 100}" data-hpin="${esc(a.id)}">` +
      b("hp", E("체력", "HP")) +
      b("kill", E("즉사", "Kill"), null, "red") +
      b("god", OWN.god.has(a.id) ? E("무적 끄기", "Unprotect") : E("무적", "God"), OWN.god.has(a.id) ? 0 : 1, OWN.god.has(a.id) ? "on" : "") +
      b("bind", OWN.bind.has(a.id) ? E("풀기", "Release") : E("묶기", "Pin"), OWN.bind.has(a.id) ? 0 : 1, OWN.bind.has(a.id) ? "on" : "") +
      (guest ? b("cheat", X.GRANT.has(a.ctrl) || cheatShown.has(a.id) ? E("치트 회수", "Take cheats") : E("치트 부여", "Give cheats"), X.GRANT.has(a.ctrl) || cheatShown.has(a.id) ? 0 : 1, X.GRANT.has(a.ctrl) || cheatShown.has(a.id) ? "on" : "") : "") +
      (human ? b("team", E("팀 이동", "Swap team"), "atk" === a.team ? "def" : "atk") : "") +
      (guest ? b("kick", E("추방", "Kick"), null, "red") : "") +
      (guest && sess().atoken ? b("ban", E("차단", "Ban"), null, "red") : "") +
      `</div></div>`
    );
  }
  const cheatShown = new Set(); // a guest owner's view of who it gave cheats to
  function renderPlayers(full) {
    const grid = $("ad-grid"),
      tg = $("ad-toggles"),
      note = document.querySelector("#ad-panel .ad-note");
    if (!grid) return;
    $("ad-panel").classList.remove("ad-locked");
    tg && (tg.innerHTML = "");
    note && (note.innerHTML = isClient() ? E("<b>운영자</b> · 방장이 대신 실행합니다." + (OWNP_ME ? "" : " (확인 중…)"), "<b>Owner</b> · the host carries these out." + (OWNP_ME ? "" : " (checking…)")) : E("<b>운영자</b> · 이 방의 모든 플레이어와 봇.", "<b>Owner</b> · every player and bot in this room."));
    const list = (world.actors || []).slice().sort((p, q) => (p.team > q.team ? 1 : p.team < q.team ? -1 : 0));
    let box = grid.querySelector(".ow-list");
    if (full || !box) {
      grid.innerHTML =
        `<div class="ow-list"><div class="ow-top"><input id="ow-msg" maxlength="120" placeholder="${E("모두에게 공지", "Announce to everyone")}"><button data-op="msg">${E("보내기", "Send")}</button></div>` +
        (list.length ? list.map(rowHTML).join("") : `<div class="ow-empty">${E("경기를 시작하면 플레이어가 여기 나옵니다.", "Players show up here once a match starts.")}</div>`) +
        `</div>`;
      box = grid.querySelector(".ow-list");
      box.onclick = click;
      return;
    }
    // light refresh: health only, so typing is not lost
    for (const a of list) {
      const r = box.querySelector(`.ow-row[data-id="${CSS.escape(String(a.id))}"]`);
      if (!r) return renderPlayers(!0);
      r.classList.toggle("dead", !a.alive);
      r.querySelector(".ow-hpv").textContent = a.alive ? Math.round(a.hp) : E("사망", "dead");
      r.querySelector(".ow-hp i").style.width = Math.min(100, Math.max(0, a.hp)) + "%";
    }
  }
  async function click(e) {
    const btn = e.target.closest("button[data-op]");
    if (!btn) return;
    const op = btn.dataset.op,
      id = btn.dataset.id,
      v = btn.dataset.v;
    const a = id != null ? actorById(id) : null;
    if ("msg" === op) {
      const t = $("ow-msg").value.trim();
      t && (order({ op: "msg", text: t }), ($("ow-msg").value = ""));
      return;
    }
    if ("hp" === op) {
      const inp = btn.parentNode.querySelector("[data-hpin]");
      order({ op: "hp", id, v: +inp.value || 100 });
    } else if ("kill" === op) order({ op: "kill", id });
    else if ("god" === op || "bind" === op) {
      // a guest owner keeps its own view of these
      const s = OWN[op];
      +v ? s.add(isNaN(+id) ? id : +id) : s.delete(isNaN(+id) ? id : +id);
      order({ op, id, v: +v });
    } else if ("cheat" === op) {
      +v ? cheatShown.add(a && a.id) : cheatShown.delete(a && a.id);
      order({ op, id, v: +v });
    } else if ("team" === op) order({ op, id, v });
    else if ("kick" === op) {
      if (!confirm(E(`${a && a.name} 님을 방에서 내보낼까요?`, `Kick ${a && a.name}?`))) return;
      order({ op, id });
    } else if ("ban" === op) {
      const name = a && a.name;
      const days = prompt(E(`${name} 계정을 며칠 차단할까요? (0 = 영구)`, `Ban ${name} for how many days? (0 = forever)`), "1");
      if (null === days) return;
      try {
        await AC.api("a_user_set", { atoken: sess().atoken, id: name, op: "ban", days: +days || 0, reason: E("운영자 차단", "Banned by the owner") });
        banner(E("차단했습니다: ", "Banned: ") + name, "#ff6b6b");
      } catch (er) {
        banner(E("차단 실패: ", "Ban failed: ") + (er.message || er), "#ff6b6b");
      }
      order({ op: "kick", id });
    }
    setTimeout(() => renderPlayers(!0), 120);
  }
  setInterval(() => {
    const open = ON && $("admin") && !$("admin").hidden;
    open && !(document.activeElement && document.activeElement.closest && document.activeElement.closest(".ow-list")) && renderPlayers(!1);
  }, 700);

  const st = document.createElement("style");
  st.textContent = `
.ow-list{grid-column:1/-1;display:flex;flex-direction:column;gap:6px}
.ow-top{display:flex;gap:6px;margin-bottom:4px}
.ow-top input{flex:1;padding:8px 10px;border-radius:10px;border:1px solid var(--line,#2a3140);background:rgba(255,255,255,.04);color:#fff;font-family:inherit}
.ow-row{display:grid;grid-template-columns:minmax(110px,1.1fr) 90px 3fr;gap:8px;align-items:center;padding:7px 9px;border:1px solid var(--line,#2a3140);border-radius:10px;background:rgba(255,255,255,.02)}
.ow-row.dead{opacity:.5}
.ow-who{display:flex;flex-direction:column;min-width:0}
.ow-who b{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ow-who small{font-size:10px;color:var(--steel-dim,#7d8899)}
.ow-atk{color:#ff7a59}.ow-def{color:#38bdf8}
.ow-hp{position:relative;height:18px;border-radius:6px;background:rgba(255,255,255,.06);overflow:hidden;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center}
.ow-hp i{position:absolute;left:0;top:0;bottom:0;background:rgba(76,175,80,.45)}
.ow-hp span{position:relative}
.ow-ctl{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.ow-ctl input{width:54px;padding:5px 6px;border-radius:8px;border:1px solid var(--line,#2a3140);background:rgba(255,255,255,.04);color:#fff;font-family:inherit}
.ow-list button{padding:5px 8px;border-radius:8px;border:1px solid var(--line,#2a3140);background:rgba(255,255,255,.04);color:var(--ink,#fff);font-family:inherit;font-size:11px;font-weight:700;cursor:pointer}
.ow-list button.red{border-color:rgba(255,80,80,.5);color:#ff8a8a}
.ow-list button.on{border-color:var(--gold,#ffc849);color:var(--gold,#ffc849);background:rgba(255,200,73,.1)}
.ow-empty{padding:14px;text-align:center;color:var(--steel-dim,#7d8899);font-size:12px}
@media (max-width:640px){.ow-row{grid-template-columns:1fr 80px}.ow-ctl{grid-column:1/-1}}`;
  document.head.appendChild(st);
  // the owner page sends commands by account name (through the room heartbeat)
  function byName(c) {
    if (isClient() || !c || !c.name) return;
    const a = (world.actors || []).find((x) => memberName(x) === c.name);
    a && run({ op: c.cmd, id: a.id, v: null != c.v ? c.v : 1 });
  }
  window.OWNER_UI = { run, order, OWN, renderPlayers, byName };
})();

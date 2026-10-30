(() => {
  // The ranked flow, client side. The rank is never what a player says about
  // himself: the host of a ranked room opens the match on the server with the
  // roster (ranked_start), every player takes a ticket for his seat in it
  // (match_start), the host sends the result when the match is over
  // (ranked_result), and each player settles his own match (progress, in
  // 44-account-sync). Here: the roster and the result on the host, the ticket
  // on everybody (waiting until the roster is in), the room list's skill band,
  // the skill range and guest check before walking into a ranked room, and the
  // line "배치 n/5" for an account still placing.
  if (!window.ACCOUNT || "undefined" == typeof room || "undefined" == typeof NET || !window.RANKED) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko);
  const $ = (id) => document.getElementById(id);
  const RK = window.RANKED;
  const AC = () => window.ACCOUNT;
  const sess = () => (AC().session && AC().session()) || null;
  const me = () => (sess() && sess().user) || null;
  const loggedIn = () => {
    const u = me();
    return !!(u && !u.guest && AC().online);
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rankedNow = () => !!room.ranked && "solo" !== NET.mode && loggedIn();
  const roomCode = () => room.code || NET.room || "";
  const say = (t, c) => {
    try {
      "function" == typeof banner && banner(t, c || "#ffc849");
    } catch (e) {}
  };

  // ── tiers from a rating (the same steps as the server: 100 a division, three a tier) ──
  const tierAt = (rr) => {
    const d = Math.floor(Math.max(0, +rr || 0) / 100);
    return d >= 24 ? { t: 8, div: 0 } : { t: Math.floor(d / 3), div: (d % 3) + 1 };
  };
  const tierName = (x) => {
    const names = (window.RANK && RANK.names) || [];
    return (names[x.t] || "") + (x.div ? " " + x.div : "");
  };
  // a room's band is its average rating rounded (1000 + RR); shown as the tier it sits in
  RK.bandName = (band) => (Number.isFinite(band) ? tierName(tierAt(band - 1000)) : "");
  RK.placement = () => {
    const u = me(),
      p = u && u.placement;
    return p && p.of ? { done: Math.max(0, p.done | 0), of: p.of | 0, placing: (p.done | 0) < (p.of | 0) } : null;
  };

  // ── the roster, the ticket and the result ──
  let cur = null; // the match this host opened: { a, b, start, result, sent }
  let goSeen = !1,
    goRes = null,
    goP = null;
  const resetGo = () => {
    goSeen = !1;
    goP = new Promise((r) => (goRes = r));
  };
  resetGo();
  const waitGo = (ms) => (goSeen ? Promise.resolve() : Promise.race([goP, sleep(ms)]));

  // who plays on which side, by account id (a bot is not in the room's members).
  // Players are matched to accounts by name, so a name two humans share belongs to nobody: both are
  // left out (no ranked ticket for either, a plain one instead), or a guest named after another player
  // would take his seat and the real owner's report would land on the wrong team. The host's own seat
  // comes from his signed-in account, not a name, so it stays and the others wearing his name go.
  function roster() {
    const sid = (me() && me().id) || "",
      rows = [],
      count = new Map(),
      a = [],
      b = [];
    for (const [peer, m] of room.members) {
      const id = String(peer === NET.id ? sid : m.name || "");
      if (!id) continue;
      rows.push({ id, own: peer === NET.id, team: m.team });
      count.set(id.toLowerCase(), (count.get(id.toLowerCase()) || 0) + 1);
    }
    for (const r of rows) {
      if (count.get(r.id.toLowerCase()) > 1 && !r.own) continue;
      ("atk" === r.team ? a : b).push(r.id);
    }
    return { a, b };
  }
  // the server may be a moment behind the room (it learns the room from the host's first report)
  async function startOnServer(r) {
    for (let i = 0; ; i++) {
      try {
        return await AC().api("ranked_start", { token: sess().token, room: roomCode(), a: r.a, b: r.b });
      } catch (e) {
        if (i >= 5 || (e.status && 409 !== e.status && e.status < 500)) throw e;
        await sleep(2000);
      }
    }
  }
  const _hsm = hostStartMatch;
  hostStartMatch = function () {
    cur = null;
    if (rankedNow() && "host" === NET.mode) {
      const r = roster(),
        rec = (cur = { a: r.a, b: r.b, sent: !1, result: null });
      rec.start = startOnServer(r).then(
        (j) => {
          rec.info = j;
          // what the server says each player is (level, tier): the room's bot skill reads these, not what a guest claims
          try {
            j && j.lv && window.dispatchEvent(new CustomEvent("dfdf:roster-levels", { detail: j.lv }));
          } catch (e) {}
          try {
            sendEventAll({ t: "rk-go", id: j.id });
          } catch (e) {}
          return j;
        },
        () => null
      );
    }
    return _hsm.apply(this, arguments);
  };
  const _cbm = clientBeginMatch;
  clientBeginMatch = function () {
    resetGo();
    return _cbm.apply(this, arguments);
  };
  const _oe = NET.onEvent;
  NET.onEvent = function (e) {
    if (e && "rk-go" === e.t) {
      goSeen = !0;
      goRes && goRes();
      return;
    }
    return _oe.apply(this, arguments);
  };

  // The ranked ticket for this seat, or null (the caller then takes a plain one: XP and gold, no RR).
  // 409 means the host has not opened the match yet; 403 that this account is not in its roster.
  async function ticket(tok, api) {
    if (!rankedNow()) return null;
    if ("host" === NET.mode) {
      if (!cur || !(await cur.start)) return null;
    } else await waitGo(12000);
    for (let i = 0; i < 5; i++) {
      try {
        return await api("match_start", { token: tok, ranked: !0, room: roomCode() });
      } catch (e) {
        if (409 !== e.status || i >= 4) return null;
        await sleep(1500 + 1000 * i);
      }
    }
    return null;
  }
  const decode = (mt) => {
    try {
      return JSON.parse(atob(String(mt).split(".")[0].replace(/-/g, "+").replace(/_/g, "/")));
    } catch (e) {
      return null;
    }
  };

  // the host's result: the winning side and every roster account's kills
  async function sendResult(rec, m) {
    // who was away, taken at the moment the match ended (119-ranked-leaving...): the server decides who left
    const gone = RK.leave && RK.leave.report ? RK.leave.report() : undefined;
    const info = await rec.start;
    if (!info) return;
    const canon = new Map(info.a.concat(info.b).map((id) => [id.toLowerCase(), id])),
      k = {};
    try {
      for (const r of RESULTS.rows()) {
        const id = canon.get(String(r.a.name || "").toLowerCase());
        id && (k[id] = Math.max(k[id] | 0, r.s.k | 0));
      }
    } catch (e) {}
    const hid = ((me() && me().id) || "").toLowerCase(),
      mine = info.a.some((id) => id.toLowerCase() === hid) ? "a" : "b",
      w = "draw" === m.outcome ? "draw" : "win" === m.outcome ? mine : "a" === mine ? "b" : "a";
    for (let i = 0; i < 5; i++) {
      try {
        await AC().api("ranked_result", { token: sess().token, rm: info.rm, w, k, gone });
        return;
      } catch (e) {
        // 4xx other than a rate limit will not get better by asking again
        if (e.status && 429 !== e.status && e.status < 500) return;
        await sleep(3000 * (i + 1));
      }
    }
  }
  addEventListener("match-finished", (e) => {
    const rec = cur;
    if (!rec || rec.sent || "host" !== NET.mode || !e.detail) return;
    rec.sent = !0;
    rec.result = sendResult(rec, e.detail).catch(() => {});
  });
  RK.flow = {
    ticket,
    // the host's report goes in after its own result (a few seconds at most)
    settled: () => (cur && cur.result ? Promise.race([cur.result, sleep(8000)]) : Promise.resolve()),
    isRanked: (mt) => {
      const p = decode(mt);
      return !!(p && 1 === p.r);
    },
    roster,
    current: () => cur,
  };

  // ── before walking into a ranked room: guests stay out, and so does anyone outside its skill range ──
  const cache = new Map();
  // The server answers ranked_can_join with {ok: false, ranked, range, band} (status 200) for a room
  // out of range; the shared api() would read that "ok" as a failure, so the answer is read raw.
  async function askJoin(token, code) {
    const { response, data } = await GAME_REQUEST("/api/v1?a=ranked_can_join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, code }) });
    if (200 !== response.status || !data || !("ranked" in data)) throw new Error(data && data.error ? data.error : "error");
    return data;
  }
  RK.canJoin = async (code) => {
    code = String(code || "").trim().toUpperCase();
    const hit = cache.get(code);
    if (hit && Date.now() - hit.at < 4000) return hit.res;
    let res = { ok: !0 };
    const s = sess();
    if (AC().online && s && s.token && 6 === code.length) {
      try {
        const j = await Promise.race([askJoin(s.token, code), sleep(3500).then(() => Promise.reject(new Error("slow")))]);
        res = { ranked: !!j.ranked, ok: !1 !== j.ok, range: j.range, band: j.band };
      } catch (e) {
        // an unknown room or a slow answer: the join itself tells
      }
    }
    cache.set(code, { at: Date.now(), res });
    return res;
  };
  RK.joinNote = (c) => {
    if (!c || !c.ranked) return "";
    if (!loggedIn()) return L("랭크전은 로그인한 계정만 들어갈 수 있습니다. 게스트는 일반 방을 이용해 주세요.", "Ranked rooms are for signed-in accounts. Guests can use the normal rooms.");
    if (c.ok) return "";
    const near = RK.bandName(c.band);
    return L(
      `이 랭크 방은 실력대${near ? `(${near} 부근)` : ""}가 나와 너무 달라 들어갈 수 없습니다. 방이 열려 있는 시간이 길어질수록 입장 범위가 넓어집니다.`,
      `This ranked room is too far from your skill${near ? ` (around ${near})` : ""} to join. The range widens the longer the room stays open.`
    );
  };
  const _jr = joinRoom;
  joinRoom = async function (code) {
    const c = await RK.canJoin(code),
      note = RK.joinNote(c);
    if (note) {
      // on the room list's note for a while, and as a banner
      RK.joinMsg = { text: note, at: Date.now() };
      try {
        window.MULTI && MULTI.paint();
      } catch (e) {}
      "function" == typeof netAlert ? netAlert(note) : say(note, "#ff8a9a");
      return;
    }
    return _jr.apply(this, arguments);
  };
  // a guest who got into a ranked room some other way (an invite link) is sent out again
  setInterval(() => {
    try {
      if ("client" !== NET.mode || !room.ranked || !AC().online || loggedIn()) return;
      netShutdown();
      world.phase = "menu";
      $("lobby") && ($("lobby").hidden = !0);
      hideAll();
      show("s-title");
      netAlert(RK.joinNote({ ranked: !0, ok: !0 }));
    } catch (e) {}
  }, 800);

  // ── "Play together": my standing on the ranked card ──
  function line() {
    const u = me();
    if (!u || u.guest) return L("랭크전은 로그인한 계정만 할 수 있습니다", "Ranked needs a signed-in account");
    const p = RK.placement(),
      r = u.rank;
    if (p && p.placing) return L(`배치 ${p.done}/${p.of} · ${p.of}판을 마치면 티어가 공개됩니다`, `Placement ${p.done}/${p.of} · your tier shows after ${p.of} matches`);
    return r ? tierName(r) + " · " + (r.t >= 8 ? r.rr + " RR" : r.into + "/100 RR") : "";
  }
  RK.myLine = line;
  setInterval(() => {
    try {
      const el = $("mu-rank-me");
      el && el.textContent !== line() && (el.textContent = line());
    } catch (e) {}
  }, 1000);
  const css = document.createElement("style");
  css.textContent = `.mu-card.mu-rank .mu-rk-me{margin:0 0 8px;font-size:12px;font-weight:700;color:#ffe9a8}.mu-room .mu-band{display:inline-block;margin-left:5px;padding:0 6px;border-radius:99px;font-size:10px;font-weight:700;letter-spacing:.04em;color:#ffe9a8;border:1px solid #ffd76a66}`;
  document.head.appendChild(css);
})();

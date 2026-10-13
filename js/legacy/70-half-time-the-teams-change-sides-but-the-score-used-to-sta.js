
(() => {
  // Half time. The teams change sides, but the score used to stay with the
  // side: the rounds the first-half attackers had won went to whoever
  // attacked in the second half, and a guest was never told it had changed
  // sides (its outlines, its roster and its HUD stayed on the old side). Now
  // the two counters swap with the teams, the host tells every guest, and the
  // top bar shows your own team on the left, in the colour of the side it
  // plays now, so your score stays where it was.
  if ("undefined" == typeof NET || "undefined" == typeof world || "undefined" == typeof updateHUD) return;
  const flip = (t) => ("atk" === t ? "def" : "atk");
  const paint = (m, team) => {
    if (!m) return;
    const c = "atk" === team ? 16739146 : 3718648;
    m.torso && (m.torso.material = new T.MeshStandardMaterial({ color: c, roughness: 0.62, metalness: 0.22 }));
    m.visor && m.visor.material && m.visor.material.color.setHex(c);
  };
  // every snapshot now says which side each player is on (slot 14: 1 for
  // defence), so a guest follows the swap even if it was reconnecting when
  // it happened; the side change itself is announced once, when its own
  // side changes
  function swapLobby() {
    if ("object" != typeof room || !room) return;
    if (room.slots) {
      const s = room.slots.atk;
      room.slots.atk = room.slots.def;
      room.slots.def = s;
    }
    if (room.members) for (const [, m] of room.members) m.team = flip(m.team);
  }
  const _pa = packActor;
  packActor = function (a) {
    const r = _pa.apply(this, arguments);
    try {
      r[14] = "def" === a.team ? 1 : 0;
    } catch (x) {}
    return r;
  };
  const _as = applySnapshot;
  applySnapshot = function (snap) {
    const r = _as.apply(this, arguments);
    try {
      if ("client" === NET.mode && snap && Array.isArray(snap.a)) {
        const me = myActor(),
          before = me && me.team;
        let n = 0;
        for (const p of snap.a) {
          if (null == p[14]) continue;
          const a = actorById(p[0]),
            team = p[14] ? "def" : "atk";
          a && a.team !== team && ((a.team = team), paint(a.model, team), n++);
        }
        if (n) {
          rosterKey = "";
          if (before && me && me.team !== before) {
            swapLobby();
            banner("진영 교대", "#ffc849");
          }
          updateHUD();
        }
      }
    } catch (x) {}
    return r;
  };
  // the host's word arrives with the snapshots; the event only refreshes the score
  const _oe = NET.onEvent;
  NET.onEvent = function (e) {
    if (e && "half" === e.t) {
      try {
        "client" === NET.mode && null != e.sa && ((world.scoreAtk = e.sa), (world.scoreDef = e.sd), updateHUD());
      } catch (x) {}
      return;
    }
    return _oe.apply(this, arguments);
  };
  // the top bar: my team on the left, the other on the right
  const _uh = updateHUD;
  updateHUD = function () {
    const r = _uh.apply(this, arguments);
    try {
      const md = window.GAME_MODES && "object" == typeof room && room && GAME_MODES[room.mode];
      if (md && md.ffa) return r;
      const me = "def" === (player && player.team) ? "def" : "atk",
        L = document.getElementById("tb-def"),
        R = document.getElementById("tb-atk");
      if (!L || !R) return r;
      _hT(L, "atk" === me ? world.scoreAtk : world.scoreDef);
      _hT(R, "atk" === me ? world.scoreDef : world.scoreAtk);
      L.classList.toggle("atk", "atk" === me);
      L.classList.toggle("def", "def" === me);
      R.classList.toggle("atk", "def" === me);
      R.classList.toggle("def", "atk" === me);
    } catch (x) {}
    return r;
  };
  window.HALFTIME = { flip };
})();

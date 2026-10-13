
(() => {
  const $ = (id) => document.getElementById(id);
  const title = $("s-title");
  if (!title) return;

  // ── featured agent: show the four abilities under the quote ──
  const abil = $("tt-abil");
  const paintAbil = () => {
    const a = AGENTS.find((x) => x.name === $("tt-name").textContent);
    if (!a || !abil) return;
    abil.innerHTML = a.abilities.map((b) => `<span${b.ult ? ' class="ult"' : ""}><b>${b.key}</b>${b.name}</span>`).join("");
  };
  new MutationObserver(paintAbil).observe($("tt-name"), { childList: !0, characterData: !0, subtree: !0 });
  paintAbil();

  // ── background: slow low orbits around the sites of a random map ──
  const rnd = (a, b) => a + (b - a) * Math.random();
  const S = { shot: null, t: 0, n: 0, fading: !1 };
  function mapName() {
    const m = (typeof MAP_LIST !== "undefined" ? MAP_LIST : []).find((x) => x.key === CUR_MAP_KEY);
    return m ? m.name : "";
  }
  function planShot() {
    const b = MAP.bounds;
    const spots = MAP.sites.map((s) => ({ x: s.x, z: s.z, n: s.id + " 사이트" }));
    spots.push({ x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2, n: "중앙" });
    let best = null;
    // keep the camera above whatever it passes over during the shot
    for (let k = 0; k < 14; k++) {
      const p = spots[Math.floor(Math.random() * spots.length)],
        s = { cx: p.x, cz: p.z, n: p.n, r: rnd(24, 38), h: rnd(8, 13), a0: rnd(0, 6.283), dir: Math.random() < 0.5 ? -1 : 1 };
      let top = 0;
      for (let t = 0; t <= 12; t += 1) {
        const a = s.a0 + s.dir * 0.055 * t;
        top = Math.max(top, blockerTopAt(s.cx + s.r * Math.sin(a), s.cz + s.r * Math.cos(a), 0, 1.5));
      }
      const score = s.h - top;
      if (!best || score > best.score) best = Object.assign(s, { score });
      if (score > 2.5) break;
    }
    return best;
  }
  function nextShot() {
    S.n++;
    // every third shot, while the title is on screen, switch to another map
    if (S.n % 3 === 0 && !title.hidden && typeof MAP_LIST !== "undefined") {
      const others = MAP_LIST.filter((m) => m.key !== CUR_MAP_KEY);
      try {
        loadMap(others[Math.floor(Math.random() * others.length)].key);
      } catch (e) {}
    }
    S.shot = planShot();
    S.key = CUR_MAP_KEY;
    S.t = 0;
    const l = $("tt-bgname");
    l && (l.textContent = mapName() + " · " + S.shot.n);
  }
  const fade = $("tt-fade");
  titleCam = function (dt) {
    if ("menu" !== world.phase) return;
    // the map may have changed under us (a match, the map viewer)
    if (!S.shot || S.key !== CUR_MAP_KEY) (S.n = 0), nextShot();
    S.t += dt;
    if (S.t > 11.4 && !S.fading) (S.fading = !0), fade && fade.classList.add("on");
    if (S.t > 12) nextShot(), (S.fading = !1), fade && fade.classList.remove("on");
    const s = S.shot,
      a = s.a0 + s.dir * 0.055 * S.t;
    camera.position.set(s.cx + s.r * Math.sin(a), s.h + 0.5 * Math.sin(S.t * 0.35), s.cz + s.r * Math.cos(a));
    camera.lookAt(s.cx, 1.2, s.cz);
  };

  // first background: a random map, unless a room link is opening the lobby
  let linked = !1;
  try {
    linked = !!new URLSearchParams(location.search).get("room");
  } catch (e) {}
  if (!linked && typeof MAP_LIST !== "undefined")
    try {
      loadMap(MAP_LIST[Math.floor(Math.random() * MAP_LIST.length)].key);
    } catch (e) {}
})();

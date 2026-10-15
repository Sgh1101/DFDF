
(() => {
  // Ability fixes found by casting every ability at a live enemy.

  // 감시 드론: the drone only ever looked at the old single-player bot list, so
  // in real matches it never found anyone. It now hunts the nearest enemy of
  // the team that launched it, among players and bots, and tags them.
  const DRONES = [];
  makeDrone = function () {
    const m = new T.Mesh(new T.OctahedronGeometry(0.45), new T.MeshStandardMaterial({ color: 16766287, emissive: 16766287, emissiveIntensity: 0.5 }));
    m.position.set(player.pos.x, 4.5, player.pos.z);
    scene.add(m);
    DRONES.push({ mesh: m, life: 10, team: player.team });
  };
  function tickDrones(dt) {
    for (let i = DRONES.length - 1; i >= 0; i--) {
      const d = DRONES[i];
      d.life -= dt;
      d.mesh.rotation.y += 2.4 * dt;
      if (d.life <= 0) {
        scene.remove(d.mesh);
        DRONES.splice(i, 1);
        continue;
      }
      const pool = (world.actors && world.actors.length ? world.actors : world.entities) || [];
      let best = null,
        bd = 1e9;
      for (const e of pool) {
        if (!e.alive || e.team === d.team) continue;
        const q = dist2(d.mesh.position.x, d.mesh.position.z, e.pos.x, e.pos.z);
        q < bd && ((bd = q), (best = e));
      }
      if (!best) continue;
      d.mesh.position.lerp(new T.Vector3(best.pos.x, 4.5, best.pos.z), Math.min(1, 0.55 * dt));
      // within 20 m it keeps the target lit up for the team
      bd < 400 && (best.revealed = Math.max(best.revealed || 0, 1.5));
    }
  }

  // 정전: it only lengthened bot skill cooldowns. It now seals every enemy's
  // abilities for 10 s and blacks out their minimap, as described.
  let blackoutUntil = 0;
  const _ca = castAbility;
  castAbility = function (type) {
    const caster = player,
      team = caster && caster.team;
    const r = _ca.apply(this, arguments);
    if ("ult_emp" === type && team) {
      const foes = (world.actors && world.actors.length ? world.actors : world.entities || []).filter((e) => e.alive && e.team !== team);
      // silence ticks down on the host; clients learn about it through the host's checks
      isHost() && foes.forEach((e) => (e.silenced = Math.max(e.silenced || 0, 10)));
      const me = "function" == typeof myActor ? myActor() : null;
      me && foes.includes(me) && (blackoutUntil = performance.now() + 1e4);
    }
    return r;
  };
  const _dm = drawMini;
  drawMini = function () {
    const r = _dm.apply(this, arguments);
    if (performance.now() < blackoutUntil && "undefined" != typeof mctx) {
      mctx.fillStyle = "#07090d";
      mctx.fillRect(0, 0, mini.width, mini.height);
      mctx.fillStyle = "#ffd54f";
      mctx.font = "bold 34px sans-serif";
      mctx.textAlign = "center";
      mctx.textBaseline = "middle";
      mctx.fillText("정전", mini.width / 2, mini.height / 2);
    }
    return r;
  };

  const _ns = netStep;
  netStep = function (dt) {
    const r = _ns.apply(this, arguments);
    try {
      tickDrones(dt || world._adt || 0.016);
    } catch (e) {}
    return r;
  };
})();

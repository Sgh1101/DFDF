window.AB_R=1.8;window.AB_D=1.7;window.AB_SM=1.4;window.AB_SP=1.4;
(() => {
  // Ability reach and areas, scaled up for the wide maps. Every ability goes
  // through these helpers, so one multiplier covers throws, aim points,
  // zones, blasts, reveals, smokes and the ultimate weapons alike.
  const R = window.AB_R, // areas
    D = window.AB_D, // reach
    SM = window.AB_SM, // smoke size
    SP = window.AB_SP; // projectile speed (thrown farther)
  const _aim = aimPoint;
  aimPoint = function (d) {
    return _aim.call(this, d * D);
  };
  const _mz = makeZone;
  makeZone = function (x, z, r) {
    const a = [...arguments];
    a[2] = r * R;
    return _mz.apply(this, a);
  };
  const _ex = explode;
  explode = function (x, z, r) {
    const a = [...arguments];
    a[2] = r * R;
    return _ex.apply(this, a);
  };
  const _ah = areaHit;
  areaHit = function (x, z, r) {
    const a = [...arguments];
    a[2] = r * R;
    return _ah.apply(this, a);
  };
  const _ra = revealArea;
  revealArea = function (x, z, r) {
    const a = [...arguments];
    a[2] = r * R;
    return _ra.apply(this, a);
  };
  const _ms = makeSmoke;
  makeSmoke = function (p, r) {
    const a = [...arguments];
    a[1] = r * SM;
    return _ms.apply(this, a);
  };
  const _msa = makeSmokeAt;
  makeSmokeAt = function (x, z, r) {
    const a = [...arguments];
    a[2] = r * SM;
    return _msa.apply(this, a);
  };
  const _tp = throwProjectile;
  throwProjectile = function (c, sp) {
    const a = [...arguments];
    a[1] = sp * SP;
    return _tp.apply(this, a);
  };
  if ("function" == typeof ultwRay) {
    const _ur = ultwRay;
    ultwRay = function (e, t, o, len) {
      const a = [...arguments];
      a[3] = len * D;
      return _ur.apply(this, a);
    };
  }
  for (const k in ULTW) ULTW[k].aiRange *= D;

  // descriptions: "반경 14m", "11m 앞" → the new numbers
  const fmt = (v) => (Math.round(v * 10) / 10).toString();
  for (const ag of AGENTS)
    for (const ab of ag.abilities)
      ab.desc && !ab._rs && ((ab._rs = 1), (ab.desc = ab.desc.replace(/(\d+(?:\.\d+)?)m/g, (m, n) => fmt(+n * (/앞|거리|사거리|날아|멀리/.test(ab.desc) ? D : R)) + "m")));
})();

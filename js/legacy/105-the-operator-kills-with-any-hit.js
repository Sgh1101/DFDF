(() => {
  // The Operator (the "sniper" gun) kills with any hit: head, body or leg, at any range, through armour. While one of its
  // shots is being fired, the damage dealt is raised to just what the target has left (hp behind its armour and
  // shield), so the damage numbers, the ultimate charge and the stats stay as for any other kill.
  if ("undefined" == typeof dealDamage || "undefined" == typeof damageEntity || "undefined" == typeof fire || "undefined" == typeof actorFire) return;
  const KEY = "sniper";
  let lethal = !1;
  // what has to be dealt for nothing to be left: armour takes half of a hit up to what it holds
  const need = (e, t) => {
    const hp = Math.max(1, e.hp || 0),
      ar = Math.max(0, e.armor || 0),
      after = hp <= ar ? 2 * hp : hp + ar,
      k = (e.shielded > 0 ? 0.4 : 1) * (e.vuln > 0 ? 1.5 : 1);
    return Math.max(t, (after / k) * 1.02 + 1);
  };
  const _dd = dealDamage;
  dealDamage = function (e, t, o, a) {
    lethal && e && e.alive && (t = need(e, t));
    return _dd.call(this, e, t, o, a);
  };
  const _de = damageEntity;
  damageEntity = function (e, t, o, a) {
    lethal && e && e.alive && (t = need(e, t));
    return _de.call(this, e, t, o, a);
  };
  // the knife and abilities are not shots: only the shot of this gun counts
  const shot = (key, run, self, args) => {
    const was = lethal;
    lethal = key === KEY;
    try {
      return run.apply(self, args);
    } finally {
      lethal = was;
    }
  };
  const _f = fire;
  fire = function () {
    return shot(curWeaponKey(), _f, this, arguments);
  };
  const _af = actorFire;
  actorFire = function (e) {
    return shot(e && e.weapons ? actorWeaponKey(e) : null, _af, this, arguments);
  };
  window.OPERATOR_LETHAL = { need };
})();

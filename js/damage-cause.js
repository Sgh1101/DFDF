(function (root) {
  "use strict";
  // Damage can arrive after the shooter switches weapons or dies.
  let current = null;
  function capture(actor, gun, kind, round, skin) {
    return Object.freeze({ actor: actor.id, gun, kind, round, skin: skin || "default" });
  }
  function run(cause, callback) {
    const previous = current;
    current = cause;
    try { return callback(); } finally { current = previous; }
  }
  const api = { capture, run, get: () => current };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DAMAGE_CAUSE = api;
})(typeof window === "object" ? window : globalThis);

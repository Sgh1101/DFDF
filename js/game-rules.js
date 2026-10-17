(function (root) {
  "use strict";
  function validInput(input) {
    return !!input && Number.isSafeInteger(input.seq) && input.seq >= 0 && Array.isArray(input.mv) && input.mv.length === 2 && input.mv.every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 2) && typeof input.yaw === "number" && Number.isFinite(input.yaw) && Math.abs(input.yaw) <= 1000 && typeof input.pitch === "number" && Number.isFinite(input.pitch) && Math.abs(input.pitch) <= Math.PI / 2 && Number.isInteger(input.btn) && input.btn >= 0 && input.btn <= 8191 && (input.sl === undefined || Number.isInteger(input.sl) && input.sl >= 0 && input.sl <= 2) && (input.slot === undefined || ["primary", "secondary", "knife"].includes(input.slot));
  }
  function abilityReady(actor, ability, phase, unlimited = false) {
    if (!actor || !actor.alive || !ability || !ability.def || !["buy", "live"].includes(phase)) return false;
    if ((actor.silenced || 0) > 0 && !unlimited) return false;
    return unlimited || (ability.def.ult ? (actor.ultCharge || 0) >= (actor.ultMax || 5) : !(ability.cd > 0) && ability.charges > 0);
  }
  function outcome(mode, score, rank) {
    if (mode === "dm") return rank === 1 ? "win" : "loss";
    return score[0] === score[1] ? "draw" : score[0] > score[1] ? "win" : "loss";
  }
  function finisher(event) {
    return !!event && event.finisher !== false && event.mode === "std" && event.last === true && ["gun", "head", "melee"].includes(event.kind) && event.killer !== event.victim && typeof event.skin === "string" && event.skin !== "default";
  }
  const championsSkin = (id) => ["champion", "champions_atk", "champions_def"].includes(id);
  const championsFinisher = (event) => finisher(event) && championsSkin(event.skin);
  const rules = { validInput, abilityReady, outcome, finisher, championsSkin, championsFinisher };
  if (typeof module === "object" && module.exports) module.exports = rules;
  else root.GAME_RULES = rules;
})(typeof window === "object" ? window : globalThis);

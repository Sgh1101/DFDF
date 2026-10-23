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
  // The skin a finisher is played in: the one the killer's gun wore (finisherSkin, when an event names one,
  // takes its place). A bot's kill has none.
  const finisherSkin = (event) => (event && (event.finisherSkin || event.skin));
  function finisher(event) {
    const skin = finisherSkin(event);
    return !!event && event.finisher !== false && !event.byBot && event.mode === "std" && event.last === true && ["gun", "head", "melee"].includes(event.kind) && event.killer !== event.victim && typeof skin === "string" && skin !== "default";
  }
  // only the transcendent Champions Phantom; the legendary "champion" (Champion's Wave) keeps its own legendary finisher
  const championsSkin = (id) => ["champions_atk", "champions_def"].includes(id);
  const championsFinisher = (event) => finisher(event) && championsSkin(finisherSkin(event));
  // the Champions skin a player's finisher uses: the attackers' dragon pair or the defenders'
  const playerFinisherSkin = (team) => ("atk" === team ? "champions_atk" : "champions_def");
  const rules = { validInput, abilityReady, outcome, finisher, finisherSkin, playerFinisherSkin, championsSkin, championsFinisher };
  if (typeof module === "object" && module.exports) module.exports = rules;
  else root.GAME_RULES = rules;
})(typeof window === "object" ? window : globalThis);

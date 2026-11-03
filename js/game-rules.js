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
  // The modes without sides (js/legacy/05-game-modes.js, ffa): placing is the result, never the team score. The server
  // reads this same list for a report's draw, so a client cannot choose which modes count as free for all.
  const FFA_MODES = ["dm", "knife", "gun", "zone", "range"];
  const ffaMode = (mode) => FFA_MODES.includes(mode);
  function outcome(mode, score, rank) {
    if (ffaMode(mode)) return rank === 1 ? "win" : "loss";
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
  const bounded = (n, lo=0, hi=1000000) => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
  function validHostEvent(e,weapons) {
    if (!e || typeof e !== 'object' || typeof e.t !== 'string') return false;
    for(const k of ['sa','sd','rd'])if(e[k]!=null&&!bounded(e[k]))return false;
    if(e.t==='over'&&e.k!=null&&(!Array.isArray(e.k)||e.k.length>128||!e.k.every(a=>Array.isArray(a)&&a.length===2&&bounded(a[1]))))return false;
    if (e.t === 'am') return typeof e.k === 'string' && Object.hasOwn(weapons,e.k) && bounded(e.n) && (e.r == null || bounded(e.r));
    if (e.t === 'ability-state') return Number.isInteger(e.i) && e.i >= 0 && e.i < 4 && bounded(e.charges) && bounded(e.cd) && bounded(e.ult);
    return true;
  }
  function validSnapshot(s) {
    if (!s || typeof s !== 'object' || typeof s.ph !== 'string' || s.ph.length > 24 || !bounded(s.rt,-1000000) || !['sa','sd','rd'].every(k=>bounded(s[k]))) return false;
    if (!Array.isArray(s.sk) || s.sk.length < 5 || !s.sk.every(n=>bounded(n,-10000000,10000000))) return false;
    if (!Array.isArray(s.a) || s.a.length > 128) return false;
    return s.a.every(a=>Array.isArray(a) && a.length >= 11 && a.length <= 32 &&
      (typeof a[0] === 'string' && a[0].length <= 96 || bounded(a[0])) &&
      a.slice(1).every(n=>bounded(n,-10000000,10000000)));
  }
  const rules = { validInput, validHostEvent, validSnapshot, abilityReady, outcome, ffaMode, FFA_MODES, finisher, finisherSkin, playerFinisherSkin, championsSkin, championsFinisher };
  if (typeof module === "object" && module.exports) module.exports = rules;
  else root.GAME_RULES = rules;
})(typeof window === "object" ? window : globalThis);

const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const rules = require("../js/game-rules");
const source = fs.readFileSync("play.html", "utf8");
const start = source.indexOf("NET.onAction=(e,t)=>{switch(t.t)");
const handler = source.slice(start, source.indexOf(",NET.onPeerGone=", start));
function host(ability, casting) {
  const actor = { ctrl: "peer", alive: true, abilities: [ability], ultCharge: 5, ultMax: 5 }, events = [];
  let casts = 0;
  const context = { NET: {}, world: { actors: [actor], phase: "live" }, room: { mode: "std" }, window: {}, GAME_RULES: rules, CAST_REFUND: false, withCaster: (a, fn) => fn(), castAbility: () => { casts++; if (casting) casting(context); }, sendEventTo: (peer, event) => events.push(event) };
  vm.createContext(context); vm.runInContext(handler, context);
  return { context, actor, events, casts: () => casts };
}
test("actual host action consumes a charge and denies repeated casts during cooldown", () => {
  const h = host({ def: { type: "test", cd: 30 }, cd: 0, charges: 1 });
  h.context.NET.onAction("peer", { t: "abil", i: 0 }); h.context.NET.onAction("peer", { t: "abil", i: 0 });
  assert.equal(h.casts(), 1); assert.equal(h.actor.abilities[0].charges, 0); assert.equal(h.actor.abilities[0].cd, 30);
  assert.equal(h.events[0].ok, true); assert.equal(h.events[1].ok, false);
});
test("failed-placement refund and ultimate meter preserve their existing rules", () => {
  const refund = host({ def: { type: "test", cd: 30 }, cd: 0, charges: 1 }, (c) => c.CAST_REFUND = true);
  refund.context.NET.onAction("peer", { t: "abil", i: 0 }); assert.equal(refund.actor.abilities[0].charges, 1); assert.equal(refund.actor.abilities[0].cd, 0);
  const ult = host({ def: { type: "ult", ult: 5 }, cd: 0, charges: 1 });
  ult.context.NET.onAction("peer", { t: "abil", i: 0 }); ult.context.NET.onAction("peer", { t: "abil", i: 0 });
  assert.equal(ult.casts(), 1); assert.equal(ult.actor.ultCharge, 0);
});

const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm"), crypto = require("node:crypto");
const source = fs.readFileSync("js/game-events.js", "utf8");
const start = source.indexOf("  const reconnectKeys ="), end = source.indexOf("  const receive =", start);
function setup() {
  const sent = [], accepted = [];
  const context = { crypto: crypto.webcrypto, NET: { room: "ABC123", onAction: (peer, message) => accepted.push({ peer, ...message }) }, sendAction: (message) => sent.push(message) };
  vm.createContext(context); vm.runInContext(source.slice(start, end), context);
  return { context, sent, accepted };
}
test("only the reconnect proof from the previous seat reaches the original takeover handler", () => {
  const { context: c, sent, accepted } = setup();
  c.sendAction({ t: "hello" }); const proof = sent[0].reconnect;
  assert.match(proof, /^[a-f0-9]{32}$/);
  c.NET.onAction("old", { t: "hello", reconnect: proof });
  for (const reconnect of [undefined, "bad", "a".repeat(32)]) c.NET.onAction("attacker", { t: "hello", prev: "old", reconnect });
  assert.equal(accepted.length, 1);
  c.sendAction({ t: "hello", prev: "old" }); assert.equal(sent[1].reconnect, proof);
  c.NET.onAction("new", sent[1]); assert.equal(accepted.at(-1).peer, "new");
  c.NET.onAction("unknown", { t: "hello", prev: "missing", reconnect: proof }); assert.equal(accepted.length, 2);
  c.NET.room = "DEF456"; c.sendAction({ t: "hello" }); assert.notEqual(sent[2].reconnect, proof);
});

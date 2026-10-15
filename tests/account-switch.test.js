const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const source = fs.readFileSync("js/legacy/44-account-sync.js", "utf8");
const start = source.indexOf("  async function signIn(guest)"), end = source.indexOf("\n  if (online &&", start);
test("in-game sign-in persists the new session and invite, then reloads without running old account callbacks", async () => {
  const controls = Object.fromEntries(["ag-go", "ag-guest", "ag-err", "ag-id", "ag-pw"].map((id) => [id, { value: "new", disabled: false, textContent: "" }]));
  const writes = new Map(), calls = [], session = { token: "new-token", user: { id: "new" }, atoken: "" };
  const c = { $: (id) => controls[id], api: async () => session, keysOf: (v) => v, device: "device", S: { token: "old" }, localStorage: { setItem: (k, v) => writes.set(k, v) }, sessionStorage: { setItem: (k, v) => writes.set(k, v) }, window: { __PENDING_ROOM: "ABC123" }, history: { replaceState: (a, b, url) => calls.push(url) }, location: { pathname: "/play.html", reload: () => calls.push("reload") }, netShutdown: () => calls.push("shutdown"), L: (ko) => ko };
  vm.createContext(c); vm.runInContext(source.slice(start, end), c); await c.signIn(false);
  assert.equal(JSON.parse(writes.get("lgp_session")).user.id, "new"); assert.equal(writes.get("lgp_gate"), "new-token");
  assert.deepEqual(calls, ["/play.html?room=ABC123", "shutdown", "reload"]);
});


test("a late account lookup cannot restore a session removed or replaced by another tab", async () => {
  const helper = source.slice(source.indexOf("  function sessionMatches"), source.indexOf("  async function api"));
  const lookup = source.slice(source.indexOf("  async function checkMe"), source.indexOf("  if (S &&", source.indexOf("  async function checkMe")));
  for (const replacement of [null, JSON.stringify({ token: "new-token" })]) {
    let stored = JSON.stringify({ token: "old-token" }), resolve;
    const session = { token: "old-token", user: { id: "old" } };
    const c = { token: () => session.token, S: session, online: true, gatePassed: () => true, api: () => new Promise((done) => resolve = done), localStorage: { getItem: () => stored, setItem: () => { throw Error("stale write"); } }, window: {} };
    vm.createContext(c); vm.runInContext(helper + lookup, c);
    const pending = c.checkMe(); stored = replacement; resolve({ user: { id: "old-updated" } }); await pending;
    assert.equal(session.user.id, "old"); assert.equal(stored, replacement);
  }
});

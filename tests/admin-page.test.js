const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const html = fs.readFileSync("admin.html", "utf8");
const line = (re) => { const m = html.split("\n").find((l) => re.test(l)); assert.ok(m, String(re)); return m.trim(); };

test("the ledger CSV quotes cells that would be read as formulas, and leaves numbers alone", () => {
  const src = line(/^\s*const q = \(v\) =>/);
  const q = vm.runInNewContext("(" + src.replace(/^const q = /, "").replace(/;$/, "") + ")");
  for (const bad of ["=1+1", "+cmd", "-2+3", "@SUM(A1)", "\tx", "\rx"]) assert.equal(q(bad), '"\'' + bad + '"');
  assert.equal(q('say "hi"'), '"say ""hi"""');
  assert.equal(q(null), '""');
  assert.equal(q("민수"), '"민수"');
  assert.equal(q(-5000), '"-5000"');
  assert.equal(q(0), '"0"');
});

test("logging in again does not stack polling timers and logging out stops them", () => {
  const timers = new Set(); let next = 1, calls = 0;
  const el = () => ({ hidden: false });
  const c = {
    AT: "tok", timer: null, badgeTimer: null, view: "dash", VIEWS: { dash: async () => {} },
    $: el, sessionStorage: { removeItem() {} }, fbBadge: () => { calls++; }, odBadge: () => { calls++; },
    setInterval: () => { const id = next++; timers.add(id); return id; }, clearInterval: (id) => timers.delete(id),
  };
  const fn = (name) => line(new RegExp("^(async )?function " + name + "\\b"));
  vm.createContext(c);
  vm.runInContext(["let timer = null, badgeTimer = null, view = \"dash\";", fn("logout"), fn("start"), fn("show")].join("\n"), c);
  c.start(); c.start(); c.start();
  assert.equal(timers.size, 1);
  c.logout();
  assert.equal(timers.size, 0);
  c.start();
  assert.equal(timers.size, 1);
});

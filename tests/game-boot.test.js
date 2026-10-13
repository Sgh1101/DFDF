const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
function boot() {
  const scheduled = [], canceled = [], handlers = {}, panels = [];
  const element = () => ({ setAttribute() {}, append(...children) { this.children = children; } });
  const window = { requestAnimationFrame: (fn) => { scheduled.push(fn); return scheduled.length; }, cancelAnimationFrame: (id) => canceled.push(id) };
  const root = { dataset: {}, removeAttribute() { delete this.dataset.gameLoading; } };
  const context = { window, document: { documentElement: root, body: { append: (node) => panels.push(node) }, createElement: element }, location: { reload() {} }, console: { error() {} }, addEventListener: (event, fn) => handlers[event] = fn, removeEventListener: (event) => delete handlers[event] };
  vm.createContext(context); vm.runInContext(fs.readFileSync("js/game-boot.js", "utf8"), context);
  return { window, root, scheduled, canceled, panels, handlers };
}
test("startup frames wait for all scripts and canceled work stays canceled", async () => {
  const b = boot(), one = () => {}, two = () => {};
  const first = b.window.requestAnimationFrame(one); const canceled = b.window.requestAnimationFrame(two); b.window.cancelAnimationFrame(canceled);
  assert.equal(b.scheduled.length, 0); b.window.GAME_BOOT.finish(); b.window.GAME_BOOT.finish();
  await b.window.GAME_BOOT.ready; assert.equal(b.scheduled.length, 1); assert.equal(b.root.dataset.gameLoading, undefined); assert.equal(b.handlers.keydown, undefined);
  b.window.cancelAnimationFrame(first); assert.deepEqual(b.canceled, [1]);
});
test("a missing script leaves gameplay stopped and displays retry", () => {
  const b = boot(); b.window.requestAnimationFrame(() => {}); b.window.GAME_BOOT.fail("missing.js"); b.window.GAME_BOOT.finish();
  assert.equal(b.scheduled.length, 0); assert.equal(b.panels.length, 1); assert.equal(typeof b.panels[0].children[1].onclick, "function");
});

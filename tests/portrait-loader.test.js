const test = require("node:test"), assert = require("node:assert/strict"), vm = require("node:vm"), fs = require("node:fs");
function fixture() {
  let ready, observer;
  const idle = [], calls = [];
  const context = { window: null, GAME_BOOT: { ready: new Promise((resolve) => { ready = resolve; }) },
    requestIdleCallback: (callback) => idle.push(callback),
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; this.observed = new Set(); observer = this; }
      observe(image) { this.observed.add(image); }
      unobserve(image) { this.observed.delete(image); }
    },
    agentPortrait: (agent, width, height) => { calls.push([agent, width, height]); return "data:" + agent; },
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync("js/portrait-loader.js", "utf8"), context);
  const image = () => ({ isConnected: true, hidden: false, closest() { return this.hidden; }, getClientRects: () => [{}] });
  const visible = (...images) => observer.callback(images.map((target) => ({ target, isIntersecting: true })));
  return { api: context.GAME_PORTRAITS, ready, idle, calls, image, visible, observer: () => observer };
}
test("portraits wait for final boot state and render one visible image per task", async () => {
  const f = fixture(), first = f.image(), second = f.image(), hidden = f.image();
  f.api.set(first, "old", 80, 100); f.api.set(second, "second", 300, 380); f.api.set(hidden, "hidden", 300, 380);
  f.visible(first, second); await Promise.resolve();
  assert.equal(f.idle.length, 0); assert.equal(f.calls.length, 0);
  f.api.set(first, "final", 80, 100); f.visible(first);
  f.ready(); await Promise.resolve(); f.idle.shift()();
  assert.deepEqual(f.calls, [["final", 80, 100]]);
  assert.equal(f.observer().observed.has(first), false);
  await Promise.resolve(); f.idle.shift()();
  assert.deepEqual(f.calls, [["final", 80, 100], ["second", 300, 380]]);
  assert.equal(hidden.src, undefined);
});
test("replaced and hidden cards never generate obsolete portraits", async () => {
  const f = fixture(), removed = f.image(), hidden = f.image(), detached = f.image();
  for (const image of [removed, hidden, detached]) f.api.set(image, "obsolete", 300, 380);
  f.visible(removed, hidden, detached);
  f.api.clear({ querySelectorAll: () => [removed] }); hidden.hidden = true; detached.isConnected = false;
  f.ready(); await Promise.resolve(); f.idle.shift()();
  assert.deepEqual(f.calls, []); assert.equal(f.observer().observed.has(removed), false);
  hidden.hidden = false; f.api.set(hidden, "new", 420, 520); f.visible(hidden);
  await Promise.resolve(); f.idle.shift()(); assert.deepEqual(f.calls, [["new", 420, 520]]);
});
test("featured portraits take priority over a large visible roster", async () => {
  const f = fixture(), cards = Array.from({ length: 40 }, () => f.image()), hero = f.image();
  for (const image of cards) f.api.set(image, "thumbnail", 80, 100);
  f.api.set(hero, "featured", 420, 520, true); f.visible(...cards, hero);
  f.ready(); await Promise.resolve(); f.idle.shift()();
  assert.deepEqual(f.calls, [["featured", 420, 520]]);
});

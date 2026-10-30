const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
// The free camera (map tour): Ctrl speeds it up and Ctrl+W still flies forward, while in a match a Ctrl combination stays
// blocked from the browser and never reaches the game (js/legacy/106).
const GUARD = fs.readFileSync(path.join(__dirname, "../js/legacy/106-browser-shortcuts-no-longer-stick-keys-ctrl-is-not-a-game-key.js"), "utf8");
const KEYMAP_SRC = fs.readFileSync(path.join(__dirname, "../js/keymap.js"), "utf8");

function page(phase, flying) {
  const listeners = { keydown: [], keyup: [] };
  const ctx = {
    keys: {}, world: { phase }, FLY: { on: flying }, SETTINGS: { binds: {} },
    document: { hidden: false, pointerLockElement: null, addEventListener() {} },
    addEventListener(type, fn, capture) { (listeners[type] || (listeners[type] = [])).push({ fn, capture: !!capture }); },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(KEYMAP_SRC, ctx);
  vm.runInContext(GUARD, ctx);
  // the engine's own key handlers (js/legacy/03-engine.js): bubbling listeners that set and let go of the keys
  ctx.addEventListener("keydown", (e) => ctx.KEYMAP.apply(ctx.keys, e, true));
  ctx.addEventListener("keyup", (e) => ctx.KEYMAP.release(ctx.keys, e));
  const fire = (type, init) => {
    const e = Object.assign({ key: "", code: "", ctrlKey: false, metaKey: false, altKey: false, target: null, prevented: false, stopped: false }, init);
    e.preventDefault = () => { e.prevented = true; };
    e.stopImmediatePropagation = () => { e.stopped = true; };
    const list = listeners[type] || [];
    for (const l of [...list.filter((l) => l.capture), ...list.filter((l) => !l.capture)]) { if (e.stopped) break; l.fn(e); }
    return e;
  };
  return { keys: ctx.keys, fire };
}
const ctrlDown = { key: "Control", code: "ControlLeft", ctrlKey: true };
const ctrlW = { key: "w", code: "KeyW", ctrlKey: true };

test("free camera: holding Ctrl speeds it up and Ctrl+W flies forward", () => {
  const { keys, fire } = page("fly", true);
  fire("keydown", ctrlDown);
  assert.equal(keys.flyFast, true, "Ctrl is the free camera's speed-up");
  const e = fire("keydown", ctrlW);
  assert.equal(keys.w, true, "W under Ctrl still moves");
  assert.equal(e.prevented, true, "the browser gets no shortcut");
  fire("keyup", { key: "w", code: "KeyW", ctrlKey: true });
  assert.equal(keys.w, false);
  fire("keyup", { key: "Control", code: "ControlLeft" });
  assert.equal(keys.flyFast, false, "letting Ctrl go ends the speed-up");
});

test("in a match a Ctrl combination stays blocked and Ctrl is not a game key", () => {
  const { keys, fire } = page("live", false);
  fire("keydown", ctrlDown);
  assert.ok(!keys.flyFast && !keys.control);
  const e = fire("keydown", ctrlW);
  assert.equal(e.prevented, true);
  assert.equal(!!keys.w, false, "Ctrl+W does not move the player");
});

test("the free camera's speed reads the Ctrl flag, not the crouch toggle", () => {
  const src = fs.readFileSync(path.join(__dirname, "../js/legacy/03-engine.js"), "utf8");
  const step = src.slice(src.indexOf("function flyStep("), src.indexOf("function flyStep(") + 600);
  assert.match(step, /FLY\.speed \* \(t\.flyFast \? 2\.6 : 1\)/);
});

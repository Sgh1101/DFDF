const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
// Keys by their place on the keyboard (js/keymap.js) and the sound helpers of js/game-audio.js.
const fresh = () => { globalThis.SETTINGS = { binds: {} }; globalThis.saveSettings = () => { fresh.saved = JSON.stringify(SETTINGS.binds); }; delete require.cache[require.resolve("../js/keymap.js")]; return require("../js/keymap.js"); };
const ev = (code, key = "") => ({ code, key, target: null });

test("defaults are the keys the game always had", () => {
  const K = fresh(), want = {
    forward: ["KeyW"], back: ["KeyS"], left: ["KeyA"], right: ["KeyD"], jump: ["Space"], crouch: ["ShiftLeft", "ShiftRight"], reload: ["KeyR"],
    slot1: ["Digit1", "Numpad1"], slot2: ["Digit2", "Numpad2"], slot3: ["Digit3", "Numpad3"], grenade: ["KeyG"], inspect: ["KeyY"],
    ability1: ["KeyQ"], ability2: ["KeyE"], ability3: ["KeyC"], ability4: ["KeyX"], use: ["KeyF"], plant: ["Digit4", "Numpad4"], shop: ["KeyB"],
    scoreboard: ["Tab"], combatlog: ["KeyN"], map: ["KeyM"], ping: ["KeyV"], quickchat: ["KeyZ"],
  };
  assert.deepEqual(Object.fromEntries(K.ACTIONS.map((a) => [a.id, K.codes(a.id)])), want);
  const keys = {};
  for (const [code, flag] of [["KeyW", "w"], ["KeyS", "s"], ["KeyA", "a"], ["KeyD", "d"], ["Space", "space"], ["ShiftRight", "shift"], ["KeyR", "r"], ["KeyF", "f"], ["Digit4", "4"]]) {
    K.apply(keys, ev(code), true); assert.equal(keys[flag], true, code);
    K.apply(keys, ev(code), false); assert.equal(keys[flag], false, code);
  }
});

test("the code decides, not the typed letter: Hangul and Process still move", () => {
  const K = fresh(), keys = {};
  assert.deepEqual(K.apply(keys, ev("KeyW", "ㅈ"), true), ["forward"]); assert.equal(keys.w, true);
  K.apply(keys, { code: "KeyW", key: "Process", keyCode: 229 }, false); assert.equal(keys.w, false);
  assert.ok(K.is(ev("KeyQ", "ㅂ"), "ability1"));
  // no code at all (a synthetic event): read by the key, as before
  assert.ok(K.is({ key: "w" }, "forward")); assert.ok(K.is({ key: "Shift" }, "crouch")); assert.ok(K.is({ key: " " }, "jump")); assert.ok(K.is({ key: "Tab" }, "scoreboard"));
  assert.deepEqual(K.actionsOf({ key: "ㅈ" }), []);
});

test("rebinding keeps the flag the game reads, and swaps on a conflict", () => {
  const K = fresh(), keys = {};
  assert.deepEqual(K.bind("forward", "KeyI"), { ok: true, swapped: null });
  assert.deepEqual(K.codes("forward"), ["KeyI"]);
  K.apply(keys, ev("KeyI", "ㅑ"), true); assert.equal(keys.w, true, "Forward is still keys.w");
  keys.w = false; K.apply(keys, ev("KeyW"), true); assert.equal(keys.w, false, "the old key no longer goes forward");
  assert.equal(fresh.saved, JSON.stringify({ forward: ["KeyI"] }));
  // Q is Ability 1: Jump takes it and Ability 1 gets Space
  const r = K.bind("jump", "KeyQ"); assert.deepEqual(r, { ok: true, swapped: "ability1" });
  assert.deepEqual(K.codes("jump"), ["KeyQ"]); assert.deepEqual(K.codes("ability1"), ["Space"]);
  assert.ok(K.is(ev("Space"), "ability1")); assert.ok(!K.is(ev("Space"), "jump"));
  // taking one of the two Shift keys leaves Crouch the other
  K.bind("grenade", "ShiftLeft"); assert.deepEqual(K.codes("crouch"), ["ShiftRight"]);
  // each key serves one action
  const all = K.ACTIONS.flatMap((a) => K.codes(a.id)); assert.equal(new Set(all).size, all.length);
  K.reset(); assert.deepEqual(K.codes("forward"), ["KeyW"]); assert.equal(fresh.saved, "{}");
});

test("reserved keys are refused and a damaged save is brought back", () => {
  const K = fresh();
  for (const c of ["Escape", "F9", "ControlLeft", "MetaRight", "AltLeft", "", "Process"]) assert.equal(K.bind("jump", c).ok, false, c);
  assert.deepEqual(K.codes("jump"), ["Space"]);
  globalThis.SETTINGS.binds = { forward: "KeyI", jump: ["Escape"], reload: ["KeyK", "KeyK", "KeyL", "KeyM"], grenade: ["KeyK"], nonsense: ["KeyZ"] };
  assert.deepEqual(K.codes("forward"), ["KeyW"], "a string is not a list of codes");
  assert.deepEqual(K.codes("jump"), ["Space"], "Escape is not bindable");
  assert.deepEqual(K.codes("reload"), ["KeyK", "KeyL"]); assert.deepEqual(K.codes("grenade"), ["KeyG"], "a key already given away is not given twice");
  for (const bad of [null, "x", 5, [1, 2]]) { globalThis.SETTINGS.binds = bad; assert.deepEqual(K.codes("forward"), ["KeyW"]); }
});

test("text fields are not the game's, buttons and sliders are", () => {
  const K = fresh(), el = (tagName, type, isContentEditable) => ({ nodeType: 1, tagName, type, isContentEditable });
  for (const t of [el("INPUT", "text"), el("INPUT", "password"), el("INPUT", "search"), el("INPUT", ""), el("TEXTAREA"), el("SELECT"), el("DIV", "", true)]) assert.equal(K.editing(t), true, t.tagName + t.type);
  for (const t of [el("INPUT", "range"), el("INPUT", "checkbox"), el("BUTTON"), el("DIV", "", false), null]) assert.equal(K.editing(t), false);
});

test("a footstep is panned by where it is, from the listener's yaw", () => {
  const { panFor } = require("../js/game-audio.js");
  const at = { x: 0, z: 0, yaw: 0 }; // facing -z, right is +x
  assert.ok(panFor(at, { x: -10, z: 0 }) < -0.99, "left");
  assert.ok(panFor(at, { x: 10, z: 0 }) > 0.99, "right");
  assert.ok(Math.abs(panFor(at, { x: 0, z: 10 })) < 0.01, "behind: the middle");
  assert.ok(Math.abs(panFor(at, { x: 0, z: -10 })) < 0.01, "ahead: the middle");
  assert.ok(panFor(at, { x: -5, z: 5 }) < -0.6 && panFor(at, { x: 5, z: 5 }) > 0.6, "behind and to a side");
  assert.equal(panFor(at, { x: 0, z: 0 }), 0, "on top of the listener");
  // turned a quarter to the left (yaw +90deg faces -x): what was on the left is now ahead, and what was ahead is on the right
  const left = { x: 0, z: 0, yaw: Math.PI / 2 };
  assert.ok(Math.abs(panFor(left, { x: -10, z: 0 })) < 0.01); assert.ok(panFor(left, { x: 0, z: -10 }) > 0.99);
});

test("every sound reaches the speakers through the volume sliders", () => {
  const root = path.join(__dirname, ".."), bad = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (f.endsWith(".js") && !f.endsWith("game-audio.js") && /\.destination\b/.test(fs.readFileSync(f, "utf8").replace(/\/\/.*$/gm, "")) && /AudioContext|createGain|\bAC\b/.test(fs.readFileSync(f, "utf8"))) bad.push(path.relative(root, f)); });
  walk(path.join(root, "js"));
  assert.deepEqual(bad, [], "these connect to the context's destination and skip the volume sliders");
});

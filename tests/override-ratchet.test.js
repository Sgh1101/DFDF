const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs");
// js/legacy/ grew by taking the game's global functions, wrapping them and putting the wrapper back. The order of play.html
// is then the only record of what runs when (the review of 2026-11-06, point 3). New work goes through js/game-hooks.js
// (GAME_HOOKS.on / run) instead; this count may only go down. Lower LIMIT when a chain is converted.
const LIMIT = 424; // 2026-11-07: netShutdown's ten cleanups became hooks (429 before ranked play and those went)
const files = JSON.parse(fs.readFileSync("js/legacy/manifest.json", "utf8"));
const sites = (name) => {
  const out = [];
  for (const f of files) for (const m of fs.readFileSync(f, "utf8").matchAll(/^\s+([A-Za-z_$][\w$]*) = function\b/gm)) (!name || m[1] === name) && out.push(f.split("/").pop().split("-")[0] + ":" + m[1]);
  return out;
};
test("the game's global functions are reassigned no more often than before (new work uses GAME_HOOKS)", () => {
  const n = sites().length;
  assert.ok(n <= LIMIT, `${n} reassignments of global functions in js/legacy/, the limit is ${LIMIT}: register a hook (js/game-hooks.js) instead of wrapping`);
});
test("netShutdown's cleanups are hooks; only the two that act after the shutdown still wrap it", () => {
  assert.deepEqual(sites("netShutdown"), ["30:netShutdown", "47:netShutdown"]);
  const hooks = require("../js/game-hooks.js"), seen = [];
  hooks.on("t", () => seen.push(1)); hooks.on("t", () => { throw Error("x"); }); hooks.on("t", (a) => seen.push(a));
  const warn = console.warn; console.warn = () => {}; try { hooks.run("t", 2); } finally { console.warn = warn; }
  assert.deepEqual(seen, [1, 2], "in order, and one failing hook does not stop the rest");
});

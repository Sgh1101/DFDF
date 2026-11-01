// Copies the coat-eligible colour groups ([body, trim, dark, glow]) from gun-paint.js into the hard-coded
// palettes of js/phantom-gun-wave.js, so the kill-coat bake recognises the painted colours.
//   node scripts/champions-phantom/sync-wave.js          (run by build.js)
"use strict";
const fs = require("node:fs"), path = require("node:path");
const { PALETTES } = require("./gun-paint");

function sync() {
  const file = path.resolve(__dirname, "../../js/phantom-gun-wave.js");
  const text = (side) => { const p = PALETTES[side]; return JSON.stringify([p.body, p.trim, p.dark, p.glow]); };
  const source = fs.readFileSync(file, "utf8"), pattern = /const palettes=attacker\?(\[\[.*?\]\]):(\[\[.*?\]\]);/;
  if (!pattern.test(source)) throw Error("kill-coat palettes not found in js/phantom-gun-wave.js");
  const next = source.replace(pattern, "const palettes=attacker?" + text("attacker") + ":" + text("defender") + ";");
  if (next !== source) fs.writeFileSync(file, next);
  return next !== source;
}
module.exports = { sync };
if (require.main === module) console.log(sync() ? "kill-coat palettes updated" : "kill-coat palettes already in sync");

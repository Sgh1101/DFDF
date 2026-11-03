// Copies the original gun's coat-eligible colour groups into the runtime atlas baker.
//   node scripts/champions-phantom/sync-wave.js          (run by build.js)
"use strict";
const fs = require("node:fs"), path = require("node:path");
const { wavePalettes } = require("./source-gun/provenance.json");

function sync() {
  const file = path.resolve(__dirname, "../../js/phantom-gun-wave.js");
  const text = (side) => JSON.stringify(wavePalettes[side]);
  const source = fs.readFileSync(file, "utf8"), pattern = /const palettes=attacker\?(\[\[.*?\]\]):(\[\[.*?\]\]);/;
  if (!pattern.test(source)) throw Error("kill-coat palettes not found in js/phantom-gun-wave.js");
  const next = source.replace(pattern, "const palettes=attacker?" + text("attacker") + ":" + text("defender") + ";");
  if (next !== source) fs.writeFileSync(file, next);
  return next !== source;
}
module.exports = { sync };
if (require.main === module) console.log(sync() ? "kill-coat palettes updated" : "kill-coat palettes already in sync");

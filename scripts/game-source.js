// Read classic scripts in their actual HTML order for focused runtime tests.
const fs = require("node:fs"), path = require("node:path");
module.exports = function gameSource() {
  const html = fs.readFileSync("play.html", "utf8");
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].map((match) => {
    const src = /\bsrc=["']([^"']+)/.exec(match[1]);
    if (!src) return match[2];
    if (!src[1].startsWith("./js/")) return "";
    return fs.readFileSync(path.resolve(src[1]), "utf8");
  }).join("\n");
};

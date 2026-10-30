// Writes the article pages (privacy.html, about.html, ... agents.html) and sitemap.xml from scripts/site-pages/.
// The pages about agents, maps and modes are made from scripts/site-pages/data.json, which scripts/dump-site-data.js
// reads out of the running game, so they cannot drift from it. `node scripts/build-site-pages.js` writes the files;
// with --check it writes nothing and exits 1 when a committed file differs from what the sources make.
const fs = require("node:fs"), path = require("node:path");
const { page, ORIGIN } = require("./site-pages/layout");
const root = path.resolve(__dirname, ".."), dir = path.join(__dirname, "site-pages");
// the order here is the order in sitemap.xml
const PAGES = ["guide", "controls", "modes", "maps", "agents", "patch-notes", "about", "contact", "privacy"];
const HOME_LASTMOD = "2026-10-30";
function data() {
  const f = path.join(dir, "data.json");
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
}
function build() {
  const d = data(), out = {}, defs = [];
  for (const name of PAGES) {
    const file = path.join(dir, name + ".js");
    if (!fs.existsSync(file)) continue;
    let def = require(file);
    if (typeof def === "function") def = def(d);
    defs.push(def);
    out[def.file] = page(def);
  }
  const url = (loc, lastmod, freq, prio) => `  <url>\n    <loc>${ORIGIN}${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${prio}</priority>\n  </url>`;
  out["sitemap.xml"] = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[url("/", HOME_LASTMOD, "weekly", "1.0"), url("/play.html", HOME_LASTMOD, "weekly", "0.9")].concat(defs.map((p) => url("/" + p.file, p.lastmod, p.freq || "monthly", p.file === "privacy.html" ? "0.3" : "0.7"))).join("\n")}\n</urlset>\n`;
  return out;
}
if (require.main === module) {
  const files = build(), check = process.argv.includes("--check");
  let stale = 0;
  for (const [name, text] of Object.entries(files)) {
    const f = path.join(root, name), cur = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null;
    if (cur === text) continue;
    if (check) { stale++; console.error("out of date:", name); } else { fs.writeFileSync(f, text); console.log("wrote", name); }
  }
  if (check && stale) process.exit(1);
  check && console.log("site pages are up to date:", Object.keys(files).length, "files");
}
module.exports = { build, PAGES };

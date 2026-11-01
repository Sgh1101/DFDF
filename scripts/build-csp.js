// Content-Security-Policy for the site, written into vercel.json (the header every page and API answer gets).
//   node scripts/build-csp.js          rewrite vercel.json
//   node scripts/build-csp.js --check  fail when vercel.json is not what the pages call for (tests/csp.test.js)
// Scripts: the site's own files (the legacy modules are loaded from ./js), cdnjs (three.js, PeerJS), and the inline ones
// by hash: every <script> block without a src in the pages, and the two onerror="…" handlers play.html puts on its tags
// ('unsafe-hashes'). Change an inline script, run this again; the test fails until you do.
// Ads are not in the policy yet: when AdSense code is added, collect the hosts it needs with a Content-Security-Policy-Report-Only
// header (the pages show them in the console) and add them to AD below, not by guessing.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
const AD = { script: [], connect: [], img: [], frame: [] };
const sha = (text) => "'sha256-" + crypto.createHash("sha256").update(text, "utf8").digest("base64") + "'";

function inlineHashes() {
  const blocks = new Set(), handlers = new Set();
  for (const file of fs.readdirSync(root).filter((f) => f.endsWith(".html")).sort()) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
      const type = /\btype="([^"]*)"/.exec(m[1]);
      if (type && !/^(text|application)\/(javascript|ecmascript)$|^module$/.test(type[1])) continue; // data blocks, not run
      m[2].trim() && blocks.add(sha(m[2]));
    }
    for (const m of html.matchAll(/\son(?:error|load|click)="([^"]*)"/g)) handlers.add(sha(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&")));
  }
  return { blocks: [...blocks].sort(), handlers: [...handlers].sort() };
}

function policy() {
  const { blocks, handlers } = inlineHashes();
  const film = "https://13fps-film.vercel.app", peer = ["https://0.peerjs.com", "wss://0.peerjs.com"];
  return [
    "default-src 'self'",
    ["script-src 'self'", "'unsafe-hashes'", ...handlers, ...blocks, "https://cdnjs.cloudflare.com", ...AD.script].join(" "),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    ["img-src 'self' data: blob:", film, ...AD.img].join(" "),
    ["media-src 'self' data: blob:", film].join(" "),
    ["connect-src 'self' blob: data:", ...peer, ...AD.connect].join(" "),
    "worker-src 'self' blob:",
    AD.frame.length ? "frame-src " + AD.frame.join(" ") : "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; ");
}

// vercel.json, each header rule on a line of its own (as it was written by hand)
function render(config) {
  const lines = (list) => "[\n" + list.map((x) => "    " + JSON.stringify(x)).join(",\n") + "\n  ]";
  const rest = Object.entries(config).filter(([k]) => k !== "headers").map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  return "{\n" + [...rest, `  "headers": ${lines(config.headers)}`].join(",\n") + "\n}\n";
}

function build() {
  const file = path.join(root, "vercel.json"), config = JSON.parse(fs.readFileSync(file, "utf8"));
  const rule = { source: "/(.*)", headers: [{ key: "Content-Security-Policy", value: policy() }] };
  const at = config.headers.findIndex((r) => r.headers.some((h) => h.key === "Content-Security-Policy"));
  at < 0 ? config.headers.splice(1, 0, rule) : (config.headers[at] = rule);
  return { file, text: render(config) };
}

if (require.main === module) {
  const { file, text } = build();
  if (process.argv.includes("--check")) {
    if (fs.readFileSync(file, "utf8") !== text) { console.error("vercel.json's Content-Security-Policy is out of date: run  node scripts/build-csp.js"); process.exit(1); }
    console.log("csp: vercel.json is up to date");
  } else { fs.writeFileSync(file, text); console.log("csp: vercel.json written"); }
}
module.exports = { policy, inlineHashes, build };

// Content-Security-Policy for the site, written to every place a page is served from:
//   vercel.json            the header every page and API answer gets on Vercel
//   _headers               the static files on Cloudflare (wrangler.jsonc)
//   cloudflare/csp.mjs     the header cloudflare/worker.mjs puts on what it answers itself (/, /admin, the API)
//   node scripts/build-csp.js          rewrite them
//   node scripts/build-csp.js --check  fail when any of them is not what the pages call for (tests/csp.test.js)
// Two stages, one switch (MODE below): "report-only" sends Content-Security-Policy-Report-Only, which blocks nothing and
// only logs what would have been blocked (the browser console shows it); "enforce" sends Content-Security-Policy.
// Scripts: the site's own files (the legacy modules are loaded from ./js), cdnjs (three.js, PeerJS), and the inline ones
// by hash: every <script> block without a src in the pages, and the two onerror="…" handlers play.html puts on its tags
// ('unsafe-hashes'). Change an inline script, run this again; the test fails until you do.
// Ads: play.html loads AdSense (the home screen's slot, js/home-ad.js). AD below lists the hosts Google's AdSense CSP
// guidance names (the script, its frames and reports, ad-traffic-quality checks, the consent message from Funding
// Choices); ad pictures come from many hosts, so images allow any https address. Before switching to "enforce", run the
// pages in report-only and add whatever the console still reports.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
const MODE = "report-only"; // "report-only" first, "enforce" when the pages have run under it with nothing reported
const HEADER = MODE === "enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
const G = ["https://pagead2.googlesyndication.com", "https://*.googlesyndication.com", "https://*.adtrafficquality.google", "https://*.doubleclick.net", "https://www.google.com", "https://fundingchoicesmessages.google.com"];
const AD = {
  script: [...G, "https://www.googletagservices.com", "https://adservice.google.com"],
  connect: [...G, "https://adservice.google.com"],
  img: ["https:"],
  frame: [...G],
};
const sha = (text) => "'sha256-" + crypto.createHash("sha256").update(text, "utf8").digest("base64") + "'";

function inlineHashes() {
  const blocks = new Set(), handlers = new Set();
  for (const file of fs.readdirSync(root).filter((f) => f.endsWith(".html")).sort()) {
    // HTML parsers normalize CRLF and lone CR before computing inline script text.
    const html = fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n?/g, "\n");
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

// every file the policy goes into, with the text it must have
function build() {
  const value = policy(), out = [];
  const vercel = path.join(root, "vercel.json"), config = JSON.parse(fs.readFileSync(vercel, "utf8"));
  const rule = { source: "/(.*)", headers: [{ key: HEADER, value }] };
  const at = config.headers.findIndex((r) => r.headers.some((h) => /^Content-Security-Policy/.test(h.key)));
  at < 0 ? config.headers.splice(1, 0, rule) : (config.headers[at] = rule);
  out.push({ file: vercel, text: render(config) });
  // _headers: the line sits in the "/*" rule, after Referrer-Policy
  const headers = path.join(root, "_headers"), old = fs.readFileSync(headers, "utf8").replace(/\r\n?/g, "\n"), line = `  ${HEADER}: ${value}`;
  out.push({ file: headers, text: /^  Content-Security-Policy(-Report-Only)?: .*$/m.test(old) ? old.replace(/^  Content-Security-Policy(-Report-Only)?: .*$/m, () => line) : old.replace(/^(  Referrer-Policy: .*)$/m, (m) => m + "\n" + line) });
  out.push({ file: path.join(root, "cloudflare", "csp.mjs"), text: `// Written by scripts/build-csp.js: the header the Worker puts on what it answers itself.\nexport const CSP = ${JSON.stringify([HEADER, value])};\n` });
  return out;
}

if (require.main === module) {
  const files = build();
  if (process.argv.includes("--check")) {
    const stale = files.filter(({ file, text }) => !fs.existsSync(file) || fs.readFileSync(file, "utf8") !== text);
    if (stale.length) { console.error("Content-Security-Policy is out of date in " + stale.map((f) => path.relative(root, f.file)).join(", ") + ": run  node scripts/build-csp.js"); process.exit(1); }
    console.log("csp: " + files.map((f) => path.relative(root, f.file)).join(", ") + " are up to date");
  } else { for (const { file, text } of files) fs.writeFileSync(file, text); console.log("csp (" + MODE + "): written to " + files.map((f) => path.relative(root, f.file)).join(", ")); }
}
module.exports = { AD, policy, inlineHashes, build, HEADER, MODE };

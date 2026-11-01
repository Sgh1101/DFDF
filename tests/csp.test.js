// The Content-Security-Policy in vercel.json follows the pages: an inline script that changed without
// `node scripts/build-csp.js` would be blocked in the browser, so it fails here first.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { policy, inlineHashes, build } = require("../scripts/build-csp");

const root = path.join(__dirname, "..");

test("vercel.json carries the policy the pages call for", () => {
  const { file, text } = build();
  assert.equal(fs.readFileSync(file, "utf8"), text, "run: node scripts/build-csp.js");
});

test("the policy: scripts by hash, no inline-script allowance, nothing framed, objects off", () => {
  const csp = policy(), dir = Object.fromEntries(csp.split("; ").map((d) => [d.split(" ")[0], d]));
  assert.ok(!/'unsafe-inline'|'unsafe-eval'/.test(dir["script-src"]), dir["script-src"]);
  assert.match(dir["script-src"], /'unsafe-hashes'/);
  assert.ok(dir["script-src"].includes("https://cdnjs.cloudflare.com"));
  assert.equal(dir["object-src"], "object-src 'none'");
  assert.equal(dir["frame-src"], "frame-src 'none'");
  assert.equal(dir["base-uri"], "base-uri 'self'");
  assert.equal(dir["form-action"], "form-action 'self'");
  assert.equal(dir["frame-ancestors"], "frame-ancestors 'self'");
});

test("every inline script block and event attribute of the pages is hashed", () => {
  const { blocks, handlers } = inlineHashes(), csp = policy();
  assert.ok(blocks.length >= 3, "index, play and the owner's page have inline scripts");
  assert.equal(handlers.length, 2, "play.html's two onerror handlers");
  for (const h of [...blocks, ...handlers]) assert.ok(csp.includes(h));
  // a page that grew an event attribute of another kind would be blocked: none may exist
  for (const file of fs.readdirSync(root).filter((f) => f.endsWith(".html")))
    for (const m of fs.readFileSync(path.join(root, file), "utf8").matchAll(/\son([a-z]+)="/g)) assert.equal(m[1], "error", file + " has an on" + m[1] + " attribute");
});

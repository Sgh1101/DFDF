const test = require("node:test"), assert = require("node:assert/strict");
// The colour-blind palettes (js/colorblind.js): each mode keeps the two sides apart for the eyes it is made for, "off" is the
// game's old colours, and only the three known modes exist. The eyes are simulated with the Machado (2009) matrices, severity 1.
const CB = require("../js/colorblind.js");
const M = {
  deut: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  prot: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  trit: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const gam = (c) => 255 * ((c = Math.max(0, Math.min(1, c))) <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const rgb = (h) => (typeof h === "number" ? [(h >> 16) & 255, (h >> 8) & 255, h & 255] : [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
const sim = (h, k) => { const [r, g, b] = rgb(h).map(lin); return M[k].map((row) => gam(row[0] * r + row[1] * g + row[2] * b)); };
const lab = (c) => {
  const [r, g, b] = c.map(lin), f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, y = 0.2126 * r + 0.7152 * g + 0.0722 * b, z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
};
const dE = (a, b, eye) => { const A = lab(eye ? sim(a, eye) : rgb(a)), B = lab(eye ? sim(b, eye) : rgb(b)); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
const use = (mode) => { globalThis.SETTINGS = { colorblind: mode }; return CB; };

test("off is the colours the game always had", () => {
  const P = use("off");
  assert.equal(CB.get("outAlly"), 0x38d6ff); assert.equal(CB.get("outEnemy"), 0xff2e44);
  assert.equal(CB.get("mapAlly"), "#4ade80"); assert.equal(CB.get("mapEnemy"), "#ff3b4e");
  assert.equal(CB.rgba("mapAlly", 0.16), "rgba(74,222,128,0.16)"); assert.equal(CB.rgba("mapEnemy", 0.18), "rgba(255,59,78,0.18)");
  assert.equal(CB.num("good"), 0x4ade80); assert.equal(CB.num("bad"), 0xff3b4e);
});

test("only known modes: anything else is off", () => {
  for (const bad of [undefined, null, "", "x", 1, {}, "RG"]) assert.equal(use(bad).mode(), "off");
  assert.deepEqual(CB.MODES, ["off", "rg", "by"]);
  assert.equal(CB.norm("rg"), "rg");
});

test("the old green and red are the pair that runs together for red-green eyes (why the mode exists)", () => {
  assert.ok(dE("#4ade80", "#ff3b4e", "deut") < 30, "deuteranopia: " + dE("#4ade80", "#ff3b4e", "deut"));
});

test("red-green mode keeps allies and enemies apart for deuteranopia and protanopia, on the outline, the maps and the roster", () => {
  use("rg");
  for (const eye of ["deut", "prot"]) {
    for (const [a, e] of [[CB.get("outAlly"), CB.get("outEnemy")], [CB.get("mapAlly"), CB.get("mapEnemy")], [CB.get("uiAlly"), CB.get("uiFoe")]])
      assert.ok(dE(a, e, eye) > 50, `${eye} ${a} vs ${e}: ${dE(a, e, eye)}`);
    assert.ok(dE(CB.get("good"), CB.get("bad"), eye) > 40, "full and critical health bars: " + eye);
  }
});

test("blue-yellow mode keeps them apart for tritanopia, and apart from the red-green confusions too", () => {
  use("by");
  for (const [a, e] of [[CB.get("outAlly"), CB.get("outEnemy")], [CB.get("mapAlly"), CB.get("mapEnemy")], [CB.get("uiAlly"), CB.get("uiFoe")]]) {
    assert.ok(dE(a, e, "trit") > 50, `trit ${a} vs ${e}: ${dE(a, e, "trit")}`);
    assert.ok(dE(a, e, "deut") > 40 && dE(a, e, "prot") > 35, `${a} vs ${e}: ${dE(a, e, "deut")} ${dE(a, e, "prot")}`);
  }
});

test("a mode changes the colours (every mode is its own palette)", () => {
  const seen = new Set();
  for (const m of CB.MODES) { use(m); seen.add([CB.get("outAlly"), CB.get("outEnemy"), CB.get("mapAlly"), CB.get("mapEnemy")].join()); }
  assert.equal(seen.size, 3);
});

test("rgba and css", () => {
  use("rg");
  assert.equal(CB.rgba("mapEnemy", 0.5), "rgba(255,176,0,0.5)");
  assert.equal(CB.css(0x4db3ff), "#4db3ff");
});

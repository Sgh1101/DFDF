// WCAG 2.x contrast for every text/background pair the film uses. Reads tokens.json.
const T = require("../tokens.json");
const lum = (hex) => { const c = hex.replace("#", "").match(/../g).map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
let fail = 0;
for (const [fg, bg, min, use] of T.pairs) {
  const r = ratio(T.color[fg], T.color[bg]);
  const ok = r >= min; fail += !ok;
  console.log(`${ok ? "pass" : "FAIL"}  ${r.toFixed(2).padStart(5)}:1  (min ${min})  ${fg} on ${bg} — ${use}`);
}
process.exit(fail ? 1 : 0);

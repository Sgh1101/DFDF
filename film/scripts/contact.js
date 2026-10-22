// contact.png: the storyboard as a contact sheet — a still at every beat of the master,
// with its time, scene and what it teaches, plus the same beats in 9:16 and 1:1.
// Needs review/beats/<format>/ (scripts/verify.js writes them).
const path = require("node:path"), fs = require("node:fs");
const { chromium } = require("playwright");
const T = require("../timeline.js");
const ROOT = path.resolve(__dirname, "..");
const list = (f) => fs.readdirSync(path.join(ROOT, "review/beats", f)).filter((n) => n.endsWith(".png")).sort().map((n) => `review/beats/${f}/${n}`);
const scene = (t) => T.scenes.find((s) => t >= s.t0 && t < s.t1);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

const master = list("16x9"), tall = list("9x16"), square = list("1x1");
const cell = (src, i) => { const b = T.beats[i], s = scene(b.t); return `<figure><img src="${src}"><figcaption><b>${b.t.toFixed(1)} s · ${s.id} ${s.arc}</b><span>${esc(b.id.replace(/^S\d /, ""))}</span></figcaption></figure>`; };
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="stylesheet" href="tokens.css"><style>
*{margin:0;padding:0;box-sizing:border-box}body{background:var(--paper);color:var(--ink);font-family:var(--f-body);padding:56px;width:2400px}
h1{font-size:40px;font-weight:700}p.l{font-size:22px;color:var(--ink2);margin:6px 0 28px}
.g{display:grid;grid-template-columns:repeat(5,1fr);gap:20px}figure img{width:100%;display:block;border-radius:8px;box-shadow:0 0 0 1px var(--rule)}
figcaption{display:flex;flex-direction:column;margin-top:8px;font-size:18px}figcaption b{font-weight:700}figcaption span{color:var(--ink2)}
h2{font-size:26px;font-weight:700;margin:40px 0 14px}.row{display:flex;gap:10px;align-items:flex-start}.row img{border-radius:6px;box-shadow:0 0 0 1px var(--rule)}
.tall img{width:138px}.sq img{width:140px}</style></head><body>
<h1>13 · 30초 — 콘택트 시트</h1><p class="l">${esc(T.idea)}</p>
<div class="g">${master.map(cell).join("")}</div>
<h2>9:16</h2><div class="row tall">${tall.map((s) => `<img src="${s}">`).join("")}</div>
<h2>1:1</h2><div class="row sq">${square.map((s) => `<img src="${s}">`).join("")}</div>
</body></html>`;
fs.writeFileSync(path.join(ROOT, "review/contact.html"), html.replace(/(src|href)="(?!http)/g, '$1="../'));
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_BIN || "/opt/pw-browsers/chromium" });
  const p = await b.newPage({ viewport: { width: 2400, height: 1000 } });
  await p.goto("file://" + path.join(ROOT, "review/contact.html"));
  await p.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 60000 });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(ROOT, "contact.png"), fullPage: true });
  await b.close();
  console.log("wrote contact.png");
})().catch((e) => { console.error(e); process.exit(1); });

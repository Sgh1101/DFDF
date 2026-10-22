// Checks that run, not claims. Writes review/verify.json and prints a summary.
//   1. determinism: the same frame rendered in two separate browsers is byte-identical
//   2. text fits: every caption/counter line stays inside the frame with a 48 px margin
//   3. stills at every beat, per format, and a 390 px-wide sheet per format for reading
//   4. flashes: luminance jumps in the rendered videos, max per one-second window
//   5. loudness: integrated LUFS and true peak of each delivered file
const path = require("node:path"), fs = require("node:fs"), crypto = require("node:crypto"), { spawnSync } = require("node:child_process");
const { open, frameAt, stills, SIZES } = require("./render.js");
const { measure } = require("./audio.js");
const T = require("../timeline.js");
const ROOT = path.resolve(__dirname, "..");
const R = {};
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

async function determinism() {
  const t = 19.5, hashes = [];
  for (let i = 0; i < 2; i++) { const { browser, page } = await open("16x9", false); const b = await frameAt(page, t); hashes.push(sha(b)); fs.writeFileSync(path.join(ROOT, `review/determinism-${i + 1}.png`), b); await browser.close(); }
  // also: seeking away and back inside one page paints the same frame (no hidden state)
  const { browser, page } = await open("16x9", false);
  const a = sha(await frameAt(page, t)); await frameAt(page, 3.2); await frameAt(page, 27.9); const b = sha(await frameAt(page, t));
  await browser.close();
  return { t, twoBrowsers: hashes, identical: hashes[0] === hashes[1], seekAwayAndBack: a === b };
}

async function textFits(format, reduced = false) {
  const [W, H] = SIZES[format], { browser, page } = await open(format, reduced), bad = [];
  const times = [...T.copy.map((c) => Math.min(c.t1 - 0.3, Math.max(c.l2at, c.t0) + 0.4)), ...T.clicks.map((k) => k.t + 0.4)];
  for (const t of times) {
    await page.evaluate((x) => window.seek(x), t);
    const boxes = await page.evaluate(() => ["l1", "l2", "cKick", "cNum", "cLab"].map((id) => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return { id, text: e.textContent, x: r.x, y: r.y, r: r.right, b: r.bottom, o: +getComputedStyle(e).opacity }; }).filter((b) => b.text && b.o > 0.5));
    for (const b of boxes) if (b.x < 48 || b.r > W - 48 || b.y < 0 || b.b > H) bad.push({ t, ...b });
  }
  await browser.close();
  return { format, checked: times.length, overflow: bad };
}

function flashes(file) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vf", "scale=320:-2,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-", "-an", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 28 });
  const y = [...r.stdout.matchAll(/YAVG=([\d.]+)/g)].map((m) => +m[1]);
  // a "flash" = average luma changes by more than 10% of full range (25.5 of 255) between frames
  const jumps = []; for (let i = 1; i < y.length; i++) if (Math.abs(y[i] - y[i - 1]) > 25.5) jumps.push(i / T.fps);
  let worst = 0; for (const j of jumps) worst = Math.max(worst, jumps.filter((k) => k >= j && k < j + 1).length);
  return { frames: y.length, bigLumaJumps: jumps.map((j) => +j.toFixed(3)), maxJumpsPerSecond: worst };
}

(async () => {
  fs.mkdirSync(path.join(ROOT, "review"), { recursive: true });
  R.determinism = await determinism();
  R.textFits = [];
  for (const f of Object.keys(SIZES)) R.textFits.push(await textFits(f));
  R.textFits.push({ ...(await textFits("16x9", true)), reduced: true });
  R.stills = {};
  for (const f of Object.keys(SIZES)) {
    const dir = path.join(ROOT, "review/beats", f);
    R.stills[f] = (await stills(f, false, T.beats.map((b) => b.t), dir)).map((p) => path.relative(ROOT, p));
    const cols = f === "9x16" ? 5 : 3;
    spawnSync("ffmpeg", ["-loglevel", "error", "-y", "-pattern_type", "glob", "-i", path.join(dir, "*.png"), "-vf", `scale=390:-2:flags=area,tile=${cols}x${Math.ceil(T.beats.length / cols)}:padding=8:color=0x777777`, "-frames:v", "1", path.join(ROOT, `review/390-${f}.png`)]);
  }
  R.media = {};
  for (const f of ["out/master_16x9.mp4", "out/cut_9x16.mp4", "out/cut_1x1.mp4", "out/cut_reduced_16x9.mp4"]) {
    const file = path.join(ROOT, f);
    if (!fs.existsSync(file)) { R.media[f] = "missing"; continue; }
    const probe = JSON.parse(spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,width,height,pix_fmt,r_frame_rate,sample_rate,channels:format=duration,size", "-of", "json", file], { encoding: "utf8" }).stdout);
    R.media[f] = { probe, loudness: measure(file), flashes: flashes(file) };
  }
  fs.writeFileSync(path.join(ROOT, "review/verify.json"), JSON.stringify(R, null, 2) + "\n");
  console.log(JSON.stringify({ determinism: R.determinism, overflow: R.textFits.map((x) => [x.format + (x.reduced ? " reduced" : ""), x.checked, x.overflow.length]), media: Object.fromEntries(Object.entries(R.media).map(([k, v]) => [k, v === "missing" ? v : { ...v.loudness, maxJumpsPerSecond: v.flashes.maxJumpsPerSecond, jumps: v.flashes.bigLumaJumps.length }])) }, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });

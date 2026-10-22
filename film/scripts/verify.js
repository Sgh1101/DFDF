// Checks that run, not claims. Writes review/verify.json and prints a summary.
//   1. determinism: the same frame rendered in two separate browsers is byte-identical
//   2. captions: every SRT line is on screen during its cue, and nothing else is
//   3. text fits: every caption/counter line stays inside the frame with a 48 px margin
//   4. contrast from pixels: text crops from real frames (opacity and backgrounds included)
//   5. stills at every beat, per format, and a 390 px-wide sheet per format for reading
//   6. per delivered file: probe, loudness, flashes (scripts/pixels.py)
const path = require("node:path"), fs = require("node:fs"), crypto = require("node:crypto"), { spawnSync } = require("node:child_process");
const { open, frameAt, stills, SIZES } = require("./render.js");
const { measure } = require("./audio.js");
const T = require("../timeline.js");
const ROOT = path.resolve(__dirname, "..");
const R = {};
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const py = (...a) => JSON.parse(spawnSync("python3", [path.join(__dirname, "pixels.py"), ...a], { encoding: "utf8", maxBuffer: 1 << 26 }).stdout);
const formats = [["16x9", false], ["9x16", false], ["1x1", false], ["16x9", true]];
const tag = (f, red) => f + (red ? "-reduced" : "");

async function determinism() {
  const t = 25.4, hashes = [];
  for (let i = 0; i < 2; i++) { const { browser, page } = await open("16x9", false); hashes.push(sha(await frameAt(page, t))); await browser.close(); }
  const { browser, page } = await open("16x9", false);
  const a = sha(await frameAt(page, t)); await frameAt(page, 3.2); await frameAt(page, 27.9); const b = sha(await frameAt(page, t));
  await browser.close();
  return { t, twoBrowsers: hashes, identical: hashes[0] === hashes[1], seekAwayAndBack: a === b };
}

// what the viewer can read at t: caption lines, the counter, the typed URL
const VISIBLE = () => {
  const vis = (id) => { const e = document.getElementById(id); return e && e.textContent && +getComputedStyle(e).opacity > 0.5 ? e.textContent : null; };
  const out = [vis("l1"), vis("l2"), vis("cKick")].filter(Boolean);
  const l = vis("cLab"); if (l) out.push((document.getElementById("cNum").textContent + " " + l).trim()); // numeral may still be dim before its click
  const ik = vis("iKick"); if (ik) out.push(ik);
  const il = vis("iLab"); if (il) out.push(`${il} ${document.getElementById("iNum").textContent}${document.getElementById("iUnit").textContent}`);
  const url = document.getElementById("barUrl"); if (+getComputedStyle(document.getElementById("bar")).opacity > 0.5 && +getComputedStyle(url).opacity > 0.5 && url.textContent) out.push("url:" + url.textContent);
  return out;
};
async function captionsMatch(format, reduced) {
  const srt = fs.readFileSync(path.join(ROOT, "captions.srt"), "utf8").trim().split(/\n\n+/).map((b) => { const [, time, ...lines] = b.split("\n"); const [a, z] = time.split(" --> ").map((s) => { const [h, m, x] = s.split(":"); return +h * 3600 + +m * 60 + +x.replace(",", "."); }); return { a, z, lines }; });
  const { browser, page } = await open(format, reduced), bad = [];
  for (const c of srt) {
    const seen = new Set();
    for (let t = c.a + 0.3; t <= c.z - 0.3 + 1e-9; t += 0.1) { await page.evaluate((x) => window.seek(x), t); for (const v of await page.evaluate(VISIBLE)) seen.add(v); }
    const typedOk = (line) => [...seen].some((v) => v.startsWith("url:") && line.startsWith(v.slice(4)) && v.length > 4);
    for (const line of c.lines) if (!seen.has(line) && !typedOk(line)) bad.push({ cue: c.a, missing: line });
    for (const v of seen) if (!v.startsWith("url:") && !c.lines.includes(v)) bad.push({ cue: c.a, extra: v });
  }
  await browser.close();
  return { format: tag(format, reduced), cues: srt.length, problems: bad };
}

async function textFits(format, reduced) {
  const [W, H] = SIZES[format], { browser, page } = await open(format, reduced), bad = [];
  const times = [...T.copy.map((c) => Math.min(c.t1 - 0.3, Math.max(c.l2at, c.t0) + 0.4)), ...T.clicks.map((k) => k.t + 0.3), ...T.inventory.items.map((x) => x.show + 0.4)];
  for (const t of times) {
    await page.evaluate((x) => window.seek(x), t);
    const boxes = await page.evaluate(() => ["l1", "l2", "cKick", "cNum", "cLab", "iKick", "iLab", "iNum", "iUnit"].map((id) => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return { id, text: e.textContent, x: r.x, y: r.y, r: r.right, b: r.bottom, o: +getComputedStyle(e).opacity }; }).filter((b) => b.text && b.o > 0.5));
    for (const b of boxes) if (b.x < 48 || b.r > W - 48 || b.y < 0 || b.b > H) bad.push({ t, ...b });
  }
  await browser.close();
  return { format: tag(format, reduced), checked: times.length, overflow: bad };
}

async function pixelContrast(format) {
  const { browser, page } = await open(format, false), dir = path.join(ROOT, "review/contrast", format), crops = [];
  fs.mkdirSync(dir, { recursive: true });
  const probes = [[1.5, ["l1", "l2", "barLabel"]], [5.2, ["l1", "barUrl"]], [12.7, ["cKick", "cNum", "cLab"]], [18.5, ["l1", "l2"]], [26.5, ["iKick", "iLab", "iNum", "iUnit"]], [34.0, ["l1", "l2", "chip", "mk0", "mk1", "mk5"]], [39.0, ["l1", "l2", "barUrl"]]];
  for (const [t, ids] of probes) {
    await page.evaluate((x) => window.seek(x), t);
    for (const id of ids) {
      const box = await page.evaluate((id) => { const e = id.startsWith("mk") ? document.querySelectorAll(".mk span")[+id.slice(2)] : document.getElementById(id); const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }, id);
      if (box.width < 2) continue;
      const f = path.join(dir, `${t.toFixed(1)}-${id}.png`);
      await page.screenshot({ path: f, clip: { x: Math.max(0, box.x - 2), y: Math.max(0, box.y - 2), width: box.width + 4, height: box.height + 4 } });
      crops.push({ t, id, f });
    }
  }
  await browser.close();
  const res = py("contrast", ...crops.map((c) => c.f));
  return crops.map((c, i) => ({ t: c.t, id: c.id, ratio: res[i].ratio, fg: res[i].fg, bg: res[i].bg }));
}

(async () => {
  fs.mkdirSync(path.join(ROOT, "review"), { recursive: true });
  R.determinism = await determinism();
  R.captions = []; R.textFits = []; R.stills = {};
  for (const [f, red] of formats) { R.captions.push(await captionsMatch(f, red)); R.textFits.push(await textFits(f, red)); }
  R.pixelContrast = {};
  for (const f of Object.keys(SIZES)) R.pixelContrast[f] = await pixelContrast(f);
  for (const [f, red] of formats) {
    const name = tag(f, red), dir = path.join(ROOT, "review/beats", name);
    fs.rmSync(dir, { recursive: true, force: true });
    R.stills[name] = (await stills(f, red, T.beats.map((b) => b.t), dir)).map((p) => path.relative(ROOT, p));
    if (red) continue;
    const cols = f === "9x16" ? 5 : 3;
    spawnSync("ffmpeg", ["-loglevel", "error", "-y", "-pattern_type", "glob", "-i", path.join(dir, "*.png"), "-vf", `scale=390:-2:flags=area,tile=${cols}x${Math.ceil(T.beats.length / cols)}:padding=8:color=0x777777`, "-frames:v", "1", path.join(ROOT, `review/390-${f}.png`)]);
  }
  R.media = {};
  for (const f of ["out/master_16x9.mp4", "out/cut_9x16.mp4", "out/cut_1x1.mp4", "out/cut_reduced_16x9.mp4"]) {
    const file = path.join(ROOT, f);
    if (!fs.existsSync(file)) { R.media[f] = "missing"; continue; }
    const probe = JSON.parse(spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,width,height,pix_fmt,r_frame_rate,nb_frames,sample_rate,channels:format=duration,size", "-of", "json", file], { encoding: "utf8" }).stdout);
    R.media[f] = { probe, loudness: measure(file), flashes: py("flashes", file) };
  }
  fs.writeFileSync(path.join(ROOT, "review/verify.json"), JSON.stringify(R, null, 2) + "\n");
  const minRatio = Object.fromEntries(Object.entries(R.pixelContrast).map(([f, v]) => [f, Math.min(...v.map((x) => x.ratio))]));
  console.log(JSON.stringify({
    determinism: R.determinism,
    captions: R.captions.map((c) => [c.format, c.cues, c.problems]),
    overflow: R.textFits.map((x) => [x.format, x.checked, x.overflow.length]),
    pixelContrastMin: minRatio,
    media: Object.fromEntries(Object.entries(R.media).map(([k, v]) => [k, v === "missing" ? v : { ...v.loudness, flashes: v.flashes.maxFlashesPerSecond }])),
  }, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });

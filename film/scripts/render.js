// Renders film.html. Every frame is seek(n / fps) in headless Chrome, piped to ffmpeg.
//   node scripts/render.js --format 16x9 [--reduced] [--out out/master_16x9.mp4] [--audio out/bed.wav]
//   node scripts/render.js --format 9x16 --stills 1.5,4.9 --dir review/stills   (PNG stills)
//   node scripts/render.js --format 16x9 --fps 12 --scale 0.5 --out review/animatic.mp4   (timing pass)
const path = require("node:path"), fs = require("node:fs"), { spawn } = require("node:child_process");
const { chromium } = require("playwright");
const T = require("../timeline.js");
const ROOT = path.resolve(__dirname, "..");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : true); };
const SIZES = { "16x9": [1920, 1080], "9x16": [1080, 1920], "1x1": [1080, 1080] };

async function open(format, reduced, scale = 1) {
  const [w, h] = SIZES[format];
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--font-render-hinting=none", "--disable-lcd-text", "--force-color-profile=srgb"] });
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  const url = "file://" + path.join(ROOT, "film.html") + `?format=${format}${reduced ? "&reduced=1" : ""}`;
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  if (errors.length) throw new Error(errors.join("\n"));
  return { browser, page, errors };
}
const frameAt = async (page, t) => { await page.evaluate((x) => window.seek(x), t); return page.screenshot({ type: "png", animations: "disabled", caret: "hide" }); };

async function stills(format, reduced, times, dir) {
  const { browser, page } = await open(format, reduced);
  fs.mkdirSync(dir, { recursive: true });
  const files = [];
  for (const t of times) { const f = path.join(dir, `${format}${reduced ? "-reduced" : ""}-${t.toFixed(2).padStart(5, "0")}.png`); fs.writeFileSync(f, await frameAt(page, t)); files.push(f); }
  await browser.close();
  return files;
}

async function video(format, reduced, out, audio, fps = T.fps, scale = 1) {
  const { browser, page } = await open(format, reduced, scale);
  const frames = Math.round(T.duration * fps);
  const args = ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-"];
  if (audio) args.push("-i", audio);
  args.push("-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-r", String(fps), "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709");
  if (audio) args.push("-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-shortest");
  args.push("-movflags", "+faststart", out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const ff = spawn("ffmpeg", args, { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((res, rej) => ff.on("close", (c) => (c ? rej(new Error("ffmpeg " + c)) : res())));
  const t0 = Date.now();
  for (let n = 0; n < frames; n++) {
    const buf = await frameAt(page, n / fps);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (n % 300 === 0) console.log(`${format}${reduced ? " reduced" : ""}: frame ${n}/${frames} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  ff.stdin.end();
  await done;
  await browser.close();
  console.log(`wrote ${out} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

module.exports = { open, frameAt, stills, video, SIZES };

if (require.main === module) {
  (async () => {
    const format = arg("format", "16x9"), reduced = !!arg("reduced", false);
    if (arg("stills")) {
      const list = arg("stills") === "beats" ? T.beats.map((b) => b.t) : String(arg("stills")).split(",").map(Number);
      const files = await stills(format, reduced, list, path.resolve(ROOT, arg("dir", "review/stills")));
      console.log(files.join("\n"));
    } else {
      const out = path.resolve(ROOT, arg("out", `out/${format}.mp4`)), audio = arg("audio") ? path.resolve(ROOT, arg("audio")) : null;
      await video(format, reduced, out, audio, Number(arg("fps", T.fps)), Number(arg("scale", 1)));
    }
  })().catch((e) => { console.error(e); process.exit(1); });
}

// The recorded clips travel in git as near-lossless H.264 (screens/clips/<name>.mp4, a few MB
// each); film.html reads JPEG frames, which are regenerated from the mp4 and not committed.
//   node scripts/clips.js pack     frames (screens/clips/<name>/NNN.jpg) -> <name>.mp4
//   node scripts/clips.js unpack   <name>.mp4 -> frames, then checks the count against timeline.js
const path = require("node:path"), fs = require("node:fs"), { spawnSync } = require("node:child_process");
const T = require("../timeline.js");
const ROOT = path.resolve(__dirname, "..");
const ff = (args) => { const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr); };
const mode = process.argv[2];
let bad = 0;
for (const [name, c] of Object.entries(T.clips)) {
  const dir = path.join(ROOT, c.dir), mp4 = path.join(ROOT, "screens/clips", name + ".mp4");
  if (mode === "pack") {
    const n = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^\d{3}\.jpg$/.test(f)).length : 0;
    if (n !== c.frames) { console.log(`${name}: ${n} frames on disk, timeline wants ${c.frames} — not packed`); bad++; continue; }
    ff(["-framerate", String(c.fps), "-i", path.join(dir, "%03d.jpg"), "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", mp4]);
    console.log(`${name}: ${n} frames -> ${path.relative(ROOT, mp4)} (${(fs.statSync(mp4).size / 1e6).toFixed(1)} MB)`);
  } else if (mode === "unpack") {
    if (!fs.existsSync(mp4)) { console.log(`${name}: ${path.relative(ROOT, mp4)} missing`); bad++; continue; }
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    ff(["-i", mp4, "-q:v", "2", "-start_number", "0", path.join(dir, "%03d.jpg")]);
    const n = fs.readdirSync(dir).filter((f) => /^\d{3}\.jpg$/.test(f)).length;
    if (n !== c.frames) { console.log(`${name}: unpacked ${n} frames, timeline wants ${c.frames}`); bad++; } else console.log(`${name}: ${n} frames`);
  } else { console.log("usage: node scripts/clips.js pack|unpack"); process.exit(2); }
}
process.exit(bad ? 1 : 0);

// Renders the sound bed (film.html renderAudio, OfflineAudioContext) and masters it:
// two-pass ffmpeg loudnorm to -16 LUFS integrated, true peak <= -1.5 dBTP.
//   node scripts/audio.js   -> out/bed.wav (+ out/bed_raw.wav)
const path = require("node:path"), fs = require("node:fs"), { spawnSync } = require("node:child_process");
const { open } = require("./render.js");
const ROOT = path.resolve(__dirname, "..");
const TARGET = { I: -16, TP: -2.0, LRA: 11 }; // TP aims 0.5 dB under the -1.5 limit to leave room for AAC

const ffmpeg = (args) => { const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", ...args], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr); return r.stderr; };
// EBU R128 integrated loudness and true peak from ffmpeg's ebur128 summary
function measure(file) {
  const log = ffmpeg(["-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"]), sum = log.slice(log.lastIndexOf("Summary:"));
  return { I: Number(sum.match(/I:\s+(-?[\d.]+) LUFS/)[1]), TP: Number(sum.match(/Peak:\s+(-?[\d.]+) dBFS/)[1]), LRA: Number(sum.match(/LRA:\s+(-?[\d.]+) LU/)[1]) };
}
module.exports = { measure };

if (require.main === module) {
  (async () => {
    const { browser, page } = await open("16x9", false);
    const b64 = await page.evaluate(() => window.renderAudio());
    await browser.close();
    fs.mkdirSync(path.join(ROOT, "out"), { recursive: true });
    const raw = path.join(ROOT, "out/bed_raw.wav"), bed = path.join(ROOT, "out/bed.wav");
    fs.writeFileSync(raw, Buffer.from(b64, "base64"));
    const norm = `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}`;
    const log = ffmpeg(["-i", raw, "-af", norm + ":print_format=json", "-f", "null", "-"]);
    const m = JSON.parse(log.slice(log.lastIndexOf("{"), log.lastIndexOf("}") + 1));
    ffmpeg(["-y", "-loglevel", "error", "-i", raw, "-af", `${norm}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`, "-ar", "48000", "-c:a", "pcm_s24le", bed]);
    console.log("raw:", measure(raw));
    console.log("bed.wav:", measure(bed));
  })().catch((e) => { console.error(e); process.exit(1); });
}

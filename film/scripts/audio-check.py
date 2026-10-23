# Audio-only check without ears: where do the loud onsets fall, and do they match the
# cue times in timeline.js? Prints each cue with the nearest detected onset.
import json, subprocess, sys, numpy as np
src = sys.argv[1] if len(sys.argv) > 1 else "out/bed.wav"
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-ac", "1", "-ar", "48000", "-f", "f32le", "-"], capture_output=True).stdout
x = np.frombuffer(raw, dtype=np.float32)
hop = 240  # 5 ms
frames = len(x) // hop
# spectral flux on a high-passed copy (cues are brighter than the bed)
hp = np.append(x[0], x[1:] - 0.97 * x[:-1])
env = np.sqrt(np.mean(hp[: frames * hop].reshape(frames, hop) ** 2, axis=1) + 1e-12)
db = 20 * np.log10(env)
flux = np.maximum(0, np.diff(db, prepend=db[0]))
onsets = [i * hop / 48000 for i in range(1, frames - 1) if flux[i] > 6 and flux[i] >= flux[i - 1] and flux[i] >= flux[i + 1] and db[i] > db.max() - 40]
cues = json.loads(subprocess.run(["node", "-e", "console.log(JSON.stringify(require('./timeline.js').cues))"], capture_output=True, text=True).stdout)
print(f"{len(onsets)} onsets detected; peak level {db.max():.1f} dB (5 ms RMS, pre-emphasised)")
for c in cues:
    if c["type"] in ("ticks", "drone", "bed"): continue
    near = min(onsets, key=lambda o: abs(o - c["t"])) if onsets else None
    print(f'{c["t"]:6.2f}s {c["type"]:6s} nearest onset {near:6.3f}s  (Δ {1000 * (near - c["t"]):+.0f} ms)')
# silence at the very end (tail should resolve, not cut)
tail = db[-int(0.2 * 48000 / hop):]
print(f"last 200 ms level: {tail.mean():.1f} dB vs peak {db.max():.1f} dB")
# cue audibility: 1-4 kHz band level just after each cue vs the 100 ms before it
from numpy.fft import rfft, rfftfreq
def band(t0, t1):
    seg = x[int(t0 * 48000):int(t1 * 48000)] * np.hanning(int(t1 * 48000) - int(t0 * 48000))
    f, s = rfftfreq(len(seg), 1 / 48000), np.abs(rfft(seg)) ** 2
    return 10 * np.log10(s[(f > 1000) & (f < 4000)].sum() + 1e-12)
for c in cues:
    if c["type"] in ("click", "pop", "motif", "plant", "head", "legend", "whoosh", "swap"):
        print(f'{c["t"]:6.2f}s {c["type"]:6s} 1-4 kHz rise {band(c["t"], c["t"] + 0.08) - band(c["t"] - 0.1, c["t"] - 0.02):+5.1f} dB')

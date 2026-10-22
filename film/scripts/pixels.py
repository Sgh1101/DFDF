# Pixel-level checks the token table can't make.
#   python3 scripts/pixels.py contrast crop1.png crop2.png ...
#       per crop: background = most common colour, text = the pixel with the highest
#       contrast against it; prints the WCAG ratio between the two (opacity included).
#   python3 scripts/pixels.py flashes video.mp4
#       WCAG 2.3.1 general and red flash, approximated: the frame is split into a 4x4 grid
#       (each block about the area the guideline calls "significant" at phone distance);
#       a flash is a pair of opposing changes of >= 0.1 relative luminance where the darker
#       state is < 0.8, or a pair of transitions into/out of saturated red. Prints the most
#       flashes found in any one-second window, per kind.
import json, subprocess, sys
import numpy as np
from PIL import Image

def lin(c):
    c = c / 255.0
    return np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

def rel_lum(rgb):
    l = lin(rgb.astype(np.float64))
    return 0.2126 * l[..., 0] + 0.7152 * l[..., 1] + 0.0722 * l[..., 2]

def contrast(files):
    out = []
    for f in files:
        px = np.asarray(Image.open(f).convert("RGB")).reshape(-1, 3)
        q = (px // 8) * 8
        keys, counts = np.unique(q, axis=0, return_counts=True)
        bg = px[(q == keys[counts.argmax()]).all(axis=1)].mean(axis=0)
        lb, lp = rel_lum(bg[None])[0], rel_lum(px)
        r = (np.maximum(lb, lp) + 0.05) / (np.minimum(lb, lp) + 0.05)
        out.append({"file": f, "ratio": round(float(r.max()), 2), "bg": [int(v) for v in bg], "fg": [int(v) for v in px[r.argmax()]]})
    print(json.dumps(out))

def flashes(video):
    w, h, fps = 160, 96, 60
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-vf", f"scale={w}:{h}:flags=area", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"], capture_output=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)
    L = rel_lum(fr)
    s = fr.astype(np.float64).sum(axis=3) + 1e-9
    red = ((fr[..., 0] / s) >= 0.8) & (fr[..., 0] > 60)
    worst = {"general": 0, "red": 0}
    for by in range(4):
        for bx in range(4):
            ys, xs = slice(by * h // 4, (by + 1) * h // 4), slice(bx * w // 4, (bx + 1) * w // 4)
            lum = L[:, ys, xs].mean(axis=(1, 2))
            redfrac = red[:, ys, xs].mean(axis=(1, 2))
            # general: transitions between running extremes
            trans, ref, d = [], lum[0], 0
            for i in range(1, len(lum)):
                if abs(lum[i] - ref) >= 0.1 and min(lum[i], ref) < 0.8:
                    nd = 1 if lum[i] > ref else -1
                    if nd != d: trans.append(i); d = nd
                    ref = lum[i]
                elif (d == 1 and lum[i] > ref) or (d == -1 and lum[i] < ref):
                    ref = lum[i]
            rtrans = [i for i in range(1, len(redfrac)) if (redfrac[i] >= 0.25) != (redfrac[i - 1] >= 0.25)]
            for kind, tr in (("general", trans), ("red", rtrans)):
                # a flash = two opposing transitions; count them in every one-second window
                for i in tr:
                    worst[kind] = max(worst[kind], sum(1 for k in tr if i <= k < i + fps) // 2)
    print(json.dumps({"frames": int(len(fr)), "maxFlashesPerSecond": worst}))

if __name__ == "__main__":
    {"contrast": lambda a: contrast(a), "flashes": lambda a: flashes(a[0])}[sys.argv[1]](sys.argv[2:])

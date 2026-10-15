function cvsTex(e, t, o, a, n) {
  const r = document.createElement("canvas");
  ((r.width = e), (r.height = t), o(r.getContext("2d"), e, t));
  const s = new THREE.CanvasTexture(r);
  return (
    (s.wrapS = s.wrapT = THREE.RepeatWrapping),
    s.repeat.set(a || 1, n || 1),
    (s.anisotropy = 4),
    s
  );
}
registerMaps(MAP);
const _cl = (e) => (e < 0 ? 0 : e > 255 ? 255 : e),
  noise = (e, t, o, a) => {
    const n = e.getImageData(0, 0, t, o),
      r = n.data;
    for (let e = 0; e < r.length; e += 4) {
      const t = (Math.random() - 0.5) * a;
      ((r[e] = _cl(r[e] + t)),
        (r[e + 1] = _cl(r[e + 1] + t)),
        (r[e + 2] = _cl(r[e + 2] + t)));
    }
    e.putImageData(n, 0, 0);
  },
  TEX_STONE = cvsTex(
    256,
    256,
    (e, t, o) => {
      ((e.fillStyle = "#3e4652"), e.fillRect(0, 0, t, o));
      const a = 64;
      for (let n = 0; n < o / a; n++)
        for (let o = 0; o < t / a; o++) {
          const r = (o * a + ((n % 2) * a) / 2) % t,
            s = n * a,
            i = 16 * Math.random() - 8;
          ((e.fillStyle = `rgb(${92 + i},${99 + i},${110 + i})`),
            e.fillRect(r + 1.5, s + 1.5, 61, 61),
            (e.strokeStyle = "rgba(18,22,30,.85)"),
            (e.lineWidth = 3),
            e.strokeRect(r + 1.5, s + 1.5, 61, 61),
            (e.fillStyle = `rgba(${40 + 30 * Math.random()},${48 + 30 * Math.random()},60,.14)`),
            e.beginPath(),
            e.arc(r + a * Math.random(), s + a * Math.random(), 16.64, 0, 7),
            e.fill());
        }
      noise(e, t, o, 18);
    },
    26,
    33,
  ),
  TEX_PLASTER = cvsTex(
    256,
    256,
    (e, t, o) => {
      ((e.fillStyle = "#8d98a6"), e.fillRect(0, 0, t, o));
      for (let a = 0; a < 200; a++)
        ((e.fillStyle = `rgba(${120 + 60 * Math.random()},${130 + 60 * Math.random()},${142 + 50 * Math.random()},.20)`),
          e.beginPath(),
          e.arc(
            Math.random() * t,
            Math.random() * o,
            26 * Math.random() + 6,
            0,
            7,
          ),
          e.fill());
      for (let a = 0; a < 8; a++) {
        const a = Math.random() * t,
          n = e.createLinearGradient(a, 0, a, o);
        (n.addColorStop(0, "rgba(80,92,108,.22)"),
          n.addColorStop(1, "rgba(80,92,108,0)"),
          (e.fillStyle = n),
          e.fillRect(a, 0, 22 * Math.random() + 6, o));
      }
      noise(e, t, o, 14);
    },
    4,
    2,
  ),
  TEX_WOOD = cvsTex(
    128,
    256,
    (e, t, o) => {
      ((e.fillStyle = "#7a4d2b"), e.fillRect(0, 0, t, o));
      for (let a = 0; a < 52; a++) {
        ((e.strokeStyle = `rgba(${60 + 70 * Math.random()},${34 + 40 * Math.random()},${16 + 24 * Math.random()},.5)`),
          (e.lineWidth = 4 * Math.random() + 1),
          e.beginPath());
        const a = Math.random() * t;
        (e.moveTo(a, 0),
          e.bezierCurveTo(
            a + 12,
            0.3 * o,
            a - 12,
            0.6 * o,
            a + 10 * Math.random() - 5,
            o,
          ),
          e.stroke());
      }
      noise(e, t, o, 12);
    },
    1,
    3,
  ),
  TEX_TILE = cvsTex(
    256,
    128,
    (e, t, o) => {
      ((e.fillStyle = "#2e3640"), e.fillRect(0, 0, t, o));
      for (let t = 0; t < 8; t++) {
        const a = 32 * t + 16,
          n = e.createLinearGradient(a - 16, 0, a + 16, 0);
        (n.addColorStop(0, "#1e242c"),
          n.addColorStop(0.5, "#485462"),
          n.addColorStop(1, "#1e242c"),
          (e.fillStyle = n),
          e.fillRect(32 * t, 0, 32, o),
          (e.strokeStyle = "rgba(16,20,26,.8)"),
          (e.lineWidth = 2),
          e.beginPath(),
          e.moveTo(32 * t, 0),
          e.lineTo(32 * t, o),
          e.stroke());
      }
      noise(e, t, o, 10);
    },
    6,
    2,
  ),
  TEX_PANEL = cvsTex(
    128,
    128,
    (e, t, o) => {
      ((e.fillStyle = "#59636f"),
        e.fillRect(0, 0, t, o),
        (e.strokeStyle = "rgba(30,36,44,.7)"),
        (e.lineWidth = 3),
        e.strokeRect(4, 4, t - 8, o - 8));
      for (let t = 0; t < 4; t++)
        for (let o = 0; o < 4; o++)
          ((e.fillStyle = "rgba(150,162,176,.55)"),
            e.beginPath(),
            e.arc(16 + 32 * t, 16 + 32 * o, 3, 0, 7),
            e.fill(),
            (e.fillStyle = "rgba(24,28,34,.5)"),
            e.beginPath(),
            e.arc(16 + 32 * t, 17.5 + 32 * o, 3, 0, 7),
            e.fill());
      noise(e, t, o, 16);
    },
    2,
    2,
  ),
  TEX_SNOW = cvsTex(
    256,
    256,
    (e, t, o) => {
      ((e.fillStyle = "#d8e4ee"), e.fillRect(0, 0, t, o));
      for (let a = 0; a < 300; a++) {
        const a = 26 * Math.random() + 6;
        ((e.fillStyle = `rgba(255,255,255,${0.5 * Math.random()})`),
          e.beginPath(),
          e.arc(Math.random() * t, Math.random() * o, a, 0, 7),
          e.fill());
      }
      for (let a = 0; a < 40; a++)
        ((e.fillStyle = `rgba(150,170,190,${0.25 * Math.random()})`),
          e.fillRect(
            Math.random() * t,
            Math.random() * o,
            40 * Math.random() + 10,
            8 * Math.random() + 2,
          ));
      noise(e, t, o, 14);
    },
    3,
    3,
  ),
  TEX_ICEPANEL = cvsTex(
    128,
    128,
    (e, t, o) => {
      ((e.fillStyle = "#8fa6b8"),
        e.fillRect(0, 0, t, o),
        (e.fillStyle = "#a8bccc"),
        e.fillRect(4, 4, t - 8, o - 8),
        (e.strokeStyle = "rgba(60,80,100,.6)"),
        (e.lineWidth = 3),
        e.strokeRect(4, 4, t - 8, o - 8));
      for (let t = 0; t < 6; t++)
        ((e.fillStyle = "#6f8698"),
          e.beginPath(),
          e.arc(14 + (t % 3) * 50, 14 + 100 * Math.floor(t / 3), 3.5, 0, 7),
          e.fill());
      noise(e, t, o, 16);
    },
    2,
    2,
  ),
  TEX_SAND = cvsTex(
    256,
    256,
    (e, t, o) => {
      ((e.fillStyle = "#c2a878"), e.fillRect(0, 0, t, o));
      for (let a = 0; a < 500; a++) {
        const a = 40 * Math.random() - 20;
        ((e.fillStyle = `rgba(${194 + a},${168 + a},${120 + a},.5)`),
          e.fillRect(
            Math.random() * t,
            Math.random() * o,
            6 * Math.random() + 2,
            6 * Math.random() + 2,
          ));
      }
      for (let a = 0; a < 14; a++)
        ((e.strokeStyle = "rgba(120,96,60,.3)"),
          (e.lineWidth = 3 * Math.random() + 1),
          e.beginPath(),
          e.moveTo(Math.random() * t, 0),
          e.lineTo(Math.random() * t, o),
          e.stroke());
      noise(e, t, o, 20);
    },
    4,
    4,
  ),
  TEX_SANDSTONE = cvsTex(
    256,
    256,
    (e, t, o) => {
      ((e.fillStyle = "#8a6f4a"), e.fillRect(0, 0, t, o));
      for (let a = 0; a < o / 42; a++)
        for (let o = 0; o < t / 72; o++) {
          const n = (72 * o + (a % 2) * 36) % t,
            r = 42 * a,
            s = 22 * Math.random() - 11;
          ((e.fillStyle = `rgb(${176 + s},${146 + s},${100 + s})`),
            e.fillRect(n + 2, r + 2, 68, 38),
            (e.strokeStyle = "rgba(70,54,32,.7)"),
            (e.lineWidth = 2.5),
            e.strokeRect(n + 2, r + 2, 68, 38));
        }
      noise(e, t, o, 16);
    },
    2,
    2,
  ),
  TEX_DECK = cvsTex(
    256,
    256,
    (e, t, o) => {
      ((e.fillStyle = "#4a5258"), e.fillRect(0, 0, t, o));
      for (let a = 0; a < o; a += 16)
        ((e.fillStyle = a % 32 ? "#525a60" : "#454d53"),
          e.fillRect(0, a, t, 15));
      for (let a = 0; a < 60; a++) {
        const a = 22 * Math.random() + 5;
        ((e.fillStyle = `rgba(${140 + 60 * Math.random()},${70 + 30 * Math.random()},30,${0.4 * Math.random()})`),
          e.beginPath(),
          e.arc(Math.random() * t, Math.random() * o, a, 0, 7),
          e.fill());
      }
      for (let a = 0; a < o; a += 64) {
        e.fillStyle = "#39414a";
        for (let o = 6; o < t; o += 22)
          (e.beginPath(), e.arc(o, a + 8, 2.6, 0, 7), e.fill());
      }
      noise(e, t, o, 18);
    },
    3,
    3,
  ),
  TEX_CONTAINER = cvsTex(
    128,
    128,
    (e, t, o) => {
      ((e.fillStyle = "#2f6b7a"), e.fillRect(0, 0, t, o));
      for (let a = 0; a < t; a += 16)
        ((e.fillStyle = a % 32 ? "#357888" : "#2a606e"),
          e.fillRect(a, 0, 15, o));
      for (let a = 0; a < 24; a++)
        ((e.fillStyle = `rgba(${150 + 60 * Math.random()},${70 + 30 * Math.random()},28,${0.45 * Math.random()})`),
          e.fillRect(
            Math.random() * t,
            Math.random() * o,
            18 * Math.random() + 4,
            12 * Math.random() + 3,
          ));
      noise(e, t, o, 16);
    },
    2,
    2,
  ),
  TEX_WETASPHALT = cvsTex(
    256,
    256,
    (e, t, o) => {
      ((e.fillStyle = "#12151c"), e.fillRect(0, 0, t, o));
      for (let a = 0; a < 400; a++) {
        const a = 26 * Math.random();
        ((e.fillStyle = `rgba(${30 + a},${34 + a},${44 + a},.6)`),
          e.fillRect(
            Math.random() * t,
            Math.random() * o,
            5 * Math.random() + 1,
            5 * Math.random() + 1,
          ));
      }
      for (let a = 0; a < 10; a++) {
        const n = Math.random() * t,
          r = Math.random() * o,
          s = e.createRadialGradient(n, r, 0, n, r, 40 * Math.random() + 18),
          i = ["255,60,120", "60,200,255", "180,80,255"][a % 3];
        (s.addColorStop(0, `rgba(${i},.22)`),
          s.addColorStop(1, "rgba(0,0,0,0)"),
          (e.fillStyle = s),
          e.beginPath(),
          e.arc(n, r, 44, 0, 7),
          e.fill());
      }
      noise(e, t, o, 10);
    },
    3,
    3,
  ),
  TEX_GLASSWALL = cvsTex(
    128,
    256,
    (e, t, o) => {
      ((e.fillStyle = "#0d1420"), e.fillRect(0, 0, t, o));
      for (let a = 0; a < o / 32; a++)
        for (let o = 0; o < t / 32; o++) {
          if (Math.random() > 0.72) {
            const t = ["#2de0ff", "#ff3d7f", "#b06bff", "#ffd23d"][
              Math.floor(4 * Math.random())
            ];
            ((e.fillStyle = t), (e.globalAlpha = 0.34 + 0.4 * Math.random()));
          } else ((e.fillStyle = "#16202e"), (e.globalAlpha = 1));
          (e.fillRect(32 * o + 2, 32 * a + 2, 28, 28),
            (e.globalAlpha = 1),
            (e.strokeStyle = "rgba(90,120,160,.5)"),
            (e.lineWidth = 2),
            e.strokeRect(32 * o + 2, 32 * a + 2, 28, 28));
        }
      noise(e, t, o, 8);
    },
    3,
    2,
  ),
  TEX_GRAVEL = cvsTex(
    256,
    256,
    (e, t, o) => {
      ((e.fillStyle = "#8c7d68"), e.fillRect(0, 0, t, o));
      for (let a = 0; a < 900; a++) {
        const a = 30 * Math.random() - 15;
        ((e.fillStyle = `rgba(${150 + a},${136 + a},${112 + a},.55)`),
          e.fillRect(
            Math.random() * t,
            Math.random() * o,
            3 * Math.random() + 1,
            3 * Math.random() + 1,
          ));
      }
      for (let a = 0; a < 6; a++) {
        const a = Math.random() * t,
          n = Math.random() * o,
          r = 18 + 14 * Math.random();
        ((e.fillStyle = "rgba(120,114,104,.9)"),
          e.beginPath(),
          e.ellipse(a, n, r, 0.7 * r, Math.random() * 3, 0, 7),
          e.fill(),
          (e.strokeStyle = "rgba(60,52,44,.6)"),
          (e.lineWidth = 2),
          e.stroke());
      }
      noise(e, t, o, 14);
    },
    30,
    38,
  ),
  TEX_MOSSSTONE = cvsTex(
    256,
    256,
    (e, t, o) => {
      ((e.fillStyle = "#3c423c"), e.fillRect(0, 0, t, o));
      for (let a = 0; a < 5; a++)
        for (let n = 0; n < 5; n++) {
          const r = 51.2 * n + 8 * Math.random() - 4,
            s = 51.2 * a + 8 * Math.random() - 4,
            i = 16 * Math.random() - 8;
          ((e.fillStyle = `rgb(${104 + i},${108 + i},${102 + i})`),
            e.fillRect(
              r + 2,
              s + 2,
              46 + 6 * Math.random(),
              46 + 6 * Math.random(),
            ));
        }
      for (let a = 0; a < 40; a++)
        ((e.fillStyle = `rgba(${60 + 30 * Math.random()},${96 + 40 * Math.random()},52,.4)`),
          e.beginPath(),
          e.arc(
            Math.random() * t,
            Math.random() * o,
            4 + 14 * Math.random(),
            0,
            7,
          ),
          e.fill());
      noise(e, t, o, 18);
    },
    30,
    24,
  ),
  TEX_TEMPLEWALL = cvsTex(
    256,
    256,
    (e, t, o) => {
      ((e.fillStyle = "#4a4e4c"), e.fillRect(0, 0, t, o));
      for (let a = 0; a < o / 40; a++)
        for (let n = 0; n < t / 64; n++) {
          const r = (64 * n + (a % 2) * 32) % t,
            s = 40 * a,
            i = 18 * Math.random() - 9;
          ((e.fillStyle = `rgb(${120 + i},${122 + i},${116 + i})`),
            e.fillRect(r + 2, s + 2, 60, 36),
            (e.strokeStyle = "rgba(40,42,40,.7)"),
            (e.lineWidth = 2.5),
            e.strokeRect(r + 2, s + 2, 60, 36));
        }
      for (let a = 0; a < 14; a++) {
        const a = Math.random() * t,
          n = e.createLinearGradient(a, o, a, o - 90 * Math.random() - 30);
        (n.addColorStop(0, "rgba(70,110,60,.55)"),
          n.addColorStop(1, "rgba(70,110,60,0)"),
          (e.fillStyle = n),
          e.fillRect(a, 0, 10 + 16 * Math.random(), o));
      }
      noise(e, t, o, 16);
    },
    2,
    2,
  ),
  TEX_BRICK = cvsTex(
    256,
    256,
    (e, t, o) => {
      ((e.fillStyle = "#5a3a30"), e.fillRect(0, 0, t, o));
      for (let a = 0; a < o / 16; a++)
        for (let n = 0; n < t / 40; n++) {
          const r = (40 * n + (a % 2) * 20) % t,
            s = 16 * a,
            i = 24 * Math.random() - 12;
          ((e.fillStyle = `rgb(${148 + i},${78 + i / 2},${60 + i / 3})`),
            e.fillRect(r + 1, s + 1, 38, 14));
        }
      for (let a = 0; a < 30; a++)
        ((e.fillStyle = `rgba(220,220,210,${0.12 * Math.random()})`),
          e.fillRect(
            Math.random() * t,
            Math.random() * o,
            30 * Math.random() + 6,
            8 * Math.random() + 2,
          ));
      noise(e, t, o, 16);
    },
    3,
    2,
  ),
  TEX_CONCRETE = cvsTex(
    256,
    256,
    (e, t, o) => {
      ((e.fillStyle = "#8e9296"), e.fillRect(0, 0, t, o));
      for (let a = 0; a < 300; a++) {
        const a = 22 * Math.random() - 11;
        ((e.fillStyle = `rgba(${140 + a},${144 + a},${148 + a},.4)`),
          e.beginPath(),
          e.arc(
            Math.random() * t,
            Math.random() * o,
            10 * Math.random() + 2,
            0,
            7,
          ),
          e.fill());
      }
      ((e.strokeStyle = "rgba(50,54,58,.55)"), (e.lineWidth = 2));
      for (let a = 0; a <= t; a += 128)
        (e.beginPath(),
          e.moveTo(a, 0),
          e.lineTo(a, o),
          e.stroke(),
          e.beginPath(),
          e.moveTo(0, a),
          e.lineTo(t, a),
          e.stroke());
      for (let a = 0; a < 8; a++)
        ((e.fillStyle = "rgba(60,50,40,.18)"),
          e.beginPath(),
          e.arc(
            Math.random() * t,
            Math.random() * o,
            20 * Math.random() + 8,
            0,
            7,
          ),
          e.fill());
      noise(e, t, o, 14);
    },
    24,
    30,
  ),
  TEX_BASALT = cvsTex(
    256,
    256,
    (e, t, o) => {
      ((e.fillStyle = "#1c1a1a"), e.fillRect(0, 0, t, o));
      for (let a = 0; a < 600; a++) {
        const a = 20 * Math.random();
        ((e.fillStyle = `rgba(${40 + a},${36 + a},${34 + a},.6)`),
          e.fillRect(
            Math.random() * t,
            Math.random() * o,
            5 * Math.random() + 1,
            5 * Math.random() + 1,
          ));
      }
      for (let a = 0; a < 3; a++) {
        let a = Math.random() * t,
          n = Math.random() * o;
        ((e.strokeStyle = `rgba(255,${80 + 40 * Math.random()},20,.38)`),
          (e.lineWidth = 0.8 + 0.8 * Math.random()),
          (e.shadowColor = "#ff5a10"),
          (e.shadowBlur = 3),
          e.beginPath(),
          e.moveTo(a, n));
        for (let r = 0; r < 6; r++)
          ((a += 24 * Math.random() - 12),
            (n += 24 * Math.random() - 12),
            e.lineTo(a, n));
        e.stroke();
      }
      ((e.shadowBlur = 0), noise(e, t, o, 12));
    },
    26,
    18,
  ),
  TEX_FORGEWALL = cvsTex(
    128,
    128,
    (e, t, o) => {
      ((e.fillStyle = "#2c2a28"), e.fillRect(0, 0, t, o));
      for (let a = 0; a < 2; a++)
        for (let n = 0; n < 2; n++) {
          const r = 14 * Math.random() - 7;
          ((e.fillStyle = `rgb(${58 + r},${54 + r},${50 + r})`),
            e.fillRect(64 * n + 2, 64 * a + 2, 60, 60),
            (e.fillStyle = "rgba(20,18,16,.8)"));
          for (const [s, i] of [
            [8, 8],
            [56, 8],
            [8, 56],
            [56, 56],
          ])
            (e.beginPath(), e.arc(64 * n + s, 64 * a + i, 2.6, 0, 7), e.fill());
        }
      for (let a = 0; a < 18; a++)
        ((e.fillStyle = `rgba(${120 + 60 * Math.random()},${50 + 20 * Math.random()},20,${0.35 * Math.random()})`),
          e.fillRect(
            Math.random() * t,
            Math.random() * o,
            14 * Math.random() + 3,
            20 * Math.random() + 4,
          ));
      noise(e, t, o, 14);
    },
    2,
    2,
  ),
  TEX_GRASS = cvsTex(
    256,
    256,
    (e, t, o) => {
      ((e.fillStyle = "#34512a"), e.fillRect(0, 0, t, o));
      for (let a = 0; a < 1400; a++) {
        const a = 30 * Math.random() - 15;
        ((e.strokeStyle = `rgba(${60 + a},${104 + a},${48 + a / 2},.6)`),
          (e.lineWidth = 1.2));
        const n = Math.random() * t,
          r = Math.random() * o;
        (e.beginPath(),
          e.moveTo(n, r),
          e.lineTo(n + 3 * Math.random() - 1.5, r - 6 * Math.random() - 2),
          e.stroke());
      }
      for (let a = 0; a < 10; a++)
        ((e.fillStyle = "rgba(96,74,48,.35)"),
          e.beginPath(),
          e.arc(
            Math.random() * t,
            Math.random() * o,
            10 + 20 * Math.random(),
            0,
            7,
          ),
          e.fill());
      noise(e, t, o, 16);
    },
    24,
    28,
  ),
  TEX_RUIN = cvsTex(
    256,
    256,
    (e, t, o) => {
      ((e.fillStyle = "#3e4436"), e.fillRect(0, 0, t, o));
      for (let a = 0; a < o / 42; a++)
        for (let n = 0; n < t / 70; n++) {
          const r = (70 * n + (a % 2) * 35) % t,
            s = 42 * a,
            i = 20 * Math.random() - 10;
          ((e.fillStyle = `rgb(${112 + i},${116 + i},${96 + i})`),
            e.fillRect(r + 2, s + 2, 66, 38),
            (e.strokeStyle = "rgba(36,40,30,.75)"),
            (e.lineWidth = 2.5),
            e.strokeRect(r + 2, s + 2, 66, 38));
        }
      for (let a = 0; a < 60; a++)
        ((e.fillStyle = `rgba(${50 + 30 * Math.random()},${100 + 50 * Math.random()},40,.45)`),
          e.beginPath(),
          e.arc(
            Math.random() * t,
            Math.random() * o,
            3 + 10 * Math.random(),
            0,
            7,
          ),
          e.fill());
      noise(e, t, o, 16);
    },
    2,
    2,
  ),
  MAT = {
    floor: new THREE.MeshStandardMaterial({
      map: TEX_STONE,
      roughness: 0.92,
      metalness: 0.04,
    }),
    wall: new THREE.MeshStandardMaterial({
      map: TEX_PLASTER,
      roughness: 0.9,
      metalness: 0.03,
    }),
    wood: new THREE.MeshStandardMaterial({
      map: TEX_WOOD,
      roughness: 0.78,
      metalness: 0.02,
    }),
    tile: new THREE.MeshStandardMaterial({
      map: TEX_TILE,
      roughness: 0.62,
      metalness: 0.22,
    }),
    panel: new THREE.MeshStandardMaterial({
      map: TEX_PANEL,
      roughness: 0.58,
      metalness: 0.55,
    }),
    beamRed: new THREE.MeshStandardMaterial({
      color: 9386542,
      roughness: 0.72,
      metalness: 0.05,
    }),
    jade: new THREE.MeshStandardMaterial({
      color: 4160099,
      roughness: 0.55,
      metalness: 0.25,
    }),
    water: new THREE.MeshStandardMaterial({
      color: 1919570,
      roughness: 0.1,
      metalness: 0.65,
      transparent: !0,
      opacity: 0.82,
    }),
    lamp: new THREE.MeshStandardMaterial({
      color: 16767392,
      emissive: 16758881,
      emissiveIntensity: 3.2,
    }),
    paper: new THREE.MeshStandardMaterial({
      color: 15260864,
      emissive: 16763528,
      emissiveIntensity: 0.55,
      roughness: 0.9,
    }),
    moss: new THREE.MeshStandardMaterial({
      color: 4020794,
      roughness: 0.95,
      metalness: 0,
    }),
  },
  M = (e) => new THREE.MeshStandardMaterial(e),
  THEMES = {
    glacier: {
      floor: M({ map: TEX_SNOW, roughness: 0.86, metalness: 0.05 }),
      wall: M({ map: TEX_ICEPANEL, roughness: 0.52, metalness: 0.45 }),
      strut: M({ color: 5533823, roughness: 0.45, metalness: 0.7 }),
      trim: M({
        color: 8317152,
        roughness: 0.3,
        metalness: 0.5,
        emissive: 2808012,
        emissiveIntensity: 1.7,
      }),
      crate: M({ color: 12109520, roughness: 0.6, metalness: 0.3 }),
      glow: 8319231,
    },
    dunes: {
      floor: M({ map: TEX_SAND, roughness: 0.96, metalness: 0.02 }),
      wall: M({ map: TEX_SANDSTONE, roughness: 0.92, metalness: 0.03 }),
      strut: M({ color: 10251059, roughness: 0.5, metalness: 0.6 }),
      trim: M({
        color: 14263361,
        roughness: 0.35,
        metalness: 0.75,
        emissive: 9067028,
        emissiveIntensity: 0.9,
      }),
      crate: M({ color: 9270096, roughness: 0.85, metalness: 0.05 }),
      glow: 16752700,
    },
    freighter: {
      floor: M({ map: TEX_DECK, roughness: 0.8, metalness: 0.5 }),
      wall: M({ map: TEX_CONTAINER, roughness: 0.72, metalness: 0.45 }),
      strut: M({ color: 4015950, roughness: 0.55, metalness: 0.8 }),
      trim: M({ color: 14242847, roughness: 0.6, metalness: 0.4 }),
      crate: M({ color: 10114086, roughness: 0.8, metalness: 0.25 }),
      glow: 16761421,
    },
    neon: {
      floor: M({ map: TEX_WETASPHALT, roughness: 0.24, metalness: 0.62 }),
      wall: M({ map: TEX_GLASSWALL, roughness: 0.16, metalness: 0.7 }),
      strut: M({ color: 1778480, roughness: 0.4, metalness: 0.85 }),
      trim: M({
        color: 16723320,
        roughness: 0.3,
        metalness: 0.4,
        emissive: 16719722,
        emissiveIntensity: 1.8,
      }),
      crate: M({ color: 2502719, roughness: 0.5, metalness: 0.55 }),
      glow: 16731540,
    },
    garden: {
      floor: M({ map: TEX_GRAVEL, roughness: 0.95, metalness: 0.02 }),
      wall: M({ map: TEX_PLASTER, roughness: 0.9, metalness: 0.03 }),
      strut: M({ color: 9386542, roughness: 0.7, metalness: 0.05 }),
      trim: M({
        color: 4160099,
        roughness: 0.5,
        metalness: 0.25,
        emissive: 1718842,
        emissiveIntensity: 0.5,
      }),
      crate: M({ map: TEX_WOOD, roughness: 0.8, metalness: 0.02 }),
      glow: 16758891,
    },
    market: {
      floor: M({ map: TEX_STONE, roughness: 0.62, metalness: 0.12 }),
      wall: M({ map: TEX_WOOD, roughness: 0.82, metalness: 0.02 }),
      strut: M({ color: 3811870, roughness: 0.8, metalness: 0.05 }),
      trim: M({
        color: 14197306,
        roughness: 0.5,
        metalness: 0.3,
        emissive: 9063952,
        emissiveIntensity: 0.8,
      }),
      crate: M({ color: 6965802, roughness: 0.85, metalness: 0.05 }),
      glow: 16757594,
    },
    temple: {
      floor: M({ map: TEX_MOSSSTONE, roughness: 0.95, metalness: 0.02 }),
      wall: M({ map: TEX_TEMPLEWALL, roughness: 0.92, metalness: 0.03 }),
      strut: M({ color: 5917242, roughness: 0.85, metalness: 0.05 }),
      trim: M({
        color: 8034922,
        roughness: 0.7,
        metalness: 0.1,
        emissive: 1714714,
        emissiveIntensity: 0.3,
      }),
      crate: M({ color: 7040882, roughness: 0.95, metalness: 0.02 }),
      glow: 16765578,
    },
    harbor: {
      floor: M({ map: TEX_CONCRETE, roughness: 0.9, metalness: 0.05 }),
      wall: M({ map: TEX_BRICK, roughness: 0.88, metalness: 0.03 }),
      strut: M({ color: 3820117, roughness: 0.5, metalness: 0.7 }),
      trim: M({ color: 14197306, roughness: 0.6, metalness: 0.3 }),
      crate: M({ color: 3108762, roughness: 0.7, metalness: 0.3 }),
      glow: 16773312,
    },
    forge: {
      floor: M({ map: TEX_BASALT, roughness: 0.9, metalness: 0.1 }),
      wall: M({ map: TEX_FORGEWALL, roughness: 0.7, metalness: 0.5 }),
      strut: M({ color: 2762276, roughness: 0.6, metalness: 0.8 }),
      trim: M({
        color: 16738858,
        roughness: 0.4,
        metalness: 0.3,
        emissive: 16730640,
        emissiveIntensity: 1.6,
      }),
      crate: M({ color: 5913130, roughness: 0.8, metalness: 0.3 }),
      glow: 16742954,
    },
    jungle: {
      floor: M({ map: TEX_GRASS, roughness: 0.98, metalness: 0 }),
      wall: M({ map: TEX_RUIN, roughness: 0.95, metalness: 0.02 }),
      strut: M({ color: 4864554, roughness: 0.9, metalness: 0.02 }),
      trim: M({
        color: 6987850,
        roughness: 0.8,
        metalness: 0.05,
        emissive: 1718800,
        emissiveIntensity: 0.4,
      }),
      crate: M({ color: 7039570, roughness: 0.95, metalness: 0.02 }),
      glow: 16773296,
    },
  },
  THEME = { cur: THEMES.glacier, key: "glacier" },
  TH = () => THEME.cur,
  PORTRAIT_CACHE = {};
function agentPortrait(e, t, o) {
  const a = e.id + "_" + t + "_v2";
  if (PORTRAIT_CACHE[a]) return PORTRAIT_CACHE[a];
  ((t = t || 300), (o = o || 380));
  const n = document.createElement("canvas");
  ((n.width = t), (n.height = o));
  const r = n.getContext("2d"),
    s = e.color,
    [i, l, c] = ((e) => {
      const t = parseInt(e.slice(1), 16);
      return [(t >> 16) & 255, (t >> 8) & 255, 255 & t];
    })(s),
    d = (e) => `rgba(${i},${l},${c},${e})`,
    h = r.createRadialGradient(
      0.5 * t,
      0.3 * o,
      10,
      0.5 * t,
      0.55 * o,
      0.78 * o,
    );
  (h.addColorStop(0, d(0.34)),
    h.addColorStop(0.45, d(0.1)),
    h.addColorStop(1, "rgba(10,13,18,1)"),
    (r.fillStyle = "#0b0e14"),
    r.fillRect(0, 0, t, o),
    (r.fillStyle = h),
    r.fillRect(0, 0, t, o),
    r.save(),
    (r.globalAlpha = 0.16),
    (r.strokeStyle = s),
    (r.lineWidth = 1.4));
  const p = e.role;
  if ("타격대" === p)
    for (let e = 0; e < 11; e++) {
      const a = -Math.PI / 2 + 0.2 * (e - 5);
      (r.beginPath(),
        r.moveTo(t / 2, 0.42 * o),
        r.lineTo(t / 2 + Math.cos(a) * t, 0.42 * o + Math.sin(a) * t),
        r.stroke());
    }
  else if ("감시자" === p)
    for (let e = 1; e <= 6; e++)
      (r.beginPath(), r.arc(0.5 * t, 0.4 * o, e * t * 0.085, 0, 7), r.stroke());
  else if ("척후대" === p)
    for (let e = -6; e < 14; e++)
      (r.beginPath(),
        r.moveTo(28 * e, 0),
        r.lineTo(28 * e + 0.7 * o, o),
        r.stroke());
  else
    for (let e = 0; e < 7; e++)
      for (let t = 0; t < 6; t++) {
        const o = 54 * t + (e % 2) * 27,
          a = 46 * e;
        r.beginPath();
        for (let e = 0; e < 6; e++) {
          const t = (e / 6) * Math.PI * 2,
            n = o + 22 * Math.cos(t),
            s = a + 22 * Math.sin(t);
          e ? r.lineTo(n, s) : r.moveTo(n, s);
        }
        (r.closePath(), r.stroke());
      }
  r.restore();
  const u = e.id || e.key,
    m = (void 0 !== CH_STYLE && (CH_STYLE[u] || CH_STYLE._default)) || {
      w: 1,
      skin: 11897454,
      hair: 2761760,
      eye: 2236962,
      coat: 3818064,
      trim: 9082795,
    },
    f = (e, t) => {
      const o = void 0 === t ? 1 : t;
      return `rgb(${0 | Math.min(255, ((e >> 16) & 255) * o)},${0 | Math.min(255, ((e >> 8) & 255) * o)},${0 | Math.min(255, (255 & e) * o)})`;
    },
    y = 0.5 * t,
    M = 0.34 * o,
    w = 0.128 * t,
    T = M + 0.02 * w,
    g = M + 1.72 * w,
    x = 0.4 * t * Math.min(1.14, m.w),
    b = (e, t, o, a, n, s) => {
      ((r.fillStyle = n),
        r.beginPath(),
        r.ellipse(e, t, o, a, s || 0, 0, 2 * Math.PI),
        r.fill());
    },
    S = (e, t) => {
      ((r.fillStyle = t),
        r.beginPath(),
        e.forEach(([e, t], o) => (o ? r.lineTo(e, t) : r.moveTo(e, t))),
        r.closePath(),
        r.fill());
    },
    v = (e, t, o, a, n, s) => {
      ((r.fillStyle = s), r.beginPath(), r.roundRect(e, t, o, a, n), r.fill());
    },
    k = (e, t, o) => {
      ((r.strokeStyle = t),
        (r.lineWidth = o),
        (r.lineCap = "round"),
        r.beginPath(),
        e.forEach(([e, t], o) => (o ? r.lineTo(e, t) : r.moveTo(e, t))),
        r.stroke());
    },
    _ = (e, t) => {
      ((r.shadowColor = e), (r.shadowBlur = t));
    },
    A = () => {
      r.shadowBlur = 0;
    },
    E = f(m.hair),
    z = f(m.hair, 0.62),
    P = f(m.skin),
    G = f(m.skin, 0.74),
    C = f(m.coat),
    I = f(m.trim);
  if (
    (r.save(),
    "hwaryeong" === u
      ? (S(
          [
            [y + 0.25 * w, M - 0.95 * w],
            [y + 1.55 * w, M - 1.95 * w],
            [y + 1.2 * w, M - 1.25 * w],
            [y + 2 * w, M - 1.3 * w],
            [y + 0.95 * w, M - 0.55 * w],
          ],
          E,
        ),
        _("#ffb347", 0.6 * w),
        S(
          [
            [y + 1.35 * w, M - 1.75 * w],
            [y + 1.75 * w, M - 2.35 * w],
            [y + 1.6 * w, M - 1.7 * w],
          ],
          "#ffb347",
        ),
        S(
          [
            [y + 1.7 * w, M - 1.32 * w],
            [y + 2.3 * w, M - 1.55 * w],
            [y + 1.9 * w, M - 1.2 * w],
          ],
          "#ff7a2c",
        ),
        A())
      : "seorin" === u
        ? v(y - 1.08 * w, M - 0.7 * w, 2.16 * w, 3.3 * w, 0.9 * w, z)
        : "muyeong" === u
          ? (b(y, M - 0.05 * w, 1.42 * w, 1.5 * w, f(1774626)),
            S(
              [
                [y - 0.5 * w, M - 1.3 * w],
                [y + 0.2 * w, M - 2.05 * w],
                [y + 0.55 * w, M - 1.25 * w],
              ],
              f(1774626),
            ))
          : "gangcheol" === u
            ? [-1, 1].forEach((e) => {
                (v(
                  y + e * w * 1.45 - 0.16 * w,
                  g - 1.5 * w,
                  0.32 * w,
                  1.4 * w,
                  0.1 * w,
                  f(6975867),
                ),
                  _("#ffa726", 0.5 * w),
                  v(
                    y + e * w * 1.45 - 0.14 * w,
                    g - 1.55 * w,
                    0.28 * w,
                    0.12 * w,
                    0.05 * w,
                    "#ffa726",
                  ),
                  A());
              })
            : "noeun" === u
              ? (k(
                  [
                    [y - 1.5 * w, g],
                    [y - 1.95 * w, M - 1.9 * w],
                  ],
                  f(9080985),
                  0.07 * w,
                ),
                _("#ff5252", 0.6 * w),
                b(y - 1.97 * w, M - 1.95 * w, 0.14 * w, 0.14 * w, "#ff5252"),
                A())
              : "baekho" === u &&
                (r.save(),
                r.translate(y + 1.1 * w, g),
                r.rotate(0.28),
                v(0.3 * -w, 2.4 * -w, 0.6 * w, 4 * w, 0.12 * w, f(2763824)),
                r.restore()),
    "noeha" === u)
  )
    (k(
      [
        [y + 0.9 * w, g + 0.4 * w],
        [y + 1.8 * w, M - 1.6 * w],
      ],
      "#8a9099",
      0.08 * w,
    ),
      _("#c5cbff", 0.8 * w),
      b(y + 1.82 * w, M - 1.66 * w, 0.13 * w, 0.13 * w, "#c5cbff"),
      A());
  else if ("gyeongyeon" === u)
    S(
      [
        [y - 0.4 * w, g - 0.2 * w],
        [y - x - 0.03 * t, g + 0.6 * w],
        [y - x - 0.06 * t, o],
        [y - 0.6 * w, o],
      ],
      f(3811904),
    );
  else if ("heuksa" === u)
    (k(
      [
        [y - 0.4 * w, o],
        [y - 1.9 * w, M - 1.9 * w],
      ],
      f(4863270),
      0.12 * w,
    ),
      _("#e0c080", 0.9 * w),
      b(y - 1.95 * w, M - 1.97 * w, 0.18 * w, 0.18 * w, "#e0c080"),
      A());
  else if ("jacheol" === u)
    ((r.strokeStyle = "#8a9099"),
      (r.lineWidth = 0.3 * w),
      r.beginPath(),
      r.arc(y, M - 0.2 * w, 1.55 * w, 1.08 * Math.PI, 1.92 * Math.PI),
      r.stroke(),
      v(
        y - 1.55 * w - 0.22 * w,
        M - 0.02 * w,
        0.44 * w,
        0.36 * w,
        0.06 * w,
        "#d84343",
      ),
      v(
        y + 1.55 * w - 0.22 * w,
        M - 0.02 * w,
        0.44 * w,
        0.36 * w,
        0.06 * w,
        "#3f6fd8",
      ));
  else if ("hongyeol" === u)
    (v(y + 0.2 * w, M + 0.3 * w, 0.4 * w, 2.4 * w, 0.2 * w, z),
      S(
        [
          [y + 0.6 * w, g - 0.1 * w],
          [y + 0.9 * x, g + 0.9 * w],
          [y + x, 0.95 * o],
          [y + 0.6 * x, 0.95 * o],
          [y + 0.5 * w, g + 0.4 * w],
        ],
        f(10165019),
      ));
  else if ("gunbong" === u) {
    const e = (e) =>
      Array.from({ length: 6 }, (t, o) => {
        const a = (o / 6) * Math.PI * 2;
        return [Math.cos(a) * e, Math.sin(a) * e];
      });
    (r.save(),
      r.translate(y + 0.62 * x, g - 0.2 * w),
      S(e(0.95 * w), f(11566866)),
      _("#ffc107", 0.6 * w),
      S(e(0.4 * w), "#ffc107"),
      A(),
      r.restore());
  }
  const N = r.createLinearGradient(0, g - 0.3 * w, 0, o);
  (N.addColorStop(0, f(m.coat, 1.08)),
    N.addColorStop(1, f(m.coat, 0.38)),
    (r.fillStyle = N));
  const L = new Path2D();
  if (
    (L.moveTo(y - x - 0.05 * t, o),
    L.quadraticCurveTo(y - x, g + 0.15 * w, y - 0.95 * w, g - 0.2 * w),
    L.lineTo(y + 0.95 * w, g - 0.2 * w),
    L.quadraticCurveTo(y + x, g + 0.15 * w, y + x + 0.05 * t, o),
    L.closePath(),
    r.fill(L),
    "hwaryeong" === u)
  )
    (S(
      [
        [y - 0.42 * w, g - 0.15 * w],
        [y + 0.42 * w, g - 0.15 * w],
        [y + 0.3 * w, o],
        [y - 0.3 * w, o],
      ],
      f(1776159),
    ),
      k(
        [
          [y - 0.42 * w, g - 0.1 * w],
          [y - 0.34 * w, o],
        ],
        I,
        0.07 * w,
      ),
      k(
        [
          [y + 0.42 * w, g - 0.1 * w],
          [y + 0.34 * w, o],
        ],
        I,
        0.07 * w,
      ),
      [-1, 1].forEach((e) =>
        S(
          [
            [y + e * w * 0.45, g - 0.25 * w],
            [y + e * w * 1.05, g - 0.75 * w],
            [y + e * w * 1.1, g + 0.1 * w],
          ],
          f(m.coat, 1.3),
        ),
      ));
  else if ("seorin" === u)
    (v(y - 0.62 * w, M + 0.78 * w, 1.24 * w, 0.95 * w, 0.2 * w, C),
      _(I, 0.5 * w),
      k(
        [
          [y - 0.6 * w, M + 0.82 * w],
          [y + 0.6 * w, M + 0.82 * w],
        ],
        I,
        0.07 * w,
      ),
      k(
        [
          [y - 0.25 * w, g],
          [y - 0.25 * w, o],
        ],
        I,
        0.05 * w,
      ),
      k(
        [
          [y + 0.25 * w, g],
          [y + 0.25 * w, o],
        ],
        I,
        0.05 * w,
      ),
      [
        [-1.55, -0.9, 0.9],
        [-1.95, -0.35, 0.65],
        [-1.25, -0.45, 0.6],
      ].forEach(([e, t, o]) =>
        S(
          [
            [y + e * w - 0.14 * w * o, g + 0.1 * w],
            [y + e * w, g + t * w * 1.6],
            [y + e * w + 0.14 * w * o, g + 0.1 * w],
          ],
          "#bfefff",
        ),
      ),
      A());
  else if ("muyeong" === u)
    (k(
      [
        [y - 0.6 * w, g - 0.1 * w],
        [y + 0.5 * w, 0.98 * o],
      ],
      f(3878216),
      0.14 * w,
    ),
      S(
        [
          [y + 0.4 * w, g - 0.3 * w],
          [y + x + 0.02 * t, g + 0.4 * w],
          [y + x, o],
          [y + 0.9 * w, o],
        ],
        f(2957114),
      ),
      _(I, 0.4 * w),
      k(
        [
          [y + 0.9 * w, g],
          [y + 0.9 * x, 0.95 * o],
        ],
        I,
        0.03 * w,
      ),
      A());
  else if ("gangcheol" === u) {
    (v(y - 0.95 * w, g + 0.2 * w, 1.9 * w, 1.5 * w, 0.12 * w, C),
      v(y - 0.95 * w, g + 1.45 * w, 1.9 * w, 0.25 * w, 0, f(15909166)),
      r.save(),
      r.beginPath(),
      r.rect(y - 0.95 * w, g + 1.45 * w, 1.9 * w, 0.25 * w),
      r.clip());
    for (let e = -3; e < 6; e++)
      S(
        [
          [y - 0.95 * w + e * w * 0.38, g + 1.7 * w],
          [y - 0.8 * w + e * w * 0.38, g + 1.45 * w],
          [y - 0.65 * w + e * w * 0.38, g + 1.45 * w],
          [y - 0.8 * w + e * w * 0.38, g + 1.7 * w],
        ],
        "#16161a",
      );
    (r.restore(),
      b(y - 0.82 * x, g + 0.05 * w, 1.15 * w, 0.72 * w, f(m.coat, 1.15)),
      b(y - 0.82 * x, g + 0.25 * w, 1.1 * w, 0.22 * w, f(15909166)),
      b(y + 0.8 * x, g + 0.2 * w, 0.72 * w, 0.45 * w, f(6975867)));
  } else if ("yeonhwa" === u)
    (k(
      [
        [y - 0.55 * w, g - 0.1 * w],
        [y, g + 0.9 * w],
        [y + 0.55 * w, g - 0.1 * w],
      ],
      "#f2efe6",
      0.16 * w,
    ),
      _(I, 0.3 * w),
      b(y + 0.2 * w, g + 1.05 * w, 0.2 * w, 0.14 * w, I),
      k(
        [
          [y + 0.25 * w, g + 1.1 * w],
          [y + 0.4 * w, 0.98 * o],
        ],
        I,
        0.1 * w,
      ),
      k(
        [
          [y + 0.1 * w, g + 1.1 * w],
          [y, 0.96 * o],
        ],
        I,
        0.09 * w,
      ),
      A(),
      k(
        [
          [y + 0.7 * x, g],
          [y - 0.5 * x, o],
        ],
        f(6965808),
        0.1 * w,
      ));
  else if ("noeun" === u)
    (b(y, M + 1.35 * w, 1.2 * w, 0.55 * w, f(m.coat, 0.8)),
      [-1, 1].forEach((e) => {
        (k(
          [
            [y + e * w * 0.25, g],
            [y + e * w * 0.3, g + 1.1 * w],
          ],
          "#eeeeee",
          0.05 * w,
        ),
          v(
            y + e * w * 1.25 - 0.14 * w,
            g,
            0.28 * w,
            o,
            0.08 * w,
            f(16766287),
          ));
      }),
      v(y - 0.8 * w, 0.86 * o, 1.6 * w, 0.6 * w, 0.15 * w, f(11566866)));
  else if ("baekho" === u) {
    (v(y - 0.4 * w, g - 0.3 * w, 0.8 * w, o, 0, f(1315862)),
      [-1, 1].forEach((e) =>
        S(
          [
            [y + e * w * 0.4, g],
            [y + e * w * 0.95, g + 0.1 * w],
            [y + e * w * 0.55, g + 1.4 * w],
          ],
          f(m.coat, 0.9),
        ),
      ));
    for (let e = 0; e < 4; e++)
      (k(
        [
          [y - 0.9 * x + e * w * 0.18, g + w * (0.8 + 0.5 * e)],
          [y - 0.55 * x + e * w * 0.18, g + w * (1.1 + 0.5 * e)],
        ],
        "#1a1a1c",
        0.1 * w,
      ),
        k(
          [
            [y + 0.9 * x - e * w * 0.18, g + w * (0.8 + 0.5 * e)],
            [y + 0.55 * x - e * w * 0.18, g + w * (1.1 + 0.5 * e)],
          ],
          "#1a1a1c",
          0.1 * w,
        ));
    for (let e = -2.2; e <= 2.21; e += 0.44) {
      const t = Math.round((e + 2.2) / 0.44);
      b(
        y + Math.sin(e) * w * 1.05,
        g - 0.35 * w + Math.cos(e) * w * 0.12,
        0.26 * w,
        0.2 * w,
        t % 2 ? "#8a8a8a" : "#e0e0e0",
      );
    }
    k(
      [
        [y + 0.7 * x, g],
        [y - 0.4 * x, o],
      ],
      f(1184276),
      0.12 * w,
    );
  }
  if ("noeha" === u)
    (v(y - 0.66 * w, M + 0.78 * w, 1.32 * w, 0.9 * w, 0.2 * w, f(2765696)),
      _("#c5cbff", 0.5 * w),
      k(
        [
          [y - 0.3 * w, g + 0.3 * w],
          [y + 0.1 * w, g + 0.75 * w],
          [y - 0.25 * w, g + 1.15 * w],
          [y + 0.15 * w, g + 1.6 * w],
        ],
        "#c5cbff",
        0.08 * w,
      ),
      k(
        [
          [y - 0.85 * x, g + 0.3 * w],
          [y - 0.75 * x, o],
        ],
        "#7c8cff",
        0.05 * w,
      ),
      k(
        [
          [y + 0.85 * x, g + 0.3 * w],
          [y + 0.75 * x, o],
        ],
        "#7c8cff",
        0.05 * w,
      ),
      A(),
      (r.strokeStyle = "#1a1a22"),
      (r.lineWidth = 0.1 * w),
      r.beginPath(),
      r.ellipse(y, M + 1.25 * w, 0.55 * w, 0.22 * w, 0, 0, 7),
      r.stroke());
  else if ("gyeongyeon" === u)
    (k(
      [
        [y + 0.5 * w, g],
        [y - 0.3 * w, o],
      ],
      "#d81b60",
      0.14 * w,
    ),
      k(
        [
          [y - 0.9 * w, g + 0.3 * w],
          [y + 0.9 * w, g + 0.3 * w],
        ],
        "#c0c6ce",
        0.06 * w,
      ),
      _("#fce4ec", 0.5 * w),
      [
        [0.95, -0.7, 0.5],
        [1.35, -0.2, -0.4],
        [1.1, 0.3, 0.9],
      ].forEach(([e, t, o]) => {
        (r.save(),
          r.translate(y + x * e * 0.7, g + t * w),
          r.rotate(o),
          v(
            0.14 * -w,
            0.22 * -w,
            0.28 * w,
            0.44 * w,
            0.04 * w,
            "rgba(223,230,238,.9)",
          ),
          r.restore());
      }),
      A());
  else if ("heuksa" === u)
    (r.save(),
      r.clip(L),
      (r.fillStyle = f(13215339)),
      r.beginPath(),
      r.ellipse(y, g - 0.25 * w, 1.05 * x, 1.35 * w, 0, 0, Math.PI),
      r.fill(),
      r.restore(),
      k(
        [
          [y - 0.5 * x, g + 0.5 * w],
          [y + 0.4 * x, o],
        ],
        f(7035461),
        0.14 * w,
      ),
      S(
        [
          [y - 0.35 * w, g + 1.1 * w],
          [y - 0.15 * w, g + 1.1 * w],
          [y - 0.25 * w, g + 1.3 * w],
        ],
        f(11569726),
      ));
  else if ("myeongjong" === u) {
    (S(
      [
        [y - 0.25 * w, g - 0.2 * w],
        [y - 0.95 * x, g + 0.2 * w],
        [y - x, o],
        [y - 0.45 * w, o],
      ],
      C,
    ),
      S(
        [
          [y + 0.25 * w, g - 0.2 * w],
          [y + 0.95 * x, g + 0.2 * w],
          [y + x, o],
          [y + 0.45 * w, o],
        ],
        C,
      ));
    for (let e = -1.2; e <= 1.21; e += 0.2)
      b(
        y + Math.sin(e) * w * 0.9,
        g + 0.1 * w + Math.cos(e) * w * 0.55,
        0.08 * w,
        0.08 * w,
        f(5913122),
      );
    b(y, g + 0.72 * w, 0.14 * w, 0.16 * w, f(11569726));
  } else if ("jacheol" === u)
    (v(y - 0.8 * w, g + 0.3 * w, 1.6 * w, o, 0.12 * w, f(6111287)),
      k(
        [
          [y - 0.7 * w, g + 0.35 * w],
          [y - 0.95 * w, g - 0.2 * w],
        ],
        f(6111287),
        0.12 * w,
      ),
      k(
        [
          [y + 0.7 * w, g + 0.35 * w],
          [y + 0.95 * w, g - 0.2 * w],
        ],
        f(6111287),
        0.12 * w,
      ),
      v(y - 0.3 * w, g + 0.9 * w, 0.6 * w, 0.4 * w, 0.06 * w, f(4862504)));
  else if ("hongyeol" === u)
    (S(
      [
        [y - 0.35 * w, g - 0.2 * w],
        [y + 0.35 * w, g - 0.2 * w],
        [y + 0.25 * w, o],
        [y - 0.25 * w, o],
      ],
      "#141012",
    ),
      r.save(),
      r.clip(L),
      [-1, 1].forEach((e) => {
        (S(
          [
            [y + e * w * 1, g - 0.3 * w],
            [y + e * (x + 0.06 * t), g + 0.2 * w],
            [y + e * (x + 0.08 * t), o],
            [y + e * x * 0.74, o],
            [y + e * x * 0.7, g + 0.45 * w],
          ],
          P,
        ),
          _("#ff3b3b", 0.5 * w),
          k(
            [
              [y + e * x * 0.86, g + 0.35 * w],
              [y + e * x * 0.9, g + 1.1 * w],
              [y + e * x * 0.86, g + 1.7 * w],
            ],
            "#ff3b3b",
            0.05 * w,
          ),
          A());
      }),
      r.restore(),
      b(y, M + 1.3 * w, 0.95 * w, 0.4 * w, f(10165019)));
  else if ("gunbong" === u) {
    (r.save(), r.clip(L));
    for (let e = 0; e < 3; e++)
      v(
        y - 1.1 * x,
        g + w * (0.5 + 0.75 * e),
        2.2 * x,
        0.28 * w,
        0,
        f(12634675),
      );
    (r.restore(), b(y + 0.55 * x, g + 0.1 * w, 0.5 * w, 0.35 * w, f(11566866)));
  }
  "seorin" !== u &&
    "baekho" !== u &&
    v(y - 0.34 * w, M + 0.62 * w, 0.68 * w, 0.95 * w, 0.18 * w, G);
  const O = r.createRadialGradient(
    y - 0.3 * w,
    M - 0.4 * w,
    0.1 * w,
    y,
    M,
    1.2 * w,
  );
  (O.addColorStop(0, f(m.skin, 1.12)),
    O.addColorStop(1, f(m.skin, 0.78)),
    b(y - 0.9 * w, M + 0.08 * w, 0.13 * w, 0.22 * w, G),
    b(y + 0.9 * w, M + 0.08 * w, 0.13 * w, 0.22 * w, G),
    b(y, M, 0.9 * w, 1.06 * w, O));
  const F = f(m.eye);
  if (
    ("muyeong" === u
      ? (_(F, 0.8 * w),
        [-1, 1].forEach((e) => b(y + e * w * 0.36, T, 0.13 * w, 0.07 * w, F)),
        A())
      : [-1, 1].forEach((e) => {
          (b(y + e * w * 0.36, T, 0.14 * w, 0.08 * w, "#f3efe9"),
            b(y + e * w * 0.34, T, 0.075 * w, 0.075 * w, F),
            b(y + e * w * 0.34, T, 0.035 * w, 0.035 * w, "#0b0b0e"));
        }),
    [-1, 1].forEach((e) =>
      k(
        [
          [y + e * w * 0.16, T - 0.2 * w],
          [y + e * w * 0.56, T - 0.27 * w],
        ],
        z,
        "gangcheol" === u ? 0.11 * w : 0.065 * w,
      ),
    ),
    k(
      [
        [y, T + 0.08 * w],
        [y - 0.06 * w, T + 0.36 * w],
        [y + 0.05 * w, T + 0.39 * w],
      ],
      G,
      0.04 * w,
    ),
    "muyeong" !== u &&
      "gangcheol" !== u &&
      ((r.strokeStyle = f(m.skin, 0.6)),
      (r.lineWidth = 0.045 * w),
      r.beginPath(),
      r.moveTo(y - 0.2 * w, M + 0.6 * w),
      r.quadraticCurveTo(y, M + 0.66 * w, y + 0.2 * w, M + 0.6 * w),
      r.stroke()),
    "hwaryeong" === u)
  )
    ((r.fillStyle = E),
      r.beginPath(),
      r.moveTo(y - 0.95 * w, M + 0.15 * w),
      r.bezierCurveTo(
        y - 1.05 * w,
        M - 1.2 * w,
        y + 1.05 * w,
        M - 1.35 * w,
        y + 0.95 * w,
        M + 0.1 * w,
      ),
      r.lineTo(y + 0.55 * w, M - 0.45 * w),
      r.quadraticCurveTo(y - 0.1 * w, M - 0.05 * w, y - 0.75 * w, M - 0.35 * w),
      r.closePath(),
      r.fill());
  else if ("seorin" === u)
    ((r.fillStyle = E),
      r.beginPath(),
      r.moveTo(y - 1 * w, M + 0.9 * w),
      r.bezierCurveTo(
        y - 1.15 * w,
        M - 1.35 * w,
        y + 1.15 * w,
        M - 1.35 * w,
        y + 1 * w,
        M + 0.9 * w,
      ),
      r.lineTo(y + 0.72 * w, M + 0.9 * w),
      r.lineTo(y + 0.75 * w, M - 0.28 * w),
      r.lineTo(y - 0.75 * w, M - 0.28 * w),
      r.lineTo(y - 0.72 * w, M + 0.9 * w),
      r.closePath(),
      r.fill(),
      _(I, 0.7 * w),
      v(
        y - 0.8 * w,
        T - 0.07 * w,
        1.6 * w,
        0.14 * w,
        0.06 * w,
        "rgba(191,239,255,.85)",
      ),
      A());
  else if ("muyeong" === u)
    (b(y, M + 0.72 * w, 0.98 * w, 0.58 * w, f(3811914)),
      (r.fillStyle = f(1774626)),
      r.beginPath(),
      r.ellipse(
        y,
        M - 0.05 * w,
        1.42 * w,
        1.5 * w,
        0,
        1.05 * Math.PI,
        1.95 * Math.PI,
      ),
      r.ellipse(
        y,
        M - 0.3 * w,
        0.95 * w,
        0.75 * w,
        0,
        1.95 * Math.PI,
        1.05 * Math.PI,
        !0,
      ),
      r.closePath(),
      r.fill());
  else if ("gangcheol" === u)
    ((r.fillStyle = f(m.hair, 0.95)),
      (r.globalAlpha = 0.9),
      r.beginPath(),
      r.ellipse(y, M - 0.45 * w, 0.9 * w, 0.62 * w, 0, Math.PI, 2 * Math.PI),
      r.fill(),
      (r.globalAlpha = 1),
      (r.fillStyle = E),
      r.beginPath(),
      r.moveTo(y - 0.86 * w, M + 0.05 * w),
      r.quadraticCurveTo(y - 0.8 * w, M + 1.25 * w, y, M + 1.3 * w),
      r.quadraticCurveTo(y + 0.8 * w, M + 1.25 * w, y + 0.86 * w, M + 0.05 * w),
      r.lineTo(y + 0.6 * w, M + 0.45 * w),
      r.quadraticCurveTo(y, M + 0.3 * w, y - 0.6 * w, M + 0.45 * w),
      r.closePath(),
      r.fill());
  else if ("yeonhwa" === u)
    ((r.fillStyle = E),
      r.beginPath(),
      r.moveTo(y - 0.95 * w, M + 0.2 * w),
      r.bezierCurveTo(
        y - 1.05 * w,
        M - 1.3 * w,
        y + 1.05 * w,
        M - 1.3 * w,
        y + 0.95 * w,
        M + 0.2 * w,
      ),
      r.quadraticCurveTo(y + 0.6 * w, M - 0.55 * w, y, M - 0.45 * w),
      r.quadraticCurveTo(y - 0.6 * w, M - 0.55 * w, y - 0.95 * w, M + 0.2 * w),
      r.closePath(),
      r.fill(),
      b(y, M - 1.22 * w, 0.45 * w, 0.36 * w, E),
      _("#7cfc9a", 0.6 * w),
      k(
        [
          [y - 0.75 * w, M - 1 * w],
          [y + 0.8 * w, M - 1.42 * w],
        ],
        "#7cfc9a",
        0.06 * w,
      ),
      b(y + 0.85 * w, M - 1.45 * w, 0.1 * w, 0.1 * w, "#7cfc9a"),
      b(y - 0.4 * w, M - 1.45 * w, 0.13 * w, 0.13 * w, "#f8bbd0"),
      A());
  else if ("noeun" === u) {
    ((r.fillStyle = E), r.beginPath(), r.moveTo(y - 0.95 * w, M + 0.1 * w));
    ([
      [-0.9, -0.7],
      [-0.75, -1.35],
      [-0.45, -0.95],
      [-0.2, -1.55],
      [0.05, -1.05],
      [0.3, -1.6],
      [0.55, -1],
      [0.8, -1.35],
      [0.95, -0.6],
    ].forEach(([e, t]) => r.lineTo(y + e * w, M + t * w)),
      r.lineTo(y + 0.95 * w, M + 0.1 * w),
      r.quadraticCurveTo(y, M - 0.5 * w, y - 0.95 * w, M + 0.1 * w),
      r.closePath(),
      r.fill(),
      [-1, 1].forEach((e) => {
        (b(y + e * w * 0.38, M - 0.62 * w, 0.3 * w, 0.26 * w, "#333333"),
          b(y + e * w * 0.38, M - 0.62 * w, 0.22 * w, 0.19 * w, "#6fd3ff"));
      }),
      k(
        [
          [y - 1.08 * w, M + 0.15 * w],
          [y - 1.1 * w, M - 0.9 * w],
          [y, M - 1.38 * w],
          [y + 1.1 * w, M - 0.9 * w],
          [y + 1.08 * w, M + 0.15 * w],
        ],
        "#1c1c1e",
        0.12 * w,
      ),
      [-1, 1].forEach((e) => {
        (v(
          y + e * w * 1.08 - 0.2 * w,
          M - 0.2 * w,
          0.4 * w,
          0.6 * w,
          0.15 * w,
          "#1c1c1e",
        ),
          _("#ffd54f", 0.5 * w),
          (r.strokeStyle = "#ffd54f"),
          (r.lineWidth = 0.06 * w),
          r.beginPath(),
          r.ellipse(y + e * w * 1.08, M + 0.1 * w, 0.13 * w, 0.2 * w, 0, 0, 7),
          r.stroke(),
          A());
      }));
  } else if ("baekho" === u) {
    ((r.fillStyle = E),
      r.beginPath(),
      r.moveTo(y - 0.92 * w, M + 0.05 * w),
      r.bezierCurveTo(
        y - 1 * w,
        M - 1.35 * w,
        y + 1 * w,
        M - 1.35 * w,
        y + 0.92 * w,
        M + 0.05 * w,
      ),
      r.quadraticCurveTo(y + 0.4 * w, M - 0.72 * w, y, M - 0.7 * w),
      r.quadraticCurveTo(y - 0.4 * w, M - 0.72 * w, y - 0.92 * w, M + 0.05 * w),
      r.closePath(),
      r.fill());
    for (let e = 0; e < 4; e++)
      k(
        [
          [y - 0.6 * w + e * w * 0.35, M - 0.75 * w],
          [y - 0.5 * w + e * w * 0.35, M - 1.1 * w],
        ],
        f(m.hair, 0.8),
        0.03 * w,
      );
    (b(y, M + 0.88 * w, 0.14 * w, 0.12 * w, z),
      b(y - 0.34 * w, T, 0.26 * w, 0.26 * w, "#3a3c42"),
      _("#ff4d4d", 0.8 * w),
      b(y - 0.34 * w, T, 0.17 * w, 0.17 * w, "#ff4d4d"),
      A(),
      k(
        [
          [y - 0.6 * w, T],
          [y - 0.95 * w, T - 0.05 * w],
        ],
        "#3a3c42",
        0.05 * w,
      ));
  } else if ("noeha" === u)
    ((r.fillStyle = E),
      r.beginPath(),
      r.moveTo(y - 0.95 * w, M + 0.05 * w),
      [
        [-0.95, -0.55],
        [-0.85, -1.4],
        [-0.55, -1],
        [-0.35, -1.85],
        [-0.1, -1.15],
        [0.1, -2],
        [0.3, -1.2],
        [0.55, -1.75],
        [0.7, -0.95],
        [0.95, -1.2],
        [0.95, -0.5],
      ].forEach(([e, t]) => r.lineTo(y + e * w, M + t * w)),
      r.lineTo(y + 0.95 * w, M + 0.05 * w),
      r.quadraticCurveTo(y, M - 0.55 * w, y - 0.95 * w, M + 0.05 * w),
      r.closePath(),
      r.fill(),
      _("#c5cbff", 0.8 * w),
      k(
        [
          [y + 0.1 * w, M - 2 * w],
          [y + 0.15 * w, M - 2.3 * w],
        ],
        "#c5cbff",
        0.06 * w,
      ),
      A());
  else if ("gyeongyeon" === u) {
    ((r.fillStyle = E),
      r.beginPath(),
      r.moveTo(y - 1.05 * w, M + 0.75 * w),
      r.bezierCurveTo(
        y - 1.2 * w,
        M - 1.4 * w,
        y + 1.2 * w,
        M - 1.4 * w,
        y + 1.05 * w,
        M + 0.75 * w,
      ),
      r.lineTo(y + 0.8 * w, M + 0.75 * w),
      r.lineTo(y + 0.8 * w, M - 0.35 * w),
      r.lineTo(y - 0.8 * w, M - 0.35 * w),
      r.lineTo(y - 0.8 * w, M + 0.75 * w),
      r.closePath(),
      r.fill());
    const e = r.createLinearGradient(y, M - w, y + w, M + w);
    (e.addColorStop(0, "rgba(245,248,252,.95)"),
      e.addColorStop(0.5, "rgba(190,200,215,.95)"),
      e.addColorStop(1, "rgba(235,240,248,.95)"),
      (r.fillStyle = e),
      r.beginPath(),
      r.ellipse(
        y,
        M + 0.05 * w,
        0.9 * w,
        1.02 * w,
        0,
        -Math.PI / 2,
        Math.PI / 2,
      ),
      r.closePath(),
      r.fill(),
      _("#f06292", 0.7 * w),
      v(y + 0.15 * w, T - 0.04 * w, 0.45 * w, 0.08 * w, 0.03 * w, "#f06292"),
      A());
  } else
    "heuksa" === u
      ? (b(y, M - 0.55 * w, 1.05 * w, 0.72 * w, f(7035461)),
        (r.strokeStyle = f(13215339)),
        (r.lineWidth = 0.14 * w),
        r.beginPath(),
        r.ellipse(y, M - 0.32 * w, 0.98 * w, 0.3 * w, 0, 0, Math.PI),
        r.stroke(),
        (r.fillStyle = f(13215339)),
        r.beginPath(),
        r.moveTo(y - 0.9 * w, M + 0.2 * w),
        r.quadraticCurveTo(y, M + 0.12 * w, y + 0.9 * w, M + 0.2 * w),
        r.lineTo(y + 0.85 * w, M + 0.9 * w),
        r.quadraticCurveTo(y, M + 1.25 * w, y - 0.85 * w, M + 0.9 * w),
        r.closePath(),
        r.fill())
      : "myeongjong" === u
        ? ((r.fillStyle = E),
          (r.globalAlpha = 0.9),
          r.beginPath(),
          r.ellipse(
            y,
            M - 0.5 * w,
            0.88 * w,
            0.55 * w,
            0,
            Math.PI,
            2 * Math.PI,
          ),
          r.fill(),
          (r.globalAlpha = 1),
          k(
            [
              [y - 0.3 * w, M + 0.48 * w],
              [y, M + 0.42 * w],
              [y + 0.3 * w, M + 0.48 * w],
            ],
            E,
            0.08 * w,
          ),
          S(
            [
              [y - 2.2 * w, M - 0.55 * w],
              [y, M - 1.75 * w],
              [y + 2.2 * w, M - 0.55 * w],
            ],
            f(3813154),
          ),
          k(
            [
              [y - 2.2 * w, M - 0.55 * w],
              [y + 2.2 * w, M - 0.55 * w],
            ],
            f(11569726),
            0.1 * w,
          ),
          [-1.8, -1.1, -0.4, 0.4, 1.1, 1.8].forEach((e) => {
            (k(
              [
                [y + e * w, M - 0.55 * w],
                [y + e * w, M - 0.25 * w],
              ],
              f(11569726),
              0.03 * w,
            ),
              S(
                [
                  [y + e * w - 0.1 * w, M - 0.12 * w],
                  [y + e * w, M - 0.3 * w],
                  [y + e * w + 0.1 * w, M - 0.12 * w],
                ],
                f(11569726),
              ));
          }),
          _("#ffd166", 0.6 * w),
          b(y, M - 1.78 * w, 0.1 * w, 0.1 * w, "#ffd166"),
          A())
        : "jacheol" === u
          ? ((r.fillStyle = E),
            r.beginPath(),
            r.moveTo(y - 0.95 * w, M + 0.15 * w),
            r.bezierCurveTo(
              y - 1.05 * w,
              M - 1.3 * w,
              y + 1.05 * w,
              M - 1.3 * w,
              y + 0.95 * w,
              M + 0.15 * w,
            ),
            r.quadraticCurveTo(
              y + 0.3 * w,
              M - 0.6 * w,
              y - 0.95 * w,
              M + 0.15 * w,
            ),
            r.closePath(),
            r.fill(),
            v(y - 1 * w, M - 0.72 * w, 2 * w, 0.14 * w, 0.05 * w, "#22262c"),
            [-1, 1].forEach((e) => {
              (b(y + e * w * 0.4, M - 0.66 * w, 0.3 * w, 0.24 * w, "#22262c"),
                b(
                  y + e * w * 0.4,
                  M - 0.66 * w,
                  0.21 * w,
                  0.16 * w,
                  "#2e3a4a",
                ));
            }),
            v(
              y - 0.95 * w,
              M - 0.35 * w,
              0.22 * w,
              0.1 * w,
              0.02 * w,
              "#d84343",
            ),
            v(
              y - 0.95 * w,
              M - 0.22 * w,
              0.22 * w,
              0.1 * w,
              0.02 * w,
              "#3f6fd8",
            ))
          : "hongyeol" === u
            ? ((r.fillStyle = E),
              r.beginPath(),
              r.moveTo(y - 0.95 * w, M + 0.5 * w),
              r.bezierCurveTo(
                y - 1.1 * w,
                M - 1.35 * w,
                y + 1.1 * w,
                M - 1.35 * w,
                y + 0.95 * w,
                M + 0.3 * w,
              ),
              r.quadraticCurveTo(
                y + 0.1 * w,
                M - 0.8 * w,
                y - 0.5 * w,
                M - 0.1 * w,
              ),
              r.quadraticCurveTo(
                y - 0.8 * w,
                M + 0.2 * w,
                y - 0.95 * w,
                M + 0.5 * w,
              ),
              r.closePath(),
              r.fill())
            : "gunbong" === u
              ? (b(y, M - 0.6 * w, 0.8 * w, 0.5 * w, E),
                b(y, M - 0.72 * w, 2.1 * w, 0.38 * w, f(14272928)),
                v(
                  y - 0.85 * w,
                  M - 1.55 * w,
                  1.7 * w,
                  0.85 * w,
                  0.25 * w,
                  f(14272928),
                ),
                v(
                  y - 0.88 * w,
                  M - 0.95 * w,
                  1.76 * w,
                  0.16 * w,
                  0,
                  f(16757504),
                ),
                (r.fillStyle = "rgba(26,26,20,.42)"),
                r.beginPath(),
                r.moveTo(y - 1.9 * w, M - 0.7 * w),
                r.lineTo(y + 1.9 * w, M - 0.7 * w),
                r.lineTo(y + 1.5 * w, M + 1.35 * w),
                r.lineTo(y - 1.5 * w, M + 1.35 * w),
                r.closePath(),
                r.fill(),
                _("#ffc107", 0.6 * w),
                [-1, 1].forEach((e) =>
                  b(y + e * w * 0.36, T, 0.14 * w, 0.11 * w, "#ffc107"),
                ),
                A())
              : b(y, M - 0.4 * w, 0.95 * w, 0.7 * w, f(3818064));
  (r.restore(), r.save(), (r.globalCompositeOperation = "lighter"));
  const R = r.createRadialGradient(y, M, 0.8 * w, y, M, 2.4 * w);
  (R.addColorStop(0, d(0)),
    R.addColorStop(0.5, d(0.14)),
    R.addColorStop(1, d(0)),
    (r.fillStyle = R),
    r.fillRect(0, 0, t, o),
    r.restore());
  const D = r.createLinearGradient(0, 0.62 * o, 0, o);
  (D.addColorStop(0, "rgba(11,14,20,0)"),
    D.addColorStop(1, "rgba(11,14,20,.92)"),
    (r.fillStyle = D),
    r.fillRect(0, 0.62 * o, t, 0.38 * o),
    (r.globalAlpha = 0.06),
    (r.fillStyle = "#000"));
  for (let e = 0; e < o; e += 3) r.fillRect(0, e, t, 1);
  r.globalAlpha = 1;
  const B = n.toDataURL("image/webp", 0.82);
  return ((PORTRAIT_CACHE[a] = B), B);
}

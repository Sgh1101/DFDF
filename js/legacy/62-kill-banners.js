
(() => {
  // A kill banner of its own for every skin: its colours, its pattern, a glyph
  // on both sides of the word, how it comes in, and (for most) something
  // drifting around it — snow, petals, embers, stars, a knife's slash. The
  // higher the rarity the more it does: common ones are a coloured plate, rare
  // ones wear the skin's pattern, epic ones move, legendary ones carry a whole
  // effect. Looks only; the sound and the streak names stay as killfx.js has them.
  if ("undefined" == typeof playKillFx || "undefined" == typeof GUN_SKINS || !window.KILLFX) return;
  const $ = (id) => document.getElementById(id);
  const EN = () => "en" === window.GAME_LANG;

  // a = accent, tx = the word, g = glyph, bg = plate, bd = border, sh = glow, cl = clip, an = how it comes in,
  // ov = the overlay (::after), x = extra css for the plate, tc = the word's own css,
  // p = [kind, glyph] drifting around it (fall · rise · twinkle · slash · none)
  const T = {
    // ── common ──
    obsidian: { a: "#ff2d55", tx: "#fff", g: "◆", bg: "linear-gradient(180deg,#1d2028,#0a0b0e)", bd: "1px solid #ff2d55", sh: "0 0 22px -4px #ff2d55", x: "border-radius:0", cl: "polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%)", ov: "background:linear-gradient(100deg,transparent 30%,rgba(255,45,85,.45) 50%,transparent 70%);left:-60%;width:60%;animation:kfSweep .9s .1s ease-out forwards", p: ["none"] },
    snow: { a: "#bfe3ff", tx: "#fff", g: "❄", bg: "linear-gradient(180deg,rgba(236,247,255,.34),rgba(120,165,200,.2))", bd: "1px solid #dff1ff", sh: "0 0 26px -6px #bfe3ff", tc: "text-shadow:0 0 14px #7cc4f5,0 1px 0 #5b88a8", p: ["fall", "❄"] },
    jungle: { a: "#8bc34a", tx: "#f1ffd6", g: "❦", bg: "linear-gradient(180deg,#2b4a1f,#14240e)", bd: "2px solid #6f9440", sh: "0 0 22px -6px #8bc34a", x: "border-radius:8px 24px 8px 24px", tc: "text-shadow:0 0 12px #8bc34a", p: ["fall", "❧"] },
    desert: { tg: "#3a2c18", tgs: "0 1px 0 rgba(255,255,255,.6)", ga: "#7d6a45", a: "#e3c58a", tx: "#3a2c18", g: "✦", bg: "linear-gradient(180deg,#e8d5a8,#bda06a)", bd: "2px dashed #7d6a45", sh: "0 0 20px -8px #a88f63", tc: "text-shadow:0 1px 0 rgba(255,255,255,.55);color:#3a2c18", sub: "#5a4727", p: ["rise", "·"] },
    urban: { a: "#9aa3ad", tx: "#eef1f4", g: "▮", bg: "linear-gradient(180deg,#4a5058,#262a30)", bd: "1px solid #8d949c", sh: "0 0 16px -8px #000", ov: "left:0;right:0;top:auto;bottom:0;height:5px;width:auto;background:repeating-linear-gradient(45deg,#f2c230 0 8px,#1c1f24 8px 16px)", tc: "letter-spacing:.3em", p: ["none"] },
    navy: { a: "#7d93b2", tx: "#eaf1fb", g: "⚓", bg: "linear-gradient(180deg,#25385a,#0f1829)", bd: "2px solid #d4af37", sh: "0 0 22px -6px #4a6488", tc: "text-shadow:0 0 12px #4a6488", p: ["rise", "○"] },
    // ── rare ──
    carbon: { a: "#00e5ff", tx: "#fff", g: "▰", bg: "repeating-linear-gradient(45deg,#1b1e24 0 3px,#0a0b0d 3px 6px)", bd: "1px solid #00e5ff", sh: "0 0 24px -4px #00e5ff,inset 0 0 14px rgba(0,229,255,.2)", tc: "text-shadow:0 0 14px #00e5ff", p: ["none"] },
    tiger: { ga: "#fff", a: "#ff8f1f", tx: "#fff", g: "✶", bg: "repeating-linear-gradient(115deg,#e9821c 0 16px,#16110b 16px 23px,#e9821c 23px 40px)", bd: "2px solid #14100a", sh: "0 0 24px -4px #ff8f1f", tc: "text-shadow:0 0 3px #000,0 0 3px #000,0 2px 0 #000", an: "kfShake .5s", p: ["slash"] },
    sakura: { ga: "#fff", a: "#f48fb1", tx: "#fff", g: "✿", bg: "linear-gradient(180deg,#f9bfd2,#e57ba2)", bd: "1px solid #ffe4ee", sh: "0 0 26px -4px #f48fb1", x: "border-radius:999px", tc: "text-shadow:0 0 12px #c2185b,0 1px 0 #b0446a", p: ["fall", "✿"] },
    ice: { a: "#bff1ff", tx: "#fff", g: "❄", bg: "linear-gradient(135deg,rgba(255,255,255,.4),rgba(150,220,255,.18) 60%,rgba(255,255,255,.3))", bd: "1px solid #fff", sh: "0 0 30px -4px #bff1ff,inset 0 0 18px rgba(255,255,255,.35)", x: "backdrop-filter:blur(3px)", tc: "text-shadow:0 0 16px #5fb8e6", p: ["twinkle", "✧"] },
    celadon: { a: "#8fc1a9", tx: "#f1fff7", g: "❀", bg: "linear-gradient(180deg,#5f9c84,#2f5a49)", bd: "4px double #d4b35a", sh: "0 0 22px -6px #8fc1a9", x: "border-radius:14px", tc: "text-shadow:0 0 10px #3f6f5a", p: ["none"] },
    marble: { tg: "#6b5a38", tgs: "0 1px 0 #fff", a: "#c9a86a", tx: "#2b2723", g: "◈", bg: "linear-gradient(118deg,#f6f3ee,#d8d2c9 34%,#f6f3ee 48%,#bdb6aa 62%,#f6f3ee)", bd: "2px solid #c9a86a", sh: "0 0 22px -6px #c9a86a", tc: "color:#2b2723;text-shadow:0 1px 0 #fff", sub: "#6b5a38", p: ["none"] },
    hex: { a: "#ffb300", tx: "#fff", g: "⬡", bg: "radial-gradient(circle at 0 0,#ffb300 0 2px,transparent 3px) 0 0/16px 14px,radial-gradient(circle at 8px 7px,#ffb300 0 2px,transparent 3px) 0 0/16px 14px,#101114", bd: "2px solid #ffb300", sh: "0 0 24px -4px #ffb300", tc: "text-shadow:0 0 12px #ffb300", p: ["twinkle", "⬡"] },
    wave: { a: "#4fa3e0", tx: "#fff", g: "≈", bg: "linear-gradient(180deg,#1f5f99,#0b2a4a)", bd: "1px solid #8ec5f0", sh: "0 0 24px -4px #4fa3e0", ov: "inset:auto 0 0 0;height:38%;width:auto;opacity:.55;background:radial-gradient(circle at 10px 100%,rgba(232,241,250,.5) 0 8px,transparent 9px) 0 0/24px 14px;animation:kfWave 1.2s linear infinite", tc: "text-shadow:0 0 12px #4fa3e0", p: ["rise", "○"] },
    flip: { a: "#c9d1d9", tx: "#fff", g: "⟋", bg: "repeating-linear-gradient(45deg,#1b1e24 0 3px,#0a0b0d 3px 6px)", bd: "1px solid #c9d1d9", sh: "0 0 20px -6px #c9d1d9", an: "kfFlip .6s", ov: "background:linear-gradient(105deg,transparent 42%,rgba(255,255,255,.85) 50%,transparent 58%);left:-70%;width:70%;animation:kfSweep .45s .2s ease-out forwards", p: ["none"] },
    // ── epic ──
    dancheong: { a: "#f2c230", tx: "#fff7e0", g: "❖", bg: "linear-gradient(#1a1410,#1a1410) padding-box,linear-gradient(90deg,#2e7d5b 0 20%,#c62828 20% 40%,#1e4fa3 40% 60%,#f2c230 60% 80%,#f5efe3 80%) border-box", bd: "4px solid transparent", sh: "0 0 28px -4px #f2c230", tc: "text-shadow:0 0 12px #f2c230", p: ["twinkle", "✦"] },
    ink: { tg: "#222", tgs: "0 0 8px #fff,0 0 2px #fff", ga: "#1b1b1b", a: "#90caf9", tx: "#111", g: "✒", bg: "radial-gradient(ellipse at 18% 85%,rgba(0,0,0,.7),transparent 55%),radial-gradient(ellipse at 88% 15%,rgba(0,0,0,.55),transparent 50%),#f4f1ea", bd: "1px solid #1b1b1b", sh: "0 6px 26px -8px #000", an: "kfInk .7s", tc: "color:#111;text-shadow:0 0 10px #fff,0 0 2px #fff", sub: "#333", p: ["none"] },
    gold: { tg: "#4a3200", tgs: "0 1px 0 rgba(255,255,255,.7)", ga: "#7a5200", a: "#ffd54f", tx: "#3a2600", g: "✦", bg: "linear-gradient(135deg,#f9e27d,#c9961a 38%,#fff1a8 52%,#b8860b)", bd: "2px solid #fff3b0", sh: "0 0 34px -2px #ffd54f", tc: "color:#3a2600;text-shadow:0 1px 0 rgba(255,255,255,.7)", sub: "#5a3f08", ov: "background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.8) 50%,transparent 60%);left:-60%;width:60%;animation:kfSweep .9s .1s ease-out forwards", p: ["twinkle", "✦"] },
    neon: { a: "#00e5ff", tx: "#fff", g: "▶", bg: "#07080c", bd: "2px solid #00e5ff", sh: "0 0 14px #00e5ff,inset 0 0 14px rgba(255,43,214,.6),0 0 40px -6px #ff2bd6", an: "kfFlick .7s", tc: "text-shadow:0 0 6px #fff,0 0 16px #00e5ff,0 0 30px #ff2bd6", p: ["none"] },
    circuit: { a: "#1de9b6", tx: "#d6fff3", g: "▤", bg: "linear-gradient(rgba(29,233,182,.18) 1px,transparent 1px) 0 0/100% 8px,linear-gradient(90deg,rgba(29,233,182,.18) 1px,transparent 1px) 0 0/12px 100%,#07130d", bd: "1px solid #1de9b6", sh: "0 0 24px -4px #1de9b6", ov: "left:0;right:0;width:auto;height:3px;top:0;background:#1de9b6;box-shadow:0 0 12px #1de9b6;animation:kfScan .8s .1s linear 2", tc: "font-family:monospace;text-shadow:0 0 10px #1de9b6", p: ["fall", "1"] },
    dragon: { a: "#9be7c4", tx: "#e6fff3", g: "龍", bg: "radial-gradient(circle at 50% 0,#2a9a74 0 38%,#0e2a22 40% 100%) 0 0/22px 13px,#0e2a22", bd: "3px solid #d4af37", sh: "0 0 26px -4px #1f7a5c", tc: "text-shadow:0 0 12px #000,0 0 10px #1f7a5c", an: "kfShake .5s", p: ["rise", "◈"] },
    aurora: { a: "#2ef2b0", tx: "#fff", g: "✧", bg: "linear-gradient(115deg,#0b2a3a,#2ef2b0,#7c4dff,#29b6f6,#0b2a3a) 0 0/300% 100%", bd: "1px solid #b9ffea", sh: "0 0 34px -4px #2ef2b0", x: "animation:kfAurora 3s linear infinite", tc: "text-shadow:0 0 14px #06121f,0 0 10px #7c4dff", p: ["twinkle", "✧"] },
    tanto: { a: "#ffffff", tx: "#fff", g: "│", bg: "linear-gradient(180deg,#1c1f26,#07080a)", bd: "1px solid #fff", sh: "0 0 24px -6px #fff", an: "kfShake .4s", ov: "background:linear-gradient(100deg,transparent 46%,#fff 50%,transparent 54%);left:-80%;width:80%;animation:kfSweep .3s .15s ease-out forwards", p: ["slash"] },
    kukri: { a: "#d3dae2", tx: "#fff4e6", g: "⟍", bg: "linear-gradient(180deg,#7a4e2c,#3a2414)", bd: "2px solid #b9bfc6", sh: "0 0 22px -6px #d3dae2", an: "kfChop .5s", ov: "background:linear-gradient(80deg,transparent 46%,#e6ebf0 50%,transparent 54%);left:-80%;width:80%;animation:kfSweep .35s .2s ease-out forwards", tc: "text-shadow:0 2px 0 #1a0f08", p: ["slash"] },
    // ── legendary ──
    lava: { a: "#ff7043", tx: "#fff3c9", g: "▲", bg: "repeating-linear-gradient(100deg,transparent 0 22px,rgba(255,112,67,.65) 22px 24px,transparent 24px 46px),radial-gradient(ellipse at 50% 120%,#ff5a1a,transparent 70%),#140e0c", bd: "2px solid #ff7043", sh: "0 0 44px -2px #ff7043,inset 0 0 20px rgba(255,112,67,.4)", x: "animation:kfShake .6s,kfPulse 1.1s ease-in-out infinite", tc: "background:linear-gradient(#fff3c9,#ffb347,#ff5722);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none;filter:drop-shadow(0 0 8px #ff5722)", p: ["rise", "●"] },
    galaxy: { a: "#c56bff", tx: "#fff", g: "✦", bg: "radial-gradient(1px 1px at 12% 30%,#fff,transparent),radial-gradient(1.5px 1.5px at 70% 20%,#fff,transparent),radial-gradient(1px 1px at 40% 80%,#fff,transparent),radial-gradient(1px 1px at 90% 70%,#fff,transparent),radial-gradient(ellipse at 20% 30%,#5a2aa8,transparent 60%),radial-gradient(ellipse at 85% 80%,#1b3a8a,transparent 60%),#0c0722", bd: "1px solid #c56bff", sh: "0 0 44px -2px #7a3df0,inset 0 0 22px rgba(197,107,255,.35)", tc: "text-shadow:0 0 12px #c56bff,0 0 4px #fff,0 0 22px #5a2aa8", p: ["twinkle", "✦"] },
    holo: { ga: "#4b3a8a", a: "#ffffff", tx: "#fff", g: "◇", bg: "linear-gradient(115deg,#ff9ad5,#9ad1ff,#9affc8,#fff59a,#ff9ad5) 0 0/300% 100%", bd: "1px solid #fff", sh: "0 0 40px -4px #9ad1ff", x: "animation:kfGlitch .6s,kfHolo 2.2s linear infinite", ov: "left:0;right:0;top:0;bottom:0;width:auto;background:repeating-linear-gradient(0deg,rgba(255,255,255,.18) 0 1px,transparent 1px 4px);animation:none", tc: "text-shadow:0 0 6px #000,0 0 14px rgba(0,0,0,.6)", p: ["twinkle", "◇"] },
    phoenix: { ga: "#7a1a05", a: "#ff6d00", tx: "#fff8e1", g: "鳳", bg: "linear-gradient(180deg,#ffe57f,#ff8f00 38%,#d81b0c 78%,#2a0806)", bd: "2px solid #ffd180", sh: "0 0 48px -2px #ff6d00,0 0 0 1px rgba(255,209,128,.5)", an: "kfRise2 .7s", x: "border-radius:26px 26px 10px 10px", tc: "color:#fff8e1;text-shadow:0 0 10px #d81b0c,0 2px 0 #7a1a05", p: ["rise", "✦"] },
    storm: { a: "#82b1ff", tx: "#eaf2ff", g: "⚡", bg: "linear-gradient(115deg,transparent 44%,rgba(130,177,255,.5) 46%,transparent 48%) 0 0/46px 100%,linear-gradient(180deg,#1b2233,#0a0c12)", bd: "2px solid #82b1ff", sh: "0 0 46px -2px #5c8dff,inset 0 0 18px rgba(130,177,255,.3)", an: "kfShake .5s", ov: "inset:0;width:auto;background:#e6f0ff;opacity:0;animation:kfBolt .8s .05s ease-out 2", tc: "text-shadow:0 0 6px #fff,0 0 18px #5c8dff", p: ["twinkle", "⚡"] },
    karambit: { a: "#e5383b", tx: "#fff", g: "⟆", bg: "linear-gradient(180deg,#22262d,#0a0b0e)", bd: "2px solid #e5383b", sh: "0 0 40px -2px #e5383b", an: "kfShake .55s", ov: "background:linear-gradient(115deg,transparent 44%,#fff 49%,#e5383b 52%,transparent 57%);left:-90%;width:90%;animation:kfSweep .35s .1s ease-out 2 forwards", tc: "text-shadow:0 0 14px #e5383b", p: ["slash"] },
    bayonet: { a: "#9be7ff", tx: "#fff", g: "†", bg: "linear-gradient(180deg,#2a2d33,#0d0e11)", bd: "1px solid #9be7ff", sh: "0 0 18px -6px #9be7ff", an: "kfShake .4s", ov: "background:linear-gradient(100deg,transparent 46%,#e6f7ff 50%,transparent 54%);left:-80%;width:80%;animation:kfSweep .3s .1s ease-out forwards", p: ["slash"] },
    gut: { a: "#b2ff59", tx: "#f4ffe6", g: "⟅", bg: "linear-gradient(180deg,#2e3a26,#101410)", bd: "1px solid #b2ff59", sh: "0 0 18px -6px #b2ff59", an: "kfShake .4s", ov: "background:linear-gradient(75deg,transparent 46%,#efffd6 50%,transparent 54%);left:-80%;width:80%;animation:kfSweep .3s .12s ease-out forwards", p: ["slash"] },
    bowie: { a: "#ffb74d", tx: "#fff4e0", g: "⟋", bg: "linear-gradient(180deg,#4a3322,#1a120c)", bd: "2px solid #c9a14a", sh: "0 0 22px -6px #ffb74d", an: "kfChop .5s", ov: "background:linear-gradient(80deg,transparent 46%,#fff1d6 50%,transparent 54%);left:-80%;width:80%;animation:kfSweep .35s .18s ease-out forwards", tc: "text-shadow:0 2px 0 #1a0f08", p: ["slash"] },
    kunai: { a: "#ff2bd6", tx: "#fff", g: "◆", bg: "linear-gradient(180deg,#24121f,#09060a)", bd: "2px solid #ff2bd6", sh: "0 0 30px -4px #ff2bd6", an: "kfFlip .6s", ov: "background:linear-gradient(115deg,transparent 45%,#ffd6f6 50%,transparent 55%);left:-90%;width:90%;animation:kfSweep .3s .1s ease-out 2 forwards", tc: "text-shadow:0 0 12px #ff2bd6", p: ["slash"] },
    stiletto: { a: "#ffd54f", tx: "#fffbe6", g: "‡", bg: "linear-gradient(180deg,#26200e,#0a0906)", bd: "2px solid #ffd54f", sh: "0 0 42px -2px #ffd54f,inset 0 0 16px rgba(255,213,79,.3)", x: "animation:kfShake .5s,kfPulse 1.1s ease-in-out infinite", ov: "background:linear-gradient(90deg,transparent 44%,#fff 49%,#ffd54f 52%,transparent 57%);left:-90%;width:90%;animation:kfSweep .25s .08s ease-out 3 forwards", tc: "text-shadow:0 0 14px #ffd54f", p: ["slash"] },
    butterfly: { a: "#ffd76a", tx: "#fff7d6", g: "✧", bg: "linear-gradient(180deg,#3b3a22,#14171c)", bd: "2px solid #ffd76a", sh: "0 0 40px -2px #ffd76a", an: "kfFlip .8s", ov: "background:linear-gradient(60deg,transparent 45%,#fff 50%,transparent 55%);left:-90%;width:90%;animation:kfSweep .4s .25s ease-out 2 forwards", tc: "text-shadow:0 0 14px #ffd76a", p: ["slash"] },
  };

  // ── the css, from the table ──
  const rules = [];
  for (const id in T) {
    const t = T[id],
      k = `#killfx.ks-${id}`;
    rules.push(
      `${k}{--a:${t.a};--g:"${t.g}";--ga:${t.ga || t.a};--tg:${t.tg || "#fff"};--tgs:${t.tgs || "0 0 3px #000,0 1px 3px #000"}}`,
      `${k} #kf-badge{background:${t.bg};border:${t.bd};box-shadow:${t.sh};${t.cl ? "clip-path:" + t.cl + ";" : ""}${t.an ? "animation:" + t.an + " cubic-bezier(.15,.9,.25,1.1);" : ""}${t.x || ""}}`,
      `${k} #kf-main{color:${t.tx};${t.tc || ""}}`,
      t.sub ? `${k} #kf-sub{color:${t.sub}}` : `${k} #kf-sub{color:color-mix(in srgb,${t.a} 40%,#fff)}`,
      t.ov ? `${k} #kf-badge::after{${t.ov}}` : `${k} #kf-badge::after{display:none}`,
    );
  }
  const css = document.createElement("style");
  css.textContent = `
#killfx{gap:6px}#killfx #kf-badge{padding:6px 26px;gap:0}
#killfx.ks #kf-badge{position:relative;overflow:hidden;animation:kfPop .45s cubic-bezier(.15,.9,.25,1.1);display:grid;grid-template-columns:auto auto;justify-content:center;align-items:center;column-gap:10px;row-gap:0;padding:5px 30px}
#killfx.ks #kf-main{grid-column:1/-1;text-align:center;line-height:1.15}
#killfx.ks #kf-sub,#killfx.ks #kf-tag{font-size:9.5px;line-height:1.25;margin:0;letter-spacing:.12em;text-indent:0}
#killfx.ks #kf-sub{justify-self:end}#killfx.ks #kf-tag{justify-self:start}
#killfx.ks #kf-sub:not(:empty)::after{content:"·";margin-left:10px;opacity:.7}
#killfx.ks #kf-sub:empty{display:none}
#killfx.ks #kf-badge::after{content:"";position:absolute;top:0;bottom:0;pointer-events:none}
#killfx.ks #kf-main::before,#killfx.ks #kf-main::after{content:var(--g);display:inline-block;font-size:.8em;margin:0 .7em;letter-spacing:0;color:var(--ga);filter:drop-shadow(0 0 5px var(--ga))}
#killfx.ks #kf-tag{display:block;color:var(--tg);text-shadow:var(--tgs);font-weight:700}
#killfx.ks.r1 #kf-main{font-size:16px}#killfx.ks.r2 #kf-main{font-size:17px}#killfx.ks.r3 #kf-main{font-size:19px}#killfx.ks.r4 #kf-main{font-size:21px}
#killfx.ks.r3 #kf-badge{padding:6px 34px}#killfx.ks.r4 #kf-badge{padding:7px 40px}
#kf-fx{position:absolute;left:-60px;right:-60px;top:-34px;bottom:-30px;pointer-events:none}
.kfp{position:absolute;top:50%;color:var(--a);text-shadow:0 0 8px var(--a);font-size:14px;animation-fill-mode:forwards;animation-timing-function:ease-out;opacity:0}
.kfp.fall{animation-name:kfpFall}.kfp.rise{animation-name:kfpRise}.kfp.twinkle{animation-name:kfpTwinkle}
.kfp.slash{height:2px;width:90px;margin-left:-45px;background:linear-gradient(90deg,transparent,var(--a),#fff,var(--a),transparent);box-shadow:0 0 10px var(--a);transform-origin:50% 50%;animation-name:kfpSlash}
@keyframes kfpFall{0%{transform:translate(0,-34px) rotate(0);opacity:0}15%{opacity:1}100%{transform:translate(var(--dx),48px) rotate(260deg);opacity:0}}
@keyframes kfpRise{0%{transform:translate(0,26px) scale(1);opacity:0}15%{opacity:1}100%{transform:translate(var(--dx),-64px) scale(.3);opacity:0}}
@keyframes kfpTwinkle{0%,100%{opacity:0;transform:scale(.2)}50%{opacity:1;transform:scale(1.3)}}
@keyframes kfpSlash{0%{opacity:0;transform:rotate(var(--rot)) scaleX(.1)}30%{opacity:1;transform:rotate(var(--rot)) scaleX(1)}100%{opacity:0;transform:rotate(var(--rot)) scaleX(1.2) translateY(8px)}}
@keyframes kfSweep{from{left:-70%}to{left:130%}}
@keyframes kfScan{from{top:0}to{top:100%}}
@keyframes kfWave{to{background-position:24px 0}}
@keyframes kfShake{0%,100%{transform:translate(0)}15%{transform:translate(-5px,2px)}30%{transform:translate(5px,-2px)}45%{transform:translate(-3px,1px)}60%{transform:translate(3px,-1px)}}
@keyframes kfFlip{0%{transform:perspective(500px) rotateX(-90deg);opacity:0}60%{transform:perspective(500px) rotateX(12deg);opacity:1}100%{transform:perspective(500px) rotateX(0)}}
@keyframes kfChop{0%{transform:translateY(-26px) scaleY(1.3);opacity:0}55%{transform:translateY(4px) scaleY(.9);opacity:1}100%{transform:none}}
@keyframes kfInk{0%{filter:blur(12px);opacity:0}100%{filter:blur(0);opacity:1}}
@keyframes kfFlick{0%,18%,22%,60%,64%{opacity:.25}20%,62%,100%{opacity:1}}
@keyframes kfPulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.35)}}
@keyframes kfBolt{0%{opacity:.95}100%{opacity:0}}
@keyframes kfRise2{0%{transform:translateY(34px) scale(.8);opacity:0;filter:brightness(2)}60%{transform:translateY(-6px) scale(1.06);opacity:1}100%{transform:none;filter:none}}
@keyframes kfAurora{to{background-position:300% 0}}
@keyframes kfHolo{to{background-position:300% 0}}
@keyframes kfGlitch{0%{transform:translateX(0);clip-path:inset(0)}15%{transform:translateX(-8px);clip-path:inset(10% 0 55% 0)}30%{transform:translateX(8px);clip-path:inset(60% 0 5% 0)}45%{transform:translateX(-4px);clip-path:inset(0)}100%{transform:none}}
${rules.join("\n")}`;
  document.head.appendChild(css);

  const fxBox = (() => {
    const b = document.createElement("div");
    b.id = "kf-fx";
    const k = $("killfx");
    k && k.appendChild(b);
    return b;
  })();
  const spawn = (id, hi) => {
    if (!fxBox) return;
    fxBox.textContent = "";
    const [kind, glyph] = (T[id] || {}).p || ["none"];
    if (!kind || "none" === kind) return;
    const n = "slash" === kind ? 3 : 8 + 2 * hi;
    for (let i = 0; i < n; i++) {
      const s = document.createElement("i");
      s.className = "kfp " + kind;
      s.style.cssText = `left:${6 + 88 * Math.random()}%;--dx:${Math.round(Math.random() * 60 - 30)}px;--rot:${Math.round(-35 + 70 * Math.random())}deg;animation-duration:${0.9 + 0.8 * Math.random()}s;animation-delay:${(0.5 * i) / n}s;font-style:normal`;
      if ("slash" !== kind) s.textContent = glyph;
      fxBox.appendChild(s);
    }
  };

  const _pk = playKillFx;
  playKillFx = function () {
    const r = _pk.apply(this, arguments);
    try {
      const fx = $("killfx"),
        my = "function" == typeof myActor ? myActor() : null;
      let s = null;
      try {
        s = my && !(my.ultW || (window.player && player.ultW)) ? GUN_SKINS.skinOf(my, curWeaponKey()) : null;
      } catch (e) {}
      if (fx) {
        for (const c of [...fx.classList]) /^(ks|ks-.*|r\d)$/.test(c) && fx.classList.remove(c);
        if (s && T[s.id]) {
          fx.classList.add("ks", "ks-" + s.id, "r" + (s.rar | 0));
          const tg = $("kf-tag"),
            R = GUN_SKINS.rar[s.rar | 0] || {};
          tg && (tg.textContent = `${EN() ? s.en : s.ko} · ${EN() ? R.en : R.ko}`);
          fx.style.setProperty("--kfc", T[s.id].a);
          spawn(s.id, s.rar | 0);
        } else spawn("");
        // the entrance again
        const b = $("kf-badge");
        if (b) {
          b.style.animation = "none";
          b.offsetWidth;
          b.style.animation = "";
        }
      }
    } catch (e) {}
    return r;
  };
  window.KILLBANNER = { table: T, ids: () => Object.keys(T), spawn };
})();

(function (root) {
  // Colour-blind modes (SETTINGS.colorblind): "off", "rg" (red-green: deuteranopia and protanopia) and "by" (blue-yellow:
  // tritanopia). The game marks sides with green and red on the minimaps and with a red outline; those pairs run together
  // for the people the mode is for. A mode swaps the pairs for ones that stay apart (rg: blue against orange-yellow, by:
  // cyan against a pink red) and gives enemies a different shape on the maps, so a colour is never the only clue.
  // "off" returns exactly the colours the game always had.
  const MODES = ["off", "rg", "by"];
  const PAL = {
    off: { outAlly: 0x38d6ff, outEnemy: 0xff2e44, mapAlly: "#4ade80", mapEnemy: "#ff3b4e", uiAlly: "#38d6ff", uiFoe: "#ff4a5c", foeDim: "#7a4650", good: "#4ade80", bad: "#ff3b4e", head: "#ff3b4e", hurt: "255,59,78" },
    rg: { outAlly: 0x4db3ff, outEnemy: 0xffb000, mapAlly: "#4db3ff", mapEnemy: "#ffb000", uiAlly: "#4db3ff", uiFoe: "#ffb000", foeDim: "#8a6a1f", good: "#4db3ff", bad: "#f2f2f2", head: "#ffb000", hurt: "255,176,0" },
    by: { outAlly: 0x2de2e6, outEnemy: 0xff3d6e, mapAlly: "#2de2e6", mapEnemy: "#ff3d6e", uiAlly: "#2de2e6", uiFoe: "#ff3d6e", foeDim: "#7a3a4c", good: "#4ade80", bad: "#ff3d6e", head: "#ff3d6e", hurt: "255,61,110" },
  };
  const names = { ko: { off: "끔", rg: "적록 색약", by: "청황 색약" }, en: { off: "Off", rg: "Red-green", by: "Blue-yellow" } };
  const descs = {
    ko: { off: "기본 색입니다", rg: "아군은 파랑, 적은 주황으로 바뀝니다 (적색약 · 녹색약)", by: "아군은 청록, 적은 분홍빛 빨강으로 바뀝니다 (청황색약)" },
    en: { off: "The usual colours", rg: "Allies turn blue and enemies orange (protan and deutan)", by: "Allies turn cyan and enemies pink-red (tritan)" },
  };
  const norm = (m) => (MODES.includes(m) ? m : "off");
  const settings = () => (typeof SETTINGS === "object" && SETTINGS ? SETTINGS : null);
  const mode = () => norm(settings() && settings().colorblind);
  const get = (k) => PAL[mode()][k];
  const hexOf = (c) => parseInt(c.slice(1), 16);
  const rgb = (c) => [(hexOf(c) >> 16) & 255, (hexOf(c) >> 8) & 255, hexOf(c) & 255];
  // "#rrggbb" of a number
  const num = (k) => hexOf(get(k));
  const css = (n) => "#" + n.toString(16).padStart(6, "0");
  // rgba() of a palette colour ("mapAlly") at an alpha
  const rgba = (k, a) => {
    const [r, g, b] = rgb(get(k));
    return `rgba(${r},${g},${b},${a})`;
  };
  // the part of the page that is not drawn on a canvas: custom properties plus a few rules that exist only while a mode is on
  const sheet = typeof document === "object" && document ? document.createElement("style") : null;
  if (sheet) {
    sheet.textContent = `html[data-cb] #rs-n-mine{color:var(--cb-ally)}
html[data-cb] #rs-n-foe{color:var(--cb-foe)}
html[data-cb] .rs-hp i{background:var(--cb-good)}
html[data-cb] .rs-hp.low i{background:#ffc849}
html[data-cb] .rs-mine .rs-p{--pc:var(--cb-ally)!important}
html[data-cb] .rs-foe .rs-p{--pc:var(--cb-foedim)!important}
html[data-cb] .tm-bar i{background:var(--cb-good)}
html[data-cb] .tm-bar.low i{background:#ffc849}
html[data-cb] .tm-bar.crit i{background:var(--cb-bad)}
html[data-cb] .bd-team.mine h4{color:var(--cb-ally)}
html[data-cb] .bd-team.foe h4{color:var(--cb-foe)}
html[data-cb] .ovb-row.mine{border-left-color:var(--cb-ally)}
html[data-cb] .ovb-row.foe{border-left-color:var(--cb-foe)}
html[data-cb] #dmg.hit{box-shadow:inset 0 0 120px rgba(var(--cb-hurt),.5)}
html[data-cb] #hsx i{background:var(--cb-head)}`;
    (document.head || document.documentElement).appendChild(sheet);
  }
  const listeners = [];
  let applied = null;
  // puts the mode on the page (the properties, the attribute) and tells whoever draws with it; cheap when nothing changed
  function apply(force) {
    const m = mode();
    if (!force && applied === m) return m;
    applied = m;
    if (typeof document === "object" && document.documentElement) {
      const d = document.documentElement,
        p = PAL[m];
      "off" === m ? d.removeAttribute("data-cb") : d.setAttribute("data-cb", m);
      d.style.setProperty("--cb-ally", p.uiAlly);
      d.style.setProperty("--cb-foe", p.uiFoe);
      d.style.setProperty("--cb-foedim", p.foeDim);
      d.style.setProperty("--cb-good", p.good);
      d.style.setProperty("--cb-bad", p.bad);
      d.style.setProperty("--cb-head", p.head);
      d.style.setProperty("--cb-hurt", p.hurt);
    }
    for (const f of listeners) {
      try {
        f(m);
      } catch (e) {}
    }
    return m;
  }
  // an enemy on a map: a diamond while a mode is on (a circle is the allies' shape), a circle as ever when off
  function dot(g, x, y, r, enemy) {
    g.beginPath();
    if (enemy && "off" !== mode()) {
      const s = 1.25 * r;
      g.moveTo(x, y - s);
      g.lineTo(x + s, y);
      g.lineTo(x, y + s);
      g.lineTo(x - s, y);
      g.closePath();
    } else g.arc(x, y, r, 0, 7);
    g.fill();
  }
  const CB = { MODES, PAL, mode, get, num, rgba, css, norm, apply, dot, names, descs, onChange: (f) => listeners.push(f) };
  if (typeof module === "object" && module.exports) module.exports = CB;
  else root.CB = CB;
})(typeof window === "object" ? window : globalThis);

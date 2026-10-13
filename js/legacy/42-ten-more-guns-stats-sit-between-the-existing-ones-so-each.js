
(() => {
  // Ten more guns. Stats sit between the existing ones so each has a job;
  // models start from the closest existing gun and add the parts that make
  // them read differently (drum, suppressor, second barrel, scope, rotor...).
  const NEW = {
    stinger: { name: "독침 권총", cls: "보조", cost: 650, dmg: 20, rpm: 1000, mag: 15, spread: 0.02, range: 45, auto: !1, hs: 2.2, burst: 3, reload: 1.7 },
    pocketshot: { name: "산탄 권총", cls: "보조", cost: 550, dmg: 11, rpm: 140, mag: 2, spread: 0.1, range: 12, auto: !1, hs: 1.4, pellets: 7, reload: 1.6 },
    ripper: { name: "드럼 기관단총", cls: "기관단총", cost: 2000, dmg: 17, rpm: 850, mag: 50, spread: 0.038, range: 42, auto: !0, hs: 1.9, reload: 2.8 },
    whisper: { name: "소음 기관단총", cls: "기관단총", cost: 1800, dmg: 18, rpm: 720, mag: 30, spread: 0.028, range: 45, auto: !0, hs: 2, quiet: !0, reload: 2 },
    burstsmg: { name: "점사 기관단총", cls: "기관단총", cost: 1700, dmg: 22, rpm: 1000, mag: 27, spread: 0.022, range: 50, auto: !0, hs: 2, burst: 3, reload: 2 },
    doublebarrel: { name: "더블배럴", cls: "산탄총", cost: 1000, dmg: 13, rpm: 260, mag: 2, spread: 0.085, range: 16, auto: !1, hs: 1.5, pellets: 10, reload: 2.2 },
    scout: { name: "정찰 소총", cls: "소총", cost: 2700, dmg: 48, rpm: 300, mag: 15, spread: 0.01, range: 120, auto: !1, hs: 2.8, reload: 2.1 },
    bullpup: { name: "불펍 소총", cls: "소총", cost: 2700, dmg: 30, rpm: 760, mag: 30, spread: 0.02, range: 80, auto: !0, hs: 2.9, reload: 2.2 },
    minigun: { name: "회전 기관총", cls: "기관총", cost: 4500, dmg: 22, rpm: 1200, mag: 120, spread: 0.06, range: 70, auto: !0, hs: 2, reload: 4.2 },
    antimat: { name: "대물 저격총", cls: "저격총", cost: 5200, dmg: 170, rpm: 35, mag: 4, spread: 0.001, range: 240, auto: !1, hs: 1.5, reload: 3.2 },
  };
  for (const k in NEW) WEAPONS[k] || (WEAPONS[k] = NEW[k]);

  // models: the base gun plus extra parts in a child group
  const M = GUNMAT;
  const extend = (base, parts, tint) => () => {
    const g = GUN_BUILD[base] ? GUN_BUILD[base]() : new T.Group();
    if (tint)
      g.traverse((o) => {
        if (!o.isMesh || !o.material || !o.material.color) return;
        const h = {};
        o.material.color.getHSL(h);
        // recolour the painted/polymer parts only, keep metal and glass
        if (h.s > 0.12 || (h.l > 0.12 && h.l < 0.5 && !o.material.metalness)) (o.material = o.material.clone()), o.material.color.lerp(new T.Color(tint), 0.55);
      });
    const b = GunBuilder();
    parts(b);
    g.add(b.group);
    return g;
  };
  GUN_BUILD.stinger = extend("pistol", (b) => {
    b.box(M.glow(0x76ff03), 0.008, 0.012, 0.16, 0.026, 0.02, -0.08);
    b.box(M.glow(0x76ff03), 0.008, 0.012, 0.16, -0.026, 0.02, -0.08);
    b.barrel(M.black(), 0.012, 0.06, 0, 0.03, -0.24);
  }, 0x33691e);
  GUN_BUILD.pocketshot = extend("handcan", (b) => {
    b.barrel(M.gunmetal(), 0.026, 0.12, -0.016, 0.03, -0.26);
    b.barrel(M.gunmetal(), 0.026, 0.12, 0.016, 0.03, -0.26);
    b.torus(M.brass(), 0.03, 0.006, 14, 0, 0.03, -0.32);
  }, 0x5d4037);
  GUN_BUILD.ripper = extend("smg", (b) => {
    b.cyl(M.black(), 0.075, 0.075, 0.07, 18, 0, -0.1, -0.1, 0, 0, Math.PI / 2);
    b.cyl(M.gunmetal(), 0.03, 0.03, 0.075, 12, 0, -0.1, -0.1, 0, 0, Math.PI / 2);
  }, 0x263238);
  GUN_BUILD.whisper = extend("pdw", (b) => {
    b.barrel(M.black(), 0.026, 0.26, 0, 0.02, -0.42);
    b.barrel(M.rubber(), 0.028, 0.02, 0, 0.02, -0.32);
    b.barrel(M.rubber(), 0.028, 0.02, 0, 0.02, -0.5);
  }, 0x37474f);
  GUN_BUILD.burstsmg = extend("vector", (b) => {
    b.box(M.glow(0xffab40), 0.06, 0.008, 0.08, 0, 0.07, -0.05);
    b.box(M.polymer(), 0.05, 0.04, 0.1, 0, -0.03, -0.24);
  }, 0xbf360c);
  GUN_BUILD.doublebarrel = extend("shotgun", (b) => {
    b.barrel(M.blued(), 0.024, 0.5, -0.026, 0.04, -0.38);
    b.barrel(M.blued(), 0.024, 0.5, 0.026, 0.04, -0.38);
    b.box(M.woodDark(), 0.07, 0.06, 0.2, 0, -0.01, -0.22);
  }, 0x6d4c41);
  GUN_BUILD.scout = extend("carbine", (b) => {
    b.barrel(M.black(), 0.028, 0.24, 0, 0.12, -0.08);
    b.box(M.gunmetal(), 0.02, 0.04, 0.03, 0, 0.085, -0.02);
    b.box(M.gunmetal(), 0.02, 0.04, 0.03, 0, 0.085, -0.16);
    b.cyl(M.glass(), 0.024, 0.024, 0.005, 14, 0, 0.12, -0.2, Math.PI / 2, 0, 0);
  }, 0x556b2f);
  GUN_BUILD.bullpup = extend("rifle", (b) => {
    b.box(M.polymer(), 0.07, 0.11, 0.18, 0, 0.0, 0.12);
    b.box(M.glow(0x40c4ff), 0.03, 0.03, 0.05, 0, 0.1, -0.06);
  }, 0xc2a36b);
  GUN_BUILD.minigun = extend("hmg", (b) => {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.barrel(M.blued(), 0.012, 0.62, Math.cos(a) * 0.036, 0.02 + Math.sin(a) * 0.036, -0.52);
    }
    b.torus(M.gunmetal(), 0.05, 0.01, 18, 0, 0.02, -0.3);
    b.torus(M.gunmetal(), 0.05, 0.01, 18, 0, 0.02, -0.78);
    b.box(M.black(), 0.1, 0.12, 0.14, 0.09, -0.04, 0.0);
  }, 0x455a64);
  GUN_BUILD.antimat = extend("sniper", (b) => {
    b.box(M.gunmetal(), 0.07, 0.05, 0.08, 0, 0.02, -0.98);
    b.box(M.black(), 0.075, 0.012, 0.06, 0, 0.045, -0.98);
    [-1, 1].forEach((s) => b.box(M.black(), 0.012, 0.012, 0.22, s * 0.04, -0.07, -0.55, -0.6, 0, s * 0.3));
    b.mag(M.black(), 0.05, 0.12, 0.1, 0, -0.1, -0.05);
  }, 0x3e4a3a);

  // bots get the new guns into their shopping lists by role
  try {
    const add = (k, list) => AI_LOADOUT[k] && AI_LOADOUT[k].guns.push(...list.filter((g) => !AI_LOADOUT[k].guns.includes(g)));
    add("strike", ["bullpup", "doublebarrel", "ripper"]);
    add("watch", ["scout", "antimat"]);
    add("scout", ["whisper", "burstsmg"]);
    add("brain", ["minigun", "bullpup"]);
    add("base", ["bullpup", "ripper"]);
  } catch (e) {}
  // the local player's reload was 1.9 s for everything (2.6 for the sniper);
  // guns that name their own reload time now use it
  const _sr = startReload;
  startReload = function () {
    const before = player.reloading || 0;
    const r = _sr.apply(this, arguments);
    try {
      const w = WEAPONS[curWeaponKey()];
      before <= 0 && player.reloading > 0 && w && w.reload && (player.reloading = w.reload);
    } catch (e) {}
    return r;
  };
  window.GUN_COUNT = Object.keys(WEAPONS).length;
})();

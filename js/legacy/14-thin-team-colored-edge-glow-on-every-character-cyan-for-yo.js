
(() => {
  // Thin team-colored edge glow on every character: cyan for your side, red
  // for the other side (everyone else in free-for-all). It rides the existing
  // character shader as an extra fresnel term, so no extra draw calls.
  function teamVC(key, hex) {
    const m = CH_VC.clone(),
      U = { value: new T.Color(hex) };
    m.onBeforeCompile = (sh) => {
      CH_VC.onBeforeCompile(sh);
      sh.uniforms.uTeam = U;
      sh.fragmentShader =
        "uniform vec3 uTeam;\n" +
        sh.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\n  { float tf = 1.0 - saturate(dot(normal, normalize(vViewPosition))); totalEmissiveRadiance += uTeam * (0.85 * pow(tf, 3.4)); }"
        );
    };
    m.customProgramCacheKey = () => "chvc_" + key;
    m.envMapIntensity = CH_VC.envMapIntensity;
    m.userData.keep = !0;
    m.userData.chTeam = key;
    m.userData.uTeam = U;
    return m;
  }
  const ALLY = teamVC("ally", CB.PAL.off.outAlly),
    ENEMY = teamVC("enemy", CB.PAL.off.outEnemy);
  window.TEAM_GLOW = { ALLY, ENEMY };
  // the colour-blind mode (js/colorblind.js) changes the two colours in place; the shader reads them every frame
  CB.onChange(() => {
    ALLY.userData.uTeam.value.setHex(CB.get("outAlly"));
    ENEMY.userData.uTeam.value.setHex(CB.get("outEnemy"));
  });
  CB.apply(!0);
  function tag(a) {
    const m = a && a.model;
    if (!m || !m.group) return;
    const me = ("function" == typeof myActor && myActor()) || player;
    const want = me && (a === me || a.team === me.team) ? ALLY : ENEMY;
    if (!m._teamMeshes) {
      m._teamMeshes = [];
      m.group.traverse((o) => o.isMesh && o.material === CH_VC && m._teamMeshes.push(o));
    }
    // other effects may swap the material for a while (ghost, reveal); only
    // touch meshes that are on the plain body material or the other team's
    for (const o of m._teamMeshes) (o.material === CH_VC || o.material === ALLY || o.material === ENEMY) && o.material !== want && (o.material = want);
  }
  const _sam = syncActorModel;
  syncActorModel = function (a) {
    const r = _sam.apply(this, arguments);
    try {
      tag(a);
    } catch (e) {}
    return r;
  };
})();

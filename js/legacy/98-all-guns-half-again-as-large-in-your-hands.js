(() => {
  // Every gun in your own hands is drawn half again as large (they read small on a phone and a laptop). The hands are
  // placed from the gun's own box (vmWithHands), so they follow; the top is pulled down by the growth so the sights
  // stay where they were. The knife (its own build) and what others see are untouched.
  if ("function" != typeof buildProcWeapon) return;
  const K = 1.5,
    TOP = 0.07;
  const _b = buildProcWeapon;
  buildProcWeapon = function (key) {
    const g = _b.apply(this, arguments);
    try {
      if (g && "knife" !== key && !g.userData.sized) {
        g.userData.sized = 1;
        g.scale.multiplyScalar(K);
        g.position.y -= TOP * (K - 1);
      }
    } catch (e) {}
    return g;
  };
  window.GUN_SIZE = { vm: K };
})();

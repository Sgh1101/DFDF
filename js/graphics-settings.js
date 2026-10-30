(function (root, factory) {
  const config = factory();
  if (typeof module === 'object' && module.exports) module.exports = config;
  else root.GRAPHICS_SETTINGS = config;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const order = Object.freeze(['mobile', 'perf', 'visual', 'ultra']);
  // Every mode supplies every setting so a downgrade cannot retain ultra costs.
  const presets = {
    mobile: {name:'휴대폰',desc:'선명한 화면 유지 · 가벼운 맵·재질, 그림자·후처리 끄기',
      pixel:1,shadow:false,shadowRes:512,charShadow:false,decorShadow:false,shadowEvery:2,blur:false,
      lamps:0,detailGun:false,fx:.35,tracer:true,shells:false,post:false,msaa:0,bloom:0,
      textureSize:256,mapRelief:false,minScale:1},
    perf: {name:'성능',desc:'프레임 우선 · 해상도 절약, 그림자·후처리 끄기, 가벼운 이펙트',
      pixel:.9,shadow:false,shadowRes:512,charShadow:false,decorShadow:false,shadowEvery:2,blur:false,
      lamps:3,detailGun:false,fx:.65,tracer:true,shells:false,post:false,msaa:0,bloom:0,
      textureSize:512,mapRelief:false,minScale:.8},
    visual: {name:'비주얼',desc:'선명한 화면 · 상세 총기, 고해상도 그림자, 조명·잔광 켜기',
      pixel:1.25,shadow:true,shadowRes:2048,charShadow:true,decorShadow:true,shadowEvery:2,blur:true,
      lamps:12,detailGun:true,fx:1,tracer:true,shells:true,post:true,msaa:2,bloom:1,
      textureSize:1024,mapRelief:true,minScale:.85},
    ultra: {name:'최고',desc:'최대 품질 · 높은 화면 해상도, 정밀 그림자, 풍부한 조명·이펙트',
      pixel:2,shadow:true,shadowRes:4096,charShadow:true,decorShadow:true,shadowEvery:1,blur:true,
      lamps:20,detailGun:true,fx:1.5,tracer:true,shells:true,post:true,msaa:4,bloom:1.1,
      textureSize:1024,mapRelief:true,minScale:.9},
  };
  // Point lights the effects pool keeps in the scene: each costs lighting maths in every lit pixel, lit or not.
  const fxLights = {mobile:1,perf:2,visual:2,ultra:4};
  for (const key of order) presets[key].fxLights = fxLights[key];
  for (const preset of Object.values(presets)) Object.freeze(preset);
  Object.freeze(presets);
  const defaultMode = phone => phone ? 'mobile' : 'perf';
  function normalize(value, phone = false) {
    if (typeof value === 'string' && order.includes(value)) return value;
    if (['min','low','fast'].includes(value)) return 'mobile';
    if (value === 'balance') return 'perf';
    return defaultMode(phone); // Old automatic and malformed settings become a fixed mode.
  }
  function advanceResolution(state, seconds, minScale) {
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 1) return false;
    const dt = Math.min(.25, seconds);
    state.ema += (1 - Math.exp(-4 * dt)) * (dt - state.ema);
    state.cool -= dt;
    state.good = state.ema < 1 / 56 ? state.good + dt : 0;
    if (state.cool > 0) return false;
    const old = state.scale;
    if (state.ema > 1 / 48) state.scale = Math.max(minScale, old - .1);
    else if (state.good > 6) state.scale = Math.min(1, old + .1);
    if (state.scale === old) return false;
    state.cool = state.scale < old ? 1.2 : 4; state.good = 0;
    return true;
  }
  return Object.freeze({order,presets,defaultMode,normalize,advanceResolution});
});

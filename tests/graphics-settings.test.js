const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../js/graphics-settings');
const engine=fs.readFileSync('js/legacy/03-engine.js','utf8');
test('four complete budgets migrate old saved choices without a hidden automatic mode',()=>{
 assert.deepEqual(C.order,['mobile','perf','visual','ultra']);
 assert.deepEqual(C.order.map(k=>C.presets[k].name),['휴대폰','성능','비주얼','최고']);
 const fields=Object.keys(C.presets.mobile).sort();
 for(const key of C.order)assert.deepEqual(Object.keys(C.presets[key]).sort(),fields,'every cost resets when switching '+key);
 for(const old of ['min','fast','low'])assert.equal(C.normalize(old),'mobile');
 assert.equal(C.normalize('balance'),'perf');assert.equal(C.normalize('auto',true),'mobile');
 for(const invalid of [null,undefined,{},'auto','highest','__proto__'])assert.equal(C.normalize(invalid),'perf');
 assert.equal(C.defaultMode(true),'mobile');assert.equal(C.defaultMode(false),'perf');
 for(const key of C.order)assert.equal(C.normalize(key,true),key,'a phone may explicitly choose higher quality');
 for(const key of ['mobile','perf']){assert.equal(C.presets[key].post,false);assert.equal(C.presets[key].msaa,0);assert.equal(C.presets[key].shadow,false);}
 assert.ok(C.presets.perf.pixel<C.presets.visual.pixel&&C.presets.visual.pixel<C.presets.ultra.pixel);
 assert.ok(C.presets.mobile.pixel*C.presets.mobile.minScale>=1,'mobile keeps at least one game pixel per CSS pixel, including slow frames');
 assert.equal(C.presets.mobile.textureSize,256,'save map material work instead of blurring the scene');
});
test('slow frames lower resolution only within the selected budget and sustained fast play recovers it',()=>{
 for(const key of C.order){
  const s={scale:1,ema:1/60,cool:2,good:0},min=C.presets[key].minScale;
  for(let i=0;i<600;i++)C.advanceResolution(s,1/20,min);
  assert.equal(s.scale,min,key+' keeps its own floor');
  for(let i=0;i<2200;i++)C.advanceResolution(s,1/120,min);
  assert.equal(s.scale,1,key+' recovers without exceeding the preset');
  const before={...s};for(const dt of [0,-1,NaN,Infinity,5])assert.equal(C.advanceResolution(s,dt,min),false);
  assert.deepEqual(s,before,'invalid intervals and background gaps do not change quality');
 }
});
test('actual settings load normalizes legacy choices and keeps unrelated preferences',()=>{
 const load=engine.slice(engine.indexOf('function loadSettings()'),engine.indexOf('function saveSettings()'));
 for(const [value,phone,expected] of [['fast',false,'mobile'],['balance',false,'perf'],['auto',true,'mobile'],['visual',true,'visual']]){
  const def={quality:C.defaultMode(phone),sens:1,sfx:true},c={GRAPHICS_SETTINGS:C,SET_DEF:def,SETTINGS:{...def},localStorage:{getItem:()=>JSON.stringify({quality:value,sens:1.8,sfx:false})}};
  vm.runInNewContext(load+';loadSettings();',c);
  assert.equal(c.SETTINGS.quality,expected);assert.equal(c.SETTINGS.sens,1.8);assert.equal(c.SETTINGS.sfx,false);
 }
});
test('actual ultra to mobile transition clears expensive state and releases retained rendering targets',()=>{
 const source=engine.slice(engine.indexOf('function applyGfx('),engine.indexOf('function rebuildActorModels()'));
 const sizes=[],ratios=[],c={GFX:{...C.presets.ultra},DYNRES:{scale:.9,cool:0},POST:{ok:true,w:2560,h:1440},sun:{shadow:{map:{dispose(){c.shadowDisposed++;}}}},shadowDisposed:0,
  matchMedia:()=>({matches:false}),navigator:{userAgent:'desktop'},devicePixelRatio:2,innerWidth:1280,innerHeight:720,
  renderer:{setPixelRatio:v=>ratios.push(v),setSize(){},shadowMap:{}},world:{actors:[]},MAPS:{ascent_trial:{graphicsStatic:true}},CUR_MAP_KEY:'ascent_trial',loadMap(){c.mapLoads++;},mapLoads:0,
  window:{},scene:{traverse(){}},setShadowRes(){},rebuildActorModels(){c.rebuilds++;},rebuilds:0,updateGfxLabel(){},shadowRefresh(){c.refreshes++;},refreshes:0,blur:null,document:{body:{classList:{toggle(n,v){assert.equal(n,'gfx-blur');c.blur=v;}}}}};
 for(const key of ['rt','hA','hB','qA','qB'])c.POST[key]={setSize:(w,h)=>sizes.push([key,w,h])};
 vm.createContext(c);vm.runInContext(source,c);c.applyGfx(C.presets.mobile,false);
 assert.equal(c.GFX.msaa,0);assert.equal(c.GFX.shadowEvery,2);assert.equal(c.GFX.post,false);assert.equal(c.GFX.bloom,0);
 assert.equal(c.shadowDisposed,1);assert.equal(c.sun.shadow.map,null);assert.equal(sizes.length,5);assert.ok(sizes.every(s=>s[1]===4&&s[2]===4));
 assert.equal(c.POST.w,0);assert.equal(c.mapLoads,0,'Ascent collision/nav is not rebuilt for lamp counts');assert.equal(c.rebuilds,1);assert.deepEqual(ratios,[1]);
 assert.equal(c.blur,false,'the glass blur behind the HUD goes with the mobile preset');assert.equal(c.refreshes,1,'a preset change redraws the shadow map at once');
 c.CUR_MAP_KEY='garden';c.MAPS.garden={};c.applyGfx(C.presets.visual,false);assert.equal(c.mapLoads,1,'regular maps rebuild their mode-specific lamps');
 assert.equal(c.blur,true);c.applyGfx(C.presets.perf,false);assert.equal(c.blur,false);c.applyGfx(C.presets.ultra,false);assert.equal(c.blur,true);
});
test('live resolution adjustment respects pauses, disabled settings and the chosen mode',()=>{
 const source=engine.slice(engine.indexOf('function dynRes('),engine.indexOf('const TICK_STEP ='));
 const ratios=[],pause={hidden:true},admin={hidden:true},c={GRAPHICS_SETTINGS:C,SETTINGS:{dynRes:true},navigator:{webdriver:false},world:{phase:'live'},document:{hidden:false},shopOpen:false,
  GFX:{...C.presets.mobile},DYNRES:{scale:1,ema:1/60,cool:2,good:0},devicePixelRatio:3,renderer:{setPixelRatio:v=>ratios.push(v)},$:id=>id==='pause'?pause:admin};
 vm.createContext(c);vm.runInContext(source,c);
 pause.hidden=false;for(let i=0;i<60;i++)c.dynRes(.1);assert.equal(c.DYNRES.scale,1,'settings screen is excluded from samples');
 pause.hidden=true;for(let i=0;i<80;i++)c.dynRes(.1);assert.equal(c.DYNRES.scale,1);assert.equal(ratios.length,0,'mobile never drops into the previous 60% blur');
 c.GFX={...C.presets.perf};for(let i=0;i<80;i++)c.dynRes(.1);assert.equal(c.DYNRES.scale,.8);assert.ok(Math.abs(ratios.at(-1)-.72)<1e-9,'other modes retain bounded dynamic resolution');
 const before={...c.DYNRES};c.SETTINGS.dynRes=false;for(let i=0;i<100;i++)c.dynRes(1/120);assert.deepEqual(c.DYNRES,before,'off means no automatic resolution changes');
 assert.equal(c.GFX.name,'성능','the selected preset does not change');
});
test('only the visual and ultra presets keep the glass blur behind the HUD',()=>{
 assert.deepEqual(C.order.filter(k=>C.presets[k].blur),['visual','ultra']);
 for(const k of C.order)assert.equal(typeof C.presets[k].blur,'boolean');
});
function shadowRig(preset,mapKey='glacier'){
 const source=engine.slice(engine.indexOf('var _shN ='),engine.indexOf('const SCREENS =',engine.indexOf('var _shN =')));
 const vec=(x,y,z)=>({x,y,z});
 const c={GFX:{...C.presets[preset]},CUR_MAP_KEY:mapKey,sun:{position:vec(-55,95,45),target:{position:vec(0,0,0)},shadow:{map:{}}},
  camera:{},renderer:{shadowMap:{enabled:true,needsUpdate:false,autoUpdate:true},render(){c.draws++;if(c.renderer.shadowMap.needsUpdate){c.shadowDraws++;c.renderer.shadowMap.needsUpdate=false;}}},scene:{},draws:0,shadowDraws:0,
  followSun(){const o=c.sun,x=Math.round(c.camera.x*10)/10,z=Math.round(c.camera.z*10)/10;o.target.position.x=x;o.target.position.z=z;o.position.x=x-55;o.position.z=z+45;o.position.y=95;},
  postActive:()=>false,POST:{},T:{}};
 c.followSun=c.followSun;c.camera.x=0;c.camera.z=0;
 vm.createContext(c);vm.runInContext(source+';this.render=render;this.shadowDue=shadowDue;this.shadowRefresh=shadowRefresh;',c);
 c.frame=(n=1)=>{for(let i=0;i<n;i++)c.render();};
 return c;
}
test('the shadow map is drawn every shadowEvery frames, and at once when the sun, the map or the preset changes',()=>{
 for(const [preset,every] of [['visual',2],['ultra',1]]){
  const c=shadowRig(preset);assert.equal(c.GFX.shadowEvery,every);
  c.frame();assert.equal(c.shadowDraws,1,'the first frame draws the map');
  const before=c.shadowDraws;c.camera.x=0.2;c.frame(12);
  assert.equal(c.shadowDraws-before,12/every,preset+': 1 draw per '+every+' frames while the sun drifts a little each frame');
 }
 const c=shadowRig('visual');c.frame();c.shadowDraws=0;
 c.frame();assert.equal(c.shadowDraws,0,'a frame between two draws leaves the shadow map alone');c.frame();assert.equal(c.shadowDraws,1);
 // right after a draw the next frame is not due by the cadence, so a draw there can only come from the change
 const justDrawn=()=>{for(let i=0;i<4;i++){const d=c.shadowDraws;c.frame();if(c.shadowDraws>d)break;}c.shadowDraws=0;c.frame();assert.equal(c.shadowDraws,0);};
 const atOnce=(change,why)=>{justDrawn();change();c.frame();assert.equal(c.shadowDraws,1,why);};
 atOnce(()=>{c.camera.x=40;},'a sun that jumped (respawn, spectate) is redrawn at once');
 atOnce(()=>{c.CUR_MAP_KEY='garden';},'a new map is drawn at once');
 atOnce(()=>{c.sun.shadow.map=null;},'a new shadow map is drawn at once');c.sun.shadow.map={};
 atOnce(()=>c.shadowRefresh(),'shadowRefresh (a preset change) draws at once');
 atOnce(()=>{c.sun.position.y+=1;},'a sun that turned is drawn at once');
 c.GFX.shadowEvery=4;c.frame(3);const n=c.shadowDraws;c.frame(8);assert.equal(c.shadowDraws-n,2,'the reduced budget (shadowEvery 4) is read live');
 c.renderer.shadowMap.enabled=false;c.shadowDraws=0;c.frame(10);assert.equal(c.shadowDraws,0,'no shadow map, no draws');
 c.renderer.shadowMap.enabled=true;c.frame();assert.equal(c.shadowDraws,1,'turning shadows back on draws at once');
});
test('a shadow frame allocates nothing and does not walk the scene',()=>{
 const c=shadowRig('visual');let walks=0;c.scene={traverseVisible(){walks++;},traverse(){walks++;},updateMatrixWorld(){walks++;}};
 c.frame(4);assert.equal(walks,0,'no scene walk, no extra matrix update');
 assert.doesNotMatch(engine.slice(engine.indexOf('function shadowDue()'),engine.indexOf('const SCREENS =')),/new Map|\.map\(|\.\.\.|updateMatrixWorld|traverse/);
});

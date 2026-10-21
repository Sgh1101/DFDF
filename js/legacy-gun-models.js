(() => {
  'use strict';
  // Only the six original procedural guns below. Imported geometry, the
  // recon rifle, Comet, RPG, knives and Champions keep their own builders.
  const keys = ['machpist', 'smg', 'whisper', 'shotgun', 'pocketshot', 'burst'];
  function kit(key) {
    const b = GunBuilder(), M = GUNMAT;
    const m = { body: M.polymer(), metal: M.gunmetal(), dark: M.blued(), rubber: M.rubber(), wood: M.wood(), accent: M.brass() };
    const root = b.group;
    root.name = 'dfdf-' + key;
    root.userData.weaponModel = 'dfdf-' + key;
    root.userData.modelRevision = 1;
    root.userData.anchors = {
      right: key === 'machpist' ? [.004,-.08,.035] : [.004,-.09,.11],
      left: ({smg:[-.006,-.065,-.19],whisper:[-.006,-.06,-.25],shotgun:[-.006,-.055,-.28],burst:[-.006,-.05,-.27]})[key] || null,
    };
    // A bevelled side profile extruded across X. Barrel forward is -Z,
    // matching the existing first-person, pickup and third-person builders.
    function profile(name, mat, width, points) {
      const shape = new T.Shape();
      points.forEach(([z, y], i) => i ? shape.lineTo(-z, y) : shape.moveTo(-z, y));
      shape.closePath();
      const geo = new T.ExtrudeGeometry(shape, { depth: width - .004, bevelEnabled: true, bevelSize: .002, bevelThickness: .002, bevelSegments: 1, steps: 1, curveSegments: 6 });
      geo.rotateY(Math.PI / 2); geo.translate(-width / 2 + .002, 0, 0);
      const mesh = new T.Mesh(geo, mat); mesh.name = name; root.add(mesh); return mesh;
    }
    const box = (name, mat, w, h, d, x, y, z, rx = 0) => {
      const mesh = b.box(mat, w, h, d, x, y, z, rx); mesh.name = name; return mesh;
    };
    function bore(z, y, r, x = 0) {
      root.userData.anchors.muzzle = [x,y,z-.006];
      b.barrel(m.dark, r, .008, x, y, z + .004).name = 'muzzle-bore';
      b.torus(m.metal, r + .004, .003, 12, x, y, z).name = 'muzzle-crown';
    }
    function grip(z, y = -.045, material = m.rubber) {
      profile('pistol-grip', material, .045, [[z-.027,y+.015],[z+.028,y+.012],[z+.065,y-.125],[z+.013,y-.137],[z-.006,y-.095]]);
      for (const side of [-1, 1]) for (let i = 0; i < 4; i++)
        box('grip-serration', m.dark, .003, .006, .038, side*.024, y-.03-i*.021, z+.014+i*.006);
    }
    function guard(z, y = -.063) {
      // The guard lies in the YZ plane; the old front-facing torus looked
      // like a loose ring when the gun was viewed from the side.
      box('trigger-guard', m.dark, .016, .009, .078, 0, y-.03, z);
      box('trigger-guard-front', m.dark, .016, .048, .009, 0, y-.01, z-.036, -.18);
      box('trigger-guard-rear', m.dark, .016, .04, .009, 0, y-.01, z+.034);
      box('trigger', m.metal, .009, .032, .009, 0, y-.002, z+.007, -.2);
    }
    function sights(front, rear, y) {
      for (const [z, h] of [[front,.022],[rear,.018]]) {
        box('sight-base', m.dark, .033, .01, .025, 0, y, z);
        for (const side of [-1,1]) box('sight-ear', m.metal, .006, h, .013, side*.012, y+h/2, z);
      }
      box('front-sight-post', m.accent, .004, .018, .006, 0, y+.013, front);
    }
    function controls(z, y, width) {
      box('ejection-port', m.dark, .004, .023, .064, width/2+.001, y, z);
      box('bolt', m.metal, .005, .009, .045, width/2+.003, y-.002, z);
      box('charging-handle-track', m.dark, .004, .009, .074, -width/2-.001, y+.008, z);
      box('charging-handle', m.metal, .02, .012, .018, -width/2-.009, y+.008, z+.02);
      for (const s of [-1,1]) {
        b.pin(m.metal, .005, s*(width/2+.002), y-.028, z+.067);
        box('selector', m.metal, .006, .008, .025, s*(width/2+.003), y-.04, z+.082, -.25);
      }
    }
    function magazine(z, height, depth, lean = .08) {
      const y = -.043-height/2;
      b.mag(m.dark, .041, height, depth, 0, y, z, lean).name = 'magazine-body';
      b.mag(m.rubber, .047, .014, depth+.008, 0, y-height/2+.002, z+height/2*Math.sin(lean), lean).name = 'magazine-floorplate';
      // Use mag() for every attached detail so the reload rig moves the
      // complete assembly, including its floorplate and witness grooves.
      for (const side of [-1,1]) for (let i=0;i<3;i++)
        b.mag(m.metal, .002, height*.65, .004, side*.021, y, z+(i-1)*depth*.24, lean).name='magazine-groove';
    }
    function stock(z, end, y = .018) {
      for (const s of [-1,1]) box('stock-strut', m.metal, .011, .018, end-z, s*.021, y, (z+end)/2);
      profile('stock-cheek', m.body, .055, [[z,y+.018],[end-.008,y+.018],[end-.008,y-.034],[z+.05,y-.018]]);
      box('stock-butt', m.rubber, .06, .107, .024, 0, y-.024, end);
      for(let i=0;i<4;i++)box('butt-pad-rib',m.dark,.062,.006,.009,0,y+.012-i*.024,end+.014);
    }
    function vents(z, count, width, y, step = .027) {
      for (const s of [-1,1]) for (let i=0;i<count;i++)
        box('handguard-vent', m.dark, .003, .013, .014, s*(width/2+.001), y, z+i*step);
    }
    function action(name, build, pivot) {
      const start = root.children.length; build();
      const group = new T.Group(); group.name = name;
      group.position.set(...pivot); root.add(group); root.updateMatrixWorld(true);
      for (const mesh of root.children.slice(start, -1)) {
        mesh.userData.live = true; group.attach(mesh);
      }
      group.userData.legacyAction = name;
      return group;
    }
    return { b, m, root, profile, box, bore, grip, guard, sights, controls, magazine, stock, vents, action };
  }

  GUN_BUILD.machpist = () => {
    const {b,m,root,profile,box,bore,guard,sights} = kit('machpist');
    profile('frame',m.body,.049,[[-.22,.006],[-.21,-.025],[-.074,-.035],[-.033,-.067],[.025,-.055],[.065,-.02],[.061,.025],[-.19,.025]]);
    profile('slide',m.metal,.053,[[-.245,.027],[-.234,.072],[.049,.072],[.067,.05],[.063,.025]]);
    profile('pistol-grip',m.rubber,.046,[[-.018,-.025],[.04,-.025],[.075,-.153],[.022,-.163],[-.005,-.11]]);
    b.mag(m.dark,.035,.068,.046,0,-.178,.057,.24).name='extended-magazine';
    b.mag(m.rubber,.045,.014,.055,0,-.212,.065,.24).name='magazine-floorplate';
    guard(-.043,-.06);
    b.barrel(m.dark,.012,.034,0,.045,-.25); bore(-.27,.045,.008);
    for(const s of [-1,1]) {
      for(let i=0;i<5;i++)box('slide-serration',m.dark,.003,.03,.005,s*.027,.047,.004+i*.009,.12);
      for(let i=0;i<3;i++)box('compensator-port',m.dark,.003,.009,.011,s*.027,.054,-.226+i*.018);
      box('frame-pin',m.metal,.003,.008,.008,s*.025,-.025,.013);
      box('safety',m.dark,.008,.007,.029,s*.026,.009,.035);
    }
    box('slide-ejection-port',m.dark,.028,.003,.044,0,.074,-.086);
    box('chamber',m.metal,.023,.004,.028,0,.075,-.084);
    sights(-.205,.037,.079);
    return root;
  };
  function submachine(suppressed) {
    const key=suppressed?'whisper':'smg';
    const {b,m,root,profile,box,bore,grip,guard,sights,controls,magazine,stock,vents}=kit(key);
    const front=suppressed?-.27:-.315;
    profile('upper-receiver',m.metal,.06,[[front,.008],[front+.018,.067],[.091,.067],[.114,.042],[.103,-.018],[-.16,-.025]]);
    profile('lower-receiver',m.body,.054,[[-.172,-.016],[.09,-.016],[.09,-.047],[-.024,-.063],[-.063,-.05],[-.159,-.05]]);
    // Closed fore-end surrounds the barrel instead of loose floating rings.
    profile('handguard',suppressed?m.rubber:m.body,.064,[[front-.008,.004],[front-.005,.047],[-.18,.047],[-.18,-.045],[front+.018,-.045]]);
    vents(front+.025,3,.064,.014,.025);
    box('fore-end-bottom',m.rubber,.055,.013,.092,0,-.045,front+.064);
    grip(.037);guard(-.015);magazine(-.111,.162,.065,.13);
    controls(-.056,.034,.06); stock(.10,suppressed?.325:.285);
    const muzzle=suppressed?-.49:-.405;
    if(suppressed){
      b.barrel(m.dark,.025,.212,0,.026,-.376).name='integrated-suppressor';
      for(const z of [-.284,-.465])b.barrel(m.metal,.026,.012,0,.026,z).name='suppressor-collar';
    }else{
      b.barrel(m.metal,.014,.085,0,.026,-.354).name='barrel';
      b.barrel(m.dark,.02,.035,0,.026,-.389).name='muzzle-device';
    }
    bore(muzzle,.026,suppressed?.014:.011);
    sights(front+.014,.054,.075);
    return root;
  }
  GUN_BUILD.smg=()=>submachine(false);
  GUN_BUILD.whisper=()=>submachine(true);
  GUN_BUILD.shotgun=()=>{
    const {b,m,root,profile,box,bore,guard,controls,action}=kit('shotgun');
    profile('receiver',m.metal,.06,[[-.14,-.015],[-.14,.052],[.09,.052],[.126,.016],[.11,-.038],[-.08,-.038]]);
    b.barrel(m.dark,.021,.46,0,.031,-.365).name='barrel';
    b.barrel(m.metal,.017,.405,0,-.015,-.339).name='shell-tube';
    bore(-.596,.031,.016);
    b.barrel(m.dark,.019,.019,0,-.015,-.545).name='shell-tube-cap';
    for(const z of [-.506,-.15])box('barrel-band',m.metal,.04,.066,.015,0,.006,z);
    action('pump',()=>{
      profile('pump-fore-end',m.wood,.061,[[-.414,.002],[-.402,.015],[-.233,.015],[-.215,-.014],[-.225,-.047],[-.404,-.047]]);
      for(let i=0;i<7;i++)box('pump-groove',m.dark,.063,.046,.005,0,-.016,-.398+i*.025);
    },[0,0,0]);
    profile('wood-stock',m.wood,.058,[[.073,.029],[.18,.012],[.366,-.012],[.366,-.112],[.21,-.089],[.134,-.105],[.098,-.066],[.115,-.021]]);
    box('butt-pad',m.rubber,.062,.11,.023,0,-.063,.375);
    guard(.061,-.055);controls(-.03,.016,.06);
    box('front-bead-base',m.dark,.014,.015,.018,0,.058,-.55);
    b.cyl(m.accent,.004,.004,.008,8,0,.069,-.55).name='front-bead';
    box('loading-port',m.dark,.035,.004,.07,0,-.041,-.024);
    return root;
  };
  GUN_BUILD.pocketshot=()=>{
    const {b,m,root,profile,box,bore,grip,guard,action}=kit('pocketshot');
    profile('receiver',m.metal,.079,[[-.105,.052],[.055,.052],[.076,.014],[.054,-.043],[-.096,-.038]]);
    grip(.028,-.041,m.wood);guard(-.037,-.059);
    b.cyl(m.metal,.012,.012,.087,10,0,-.012,-.093,0,0,Math.PI/2).name='break-hinge';
    action('break',()=>{
      for(const x of [-.023,.023]){
        b.barrel(m.dark,.022,.21,x,.027,-.208).name='double-barrel';
        bore(-.317,.027,.016,x);
      }
      box('barrel-rib',m.metal,.009,.01,.204,0,.047,-.206);
      profile('wood-fore-end',m.wood,.071,[[-.268,-.005],[-.115,-.005],[-.115,-.037],[-.23,-.049],[-.266,-.035]]);
      box('front-bead',m.accent,.005,.009,.006,0,.059,-.281);
    },[0,-.012,-.093]);
    box('break-lever',m.dark,.015,.012,.046,.015,.059,.015,.16);
    box('hammer',m.dark,.013,.024,.021,0,.055,.065,-.3);
    for(const s of [-1,1])b.pin(m.accent,.006,s*.041,.011,-.035);
    return root;
  };
  GUN_BUILD.burst=()=>{
    const {b,m,root,profile,box,bore,grip,guard,sights,controls,magazine,vents}=kit('burst');
    // Conventional magazine-forward rifle, distinct from Phantom and the
    // recently added rear-magazine Comet.
    profile('upper-receiver',m.metal,.062,[[-.235,-.01],[-.235,.06],[.105,.06],[.127,.034],[.106,-.021]]);
    profile('lower-receiver',m.body,.057,[[-.176,-.013],[.105,-.013],[.10,-.054],[-.007,-.052],[-.05,-.035],[-.17,-.05]]);
    profile('handguard',m.body,.066,[[-.447,.01],[-.427,.058],[-.221,.058],[-.221,-.047],[-.43,-.047]]);
    vents(-.408,6,.066,.023,.03);
    box('handguard-under-rail',m.dark,.039,.012,.16,0,-.051,-.327);
    b.barrel(m.metal,.014,.15,0,.022,-.506).name='barrel';
    b.barrel(m.dark,.022,.045,0,.022,-.584).name='flash-hider';bore(-.609,.022,.013);
    grip(.043);guard(-.011);magazine(-.121,.182,.077,.18);controls(-.077,.027,.062);
    profile('stock',m.body,.061,[[.103,.052],[.313,.04],[.342,.008],[.342,-.102],[.295,-.102],[.237,-.028],[.103,-.018]]);
    box('stock-cheek',m.rubber,.055,.014,.105,0,.05,.245);
    box('butt-pad',m.rubber,.065,.123,.019,0,-.035,.349);
    // Two feet support the carry handle; its middle remains visibly open.
    for(const z of [-.184,.037])box('carry-handle-foot',m.body,.048,.045,.026,0,.08,z);
    box('carry-handle',m.body,.047,.018,.25,0,.111,-.075);
    sights(-.407,.027,.124);
    box('front-sight-tower',m.dark,.027,.061,.022,0,.086,-.407);
    return root;
  };
  window.LEGACY_GUN_MODELS=Object.freeze({keys:Object.freeze(keys),revision:1});
})();

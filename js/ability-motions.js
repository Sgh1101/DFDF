(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ABILITY_MOTIONS = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';
  // Every ability has its own cast choreography: a keyframed path for the casting hand, the other hand when the move
  // needs two, what the held tool does, a hand trail and the burst at the moment of release. The spectator body is
  // driven from the same path, so what others see matches what the caster sees. A pose is [x, y, z, rx, ry, rz]:
  // camera-space offset of the casting (left) hand from its resting place and the wrist turn around it.
  const P = {
    low:[-.06,-.36,.1,-.3,0,.25], rest:[0,0,0,0,0,0], chest:[.13,-.07,.1,.2,0,.45], mid:[.08,.02,-.06,0,0,.15],
    far:[.04,.04,-.26,.3,0,.05], farUp:[.05,.16,-.24,-.15,0,.05], high:[.05,.3,-.04,-.55,0,.15],
    cock:[.1,.18,.1,-.95,0,-.15], release:[-.03,.04,-.18,.55,0,.1], follow:[.04,-.28,-.06,.8,0,.05],
    floor:[.08,-.2,-.2,1.15,0,.1], left:[-.3,0,0,0,.35,-.55], right:[.3,-.02,-.08,.05,-.3,.6],
    upLeft:[-.22,.26,0,-.4,.25,-.5], upRight:[.28,.24,-.06,-.4,-.2,.5], downLeft:[-.25,-.2,0,.4,.2,-.4],
    downRight:[.26,-.2,-.06,.5,-.2,.6], face:[.17,.1,.12,-.3,.2,.4], hip:[-.14,-.3,.14,.3,0,-.1],
    palm:[.08,.04,-.2,-.9,0,.1], fist:[.1,-.02,.04,.35,0,.6],
    // the drawing hand of a bow, mirrored to the right of the view so the sights stay clear
    draw:[-.16,-.04,.06,-.2,.2,-.3],
  };
  // floor reaches stay above the skill tiles at the bottom of a phone screen
  // a named pose, a named pose nudged by a delta, or a literal pose
  const pose = (k) => typeof k === 'string' ? P[k] : (typeof k[0] === 'string' ? P[k[0]].map((v, i) => v + (k[1][i] || 0)) : k);
  const lerp = (a, b, t) => a + (b - a) * t;
  const cl = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const smooth = (x) => (x = cl(x), x * x * (3 - 2 * x));
  // Catmull-Rom through the keys, so a swing arcs through its poses instead of snapping between them
  function track(keys, o) {
    if (o <= keys[0][0]) return pose(keys[0][1]).slice();
    let i = 0;
    while (i < keys.length - 2 && o > keys[i + 1][0]) i++;
    const k1 = keys[i], k2 = keys[i + 1], u0 = cl((o - k1[0]) / Math.max(1e-6, k2[0] - k1[0]));
    const ease = k2[2] === 'o' ? 1 - (1 - u0) * (1 - u0) * (1 - u0) : k2[2] === 'i' ? u0 * u0 * u0 : k2[2] === 's' ? smooth(u0) : u0;
    const a = pose((keys[i - 1] || k1)[1]), b = pose(k1[1]), c = pose(k2[1]), d = pose((keys[i + 2] || k2)[1]), t = ease, t2 = t * t, t3 = t2 * t;
    return b.map((_, j) => .5 * (2 * b[j] + (-a[j] + c[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * t3));
  }
  // the right hand mirrors a left-hand pose across the view
  const RM = [-.1, -.12, -.5], RS = [.12, -.21, -.42];
  const mirror = (p) => [-(RM[0] + p[0]) + .02 - RS[0], RM[1] + p[1] - RS[1], RM[2] + p[2] - RS[2], p[3], -p[4], -p[5]];
  // a few shared shapes; every ability still gets its own key times, poses, tool action and effects
  const T = {};
  const tpl = (name, def) => (T[name] = def);
  // ---- throws
  tpl('hurl', {k:[[0,'low'],[.34,'cock','s'],[.48,'release','o'],[.7,'follow'],[1,'low','s']], rel:.45, tool:'launch', fx:['flash','bolt'], trail:1, dip:.32});
  tpl('lob', {k:[[0,'low'],[.3,['hip',[.1,-.02,.04,0,0,0]],'s'],[.52,['farUp',[0,.05,0,-.3,0,0]],'o'],[.75,'farUp'],[1,'low','s']], rel:.5, tool:'launch', fx:['bolt','flash'], arc:.3, trail:.8});
  tpl('sidearm', {k:[[0,'low'],[.3,['left',[-.04,-.04,.06,0,.2,-.2]],'s'],[.5,['right',[0,.04,-.06,0,0,.3]],'o'],[.72,'downRight'],[1,'low','s']], rel:.45, tool:'launch', fx:['bolt','spark'], trail:1});
  tpl('flick', {dur:.45, k:[[0,'low'],[.32,'chest','s'],[.46,['far',[0,.02,0,.5,0,0]],'o'],[.7,'far'],[1,'low','s']], rel:.44, tool:'launch', fx:['bolt'], trail:.7});
  tpl('flickSpin', {dur:.5, k:[[0,'low'],[.3,['face',[-.04,-.04,0,0,0,0]],'s'],[.45,['far',[.06,.04,0,.6,0,-.3]],'o'],[.7,'far'],[1,'low','s']], rel:.43, tool:'launch', fx:['bolt','spark'], trail:.9});
  tpl('skipThrow', {k:[[0,'low'],[.3,['downLeft',[0,0,.06,0,0,0]],'s'],[.5,['downRight',[0,.06,-.1,0,0,0]],'o'],[.7,'right'],[1,'low','s']], rel:.46, tool:'launch', fx:['bolt','shock'], trail:.9});
  tpl('palmShot', {k:[[0,'low'],[.36,['chest',[0,.04,.06,-.3,0,0]],'s'],[.5,['palm',[0,0,-.06,0,0,0]],'o'],[.72,'palm'],[1,'low','s']], rel:.48, tool:'launch', fx:['charge','bolt','ring'], trail:.5});
  tpl('castNet', {k:[[0,'low'],[.32,['cock',[-.06,0,0,0,.3,0]],'s'],[.5,['far',[-.12,.06,0,0,0,-.6]],'o'],[.72,['right',[0,.06,0,0,0,0]]],[1,'low','s']], rel:.47, tool:'launch', fx:['bolt','ring'], trail:1, s:'mirror', sd:.06});
  tpl('release', {k:[[0,'low'],[.3,['chest',[-.04,-.04,0,0,0,0]],'s'],[.5,['farUp',[0,.04,0,-.5,0,0]],'o'],[.75,'farUp'],[1,'low','s']], rel:.47, tool:'launch', fx:['spark','bolt'], trail:.6});
  tpl('sendForth', {k:[[0,'low'],[.28,'face','s'],[.44,['far',[0,.08,0,.2,0,0]],'o'],[.68,['far',[.02,.06,0,.1,0,0]]],[1,'low','s']], rel:.42, tool:'launch', fx:['bolt','flash'], trail:.8});
  tpl('hail', {k:[[0,'low'],[.3,['hip',[.14,0,0,0,0,0]],'s'],[.52,['high',[.04,.04,-.08,-.3,0,0]],'o'],[.75,'high'],[1,'low','s']], rel:.5, tool:'pulse', fx:['spark','flash'], trail:.9});
  // ---- ground
  tpl('stake', {k:[[0,'low'],[.3,['high',[.04,-.04,-.06,.4,0,0]],'s'],[.46,'floor','o'],[.66,['floor',[0,-.02,0,0,.9,0]]],[1,'low','s']], rel:.45, tool:'flip', fx:['shock','spark'], trail:.8, dip:.36});
  tpl('plant', {k:[[0,'low'],[.32,['mid',[0,.06,0,-.2,0,0]],'s'],[.5,'floor','o'],[.72,['floor',[0,.01,0,0,-.6,0]]],[1,'low','s']], rel:.5, tool:'pulse', fx:['shock'], trail:.4, dip:.36});
  tpl('setDown', {k:[[0,'low'],[.3,['chest',[0,0,0,0,0,0]],'s'],[.58,['floor',[0,.06,.02,-.2,0,0]],'s'],[.78,['floor',[0,.08,.02,-.2,0,0]]],[1,'low','s']], rel:.58, tool:'pulse', fx:['shock','flash'], trail:.2, s:'mirror', sd:.04, dip:.42});
  tpl('armPlace', {k:[[0,'low'],[.3,'mid','s'],[.48,'floor','o'],[.6,['floor',[0,.06,0,-.3,0,0]],'o'],[.7,'floor','o'],[1,'low','s']], rel:.69, tool:'pulse', fx:['spark','shock'], trail:.3, dip:.36});
  tpl('sow', {k:[[0,'low'],[.25,'downLeft','s'],[.6,['downRight',[0,.04,-.04,0,0,0]],'s'],[.8,'downRight'],[1,'low','s']], rel:.45, tool:'shake', fx:['spark','shock'], trail:.7});
  tpl('rake', {k:[[0,'low'],[.25,['downLeft',[0,-.02,-.06,.4,0,0]],'s'],[.55,['downRight',[0,0,-.08,.3,0,0]],'o'],[.78,'downRight'],[1,'low','s']], rel:.42, tool:'roll', fx:['shock','spark'], trail:1});
  tpl('meteor', {k:[[0,'low'],[.38,['high',[0,.06,0,-.3,0,0]],'s'],[.5,['high',[0,.08,0,-.5,0,0]]],[.62,'floor','i'],[.8,'floor'],[1,'low','s']], rel:.62, tool:'pulse', fx:['charge','shock','spark'], trail:1, dip:.4});
  tpl('slam', {k:[[0,'low'],[.36,['high',[.02,.04,.06,-.6,0,0]],'s'],[.5,'floor','i'],[.7,['floor',[0,.02,0,0,0,0]]],[1,'low','s']], rel:.5, tool:'pulse', fx:['shock','spark','flash'], trail:1, s:'mirror', sd:.02, dip:.45, shake:.012});
  tpl('cultivate', {k:[[0,'low'],[.25,['floor',[0,.06,.04,-.3,0,0]],'s'],[.8,['floor',[0,.06,.04,-.3,0,0]]],[1,'low','s']], rel:.75, tool:'spin', circle:[.25,.8,.06,1.5,'xz'], fx:['swirl','shock','flash'], trail:.6, s:'mirror', sd:.08, dip:.45});
  tpl('build', {k:[[0,'low'],[.22,['floor',[-.1,.04,0,0,0,0]],'o'],[.36,['mid',[-.04,0,0,0,0,0]]],[.52,['floor',[.06,.08,-.04,0,0,0]],'o'],[.64,'mid'],[.8,['mid',[0,.12,-.04,.3,0,0]],'o'],[1,'low','s']], rel:.8, tool:'pulse', fx:['shock','ring'], trail:.4, s:'mirror', sd:.07, dip:.45});
  tpl('stamp', {dur:.5, k:[[0,'low'],[.3,['chest',[0,.04,.08,-.3,0,0]],'s'],[.46,['palm',[0,0,-.04,0,0,0]],'o'],[.68,'palm'],[1,'low','s']], rel:.46, tool:'pulse', fx:['ring','spark'], trail:.4});
  // ---- sweeps and slashes
  tpl('sweepH', {k:[[0,'low'],[.25,['right',[0,.04,0,0,0,0]],'s'],[.55,['left',[0,.04,-.08,0,0,0]],'o'],[.75,'left'],[1,'low','s']], rel:.42, tool:'roll', fx:['spark'], trail:1});
  tpl('sweepWall', {k:[[0,'low'],[.24,'downLeft','s'],[.56,['upRight',[0,-.06,-.04,0,0,0]],'o'],[.76,'upRight'],[1,'low','s']], rel:.45, tool:'pulse', fx:['shock','flash'], trail:1});
  tpl('cleave', {k:[[0,'low'],[.3,['upRight',[0,.04,.06,0,0,0]],'s'],[.5,['downLeft',[0,0,-.08,0,0,0]],'o'],[.7,'downLeft'],[1,'low','s']], rel:.42, tool:'roll', fx:['spark','flash'], trail:1, shake:.006});
  tpl('arc', {k:[[0,'low'],[.25,['upLeft',[0,-.08,0,0,0,0]],'s'],[.45,['high',[0,.04,-.06,0,0,0]]],[.68,['upRight',[0,-.06,0,0,0,0]],'s'],[1,'low','s']], rel:.45, tool:'pulse', fx:['flash','spark'], trail:1});
  tpl('fanOut', {k:[[0,'low'],[.26,['downLeft',[.04,.06,0,0,0,0]],'s'],[.42,['far',[-.1,.02,0,0,0,-.5]]],[.58,['upRight',[0,-.04,-.08,0,0,0]],'o'],[.78,'upRight'],[1,'low','s']], rel:.48, tool:'spread', fx:['spark','bolt'], trail:1});
  tpl('lash', {k:[[0,'low'],[.22,['high',[-.1,-.08,.04,0,0,0]],'s'],[.36,['upRight',[0,.06,.06,0,0,0]]],[.5,['far',[0,-.04,-.04,.8,0,0]],'i'],[.7,'follow'],[1,'low','s']], rel:.5, tool:'roll', circle:[.18,.42,.06,1,'xy'], fx:['spark','flash'], trail:1, shake:.008});
  tpl('dashCut', {dur:.42, k:[[0,'low'],[.2,['right',[0,.02,.04,0,0,0]],'s'],[.42,['left',[0,0,-.14,0,0,0]],'o'],[.62,'left'],[1,'low','s']], rel:.32, tool:'roll', fx:['spark'], trail:1, lunge:.07});
  // ---- raises, walls, domes
  tpl('wallRaise', {k:[[0,'low'],[.3,['floor',[0,.04,.04,-.6,0,0]],'s'],[.62,['high',[0,-.06,-.08,-.2,0,0]],'s'],[.8,['high',[0,-.06,-.08,-.2,0,0]]],[1,'low','s']], rel:.62, tool:'pulse', fx:['shock','flash'], trail:.6, s:'mirror', sd:.03, dip:.45});
  tpl('updraft', {k:[[0,'low'],[.3,['hip',[.14,.04,-.06,0,0,0]],'s'],[.7,['high',[0,0,-.06,0,0,0]],'s'],[.8,'high'],[1,'low','s']], rel:.68, tool:'spin', circle:[.3,.7,.07,2,'xz'], fx:['swirl','flash'], trail:1});
  tpl('levitate', {k:[[0,'low'],[.3,['floor',[0,.08,.04,-.1,0,0]],'s'],[.7,['mid',[0,-.04,0,.9,0,0]],'s'],[.85,['mid',[0,-.04,0,.9,0,0]]],[1,'low','s']], rel:.65, tool:'pulse', osc:[.4,.9,[0,.015,0,0,0,0],4], fx:['shock','swirl'], trail:.3, s:'mirror', sd:.06, dip:.45});
  tpl('flare', {k:[[0,'low'],[.32,['chest',[-.04,0,0,-.4,0,0]],'s'],[.5,['high',[0,.06,-.04,-.3,0,0]],'o'],[.56,['high',[0,0,.04,-.5,0,0]]],[.76,'high'],[1,'low','s']], rel:.5, tool:'launch', boltDir:[0,1,-.25], fx:['flash','bolt','spark'], trail:.8, shake:.006});
  tpl('dome', {k:[[0,'low'],[.3,['mid',[.06,-.06,0,0,0,0]],'s'],[.68,['upLeft',[.02,.02,-.06,0,0,0]],'s'],[.82,'upLeft'],[1,'low','s']], rel:.62, tool:'pulse', fx:['ring','flash'], trail:.8, s:'mirror', sd:0, dip:.45});
  tpl('ward', {k:[[0,'low'],[.25,['palm',[0,0,.06,0,0,0]],'s'],[.65,['palm',[0,0,.04,0,0,0]]],[.76,['palm',[0,0,-.06,0,0,0]],'o'],[1,'low','s']], rel:.74, tool:'pulse', circle:[.25,.65,.07,1,'xy'], fx:['swirl','ring'], trail:.9});
  tpl('guard', {k:[[0,'low'],[.3,['mid',[0,0,.06,0,0,1.25]],'s'],[.46,['far',[0,0,0,-.2,0,1.25]],'o'],[.78,['far',[0,0,.02,-.2,0,1.25]]],[1,'low','s']], rel:.46, tool:'pulse', fx:['ring','flash'], trail:.4, shake:.006, elbow:[-.95,-.22,-.45]});
  tpl('clad', {k:[[0,'low'],[.28,['face',[-.04,.04,0,0,0,0]],'s'],[.62,['chest',[0,-.06,.02,0,0,0]],'s'],[.72,'fist','o'],[.86,'fist'],[1,'low','s']], rel:.7, tool:'pulse', fx:['charge','flash','spark'], trail:.6, shake:.008});
  tpl('prism', {dur:.75, k:[[0,'low'],[.3,['mid',[0,.04,-.04,-.4,0,0]],'s'],[.75,['mid',[0,.04,-.08,-.4,1.2,0]],'s'],[1,'low','s']], rel:.55, tool:'spin', fx:['ring','flash'], trail:.5});
  // ---- binds, pulls, drains
  tpl('snare', {k:[[0,'low'],[.3,['far',[0,.02,0,0,0,0]],'o'],[.5,['far',[0,0,-.04,0,0,0]]],[.64,['chest',[-.04,0,.06,0,0,0]],'o'],[.8,'chest'],[1,'low','s']], rel:.64, tool:'pulse', fx:['spark','flash'], trail:1, shake:.006});
  tpl('cage', {k:[[0,'low'],[.2,['mid',[-.1,.12,-.04,0,0,0]],'s'],[.35,['mid',[.12,.12,-.04,0,0,0]]],[.5,['mid',[.12,-.1,-.04,0,0,0]]],[.65,['mid',[-.1,-.1,-.04,0,0,0]]],[.76,['mid',[-.1,.12,-.04,0,0,0]]],[1,'low','s']], rel:.76, tool:'spin', fx:['ring','flash'], trail:1});
  tpl('grasp', {k:[[0,'low'],[.3,['far',[0,.04,0,-.5,0,0]],'s'],[.5,['far',[0,.02,-.02,.4,0,.6]],'o'],[.72,['chest',[0,0,0,.2,0,.6]],'s'],[1,'low','s']], rel:.5, tool:'pulse', fx:['spark','charge'], trail:.7});
  tpl('pullIn', {k:[[0,'low'],[.3,['far',[-.08,.04,-.02,0,0,-.3]],'s'],[.62,['chest',[0,.02,.04,0,0,0]],'s'],[.8,'chest'],[1,'low','s']], rel:.45, tool:'spin', fx:['swirl','shock'], trail:.8, s:'mirror', sd:.04, dip:.45});
  tpl('drain', {dur:.8, k:[[0,'low'],[.25,['far',[0,.04,0,-.3,0,.4]],'s'],[.75,['chest',[0,0,.02,-.1,0,.6]],'s'],[1,'low','s']], rel:.3, tool:'pulse', osc:[.25,.75,[.006,.006,0,0,0,.05],9], fx:['charge','swirl'], trail:.6});
  tpl('crush', {k:[[0,'low'],[.32,['far',[0,.06,0,-.4,0,0]],'s'],[.55,['far',[0,.06,0,-.4,0,0]]],[.66,['far',[0,.02,.06,.5,0,.7]],'i'],[.82,'far'],[1,'low','s']], rel:.66, tool:'pulse', osc:[.32,.62,[.005,.005,0,0,0,0],13], fx:['charge','spark','flash'], trail:.5, shake:.01});
  tpl('collapse', {k:[[0,'low'],[.3,['far',[0,.06,0,-.5,0,0]],'s'],[.62,['far',[0,.06,.04,0,0,0]],'s'],[.7,['chest',[0,.02,.04,.4,0,.7]],'i'],[.85,'chest'],[1,'low','s']], rel:.7, tool:'spin', fx:['swirl','flash'], trail:.6, s:'mirror', sd:.03, dip:.45});
  tpl('recall', {k:[[0,'low'],[.3,['far',[0,.04,-.02,.3,0,0]],'o'],[.45,['far',[0,.04,0,.2,0,0]]],[.6,['face',[-.04,-.04,0,0,0,0]],'o'],[.8,'face'],[1,'low','s']], rel:.6, tool:'flip', fx:['spark','flash'], trail:1});
  tpl('tether', {k:[[0,'low'],[.3,['far',[-.06,.04,0,0,0,0]],'o'],[.6,['far',[-.06,.04,0,0,0,0]]],[.72,['far',[-.06,.04,.06,0,0,0]],'s'],[1,'low','s']], rel:.3, tool:'pulse', fx:['bolt','ring'], boltDir:[-.35,0,-1], trail:.5});
  tpl('chainZig', {k:[[0,'low'],[.3,['high',[0,.04,0,0,0,0]],'s'],[.42,['far',[-.06,.08,0,0,0,0]],'o'],[.52,['far',[.06,0,0,0,0,0]]],[.62,['far',[-.04,-.04,-.04,0,0,0]]],[.8,'far'],[1,'low','s']], rel:.42, tool:'pulse', fx:['charge','spark','bolt','flash'], trail:1, shake:.006});
  tpl('knot', {k:[[0,'low'],[.25,['mid',[-.06,0,0,0,0,0]],'s'],[.6,['mid',[.06,0,0,0,0,0]]],[.72,['left',[.1,0,0,0,0,0]],'o'],[.85,'left'],[1,'low','s']], rel:.72, tool:'roll', circle:[.25,.6,.06,2,'xy'], fx:['swirl','spark'], trail:.8, s:'mirror', sd:.12, dip:.45});
  tpl('stretch', {k:[[0,'low'],[.3,['mid',[.06,0,0,0,0,0]],'s'],[.65,['left',[0,.04,-.04,0,0,0]],'s'],[.8,'left'],[1,'low','s']], rel:.65, tool:'pulse', fx:['spark'], trail:.6, s:'mirror', sd:0, dip:.45});
  tpl('wrap', {k:[[0,'low'],[.25,'mid','s'],[.75,'mid'],[1,'low','s']], rel:.72, tool:'spin', circle:[.25,.75,.07,2,'xy'], fx:['swirl','flash'], trail:1, s:'mirror', sd:.1, dip:.45});
  tpl('weave', {k:[[0,'low'],[.2,['mid',[-.1,.04,0,0,0,0]],'s'],[.35,['mid',[.12,-.04,0,0,0,0]]],[.5,['mid',[-.1,-.04,0,0,0,0]]],[.65,['mid',[.12,.04,0,0,0,0]]],[.8,['far',[0,0,0,0,0,0]],'o'],[1,'low','s']], rel:.8, tool:'roll', fx:['spark','ring'], trail:1, s:'mirror', sd:.08, dip:.45});
  tpl('spread', {dur:.85, k:[[0,'low'],[.3,['far',[-.08,0,0,-.5,0,0]],'s'],[.72,['far',[.14,.02,0,-.5,0,.4]],'s'],[1,'low','s']], rel:.4, tool:'shake', osc:[.3,.72,[0,0,0,0,0,.18],5], fx:['spark','swirl'], trail:.8});
  // ---- strikes, dashes
  tpl('punch', {k:[[0,'low'],[.36,['chest',[-.06,-.02,.04,0,0,.2]],'s'],[.5,['far',[0,0,-.06,.2,0,.6]],'o'],[.62,['far',[0,0,-.02,.2,0,.6]]],[1,'low','s']], rel:.5, tool:'pulse', fx:['charge','ring','flash','spark'], trail:.8, s:[[0,'low'],[.3,['face',[.02,0,-.04,0,0,0]]],[.8,'face'],[1,'low']], dip:.45, shake:.016, lunge:.05});
  tpl('hammer', {k:[[0,'low'],[.36,['high',[-.04,.06,.08,-.6,0,0]],'s'],[.5,['far',[0,-.06,0,.9,0,0]],'i'],[.62,['far',[0,-.02,0,.6,0,0]]],[1,'low','s']], rel:.5, tool:'pulse', fx:['ring','shock','flash'], trail:1, shake:.014});
  tpl('shoulder', {dur:.45, k:[[0,'low'],[.24,['fist',[-.06,-.04,.06,0,0,0]],'s'],[.5,['fist',[0,0,-.1,0,0,0]],'o'],[1,'low','s']], rel:.3, tool:'pulse', fx:['ring','spark'], trail:.6, lunge:.1, shake:.01});
  tpl('snap', {dur:.4, k:[[0,'low'],[.3,['face',[-.06,0,-.06,0,0,0]],'s'],[.42,['face',[-.04,.02,-.1,.4,0,.2]],'o'],[.62,'face'],[1,'low','s']], rel:.42, tool:'pulse', fx:['flash','spark'], trail:.4, lunge:.06});
  tpl('backstep', {dur:.45, k:[[0,'low'],[.25,['far',[0,-.04,0,0,0,0]],'s'],[.45,['face',[0,-.06,-.02,0,0,0]],'o'],[.65,'face'],[1,'low','s']], rel:.3, tool:'spin', fx:['ring','bolt'], boltDir:[0,0,-1], trail:.8, lunge:-.05});
  tpl('banish', {k:[[0,'low'],[.3,['palm',[0,0,.06,0,0,0]],'s'],[.48,['palm',[0,0,-.06,0,0,0]],'o'],[.66,['right',[0,.06,0,0,0,.4]],'o'],[1,'low','s']], rel:.48, tool:'spin', fx:['ring','flash','spark'], trail:1});
  tpl('push', {k:[[0,'low'],[.32,['chest',[0,.04,.06,-.6,0,0]],'s'],[.5,['palm',[0,0,-.04,0,0,0]],'o'],[.8,'palm'],[1,'low','s']], rel:.48, tool:'pulse', fx:['ring','bolt','spark'], trail:.6, s:'mirror', sd:0, dip:.45, shake:.008});
  // ---- auras, channels
  tpl('channel', {dur:1.05, k:[[0,'low'],[.25,['chest',[0,.06,0,0,0,0]],'s'],[.66,['chest',[.02,.06,.02,0,0,0]]],[.76,['palm',[0,0,-.06,0,0,0]],'o'],[.88,'palm'],[1,'low','s']], rel:.76, tool:'spin', osc:[.25,.68,[.004,.004,0,0,0,0],15], fx:['charge','swirl','ring','flash'], trail:.7, s:'mirror', sd:.03, dip:.45, shake:.012});
  tpl('resonate', {k:[[0,'low'],[.3,['palm',[0,0,.06,0,0,0]],'s'],[.8,['palm',[0,0,.02,0,0,0]]],[1,'low','s']], rel:.4, tool:'pulse', osc:[.3,.8,[0,.012,0,0,0,0],10], fx:['ring','ring2','ring3'], trail:.3, s:'mirror', sd:0, dip:.45});
  tpl('rage', {k:[[0,'low'],[.25,['fist',[.04,0,.08,0,0,0]],'s'],[.6,['fist',[.04,0,.08,0,0,0]]],[.72,['upLeft',[0,-.06,0,0,0,0]],'o'],[.86,'upLeft'],[1,'low','s']], rel:.72, tool:'pulse', osc:[.25,.62,[.01,.01,0,0,0,0],16], fx:['charge','flash','spark'], trail:.6, s:'mirror', sd:0, dip:.45, shake:.012});
  tpl('bloom', {dur:1, k:[[0,'low'],[.3,['floor',[.06,.12,.06,-.4,0,0]],'s'],[.7,['upLeft',[.06,-.04,-.04,-.3,0,0]],'s'],[.85,'upLeft'],[1,'low','s']], rel:.62, tool:'spread', fx:['charge','flash','spark','ring'], trail:.8, s:'mirror', sd:0, dip:.45});
  tpl('hatch', {dur:1, k:[[0,'low'],[.3,['chest',[0,-.04,0,-.4,0,0]],'s'],[.62,['high',[0,0,-.06,-.3,0,0]],'s'],[.82,'high'],[1,'low','s']], rel:.62, tool:'launch', boltDir:[0,1,-.4], fx:['charge','spark','bolt','flash'], trail:.6, s:'mirror', sd:.02, dip:.45});
  tpl('lever', {k:[[0,'low'],[.32,['high',[0,.04,0,0,0,0]],'s'],[.52,['high',[0,.04,0,0,0,0]]],[.64,['floor',[0,.1,.04,0,0,0]],'i'],[.84,'floor'],[1,'low','s']], rel:.64, tool:'pulse', fx:['charge','flash','spark','shock'], trail:.8, shake:.012});
  tpl('rally', {k:[[0,'low'],[.3,['upLeft',[.12,.02,0,0,0,.4]],'o'],[.42,['upLeft',[.12,-.08,0,0,0,.4]]],[.54,['upLeft',[.12,.04,0,0,0,.4]],'o'],[.8,'upLeft'],[1,'low','s']], rel:.54, tool:'pulse', fx:['flash','ring','spark'], trail:.6, shake:.008});
  tpl('twirl', {k:[[0,'low'],[.22,'mid','s'],[.78,'mid'],[1,'low','s']], rel:.7, tool:'spin', circle:[.22,.78,.09,2,'xy'], fx:['swirl','spark','flash'], trail:1});
  tpl('rewind', {k:[[0,'low'],[.22,'mid','s'],[.72,'mid'],[1,'low','s']], rel:.72, tool:'rewind', circle:[.22,.72,.1,-1,'xy'], fx:['swirl','flash'], trail:1});
  tpl('echoSnap', {k:[[0,'low'],[.3,['face',[-.04,0,-.06,0,0,0]],'s'],[.4,['face',[-.03,.02,-.1,.4,0,.2]],'o'],[.85,'face'],[1,'low','s']], rel:.4, tool:'pulse', fx:['ring','ring2','ring3','flash'], trail:.3});
  tpl('eclipse', {dur:1, k:[[0,'low'],[.25,['left',[.04,.14,-.04,-.4,0,0]],'s'],[.6,['mid',[0,.12,.06,-.6,0,0]],'s'],[.8,['right',[-.06,.12,0,-.4,0,0]],'s'],[1,'low','s']], rel:.6, tool:'pulse', fx:['charge','flash','ring'], trail:.8});
  tpl('phase', {k:[[0,'low'],[.3,['high',[.06,0,.06,0,0,0]],'s'],[.7,['downRight',[0,0,0,0,0,0]],'s'],[1,'low','s']], rel:.5, tool:'fade', fx:['spark','flash'], trail:1});
  tpl('veil', {k:[[0,'low'],[.3,['upRight',[0,.04,.06,0,0,0]],'s'],[.7,['downLeft',[0,0,.04,0,0,0]],'s'],[1,'low','s']], rel:.5, tool:'fade', fx:['ring','flash'], trail:1, s:'mirror', sd:.08, dip:.45});
  tpl('tear', {k:[[0,'low'],[.3,['mid',[.06,0,0,0,0,1.3]],'s'],[.6,['upLeft',[.1,0,0,0,0,1.3]],'s'],[.8,'upLeft'],[1,'low','s']], rel:.6, tool:'spin', fx:['ring','flash','spark'], trail:.8, s:'mirror', sd:0, dip:.45});
  tpl('navigate', {dur:1, k:[[0,'low'],[.25,['far',[0,.04,0,-.6,0,0]],'s'],[.65,['far',[0,.04,0,-.6,0,0]]],[.78,['farUp',[0,.06,-.04,0,0,0]],'o'],[1,'low','s']], rel:.78, tool:'spin', fx:['swirl','flash','bolt'], trail:.6, s:'mirror', sd:.03, dip:.45});
  // ---- precise
  tpl('bowDraw', {k:[[0,'low'],[.3,['far',[-.04,.06,0,0,0,0]],'s'],[.5,['far',[-.04,.06,0,0,0,0]]],[.56,['far',[-.04,.06,.04,0,0,0]],'o'],[1,'low','s']], rel:.54, tool:'pulse', fx:['bolt','spark'], trail:.4, s:[[0,'low'],[.3,['far',[0,.04,-.04,0,0,0]]],[.52,['draw',[0,0,0,0,0,0]],'s'],[.58,['draw',[-.04,.02,.06,0,0,0]],'o'],[.8,'draw'],[1,'low']], dip:.45});
  tpl('bowQuick', {dur:.5, k:[[0,'low'],[.3,['farUp',[-.04,.04,0,0,0,0]],'o'],[.46,'farUp'],[.52,['farUp',[0,0,.04,0,0,0]],'o'],[1,'low','s']], rel:.48, tool:'pulse', fx:['bolt'], trail:.3, s:[[0,'low'],[.3,['farUp',[0,0,-.02,0,0,0]]],[.46,['draw',[0,.08,0,0,0,0]],'o'],[.6,['draw',[-.04,.1,.06,0,0,0]]],[1,'low']], dip:.45});
  tpl('bowSky', {k:[[0,'low'],[.32,['high',[-.04,-.04,-.1,0,0,0]],'s'],[.54,['high',[-.04,-.04,-.1,0,0,0]]],[.6,['high',[-.04,-.02,-.06,0,0,0]],'o'],[1,'low','s']], rel:.56, tool:'pulse', boltDir:[0,1,-.8], fx:['bolt','spark'], trail:.4, s:[[0,'low'],[.32,['mid',[0,.06,0,0,0,0]]],[.54,['draw',[0,.08,0,0,0,0]],'s'],[.62,['draw',[-.04,.12,.06,0,0,0]],'o'],[1,'low']], dip:.45});
  tpl('bowFull', {dur:1, k:[[0,'low'],[.25,['far',[-.04,.06,0,0,0,0]],'s'],[.72,['far',[-.04,.06,0,0,0,0]]],[.76,['far',[-.04,.06,.05,0,0,0]],'o'],[1,'low','s']], rel:.74, tool:'pulse', osc:[.45,.72,[.003,.003,0,0,0,0],18], fx:['charge','bolt','flash','spark'], trail:.4, s:[[0,'low'],[.25,['far',[0,.04,-.04,0,0,0]]],[.55,['draw',[0,0,.02,0,0,0]],'s'],[.72,['draw',[0,0,.02,0,0,0]]],[.78,['draw',[-.04,.02,.08,0,0,0]],'o'],[1,'low']], dip:.45});
  tpl('fingerGun', {dur:1, k:[[0,'low'],[.3,['far',[-.06,.06,0,-.1,0,1.2]],'s'],[.64,['far',[-.06,.06,0,-.1,0,1.2]]],[.7,['far',[-.06,.12,.06,-.6,0,1.2]],'o'],[.86,'far'],[1,'low','s']], rel:.68, tool:'pulse', osc:[.3,.64,[.003,.003,0,0,0,0],8], fx:['charge','bolt','flash'], trail:.3, shake:.01});
  tpl('pointAt', {k:[[0,'low'],[.32,['far',[-.06,.06,0,0,0,0]],'o'],[.75,['far',[-.06,.06,0,0,0,0]]],[1,'low','s']], rel:.4, tool:'pulse', fx:['bolt','ring'], trail:.4});
  tpl('quickdraw', {dur:1, k:[[0,'low'],[.3,['hip',[.06,.16,-.04,0,0,0]],'s'],[.5,['hip',[.06,.16,-.04,0,0,0]]],[.58,['far',[-.04,.06,0,-.1,0,0]],'o'],[.64,['far',[-.04,.12,.06,-.6,0,0]],'o'],[.84,'far'],[1,'low','s']], rel:.62, tool:'spin', fx:['flash','bolt','spark'], trail:1, shake:.01});
  tpl('ricochet', {k:[[0,'low'],[.22,'mid','s'],[.52,'mid'],[.62,['far',[.1,.04,0,.3,0,-.4]],'o'],[.8,'far'],[1,'low','s']], rel:.6, tool:'spin', circle:[.22,.52,.05,1,'xy'], fx:['bolt','spark'], boltDir:[.6,0,-1], trail:1});
  tpl('reloadSpin', {dur:.55, k:[[0,'low'],[.25,['chest',[-.06,.04,0,0,0,0]],'s'],[.65,['chest',[-.06,.04,0,0,0,0]]],[1,'low','s']], rel:.6, tool:'roll', fx:['spark','flash'], trail:.3, s:[[0,'low'],[.25,['chest',[.12,0,0,0,0,0]]],[.4,['chest',[.04,.04,0,0,0,0]],'o'],[.65,'chest'],[1,'low']], dip:.45});
  tpl('lookout', {k:[[0,'low'],[.32,['far',[0,.08,.04,-.8,0,0]],'s'],[.75,['far',[0,.08,.04,-.8,.5,0]],'s'],[1,'low','s']], rel:.5, tool:'spin', fx:['ring','flash'], trail:.3});
  tpl('measure', {k:[[0,'low'],[.3,['far',[-.12,.06,0,0,0,1.4]],'s'],[.7,['far',[.14,.06,0,0,0,1.4]],'s'],[1,'low','s']], rel:.7, tool:'pulse', fx:['bolt','spark'], trail:.9});
  // ---- trickery
  tpl('palmFlip', {dur:.55, k:[[0,'low'],[.3,['far',[0,0,0,.6,0,0]],'s'],[.55,['far',[0,.02,0,.6,0,3.1]],'o'],[.75,['far',[0,.02,0,.6,0,3.1]]],[1,'low','s']], rel:.5, tool:'flip', fx:['flash','spark'], trail:.6});
  tpl('sleight', {k:[[0,'low'],[.25,['mid',[-.04,0,0,0,0,0]],'s'],[.45,['mid',[.16,0,0,0,0,0]],'s'],[.55,['mid',[.16,0,0,0,0,0]]],[.75,['mid',[-.04,.04,-.04,0,0,0]],'s'],[1,'low','s']], rel:.5, tool:'flip', fx:['flash','spark'], trail:.6, s:[[0,'low'],[.25,['mid',[.06,0,0,0,0,0]]],[.75,['mid',[.06,0,0,0,0,0]]],[1,'low']], dip:.45});
  tpl('mirrorSplit', {k:[[0,'low'],[.3,['mid',[.08,0,0,0,0,0]],'s'],[.5,['left',[0,.04,-.04,0,0,0]],'o'],[.75,'left'],[1,'low','s']], rel:.45, tool:'spread', fx:['flash','spark'], trail:1, s:'mirror', sd:0, dip:.45});
  tpl('crossSwap', {dur:1, k:[[0,'low'],[.25,['mid',[-.1,0,0,0,0,0]],'s'],[.55,['mid',[.18,.04,0,0,0,0]],'s'],[.65,['mid',[.18,.04,0,0,0,0]]],[.85,'mid'],[1,'low','s']], rel:.55, tool:'flip', fx:['charge','flash','spark'], trail:1, s:'mirror', sd:0, dip:.45});
  tpl('maskOn', {k:[[0,'low'],[.3,['face',[-.06,.02,.04,-.6,0,0]],'s'],[.55,['face',[-.06,.02,.04,-.6,0,0]]],[.75,['right',[0,.06,0,0,0,0]],'s'],[1,'low','s']], rel:.55, tool:'pulse', fx:['flash','ring'], trail:.6});
  tpl('wipe', {k:[[0,'low'],[.25,['face',[-.06,.1,.02,-.6,0,0]],'s'],[.6,['face',[-.06,-.14,.02,-.4,0,0]],'s'],[1,'low','s']], rel:.45, tool:'fade', fx:['spark','flash'], trail:1});
  // ---- the referee
  tpl('show', {dur:.6, k:[[0,'low'],[.3,['upLeft',[.12,-.04,-.04,0,0,.5]],'o'],[.75,['upLeft',[.12,-.02,-.04,0,0,.5]]],[1,'low','s']], rel:.32, tool:'pulse', fx:['flash','ring'], trail:.5});
  tpl('brandish', {dur:1, k:[[0,'low'],[.3,['high',[0,.04,0,0,0,0]],'o'],[.42,['high',[0,.1,-.04,0,0,0]],'o'],[.8,'high'],[1,'low','s']], rel:.42, tool:'pulse', fx:['charge','flash','ring','spark'], trail:.6, shake:.008});
  tpl('whistle', {k:[[0,'low'],[.25,['face',[0,-.08,.02,-.3,0,.3]],'s'],[.5,['face',[0,-.08,.02,-.3,0,.3]]],[.62,['mid',[0,.1,0,0,0,1.4]],'o'],[.85,['mid',[0,.1,0,0,0,1.4]]],[1,'low','s']], rel:.4, tool:'pulse', fx:['ring','ring2','flash'], trail:.3, s:[[0,'low'],[.5,'low'],[.62,['mid',[0,.24,0,0,0,0]],'o'],[.85,['mid',[0,.24,0,0,0,0]]],[1,'low']], dip:.45});
  tpl('lineDraw', {k:[[0,'low'],[.25,['downLeft',[0,.08,-.06,0,0,0]],'s'],[.7,['downRight',[0,.08,-.08,0,0,0]],'s'],[1,'low','s']], rel:.7, tool:'pulse', fx:['spark','shock'], trail:1});
  tpl('climb', {k:[[0,'low'],[.32,['high',[-.04,.06,-.08,0,0,0]],'o'],[.5,['high',[-.04,.06,-.08,.4,0,0]]],[.7,['mid',[0,-.04,0,.4,0,0]],'s'],[1,'low','s']], rel:.4, tool:'pulse', fx:['spark'], trail:.6});
  // ---- second takes on a shape, so two agents never cast the same way
  tpl('sweepWallR', {k:[[0,'low'],[.24,'downRight','s'],[.56,['upLeft',[0,-.06,-.04,0,0,0]],'o'],[.76,'upLeft'],[1,'low','s']], rel:.45, tool:'shake', fx:['shock','spark'], trail:1});
  tpl('dart', {dur:.45, k:[[0,'low'],[.3,['face',[-.02,.06,-.02,-.4,0,0]],'s'],[.44,['far',[-.04,.08,0,.2,0,0]],'o'],[.7,['far',[-.04,.04,0,.3,0,0]]],[1,'low','s']], rel:.42, tool:'launch', fx:['bolt','ring'], trail:.6});
  tpl('snareLow', {k:[[0,'low'],[.3,['floor',[0,.06,-.06,0,0,0]],'o'],[.48,['floor',[0,.04,-.08,0,0,0]]],[.64,['mid',[-.04,.12,.04,-.3,0,0]],'o'],[.8,'mid'],[1,'low','s']], rel:.62, tool:'roll', fx:['shock','spark'], trail:1, shake:.006});
  tpl('stick', {k:[[0,'low'],[.3,['chest',[0,.06,.02,-.4,0,0]],'s'],[.5,['palm',[.06,-.02,-.02,0,0,0]],'o'],[.72,['palm',[.06,-.02,0,0,0,.3]]],[1,'low','s']], rel:.5, tool:'pulse', fx:['ring','spark'], trail:.4});
  tpl('setTwist', {k:[[0,'low'],[.3,['mid',[0,.02,0,0,0,0]],'s'],[.5,['floor',[0,.06,0,0,0,0]],'s'],[.75,['floor',[0,.06,0,0,1.2,0]],'s'],[1,'low','s']], rel:.5, tool:'spin', fx:['shock','flash'], trail:.4, s:'mirror', sd:.03, dip:.45});
  tpl('blow', {k:[[0,'low'],[.3,['face',[-.04,-.06,0,-.7,0,0]],'s'],[.5,['face',[-.04,-.06,-.02,-.7,0,0]]],[.68,['palm',[0,0,-.04,0,0,0]],'s'],[1,'low','s']], rel:.55, tool:'spread', fx:['spark','swirl'], trail:.5});
  tpl('sprinkle', {dur:.75, k:[[0,'low'],[.3,['farUp',[0,.06,0,.6,0,0]],'s'],[.72,['farUp',[.08,.02,0,.6,0,0]],'s'],[1,'low','s']], rel:.4, tool:'shake', osc:[.3,.72,[.008,0,0,0,0,.25],7], fx:['spark','swirl'], trail:.4});
  tpl('toss', {dur:.65, k:[[0,'low'],[.3,['mid',[0,-.06,0,-.7,0,0]],'s'],[.5,['farUp',[0,.1,0,-.6,0,0]],'o'],[.7,'farUp'],[1,'low','s']], rel:.48, tool:'launch', boltDir:[0,.6,-1], fx:['bolt','flash'], trail:.6});
  tpl('volley', {k:[[0,'low'],[.26,['chest',[-.04,0,.02,0,0,0]],'s'],[.4,['far',[-.12,0,0,0,0,0]],'o'],[.5,['far',[0,.04,0,0,0,0]],'o'],[.6,['far',[.12,.08,0,0,0,0]],'o'],[.8,'far'],[1,'low','s']], rel:.4, tool:'spread', fx:['bolt','spark','flash'], trail:.9});
  tpl('pour', {k:[[0,'low'],[.3,['farUp',[0,0,.04,0,0,0]],'s'],[.7,['farUp',[0,-.02,.02,0,0,-.9]],'s'],[1,'low','s']], rel:.55, tool:'tilt', fx:['flash','shock'], trail:.3});
  // ability -> [shape, tool action / effect overrides]
  const A = {
    hwaryeong:{wall_fire:'sweepWall', proj_fire:'hurl', x_magma_shield:'clad', ult_fire:'channel'},
    seorin:{trap_slow:'stake', wall_ice:'wallRaise', smoke_ice:'lob', ult_ice:'crush'},
    gangcheol:{x_ground_slam:'slam', shield:'guard', charge:'shoulder', ult_smash:'punch'},
    yeonhwa:{heal:'setDown', root:'snare', smoke:'blow', ult_res:'bloom'},
    noeun:{emp:'flick', drone:'toss', mine:'armPlace', ult_emp:'lever'},
    baekho:{pierce:'bowDraw', recon_dart:'bowQuick', x_mortar:'bowSky', ult_snipe:'bowFull'},
    heuksa:{x_moon_cage:'cage', quicksand:'pullIn', sand_wall:'sweepWallR', x_ult_plague:'spread'},
    myeongjong:{tripwire:'stretch', sound_sensor:'plant', ripple_dome:'dome', ult_bell:'hammer'},
    jacheol:{mag_turret:'setTwist', mag_anchor:'recall', mag_net:'castNet', x_ult_soundwall:'resonate'},
    hongyeol:{blood_drain:'drain', x_rage:'rage', blood_orb:'palmShot', ult_undying:'lash'},
    gunbong:{scout_swarm:'release', hunt_bee:'sendForth', hive_trap:'stick', ult_queen:'hatch'},
    baram:{x_gale_slash:'cleave', x_updraft:'updraft', rift_wave:'sweepH', x_ult_storm_eye:'twirl'},
    geomi:{y_wallcrawl:'climb', x_cocoon:'wrap', x_ult_nest:'weave'},
    byeolbit:{x_meteor:'meteor', x_levitate:'levitate', blink:'snap', x_ult_blackhole:'collapse'},
    kallal:{x_boomerang:'sidearm', x_shadow_cut:'dashCut', x_mark_knife:'flickSpin', ult_mirror:'fanOut'},
    deonggul:{x_thorn_field:'rake', x_vine_snare:'snareLow', x_leech:'grasp', x_ult_jungle:'knot'},
    hwanyeong:{x_clones:'mirrorSplit', x_swap:'palmFlip', x_moon_shadow:'phase', x_ult_fullmoon:'eclipse'},
    suho:{x_aegis:'ward', x_guard_link:'tether', x_rally_cry:'rally', x_ult_citadel:'build'},
    danbi:{x_water_cannon:'push', x_hail:'hail', x_rainbow:'arc', ult_lightning:'chainZig'},
    chujeok:{x_tracker_dart:'dart', x_feather_volley:'volley', x_flare:'flare', x_ult_execution:'fingerGun'},
    yakcho:{x_potion_heal:'pour', x_sleep_powder:'sprinkle', x_herb_heal:'sow', x_ult_garden_heal:'cultivate'},
    chochim:{y_time_brand:'stamp', y_rewind:'rewind', y_backstep:'backstep', y_ult_echo:'echoSnap'},
    gwanmun:{y_portal:'tear', y_phase_cloak:'veil', y_refract:'prism', y_ult_banish:'banish'},
    hwangya:{y_ricochet:'ricochet', y_quickdraw:'reloadSpin', y_bounty:'pointAt', y_ult_duel:'quickdraw'},
    nachim:{y_footprints:'skipThrow', y_compass:'lookout', y_rangefinder:'measure', y_ult_warp:'navigate'},
    gamyeon:{y_mimic:'maskOn', y_disguise:'wipe', y_gunswap:'sleight', y_ult_lifeswap:'crossSwap'},
    simpan:{y_yellow:'show', y_timeout:'whistle', y_offside:'lineDraw', y_ult_red:'brandish'},
  };
  const motions = {};
  for (const [agent, row] of Object.entries(A)) for (const [type, ref] of Object.entries(row)) {
    const [name, over] = Array.isArray(ref) ? ref : [ref, null];
    motions[type] = Object.freeze(Object.assign({agent, shape:name}, T[name], over || {}));
  }
  const env = (o) => smooth(o / .12) * smooth((1 - o) / .16);
  function addWave(p, o, osc) {
    if (!osc) return;
    const [t0, t1, amp, f] = osc, u = (o - t0) / (t1 - t0);
    if (u <= 0 || u >= 1) return;
    const e = Math.sin(Math.PI * u), s = Math.sin(2 * Math.PI * f * u);
    for (let i = 0; i < 6; i++) p[i] += amp[i] * e * s;
  }
  function addCircle(p, o, c) {
    if (!c) return;
    const [t0, t1, r, turns, plane] = c, u = cl((o - t0) / (t1 - t0)), a = 2 * Math.PI * turns * smooth(u);
    // a part turn left at the end eases back to the path
    const back = o > t1 ? 1 - smooth((o - t1) / .15) : 1, dx = back * r * Math.sin(a), dy = back * r * (1 - Math.cos(a)) * Math.sign(turns || 1);
    p[0] += dx;
    if (plane === 'xz') p[2] -= dy; else p[1] += dy;
  }
  // the pose at time o (0..1) of the cast
  function sample(type, o, reduced) {
    const m = motions[type];
    if (!m) return null;
    o = cl(o);
    const hand = track(m.k, o);
    if (!reduced) addWave(hand, o, m.osc);
    addCircle(hand, o, m.circle);
    let support = null;
    if (m.s === 'mirror') {
      const q = track(m.k, cl(o - (m.sd || 0)));
      if (!reduced) addWave(q, cl(o - (m.sd || 0)), m.osc);
      addCircle(q, cl(o - (m.sd || 0)), m.circle);
      support = mirror(q);
    } else if (Array.isArray(m.s)) support = mirror(track(m.s, o));
    const w = env(o), rel = m.rel;
    // the body leans into a strike or steps back for a recoil
    if (m.lunge) hand[2] -= m.lunge * Math.sin(Math.PI * cl((o - rel + .15) / .45)) * (o > rel - .15 ? 1 : 0);
    if (m.shake && !reduced && o > rel && o < rel + .2) {
      const k = (1 - (o - rel) / .2) * m.shake;
      hand[0] += k * Math.sin(o * 211); hand[1] += k * Math.cos(o * 173);
      if (support) { support[0] += k * Math.sin(o * 197); support[1] += k * Math.cos(o * 181); }
    }
    return {hand, support, dip:(m.dip || .3) * w, weight:w, rel};
  }
  // what the held tool does, as an offset from where it sits in the hand: [dx,dy,dz, rx,ry,rz, scale, opacity]
  function toolPose(type, o) {
    const m = motions[type];
    if (!m) return null;
    const r = m.rel, after = cl((o - r) / (1 - r)), before = cl(o / r), pop = Math.exp(-Math.pow((o - r) / .06, 2));
    const t = [0, 0, 0, 0, 0, 0, 1 + .25 * pop, 1];
    switch (m.tool) {
      case 'launch': t[7] = o < r ? 1 : smooth((o - .82) / .12); t[6] *= o < r ? 1 + .2 * before : 1; break;
      case 'spin': t[4] = 2 * Math.PI * 2 * smooth(o); break;
      case 'rewind': t[5] = -2 * Math.PI * 2 * smooth(o); break;
      case 'roll': t[5] = 2 * Math.PI * smooth(cl((o - r + .2) / .4)); break;
      case 'flip': t[3] = 2 * Math.PI * smooth(cl((o - r + .12) / .3)); t[1] = .08 * Math.sin(Math.PI * cl((o - r + .12) / .3)); break;
      case 'tilt': t[5] = -1.6 * Math.sin(Math.PI * cl((o - r + .1) / .5)); break;
      case 'shake': t[5] = .35 * Math.sin(o * 60) * env(o); break;
      case 'spread': t[6] *= 1 + .22 * Math.sin(Math.PI * cl((o - r + .1) / .5)); t[4] = .6 * Math.sin(Math.PI * cl((o - r + .1) / .5)); break;
      case 'fade': t[7] = 1 - .85 * Math.sin(Math.PI * cl((o - r + .25) / .5)); break;
      default: t[6] *= 1 + .35 * pop;
    }
    return t;
  }
  // effects that fire at a time of the cast: [kind, time]; swirl and charge last from the start of the cast to release
  function cues(type) {
    const m = motions[type];
    if (!m) return [];
    return (m.fx || []).map((kind) => [kind, kind === 'ring2' ? m.rel + .12 : kind === 'ring3' ? m.rel + .24 : kind === 'bolt' ? m.rel : kind === 'charge' || kind === 'swirl' ? 0 : m.rel]);
  }
  return Object.freeze({motions, shapes:T, poses:P, sample, toolPose, cues, track, mirror, env});
});
// In the game: the viewmodel hands, the held tool, the hand trail and release effects, and the spectator body.
(() => {
  'use strict';
  if (typeof window === 'undefined' || typeof castVmPose !== 'function' || !window.ABILITY_DETAILS || !window.ABILITY_MOTIONS || !ABILITY_DETAILS.vm) return;
  const M = ABILITY_MOTIONS, D = ABILITY_DETAILS;
  const typeOf = (style) => (typeof style === 'string' && style.startsWith('detail:') && M.motions[style.slice(7)] ? style.slice(7) : null);
  for (const [type, m] of Object.entries(M.motions)) if (m.dur && D.profiles[type]) CAST_DUR['detail:' + type] = m.dur;
  const reduced = () => !(MOT() > 0) || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const RM = new T.Vector3(-.1, -.12, -.5), RS = new T.Vector3(.12, -.21, -.42);
  // ---- the effect pool: made once, recoloured per cast, never rebuilt
  let fx = null;
  const N = 16;
  function pool() {
    if (fx && fx.root.parent === VM.root) return fx;
    if (fx) VM.root.add(fx.root);
    else {
      const root = new T.Group();
      root.name = 'ability-motion-fx';
      const mat = (o) => new T.MeshBasicMaterial(Object.assign({transparent:true, depthTest:false, depthWrite:false, blending:T.AdditiveBlending, side:T.DoubleSide}, o));
      const sprite = () => new T.Sprite(new T.SpriteMaterial({map:glowTex(), transparent:true, depthTest:false, depthWrite:false, blending:T.AdditiveBlending}));
      const tg = new T.BufferGeometry(), idx = [];
      tg.setAttribute('position', new T.BufferAttribute(new Float32Array(N * 6), 3));
      tg.setAttribute('color', new T.BufferAttribute(new Float32Array(N * 6), 3));
      for (let i = 0; i < N - 1; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
      tg.setIndex(idx);
      const sg = new T.BufferGeometry();
      sg.setAttribute('position', new T.BufferAttribute(new Float32Array(24 * 3), 3));
      sg.setAttribute('color', new T.BufferAttribute(new Float32Array(24 * 3), 3));
      const ring = () => new T.Mesh(new T.RingGeometry(.82, 1, 48), mat({}));
      fx = {root, trail:new T.Mesh(tg, mat({vertexColors:true})), flash:sprite(), charge:sprite(), bolt:sprite(),
        ring:ring(), ring2:ring(), ring3:ring(), shock:ring(), spark:new T.LineSegments(sg, new T.LineBasicMaterial({vertexColors:true, transparent:true, depthTest:false, depthWrite:false, blending:T.AdditiveBlending})),
        swirl:new T.Mesh(new T.TorusGeometry(1, .07, 6, 40, Math.PI * 1.35), mat({}))};
      fx.dirs = Array.from({length:12}, (_, i) => { const a = i * 2.39996, z = 1 - 2 * ((i + .5) / 12); const r = Math.sqrt(1 - z * z); return new T.Vector3(Math.cos(a) * r, Math.sin(a) * r, z * .5).normalize(); });
      for (const k of ['trail', 'flash', 'charge', 'bolt', 'ring', 'ring2', 'ring3', 'shock', 'spark', 'swirl']) {
        const o = fx[k]; o.name = 'ability-motion-' + k; o.renderOrder = 1001; o.frustumCulled = false; o.visible = false; root.add(o);
      }
      VM.root.add(root);
    }
    return fx;
  }
  function hide() {
    if (!fx) return;
    for (const o of fx.root.children) o.visible = false;
  }
  // per cast
  const S = {type:null, trail:[], ring:Array.from({length:N}, () => new T.Vector3()), head:0, at:{}, spots:{}, color:new T.Color(), white:new T.Color(1, 1, 1), tip:new T.Vector3()};
  function begin(type) {
    S.type = type; S.trail.length = 0; S.at = {};
    const a = (player && player.agent) || null;
    S.color.set(a && a.color ? a.color : '#8aa0b8');
    if (fx) hide();
  }
  // ---- the hands follow the authored path
  const prevPose = castVmPose;
  castVmPose = function(style, o) {
    const type = typeOf(style);
    if (!type) return prevPose.apply(this, arguments);
    const s = M.sample(type, o, reduced()), h = s.hand;
    return {p:[h[0], h[1], h[2], h[3], h[5], h[4]], orb:{f:1, x:0, y:0, z:0, sx:1, sy:1, sz:1, op:0}, dip:s.dip};
  };
  const prevCast = vmCast;
  vmCast = function(style) {
    const r = prevCast.apply(this, arguments), type = typeOf(style);
    if (type) begin(type); else { S.type = null; hide(); unbend(VM_CAST.grp); }
    return r;
  };
  const _m = new T.Matrix4(), _r = new T.Matrix4(), _t = new T.Matrix4(), _inv = new T.Matrix4(), _e = new T.Euler(), _v = new T.Vector3(), _w = new T.Vector3(), _c = new T.Color();
  function placeSupport(group, g, pose) {
    _t.makeTranslation(-RS.x, -RS.y, -RS.z);
    _r.makeRotationFromEuler(_e.set(pose[3], pose[4], pose[5]));
    _m.makeTranslation(RS.x + pose[0], RS.y + pose[1], RS.z + pose[2]).multiply(_r).multiply(_t);
    _inv.copy(g.matrix).invert().multiply(_m);
    _inv.decompose(group.position, group.quaternion, group.scale);
    group.visible = true;
  }
  // The forearm always runs from the wrist down to an elbow below the view, whatever the wrist does; a forearm that
  // turned with the wrist swung its far end through the camera on the high and drawn-back poses.
  const EL = new T.Vector3(-.34, -.66, -.22), ER = new T.Vector3(.36, -.66, -.22), UP = new T.Vector3(0, 1, 0), _u = new T.Vector3(), _a = new T.Vector3(), _q = new T.Quaternion();
  function forearm(group, wrist, elbow, toLocal) {
    const parts = group.children.slice(0, 3);
    // the sleeve (a lathe once the hands are dressed), the cuff ring and the wrist, as the arm builder made them
    const kind = (m, ...k) => m && m.geometry && k.includes(m.geometry.type);
    if (!kind(parts[0], 'CylinderGeometry', 'LatheGeometry') || !kind(parts[1], 'CylinderGeometry') || !kind(parts[2], 'CylinderGeometry')) return;
    if (!group.userData.forearm) group.userData.forearm = parts.map((m) => ({m, p:m.position.clone(), q:m.quaternion.clone(), s:m.scale.clone()}));
    _a.copy(elbow).applyMatrix4(toLocal);
    _u.subVectors(_a, wrist);
    const dist = _u.length();
    _u.normalize();
    _q.setFromUnitVectors(UP, _u);
    const [arm, band, glove] = parts, gp = arm.geometry.parameters, L = gp.height || (gp.points ? gp.points[gp.points.length - 1].y - gp.points[0].y : 1);
    arm.quaternion.copy(_q); arm.scale.set(1, dist / L, 1); arm.position.copy(wrist).addScaledVector(_u, .5 * dist + .03);
    band.quaternion.copy(_q); band.position.copy(wrist).addScaledVector(_u, .075);
    glove.quaternion.copy(_q); glove.position.copy(wrist).addScaledVector(_u, .045);
  }
  function unbend(group) {
    const saved = group && group.userData.forearm;
    if (!saved) return;
    for (const r of saved) { r.m.position.copy(r.p); r.m.quaternion.copy(r.q); r.m.scale.copy(r.s); }
    delete group.userData.forearm;
  }
  const _l = new T.Matrix4(), _el = new T.Vector3();
  const tip = (g, tool, out) => out.copy(tool.position).add(_w.set(0, .07 * tool.scale.y, -.02)).applyMatrix4(g.matrix);
  function frame(dt) {
    const g = VM_CAST.grp, type = typeOf(VM_CAST.style);
    if (!g || VM_CAST.t <= 0 || !type || type !== S.type) return hide();
    const m = M.motions[type], dur = VM_CAST.dur, o = 1 - Math.max(0, VM_CAST.t) / dur, calm = reduced();
    const s = M.sample(type, o, calm), vm = D.vm(), f = pool();
    g.updateMatrix();
    forearm(g, VM_CAST.hand, m.elbow ? _el.fromArray(m.elbow) : EL, _l.copy(g.matrix).invert());
    if (vm.support) {
      if (s.support) { placeSupport(vm.support, g, s.support); vm.support.updateMatrix(); forearm(vm.support, RS, ER, _l.copy(g.matrix).multiply(vm.support.matrix).invert()); }
      else vm.support.visible = false;
    }
    const tool = vm.tool;
    if (!tool) return hide();
    const tp = M.toolPose(type, o);
    tool.position.copy(VM_CAST.hand).add(_v.set(tp[0], .06 + tp[1], -.035 + tp[2]));
    tool.rotation.set(tp[3], tp[4], tp[5]);
    tool.scale.setScalar(.8 * tp[6]);
    tool.visible = tp[7] > .02;
    for (const c of tool.children) {
      if (c.material && c.material.transparent) c.material.opacity = .94 * tp[7];
      if (c.userData.wing) c.rotation.z = c.userData.wing * (.22 + (calm ? 0 : Math.sin(o * dur * 32) * .45));
    }
    const at = tip(g, tool, S.tip);
    // the hand trail: a ribbon behind the tool, brighter the faster it moves (a fixed ring of points, newest first)
    S.head = (S.head + N - 1) % N;
    S.trail.unshift(S.ring[S.head].copy(at));
    if (S.trail.length > N) S.trail.length = N;
    const strength = (m.trail || 0) * (calm ? .5 : 1);
    const pos = f.trail.geometry.attributes.position, col = f.trail.geometry.attributes.color;
    for (let i = 0; i < N; i++) {
      const p = S.trail[Math.min(i, S.trail.length - 1)], a = S.trail[Math.max(0, i - 1)], b = S.trail[Math.min(S.trail.length - 1, i + 1)];
      _v.subVectors(a, b); const len = _v.length();
      _v.set(-_v.y, _v.x, 0).normalize().multiplyScalar(.022 * strength * (1 - i / N));
      pos.setXYZ(2 * i, p.x + _v.x, p.y + _v.y, p.z); pos.setXYZ(2 * i + 1, p.x - _v.x, p.y - _v.y, p.z);
      const k = strength * (1 - i / N) * Math.min(1, len / .03) * (i < S.trail.length ? 1 : 0);
      _c.copy(S.color).lerp(S.white, .25 * (1 - i / N)).multiplyScalar(k);
      col.setXYZ(2 * i, _c.r, _c.g, _c.b); col.setXYZ(2 * i + 1, _c.r, _c.g, _c.b);
    }
    pos.needsUpdate = col.needsUpdate = true;
    f.trail.visible = strength > 0 && S.trail.length > 2;
    // release effects
    for (const [kind, time] of M.cues(type)) {
      if (kind === 'charge' || kind === 'swirl') {
        const on = o < m.rel + .06, k = smooth01(o / m.rel), obj = f[kind];
        obj.visible = on;
        if (!on) continue;
        obj.position.copy(at);
        if (kind === 'charge') { obj.scale.setScalar(.04 + .16 * k + (calm ? 0 : .015 * Math.sin(o * 90))); obj.material.color.copy(S.color).multiplyScalar(1.6 + 1.4 * k); }
        else { obj.scale.setScalar(.05 + .05 * k); obj.rotation.z = -o * dur * 14; obj.material.color.copy(S.color).multiplyScalar(.9 * Math.sin(Math.PI * Math.min(1, o / (m.rel + .06)))); }
        continue;
      }
      const obj = f[kind];
      if (!obj) continue;
      const age = (o - time) * dur;
      if (age < 0 || age > .45) { obj.visible = false; continue; }
      // where the hand was at the moment of release
      if (!S.at[kind]) S.at[kind] = (S.spots[kind] = S.spots[kind] || new T.Vector3()).copy(at);
      const c0 = S.at[kind], k = age / .45, fade = 1 - k;
      obj.visible = true;
      if (kind === 'flash') { obj.position.copy(c0); obj.scale.setScalar(.08 + .4 * smooth01(age / .2)); obj.material.color.copy(S.color).lerp(S.white, .4).multiplyScalar(2.2 * Math.max(0, 1 - age / .25)); }
      else if (kind === 'bolt') {
        const d = m.boltDir ? _v.fromArray(m.boltDir).normalize() : _v.set(0, .04, -1).normalize();
        obj.position.copy(c0).addScaledVector(d, 3.4 * age);
        if (m.arc) obj.position.y += m.arc * age * 2.5 - 3 * age * age;
        obj.scale.setScalar(.11 * (1 - .5 * k)); obj.material.color.copy(S.color).multiplyScalar(2.4 * fade);
      } else if (kind === 'shock') {
        obj.position.set(c0.x, Math.min(c0.y - .08, -.42), c0.z - .1); obj.rotation.set(-Math.PI / 2, 0, 0);
        obj.scale.setScalar(.06 + .6 * smooth01(k * 1.4)); obj.material.color.copy(S.color).multiplyScalar(1.3 * fade);
      } else if (kind === 'spark') {
        const sp = obj.geometry.attributes.position, sc = obj.geometry.attributes.color;
        _c.copy(S.color).lerp(S.white, .5).multiplyScalar(1.6 * fade);
        f.dirs.forEach((d, i) => {
          const r0 = .02 + .32 * smooth01(k * 1.3), r1 = r0 + .05 * fade + .02;
          sp.setXYZ(2 * i, c0.x + d.x * r0, c0.y + d.y * r0, c0.z + d.z * r0); sp.setXYZ(2 * i + 1, c0.x + d.x * r1, c0.y + d.y * r1, c0.z + d.z * r1);
          sc.setXYZ(2 * i, _c.r, _c.g, _c.b); sc.setXYZ(2 * i + 1, 0, 0, 0);
        });
        sp.needsUpdate = sc.needsUpdate = true;
      } else {
        obj.position.copy(c0); obj.position.z -= .5 * age; obj.rotation.set(0, 0, 0);
        obj.scale.setScalar(.05 + .42 * smooth01(k * 1.2)); obj.material.color.copy(S.color).multiplyScalar(1.4 * fade);
      }
    }
  }
  const smooth01 = (x) => (x = x < 0 ? 0 : x > 1 ? 1 : x, x * x * (3 - 2 * x));
  const prevTick = tickVmCast;
  tickVmCast = function(dt) {
    const dip = prevTick.apply(this, arguments);
    try { frame(dt); } catch (e) { hide(); }
    return dip;
  };
  // ---- the spectator body follows the same hand path
  const SL = new T.Vector3(-.24, -.34, .02), SR = new T.Vector3(.26, -.36, .02);
  function arm(parts, hand, rest, shoulder, side, w, chest) {
    const x = rest.x + hand[0], y = rest.y + hand[1], z = rest.z + hand[2];
    const vx = x - shoulder.x, vy = y - shoulder.y, vz = z - shoulder.z;
    let ax = Math.atan2(-vz, -vy);
    if (ax < -Math.PI / 2) ax += 2 * Math.PI;
    ax = Math.max(-.6, Math.min(3.3, ax));
    const reach = Math.hypot(vx, vy, vz), fx = -Math.max(0, Math.min(1, (.66 - reach) / .4)) * 1.7;
    const az = side * Math.max(-.9, Math.min(1.1, (x - rest.x) * 2.6));
    parts.arm.rotation.x += (ax - parts.arm.rotation.x) * w;
    parts.fore.rotation.x += (fx - parts.fore.rotation.x) * w;
    parts.arm.rotation.z += az * w;
    if (chest) {
      chest.rotation.y += Math.max(-.4, Math.min(.4, -1.4 * hand[0])) * w;
      chest.rotation.x += Math.max(-.15, Math.min(.45, -.9 * hand[1] - .05)) * w;
    }
  }
  const prevBody = castPose;
  castPose = function(actor, model, dt) {
    const type = actor && typeOf(actor._castS);
    if (!type) return prevBody.apply(this, arguments);
    // the earlier layers only put the arms back to rest when no cast runs
    const left = actor._castT;
    actor._castT = 0;
    try { prevBody.apply(this, arguments); } finally { actor._castT = left; }
    if (!(actor._castT > 0)) return;
    actor._castT -= dt;
    const d = actor._castD || CAST_DUR[actor._castS] || .6, o = 1 - Math.max(0, actor._castT) / d;
    const s = M.sample(type, o, reduced());
    arm(model.armL, s.hand, RM, SL, 1, s.weight, model.chest);
    if (s.support && !actor.ultW) arm(model.armR, [s.support[0], s.support[1], s.support[2]], RS, SR, -1, s.weight, null);
  };
  const prevClear = abilClear;
  abilClear = function() { const r = prevClear.apply(this, arguments); S.type = null; S.trail.length = 0; hide(); return r; };
  window.ABILITY_MOTION_FX = {root:() => fx && fx.root, shown:() => (fx ? fx.root.children.filter((o) => o.visible).map((o) => o.name) : []), state:S};
})();

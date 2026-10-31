(function (root) {
  "use strict";
  // A small Verlet skeleton for the bodies that fall over when a fighter dies (js/legacy/123-ragdolls-*.js). It is only a
  // picture: it never takes part in hit detection and nothing in the game reads it. Points are the joints, links keep the
  // distance between them, and the world is two callbacks the caller gives (the floor under a point, and whether a point
  // is inside a wall), so the maths can be run and tested without a map or a renderer.
  //   - fixed steps of 1/60 s (what is left of a frame waits for the next), gravity, a little drag, a floor with friction and
  //     a small bounce, walls that stop the sideways move of a point
  //   - links: kind 0 keeps a distance, kind 1 only keeps two points from coming closer (a knee or an elbow cannot fold flat)
  //   - it settles (no point moved more than `settle` m in each quarter second for `settleTime` s, or `maxTime` s since it
  //     began) and then FREEZES: step() does nothing and costs nothing after that. (A speed would not do: a point held up
  //     only by its links shivers by a few millimetres a step.)
  const H = 1 / 60;
  // the joints of a fighter, in the order the rig's bones are read: the pelvis, chest, neck and head; a shoulder, elbow and
  // hand on each side; a hip, knee and foot on each side (L is the -x side, as in the rig)
  const NAMES = ["hip", "chest", "neck", "head", "shL", "shR", "elL", "elR", "haL", "haR", "hpL", "hpR", "knL", "knR", "ftL", "ftR"];
  const IDX = {};
  NAMES.forEach((n, i) => (IDX[n] = i));
  // [a, b, kind]: the bones and the bracing that keeps the trunk a trunk
  const LINKS = [
    ["hip", "chest"], ["chest", "neck"], ["neck", "head"], ["chest", "head"], ["hip", "neck"],
    ["chest", "shL"], ["chest", "shR"], ["shL", "shR"], ["neck", "shL"], ["neck", "shR"], ["hip", "shL"], ["hip", "shR"],
    ["shL", "elL"], ["elL", "haL"], ["shR", "elR"], ["elR", "haR"],
    ["hip", "hpL"], ["hip", "hpR"], ["hpL", "hpR"], ["chest", "hpL"], ["chest", "hpR"], ["hpL", "shR"], ["hpR", "shL"],
    ["hpL", "knL"], ["knL", "ftL"], ["hpR", "knR"], ["knR", "ftR"],
    // one-sided: a leg or an arm cannot fold onto itself, and the two feet and knees stay apart
    ["hpL", "ftL", 1, 0.5], ["hpR", "ftR", 1, 0.5], ["shL", "haL", 1, 0.3], ["shR", "haR", 1, 0.3], ["ftL", "ftR", 1, 0.3], ["knL", "knR", 1, 0.45], ["elL", "elR", 1, 0.3],
  ];
  // how thick the body is around each joint, in metres at scale 1 (a point rests this far above the floor)
  const RADIUS = { hip: 0.12, chest: 0.13, neck: 0.08, head: 0.13, shL: 0.08, shR: 0.08, elL: 0.06, elR: 0.06, haL: 0.05, haR: 0.05, hpL: 0.1, hpR: 0.1, knL: 0.07, knR: 0.07, ftL: 0.04, ftR: 0.04 };
  const DEFAULTS = { gravity: 16, drag: 0.992, iterations: 5, settle: 0.015, settleTime: 0.5, maxTime: 7, friction: 0.72, bounce: 0.12, maxSteps: 4 };
  // a standing fighter at (x, y, z) facing -z, scaled: the same proportions as the rig (hips 0.92 up, chest +0.22, neck +0.44 …)
  function stand(x, y, z, scale) {
    const k = scale || 1, P = {
      hip: [0, 0.92, 0], chest: [0, 1.14, 0], neck: [0, 1.58, 0], head: [0, 1.8, 0], shL: [-0.245, 1.47, 0], shR: [0.245, 1.47, 0], elL: [-0.245, 1.19, 0], elR: [0.245, 1.19, 0],
      haL: [-0.245, 0.89, 0], haR: [0.245, 0.89, 0], hpL: [-0.11, 0.86, 0], hpR: [0.11, 0.86, 0], knL: [-0.11, 0.45, 0], knR: [0.11, 0.45, 0], ftL: [-0.11, 0.03, 0], ftR: [0.11, 0.03, 0],
    };
    return NAMES.map((n) => ({ x: x + P[n][0] * k, y: y + P[n][1] * k, z: z + P[n][2] * k, r: RADIUS[n] * k }));
  }
  // points: [{x, y, z, r}], links: [[a, b, kind?, ratio?]] with indices or joint names; a link keeps the distance it has now (a
  // one-sided one keeps `ratio` of it); opt: gravity, drag, iterations, settle, settleTime, maxTime, friction, bounce,
  // ground(x, z, y) -> floor height under the point, blocked(x, z, y, r) -> true inside a wall, bounds {minX, maxX, minZ, maxZ}
  function create(points, links, opt) {
    const o = Object.assign({}, DEFAULTS, opt || {}), n = points.length;
    const P = new Float64Array(3 * n), Q = new Float64Array(3 * n), R = new Float64Array(n), G = new Float64Array(n), S = new Float64Array(3 * n);
    points.forEach((p, i) => { P[3 * i] = Q[3 * i] = p.x; P[3 * i + 1] = Q[3 * i + 1] = p.y; P[3 * i + 2] = Q[3 * i + 2] = p.z; R[i] = p.r || 0; });
    S.set(P);
    const m = links.length, A = new Int32Array(m), B = new Int32Array(m), L = new Float64Array(m), K = new Uint8Array(m);
    links.forEach((l, i) => {
      const a = typeof l[0] === "string" ? IDX[l[0]] : l[0], b = typeof l[1] === "string" ? IDX[l[1]] : l[1];
      A[i] = a; B[i] = b; K[i] = l[2] ? 1 : 0;
      L[i] = Math.hypot(P[3 * a] - P[3 * b], P[3 * a + 1] - P[3 * b + 1], P[3 * a + 2] - P[3 * b + 2]) * (K[i] && l[3] ? l[3] : 1);
    });
    const body = {
      n, P, Q, R, G, frozen: false, t: 0, still: 0, steps: 0, acc: 0, win: 0, opt: o, lengths: L, A, B, K,
      // gives point i (or every point, i < 0) a velocity of (vx, vy, vz) m/s
      kick(i, vx, vy, vz, w) {
        const f = H * (w === undefined ? 1 : w);
        for (let j = i < 0 ? 0 : i; j < (i < 0 ? n : i + 1); j++) { Q[3 * j] -= vx * f; Q[3 * j + 1] -= vy * f; Q[3 * j + 2] -= vz * f; }
        body.frozen = false; body.still = 0;
      },
      // the fastest point, m/s
      speed() {
        let s = 0;
        for (let i = 0; i < n; i++) s = Math.max(s, Math.hypot(P[3 * i] - Q[3 * i], P[3 * i + 1] - Q[3 * i + 1], P[3 * i + 2] - Q[3 * i + 2]) / H);
        return s;
      },
      freeze() { body.frozen = true; for (let i = 0; i < 3 * n; i++) Q[i] = P[i]; },
      substep() {
        const g = o.gravity * H * H, ground = o.ground, blocked = o.blocked, bd = o.bounds, bounce = o.bounce, fr = o.friction;
        for (let i = 0; i < n; i++) {
          const x = 3 * i, y = x + 1, z = x + 2, r = R[i], px = P[x], pz = P[z];
          const vx = (P[x] - Q[x]) * o.drag, vy = (P[y] - Q[y]) * o.drag, vz = (P[z] - Q[z]) * o.drag;
          Q[x] = P[x]; Q[y] = P[y]; Q[z] = P[z];
          P[x] += vx; P[y] += vy - g; P[z] += vz;
          if (bd) { P[x] = Math.min(bd.maxX, Math.max(bd.minX, P[x])); P[z] = Math.min(bd.maxZ, Math.max(bd.minZ, P[z])); }
          // a wall: the sideways move that goes into it is dropped (one axis at a time, so a point slides along it)
          if (blocked && blocked(P[x], P[z], P[y], r)) {
            if (!blocked(P[x], pz, P[y], r)) { P[z] = pz; Q[z] = pz; }
            else if (!blocked(px, P[z], P[y], r)) { P[x] = px; Q[x] = px; }
            else { P[x] = px; P[z] = pz; Q[x] = px; Q[z] = pz; }
          }
          G[i] = ground ? ground(P[x], P[z], P[y]) : 0;
          if (P[y] < G[i] + r) {
            const vy1 = P[y] - Q[y];
            P[y] = G[i] + r; Q[y] = P[y] + Math.min(0, vy1) * bounce;
            Q[x] = P[x] - (P[x] - Q[x]) * fr; Q[z] = P[z] - (P[z] - Q[z]) * fr;
          }
        }
        for (let it = 0; it < o.iterations; it++) {
          for (let j = 0; j < m; j++) {
            const a = 3 * A[j], b = 3 * B[j], dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2], d = Math.hypot(dx, dy, dz);
            if (d < 1e-9 || (K[j] && d >= L[j])) continue;
            const f = (d - L[j]) / d * 0.5, ox = dx * f, oy = dy * f, oz = dz * f;
            P[a] += ox; P[a + 1] += oy; P[a + 2] += oz; P[b] -= ox; P[b + 1] -= oy; P[b + 2] -= oz;
          }
          for (let i = 0; i < n; i++) if (P[3 * i + 1] < G[i] + R[i]) P[3 * i + 1] = G[i] + R[i];
        }
        // the links may have pulled a point into a wall: it goes back to where it was
        if (blocked) for (let i = 0; i < n; i++) if (blocked(P[3 * i], P[3 * i + 2], P[3 * i + 1], R[i])) { P[3 * i] = Q[3 * i]; P[3 * i + 2] = Q[3 * i + 2]; }
        body.t += H; body.steps++;
        if (++body.win >= 15) {
          let d = 0;
          for (let i = 0; i < 3 * n; i++) d = Math.max(d, Math.abs(P[i] - S[i]));
          body.win = 0; S.set(P);
          if (d < o.settle) { body.still += 15 * H; if (body.still >= o.settleTime) body.freeze(); } else body.still = 0;
        }
        if (body.t >= o.maxTime) body.freeze();
      },
      // dt seconds pass; returns how many fixed steps were taken (0 once frozen)
      step(dt) {
        if (body.frozen) return 0;
        body.acc = Math.min(body.acc + dt, H * o.maxSteps);
        let k = 0;
        while (body.acc >= H && !body.frozen) { body.acc -= H; body.substep(); k++; }
        return k;
      },
      // runs the fall at once, for a canned death (reduced motion): up to `seconds` of steps, stopping when it freezes
      settleNow(seconds) {
        let s = 0;
        while (!body.frozen && s < (seconds || o.maxTime)) { body.substep(); s += H; }
        return s;
      },
    };
    return body;
  }
  // the corpses a scene keeps: the oldest go first. Returns the ones to drop (the list itself is left alone).
  const overflow = (list, max) => (list.length > Math.max(0, max) ? list.slice(0, list.length - Math.max(0, max)) : []);
  const api = { H, NAMES, IDX, LINKS, RADIUS, DEFAULTS, stand, create, overflow };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RAGDOLL_VERLET = api;
})(typeof window === "object" ? window : globalThis);

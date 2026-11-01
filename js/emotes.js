(function (root) {
  "use strict";
  // The emotes (js/legacy/123b-emotes-*.js plays them): six short keyframe animations made for the game's segment rigs, and the
  // rate limit a host puts on them. A pose is the rotation of each part of the rig (hips, chest, neck, each upper arm and
  // forearm, each thigh and shin) at a time since the emote began; a part left out keeps whatever the walking animation gave
  // it. Rotations are Euler angles in the rig's own axes: an arm hangs along -y, +x of its rotation swings it forward (-z),
  // +z of the right arm (the +x side) swings it out and up; the left arm's z is the mirror of that. hy is the height of the hips
  // (0.92 standing). No three.js in here, so the numbers can be checked without a browser.
  const sin = Math.sin, cos = Math.cos, abs = Math.abs;
  const LIST = [
    { id: "wave", ko: "손 흔들기", en: "Wave", dur: 3 },
    { id: "cheer", ko: "환호", en: "Cheer", dur: 3 },
    { id: "salute", ko: "경례", en: "Salute", dur: 2.8 },
    { id: "dance", ko: "춤", en: "Dance", dur: 6 },
    { id: "laugh", ko: "웃음", en: "Laugh", dur: 3 },
    { id: "sit", ko: "앉기", en: "Sit", dur: 12 },
  ];
  const POSE = [
    // wave: the right arm up, the forearm swinging, the head tilted a little
    (t) => ({ armR: [0, 0, 2.5], foreR: [0, 0, 0.35 + 0.55 * sin(9 * t)], armL: [0.12, 0, -0.14], neck: [0, 0, -0.1], chest: [0, 0, -0.06 + 0.02 * sin(9 * t)] }),
    // cheer: both arms up and shaking, a hop, the head back
    (t) => ({ armL: [0, 0, -2.75 + 0.18 * sin(11 * t)], armR: [0, 0, 2.75 - 0.18 * sin(11 * t)], foreL: [0, 0, -0.2], foreR: [0, 0, 0.2], chest: [-0.18, 0, 0], neck: [-0.25, 0, 0], hy: 0.92 + 0.09 * abs(sin(5.5 * t)), legL: [0.12 * abs(sin(5.5 * t)), 0, 0], legR: [0.12 * abs(sin(5.5 * t)), 0, 0], shinL: [-0.2 * abs(sin(5.5 * t)), 0, 0], shinR: [-0.2 * abs(sin(5.5 * t)), 0, 0] }),
    // salute: the right hand to the brow, the chest square, a steady head
    (t) => ({ armR: [0, 0.5, 1.5], foreR: [0, 0, 2.5 + 0.02 * sin(14 * t)], armL: [0.05, 0, -0.1], chest: [-0.06, -0.1, 0], neck: [0, 0.1, 0] }),
    // dance: the hips swing, the arms pump in turn, the knees dip, the chest turns the other way
    (t) => {
      const s = sin(6 * t), c = cos(6 * t);
      return { hy: 0.92 - 0.04 - 0.05 * abs(s), hips: [0, 0.25 * s, 0.1 * s], chest: [0.05, -0.35 * s, -0.08 * s], neck: [0, 0.2 * s, 0.05 * c], armR: [0.4 * c, 0, 1.2 + 0.9 * s], armL: [0.4 * -c, 0, -(1.2 - 0.9 * s)], foreR: [0, 0, 0.5 + 0.3 * c], foreL: [0, 0, -(0.5 - 0.3 * c)], legL: [0.45 * Math.max(0, s), 0, 0], legR: [0.45 * Math.max(0, -s), 0, 0], shinL: [-0.5 * Math.max(0, s) - 0.15, 0, 0], shinR: [-0.5 * Math.max(0, -s) - 0.15, 0, 0] };
    },
    // laugh: doubled over a little, shaking, a hand on the belly
    (t) => {
      const s = sin(17 * t);
      return { chest: [0.32 + 0.1 * s, 0, 0.03 * s], neck: [-0.55 + 0.12 * s, 0, 0], hy: 0.92 - 0.06 + 0.015 * s, armL: [0.55, -0.3, -0.25 + 0.05 * s], foreL: [1.2, 0, 0], armR: [0.35, 0.1, 0.45 + 0.08 * s], foreR: [0.5, 0, 0], legL: [0.1, 0, 0], legR: [0.1, 0, 0], shinL: [-0.2, 0, 0], shinR: [-0.2, 0, 0] };
    },
    // sit: down on the floor, the legs out in front, the hands behind to lean on, a slow breath
    (t) => ({ hy: 0.17, hips: [0, 0, 0], legL: [1.5, 0, -0.12], legR: [1.5, 0, 0.12], shinL: [-0.05, 0, 0], shinR: [-0.05, 0, 0], chest: [-0.08 + 0.015 * sin(1.7 * t), 0, 0], neck: [0.04, 0.12 * sin(0.6 * t), 0], armL: [-0.45, 0, -0.35], armR: [-0.45, 0, 0.35], foreL: [-0.15, 0, 0], foreR: [-0.15, 0, 0] }),
  ];
  const valid = (i) => Number.isInteger(i) && i >= 0 && i < LIST.length;
  // the pose at t seconds, or null when t is outside the emote
  const pose = (i, t) => (valid(i) && t >= 0 && t <= LIST[i].dur ? POSE[i](t) : null);
  const IN = 0.28, OUT = 0.32, ease = (x) => x * x * (3 - 2 * x);
  // how much of the pose shows: it eases in over 0.28 s and out over the last 0.32 s
  function weight(i, t) {
    if (!valid(i) || t < 0 || t > LIST[i].dur) return 0;
    return ease(Math.min(1, t / IN)) * ease(Math.min(1, (LIST[i].dur - t) / OUT));
  }
  // the host's rate limit for one player: a bucket of CAP starts, one more every EVERY ms (stopping an emote is free)
  const RATE = { cap: 2, every: 2000 };
  function take(buckets, key, now) {
    now = now === undefined ? Date.now() : now;
    let b = buckets.get(key);
    b || buckets.set(key, (b = { tokens: RATE.cap, at: now }));
    b.tokens = Math.min(RATE.cap, b.tokens + Math.max(0, now - b.at) / RATE.every);
    b.at = now;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }
  const api = { LIST, valid, pose, weight, take, RATE, IN, OUT, IDS: LIST.map((e) => e.id), name: (i, en) => (valid(i) ? LIST[i][en ? "en" : "ko"] : "") };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.EMOTES = api;
})(typeof window === "object" ? window : globalThis);

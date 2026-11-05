'use strict';

// Every sound starts with synthesized noise and oscillators. No source recording is read.
const RATE = 22050;
const TAU = 2 * Math.PI;

function render(duration, seed, compose) {
  const signal = new Float64Array(Math.round(duration * RATE));
  function noise() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2147483648 - 1;
  }
  function add(at, span, sample) {
    const start = Math.round(at * RATE);
    const length = Math.min(signal.length - start, Math.round(span * RATE));
    for (let i = 0; i < length; i++) signal[start + i] += sample(i / RATE);
  }
  function click(at, strength, pitch = 1) {
    let previous = 0;
    add(at, .092, t => {
      const raw = noise();
      const edge = raw - .72 * previous;
      previous = raw;
      const impact = .58 * edge * Math.exp(-t / .0031);
      const resonance = .36 * Math.sin(TAU * 930 * pitch * t) * Math.exp(-t / .023)
        + .22 * Math.sin(TAU * 2310 * pitch * t) * Math.exp(-t / .012)
        + .10 * Math.sin(TAU * 4760 * pitch * t) * Math.exp(-t / .0065);
      return strength * Math.min(1, t / .0008) * (impact + resonance);
    });
  }
  function latch(at, strength, pitch) {
    click(at, strength * .49, pitch * 1.17);
    click(at + .021, strength, pitch);
  }
  function air(at, span, strength, brightness) {
    let body = 0, tail = 0;
    add(at, span, t => {
      const phase = t / span;
      const raw = noise();
      body += (.13 + brightness * Math.sin(Math.PI * phase)) * (raw - body);
      tail += .028 * (body - tail);
      const contour = Math.pow(Math.sin(Math.PI * phase), 1.45);
      const blade = .11 * Math.sin(TAU * (430 * t + 510 * t * t));
      return strength * contour * ((body - tail) * 1.7 + blade);
    });
  }
  compose({ click, latch, air });

  let peak = 0;
  for (const sample of signal) peak = Math.max(peak, Math.abs(sample));
  const gain = Math.min(1, .79 / Math.max(peak, .001));
  const out = Buffer.alloc(44 + signal.length * 2);
  out.write('RIFF', 0);
  out.writeUInt32LE(out.length - 8, 4);
  out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(RATE, 24);
  out.writeUInt32LE(RATE * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36);
  out.writeUInt32LE(signal.length * 2, 40);
  for (let i = 0; i < signal.length; i++) out.writeInt16LE(Math.round(signal[i] * gain * 32767), 44 + i * 2);
  return out;
}

function sounds() {
  const flips = (duration, seed, cues) => render(duration, seed, ({ air, click, latch }) => {
    cues.forEach(([at, force, pitch], i) => {
      air(Math.max(0, at - .075), .13, force * .37, .14);
      if (i % 3 === 1) click(at, force, pitch);
      else latch(at, force, pitch);
    });
  });
  const cut = (seed, strength, sweep, pitch) => render(.32, seed, ({ air, click }) => {
    air(.01, .245, strength, sweep);
    air(.033, .108, strength * .36, .29);
    click(.104, .14, pitch);
  });
  return {
    draw: flips(1, 201, [[.022,.32,1.2],[.116,.55,1.05],[.28,.7,.88],[.45,.48,1.12],[.61,.79,.86],[.73,.29,1.14]]),
    inspect: flips(4.35, 202, [
      [.025,.35,1.18],[.17,.64,.91],[.44,.42,1.07],[.66,.64,.92],[.92,.39,1.21],
      [1.24,.7,.84],[1.51,.42,1.13],[1.8,.59,.95],[2.11,.57,1.16],[2.46,.74,.85],
      [2.74,.45,1.11],[3.06,.62,.98],[3.36,.43,1.18],[3.67,.76,.86],[3.95,.46,1.07],[4.21,.69,.84],
    ]),
    melee_1: cut(203, .81, .23, 1.02),
    melee_2: cut(204, .87, .31, 1.16),
    melee_3: cut(205, .96, .19, .88),
    rotate_1: flips(1.04, 206, [[.053,.51,1.05],[.23,.67,.87],[.44,.45,1.12],[.68,.74,.89]]),
    rotate_2: flips(1, 207, [[.064,.46,1.17],[.26,.61,1.02],[.49,.72,.88],[.67,.42,1.13]]),
    rotate_3: flips(1.25, 208, [[.032,.4,1.12],[.21,.62,.94],[.47,.48,1.23],[.72,.76,.86],[.93,.33,1.11]]),
  };
}

module.exports = { sounds };

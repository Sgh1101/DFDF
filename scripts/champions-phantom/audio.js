// DFDF's own Champions Phantom music: instrument recipes (synthesized in the
// browser by js/phantom-audio.js) and original note sequences for the five
// kill cues, the inspect groove and the finisher theme.
// Each event: { at: seconds, sound, pitch: playback-rate ratio (0.5..2), volume }.
"use strict";

// Instrument recipes. base = Hz at pitch 1 (the MIDI note in BASE); no samples.
const INSTRUMENTS = {
  kick: { type: "kick", base: 150, end: 42, duration: 0.42, click: 0.35 },
  snare: { type: "snare", base: 196, duration: 0.26, tone: 0.35, noise: 0.85 },
  hat: { type: "hat", duration: 0.07, noise: 0.6 },
  bass: { type: "pluck", base: 73.42, duration: 0.7, bright: 0.35, decay: 4.5, sub: 0.6 },
  guitar: { type: "pluck", base: 146.83, duration: 0.9, bright: 0.62, decay: 3.4, sub: 0.15 },
  harp: { type: "pluck", base: 440, duration: 1.1, bright: 0.8, decay: 3.0, sub: 0 },
  chime: { type: "fm", base: 587.33, duration: 1.2, ratio: 4, index: 2.2, decay: 3.2 },
  bell: { type: "fm", base: 587.33, duration: 1.6, ratio: 3.51, index: 3, decay: 2.4 },
  flute: { type: "breath", base: 587.33, duration: 0.55, attack: 0.03, vibrato: 0.006, noise: 0.08 },
};
// MIDI note of each instrument's base; every note must sit within an octave of it.
const BASE = { bass: 38, guitar: 50, harp: 69, chime: 74, bell: 74, flute: 74 };
const N = { C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
const midi = (name) => { const m = /^([A-G]b?)(\d)$/.exec(name); if (!m) throw Error("bad note " + name); return N[m[1]] + 12 * (+m[2] + 1); };
function ev(at, sound, name, volume) {
  let pitch = 1;
  if (name != null) {
    const n = midi(name) - BASE[sound];
    if (Math.abs(n) > 12) throw Error(`${name} is outside ${sound}'s two octaves`);
    pitch = Math.round(2 ** (n / 12) * 10000) / 10000;
  }
  return { at: Math.round(at * 10000) / 10000, sound, pitch, volume: Math.round(volume * 10000) / 10000 };
}
// Shift a note name by octaves: up("A3", 1) = "A4".
const up = (name, k) => name.replace(/\d$/, (d) => String(+d + k));
const sorted = (out) => out.sort((a, b) => a.at - b.at || a.sound.localeCompare(b.sound) || a.pitch - b.pitch);

// ── kill cues: three quick steps, the harmony climbing with every kill ──
const STEP = 0.1875;
function killCue(chord, top, extra) {
  const out = [ev(0, "kick", null, 0.6), ev(0, "guitar", up(chord[0], -1), 0.42)];
  chord.forEach((n, i) => out.push(ev(i * STEP, "harp", n, 0.36 - i * 0.04)));
  top.forEach((n, i) => out.push(ev(i * STEP, "flute", n, 0.3 + i * 0.05)));
  out.push(ev(2 * STEP, "chime", top[2], 0.32), ...extra);
  return sorted(out);
}
const kill = {
  kill_1: killCue(["D4", "F4", "A4"], ["A4", "D5", "F5"], []),
  kill_2: killCue(["F4", "A4", "C5"], ["C5", "F5", "A5"], []),
  kill_3: killCue(["G4", "Bb4", "D5"], ["D5", "G5", "Bb5"], [ev(STEP, "bell", "D5", 0.22), ev(2 * STEP, "bell", "G5", 0.26)]),
  kill_4: killCue(["A4", "Db5", "E5"], ["E5", "A5", "Db6"], [ev(STEP, "bell", "E5", 0.24), ev(2 * STEP, "bell", "A5", 0.3)]),
  kill_5: fanfare(),
};
// Fifth kill: a five-chord fanfare over 2.6 s that resolves to D major.
function fanfare() {
  const out = [ev(0, "kick", null, 0.8)];
  const bars = [["D2", "D4", "F4", "A4"], ["Bb1", "Bb3", "D4", "F4"], ["C2", "C4", "E4", "G4"], ["A1", "A3", "Db4", "E4"], ["D2", "D4", "Gb4", "A4"]];
  const melody = ["A4", "D5", "F5", "E5", "D5", "C5", "D5", "E5", "F5", "G5", "A5", "G5", "E5", "Db5", "D5"];
  bars.forEach(([bass, ...chord], b) => {
    const t = b * 3 * STEP, last = b === bars.length - 1;
    out.push(ev(t, "bass", bass, 0.5));
    if (!last) chord.forEach((n, i) => out.push(ev(t + i * STEP, "harp", n, 0.3)));
    chord.forEach((n, i) => out.push(ev(t + (last ? 0 : i * STEP), "bell", up(n, 1), last ? 0.34 : 0.16 + i * 0.03)));
  });
  melody.forEach((n, i) => out.push(ev(i * STEP, "flute", n, 0.24 + (i % 3 === 0 ? 0.08 : 0))));
  ["F5", "D5", "E5", "Db5", "Gb5"].forEach((n, i) => out.push(ev(i * 3 * STEP, "chime", n, 0.3)));
  out.push(ev(14 * STEP, "kick", null, 0.7), ev(14 * STEP, "bell", "D6", 0.4), ev(14 * STEP, "chime", "A5", 0.36));
  return sorted(out);
}

// ── inspect: a laid-back four-bar groove at 100 BPM, loop 0.6..10.2 s ──
function inspect() {
  const beat = 0.6, out = [ev(0, "kick", null, 0.12), ev(0, "harp", "D5", 0.08)];
  const prog = [["D2", "D3", "F3", "A3"], ["Bb1", "Bb2", "D3", "F3"], ["F2", "C3", "F3", "A3"], ["A1", "A2", "Db3", "E3"]];
  const tune = ["A4", null, "C5", "D5", null, "F5", "E5", "D5", "F4", null, "A4", "Bb4", null, "D5", "C5", "A4", "C5", null, "D5", "F5", "E5", "D5", "C5", "A4", "Db5", null, "E5", null, "D5", "Db5", "A4", null];
  prog.forEach(([root, ...chord], bar) => {
    for (let b = 0; b < 4; b++) {
      const t = beat + (bar * 4 + b) * beat;
      out.push(ev(t, "kick", null, b % 2 ? 0.07 : 0.13));
      out.push(ev(t, "bass", root, 0.14), ev(t + beat / 2, "bass", b === 3 ? up(chord[0], -1) : root, 0.09));
      if (b % 2 === 1) chord.forEach((n, i) => out.push(ev(t + i * 0.02, "guitar", n, 0.07)));
      if (b === 0) out.push(ev(t + beat / 2, "harp", up(chord[2], 1), 0.06));
    }
    for (let k = 0; k < 8; k++) {
      const n = tune[bar * 8 + k];
      if (n) out.push(ev(beat + bar * 4 * beat + k * beat / 2, "flute", n, 0.05 + (k % 4 === 0 ? 0.03 : 0)));
    }
  });
  return { loopStart: 0.6, loopEnd: 10.2, events: sorted(out) };
}
// ── finisher theme: eight driving bars at 100 BPM (0..19.2 s) ──
function finisher() {
  const beat = 0.6, e = beat / 2, s = beat / 4, out = [];
  const prog = [["D2", "D3", "F3", "A3"], ["D2", "D3", "F3", "A3"], ["Bb1", "Bb2", "D3", "F3"], ["C2", "C3", "E3", "G3"], ["D2", "D3", "F3", "A3"], ["G1", "G2", "Bb2", "D3"], ["A1", "A2", "Db3", "E3"], ["A1", "A2", "Db3", "E3"]];
  const hook = ["D5", "F5", "A5", "G5", "F5", "E5", "D5", "E5"];
  prog.forEach(([root, ...chord], bar) => {
    const t0 = bar * 4 * beat;
    for (let b = 0; b < 4; b++) {
      const t = t0 + b * beat;
      if (b % 2 === 0 || (bar % 2 && b === 3)) out.push(ev(t, "kick", null, 0.42));
      if (b % 2 === 1) out.push(ev(t, "snare", null, 0.3));
      out.push(ev(t + e, "hat", null, 0.2));
      if (b === 3) out.push(ev(t + e + s, "hat", null, 0.16));
      out.push(ev(t, "bass", root, 0.4), ev(t + e, "bass", b === 3 ? up(chord[0], -1) : root, 0.3));
      for (let k = 0; k < 4; k++) out.push(ev(t + k * s, "guitar", chord[(b + k) % 3], 0.2 + (k === 0 ? 0.06 : 0)));
    }
    out.push(ev(t0, "chime", up(chord[2], 2), 0.3), ev(t0 + 2 * beat + e, "chime", up(chord[1], 2), 0.22));
    if (bar % 2 === 0) out.push(ev(t0, "harp", up(chord[0], 1), 0.28), ev(t0 + beat, "harp", up(chord[1], 1), 0.24));
    if (bar >= 4) hook.forEach((n, i) => i % 2 === bar % 2 && out.push(ev(t0 + i * e, "flute", n, 0.26)));
  });
  return { loopStart: 0, loopEnd: 19.2, events: sorted(out) };
}
function build() {
  const generator = "scripts/champions-phantom/audio.js";
  return {
    samples: { generator, synthesized: true, samples: INSTRUMENTS },
    kill: { generator, profiles: Object.fromEntries(Object.entries(kill).map(([k, events]) => [k, { category: "PLAYERS", events }])) },
    music: { generator, profiles: { inspect: { category: "RECORDS", ...inspect() }, finisher_music: { category: "RECORDS", ...finisher() } } },
  };
}
module.exports = { build, INSTRUMENTS };

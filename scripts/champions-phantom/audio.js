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
  chime: { type: "fm", base: 587.33, duration: 1.05, ratio: 2, index: 1.4, decay: 4.2 },
  bell: { type: "fm", base: 587.33, duration: 1.4, ratio: 3.0, index: 1.8, decay: 3.0 },
  flute: { type: "breath", base: 587.33, duration: 0.42, attack: 0.018, vibrato: 0.003, noise: 0.035 },
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

// Aurora: an original E-minor motif. Short kills answer the same three-note
// question higher each time; the fifth resolves with a major third.
const STEP=.1875;
function cue(root,notes){
 const out=[ev(0,'kick',null,.3),ev(0,'guitar',root,.2)];
 notes.forEach((n,i)=>out.push(ev(i*STEP,'flute',n,.23+i*.025)));
 out.push(ev(2*STEP,'chime',notes[2],.23));return sorted(out);
}
function fanfare(){
 const out=[],roots=['E2','C2','G2','B1','E2'];
 const chords=[['E4','G4','B4'],['C4','E4','G4'],['G4','B4','D5'],['B3','Eb4','Gb4'],['E4','Ab4','B4']];
 const tune=['B4','E5','G5','E5','D5','G5','B5','A5','G5','Gb5','B5','Eb5','E5','Ab5','B5'];
 for(let bar=0;bar<5;bar++){
  const t=bar*3*STEP;out.push(ev(t,'bass',roots[bar],.32),ev(t,'kick',null,.32));
  chords[bar].forEach((n,i)=>{out.push(ev(t+i*STEP,'harp',n,.17));out.push(ev(t,'bell',up(n,1),bar===4?.16:.09));});
 }
 tune.forEach((n,i)=>out.push(ev(i*STEP,'flute',n,.22),ev(i*STEP,'chime',n,.08)));
 out.push(ev(14*STEP,'bell','E5',.35),ev(14*STEP,'chime','B5',.2));return sorted(out);
}
const kill={
 kill_1:cue('E3',['B4','E5','G5']),kill_2:cue('G3',['D5','G5','B5']),
 kill_3:cue('A3',['E5','A5','C6']),kill_4:cue('B3',['Gb5','B5','D6']),kill_5:fanfare()
};
const PROG=[['E2','E3','G3','B3'],['C2','C3','E3','G3'],['A1','A2','C3','E3'],['B1','B2','Eb3','Gb3']];
const HOOK=['B4','E5',null,'G5','Gb5','E5','D5',null];
function inspect(){
 const beat=.6,out=[ev(0,'harp','E5',.09)];
 PROG.forEach(([root,...chord],bar)=>{
  const t=.6+bar*4*beat;
  for(let b=0;b<4;b++){
   if(b%2===0)out.push(ev(t+b*beat,'kick',null,.07),ev(t+b*beat,'bass',root,.12));
   if(b%2)out.push(ev(t+b*beat,'hat',null,.035));
   out.push(ev(t+b*beat+beat/2,'guitar',chord[(b+bar)%3],.075));
  }
  HOOK.forEach((n,k)=>{if(n)out.push(ev(t+k*beat/2,'flute',n,.055+(k===0?.02:0)));});
  out.push(ev(t+3*beat,'chime',bar===3?'Eb5':'E5',.045));
 });
 return {loopStart:.6,loopEnd:10.2,events:sorted(out)};
}
function finisher(){
 const beat=.6,out=[];
 for(let bar=0;bar<8;bar++){
  const [root,...chord]=PROG[bar%4],t=bar*4*beat;
  for(let b=0;b<4;b++){
   if(b===0||b===2)out.push(ev(t+b*beat,'kick',null,.29));
   if(b%2)out.push(ev(t+b*beat,'snare',null,.18));
   out.push(ev(t+b*beat,'bass',root,.24),ev(t+(b+.5)*beat,'bass',root,.12),ev(t+(b+.5)*beat,'hat',null,.08));
   for(let k=0;k<4;k++)out.push(ev(t+(b+k/4)*beat,'guitar',chord[(b+k)%3],k===0?.12:.065));
  }
  const melody=bar%4===3?['B4','Eb5',null,'Gb5','A5','Gb5','Eb5',null]:HOOK;
  melody.forEach((n,k)=>{if(n)out.push(ev(t+k*beat/2,'flute',n,.16));});
  chord.forEach((n,i)=>out.push(ev(t+i*.035,'harp',up(n,1),.1)));
  out.push(ev(t,'chime',bar%4===3?'Gb5':'E5',.19));
  if(bar>=4)out.push(ev(t+2*beat,'bell',bar%4===3?'B5':'G5',.12));
 }
 return {loopStart:0,loopEnd:19.2,events:sorted(out)};
}
function build() {
  const generator = "scripts/champions-phantom/audio.js";
  return {
    samples: { generator, synthesized: true, samples: INSTRUMENTS },
    kill: { generator, profiles: Object.fromEntries(Object.entries(kill).map(([k, events]) => [k, { category: "PLAYERS", events }])) },
    music: { generator, composition: "DFDF Aurora / 2026-11-02", profiles: { inspect: { category: "RECORDS", ...inspect() }, finisher_music: { category: "RECORDS", ...finisher() } } },
  };
}
module.exports = { build, INSTRUMENTS };

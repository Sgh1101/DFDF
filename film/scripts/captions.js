// captions.srt from TIMELINE: the same words, at the same times, as the burned-in copy
// and the click counter. The film has no voice; the copy is the narration.
const fs = require("node:fs"), path = require("node:path");
const T = require("../timeline.js");
const ts = (s) => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };
const cues = [];
for (const c of T.copy) {
  if (c.l2 && c.l2at > c.t0) { cues.push([c.t0, c.l2at, c.l1]); cues.push([c.l2at, c.t1, c.l1 + "\n" + c.l2]); }
  else cues.push([c.t0, c.t1, c.l2 ? c.l1 + "\n" + c.l2 : c.l1]);
}
// the URL typed into the bar stays readable on screen until the window takes it into its chrome
const typed = [T.moves.type[0], T.copy[1].t0], link = cues.find((c) => c[0] === T.copy[1].t0);
cues.push([typed[0], typed[1], T.url]); link[2] = T.url + "\n" + link[2];
// the counter names each button from the moment its screen is up (the numeral ticks on the click)
T.clicks.forEach((k, i) => cues.push([k.show, i + 1 < T.clicks.length ? T.clicks[i + 1].show : T.counter.t1, `${T.counter.kicker}\n${k.n} ${k.label}`]));
// what is inside: the kicker with one count at a time, as on screen
const I = T.inventory;
I.items.forEach((x, i) => cues.push([x.show, i + 1 < I.items.length ? I.items[i + 1].show : I.t1, `${I.kicker}\n${x.label} ${x.n}${x.unit}`]));
cues.sort((a, b) => a[0] - b[0]);
const srt = cues.map(([a, b, text], i) => `${i + 1}\n${ts(a)} --> ${ts(b)}\n${text}\n`).join("\n");
fs.writeFileSync(path.join(__dirname, "../captions.srt"), srt);
console.log(srt);

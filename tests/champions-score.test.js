const test=require('node:test'),assert=require('node:assert/strict'),{build}=require('../scripts/champions-phantom/audio');
test('Aurora is a newly composed common theme with distinct short kill cues, a calmer inspect and an immediate finale',()=>{
 const a=build();assert.equal(a.music.composition,'DFDF Aurora / 2026-11-02');
 const cues=Object.values(a.kill.profiles),inspect=a.music.profiles.inspect,fin=a.music.profiles.finisher_music;
 assert.equal(new Set(cues.map(c=>JSON.stringify(c.events))).size,5);
 assert.ok(cues[4].events.length>3*cues[0].events.length);
 const maximum=p=>Math.max(...p.events.map(e=>e.volume));assert.ok(maximum(inspect)<maximum(fin));
 for(const p of [inspect,fin]){
  assert.ok(p.events.some(e=>e.sound==='bass'));assert.ok(p.events.some(e=>e.sound==='flute'));assert.ok(p.events.some(e=>e.sound==='chime'));
  assert.ok(p.events.every(e=>e.at>=0&&e.at<p.loopEnd&&e.volume<=.5));
 }
 assert.ok(fin.events.some(e=>e.at<.3&&e.sound==='flute'),'the short eight-second finisher hears the actual hook');
 assert.ok(inspect.events.length<fin.events.length/2,'preview has room around the melody');
 assert.deepEqual(build(),a,'composition is deterministic');
});

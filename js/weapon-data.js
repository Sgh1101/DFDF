(function(root){
  'use strict';
  // The weapon line-up shared by the game (js/weapon-identity.js) and the server catalog (api/v1.js).
  // The numbers are this game's own (2026-11-07): magazines, fire rates, reloads and prices no longer copy any other
  // game's guns. Damage moved with the fire rate so the time to kill stays near where it was. Saved weapon/skin keys and
  // the Champions target are unchanged.
  const aliases={handcan:'revolver',stinger:'pistol',vector:'smg',pdw:'smg',burstsmg:'smg',ripper:'smg',slugger:'shotgun',doublebarrel:'pocketshot',battle:'rifle',lmg:'hmg',minigun:'hmg',antimat:'sniper'};
  const restored=['machpist','whisper','burst','shotgun','scout','bullpup'];
  const championsWeapon='scout';
  // Display names only. Saved weapon/skin keys and the Champions target stay unchanged.
  const names={pistol:'Axiom',silenced:'Hush',revolver:'Verdict',machpist:'Tempo',pocketshot:'Breach',smg:'Rush',whisper:'Veil',shotgun:'Impact',autoshot:'Havoc',rifle:'Strife',carbine:'Parallax',burst:'Trinity',scout:'Vesper',bullpup:'Vertex',hmg:'Overdrive',marksman:'Duplex',sniper:'Eclipse',rpg:'Rupture'};
  const profiles={pistol:{mag:15,rpm:420,auto:false,reload:2.0,dmg:22},silenced:{mag:11,rpm:380,auto:false,reload:1.8,dmg:22},revolver:{mag:6,rpm:210,auto:false,reload:2.6,dmg:58},rifle:{mag:28,rpm:620,auto:true,reload:2.2,cost:2800,dmg:32},carbine:{mag:15,rpm:300,auto:false,burst:0,reload:2.1,dmg:48,range:120,spread:.01,hs:2.8,quiet:false},scout:{mag:32,rpm:690,auto:true,burst:0,reload:2.4,dmg:27,range:75,spread:.022,hs:2.8,quiet:true},bullpup:{mag:30,rpm:750,auto:true,burst:0,reload:2.4,cost:2800,dmg:30,range:80,spread:.019,hs:2.8,quiet:false},autoshot:{mag:8,rpm:270,auto:true,reload:2.5},hmg:{mag:90,rpm:680,auto:true,reload:4.6,cost:4000,dmg:38},marksman:{mag:2,rpm:200,auto:false,reload:2.6,cost:3600},sniper:{mag:4,rpm:40,auto:false,reload:3.9,cost:4500}};
  // Knife skins that came with a removed third-party pack. They are no longer in the catalog; an account that
  // owned one gets gold back once (api/v1.js ensureWallet).
  const retiredKnives=['desire_blade','eternal_axe','eternal_karambit','future_butterfly','future_dagger','thunder_hammer'].map(id=>'vp_'+id);
  const api={aliases,restored,names,profiles,championsWeapon,retiredKnives,canonical:key=>aliases[key]||key};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.WEAPON_DATA=api;
})(typeof window==='object'?window:globalThis);

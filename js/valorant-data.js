(function(root){
  'use strict';
  // The weapon line-up shared by the game (js/weapon-identity.js) and the server catalog (api/v1.js).
  // VALORANT_DATA and the file name are internal names kept for saves, rooms and the Champions skin.
  const aliases={handcan:'revolver',stinger:'pistol',vector:'smg',pdw:'smg',burstsmg:'smg',ripper:'smg',slugger:'shotgun',doublebarrel:'pocketshot',battle:'rifle',lmg:'hmg',minigun:'hmg',antimat:'sniper'};
  const restored=['machpist','whisper','burst','shotgun','scout','bullpup'];
  const championsWeapon='scout';
  // Display names only; the keys stay. scout keeps 팬텀 because the Champions skin names it (champions-phantom.js).
  const names={pistol:'참새',silenced:'부엉이',revolver:'황소',rifle:'표범',carbine:'정찰 소총',scout:'팬텀',bullpup:'코멧 소총',autoshot:'멧돼지',hmg:'코뿔소',marksman:'송골매',sniper:'독수리'};
  const profiles={pistol:{mag:12,rpm:405,auto:false,reload:2.25},silenced:{mag:13,rpm:405,auto:false,reload:1.5},revolver:{mag:6,rpm:240,auto:false,reload:2.25},rifle:{mag:25,rpm:585,auto:true,reload:2.3333},carbine:{mag:15,rpm:300,auto:false,burst:0,reload:2.1,dmg:48,range:120,spread:.01,hs:2.8,quiet:false},scout:{mag:30,rpm:660,auto:true,burst:0,reload:2.5,dmg:28,range:75,spread:.022,hs:2.8,quiet:true},bullpup:{mag:30,rpm:750,auto:true,burst:0,reload:2.4,cost:2800,dmg:30,range:80,spread:.019,hs:2.8,quiet:false},autoshot:{mag:8,rpm:270,auto:true,reload:2.5},hmg:{mag:100,rpm:720,auto:true,reload:5},marksman:{mag:2,rpm:230,auto:false,reload:2.25},sniper:{mag:5,rpm:36,auto:false,reload:4.25}};
  // Knife skins that came with a removed third-party pack. They are no longer in the catalog; an account that
  // owned one gets gold back once (api/v1.js ensureWallet).
  const retiredKnives=['desire_blade','eternal_axe','eternal_karambit','future_butterfly','future_dagger','thunder_hammer'].map(id=>'vp_'+id);
  const api={aliases,restored,names,profiles,championsWeapon,retiredKnives,canonical:key=>aliases[key]||key};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.VALORANT_DATA=api;
})(typeof window==='object'?window:globalThis);

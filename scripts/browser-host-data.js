// Written after exploring entry, agent selection and the in-game HUD.
const assert=require('node:assert/strict'),{fixture}=require('./browser-fixture');
(async()=>{const f=await fixture();try{
 const p=await f.page('hostdata',{width:1280,height:720});
 await p.locator('#go-play').click();await p.waitForFunction(()=>!!document.querySelector('#sel-grid .acard'));
 await p.evaluate(()=>{room.map='glacier';room.mode='std';startGame(AGENTS[0],false);closeShop();ADMIN.freezeAI=true;world.phase='live';});
 await p.waitForFunction(()=>myActor()?.alive);
 const out=await p.evaluate(()=>{
  const a=myActor(),k=actorWeaponKey(a),mode=NET.mode,peer=NET.peer,html='<img src=x onerror="window.__hostDataXss=1">';
  NET.mode='client';NET.peer={};
  try{
   NET.onEvent({t:'am',id:a.id,k,n:7,r:25,rl:0});const legitimate=[a.ammo[k],a.reserve[k]];
   NET.onEvent({t:'am',id:a.id,k,n:html,r:html});const rejected=[a.ammo[k],a.reserve[k]];
   const s=buildSnapshot(false),score=world.scoreAtk;s.sa=html;applySnapshot(s);const scoreSafe=world.scoreAtk===score;
   const late=buildSnapshot(false),timer=world.roundTime;late.rt=-25;applySnapshot(late);const signedRound=world.roundTime===-2.5;world.roundTime=timer;
   // The renderer also handles a corrupt local state safely; markup stays text.
   a.ammo[k]=html;a.reserve[k]=html;updateHUD();const sink=document.getElementById('am-count'),textOnly=!sink.querySelector('img')&&sink.textContent.includes('<img');
   a.ammo[k]=7;a.reserve[k]=25;updateHUD();
   // The board was explored through its Tab path before this assertion was added.
   const saved=[world.scoreAtk,world.scoreDef,world.round,a.kills,a.ultCharge];
   world.scoreAtk=world.scoreDef=world.round=a.kills=a.ultCharge=html;
   QOL.openBoard('sb',true);const boardSafe=!document.querySelector('#bd-score img')&&!document.querySelector('#bd-body .ult img');QOL.closeBoard();
   [world.scoreAtk,world.scoreDef,world.round,a.kills,a.ultCharge]=saved;
   return{legitimate,rejected,scoreSafe,signedRound,textOnly,boardSafe,payload:!!window.__hostDataXss};
  }finally{NET.mode=mode;NET.peer=peer;}
 });
 assert.deepEqual(out,{legitimate:[7,25],rejected:[7,25],scoreSafe:true,signedRound:true,textOnly:true,boardSafe:true,payload:false});
 assert.deepEqual(f.errors,[]);console.log('Host numeric event/snapshot validation and text-only ammunition HUD passed');
}finally{await f.browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

(() => {
  'use strict';
  const R=RUNTIME_TOOLS,$=id=>document.getElementById(id),L=(ko,en)=>GAME_LANG==='en'?en:ko;
  const frames=R.samples(),input=R.samples(200),events=R.ring(),optional=R.budget(),lifetime=R.scope();
  const weapons=Object.create(null),bots=new Map();let activeSince=0,quality=SETTINGS.quality,lastNet='',botClock=0,deathUntil=0,tutorial=null;
  const metric=key=>{key=Object.hasOwn(WEAPONS,key)?key:'ability';return weapons[key]||(weapons[key]={shots:0,hits:0,damage:0,kills:0,heldSeconds:0});};
  const report=()=>({schema:1,release:release,platform:{mobile:matchMedia('(pointer:coarse)').matches,viewport:[innerWidth,innerHeight],pixelRatio:devicePixelRatio,standalone:matchMedia('(display-mode: standalone)').matches},
    measurement:{frameWindowMax:1800,inputMeaning:"pointerdown-to-fire-processing; not display latency"},game:{map:CUR_MAP_KEY,mode:room.mode,quality:SETTINGS.quality,optionalBudget:optional.level,seconds:activeSince?Math.round((performance.now()-activeSince)/1000):0},
    frameMs:frames.read(),inputMs:input.read(),gpu:{...renderer.info.memory},network:{mode:NET.mode,state:NET.status,latency:Math.round(NET.latency||0),connections:NET.conns.size},weapons:JSON.parse(JSON.stringify(weapons)),events:events.read()});
  let release={version:'2026.10.21',commit:'local'};
  window.addEventListener('api-diagnostic',({detail:d})=>{events.add('api-error',{action:d.action,status:d.status,requestId:/^[a-f0-9-]{36}$/.test(d.requestId)?d.requestId:''});});
  fetch('./api/release',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(j=>{if(j&&/^[a-f0-9]{7,40}$/.test(j.commit))release={version:String(j.version).slice(0,30),commit:j.commit};}).catch(()=>{});
  const diag=document.createElement('section');diag.id='game-diagnostics';diag.hidden=true;
  diag.innerHTML=`<div class="improve-card"><header><h2>${L('성능 · 연결 진단','Performance & connection')}</h2><button data-close aria-label="닫기">✕</button></header><p>${L('이 화면의 기록은 이 기기에만 있습니다. 이름·계정·대화·위치는 포함하지 않습니다.','These measurements stay on this device. No names, accounts, chat or positions.')}</p><pre id="diagnostic-values"></pre><footer><button id="diagnostic-reset">${L('측정 다시 시작','Restart measurement')}</button><button id="diagnostic-export">${L('진단 파일 저장','Save report')}</button></footer><p id="diagnostic-note" role="status"></p></div>`;
  document.body.append(diag);
  const button=(id,text,fn,parent)=>{const b=document.createElement('button');b.id=id;b.className='btn';b.textContent=text;b.onclick=fn;parent?.append(b);return b;};
  const paintReport=()=>{const d=report();$('diagnostic-values').textContent=JSON.stringify(d,null,2);};
  function reset(){frames.reset();input.reset();events.add('measurement-reset');activeSince=performance.now();}
  function open(){document.exitPointerLock?.();diag.hidden=false;paintReport();}
  diag.querySelector('[data-close]').onclick=()=>diag.hidden=true;
  $('diagnostic-reset').onclick=()=>{reset();paintReport();};
  button('diagnostic-update',L('업데이트 확인','Check for update'),async()=>{
    const note=$('diagnostic-note');note.textContent=L('확인 중…','Checking…');
    try{await navigator.serviceWorker?.getRegistration().then(r=>r?.update());const r=await fetch('./api/release',{cache:'no-store'});if(!r.ok)throw Error();const j=await r.json();
      if(j.commit!=='local'&&release.commit!=='local'&&j.commit!==release.commit){note.textContent=L('새 버전이 있습니다. 경기 종료 후 다시 열어 주세요.','An update is ready. Reopen after the match.');if((world.phase==='menu'||world.phase==='over')&&!$('diagnostic-reload'))button('diagnostic-reload',L('새 버전 열기','Open new version'),()=>location.reload(),diag.querySelector('footer'));}
      else note.textContent=L('현재 공개 버전과 같습니다.','You have the current release.');
    }catch{note.textContent=L('연결을 확인하고 다시 시도해 주세요.','Check your connection and retry.');}
  },diag.querySelector('footer'));
  $('diagnostic-export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='13-diagnostics-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  button('go-diagnostics',L('성능 진단','Diagnostics'),open,document.querySelector('#s-title .tt-sub'));
  button('pause-diagnostics',L('성능 · 연결 진단','Diagnostics'),open,$('pause')?.querySelector('.panel')||$('pause'));
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&(!diag.hidden||!guide.hidden)){e.stopImmediatePropagation();diag.hidden=true;guide.hidden=true;}},true);
  let pressAt=0;document.addEventListener('pointerdown',e=>{if(e.target.closest('#touch,canvas')&&world.phase==='live')pressAt=performance.now();},{passive:true});
  const fire=actorFire;actorFire=function(a){const key=a&&actorWeaponKey(a),before=a?.ammo?.[key];const r=fire.apply(this,arguments);
    if(a&&before!==a.ammo?.[key]&&a.ctrl==='me'){metric(key).shots++;if(pressAt){input.add(performance.now()-pressAt);pressAt=0;}}return r;};
  const hurt=hurtFighter;hurtFighter=function(a,n,h,by){const before=a?(a.hp||0)+(a.armor||0)+(a.shield||0):0,origin=window.DAMAGE_CAUSE?.get();const r=hurt.apply(this,arguments);
    const delta=a?Math.max(0,before-((a.hp||0)+(a.armor||0)+(a.shield||0))):0;
    if(delta&&by?.ctrl==='me'&&a!==by){const m=metric(origin?.gun||actorWeaponKey(by));m.hits++;m.damage+=Math.round(delta*10)/10;}return r;};
  const cast=castAbility;castAbility=function(){const r=cast.apply(this,arguments);if(tutorial&&world.phase==='live'&&!GAME_MODES[room.mode]?.noAbil&&!CAST_REFUND)tutorial.cast=true;return r;};
  const reload=actorReload;actorReload=function(a){const before=a?.reloading,r=reload.apply(this,arguments);if(tutorial&&a?.ctrl==='me'&&!before&&a.reloading)tutorial.reload=true;return r;};
  const death=document.createElement('div');death.id='death-detail';death.hidden=true;death.setAttribute('role','status');document.body.append(death);
  window.addEventListener('kill-confirmed',({detail:e})=>{const me=myActor();if(e.killer===me?.id)metric(e.kind==='ability'?'ability':e.gun).kills++;
    if(e.victim===me?.id){const skin=GUN_SKINS.list.find(s=>s.id===e.skin);death.textContent=[WEAPONS[e.gun]?.name||L('능력','Ability'),skin&&e.skin!=='default'?(GAME_LANG==='en'?skin.en:skin.ko):'',Number.isFinite(e.distance)?Math.round(e.distance)+'m':'',e.head?L('헤드샷','Headshot'):e.kind==='ability'?L('능력 처치','Ability kill'):''].filter(Boolean).join(' · ');death.hidden=false;deathUntil=performance.now()+4000;}});
  const guide=document.createElement('section');guide.id='quick-guide';guide.hidden=true;
  guide.innerHTML=`<div class="improve-card"><header><h2>${L('빠른 훈련','Quick training')}</h2><button data-close aria-label="닫기">✕</button></header><p>${L('표적장: 이동 → 장전 → 표적 3회 명중. 능력·스파이크는 별도 연습에서 배웁니다. 연습에서는 경기 보상을 지급하지 않습니다.','Range: move, reload, hit three targets. Practice abilities and the spike separately. Practice gives no match rewards.')}</p><div id="mode-guides"></div><footer><button id="guide-start">${L('표적장에서 배우기','Learn in the range')}</button></footer></div>`;
  document.body.append(guide);guide.querySelector('[data-close]').onclick=()=>guide.hidden=true;
  const tips={std:'공격은 사이트에서 설치 4초, 수비는 F로 해제 7초. 반 해제 진행이 저장됩니다.',dm:'처치로 팀 점수를 올립니다. 사망 후 다시 출전합니다.',ctf:'적 깃발을 우리 깃발 자리로 가져오세요. 먼저 3점.',zone:'줄어드는 안전 구역 안에서 마지막 한 명까지 생존하세요.',gun:'주어진 무기로 처치하며 단계를 올립니다.',knife:'칼의 공격 거리와 타이밍을 연습하세요.',inf:'감염을 피하거나 상대를 감염시키세요.',hill:'여러 거점의 점유 상태를 보며 이동하세요.'};
  for(const [key,mode] of Object.entries(GAME_MODES)){const p=document.createElement('p');p.textContent=(mode.name||key)+' · '+(GAME_LANG==='en'?(mode.sub||mode.name||key):(tips[key]||mode.sub||'목표와 점수는 경기 상단에 표시됩니다.'));$('mode-guides').append(p);}
  button('go-quick-guide',L('빠른 훈련 · 모드 안내','Training & mode guide'),()=>guide.hidden=false,document.querySelector('.home-practice > div'));
  const task=document.createElement('div');task.id='training-task';task.hidden=true;task.innerHTML='<span></span><button aria-label="훈련 건너뛰기">×</button>';document.body.append(task);
  task.querySelector('button').onclick=()=>{tutorial=null;task.hidden=true;};
  $('guide-start').onclick=()=>{guide.hidden=true;TARGET_RANGE.enter();tutorial={kind:'range',start:null,reload:false,cast:false,hits:TARGET_RANGE.RANGE.hits||0};task.hidden=false;};
  button('guide-ability',L('능력 · 스파이크 연습','Ability & spike practice'),()=>{guide.hidden=true;room.mode='std';room.map='glacier';startGame(typeof picked!=='undefined'&&picked||AGENTS[0],true);closeShop();tutorial={kind:'ability',cast:false,planted:false};task.hidden=false;},guide.querySelector('footer'));
  const begin=startGame;startGame=function(){lifetime.reset();bots.clear();for(const k of Object.keys(weapons))delete weapons[k];tutorial=null;task.hidden=true;death.hidden=true;events.add('match-start',{map:room.map,mode:room.mode});reset();return begin.apply(this,arguments);};
  const qualitySet=setQuality;setQuality=function(){const r=qualitySet.apply(this,arguments);optional.reset();quality=SETTINGS.quality;return r;};
  const baseAuto=autoQuality;autoQuality=function(dt,raw){const r=baseAuto.apply(this,arguments),ms=(raw??dt)*1000;
    if(SETTINGS.dynRes===false&&optional.level){const p=GRAPHICS_SETTINGS.presets[quality];optional.reset();GFX.bloom=p.bloom;GFX.shells=p.shells;GFX.shadowEvery=p.shadowEvery;}
    const running=world.phase==='live'&&!document.hidden&&!shopOpen&&$('pause').hidden&&diag.hidden;
    if(running){frames.add(ms);if(!navigator.webdriver&&SETTINGS.dynRes!==false&&optional.tick(ms,Math.min(raw??dt,.5))){const p=GRAPHICS_SETTINGS.presets[quality];GFX.bloom=p.bloom*optional.fraction;GFX.shells=p.shells&&optional.level<2;GFX.shadowEvery=Math.max(p.shadowEvery,optional.level?4:1);events.add('optional-budget',{level:optional.level});}}
    if(deathUntil&&(performance.now()>deathUntil||myActor()?.alive)){death.hidden=true;deathUntil=0;}return r;};
  const tick=step;step=function(dt){const r=tick.apply(this,arguments);botClock+=dt;const held=myActor();if(world.phase==='live'&&held?.alive&&Number.isFinite(dt)&&dt>0&&dt<1)metric(actorWeaponKey(held)).heldSeconds+=dt;
    if(tutorial&&['menu','over'].includes(world.phase)){tutorial=null;task.hidden=true;}
    if(tutorial?.kind==='ability'){const planted=world.spike?.state==='planted';tutorial.planted ||= planted;task.querySelector('span').textContent=!tutorial.cast?L('Q/E/C 능력을 사용하세요','Use Q, E or C'):!tutorial.planted?L('공격팀으로 사이트에 가서 4초 머물러 스파이크 설치','As attacker, stay on a site for 4 seconds to plant'):L('설치 완료! 수비팀은 F로 7초 해제합니다. 절반 진행은 저장됩니다.','Planted! Defenders hold F for 7s; half progress is saved.');}
    if(tutorial?.kind==='range'){const me=myActor();if(me?.pos){tutorial.start||={x:me.pos.x,z:me.pos.z};const moved=tutorial.moved ||= Math.hypot(me.pos.x-tutorial.start.x,me.pos.z-tutorial.start.z)>4;
      const hits=(TARGET_RANGE.RANGE.hits||0)-tutorial.hits,stage=!moved?0:!tutorial.reload?1:hits<3?2:3;
      task.querySelector('span').textContent=[L('4m 이동하세요','Move 4m'),L('발사 후 R 또는 장전 버튼','Fire, then reload'),L(`표적 명중 ${Math.max(0,hits)}/3`,`Target hits ${Math.max(0,hits)}/3`),L('훈련 완료! 모드를 골라 시작하세요.','Training complete! Choose a mode.')][stage];
    }}
    if(botClock>=1){const elapsed=botClock;botClock=0;
      const connections=[NET.up,...NET.conns.values()].filter(Boolean),states=connections.map(c=>c.peerConnection?.iceConnectionState||c.open&&'open'||'connecting').sort();
      const signature=JSON.stringify([NET.mode,NET.status,states]);if(signature!==lastNet){events.add('connection',{mode:NET.mode,phase:NET.status,ice:states.slice(0,12)});lastNet=signature;}
      if(world.phase==='live')for(const a of world.actors||[])if(a.alive&&isAI(a)){const b=bots.get(a.id);if(b){b.still=Math.hypot(a.pos.x-b.x,a.pos.z-b.z)<.1?b.still+elapsed:0;if(b.still>=10&&!b.warned){events.add('bot-stall',{mode:room.mode,map:CUR_MAP_KEY});b.warned=true;}if(!b.still)b.warned=false;}bots.set(a.id,{x:a.pos.x,z:a.pos.z,still:b?.still||0,warned:b?.warned||false});}
      if(!diag.hidden)paintReport();
    }return r;};
  // A visible direct entry; the selected map still loads lazily via ASCENT_TRIAL.
  const mapEntry=button('go-mark-valo','마크X발로 · '+L('원본 맵','Original map'),()=>{room.map='ascent_trial';$('go-play').click();paintSelMaps();},document.querySelector('#s-title .tt-menu'));
  const thumb=document.createElement('img');thumb.src='./assets/ui/ascent-preview-v1.png';thumb.alt='';thumb.width=64;thumb.height=36;thumb.loading='lazy';mapEntry.prepend(thumb);mapEntry.title='Minecraft 기본 텍스처 · 5대5 · A/B 거점';
  const controls=document.querySelector('.pz-pane[data-pane="ctl"]');
  if(controls&&window.TOUCHLAY){
    const preset=document.createElement('div');preset.className='pz-row';preset.textContent=L('주 사격 손 · 적용 후 버튼 배치에서 더 조절할 수 있습니다.','Fire hand · refine the layout in Edit layout.');controls.append(preset);
    for(const [id,label,x] of [['touch-left','왼손 사격',.14],['touch-right','오른손 사격',.86]])button(id,L(label,id==='touch-left'?'Left fire':'Right fire'),()=>{TOUCHLAY.set('tb-fire',[x,.55,1]);TOUCHLAY.apply();},preset);
  }
  window.addEventListener('pagehide',()=>{lifetime.reset();CHAMPIONS_AUDIO?.stopMusic();});
  window.GAME_DIAGNOSTICS=Object.freeze({report,reset,open,events,lifetime,optional});
})();

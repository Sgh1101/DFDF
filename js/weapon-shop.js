/* Match-credit equipment shop. Reuses the game's purchase and skin paths. */
(() => {
  'use strict';
  const el=id=>document.getElementById(id),shop=el('shop'),market=el('shop-grid');
  shop.classList.add('weapon-shop');shop.setAttribute('role','dialog');shop.setAttribute('aria-label','장비 구매');
  const header=shop.querySelector('.shop-hd'),wallet=el('shop-cr');
  header.innerHTML='<div class="buy-heading"><div><div class="buy-kicker">ROUND LOADOUT</div><h3>장비 구매</h3></div><div class="buy-round">준비를 마치고<b>다음 라운드로</b></div></div>';
  const money=document.createElement('div');money.className='buy-wallet';money.innerHTML='<small>경기 크레딧</small>';money.append(wallet);header.append(money);
  const body=document.createElement('div');body.className='buy-body';
  const left=document.createElement('div');left.className='buy-market';shop.insertBefore(body,market);left.append(market);body.append(left);
  const utility=document.createElement('div');utility.id='buy-utility';utility.className='buy-utility';left.append(utility);
  const detail=document.createElement('aside');detail.id='buy-detail';detail.className='buy-detail';detail.setAttribute('aria-label','선택한 장비 정보');
  detail.innerHTML='<div class="buy-detail-tag" id="buy-category"></div><div class="buy-preview" id="buy-preview"><canvas id="buy-canvas" aria-label="선택한 총의 실제 장착 모델"></canvas><div id="buy-preview-state" class="buy-preview-state"></div></div><h2 id="buy-name"></h2><div class="buy-detail-skin" id="buy-skin"></div><p class="buy-detail-desc" id="buy-description"></p><dl class="buy-stat-list" id="buy-stats"></dl><table class="buy-damage" id="buy-damage"><caption class="buy-hint">기본 피해 · 거리 보정 전</caption><thead><tr><th>타격 부위</th><th>머리</th><th>몸통</th></tr></thead><tbody></tbody></table><button class="buy-action" id="buy-purchase"></button><div class="buy-why" id="buy-why"></div>';
  body.append(detail);
  const footer=shop.querySelector('.shop-ft');footer.querySelector('span').remove();
  const notice=document.createElement('span');notice.id='buy-notice';notice.className='buy-notice';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');footer.prepend(notice);
  const hint=document.createElement('span');hint.className='buy-hint';hint.textContent='총 위에 마우스 · 클릭하여 구매';footer.insertBefore(hint,footer.querySelector('button'));
  const shield='<svg viewBox="0 0 64 72" aria-hidden="true"><path d="M32 5 56 14v20c0 14-12 25-24 33C20 59 8 48 8 34V14Z"/><path d="M32 22v24M20 34h24"/></svg>';
  const grenade='<svg viewBox="0 0 64 72" aria-hidden="true"><path d="m25 15 14-3 6 13-17 5Z"/><path d="m33 12 2-7 15 3 4 19M19 31c-14 16-8 35 10 36 20 0 28-19 16-33L34 25Z"/></svg>';
  const desc={pistol:'가벼운 기본 보조 무기. 빠르게 꺼내 근거리와 중거리에 대응합니다.',silenced:'소음기를 장착한 정밀 보조 무기. 조용한 사격과 정확한 조준에 적합합니다.',revolver:'한 발의 위력이 높은 보조 무기. 정확히 조준해 강력한 피해를 줍니다.',pocketshot:'짧은 거리에서 여러 산탄을 발사하는 보조 무기. 모퉁이와 좁은 통로에서 유용합니다.',smg:'빠른 연사로 근거리 교전에 대응하는 기관단총입니다.',autoshot:'연속 사격이 가능한 산탄총. 가까운 거리에서 여러 탄환이 한 번에 퍼집니다.',rifle:'정확한 조준과 강한 한 발을 갖춘 자동 소총. 중거리 교전에 적합합니다.',carbine:'빠른 연사와 소음기를 갖춘 자동 소총. 이동 후 짧게 끊어 쏘며 사용합니다.',hmg:'넉넉한 탄창으로 긴 시간 사격하는 기관총. 진입로와 좁은 구역을 견제합니다.',marksman:'두 발을 빠르게 이어 쏘는 저격소총. 짧은 틈에 집중 사격할 수 있습니다.',sniper:'한 발의 위력이 높은 장거리 저격소총. 조준경을 사용해 멀리 있는 적을 노립니다.',rpg:'폭발 피해를 주는 로켓 발사기. 한 발을 발사한 뒤 재장전해야 합니다.'};
  const columns=[[['보조 무기',['보조']]],[['기관단총',['기관단총']],['산탄총',['산탄총']]],[['소총',['소총']]],[['저격소총',['저격총']],['중화기',['기관총','중화기']]],[['방어구',[]]]];
  Object.assign(desc,{machpist:'자동 사격이 가능한 보조 무기. 가까운 거리에서 빠르게 연사합니다.',whisper:'소음기를 갖춘 기관단총. 근거리에서 빠른 연사로 대응합니다.',burst:'세 발씩 점사하는 소총. 연속 발사 사이에 조준을 가다듬어 사용합니다.',shotgun:'여러 산탄을 한 번에 발사하는 단발 산탄총. 가까운 거리의 교전에 적합합니다.',scout:'중장거리에서 정밀 사격하는 소총. 저격총보다 빠르게 후속 사격할 수 있습니다.'});
  let selected='weapon:carbine',noticeText='',lastState='',raf=0,lastTick=0,preview=null,previewKey='',thumbTimer=0,pending=null;
  const thumbnails=new Map(),thumbQueue=new Map();
  const actor=()=>myActor()||player;
  const unlimited=a=>a.credits>=999999;
  const price=(cost,a)=>cost===0?'기본 지급':unlimited(a)?'무료':cost.toLocaleString()+' 크레딧';
  const refs=()=>{const a=actor(),items=new Map();
    for(const [key,w] of Object.entries(WEAPONS))if(key!=='knife')items.set('weapon:'+key,{kind:'weapon',key,name:w.name,category:w.cls,cost:w.cost,owned:Object.values(a.weapons||{}).includes(key),w});
    for(const [key,amount,cost,name] of [['light',25,400,'경량 방어구'],['heavy',50,1000,'중형 방어구']])items.set('armor:'+key,{kind:'armor',key,name,category:'방어구',cost,owned:a.armor>=amount,amount});
    items.set('nade:',{kind:'nade',key:'',name:'수류탄',category:'장비',cost:300,owned:(a.nades||0)>=2,count:a.nades||0,max:2});
    for(const [i,x] of (a.abilities||[]).entries())if(x.def.cost)items.set('ability:'+i,{kind:'ability',key:i,name:x.def.name,category:'스킬',cost:x.def.cost,owned:x.charges>=x.def.charges,count:x.charges,max:x.def.charges,def:x.def});
    return items;
  };
  function usable(item,a){return !pending&&world.phase==='buy'&&a.alive&&!item.owned&&(unlimited(a)||a.credits>=item.cost);}
  function message(item,a){if(world.phase!=='buy')return '구매 단계에만 이용할 수 있습니다';if(!a.alive)return '다음 라운드에 구매할 수 있습니다';if(pending)return '호스트의 구매 확인을 기다리는 중입니다';if(item.owned)return item.kind==='weapon'?'이미 보유한 무기입니다':'최대로 보유하고 있습니다';if(!unlimited(a)&&a.credits<item.cost)return (item.cost-a.credits).toLocaleString()+' 크레딧이 부족합니다';return item.kind==='weapon'?'구매하면 바로 장착합니다':'구매 즉시 보유 장비에 추가됩니다';}
  function reconcile(){if(!pending)return;const item=refs().get(pending.id),done=item&&(item.kind==='weapon'||item.kind==='armor'?item.owned:item.count>pending.count);
    if(done){noticeText=item.name+' 구매 완료';pending=null;}
    else if(NET.mode!=='client'||performance.now()-pending.at>10000){noticeText='구매 결과가 확인되지 않았습니다. 보유 장비와 연결 상태를 확인하세요.';pending=null;}
  }
  function select(id){if(selected!==id){selected=id;paintSelection();}else paintDetail();}
  function purchase(id){const a=actor(),item=refs().get(id);if(!item)return;select(id);if(!usable(item,a))return;
    if(NET.mode==='client'){pending={id,count:item.count,at:performance.now()};sendAction({t:'buy',kind:item.kind,key:item.key});noticeText=item.name+' 구매 요청 중…';}
    else{applyPurchase(a,item.kind,item.key);noticeText=item.name+' 구매 완료';}
    renderShop();updateHUD();
  }
  function queueThumb(img,key,skin){const token=key+'|'+skin.id;
    if(VALORANT_PACK.status!=='ready'||(CHAMPIONS_PHANTOM.isSkin(skin.id)&&!CHAMPIONS_PHANTOM.loaded()))return;
    if(thumbnails.has(token)){img.src=thumbnails.get(token);return;}
    if(!thumbQueue.has(token))thumbQueue.set(token,[]);thumbQueue.get(token).push(img);
    if(!thumbTimer)thumbTimer=setTimeout(pumpThumb,20);
  }
  function pumpThumb(){thumbTimer=0;if(shop.hidden){thumbQueue.clear();return;}const next=thumbQueue.entries().next().value;if(!next)return;const [token,images]=next;thumbQueue.delete(token);const [key,sid]=token.split('|'),url=GUN_SKINS.thumb(key,sid);if(url){thumbnails.set(token,url);for(const img of images)if(img.isConnected)img.src=url;}
    if(thumbQueue.size)thumbTimer=setTimeout(pumpThumb,25);
  }
  function button(item){const a=actor(),id=item.kind+':'+item.key,b=document.createElement('button');b.type='button';b.className='sitem';b.dataset.kind=item.kind;b.dataset.key=item.key;b.dataset.item=id;
    b.classList.toggle('owned',item.owned);b.classList.toggle('unaffordable',!unlimited(a)&&a.credits<item.cost);b.setAttribute('aria-disabled',String(!usable(item,a)));b.setAttribute('aria-label',item.name+' · '+(item.owned?'보유 중':price(item.cost,a)));
    if(item.kind==='weapon'){const img=document.createElement('img');img.className='buy-gun-image';img.alt='';img.decoding='async';b.append(img);const skin=GUN_SKINS.of(item.key);queueThumb(img,item.key,skin);if(skin.id!=='default'){const dot=document.createElement('i');dot.className='buy-skin-dot';b.append(dot);}}
    else{const icon=document.createElement('span');icon.className='buy-icon';icon.innerHTML=shield;icon.firstElementChild.classList.add('buy-shield');b.append(icon);}
    if(item.owned){const owned=document.createElement('i');owned.className='buy-owned';owned.textContent='보유 중';b.append(owned);}
    const cost=document.createElement('span');cost.textContent=item.owned?'보유 중':price(item.cost,a);const name=document.createElement('b');name.textContent=item.name;b.append(cost,name);
    b.onpointerenter=e=>{if(e.pointerType!=='touch')select(id);};b.onfocus=()=>select(id);b.onclick=()=>purchase(id);return b;
  }
  function util(item){const a=actor(),id=item.kind+':'+item.key,b=document.createElement('button');b.className='buy-util';b.type='button';b.dataset.item=id;b.dataset.kind=item.kind;b.dataset.key=item.key;b.setAttribute('aria-disabled',String(!usable(item,a)));
    const icon=document.createElement('span');icon.className='buy-util-icon';icon.textContent=item.def?.key||'G';const copy=document.createElement('span'),name=document.createElement('b'),meta=document.createElement('small');name.textContent=item.name;meta.textContent=`${item.count}/${item.max} · ${price(item.cost,a)}`;copy.append(name,meta);b.append(icon,copy);b.onpointerenter=e=>{if(e.pointerType!=='touch')select(id);};b.onfocus=()=>select(id);b.onclick=()=>purchase(id);return b;
  }
  renderShop=function(){const a=actor();if(!a)return;reconcile();const focused=document.activeElement?.closest?.('[data-item]')?.dataset.item,scroll=market.scrollTop,items=refs();
    wallet.textContent=unlimited(a)?'무제한':a.credits.toLocaleString();shop.querySelector('.buy-round').innerHTML='구매 단계<b>총기 '+[...items.values()].filter(x=>x.kind==='weapon').length+'종 · 칼 별도</b>';market.replaceChildren();utility.replaceChildren();
    for(const [i,groups] of columns.entries()){const col=document.createElement('div');col.className='shop-col'+(i===4?' buy-armor':'');for(const [name,classes] of groups){const group=document.createElement('section');group.className='buy-group';const title=document.createElement('h4');title.className='shop-sec';title.textContent=name;group.append(title);
      for(const item of items.values())if((i===4&&item.kind==='armor')||(item.kind==='weapon'&&classes.includes(item.category)))group.append(button(item));col.append(group);}market.append(col);}
    const label=document.createElement('span');label.className='buy-utility-title';label.innerHTML='스킬 & 장비<small>나이프는 기본 보유</small>';utility.append(label);for(const item of items.values())if(item.kind==='nade'||item.kind==='ability')utility.append(util(item));
    if(!items.has(selected))selected='weapon:carbine';market.scrollTop=scroll;paintSelection();el('buy-notice').textContent=noticeText||'구매 단계 · 전투를 준비하세요';
    if(focused)shop.querySelector(`[data-item="${focused}"]`)?.focus({preventScroll:true});lastState=state();return undefined;
  };
  function paintSelection(){for(const b of shop.querySelectorAll('[data-item]')){const on=b.dataset.item===selected;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));}paintDetail();}
  function paintDetail(){const a=actor(),item=refs().get(selected);if(!item)return;const w=item.w,skin=w?GUN_SKINS.of(item.key):null;
    el('buy-category').textContent=item.category;el('buy-name').textContent=item.name;el('buy-skin').textContent=skin?(skin.id==='default'?'기본 스킨':skin.ko||skin.en):item.kind==='armor'?'방어구 '+item.amount+' 제공':`보유 ${item.count} / ${item.max}`;
    el('buy-description').textContent=w?desc[item.key]||'전투 상황에 맞춰 사용하는 무기입니다.':item.kind==='armor'?'받는 피해를 흡수해 생존을 돕습니다. 이미 더 높은 방어구를 보유했다면 추가 구매할 수 없습니다.':item.kind==='nade'?'G로 핀을 뽑고 발사 버튼으로 던집니다. 최대 2개까지 보유합니다.':item.def?.desc||'라운드에서 사용할 스킬 충전을 추가합니다.';
    const stats=w?[['사격 방식',w.launcher?'로켓':w.burst?'점사':w.auto?'자동':'단발'],['연사 속도',(w.rpm/60).toFixed(1)+'발/초'],['탄창',w.mag+'발'],['사거리',w.range+'m']]:[['보유',item.kind==='armor'?a.armor:item.count],['최대',item.kind==='armor'?item.amount:item.max]];
    el('buy-stats').replaceChildren();for(const [label,value] of stats){const cell=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;cell.append(dt,dd);el('buy-stats').append(cell);}
    el('buy-damage').hidden=!w;el('buy-damage').querySelector('tbody').innerHTML=w?`<tr><td>${w.pellets?'산탄 1발 기준':w.launcher?'최대 폭발 피해':'기본 피해'}</td><td>${w.launcher?'—':Math.round(w.dmg*w.hs)}</td><td>${w.dmg}</td></tr>${w.pellets?`<tr><td>발사당 산탄</td><td colspan="2">${w.pellets}발</td></tr>`:''}`:'';
    const buy=el('buy-purchase');buy.disabled=!usable(item,a);buy.textContent=item.owned?'보유 중':'구매 · '+price(item.cost,a);buy.onclick=()=>purchase(selected);el('buy-why').textContent=message(item,a);showModel(item,skin);
  }
  function initPreview(){if(preview)return preview;const r=new T.WebGLRenderer({canvas:el('buy-canvas'),alpha:true,antialias:true});r.setPixelRatio(Math.min(devicePixelRatio||1,2));r.outputColorSpace=T.SRGBColorSpace;r.toneMapping=renderer.toneMapping;r.toneMappingExposure=1.1;const sc=new T.Scene();sc.environment=scene.environment;sc.add(new T.HemisphereLight(0xffffff,0xa0bca8,1.8));for(const [color,power,x,y,z] of [[0xfff2dd,2.8,2,3,3],[0xa1d6d0,2,-3,1,-2]]){const light=new T.DirectionalLight(color,power);light.position.set(x,y,z);sc.add(light);}const cam=new T.PerspectiveCamera(26,1,.01,50);preview={r,sc,cam,obj:null};return preview;}
  function clearPreview(){if(!preview?.obj)return;preview.sc.remove(preview.obj);const disposed=new Set();preview.obj.traverse(n=>{if(n.geometry&&!n.geometry.userData.shared&&!disposed.has(n.geometry)){disposed.add(n.geometry);n.geometry.dispose();}});preview.obj=null;}
  function showModel(item,skin){const key=item.kind==='weapon'?item.key+'|'+skin.id+'|'+VALORANT_PACK.status+'|'+CHAMPIONS_PHANTOM.loaded():item.kind;
    if(previewKey===key){resizePreview();return;}previewKey=key;clearPreview();const host=el('buy-preview'),state=el('buy-preview-state'),canvas=el('buy-canvas');host.querySelector('svg')?.remove();host.dataset.weapon=item.kind==='weapon'?item.key:'';host.dataset.skin=skin?.id||'';
    if(item.kind!=='weapon'){canvas.hidden=true;state.hidden=true;host.insertAdjacentHTML('beforeend',item.kind==='armor'?shield:grenade);return;}
    canvas.hidden=false;state.hidden=true;
    if(VALORANT_PACK.status!=='ready'||(CHAMPIONS_PHANTOM.isSkin(skin.id)&&!CHAMPIONS_PHANTOM.loaded())){state.textContent='원본 모델 불러오는 중…';state.hidden=false;return;}
    try{const p=initPreview(),gun=GUN_SKINS.buildFor(item.key,skin);GUN_SKINS.apply(gun,skin);const pivot=new T.Group();pivot.add(gun);gun.position.sub((window.VALORANT_PACK?.bounds(gun) || new T.Box3().setFromObject(gun)).getCenter(new T.Vector3()));pivot.rotation.y=Math.PI/2+.15;p.sc.add(pivot);pivot.updateMatrixWorld(true);const box=(window.VALORANT_PACK?.bounds(pivot) || new T.Box3().setFromObject(pivot));pivot.position.sub(box.getCenter(new T.Vector3()));p.obj=pivot;resizePreview();}
    catch(error){state.textContent='모델을 불러오지 못했습니다';state.hidden=false;console.error('Equipment preview',error);}
  }
  function resizePreview(){if(!preview?.obj||shop.hidden)return;const {r,cam,obj,sc}=preview,host=el('buy-preview'),w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;r.setSize(w,h,false);cam.aspect=w/h;const size=(window.VALORANT_PACK?.bounds(obj) || new T.Box3().setFromObject(obj)).getSize(new T.Vector3()),tan=Math.tan(cam.fov*Math.PI/360),d=Math.max(size.y*1.3/(2*tan),size.x*1.16/(2*tan*cam.aspect))+size.z/2;cam.position.set(0,d*.12,d);cam.lookAt(0,0,0);cam.updateProjectionMatrix();r.render(sc,cam);}
  new ResizeObserver(resizePreview).observe(el('buy-preview'));
  function state(){const a=actor();return JSON.stringify([world.phase,a.alive,a.credits,a.armor,a.nades,a.weapons,(a.abilities||[]).map(x=>x.charges),GUN_SKINS.mine(),VALORANT_PACK.status,CHAMPIONS_PHANTOM.loaded(),pending?.id,NET.mode]);}
  function watch(t){raf=0;if(shop.hidden)return;if(t-lastTick>180){lastTick=t;reconcile();if(state()!==lastState)renderShop();}raf=requestAnimationFrame(watch);}
  const open=openShop,close=closeShop;
  openShop=function(){noticeText='';const wanted=selected,r=open.apply(this,arguments);if(!shop.hidden){queueMicrotask(()=>{selected=wanted;paintSelection();shop.querySelector(`[data-item="${selected}"]`)?.focus({preventScroll:true});});if(!raf)raf=requestAnimationFrame(watch);}return r;};
  closeShop=function(){if(raf)cancelAnimationFrame(raf);raf=0;return close.apply(this,arguments);};
  window.WEAPON_SHOP={selected:()=>selected,preview:()=>preview,items:refs};
})();

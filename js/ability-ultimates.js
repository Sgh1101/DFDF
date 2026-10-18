(() => {
  'use strict';
  if(!window.ABILITY_DETAILS)return;
  const A=ABILITY_DETAILS, fields=new Set(), objects=new Map();
  const host=()=>NET.mode!=='client';
  const foes=c=>foesOf(c).filter(a=>a.alive);
  const allies=c=>actorList().filter(a=>a.alive&&a.team===c.team);
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  const near=(a,p,r)=>distance(a.pos,p)<=r;
  const visible=(a,b)=>!rayBlocked(a.pos.x,(a.y||0)+1.4,a.pos.z,b.pos.x,(b.y||0)+1.1,b.pos.z);
  const aim=d=>aimPoint(d/(window.AB_D||1));
  const hit=(a,n,c)=>host()&&a.alive&&hurtFighter(a,n,false,c);
  const color=c=>c.agent.color;
  let serial=0,token=null,received=null;
  const changed=new Set(['ult_lightning','ult_queen','x_ult_jungle','x_ult_soundwall','x_ult_fullmoon','x_ult_skyhunter','x_ult_garden_heal']);
  const key=(c,type)=>`${world.round}:${c.id}:${type}:${token||++serial}`;
  const send=event=>{if(NET.mode==='host')sendEventAll({...event,t:'ability-detail'});};
  // Carry the host's exact cast identity to each replay. A destruction event cannot
  // accidentally remove a different cast even if a guest joined halfway through a round.
  const oldSend=sendEventAll;
  sendEventAll=function(m){return oldSend.call(this,m&&m.t==='cast'&&changed.has(m.ty)?{...m,dv:token}:m);};
  const oldReplay=replayCast;
  replayCast=function(m){const prev=received;received=m&&m.dv;try{return oldReplay.apply(this,arguments);}finally{received=prev;}};
  const oldCast=castAbility;
  castAbility=function(type){const prev=token;token=received||++serial;try{return oldCast.apply(this,arguments);}finally{token=prev;}};
  const oldEvent=NET.onEvent;
  NET.onEvent=function(m){
    if(m&&m.t==='ability-detail'){
      if(m.k==='concuss'&&Number.isFinite(m.n)){const a=actorById(m.a);if(a)applyConcuss(a,Math.max(0,Math.min(1,m.n)));return;}
      if(m.k==='cleanse'&&Array.isArray(m.a)){for(const id of m.a.slice(0,TEAM_SIZE)){const a=actorById(id);if(a){for(const k of ['blind','concuss','slowT','root','decayT','decayAmt'])a[k]=0;a.slow=1;}}return;}
      if(m.k==='soundpulse'){const a=actorById(m.a);if(a)fxRing(a.pos.x,a.pos.z,16,0x80deea,.55);return;}
      const item=objects.get(m.id);
      if(item){if(m.k==='break')item.broken=true;else if(m.k==='pool'&&Number.isFinite(m.n))item.pool=Math.max(0,Math.min(180,m.n));}
      return;
    }
    return oldEvent.apply(this,arguments);
  };
  function refund(c){if(host()){CAST_REFUND=true;c.ultCharge=c.ultMax;}tellTeam(c,'대상이 없습니다 — 궁극기 반환','#8a97ab');}
  function pick(c,range=40){
    const dx=-Math.sin(c.yaw),dz=-Math.cos(c.yaw);
    return foes(c).filter(a=>{const x=a.pos.x-c.pos.x,z=a.pos.z-c.pos.z,L=Math.hypot(x,z);return L<=range&&(L<1||(x*dx+z*dz)/L>.94)&&visible(c,a);})
      .sort((a,b)=>distance(a.pos,c.pos)-distance(b.pos,c.pos)||String(a.id).localeCompare(String(b.id)))[0];
  }
  function point(a,h=1.2){return {x:a.pos.x,y:(a.y||0)+h,z:a.pos.z};}
  function outline(x,y,z,r,col){
    const l=A.line(col,49),pts=[];for(let i=0;i<=48;i++){const a=i*Math.PI/24;pts.push({x:x+Math.cos(a)*r,y,z:z+Math.sin(a)*r});}A.setLine(l,pts);scene.add(l);return l;
  }
  function shootable(id,c,p,model,hp,r) {
    const item={id,broken:false,model},s={x:p.x,y:p.y,z:p.z,r,hp,team:c.team,color:parseInt(color(c).slice(1),16),onBreak(){if(!host())return;item.broken=true;send({k:'break',id});}};
    SHOOTABLES.push(s);objects.set(id,item);
    item.shot=s;item.remove=()=>{const i=SHOOTABLES.indexOf(s);if(i>=0)SHOOTABLES.splice(i,1);objects.delete(id);A.dispose(model);};
    return item;
  }
  function updateDef(type,name,desc){for(const a of AGENTS)for(const d of a.abilities)if(d.type===type){d.name=name;d.desc='궁극기 — '+desc;}}

  updateDef('ult_lightning','연쇄 뇌격','40m 안 조준한 적에게 전하를 모아 0.65초 뒤 방전한다. 8m 안 가까운 적으로 최대 4명까지 연결(60/42/29/21 피해, 1초 뇌진탕). 벽이나 적 사이 거리로 연결을 끊을 수 있다.');
  delete ULTW_OF.ult_lightning; // The continuous hand beam belongs exclusively to Neon.
  CAST_EXT.ult_lightning=()=>{
    const c=player,first=pick(c);if(!first)return refund(c);
    const wire=A.line(color(c),2);scene.add(wire);let chain=null,index=0,next=.65;
    A.lifecycle(1.5,(t)=>{
      if(t<.65){A.setLine(wire,[point(c),point(first)]);wire.material.opacity=.25+t*.7;return;}
      if(!chain){chain=first.alive&&near(first,c.pos,40)&&visible(c,first)?ABILITY_PROFILES.chainTargets(first,foes(c),8,4,visible):[];}
      if(index<chain.length&&t>=next){
        const from=index?chain[index-1]:c,to=chain[index];
        // Validate each link again as it fires: moving behind a wall/breaking spacing works.
        if(!to.alive||!visible(from,to)||(index&&distance(from.pos,to.pos)>8)){index=chain.length;return;}
        A.setLine(wire,[point(from),point(to)]);wire.material.opacity=1;
        hit(to,Math.round(60*Math.pow(.7,index)),c);if(host()){applyConcuss(to,1);send({k:'concuss',a:to.id,n:1});}
        index++;next+=.16;
      }else wire.material.opacity=Math.max(0,wire.material.opacity-.07);
    },()=>A.dispose(wire),c);
  };

  updateDef('ult_queen','여왕벌','조준한 곳에 체력 120의 여왕을 12초간 세운다. 18m 안 보이는 적에게 1.5초마다 일벌이 출격한다(18 피해). 여왕을 쏴서 파괴하거나 영역을 벗어나면 멈춘다.');
  CAST_EXT.ult_queen=()=>{
    const c=player,p=aim(25),id=key(c,'queen'),q=A.tool('bee',color(c));q.scale.setScalar(8);q.position.set(p.x,(p.y||0)+2,p.z);scene.add(q);
    const edge=outline(p.x,(p.y||0)+.08,p.z,18,color(c)),o=shootable(id,c,{x:p.x,y:(p.y||0)+2,z:p.z},q,120,1.05);
    let cd=.75;
    A.lifecycle(12,(t,dt)=>{
      if(o.broken)return false;
      q.position.y=(p.y||0)+2+Math.sin(t*3)*.18;
      for(const m of q.children)if(m.userData.wing)m.rotation.z=m.userData.wing*(.2+Math.sin(t*30)*.5);
      if((cd-=dt)>0)return;cd+=1.5;
      const target=foes(c).filter(a=>near(a,p,18)&&!rayBlocked(p.x,(p.y||0)+2,p.z,a.pos.x,(a.y||0)+1.1,a.pos.z))
        .sort((a,b)=>distance(a.pos,p)-distance(b.pos,p)||String(a.id).localeCompare(String(b.id)))[0];
      if(!target)return;
      const b=A.tool('bee',color(c),'E'),goal=point(target),from=q.position.clone();b.scale.setScalar(1.4);b.position.copy(from);scene.add(b);
      let struck=false;
      A.lifecycle(.6,(u)=>{
        if(o.broken)return false;const k=u/.6,previous=b.position.clone();b.position.set(from.x+(goal.x-from.x)*k,from.y+(goal.y-from.y)*k+Math.sin(k*Math.PI),from.z+(goal.z-from.z)*k);
        if(rayBlocked(previous.x,previous.y,previous.z,b.position.x,b.position.y,b.position.z))return false;
        if(k>=1&&!struck){struck=true;if(target.alive&&distance(target.pos,goal)<1.8&&Math.abs((target.y||0)+1.2-goal.y)<2&&!rayBlocked(from.x,from.y,from.z,target.pos.x,(target.y||0)+1.2,target.pos.z))hit(target,18,c);}
      },()=>A.dispose(b),c);
    },()=>{o.remove();A.dispose(edge);},c);
  };

  updateDef('x_ult_jungle','밀림 결속','조준 지점 16m 안 적을 둘씩 덩굴로 연결한다(10초). 8m보다 멀어지면 서로 끌려온다. 연결 씨앗 체력 60을 쏘면 풀린다. 한 명이면 씨앗 주변 6m에 결속된다.');
  CAST_EXT.x_ult_jungle=()=>{
    const c=player,p=aim(30),targets=foes(c).filter(a=>near(a,p,16)).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    if(!targets.length)return refund(c);
    for(let i=0;i<targets.length;i+=2){
      const a=targets[i],b=targets[i+1],mid={x:b?(a.pos.x+b.pos.x)/2:a.pos.x,z:b?(a.pos.z+b.pos.z)/2:a.pos.z,y:((a.y||0)+(b?b.y||0:a.y||0))/2+.7};
      const root=A.tool('vine',color(c));root.scale.setScalar(5);root.position.set(mid.x,mid.y,mid.z);scene.add(root);
      const o=shootable(key(c,'vine'+i),c,mid,root,60,.65),segments=A.budget().segments,wire=A.line(color(c),segments+1);scene.add(wire);
      A.lifecycle(10,(t,dt)=>{
        if(o.broken||!a.alive||(b&&!b.alive))return false;
        const ap=point(a,.65),bp=b?point(b,.65):mid,grow=Math.min(1,t/.4),pts=[];
        if(b){mid.x=(ap.x+bp.x)/2;mid.z=(ap.z+bp.z)/2;mid.y=(ap.y+bp.y)/2-.1;root.position.set(mid.x,mid.y,mid.z);Object.assign(o.shot,{x:mid.x,y:mid.y,z:mid.z});}
        for(let j=0;j<=segments;j++){const k=j/segments,x=ap.x+(bp.x-ap.x)*k,y=ap.y+(bp.y-ap.y)*k-.3*Math.sin(k*Math.PI),z=ap.z+(bp.z-ap.z)*k;pts.push({x:mid.x+(x-mid.x)*grow,y:mid.y+(y-mid.y)*grow,z:mid.z+(z-mid.z)*grow});}
        A.setLine(wire,pts);root.scale.setScalar(5*grow);
        if(t<.4||!host())return;
        const end=b?b.pos:mid,dx=end.x-a.pos.x,dz=end.z-a.pos.z,L=Math.hypot(dx,dz),limit=b?8:6;
        wire.material.opacity=L>limit?.95:.45;
        if(L>limit){const n=Math.min((L-limit)/(b?2:1),dt*8);moveWithSlide(a.pos,dx/L*n,dz/L*n,a.y||0,.4);if(b)moveWithSlide(b.pos,-dx/L*n,-dz/L*n,b.y||0,.4);}
      },()=>{o.remove();A.dispose(wire);},c);
    }
  };

  updateDef('x_ult_soundwall','공명 음벽','10초간 반경 12m 음벽. 바깥에서 안으로 들어오는 일반 총격 피해를 50% 흡수한다. 흡수량 60마다 경계의 적을 밀어내는 공명파가 나간다. 능력 피해와 안쪽에서 쏜 총은 막지 못한다.');
  CAST_EXT.x_ult_soundwall=()=>{
    const c=player,f={kind:'sound',c,r:12,energy:0},g=new T.Group();scene.add(g);fields.add(f);
    const edge=outline(0,0,0,12,color(c));edge.removeFromParent();g.add(edge);
    const forks=[],n=3+A.budget().decor;for(let i=0;i<n;i++){const fork=A.tool('fork',color(c));fork.scale.setScalar(4);fork.position.set(Math.cos(i*Math.PI*2/n)*12,1,Math.sin(i*Math.PI*2/n)*12);g.add(fork);forks.push(fork);}
    A.lifecycle(10,(t)=>{g.position.set(c.pos.x,c.y||0,c.pos.z);forks.forEach((m,i)=>{if(i>=3+A.budget().decor)A.dispose(m);else m.rotation.z=Math.sin(t*8+i)*.05;});edge.material.opacity=.45+Math.min(1,f.energy/60)*.5;},()=>{fields.delete(f);A.dispose(g);},c);
  };
  const oldDamage=dealDamage;
  dealDamage=function(victim,damage,head,source){
    const cause=window.DAMAGE_CAUSE&&DAMAGE_CAUSE.get(),src=source&&source.pos?source:actorById(source);
    if(host()&&cause&&cause.kind==='gun'&&cause.gun!=='rpg'&&src&&victim&&src.team!==victim.team){
      for(const f of fields)if(f.kind==='sound'&&f.c.alive&&victim.team===f.c.team&&near(victim,f.c.pos,f.r)&&!near(src,f.c.pos,f.r)){
        f.energy+=damage*.5;damage*=.5;
        if(f.energy>=60){
          f.energy-=60;fxRing(f.c.pos.x,f.c.pos.z,16,0x80deea,.55);send({k:'soundpulse',a:f.c.id});
          for(const e of foes(f.c)){const d=distance(e.pos,f.c.pos);if(d>=10&&d<=16){const dx=e.pos.x-f.c.pos.x,dz=e.pos.z-f.c.pos.z;moveWithSlide(e.pos,dx/(d||1)*2,dz/(d||1)*2,e.y||0,.4);}}
        }
        break; // Overlapping allied sound walls never multiply absorption.
      }
    }
    return oldDamage.call(this,victim,damage,head,source);
  };

  updateDef('x_ult_fullmoon','달빛 은폐','내 위치 반경 16m에 8초간 달빛을 펼친다. 안의 아군은 위치 탐지가 지워지고 새 탐지에도 표시되지 않는다. 모습은 숨기지 않으므로 직접 시야와 사격으로 대응할 수 있다.');
  CAST_EXT.x_ult_fullmoon=()=>{
    const c=player,p={x:c.pos.x,z:c.pos.z,y:c.y||0},f={kind:'moon',c,p,r:16},moon=A.tool('crescent',color(c));moon.scale.setScalar(22);moon.position.set(p.x,p.y+12,p.z);scene.add(moon);
    const edge=outline(p.x,p.y+.08,p.z,16,color(c));fields.add(f);
    A.lifecycle(8,(t)=>{
      moon.rotation.z=Math.sin(t*.4)*.08;
      for(const a of allies(c))if(near(a,p,16))a.revealed=0;
    },()=>{fields.delete(f);A.dispose(moon);A.dispose(edge);},c);
  };
  const concealed=a=>a&&[...fields].some(f=>f.kind==='moon'&&f.c.alive&&a.team===f.c.team&&near(a,f.p,f.r));
  const oldStatus=statusOn;
  statusOn=function(a,k,t){if(k==='revealed'&&concealed(a)){a.revealed=0;return;}return oldStatus.apply(this,arguments);};
  const oldStep=step;
  step=function(){const r=oldStep.apply(this,arguments);if(fields.size)for(const a of world.actors||[])if(concealed(a))a.revealed=0;return r;};
  const oldSnapshot=buildSnapshot;
  buildSnapshot=function(){if(fields.size)for(const a of world.actors||[])if(concealed(a))a.revealed=0;return oldSnapshot.apply(this,arguments);};

  updateDef('x_ult_skyhunter','매의 급강하','10초간 매가 선회한다. 35m 안 보이는 적의 위치를 예고하고 0.8초 뒤 실제로 급강하한다(35 피해). 예고된 지점에서 벗어나면 피할 수 있다. 전체 탐지는 하지 않는다.');
  CAST_EXT.x_ult_skyhunter=()=>{
    const c=player,b=A.tool('bird',color(c));b.scale.setScalar(7);scene.add(b);
    let cd=.8,dive=null;
    A.lifecycle(10,(t,dt)=>{
      for(const m of b.children)if(m.userData.wing)m.rotation.z=m.userData.wing*(dive?.07:.2+Math.sin(t*16)*.45);
      if(!dive){
        b.position.set(c.pos.x+Math.cos(t)*6,(c.y||0)+12,c.pos.z+Math.sin(t)*6);b.rotation.y=-t;
        if((cd-=dt)>0)return;
        const e=foes(c).filter(a=>near(a,c.pos,35)&&visible(c,a)&&!rayBlocked(b.position.x,b.position.y,b.position.z,a.pos.x,(a.y||0)+.6,a.pos.z)).sort((a,b)=>distance(a.pos,c.pos)-distance(b.pos,c.pos))[0];
        if(!e){cd=.2;return;}
        const goal=point(e,.6),warn=outline(goal.x,(e.y||0)+.1,goal.z,1.8,color(c));
        dive={e,from:b.position.clone(),goal,t:0,warn,hit:false,recover:0};return;
      }
      const d=dive;
      if(d.hit){d.recover+=dt;b.position.copy(d.impact);b.position.y+=d.recover*20;if(d.recover>.45){dive=null;cd=1.1;b.rotation.x=0;}return;}
      d.t+=dt;const k=Math.min(1,d.t/.8),s=k*k,previous=b.position.clone();
      b.position.set(d.from.x+(d.goal.x-d.from.x)*s,d.from.y+(d.goal.y-d.from.y)*s,d.from.z+(d.goal.z-d.from.z)*s);b.rotation.x=-.6*k;
      d.warn.material.opacity=.3+.6*k;
      const blocked=collideXZ(b.position.x,b.position.z,b.position.y,.15)||rayBlocked(previous.x,previous.y,previous.z,b.position.x,b.position.y,b.position.z);
      if(blocked)b.position.copy(previous);
      if(k>=1||blocked){d.hit=true;d.impact=b.position.clone();if(!blocked&&d.e.alive&&distance(d.e.pos,d.goal)<1.8&&Math.abs((d.e.y||0)+.6-d.goal.y)<2&&!rayBlocked(d.from.x,d.from.y,d.from.z,d.goal.x,d.goal.y,d.goal.z))hit(d.e,35,c);A.dispose(d.warn);}
    },()=>{if(dive)A.dispose(dive.warn);A.dispose(b);},c);
  };

  updateDef('x_ult_garden_heal','생명의 정원','반경 12m 정원을 12초간 세운다. 총 180의 생명력을 다친 아군에게 0.5초마다 최대 12씩 공평하게 나누고 둔화·실명·뇌진탕·부패를 정화한다. 생명력이 소진되면 끝난다. 무적이나 부활은 주지 않는다.');
  CAST_EXT.x_ult_garden_heal=()=>{
    const c=player,p={x:c.pos.x,z:c.pos.z,y:c.y||0},id=key(c,'garden'),g=A.tool('lotus',color(c));g.scale.setScalar(12);g.position.set(p.x,p.y+1.5,p.z);scene.add(g);
    const edge=outline(p.x,p.y+.07,p.z,12,color(c)),o={pool:180};objects.set(id,o);let cd=.5,offset=0;
    A.lifecycle(12,(t,dt)=>{
      g.rotation.y=t*.4;g.scale.setScalar(12*Math.cbrt(Math.max(.01,o.pool/180)));
      if(o.pool<=0)return false;
      if(!host()||(cd-=dt)>0)return;cd+=.5;
      const list=allies(c).filter(a=>near(a,p,12)).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
      if(!list.length)return;
      const clean=[];
      for(let i=0;i<list.length;i++){
        const a=list[(i+offset)%list.length],n=Math.min(12,Math.max(0,100-a.hp),o.pool);a.hp+=n;o.pool-=n;
        if(['blind','concuss','slowT','root','decayT'].some(k=>a[k]>0))clean.push(a.id);
        // Restore temporary decay once, before clearing its bookkeeping.
        if(a.decayAmt>0)a.hp=Math.min(100,a.hp+a.decayAmt);
        for(const k of ['blind','concuss','slowT','root','decayT','decayAmt'])a[k]=0;a.slow=1;
      }
      offset=(offset+1)%list.length;send({k:'pool',id,n:o.pool});if(clean.length)send({k:'cleanse',a:clean});
    },()=>{objects.delete(id);A.dispose(g);A.dispose(edge);},c);
  };
  // The bow's identity is its three penetrating shots; leave global tracking to 무영.
  updateDef('ult_snipe','응시','12초간 빛의 활 3발을 든다. 벽과 적을 모두 꿰뚫는다(몸 130·머리 200). 전역 위치 탐지는 하지 않는다.');
  CAST_EXT.ult_snipe=d=>startUltW(player,'bow',d);
  const oldClear=abilClear;
  abilClear=function(){const r=oldClear.apply(this,arguments);fields.clear();objects.clear();return r;};
  window.ABILITY_ULTIMATES=Object.freeze({fields:()=>[...fields].map(f=>({kind:f.kind,owner:f.c.id,energy:f.energy})),objects:()=>[...objects].map(([id,o])=>({id,broken:o.broken,pool:o.pool})),concealed});
})();

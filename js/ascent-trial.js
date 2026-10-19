/* Public map selection; terrain assets load only when this map is selected. */
(() => {
  'use strict';
  const trial=new URLSearchParams(location.search).get('ascent-trial')==='1';
  const KEY='ascent_trial', S=window.ASCENT_TRIAL={status:'idle',active:false,meshes:[],meta:null};
  const panel=document.createElement('section');panel.id='ascent-trial';panel.setAttribute('aria-label','마크X발로 불러오기');
  panel.style.cssText='position:fixed;left:16px;bottom:18px;z-index:10020;max-width:380px;padding:18px;background:#101c29f2;color:#eef6ff;border:1px solid #64b8b0;border-radius:12px;font:14px/1.6 sans-serif;box-shadow:0 8px 32px #0008';
  const title=document.createElement('strong');title.textContent='마크X발로';
  const msg=document.createElement('p');msg.setAttribute('role','status');msg.textContent='원본 지형을 준비하는 중…';msg.style.margin='8px 0';
  const start=document.createElement('button');start.textContent='이 맵으로 연습 시작';start.disabled=true;start.className='btn';
  const exit=document.createElement('a');exit.href='./play.html';exit.textContent='기존 게임으로';exit.style.cssText='color:#a8dcd6;margin-left:12px';
  panel.append(title,msg,start,exit);panel.hidden=!trial;document.body.append(panel);
  MAPS[KEY]={...MAPS.glacier,key:KEY,name:'마크X발로',size:5,walls:[],graphicsStatic:true};
  const entry={key:KEY,name:'마크X발로',size:5};
  (window.MAP_EXTRA||=[]).push(entry);
  if(window.POGU){if(!POGU.pool.includes(KEY))POGU.pool.push(KEY);POGU.setPool();}else MAP_LIST.push(entry);
  let pending=null,startRevision=0,loadRevision=0;
  let material, glassMaterial, atlasTexture, palette, buffer, navHeight, navEdges, previousNav=null, previousCell;
  const renderAssets=new Map(),assetLoads=new Map();let graphicsRevision=0,renderProfile=null;
  const profileFor=mode=>mode==='mobile'?'mobile':'original';
  const flows=new Map();
  const on=()=>S.active&&CUR_MAP_KEY===KEY;
  const sourcePoint=(x,z)=>({x:(x-S.meta.sourceCropMin[0]-S.meta.dimensions[0]/2)*S.meta.scale,z:(z-S.meta.sourceCropMin[2]-S.meta.dimensions[2]/2)*S.meta.scale});
  function nearby(x,z,r=PR) {
    if (CHASH.dirty||!CHASH.buckets) chashBuild();
    const found=new Set(), out=[];
    for(let iz=Math.max(0,Math.floor((z-r-CHASH.minZ)/CHASH.cell));iz<=Math.min(CHASH.rows-1,Math.floor((z+r-CHASH.minZ)/CHASH.cell));iz++)
      for(let ix=Math.max(0,Math.floor((x-r-CHASH.minX)/CHASH.cell));ix<=Math.min(CHASH.cols-1,Math.floor((x+r-CHASH.minX)/CHASH.cell));ix++)
        for(const c of CHASH.buckets[iz*CHASH.cols+ix]||[]) if(!found.has(c)) { found.add(c);out.push(c); }
    return out;
  }
  S.nearby=nearby;
  // Use the same support footprint and step ceiling as player movement. A tiny
  // point ray falls through slab seams/ledge centers that still support a body.
  S.groundY=(x,z,reference=player.y||0)=>groundAt(x,z,reference);
  function surface(x,z,ceiling=19,r=PR) {
    const candidates=nearby(x,z,r).filter(c=>c.h<=ceiling&&x+r>c.minX&&x-r<c.maxX&&z+r>c.minZ&&z-r<c.maxZ).sort((a,b)=>Math.abs(a.h-7.5)-Math.abs(b.h-7.5));
    for(const c of candidates) if(!collideXZ(x,z,c.h+.02,r)) return c.h;
    return NaN;
  }
  const oldGround=groundAt;
  S.standAt=(x,z)=>{const p=safe({x,z});return Math.hypot(p.x-x,p.z-z)<=8&&!collideXZ(p.x,p.z,p.y,PR)?p:null;};
  groundAt=function(x,z,y) {
    if(!on()) return oldGround.apply(this,arguments);
    let top=0;
    for(const c of nearby(x,z)) if(x>c.minX-PR&&x<c.maxX+PR&&z>c.minZ-PR&&z<c.maxZ+PR&&c.h<=y+STEP_H&&c.h>top) top=c.h;
    return top;
  };
  function rayBox(c,ox,oy,oz,dx,dy,dz,max) {
    let lo=0,hi=max;
    for(const [p,d,min,max] of [[ox,dx,c.minX,c.maxX],[oy,dy,c.y0||0,c.h],[oz,dz,c.minZ,c.maxZ]]) {
      if(Math.abs(d)<1e-9) {if(p<=min||p>=max)return Infinity;continue;}
      let a=(min-p)/d,b=(max-p)/d;if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return Infinity;
    }
    return lo;
  }
  S.rayT=function(ox,oy,oz,dx,dy,dz,max,skip) {
    if(CHASH.dirty)chashBuild();
    let best=max;
    // Visit every hash bucket traversed by the segment, then exact 3D boxes.
    const cell=CHASH.cell, seen=new Set();
    let ix=Math.floor((ox-CHASH.minX)/cell),iz=Math.floor((oz-CHASH.minZ)/cell);
    const sx=Math.sign(dx),sz=Math.sign(dz),tx=dx?cell/Math.abs(dx):Infinity,tz=dz?cell/Math.abs(dz):Infinity;
    let nx=dx?((CHASH.minX+(ix+(sx>0?1:0))*cell)-ox)/dx:Infinity,nz=dz?((CHASH.minZ+(iz+(sz>0?1:0))*cell)-oz)/dz:Infinity;
    let t=0;
    for(let steps=0;steps<4096&&t<=best;steps++) {
      if(ix>=0&&iz>=0&&ix<CHASH.cols&&iz<CHASH.rows) for(const c of CHASH.buckets[iz*CHASH.cols+ix]||[]) {
        if(c===skip||seen.has(c))continue;seen.add(c);best=Math.min(best,rayBox(c,ox,oy,oz,dx,dy,dz,best));
      }
      if(nx<nz){t=nx;nx+=tx;ix+=sx;}else{t=nz;nz+=tz;iz+=sz;}
      if(!Number.isFinite(t))break;
    }
    if(dy<0)best=Math.min(best,-oy/dy);
    return best;
  };
  const oldAim=aimPoint;
  aimPoint=function(distance){
    if(!on())return oldAim.apply(this,arguments);
    const max=distance*(window.AB_D||1),origin=new T.Vector3(player.pos.x,(player.y||0)+eyeHeight(),player.pos.z);
    const direction=new T.Vector3(-Math.sin(player.yaw)*Math.cos(player.pitch),Math.sin(player.pitch),-Math.cos(player.yaw)*Math.cos(player.pitch));
    const wall=S.rayT(origin.x,origin.y,origin.z,direction.x,direction.y,direction.z,max);
    let nearest=wall,target=null;
    for(const actor of otherFighters())if(actor.alive&&actor.team!==player.team){
      const t=raySphereT(origin,direction,actor.pos.x,(actor.y||0)+1,actor.pos.z,.9);
      if(t>=0&&t<nearest){nearest=t;target=actor;}
    }
    if(target)return{x:target.pos.x,y:target.y||0,z:target.pos.z,hit:true,target};
    const point=origin.addScaledVector(direction,Math.max(0,nearest-.025));
    return{x:point.x,y:Math.max(0,point.y),z:point.z,hit:wall<max};
  };
  const oldRay=rayBlocked;
  rayBlocked=function(x,y,z,X,Y,Z,skip) {
    if(!on())return oldRay.apply(this,arguments);
    if(S.rayT(x,y,z,X-x,Y-y,Z-z,1,skip)<1)return true;
    for(const m of world.smokes) if(m.blocksVision) {
      const n=Math.ceil(Math.hypot(X-x,Y-y,Z-z)/.8);
      for(let i=1;i<n;i++){const t=i/n;if(y+(Y-y)*t<m.y+m.r&&dist2(x+(X-x)*t,z+(Z-z)*t,m.x,m.z)<m.r*m.r)return true;}
    }
    return false;
  };
  function clearMeshes() {
    for(const m of S.meshes){scene.remove(m);m.geometry.dispose();}
    S.meshes.length=0;
    if(material){material.dispose();material=null;}
    if(glassMaterial){glassMaterial.dispose();glassMaterial=null;}
    if(atlasTexture)atlasTexture.dispose(); // Retain decoded pixels, release the inactive GPU upload.
    renderProfile=null;
  }
  function clear() {
    graphicsRevision++;clearMeshes();S.graphicsMessage='';S.graphicsStatus='idle';
    if(S.active)floor.visible=true;
    S.active=false;navHeight=null;navEdges=null;S.nav=null;flows.clear();
    if(previousNav){NAV.length=0;NAV.push(...previousNav);GRID.cell=previousCell;previousNav=null;}
  }
  const oldClear=clearMapGeometry;
  clearMapGeometry=function(){clear();return oldClear.apply(this,arguments);};
  function geometry(asset,collisions=false) {
    buffer=asset.buffer;palette=asset.palette;atlasTexture=asset.texture;atlasTexture.needsUpdate=true;
    const mobile=asset.profile==='mobile',chunkSize=mobile?64:40;
    const d=new DataView(buffer),n=d.getUint32(4,true),count=d.getUint32(8,true),s=S.meta.scale/16,dim=S.meta.dimensions;
    const origin=[-dim[0]*S.meta.scale/2,0,-dim[2]*S.meta.scale/2],chunks=new Map();
    function atlasMaterial(transparent){
      const width=palette.width,height=palette.height;
      const m=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide,map:atlasTexture,alphaTest:.05,transparent,depthWrite:!transparent});
      m.customProgramCacheKey=()=>`ascent-atlas-rect-v1:${width}:${height}`;
      m.onBeforeCompile=shader=>{
        shader.vertexShader='attribute vec4 atlasRect; varying vec4 vAtlasRect;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvAtlasRect = atlasRect;');
        shader.fragmentShader='varying vec4 vAtlasRect;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`vec4 sampledDiffuseColor = texture2D(map, (vAtlasRect.xy + fract(vMapUv) * vAtlasRect.zw) / vec2(${width.toFixed(1)}, ${height.toFixed(1)})); diffuseColor *= sampledDiffuseColor;`);
      };
      return m;
    }
    material=palette?atlasMaterial(false):new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});
    glassMaterial=palette?atlasMaterial(true):null;
    for(let i=0;i<n;i++) {
      const p=16+i*24, q=Array.from({length:9},(_,a)=>(a<3?d.getUint16(p+a*2,true):d.getInt16(p+a*2,true))*s),tile=palette?d.getUint16(p+21,true):0,info=palette?.tiles[tile],transparent=!!info?.transparent,k=Math.floor(q[0]/chunkSize)+','+Math.floor(q[2]/chunkSize)+','+Math.floor(q[1]/chunkSize)+','+transparent;
      if(!chunks.has(k))chunks.set(k,{pos:[],normal:[],color:[],uv:[],atlas:[],indices:[],transparent});
      const c=chunks.get(k),base=c.pos.length/3,u=q.slice(3,6),v=q.slice(6,9),normal=new T.Vector3(...u).cross(new T.Vector3(...v)).normalize();
      const color=new T.Color((d.getUint8(p+18)<<16)|(d.getUint8(p+19)<<8)|d.getUint8(p+20));
      for(const [a,b] of [[0,0],[1,0],[1,1],[0,1]]) {
        for(let j=0;j<3;j++)c.pos.push(q[j]+a*u[j]+b*v[j]+origin[j]);
        c.normal.push(normal.x,normal.y,normal.z);c.color.push(color.r,color.g,color.b);
        if(palette){
          const pos=q.slice(0,3).map((x,j)=>(x+a*u[j]+b*v[j])/S.meta.scale),n=normal;
          let uv=Math.abs(n.y)>.9?[pos[0],n.y>0?-pos[2]:pos[2]]:Math.abs(n.x)>.9?[n.x>0?-pos[2]:pos[2],pos[1]]:[n.z>0?pos[0]:-pos[0],pos[1]];
          if(Math.abs(n.x)>.1&&Math.abs(n.z)>.1)uv=[a,b];
          c.uv.push(...uv);
          const size=info.size||palette.tileSize,pad=info.padding??palette.padding,x=info.x??(tile%palette.columns)*palette.cell,y=info.y??Math.floor(tile/palette.columns)*palette.cell;
          c.atlas.push(x+pad,palette.height-y-pad-size,size,size);
        }
      }
      c.indices.push(base,base+1,base+2,base,base+2,base+3);
    }
    for(const c of chunks.values()) {
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(c.pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(c.normal,3));g.setAttribute('color',new T.Float32BufferAttribute(c.color,3));g.setIndex(c.indices);g.computeBoundingSphere();
      if(palette){g.setAttribute('uv',new T.Float32BufferAttribute(c.uv,2));g.setAttribute('atlasRect',new T.Uint16BufferAttribute(c.atlas,4));}
      const mesh=new T.Mesh(g,c.transparent?glassMaterial:material);mesh.userData.ascent=true;scene.add(mesh);S.meshes.push(mesh);
    }
    renderProfile=asset.profile;S.renderStats={profile:renderProfile,quads:n,meshes:S.meshes.length,atlasWidth:palette?.width,atlasHeight:palette?.height,geometryBytes:S.meshes.reduce((sum,m)=>sum+m.geometry.index.array.byteLength+Object.values(m.geometry.attributes).reduce((a,b)=>a+b.array.byteLength,0),0)};
    if(!collisions)return;
    let p=16+n*24;
    for(let i=0;i<count;i++,p+=12) {
      const b=Array.from({length:6},(_,a)=>d.getUint16(p+a*2,true)*s+origin[a%3]);
      COLLIDERS.push({minX:b[0],y0:b[1],minZ:b[2],maxX:b[3],h:b[4],maxZ:b[5],mesh:null,hp:Infinity,destructible:false,temp:false,ascent:true});
    }
    CHASH.dirty=true;chashBuild();
  }
  function buildNav() {
    GRID.cell=S.meta.scale/2;GRID.minX=MAP.bounds.minX;GRID.minZ=MAP.bounds.minZ;
    GRID.cols=Math.ceil((MAP.bounds.maxX-GRID.minX)/GRID.cell);GRID.rows=Math.ceil((MAP.bounds.maxZ-GRID.minZ)/GRID.cell);
    GRID.walk=new Uint8Array(GRID.cols*GRID.rows);navHeight=new Float32Array(GRID.walk.length);navHeight.fill(NaN);
    for(let z=0;z<GRID.rows;z++)for(let x=0;x<GRID.cols;x++) {
      const p=cellCenter(x,z),h=surface(p.x,p.z,19,.8),i=z*GRID.cols+x;
      if(Number.isFinite(h)){navHeight[i]=h;GRID.walk[i]=1;}
    }
    // Cardinal links sampled with the actual body movement/step solver.
    navEdges=new Uint8Array(GRID.walk.length);
    for(let z=0;z<GRID.rows;z++)for(let x=0;x<GRID.cols;x++) {
      const i=z*GRID.cols+x;if(!GRID.walk[i])continue;
      const p=cellCenter(x,z);
      for(const [dx,dz,bit] of [[1,0,1],[-1,0,2],[0,1,4],[0,-1,8]]) {
        const X=x+dx,Z=z+dz,j=Z*GRID.cols+X;if(X<0||Z<0||X>=GRID.cols||Z>=GRID.rows||!GRID.walk[j])continue;
        if(navHeight[j]-navHeight[i]>STEP_H||navHeight[i]-navHeight[j]>2)continue;
        const pos={x:p.x,z:p.z},y=moveWithSlide(pos,dx*GRID.cell,dz*GRID.cell,navHeight[i],PR);
        if(Math.hypot(pos.x-p.x-dx*GRID.cell,pos.z-p.z-dz*GRID.cell)<.01&&y-navHeight[i]<=STEP_H+.001)navEdges[i]|=bit;
      }
    }
    // Keep match spawns and objectives on the largest connected street network.
    const component=new Int32Array(GRID.walk.length);component.fill(-1);const groups=[];
    for(let begin=0;begin<GRID.walk.length;begin++) {
      if(!GRID.walk[begin]||component[begin]>=0)continue;
      const id=groups.length,q=[begin];component[begin]=id;
      for(let head=0;head<q.length;head++)for(const [step,bit,reverse] of [[1,1,2],[-1,2,1],[GRID.cols,4,8],[-GRID.cols,8,4]]){
        const i=q[head],j=i+step;if((navEdges[i]&bit)&&(navEdges[j]&reverse)&&component[j]<0){component[j]=id;q.push(j);}
      }
      groups.push(q);
    }
    const main=groups.reduce((a,b)=>a.length>b.length?a:b,[]);
    S.nav={height:navHeight,edges:navEdges,component,main,groups:groups.map(a=>a.length).sort((a,b)=>b-a)};
    for(const p of [MAP.attackSpawn,MAP.defendSpawn,...MAP.sites,...Object.values(MAP.nodes)]) {
      let best=null,d=Infinity;
      for(const i of main){const c=cellCenter(i%GRID.cols,Math.floor(i/GRID.cols)),dist=(p.x-c.x)**2+(p.z-c.z)**2;if(dist<d){d=dist;best={...c,y:navHeight[i]};}}
      if(best)Object.assign(p,best);
    }
  }
  const oldFind=findPath;
  findPath=function(x,z,X,Z) {
    if(!on())return oldFind.apply(this,arguments);
    const [sx,sz]=nearestWalkable(gx(x),gz(z)),[ex,ez]=nearestWalkable(gx(X),gz(Z)),begin=sz*GRID.cols+sx,end=ez*GRID.cols+ex;
    if(!GRID.walk[begin]||!GRID.walk[end])return [];
    if(!flows.has(end)){
      const q=[end],next=new Int32Array(GRID.walk.length);next.fill(-1);next[end]=end;
      for(let head=0;head<q.length;head++) {
        const i=q[head],cx=i%GRID.cols,cz=Math.floor(i/GRID.cols);
        for(const [dx,dz,bit] of [[1,0,2],[-1,0,1],[0,1,8],[0,-1,4]]) {
          const x=cx+dx,z=cz+dz,j=z*GRID.cols+x;
          if(x>=0&&z>=0&&x<GRID.cols&&z<GRID.rows&&(navEdges[j]&bit)&&next[j]<0){next[j]=i;q.push(j);}
        }
      }
      if(flows.size>=12)flows.delete(flows.keys().next().value);flows.set(end,next);
    }
    const next=flows.get(end);if(next[begin]<0)return [];
    const path=[];for(let i=begin;i!==end;){i=next[i];path.push({...cellCenter(i%GRID.cols,Math.floor(i/GRID.cols)),y:navHeight[i]});}
    return path;
  };
  const oldNext=navNext;
  navNext=function(a,x,z,dt) {
    if(!on())return oldNext.apply(this,arguments);
    const n=a.ai;n.repathCd2=(n.repathCd2||0)-dt;
    if(!n.path||n.repathCd2<=0||!n.pathGoal||Math.hypot(n.pathGoal.x-x,n.pathGoal.z-z)>3){
      n.path=findPath(a.pos.x,a.pos.z,x,z);n.pathIdx=0;n.pathGoal={x,z};n.repathCd2=2;
    }
    while(n.pathIdx<n.path.length&&Math.hypot(a.pos.x-n.path[n.pathIdx].x,a.pos.z-n.path[n.pathIdx].z)<.3)n.pathIdx++;
    return n.path[n.pathIdx]||{x,z};
  };
  const oldSteer=steerToward;
  steerToward=function(a,x,z,dt,rate) {
    if(!on())return oldSteer.apply(this,arguments);
    a.yaw=Math.atan2(-(x-a.pos.x),-(z-a.pos.z));return 0;
  };
  function safe(p,index=0) {
    if(S.nav){
      let best=null,d=Infinity;
      for(const i of S.nav.main){const c=cellCenter(i%GRID.cols,Math.floor(i/GRID.cols)),dist=(p.x-c.x)**2+(p.z-c.z)**2;if(dist<d&&!collideXZ(c.x,c.z,navHeight[i]+.02,PR+.1)){d=dist;best={...c,y:navHeight[i]};}}
      if(best)return best;
    }
    for(let r=0;r<20;r+=.625)for(let a=0;a<(r?24:1);a++) {
      const x=p.x+Math.cos(a*Math.PI/12+index)*r,z=p.z+Math.sin(a*Math.PI/12+index)*r,y=surface(x,z);
      if(Number.isFinite(y)&&!collideXZ(x,z,y+.02,PR+.15))return{x,z,y};
    }
    throw Error('안전한 시작 위치를 찾지 못했어');
  }
  const oldSpawn=spawnPointFor;
  spawnPointFor=function(team,index) {
    if(!on())return oldSpawn.apply(this,arguments);
    const p=team==='atk'?MAP.attackSpawn:MAP.defendSpawn,other=team==='atk'?MAP.defendSpawn:MAP.attackSpawn;
    const yaw=Math.atan2(-(other.x-p.x),-(other.z-p.z));
    return {...safe({x:p.x+Math.cos(yaw)*(index-2)*3,z:p.z-Math.sin(yaw)*(index-2)*3},index),yaw};
  };
  function placeActors() {
    const counts={atk:0,def:0};
    for(const a of world.actors){const p=spawnPointFor(a.team,counts[a.team]++);a.pos.set(p.x,p.y,p.z);a.y=p.y;a.vy=0;a.onGround=true;syncActorModel(a);}
  }
  const oldReset=resetActorsForRound;
  resetActorsForRound=function(){const r=oldReset.apply(this,arguments);if(on())placeActors();return r;};
  const oldRespawn=respawnAll;
  respawnAll=function(){const r=oldRespawn.apply(this,arguments);if(on())placeActors();return r;};
  const oldRound=startRound;
  startRound=function(){const r=oldRound.apply(this,arguments);if(on())placeActors();return r;};
  const oldCreate=createActor;
  createActor=function(){const a=oldCreate.apply(this,arguments);if(on()){const p=safe(a.pos);a.y=p.y;a.pos.y=p.y;}return a;};
  const oldLoad=loadMap;
  loadMap=function(key) {
    const revision=++loadRevision;
    if(key!==KEY)return oldLoad.apply(this,arguments);
    if(S.status!=='ready'){
      S.ensure().then(ok=>{if(ok&&revision===loadRevision)loadMap(KEY);});return false;
    }
    clearMapGeometry();previousNav=NAV.slice();previousCell=GRID.cell;CUR_MAP_KEY=KEY;S.active=true;
    applyMapData(MAPS[KEY]);THEME.cur=THEMES.glacier;THEME.key='glacier';applyMapMood(MAPS[KEY]);
    // Neutral daylight keeps vanilla stone/wool colors intact rather than
    // applying another map's blue cinematic tint to the supplied blocks.
    POST.tint=[1,1,1];POST.lift=[0,0,0];POST.sat=1;POST.contrast=1;POST.vignette=.12;
    hemi.color.setHex(0xffffff);hemi.groundColor.setHex(0xbcbcbc);hemi.intensity=.9;
    sun.color.setHex(0xfff4df);sun.intensity=1.1;renderer.toneMappingExposure=1;
    geometry(renderAssets.get(profileFor(SETTINGS.quality))||renderAssets.values().next().value,true);floor.visible=false;buildNav();
    S.applyGraphics(SETTINGS.quality);
    NAV.length=0;NAV.push(...Object.values(MAP.nodes));
    if(VM.root&&!VM.root.parent)scene.add(VM.root);
    if(world.spike.mesh&&!world.spike.mesh.parent)scene.add(world.spike.mesh);
    S.loads=(S.loads||0)+1;S.walkable=GRID.walk.reduce((a,b)=>a+b,0);
    return true;
  };
  const oldMove=simMove;
  simMove=function(a,dt) {
    const oldY=a.y;
    const r=oldMove.apply(this,arguments);
    if(on()&&a.y>oldY)for(const c of nearby(a.pos.x,a.pos.z)){
      if(c.y0>0&&oldY+2.3<=c.y0+.001&&a.y+2.3>c.y0&&a.pos.x+PR>c.minX&&a.pos.x-PR<c.maxX&&a.pos.z+PR>c.minZ&&a.pos.z-PR<c.maxZ){a.y=Math.max(oldY,c.y0-2.3);a.vy=0;}
    }
    if(on()&&a.alive&&a.y<.1&&!Number.isFinite(surface(a.pos.x,a.pos.z,.8,.1))){const p=spawnPointFor(a.team,0);a.pos.set(p.x,p.y,p.z);a.y=p.y;a.vy=0;}
    return r;
  };
  const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  async function loadAsset(profile){
    if(renderAssets.has(profile))return renderAssets.get(profile);
    if(assetLoads.has(profile))return assetLoads.get(profile);
    const promise=(async()=>{
      const base='./assets/maps/ascent/'+(profile==='mobile'?'mobile/':''),version=profile==='mobile'?'mobile1':'vanilla2';
      const mr=profile==='mobile'?await fetch(base+'manifest.json?v='+version):null;
      if(mr&&!mr.ok)throw Error('휴대폰용 맵 목록을 불러오지 못했어');
      const meta=mr?await mr.json():S.meta;
      if(profile==='mobile'&&(meta.sourceGeometrySha256!==S.meta.geometrySha256||meta.colliders!==S.meta.colliders||meta.scale!==S.meta.scale||JSON.stringify(meta.dimensions)!==JSON.stringify(S.meta.dimensions)))throw Error('휴대폰용 맵 버전이 맞지 않아');
      const br=await fetch(base+'geometry.bin?v='+version);if(!br.ok)throw Error('지형 파일을 불러오지 못했어');
      const bytes=await br.arrayBuffer(),v=new DataView(bytes);
      if(bytes.byteLength<16||bytes.byteLength>64000000||![0x41534331,0x41534332].includes(v.getUint32(0,false))||![1,2].includes(meta.version)||meta.quads!==v.getUint32(4,true)||meta.colliders!==v.getUint32(8,true)||bytes.byteLength!==16+meta.quads*24+meta.colliders*12)throw Error('지형 데이터가 맞지 않아');
      if(await sha(bytes)!==meta.geometrySha256)throw Error('지형 파일 검증에 실패했어');
      let palette=null,texture=null;
      if(meta.textures){
        const r=await fetch(base+meta.textures+'?v='+version);if(!r.ok)throw Error('블록 재질 목록 로딩 실패');palette=await r.json();
        const ar=await fetch(base+meta.atlas+'?v='+version);if(!ar.ok)throw Error('블록 텍스처 로딩 실패');const ab=await ar.arrayBuffer();
        if(await sha(ab)!==meta.atlasSha256)throw Error('블록 텍스처 검증 실패');
        const url=URL.createObjectURL(new Blob([ab],{type:'image/png'}));
        try{texture=await new T.TextureLoader().loadAsync(url);}finally{URL.revokeObjectURL(url);}
        texture.colorSpace=T.SRGBColorSpace;texture.magFilter=T.NearestFilter;
        // Atlas-wide mip levels blend unrelated tiles across seams. Keep
        // source pixels in detailed modes and use padded bilinear minification;
        // the light pack additionally reduces only opaque texture patterns.
        texture.minFilter=T.LinearFilter;texture.generateMipmaps=false;
        S.textureCount=palette.tiles.length;
      }
      const asset={profile,buffer:bytes,palette,texture};renderAssets.set(profile,asset);return asset;
    })().finally(()=>assetLoads.delete(profile));
    assetLoads.set(profile,promise);return promise;
  }
  S.applyGraphics=mode=>{
    const revision=++graphicsRevision,profile=profileFor(mode);
    if(!on())return Promise.resolve(false);
    if(profile===renderProfile){S.graphicsStatus='ready';S.graphicsMessage=profile==='mobile'?'휴대폰용 맵 · 선명도 유지':'';updateGfxLabel();return S.graphicsReady=Promise.resolve(true);}
    S.graphicsStatus='loading';S.graphicsMessage='맵 재질을 바꾸는 중…';updateGfxLabel();
    return S.graphicsReady=loadAsset(profile).then(asset=>{
      if(revision!==graphicsRevision||!on())return false;
      // Replace rendering only: keep collision hash, navigation, temporary
      // ability walls, actors and round state untouched during live switches.
      clearMeshes();geometry(asset);S.graphicsStatus='ready';S.graphicsMessage=profile==='mobile'?'휴대폰용 맵 · 선명도 유지':'';updateGfxLabel();return true;
    }).catch(()=>{
      if(revision===graphicsRevision&&on()){S.graphicsStatus='error';S.graphicsMessage='맵 재질 로딩 실패 · 모드를 다시 눌러 재시도';updateGfxLabel();}
      return false;
    });
  };
  async function load() {
    start.disabled=true;S.status='loading';msg.textContent='지형을 준비하는 중…';
    try {
      // Full-quality files keep their existing URLs; the separate mobile pack
      // is fetched only for mobile, and never replaces cached original assets.
      const mr=await fetch('./assets/maps/ascent/manifest.json?v=vanilla2');if(!mr.ok)throw Error('맵 목록을 불러오지 못했어');
      const meta=S.meta=await mr.json();
      await loadAsset(profileFor(SETTINGS.quality));
      MAPS[KEY]={graphicsStatic:true,
        key:KEY,name:'마크X발로',size:5,theme:'glacier',fog:.002,
        bounds:{minX:-meta.dimensions[0]*meta.scale/2,maxX:meta.dimensions[0]*meta.scale/2,minZ:-meta.dimensions[2]*meta.scale/2,maxZ:meta.dimensions[2]*meta.scale/2},
        attackSpawn:sourcePoint(95,193),defendSpawn:sourcePoint(175,55),
        sites:[{id:'A',label:'A 거점',...sourcePoint(220,177),r:6},{id:'B',label:'B 거점',...sourcePoint(105,70),r:6}],
        nodes:{atk:sourcePoint(95,193),mid:sourcePoint(180,125),A:sourcePoint(220,177),B:sourcePoint(105,70),def:sourcePoint(175,55)},walls:[],
      };
      S.status='ready';start.disabled=false;
      msg.textContent='마크X발로 준비 완료 · 원본 지형과 마인크래프트 기본 텍스처를 사용합니다.';
      if(!trial)panel.hidden=true;
      return true;
    }catch(e){S.status='error';msg.textContent=e.message;start.textContent='다시 불러오기';start.disabled=false;return false;}
  }
  S.ensure=()=>{
    if(S.status==='ready')return Promise.resolve(true);
    if(!pending){panel.hidden=false;pending=load().finally(()=>{pending=null;});}
    return pending;
  };
  function prepare(fn,args,key){
    const revision=++startRevision;
    if(key!==KEY||S.status==='ready')return fn.apply(null,args);
    const screen=fn===solo?document.getElementById('s-select'):fn===hostStart?document.getElementById('lobby'):null,visible=screen&&!screen.hidden;
    return S.ensure().then(ok=>{if(ok&&revision===startRevision&&room.map===KEY&&!(visible&&screen.hidden))return fn.apply(null,args);});
  }
  const solo=startGame,hostStart=hostStartMatch,clientStart=clientBeginMatch;
  startGame=function(){return prepare(solo,arguments,room.map);};
  hostStartMatch=function(){return prepare(hostStart,arguments,room.map);};
  clientBeginMatch=function(message){if(message.map===KEY)room.map=KEY;return prepare(clientStart,arguments,message.map);};
  const selectMaps=paintSelMaps,lobbyMaps=paintMaps;
  paintSelMaps=function(){const r=selectMaps.apply(this,arguments);if(room.map===KEY)S.ensure();return r;};
  paintMaps=function(snapshot){const r=lobbyMaps.apply(this,arguments);if(snapshot.map===KEY)S.ensure();return r;};
  start.onclick=async()=>{
    if(S.status==='error'){start.textContent='이 맵으로 연습 시작';await load();return;}
    start.disabled=true;msg.textContent='지형과 이동 경로를 만드는 중…';
    await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,30)));
    try{room.map=KEY;room.mode='std';await startGame(typeof picked!=='undefined'&&picked||AGENTS[0],true);closeShop();panel.hidden=true;S.started=true;}
    catch(e){msg.textContent=e.message;start.disabled=false;}
  };
  S.show=()=>{panel.hidden=false;};
  if(trial)S.ensure();
})();

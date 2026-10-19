// Seafle 0.1.0 client.h.a/d and vfx_gun: source UV atlas, kill sweep and 8.7s coat.
(function(root){
  'use strict';
  const clamp=n=>Math.max(0,Math.min(1,n));
  function trigger(s={},now=0){return {at:now,previous:s.at,strong:sample(s,now).hold>=.75};}
  function sample(s={},now=0){
    if(s.at==null)return {current:1,previous:1,hold:0,flame:0};
    const age=Math.max(0,now-s.at),hold=age<8.7?(s.strong?1:.6):age<9.03?.49*(1-(age-8.7)/.33):0;
    return {current:clamp(age/1.25),previous:s.previous==null?1:clamp((now-s.previous)/1.25),hold,flame:hold>=.75?1:hold>=.5?clamp((age-.25)/.2):2*hold};
  }
  const textures=['gunart_side','gunart_top','lick_attacker','lick_defender'];
  function pixels(image){const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(image,0,0);return {data:x.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height};}
  // Rasterize the native model's UV quads once, just as the original atlas builder does.
  function bake(geo,baseImage,maskImage,sideImage,topImage,attacker){
    const T=root.THREE,base=pixels(baseImage),mask=pixels(maskImage),side=pixels(sideImage),top=pixels(topImage),out=new Uint8Array(base.w*base.h*4),anchors=Array.from({length:128},()=>[-99,0]);
    const palettes=attacker?[[1049092,2491400,4458508,6819346,9707040,0xc45454],[9175046,12454924,15212052,16728104,16743520,16763060],[657932,0x16161a,0x24242a,0x36363e,0x50505a,8553614],[16766624,16480594]]:[[1313028,3019782,5383690,8405008,12085276,15244346],[9850378,13400088,15769640,16763974,16771712,16775880],[4870238,7370886,9871020,12370895,14409961,16185596],[0xfffcc4,16769656]];
    const rig=root.GECKO_FINISHER_RIG.build(geo,new T.MeshBasicMaterial());rig.updateMatrixWorld(true);
    rig.traverse(m=>{if(!m.isMesh)return;const p=m.geometry.attributes.position,u=m.geometry.attributes.uv,n=m.geometry.attributes.normal;
      for(let k=0;k<p.count;k+=6){
        const ids=[k,k+1,k+5],pts=ids.map(i=>new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld)),uv=ids.map(i=>[u.getX(i)*base.w,(1-u.getY(i))*base.h]);
        const normal=new T.Vector3().fromBufferAttribute(n,k).transformDirection(m.matrixWorld),isTop=Math.abs(normal.y)>.7,isSide=Math.abs(normal.z)>.7;
        const [a,b,c]=uv,dx=b[0]-a[0],dy=b[1]-a[1],ex=c[0]-a[0],ey=c[1]-a[1],det=dx*ey-ex*dy;if(Math.abs(det)<1e-6)continue;
        const fourth=[b[0]+c[0]-a[0],b[1]+c[1]-a[1]],xs=[a[0],b[0],c[0],fourth[0]],ys=[a[1],b[1],c[1],fourth[1]];
        for(let y=Math.max(0,Math.floor(Math.min(...ys)+.001));y<Math.min(base.h,Math.ceil(Math.max(...ys)-.001));y++)for(let x=Math.max(0,Math.floor(Math.min(...xs)+.001));x<Math.min(base.w,Math.ceil(Math.max(...xs)-.001));x++){
          const at=(y*base.w+x)*4;if(!base.data[at+3])continue;
          const vx=x+.5-a[0],vy=y+.5-a[1],s=(vx*ey-ex*vy)/det,t=(dx*vy-vx*dy)/det;
          const pos=pts[0].clone().addScaledVector(pts[1].clone().sub(pts[0]),s).addScaledVector(pts[2].clone().sub(pts[0]),t),f=-pos.x,h=pos.y,z=pos.z;
          const art=isTop?top:side,ax=Math.floor((f+22.75)*8),ay=Math.floor((isTop?2-z:5-h)*8),ai=(ay*art.w+ax)*4,valid=ax>=0&&ay>=0&&ax<art.w&&ay<art.h;
          const red=valid?art.data[ai]:0,green=valid?art.data[ai+1]:0,blue=valid?art.data[ai+2]:0;
          const color=(base.data[at]<<16)|(base.data[at+1]<<8)|base.data[at+2],eligible=palettes[0].includes(color)||palettes[1].includes(color)||palettes[3].includes(color)||(mask.data[at+3]>0&&!palettes[2].includes(color));
          const ks=eligible&&f>=-9.6&&f<=13&&h>=1.25?(red>=192?3:red>=64?2:1):0;
          if(ks&&isSide){const i=Math.floor((f+22.75)*2);if(i>=0&&i<128&&h>anchors[i][0])anchors[i]=[h,Math.abs(z)];}
          const lvl=Math.min(7,Math.round(green/255*7)),wisp=!attacker&&isSide&&palettes[2].includes(color)&&blue>=128&&f>-14&&f<16;
          const q=Math.floor((isTop?z:h)*2),r=Math.min(5,Math.round(Math.max(0,.6+.45*Math.sin(q*1.7)+.25*Math.sin(q*.83+1.3))/1.3*5))*.25;
          out.set([Math.max(0,Math.min(255,Math.round((f-r+22.75)/.25))),ks*64+lvl*8+(wisp?4:0),0,255],at);
        }
      }
    });
    rig.traverse(m=>{if(m.geometry)m.geometry.dispose();if(m.material)m.material.dispose();});
    const atlas=new T.DataTexture(out,base.w,base.h);atlas.flipY=true;atlas.minFilter=atlas.magFilter=T.NearestFilter;atlas.generateMipmaps=false;atlas.needsUpdate=true;
    return {atlas,anchors:anchors.flatMap(([y,z],i)=>y>-98?[[-22.75+(i+.5)/2,y,z]]:[])};
  }
  // Algebraically identical GLSL, with float bit decoding for WebGL 1 devices.
  const shader=`
uniform sampler2D phantomAtlas;
uniform vec4 phantomWave;
vec3 phHex(float c){return vec3(floor(c/65536.0),mod(floor(c/256.0),256.0),mod(c,256.0))/255.0;}
float phFront(float t){
 if(t<=.05)return mix(-26.,-22.75,t/.05);
 if(t<=.125)return mix(-22.75,-8.,(t-.05)/.075);
 if(t<=.208)return mix(-8.,5.,(t-.125)/.083);
 if(t<=.3)return mix(5.,13.,(t-.208)/.092);
 if(t<=.408)return mix(13.,24.,(t-.3)/.108);
 if(t<=.5)return mix(24.,33.,(t-.408)/.092);
 if(t<=.583)return mix(33.,41.5,(t-.5)/.083);
 return t<=.717?mix(41.5,52.,(t-.583)/.134):52.;
}
float phPass(float f){
 if(f<=-26.)return 0.;if(f<=-22.75)return mix(0.,.05,(f+26.)/3.25);
 if(f<=-8.)return mix(.05,.125,(f+22.75)/14.75);
 if(f<=5.)return mix(.125,.208,(f+8.)/13.);
 if(f<=13.)return mix(.208,.3,(f-5.)/8.);
 if(f<=24.)return mix(.3,.408,(f-13.)/11.);
 if(f<=33.)return mix(.408,.5,(f-24.)/9.);
 if(f<=41.5)return mix(.5,.583,(f-33.)/8.5);
 return f<=52.?mix(.583,.717,(f-41.5)/10.5):99.;
}
vec4 phSweep(float t,float fe,float lvl,float b,bool att){
 if(t>=1.24875||fe>phFront(t))return vec4(0.);
 float age=t-phPass(fe),fr=phFront(t),dis=att?.4:.3;
 if(fr-fe<.3)return att?vec4(phHex(3801604.),1.):vec4(1.);
 vec3 fill=att?(b<.5?phHex(10488328.):b<1.5?phHex(14685710.):b<2.5?phHex(16721428.):phHex(16736320.)):(b<.5?phHex(16764762.):b<1.5?phHex(16770976.):b<2.5?phHex(16774870.):vec3(1.));
 vec3 dark=att?(b<.5?phHex(7079430.):b<1.5?phHex(10488328.):b<2.5?phHex(14685710.):phHex(16721428.)):(b<.5?phHex(15771704.):b<1.5?phHex(16764762.):b<2.5?phHex(16770976.):phHex(16774870.));
 if(lvl<.45)fill=dark;if(age<.1)return vec4(fill,1.);
 float k=clamp((age-.1)/dis,0.,1.);
 if(lvl>k){vec3 hot=att?mix(phHex(16719888.),phHex(9176070.),k):mix(phHex(16773304.),phHex(16756780.),k);return vec4(mix(fill,hot,min(1.,k*3.)),1.);}
 if(lvl>k-.15&&k<.85)return vec4(att?phHex(4850180.):phHex(14184474.),1.);
 return vec4(0.);
}
vec4 phColor(vec2 uv,vec3 base){
 vec4 a=texture2D(phantomAtlas,uv);if(a.a<.5)return vec4(0.);
 float fe=-22.75+floor(a.r*255.+.5)*.25,g=floor(a.g*255.+.5),ks=floor(g/64.),lvl=mod(floor(g/8.),8.)/7.,wisp=mod(floor(g/4.),2.);
 bool att=phantomWave.w>.5;float l=dot(base,vec3(.299,.587,.114)),b=l<.18?0.:l<.38?1.:l<.62?2.:3.;
 vec4 c=vec4(0.);float kb=phantomWave.z,on=1.;
 if(kb>.002&&(ks>0.||(!att&&wisp>.5))){
  if(kb<.5){float p=1.-2.*kb,x=(fe+9.)/24.+(lvl-.5)*.12;on=x<p?0.:1.;}
  else if(kb<.75){float k=clamp((phantomWave.x*1.25-phPass(fe)-.12)/.2,0.,1.);on=(1.-lvl)<k?1.:0.;}
  if(on>.5){vec3 col=ks>2.5?(att?phHex(655876.):phHex(1313028.)):ks>1.5?(att?phHex(16722452.):phHex(16769146.)):ks>.5?(att?phHex(2753286.):phHex(16097320.)):phHex(16765530.);c=vec4(col,1.);}
 }
 vec4 s1=phSweep(phantomWave.y*1.25,fe,lvl,b,att),s0=phSweep(phantomWave.x*1.25,fe,lvl,b,att);
 c=vec4(mix(c.rgb*c.a,s1.rgb,s1.a),s1.a+c.a*(1.-s1.a));c=vec4(mix(c.rgb,s0.rgb,s0.a),s0.a+c.a*(1.-s0.a));return c;
}`;
  function flames(rig,config,map,attacker){
    const T=root.THREE,positions=new Float32Array(180),uvs=new Float32Array(120),geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));geo.setAttribute('uv',new T.BufferAttribute(uvs,2).setUsage(T.DynamicDrawUsage));
    const mat=new T.MeshBasicMaterial({map,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}),mesh=new T.Mesh(geo,mat);mesh.name='champions-source-gun-flames';mesh.frustumCulled=false;rig.add(mesh);
    const anchors=[-6.5,-3.5,-.5,2.5,5.5].map(f=>config.anchors.reduce((best,a)=>Math.abs(a[0]-f)<Math.min(.6,best?Math.abs(best[0]-f):.6)?a:best,null));
    return {mesh,step(now,alpha,camera){
      mesh.visible=alpha>.01;if(!mesh.visible)return;mat.opacity=alpha;rig.updateWorldMatrix(true,false);const eye=rig.worldToLocal(camera.getWorldPosition(new T.Vector3()));let count=0;
      for(let i=0;i<anchors.length;i++){const a=anchors[i];if(!a)continue;for(const side of [-1,1]){
        const phase=now*12+i*1.7+(side>0?.9:0),frame=((Math.floor(phase)%4)+4)%4,height=[1.9,2.4,1.7,2.2,1.5][(i+(side>0?3:0))%5]*(attacker?.45:1)*(.85+.15*Math.sin(phase*.9)),width=height/2.4;
        const base=new T.Vector3(a[0],a[1],side*a[2]),up=new T.Vector3(0,1,0),right=up.clone().cross(eye.clone().sub(base)).normalize().multiplyScalar(width/2),tip=base.clone().addScaledVector(up,height);tip.x+=(-.6+.12*Math.sin(phase*.7))*height;
        const p=[tip.clone().sub(right),tip.clone().add(right),base.clone().add(right),base.clone().sub(right)],u=[[frame/4,1],[(frame+1)/4,1],[(frame+1)/4,0],[frame/4,0]];
        for(const j of [0,1,2,0,2,3]){geo.attributes.position.setXYZ(count,...p[j].toArray());geo.attributes.uv.setXY(count,...u[j]);count++;}
      }}
      geo.setDrawRange(0,count);geo.attributes.position.needsUpdate=true;geo.attributes.uv.needsUpdate=true;
    }};
  }
  const api={trigger,sample,bake,shader,flames,textures};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.PHANTOM_GUN_WAVE=api;
})(typeof window==='object'?window:globalThis);

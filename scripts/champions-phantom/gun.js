// DFDF solid-body Champions rifle. Original animation bones remain unchanged.
'use strict';
const {Model}=require('./model');
function build(){
  const m=new Model('geometry.dfdf_champions_phantom',[512,512]);
  m.bone('root',null,[-3.5,-3.25,0]);m.bone('mag_and_lefthand','root',[6,-5.5,0]);
  m.bone('magazine','mag_and_lefthand',[6,-5.5,0],[0,0,28]);m.bone('gun_and_righthand','root',[-3.5,-3.25,0]);m.bone('gun','gun_and_righthand',[0,0,0]);
  for(const name of ['barrel','handguard','receiver','grip','stock'])m.bone(name,'gun',[0,0,0]);
  m.bone('grip_handle','grip',[-4.5,-4.25,0],[0,0,24]);m.bone('charge_handle','gun_and_righthand',[17.5,2.25,1.25]);
  m.bone('bolt','gun_and_righthand',[2.5,0,-1]);m.bone('trigger','gun_and_righthand',[-.5,-3,0]);m.bone('mag_release','gun_and_righthand',[2.5,-2.25,-1.25]);
  m.bone('muzzle_pos','gun_and_righthand',[41.25,0,0]);m.bone('shell','gun_and_righthand',[2.5,0,-1.5]);
  const pair=fn=>[-1,1].forEach(fn),solid=r=>({dfdf_mesh:{type:'bevel',radius:r}});
  const box=(bone,x0,x1,y0,y1,hz,material,cz=0,extra={})=>m.cube(bone,[x0,y0,cz-hz],[x1-x0,y1-y0,hz*2],material,extra);
  function beam(bone,a,b,thick,hz,material,cz=0,extra={}){
    const p=[(a[0]+b[0])/2,(a[1]+b[1])/2,cz],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    return m.cube(bone,[p[0]-length/2,p[1]-thick/2,cz-hz],[length,thick,hz*2],material,{...extra,pivot:p,rotation:[0,0,Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI]});
  }
  function cylinder(bone,x0,x1,r,material,extra={}){return m.cube(bone,[x0,-r,-r],[x1-x0,r*2,r*2],material,{...extra,dfdf_mesh:{type:'cylinder',segments:16,...extra.dfdf_mesh}});}
  function pin(bone,x,y,z,r=.22){return m.cube(bone,[x-r,y-r,z-.075],[r*2,r*2,.15],'shell',{dfdf_mesh:{type:'cylinder',axis:'z',segments:8}});}
  // Solid buttstock, raised cheek rest and rubber butt pad.
  box('stock',-22,-11.1,-3.8,1.55,1.85,'dark',0,solid(.55));
  box('stock',-21.5,-12.2,1.25,2.45,1.65,'body',0,solid(.32));
  beam('stock',[-19.5,-3.45],[-10.4,-1.5],1.6,1.6,'dark',0,solid(.35));
  box('stock',-23,-21.8,-4.7,2.3,1.95,'dark',0,{...solid(.32),finish:'rubber'});
  box('stock',-21.8,-21.5,-4,1.5,1.9,'trim',0,solid(.08));cylinder('stock',-12.4,-7.1,1.24,'dark');
  pair(s=>{
    box('stock',-20.8,-12.8,-2.4,.85,.08,'body',s*1.87,solid(.07));box('stock',-20.1,-13.2,.9,1.15,.09,'trim',s*1.88);
    box('stock',-20,-18.3,-1.3,-.7,.10,'dark',s*1.97,solid(.06));box('stock',-17.8,-15.1,-1.5,-1.3,.10,'glow',s*1.97);
    pin('stock',-20.1,-1.95,s*1.99);pin('stock',-13.6,-1.95,s*1.99);
  });
  // Broad upper/lower receiver. Gold is trim, not a wire cage.
  box('receiver',-8,13,-1.65,2.6,2.25,'dark',0,solid(.38));box('receiver',-6.8,10.8,-4.45,-1.25,1.95,'body',0,solid(.34));
  box('receiver',2.9,10.1,-5.35,-3.15,1.75,'dark',0,solid(.24));
  pair(s=>{
    box('receiver',-6.8,10.7,-.8,1.75,.08,'body',s*2.26,solid(.07));box('receiver',-6.5,10.3,1.78,2.03,.07,'trim',s*2.30);
    box('receiver',-4.6,-1.2,-.25,1.5,.10,'trim',s*2.35,{...solid(.08),scales:true});
    box('receiver',-3.7,-2.2,.1,1.1,.11,'body',s*2.46,solid(.07));box('receiver',-3.15,-2.75,.35,.88,.12,'glow',s*2.48);
    box('receiver',-6.2,-4.7,-2.85,-2.5,.10,'dark',s*1.99);pin('receiver',-5.7,-3.6,s*2.08,.24);pin('receiver',9.8,-2.6,s*2.08,.24);
  });
  box('receiver',3.2,10.1,.15,1.55,.10,'dark',-2.36,solid(.07));box('receiver',3,10.3,1.55,1.78,.12,'shell',-2.39);
  box('bolt',3.6,8.65,.34,1.28,.11,'shell',-2.46,solid(.06));box('bolt',4.1,7.3,.53,.74,.12,'dark',-2.58);
  box('receiver',-6.5,25.4,2.6,3.05,.85,'dark',0,solid(.1));
  for(let x=-5.8;x<25;x+=3.2)box('receiver',x,x+1.5,3.05,3.38,.91,'shell',0,solid(.07));
  box('receiver',-5.4,-3.9,3.38,4.12,.68,'dark',0,solid(.12));pair(s=>box('receiver',-5,-4.35,4,4.45,.15,'trim',s*.51,solid(.05)));
  // Rearward leaning rubber grip, open guard and separate trigger.
  box('grip',-6.3,-1.6,-4.8,-3.5,1.48,'body',0,solid(.25));
  box('grip_handle',-5.75,-2.45,-10.8,-4.5,1.23,'dark',0,{...solid(.35),finish:'rubber'});
  box('grip_handle',-5.7,-2.5,-11.3,-10.65,1.27,'dark',0,solid(.16));
  pair(s=>{for(let y=-10;y<-5;y+=1.05)box('grip_handle',-5.25,-2.9,y,y+.18,.06,'body',s*1.24,{...solid(.04),finish:'rubber'});});
  beam('grip',[-2.5,-4.45],[-2,-6],.44,.65,'dark',0,solid(.12));beam('grip',[-2,-6],[2.05,-5.75],.44,.65,'dark',0,solid(.12));
  beam('grip',[2.05,-5.75],[2.55,-4.35],.44,.65,'dark',0,solid(.12));beam('trigger',[-.3,-3.9],[-.7,-5.4],.38,.32,'trim',0,solid(.1));
  box('mag_release',1.9,3.1,-2.55,-1.75,.22,'trim',-2.03,solid(.13));
  // Contiguous sweeps form a gently curved box magazine.
  box('magazine',3.8,8.45,-6.8,-3.25,1.40,'body',0,solid(.28));
  beam('magazine',[6.12,-6.4],[6.65,-9.05],4.55,1.35,'body',0,solid(.29));beam('magazine',[6.65,-9],[7.65,-11.65],4.3,1.28,'dark',0,solid(.28));
  pair(s=>{
    for(const x of [4.6,6.2,7.8])beam('magazine',[x,-4.3],[x+.85,-10.2],.23,.055,'dark',s*1.43,solid(.04));
    beam('magazine',[4.2,-4.3],[5.3,-10.7],.18,.06,'trim',s*1.44);box('magazine',5.9,6.55,-6.05,-5.7,.06,'glow',s*1.45);
  });box('magazine',5.1,10.1,-12.35,-11.6,1.38,'dark',0,solid(.18));
  // Enclosed tapered handguard, recessed vents and low front sight.
  box('handguard',11.5,16.7,-1.65,2.45,2.14,'body',0,solid(.35));box('handguard',16.1,22.4,-1.5,2.35,1.97,'body',0,solid(.34));
  box('handguard',21.9,27.2,-1.3,2.15,1.79,'body',0,solid(.32));
  pair(s=>{
    for(const [x,z]of[[13.1,2.16],[18.25,2],[23.4,1.82]]){box('handguard',x,x+2.1,.15,1.07,.065,'dark',s*z,solid(.06));box('handguard',x+.15,x+1.95,.10,.23,.07,'shell',s*(z+.07));pin('handguard',x+.9,-.78,s*(z+.04),.15);}
    beam('handguard',[12.1,-1.4],[25.9,-1.12],.23,.075,'trim',s*1.91);box('handguard',14.1,23.9,1.6,1.77,.07,'glow',s*2.02);
  });box('handguard',24.1,25.8,3,3.6,.55,'dark',0,solid(.1));box('handguard',24.7,25.1,3.5,4.16,.18,'trim',0,solid(.06));
  // Round suppressor with recessed open bore and thin metallic bands.
  cylinder('barrel',26.9,29.3,.88,'dark',{keepDark:true});cylinder('barrel',28.5,29.4,1.52,'shell');
  cylinder('barrel',29.3,40.35,1.48,'dark',{keepDark:true});cylinder('barrel',30,30.4,1.56,'trim',{dfdf_mesh:{type:'tube',bore:.9}});
  cylinder('barrel',39.85,40.25,1.55,'trim',{dfdf_mesh:{type:'tube',bore:.9}});cylinder('barrel',40.2,41.25,1.48,'dark',{keepDark:true,dfdf_mesh:{type:'tube',bore:.49}});
  pair(s=>box('barrel',32.1,36.8,-.12,.12,.04,'body',s*1.49));
  box('charge_handle',-8.25,-5.4,1.6,2.35,.46,'shell',1.8,solid(.14));box('charge_handle',-8.25,-7.3,1.35,2.6,.65,'dark',2.7,solid(.16));
  // Natural rake without changing any animation bone's rest pose.
  for(const [bone,pivot,angle]of[['magazine',[6,-5.5],-20],['grip_handle',[-4.5,-4.25],-40]])for(const c of m.cubes.filter(c=>c.bone===bone)){
    const [x,y,z]=c.origin.map((v,i)=>v+c.size[i]/2),a=angle*Math.PI/180,dx=x-pivot[0],dy=y-pivot[1];
    const center=[pivot[0]+dx*Math.cos(a)-dy*Math.sin(a),pivot[1]+dx*Math.sin(a)+dy*Math.cos(a),z];
    c.origin=center.map((v,i)=>v-c.size[i]/2);c.pivot=center;c.rotation=[0,0,(c.rotation?.[2]||0)+angle];
  }
  return m;
}
module.exports={build};

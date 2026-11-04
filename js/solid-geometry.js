// DFDF's own solid primitives. Source-pack cubes never opt into these shapes.
(function(root){
  'use strict';
  function build(T,cube,desc){
    const spec=cube.dfdf_mesh||{},size=cube.size,h=size.map(v=>v/2),P=[],N=[],UV=[],F=[];
    if(!size.every(v=>Number.isFinite(v)&&v>0))throw Error('Invalid solid size');
    const faceFor=n=>{const a=n.map(Math.abs),k=a.indexOf(Math.max(...a));return k===0?(n[0]>0?0:1):k===1?(n[1]>0?2:3):(n[2]>0?4:5);};
    function vertex(p,n,face){
      const uvs=[[.5-p[2]/size[2],.5+p[1]/size[1]],[.5+p[2]/size[2],.5+p[1]/size[1]],[.5+p[0]/size[0],.5-p[2]/size[2]],[.5+p[0]/size[0],.5+p[2]/size[2]],[.5+p[0]/size[0],.5+p[1]/size[1]],[.5-p[0]/size[0],.5+p[1]/size[1]]];
      const name=['east','west','up','down','south','north'][face],rect=cube.uv?.[name];if(!rect)throw Error('Solid UV face missing: '+name);
      const [u,v]=uvs[face].map(x=>Math.max(0,Math.min(1,x))),extent=rect.uv_size;
      P.push(...p);N.push(...n);UV.push((rect.uv[0]+.5+u*Math.max(0,extent[0]-1))/desc.texture_width,1-(rect.uv[1]+.5+(1-v)*Math.max(0,extent[1]-1))/desc.texture_height);F.push(face);
    }
    function polygon(points,normal){
      const n=new T.Vector3(...normal).normalize(),face=faceFor(n.toArray()),a=new T.Vector3(...points[0]);
      for(let i=1;i<points.length-1;i++){
        const b=new T.Vector3(...points[i]),c=new T.Vector3(...points[i+1]);
        const ordered=new T.Vector3().subVectors(b,a).cross(new T.Vector3().subVectors(c,a)).dot(n)<0?[points[0],points[i+1],points[i]]:[points[0],points[i],points[i+1]];
        for(const p of ordered)vertex(p,n.toArray(),face);
      }
    }
    if(spec.type==='bevel'){
      const r=Math.max(.00001,Math.min(Number(spec.radius)||.2,Math.min(...h)*.9));
      for(let a=0;a<3;a++)for(const s of [-1,1]){
        const b=(a+1)%3,c=(a+2)%3,n=[0,0,0];n[a]=s;
        polygon([[-1,-1],[1,-1],[1,1],[-1,1]].map(([sb,sc])=>{const p=[0,0,0];p[a]=s*h[a];p[b]=sb*(h[b]-r);p[c]=sc*(h[c]-r);return p;}),n);
      }
      for(let a=0;a<3;a++)for(let b=a+1;b<3;b++)for(const sa of [-1,1])for(const sb of [-1,1]){
        const c=3-a-b,n=[0,0,0];n[a]=sa;n[b]=sb;
        const point=(which,sc)=>{const p=[0,0,0];p[a]=sa*(h[a]-(which?r:0));p[b]=sb*(h[b]-(which?0:r));p[c]=sc*(h[c]-r);return p;};
        polygon([point(0,-1),point(1,-1),point(1,1),point(0,1)],n);
      }
      for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1]){
        const signs=[sx,sy,sz];polygon([0,1,2].map(a=>h.map((v,i)=>signs[i]*(v-(i===a?0:r)))),signs);
      }
    }else if(spec.type==='cylinder'||spec.type==='tube'){
      if(spec.segments!=null&&!Number.isFinite(spec.segments))throw Error('Invalid solid segments');
      const a=({x:0,y:1,z:2})[spec.axis||'x'];if(a==null)throw Error('Invalid solid axis');
      const b=(a+1)%3,c=(a+2)%3,segments=Math.max(8,Math.min(24,Math.round(spec.segments||16))),bore=spec.type==='tube'?Math.max(.1,Math.min(.9,+spec.bore||.55)):0;
      const point=(s,t,k=1)=>{const p=[0,0,0];p[a]=s*h[a];p[b]=Math.cos(t)*h[b]*k;p[c]=Math.sin(t)*h[c]*k;return p;};
      for(let i=0;i<segments;i++){
        const t=i*2*Math.PI/segments,u=(i+1)*2*Math.PI/segments,mid=(t+u)/2,n=[0,0,0];n[b]=Math.cos(mid)/h[b];n[c]=Math.sin(mid)/h[c];
        polygon([point(-1,t),point(1,t),point(1,u),point(-1,u)],n);
        if(bore)polygon([point(-1,t,bore),point(-1,u,bore),point(1,u,bore),point(1,t,bore)],n.map(v=>-v));
        for(const s of [-1,1]){const end=[0,0,0];end[a]=s;polygon(bore?[point(s,t),point(s,u),point(s,u,bore),point(s,t,bore)]:[point(s,0,0),point(s,t),point(s,u)],end);}
      }
    }else throw Error('Unknown solid shape type: '+spec.type);
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('normal',new T.Float32BufferAttribute(N,3));g.setAttribute('uv',new T.Float32BufferAttribute(UV,2));g.setAttribute('dfdfFace',new T.Float32BufferAttribute(F,1));return g;
  }
  const api={build};if(typeof module==='object'&&module.exports)module.exports=api;else root.DFDF_SOLID_GEOMETRY=api;
})(typeof window==='object'?window:globalThis);

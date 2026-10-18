"""Port the supplied renderer's numeric/vertex methods from CFR output.

Usage: python scripts/port-neon-effects.py /path/to/decompiled
No Java/Minecraft classes are executed. The output is ordinary reviewed JS.
"""
import pathlib, re, sys, hashlib, json

root = pathlib.Path(sys.argv[1]) / 'com/lunadia/valorantneon/client/skill'
out = pathlib.Path(__file__).resolve().parents[1] / 'js/neon-fx-source.js'
classes = {'FastLaneRenderer': ['renderSingleWall'], 'RelayBoltRenderer': ['renderBolt', 'renderPairExplosionPoint', 'renderCrackMark'], 'FastLaneOrbRenderer': ['drawPreviewLanes', 'drawOrbSphere']}
result, provenance = [], {}
for cls, entry in classes.items():
    raw = (root / (cls + '.java')).read_text(encoding='utf-8')
    provenance[cls] = hashlib.sha256(raw.encode()).hexdigest()
    methods = {}
    for m in re.finditer(r'private static ([\w.\[\]]+) (\w+)\(([^\n]*)\) \{', raw):
        start = m.end(); level = 1; end = start
        while level:
            level += (raw[end] == '{') - (raw[end] == '}'); end += 1
        methods[m[2]] = (m[3], raw[start:end-1])
    needed = set(entry)
    overrides = {'drawWallStripes'} if cls == 'RelayBoltRenderer' else {'sampleGroundY'} if cls == 'FastLaneOrbRenderer' else set()
    while True:
        deps = {call for name in needed - overrides for call in re.findall(cls+r'\.(\w+)\(', methods[name][1])}
        if deps <= needed: break
        needed |= deps
    # Minecraft wall raycasts are supplied by the browser's collider adapter.
    constants = re.findall(r'private static final (?:int|float|double)(?:\[\])? (LUMP_\w+) = ([^;]+);', raw)
    body = '\n'.join('const '+name+' = '+value+';' for name,value in constants)
    for name in sorted(needed - overrides):
        args, code = methods[name]
        args = ','.join(a.strip().split()[-1] for a in args.split(','))
        body += '\n'+name+'('+args+') {'+code+'},\n'
    # Constants live outside the object methods.
    constant_part = body[:body.find('\n'+sorted(needed-overrides)[0]+'(')]
    function_part = body[len(constant_part):]
    def translate(s):
        s = re.sub(r'new float\[\]\[\]\{([^;]+)\}', lambda m: '['+m[1].replace('{','[').replace('}',']')+']', s)
        s = re.sub(r'new (?:float|double|int)\[\]\{([^}]+)\}',r'[\1]',s)
        s = re.sub(r'new (?:float|double|int)\[([^\]]+)\]',r'new Array(\1).fill(0)',s)
        s = re.sub(r'new Vector3f\[([^\]]+)\]',r'new Array(\1)',s)
        s = re.sub(r'\((?:float|double|long|Vector3fc)\)', '', s)
        # Java integer casts truncate toward zero; source values here are finite.
        s = s.replace('(int)Math.floor','Math.floor')
        s = re.sub(r'\(int\)\(([^()]+)\)',r'Math.trunc(\1)',s)
        s = re.sub(r'\(int\)([\w.]+)',r'Math.trunc(\1)',s)
        s = s.replace('(int)', 'Math.trunc')
        s = re.sub(r'\b(float|double|int|long|boolean|class_289|class_287|Vector3f|WallGeom)(?:\[\])*\s+(\w+)',r'let \2',s)
        s = re.sub(r'\b(\d+(?:\.\d*)?(?:[Ee][+-]?\d+)?)[fL]\b',r'\1',s)
        s = s.replace('System.currentTimeMillis()', 'nowMs').replace('new Vector3f', 'new Vec')
        s = s.replace('class_289.method_1348()', 'tess').replace('tess.method_1349()', 'buf')
        s = s.replace('let tess = tess;', '').replace('let buf = buf;', '')
        s = re.sub(r'class_310 mc = class_310.method_1551\(\);\s*class_638 world = mc.field_1687;', 'let world=null;', s)
        s = s.replace('class_293.class_5596.field_27382','0').replace('class_290.field_1576','0').replace('class_290.field_1575','0')
        s = s.replace('let frameStep = nowMs / 500;', 'let frameStep = Math.floor(nowMs / 500);').replace('let frameStep = nowMs / 200;', 'let frameStep = Math.floor(nowMs / 200);')
        s = s.replace('RenderSystem.disableBlend()', 'state.opaque=true').replace('RenderSystem.enableBlend()', 'state.opaque=false')
        s = re.sub(r'RenderSystem\.(?:depthMask|blendFunc)\([^;]+\);','',s)
        s = re.sub(r'RenderSystem\.(?:setShader|setShaderColor)\([^;]+\);','',s)
        s = s.replace('RenderSystem.setShaderTexture((int)0, (class_2960)SPARK_TEX_ELEC[texIdx]);','state.texture=texIdx;')
        s = re.sub(r'RenderSystem.setShaderTexture\([^;]+\);','state.texture=texIdx;',s)
        s = s.replace('RenderSystem.defaultBlendFunc();','state.texture=null;')
        s = s.replace('FastLaneRenderer.', 'F.').replace('RelayBoltRenderer.', 'R.').replace('FastLaneOrbRenderer.', 'O.')
        s = s.replace('System.currentTimeMillis()', 'nowMs')
        return s
    adapter = '\ndrawWallStripes(m,...args){const extra=wallStripes(...args);if(extra)batches.push(...extra);},' if cls=='RelayBoltRenderer' else '\nsampleGroundY(world,x,z,y){return groundProbe(x,z,y);},' if cls=='FastLaneOrbRenderer' else ''
    result.append(translate(constant_part)+'\nconst '+{'FastLaneRenderer':'F','RelayBoltRenderer':'R','FastLaneOrbRenderer':'O'}[cls]+' = {\n'+translate(function_part)+adapter+'\n};')

header = '''// Generated numeric/vertex port of Seafle Neon 1.0.0-release (NoSound).
// Source JAR SHA256: 384bb3cbb1bf5858493f6b8598b684c1f27433fdb5b06a987f286bd68780bd8e
// Regenerate using scripts/port-neon-effects.py; see docs/NEON_AGENT.md.
(function(root){'use strict';
let nowMs=0, state={opaque:false,texture:null}, vertices=[], batches=[], wallStripes=()=>{},groundProbe=(x,z,y)=>y;
class Vec {
 constructor(x=0,y=0,z=0){if(typeof x==='object'){this.x=x.x;this.y=x.y;this.z=x.z;}else{this.x=x;this.y=y;this.z=z;}}
 set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
 cross(v){const {x,y,z}=this;return this.set(y*v.z-z*v.y,z*v.x-x*v.z,x*v.y-y*v.x);}
 lengthSquared(){return this.x*this.x+this.y*this.y+this.z*this.z;}
 normalize(){const l=Math.sqrt(this.lengthSquared())||1;return this.mul(1/l);}
 mul(v){this.x*=v;this.y*=v;this.z*=v;return this;}
}
class WallGeom {
 constructor(w,dx,dz,px,pz,len){Object.assign(this,{w,dirX:dx,dirZ:dz,perpX:px,perpZ:pz,lenXZ:len});}
 worldX(s){return this.w.startX+(this.w.endX-this.w.startX)*s;}
 worldZ(s){return this.w.startZ+(this.w.endZ-this.w.startZ)*s;}
 worldY(r,h){return this.w.startY+h*r;}
}
const buf={method_1328(){vertices=[];},method_22918(m,x,y,z){this.p=[x,y,z];this.uv=[0,0];return this;},method_22913(u,v){this.uv=[u,v];return this;},method_22915(r,g,b,a){this.c=[r,g,b,a];return this;},method_1344(){vertices.push([...this.p,...this.c,...this.uv]);}};
const tess={method_1349(){return buf;},method_1350(){batches.push({opaque:state.opaque,texture:state.texture,vertices});vertices=[];}};
function begin(ms,probe){nowMs=ms;batches=[];state.opaque=false;state.texture=null;wallStripes=probe||(()=>{});}
'''
footer = '''
const api={
 lane(w,age,t=age){begin(age*1000);F.renderSingleWall(null,{...w,spawnMs:0},t,age<.4?age/.4:age>3.4?Math.max(0,(4-age)/.6):1);return batches;},
 bolt(b,time,cam){begin(time*1000);R.renderBolt(null,b,new Vec(cam));return batches;},
 shock(p,age,probe){begin(age*1000,probe);R.renderCrackMark(null,{...p,spawnMs:0});R.renderPairExplosionPoint(null,p.x,p.y,p.z,age*1000);return batches;},
 preview(o,age,ground){begin(age*1000);groundProbe=ground||((x,z,y)=>y);O.drawPreviewLanes(null,o);O.drawOrbSphere(null,o);return batches.map(b=>({...b,additive:true}));},
 color:F.mainBodyColor, silhouette:F.topSilhouette, ribbon:R.ribbonColor,
};
if(typeof module==='object'&&module.exports)module.exports=api;else root.NEON_FX_SOURCE=api;
})(typeof window==='object'?window:globalThis);
'''
out.write_text('\n'.join(line.rstrip() for line in (header + '\n'.join(result) + footer).splitlines())+'\n', encoding='utf-8')
print(json.dumps({'output':str(out),'sourceHashes':provenance}))

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../js/rgx-firefly-data'),{bedrock,THREE}=require('../scripts/champions-phantom/model');
const flush=()=>new Promise(setImmediate);
async function runtime({suspended=false}={}){
  let weapon='knife',started=0,resume;
  const audio={state:suspended?'suspended':'running',decodeAudioData:async()=>({}),resume:()=>new Promise(resolve=>{resume=resolve;}),
    createBufferSource:()=>({connect(){},disconnect(){},stop(){},start(){started++;}}),createGain:()=>({gain:{},connect(){},disconnect(){}})};
  const s={console,TextDecoder,URL,Blob,crypto:require('node:crypto').webcrypto,
    document:{hidden:false,createElement:()=>({setAttribute(){},style:{}}),body:{append(){}},getElementById:()=>({hidden:true})},
    T:{...THREE,TextureLoader:class{async loadAsync(){return new THREE.Texture();}}},RGX_FIREFLY_DATA:D,BEDROCK_RIG:bedrock(),
    GUN_SKINS:{of:()=>({id:'butterfly',model:'rgx_butterfly'})},KNIVES:{build:{},inspD:()=>1,drawD:()=>1},
    bakeDeep:root=>root,viewmodelFireKick(){},tickViewmodel(){},curWeaponKey:()=>weapon,
    player:{alive:true,ads:false},world:{phase:'live'},VM:{root:{visible:true}},SKIN_PERKS:{state:{insp:{t:-1}}},SETTINGS:{sfx:true},
    GAME_AUDIO:{context:()=>audio,output:{}},fetch:async url=>{
      const bytes=fs.readFileSync('assets/rgx-firefly/v1/'+url.replace(/^.*\/v1\//,'').split('?')[0]);
      return {ok:true,json:async()=>JSON.parse(bytes),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
    }};
  s.window=s;vm.runInNewContext(fs.readFileSync('js/rgx-firefly.js','utf8'),s);
  assert.equal(await s.RGX_FIREFLY.ready,true);s.VM.current=s.RGX_FIREFLY.create();
  return {s,setWeapon:v=>{weapon=v;},started:()=>started,resume:()=>resume?.()};
}
test('the third SGH attack plays past 2.5 seconds until its three-second endpoint',async()=>{
  const {s}=await runtime();s.tickViewmodel(.01);s.tickViewmodel(2.1);
  for(let i=0;i<3;i++)s.viewmodelFireKick();s.tickViewmodel(2.7);
  assert.equal(s.RGX_FIREFLY.clip,'melee_3');s.tickViewmodel(.31);assert.equal(s.RGX_FIREFLY.clip,'static_idle');
});
test('switching back to a cached RGX root replays its draw',async()=>{
  const {s,setWeapon}=await runtime();s.tickViewmodel(.01);assert.equal(s.RGX_FIREFLY.clip,'draw');s.tickViewmodel(2.1);
  const root=s.VM.current;setWeapon('rifle');s.tickViewmodel(.2);setWeapon('knife');s.tickViewmodel(.01);
  assert.equal(s.VM.current,root);assert.equal(s.RGX_FIREFLY.clip,'draw');
});
test('audio cancelled during suspended-context resume never starts later',async()=>{
  const {s,setWeapon,started,resume}=await runtime({suspended:true});s.tickViewmodel(.01);s.tickViewmodel(.22);await flush();
  s.RGX_FIREFLY.stop();setWeapon('rifle');resume();await flush();assert.equal(started(),0);
});

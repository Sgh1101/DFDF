(() => {
  'use strict';
  // The weapon line-up: retired keys point at the active weapon that replaced
  // them, and every active weapon gets its display name and handling from
  // VALORANT_DATA (an internal name, kept so saves and skins stay valid). The
  // models and sounds are the game's own builders (GUN_BUILD, SFX.gun).
  const D=VALORANT_DATA,canonical=D.canonical;
  // Keep legacy properties and wire indices readable, while all enumerated
  // Shopping/gacha lists expose only the distinct weapons.
  for(const [old,target] of Object.entries(D.aliases))if(WEAPONS[old])Object.defineProperty(WEAPONS,old,{value:WEAPONS[target],writable:true,configurable:true,enumerable:false});
  for(const [key,name] of Object.entries(D.names))Object.assign(WEAPONS[key],D.profiles[key],{name});
  // Append late-added active guns without changing any existing wire index.
  for(const key of Object.keys(WEAPONS))if(!WKEYS.includes(key))WKEYS.push(key);
  window.GUN_COUNT=Object.keys(WEAPONS).length;
  // The identity swap includes mechanics and optics, not just display names.
  SCOPE_FOV.carbine = 38; delete SCOPE_FOV.scout;
  const reconBase=GUN_BUILD.carbine;
  GUN_BUILD.carbine=()=>{
    const root=reconBase(),b=GunBuilder(),M=GUNMAT;
    b.barrel(M.black(),.028,.24,0,.12,-.08);
    for(const z of [-.02,-.16])b.box(M.gunmetal(),.02,.04,.03,0,.085,z);
    b.cyl(M.glass(),.024,.024,.005,14,0,.12,-.2,Math.PI/2,0,0);
    root.add(b.group);root.userData.weaponModel='recon';return root;
  };
  const purchase=applyPurchase;
  applyPurchase=function(a,kind,key){return purchase.call(this,a,kind,kind==='weapon'?canonical(key):key);};
  function migrateActor(a){
    if(!a?.weapons)return;
    for(const slot of ['primary','secondary']){
      const key=a.weapons[slot],next=canonical(key);if(!key||key===next)continue;
      a.weapons[slot]=next;if(a.ammo?.[key]!=null)a.ammo[next]=a.ammo[key];if(a.reserve?.[key]!=null)a.reserve[next]=a.reserve[key];
    }
  }
  const weaponKey=actorWeaponKey;
  actorWeaponKey=function(a){migrateActor(a);return canonical(weaponKey.apply(this,arguments));};
  const frame=netStep;
  netStep=function(){for(const a of world.actors)migrateActor(a);return frame.apply(this,arguments);};
})();

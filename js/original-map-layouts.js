// Original DFDF objective/spawn contract shared by the generator and client.
(function(root){
 const island={attackSpawn:[48,100],defendSpawn:[48,12],sites:[['A',22,29],['B',74,29]],nodes:{atk:[48,100],def:[48,12],mid:[48,56],A:[22,29],B:[74,29],west:[22,80],east:[74,80]}};
 const desert={bounds:{minX:-54,maxX:54,minZ:-68,maxZ:68},spawns:{atk:[[-8,58,0],[-4,58,0],[0,58,0],[4,58,0],[8,58,0]],def:[[-8,-58,0],[-4,-58,0],[0,-58,0],[4,-58,0],[8,-58,0]]},sites:[['A',-34,-30,0,6],['B',32,-6,3,5]],nodes:{mid:[0,0,0],west:[-36,22,0],east:[36,22,0],westS:[-34,-12,0],plazaW:[-18,-32,0],plazaE:[18,-32,0],lane:[0,32,0],pitE:[34,-40,0],eastS:[36,40,0]}};
 const api={island,desert};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ORIGINAL_MAP_LAYOUTS=api;
})(typeof window==='object'?window:globalThis);

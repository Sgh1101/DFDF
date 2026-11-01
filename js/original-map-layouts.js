// Original DFDF objective/spawn contract shared by the generator and client.
(function(root){
 const island={attackSpawn:[48,100],defendSpawn:[48,12],sites:[['A',22,29],['B',74,29]],nodes:{atk:[48,100],def:[48,12],mid:[48,56],A:[22,29],B:[74,29],west:[22,80],east:[74,80]}};
 const api={island};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ORIGINAL_MAP_LAYOUTS=api;
})(typeof window==='object'?window:globalThis);

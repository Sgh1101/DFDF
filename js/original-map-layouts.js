// Original DFDF objective/spawn contract shared by the generator and client.
(function(root){
 const island={attackSpawn:[48,100],defendSpawn:[48,12],sites:[['A',22,29],['B',74,29]],nodes:{atk:[48,100],def:[48,12],mid:[48,56],A:[22,29],B:[74,29],west:[22,80],east:[74,80]}};
 island.districts=[{id:'market',label:'시장 골목',center:[22,29]},{id:'station',label:'정류장 광장',center:[74,29]},{id:'canal',label:'중앙 산책로',center:[48,56]},{id:'residential',label:'주택가',center:[48,82]}];
 island.buildings=[
  {x:7,z:12,w:11,d:12,tone:14,kind:'shop'},{x:29,z:39,w:10,d:10,tone:9,kind:'cafe'},
  {x:78,z:12,w:11,d:12,tone:14,kind:'shop'},{x:7,z:66,w:12,d:12,tone:1,kind:'home'},
  {x:77,z:66,w:12,d:12,tone:1,kind:'home'},{x:25,z:87,w:11,d:11,tone:9,kind:'home'},
  {x:60,z:87,w:11,d:11,tone:9,kind:'home'},{x:7,z:39,w:12,d:10,tone:5,kind:'shop'},
  {x:77,z:39,w:12,d:10,tone:3,kind:'cafe'}
 ];
 const api={island};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ORIGINAL_MAP_LAYOUTS=api;
})(typeof window==='object'?window:globalThis);

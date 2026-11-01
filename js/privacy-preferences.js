// Optional local preferences only: this is not Google's certified CMP or proof of
// consent to any third party. Nothing here starts advertisements or analytics.
(function(root){
  'use strict';
  const key='13_privacy_preferences_v1';
  const defaults=()=>({version:1,essential:true,advertising:false,analytics:false});
  function normalize(value){
    if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1)return defaults();
    return {version:1,essential:true,advertising:value.advertising===true,analytics:value.analytics===true};
  }
  function read(storage){try{return normalize(JSON.parse(storage.getItem(key)));}catch(e){return defaults();}}
  function write(storage,value){try{storage.setItem(key,JSON.stringify(normalize({version:1,...value})));return true;}catch(e){return false;}}
  function reset(storage){return write(storage,defaults());}
  const api=Object.freeze({key,defaults,read,write,reset});
  if(typeof module==='object'&&module.exports){module.exports=api;return;}
  root.PRIVACY_PREFERENCES=api;
  const form=document.getElementById('privacyChoices');if(!form)return;
  let storage;try{storage=root.localStorage;}catch(e){storage=null;}
  const advertising=document.getElementById('privacyAdvertising'),analytics=document.getElementById('privacyAnalytics'),status=document.getElementById('privacyChoiceStatus');
  const paint=()=>{const s=read(storage);advertising.checked=s.advertising;analytics.checked=s.analytics;};
  form.addEventListener('submit',event=>{
    event.preventDefault();const ok=write(storage,{advertising:advertising.checked,analytics:analytics.checked});
    if(!ok)paint();
    status.textContent=ok?'선택을 이 브라우저에 저장했습니다. 현재 광고와 선택적 분석은 실행되지 않습니다.':'브라우저가 저장을 허용하지 않았습니다. 선택적 기능은 꺼진 상태로 유지됩니다.';
  });
  document.getElementById('privacyWithdraw').addEventListener('click',()=>{
    const ok=reset(storage);advertising.checked=false;analytics.checked=false;
    status.textContent=ok?'선택을 철회했습니다. 필수 저장소만 사용합니다.':'선택을 저장하지 못했습니다. 현재 광고와 선택적 분석은 실행되지 않습니다. 브라우저 설정에서 이 사이트 데이터를 지워 주세요.';
  });
  paint();
})(typeof window==='object'?window:globalThis);

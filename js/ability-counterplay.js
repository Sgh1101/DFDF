(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.ABILITY_COUNTERPLAY=api;api.install(AGENTS);}})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 // Five mechanic axes from the final cast implementations, not colours or names.
 // Pair differences are a review aid; actual cast/counter tests remain required.
 const rows=[
 ['hwaryeong','지속 사격','전방 적과 바닥','지속 화염 궤적','직접 화염과 잔류 화상','화염 사거리 밖으로 물러나고 불붙은 바닥을 피하세요.'],
 ['seorin','지점 시전','원 안의 적','순간 원형','즉시 완전 속박','빙결 구역을 벗어나거나 시전 전에 거리를 벌리세요.'],
 ['gangcheol','세 번 수동 공격','전방 적','직선 충격파','밀침과 뇌진탕','정면 충격파를 옆으로 피하고 남은 주먹 횟수를 확인하세요.'],
 ['yeonhwa','시체 선택','쓰러진 아군 한 명','아군 시체 지점','아군 부활','쓰러진 아군 위치를 지켜 부활 후 재합류를 막으세요.'],
 ['noeun','즉시 활성','모든 적','전역','능력과 미니맵 차단','차단 중에는 총격과 직접 시야로 대응하세요.'],
 ['baekho','세 발 수동 조준','조준선 적','관통 직선','벽 관통 활 피해','벽 뒤에서도 사선을 바꾸고 세 발 소모를 유도하세요.'],
 ['heuksa','전방 감염','부채꼴 적과 주변 적','전염 연결','부패와 취약 전파','감염된 동료와 떨어져 전염을 줄이세요.'],
 ['myeongjong','지점 시전','범위 내 적','낙하 종 원형','무기 사용 봉인','종의 범위를 피하거나 봉인 중 엄폐하며 능력으로 대응하세요.'],
 ['jacheol','영역 활성','밖에서 들어오는 총격','원형 경계','총탄 흡수와 누적 공명파','영역 안으로 들어가 쏘거나 능력 피해로 대응하세요.'],
 ['hongyeol','수동 채찍','전방 적과 자신','근거리 채찍','흡혈 끌기와 일회 자기 부활','채찍 거리를 유지하고 되살아난 뒤 다시 공격하세요.'],
 ['gunbong','설치','여왕 시야의 적','파괴 가능한 고정 영역','반복 일벌 출격','여왕을 파괴하거나 시야와 영역을 벗어나세요.'],
 ['baram','자기 강화','자신 주변 적','이동 원형','연속 바깥 밀침','바람의 중심과 거리를 벌리고 범위 밖에서 공격하세요.'],
 ['geomi','지점 설치','체류 중인 적','고정 거미줄 바닥','체류 시간 누적 속박','거미줄 안에 오래 머물지 말고 경계를 빠져나오세요.'],
 ['byeolbit','지점 시전','영역 내 적','흡인 중심과 종료 폭발','중심 끌어당김','중심에서 멀어지고 끝날 때 폭발 범위를 피하세요.'],
 ['kallal','좌클릭 단발 또는 우클릭 일제','조준 적','직선 또는 부채꼴','처치 시 재충전 수동 칼날','사선을 끊고 일제 투척 소모 후 공격하세요.'],
 ['deonggul','영역 결속','적 쌍 또는 단일 적','씨앗과 연결선','최대 거리 제한 끌기','연결 씨앗을 파괴하거나 연결된 동료와 함께 이동하세요.'],
 ['hwanyeong','자기 위치 영역','영역 내 아군','고정 달빛 원','탐지 표시 제거','직접 시야로 확인하세요. 모습이나 총탄을 숨기지는 않습니다.'],
 ['suho','자기 위치 설치','아군과 적 총격','열린 모서리 사각 방벽','엄폐 요새와 내부 회복','열린 모서리로 우회해 내부를 압박하세요.'],
 ['danbi','단일 조준 후 지연','첫 대상과 이웃 적','근접 연결 사슬','순차 연쇄 피해와 뇌진탕','전하가 보이면 엄폐하고 아군끼리 흩어져 연결을 끊으세요.'],
 ['chujeok','전방 적 표식','표식 적 한 명','단일 대상 유지','저체력 임계 처형','표식 중 교전을 끊고 체력이 낮아지지 않게 회복하세요.'],
 ['yakcho','자기 위치 설치','영역 내 다친 아군','유한 회복 저장소','회복 분배와 상태 정화','정원 밖으로 교전을 유도하세요. 무적이나 부활은 없습니다.'],
 ['chochim','자기 주변 강화','아군이 가한 피해','주변 팀 피해 사건','지연 반향 피해','교전을 끊어 추가 피해 사건을 만들지 않게 하세요.'],
 ['gwanmun','단일 적 조준','적 한 명','일시 제거','공격 불가 무적 추방 후 복귀','추방된 대상에게 탄을 낭비하지 말고 복귀 시점을 지키세요.'],
 ['hwangya','단일 적 결투','시전자와 적 한 명','출입 제한 결투 원','외부 개입 없는 결투','결투 안에서는 엄폐와 거리로 시전자의 강화 시간을 버티세요.'],
 ['nachim','지도 지점 선택','자신','맵 전역 목적지','선택 위치 순간이동','이동 후 합류 경로와 후방을 직접 확인하세요.'],
 ['gamyeon','단일 적 조준','자신과 적 한 명','즉시 상태 교환','체력 방어구 맞교환','낮은 체력의 시전자에게 근접 조준을 허용하지 마세요.'],
 ['simpan','단일 적 조준','적 한 명','스폰 지점 강제 복귀','위치 초기화와 능력 봉인','조준을 피하고 복귀 후 팀과 다시 합류하세요.'],
 ['neon_agent','지속 수동 빔과 슬라이딩','조준 적과 자신','전기 빔 사선과 이동','연속 빔과 사격 중 슬라이딩','빔 사선을 엄폐하고 슬라이딩 후 위치를 다시 확인하세요.'],
 ];
 const axes=['input','target','shape','result','counter'];
 const all=Object.freeze(rows.map(([id,...v])=>Object.freeze(Object.fromEntries([['id',id],...axes.map((k,i)=>[k,v[i]])]))));
 const by=Object.freeze(Object.fromEntries(all.map(r=>[r.id,r])));
 function pairs(){const out=[];for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++)out.push({a:all[i].id,b:all[j].id,different:axes.filter(k=>all[i][k]!==all[j][k])});return out;}
 function install(roster){for(const a of roster){const row=by[a.id],d=a.abilities.find(d=>d.ult);if(!row||!d)throw Error('Missing ultimate contract: '+a.id);d.counterplay=row.counter;}}
 return Object.freeze({all,by,axes,pairs,install});
});

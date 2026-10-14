# 게임 소스와 로딩

`play.html`에는 화면과 스타일, 외부 스크립트의 순서가 남아 있습니다. 기존 80개 인라인 스크립트는 `js/legacy/`에 분리했습니다. 목록은 `js/legacy/manifest.json`이며 HTML에서 같은 순서로 실행합니다. `03-engine.js`는 기존 압축 코드를 정렬한 엔진이며, 초기 데이터와 자산 생성 함수는 `js/engine/`의 네 파일로 추가 분리했습니다. 이 네 파일은 엔진 바로 앞에서 같은 순서로 실행합니다. `manifest.json`은 원래 80개 스크립트의 목록이고, 현재 전체 실행 목록은 HTML에 있습니다.

기존 스크립트는 전역 함수와 변수를 공유하는 classic script입니다. 뒤쪽 파일이 앞쪽 기능을 감싸는 구조를 유지하므로 `async`, `type="module"`, 임의 순서 변경을 적용하면 안 됩니다. 이번 분리는 파일과 진입 경로를 정리한 단계이며, 기존 함수 래퍼를 전부 제거하거나 엔진 내부를 완전히 나눈 변경은 아닙니다.

주요 파일:

| 파일 | 담당 |
|---|---|
| `js/engine/agents.js`, `weapons.js`, `maps.js` | 최초 요원·무기·맵 데이터와 맵 등록 |
| `js/engine/textures-portraits.js` | 텍스처·초상화 생성 함수 |
| `js/portrait-loader.js` | 부팅 후 보이는 요원 사진을 한 작업에 하나씩 생성, 대표/선택 요원 우선 처리 |
| `js/legacy/03-engine.js` | 렌더링, 물리, 사격, 경기, P2P 기본 구현 |
| `js/game-catalog.js` | 최종 데이터의 개수와 홈 안내 문구 |
| `js/legacy/05-game-modes.js` | 모드 규칙과 부활 |
| `js/legacy/44-account-sync.js` | 계정·설정·경기 보고 |
| `js/legacy/47-owner-controls.js` | 방에 한정된 소유자 확인과 명령 |
| `js/legacy/50-map-sizes.js` | 팀 규모와 맵에 따른 목표 조정 |
| `js/legacy/52-projectiles.js` | 수류탄·RPG 발사와 폭발, 발사 원인 전파 |
| `js/legacy/58-gun-skins.js` | 스킨 소유·장착·모델·무기고 |
| `js/legacy/66-touch-layout.js` | 계정별 터치 배치 |
| `js/game-rules.js` | 입력·능력·결과·피니셔 허용 규칙 |
| `js/damage-cause.js` | 무기 전환 이후에도 유지할 피해 원인과 실행 범위 |
| `js/game-events.js` | 최종 입력·재접속 보호, 처치 사건, 피니셔, 라운드 경계 |
| `js/home.js`, `js/home-details.js` | 홈 배치·미리보기·최근 설정·즐겨찾기·안내 |
| `js/home-layout.js`, `css/home-lobby.css` | 상단 내비게이션·플레이/요원/하단 영역과 반응형 홈 배치, 도움말 팝업 경계 |
| `js/modal-focus.js` | 설정·구매·관리자·무기고·미션·지도·점수판·뽑기·로그인·배치 편집 포커스 |

`game-boot.js`는 초기 프레임을 모아 두었다가 마지막 스크립트까지 로딩되면 실행합니다. 초대 링크 자동 참가도 그 뒤에 시작합니다. 파일을 못 받으면 게임 시작을 막고 다시 시도할 수 있는 화면을 표시합니다. 스크립트 preload는 병렬 다운로드를 돕고 실제 실행 순서는 그대로 유지합니다.

무기고 버튼은 초기 HTML에 있으며 준비가 끝나면 활성화합니다. 요원 확장 파일이 초기화하는 동안 `renderTitleRoster`/`renderSelect`는 사진을 만들지 않습니다. 최종 목록으로 홈의 작은 요원 칩을 한 번 만들고, 선택 화면은 진입할 때 만듭니다. `GAME_PORTRAITS.set()`은 화면에 보이는 이미지의 캔버스 생성만 예약하며 대표 요원/선택한 요원을 먼저 그립니다. 선택 카드 교체 전 `clear()`로 이전 이미지 관찰과 대기 작업을 제거합니다. 초상화 함수와 캐시는 마지막 외형 확장 이후의 구현을 사용합니다.

`#skins`/`#skins-mine`은 부팅 완료와 `hashchange`에서 처리하며, 보유품 조회도 부팅 완료 후 즉시 시작합니다. 기존 주기 조회는 재시도/홈 복귀 확인으로 남깁니다. 무기고의 첫 WebGL 미리보기는 버튼을 먼저 그린 뒤 생성하며, 보이지 않는 총별 스킨 패널과 썸네일 렌더러는 미리 만들지 않습니다.

검사 시 `scripts/game-source.js`로 HTML의 실제 실행 순서에 따라 소스를 읽습니다. 따라서 호스트 능력·소유자·백그라운드 테스트는 복제한 함수 대신 배포되는 구현을 검사합니다. `npm run check`는 하위 폴더를 포함한 모든 JS를 파싱합니다.


터치 이벤트는 `03-engine.js`의 `enableTouch()`에서 한 번만 등록합니다. `17-mobile-controls.js`의 왼쪽 사격 버튼도 같은 `beginTouchFire`/`endTouchFire`를 사용해 손가락별 누름 상태를 공유합니다. 끄기·창 포커스 상실·백그라운드 전환은 `resetTouchInput()`으로 해제하며, 29번 파일의 입력 함수 래퍼와 별도 터치 선택 재해석은 제거했습니다.

`chDispose()`는 요원 모델의 baked 지오메트리와 명시적으로 소유한 팀 색상 재질을 해제합니다. `CH_GEO`, `CH_MAT`, `TP_GUN` 등의 공유 자산은 해제하지 않습니다. 경기 다시 시작과 모델 품질 변경이 이 경로를 사용합니다. 모든 투사체·무기·맵 자산의 소유권을 완전히 통합한 단계는 아닙니다.


맵 장치의 소유 자원은 `06-one-way-teleporters-switch-doors-ziplines.js`의 `MAP_GIMMICKS.clear()`에서 정리합니다. 문 스위치·문 본체·순간이동 링·집라인의 geometry/material은 이 모듈에서 생성하므로 중복 없이 해제합니다. 공유 텍스처는 해제하지 않습니다. `clearMapGeometry()`는 일반 맵 메시를 제거하기 전에 장치 정리를 호출하고, 장치가 맵 메시 목록에도 등록되어 있으면 먼저 목록에서 제외해 이중 해제를 막습니다.


사이트 표시(`13-plant-zones-made-visible-a-glowing-ring-and-light-curtain.js`)도 재생성 전에 이전 링·바닥·장막의 geometry/material을 해제합니다. 사이트 간 공유하는 `TEX.fill`과 `TEX.curtain`은 유지합니다.

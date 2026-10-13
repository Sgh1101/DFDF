# 게임 소스와 로딩

`play.html`에는 화면과 스타일, 외부 스크립트의 순서가 남아 있습니다. 기존 80개 인라인 스크립트는 `js/legacy/`에 분리했습니다. 목록은 `js/legacy/manifest.json`이며 HTML에서 같은 순서로 실행합니다. 세 번째 파일인 `03-engine.js`는 기존 압축 코드를 읽을 수 있게 정렬한 엔진입니다.

기존 스크립트는 전역 함수와 변수를 공유하는 classic script입니다. 뒤쪽 파일이 앞쪽 기능을 감싸는 구조를 유지하므로 `async`, `type="module"`, 임의 순서 변경을 적용하면 안 됩니다. 이번 분리는 파일과 진입 경로를 정리한 단계이며, 기존 함수 래퍼를 전부 제거하거나 엔진 내부를 완전히 나눈 변경은 아닙니다.

주요 파일:

| 파일 | 담당 |
|---|---|
| `js/legacy/03-engine.js` | 최초 요원·맵·총기, 물리, 사격, 경기, P2P 기본 구현 |
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
| `js/modal-focus.js` | 설정·구매·관리자·무기고·미션 포커스 |

`game-boot.js`는 초기 프레임을 모아 두었다가 마지막 스크립트까지 로딩되면 실행합니다. 초대 링크 자동 참가도 그 뒤에 시작합니다. 파일을 못 받으면 게임 시작을 막고 다시 시도할 수 있는 화면을 표시합니다. 스크립트 preload는 병렬 다운로드를 돕고 실제 실행 순서는 그대로 유지합니다.

검사 시 `scripts/game-source.js`로 HTML의 실제 실행 순서에 따라 소스를 읽습니다. 따라서 호스트 능력·소유자·백그라운드 테스트는 복제한 함수 대신 배포되는 구현을 검사합니다. `npm run check`는 하위 폴더를 포함한 모든 JS를 파싱합니다.

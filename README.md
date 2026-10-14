# DFDF

브라우저에서 바로 하는 5대5 공격/수비 전술 FPS입니다. 공격팀은 스파이크를 설치하고, 수비팀은 막거나 해제합니다.

## 게임

- **요원**: 40명, 능력 160개. 요원마다 Q/E/C/X 능력 4개가 있습니다. 최초 요원 목록은 `js/engine/agents.js`이며 `js/legacy/`의 여러 묶음이 보완합니다.
- **멀티플레이**: PeerJS(WebRTC) P2P. 대기실의 빈 자리는 AI 봇으로 채울 수 있습니다.
- **성장**: 계정, 레벨/XP, 골드, 랭크, 미션, 뽑기, 스킨.
- **관리자 페이지**: `admin.html` (`/admin`).
- **PWA**: `manifest.webmanifest`, `sw.js`. Vercel에 배포됩니다.

## 그래픽과 사운드

효과음, 초상화, 일부 텍스처는 코드로 만듭니다. 맵 표면 재질과 하늘 조명은 파일을 씁니다.

- `assets/mat/`: 표면 재질 webp 54개 (색, 노멀, ORM). `play.html`이 `assets/mat/<재질>_<종류>.webp`로 불러옵니다.
- `assets/env/`: 하늘 조명 HDR 7개 (alpine, city, dawn, forest, park, studio, warehouse). `assets/env/<이름>.hdr`로 불러옵니다.
- 출처는 `assets/CREDITS.md`에 있습니다 (CC0).

## 파일

| 파일 | 설명 |
|---|---|
| `play.html` | 게임 화면·스타일과 스크립트 실행 순서 |
| `js/legacy/` | 기존 엔진·요원·맵·계정·스킨 기능 80개, 순서는 `manifest.json` |
| `js/engine/` | 초기 요원·무기·맵 데이터, 텍스처·초상화 생성 |
| `js/` | 공통 요청·오디오·처치 원인·홈·포커스·부팅 관리 |
| `index.html` | 소개 페이지 |
| `admin.html` | 관리자 페이지 |
| `api/v1.js` | 서버 함수 (`?a=<action>`), 데이터는 Upstash Redis REST |
| `sw.js`, `manifest.webmanifest` | PWA |
| `vercel.json` | 배포 설정 |

## 환경변수 (Vercel)

| 이름 | 용도 |
|---|---|
| `KV_REST_API_URL` / `UPSTASH_REDIS_REST_URL` | Redis 주소 |
| `KV_REST_API_TOKEN` / `UPSTASH_REDIS_REST_TOKEN` | Redis 토큰 |
| `ADMIN_MASTER_PASS` | 관리자 비밀번호 |
| `SESSION_SECRET` | 세션·매치 티켓 서명 키 |
| `OWNER_ID` | 마스터 비밀번호로 로그인하는 소유자 계정 아이디 |
| `CF_TURN_KEY_ID`, `CF_TURN_API_TOKEN` | Cloudflare TURN 임시 접속 정보 발급 |
| `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` | 대체 TURN 서버 접속 설정 |

`SESSION_SECRET`이 없으면 관리자 비밀번호와 Redis 토큰에서 만든 값을 대신 씁니다. 그러면 비밀번호를 바꿀 때 기존 티켓이 모두 무효가 되므로, Vercel에 따로 설정해 두세요.

## 개발과 검증

Node.js 20 이상에서 `npm run dev`로 정적 페이지와 `/api/v1`을 실행합니다. 실제 계정 기능에는 위 Redis 환경변수가 필요합니다. 환경변수가 없으면 저장 요청이 실패하며 운영 데이터를 흉내 내지 않습니다.

- `npm run check`: 서버, 기능 모듈 및 HTML의 인라인 스크립트 문법 검사.
- `npm test`: 임시 메모리 저장소로 인증 경계, 동시 저장, 보상 재시도, 입력·능력·피니셔 조건 검사. 운영 Redis의 통합 검증은 별도로 필요합니다.
- `npm run test:browser`: 실행 중인 개발 서버에서 작은 가로 화면의 홈·요원 선택·무기고·처치·결과·로그아웃을 검사합니다. Playwright와 Chromium이 필요합니다. 선택적으로 `DFDF_BASE_URL`, `CHROME_BIN`, `DFDF_PLAYWRIGHT_MODULE`, `DFDF_THREE_PATH`를 설정할 수 있습니다.
- `npm run test:maps`: 문·순간이동 장치·집라인의 맵 재로딩 후 자원 해제, 중복 해제 방지, 공유 자산 유지, 문 조작 및 반복 렌더링 검사.
- `npm run test:home-layout`: 상단 메뉴와 원래 플레이 버튼·로고·요원·계정 칩 스타일 유지, 5개 화면 크기의 경계·겹침·실제 메뉴 클릭 검사. [수정 화면](docs/HOME_LAYOUT.md).
- `npm run test:startup`: 엔진 로딩 전 무기고 버튼 표시, 스킨 바로가기, 지연된 보유품 조회·뽑기 및 화면에 보이는 최종 요원 사진 검사.
- `npm run test:followup`: 방 목록 갱신·정렬·실패 표시, 요원 전용 그래픽 자원 해제, Chromium CDP 멀티터치·취소, 배치 편집·복원, 계정 전환·다른 탭 로그아웃과 한국어/영어 화면 검사. API는 테스트 저장소로 대체하며 서비스 워커를 막아 요청을 정확히 대체합니다. 모바일 실기기나 운영 데이터 검증을 뜻하지 않습니다.
- `js/game-rules.js`: 입력·능력·승패·피니셔의 공통 규칙.
- `js/game-events.js`: 온라인 처치 정보, 피니셔, 재접속 보호, 결과 완료 사건.
- `js/home.js`, `js/home-details.js`, `css/home.css`: 홈 동선, 최근 설정·즐겨찾기·모드 안내·장착 스킨과 미리보기.
- `js/home-navigation.js`, `css/home-navigation.css`: 상단 메뉴·계정 배치와 원래 홈의 위치·크기 조정.
- `js/damage-cause.js`: 지연 피해의 발사 당시 무기·스킨.
- `js/modal-focus.js`: 주요 모달의 키보드 포커스.
- `js/portrait-loader.js`: 부팅 후 화면에 보이는 요원 사진을 작업별로 생성하고, 교체된 카드의 대기 작업 정리.
- `js/game-boot.js`: 모든 스크립트 로딩 뒤 프레임·초대 연결 시작.
- `npm run test:regression`: 추가 홈 기능·실제 RPG 폭발·부활·수류탄·반복 경기 검사.
- `npm run test:online`: 두 브라우저의 실제 WebRTC 연결 검사. 테스트용 `peer` 패키지와 PeerJS 브라우저 파일이 필요하며 `DFDF_PEER_SERVER_MODULE`, `DFDF_PEERJS_PATH`로 경로를 지정할 수 있습니다. 로컬 신호 서버를 9000번 포트에서 실행합니다.
- 구조와 로딩 규칙은 [소스 안내](docs/SOURCE_LAYOUT.md)에 있습니다.
- `js/game-audio.js`, `js/client-request.js`: 공통 오디오 출력과 요청 시간 제한.

전체 작업 계획과 남은 항목은 [개발 메모 #17](https://github.com/Sgh1101/DFDF/issues/17)에 기록합니다.

실제 Redis의 Lua 저장 경로는 임시 Redis 인스턴스를 실행한 뒤 `DFDF_REDIS_CLI`와 `DFDF_REDIS_SOCKET`을 지정해 `npm test`로 검사할 수 있습니다. 지정하지 않으면 해당 통합 테스트 하나를 건너뜁니다. 테스트 API 요청은 운영 서버로 전송하지 않습니다. `test:online`은 브라우저가 WebRTC 연결을 허용하는 환경이 필요합니다. 관리 정책으로 직접 UDP가 차단되고 TURN도 없는 환경에서는 연결 실패를 보고하며, 성공한 검증으로 간주하지 않습니다.

소유자와 관리자 인증 형식을 갱신했으므로 적용 후 해당 계정은 다시 로그인해야 합니다. 일반 계정은 비밀번호 초기화 또는 새 세션 발급에 따라 이전 세션이 무효가 될 수 있습니다. 보상은 유효한 경기 확인표가 있어야 지급되며, P2P 호스트의 경기 자체를 서버가 검증하는 구조는 아닙니다.


현재 RR은 AI전·비공개 방·관리자 설정 경기를 포함한 완료 경기 결과에 반영되며 무승부는 0입니다. 사격 연습과 맵 탐방은 결과를 적립하지 않습니다. 온라인 일반전만 반영하도록 바꾸는 선택은 아직 확정되지 않아 기존 경기 정책을 유지합니다.

세션 버전이 없는 이전 로그인은 다시 로그인해야 합니다. 경기 보상 확인표도 해당 계정의 세션 버전에 묶으므로, 비밀번호 초기화 또는 삭제·재가입 이전의 확인표는 사용할 수 없습니다. 업데이트 전에 발급한 이전 형식의 확인표는 새 경기 시작 후 새 확인표로 대체됩니다.

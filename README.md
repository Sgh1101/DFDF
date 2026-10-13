# DFDF

브라우저에서 바로 하는 5대5 공격/수비 전술 FPS입니다. 공격팀은 스파이크를 설치하고, 수비팀은 막거나 해제합니다.

## 게임

- **요원**: 40명, 능력 160개. 요원마다 Q/E/C/X 능력 4개가 있습니다. 요원 목록은 `play.html` 안에서 여러 묶음으로 조합됩니다.
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
| `play.html` | 게임 본체 (단일 파일) |
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
- `js/game-rules.js`: 입력·능력·승패·피니셔의 공통 규칙.
- `js/game-events.js`: 온라인 처치 정보, 피니셔, 재접속 보호, 결과 완료 사건.
- `js/home.js`, `css/home.css`: 홈 동선과 스킨 미리보기.
- `js/game-audio.js`, `js/client-request.js`: 공통 오디오 출력과 요청 시간 제한.

전체 작업 계획과 남은 항목은 [개발 메모 #17](https://github.com/Sgh1101/DFDF/issues/17)에 기록합니다.

실제 Redis의 Lua 저장 경로는 임시 Redis 인스턴스를 실행한 뒤 `DFDF_REDIS_CLI`와 `DFDF_REDIS_SOCKET`을 지정해 `npm test`로 검사할 수 있습니다. 지정하지 않으면 해당 통합 테스트 하나를 건너뜁니다. 테스트 API 요청은 운영 서버로 전송하지 않습니다.

소유자와 관리자 인증 형식을 갱신했으므로 적용 후 해당 계정은 다시 로그인해야 합니다. 일반 계정은 비밀번호 초기화 또는 새 세션 발급에 따라 이전 세션이 무효가 될 수 있습니다. 보상은 유효한 경기 확인표가 있어야 지급되며, P2P 호스트의 경기 자체를 서버가 검증하는 구조는 아닙니다.

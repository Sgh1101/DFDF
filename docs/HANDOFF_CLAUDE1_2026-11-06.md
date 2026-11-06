# 인수인계: Claude1 → Claude2 (2026-11-06)

Claude1(이전 계정의 Claude 세션)이 마친 일, 남긴 일, 다음 순서를 적은 문서다. 기존 기록(`docs/AGENT_WORK_STATUS.md`)은 그대로 두고 이 파일을 더했다. 비밀 값(키·토큰·비밀번호)은 적지 않았다.

## 0. 처음 읽을 문서 (이 순서로)

1. `AGENTS.md`: 모든 작업 전에 상호 확인한다. 챔피언스 스킨은 사용자 승인을 받는다. 검증 원칙을 지킨다.
2. `.cursor/rules/collaboration-coordination.mdc`: Codex와 Claude가 작업 전에 서로의 최신 커밋, 열린 PR, 미커밋 변경을 확인하는 규칙이다.
3. `CLAUDE.md`: Claude 전용 지침이다.
4. `docs/AGENT_WORK_STATUS.md`: 공동 작업 기록. 최신 항목은 맨 아래에 있다. 작업할 때마다 항목을 덧붙이고, 지우지 않는다.
5. `.cursor/rules/deployment-coordination.mdc`: 배포할 때 읽는다.
6. 필요할 때 읽는 것:
   - `docs/SOURCE_LAYOUT.md`: play.html의 스크립트 순서와 `js/legacy` 구조
   - `docs/RELEASE_RUNBOOK.md`
   - `docs/MULTIPLAYER_VERIFICATION.md`
   - `docs/PROJECT_REVIEW_2026-10-21.md`, `docs/QA_2026-10-21.md`

## 1. Claude2가 맡을 일: 사용자 평가 1~4

사용자가 2026-11-06에 전한 평가다. 확인·개선은 **Claude2 담당**이다. Claude1은 이 평가로 작업을 시작하지 않았고, 아래 내용을 판정하지도 않았다. 사용자 지시는 이렇다: 최신 코드·문서로 확인하고 이미 해결/미해결/검증 필요로 구분한다. 1~4 순서로 우선순위를 잡는다. Codex의 최근 변경을 확인한다. 기록에 반영한다. 대규모 삭제·재작성이나 머지는 하지 않는다.

1. **아직 발로란트다.** 이름만 일부 바뀌었다.
   - 내부 데이터 이름이 그대로 `VALORANT_DATA`다.
   - 팬텀에 해당하는 총은 30발·분당 660발, 밴달에 해당하는 총은 25발·분당 585발이다.
   - 요원 이름에 '네온'이 남아 있다.
   - 황혼 지구는 어센트 구조를 가로·세로 1.75배, 높이 1.25배로 늘린 맵이다. 문서에는 재배포·광고 허가가 확인되지 않았다고 적혀 있다.
   - 나비칼은 모양은 자체 제작이지만 뼈대, 동작, 소리 8개는 외부 팩이다.
   - 비공개로 혼자 두는 것과 주소로 공개해 광고를 거는 것은 다르다. 후자는 지금 문서 기준으로도 준비되지 않았다.
   - 관련 문서와 PR:
     - `monetization-review.json`, `scripts/check-ad-readiness.js`, `docs/VALORANT_PACKS.md`, `assets/CREDITS.md`, `docs/asset-provenance.md`
     - Codex #137(나비칼 뼈대·모션·소리 자체 제작, 열림)
2. **랭크는 경쟁전이 아니다.**
   - 판정을 방장 브라우저가 한다. 방장이 유리하고, 손님은 연결이 끊기면 그 판이 끝난다.
   - 10/14 기록에는 로컬에서 신호는 오갔지만 데이터 채널이 열리지 않았다고 되어 있다.
   - 다른 집 두 대와 휴대폰 데이터로 10판 연결 성공률을 잰 기록은 없다.
3. **코드 수명.**
   - `play.html`이 스크립트 순서에 의존한다. `js/legacy/` 수십 개 파일이 전역 함수를 앞 파일 위에 덮어쓴다.
   - `js/gun-designs.js`는 약 129KB, `admin.html`은 약 124KB다.
   - 브라우저 테스트가 기능마다 하나씩이라 100개가 넘는다. 규칙을 지키는 검사보다 기능을 따라가는 검사에 가깝다.
4. **콘텐츠가 손맛보다 앞선다.**
   - 10/21 자체 리뷰에서 끝나지 않은 것: 휴대폰 FPS, 궁극기 차이, 작은 화면에서 정보가 겹치는 문제, CTF 봇이 점수를 내는지.
   - 그 다음 2주 동안 이 구멍을 닫기보다 기능을 더 쌓았다.

## 2. Claude1이 마친 일 (main에 병합됨)

| PR | 내용 | 병합 |
|---|---|---|
| #144 | 통합 PR. #140 운영자 카드, #141 홈 소식 칸 → AdSense 칸, #142 이름 글꼴(Pretendard 800), #143 멀티 치트 능력 세트 버그 | 2026-11-06, main `c4241cd` (사용자가 병합) |
| #136 | 총 디자인 개편 4/18: Tempo(기관권총), 새 총 조준을 실제 가늠자에 맞춤 | 2026-11-06 |
| #135 | 공동 작업 기록: 챔피언스 팬텀은 #128 유지 (#126 사용 안 함) | 2026-11-05 |

주요 파일:
- 운영자 카드:
  - `js/legacy/125-operator-card.js`(새 파일), `scripts/browser-operator-card.js`
  - 등록: `play.html`, `js/legacy/manifest.json`
- 홈 광고:
  - `js/home-ad.js`, `css/home-ad.css`, `scripts/browser-home-ad.js`
  - `js/home-newmap.js`와 `css/home-newmap.css`는 삭제했다.
  - CSP 생성기 `scripts/build-csp.js`(AD 목록)와 그 출력 `vercel.json`, `_headers`, `cloudflare/csp.mjs`
  - 광고 게이트 `ads-config.json`의 `userApprovedIntegrations: ["play.html"]`, `scripts/check-ad-readiness.js`
  - 테스트 픽스처 `scripts/browser-fixture.js`는 Google 광고 호스트를 차단한다.
- 글꼴:
  - `css/typography.css`, `css/font-faces.css`(`--ui-display-font`), `css/home-intro.css`, `css/pages.css`
  - `scripts/browser-soft-fonts.js`
- 치트 세트:
  - `js/legacy/25-admin-panel.js`: `sendKit`, 방장이 보내는 `kit` 이벤트
  - `scripts/browser-guest-kit.js`

## 3. 진행 중·미완료 (머지 안 됨)

| 항목 | 브랜치 / PR | 상태 | 다음 할 일 |
|---|---|---|---|
| 홈 광고 칸에 AdSense 단위 번호(13fps 홈 우측 디스플레이, `data-ad-slot="1624269865"`, 반응형) + 이 인수인계 문서 | `claude/ad-slot` / **#145** | 푸시 완료, CI 결과는 #145 PR 페이지에서 확인 | 사용자 병합. 병합 후 배포된 홈에서 광고 칸을 확인한다. 광고 송출은 AdSense 사이트 승인에 달려 있다. |
| SGH나비칼 4색·디자인 + 기본 칼 찌르기 + 칼끝 올리기 | `claude/sgh-colors-v2` / **#138** (`3267b15`) | CI 통과. **Codex #137 위에 쌓은 PR** | #137을 먼저 병합하고 그다음 #138. #137이 바뀌면 다시 맞춘다. |
| (Codex) 나비칼 뼈대·모션·소리 자체 제작 | `codex/sgh-butterfly-motion-20261105` / #137 (`156c5b4`) | 열림 | 사용자 승인 대기. #141과 `scripts/check-ad-readiness.js`가 겹치지만 다른 줄이라 자동 병합된다(확인함). |
| (Codex) 축소전 시작 위치를 맵 전체로 분산 | `codex/zone-spawn-spacing-20261106` / #139 (`0592d17`) | 열림 | `docs/AGENT_WORK_STATUS.md` 끝부분만 겹친다. |
| Cloudflare 단독 호스팅(페이지와 API를 Worker 하나로) | 이전 작업 브랜치 `claude/cloudflare` 등 | 보류 | 사용자 쪽 일이 남아 있다: Cloudflare DNS 영역(네임서버) 연결, Workers Paid 결정. 지금 운영은 Vercel(13fps 프로젝트)이다. Worker 이름은 dfdf이고, 필요한 비밀은 Worker에 이미 등록되어 있다(값은 적지 않는다). |
| CSP 강제 모드 | `scripts/build-csp.js`의 `MODE` | 지금은 report-only다. 아무것도 막지 않는다. | 배포 후 콘솔의 CSP 보고(AdSense 포함)를 모은 뒤 `"enforce"`로 바꾼다. |
| AdSense 승인 | 외부 | 사이트 승인과 EU 동의 메시지 게시는 사용자 쪽 일이다. | `ads-config.json`과 `monetization-review.json`의 대기 항목(사이트 승인, 연령·CMP, 자산 권리)은 Codex 게이트가 관리한다. |

## 4. 테스트·실행 결과 (Claude1이 실제로 돌린 것)

- 2026-11-06, #140~#143을 합친 트리(#144):
  - 단위 테스트 522 통과, 2 건너뜀(Redis가 필요한 것).
  - `npm run check`, `node scripts/build-csp.js --check`, `node scripts/check-ad-readiness.js`(gateChecksPass true) 통과.
  - 브라우저: operator-card, home-ad, soft-fonts, guest-kit, ui-fixes, followup, perm-ticket 통과. CI도 통과했다.
- #145(`claude/ad-slot`): `test:home-ad`(실제 단위 번호·형식·요청 1회 확인) 통과. 단위 522, CSP check, 광고 게이트 통과.
- 실기기(Android), 실제 인터넷 방(다른 네트워크 두 대), 실제 광고 송출은 **검증하지 않았다**.

## 5. 알려진 문제

- **밤 전체 CI(schedule) 실패, 2026-11-06, main `a09e677`(#144 병합 전) 기준.** 원인은 조사하지 않았다.
  - 실패한 검사: `test:service-worker`, `test:chat`, `test:bot-skill`, `test:verified-levels`, `test:followup`, `test:admin`, `test:finisher`, `audit:ui`, `test:pwa`, `test:net-wave2`
  - `test:followup`은 #143에서 고쳤다. 원인은 오래된 기대값이었다(목록에 `guns: 18`이 추가됨).
  - `test:bot-skill`과 `test:verified-levels`는 같은 단언("nor on the guest's lobby")에서 실패한다.
  - `test:net-wave2`는 "2 stop: holding W … not corrected"에서 1회 실패했다.
  - `test:service-worker`는 "manifests bypass even a poisoned asset cache"에서 실패했다. Codex #137이 `sw.js`를 바꾸므로 함께 볼 것.
  - #144 이후 main(`c4241cd`)의 다음 밤 실행에서 다시 확인해야 한다.
- 이 세션의 권한 검사는 **PR 병합을 막는다**(검토 없는 병합). 병합은 사용자가 한다.
- GitHub 푸시가 서버 오류(`fatal error in commit_refs`)로 잠시 거절된 적이 있다. 시간을 두고 다시 하면 된다.
- 멀티 치트 세트 수정(#143)은 로컬 PeerServer 두 페이지로만 검증했다. 사용자가 실제 방에서 같은 증상을 다시 보면 그때의 상황(방장·게스트, 권한 종류, 타이밍)을 받아 재현한다.

## 6. 브랜치·작업 폴더 정리 상태

- **로컬에만 있고 원격에 없는 커밋:** `claude/sgh-colors` `092a574`(#137 이전 기반의 나비칼 4색 WIP). #138로 대체되어 필요 없다.
- 2026-10-26의 `claude/check-*` 브랜치들(account, admin, gameplay, multi, skins, ui)에서 원격에 없던 커밋은 모두 같은 제목으로 main에 들어가 있다. 해시만 다르다. 잃은 작업은 없다.
- Claude1 컴퓨터의 `/tmp/wt-*` 작업 폴더와 `/home/user/cx` 클론은 그 컴퓨터에만 있다. Claude2는 볼 수 없고, 필요하지도 않다. `/home/user/cx`는 브라우저 테스트에 node_modules를 대 주는 클론일 뿐 진행 중인 작업이 아니다(인덱스가 오래된 상태).

## 7. 실행 방법 (요약)

- 개발 서버: `PORT=3000 node scripts/dev-server.js`
- 단위 테스트: `node --test tests/*.test.js`
- 구문 검사: `npm run check`
- CSP 다시 만들기: `node scripts/build-csp.js`. 인라인 스크립트나 HTML을 바꾼 뒤 실행한다. 확인만 할 때는 `--check`.
- 광고 게이트: `node scripts/check-ad-readiness.js`
- 브라우저 테스트: `node scripts/browser-<이름>.js`(`package.json`의 `test:*`). 쓰는 환경 변수:
  - `DFDF_BASE_URL`(개발 서버 주소)
  - `DFDF_THREE_PATH`, `DFDF_PEERJS_PATH`(로컬 three.min.js, peerjs.min.js. 지정하면 CDN 대신 쓴다)
  - `DFDF_PEER_SERVER_MODULE`(멀티 테스트용 `peer` 패키지)
  - 브라우저 테스트는 한 번에 하나씩 돌린다. CPU 경합이 생기면 시간 초과가 난다.
- CI 일부만 돌리기: `gh api repos/Sgh1101/DFDF/actions/workflows/check.yml/dispatches -f ref=<브랜치> -f "inputs[only]=test:a,test:b"`

## 8. 다음 실행 순서 (제안)

1. Codex의 최신 커밋과 열린 PR(#137, #139)을 확인하고 `docs/AGENT_WORK_STATUS.md`에 시작 기록을 남긴다.
2. 사용자가 #145를 병합하면 배포된 홈 광고 칸(1181px 이상 화면)을 확인한다.
3. #144 이후 main의 밤 CI 결과를 확인하고, 위 실패 목록을 실제 버그와 오래된 테스트로 가른다.
4. 사용자 평가 1~4(1절)를 1→4 순서로 해결/미해결/검증 필요로 분류해 기록한다. 대규모 삭제·재작성과 머지는 하지 않는다.
5. #137 → #138 순서의 병합은 사용자 승인을 받은 뒤에 한다.

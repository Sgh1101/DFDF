# DFDF 전체 개편 실행 계획

Base: `45ce6f3d57fdeffe1232097079b5e7d6b25f8845`. Branch: `codex/full-visual-rework-20261102`. Spec: `docs/superpowers/specs/2026-11-02-game-visual-overhaul.md`.

워크플로: 기존 격리 worktree에서 `executing-plans`로 직접 구현한다. 사용자에게 추가 설계 승인을 반복해서 묻지 않는다. 독립 보안 검토만 보안 스킬이 지시한 작업자에게 맡긴다. 새 기능 로직은 실패를 확인한 테스트부터 구현하고, 낮은 영향의 CSS/문구 수정은 실제 화면 검증을 우선한다.

## 사전 검토와 실패 조건

- 칼이 새 모양이어도 피벗이 바뀌면 기존 모션이 손에서 떨어진다 → geometry 변경 전 피벗/모션 샘플 기준을 저장하고 변경 후 비교한다.
- 한글 폰트가 로드되지 않거나 좁은 화면이면 글자가 잘리기 쉽다 → 폴백·375px·가로 휴대폰·PC에서 조작/가격/킬로그를 확인한다.
- 음악을 바꿔도 검사/음소거/탭 전환으로 여러 곡이 중첩될 수 있다 → 재생 수명과 정지·반복을 브라우저에서 검사한다.
- 세밀한 건물은 바닥/시야와 충돌이 어긋날 수 있다 → 양 팀 실제 몸체 이동·능력 바닥·창/문/천장·사격을 검증한다.
- 모바일 세부 생략이 지형을 관통하게 만들면 안 된다 → 원본과 모바일의 충돌 바이트 동일성을 유지한다.
- 다른 작업자가 시안을 수정 중일 수 있다 → 해당 worktree를 수정하지 않고 완료 커밋·범위·검증을 확인해 통합한다.

## Task 1 — 칼 자체 모델, 모션 보존

Files: `js/legacy/67-knives.js`의 `build.butterfly()`/`build.karambit()`만 형상 변경, `tests/knife-design.test.js` 생성, `scripts/browser-knife-tricks.js`와 필요 시 별도 모델 검증 스크립트.

Interface: 기존 `KNIVES`/`VM` 및 `spin`, `hA`, `hB` 유지. `js/legacy/83-knife-tricks-the-knife-turns-in-the-hand-and-the-arm-stays.js`와 67번 모듈의 HAND/GRIP/REST/SIZE/DRAW_D/타격·표시 애니메이션은 변경하지 않는다.

- [x] 기준 피벗·부품·움직임 샘플과 실제 화면을 확인한다.
- [x] 새 자체 디자인 계약(유한 메시/UV·기존 피벗/연결·적절한 크기)을 검증하는 실패 테스트를 작성·실행한다.
- [x] 두 builder를 새 프로파일·베벨·프레임·그립·금속 장식으로 구현한다. 외부 팩은 추가하지 않는다.
- [x] 단위 및 기존 knife/knife-walls 브라우저 검사, 실제 장착·자세히 보기·공격·모바일 화면을 확인하고 커밋한다.

## Task 2 — 글꼴·수치 가독성

Files: `index.html`, `play.html`, `css/pages.css`, 필요 시 `css/typography.css`, `scripts/browser-soft-fonts.js`, 공개 출처 글꼴 목록. 인터페이스는 기존 `--fd`/`--fb`, `--f-display`/`--f-body` 토큰을 사용한다.

- [x] 실제 로비·요원 선택·상점·인게임·문서의 현재 화면을 탐색한다.
- [x] 장식 본문을 Noto Sans KR로 정리하고 한글 제목 Black Han Sans의 실제 굵기를 사용한다. 중요한 숫자는 tabular-nums와 읽을 수 있는 크기로 유지한다.
- [x] 사용하지 않는 글꼴 요청을 제거하고 기존 글꼴 검사 요구를 새 계약에 맞춘다.
- [x] PC/세로·가로 휴대폰, 폰트 폴백, 메뉴 줄바꿈·버튼 접근·킬 배너·스크롤을 검증한다. 정적 페이지 생성 및 CSP 해시를 갱신하고 커밋한다.

## Task 3 — 지역처럼 읽히는 자체 마을

Files: `scripts/build-original-maps.js`, `js/original-map-layouts.js`, 원본/모바일 패키지, `tests/original-maps.test.js`, `scripts/browser-original-maps.js`, 사이트 맵 설명·미리보기.

Interface: `islandLayout()`/`buildIsland()`/`writePackages()` 출력과 ASC2 포맷, manifest의 layout/스폰/거점, 기존 `ASCENT_TRIAL` 로더를 유지한다. 환경/모바일 표현은 같은 물리 좌표와 충돌을 사용한다.

- [x] 도로·보도·주거/상가·광장·양쪽 우회로·2층 접근을 공유 layout에 정의한다. A/B는 독립적인 진입·엄폐를 가진다.
- [x] 통행 가능한 연결·문/천장 높이·양 팀 스폰·원본/모바일 충돌 계약을 먼저 테스트한다.
- [x] 건축 입면·지붕·출입구·창틀·간판/가로등/벤치/배수 구조 등을 예산 내에서 생성한다. 생활 소품은 불필요한 복잡한 충돌을 추가하지 않는다.
- [x] 실제 이동/봇/사격/천장/능력 바닥·미니맵·그래픽 전환을 검증한다. 렌더링 비용을 측정하고 모바일 표현을 조절한다.
- [x] 실제 게임으로 미리보기/문서를 다시 만들고 단위·맵 브라우저 검사 후 커밋한다.

## Task 4 — 챔피언스 디자인·음악 전면 개선

Files: 완료된 `codex/champions-concept-v2` 변경을 검토 통합, `scripts/champions-phantom/{gun,gun-paint,creatures,fx,audio}.js`, `js/phantom-audio.js`(필요한 재생 개선만), 번들 manifest/생성물, `tests/phantom-audio.test.js`·디자인 계약 및 관련 브라우저 스크립트.

Interface: 리그 뼈·총구·기존 애니메이션, 오디오 profiles `kill_1..5`, `inspect`, `finisher_music`와 이벤트 `{at,sound,pitch,volume}`를 유지한다. 합성 악기 범위·반복 구간·재생 종료를 검증한다. 가격·보유·확률·8초 마무리 조건은 수정하지 않는다.

- [x] 승인 시안과 다른 작업창의 완료 커밋·검증·부작용을 확인한다. 미완성 파일을 직접 수정하지 않는다.
- [x] 총/마무리/배너를 실제 렌더러에서 비교하고 동일한 디자인 언어로 정리한다. 공격·수비 변형은 공통 실루엣을 유지한다.
- [x] 새 킬 모티프·미리보기 곡·마무리 곡을 작곡하고 재생 계약·음량/피크·결정성을 실패 테스트 후 구현한다.
- [x] 번들을 재생성하고 해시·장착·모션·물결·킬 배너·마무리·미리보기/음소거/반복/네트워크를 검증한다. 자체 곡의 미리듣기와 실제 화면을 남기고 커밋한다.

## Task 5 — 보안·통합·배포

보안 scan `3debcf26-671e-4081-af70-a528681c766b`는 읽기 전용 `adsense-review-20261101`의 기반 커밋 45ce6f3을 대상으로 한다. 이 worktree는 검사 중 수정하지 않는다. 보안 canonical 결과는 전용 MCP 저장소에 기록한다.

- [x] 독립 baseline + 독립 아키텍처 검토, 신뢰 경계별 조사 및 후보 검증을 수행한다. 결과/커버리지/미확인 범위를 보존한다.
- [x] 확인된 실제 취약점은 이 개편 브랜치에서 수정·회귀 검증한다. 보안 결과를 공개 PR에 자동 게시하지 않는다.
- [x] 최종 diff의 새 로딩/HTML/입력 경계와 의존성 영향을 검토하고 문법·단위·패키지·목표 브라우저 검사를 실행한다.
- [x] 각 모드의 실제 스크린샷과 음악, 보안 보고서, 검증 종류/한계를 결과 문서에 기록한다.
- [ ] 배포 전 다시 fetch하여 클로드·다른 작업창·현재 운영 커밋을 확인한다. Vercel 사용자 재인증 후 정확한 최종 커밋을 운영 배포하고 실제 서비스까지 검증한다. 광고는 비활성화, main은 별도 승인 없이 병합하지 않는다.

실행 결과: `docs/game-visual-overhaul-result.md`. 최종 배포 단계만 사용자 Vercel 재인증 대기.

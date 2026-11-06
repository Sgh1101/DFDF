# Codex · Claude 공통 작업 기록

각 담당자는 작업 시작·중요 변경·종료 시 자기 항목을 갱신한다. 다른 담당자의 미완료 기록과 미커밋 파일은 보존한다. 커밋 기록과 현재 worktree 상태를 확인해 아래 내용의 유효성을 판단한다.

## 2026-11-04 · Codex · 챔스 입체 소총 재설계 — 진행 중

- 사용자 요청: 팬텀을 입체적이고 실제 소총 같은 자체 모델로 다시 제작. 별도 요청으로 모든 작업 전 Claude/Codex 상호 확인 지침 추가.
- 작업 브랜치/worktree: `codex/champions-solid-rifle-20261104` / `champions-solid-rifle-20261104`.
- 기준: `e0733ac`. 시작 및 지침 추가 시 원격 fetch, main·상대 브랜치·열린 PR·관련 worktree를 확인했다. 확인 시 열린 PR은 없었다.
- 상대 작업 확인: Claude의 #119 HTTPS, #120 칼/손 모션, #122 운영자 권한, #123 명칭 변경이 main에 포함되어 있다. Codex의 #121 능력 조준, #125 총기 이름, #124 스킨 교정도 포함되어 있다. 이 변경을 유지한다.
- 담당 파일: `js/solid-geometry.js`, `js/bedrock-rig.js`, `js/champions-phantom.js`, `js/phantom-assets.js`, `scripts/champions-phantom/`, 해당 생성 자산·검사·설명 문서, 공동 작업 지침 파일.
- 구현: 기존 17개 본/피벗 유지, 자체 베벨/원통/열린 총구, 124부품·14172정점, 512px 아틀라스 및 linear 거칠기/금속성 맵.
- 실제 검사: 전체 단위 522 통과·2 Redis 선택 검사 제외. 로컬 브라우저 챔스 PC/모바일 두 변형·기본 캐시 복구·RGX·처치 물결 통과. 검토 수정 후 두 변형/표면 맵/상부/총구/1인칭 및 로딩 재시도 통과, 전체 구매·장착 검사는 진행 중. 실제 Android/실결제 미검증.
- 독립 검토: 오래된 `큐브×36` 기대값과 베벨 UV 알파 빈틈을 수정했다. 두 변형 각각 내부 샘플 132272개에서 투명 픽셀 0, 실제 총구 구멍과 RGX 해시 유지. 두 검토자 모두 남은 지적 없음. 다음은 최종 흐름 및 GitHub 회귀 검사, PR/시안 제시다.
- 보호할 미완료 작업: `champions-concept-20261101`, `practice-range-20261101`의 기존 변경을 그대로 보존했다. 다른 도구가 이 worktree를 사용 중이라고 단정하지 않는다.
- 배포 상태: 이번 입체 모델은 미배포. 기존 #124는 `06cc74c`로 배포 완료되었고 이후 main에 위 Claude 변경이 추가되었다. 새 모델의 별도 main 병합 승인은 아직 없다.

## 다른 담당자가 이어받을 때

## 2026-11-04 · Codex · 황혼 지구 / 어센트 구조 복원 — 진행 중

- 사용자 정정: 마크X발로의 이름을 바꾸고 더 넓히되 실제 어센트의 길·사이트·엄폐 배치는 유지하고 외형만 바꾼다. 자체 마을로 구조를 교체한 것이 원인이었다.
- 브랜치/worktree: `codex/ascent-layout-restore-20261104` / `ascent-layout-restore-20261104`. main `e0733ac` + 지침 전용 `1d189e7`에서 분리했다. 미승인 팬텀 모델 PR #126의 제품 코드는 포함하지 않는다.
- 시작 확인: 원격 main/Claude/Codex 브랜치·열린 PR·관련 worktree를 확인했다. Claude #119/#120/#122/#123 및 Codex #121/#124/#125를 유지한다. 기존 concept/practice 미커밋 변경과 PR #126을 그대로 둔다.
- 원본: Downloads의 `ascent-final2021.schematic`, SHA-256 `b987d994b5aa01e0b614b5e7d92a4b8f41f7cf6ecab1daddd5ba3fc4cf1b9c28`. crop [55,12,16], dimensions [206,115,223], 원본 scale 1.25. 현재 자체 마을 [96,18,112] 대신 원본 지형을 복원한다.
- 담당 파일: 맵 변환/재생성·캐시·메타데이터, `js/ascent-trial.js`, 맵 이름/미리보기·공개 안내, 관련 지형/이동/능력/모바일 검사. 스킨·총·서버 권한·요원 모션은 변경하지 않는다.
- 결정: 가칭 황혼 지구(Dusk District). 원본 1.25배 축척과 높이/계단을 보존해 현재보다 큰 약258×279m 외곽을 사용한다. 원본 좌표/충돌 기준을 고정하고 외관은 자체 재질/색·조명으로 구분한다. 모바일도 같은 충돌을 쓴다.
- 현재 원본 변환 측정: desktop 302566 quads / 44380 colliders / 7794160 bytes, 기존 경량화 적용 mobile 166330 quads / 4524496 bytes. 실기기 성능은 검증 전이며 단순히 렉이 같다고 주장하지 않는다.
- 다음: 원본 구조/충돌 보존과 재생성 경로 검사부터 추가하고, 실제 브라우저에서 원본 복원·길찾기·A/B 설치·스킬·모바일 전환을 확인한다. 이번 변경의 별도 main 병합 승인 없음.

이 기록을 읽고 실제 원격·PR·worktree를 새로 확인한다. 같은 파일을 수정해야 하면 기존 diff와 사용자 지시를 먼저 대조한다. 완료한 내용을 새 담당자의 항목에 추가하고, 위 진행 기록을 임의로 완료 처리하지 않는다.

## 2026-11-04 · Codex · 황혼 지구 최종 통합/검증 중

- 원본 변환 지형/충돌 바이트를 복원했고 X/Z만1.75, 높이1.25로 약361×390m로 넓혔다. 원본의 단차·길·엄폐 배치를 유지한다. 다층 내비게이션과 실제 시작/사이트 좌표는 자동 이동0m.
- 양 팀→A/B 네 경로 전체 실제 물리 통과, 키보드 이동, 봇9명 이동,112개 능력/4모드 장판 높이, 모바일 전환·재시도·정리 통과. 마지막 기록의258×279m는 캐릭터 지름1.5m와 한 블록 통로를 검증한 결과 위 가로 확대로 대체한다.
- 별도 코드 리뷰에서 목표 층 높이 유실·폭탄/구역 높이 누락을 찾아 수정했다. 수동 설치·해제/다른 층 차단/폭발·미리보기 경계/13.75↔18.75m 재탐색과 실제 추적 회귀 검사를 추가했다. 로컬 WebRTC에서A/B폭탄 높이와 참가자 순간이동의 선택 층을 확인한다. 실제Android/WAN/실결제 미검증.
- 원격 main이bcdec21로 전진하며 Claude#127 SGH나비칼이 승인 병합된 것을 확인했다. 해당 diff(모델/텍스처/표시·설명/검사)를 유지해 이 feature branch에 통합한다. 열린#126 Codex 팬텀과#128 Claude 총/스킨 변경은 이 맵 PR에 합치지 않는다. #126은 새SGH모델 해시 및#128 중복 작업과 다시 대조해야 한다.
- 최종 통합 커밋에서 전체 단위·구문·자산·관련 브라우저 검사를 재실행한 뒤 별도 PR로 제시한다. main병합 승인 없음.

## 2026-11-04 · Claude · SGH나비칼 (RGX 나비칼의 모양·텍스처·이름 교체) — 병합·배포 완료

- 사용자 요청: RGX 나비칼의 모션과 손잡이 돌아가는 동작은 그대로 두고, 이름과 디자인만 자체 것으로 바꾼다. 이름은 "SGH나비칼"이고 소리는 유지한다.
- 작업 브랜치: `claude/sgh-butterfly`. 기준은 `e0733ac`(main)이다.
- 상대 작업 확인: Codex #124(RGX 도입, 칼 10종, 챔스 자체 디자인)와 #125가 main에 들어가 있다. 열린 PR #126(챔스 입체 소총, 공동 작업 지침)의 diff를 읽었다. 겹치는 파일은 이 기록 파일뿐이다.
- 주의: #126의 `tests/champions-solid.test.js`에는 "retained source RGX positions, normals and UVs are byte-identical" 검사가 있다. 이 PR이 RGX 모델의 큐브를 바꾸므로, 둘 다 병합되면 그 검사의 해시를 새 모델 기준으로 갱신해야 한다. 먼저 병합되는 쪽을 기준으로 나중 쪽에서 맞춘다.
- 담당 파일:
  - `assets/rgx-firefly/v1/{model.json,texture.png,manifest.json}`
  - `scripts/build-sgh-butterfly.js`(새 파일)
  - `js/rgx-firefly.js`(표시 문구)
  - `js/legacy/58-gun-skins.js`(이름)
  - `scripts/site-pages/credits.js`, `credits.html`
  - `tests/sgh-butterfly.test.js`, `scripts/browser-rgx-firefly.js`(큐브 수 기준)
- 구현: 뼈대 27개의 이름·부모·피벗·회전과 `animation.json`·소리 8개는 바이트 그대로다(테스트로 고정). 칼날·손잡이 두 쪽·발광 부위의 큐브와 128px 텍스처만 생성 스크립트로 새로 만든다. 저장 키 `butterfly`와 모델 키 `rgx_butterfly`는 유지한다.
- 실제 검사:
  - 단위 517개 통과, 자산 50해시 통과
  - 로컬 브라우저: RGX(손 위치, 원본 inspect 6.5초, 재장착, 3번째 공격), 칼 모션, 사이트 페이지, 모바일 스킨 미리보기, 무기 상점 통과
  - 살펴보기 프레임과 확대 렌더를 직접 확인했다
- 결과: PR #127은 사용자 승인으로 `bcdec21`에 병합됐다. main CI와 Workers Builds 통과, Vercel 운영 배포 READY, 운영 manifest에서 새 model/texture 지문을 확인했다.
- 남은 조정: #126의 RGX 바이트 동일 검사는 새 SGH 모델 기준으로 갱신이 필요하다(#126 담당).


## 2026-11-04 · Codex · 황혼 지구 검증 완료 / 병합 승인 대기

- PR#130: https://github.com/Sgh1101/DFDF/pull/130 . 제품 코드394603d, 승인된 main bcdec21 통합. 이후 커밋은 이 검증 기록/문서만 정리한다. 원본 지형/충돌 해시 보존, 가로·세로1.75/높이1.25, 약361×390m, 자체 색/조명, 다층 목표·사이트·폭탄/원격 좌표 처리 완료.
- 독립 리뷰의 두 중요 지적(목표 층 유실·폭탄/구역 높이), 원격 순간이동 높이 및 미리보기/폭발 높이 보완을 모두 반영했고 최종 리뷰에 남은 지적 없다.
- 전체 단위 로컬517통과·2선택Redis제외, GitHub CI41805604486 실제Redis 포함519전부 통과·제외0. 구문206파일/자산50지문 통과. 최종 코드 고정 상태의 브라우저13종 재시도 없이 전부 통과(실행 중 소스 변경0). 실제Android/WAN/실결제 미검증.
- 상세 결과/전체 지도는 docs/superpowers/records/ascent-layout-20261104 . 총/스킨#126/#128과 기존 미커밋 worktree는 보존한다. #126은 새SGH 모델과 Claude#128 중복 작업을 다음 담당자가 다시 대조해야 한다.
- 이번 맵은 아직 main 미병합·운영 미배포. 별도 사용자 승인 후 최신 공동 작업/배포 규칙을 다시 확인한다.

## 2026-11-04 · Codex · AdSense 심사 준비 구현 중

- 기준 e104bcf, branch codex/adsense-compliance-20261104, 별도 sibling worktree. 내장 worktree 도구가 repo 경로를 허용하지 않아 git worktree로 생성. 기존 평가 메모와 Claude#128/#129·Codex#126 및 미커밋 작업은 보존.
- 범위: 홈 소개/가이드 우선 배치, 현재 자산 지문에 묶인 광고 준비 점검, 미확인 허가·신청/연령/CMP 항목 분리, 실제 문서 정합성. 챔스 미수정, 광고 OFF.
- 이전 맵 구조/나비칼 모션 유지 요청과 권리 미확인을 구분한다. 허가 질문은 답변 대기이며 임의로 승인 또는 전면 교체하지 않는다. 기본 단위 517통과/선택Redis2제외.
- 계획 docs/superpowers/plans/2026-11-04-adsense-readiness.md. main 병합/운영 배포 승인 없음.

## 2026-11-04 · Claude · 총 디자인 개편(1/18 참새) · 챔피언의 물결 · 챔스 총 B형 자체 제작 — PR #128, 병합 승인 받음

- 사용자 요청: 초월 등급을 뺀 총 18종을 실제 총처럼 하나씩 다시 만들고, 한 자루씩 검토·승인 후 다음으로 간다. 챔피언의 물결(전설) 전체 개편. 챔스 팬텀 총은 사용자가 원본 JAR(B, #115 시점) 모양을 자체 제작으로 재현하는 안을 골랐다.
- 브랜치: `claude/quirky-fermat-11wa1b` (PR #128). 기준: main `e104bcf`(#130 황혼 지구, 1d189e7 공동 작업 지침)까지 병합.
- 상대 작업 확인: Codex 열린 PR #126(챔스 입체 소총)은 #128의 챔스 총과 같은 파일(`scripts/champions-phantom/`, `assets/champions-phantom/`, `js/phantom-gun-wave.js`)을 고친다. 두 PR 중 하나만 병합해야 하며, 사용자가 #128(원본 B 모양)을 골랐다. Codex는 #126에서 챔스 총 부분을 빼거나 닫아야 한다. #129(Claude, 공개 파일 문구)·#130(Codex, 맵)과는 겹치지 않는다.
- 담당 파일: `js/gun-model-pistol.js`(새), `play.html`, `js/legacy/54-reload-animation.js`, `js/legacy/58-gun-skins.js`·`62-kill-banners.js`·`80-skin-sound-packs-…`·`96-…`·`97-…`(champion 키트만), `scripts/browser-champion.js`, `scripts/champions-phantom/gun.js`·`gun-paint.js`, 재생성 자산, `docs/CHAMPIONS_PHANTOM.md`.
- 실제 검사: 단위 517 통과, check·자산·사이트 페이지 통과, 로컬 브라우저 champion/phantom/champions-finish/phantom-kill-wave/legacy-models/weapon-shop/reload 통과, GitHub CI 7개 통과(main 병합 전 커밋 51c36eb). 실기기·실결제 미검증.
- 진행 중: 2/18 부엉이(silenced) — worktree `agent-ae9fe0e89f0548e03`, 미커밋.

## 2026-11-04 · Claude · 공개 파일의 출처 표기 정리 (PR #129) — 병합 대기

- 사용자 요청: 공개 manifest에 남은 다른 게임 이름 표기를 정리.
- 브랜치: `claude/manifest-label`. 기준은 `bcdec21`이고, 이후 main `e104bcf`(Codex #130 황혼 지구)를 합쳤다.
- 상대 작업 확인: fetch 후 main 최근 커밋, 열린 PR #126(Codex 챔스 소총)과 #128(다른 Claude 세션의 참새 권총·챔스 물결)을 확인했다. 겹치는 파일은 `assets/CREDITS.md` 하나(#130)였다. 충돌은 SGH 설명과 #130의 "황혼 지구 구조 복원" 절을 둘 다 남겨 풀었다. #126·#128과 겹치는 파일은 없다.
- 담당 파일: `assets/rgx-firefly/v1/manifest.json`(sourcePack 표기만), `assets/CREDITS.md`(SGH 절), `scripts/package-rgx-firefly.js`(표기·안내), `.vercelignore`(`*.md`를 Cloudflare와 같이 비공개).
- 실제 검사: 단위 517 통과, 자산 50지문, CSP 일치. GitHub CI는 진행 중이다.
- 다음: CI 통과 후 병합한다(사용자 승인 받음).

## 2026-11-04 · Codex · AdSense 분기 최신 main 통합
- 작업 중 origin/main이165caf3(#128/#129승인병합)로 전진했다. 겹친 .vercelignore와 이 기록은 양쪽을 유지했다. 참새·챔스 모델/음향/연출과 SGH공개문구는 main의 바이트 그대로 보존한다. 우리 변경은 광고준비/홈/안내뿐이다.
- 광고점검기가 실제 SGH manifest 문구 변경을 asset-changed로 차단함을 확인했다. 해당지문만 갱신하고 허가미확인·광고OFF는 그대로 유지했다. 전체권리검토도미완료다. #126은 #128과 겹치므로 이 PR에서 합치지 않으며 별도정리가필요하다.
- 통합후 단위/구문/자산/CSP 및 관련브라우저검사를 다시 진행한다. main병합승인 없음. 클로드의 부엉이 미반영 작업은 건드리지 않는다.


## 2026-11-05 · Codex · AdSense 심사 준비 구현·로컬 검증 완료 / PR#131
- 제품코드849e366, 최신main165caf3의Claude#128/#129보존. 홈소개/가이드우선, 기존로그인/게스트/초대유지, 광고준비점검/16파일지문/미확인권리차단, 안내정합성수정. 광고OFF이며SDK미추가. 챔스·참새·스킨파일은main과동일.
- 로컬단위521통과/2선택Redis제외, 구문207/자산50/문서CSP통과. 고정코드의브라우저8종모두통과, 재시도0/소스변경0. 독립리뷰중요/경미지적0. 실제Android/WAN/광고/결제/새전수보안미검증.
- 증거 docs/superpowers/records/adsense-readiness-20261105 . 실제계정승인/성인신청인/지역연령CMP·자산허가는외부확인대기. 광고OFF가사용권을해결하지않음. 맵구조·나비칼모션보존요청과충돌하여임의교체안함. 전체애드센스조건완료로표현하지않는다.
- PR https://github.com/Sgh1101/DFDF/pull/131 . 이시점GitHub검사진행중. 이PR의main병합/운영배포는별도승인대기. 기존평가메모·다른worktree·#126보존.

## 2026-11-05 · Codex · PR#131 CI 언어 환경 검사 보완
- GitHub의en-US초기상태를한국어로가정한새public-entry검사가실패했다. en-US컨텍스트로동일실패를로컬재현하고, ko-KR/en-US초기언어와양방향변경·메뉴재열기를명시해수정했다. 제품/홈/광고정책런타임변경없음. 네화면+JS OFF통과, 단위521통과/선택Redis2제외재확인.
- 이전GitHub전체523단위(실제Redis포함)통과, 다른브라우저검사묶음통과. 최종CI는수정테스트커밋에서다시확인한다. 권리/계정/CMP미확인과병합승인대기는변함없다.

## 2026-11-04 · Claude · 부엉이(silenced) 소음권총 실총형 재제작 — 사용자 검토 대기

- 사용자 요청: 기본 총 18종 순차 재제작 중 2번째. 부엉이를 풀사이즈 폴리머 스트라이커 9mm + 긴 원통형 소음기로 다시 만든다. 사용자 승인 후 다음 총으로 넘어간다.
- 작업 브랜치/worktree: `worktree-agent-ae9fe0e89f0548e03`(로컬, 미푸시). 기준: 승인된 참새 권총 `claude/quirky-fermat-11wa1b`, 이후 origin/main `165caf3`(#128·#129·#130 포함) 병합.
- 상대 작업 확인: `git fetch origin --prune` 후 열린 PR #126(Codex 챔스 입체 소총)·#129를 대조했다. #126은 play.html의 다른 줄(solid-geometry.js 추가)만 겹치고 충돌 없음. 미병합 codex 브랜치는 #126과 10월 15일의 `codex/reliability-home-skins`(오래됨, 열린 PR 없음)뿐이며 이번 변경 파일과 실제로 겹치는 미반영 작업은 없다.
- 담당 파일: `js/gun-model-silenced.js`(새 파일), `play.html`(스크립트 한 줄). 03-engine·54·58·챔피언스 파일·스킨 목록·무기 수치는 변경하지 않았다.
- 실제 검사(로컬): 단위 517 통과·2 Redis 선택 제외, 구문, 자산 50지문, 사이트 페이지, 브라우저 legacy-models·weapon-shop·mobile-skin-preview·improvements·graphics·startup·reload·render-cost·gun-template-memory·drop-skins. 실기기/Android 미검증.
- 다음: 사용자 외형 승인 후 병합 여부 결정. 미배포.

## 2026-11-05 · Claude · 총 개편 2/18 부엉이 통합 — PR 준비
- 사용자 승인("코덱스가 한 일 생각해서 ㄱ"). 브랜치 `claude/quirky-fermat-11wa1b`를 main `4165f84`(Codex #131 AdSense 준비)에서 다시 시작해 부엉이 커밋 `1f81298`을 병합했다.
- 상대 작업 확인: #131 diff 33파일을 읽었다. 총·챔스·play.html과 겹치지 않는다. 광고 준비 점검기(`check-ad-readiness.js`)와 고정 지문은 부엉이 변경 후에도 통과(exit 0). 열린 #126은 여전히 #128과 챔스 총이 겹쳐 별도 정리가 필요하다.
- 담당 파일: `js/gun-model-silenced.js`(새), `play.html` 한 줄.
- 실제 검사: 단위 521 통과, check 208, 자산 50, 사이트 페이지 12, 광고 준비 점검 통과. 브라우저 10종은 에이전트 worktree(main 165caf3 병합본)에서 통과.
- 다음: 3/18 황소(revolver).

## 2026-11-05 · Claude · 챔피언의 물결(전설) 실총형 총에 맞게 재설계 — 사용자 검토 대기
- 사용자 요청: 챔피언의 물결(`champion`, 전설) 스킨이 새 실총형 Axiom(pistol)·Hush(silenced)에 방패/상자처럼 붙던 문제 수정. 초월 챔피언스 팬텀(`champions_atk/def`)과 그 파일은 건드리지 않았다.
- 작업 브랜치/worktree: `worktree-agent-a66a39ac7e9e80894`(로컬, 미푸시). 기준: `claude/quirky-fermat-11wa1b` `ccdb6da`(main `4165f84` + Axiom/Hush).
- 상대 작업 확인: `git fetch origin --prune`(시작 시와 커밋 직전 두 번). origin/main은 `4165f84`(#131) 그대로, codex/* 새 커밋 없음. 열린 PR은 #126(Codex 챔스 입체 소총)과 #132(Claude Hush)뿐. #126 diff 35파일은 챔스 팬텀·play.html 다른 줄만 고치고 이번 담당 파일과 겹치지 않는다. #131의 `check-ad-readiness.js`는 변경 후에도 gateChecksPass·assetErrors 없음. 다른 worktree에서 담당 파일의 새 미커밋 변경은 찾지 못했다(Verdict 리볼버 작업 파일은 미접촉).
- 담당 파일: `js/legacy/58-gun-skins.js`(champion 정의, 금속 장갑판 무늬 `championPlate`, 금속·작은 부품 광택 코트, 밀도 기반 UV 맞춤 `fitAll`(champion만), `KITS.champion` 전면 교체, 키트 제거가 하위 그룹까지 보도록), `js/legacy/96-champions-wave-…js`(고리 크기·금 고리 지속, `userData.anchors.muzzle` 사용), `js/legacy/97-legendary-finishers-…js`(champion 하늘 0.7→0.2, 안개 0.1, 화면 가장자리만 옅게), `scripts/browser-champion.js`, `README.md`.
- 구현: 스킨은 총 자체 부품의 표면 마감(몸통=불꽃 장갑, 금속=회색·광택검정 체커 장갑판, 작은 부품=광택 검정). 덧붙는 것은 윗부분 부품에 광선을 쏴 찾은 실제 표면 위의 가는 금선·주황 빛선·작은 문장뿐이며 슬라이드에 붙어 함께 움직인다. 총마다 그리기 +2(이전 +7), 외곽 증가 최대 0.3%(이전 Axiom 높이 1.25배·폭 1.31배).
- 실제 검사(로컬): 단위 521 통과·2 선택 제외, check 208, 자산 50, 사이트 페이지 12, 광고 준비 점검 exit 0. 브라우저(한 번에 하나): champion·finisher-always·improvements·weapon-shop·mobile-skin-preview·graphics·startup·phantom·champions-finish·phantom-kill-wave 통과. render-cost는 첫 실행 1500초 시간 초과, 재실행 통과. legacy-models는 처음 두 번 `GUN_SKINS.isOpen` 대기 30초 초과, 이후 같은 코드로 3회 연속 통과(기준 ccdb6da 사본은 3/3 통과). 실기기 미검증.
- 다음: 사용자 외형 검토 후 병합 여부 결정. 미배포.
- 2026-11-05 추가: 사용자가 회색/검정 체커+불꽃 대신 완전히 새 콘셉트를 요청(참고: VCT Champions 2024 스킨의 절제된 디자인 원칙만, 모티프·로고 복제 금지). 개발용 플래그(localStorage `dfdf_champion_concept` = A|B|C)로 A 물마루(Tide Line)·B 트로피 물결(Trophy Ripple)·C 진주 물살(Pearl Surf) 세 가지를 실제 렌더로 비교 중. 플래그가 없으면 출시된 모습 그대로. origin/main `c37cf1f`(#132 Hush·Verdict) 병합. 사용자 선택 대기, 미배포.

## 2026-11-05 · Claude · 총 개편 3/18 Verdict(revolver) 실총형 재제작 — 사용자 검토 대기
- 사용자 요청: 기본 총 18종 순차 재제작 3번째. Verdict(키 `revolver`)를 6인치 풀러그 더블액션 6연발 .357 리볼버로 다시 만든다(특정 제조사 이름·로고·각인 없음). 승인 후 다음 총.
- 작업 worktree: `worktree-agent-a3ff956c11f7e2ff6`(로컬, 미푸시). 기준: main `4165f84`(Codex #131) + 승인된 참새·부엉이 `origin/claude/quirky-fermat-11wa1b`(`ccdb6da`) 병합.
- 상대 작업 확인: `git fetch origin --prune` 후 열린 PR은 #126(Codex 챔스 입체 소총)과 #132(Claude 부엉이)뿐. #126의 play.html 변경은 다른 줄(solid-geometry.js)이라 겹치지 않고, 03-engine·54·58·총 모델 파일과도 겹치지 않는다. origin/codex/* 최근 브랜치(adsense-compliance #131 병합됨, ascent-layout-restore, champions-solid-rifle)도 이번 파일과 겹치는 미반영 변경 없음.
- 담당 파일: `js/gun-model-revolver.js`(새), `play.html`(스크립트 한 줄), `js/legacy/54-reload-animation.js`(크레인 스윙·이젝터·탄두 표시·스피드로더 크기/위치·해머/방아쇠/실린더 사격 동작 추가; 기존 총 동작은 그대로). 챔스 파일·champion 키트·참새/부엉이 모델·무기 수치·가격·스킨 목록·광고 파일은 건드리지 않았다.
- 결과: 메시 66→19, 크기 0.098×0.241×0.528 → 0.073×0.264×0.510(길이 -3%, 높이 +10%, 폭은 실총 비율로 좁아짐). 총구·총열 위치 유지(섬광·예광탄 시작점 동일). 기본 마감은 스테인리스+어두운 강철 부품+검은 그립으로 1인칭에서 디테일이 보인다. 재장전: 크레인이 왼쪽으로 열리고 탄피 6개가 각 약실에서 나오며, 스피드로더가 열린 실린더에 맞춰 들어간다. 사격 때 해머·방아쇠·실린더가 움직인다.
- 실제 검사(로컬, 기준 4165f84+ccdb6da 병합본): 단위 523 중 521 통과·2 Redis 선택 제외·실패 0, check 209 스크립트, 자산 50지문, 사이트 페이지 12, 광고 준비 점검 exit 0(게이트 통과·자산 오류 0, 외부 승인 대기 항목은 기존과 동일). 브라우저(한 번에 하나씩): weapon-shop·mobile-skin-preview·improvements·graphics·startup·reload(revolver: loader, empties 6)·render-cost·gun-template-memory·drop-skins·modes2 통과. legacy-models는 첫 실행에서 모든 단언 통과 후 무기고 열기 대기 30초 시간 초과(다른 세션 렌더로 CPU 경합), 단독 재실행 통과. 실기기/Android 미검증. 미배포.
- 남은 점: 리볼버도 사격마다 탄피가 튀는 기존 효과(18-gun-effects.js, 이번 범위 밖)는 그대로다. 사용자 승인 후 다음 총(4/18).

## 2026-11-05 · Codex · 레트로 픽셀 글꼴 적용 시작
- 사용자 승인: 갈무리11을 주요 제목·라운드 알림·큰 탄약 숫자에, Pretendard를 본문·설정·작은 HUD에 적용. 기준4165f84, 작업 codex/retro-pixel-fonts-20261105. Claude#132의 play.html 추가 스크립트와 #126의 차이를 읽었고 이번 CSS/헤드 수정과 줄이 겹치지 않는다. 다른 작업 폴더의 미커밋 변경을 보존한다.
- 담당 범위: 홈·게임·안내 글꼴 및 공식 WOFF2/라이선스, 실제 브라우저 화면 검사. 기존 챔피언스 전용 서체는 해당 규칙에 따라 구분한다. 제품 병합·배포는 별도 승인 대상이다.

## 2026-11-05 · Codex · 레트로 픽셀 글꼴 구현·로컬 검증 완료
- 작업 브랜치 codex/retro-pixel-fonts-20261105. 제품 4ccc38b의 기준 main은 c37cf1f(Claude PR #132)다. 소음권총·리볼버 모델과 장전 코드는 통합 후 diff로 확인했다. #126과 다른 작업 폴더의 변경은 유지했다.
- 홈·안내와 게임의 주요 제목, 라운드 알림, 큰 탄약 숫자에 갈무리11 Bold를 적용했다. 본문, 설정과 작은 HUD에는 Pretendard Variable을 사용한다. WOFF2와 라이선스를 함께 제공하며, 챔피언스 전용 배너 서체는 별도로 적용된다.
- 로컬 단위 521개 통과, 실제 Redis가 필요한 선택 검사 2개 제외. 구문·자산 50개·생성 페이지·CSP·광고 준비 게이트를 검사했다. Chrome 글꼴, 공개 진입, 안내 페이지, 랜딩 4종 모두 재시도 없이 통과했다. 360px 홈 및 568×320 가로 인게임을 검증했다. Android 실기기 검사는 수행하지 않았다.
- 다음 작업은 GitHub PR 검사와 사용자 병합 승인이다. 운영 배포는 승인 이후의 별도 단계다.

## 2026-11-05 · Codex · 폭탄전 수비 구역과 40초 스파이크 작업 시작
- 기준 main 48c9ad9, 브랜치 codex/spike-defense-rules-20261105. 최신 Claude #132 2023f39는 main에 포함됐다. 열린 #126과 미커밋 챔피언스 작업은 총 에셋·전용 연출 범위다. 기존 worktree를 보존한다.
- 엔진의 설치·해제·전멸 판정, 호스트 스냅샷과 HUD, 전체 공개 맵의 스폰→사이트 경로, 가이드 문구 및 회귀 검사를 확인한다.

## 2026-11-05 · Codex · 폭탄전 규칙과 스파이크 표시 구현
- 기준 main 48c9ad9, Claude #132 포함. 사용자 요청에 따라 모래무덤 C를 수비 쪽의 설치 가능한 자리로 옮겼다. 공개 맵 23개의 사이트 49곳에서 설치 가능 지점을 잡고 경로를 비교했다. 모래무덤 C 중심 경로는 공격 약 188m, 수비 약 64m다.
- 설치 후 40초. 숫자 시계 자리에 빨간 진행 바가 들어간다. 공격 팀이 전멸해도 수비가 살아 있다면 해제나 폭발까지 계속된다. 방장 판정의 설치·해제·폭발과 점수가 참가자에게 전달된다. 마지막 시뮬레이션 단계에서도 만료 전에 완료된 해제만 인정한다.
- 로컬 단위 521개 통과, 선택 Redis 2개 제외. 구문·무기 자산 50개·정적 안내 생성·CSP 통과. Chrome 스파이크 40초/568×320 HUD, 방장·참가자 설치·해제·폭발 통과. 나머지 브라우저 회귀 검사 진행 중. 실제 Android 기기 및 외부 인터넷 방 검사는 수행하지 않았다.
- 사용자 병합 승인 이후에 운영 배포한다.

## 2026-11-05 · Claude · 총 개편 4/18 Tempo(machpist) 실총형 기관권총 재제작 — 사용자 검토 대기
- 사용자 요청: 기본 총 18종 순차 재제작 4번째. Tempo(키 `machpist`)를 폴리머 프레임 셀렉트 파이어 9mm 기관권총으로 다시 만든다(특정 제조사 이름·로고·각인 없음). 승인 후 다음 총.
- 작업 worktree: `worktree-agent-ae4c76018da08d58e`(로컬, 미푸시). 기준: main `4165f84`(Codex #131) + 승인된 Axiom·Hush·Verdict `origin/claude/quirky-fermat-11wa1b`(`2023f39`, fast-forward).
- 상대 작업 확인: `git fetch origin --prune` 후 열린 PR은 #126(Codex 챔스 입체 소총)과 #132(Claude Hush·Verdict). #126의 play.html 변경은 다른 줄(solid-geometry.js)이라 겹치지 않고, 이번 파일과 겹치는 미반영 Codex 변경은 없다(최근 codex/* 브랜치: adsense-compliance #131 병합됨, ascent-layout-restore, champions-solid-rifle). 챔피언의 물결 스킨(58·96·97)은 다른 세션 담당이라 건드리지 않았다.
- 담당 파일: `js/gun-model-machpist.js`(새), `play.html`(스크립트 한 줄). `js/legacy-gun-models.js`의 옛 machpist는 그대로 두고 뒤에 로드되는 새 파일이 `GUN_BUILD.machpist`를 대체한다. 챔스 파일·champion 키트·다른 총 모델·무기 수치·가격·스킨 목록·광고 파일은 건드리지 않았다.
- 설계: 상단 보정 컷 3개와 광학 컷이 있는 슬라이드, 오픈 에미터 레드닷, 슬라이드 왼쪽 뒤의 조정간, 슬라이드 폭 3실 보정기, 손가락 홈 그립, 레일 앞 핸드 스톱, 그립 아래로 길게 나온 33발 탄창과 넓은 베이스플레이트. 기본 마감은 FDE 프레임 + 텅스텐 회색 슬라이드 + 스테인리스 보정기 + 검은 광학·소부품.
- 결과: 메시 41→16, 크기 0.060×0.326×0.366 → 0.049×0.338×0.393(길이 +7%, 높이 +4%, 폭은 실총 비율로 좁아짐). 보정기 앞면이 옛 총구 위치(z -0.276)이고 `anchors.muzzle`도 그곳(3인칭 섬광·예광탄). 슬라이드·광학·조정간이 한 그룹으로 사격·연사마다 후퇴하고 재장전 때 당겨진다. 탄창은 mag() 4부품(몸통·베이스플레이트·구멍·맨 위 탄)으로 통째로 빠진다. `browser-legacy-models.js` 단언은 바꾸지 않았다.
- 통합: 작업 중 origin/main이 `1a5068a`(Claude #132 병합, Codex #133 글꼴·#134 폭탄전 규칙)로 전진해 병합했다. 겹친 파일은 play.html(다른 줄)과 이 기록(양쪽 유지)뿐이고 총 코드와 겹치지 않는다.
- 실제 검사(로컬): 병합 전 단위 523 중 521 통과·2 Redis 선택 제외·실패 0, check 210, 자산 50, 사이트 페이지 12, 광고 준비 exit 0, 브라우저(하나씩) legacy-models·weapon-shop·mobile-skin-preview·improvements·graphics·startup·reload·render-cost·gun-template-memory·drop-skins 모두 통과. main 병합 후 단위·check·자산·사이트 페이지·광고 준비와 legacy-models·reload 재실행 통과. 실기기/Android 미검증. 미배포·미푸시.
- 남은 점: 실총 폭(슬라이드 25.5mm)을 옛 길이에 맞추니 1인칭에서 옛 뭉툭한 모델보다 가늘어 보인다. 사용자 승인 후 다음 총(5/18).

## 2026-11-05 · Claude · 챔피언스 팬텀 디자인 결정 기록 — 사용자 결정

- 사용자 결정: 챔피언스 팬텀은 **#128(이미 main에 병합된 현재 디자인)을 유지**한다. Codex #126(챔스 입체 소총)은 쓰지 않는다.
- 근거: 사용자가 같은 조건(같은 손·조명·각도, 공격/수비, 1인칭)으로 찍은 두 안의 사진을 비교한 뒤 직접 골랐다. 확인 기준은 main `1a5068a`, #126 `0cd1cec`이다.
- 요청: #126은 닫아 달라. Claude가 PR 닫기를 시도했지만 이 세션의 권한 검사에서 막혔다. #126에만 있는 공동 작업 지침은 이미 main(`1d189e7`)에 들어 있다. #126 브랜치의 다른 변경을 다시 쓰려면 사용자에게 먼저 확인한다.
- 이전 기록 정리: SGH나비칼 항목의 "#126의 RGX 해시 검사 갱신 필요"는 #126을 쓰지 않으므로 더 이상 할 일이 아니다. #129(출처 표기)는 `ac757fd`로 병합·배포되었다.

## 2026-11-05 · Claude · 챔피언의 물결 물마루(Tide Line) 확정안 — 사용자 검토 대기
- 사용자 요청: 세 콘셉트 중 A(물마루)를 고르고 더 밝고 세련되게. 개발용 콘셉트 플래그와 B·C 코드는 지웠다.
- 작업 브랜치/worktree: `worktree-agent-a66a39ac7e9e80894`(로컬, 미푸시). origin/claude/quirky-fermat-11wa1b `538ec1f`(main `a09e677` + Tempo #136)를 병합했다.
- 상대 작업 확인: `git fetch origin --prune`. 열린 PR은 #136(Claude Tempo, 병합해 렌더에 포함), #137(Codex SGH 나비칼 모션·소리, 담당 파일과 겹치지 않음), #138(Claude SGH 색: `58-gun-skins.js` 62~70줄의 칼 스킨과 README 57줄의 "601개"→"604개"). 이 작업은 58의 그 줄들을 건드리지 않는다. README 57줄은 양쪽이 고치므로 나중에 병합되는 쪽이 그 줄에서 이쪽 설명 + "604개"로 맞추면 된다. #126은 #135 기록대로 쓰지 않는다.
- 구현: `champTide` 무늬(밝은 트와일라잇 바탕, 선명한 광택 금 물결선, 부드러운 보라·분홍 빛, 옅은 두 번째 물결과 윤기). `spineOf`로 총마다 윗부분 부품을 찾아 물결 높이·크기를 정하고, 무늬는 총 자기 좌표에 투영(가로:세로 2.5:1로 선 굵기 일정). 장식은 금선·라일락 빛선·분홍 보석 2메시. 고리·피니셔 변경(2e6c5e7)은 그대로.
- 실제 검사(로컬, a140a52): 단위 523 중 521 통과·2 선택 제외, check 210, 자산 50, 사이트 페이지 12, 광고 준비 점검 exit 0. 브라우저 12종(champion·finisher-always·improvements·weapon-shop·legacy-models·mobile-skin-preview·graphics·render-cost·startup·phantom·champions-finish·phantom-kill-wave) 한 번에 하나씩 모두 통과. 그 전 판(금속·작은 부품에도 물리 재질 코트)은 legacy-models가 3번 중 2번 무기고 열기 대기 30초 초과로 실패했고(같은 때 기준 사본은 2/2 통과), 셰이더 수를 줄인 뒤 3/3과 전체 묶음에서 통과했다. 이후 Tempo 브랜치의 정조준 가늠쇠 앵커(cba5a4d)를 병합하고 champion·legacy-models를 다시 확인했다. 실기기 미검증. 미배포.


## 2026-11-05 · Claude · 실총형 권총 4종 정조준(ADS) 가늠쇠 정렬 — 로컬 완료, 미푸시
- 사용자 승인: 새 실총형 모델(Axiom·Hush·Verdict·Tempo)에서 정조준 때 가늠쇠/레드닷이 화면 중앙보다 약 30px 아래에 있던 문제를 고친다.
- 작업 worktree: `worktree-agent-acd1811b98bda6b2e`(로컬). 기준: main `a09e677` + Tempo `origin/claude/quirky-fermat-11wa1b`(`538ec1f`, PR #136) 병합.
- 상대 작업 확인: `git fetch origin --prune` 후 열린 PR #136(Tempo), Codex #137(SGH나비칼 뼈대·모션·소리), Claude #138(SGH나비칼 색) 파일 목록을 읽었다. 03-engine·총 모델 파일과 겹치지 않는다(#138의 58-gun-skins.js 칼 항목은 손대지 않음). origin/codex/* 최근 브랜치도 이번 파일과 겹치는 미반영 변경 없음.
- 담당 파일: `js/legacy/03-engine.js`(vmWithHands가 `userData.anchors.sight`를 읽고, tickViewmodel이 정조준 때 그 점을 화면 중심선에 둔다), `js/gun-model-{pistol,silenced,revolver,machpist}.js`(각 `anchors.sight` 한 줄). 앵커가 없는 다른 총은 기존 고정 자세(0, -0.075, -0.72) 그대로. FOV·전환·흔들림/반동·저격/지정사수 스코프·손 위치·3인칭은 변경 없음. 58·96·97·pocketshot 미수정.
- 앵커: Axiom 앞 점(y 3.3mm, 뒤 점 3.4mm와 수평), Hush 앞 점(7.4mm), Verdict 앞 블레이드 윗면 뒤끝(23.2mm, 가늠자 노치 윗면 23mm), Tempo 레드닷 중심.
- 측정(투영 위치, 중앙 기준 아래쪽 +): 1280×720 Axiom 32.5→0, Hush 28.8→0, Verdict 26.8→0, Tempo 37.2→0px. 852×393 17.7/15.7/14.7/20.3→0px. Strife(소총) 자세 동일.
- 실제 검사(로컬): 단위 523 중 521 통과·2 Redis 선택 제외, check 210, 자산 50, 사이트 페이지 12, 광고 준비 exit 0. 브라우저(하나씩): aim·improvements·reload·graphics·startup·rifle-identity 통과, legacy-models는 무기고 열기 대기 30초 시간 초과가 반복된 뒤(기준 커밋에서도 같은 대기가 20초를 넘김을 확인) 재실행 통과. followup은 ADS 단계 전의 첫 단언(GAME_CATALOG.counts에 새 `guns:18` 키)에서 실패 — 이번 변경과 무관, 기존 상태. 실기기/Android 미검증. 미배포·미푸시.

## 2026-11-05 · Claude · 총 개편 5/18 Breach(pocketshot) 실총형 재제작 — 사용자 검토 대기
- 사용자 요청: 기본 총 18종 순차 재제작 5번째. Breach(키 `pocketshot`)를 권총 손잡이의 짧은 수평 쌍대 중절식 산탄총(코치건/소드오프형, 특정 제조사 이름·로고·각인 없음)으로 다시 만든다. 승인 후 다음 총.
- 작업 worktree: `worktree-agent-a4ac8c01a923840ed`(로컬, 미푸시). 기준: origin/main `1a5068a`(Codex #133 글꼴·#134 스파이크 규칙 포함) + 승인된 Axiom·Hush·Verdict·Tempo `origin/claude/quirky-fermat-11wa1b`(`1419dfb`, fast-forward).
- 상대 작업 확인: `git fetch origin --prune` 후 열린 PR은 #126(Codex 챔스 입체 소총, 건드리지 않음)·#135(Claude 기록)·#136(Claude Tempo). #133/#134는 글꼴·스파이크 파일로 이번 파일과 겹치지 않는다. 다른 세션이 챔스 스킨(58·96·97)과 ADS 조준선(모델 `userData.anchors.sight`, 뷰모델 코드)을 동시에 고치므로 그 파일은 건드리지 않고 모델에 `anchors.sight`만 넣는다.
- 담당 파일: `js/gun-model-pocketshot.js`(새), `play.html`(스크립트 한 줄), `js/legacy/54-reload-animation.js`의 break 분기(모델이 `userData.reload`로 약실 위치·탄 크기를 주면 그 약실에 맞춰 넣고 빼며, 없으면 기존 동작 그대로).
- 통합: 작업 중 Tempo 브랜치가 `cba5a4d`(ADS 가늠 기준점 `anchors.sight`를 03-engine이 읽음)로 전진해 다시 병합했다. 이 모델의 `anchors.sight`는 리브 위 가늠쇠(구슬) 꼭대기 높이의 조준선 위 점이며, ADS에서 구슬이 화면 중앙(1920×1080에서 약 955,545)에 오고 두 공이치기 사이로 보인다.
- 설계: 12게이지 수평 쌍대, 205mm로 잘라낸 총열(밝게 다듬은 절단면, 두 총구), 상부 리브와 황동 구슬, 바닥 리브, 경첩 너클과 핀, 둥근 펜스, 탑 레버(청화), 외부 공이치기 2개, 긴 방아쇠울과 2단 방아쇠, 짧은 스플린터 포엔드와 철물·래치, 체커링 패널이 있는 경사 호두나무 손잡이와 강철 캡, 조각 무늬 측판. 기본 마감은 케이스 하드닝(얼룩 색) 기관부 + 짙은 청화 총열 + 호두나무로 대비가 강하다. 스킨 역할은 GUNMAT 종류 그대로(나무=body, 기관부·측판=steel/metal, 방아쇠·핀·총구면=chrome/metal, 총열·울·레버·캡=blued/dark). 총강만 스킨이 바꾸지 않는 검은 무광.
- 결과: 메시 28→14, 크기 0.092×0.250×0.415 → 0.066×0.202×0.431(길이 +4%, 높이 -19%, 폭 -29%: 실총 비율). 총구 위치 유지(z -0.32, 섬광은 오른쪽 총열). 재장전: 총열이 경첩에서 0.55rad 꺾이고 빈 탄피 두 개가 실제 약실에서 튀어나오며, 새 탄 두 발이 약실 축을 따라 들어가 장착된 채 닫힐 때까지 보인다.
- 실제 검사(로컬, 병합본 3f97b25 기준): 단위 523 중 521 통과·2 Redis 선택 제외·실패 0, check 211 스크립트, 자산 50지문, 사이트 페이지 12, 광고 준비 점검 exit 0. 브라우저(한 번에 하나씩): legacy-models·weapon-shop·mobile-skin-preview·improvements·graphics·startup·reload(pocketshot: break, pair, 0.55rad 후 복귀 0)·render-cost·gun-template-memory·drop-skins 모두 통과. 실기기/Android 미검증. 미배포.
- 남은 점: 3인칭 손에 든 모습은 요원 팔 블록에 대부분 가려 검사 사진에서 잘 안 보인다(Tempo와 같은 촬영 한계). 공이치기는 사격 때 움직이지 않는다(검사가 동작 종류를 ['break']만 허용). 열린 PR #137~#143의 play.html 변경은 다른 줄이라 겹치지 않는다.

## 2026-11-05 · Claude · 운영자 카드(권총 칸) 추가

- 기준 main `a09e677`, 브랜치 `claude/operator-card`. 최근 Codex 작업을 먼저 확인했다. 확인한 것: #137(나비칼 모션, 열림), #134(스파이크), #133(글꼴), #131(광고 게이트). 이 작업은 새 모듈 하나(`js/legacy/125-operator-card.js`)와 로드 목록만 바꾸므로 겹치지 않는다.
- 동작:
  - 운영자 또는 소유자는 시작 권총 대신 카드를 듭니다.
  - 좌클릭으로 가장 가까운 적 한 명을 무조건 처치합니다. 방어구, 보호막, 무적도 무시합니다. 0.6초에 한 번 던질 수 있습니다.
  - 랭크전에서는 꺼집니다.
- 멀티플레이:
  - 방장이 판정합니다. 게스트는 서버가 확인한 운영자일 때만 카드를 받습니다(`HUNTX.OWNP`). 일반 게스트가 카드를 억지로 들어도 아무도 죽지 않습니다.
  - 카드가 날아가는 연출(`opcard` 이벤트)은 모두에게 보입니다.
- 상점, 스킨 목록, 개수에는 나오지 않습니다. 황금 권총처럼 숨긴 무기입니다.
- 검사: `test:operator-card`(혼자: 운영자 vs 일반, 온라인: 일반 방장 + 운영자 게스트 + 일반 게스트) 통과. 실기기는 검증하지 않았다. 사용자 요청에 따라 병합하지 않고 브랜치 푸시만 한다.

## 2026-11-05 · Claude · 홈 소식 칸 → AdSense 광고 칸 (사용자 요청)

- 기준 main `a09e677`, 브랜치 `claude/home-adsense`. 먼저 Codex 작업을 확인했다. #131(광고 준비 게이트 `scripts/check-ad-readiness.js`, `js/advertising-policy.js`, `ads-config.json`), #133(글꼴), #134(스파이크)가 병합되어 있고, #137은 열려 있다.
- 사용자 지시: "홈 화면 옆 소식 보기(지난 소식 등) 영역을 없애고, 소식은 공지로 충분하니 그 자리에 애드센스 광고를 넣어 줘. CSP도 허용해 줘."
- 바꾼 것:
  - play.html 홈 오른쪽 열을 바꿨다.
    - 뺀 것: 새 맵 카드, 플레이 안내, 지난 소식 보기. `js/home-newmap.js`와 `css/home-newmap.css`는 지웠다. `js/home.js`의 안내 채우기도 뺐다.
    - 넣은 것: `<aside class="tt-ad">` 광고 칸 하나, head의 AdSense 스크립트(사용자가 준 코드 그대로), `js/home-ad.js`와 `css/home-ad.css`.
  - 광고 칸 동작:
    - 디스플레이 광고 단위 번호(`data-ad-slot`)가 있고 칸이 보일 때만 한 번 요청한다. 칸은 넓이 1181px 이상, 높이 561px 이상일 때 보인다.
    - 단위 번호가 없거나 광고가 채워지지 않으면(unfilled) 칸을 숨긴다.
    - **단위 번호는 아직 비어 있다. 사용자가 AdSense에서 디스플레이 광고 단위를 만들면 넣는다.**
  - Codex 게이트와 맞춘 방식:
    - 게이트는 그대로 두고, `ads-config.json`에 `userApprovedIntegrations: ["play.html"]`을 더했다.
    - 승인 목록에 없는 파일에 광고 코드가 들어가면 여전히 게이트가 실패한다. 이 경우를 확인하는 테스트를 더했다.
    - `advertising-policy.js`(글 페이지 광고 판정)는 손대지 않았다.
  - CSP:
    - `scripts/build-csp.js`의 AD 목록에 AdSense 호스트를 넣었다. googlesyndication, doubleclick, adtrafficquality, google.com, fundingchoicesmessages가 들어간다. 이미지는 https 전체를 허용한다.
    - 지금은 report-only라 아무것도 막지 않는다. enforce로 바꾸기 전에 콘솔 보고를 확인해야 한다.
  - 테스트 픽스처는 Google 광고 호스트를 차단한다. 테스트가 외부에 의존하지 않게 하기 위해서다.
- 검사:
  - 단위 522 통과, 2 건너뜀. check 통과, CSP check 통과, 광고 준비 점검 gateChecksPass true.
  - 브라우저: 새 테스트 `test:home-ad` 통과. 확인한 것: 단위 번호가 없을 때 칸이 없음, 있을 때 1회 요청과 위치, unfilled일 때 숨김, 좁은 화면에서 넓혔을 때 요청. `test:ui-fixes`도 통과.
  - 실제 AdSense 송출은 검증하지 못했다(사이트 승인과 단위 번호 대기). 병합하지 않고 브랜치 푸시만 한다.

## 2026-11-05 · Claude · 캐릭터 이름 글꼴 교체 (사용자 요청)

- 기준 main `a09e677`, 브랜치 `claude/readable-names`. 먼저 Codex #133(레트로 픽셀 글꼴: 갈무리11 + Pretendard)을 확인했다. 그 뒤 새 Codex 커밋은 없다.
- 사용자 지시: "글꼴을 바꿔 줘. 지금 글꼴은 캐릭터 이름이 이상하게 나와서 구분이 안 돼. 이름이 잘 구분되는 글꼴로."
- 바꾼 것:
  - 요원 이름(홈 `.tt-name`, 선택 카드 `.acard-name`, 상세 `.det-name`), 한글 제목(`.sel-top h2`, `.ov-head`, 사이트 h1), 라운드 배너, 처치 문구는 Pretendard Variable 800(굵게)으로 바꿨다. 새 변수는 `--ui-display-font`다.
  - 갈무리11 픽셀 글꼴은 글자를 구분할 필요가 없는 곳에만 남겼다. 남긴 곳은 "13" 로고(`.title-mark`, `.logo`, `.sh-logo`)와 큰 탄약 숫자(`#am-count`)다.
  - 챔피언스 전용 처치 연출 글꼴(Orbitron/Noto Sans KR)은 그대로 두었다.
  - 새 글꼴 파일은 추가하지 않았다. 이미 함께 제공되는 Pretendard를 쓴다.
- 검사:
  - Codex의 `test:soft-fonts`에서 기대값만 새 배치에 맞게 바꿨고 통과했다. 이름과 제목은 Pretendard 800, 로고와 탄약은 갈무리11이다.
  - 홈과 요원 선택 화면을 1280×720으로 찍어 이름을 확인했다.
  - 병합하지 않고 브랜치 푸시만 한다.

## 2026-11-05 · Claude · 멀티플레이 치트 능력 세트 바꾸기 버그 (사용자 제보)

- 기준 main `a09e677`, 브랜치 `claude/mp-cheat-ability`. 먼저 Codex 작업을 확인했다. 관련 파일(`25-admin-panel.js`, `43-cheat-hunt.js`, `47-owner-controls.js`, `55-*.js`)을 바꾼 열린 Codex PR은 없다.
- 제보: "멀티플레이에서 치트 권한으로 능력을 바꾸면 랙이 걸리면서 능력이 안 바뀐다."
- 원인(재현함):
  - 게스트가 치트를 켜고 세트를 고를 때, 방장이 아직 서버 확인을 받지 못했으면 방장은 그 `kit` 요청을 버린다(43의 필터). 서버 확인은 운영자 확인(own-ok)이나 계정 치트 표(perm-ok)를 말한다. 게스트는 이 확인을 기다리지 않고 치트 칩을 바로 쓸 수 있다.
  - 확인이 온 뒤 게스트는 스위치(`padm`)만 다시 보내고 고른 세트는 다시 보내지 않았다. 방장도 게스트에게 세트 결과를 알려 주지 않았다.
  - 그 결과 게스트 화면에는 새 능력이 보이지만 방장은 원래 능력을 시전했다. 게스트가 예측한 상태는 방장 상태로 계속 되돌려졌다. 사용자가 말한 "랙 + 안 바뀜"이 이것이다.
- 고친 것(`js/legacy/25-admin-panel.js`):
  - 게스트는 스위치를 보낼 때마다 지금 고른 세트도 함께 보낸다(`sendKit`). 요청에는 번호를 붙인다.
  - 방장은 게스트 몸의 세트를 바꿀 때마다 그 게스트에게 `kit` 이벤트로 알린다. 수락, 치트 꺼짐, 라운드 초기화, 운영자 회수 모두 해당한다.
  - 게스트는 방장의 말을 따른다. 단, 더 오래된 요청에 대한 답은 무시한다.
- 검사:
  - 새 테스트 `test:guest-kit`는 고치기 전 실패, 고친 뒤 통과한다. 확인하는 것: 방장의 서버 확인을 늦춘 상태에서 운영자 게스트가 먼저 세트를 고름, 확인 뒤 방장과 같은 세트, 시전도 같은 능력, 계정 치트 게스트, 방장이 되돌리면 게스트도 따라감.
  - 따로 28개 세트 전부를 실제 방향키로 바꾸고 3개씩 시전해 봤다. 전부 동기화되고 step 시간도 정상이었다.
  - followup, perm-ticket, ranked-flow 통과. followup의 첫 줄은 main에서도 실패하던 오래된 기대값(목록에 `guns: 18`이 추가됨)이라 함께 고쳤다.
  - 단위 테스트 통과. 실제 인터넷 방에서는 검증하지 않았다. 병합하지 않고 브랜치 푸시만 한다.

## 2026-11-06 · Claude · #140~#143 통합 PR (사용자: "해, 코덱스가 한 일 생각하고")

- 기준 main `a09e677`, 브랜치 `claude/batch-1106`. 운영자 카드 #140, 홈 광고 #141, 이름 글꼴 #142, 치트 세트 #143을 하나로 합쳤다. 서로 겹친 곳은 이 기록 파일 끝뿐이라 양쪽 기록을 모두 남겼다.
- Codex 열린 PR과 겹치는지 확인했다.
  - #137(나비칼 모션): `scripts/check-ad-readiness.js`가 #141과 겹친다. #137은 소리 파일 이름 목록만 바꾸고, #141은 사용자 승인 예외(`userApprovedIntegrations`)만 더한다. 자동 병합이 된다(git merge-tree로 확인).
  - #139(축소전 시작 위치): 기록 파일만 겹친다.
  - 두 PR 모두 이 PR이 들어간 뒤에는 기록 파일 끝만 다시 맞추면 된다.
- 이 세션의 권한 검사가 PR 병합을 막았다(검토 없는 병합). 그래서 사용자가 이 PR 하나를 병합하면 된다. 병합되면 #140~#143은 같은 커밋이 main에 들어가 병합된 것으로 표시된다.

## 2026-11-06 · Claude2 · 총 개편 6/18 Rush(smg) 실총형 재제작 — 사용자 검토 대기

- 사용자 지시: "하던 작업 보고 마저 진행해, 깃허브 잘 살피고". 인수인계 두 개를 읽었다. #145의 `docs/HANDOFF_CLAUDE1_2026-11-06.md`와 #146의 `docs/HANDOVER_GUN_REDESIGN_20261106.md`다. #146 3절의 Rush 지시(사용자가 붙여 넣은 것)를 따라 main에서 새로 만든다. 원격에는 이전 Rush 커밋이 없다.
- 브랜치 `claude/adoring-dijkstra-n9rtaj`. 기준 main은 `c4241cd`(#144)다.
- 상대 작업 확인: `git fetch origin --prune`과 GitHub 열린 PR을 확인했다.
  - Codex #137(나비칼 모션)과 #139(축소전 시작 위치)는 main과 작업 기록 파일만 충돌한다.
  - Claude #138은 #137 위에 쌓인 PR이다. README, `_headers`, `cloudflare/csp.mjs`, `vercel.json`, 작업 기록이 main과 충돌한다.
  - #145(광고 단위 번호, 인수인계)와 #146(Grok 인수인계)도 열려 있다.
  - 이번 담당 파일(`js/gun-model-smg.js` 새 파일, `play.html` 한 줄, 필요하면 뷰모델·재장전 코드의 새 총 전용 분기)과 겹치는 열린 변경은 없다. #137의 `sw.js` 변경은 건드리지 않는다.
- 챔피언스 파일, champion 키트, 다른 총 모델, 무기 수치·가격·스킨 목록, 광고 파일은 건드리지 않는다. 병합·배포하지 않는다.
- 구현:
  - `js/gun-model-smg.js`(새): 롤러 지연식 9mm 기관단총이다. 밝은 회색 프레스 강판 몸통에 보강 홈과 용접 점이 있다. 고리 가늠쇠와 드럼 가늠자가 한 조준선에 있다. 홈 3줄의 폴리머 총열덮개, 손가락 굴곡과 둥근 등판·질감이 있는 날렵한 손잡이, 휜 30발 강철 탄창, 앞뒤 멜빵 고리, 밀핀, 끝마개 이음새, 두 줄 신축 개머리판이 있다. 상표·로고·각인은 없다. 메시 22개, 길이 0.706이다(검사 범위 0.6~0.8).
  - 개머리판은 1인칭에서만 190mm 접힌다(`userData.firstPerson`). 3인칭, 떨어진 총, 무기고는 펼친 모습이다.
  - 왼손은 총열덮개 뒤, 탄창 삽입구 앞에 둔다. 가늠쇠·총열덮개·총구를 가리지 않는다.
  - 재장전 때 왼손이 앞쪽 장전 손잡이를 잡아 104mm 당겼다가 놓는다(`legacyAction: "charge"`).
  - 1인칭 총구 불꽃은 이 총의 총구에서 나온다(`userData.fpFlash`). 옛 총은 그대로 눈 위치다.
  - 표면 무늬는 이 총 전용의 이음매 없는 무늬다. 공용 무늬의 타일 테두리와 네모 얼룩 때문에 생기던 네모 자국이 없다. 옛 총은 그대로다.
- 바꾼 공용 파일(새 총이 요청할 때만 동작): `js/legacy/54-reload-animation.js`(1인칭 부품 이동, 장전 손잡이), `js/legacy/18-gun-effects.js`(1인칭 총구 불꽃), `play.html` 한 줄, `package.json`의 `test:rush`.
- 실제 검사(로컬):
  - 단위 524개 중 522 통과, Redis 선택 2개 제외, 실패 0. check 213 스크립트, CSP check, 자산 50지문, 사이트 페이지 12, 광고 준비 점검 exit 0.
  - 브라우저(한 번에 하나씩): legacy-models, reload, weapon-shop, mobile-preview, improvements, aim, graphics, startup, gun-memory, drop-skins, render-cost, champion, finisher-always, 새 `test:rush` 모두 통과.
  - `test:rush`가 확인하는 것: 1인칭에서만 개머리판 접힘, 왼손이 가늠쇠보다 뒤, 정조준 시 가늠쇠 끝과 드럼 구멍이 화면 중앙(오차 0px), 재장전 시 손잡이 0.104 후퇴와 손 위치 오차 0.4mm 뒤 원위치, 불꽃이 총구에서 나옴(카메라가 움직인 프레임 포함), 옛 총 불꽃은 그대로.
  - 이전/새 비교 사진을 직접 찍어 확인했다. 실기기·Android는 검증하지 않았다.
- 남은 점: 정조준 때 접힌 개머리판 끝이 드럼 아래쪽 화면 일부를 가린다(이전 Rush의 몸통 뒤쪽도 같은 자리를 가렸다). 화면 가운데의 녹색 조준 고리(CSS)는 모든 총 공통이라 그대로 두었다. 사용자 외형 승인 후 7/18 Veil.

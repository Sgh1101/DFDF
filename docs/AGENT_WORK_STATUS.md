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

## 2026-11-04 · Claude · SGH나비칼 (RGX 나비칼의 모양·텍스처·이름 교체) — PR 대기

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
- 다음: PR, CI, 사용자 병합 승인.

## 다른 담당자가 이어받을 때

이 기록을 읽고 실제 원격·PR·worktree를 새로 확인한다. 같은 파일을 수정해야 하면 기존 diff와 사용자 지시를 먼저 대조한다. 완료한 내용을 새 담당자의 항목에 추가하고, 위 진행 기록을 임의로 완료 처리하지 않는다.

# Champions Solid Rifle Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans; implement tasks in this session. User delegated implementation choices.

**Goal:** 입체적인 자체 챔스 소총 모델과 실제 렌더 검토본을 만든다.
**Architecture:** 선택된 자체 부품에만 베벨/원통 메시를 적용하고 기존 본·UV 아틀라스·스킨 경로를 유지한다. 페인터에 삼각형별 부품/면 식별자를 전달한다.
**Tech Stack:** 기존 Three.js, Node.js, 절차적 PNG 페인터. 새 의존성 없음.
**Spec:** `docs/superpowers/specs/2026-11-04-champions-solid-rifle-design.md`

## Global Constraints
- 기존 17개 본/피벗, 총구 [41.25,0,0], 512px 아틀라스, 부품 <=240, 정점 <=15000.
- RGX/일반 큐브와 모션·재화·보유·장착 대상·오디오·배너·마무리를 보존한다.
- 별도 작업 브랜치. main 병합은 완성 후 별도 승인.

## Review Focus
- 얇은 부품/과도한 베벨 반경에서 유한 정점과 바깥 방향 법선을 유지한다.
- 속 빈 원통의 앞면이 막히거나 UV가 아틀라스 밖으로 나가지 않는다.
- 기존 큐브/RGX의 정점과 UV는 바뀌지 않는다.
- 표면 맵을 색 텍스처로 읽어 금속/고무가 잘못 빛나지 않는다.
- 사라진 캐시/회색 대체 모델 없이 두 변형의 모션과 물결이 동작한다.

## Task 1: Solid geometry and atlas metadata
- [ ] `tests/solid-geometry.test.js`: 베벨 다방향 법선, 경계, 원통 앞면 구멍, UV 범위, legacy cube 보존 실패 검사 작성/RED 확인.
- [ ] `js/solid-geometry.js`: `build(T,cube,desc)`가 자체 bevel/cylinder/tube 메시와 face 식별자를 생성한다.
- [ ] `js/bedrock-rig.js`, `scripts/champions-phantom/model.js`, `play.html`: 선택적 솔리드 로드, 부품/면 식별자 전달, JSON 보존. 위 검사 GREEN.

## Task 2: Own rifle and surface response
- [ ] `tests/champions-solid.test.js`: 닫힌 개머리판·몸통 두께·원통/베벨 존재·고정 피벗·정점 예산 실패 검사 작성/RED 확인.
- [ ] `scripts/champions-phantom/gun.js`, `gun-paint.js`, `build.js`: 실제 소총 비율의 자체 형상과 두 변형 및 거칠기/금속성 맵 생성.
- [ ] `js/champions-phantom.js`, `phantom-assets.js`: 표면 맵을 linear data로 읽고 캐시 버전 갱신. 생성물 재생성 후 단위 GREEN.

## Task 3: Actual render and regression
- [ ] 기존 실제 무기고/인게임 경로 탐색 후 `scripts/browser-champions-concept.js`의 정점/표면 맵·시점 검증 갱신, 실 렌더 캡처.
- [ ] 전체 단위·구문·자산·CSP, 자체 기본/모션/물결/소리/마무리·RGX·모바일 미리보기 검사.
- [ ] 실패 수정, 독립 코드 검토, 실제 렌더 이미지와 한계를 기록해 PR 작성. main 병합 승인 전 서비스 반영 안 함.

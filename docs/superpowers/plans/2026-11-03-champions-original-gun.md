# Champions Original Gun Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기본 챔피언스 총 외형을 사용자가 선택한 JAR 원본의 형상·비율·색으로 복원한다.

**Architecture:** 원본 다섯 파일과 해시를 빌드 입력으로 보존하고 기존 패키지 생성기에서 그대로 복사한다. 런타임 리그·장착 계약을 유지하며 색 판정·검증·출처 설명을 맞춘다.

**Tech Stack:** Node.js, Three.js, 기존 Bedrock 리그, node:test, Playwright.

**Spec:** ../specs/2026-11-03-champions-original-gun-design.md

## Global Constraints

- 원본 33개 뼈대·878개 큐브·피벗·회전·512×512 UV와 기본/발광 PNG 바이트 보존.
- 장착 대상 팬텀(scout), 보유·구매·코인·성능 계약 유지.
- 음악·마무리·배너와 현재 게임 모션은 이번 총 외형 수정 범위에 포함하지 않는다.
- Java 실행과 다른 worktree 수정 없이 격리 브랜치에서 작업한다.

## Review Focus

- 이전 설치 모델/텍스처가 새 manifest와 섞이지 않아야 한다.
- 양쪽 스킨의 UV·색·발광·처치 물결이 함께 작동해야 한다.
- 빈 부착 뼈대도 장착·장전·발사 모션에서 보존해야 한다.
- 휴대폰 미리보기/1인칭에서 전체 모델이 유한한 크기로 표시돼야 한다.
- 재생성 결과가 원본 파일 및 나머지 생성 자산과 재현돼야 한다.

### Task 1: 원본 외형을 재현 가능한 기본 패키지로 제공

**Files:** scripts/champions-phantom/source-gun/, source-gun.js, build.js, sync-wave.js, tests/champions-source-gun.test.js, assets/champions-phantom/dfdf-1/.

- [ ] 원본 다섯 파일과 SHA-256을 보존하고 배포 팩 불일치 실패 검사를 실행한다.
- [ ] 빌드에서 원본 바이트를 검증·복사하고 원본 처치 물결 색표를 사용한다.
- [ ] 자산/재현성/모션 단위 검사를 통과시킨다.
- [ ] 출처·제작 경로를 업데이트하고 커밋한다.

### Task 2: 실제 렌더와 팩 전환 확인

**Files:** scripts/browser-phantom.js, scripts/browser-champions-concept.js, docs/CHAMPIONS_PHANTOM.md.

- [ ] JAR 업로드 시 이전 모델을 성공으로 오인하지 않는 준비 조건을 추가한다.
- [ ] PC·휴대폰 공격/수비 외형, 장착/장전/발사, 처치 물결과 모델 전환을 확인한다.
- [ ] 전체 단위 및 관련 브라우저 검사를 실행하고 화면·한계를 기록한다.
- [ ] 푸시 후 최신 main/클로드 확인, 검토·배포를 진행한다.

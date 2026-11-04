# Ascent Layout Restore Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans; implement in this session. User delegated implementation choices.

**Goal:** 원본 어센트의 구조와 큰 공간을 복원하고 자체 황혼 지구 외형으로 표시한다.
**Architecture:** 기존 schematic 변환/ASC2 렌더·충돌·길찾기·모바일 경로를 재사용한다. 원본 source/collision hash와 좌표를 계약으로 고정하고, 기존 자체 마을 재생성이 덮어쓰지 못하게 한다.
**Tech Stack:** 기존 Node.js, Three.js, Python 팔레트 생성기. 새 라이브러리 없음.
**Spec:** `docs/superpowers/specs/2026-11-04-ascent-layout-restore-design.md`

## Constraints and Review Focus
- ID ascent_trial, scale1.25, crop[55,12,16], dimensions[206,115,223], 44380 colliders 유지.
- 검증 없이 스폰/사이트를 다른 지역으로 옮기지 않는다. 시각 변경과 물리 지형을 구분한다.
- 원본 입력 없을 때 기존 자체 마을로 되돌리지 않는다. 실제 Redis/기기/실결제와 fixture 검사를 구분한다.
- 모바일 전환/재접속/다른 맵 전환 시 동일 충돌·능력 높이와 상태 정리를 검증한다.
- 이미 반영된 Claude 작업과 미완료 worktree/PR126을 보존한다.

## Task 1: Canonical source and restore pipeline
- [ ] 실패 검사: source SHA/crop/dims/collision hash, 원본 스폰/사이트·미드, 마을 덮어쓰기 방지.
- [ ] 원본 입력을 받는 district 빌드와 이전 명령 호환/검증 경로 구현. desktop/mobile 동일 충돌 및 provenance 생성.
- [ ] 로더의 이름/버전/원본 layout 적용, 필요 시 실제 PR 반경으로 길찾기 정정. 단위 GREEN.

## Task 2: Own appearance and coherent naming
- [ ] 자체 팔레트/마스크를 유지한 황혼 지구 외관, 로비/홈/영문/안내/미리보기 일치.
- [ ] 실제 UI 탐색 후 브라우저 검사 작성/갱신. 원본 평면·A/B·미드·스폰과 실제 이동 비교 캡처.

## Task 3: Verification and handoff
- [ ] 전체 단위·구문·자산·CSP 및 원본/모바일 충돌/길찾기·장판/발사체·네트워크 검사.
- [ ] 독립 검토, 실제 렌더 결과와 성능 한계를 기록하고 PR로 제시. 승인 전 main 미병합.

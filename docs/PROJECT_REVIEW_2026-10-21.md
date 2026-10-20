---
title: "현재 작업·막히는 점·개편 우선순위"
date: 2026-10-21
source_commit: f9d47c4258a1a4871a4520c65d0ff24e08365ad3
tags: [DFDF, 현재작업]
---

# 현재 작업·막히는 점·개편 우선순위

요청에 따라 최신 공동 작업을 확인하고 게임 코드를 직접 수정한 뒤 검사와 다음 작업을 정리했다. 기준 코드는 **f9d47c4**. 문서와 원본 전체 기록의 이전 기준인 316bede는 과거 스냅샷으로 보존한다.

수정본: [GitHub PR #57](https://github.com/Sgh1101/DFDF/pull/57). 이 기록 마무리 시점에는 병합·운영 배포 전 검토 상태다.

## 지금 볼 자료

- 실행한 전체 검사와 한계
- 총기별 전후·모션·보존 범위
- 24개 작업의 근거·할 일·완료 기준

## 이번 구현

기관권총, 기관단총, 소음 기관단총, 산탄총, 산탄 권총, 점사소총 6종을 독립 형태로 다시 만들었다. 원본 총기 팩 9종·챔피언스·칼·정찰 소총(기존 카빈)·코멧·RPG와 무기 수/전투 수치는 유지한다. 산탄 권총의 실제 총열 꺾임, 산탄총의 펌프, 탄창 장식 일체 이동과 취소 뒤 복귀도 포함했다.

최신 main의 클로드 오퍼레이터 치명타(PR #55)와 그림자/bloom 최적화(PR #56)를 포함하는 **8f09355** 위에서 작업했다. 총기 구현은 5c2e087, 위시리스트 검사 보완은 e9a7d26, CTF 검사 보완은 f9d47c4다. 세 커밋의 게임 실행 파일은 동일하다. 클로드의 두 변경은 이번에 새로 만든 기능으로 세지 않는다.

## 우선순위 판단

P0는 재현되는 서비스 중단/데이터 손실이 있을 때 지정한다. 검사 전부터 추정으로 붙이지 않는다. P1은 실기기·외부 회선·저장소 검증과 핵심 UX/능력 판정, P2는 반복 품질·운영·구조, P3는 선택 확장이다. ‘환경 필요’는 현재 코드 작업 전체가 막혔다는 뜻이 아니다.

전체 검사 현황: 통과 **76**, 실패 **0**, 실행 중 **0**, 목표 명령 **76개**. 실행이 끝났다. 최종 판정은 검사 노트 참조.

## 권장 진행 순서

1. 이번 6종 외형과 전체 회귀 결과 확인.
2. 실제 휴대폰/외부 회선/격리 Redis의 기준선을 확보하고 실패를 재현.
3. 43궁극기 대응 차이와 다층 지면 능력, 작은 화면의 조준/정보 표시 보강.
4. 반복 검사 CI와 자산 규격·모듈 경계를 정리.
5. 플레이 데이터가 쌓인 뒤 무기/요원 밸런스와 새 콘텐츠를 추가.

## 작업표

| ID | 우선 | 작업 | 현재 분류 |
| --- | --- | --- | --- |
| QA-01 | P1 | 실제 휴대폰 기준선과 장시간 성능 | 추가 검증 |
| NET-01 | P1 | 외부 회선 연결과 TURN 검증 | 추가 검증 |
| OPS-01 | P1 | 실제 Redis Lua 통합 재검사 | 환경 필요 |
| OPS-02 | P1 | 배포 추적과 되돌리기 절차 | 개선 제안 |
| QA-02 | P1 | 전체 브라우저 검사를 재현 가능한 CI로 | 개선 제안 |
| ABIL-01 | P1 | 43개 궁극기의 대응 방식 재심사 | 설계·플레이 검증 |
| ABIL-02 | P1 | 다층 바닥과 지면 능력 가시성 | 추가 검증 |
| SKIN-01 | P1 | 챔피언스 원본 대조표와 실기기 소리 | 추가 검증 |
| UX-01 | P1 | 작은 화면 전투 정보 우선순위 | 개선 제안 |
| MAP-01 | P2 | 마크X발로 진입 동선과 길 안내 | 개선 제안 |
| MAP-02 | P2 | 다층 AI의 막힘과 사이트 도달 | 추가 검증 |
| PERF-01 | P2 | 자동 품질 조절의 예산 분리 | 개선 제안 |
| PERF-02 | P2 | 무기고·라운드 반복 메모리 예산 | 조사 제안 |
| GUN-01 | P2 | 새 외형 6종의 사격/장전 읽기 평가 | 구현 완료·플레이 보완 |
| GUN-02 | P2 | 무기 역할·구매 선택 근거 | 플레이 분석 제안 |
| ECON-01 | P2 | 완전 수집 후 뽑기 동작 명확화 | 설계 결정 필요 |
| ECON-02 | P2 | 700코인 진행과 보상 명세 | 개선 제안 |
| GAME-01 | P2 | 동시 승패·스파이크 경계 사례 | 추가 검증 |
| GAME-02 | P2 | 모드별 학습 동선과 짧은 훈련 | 기획 제안 |
| ARCH-01 | P2 | 전역 래퍼 체인부터 단계적 모듈화 | 구조 개선 제안 |
| OPS-03 | P2 | 보상·실패 로그와 데이터 복구 훈련 | 운영 개선 제안 |
| APP-01 | P3 | PWA 갱신과 네이티브 앱 경계 | 추가 검증·선택 기획 |
| IDEA-01 | P3 | 관전·사망 정보로 피드백 품질 개선 | 기획 제안 |
| IDEA-02 | P3 | 맵 제작·3D 자산 가져오기 규격 | 기획 제안 |

확정 실패·미검증 범위·제안은 다른 상태다. ‘모든 궁극기가 유일하다’, ‘모든 폰에서 렉이 줄었다’, ‘실결제까지 검증했다’는 표현은 현재 증거를 넘는다.


## 세부 작업

이 목록은 코드를 조사해 정한 실행 후보이며, 모두 확인된 버그라는 뜻은 아니다. 가격·확률·핵심 규칙을 임의로 바꾸는 승인으로 사용하지 않는다.

### QA-01 · 실제 휴대폰 기준선과 장시간 성능

**우선순위 P1 / 추가 검증**

- 근거: 브라우저 fixture는 Chrome/SwiftShader와 모바일 화면 크기를 사용한다. 실기기 FPS·발열·터치 지연을 증명하지 않는다.
- 작업: 저사양/중간급 Android와 iPhone 각 대표 기기에서 4단계 품질, 기본 맵/마크X발로, 교전/피니셔를 같은 동선으로 기록한다. 10분·30분 시점의 프레임 시간과 메모리, 발열, 배터리도 남긴다.
- 완료 기준: 기기·OS·브라우저·해상도·품질·동시 인원·맵을 함께 저장. 중앙값·p95 프레임 시간과 긴 프레임 횟수, 터치→발사 지연을 공개하고 목표를 정한다. 현재 숫자만으로 몇 % 빨라졌다고 발표하지 않는다.
- 의존/제약: 실제 기기 또는 사용자의 재현 결과. ARTEMIS는 선택.
- 조사한 코드: [scripts/browser-graphics.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/scripts/browser-graphics.js) · [scripts/browser-mobile-map.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/scripts/browser-mobile-map.js) · [scripts/browser-performance.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/scripts/browser-performance.js)

### NET-01 · 외부 회선 연결과 TURN 검증

**우선순위 P1 / 추가 검증**

- 근거: 로컬 PeerServer·두 브라우저 검사는 인터넷 NAT/이동통신의 연결 성공률을 대신하지 못한다. 실제 운영 TURN 설정은 이번에 열람하지 않았다.
- 작업: 다른 집 Wi-Fi/모바일 데이터 간 최초 연결, 재접속, Wi-Fi↔LTE, 호스트 창 백그라운드, 중도 참가를 검사한다. 연결 실패 시 신호/ICE/채널/방 만료 단계를 구분해 익명 진단을 남긴다.
- 완료 기준: 원래 자리·요원·스킨·탄약이 보존되고 중복 피해/중복 보상이 없어야 한다. TURN 사용/만료/실패 시의 안내와 재시도 상한 확인.
- 의존/제약: 다른 네트워크 2곳, 운영 TURN 접근 권한과 테스트 계정.
- 조사한 코드: [scripts/browser-online.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/scripts/browser-online.js) · [scripts/browser-network-recovery.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/scripts/browser-network-recovery.js) · [docs/MULTIPLAYER_VERIFICATION.md](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/docs/MULTIPLAYER_VERIFICATION.md)

### OPS-01 · 실제 Redis Lua 통합 재검사

**우선순위 P1 / 환경 필요**

- 근거: tests/api-redis.test.js는 DFDF_REDIS_CLI와 DFDF_REDIS_SOCKET이 없으면 건너뛴다. 현재 Docker daemon도 실행 중이 아니며 기본 실행은 메모리 harness다.
- 작업: 운영 DB와 분리된 임시 Redis에서 기존 Lua 통합 검사를 실행한다. 동시에 뽑기·보상 재전송·미션 중복 요청·상점 구매·스킨 이관 경합을 확인한다.
- 완료 기준: 실제 Redis 검사가 skip 없이 통과하고 원장 합계·보유품·한 번 지급이 일치. 테스트 DB 정리 및 운영 DB 미접근 증거 기록.
- 의존/제약: 격리된 Redis 실행 환경. 현재 작업을 막지는 않음.
- 조사한 코드: [tests/api-redis.test.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/tests/api-redis.test.js) · [tests/api-harness.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/tests/api-harness.js) · [api/v1.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/api/v1.js)

### OPS-02 · 배포 추적과 되돌리기 절차

**우선순위 P1 / 개선 제안**

- 근거: 배포 공동 작업 규칙이 있으나 로컬 전체 브라우저 검사가 GitHub CI 전체에 자동 포함되지는 않는다.
- 작업: 버전/커밋을 앱 진단에서 확인하게 하고, main/Claude/열린 PR/배포 대상 차이와 롤백 커밋을 릴리스 체크에 기록한다.
- 완료 기준: 서비스가 테스트한 커밋과 일치. 이전 릴리스로 복원 후 계정·스킨 데이터 호환을 확인. 비밀 값은 진단에 포함하지 않는다.
- 의존/제약: 릴리스 시점의 GitHub/Vercel 상태 확인.
- 조사한 코드: [.cursor/rules/deployment-coordination.mdc](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/.cursor/rules/deployment-coordination.mdc) · [.github/workflows/check.yml](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/.github/workflows/check.yml) · [vercel.json](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/vercel.json)

### QA-02 · 전체 브라우저 검사를 재현 가능한 CI로

**우선순위 P1 / 개선 제안**

- 근거: .github/workflows/check.yml의 현재 두 실행 명령은 npm run check와 npm test다. 72개 기능 브라우저 스크립트와 UI 감사는 로컬 별도 실행이다. package.json에는 test:buildings가 같은 값으로 두 번 선언돼 있다. 현재 실행 결과는 같지만 정리 대상이다.
- 작업: 정적 서버·Playwright/Chrome·캐시된 Three/PeerJS·임시 PeerServer 버전을 명시한 공통 러너를 저장소에 넣고, 핵심 PR 스모크와 야간 전체 검사를 분리한다. 중복 명령 키도 정리한다.
- 완료 기준: 새 환경에서 문서대로 실행 가능. 실패 로그/화면/정확한 커밋이 남고 UI 감사 JSON의 진단 1개도 실패로 처리한다.
- 의존/제약: CI 시간/아티팩트 용량 결정. API는 테스트 harness 사용.
- 조사한 코드: [.github/workflows/check.yml](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/.github/workflows/check.yml) · [package.json](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/package.json) · [scripts/browser-fixture.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/scripts/browser-fixture.js)

### ABIL-01 · 43개 궁극기의 대응 방식 재심사

**우선순위 P1 / 설계·플레이 검증**

- 근거: ability-profiles.js에는 43개의 서로 다른 궁극기 계약명이 있다. 이름의 고유성만으로 실제 플레이가 모두 다르다고 증명할 수는 없다. 전수 발동과 주요 8종 판정 검사는 별도다.
- 작업: 입력·대상 선택·공간 형태·주 결과·적의 대응 5축으로 43개를 비교한다. 특히 탐지/추적, 지속 피해 장판, 투사체, 이동, 추방/복귀 계열을 같은 전장 조건에서 비교한다. 일반 Q/E/C도 type 이름이 달라도 같은 효과/입력 조합인지 검토한다.
- 완료 기준: 같은 주 입력과 결과/대응을 갖는 쌍이 없어야 한다. 수치·색만 다른 경우 개편한다. 903개 쌍 비교표는 검토 보조이며 단순 문자열 검사로 완료 처리하지 않는다.
- 의존/제약: 현재 172개 발동 검사를 회귀 기준으로 보존.
- 조사한 코드: [js/ability-profiles.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/ability-profiles.js) · [js/ability-ultimates.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/ability-ultimates.js) · [scripts/browser-ability-upgrade.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/scripts/browser-ability-upgrade.js)

### ABIL-02 · 다층 바닥과 지면 능력 가시성

**우선순위 P1 / 추가 검증**

- 근거: 마크X발로는 높이가 다른 지형이며 과거 지면 효과 가시성 수정과 전용 회귀가 있다. 모든 계단/천장/층 조합을 통과했다는 증거는 없다.
- 작업: 각 맵의 계단·반블록·경사·위층 아래 공간에서 원형/선형/벽/설치형 효과를 검사하고 시전 표시와 실제 피해 높이·충돌을 함께 기록한다.
- 완료 기준: 효과가 아래층으로 새거나 천장에 붙지 않고 실제 판정 위치를 보여야 한다. 품질 4단계에서 위험 경계는 보존.
- 의존/제약: 마크X발로 원본 충돌·navigation 보존.
- 조사한 코드: [js/ascent-trial.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/ascent-trial.js) · [scripts/browser-ascent-abilities.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/scripts/browser-ascent-abilities.js) · [scripts/browser-ability-upgrade.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/scripts/browser-ability-upgrade.js)

### SKIN-01 · 챔피언스 원본 대조표와 실기기 소리

**우선순위 P1 / 추가 검증**

- 근거: 원본 자산 보존·킬 물결·피니셔·inspect 음악에 별도 검사가 있다. 용/뱀 관절 자체는 원본 고정이고 물결·리본·문양·입자가 움직인다. 영상의 모든 카메라/조명과 같다는 뜻은 아니다.
- 작업: 공격/수비 각각 처치 1~5, 마지막 적, 벽/천장/좁은 곳, 다른 사람이 보는 피니셔, inspect→중단→재생을 시간축으로 촬영해 원본과 비교한다.
- 완료 기준: 킬 물결 8.7초와 8초 마무리 전환, 원본 음표/배너/재질이 유지되고 반복 중첩·뮤트 후 잔음·다음 라운드 잔상이 없어야 한다.
- 의존/제약: 실제 기기 오디오 잠금 해제와 원본 비교 영상.
- 조사한 코드: [js/champions-phantom.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/champions-phantom.js) · [js/phantom-gun-wave.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/phantom-gun-wave.js) · [js/phantom-audio.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/phantom-audio.js) · [tests/phantom-finisher-motion.test.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/tests/phantom-finisher-motion.test.js)

### UX-01 · 작은 화면 전투 정보 우선순위

**우선순위 P1 / 개선 제안**

- 근거: 모바일 미리보기 전용 회귀와 UI 경계 감사가 있다. 전투 중 미니맵·스킬·총기·터치 버튼이 동시에 있는 화면의 읽기 편의는 플레이 평가가 필요하다.
- 작업: 주 손/보조 손 영역과 조준 중앙을 정하고 중복 안내를 줄인다. 568×320부터 노치/주소창 높이 변화, 세로→가로 회전, 터치 배치 저장까지 검사한다.
- 완료 기준: 미리보기와 장착 버튼이 가려지지 않고 구매/닫기/뒤로 가기가 항상 닿아야 한다. 위험 경계·체력·탄창을 우선 보존.
- 의존/제약: 실기기 조작성 평가 + 기존 UI 감사.
- 조사한 코드: [css/armory-mobile.css](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/css/armory-mobile.css) · [css/mobile.css](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/css/mobile.css) · [scripts/browser-mobile-skin-preview.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/scripts/browser-mobile-skin-preview.js) · [scripts/browser-touchlay.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/scripts/browser-touchlay.js)

### MAP-01 · 마크X발로 진입 동선과 길 안내

**우선순위 P2 / 개선 제안**

- 근거: 맵은 일반 선택/방 목록에 등록되고 선택 시 리소스를 불러온다. 사용자는 과거 맵을 못 찾았다고 보고했다.
- 작업: 마지막 선택 기억·대표 썸네일·원본/휴대폰 상세 차이 안내·로딩 단계/재시도 경로를 다듬고 미니맵 콜아웃과 사이트 접근 경로를 정리한다.
- 완료 기준: 첫 이용자가 맵을 찾아 입장할 수 있고 로딩 실패 뒤 홈/다른 맵으로 복귀 가능. 다운받지 않은 맵을 준비 완료로 표시하지 않는다.
- 의존/제약: 맵 플레이 테스트. 신규 지형 제작 전 기존 진입 경험 검증.
- 조사한 코드: [js/ascent-trial.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/ascent-trial.js) · [js/home-newmap.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/home-newmap.js) · [scripts/browser-public-map-online.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/scripts/browser-public-map-online.js) · [scripts/browser-map-loading.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/scripts/browser-map-loading.js)

### MAP-02 · 다층 AI의 막힘과 사이트 도달

**우선순위 P2 / 추가 검증**

- 근거: 병원 전용 층간 navigation과 마크X발로 경로 검사가 존재한다. 모든 동적 문/좁은 길/낙하 구간을 실행한 것은 아니다. 이번 CTF 무작위 5분 봇 전투에서는 깃발 이동 0프레임과 788프레임이 각각 관찰됐고 둘 다 0득점이었다. 조합에 따른 진행 변동성으로 기록하며 경로 고장으로 단정하지 않는다.
- 작업: 스폰→사이트→설치/해제 경로에서 문 닫힘·적 회피·계단·층 변경을 반복하고 5초 이상 막힘 위치를 시각화한다. CTF는 고정 seed/요원 조합을 여러 개 사용해 목표 추구와 전투 집중, 운반자 생존, 10분 경기의 득점을 따로 측정한다.
- 완료 기준: 도달 불가능 지점 재선택, 무한 점프/벽 밀기 방지, 목표 변경 후 복구. 사람 이동/충돌을 AI 때문에 단순화하지 않는다.
- 의존/제약: 재현 seed와 맵 좌표 기록.
- 조사한 코드: [js/legacy/102-bots-climb-the-hospital-stairs-and-the-minimap-shows-the-floor.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/legacy/102-bots-climb-the-hospital-stairs-and-the-minimap-shows-the-floor.js) · [js/legacy/94-capture-the-flag-take-theirs-home-while-yours-is-safe.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/legacy/94-capture-the-flag-take-theirs-home-while-yours-is-safe.js) · [scripts/browser-hospital-bots.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/scripts/browser-hospital-bots.js) · [scripts/browser-ctf.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/scripts/browser-ctf.js)

### PERF-01 · 자동 품질 조절의 예산 분리

**우선순위 P2 / 개선 제안**

- 근거: 4개 품질 모드와 휴대폰 전용 마크X발로 메시가 있다. 최신 main에는 bloom/그림자 최적화도 포함됐다.
- 작업: 실측 뒤 장식 거리·그림자 갱신·후처리·비필수 입자만 단계적으로 조절한다. 화면 해상도를 과도하게 낮추는 방식은 피한다.
- 완료 기준: 같은 카메라/동선에서 비교하고 충돌·판정·위험 경계·UI 선명도 동일. 품질 왕복 시 GPU 자원이 계속 늘지 않아야 한다.
- 의존/제약: QA-01 기기 기준선. 자동 조절은 흔들림을 막는 지연/복구 규칙 필요.
- 조사한 코드: [js/graphics-settings.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/graphics-settings.js) · [js/legacy/03-engine.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/legacy/03-engine.js) · [scripts/browser-mobile-map.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/scripts/browser-mobile-map.js)

### PERF-02 · 무기고·라운드 반복 메모리 예산

**우선순위 P2 / 조사 제안**

- 근거: 무기 템플릿/썸네일 캐시와 공유 재질이 있고, 원본 스킨에는 별도 애니메이션/오디오 자원이 있다. 캐시가 있다는 사실 자체를 누수로 단정하지 않는다.
- 작업: 전체 스킨 순회·챔피언스 교체·맵 왕복·경기 20회 후 heap/GPU geometry/texture/audio node 수를 기록한다. 공유 자산은 참조 관계를 확인한 뒤 해제한다.
- 완료 기준: 워밍업 이후 상한 안에서 안정. 늦게 끝난 다운로드가 닫힌 화면을 되살리지 않고 이전 효과/곡이 멈춰야 한다.
- 의존/제약: 동일 seed/동선과 GC 측정 조건 고정.
- 조사한 코드: [js/legacy/58-gun-skins.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/legacy/58-gun-skins.js) · [js/champions-phantom.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/champions-phantom.js) · [scripts/browser-regression.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/scripts/browser-regression.js) · [scripts/browser-phantom-loading.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/scripts/browser-phantom-loading.js)

### GUN-01 · 새 외형 6종의 사격/장전 읽기 평가

**우선순위 P2 / 구현 완료·플레이 보완**

- 근거: 이번 코드에서 기관권총/SMG/소음 SMG/산탄총/산탄 권총/점사소총을 독립 모델로 재구성했다. 원본 팩·카빈·코멧·RPG는 보존했다.
- 작업: 실제 플레이에서 적 구분, ADS 중심, 손잡이 쥐는 위치, 스킨 무늬, 탄창 움직임과 조준 시 시야를 평가한다. 피드백은 총 이름·화면·입력으로 받는다.
- 완료 기준: 원본 총을 바꾸지 않고도 실루엣을 식별. 산탄 권총 꺾임/산탄총 펌프가 취소 뒤 원위치. 스탯·보유 스킨·네트워크 키 유지.
- 의존/제약: 이번 모델 회귀 검사와 사용자 시각 피드백.
- 조사한 코드: [js/legacy-gun-models.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/legacy-gun-models.js) · [scripts/browser-legacy-models.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/scripts/browser-legacy-models.js) · [js/legacy/54-reload-animation.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/legacy/54-reload-animation.js)

### GUN-02 · 무기 역할·구매 선택 근거

**우선순위 P2 / 플레이 분석 제안**

- 근거: 총기는 18종+칼이며 팬텀 자동/점사 3점사/정찰 단발이 분리돼 있다. 최신 main의 오퍼레이터는 어느 부위든 치명타다.
- 작업: 사거리·명중·경제·연사/점사·관통·소음·장전 위험을 같은 조건으로 비교한다. 픽률/명중률/킬 관여를 수집해 유사 총의 역할을 정리한다.
- 완료 기준: 비슷한 총도 선택 이유가 설명되고 오퍼레이터 한 방 설정을 유지하면서 회피/재장전 위험이 작동. 데이터 없이 피해량을 임의 변경하지 않는다.
- 의존/제약: 모드별 실제 경기 표본. 사용자 원본 총 보존.
- 조사한 코드: [js/valorant-data.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/valorant-data.js) · [js/legacy/105-the-operator-kills-with-any-hit.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/legacy/105-the-operator-kills-with-any-hit.js) · [js/weapon-shop.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/weapon-shop.js)

### ECON-01 · 완전 수집 후 뽑기 동작 명확화

**우선순위 P2 / 설계 결정 필요**

- 근거: 현재 일반~전설을 모두 모으면 일반 뽑기 입구가 거절될 수 있어 초월만 노리는 시도와 충돌할 수 있다. 원래 요구는 공통 뽑기 포함과 700코인 구매다.
- 작업: 완전 수집자에게 제공할 동작을 정한다. 가장 작은 변경은 유효 보상/환급 규칙을 명시하고 초월 포함 여부를 화면과 서버가 동일하게 처리하는 것이다.
- 완료 기준: 확률 0.00000000000000001%와 700코인 설정을 몰래 변경하지 않는다. 보상 후보 0개/확률 검사/환급/중복 요청을 서버에서 검증.
- 의존/제약: 보상 정책을 구체화한 뒤 별도 변경. 현 상태를 확률 보장으로 설명하지 않음.
- 조사한 코드: [api/v1.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/api/v1.js) · [tests/api.test.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/tests/api.test.js) · [js/legacy/58-gun-skins.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/legacy/58-gun-skins.js)

### ECON-02 · 700코인 진행과 보상 명세

**우선순위 P2 / 개선 제안**

- 근거: 매 경기 코인 1개와 초월 700코인 구매가 결정돼 있다. 경기 크레딧/골드/코인/스킨 등급은 서로 다른 체계다.
- 작업: 챔피언스 구매 페이지에 현재 코인·필요량·경기 보상 적용 상태를 표시하고 재접속/중복 결과에서도 한 번만 지급되는지 검사한다.
- 완료 기준: 가격/확률은 유지. 이미 가진 공격·수비 스킨 잠금과 팬텀 이관이 회귀하지 않고 중복 구매/두 탭 경합에 이중 차감 없음.
- 의존/제약: OPS-01 실제 저장소 통합.
- 조사한 코드: [js/champion-shop.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/champion-shop.js) · [api/v1.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/api/v1.js) · [tests/api.test.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/tests/api.test.js) · [scripts/browser-champions-panel.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/scripts/browser-champions-panel.js)

### GAME-01 · 동시 승패·스파이크 경계 사례

**우선순위 P2 / 추가 검증**

- 근거: 마지막 처치 8초 전환과 기본 모드 검사가 있다. 동시 전멸/해제 종료·폭발 동프레임/여러 소지자 같은 조합은 별도 행렬이 필요하다.
- 작업: 단일 시뮬레이션 tick에 여러 종료 조건을 넣고 승패 우선순위·점수 1회·보상 1회·다음 라운드 1회를 검증한다.
- 완료 기준: 호스트/게스트가 같은 승패를 보고 메뉴 복귀나 맵 변경 후 옛 타이머가 새 경기를 시작하지 않는다.
- 의존/제약: 규칙 우선순위 명세와 재현 fixture.
- 조사한 코드: [tests/round-end.test.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/tests/round-end.test.js) · [scripts/browser-champions-finish.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/scripts/browser-champions-finish.js) · [scripts/browser-modes2.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/scripts/browser-modes2.js)

### GAME-02 · 모드별 학습 동선과 짧은 훈련

**우선순위 P2 / 기획 제안**

- 근거: 11개 모드와 많은 요원/능력이 있어 최초 학습량이 크다. 훈련장과 모드 설명은 이미 존재한다.
- 작업: 이동/반동/장전→스파이크→요원 능력→모드 목표 순서의 짧은 과제를 기존 훈련장에 연결한다. 결과는 점수보다 다음 행동을 알려준다.
- 완료 기준: 실전 설정과 동일한 무기/판정. 안내를 건너뛰거나 재실행할 수 있고 완료 보상을 중복 지급하지 않는다.
- 의존/제약: 처음 플레이하는 사람의 관찰. 신규 모드 추가보다 기존 안내 우선.
- 조사한 코드: [scripts/browser-range.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/scripts/browser-range.js) · [js/game-catalog.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/game-catalog.js)

### ARCH-01 · 전역 래퍼 체인부터 단계적 모듈화

**우선순위 P2 / 구조 개선 제안**

- 근거: play.html은 다수 classic script의 순서에 의존하고 fire/dealDamage/tickViewmodel 등을 여러 파일이 감싼다.
- 작업: 한 번에 엔진을 다시 쓰지 않고 피해 원인/이벤트/자산 수명/무기 모델 인터페이스를 우선 계약으로 분리한다. 실행 순서와 등록표를 문서/검사에서 공유한다.
- 완료 기준: 원본 모델·세션·피해 1회·궁극기·스냅샷 인덱스가 보존되고 각 단계 전후 기존 회귀가 통과. 늦은 override가 조용히 사라지지 않음.
- 의존/제약: QA-02 반복 가능한 검사. 한 PR 한 경계.
- 조사한 코드: [play.html](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/play.html) · [js/game-events.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/game-events.js) · [js/legacy/03-engine.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/legacy/03-engine.js) · [js/legacy/manifest.json](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/legacy/manifest.json)

### OPS-03 · 보상·실패 로그와 데이터 복구 훈련

**우선순위 P2 / 운영 개선 제안**

- 근거: 서버 원장/문의/주문 경로가 있으나 이번 검사는 운영 DB·실제 입금·복구를 실행하지 않았다.
- 작업: 개인정보를 제외한 오류 코드·보상 요청 ID·지급 결과를 연결하고 테스트 백업의 복구 연습을 문서화한다. 계정 정지/삭제/재생성도 포함한다.
- 완료 기준: 같은 요청 재전송에 보상 1회. 백업 복구 후 보유품·세션 무효화가 일치. 실입금 확인 없이 결제 완료로 표시하지 않음.
- 의존/제약: 운영 권한과 테스트 데이터/보존 기간 결정.
- 조사한 코드: [api/v1.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/api/v1.js) · [tests/api.test.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/tests/api.test.js) · [docs/MULTIPLAYER_VERIFICATION.md](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/docs/MULTIPLAYER_VERIFICATION.md)

### APP-01 · PWA 갱신과 네이티브 앱 경계

**우선순위 P3 / 추가 검증·선택 기획**

- 근거: .well-known/assetlinks.json에는 패키지명/인증서 자리표시자가 있다. 완성 Android 네이티브 앱이 있다는 뜻이 아니다.
- 작업: 우선 설치된 PWA에서 오래된 캐시→새 버전, 오프라인 복귀, 계정/설정 보존을 검사한다. APK 전환은 기기 성능 측정 후 별도 범위로 잡는다.
- 완료 기준: 설치된 PWA도 최신 코드와 신규 자산을 받고 오프라인 안내가 동작. 패키지/인증서가 정해진 경우에만 assetlinks 값을 확정.
- 의존/제약: 실제 설치 기기. 웹 게임을 Termux 서버로 옮기는 것과 별개.
- 조사한 코드: [sw.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/sw.js) · [manifest.webmanifest](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/manifest.webmanifest) · [.well-known/assetlinks.json](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/.well-known/assetlinks.json)

### IDEA-01 · 관전·사망 정보로 피드백 품질 개선

**우선순위 P3 / 기획 제안**

- 근거: 킬캠/배너/피해 원인 경로와 사용자 문의 기능이 있다.
- 작업: 사망 시 총/스킨/거리/능력 원인/막은 방어량을 짧게 보여주고 선택적으로 버전·맵·기기 진단을 문의에 첨부하게 한다.
- 완료 기준: 관전으로 살아 있는 적 위치가 새지 않고 기록은 실제 피해 원인을 사용. 개인정보나 인증 값은 첨부하지 않음.
- 의존/제약: 기존 피해 원인과 관전 권한 규칙.
- 조사한 코드: [scripts/browser-killcam.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/scripts/browser-killcam.js) · [js/feedback.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/feedback.js) · [js/game-events.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/game-events.js)

### IDEA-02 · 맵 제작·3D 자산 가져오기 규격

**우선순위 P3 / 기획 제안**

- 근거: 현재 schematic/Bedrock/Gecko 변환은 각 자산에 맞는 구현이 있다. Tripo 연결은 현재 완료 항목이 아니다.
- 작업: 단위·축·원점·피벗·재질·텍스처 크기·애니메이션 클립·손잡이/총구 앵커·LOD·삼각형 예산을 자산 규격으로 작성하고 임포트 검사기를 만든다.
- 완료 기준: 형태가 깨진 자산은 조용히 대체하지 않고 원인 표시. 제공 원본과 렌더 파생물을 별도 보존하며 모델/텍스처 해시를 확인.
- 의존/제약: 기존 총 원본 보존 정책. 유료 도구 연결은 별도 요청 때 진행.
- 조사한 코드: [js/valorant-data.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/valorant-data.js) · [js/bedrock-rig.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/bedrock-rig.js) · [js/gecko-finisher-rig.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/js/gecko-finisher-rig.js) · [tests/valorant.test.js](https://github.com/Sgh1101/DFDF/blob/f9d47c4258a1a4871a4520c65d0ff24e08365ad3/tests/valorant.test.js)

현재 작업표는 이 문서의 첫 부분 참조.

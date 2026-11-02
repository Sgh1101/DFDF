# 2026-11-02 게임 디자인·음악·맵 개편 결과

계획: [전체 설계](superpowers/specs/2026-11-02-game-visual-overhaul.md), [실행 계획](superpowers/plans/2026-11-02-game-visual-overhaul.md). 기반 45ce6f3, 작업 브랜치 `codex/full-visual-rework-20261102`.

## 적용 내용

- 챔피언스 팬텀: 열린 개머리판·금색 프레임·비늘 문양·소음기로 재제작한 공격 진홍/수비 상아 두 변형. 512×512 아틀라스와 기존 총구·리그·장착을 유지한다. 별도 시안 worktree는 수정하지 않았다. 완료 커밋이 없어 안정된 개별 파일을 검토·해시 기록 후 이 브랜치에 복사하고 생성물을 직접 다시 만들었다. 이 절차 변경은 [소스 기록](superpowers/records/2026-11-02-concept-source-snapshot.json)에 남겼다.
- 새 자체 합성곡 **Aurora**: 킬 1~5의 상승 모티프, 여유 있는 미리보기 곡, 시작부터 주제가 나오는 마무리 곡. 기존 곡을 단순 이조한 것이 아니라 음형·화성·편성·악기 음색을 바꿨다. 새 버전 URL로 이전 음악 캐시를 피한다.
- 챔피언스 마무리: 용·뱀에 금빛 이마 장식을 추가하고 몸과 턱을 절대 시간으로 움직인다. 눈/머리 앵커와 관련 효과는 정렬을 유지한다. 총에 감기는 처치 물결·배너, 최소 플레이어 5배 크기, 마지막 적 처치 후 8초 전환은 유지한다. 기본 애니메이션이 정지 모델이었다는 사실과 새 움직임을 구분한다.
- 마크X발로: 자체 블록 마을에 도로·보도·횡단보도, 시장·카페·주택·정류장, 가로등·벤치·가로수·굴뚝·출입구·창틀·차양을 만들었다. 중앙 광장/다리와 양 팀→A/B 동선은 유지한다. 특정 실존 도시를 복제한 맵은 아니다. 미리보기 이미지도 실제 새 렌더로 교체했다.
- 글꼴: 본문 Noto Sans KR, 주요 제목 Black Han Sans의 실제 400 굵기, 체력·탄약·시간·점수는 Noto 고정폭 숫자. 휴대폰 가로 화면과 세로 회전 안내를 확인했다. Google Fonts의 실제 한글 글꼴 다운로드도 성공했다.
- 자체 칼: 구리 프레임 Ember 카람빗, 청록 프레임 Tide 나비칼. 기존 스킨 ID·보유 정보와 모션을 유지한다. 67번 모듈 HAND 이후 손/그립/휴식 자세/크기/모션 코드 및 83번 자세히 보기 모듈이 기반과 동일함을 비교했다.
- 보안: 고정 기반 커밋에서 확인한 5건의 데이터 검증·연결 입장·방 권한 수명·동시 방 등록·운영자 방 목록 문제를 이 개편 브랜치에서 수정했다. CSP는 기존 보고 모드를 유지하므로 추가 차단 장치로 작동한다고 주장하지 않는다. 광고는 계속 비활성화다.

## 검증

단위 검사 최종 467개: **465 통과, 실패 0, 실제 Redis 검사 2개 건너뜀**. `node --test tests/*.test.js`.

브라우저 1차 23종 중 21종 통과. 나머지 2종은 정지 모델을 전제로 하던 기존 마무리 검사로, 새 움직임과 바인드 포즈를 분리해 검증하도록 수정했다. 새 계약에서 유한한 몸 움직임·고정된 눈 앵커·바인드 포즈의 원본 정점 오차를 각각 확인한다. 허용 오차를 넓혀 통과시키지 않았다.

최종 변경 후 **관련 브라우저 11종 모두 통과**, 같은 게임 트리 SHA-256 `97c46a9289d22bf4ad52c6fa1aa9aa6edf492de00d976c2b60eca4058df7c280`:

`host-data`, `online`, `soft-fonts`, `original-maps`, `mobile-map`, `phantom-motion`, `champions-finish`, `champions-finish-online`, `csp`, `service-worker`, `site-pages`.

화면표·음수 라운드 시간 검사를 확장한 `host-data`도 최종 코드에서 단독 통과했다. 동시 실행 중 클릭 시간 초과 1회 후 단독으로 재실행했으며 최초 로그를 남겼다. 앞선 23종의 다른 게임 트리 결과를 최종 11종과 같은 버전의 전체 검사로 섞어 세지 않는다.

추가 실제 화면 확인: 두 챔피언스 변형의 PC/휴대폰 프레이밍·색 차이·재장전/발사/살펴보기, 처치 물결의 실제 GPU 픽셀 변화, 처치 5단계와 미리보기/마무리의 Web Audio 출력·중지·음소거·503 재시도. 맵의 양 팀→A/B 몸체 이동, 벽의 총알 차단, 능력 112종과 네 그래픽 모드의 바닥 정렬. 실제 로컬 WebRTC로 8초 마무리 공유와 정리를 확인했다.

마을 패키지: 원본 13,672쿼드·353,332바이트, 휴대폰 91,252바이트(약 **74% 작음**). 충돌 바이트 동일. 이는 파일/기하량 수치이며 FPS가 74% 올랐다는 뜻이 아니다. 렌더 메시 27개, 원본 GPU 기하 버퍼 약 3.0MB.

Android 실기기, 하드웨어 GPU 성능 측정, 실제 스토어 결제, 운영 Redis·인터넷 TURN 검사는 실행하지 않았다. 단위 API와 로컬 WebRTC를 이 항목들의 검증으로 표현하지 않는다. 외형·곡의 취향 및 실전 대인 밸런스는 사람의 추가 평가 여지가 있다.

## 미리보기·미리듣기 (이 PC)

- [공격형 총 화면](../test-results/visual-overhaul/integrated/test-champions-concept/desktop-attacker-ui.png)
- [수비형 총 화면](../test-results/visual-overhaul/integrated/test-champions-concept/desktop-defender-ui.png)
- [새 마무리 화면](../test-results/phantom-motion/03-dragon-flash.png)
- [카람빗](../test-results/visual-overhaul/proof/karambit-held.png), [나비칼](../test-results/visual-overhaul/proof/butterfly-held.png)
- [휴대폰 한글 글꼴](../test-results/visual-overhaul/proof/phone-landscape-fonts.png)
- [새 맵](../assets/site/maps/ascent_trial.webp)
- [킬 1~5 WAV](../test-results/visual-overhaul/audio/aurora-kills-1-to-5.wav), [미리보기 곡 WAV](../test-results/visual-overhaul/audio/aurora-inspect.wav), [마무리 곡 WAV](../test-results/visual-overhaul/audio/aurora-finisher_music.wav)

WAV는 같은 음표·합성 악기의 오프라인 참고 믹스다. 게임의 사용자 음량·마스터 리미터와 완전히 동일한 캡처는 아니다. 참고 믹스는 피크 0.85 이하로 내보냈다.

## 독립 검토와 남은 배포 단계

코드 검토 기준 `45ce6f3..01301ca`: Important 2건(스파이크 설치 후 음수 시간의 정상 스냅샷, 숫자 글꼴 CSS 로드/실제 HUD 선택자)을 수정하고 회귀 검사했다. 검토자가 판단하지 않은 실제 렌더·소리는 위 부모 브라우저 검사로 확인했다. Android/실서비스/스토어는 미확인으로 남긴다. 검토 이전에 알고 있던 맵 캐시·미리보기·점수표 처리도 수정했다.

공식 보안 스캔 `3debcf26-671e-4081-af70-a528681c766b` 완료: 높음 1·중간 2·낮음 2. 11개 신뢰 경계 질문을 검토했고 44파일을 전체 감사했으며 큰 엔진 등은 선택 구간을 추적했다. 734파일 전체를 한 줄씩 감사하거나 안전을 보증한 결과가 아니다. 상세 보고서는 Codex Security의 로컬 전용 저장소에 있으며 저장소/공개 배포에 복사하지 않았다. 도구 집계 토큰은 연결 스레드 누적 32,226,468(캐시 포함)이며 이번 검사만의 비용/사용량으로 분리된 값이 아니다.

main은 병합하지 않는다. Vercel 운영 승격에는 사용자 재인증이 남아 있다. 운영 도메인에서 새 커밋을 확인하기 전에는 배포 완료로 기록하지 않는다. 이전 45ce6f3의 보류 중 승격 창은 취소했고, 최종 개편 커밋을 기준으로 새 Preview를 준비한다.

### 원격 배포 확인

Vercel은 372b29c를 Ready Preview로 배포했다. `https://13fps-e60ok2bj2-sgh1101s-projects.vercel.app/api/release`에서 같은 커밋을 확인했고, 그 주소에서 startup·두 챔피언스 변형/모션·새 맵 3개 브라우저 검사가 통과했다. 이 검사도 계정 API는 메모리 대역으로 가로채므로 운영 계정·Redis 검증이 아니다. 현재 운영 `13fps.xyz/api/release`는 여전히 32a422e다.

Cloudflare의 별도 자동 검사 실패는 앱 컴파일 오류가 아니라 `wrangler preview`가 요구하는 `previews` 설정 블록 누락이었다. [공식 구성 문서](https://developers.cloudflare.com/workers/previews/configuration/)에 따라 빈 블록을 추가했다. 프로덕션 시크릿을 열람·복사하거나 자원/요금제를 새로 구성하지 않았다. Wrangler 4.151.0 로컬 dry-run은 성공했다. 원격 Workers 검사 상태는 최종 전달에서 별도로 구분한다. Vercel 인증을 우회하거나 main을 병합해 배포하는 방식은 쓰지 않는다.

# 배포·진단·복구 절차

운영 주소: https://13fps.vercel.app · 저장소: Sgh1101/DFDF. 운영 DB 대신 fixture와 CI의 임시 Redis를 검사한다.

1. `.cursor/rules/deployment-coordination.mdc`를 읽고 remote fetch, main/Claude/열린 PR/두 worktree의 상태를 확인한다.
2. `npm ci`, `npm run check`, `npm run check:assets`, `npm test`, `npm run test:full`을 실행한다. `test-results/browser-suite/summary.json`의 모든 행이 passed, UI 감사 신호는 0이어야 한다. 정확한 SHA와 로그를 보관한다.
3. GitHub CI에서 실제 Redis 행이 skip 없이 통과했는지 확인한다. CI는 localhost의 별도 Redis 컨테이너에 요청마다 임의 namespace를 쓰고 종료 뒤 해당 key만 정리한다. 운영 저장소의 URL·토큰을 가져오지 않는다.
4. 사용자 배포 요청이 있는 변경만 병합한다. main에 다른 변경이 생기면 포함 여부와 충돌을 다시 검사한다. Vercel Git 연동의 Production 성공과 SHA를 확인한다.
5. 운영 `/api/release`의 commit이 배포 SHA와 같은지 확인한다. 홈·로그인 화면·무기고 정적 파일 및 새 UI를 확인하되, 운영 계정에 테스트 보상이나 가짜 구매를 쓰지 않는다.
6. 이전 운영 SHA, 새 SHA, PR, CI, 배포 시각과 검사 범위를 기록한다. 실제 기기·외부 NAT·실입금과 fixture 결과는 구분한다.

## 되돌리기

이 변경은 데이터 스키마·가격·초월 확률·코인 보상 규칙을 바꾸지 않는다. 장애가 생기면 먼저 배포 SHA와 익명 request ID로 실패 범위를 확인한다. Vercel 권한이 있으면 이전 **운영** 배포로 rollback하고, 없으면 main에서 배포 변경을 revert하는 PR을 만들어 동일 검사 후 Git 연동으로 배포한다. 체크아웃을 강제 reset하거나 오래된 파일로 다른 작업자의 main을 덮지 않는다.

코드 rollback은 계정 DB를 되돌리는 작업과 다르다. 실제 운영 DB restore는 별도 백업과 검토된 범위가 있어야 한다. 먼저 격리 환경에서 user·sessionVersion·ownership·match ticket·reward receipt·TTL을 함께 복원하고, 결과 재전송이 보상을 두 번 지급하지 않는지 검사한다. `tests/account-restore.test.js`는 이 동작의 fixture 복구 연습이며 실제 서비스 백업이 아니다. 운영 DB 복원이나 실입금 검증을 실행하지 않고 완료로 표시하지 않는다.

## 현장에서 성능·연결 기록하기

홈 또는 설정의 **성능 · 연결 진단 → 측정 다시 시작** 후 같은 맵·모드·동선으로 플레이한다. 10분/30분 시점에 JSON을 저장한다. 4가지 품질마다 반복한다. 프레임 중앙값/p95는 최근 최대 1,800개의 유효 프레임이며, 전체 표본/긴 프레임 수는 측정 시작 이후 누적이다. 1초 초과 공백은 프레임 통계에서 제외하므로 긴 멈춤과 온도·배터리도 별도로 기록한다. inputMs는 pointerdown부터 사격 처리까지의 코드 시간이며 화면 표시까지의 지연을 측정하지 않는다. 온도·배터리는 직접 측정해야 한다.

진단은 이름·계정·채팅·위치·토큰을 기록하지 않고 이 기기에만 유지한다. 저장 버튼을 눌렀을 때만 파일을 만든다. API 5xx의 request ID는 서버의 익명 오류 로그와 연결할 수 있다. 연결 기록에는 Peer/방 코드 대신 모드·단계·ICE 상태만 남긴다. 서로 다른 Wi-Fi와 모바일 데이터의 TURN 성공은 별도로 검증한다.

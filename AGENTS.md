# 공동 작업과 배포

배포할 때마다 [.cursor/rules/deployment-coordination.mdc](.cursor/rules/deployment-coordination.mdc)를 읽고 클로드와 다른 작업자의 최신 변경을 확인한다. 이 규칙은 사용자의 명시적 요청이다.

# 검증

- UI 검사는 실제 브라우저나 기기로 화면과 경로를 탐색한 후 작성한다. 순수 로직 검사는 탐색이 필요하지 않다.
- 단위·브라우저·Android·구매 검증 중 실제 실행한 내용을 구분한다. 빌드나 메모리 API 구매를 실기기·실결제 검증으로 표현하지 않는다.
- ARTEMIS와 Android 기기는 선택 사항이다. 기기 작업 전 `adb devices -l`로 대상을 확인하며 관련 없는 앱이나 작업을 방해하지 않는다.
- 자격 증명을 채팅이나 로그에 노출하지 않는다.

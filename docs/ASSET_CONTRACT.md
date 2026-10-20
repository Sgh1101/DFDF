# 새 맵·3D 자산 가져오기 규격

원본 보존 검사는 `npm run check:assets`로 실행한다. 챔피언스 39개, 네온 28개, 총·칼 팩 485개 파일의 SHA-256과 길이를 기존 manifest와 비교한다. 원본을 수정해 검사에 맞추는 방식은 금지한다. 시각 보정은 별도 어댑터에서 수행한다.

| 항목 | 규격 |
| --- | --- |
| 좌표 | 게임은 미터 단위, +Y 위, 총구 방향 -Z. 원본 단위·축을 manifest에 함께 기록하고 어댑터 한 곳에서 변환 |
| 원점 | 무기는 장착 기준, 맵은 기준 지점·원본 crop·scale을 기록 |
| 기준점 | `userData.anchors.right/left/muzzle`: 모델 좌표의 유한한 숫자 3개. 왼손이 없는 모델은 null. 기준점도 모델 변환과 함께 처리 |
| 원본 리그 | 뼈 이름·부모·pivot·rotation·display transform·UV 보존. 부모 변환을 자식에 두 번 적용하지 않음 |
| 재질 | 텍스처 해상도·nearest/linear 필터·투명도·양면·emissive 별도 명시. 원본 색·형태 변경은 별도 변형으로 표시 |
| 애니메이션 | draw/idle/fire/reload/inspect/holster와 각 clip 길이·loop·보간·부품별 pivot. 원본에 없는 모션을 원본이라고 표시하지 않음 |
| 소리 | 원본 sound event와 파일, 재생 위치·pitch·구간. 중단·뮤트·재시작 시 모든 관련 소스 정리 |
| 성능 | 원본 geometry 보존본과 파생 LOD 분리. vertex/triangle/material/draw-call/텍스처 바이트를 측정. 콜라이더·navigation·위험 경계는 그래픽 LOD와 분리 |
| 수명 | 공유 텍스처·template 소유자는 cache, preview 전용 renderer·geometry·animation loop는 preview 소유. 늦은 비동기 응답은 세대 번호로 폐기 |
| 검증 | 무기고·1인칭·ADS·장전 취소·inspect·3인칭·드롭·모바일 4품질에서 비교. 원본 해시 검사와 스크린샷·장착 대상 검사 모두 필요 |

초기 총기 6종에는 명시한 손·총구 기준점을 적용했다. 기존 가져온 총 9종·챔피언스·칼의 원본 리그와 텍스처는 별도 importer가 계속 사용한다. Tripo 같은 생성 도구를 연결하더라도 이 규격과 실제 게임 검사를 통과해야 한다.

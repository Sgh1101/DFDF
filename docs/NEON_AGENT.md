# 네온 요원 연결

**혼자 하기 또는 방의 요원 선택 → 네온 → 전투 투입**으로 사용한다. 기존 요원 뒤에 추가해 기존 요원 식별자와 순서를 유지한다. 요원 43명, 능력 172개다.

| 키 | 능력 | DFDF 동작 |
| --- | --- | --- |
| Q | 릴레이볼트 | 0.35초 준비, 초속 38m·중력 4.8m/s², 속도를 유지하며 한 번 반사. 첫 충돌과 다음 충돌(또는 반사 후 0.75초) 지점에서 각각 0.8초 뒤 반경 5m, 2.5초 뇌진탕. 벽에 가려진 적 제외. 2회, 200크레딧 |
| E | 고속기어 | 10초간 이동 속도 1.4배. **좌클릭/모바일 사격으로 6m·0.8333초 슬라이딩 후 질주 종료·일반 무기 복귀**. 해당 클릭은 총을 쏘지 않으며 다시 누르면 정상 사격. 2킬마다 슬라이딩 충전. 재사용 30초 |
| C | 추월차선 | 원본의 0.4초 이동 예고 후 길이 25m, 높이 4m, 간격 2.4m의 장벽 두 개. 지형 높이에 따라 분할, 4초간 양옆 시야 차단. 중앙 통로 유지. 1회, 300크레딧 |
| X | 오버드라이브 | 7포인트. 20초간 손에서 40m 빔을 발사해 0.1초당 피해 18. 고속기어·슬라이딩 재충전. 궁극기 중 좌클릭은 빔, 우클릭은 슬라이딩 |

피해와 상태 이상은 방장이 결정한다. 능력 요청·시전 재생은 기존 경로를 사용하고 질주·슬라이딩·궁극기·뇌진탕 상태를 스냅샷으로 보완한다. 손님은 직접 피해를 주지 않는다. 사망·라운드 초기화·요원 변경 때 전용 상태를 지운다. 능력 없는 모드에서는 기존 제한을 따른다.

## 원본과 적용 범위

`SeafleNeonValorant-NoSound-1.0.0-release.jar`는 **Seafle - UnfixedGames**의 Fabric 1.20.1 모드다. JAR에는 **전신 캐릭터 모델이 없다**. 두 팔 모델/일반·충전 텍스처, 스킬 아이콘 4개, HUD 장식, 전기 파티클 12장, 팔 동작과 슬라이딩 데이터가 있다.

이 PNG·JSON **28개를 바이트 그대로** `assets/neon/1.0.0/`에 복사했다. 해상도를 줄이거나 PNG를 재인코딩하지 않았고 팔의 상자 3개·원본 UV를 유지했다. 브라우저는 크기·SHA-256을 검증하고 텍스처 디코딩이 끝난 뒤 사용한다. `manifest.json`에 원본 JAR 해시와 각 항목의 해시가 있다.

원본 64×64 팔 PNG에는 머리·몸·다리까지 포함된 슬림형 Minecraft 플레이어 스킨이 있다. `neon-appearance.js`는 이 텍스처의 원래 UV를 DFDF 관절에 입혀 전신과 선택 초상화를 만든다. 이전의 별도 얼굴·머리카락·복장 그림은 제거했다. 전신 메시 자체는 DFDF 관절에 맞춰 재구성한 것이며 원본 JAR에 전신 메시가 들어 있다는 뜻은 아니다.

1인칭은 `HeldItemRendererMixin`의 이동(-.25, -.81, -.58)·배율 .46과 GeckoLib 1.20.1 아이템 원점(.5, .51, .5)을 합성한다. 픽셀 단위 배율은 .02875, 원점은 (-.02, -.5754, -.35)이다. GeckoLib의 X 반사, X/Y 회전 부호, ZYX 회전, 상자 UV, 누락 트랙 초기화를 적용한다. 선형/Catmull-Rom 및 원본 easeInCirc 키프레임을 지원하고 Molang은 실행하지 않는다. E 준비·대기·달리기, C/Q 전체 시전, 궁극기 준비·발사·복귀를 원본 타임라인으로 재생한다. 일반/충전 PNG 전환 시간도 원본 컨트롤러에서 옮겼다. 기존 총·일반 시전 손을 중복 표시하지 않고 빔 시작점도 원본 오른손을 따라간다.

`neon-fx-source.js`는 JAR의 `FastLaneRenderer`, `FastLaneOrbRenderer`, `RelayBoltRenderer` 중 실제 호출되는 수식·정점 생성 메서드를 JavaScript로 옮긴 파일이다. C의 주 몸체·물결·내부 빛·안개·하단 불꽃·곁가지·상단 어두운 띠·바닥선, 예고 궤적과 원본 파티클 UV를 유지한다. Q는 6중 구체·100분할 전기 꼬리·푸른 충전 링·노란 충전·섬광·기둥·잔광·4초 균열을 원본 수식과 크기로 그린다. `neon-effects.js`가 동적 GPU 버퍼를 재사용하고 Minecraft 지면/벽 조회를 DFDF 지형/충돌체로 연결한다. 원본의 사용되지 않는 이펙트 레이어는 추가하지 않는다.

참조한 GeckoLib 구현: [GeoItemRenderer](https://github.com/bernie-g/geckolib/blob/7d6f32db9168a24e14b327c0ad9f8f87dfc204de/Fabric/src/main/java/software/bernie/geckolib/renderer/GeoItemRenderer.java), [RenderUtils](https://github.com/bernie-g/geckolib/blob/7d6f32db9168a24e14b327c0ad9f8f87dfc204de/Fabric/src/main/java/software/bernie/geckolib/util/RenderUtils.java).

Minecraft 런타임이나 모드 클래스를 실행하지 않는다. 원본 수식을 보존해 브라우저로 이식한 것이므로 엔진·조명·지형 차이까지 픽셀 단위로 동일하다고 주장하지 않는다. 비용·궁극기 피해량 등은 DFDF 규칙을 유지한다. 제공된 **NoSound** 버전에는 캐릭터 음성/음원이 없다.

재패키징:

```sh
python scripts/package-neon-assets.py /path/to/SeafleNeonValorant-NoSound-1.0.0-release.jar
# CFR 0.152로 JAR를 정적 분석한 결과 폴더에서 이펙트 수식 재생성:
python scripts/port-neon-effects.py /path/to/decompiled
```

## 검증

```sh
npm run check
npm test
npm run dev
# Playwright/Chrome 경로를 환경에 맞게 지정한 다른 터미널에서:
npm run test:neon
npm run test:neon-fidelity
# 로컬 PeerServer의 peer 모듈을 설치하거나 DFDF_PEER_SERVER_MODULE로 지정:
npm run test:neon-online
```

단위 검사는 원본 파일의 해시·크기, 보간·좌표·UV·충전 전환, 시간별 이펙트의 유효한 정점·범위·색·파티클 UV를 확인한다. 브라우저 검사는 실제 선택 화면과 원본 스킨 20메시, 팔 지오메트리, E 좌클릭·이동 중 슬라이딩 거리/재충전·무기 복귀, 양옆 시야 차단/중앙 통로, 충격탄의 뇌진탕, 빔 피해와 손님 피해 차단, 실제 GPU 이펙트 표시·해제를 확인한다. 별도 검사에서는 브라우저 두 개를 로컬 WebRTC로 연결해 손님의 능력 요청과 방장 처리, 상태 동기화, 뇌진탕 만료를 검증한다.

계정·구매 API는 테스트용 메모리 저장소를 사용한다. 실제 Redis 검사는 별도 환경이 필요하다. Android 기기·실제 스토어 결제 검증과는 구분한다.

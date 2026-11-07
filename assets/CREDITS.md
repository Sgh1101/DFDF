# 사진 재질 · 하늘 조명 · 글꼴 출처

`assets/mat`의 표면 재질과 `assets/env`의 하늘 조명(HDRI)은 모두 **CC0 1.0**(퍼블릭 도메인) 자료입니다. 출처 표기 의무는 없지만 감사의 뜻으로 적어 둡니다. 게임에 맞게 크기를 줄이고, 노멀 맵을 OpenGL 방향으로 맞추고, 거칠기·주변 차폐·금속도를 한 장(ORM)으로 묶었습니다.

## 표면 재질 (ambientCG, Poly Haven)

| 파일 | 원본 | 받은 곳 |
|---|---|---|
| snow, sand | ambientCG Ground092C (눈은 같은 결에 흰색) | playcanvas/engine 예제 |
| stoneblock | ambientCG Bricks076A | playcanvas/engine 예제 |
| concrete | ambientCG Concrete07 | yuki-koyama/cc0assetsloader |
| container | ambientCG Metal26 (+ 골판 무늬를 더함) | yuki-koyama/cc0assetsloader |
| asphalt | ambientCG Metal01 | yuki-koyama/cc0assetsloader |
| deckplate | ambientCG MetalPlates006 | VeraVisions/nuclide-pbr |
| glasswall | ambientCG Tiles052 | VeraVisions/nuclide-pbr |
| plaster | ambientCG Metal012 | VeraVisions/nuclide-pbr |
| planks | ambientCG WoodFloor041 | VeraVisions/nuclide-pbr |
| paving | ambientCG PavingStones094 | VeraVisions/nuclide-pbr |
| siding | ambientCG WoodSiding001 | VeraVisions/nuclide-pbr |
| brick | ambientCG Bricks023 | VeraVisions/nuclide-pbr |
| rust | ambientCG Metal022 | VeraVisions/nuclide-pbr |
| ruin | ambientCG Bricks045 | VeraVisions/nuclide-pbr |
| gravel | Poly Haven rocky_trail (색만, 결은 밝기에서 만듦) | playcanvas/engine 예제 |
| basalt | Poly Haven rock_boulder_cracked (색만) | playcanvas/engine 예제 |
| groundmoss | Poly Haven coast_sand_rocks_02 (색만) | playcanvas/engine 예제 |

## 하늘 조명 (Poly Haven HDRI, pmndrs/drei-assets 사본)

| 파일 | 원본 |
|---|---|
| alpine | immenstadter_horn |
| park | rooitou_park |
| city | potsdamer_platz |
| dawn | kiara_1_dawn |
| forest | forest_slope |
| warehouse | empty_warehouse_01 |
| studio | studio_small_03 |

- ambientCG: https://ambientcg.com (CC0 1.0)
- Poly Haven: https://polyhaven.com (CC0 1.0)

## 글꼴 (Google Fonts, SIL Open Font License 1.1)

글꼴 파일은 저장소에 없고, 페이지가 Google Fonts(`fonts.googleapis.com`)에서 불러옵니다. 모두 SIL Open Font License 1.1로 배포되어 웹사이트와 게임에서 상업적으로도 쓸 수 있습니다.

| 글꼴 | 만든 곳 |
|---|---|
| Jua | Woowahan Brothers |
| Gowun Dodum | Yanghee Ryu |
| Black Han Sans | Zess Type |
| Orbitron | Matt McInerney |
| Noto Sans KR | Google (Adobe와 함께 만든 Source Han Sans 기반) |

- Google Fonts: https://fonts.google.com
- SIL Open Font License 1.1: https://openfontlicense.org

## 황혼 지구 (제공된 어센트 구조 / 자체 블록 표현)

사용자가 제공한 `ascent-final2021.schematic`의 구조를 `scripts/build-ascent-district.js`가 변환합니다. source SHA `b987d994b5aa01e0b614b5e7d92a4b8f41f7cf6ecab1daddd5ba3fc4cf1b9c28`, 좌표와 불변 지문은 `scripts/ascent-contract.js`가 기록합니다. 가로·세로1.75, 높이1.25로 넓히며 길·엄폐물·계단 배치를 바꾸지 않습니다. 현행 입력이 외부 구조임을 구분하고 제공 사실을 제3자 재배포·광고 허가 확인으로 표시하지 않습니다.

블록239개 타일과 투명 실루엣은 `scripts/paint-block-textures.py` 및 `scripts/block-shapes.json`에서 만듭니다. Claude의 단색/마스크 표현을 유지하고 구리색·슬레이트·푸른 석재와 조명을 자체 조정했습니다. Minecraft/Riot 원본 텍스처 묶음은 포함하지 않습니다. 이전 자체 마을 생성 코드는 폐기하고 사막 맵 삭제를 유지합니다. 상세는 `docs/ASCENT_TRIAL.md`와 `docs/asset-provenance.md`를 참고하세요.

## 챔피언스 및 권리 확인 상태

2026-11-04: 사용자의 정정에 따라 챔피언스 총은 원본을 참고한 자체 디자인으로 생성합니다. `scripts/champions-phantom/gun.js`와 `gun-paint.js`가 형상·공격/수비 텍스처를 만들며 JAR 총 파일을 기본 패키지에 복사하지 않습니다. 마무리·배너·음악도 DFDF 생성 코드의 결과입니다. 이전 원본 복사본은 현행 트리에서 제거했으며 비교용 지문만 `docs/superpowers/records/2026-11-04-champions-reference-hashes.json`에 남깁니다.

`assets/champions-phantom/dfdf-1/SOURCE-NOTICE.txt`와 생성 스크립트가 제작 경로를 기록합니다. 광고 설정은 별도입니다. 전체 기록은 `docs/asset-provenance.md`를 확인하세요.

## SGH나비칼과 자체 칼

SGH나비칼의 형상, 텍스처, 9개 뼈대, 직접 작성한 키프레임과 합성음 8개는 `scripts/build-sgh-butterfly.js`로 생성합니다. 펼치기, 자세히 보기와 세 가지 공격의 타이밍을 참고해 움직임과 음향을 새로 구성했습니다. 각 배포 파일의 지문과 크기는 `assets/rgx-firefly/v1/manifest.json`에 기록합니다. 나머지 칼 10종은 `js/knife-designs.js`에서 생성하며 기존 손·피벗·모션을 유지합니다.

## 황혼 지구 구조 복원 (2026-11-04)

사용자의 최신 지시로 위 독립 배치 교체 설명은 황혼 지구에 대해서 대체합니다. `ascent-final2021.schematic` 제공본의 구조를 `scripts/build-ascent-district.js`로 변환하고, 자체239개 단색 타일/투명 마스크/조명으로 표현합니다. 원본 출처·SHA와 자체 외형을 구분하며 원본 텍스처는 포함하지 않습니다. 높이 배율1.25를 유지하고 가로·세로만1.75로 넓혔습니다. 이전 자체 마을 생성 코드는 원본을 덮어쓰지 못합니다. 제공 사실을 제3자의 허가 확인으로 표시하지 않습니다. 상세는 `docs/ASCENT_TRIAL.md`, `docs/asset-provenance.md`를 확인하세요.

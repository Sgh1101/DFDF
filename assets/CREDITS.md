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

## 하늘섬 마을 (DFDF 자체 지형)

2026-11-01 광고 준비 작업에서 `scripts/build-original-maps.js`의 독립적인 배치로 교체했습니다. 스폰·사이트 좌표는 `js/original-map-layouts.js`, 모델·충돌 생성은 위 생성 스크립트가 기준입니다. 외부 게임의 지형·UV·재질·이미지·schematic은 생성 입력이 아닙니다. 각 패키지 manifest에 생성 경로와 해시를 기록합니다.

기존 Kour.io 맵 7의 파일과 원본 schematic에서 만든 형상은 현행 배포 자산에서 제거했습니다. 과거 자료는 Git 이력에 남아 있으므로 그 이력의 출처 설명을 현행 자산의 사용 허가로 해석하지 마세요. `ascent_trial` 내부 이름은 저장 데이터와 연동을 위한 호환 이름입니다. 사막 마을과 전용 이벤트 기능은 클로드의 최신 삭제 작업을 유지합니다.

하늘섬의 블록 텍스처는 `scripts/paint-block-textures.py`가 그린 자체 이미지입니다. 기본 Minecraft 텍스처를 추출한 파일이 아닙니다. 클로드가 적용한 재료별 단색 텍스처를 그대로 사용합니다.

## 챔피언스 및 권리 확인 상태

2026-11-03: 사용자가 원본 제작자라고 밝히며 제공한 `ChampionsPhantom2026-0.1.0.jar`의 총 외형·비율·색상을 요청했습니다. 총 형상 JSON과 공격·수비 기본/발광 텍스처는 원본 바이트를 보존하며 `scripts/champions-phantom/source-gun/provenance.json`에 해시와 출처를 기록합니다. 나머지 마무리·배너·음악은 DFDF 생성 코드의 결과입니다.

`assets/champions-phantom/dfdf-1/SOURCE-NOTICE.txt`와 생성 스크립트가 총 원본 및 나머지 연출의 제작 경로를 구분해 기록합니다. 광고 설정은 별도입니다. 전체 기록은 `docs/asset-provenance.md`를 확인하세요.

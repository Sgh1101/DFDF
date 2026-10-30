# 사진 재질 · 하늘 조명 출처

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

## 사막 마을 (Kour.io 맵 7)

`assets/maps/kour`의 맵(모델, UV, 재질, 텍스처)은 Kour.io 공개 클라이언트(`https://kour.io/StreamingAssets/map7?v=4.24`)의 맵 7을 운영자의 kouor 프로젝트가 JSON으로 옮긴 것을 그대로 가져온 것입니다. 원본 파일 이름과 해시는 `assets/maps/kour/manifest.json`에 적혀 있습니다. 충돌 상자(`map7-collision.json`)는 이 게임이 `scripts/import-kour-map.js`로 같은 파일에서 만들었습니다.

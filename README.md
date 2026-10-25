# 13 소개 영상 사이트

`13fps.vercel.app`(게임)과는 별도의 Vercel 프로젝트(`13fps-film`)가 이 브랜치(`film-site`)를 올립니다.
영상은 영상 세션(`ccr-b13d9aff-wdadkp`, `film/out/`)이 만든 것을 그대로 가져왔습니다.
2026-10-25: 첫 장면을 챔피언스 팬텀 대신 소총(밴달)·봉황 스킨으로 다시 녹화한 판(`claude/film-gun`, `film/out/`)으로 바꾸고, 포스터도 그 판의 첫 헤드샷 장면(1.05초)으로 바꿨습니다.

- `index.html` 재생 페이지 (항상 가로 16:9: 동작 줄이기 설정은 동작 줄인 컷, 나머지는 원본)
- `v/master_16x9.mp4` · `v/cut_reduced_16x9.mp4` (세로 컷은 쓰지 않아 뺐습니다)
- `captions.ko.vtt` 한국어 자막 (영상 세션의 `captions.srt`를 변환)
- `poster.jpg` 영상 한 장면

이 프로젝트는 `main`이 바뀌어도 새로 빌드하지 않도록(`commandForIgnoringBuildStep`) 이 브랜치만 빌드합니다.
다시 올리려면 이 브랜치에 푸시한 뒤 `film-site` 브랜치를 production 대상으로 배포합니다.

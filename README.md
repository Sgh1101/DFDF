# 13 소개 영상 사이트

`13fps.vercel.app`(게임)과는 별도의 Vercel 프로젝트(`13fps-film`)가 이 브랜치(`film-site`)를 올립니다.
영상은 영상 세션(`ccr-b13d9aff-wdadkp`, `film/out/`)이 만든 것을 그대로 가져왔습니다.

- `index.html` 재생 페이지 (세로 폰은 9:16 컷, 동작 줄이기 설정은 동작 줄인 컷, 나머지는 원본)
- `v/master_16x9.mp4` · `v/cut_9x16.mp4` · `v/cut_reduced_16x9.mp4`
- `captions.ko.vtt` 한국어 자막 (영상 세션의 `captions.srt`를 변환)
- `poster.jpg` 영상 한 장면

이 프로젝트는 `main`이 바뀌어도 새로 빌드하지 않도록(`commandForIgnoringBuildStep`) 이 브랜치만 빌드합니다.
다시 올리려면 이 브랜치에 푸시한 뒤 `film-site` 브랜치를 production 대상으로 배포합니다.

# 13 — 30초 설명 영상

**한 문장:** 13은 링크 하나로 열리는 5대5 전술 FPS다. 클릭 네 번이면 라운드 안이고, 빈자리는 AI가 채운다.
**보고 나면:** 설치 없이 13fps.vercel.app에서 지금 혼자서도 5대5 한 판을 시작할 수 있다는 걸 안다.
**대상:** 이미 전술 FPS를 하는 사람. **질문:** “5대5 전술 FPS, 설치부터 기다려야 할까?”

## 결과물

| 파일 | 내용 |
|---|---|
| `out/master_16x9.mp4` | 원본 1920×1080, 60 fps, H.264 (crf 16, yuv420p), AAC 256k |
| `out/cut_9x16.mp4` | 1080×1920 재구성 |
| `out/cut_1x1.mp4` | 1080×1080 재구성 |
| `out/cut_reduced_16x9.mp4` | 동작 줄이기 판: 같은 순서·같은 시간, 움직임 대신 짧은 페이드, 확대 없음 |
| `captions.srt` | 화면에 박힌 글자와 같은 말·같은 시간 (음성 없음) |
| `contact.png` | 콘택트 시트: 원본의 모든 비트 + 9:16·1:1 |
| `directions.html` | 네 방향과 선택 이유(결정 기록) |
| `DECISIONS.md` · `SOURCES.md` | 판단 한 줄씩 · 모든 숫자와 주장의 출처 |
| `review/` | 검증 결과(`verify.json`), 390 px 시트, 수정 전후 쌍(`fixes/`) |

## 다시 만들기

저장소 루트에서 `npm ci`를 한 번 한 뒤(Playwright), `film/`에서:

```sh
node scripts/tokens.js                 # tokens.json -> tokens.css
node scripts/audio.js                  # 소리 -> out/bed.wav (-16 LUFS, -2 dBTP)
node scripts/render.js --format 16x9 --audio out/bed.wav --out out/master_16x9.mp4
node scripts/render.js --format 9x16 --audio out/bed.wav --out out/cut_9x16.mp4
node scripts/render.js --format 1x1  --audio out/bed.wav --out out/cut_1x1.mp4
node scripts/render.js --format 16x9 --reduced --audio out/bed.wav --out out/cut_reduced_16x9.mp4
node scripts/captions.js               # captions.srt
node scripts/verify.js                 # review/verify.json, review/beats/, review/390-*.png
node scripts/contact.js                # contact.png
```

화면 다시 찍기(선택): 저장소 루트에서 `npm run dev`를 켠 채 `node film/scripts/capture-screens.js`.

구조: `timeline.js`가 모든 장면·비트·움직임·컷·문구·소리 신호를 가진 TIMELINE 하나다. `film.html`의 `window.seek(t)`는 t만으로 한 프레임을 그린다(난수는 시드 고정, 시계·애니메이션 없음). `render.js`가 헤드리스 Chrome에서 t = n/60마다 찍어 ffmpeg(libx264, crf 16, yuv420p)로 보낸다. 소리는 같은 TIMELINE으로 `OfflineAudioContext`에서 만든다.

## 검사한 것

RESULTS_PLACEHOLDER

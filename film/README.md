# 13 — 40초 설명 영상 (두 번째 판)

**한 문장:** 13은 브라우저 탭 하나로 바로 하는 5대5 전술 FPS다. 가입은 클릭 한 번, 교전까지 클릭 네 번, 요원·스킬·맵·스킨은 다 들어 있고, 혼자여도 5대5다.
**보고 나면:** 다운로드 없이 13fps.vercel.app에서 지금 바로, 혼자서도 내용이 꽉 찬 5대5 한 판을 시작할 수 있다는 걸 안다.
**대상:** 이미 전술 FPS를 하는 사람. **첫 그림:** 실제 플레이가 화면을 채우다가 브라우저 창 안으로 접힌다 — 보고 있던 게 탭이었다.

**구성:** S1 플레이 → 탭 0–6.5 s · S2 가입 한 번, 클릭 네 번 6.5–17 s · S3 안에 든 것(요원·스킬·맵·스킨) 17–27 s · S4 혼자여도 5대5, 링크로 친구 27–34.5 s · S5 다운로드 대신 탭 하나 34.5–40 s.

첫 판(밝은 바탕, 다운로드 바 도식)과 무엇이 달라졌고 왜인지는 `directions.html`과 `DECISIONS.md`에, 다른 게임이 어떻게 말하는지 본 것은 `RESEARCH.md`에 있다.

## 결과물

| 파일 | 내용 |
|---|---|
| `out/master_16x9.mp4` | 원본 1920×1080, 60 fps, H.264 (crf 16, yuv420p), AAC 256k |
| `out/cut_9x16.mp4` | 1080×1920 재구성 (오프닝 플레이는 가운데를 세로로 잘라 채움) |
| `out/cut_1x1.mp4` | 1080×1080 재구성 |
| `out/cut_reduced_16x9.mp4` | 동작 줄이기 판: 같은 순서·같은 시간, 카메라 이동·확대 없이 컷과 짧은 페이드만 (녹화된 플레이 자체는 그대로) |
| `captions.srt` | 화면에 박힌 글자와 같은 말·같은 시간 (음성 없음) |
| `contact.png` | 콘택트 시트: 원본의 모든 비트 + 9:16·1:1 |
| `directions.html` | 네 방향과 선택 이유(결정 기록) |
| `DECISIONS.md` · `SOURCES.md` · `RESEARCH.md` | 판단 한 줄씩 · 모든 숫자와 주장의 출처 · 조사 노트 |
| `screens/clips/*.mp4` | 게임 엔진을 한 프레임씩 돌려 녹화한 플레이 (거의 무손실 H.264; `film.html`이 읽는 JPEG 프레임열은 `node scripts/clips.js unpack`으로 다시 만든다. `clips.json`에 녹화 기록) |
| `review/` | 검증 결과(`verify.json`), 390 px 시트(`390-*.png`), 픽셀 대비 조각(`contrast/`), 첫 판의 수정 전후 쌍(`fixes/`) |

## 실제 플레이 영상으로 바꿔 끼우기

`screens/clips/open`(5 s, 30 fps)과 `screens/clips/cast`(2.5 s, 30 fps)는 소프트웨어 렌더러로 녹화한 것이라 실제 GPU 플레이보다 화질이 낮다. 실제 플레이를 넣으려면:

```sh
# 16:9로 녹화한 mp4에서 5초를 잘라 같은 규격으로 바꿔 넣는다 (오프닝: 5 s, 30 fps = 150장)
ffmpeg -ss 12.0 -t 5 -i my-play.mp4 -vf "scale=1920:1080,fps=30" -c:v libx264 -crf 17 -pix_fmt yuv420p film/screens/clips/open.mp4
node film/scripts/clips.js unpack      # 프레임열을 다시 만들고 장수를 확인
```

오프닝 클립에 어울리는 장면: 달리다가 능력을 쓰고 몇 발 쏘는 5초, HUD 포함, 사망·메뉴·채팅 없음. 소리 신호(`timeline.js` → `cues`의 `shots`, `cast`)는 클립 안에서 쏘고 쓰는 시각에 맞춰 둔 것이니 클립을 바꾸면 그 시각도 맞춘다. 바꾼 뒤 `node scripts/verify.js`가 프레임 수를 확인한다.

## 다시 만들기

저장소 루트에서 `npm ci`를 한 번 한 뒤(Playwright), `film/`에서:

```sh
node scripts/clips.js unpack           # screens/clips/*.mp4 -> JPEG 프레임열 (커밋하지 않음)
node scripts/tokens.js                 # tokens.json -> tokens.css
node scripts/audio.js                  # 소리 -> out/bed.wav (-16 LUFS, -2 dBTP)
node scripts/render.js --format 16x9 --audio out/bed.wav --out out/master_16x9.mp4
node scripts/render.js --format 9x16 --audio out/bed.wav --out out/cut_9x16.mp4
node scripts/render.js --format 1x1  --audio out/bed.wav --out out/cut_1x1.mp4
node scripts/render.js --format 16x9 --reduced --audio out/bed.wav --out out/cut_reduced_16x9.mp4
node scripts/captions.js               # captions.srt
node scripts/verify.js                 # review/verify.json, review/beats/, review/390-*.png (python3 + numpy + Pillow)
python3 scripts/audio-check.py out/master_16x9.mp4   # 소리 신호가 제때 나는지
node scripts/contact.js                # contact.png
```

화면·녹화 다시 만들기(선택, 저장소 루트에서 `npm run dev`를 켠 채): `node film/scripts/capture-screens.js`(가입→라운드 경로), `node film/scripts/capture-content.js`(요원·능력·맵·스킨, 게임이 센 개수), `node film/scripts/capture-clips.js`(플레이·맵 회전 녹화; 프레임당 3–6초 걸린다) 뒤 `node film/scripts/clips.js pack`.

구조: `timeline.js`가 모든 장면·비트·움직임·컷·문구·소리 신호를 가진 TIMELINE 하나다. `film.html`의 `window.seek(t)`는 t만으로 한 프레임을 그린다(클립은 t에서 프레임 번호를 계산해 그 JPEG 한 장을 보인다; 시계·애니메이션 없음). `render.js`가 헤드리스 Chrome에서 t = n/60마다 찍어 ffmpeg(libx264, crf 16, yuv420p)로 보낸다. 소리는 같은 TIMELINE으로 `OfflineAudioContext`에서 만든다.

## 검사한 것

RESULTS_PLACEHOLDER

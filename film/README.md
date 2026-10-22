# 13 — 40초 설명 영상

**한 문장:** 13은 링크 하나로 바로 하는 5대5 전술 FPS다. 다운로드 없이도 요원 28명, 스킬 112개, 맵 22개, 스킨 607개가 다 들어 있다.
**보고 나면:** 다운로드 없이 13fps.vercel.app에서 지금 혼자서도, 내용이 꽉 찬 5대5 한 판을 시작할 수 있다는 걸 안다.

**구성:** S1 질문 0–3 s · S2 모델(링크 → 탭, 열 자리) 3–9 s · S3 증명(클릭 네 번 → 라운드) 9–20 s · S4 안에 든 것(요원·스킬·맵·스킨) 20–30 s · S5 전환(빈자리는 AI, 친구는 링크) 30–36 s · S6 마무리(주소창) 36–40 s.
**대상:** 이미 전술 FPS를 하는 사람. **질문:** “5대5 전술 FPS, 다운로드부터 해야 할까?”

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
| `review/` | 검증 결과(`verify.json`), 390 px 시트(`390-*.png`), 픽셀 대비 잘라 낸 조각(`contrast/`), 수정 전후 쌍 18개(`fixes/*-pair.png`) |

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
node scripts/verify.js                 # review/verify.json, review/beats/, review/390-*.png (python3 + numpy + Pillow)
python3 scripts/audio-check.py out/master_16x9.mp4   # 소리 신호가 제때 나는지
node scripts/contact.js                # contact.png
```

화면 다시 찍기(선택): 저장소 루트에서 `npm run dev`를 켠 채 `node film/scripts/capture-screens.js`(링크→라운드 경로)와 `node film/scripts/capture-content.js`(요원·능력·맵·스킨, 게임이 센 개수).

구조: `timeline.js`가 모든 장면·비트·움직임·컷·문구·소리 신호를 가진 TIMELINE 하나다. `film.html`의 `window.seek(t)`는 t만으로 한 프레임을 그린다(난수는 시드 고정, 시계·애니메이션 없음). `render.js`가 헤드리스 Chrome에서 t = n/60마다 찍어 ffmpeg(libx264, crf 16, yuv420p)로 보낸다. 소리는 같은 TIMELINE으로 `OfflineAudioContext`에서 만든다.

## 검사한 것

모두 이 컨테이너의 헤드리스 Chromium 141과 ffmpeg 6.1에서 실행했다. 실기기 재생, 소셜 플랫폼 업로드, 사람 귀로 듣기는 하지 않았다.

| 검사 | 결과 | 근거 |
|---|---|---|
| 같은 프레임 두 번 렌더 | 동일 | 25.4 s 프레임(맵 타일이 깔리는 중)을 서로 다른 브라우저 두 개에서 찍어 SHA-256 일치, 한 페이지에서 다른 시각을 갔다 와도 일치 (`review/verify.json` → `determinism`) |
| 출력 규격 | 4개 모두 40.000 s, 2400프레임, 60 fps, H.264 yuv420p, AAC 48 kHz | ffprobe (`verify.json` → `media.*.probe`) |
| 자막 = 화면 글자 | 4개 컷 × 17개 큐 모두 일치 | 큐마다 0.1 s 간격으로 화면에 보이는 글자를 읽어 SRT와 대조 (`captions`) |
| 글자 넘침 | 0건 | 문구·카운터가 4개 컷 모두 프레임 안 48 px 여백 안 (`textFits`) |
| 대비(실제 픽셀) | 최저 5.07:1 | 실제 프레임에서 글자 조각을 잘라 배경색 대 글자색 측정: 1행 15.4:1, 2행 7.1:1, “요원 28명” 같은 개수 15.4:1, 빨간 원 안 글자 5.07:1 (`pixelContrast`, `review/contrast/`). 토큰 표는 `scripts/contrast.js` |
| 휴대폰 폭 390 px | 읽힘 | `review/390-*.png`를 직접 봄. 16:9: 1행 약 13 px, 2행 약 11 px, 개수(“스킨 607개”) 라벨 약 13 px·숫자 약 21 px, 자리 안 글자 약 9 px, 마지막 주소 약 12 px. 9:16: 1행 약 23 px, 자리 안 글자 약 14 px. 1:1: 1행 약 21 px, 자리 안 글자 약 13 px. 창 안의 게임 글자와 주소창 속 작은 주소는 390 px에서 읽히지 않는다(의미는 문구가 전한다) |
| 소리 크기 | 4개 모두 −16.0 LUFS, 트루 피크 −2.0 dBTP | ffmpeg `ebur128=peak=true`, 납품 파일에서 측정 |
| 소리 신호 시각 | 14개 중 13개 오차 0 ms, 1개 +60 ms | `scripts/audio-check.py`로 납품 파일의 음 시작점을 찾아 TIMELINE과 대조. 25.0 s 개수 신호는 두 음 중 둘째 음(+60 ms)이 잡힘. 마지막 200 ms −52.2 dB로 잘리지 않고 끝남 |
| 번쩍임 | 초당 최대 1회, 빨강 번쩍임 0회 | `scripts/pixels.py flashes`: 4×4 구역별 상대 휘도에서 0.1 이상 반대 방향 변화 한 쌍을 1회로 셈. WCAG 2.3.1을 근사한 자체 검사이며 공인 도구(PEAT) 결과는 아니다 |
| 소리 없이 보기 | 의미 전부 화면에 있음 | 모든 비트와 전환 프레임을 봄. 소리 신호마다 같은 순간의 화면 동작이 있다 |
| 소리만 듣기 | **귀로 듣지 못함** | 대신 스펙트로그램과 음 시작점으로 확인. 첫 확인에서 저음이 지나치게 커서 줄였다 (`DECISIONS.md`) |
| 디자인 검토 | 서브에이전트가 Meaghan Choi의 질문으로 검토 (30초판) | 반드시 고칠 6개를 반영(규칙 장면·거짓 설치 문구 삭제, 카운터 동기화 등). “GB 표시” 제안은 지어낸 숫자라 거절. 전후 쌍: `review/fixes/7`–`16`, `17`–`18`. **40초판의 S4는 서브에이전트 검토를 다시 받지 않았다** — 같은 자동 검사와 직접 본 정지·전환 프레임만 거쳤다 |
| 접근성 검토 | 서브에이전트 검토 후 수정 | 상대 팀 흐리게 처리(2.9:1) 제거, 클릭 고리 테두리, 다운로드 바 색, 자리 글자 확대, 화면→자막 자동 대조와 구역별 번쩍임 검사 추가 |
| `directions.html` | 390 px·1440 px에서 가로 넘침 없음, 깨진 이미지 0 | Chromium으로 열어 확인 |
| 동작 줄이기 판 | 16:9만 렌더 | 같은 순서·시간, 확대 없음(S4의 패닝도 없이 전체 화면), 맵 타일은 페이드만. 9:16·1:1 동작 줄이기 판은 만들지 않았다 |

화면은 실제 게임을 로컬 서버와 테스트용 API(`tests/api-harness.js`)로 띄워 찍었다. 운영 서버(13fps.vercel.app)에서 찍은 것은 아니다. 개수는 게임이 실행 중에 세는 `GAME_CATALOG.counts()`에서 읽었고, 운영 서버 설정(`/api/v1?a=config`, 2026-10-22)에서 꺼 둔 요원이 없고 스킨이 607개임을 확인했다. 무엇을 연출했는지는 `SOURCES.md`에 있다.

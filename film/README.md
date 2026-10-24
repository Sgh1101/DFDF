# 13 — 40초 설명 영상 (두 번째 판)

**한 문장:** 13은 브라우저 탭 하나로 바로 하는 5대5 전술 FPS다. 가입은 클릭 한 번, 교전까지 클릭 네 번, 요원·스킬·맵·스킨은 다 들어 있고, 혼자여도 5대5다.
**보고 나면:** 다운로드 없이 13fps.vercel.app에서 지금 바로, 혼자서도 내용이 꽉 찬 5대5 한 판을 시작할 수 있다는 걸 안다.
**대상:** 이미 전술 FPS를 하는 사람. **첫 그림:** 챔피언스 팬텀 스킨의 팬텀으로 헤드샷 두 번(더블 킬, 라운드를 끝낸 처치에 챔피언스 마무리: 용과 뱀)이 화면을 채우다가 브라우저 창 안으로 접힌다 — 보고 있던 게 탭이었다.

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
| `review/` | 검증 결과(`verify.json`), 390 px 시트(`390-*.png`), 픽셀 대비 조각(`contrast/`), 수정 전후 쌍(`fixes/`: 첫 판 `1-`…`18-`, 두 번째 판 디자인 검토 뒤 `v2-*`, 헤드샷 오프닝·스킨 다섯 개 `v3-*`) |

## 실제 플레이 영상으로 바꿔 끼우기

`screens/clips/open`(5 s, 30 fps)과 `screens/clips/cast`(2.5 s, 30 fps)는 소프트웨어 렌더러로 녹화한 것이라 실제 GPU 플레이보다 화질이 낮다. 실제 플레이를 넣으려면:

```sh
# 16:9로 녹화한 mp4에서 5초를 잘라 같은 규격으로 바꿔 넣는다 (오프닝: 5 s, 30 fps = 150장)
ffmpeg -ss 12.0 -t 5 -i my-play.mp4 -vf "scale=1920:1080,fps=30" -c:v libx264 -crf 17 -pix_fmt yuv420p film/screens/clips/open.mp4
node film/scripts/clips.js unpack      # 프레임열을 다시 만들고 장수를 확인
```

오프닝 클립에 어울리는 장면: 1.5초 안에 헤드샷 처치가 나오는 5초(2.5초에 화면이 창으로 줄어들기 시작한다; 챔피언스 마무리의 용은 마지막 처치 2.7초 뒤에 올라온다), HUD 포함, 사망·메뉴·채팅 없음. 소리 신호(`timeline.js` → `cues`의 `shots`, `head`, `motif`, `legend`)는 지금 클립에서 쏘고 처치한 프레임에 맞춰 둔 것이니(`screens/clips/clips.json` → `events`) 클립을 바꾸면 그 시각도 맞춘다. 바꾼 뒤 `node scripts/verify.js`가 프레임 수를 확인한다.

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

화면·녹화 다시 만들기(선택, 저장소 루트에서 `npm run dev`를 켠 채): `node film/scripts/capture-screens.js`(가입→라운드 경로), `node film/scripts/capture-content.js`(요원·능력·맵, 게임이 센 개수), `node film/scripts/capture-skins.js`(무기고, 같은 소총에 스킨 열두 가지), `node film/scripts/capture-clips.js`(헤드샷 오프닝·스킬·맵 회전 녹화; 화면에 남는 프레임마다 3–6초 걸린다; `FILM_EVERY=6`이면 여섯 장에 한 장만 그려 빠르게 미리 본다, `FILM_OUT=폴더`로 실제 클립을 건드리지 않고 시험한다) 뒤 `node film/scripts/clips.js pack`. 녹화 스크립트는 메모리 속 테스트 API에서 `hana` 계정을 만들고 운영자 페이지의 "전체 지급"으로 스킨 607개를 준다. 오프닝의 챔피언스 팬텀 스킨은 "전체 지급"에 없어 `scout|champions_atk`를 따로 지급한다. 챔피언스 마무리는 챔피언스 총에서만 나오므로(`AGENTS.md`) 오프닝의 총은 팬텀이다. 공지 팝업·▶ 홍보영상 단추는 녹화 중 `display:none`으로 숨긴다. 저장소 루트가 아니라 `tests/api-harness.js`가 `api/v1.js`를 상대 경로로 읽으므로 게임 저장소 루트에서 실행한다. 운영 서버와 실제 계정은 쓰지 않는다.

구조: `timeline.js`가 모든 장면·비트·움직임·컷·문구·소리 신호를 가진 TIMELINE 하나다. `film.html`의 `window.seek(t)`는 t만으로 한 프레임을 그린다(클립은 t에서 프레임 번호를 계산해 그 JPEG 한 장을 보인다; 시계·애니메이션 없음). `render.js`가 헤드리스 Chrome에서 t = n/60마다 찍어 ffmpeg(libx264, crf 16, yuv420p)로 보낸다. 소리는 같은 TIMELINE으로 `OfflineAudioContext`에서 만든다.

## 검사한 것

실제로 돌린 것만 적는다. 결과 파일은 `review/verify.json`(2026-10-24, 클립을 현재 게임에서 다시 녹화한 최종 렌더 기준; 아래 표의 숫자 중 2026-10-24로 적은 것만 그때 다시 잰 것).

| 검사 | 방법 | 결과 |
|---|---|---|
| 결정성 | t = 20.6 s 프레임을 서로 다른 두 브라우저에서 렌더해 SHA-256 비교, 같은 브라우저에서 다른 t로 갔다 돌아와 다시 비교 | 세 해시 동일 |
| 클립 프레임 | `timeline.js`가 부르는 다섯 클립의 모든 프레임(150·75·48·48·48장) 존재 여부 | 전부 있음 |
| 자막 = 화면 글자 | `captions.srt` 17개 큐마다 큐 안을 0.1 s 간격으로 찾아가(0.6 s보다 짧은 큐는 끝 직전) 보이는 글자에 큐 텍스트가 있는지, 네 컷 모두 | 문제 0 |
| 글자 넘침 | 네 컷 × 15 시점에서 모든 글자 상자가 프레임 안에 있는지 | 넘침 0 |
| 대비(토큰) | `scripts/contrast.js`, 글자 쌍 5개(≥ 4.5:1)와 비문자 쌍 5개(≥ 3:1) | 10/10 통과 (본문 16.5, 보조 6.6, 채운 좌석 라벨 5.1, 테두리 좌석 라벨 15.0, 알약 URL 17.4) |
| 대비(픽셀) | 렌더된 프레임에서 글자 상자를 잘라(`review/contrast/<비율>/`) 실제 전경·배경 색으로 다시 계산, 세 비율 | 23개 조각 × 3 비율 모두 ≥ 4.5:1 (최저 5.07:1, 채운 좌석의 라벨) |
| 소리 크기 | ffmpeg loudnorm 측정, 네 파일 | I −16.1 LUFS · TP −1.9 dBTP · LRA 1.8 (목표 −16 / ≤ −1.5) |
| 소리 신호 시각 | `scripts/audio-check.py`: 원본의 onset을 찾아 `cues`의 시각과 비교 | 34개 중 32개가 3 ms 이내(오프닝의 사격·헤드·처치·마무리 11개 포함, 2026-10-24에 시각을 0.8·0.933·1.333·1.467 s로 옮긴 뒤 다시 잼); 스킬 휘두름 2개(20.0·20.9 s)는 공격이 완만해 가장 가까운 onset이 −250/−150 ms |
| 깜빡임 | 초당 밝기 전환 횟수와 포화 빨강 전환 횟수, 네 파일 | 최대 일반 2/s, 빨강 0/s (한계 3/s) |
| 헤드샷 녹화 | 녹화 중 게임의 피해 함수와 피격 표시를 감싸 프레임마다 기록(`screens/clips/clips.json` → `open.events`) | 4발 모두 머리 판정, 처치 2회 모두 헤드샷(프레임 28·44, 6.3 m·6.5 m), 두 번째 처치에서 챔피언스 마무리 실행(`finisher: champions_atk`); 쏠 때 내 속도 0.13·0.04·0·0 m/s (2026-10-24 다시 녹화: 쏜 프레임 24·28·40·44; 그 전엔 소총·봉황, 프레임 40·56, 5.7 m·5.8 m) |
| 스킨 보유 | 녹화 계정의 클라이언트 인벤토리(`GUN_SKINS.mineItems()`) | 607개(게임이 센 스킨 수와 같음), 팬텀에 챔피언스 팬텀·공격, 소총에 심연 장착 성공(`clips.json` → `skinSet`; 챔피언스 스킨은 코인 전용이라 `scout|champions_atk`를 따로 지급) |
| 규격 | ffprobe, 네 파일 | 2400 프레임 · 60 fps · yuv420p · 40.000 s · AAC 48 kHz 2ch; 1920×1080 / 1080×1920 / 1080×1080 / 1920×1080 |
| 390 px 가독성 | 세 비율의 비트 스틸을 390 px 폭으로 줄인 시트(`review/390-*.png`)를 눈으로 확인 | 카피·숫자·좌석 라벨·알약 URL 읽힘; 게임 화면 안의 작은 UI 글자는 읽히지 않으나 읽을 필요 없음 |
| 디자인 검토 | 완성 합성의 18개 비트 스틸을 검토 서브에이전트에 보냄 | 반드시 3·권장 5 중 7개 반영, 1개 보류(`DECISIONS.md`); 전후 쌍 `review/fixes/v2-*.png` |
| 카피 검토 | 한국어 카피 검토 서브에이전트 1회 | 문체 통일·오프닝 교체 등 반영, 1개 거절(`DECISIONS.md`) |

**2026-10-23 다시 확인(게임 숫자 맞추기).** 게임이 세는 값(`GAME_CATALOG.counts()`, `origin/main` 0364a02)은 요원 28 · 능력 112 · 맵 22 · 스킨 607(무기 19 · 모드 11)로 자막·`timeline.js`와 같아 자막은 그대로다. 낡은 것은 녹화된 홈 화면의 “맵 21종”(버튼 부제와 아래 줄, 두 곳)뿐이었고, 게임이 이제 22종으로 센다. 그래서 `capture-screens.js`·`capture-content.js`·`capture-skins.js`로 화면을 다시 찍고(`screens/*.png`, `path.json`, `content.json`, `skins.json`) 네 컷을 다시 렌더했다. 클립은 HUD만 있고 숫자가 없어 그대로 둔다. 공지 팝업은 `localStorage.lgp_notice_seen`을 미리 넣어 프레임에 나오지 않게 했다(▶ 홍보영상 단추는 창 밖). 이 환경엔 ffprobe가 없어 `verify.js`는 `ffmpeg -i`로 만든 대용품으로 돌렸다(결과 파일은 같은 형식). 전후 비교: `review/fixes/v4-home-map-count.png`(위 21종, 아래 22종).

**2026-10-24 다시 확인(클립을 현재 게임에서 다시 녹화).** `screens/clips/*`(open, cast, map-pogu, map-neon, map-train)를 `origin/main` 62b40c5에서 `capture-clips.js`로 다시 녹화하고 `clips.js pack`, 네 컷을 다시 렌더했다(`audio.js`로 소리 바탕도 다시). 게임이 바뀐 것: 챔피언의 물결 스킨과 총 디자인, 큰 5대5 맵 3/4 크기, 능력 효과가 대상에게 보임, 마무리. **마무리는 요청 설명과 달랐다:** `origin/main`에서 “마지막 처치는 어떤 총이든 챔피언스 마무리”(#76)는 `a1eb27e`로 되돌려졌고 지금은 챔피언스 총에서만 나온다(`AGENTS.md`). 그래서 오프닝은 팬텀에 챔피언스 팬텀·공격 스킨으로 다시 녹화했다(헤드샷 4발, 처치 2회, 두 번째 처치에서 용과 뱀). 이 스킨은 글자 배너 대신 작은 휘장을 쓰므로 “헤드샷·더블 킬” 글자는 화면에 없다. 쏜 프레임이 24·28·40·44로 옮겨 `timeline.js`의 소리 신호도 옮겼다(전: 36·40·52·56). 공지 팝업과 ▶ 홍보영상 단추는 녹화 내내 숨겼다. 이 환경엔 ffprobe가 없어 `verify.js`는 대용품으로 돌렸다. 본 프레임: 오프닝 24·29·40·44·60·100·125·149번, 마스터 0.5·0.97·1.5·2.0·3.0·3.7·4.3·4.8 s, 세 다른 비율의 1.5·4.5 s, cast·맵 세 개의 대표 프레임. 설명은 `DECISIONS.md`와 `SOURCES.md`의 2026-10-24 항목에. 검증: 클립 프레임 수 150·75·48·48·48 확인, 결정성·자막·넘침·대비(최저 5.07:1)·소리 크기(−16.1 LUFS, TP −1.9) 모두 이전과 같은 결과, 깜빡임 일반 최대 2/s·빨강 0/s.

하지 않은 것: 사람이 실제 화면과 스피커로 보고 들은 검사(소리는 수치로만 확인했다), 실제 폰에서의 재생, 음성 해설, 실제 GPU에서 녹화한 플레이(클립은 소프트웨어 렌더), 9:16·1:1의 동작 줄이기 판(16:9만 있다), 헤드샷 오프닝과 스킨 다섯 개를 넣은 뒤의 디자인 검토 서브에이전트 재검토(직접 390 px 시트와 스틸로만 확인했다).


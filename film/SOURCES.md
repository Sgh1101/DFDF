# Sources

Every number and claim in the film, and where it comes from. Paths are relative to the repository root. `film/screens/path.json` and `film/screens/content.json` are the logs the capture scripts wrote while they played the game on 2026-10-22 (local `scripts/dev-server.js`, in-memory API harness from `tests/api-harness.js`, Chromium 141, Korean locale). `film/screens/clips/clips.json` logs the recorded play.

| On screen | Claim | Source |
|---|---|---|
| 0–2.5 s full-frame play, then it shrinks into a browser window · “방금 그거, 브라우저 탭.” | The game runs in a browser tab | `README.md:3` (“브라우저에서 바로 하는 5대5 … FPS”); the clip is the game itself, recorded in headless Chromium (`scripts/capture-clips.js`, `screens/clips/open`) |
| Title: “13” · “브라우저에서 바로, 5대5 전술 FPS” | Name and genre | `manifest.webmanifest` (`"name": "13 — 전술 슈팅"`); `README.md:3`; `index.html:248` (“설치 없이 브라우저에서 바로.”) |
| “가입은 클릭 한 번.” · “인증도, 이메일도 없이.” · click 1 = 로그인 / 가입 | Typing an id and a password and pressing the button makes the account; no verification, no e-mail | `index.html:249` (“아이디와 비밀번호를 정해서 넣고 누르면 끝. 처음 쓰는 아이디면 바로 가입됩니다. 인증 없음.”), `:263` (“No e-mail, no verification.”); `api/v1.js:557-562` (`A.auth`, id 2–16 chars); `path.json` → `signup: "hana"`, `clicks[0]` |
| “링크에서 교전까지, 클릭 네 번.” · 클릭 1–4 | 로그인 / 가입 → 게임 들어가기 → 혼자 하기 → 전투 투입, then the round | `path.json` → `clicks` (four entries, labels read from the buttons); `screens/05-buy.png`, `06-live.png` (clock 1:38, the live round) |
| “탭 하나에 이만큼.” · “요원 28명” | 28 agents | `GAME_CATALOG.counts().agents` at runtime (`content.json`, `js/game-catalog.js:4`); production config on 2026-10-22 has no agent switched off (`/api/v1?a=config` → `game.disabledAgents: ""`); `screens/11-abilities.png` (“28명 중 한 명을 고르세요”) |
| “스킬 112개” · the cast clip (Q 불꽃 장막, E 화염탄) | 112 abilities, four per agent | `counts().abilities` = 112 (`js/game-catalog.js:5`); `README.md` (“능력 112개”); the clip casts 화령's Q and E with the game's own `useAbility()` (`clips.json`). The game mostly says 능력; the film says 스킬 (the request's word and the buy screen's “스킬 & 장비”) |
| “맵 22개” · three orbits (포구, 네온 정점, 달리는 열차) | 22 selectable maps | `counts().maps` = `MAP_LIST.length` = 22 at runtime, the last being 마크X발로 (`js/ascent-trial.js:16`); the select screen's filter shows “전체 22”. The orbits are the home screen's own camera (`titleCam`, `js/legacy/08-…js`) stepped 0.2 s per frame. **The home footer says “맵 21종”**: it counts before 마크X발로 joins the list and is not recounted (`js/home.js:47-55`) |
| “스킨 607개” · the armoury | 607 gun skins (non-default, summed over guns) | `counts().skins` = 607 (`js/game-catalog.js:8`); production config `gacha.items: 607`; home footer “스킨 607종”. `README.md:39` still says 909 — out of date |
| “혼자여도 5대5.” · “나머지는 AI.” | Solo play fills the other nine seats with AI; a round is 5 v 5 | Home button “혼자 하기 · AI 대전” (`screens/03-home.png`); `path.json` → `teams: { total: 10, mine: 5, theirs: 5 }` read from the running round |
| “링크 하나면, 친구가 그 자리에.” | An invite link carries the room code and joins that room when opened | `js/legacy/03-engine.js:21214-21215` (copy invite link), `:21248-21261` (`?room=` → `joinRoom`) |
| “다운로드 대신, 탭 하나.” · `13fps.vercel.app` | The production address | `docs/RELEASE_RUNBOOK.md:3` (“운영 주소: https://13fps.vercel.app”) |
| Motif | The game's own two-note kill sound, A major pentatonic from A4 | `js/legacy/61-kills-that-sound-and-look-like-the-skin-in-your-hands-and.js:94-110` |
| Rifle rounds, casts (sound) | Synthesized after the game's layered gunshot (low body + crack + tail) | `js/legacy/63-heavier-gunshots.js`; not the game's actual audio (headless Chrome records no sound) |
| Colours, faces | Brand values | `index.html` / `play.html` `:root` (`--void #0a0d12`, `--panel #141922`, `--red #ff3b4e`, `--ink #e8edf4`, `--steel #8a97ab`, Orbitron, Noto Sans KR); `film/tokens.json` |

The film makes no claim about frame rate. “13fps” is the address.

## Recorded, staged, and what the clips are not

- **Play clips** (`screens/clips/open`, `cast`): the game's own simulation and renderer, stepped one frame at a time (`requestAnimationFrame` off, `tick(t)` called with t advancing 1/30 s). Bots think and move; the player follows a scripted route (run, look, cast, fire) and is kept alive (`hp = 100` each frame) so the camera never dies mid-clip. The buy phase was ended with `world.roundTime = 0.01`, the pause the game shows when it has no pointer lock was hidden, and network toasts from the test API were hidden. The renderer is software (SwiftShader) at the game's “비주얼” preset: lower than a real GPU. No clip was edited.
- **Map orbits** (`clips/map-*`): the home screen's own camera, UI hidden, advanced 0.2 s per frame.
- **Path screens** (`01…06`): the four clicks were real; after 전투 투입 the shop was closed and the buy timer set to 0.01 s so the game's `step()` opened the round (bots frozen so the view stayed still). The id typed was `hana`; the harness made the account.
- **Content screens** (`11-abilities`, `13-skins`): the menu, nothing staged.
- Not used: `07-planted.png`, the phone screens, the earlier download-bar diagram.

## Third-party assets

- Noto Sans KR and Orbitron, SIL Open Font License 1.1, from `@fontsource/noto-sans-kr@5.3.1` and `@fontsource/orbitron@5.3.0` (`film/fonts/LICENSE-*.txt`).
- All pictures are the repository's own game. No stock footage, stock music or voice.

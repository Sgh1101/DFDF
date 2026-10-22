# Sources

Every number and claim in the film, and where it comes from. Paths are relative to the repository root. `film/screens/path.json` is the log the capture script wrote while it played the game on 2026-10-22 (local `scripts/dev-server.js`, in-memory API harness from `tests/api-harness.js`, a fresh guest, Chromium 141, Korean locale).

| On screen | Claim | Source |
|---|---|---|
| “5대5 전술 FPS” | Two teams of five | `README.md:3` (“5대5 공격/수비 전술 FPS”); `index.html:248` landing copy (“다섯 명이 한 팀.”) |
| “한 판에 열 자리.” · ten markers | A round has ten players | `film/screens/path.json` → `teams: { total: 10, mine: 5, theirs: 5 }`, read from the running round |
| “열 자리가 그대로 5:5.” · markers land on the HUD portraits | The same ten are the HUD's 5 : 5, ours on the left | `film/screens/06-live.png` (HUD roster “5 : 5”, our agent highlighted on the left); `path.json` → `teams.myTeam: "atk"` |
| Bar → `13fps.vercel.app` | The production address | `docs/RELEASE_RUNBOOK.md:3` (“운영 주소: https://13fps.vercel.app”) |
| “링크 하나면 된다.” | Runs in the browser, nothing to download | `index.html:248` (“설치 없이 브라우저에서 바로.”, visible in `film/screens/01-landing.png`); `README.md:3` |
| “클릭 1–4”, “클릭 네 번이면 라운드 안.” | Four clicks from opening the link to being in a round: 게스트로 시작 → 게임 들어가기 → 혼자 하기 → 전투 투입 | `film/screens/path.json` → `clicks` (four entries, labels read from the buttons) |
| Buy screen, then clock 1:38 | The round opens in the buy phase; the live round starts at 1:40 | `js/legacy/03-engine.js:20134-20141` (`world.roundTime = 100` when the buy phase ends); `film/screens/05-buy.png`, `06-live.png` |
| “혼자 하면 빈자리는 AI가.” | Solo play fills the other nine seats with AI | Home button “혼자 하기 · AI 대전” in `film/screens/03-home.png`; `path.json` → `home.solo` |
| “친구는 링크로 합류.” | An invite link carries the room code and joins that room when opened | `js/legacy/03-engine.js:21214-21215` (copy invite link), `:21248-21261` (`?room=` → `joinRoom`); `README.md` 멀티플레이 (empty lobby seats can be filled with AI) |
| “다운로드 없이도, 다 있다.” · “요원 28명” | 28 agents | `GAME_CATALOG.counts().agents` read from the running game (`film/screens/content.json`, `js/game-catalog.js:4`); production config read on 2026-10-22 has no agent switched off (`/api/v1?a=config` → `game.disabledAgents: ""`); `film/screens/11-abilities.png` (“요원 선택 · 28명 중 한 명을 고르세요”) |
| “스킬 112개” · the pan to one agent's Q/E/C/X | 112 abilities, four per agent | `counts().abilities` = 112 (`js/game-catalog.js:5`); `README.md` (“능력 112개”). The game mostly says 능력; the film uses 스킬, the word the request used and the buy screen's “스킬 & 장비” (`film/screens/05-buy.png`) |
| “맵 22개” · six map tiles | 22 selectable maps | `counts().maps` = `MAP_LIST.length` = 22 at runtime, the last being 마크X발로 added by `js/ascent-trial.js:16`; the agent-select map filter shows “전체 22” (`film/screens/11-abilities.png`). The six tiles are 포구, 네온 정점, 시프트 아레나, 달리는 열차, 야간 항구, 모래무덤 from the home screen's aerial camera (`scripts/capture-content.js`). **The home footer says “맵 21종”**: it counts before 마크X발로 joins the list and is not recounted (`js/home.js:47-55`) |
| “스킨 607개” · the armoury | 607 gun skins (non-default, summed over guns) | `counts().skins` = 607 (`js/game-catalog.js:8`); production config `gacha.items: 607`; home footer “스킨 607종”. `README.md:39` still says 909 — out of date |
| Motif | The game's own two-note kill sound, A major pentatonic from A4 | `js/legacy/61-kills-that-sound-and-look-like-the-skin-in-your-hands-and.js:94-110` |
| Colours, faces | Brand values | `index.html` / `play.html` `:root` (`--void #0a0d12`, `--red #ff3b4e`, Orbitron, Noto Sans KR); `film/tokens.json` |
| Cut list numbers (not in the film) | 19 weapons, 11 modes | `counts().weapons`, `counts().modes` (`film/screens/content.json`) |

The film makes no claim about frame rate. “13fps” is the address.

## Staged in the capture

One step used the game's own functions instead of waiting, logged in `path.json` → `staged`: after 전투 투입 the shop was closed and the buy timer set to 0.01 s, so the game's `step()` opened the round itself (clock 1:40, “교전 개시”), with bots frozen (`ADMIN.freezeAI`) so the view stayed still. The four clicks were not staged.

The content screens (`11-abilities.png`, `12-map-*.jpg`, `13-skins.png`) were taken in the menu with nothing staged: the agent grid once every portrait had drawn, the selected agent's panel scrolled to its abilities, each map loaded with `loadMap()` and seen from the home screen's own aerial camera with the menu hidden, and the armoury's gun-skin tab.

The capture also takes `07-planted.png` (player moved to site A, then the game's `plantSpike()`) and two phone screens. None of them is used in the film: the plant shot implied that four clicks reach the plant, which is not true — you still walk to the site.

## Third-party assets

- Noto Sans KR and Orbitron, SIL Open Font License 1.1, from `@fontsource/noto-sans-kr@5.3.1` and `@fontsource/orbitron@5.3.0` (`film/fonts/LICENSE-*.txt`).
- All screens are captures of this repository's own game. No stock footage, stock music or voice.

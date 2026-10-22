# Sources

Every number and claim in the film, and where it comes from. Paths are relative to the repository root. `film/screens/path.json` is the log the capture script wrote while it played the game on 2026-10-22 (local `scripts/dev-server.js`, in-memory API harness from `tests/api-harness.js`, a fresh guest, Chromium 141, Korean locale).

| On screen | Claim | Source |
|---|---|---|
| “5대5 전술 FPS” · “다섯 명이 한 팀.” | Two teams of five | `README.md:3` (“5대5 공격/수비 전술 FPS”); `index.html:248` landing copy (“다섯 명이 한 팀.”); `film/screens/path.json` → `teams: { total: 10, mine: 5, theirs: 5 }` read from the running round |
| “공격은 스파이크 설치, 수비는 해제.” | Attack plants, defence stops or defuses | `README.md:3`; `js/legacy/03-engine.js:15201` `plantSpike`, `SPIKE.DEFUSE` at `:14750` |
| Bar → `13fps.vercel.app` | The production address | `docs/RELEASE_RUNBOOK.md:3` (“운영 주소: https://13fps.vercel.app”) |
| “링크 하나면 된다.” + underlined “설치 없이 브라우저에서 바로.” | Runs in the browser, no install | `index.html:248` (the landing page says it in these words, captured in `film/screens/01-landing.png`); `README.md:3` |
| “클릭 1–4”, “클릭 네 번이면 라운드 안.” | Four clicks from opening the link to being in a round: 게스트로 시작 → 게임 들어가기 → 혼자 하기 → 전투 투입 | `film/screens/path.json` → `clicks` (four entries, labels read from the buttons) |
| The ten markers become the ten HUD portraits | A round has ten players; ours on the left | `film/screens/06-live.png` (HUD shows 5 : 5); `path.json` → `teams` |
| “수비는 45초 안에 해제해야 한다.” | Spike fuse is 45 s | `js/legacy/03-engine.js:14752` (`FUSE: 45`); `path.json` → `plant.fuse: 45`; the planted screen shows “44.1초” |
| Clock 1:38 in the live screens | Real round clock (round opens at 1:40) | `js/legacy/03-engine.js:20134-20141` (`world.roundTime = 100` when the buy phase ends); the capture let the game's own `step()` open the round |
| “혼자 하면 빈자리는 AI가.” | Solo play fills the other nine slots with AI | Home button “혼자 하기 · AI 대전” in `film/screens/03-home.png`; `path.json` → `home.solo` |
| “친구는 초대 링크로 합류.” | An invite link carries the room code and joins that room on open | `js/legacy/03-engine.js:21214-21215` (copy invite link), `:21248-21261` (`?room=` → `joinRoom`); `README.md` 멀티플레이 (empty lobby slots can be filled with AI) |
| Motif | The game's own two-note kill sound, A major pentatonic from A4 | `js/legacy/61-kills-that-sound-and-look-like-the-skin-in-your-hands-and.js:94-110` |
| Colours, faces | Brand values | `index.html` / `play.html` `:root` (`--void #0a0d12`, `--red #ff3b4e`, Orbitron, Noto Sans KR); `film/tokens.json` |
| Cut list numbers (not in the film) | 28 agents, Q/E/C/X, 19 weapons, 21 maps, 11 modes | `film/screens/03-home.png` (“요원 28명 · 무기 19종 · 맵 21종”, “모드 11종”); `path.json` → `roster` |

## Staged in the capture

Two steps used the game's own functions instead of waiting, so the screens could be taken in seconds. Both are logged in `path.json` → `staged`:

1. After 전투 투입 the shop was closed and the buy timer set to 0.01 s, so the game's `step()` opened the round itself (clock 1:40, “교전 개시”). Bots were frozen (`ADMIN.freezeAI`) so the view stayed still.
2. For the planted shot the player was moved to site A and the game's `plantSpike()` was called. In play this takes walking to the site and holding the plant.

The four clicks themselves were not staged.

## Third-party assets

- Noto Sans KR and Orbitron, SIL Open Font License 1.1, from `@fontsource/noto-sans-kr@5.3.1` and `@fontsource/orbitron@5.3.0` (`film/fonts/LICENSE-*.txt`).
- All screens are captures of this repository's own game. No stock footage, stock music or voice.

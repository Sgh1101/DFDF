# Decisions

One line per call made where the brief was thin.

## Second build (request: more dynamic, better copy, sign-up instead of guest, start over)

- **Start over means the story and the look, not the pipeline.** render.js / audio.js / verify.js / captions.js / contact.js stay; timeline.js, film.html, tokens.json and directions.html were rewritten.
- **Open on real play.** Trailer editors open on action and show the name early (RESEARCH.md); the first 2.5 s are a recorded round, full frame, then it shrinks into the browser window it was in. That shrink is the film's one image.
- **Play is recorded by stepping the game's own loop** one frame at a time in headless Chrome (scripts/capture-clips.js: requestAnimationFrame off, tick(t) advanced 1/30 s, bots live, the player driven by a scripted route). It is real simulation and real rendering, but software-rendered: the user's own captured play on a real GPU would look better and the clip directories are the place to drop it in.
- **Dark ground now.** Real play only fills the frame on the brand's void; the window's light chrome is what makes the tab read. Contrast measured on the new pairs (scripts/contrast.js, all ≥ 4.5:1 for text).
- **Sign-up, not guest.** Click 1 is 로그인 / 가입 after typing an id and a password (the landing page: "처음 쓰는 아이디면 바로 가입됩니다. 인증 없음."). Still four clicks to the round.
- **Copy says, it does not explain.** Lines are declarations of two to five words (“방금 그거, 브라우저 탭.”, “가입은 클릭 한 번.”, “탭 하나에 이만큼.”, “혼자여도 5대5.”, “다운로드 대신, 탭 하나.”); the pictures carry the explanation. “다운로드 없음” alone is what every browser FPS says (RESEARCH.md), so it is a premise here, not the point.
- **A Korean copy review (subagent) then unified the register**: every second line had been 합니다체 (“인증도 이메일도 없습니다.”, “빈자리는 AI가 채웁니다.”, “있을 건, 다 있습니다.” — the last one “sounds like a supermarket”), so all lines are now 선언형; the opening points at the picture it follows (“방금 그거, 브라우저 탭.”), the title line stops repeating “다운로드” (“브라우저에서 바로, 5대5 전술 FPS”), the inventory kicker carries the 탭 하나 motif into the middle (“탭 하나에 이만큼.”), and the sign-up pair gets 1.9 s instead of 1.3 s. Kept against the review: a second line for the seats (“나머지는 AI.”) so the captions carry what the 나/AI labels show.
- **Skills and maps move.** 스킬 is a recorded cast (Q, E, fire) on 네온 정점; 맵 is three of the home screen's own orbits, cut on the beat. Still frames stay for 요원 (the grid, panning to one agent's four abilities) and 스킨 (the armoury).
- **The seats (나/AI/친구) stay** from the first build: the reviewer called them the clearest device, and nothing in the game's UI shows who fills a seat.
- **Scenes** S1 0–6.5, S2 6.5–17, S3 17–27, S4 27–34.5, S5 34.5–40. Title card at 5 s (name early), end card held 5 s.
- **Sound**: the bed starts on frame one with the pulse and hats under the play, chords from 3 s; synthesized rifle rounds and ability whooshes land where the clips fire and cast; the game's kill motif marks the reveal, the friends and the payoff as before.
- **Clips travel as mp4, not frames.** 369 JPEG frames would be ~60 MB in git; the five clips are committed as H.264 at crf 20 (23 MB together) and `scripts/clips.js unpack` regenerates the frames `film.html` reads. crf 12 / yuv444p was tried first (21 MB for the opening clip alone) and dropped: at the window's size the difference is invisible.
- **The round-start banner stays.** The live frame after click 4 carries the game's own “교전 개시” text; it is the game saying the round began, which is what the line (“링크에서 교전까지”) claims.


## Third build (request: open on a headshot; show several skins; the owner offered to grant every skin)

- **The opening is a headshot double kill with a legendary skin.** Walk out, stop, two taps to one head, flick, two taps to the next: “헤드샷”, “헤드샷 · 더블 킬”, and because the second kill ends the round the phoenix skin plays its finisher (sky and fog turn orange, a figure over the body). It all happens before 2.5 s, full frame, so the shrink into the browser window lands on the climax and “방금 그거, 브라우저 탭.” points at something worth pointing at.
- **Two taps, not one.** The rifle does 34 × 3 = 102 to the head before fall-off (`WEAPONS.rifle` at runtime); through heavy armour that leaves the target alive, so a one-tap would need staging the game's numbers. Two taps to the head is what the game actually takes, and it reads as a burst.
- **Hip fire, at about 6 m.** Aiming down sights puts this rifle's front sight block over the target's head, which hides the very thing the shot is about. From the hip the crosshair stays on the head, and at about 6 m the game's hip spread (±0.018 rad) stays inside the head sphere (0.187 m).
- **Aimed at the real head.** The first attempts aimed at y + 1.86 m, the number in the engine's original hit test, and half the shots hit the body: the hit test that actually runs (`js/legacy/11-walls-…js`) scales the body by BODY_K = 1.1, so the head centre is at 2.05 m. Aiming there also puts the crosshair in the middle of the drawn head.
- **A virtual clock for the recorder.** The kill banner, the headshot X, the kill flash and the finisher run on `performance.now()`, `setTimeout` and CSS animations; stepping one frame every few seconds of real time made them finish between two frames. During a clip those now follow the clip's time.
- **The owner's offer was not needed.** The clips record against the in-memory test API, where the owner page's own “grant all” runs on the film's account; no production account, password or grant was used or shared. The armoury shows 607 owned.
- **Several skins, two ways.** Each moving clip carries a different legendary on the rifle (opening: 봉황, skill clip: 심연), and the 스킨 607개 beat cuts the same rifle through five skins on the beat (봉황 → 금이음 → 신스웨이브 → 프리즘 → 챔피언, 0.5 s each, a soft tick per change). Five chosen from twelve captured for distinct colours and a readable angle of the spinning preview (오팔 and 잉어 were caught end-on).
- **Sound follows the clip's log**: a shot and a bright head tick on each of the four frames that fired (1.20, 1.33, 1.73, 1.87 s), the game's own kill ta-DAN one step up per kill (as the game climbs its ladder with the streak), a deep hit and a sparkle run for the finisher, a whoosh for the shrink. The later motif steps (friends 3, payoff 6) keep climbing from there.

### Second design review (on the finished composition, before the final render)

A design-review subagent went through all 18 beat stills at 1920×1080 and at phone width. Three findings were marked must-fix and were; four of the five nice-to-haves were taken. Before/after pairs: `review/fixes/v2-*.png`.

- **The zooms were cropping the real screens** (must-fix, confirmed): at 1.7× the login card lost its title under the chrome, the home lost the top of the game's own 13 mark, the select screen showed half cards and the “전체 22” chip cut to “체 22”, the armoury cut the rifle's barrel. A screenshot that is cut at the edge stops reading as a tab and starts reading as a crop. Now 1.5× centred on the whole card (login, account), 1.5× on the home with the mark in, 1.25× on the select with its left edge on a column boundary (six whole columns, chips and button in), 1.2× on the armoury with the whole gun.
- **Seats: a person is filled, an AI is an outline** (must-fix, taken). Before, all five of our seats were solid red and only the labels said 나/AI, so the turn (AI → 친구) was invisible without reading. Now 나 is the one filled seat among four red outlines (“혼자여도” is visible), and the four outlines fill in as the friends arrive. Team is still red vs ink and left group vs right group; labels stay, 4 px larger.
- **One link, not two** (must-fix, taken). The address pill at the top and a second chip over the seats meant two URLs on screen as the line said “링크 하나면”. The pill is now one object: it lifts out of the window's chrome, shrinks and moves down to sit over our five seats (the link, handed over), then grows into the sign-off pill under the 13 mark. The separate chip is gone, and so is the red fill line along the end pill, which doubled the mark's underline.
- **The pill is sized to its text** (taken): the 1100 px end pill with the URL left-aligned read as an empty input; all pill poses are now text width plus padding, which also makes the pill → chip move a small one.
- **The cursor sits at the right end of each button** (taken), inside its box but clear of its label, so the ring never covers the words the counter names.
- **Map orbits reordered** 포구 → 달리는 열차 → 네온 정점 (taken), so 네온 정점 no longer follows its own cast clip.
- **The title line is bigger** (taken): 44 → 56 px (16:9); it is the film's one sentence and was its smallest text. Kickers 44 → 48 px.
- **Not taken: re-recording the play without “경기 크레딧 무제한”** in the HUD (the solo mode's economy readout, legible only at desktop size): a full re-record costs about an hour of frame-stepped capture for a line most viewers will not resolve. Noted here instead. Also kept: the agent-grid shot that pans into one agent's four abilities (the reviewer wanted more whole cards; the pan is what sets up the 스킬 count that follows).

## Numbers re-checked against the current game (2026-10-23)

- **Counts are unchanged, one screen was stale.** `GAME_CATALOG.counts()` on `origin/main` still gives 28 / 112 / 22 / 607 (weapons 19, modes 11), so the captions and `timeline.js` stay as they were. The recorded home screen said “맵 21종” in two places; the game now recounts the map list and says 22종. `03-home.png`, the other path screens, `11-abilities.png` and the skin screens were re-captured from the current game (`path.json`, `content.json`, `skins.json` rewritten); all four cuts (`master_16x9`, `cut_9x16`, `cut_1x1`, `cut_reduced_16x9`) were re-rendered and `scripts/verify.js` re-run.
- **Clips kept.** They show HUD only, no counts or fixed text that changed.
- **The new notice popup is kept out of the frames** by presetting `lgp_notice_seen` in the capture browser, the same state a returning visitor has; the ▶ 홍보영상 button stays (it is the game) and sits outside the cropped window.
- **The earlier entry “맵 22, not the home screen's 21” is obsolete**: the game fixed the footer, so the film no longer has two different map numbers on screen.

## Brief

- **Topic “13fps 게임”** = this repository's game, “13” (`manifest.webmanifest`), served at 13fps.vercel.app. “13fps” is the address, not a frame-rate claim; the film makes no frame-rate claim.
- **Audience** = people who already play tactical FPS (the brief's “fps의 주제”). They know spikes, sites and 5v5, so the film doesn't explain the genre; it explains how you get into *this* one.
- **Outcome** (“우리의 13fps게임”) = they know 13 opens from a link, gets them into a round in four clicks, and fills empty seats with AI, so they can start now.
- **Hook** = “a tactical FPS starts with a download.” The landing page itself says “설치 없이 브라우저에서 바로.”
- **No `./brand`, `./refs`, `./screens` folders existed.** Brand came from the game's own `:root` tokens and fonts; screens were captured fresh from the running game (`scripts/capture-screens.js`). The 2026-10-21 preview PNGs in `docs/previews` were not used: they show an older 40-agent roster.
- **Language**: Korean, matching the game and the user.

## Look

- **Ground**: warm neutral paper (#F2EEE7) rather than the brand's dark void. A dark game screen reads as a browser tab only against a light ground; the void stays inside the window (see `directions.html`).
- **One accent**: brand red #FF3B4E for marks; where red must reach 3:1 on a light track (the download bar, the payoff line) it is the darker #BF1D32. No red text.
- **Two typefaces**: Orbitron for numerals and the 13 mark (it has no Hangul), Noto Sans KR for every Korean word and the URL.
- **Our team vs theirs** is filled vs outlined, and from the turn on the 나/AI/친구 text, never colour alone. The other team is not dimmed (dimming took it to 2.9:1).

## Story (after the design review)

- **The model is seats, not rules.** “한 판에 열 자리.” and ten unlabelled markers; the site, spike and “공격은 설치, 수비는 해제” were a genre lesson for people who already know it.
- **No plant beat.** “클릭 네 번에 스파이크까지” was false (you still walk to the site); the proof ends on “클릭 네 번이면 라운드 안. / 열 자리가 그대로 5:5.”
- **“다운로드”, not “설치”**, for the thing you wait for: the game's HUD uses 설치 for planting.
- **The counter names the button that is on screen**; the numeral sits dim until its click, then ticks. No marker strip during the clicks (it read as an 11-step progress bar).
- **Hard cuts between game screens**, each after the click ring is gone; one move at a time.
- **The chip is the same link** peeled off the address pill, so the line can say just “친구는 링크로 합류.”
- **Rejected from the review: a “GB” readout** on the download bar. It would be an invented number; the bar is named “다운로드 중” instead.
- **Arc timing** moved from the brief's 10/25/40/15/10 % to 10/20/37/20/13 % (S1 0–3, S2 3–9, S3 9–20, S4 20–26, S5 26–30 s) so scenes change on the two-bar grid and the end card holds for 3 s.

## 40-second cut (request: add agents, maps, skills, skins)

- **One beat, not a feature list.** The four counts sit in one scene, S4 “Inside” (20–30 s), under one line — “다운로드 없이도, 다 있다.” — so they answer the next doubt after the hook (a browser game must be thin) instead of starting a second idea.
- **Counts are the game's own** (`GAME_CATALOG.counts()` at runtime): 요원 28 · 스킬 112 · 맵 22 · 스킨 607. Weapons (19) and modes (11) stay cut: the request named four things.
- **맵 22, not the home screen's 21.** 22 maps are selectable (MAP_LIST, the select screen's “전체 22”); the home footer counts before 마크X발로 joins and never recounts. Flagged to the user as a game bug rather than worked around in the film.
- **스킬, not 능력**, because the request said 스킬 and the buy screen says “스킬 & 장비”; the game mostly says 능력.
- **Real frames, one camera move each**: the agent grid pans to the same frame's ability panel (one capture, not a composite); six maps tile into the window one by one; the armoury shows a skin on a gun next to the skin grid. Six maps chosen for different light and colour so the tiles read as different places at a glance.
- **Scenes** S1 0–3, S2 3–9, S3 9–20, S4 20–30, S5 30–36, S6 36–40 (8/15/28/25/15/10 %). Turn and payoff are unchanged, only later; the seats re-enter for the turn instead of flying back from a HUD that is no longer on screen.
- **Music**: S4 keeps the proof's eighth-note walk over I–IV–V, resolving into the turn; each count lands with a soft fifth that climbs with the list.

## Sound

- **No voiceover.** No licensed Korean voice or TTS was available here, and the brief marks voice optional. The on-screen copy is the narration, so it is also the burned-in caption, and `captions.srt` carries the same words at the same times. With no voice there is nothing to duck.
- **Music**: 120 BPM so every beat lands on the 0.5 s grid the moves use; I–vi–IV–V in A major, changing chord with each scene, because the game's kill sound uses an A major pentatonic ladder from A4. The motif is that kill sound (“타-단”) and climbs a step each time the idea returns (link → friends → payoff).
- **Mix**: sub-bass cut back after the spectrogram showed the bed living below 140 Hz, where phone speakers play nothing.
- **Loudness target** −16 LUFS / −2.0 dBTP before AAC so the delivered file stays under −1.5 dBTP.

## Formats

- **Recompositions**: 9:16 puts the copy on top and stacks window and seats down the frame; 1:1 keeps the copy at the bottom with a smaller window. Both split the ten seats into two rows of five so the labels stay readable on a phone. Same objects, same order, same timing.
- **Reduced-motion cut**: same sequence and timing; every move becomes a short fade at its end point, no zooms, no rings expanding, no flips; the seats hold on the HUD 0.75 s longer.
- **Video files are committed** in `film/out/` so the branch carries the deliverable itself (each is a few MB).

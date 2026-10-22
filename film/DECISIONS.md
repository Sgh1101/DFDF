# Decisions

One line per call made where the brief was thin.

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

## Sound

- **No voiceover.** No licensed Korean voice or TTS was available here, and the brief marks voice optional. The on-screen copy is the narration, so it is also the burned-in caption, and `captions.srt` carries the same words at the same times. With no voice there is nothing to duck.
- **Music**: 120 BPM so every beat lands on the 0.5 s grid the moves use; I–vi–IV–V in A major, changing chord with each scene, because the game's kill sound uses an A major pentatonic ladder from A4. The motif is that kill sound (“타-단”) and climbs a step each time the idea returns (link → friends → payoff).
- **Mix**: sub-bass cut back after the spectrogram showed the bed living below 140 Hz, where phone speakers play nothing.
- **Loudness target** −16 LUFS / −2.0 dBTP before AAC so the delivered file stays under −1.5 dBTP.

## Formats

- **Recompositions**: 9:16 puts the copy on top and stacks window and seats down the frame; 1:1 keeps the copy at the bottom with a smaller window. Both split the ten seats into two rows of five so the labels stay readable on a phone. Same objects, same order, same timing.
- **Reduced-motion cut**: same sequence and timing; every move becomes a short fade at its end point, no zooms, no rings expanding, no flips; the seats hold on the HUD 0.75 s longer.
- **Video files are committed** in `film/out/` so the branch carries the deliverable itself (each is a few MB).

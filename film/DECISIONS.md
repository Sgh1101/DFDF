# Decisions

One line per call made where the brief was thin.

- **Topic “13fps 게임”** = this repository's game, “13” (`manifest.webmanifest`), served at 13fps.vercel.app. “13fps” is the address, not a frame-rate claim; the film makes no frame-rate claim.
- **Audience** = people who already play tactical FPS (the brief's “fps의 주제”). They know spikes, sites and 5v5, so the film doesn't explain the genre; it explains how you get into *this* one.
- **Outcome** (“우리의 13fps게임”) = they know 13 opens from a link, gets them into a round in four clicks, and fills empty slots with AI, so they can start now.
- **Hook** = “a tactical FPS starts with an install.” The landing page itself says “설치 없이 브라우저에서 바로.”, so the film quotes it.
- **No `./brand`, `./refs`, `./screens` folders existed.** Brand came from the game's own `:root` tokens and fonts; screens were captured fresh from the running game (`scripts/capture-screens.js`); the 2026-10-21 preview PNGs in `docs/previews` were not used because they show an older 40-agent roster.
- **Ground**: warm neutral paper (#F2EEE7) rather than the brand's dark void. A dark game screen reads as a browser tab only against a light ground; the void stays inside the window (see `directions.html`).
- **One accent**: brand red #FF3B4E for marks only; text in red uses #BF1D32 (5.3:1 on paper).
- **Defence vs attack** is shape (outlined vs filled) plus the 공격/수비 labels, never colour alone.
- **Two typefaces**: Orbitron for numerals and the 13 mark (it has no Hangul), Noto Sans KR for every Korean word and the URL.
- **No voiceover.** No licensed Korean voice or TTS was available here, and the brief marks voice optional. The on-screen copy is the narration, so it is also the burned-in caption, and `captions.srt` carries the same words at the same times. With no voice there is nothing to duck the bed under.
- **Language**: Korean, matching the game and the user.
- **Mobile is cut** from the story (second idea). The phone captures stay in `screens/`.
- **Buy phase shown for one second** between click 4 and the live round so the path stays truthful (the round opens in the buy phase).
- **Spike fuse “45초”** kept as the only extra number: it is the consequence of the plant shown on screen and is sourced.
- **Music**: 120 BPM so every beat lands on the 0.5 s grid the moves use; I–vi–IV–V in A major because the game's kill sound uses an A major pentatonic ladder from A4. The motif is that kill sound (“타-단”) and climbs a step each time the idea returns (link → friends → payoff).
- **Loudness target** set to −16 LUFS / −2.0 dBTP before AAC so the delivered file stays under −1.5 dBTP.
- **Reduced-motion cut** = same sequence and timing; every move becomes a short fade at its end point, no zooms, no rings expanding, no flips.
- **Recompositions**: 9:16 puts the copy on top and stacks window, teams and strip down the frame; 1:1 keeps the copy at the bottom with a smaller window. Same objects, same order, same timing.
- **Video files are committed** in `film/out/` so the branch carries the deliverable itself (each is a few MB).

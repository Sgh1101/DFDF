# Grok UI inspection follow-up

Source: two user-supplied Grokbot reports, approximately 27 minutes total. Target: https://13fps.xyz, English guest, Chrome desktop 1280 px wide with approximately 680–720 px of content height. Match controls were not verified by that inspection because of input lag.

Implementation order:
1. Restore a visible guest sign-in/sign-up path on the home page and in the game, preserve the guest session when cancelling, and route account chips to records.
2. Dismiss Practice/More on Escape, outside interaction, and navigation. Keep closed menu content hidden and align all entries consistently.
3. Put the server announcement in the home document flow; keep it beneath dialogs. Stabilize settings geometry and make its card opaque. Make ability details and map/mode lists scroll without overlapping the footer.
4. Correct verified display inconsistencies: rarity wrapping, clan-board explanation, mastery with no progress, late-added English weapon/mode/agent labels, catalogue counts and guide language indications.
5. Inspect HUD and scoreboard/armor ownership. Only change confirmed defects; record unverified match/network behavior separately.

Verification: explore the actual application before writing UI tests; exercise English guest paths at 1280×680, 700, 720 and a landscape phone viewport. Run relevant unit/browser checks and the repository check. Browser fixtures use a memory account API and software rendering; they do not establish real purchase, Android, multiplayer, or physical-device performance behavior.

No Champions model, texture, animation, finisher, audio, ownership, or weapon targeting changes are included. Work stays on a review branch pending this change's merge approval.

## Report disposition

| Reported symptom | Change / assessment |
| --- | --- |
| Guest sign-in inaccessible; gear only has logout | Explicit sign-in/sign-up on the landing page and lobby, also settings and solo competitive selection. Cancel keeps the current session. Existing combined authentication is reused; separate login.html/signup.html are not introduced. |
| Practice remains open, blocks multiplayer, ignores Escape | Close on Escape, outside pointer/focus, item selection and screen navigation; explicit closed-content CSS; consistently left-aligned items. |
| Beta announcement covers screen headers and dialog backdrop | Move the server announcement into the scrollable home flow. It is naturally hidden with home and dimmed behind dialogs. |
| Agent X detail and map names clipped | Keep details keyboard-scrollable with bottom padding/stable gutter; prevent footer shrink; preserve full map labels and wrapped map sheet. Desktop X is reachable by scrolling; on a short landscape phone the detail column extends beside the left-hand footer. |
| Settings jumps and shows character behind it | Stable card height, scrollable content, opaque background; modal ordering keeps the home behind settings and the Armory opened from settings above it. |
| Rarity labels wrap within words; tiny Transcendent percentage | Keep rarity and probability tokens intact; give them intrinsic columns and a stacked phone layout. Actual existing rate is 0.00000000000000001%; do not change the draw logic. |
| Weapon/mode language mixture; NEON_AGENT; guest name | Translate named weapons, late mode names and electric-agent labels in the existing English display translator; use SURGE as the agent display codename; translate the generated guest prefix in account display. Account IDs and saves stay unchanged. |
| Guide links unexpectedly open Korean | Mark Korean guide destinations in the English landing-page menu. The guide documents and many agent/ability descriptions still need a full English editorial pass. |
| Clan board displays ranked-account explanation | Give guest clan browsing its own explanation. A five-second real API delay was not reproduced by the memory API; no claim that production request latency is fixed. |
| Home/lobby counts differ | Explain 22 permanent maps plus 1 weekly, 18 guns plus a knife, 30×18 shared-pool skins versus 601 total collectible items. The game footer identifies guns separately. |
| Mastery says 0/0 XP | Show a first-match prompt until a real XP target exists. |
| Account/rank chip goes home | Direct both to #records-stats, the existing profile/records view. |
| Tutorial undiscoverable; hints dim; control toggle too close | Expose existing controls/ability training directly; enlarge/brighten hints; add a distinct mouse-start action with separated touch alternative. |
| Kill feed covers settings, hints touch vitals | Measure minimap and vitals only on resize; reserve a gap for gear and health. No additional per-frame layout polling. |
| Light/heavy armor both say Owned | Keep purchase validation; label the lower armor as covered by higher protection instead of two Owned labels. |
| Other players' K/D missing | Source already broadcasts whole-board stats and renders all actors. Validate local non-player kills/rows; real multiplayer is a separate unverified check. |
| Shop preview too small | Give the desktop detail/preview column more width; retain the gun model. |
| Shop tab retains a focus border | Retain keyboard focus indication; removing it would impair navigation. No evidence of a stuck non-focus state. |
| Severe input lag and untested match actions | No physical-PC performance claim. Reload/abilities/planting/round completion/rewards still require a real interactive match; browser fixture interactions do not replace this. |

## Verification evidence

- `npm run check`: all 204 external game scripts and the inline application scripts parse.
- `npm test`: 465 passed, 2 optional external-Redis checks skipped, 0 failed (467 total).
- `node --test tests/csp.test.js tests/account-switch.test.js`: 7 passed after the final inline-copy/CSP update.
- `npm run test:grok-ui`: new English guest regression covers 1280×680/700/720, 852×393, home/lobby registration and cancellation, Practice dismissal, settings-to-Armory layering, original tiny probability text, accessible X/map content, clan hint, armor labels, local other-player K/D and HUD gaps. The original unmodified page failed its first assertion: Escape left Practice open.
- Existing `browser-home-layout`, `browser-weapon-shop`, `browser-home-numbers`, `browser-mobile-skin-preview`: passed. Home bounds/navigation include desktop/tablet/mobile/small/portrait; catalogue text is checked against the running game in Korean and English; touch skin previews include By gun/My skins/Shop/Champions and desktop.
- Browser captures/logs: ignored `test-results/grok-ui-20261103/`; the mobile preview suite also writes `test-results/mobile-preview/`.
- Android: not run. Real money/store purchases: not run. Weapon/armor purchases used match credits in the memory API/local game fixture. Live multiplayer stats synchronization and physical-device input latency: not verified.

Run with the dev server running: set `DFDF_BASE_URL` (this session used `http://127.0.0.1:3023`), optionally `CHROME_BIN`, `DFDF_THREE_PATH` and `DFDF_PEERJS_PATH`, then `npm run test:grok-ui`. The test uses isolated browser storage and fixture accounts.

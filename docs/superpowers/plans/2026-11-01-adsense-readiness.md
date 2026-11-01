# AdSense Readiness Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline, with a fresh whole-branch review after implementation.

**Goal:** Implement the approved readiness priorities without activating advertisements or altering Champions.

**Architecture:** Retain map loaders and identifiers with original generated layouts; keep advertising behind a default-off readiness policy. Extend the existing static page generator for terms, credits and privacy choices.

**Tech Stack:** Node.js, existing Three.js engine, static HTML/CSS/JS, Node test runner and Playwright.

**Spec:** `docs/superpowers/specs/2026-11-01-adsense-readiness-design.md`.

**Integration amendment:** After the user requested checking Claude, fetched main `32a422e`: keep its removal of Desert Town/event maps and its latest Champions/flat-colour textures. The earlier desert candidate is removed; verify only the independent island and the absence of the retired map. Champions preservation means byte equality with updated main, not the superseded base. Open security PR #111 remains unmerged and is not imported automatically.

## Global Constraints

- No main merge, deployment, actual ads, account applications or invented identity/permissions. Integrating existing main into this review branch is allowed.
- Keep Champions models/audio/textures/finisher/equip/ownership and exact odds unchanged.
- No new paid or transferable rewards. Default to essential storage only.
- Preserve the island key/name and Claude's desert/event removal. Unknown permissions remain unknown in records.
- Preserve other workers' changes; work on `codex/adsense-readiness` in the existing isolated checkout.

## Review Focus

- The island selection must start its intended map, and retired desert/event features must stay absent.
- Lightweight geometry must preserve solid walls and objective routes.
- Optional preference refusal or storage errors must not enable network advertising.
- New navigation must work without JavaScript and on narrow screens.
- Public statements must agree with real storage, actual ad status and verified provenance.

### Task 1: Default-off advertising policy

Files: create `js/advertising-policy.js`, `ads-config.json`, `tests/advertising-policy.test.js`, `docs/advertising-setup.md`.

- [x] Write failing pure tests for `ADVERTISING_POLICY.evaluate(config, pathname, consent)` returning `{allowed, reasons}`: only six article pages; enabled false, invalid publisher ID, site not approved, unreviewed audience, CMP not ready, essential-only refusal all block.
- [x] Implement the policy with no network calls and a JSON config that is disabled, has an empty publisher ID and false/unreviewed external readiness.
- [x] Document the official account/CMP steps, explicit exclusions, test-mode requirement, no-click-reward policy and H5 separate approval.
- [x] Verify unit tests. Do not implement a live SDK loader in this task.

### Task 2: Public operating pages and privacy choices

Files: `scripts/site-pages/{layout,privacy,guide,terms,credits}.js`, `scripts/build-site-pages.js`, `index.html`, `js/privacy-preferences.js`, `css/pages.css`, generated pages, `tests/site-pages.test.js`, `tests/privacy-preferences.test.js`.

- [x] Test malformed or inaccessible stored preferences produce essential-only state, and reset/withdrawal persists safely.
- [x] Add accessible settings on privacy.html with explicit current no-ad status, local optional preference controls and withdrawal. It is not a certified CMP and cannot activate ads.
- [x] Add terms and credits, global links, clearer deletion verification/retention and precise earned-only/non-transferable rewards text. Preserve registration and Champions behavior.
- [x] Normalize line endings in build consistency checks only, regenerate static outputs, then verify content tests.
- [x] Explore the actual local UI and then add deterministic browser checks for settings persistence/reset and page navigation.

### Task 3: Original map replacement and provenance

Files: `scripts/build-original-maps.js`, `js/ascent-trial.js`, generated island packages/preview, map site-page sources, `assets/CREDITS.md`, `docs/asset-provenance.md`, map tests.

- [x] Check for the user's permission reply. If unverified, test generators produce original manifests with no external input; both teams and sites must be within free reachable space.
- [x] Generate an original block island layout from documented constants. Remove the initially generated desert candidate in accordance with latest main; preserve flat-colour textures, and update the island preview.
- [x] Rebuild mobile geometry using the existing optimizer. Assert deterministic output, package integrity and identical collision bytes.
- [x] Update loaders' map coordinates and metadata, public descriptions and provenance; purge superseded assets from the service-worker cache by version/path.
- [x] Verify the island in the browser, including retired-map absence, bot routes, wall collision, elevated support, ability floors and switching.

### Task 4: Integration verification and handoff

- [x] Run syntax, unit, packaged-asset and relevant browser checks, including site pages, startup, map flows, graphics and Champions regression checks for untouched integration.
- [x] Save before/after evidence and source fingerprints. Run a fresh independent whole-branch review and resolve material findings.
- [x] Write the implementation result and outstanding external account/permission/design rights items. Preserve a reviewable branch; no merge/deploy.

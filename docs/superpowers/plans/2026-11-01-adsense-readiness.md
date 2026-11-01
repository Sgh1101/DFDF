# AdSense Readiness Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline, with a fresh whole-branch review after implementation.

**Goal:** Implement the approved readiness priorities without activating advertisements or altering Champions.

**Architecture:** Retain map loaders and identifiers with original generated layouts; keep advertising behind a default-off readiness policy. Extend the existing static page generator for terms, credits and privacy choices.

**Tech Stack:** Node.js, existing Three.js engine, static HTML/CSS/JS, Node test runner and Playwright.

**Spec:** `docs/superpowers/specs/2026-11-01-adsense-readiness-design.md`.

## Global Constraints

- No merge, deployment, actual ads, account applications or invented identity/permissions.
- Keep Champions models/audio/textures/finisher/equip/ownership and exact odds unchanged.
- No new paid or transferable rewards. Default to essential storage only.
- Preserve both map keys and names. Unknown permissions remain unknown in records.
- Preserve other workers' changes; work on `codex/adsense-readiness` in the existing isolated checkout.

## Review Focus

- Saved map keys and event-map selections must still start the intended map.
- Lightweight geometry must preserve solid walls and objective routes.
- Optional preference refusal or storage errors must not enable network advertising.
- New navigation must work without JavaScript and on narrow screens.
- Public statements must agree with real storage, actual ad status and verified provenance.

### Task 1: Default-off advertising policy

Files: create `js/advertising-policy.js`, `ads-config.json`, `tests/advertising-policy.test.js`, `docs/advertising-setup.md`.

- [ ] Write failing pure tests for `ADVERTISING_POLICY.evaluate(config, pathname, consent)` returning `{allowed, reasons}`: only six article pages; enabled false, invalid publisher ID, site not approved, unreviewed audience, CMP not ready, essential-only refusal all block.
- [ ] Implement the policy with no network calls and a JSON config that is disabled, has an empty publisher ID and false/unreviewed external readiness.
- [ ] Document the official account/CMP steps, explicit exclusions, test-mode requirement, no-click-reward policy and H5 separate approval.
- [ ] Verify unit tests. Do not implement a live SDK loader in this task.

### Task 2: Public operating pages and privacy choices

Files: `scripts/site-pages/{layout,privacy,guide,terms,credits}.js`, `scripts/build-site-pages.js`, `index.html`, `js/privacy-preferences.js`, `css/pages.css`, generated pages, `tests/site-pages.test.js`, `tests/privacy-preferences.test.js`.

- [ ] Test malformed or inaccessible stored preferences produce essential-only state, and reset/withdrawal persists safely.
- [ ] Add accessible settings on privacy.html with explicit current no-ad status, local optional preference controls and withdrawal. It is not a certified CMP and cannot activate ads.
- [ ] Add terms and credits, global links, clearer deletion verification/retention and precise earned-only/non-transferable rewards text. Preserve registration and Champions behavior.
- [ ] Normalize line endings in build consistency checks only, regenerate static outputs, then verify content tests.
- [ ] Explore the actual local UI and then add deterministic browser checks for settings persistence/reset and page navigation.

### Task 3: Original map replacement and provenance

Files: `scripts/build-original-maps.js`, `js/ascent-trial.js`, `js/kour-map.js`, generated map packages/previews, map site-page sources, `assets/CREDITS.md`, `docs/asset-provenance.md`, map tests.

- [ ] Check for the user's permission reply. If unverified, test generators produce original manifests with no external input; both teams and sites must be within free reachable space.
- [ ] Generate an original block island layout and an original desert courtyard layout from documented constants. Replace original geometry/texture dependencies and old copyrighted previews; retain map identifiers and names.
- [ ] Rebuild mobile geometry using the existing optimizer. Assert deterministic output, package integrity and identical collision bytes.
- [ ] Update loaders' map coordinates and metadata, public descriptions and provenance; purge superseded assets from the service-worker cache by version/path.
- [ ] Verify both maps in the browser, including events, bot routes, wall collision, elevated support, ability floors and switching.

### Task 4: Integration verification and handoff

- [ ] Run syntax, unit, packaged-asset and relevant browser checks, including site pages, startup, map flows, graphics and Champions regression checks for untouched integration.
- [ ] Save before/after evidence and source fingerprints. Run a fresh independent whole-branch review and resolve material findings.
- [ ] Write the implementation result and outstanding external account/permission/design rights items. Preserve a reviewable branch; no merge/deploy.

# AdSense Readiness Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. The user delegated routine decisions; execute in this worktree and request only the final merge approval.

**Goal:** Improve the public entry and enforce honest, default-off advertising readiness.

**Architecture:** Retain vanilla HTML/CSS and the existing pure advertising policy. A repository review record pins asset fingerprints; a CLI validates the record and reports remaining operator prerequisites. There is no ad SDK while under review.

**Tech Stack:** HTML/CSS, browser JavaScript, Node test runner, Playwright/Chrome.

**Spec:** ../specs/2026-11-04-adsense-readiness.md

## Global Constraints

- Preserve login, guest, invites, saved items and signed-in dashboard.
- Do not edit Champions assets/runtime or merge Claude PRs.
- Local preferences never authenticate a CMP. No real ad SDK/requests/clicks.
- Keep unresolved asset permissions unresolved. Hash changes invalidate review.
- Preserve source attachments, main's evaluation notes and peer worktrees.

## Review Focus

- Corrupt/missing review records and removed asset entries must fail closed (Task 1).
- A hash change after a rights review must invalidate it (Task 1).
- Anonymous visitors with scripts disabled must still see the game and guide (Task 2).
- Login/guest/invite restoration must keep its existing destination (Task 2).
- Narrow/short screens, English and modal/focus states must remain usable (Tasks 2/3).

### Task 1: Review record and advertising checks

Files: `monetization-review.json`, `js/advertising-policy.js`, `scripts/check-ad-readiness.js`, `tests/advertising-policy.test.js`, `tests/ad-readiness.test.js`, `package.json`.

Interface: `policy.evaluate(config, pathname, consent, review)` and `reviewReasons(review)` deny unknown approval/age/CMP/rights. CLI `audit(root)` additionally checks current asset fingerprints and unexpected SDK integrations.

- [x] Write tests for missing/malformed records, unresolved rights, consent errors, expired consent, prohibited pages, missing entries and asset drift; observe failure.
- [x] Implement record, pure gates and CLI. Pin the two unverified asset bundles without changing them.
- [x] Run policy/readiness tests and `npm run check:ads`; `--require-ready` must exit 1 with actual missing prerequisites.
- [x] Commit tested change.

### Task 2: Public game introduction before sign-in

Files: `index.html`, `css/home-intro.css`, `scripts/browser-public-entry.js`.

Interface: Anonymous `#publicIntro` precedes auth; signed-in dashboard stays at top. Existing `#doGuest`, `#doAuth`, `#enter` and invite handling stay authoritative.

- [x] Explore current home in Chrome, then add browser assertions for public content, guide links, language, keyboard entry, no-JS, viewport fit and existing guest/login flow; observe failure.
- [x] Add owned in-game screenshot, concise instructions and entry links using existing typography/palette. Hide public hero after a session exists, preserve dashboard layout.
- [x] Run public-entry and existing landing/guest/login browser checks.
- [x] Commit tested change.

### Task 3: Consistent documents and completion

Files: `docs/advertising-setup.md`, `docs/asset-provenance.md`, `scripts/site-pages/{about,credits,privacy}.js`, generated HTML/CSP/sitemap, work records.

- [x] Correct stale SGH attribution; state known versus unverified rights and actual current ad state; add practical operator checklist with official policy links.
- [x] Rebuild pages/CSP; run full unit, syntax, asset, page freshness and relevant public browser checks. Record actual versus unverified environments separately.
- [ ] Fresh whole-branch review, fix material findings, create a reviewable PR. Keep main and production untouched pending this task's approval.

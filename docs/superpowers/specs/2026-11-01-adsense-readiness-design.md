# AdSense readiness design

The user approved implementing the priorities in the 2026-11-01 evaluation. Prepare the game for a later, separately approved ad rollout. Existing game content and saves must continue to work. No merge, deployment, actual advertisements, account applications, invented permissions or publisher IDs.

## Approach

1. Keeping copied maps until a permission arrives would leave the main identified blocker unresolved. Removing both maps outright would break existing selections and reduce content. Chosen implementation default: retain `desert_town` and `ascent_trial` identifiers and names, replace their generated terrain with original layouts, record exact source provenance, and keep removed artifacts recoverable in Git. If the user supplies valid permission before replacement, preserve the permitted map instead.
2. Use the existing map renderers, collision format and navigation systems with original generated geometry. No new engine or dependencies. Keep the original-looking block art already painted by this project. Rebuild map previews and descriptions for changed layouts.
3. An ordinary self-made cookie banner cannot certify Google consent. Keep all real ad loading disabled; add an explicit readiness policy, page exclusions, locally stored privacy choices and a console/setup runbook for a certified CMP. Do not claim a local choice is legally sufficient consent or Google certification. Actual publisher identity, site approval, target audience and CMP activation remain external prerequisites.

## Boundaries

- Champions models, textures, audio, finishers, names, equip mapping, owned items and the exact transcendent odds stay byte-identical. Add provenance documentation and unresolved expression-rights review status; do not label that status approved.
- No paid spins, real money, transferable reward, ad click reward or gameplay ads.
- General ad candidate pages: guide, controls, modes, maps, agents, patch-notes. Exclude home login, play, skin/shop, chat, contact, privacy, terms, credits, admin, errors and loading.
- Default privacy choice: essential storage only. No optional analytics or advertising request is introduced by this work. Withdrawal resets optional preferences and is available from public page footers.
- Policies describe the currently implemented retention and deletion workflow without inventing storage limits, legal identity or rights assurances.
- Existing Windows CRLF false failures are corrected by normalizing comparison text, without loosening the substantive checks.

## Deliverables

Original reproducible map packages (if permission remains unverified); asset provenance ledger and public credits; terms and expanded privacy/deletion/reward explanations; readiness config with no live publisher ID; privacy settings UI; appropriate unit/browser checks; a readiness report naming external blockers. No AdSense approval guarantee.

## Verification

Test map generator determinism and independent layouts, package hashes, identical mobile collision data, routes from both teams to both sites, bodies/bullets blocked by walls, elevated support and map switching. Test ad policy rejects unsupported pages, missing publisher/site/CMP/audience readiness and refusal. Explore changed pages locally before adding UI tests; check narrow and desktop layouts, privacy persistence/withdrawal and no Google ad requests. Distinguish browser emulation from actual Android tests.

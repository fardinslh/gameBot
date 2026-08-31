---
title: Continue Crown & Coin with an AI coding agent
navLabel: AI Handoff
contentType: How-to
---

# Continue Crown & Coin with an AI coding agent

Use this sequence before a major change. Code and migrations remain authoritative when the documentation baseline is older than `HEAD`.

This guide is primarily for the coding and implementation agent. A product, game-design, or technical planning partner should read [Planner Handoff](PLANNER_HANDOFF.md) first, then use this guide when preparing or verifying implementation work.

## Read these files in this order

1. [Project context index](INDEX.md)
2. [Current implementation state](CURRENT_STATE.md)
3. [Architecture decisions](DECISIONS.md)
4. The relevant system document for your task
5. [Testing and browser validation](TESTING.md)
6. [Player experience](PLAYER_EXPERIENCE.md), [audio](AUDIO.md), and [audio audition](AUDIO_AUDITION.md) when touching first-session or media behavior
7. [Retention roadmap](RETENTION_ROADMAP.md) and [building evolution](BUILDING_EVOLUTION.md) before retention or Kingdom-art work

Check the `Last verified against commit` value in `INDEX.md`, then compare it with `git rev-parse HEAD`. Inspect changed source after that baseline before relying on a documented formula or route.

## Rules before changing code

- Inspect current branch, HEAD, status, recent commits, README, and system source
- Preserve working systems and avoid repository reinitialization
- Keep the server authoritative for economy, progression, Hero stats, battle, loot, Trophies, and rewards
- Keep domain logic independent from Bale, Telegram, and Web transport details
- Keep gameplay formulas in config/calculator modules rather than controllers or React components
- Update shared contracts, API producers, and client consumers together
- Add unit tests for authoritative calculations and integration tests for persistence/concurrency changes
- Use Prisma migrations for schema changes and read every existing migration before adding one
- Run targeted browser regressions for affected features
- Inspect real 320 by 568, 375 by 812, and 390 by 844 screenshots for visual changes
- Preserve unrelated work in a dirty worktree

## Kingdom visual rules

- Castle remains the visual hero
- Castle 1 mounts exactly five gameplay buildings
- Locked buildings do not load, render, receive hit areas, enter accessibility targets, or affect camera bounds
- Keep gameplay buildings separate from `kingdom-base-v3.webp`
- Preserve negative space and terrain readability
- Match current perspective, light direction, scale, ground contact, and mobile sharpness
- Use irregular, region-specific terrain integration instead of circular pads or terrain cards
- Keep world coordinates independent from UI direction
- Use `getLocaleDirection` and the shared `LocalizedGameRoot`; do not add page-local direction checks
- Isolate external names with `BidiValue`/`dir="auto"` and numeric, timer, percentage, ID, or signed values with `dir="ltr"`
- Keep sentence punctuation in the localized parent and render placeholders through `BidiTemplate`; never rely on `text-align` alone for Persian
- Treat the Kingdom Resource HUD values as authoritative current balance first and Castle-derived storage capacity second. Keep `Cap` / `ظرفیت` explicit; these values are not hourly production or ready-to-collect amounts.
- Never mirror Pixi Kingdom/Battle geometry or ordered spatial grids when correcting interface direction
- Preserve Mine anchor source pixel `(280, 453)` unless the Mine source image changes
- Respect `prefers-reduced-motion`
- For all nine active buildings, derive visuals only through explicit `{ buildingId, level, theme }` requests to `getBuildingVisualState`; preserve `DEFAULT` as the sole implemented theme, all five tier assets, per-level detail rules, stable containers, and development Lab parity
- Keep building world labels and compact upgrade status screen-legible; do not parent compact UI so it blindly inherits building and world shrink. Preserve the shared screen-space overlay, one semantic `statusStackAnchor` per building, exact centered indicator-above-badge layout, and device-pixel snapping unless a measured replacement is better.
- Judge core texture quality from effective opaque-pixel resolution at production size, DPR, and moderate 150/200% inspection. Never claim improvement from naive raster upscaling; preserve current-stage lazy loading and the per-file budget.
- Keep Kingdom Theme presentation-only. Do not add persistence, ownership, selection, historical catalogs, commerce, Seasons, or gameplay bonuses without their explicit future phase

## Backend integrity rules

- Require idempotency keys for replayable economy and settlement mutations
- Acquire player advisory locks before balance or progression changes
- Lock multiple players in stable sorted order
- Use conditional decrements for charges and loot
- Record resource changes in `EconomyTransaction`
- Persist battle seed, rules version, snapshots, events, and final settlement
- Reuse the existing battle engine for Revenge
- Preserve Match Offer ownership, expiry, single use, and non-self checks
- Preserve the 24-hour `Player.createdAt` shield, bounded real matchmaking passes, recent-eight memory, and six-hour standard-Raid anti-farm rule
- Keep system-opponent classification server-owned, replenishment locked and ledgered, Trophy stable, and human social/Revenge state excluded
- Preserve Revenge ownership, expiry, source validation, row lock, single use, and loop prevention
- Preserve current Army targeting and roles: basic attacks use same lane then nearest living enemy slot with lower-slot tie break; Knight/Shield Wall protects its own squad, Ranger/Power Shot hits one enemy squad, Mage/Arcane Blast hits all living enemy squads; Infantry counters Cavalry, Cavalry counters Archer, and Archer counters Infantry
- Preserve the typography boundary: Persian uses locally bundled `Vazirmatn Variable`, English uses the system sans stack, visible production gameplay text stays at least 10px, and Georgia/Times display styling must never leak into Persian. Keep Persian numerals and bidi isolation intact; fix constrained layouts instead of reintroducing 5–9px gameplay text.
- Never expose development identity as production authentication

## Scope rules

Unused assets, Prisma enum values, transaction reasons, or adapter interfaces do not make a feature implemented. Confirm a schema path, service, controller, shared contract, client flow, and validation before describing a system as complete.

Retention work is split into explicit bounded tasks. Retention 03A, 03B, and 04 are complete; do not automatically start Retention 05 Shop, Guild, Leaderboards, Bale, Telegram, Barracks activation, equipment, or new building gameplay.

## Documentation maintenance

Update the relevant files under `docs/project` in the same commit when work changes architecture, API, database models, formulas, phase status, visual progression, or a major decision. Skip documentation churn for formatting and behavior-preserving refactors.

## Complete meaningful work

Every AI agent that completes meaningful work must update project history before finishing. A phase, feature, important bug fix, architecture or balance change, gameplay or world change, roadmap or launch change, security change, significant refactor, or major art and user experience pass qualifies. Typos and formatting-only edits do not.

Before work:

1. Read current Git HEAD and [the project index](INDEX.md).
2. Read the relevant system documentation.
3. Read `.private/PROJECT_MASTER_PLAN.md` when local access permits.
4. Read the latest `.private/AI_WORK_LOG.md` entries when local access permits.
5. Verify the current implementation in code.

After work:

1. Run appropriate validation.
2. Commit validated tracked changes when the project workflow requires it.
3. Push when required.
4. Update relevant canonical documentation.
5. Update `.private/PROJECT_MASTER_PLAN.md` when roadmap or current state changes.
6. Update `.private/PRODUCT_DECISIONS.md` when a meaningful decision changes.
7. Update `.private/LAUNCH_CHECKLIST.md` when launch readiness changes.
8. Append a meaningful entry to `.private/AI_WORK_LOG.md`.
9. Record the exact commit SHA and actual validation results.
10. Leave a clear next step.

Private files are intentionally ignored. Commit and push tracked changes first, then record the final SHA in the private history. Never force-add `.private/`, amend or force-push to include it, or claim meaningful work complete without the history entry.

Run `npm run validate:docs` after documentation changes.

## Current retention gate

Retention 01A, 01B, 02, 03A, 03B, and 04 are implemented. Army persistence, one-order training, Castle-derived capacity, and three Commander-led formation slots drive new rules-version-2 Raid/Revenge/Campaign battles. Broken Frontier provides nine authoritative stages, persistent best stars, and one-time rewards without PvP side effects. Historical rules-version-1 Hero replay remains compatible. Retention 05 Shop MVP + Gem Economy is next and not started. Barracks remains inactive. Kingdom Pixi coordinates, Castle composition, 54px navigation, and Persian RTL remain intact. Campaign art direction, troop art, advanced building art, Aren portrait/copy, and real-device audio still require owner review. Theme content, Guild, and Bale have not started.

## Git completion rules

After validated implementation work:

1. Review `git status` and the complete diff
2. Exclude unrelated or generated files
3. Commit with a scoped message
4. Push the current branch to `origin`
5. Verify local HEAD, tracking ref, and remote HEAD match
6. Verify the worktree is clean
7. Report branch, full commit hash, message, remote, push result, and worktree status

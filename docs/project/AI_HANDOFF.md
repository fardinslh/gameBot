---
title: Continue Crown & Coin with an AI coding agent
navLabel: AI Handoff
contentType: How-to
---

# Continue Crown & Coin with an AI coding agent

Use this sequence before a major change. Code and migrations remain authoritative when the documentation baseline is older than `HEAD`.

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
- Preserve Mine anchor source pixel `(280, 453)` unless the Mine source image changes
- Respect `prefers-reduced-motion`
- For core buildings, derive visuals only through explicit `{ buildingId, level, theme }` requests to `getBuildingVisualState`; preserve `DEFAULT` as the sole implemented theme, all five tier assets, per-level detail rules, stable containers, and development Lab parity
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
- Never expose development identity as production authentication

## Scope rules

Unused assets, Prisma enum values, transaction reasons, or adapter interfaces do not make a feature implemented. Confirm a schema path, service, controller, shared contract, client flow, and validation before describing a system as complete.

Retention work is split into explicit bounded tasks. After Retention 01A, do not automatically start 01B, Missions, Hero expansion, PvE, Shop, Guild, Leaderboards, Bale, Telegram, equipment, or new building gameplay.

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

Retention 01A core building evolution and its DEFAULT theme-ready architecture are implemented. `/dev/buildings` is the production-backed owner review surface; visual approval is pending. Retention 01B advanced buildings and progression goals are next but must not start without an explicit request. Retention 05B Theme Foundation follows future Shop/Gem architecture and remains unimplemented. The prior Aren and audio human checks remain open. Bale has not started and is intentionally after the bounded retention roadmap.

## Git completion rules

After validated implementation work:

1. Review `git status` and the complete diff
2. Exclude unrelated or generated files
3. Commit with a scoped message
4. Push the current branch to `origin`
5. Verify local HEAD, tracking ref, and remote HEAD match
6. Verify the worktree is clean
7. Report branch, full commit hash, message, remote, push result, and worktree status

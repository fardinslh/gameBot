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

## Backend integrity rules

- Require idempotency keys for replayable economy and settlement mutations
- Acquire player advisory locks before balance or progression changes
- Lock multiple players in stable sorted order
- Use conditional decrements for charges and loot
- Record resource changes in `EconomyTransaction`
- Persist battle seed, rules version, snapshots, events, and final settlement
- Reuse the existing battle engine for Revenge
- Preserve Match Offer ownership, expiry, single use, and non-self checks
- Preserve Revenge ownership, expiry, source validation, row lock, single use, and loop prevention
- Never expose development identity as production authentication

## Scope rules

Unused assets, Prisma enum values, transaction reasons, or adapter interfaces do not make a feature implemented. Confirm a schema path, service, controller, shared contract, client flow, and validation before describing a system as complete.

Do not start Guild, Season, Shop, payment, Bale, Telegram, additional Hero, equipment, or building gameplay work without a scoped user request.

## Documentation maintenance

Update the relevant files under `docs/project` in the same commit when work changes architecture, API, database models, formulas, phase status, visual progression, or a major decision. Skip documentation churn for formatting and behavior-preserving refactors.

Run `npm run validate:docs` after documentation changes.

## Git completion rules

After validated implementation work:

1. Review `git status` and the complete diff
2. Exclude unrelated or generated files
3. Commit with a scoped message
4. Push the current branch to `origin`
5. Verify local HEAD, tracking ref, and remote HEAD match
6. Verify the worktree is clean
7. Report branch, full commit hash, message, remote, push result, and worktree status

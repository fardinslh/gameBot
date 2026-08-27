---
title: Understand onboarding and the permanent Game Guide
navLabel: Player Experience
contentType: Reference
---

# Player Experience

## Aren and the mandatory flow

Aren (Persian: آرِن) is the recurring Royal Steward / Kingdom Advisor. The current portrait is an original 512-pixel transparent WebP candidate showing an experienced older steward in green, charcoal, leather, and restrained gold. The asset is replaceable without changing advisor behavior and still requires owner visual approval.

The pre-Bale first session teaches the existing core loop through real actions rather than a separate tutorial simulation:

```text
Welcome -> Collect -> start one building upgrade -> open Raid
  -> find a shielded SYSTEM opponent -> attack -> watch Battle
  -> inspect Result -> return to Kingdom -> complete
```

The player-facing sequence is `WELCOME -> COLLECT -> UPGRADE -> RAID -> FIND ENEMY -> ATTACK -> BATTLE -> RESULT -> COMPLETE`. Server persistence intentionally keeps the compact authoritative `RAID` state while React derives Find, Attack, Battle, and Result from real Raid UI state. Heroes are deliberately not mandatory. New players already have a valid three-Hero Raid Team.

## Authoritative state

`OnboardingProgress` is a one-to-one PostgreSQL record owned by `Player`. Status is `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, or `SKIPPED`; current step is `WELCOME`, `COLLECT`, `UPGRADE`, `RAID`, or `COMPLETE`. The response also carries `startedAt`, `completedAt`, `skippedAt`, and `serverTime`.

The API owns gameplay transitions inside the same transactions as their real actions:

- `POST /onboarding/start` changes `WELCOME` to `COLLECT`; this is presentation lifecycle only
- a successful authoritative Collect advances to `UPGRADE`
- a successful building-upgrade start advances to `RAID`
- a successfully settled standard Raid, win or loss against a real or system opponent, advances to `COMPLETE`
- Revenge never completes onboarding
- `POST /onboarding/skip` persists `SKIPPED` but creates no Raid, activation, reward, or completion event

The browser cannot submit an arbitrary step. Refresh and API restart reload the row. Existing players reconcile only from canonical milestones: `first_collect` means `UPGRADE`, `first_upgrade` means `RAID`, and `first_raid_completed` means `COMPLETED`. Missing history is never invented. System opponents receive a virtual skipped response and no onboarding row or metrics.

## Client presentation and collision rules

The React experience provider fetches state without blocking the game. Aren appears in welcome, completion, action coaching, contextual tips, and the permanent Guide. Every actionable step uses a typed `data-guide-target` rather than text queries.

`AdvisorCoach` measures the complete portrait-and-bubble unit and target with `getBoundingClientRect`. It uses the visual viewport, safe-area insets, live HUD bottom, 54-pixel navigation reserve, and a 12-pixel expanded target exclusion rectangle. It chooses above, below, left, or right space and reacts through `ResizeObserver`, `MutationObserver`, viewport resize/scroll, and layout scroll without polling. Targets receive a nonblocking visual outline; the coach has no pointer events. Offscreen DOM targets use restrained `scrollIntoView`. The bottom-sheet Upgrade CTA is explicitly covered by unit and browser acceptance logic: the full CTA remains visible and trial-clickable.

English and Persian copy lives in the shared localization dictionaries. The same component tree supports LTR and RTL; Pixi coordinates are unchanged.

## Permanent Game Guide

The compact book control in the top HUD remains available after completion or skip. The Guide contains exactly:

1. Kingdom
2. Resources
3. Buildings
4. Heroes
5. Raid
6. Trophies
7. New Kingdom Shield
8. Defense & Revenge

The panel header now identifies Aren and carries his reminder while preserving the same eight implemented-mechanics sections. It documents no nonexistent Guild, Season, Shop, payment, leaderboard, or Bale system.

## One-time contextual counsel

`AdvisorTipProgress` stores one row per `(playerId, tipKey)` for `HEROES_INTRO`, `CASTLE_PROGRESSION`, `NEW_KINGDOM_SHIELD`, `DEFENSE_INBOX`, and `REVENGE`. `GET /onboarding/advisor-tips` returns seen keys; `POST /onboarding/advisor-tips/:tipKey` idempotently marks one seen. Missing rows or a failed tip request never affect resources, matchmaking, shield, battle, loot, Trophies, or Revenge. Optional counsel waits until mandatory onboarding is complete or skipped and never uses analytics as state.

## Analytics

`onboarding_started` and `onboarding_step_seen` are bounded best-effort CLIENT events. `onboarding_completed` is a deduplicated SERVER event emitted in the standard-Raid transaction or historical reconciliation. `first_raid_completed` remains the canonical activation event; tutorial completion and skip do not redefine activation.

## Known limitations

- Copy still needs final Persian real-user review, and the Aren portrait remains a current candidate pending owner approval.
- The initial pass has one short mandatory path and no branching tutorial variants.
- All 24 explicit owner audio choices are mapped. The development-only Audio Lab records the completed selection gate; full-game real-device mix review remains open.
- The target-aware mobile browser screenshot run could not execute when no browser binding was available; unit geometry covers 320x568, 375x812, and 390x844, but manual screenshots remain required.
- Bale launch/reconnect behavior is not implemented or device-tested yet.

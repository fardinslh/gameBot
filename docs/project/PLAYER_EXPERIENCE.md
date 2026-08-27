---
title: Understand onboarding and the permanent Game Guide
navLabel: Player Experience
contentType: Reference
---

# Player Experience

## Purpose and mandatory flow

The pre-Bale first session teaches the existing core loop through real actions rather than a separate tutorial simulation:

```text
Welcome -> Collect -> start one building upgrade -> open Raid
  -> find a shielded SYSTEM opponent -> attack -> watch Battle
  -> inspect Result -> return to Kingdom -> complete
```

Heroes are deliberately not mandatory. New players already have a valid three-Hero Raid Team, so the tutorial reaches activation without diverting into roster management.

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

## Client presentation

The React experience provider fetches state without blocking the game. A compact welcome dialog starts or confirms skip. Contextual coaches point at Collect, building upgrade, Raid search, Attack, Battle, Result, and Kingdom return. The player still taps the real controls and receives the real server response. Failure to fetch onboarding displays a retry notice while gameplay remains available.

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

It documents implemented mechanics only. Guild, Season, Shop, payments, leaderboard, and Bale behavior are not represented as working game systems.

## Analytics

`onboarding_started` and `onboarding_step_seen` are bounded best-effort CLIENT events. `onboarding_completed` is a deduplicated SERVER event emitted in the standard-Raid transaction or historical reconciliation. `first_raid_completed` remains the canonical activation event; tutorial completion and skip do not redefine activation.

## Known limitations

- Copy still needs final Persian real-user review.
- The initial pass has one short mandatory path and no branching tutorial variants.
- All 24 explicit owner audio choices are mapped. The development-only Audio Lab records the completed selection gate; full-game real-device mix review remains open.
- Bale launch/reconnect behavior is not implemented or device-tested yet.

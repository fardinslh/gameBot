---
title: Operate missions, achievements, and Daily Return
navLabel: Retention Systems
contentType: Reference
---

# Operate missions, achievements, and Daily Return

Retention 02 adds three bounded return loops without changing existing economy, building, Hero, Raid, or Revenge rules. The API owns periods, progress, eligibility, rewards, claims, and time. The React client only renders `GET /retention` and sends claim intent.

## Authoritative progress

`RetentionMetricsService` derives progress from durable gameplay facts instead of accepting counters from the browser:

- successful `EconomyRequest` rows count Collect and Hero-upgrade actions;
- `EconomyTransaction` rows total collected resources;
- `BuildingUpgrade` rows count upgrade starts and completions;
- `Battle` rows count Raids, wins, and Revenge;
- current `Building` levels provide Castle and total-building milestones;
- current and historical Trophy values provide the highest reached Trophy milestone.

This derivation includes valid activity that predates Retention 02 and makes refreshes and mutation retries unable to inflate progress. Existing gameplay services do not write mission counters.

## Missions

The server assigns three enabled Daily missions from a pool of six and three Weekly missions from a pool of five. Selection is deterministic for the Player and UTC period, so refreshes and server restarts preserve the set. Daily periods reset at `00:00 UTC`; Weekly periods begin Monday at `00:00 UTC`.

Assignments snapshot definition key, target, and rewards in `RetentionMissionInstance`. A completed mission remains unclaimed until the Player explicitly claims it. Completing all three Daily missions enables one `RetentionDailyBonusClaim` for that UTC day. Revenge is intentionally absent from recurring mission pools.

## Achievements

Nine permanent families cover Castle level, total building levels, completed upgrades, collected resources, Hero upgrades, Raids, victories, Revenge, and highest Trophy value. Each family has ordered tiers and permits claiming only the next completed tier. Claimed tiers persist in `RetentionAchievementClaim`; earlier valid history is recognized automatically.

## Daily Return

`DailyReturnClaim` provides one explicit claim per UTC day. The seven-day cycle advances only when a day is claimed, missed days neither reset the cycle nor grant catch-up rewards, and the next claim after day 7 wraps to day 1. The daily UTC period has a unique database constraint, so concurrent requests cannot grant twice.

## Reward settlement and integrity

Every claim requires an 8–100 character `Idempotency-Key`, runs under the Player advisory lock, credits balances inside one PostgreSQL transaction, writes an immutable `EconomyTransaction` per resource, stores the response in `EconomyRequest`, and emits server analytics. Reward definitions live only in `retention.config.ts`; claim routes accept no amount, progress, time, or eligibility payload.

Campaign progression is a separate Retention 04 domain. Campaign battles do not count as Raid/Revenge mission progress, and Campaign rewards do not alter Retention 02 claim sequencing. Both systems reuse the transaction, ledger, idempotency, and advisory-lock integrity patterns.

Retention 02 remains the current free Gem-faucet family: Daily and Weekly Mission rewards, Daily completion, Achievement claims, and Daily Return may grant configured Gems. Gems are uncapped, so a valid reward is never discarded at the former placeholder capacity. Retention 05 consumes Gems but does not change progress derivation, period assignment, claim order, or reward definitions.

## Client boundary

After onboarding is complete or skipped, Kingdom shows one compact parchment/gold entry control. It opens a scrollable React sheet with Daily, Weekly, and Achievements tabs plus a seven-day return strip. The overlay preserves the existing Pixi world, coordinates, HUD, RTL/LTR boundary, safe areas, and exact 54px navigation. Successful claims refresh both Retention state and authoritative Kingdom balances.

## Validation

Run `npm run validate:retention` with API and client running. It verifies Persian RTL and English LTR, exactly three Daily missions, seven return days, nine achievement families, zero horizontal overflow, the 54px navigation, and clean browser consoles at 320x568, 375x812, and 390x844.

---
title: Understand the authoritative economy
navLabel: Economy
contentType: Reference
---

# Understand the authoritative economy

The API owns resource balances, production time, storage, costs, timers, levels, and ledger entries. PostgreSQL transactions and player advisory locks serialize mutations.

## Resources and starting balances

| Resource | Starting balance | Castle level 1 capacity | Capacity growth |
| --- | ---: | ---: | ---: |
| Gold | 8,000 | 10,000 | 1.35 |
| Food | 5,000 | 10,000 | 1.32 |
| Wood | 5,000 | 10,000 | 1.32 |
| Stone | 3,500 | 8,000 | 1.32 |
| Gems | 120 | 500 | 1.15 |

For resource `r` and Castle level `L`:

```text
capacity(r, L) = round(baseCapacity[r] * growth[r]^(max(1, L) - 1))
```

The API never lowers a legacy balance above its calculated capacity. Future production for that resource becomes zero until the balance falls below capacity.

## Building economy configuration

`apps/game-api/src/economy/economy.config.ts` stores all current values.

| Building | L1 production/hour | Production growth | L1 cost | Cost growth | Base time | Time growth |
| --- | ---: | ---: | --- | ---: | ---: | ---: |
| Castle | 0 | 1.00 | 1,000 Gold, 500 Wood, 500 Stone | 1.35 | 20s | 1.25 |
| Farm | 500 Food | 1.18 | 350 Gold, 120 Wood | 1.22 | 10s | 1.20 |
| Lumber Mill | 420 Wood | 1.18 | 400 Gold, 100 Food | 1.22 | 12s | 1.20 |
| Mine | 300 Stone | 1.18 | 450 Gold, 100 Food, 180 Wood | 1.22 | 14s | 1.20 |
| Grand Market | 380 Gold | 1.18 | 200 Food, 150 Wood, 120 Stone | 1.22 | 16s | 1.20 |
| Academy | 0 | 1.00 | 1,200 Gold, 500 Wood, 700 Stone | 1.28 | 30s | 1.22 |
| Blacksmith | 0 | 1.00 | 900 Gold, 400 Wood, 600 Stone | 1.26 | 25s | 1.21 |
| Watchtower | 0 | 1.00 | 700 Gold, 550 Wood, 450 Stone | 1.24 | 22s | 1.20 |
| Workshop | 0 | 1.00 | 800 Gold, 700 Wood, 350 Stone | 1.25 | 24s | 1.20 |

Every building has maximum level 20. The current balance values remain temporary product tuning.

## Production formula

The server clamps elapsed time to zero through eight hours. Each producing building stores an integer `productionRemainder` so repeated collections preserve fractions.

```text
rate = round(baseProductionPerHour * productionGrowth^(level - 1))
academyRate = floor(rate * (10000 + academyBonusBps) / 10000)
numerator = academyRate * elapsedMs + previousRemainder
rawGain = floor(numerator / 3600000)
nextRemainder = numerator mod 3600000
```

The server caps each raw gain against current resource capacity. Academy applies before the storage cap.

## Collect transaction

`POST /kingdom/collect` requires an idempotency key. `EconomyService.collect` performs these steps under one player lock and transaction:

1. Return a prior `EconomyRequest` response for the same player, key, and `COLLECT` action
2. Reconcile due building upgrades
3. Load authoritative balances, levels, last collection time, and remainders
4. Apply Academy production, the eight-hour cap, and resource storage limits
5. Update each producing building remainder
6. Increment each balance and create `OFFLINE_PRODUCTION` ledger rows
7. Set `Kingdom.lastCollectedAt` to server time
8. Store the complete response in `EconomyRequest`

## Upgrade formulas

For current level `L`:

```text
cost(resource, L) = ceil(baseCost[resource] * costGrowth^(L - 1))
baseDuration(L) = ceil(baseSeconds * durationGrowth^(L - 1) * timerMultiplier)
duration(L) = ceil(baseDuration(L) * (10000 - workshopSpeedBps) / 10000)
```

`ECONOMY_TIMER_MULTIPLIER` defaults to `1` and exists for development/testing. The server clamps each configured duration to at least one second before applying the Workshop discount.

Non-Castle upgrades require:

```text
requiredCastleLevel(targetLevel) = max(1, ceil(targetLevel / 3))
```

Levels 2 and 3 need Castle 1, levels 4 through 6 need Castle 2, and the three-level pattern continues.

## Upgrade lifecycle

Upgrade start validates ownership, building unlock, active-upgrade uniqueness, maximum level, Castle requirement, and every balance. Conditional decrements prevent a concurrent negative balance. The service records one `BUILDING_UPGRADE` ledger row per charged resource and inserts an `IN_PROGRESS` `BuildingUpgrade`.

Reads and mutation paths reconcile due upgrades. Reconciliation claims a due row through conditional `updateMany`, updates the building level once, mirrors Castle level to `Kingdom.level`, and creates one `UPGRADE_COMPLETE` notification through a unique source key. The explicit collect-completed endpoint rejects a timer that remains active.

## Transaction ledger and idempotency

`EconomyTransaction` records player, Kingdom, balance, resource, delta, balance before, balance after, reason, reference ID, and timestamp. Starting resources, Collect, building upgrades, Hero upgrades, troop training, Raid transfers, and Campaign rewards use the ledger. Troop-training charges use the `TROOP_TRAINING` reason and reference their `TroopTrainingOrder`.

Campaign first-clear and 9/18/27-star rewards may grant Gold, Food, Wood, and Stone only; Chapter One grants no Gems. Definitions and amounts live in `campaign.config.ts`. The client cannot submit a reward amount, battle result, or star count.

`EconomyRequest` enforces uniqueness across player, idempotency key, and action. Keys must contain 8 through 100 characters. Economy transactions retry Prisma serialization conflict `P2034` up to three attempts before returning `ECONOMY_CONFLICT`.

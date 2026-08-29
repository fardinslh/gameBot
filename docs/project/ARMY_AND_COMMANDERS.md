---
title: Operate the Army and Commander foundation
navLabel: Army and Commanders
contentType: Reference
---

# Operate the Army and Commander foundation

Retention 03 changes Crown & Coin's long-term combat fantasy from Hero-only expansion to Army-first Kingdom strategy. The Player remains a ruler who trains troops, assigns existing Heroes as Commanders, builds a formation, and later takes that Army into battle.

Retention 03A adds the authoritative Army domain in parallel with current combat. Retention 03B will introduce Army Battle rules version 2. Current Raid and Revenge still use the validated three-Hero Raid Team, `BattleHeroSnapshot`, events, and rules version 1.

## Troop content

Exactly three troop types exist:

| Type | Role prepared for 03B | Cost per unit | Training time | Starter count |
| --- | --- | --- | ---: | ---: |
| `INFANTRY` | Durable defensive frontline | 20 Food, 5 Gold | 2 seconds | 20 |
| `ARCHER` | Ranged offensive pressure | 15 Food, 10 Wood, 5 Gold | 3 seconds | 15 |
| `CAVALRY` | Mobile burst, premium military identity | 30 Food, 15 Gold | 5 seconds | 10 |

`army.config.ts` owns display order, costs, time, starter counts, future role metadata, the 25-unit maximum batch, and capacity constants. These values are development-scale balance and remain subject to later tuning. No counter triangle or production combat statistics exist yet.

## Capacity

The API calculates capacity from the authoritative Castle level:

```text
maximum = 60 + 10 × (Castle level - 1)
```

Ready troops and the quantity in an active training order both consume capacity. Available capacity is `maximum - ready - training`, never below zero. The client cannot submit capacity.

Castle-derived capacity is temporary. Prisma reserves `BARRACKS`, but Barracks is not an active Kingdom building, is not present in the validated building catalog, and has no world sprite, progression milestone, economy config, or visual evolution. Activating it requires a separate bounded phase.

## Persistent ownership and bootstrap

`PlayerTroop` stores one non-negative ready count per `(playerId, troopType)`. Runtime bootstrap creates missing rows with 20 Infantry, 15 Archers, and 10 Cavalry. It also creates one default formation:

1. 20 Infantry commanded by Knight
2. 15 Archers commanded by Ranger
3. 10 Cavalry commanded by Mage

Unique constraints and `createMany(..., skipDuplicates)` make repeated bootstrap safe. The migration backfills every existing Player, including system opponents. Repairing a missing troop row grants only that missing type's starter count; existing counts are not incremented.

## Training

Each Player may have one `IN_PROGRESS` `TroopTrainingOrder`. A PostgreSQL partial unique index enforces this beyond service validation. An order stores type, positive quantity, timestamps, status, and the charged cost snapshot.

`POST /army/train` accepts only `troopType`, `quantity`, and an 8–100 character `Idempotency-Key`. The API:

1. acquires the existing Player advisory transaction lock;
2. replays an existing response for the same Army training key;
3. reconciles a due order;
4. validates the single queue, 1–25 batch, remaining capacity, and balances;
5. conditionally deducts each required balance;
6. writes `TROOP_TRAINING` ledger rows using the order ID as `referenceId`;
7. creates the order and stores the response under Economy action `TROOP_TRAINING`;
8. commits balances, ledger, order, response, and analytics together.

The response includes the refreshed Army, authoritative balances, and server time. Gems, paid queues, cancellation, acceleration, and instant completion are absent.

## Lazy completion

`GET /army`, `POST /army/train`, and `PUT /army/formation` reconcile due training under the same Player lock. When server time reaches `completesAt`, one conditional status transition changes the order to `COMPLETED`, writes `completedAt`, and increments the matching ready count exactly once.

Correctness does not depend on a browser timer, timezone, process lifetime, Redis, or BullMQ. The browser countdown is informational.

## Formation and Commanders

`ArmyFormation` is one-to-one with Player. Its three `ArmyFormationSlot` records use slots 1, 2, and 3. Every slot stores a troop type, positive unit count, and `commanderPlayerHeroId`.

The API requires:

- exactly three unique slots numbered 1, 2, and 3;
- three distinct Commanders;
- enabled Commander ownership by the Player;
- assigned totals no greater than ready ownership for each troop type;
- total assigned units no greater than Army capacity.

The same troop type may occupy multiple squads when its combined assigned count is valid. The API does not require one of each type.

Knight, Ranger, and Mage remain `PlayerHero` records and still support Hero levels, upgrades, and the current Raid Team. Army slots reference those rows directly; no duplicate Commander entity or destructive Hero migration exists. A Commander's troop assignment is flexible. Retention 03B owns future synergy and combat behavior.

## API

| Method | Path | Authority |
| --- | --- | --- |
| `GET` | `/army` | Reconcile due training and return capacity, troops, training, formation, and Commanders |
| `POST` | `/army/train` | Validate intent, charge resources, create one order, and return Army plus balances |
| `PUT` | `/army/formation` | Validate and persist the requested three-slot formation |

Shared contracts define `TroopType`, Army troop/capacity/training/formation/Commander states, mutation inputs, responses, and structured Army errors. Counts are bounded integers; resource amounts use the existing serialized string convention.

## Analytics

Server events are:

- `army_bootstrapped`
- `troop_training_started`
- `troop_training_completed`
- `army_formation_saved`

System opponents remain excluded by the existing server analytics boundary. Reads emit no event.

## Battle-loss policy

The first Army Battle version will not permanently delete trained troops. Future battle casualties are battle-state casualties, not roster loss. This avoids a Hospital, wounded queue, recovery economy, loss spiral, and player soft-lock before Army combat is proven fun.

No Hospital or wounded-troop model exists.

## Development inspection

Run the client in development and open `/dev/army`. The lab calls the real Army API and shows capacity, ready counts, per-unit costs/time, active training, formation, and Commanders. It can start one-unit training orders and refresh reconciliation.

The route returns 404 in production and is not linked from production navigation. The Heroes tab and current Raid Team language remain unchanged until the 03B cutover is designed.

## Retention 03A / 03B boundary

Retention 03A implements persistence, bootstrap, training economy, capacity, formation, Commander assignments, APIs, analytics, tests, and development inspection.

Retention 03B remains next and must separately define:

- Army Battle rules version 2;
- Army snapshots and events;
- troop/Commander combat stats, counters, targeting, and balance;
- Raid, Revenge, system-opponent, playback, and UI cutover behavior;
- permanent rules version 1 replay compatibility.

Current production Raid does not read Army data. No permanent PvP troop casualties, Barracks activation, Army missions, Army Achievements, PvE, Shop, or platform integration were added.

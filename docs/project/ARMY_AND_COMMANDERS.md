---
title: Operate the Army and Commander battle system
navLabel: Army and Commanders
contentType: Reference
---

# Operate the Army and Commander battle system

Retention 03 changes Crown & Coin's combat fantasy from Hero-only expansion to Army-first Kingdom strategy. The Player trains troops, assigns existing Heroes as Commanders, builds a formation, and takes that Army into Raid and Revenge battles.

Retention 03A provides the authoritative Army domain. Retention 03B cuts new Raid and Revenge battles over to Army Battle rules version 2 while preserving stored rules-version-1 Hero replays. Retention 04 reuses the same immutable Army snapshot and simulator for Campaign attempts; casualties remain battle-state only.

## Troop content

Exactly three troop types exist:

| Type | Combat role | HP / ATK / DEF | Cost per unit | Training time | Starter count |
| --- | --- | --- | ---: | ---: |
| `INFANTRY` | Durable defensive frontline; counters Cavalry | 90 / 9 / 14 | 20 Food, 5 Gold | 2 seconds | 20 |
| `ARCHER` | Ranged pressure; counters Infantry | 60 / 14 / 7 | 15 Food, 10 Wood, 5 Gold | 3 seconds | 15 |
| `CAVALRY` | Mobile burst; counters Archer | 80 / 16 / 10 | 30 Food, 15 Gold | 5 seconds | 10 |

`army.config.ts` owns display order, costs, time, starter counts, combat statistics, the 25-unit maximum batch, and capacity constants. These values are development-scale balance. Army Battle v2 applies a 20 percent counter advantage in the triangle above.

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

The response includes the refreshed Army, authoritative balances, and server time. The production Army client applies both Army state and those returned balances immediately, preserving the existing Hero roster/player fields and avoiding client subtraction or an extra GET. Gems, paid queues, cancellation, acceleration, and instant completion are absent.

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

Knight, Ranger, and Mage remain `PlayerHero` records and still support Hero levels and upgrades. Army slots reference those rows directly; no duplicate Commander entity or destructive Hero migration exists. A Commander's troop assignment is flexible. Each level above 1 adds one percent to its squad's HP and ATK, capped at level 20. Knight casts Shield Wall, Ranger casts Power Shot, and Mage casts Arcane Blast.

### Current Commander roles and targeting

- **Knight** is the tank/frontline-sustain Commander. Shield Wall targets and protects the Knight's own squad.
- **Ranger** is the single-target damage Commander. Power Shot targets one living enemy squad.
- **Mage** is the area/burst Commander. Arcane Blast damages every living enemy squad.
- A basic attack targets the living enemy in the same lane first. If that lane is empty, it selects the nearest living enemy slot; an equal-distance tie uses the lower slot number.
- Troop counters are `Infantry > Cavalry`, `Cavalry > Archer`, and `Archer > Infantry`. Commander identity does not change that troop counter triangle.

These are descriptions of the current authoritative Army Battle v2 engine, not client targeting choices. This corrective pass changes presentation and documentation only; combat formulas, targeting, multipliers, and balance remain unchanged.

## API

| Method | Path | Authority |
| --- | --- | --- |
| `GET` | `/army` | Reconcile due training and return capacity, troops, training, formation, and Commanders |
| `POST` | `/army/train` | Validate intent, charge resources, create one order, and return Army plus balances |
| `PUT` | `/army/formation` | Validate and persist the requested three-slot formation |

Shared contracts define `TroopType`, Army troop/capacity/training/formation/Commander states, Army and squad power, mutation inputs, responses, and structured Army errors. Counts are bounded integers; resource amounts use the existing serialized string convention.

## Analytics

Server events are:

- `army_bootstrapped`
- `troop_training_started`
- `troop_training_completed`
- `army_formation_saved`
- `army_battle_started`
- `army_battle_finished`

System opponents remain excluded by the existing server analytics boundary. Reads emit no event.

## Battle-loss policy

Army Battle v2 does not permanently delete trained troops. Replay casualties are battle-state casualties, not roster loss. This avoids a Hospital, wounded queue, recovery economy, loss spiral, and player soft-lock before Army combat is proven fun.

No Hospital or wounded-troop model exists.

## Development inspection

Run the client in development and open `/dev/army`. The lab calls the real Army API and shows capacity, ready counts, per-unit costs/time, active training, formation, and Commanders. It can start one-unit training orders and refresh reconciliation.

The route returns 404 in production and is not linked from production navigation. Production navigation keeps the internal `heroes` section ID for compatibility but presents it as Army and renders formation, training, Commander assignment, power, and Commander upgrades.

## Army Battle v2

New Raid and Revenge starts load both validated formations under the existing sorted participant locks. Six immutable `BattleArmySquadSnapshot` rows store troop type/count, Commander identity/level/skill, per-unit stats, aggregate HP, and squad power. The server uses a cryptographic seed and deterministic rules version 2; the client receives only persisted outcomes and events.

Squads attack the same lane first, then the nearest living lane with a lower-slot tie break. Shield Wall affects its own squad, Power Shot hits one selected enemy squad, and Arcane Blast hits all living enemy squads. Attack output falls with casualties. `SQUAD_DEFEATED` and `remainingUnits` make losses explicit in replay and results. The Pixi scene renders three fixed portrait lanes per side without mirroring world coordinates for RTL.

Stored rules-version-1 battles continue to reconstruct from `BattleHeroSnapshot`; new rules-version-2 battles reconstruct from Army snapshots. No permanent PvP troop casualties, Barracks activation, Army missions, Army Achievements, PvE, Shop, or platform integration were added.

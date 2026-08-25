---
title: Understand Raid and battle settlement
navLabel: Raid and Battle
contentType: Reference
---

# Understand Raid and battle settlement

Raid uses server-owned Match Offers, immutable Hero snapshots, a seeded deterministic engine, and one transactional settlement. The client never calculates the winner.

## Request flow

```text
GET /raid
  -> authoritative team, power, balances, Trophies

POST /raid/search
  -> server selects defender
  -> server calculates protected potential loot
  -> RaidMatchOffer expires in 180s

POST /raid/start + Idempotency-Key
  -> validate offer ownership, expiry, single use, and non-self target
  -> lock both players in sorted order
  -> snapshot both three-Hero teams
  -> simulate rules version 1 from a server UUID seed
  -> settle loot and Trophies
  -> persist Battle, snapshots, events, and response

GET /battles/:battleId
  -> return stored replay to either participant
```

## Matchmaking

`RaidService.search` ensures five development opponents exist, then evaluates players with a Kingdom and a non-empty Raid Team. It avoids the five most recently offered defenders where a candidate remains.

The server tries these passes in order:

1. Trophy difference up to 150 and power difference up to 15 percent
2. Trophy difference up to 300 and power difference up to 30 percent
3. Any non-recent eligible opponent
4. Any eligible opponent, including recent opponents

Within a pass, the server sorts by `absolute Trophy difference + absolute power difference / 10`, then by player ID. A Match Offer stores attacker, defender, both power values, potential loot, creation time, expiry, and use time.

## Raid Team snapshots

Each side must have exactly three enabled Heroes owned by that player. At settlement, the API derives HP, ATK, DEF, power, and skill from current server content and levels. `BattleHeroSnapshot` stores the six resulting combat records.

Snapshots protect replay history from later Hero config, level, or team changes.

## Deterministic battle engine

`apps/game-api/src/battle/battle.engine.ts` accepts only a seed, rules version, and two validated teams. `seeded-random.ts` supplies all variance and critical rolls. Authoritative battle code does not call `Math.random()`.

Current rules version is `1`:

| Rule | Value |
| --- | --- |
| Logical simulation limit | 30,000 ms |
| Playback duration | scaled to 8,000 through 15,000 ms |
| Base damage | `max(25, ATK - round(DEF * 0.35))` |
| Damage variance | seeded 95 through 105 percent |
| Critical | seeded 10 percent chance, 150 percent damage |
| Knight basic interval | 1,400 ms |
| Ranger basic interval | 1,200 ms |
| Mage basic interval | 1,500 ms |
| Targeting | first living enemy slot |

Skills use these rules:

- **Shield Wall**: 35 percent damage reduction for 2,500 ms, 5,000 ms cooldown
- **Power Shot**: 180 percent damage against the first living enemy, 4,000 ms cooldown
- **Arcane Blast**: 100 percent damage against every living enemy, 5,500 ms cooldown

If both teams remain alive at 30 logical seconds, total remaining HP ratios decide the winner. A seeded tie-break handles equal ratios.

## Persisted battle record

`Battle` stores type, result, winner, participants, seed, rules version, duration, Trophy before/delta values, loot, and timestamps. `BattleEvent` stores an ordered timeline of battle start, basic attacks, skill casts, damage, buffs, defeats, and battle end.

The Battle response reconstructs both teams from snapshots and events from the database. It does not run the engine during replay.

## Loot calculation

Gems never participate in Raid loot. Base protection is 70 percent, which exposes 30 percent. Defender Watchtower protection adds one percentage point per level above 1, capped at 15 points.

For each raidable resource:

```text
exposed = balance - floor(balance * protectedBps / 10000)
aboveReserve = balance - reserve
loot = max(0, min(exposed, aboveReserve, cap))
```

| Resource | Reserve | Cap |
| --- | ---: | ---: |
| Gold | 2,000 | 8,000 |
| Food | 1,000 | 6,000 |
| Wood | 1,000 | 5,000 |
| Stone | 800 | 4,000 |

Search, Raid settlement, Revenge preview, and Revenge settlement call the same calculator. The settlement recalculates from current balances after locks rather than trusting the Match Offer preview.

## Trophy calculation

The calculator derives an expected score from a 400-point rating curve. An attacker victory grants 15 through 30 Trophies and removes 5 through 20 from the defender. A defender victory removes 5 through 20 from the attacker and grants 15 through 30 to the defender. Settlement clamps a negative delta so neither player falls below zero.

## Transaction and concurrency safety

Raid start requires an 8 through 100 character idempotency key. The service locks both player identities in sorted player-ID order, checks a stored response, validates the Match Offer, resolves and persists the battle, marks the offer used, and stores the response in one PostgreSQL transaction.

Attacker victories conditionally decrement each defender balance, increment the attacker balance, and create paired `RAID_LOSS` and `RAID_REWARD` ledger rows with `referenceId = battleId`. Prisma serialization and uniqueness conflicts retry up to three times.

## Rate limiting and development fixtures

The current rate limiter lives in API process memory. Per player and 60-second window it allows 30 searches, 20 starts, and 120 overview or battle-detail requests. Multiple API instances do not share these counters.

`RaidFixtureService` creates five persistent Web development opponents: Iron Wolf, Silver Fox, Lion Heart, Black Raven, and Storm Keep. Their stable `raid-fixture:*` identities, fixed levels, resources, and Trophies support local matchmaking. They are development scaffolding, not production bots.

## Client playback

`BattleScene` loads the six local Hero portraits and schedules visual events using stored `timeMs`. Pixi animates attacks, skills, damage flashes, and HP bars. A browser timer shows the result after `durationMs + 450`. The client does not alter battle state.

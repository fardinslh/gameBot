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

`RaidService.search` idempotently ensures 30 system opponents exist, then evaluates players with a Kingdom and valid three-Hero Raid Team. Real candidates are queried inside the maximum Trophy bound, must be older than the 24-hour shield, and cannot have been Raided by this attacker in the previous six hours.

The server tries these passes in order:

1. Trophy difference up to 150 and power difference up to 15 percent
2. Trophy difference up to 300 and power difference up to 30 percent
3. Trophy difference up to 450 and power difference up to 40 percent
4. A non-recent system opponent
5. An older recent safe real opponent, then an older recent system opponent
6. Any system opponent as the absolute cold-start fallback

There is no unlimited real-player fallback. Within each eligible set, the server sorts by `absolute Trophy difference + absolute power difference / 10`, takes the best five, and selects one server-side with cryptographic randomness. The last eight offered defenders are avoided where possible and the immediate previous opponent is only allowed by the absolute system fallback. A Match Offer stores attacker, defender, both power values, potential loot, creation time, expiry, and use time.

## New Kingdom Shield

The API derives protection from persistent `Player.createdAt`; it does not store or trust a client flag. Human Players remain protected for exactly 24 hours across refreshes, browser/API restarts, and system Raids. A protected attacker searches system opponents only. Protected real Players are excluded as normal defenders. System accounts are exempt from shield classification. Raid overview/search returns `{ active, expiresAt }` plus `serverTime`, and the client renders a compact localized countdown.

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

## Rate limiting and system opponents

The current rate limiter lives in API process memory. Per player and 60-second window it allows 30 searches, 20 starts, and 120 overview or battle-detail requests. Multiple API instances do not share these counters.

`SystemOpponentService` creates 30 persistent Web system accounts in six tiers of five. Stable `system-opponent:*` keys plus the five retained `raid-fixture:*` keys prevent duplicates. They use normal Player, Kingdom, Building, ResourceBalance, PlayerHero, RaidTeam, Trophy, Battle, and EconomyTransaction records. `Player.isSystemOpponent` is the durable server classification; names are never used for detection.

Tier Hero levels produce normal server-derived team-power ranges of 2,155–2,294, 2,366–2,516, 2,598–2,762, 2,852–3,035, 3,135–3,334, and 3,448–3,668. Each tier's GOLD/FOOD/WOOD/STONE replenishment threshold is half its configured target. Before offer creation, an advisory transaction lock serializes re-read and replenishment; only below-threshold balances are restored and every exact delta uses `SYSTEM_OPPONENT_REPLENISH`.

| Tier | Count | Trophy | Castle | Hero levels | Team power | Resource targets G/F/W/S | 50% thresholds G/F/W/S |
| --- | ---: | --- | ---: | --- | --- | --- | --- |
| 1 | 5 | 780–940 | 1 | 1–2 | 2,155–2,294 | 12k / 10k / 8k / 6k | 6k / 5k / 4k / 3k |
| 2 | 5 | 900–1,060 | 2 | 2–3 | 2,366–2,516 | 18k / 14k / 12k / 9k | 9k / 7k / 6k / 4.5k |
| 3 | 5 | 1,040–1,200 | 3 | 3–4 | 2,598–2,762 | 26k / 20k / 17k / 13k | 13k / 10k / 8.5k / 6.5k |
| 4 | 5 | 1,180–1,340 | 4 | 4–5 | 2,852–3,035 | 38k / 29k / 24k / 18k | 19k / 14.5k / 12k / 9k |
| 5 | 5 | 1,320–1,480 | 5 | 5–6 | 3,135–3,334 | 54k / 40k / 33k / 25k | 27k / 20k / 16.5k / 12.5k |
| 6 | 5 | 1,460–1,620 | 6 | 6–7 | 3,448–3,668 | 75k / 56k / 46k / 35k | 37.5k / 28k / 23k / 17.5k |

System configured Trophy values remain stable: human Trophy settlement still applies, but a system participant receives delta zero and no Trophy update. A standard Raid against a system defender persists the Battle but creates no `PLAYER_RAIDED`, `REVENGE_AVAILABLE`, `RevengeTarget`, or human unread state.

## Client playback

`BattleScene` loads the six local Hero portraits and schedules visual events using stored `timeMs`. Pixi animates attacks, skills, damage flashes, and HP bars. A browser timer shows the result after `durationMs + 450`. The client does not alter battle state.

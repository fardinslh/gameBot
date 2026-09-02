---
title: Understand Raid and battle settlement
navLabel: Raid and Battle
contentType: Reference
---

# Understand Raid and battle settlement

## Campaign isolation

Campaign attempts reuse deterministic Army Battle rules version 2 and stored replay events, but they are not Raid or Revenge. `Battle.type = CAMPAIGN` and `campaignStageKey` identify them. Campaign-only system players carry `SystemOpponentKind.CAMPAIGN`, so Raid search cannot select them. Campaign battles are filtered from Raid history and inbox and create no Match Offer, Trophy, loot transfer, Revenge target, notification, shield mutation, anti-farm record, or permanent troop loss.

Raid uses server-owned Match Offers, immutable versioned snapshots, a seeded deterministic engine, and one transactional settlement. The client never calculates the winner. New Raid and Revenge battles use Army Battle rules version 2; historical Hero battles remain replayable under rules version 1.

## Request flow

```text
GET /raid
  -> authoritative Army, power, balances, Trophies

POST /raid/search
  -> server selects defender
  -> server calculates protected potential loot
  -> server fingerprints the attacker's ordered battle-relevant Army state
  -> RaidMatchOffer expires in 180s

POST /raid/start + Idempotency-Key
  -> validate offer ownership, expiry, single use, and non-self target
  -> lock both players in sorted order
  -> reconcile and fingerprint the current attacker Army; reject if it changed
  -> validate the current defender Army and snapshot both three-squad Armies
  -> simulate rules version 2 from a server UUID seed
  -> settle loot and Trophies
  -> persist Battle, snapshots, events, and response

GET /battles/:battleId
  -> return stored replay to either participant
```

## Matchmaking

`RaidService.search` idempotently ensures 30 system opponents exist, then evaluates players with a Kingdom and valid three-squad Army Formation. Real candidates are queried inside the maximum Trophy bound, must be older than the 24-hour shield, and cannot have been Raided by this attacker in the previous six hours.

The server tries these passes in order:

1. Trophy difference up to 150 and power difference up to 15 percent
2. Trophy difference up to 300 and power difference up to 30 percent
3. Trophy difference up to 450 and power difference up to 40 percent
4. A non-recent system opponent
5. An older recent safe real opponent, then an older recent system opponent
6. Any system opponent as the absolute cold-start fallback

There is no unlimited real-player fallback. Within each eligible set, the server sorts by `absolute Trophy difference + absolute power difference / 10`, takes the best five, and selects one server-side with cryptographic randomness. The last eight offered defenders are avoided where possible and the immediate previous opponent is only allowed by the absolute system fallback. A Match Offer stores attacker, defender, both power values, potential loot, creation time, expiry, use time, and a SHA-256 fingerprint of the attacker's ordered slot, troop type, unit count, Commander ownership ID/key, and Commander level. A null fingerprint marks a pre-cutover offer and cannot start.

## New Kingdom Shield

The API derives protection from persistent `Player.createdAt`; it does not store or trust a client flag. Human Players remain protected for exactly 24 hours across refreshes, browser/API restarts, and system Raids. A protected attacker searches system opponents only. Protected real Players are excluded as normal defenders. System accounts are exempt from shield classification. Raid overview/search returns `{ active, expiresAt }` plus `serverTime`, and the client renders a compact localized countdown.

## Versioned snapshots

Rules version 2 requires exactly three positive squads and three unique enabled Commanders owned by each participant. At settlement, the API reconciles training, validates ready troop ownership, derives combat values and power, and stores six `BattleArmySquadSnapshot` rows. Rules version 1 keeps using its six `BattleHeroSnapshot` rows. Snapshots protect replay history from later troop, formation, Commander, or content changes.

## Deterministic battle engine

`apps/game-api/src/battle/battle.engine.ts` accepts only a seed, rules version, and two validated teams. `seeded-random.ts` supplies all variance and critical rolls. Authoritative battle code does not call `Math.random()`.

Rules version 1 remains frozen for historical Hero replay. New battles use version 2:

| Rule | Value |
| --- | --- |
| Logical simulation limit | 30,000 ms |
| Playback duration | scaled to 8,000 through 15,000 ms |
| Base damage | living-unit attack minus defense contribution, minimum 5 |
| Damage variance | seeded 95 through 105 percent |
| Critical | seeded 10 percent chance, 150 percent damage |
| Knight basic interval | 1,400 ms |
| Ranger basic interval | 1,200 ms |
| Mage basic interval | 1,500 ms |
| Counter bonus | 20 percent: Infantry > Cavalry > Archer > Infantry |
| Targeting | same lane, then nearest living lane; lower slot wins ties |

Skills use these rules:

- **Shield Wall**: 35 percent damage reduction for 2,500 ms, 5,000 ms cooldown
- **Power Shot**: 180 percent damage against the first living enemy, 4,000 ms cooldown
- **Arcane Blast**: 75 percent damage against every living enemy, 5,500 ms cooldown

Squad damage output scales down as units fall. Shield Wall reduces damage by 35 percent for 2,500 ms; Power Shot deals 180 percent to one target. If both Armies remain alive at 30 logical seconds, each side is scored from Army-wide `sum(current HP) / sum(max HP)`, scaled to an integer millionth. This weights every HP point consistently instead of weighting small and large squads equally. A seeded tie-break handles exact equal scores.

## Persisted battle record

`Battle` stores type, result, winner, participants, seed, rules version, duration, Trophy before/delta values, loot, and timestamps. `BattleEvent` stores an ordered timeline of battle start, basic attacks, skill casts, damage, buffs, squad defeats, remaining HP/units, and battle end.

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

Raid start requires an 8 through 100 character idempotency key. The service locks both player identities in sorted player-ID order and checks a stored response first, preserving same-key retry behavior. It then validates the Match Offer, reconciles and fingerprints the current attacker Army, and rejects `MATCH_OFFER_ARMY_CHANGED` before settlement if the fingerprint differs or is absent. A valid start uses that same loaded attacker snapshot, loads the defender's current Army, resolves and persists the battle, marks the offer used, and stores the response in one PostgreSQL transaction. Defender state intentionally remains current at start.

Attacker victories conditionally decrement each defender balance, increment the attacker balance, and create paired `RAID_LOSS` and `RAID_REWARD` ledger rows with `referenceId = battleId`. Prisma serialization and uniqueness conflicts retry up to three times.

## Rate limiting and system opponents

The current rate limiter lives in API process memory. Per player and 60-second window it allows 30 searches, 20 starts, and 120 overview or battle-detail requests. Multiple API instances do not share these counters.

`SystemOpponentService` creates 30 persistent Web system accounts in six tiers of five. Stable `system-opponent:*` keys plus the five retained `raid-fixture:*` keys prevent duplicates. They use normal Player, Kingdom, Building, ResourceBalance, PlayerHero, RaidTeam, Trophy, Battle, and EconomyTransaction records. `Player.isSystemOpponent` is the durable server classification; names are never used for detection.

Tier troop counts and Commander levels produce server-derived Army-power ranges of 1,249–1,265, 1,507–1,524, 1,781–1,799, 2,033–2,089, 2,345–2,371, and 2,638–2,679. Each tier's GOLD/FOOD/WOOD/STONE replenishment threshold is half its configured target. Before offer creation, an advisory transaction lock serializes re-read and replenishment; only below-threshold balances are restored and every exact delta uses `SYSTEM_OPPONENT_REPLENISH`.

| Tier | Count | Trophy | Castle | Commander levels | Army power | Resource targets G/F/W/S | 50% thresholds G/F/W/S |
| --- | ---: | --- | ---: | --- | --- | --- | --- |
| 1 | 5 | 780–940 | 1 | 1–2 | 1,249–1,265 | 12k / 10k / 8k / 6k | 6k / 5k / 4k / 3k |
| 2 | 5 | 900–1,060 | 2 | 2–3 | 1,507–1,524 | 18k / 14k / 12k / 9k | 9k / 7k / 6k / 4.5k |
| 3 | 5 | 1,040–1,200 | 3 | 3–4 | 1,781–1,799 | 26k / 20k / 17k / 13k | 13k / 10k / 8.5k / 6.5k |
| 4 | 5 | 1,180–1,340 | 4 | 4–5 | 2,033–2,089 | 38k / 29k / 24k / 18k | 19k / 14.5k / 12k / 9k |
| 5 | 5 | 1,320–1,480 | 5 | 5–6 | 2,345–2,371 | 54k / 40k / 33k / 25k | 27k / 20k / 16.5k / 12.5k |
| 6 | 5 | 1,460–1,620 | 6 | 6–7 | 2,638–2,679 | 75k / 56k / 46k / 35k | 37.5k / 28k / 23k / 17.5k |

System configured Trophy values remain stable: human Trophy settlement still applies, but a system participant receives delta zero and no Trophy update. A standard Raid against a system defender persists the Battle but creates no `PLAYER_RAIDED`, `REVENGE_AVAILABLE`, `RevengeTarget`, or human unread state.

## Client playback

`BattleScene` dispatches by replay rules version. Version 1 loads the six local Hero portraits unchanged. Version 2 renders three stable portrait lanes per side with local troop sprites, compact Commander medallions, attacks, skills, damage flashes, HP bars, and representative-unit loss. A browser timer shows the result after `durationMs + 450`. The client does not alter battle state.

For a standard Raid, the active authoritative Army preview now appears in a short departure scene while `POST /raid/start` is already in flight. The normal minimum beat is 1,050 ms and reduced-motion mode uses 180 ms; neither delays the request itself nor changes the response. After stored replay and result presentation, Return to Kingdom derives a one-shot Commander procession from the replay. Victory carries a decorative loot cart and authoritative settled loot context; defeat returns without loot. This return creates no server call or settlement and clears after playback. Revenge and Campaign retain their existing navigation flows.

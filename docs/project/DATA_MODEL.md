---
title: Understand the PostgreSQL data model
navLabel: Data Model
contentType: Reference
---

# Understand the PostgreSQL data model

Prisma defines identity, Kingdom economy, Heroes, Army and Commanders, battle history, Revenge, notifications, analytics, and onboarding. SQL migrations add constraints and backfills that remain part of the authoritative schema.

## Relationship map

```text
Player
  1--* PlatformAccount
  1--1 Kingdom
        1--* ResourceBalance --* EconomyTransaction
        1--* Building --* BuildingUpgrade
  1--* EconomyRequest
  1--* PlayerHero *--1 HeroDefinition
  1--1 RaidTeam --* RaidTeamSlot *--1 PlayerHero
  1--* RaidMatchOffer as attacker and defender
  1--* Battle as attacker, defender, and winner
  1--* RevengeTarget as owner and target
  1--* Notification
  1--1 OnboardingProgress
  1--* AdvisorTipProgress
  1--* AnalyticsEvent
  1--* RetentionMissionInstance
  1--* RetentionDailyBonusClaim
  1--* RetentionAchievementClaim
  1--* DailyReturnClaim

RaidMatchOffer 1--0..1 Battle
Battle 1--0..6 BattleHeroSnapshot
Battle 1--0..6 BattleArmySquadSnapshot
Battle 1--* BattleEvent
Battle 1--0..1 RevengeTarget as source
RevengeTarget 1--0..1 Battle as consumed Revenge
```

## Identity models

`Player` owns cross-platform game state, Trophies, persistent `createdAt`, and the durable server-owned `isSystemOpponent` classification. `createdAt` is also the source of truth for the 24-hour New Kingdom Shield. `PlatformAccount` maps one `(platform, externalUserId)` pair to a Player. This unique pair forms the current advisory-lock identity.

`Platform` contains `BALE`, `TELEGRAM`, and `WEB`. Runtime player context currently resolves only `WEB`.

## Kingdom economy models

`Kingdom` has one Player, a name, legacy level, collection timestamp, balances, buildings, and ledger rows. `ResourceBalance` enforces one row per Kingdom and resource.

`Building` enforces one row per Kingdom and type. It stores level and production remainder. `BuildingUpgrade` stores one-level transitions and lifecycle timestamps.

`EconomyTransaction` records immutable balance movement details. `EconomyRequest` stores JSON responses and enforces one `(playerId, idempotencyKey, action)` tuple.

## Retention models

`RetentionMissionInstance` stores one deterministic assignment snapshot per Player, cadence, UTC period, and definition key. It persists target/rewards and optional claim time; progress remains derived from gameplay facts. `RetentionDailyBonusClaim` permits one all-Daily reward per Player and UTC day. `RetentionAchievementClaim` permits one claim per Player, family key, and tier. `DailyReturnClaim` permits one claim per Player and UTC day and records the claimed day index from 1 through 7.

Retention rewards reuse `ResourceBalance`, `EconomyTransaction`, and `EconomyRequest`. New transaction reasons distinguish Daily/Weekly missions, Achievements, Daily Return, and Daily completion. Database uniqueness plus the existing advisory-lock boundary prevents duplicate grants under concurrent requests.

## Hero models

`HeroDefinition.key` is unique. Definitions contain server content and can be disabled. `PlayerHero` enforces one ownership row for each player and definition.

`RaidTeam` enforces one active team per Player. `RaidTeamSlot` enforces unique slot and unique Hero within that team. SQL constrains slots to 1 through 3.

## Army and Commander models

`PlayerTroop` enforces one row per Player and `TroopType`, with a non-negative ready count. `TroopTrainingOrder` stores positive quantity, cost snapshot, timestamps, and `IN_PROGRESS` or `COMPLETED` status. A partial unique index permits only one active order per Player.

`ArmyFormation` enforces one formation per Player. `ArmyFormationSlot` enforces slots 1 through 3, positive unit count, one slot number per formation, and one use of each Commander per formation. Its Commander foreign key references the existing `PlayerHero` row. Deleting a Hero ownership row removes the dependent formation slot so runtime bootstrap can repair the formation; Player deletion remains cascade-safe.

## Raid and battle models

`RaidMatchOffer` stores one proposed pairing, its expiry/use state, and the attacker's ordered Army fingerprint captured by search. SQL forbids a self-offer, requires positive authoritative power, and constrains a present fingerprint to the 64-character SHA-256 representation. Nullable fingerprints preserve migration compatibility but are treated as stale by Raid start.

`Battle` supports `RAID` and `REVENGE`. A standard Raid links one unique Match Offer; a Revenge links one unique Revenge target. The row stores settlement and replay metadata.

`BattleHeroSnapshot` preserves rules-version-1 Hero records. `BattleArmySquadSnapshot` stores rules-version-2 troop, Commander, aggregate-stat, and power state with one row per battle, side, and slot. `BattleEvent` enforces one sequence number per battle and can store remaining unit count. SQL constrains battle duration to 8,000 through 15,000 ms and validates positive snapshot stats.

## Revenge and notification models

`RevengeTarget.sourceBattleId` is unique. SQL forbids self-Revenge. Indexed owner, status, and expiry fields support inbox and eligibility queries.

`Notification.sourceKey` is unique. Notifications store typed payload JSON, typed deep-link intent JSON, creation/read timestamps, and `STORED` delivery status.

## Key database-only constraints

- One active `QUEUED` or `IN_PROGRESS` upgrade per building through a partial unique index
- Building level from 1 through 20
- Upgrade levels from 1 through 20 with a one-level step
- Hero level from 1 through 20 and non-negative XP
- Three valid Raid Team slot numbers
- Non-negative troop ready counts and positive training quantities
- One active troop training order per Player
- One Army Formation per Player with unique slots and Commanders
- Army Formation slots 1 through 3 with positive unit counts
- No self Raid Match Offer
- No self Battle participant pair
- No self Revenge target
- Non-negative Player Trophies

## AnalyticsEvent

`AnalyticsEvent` belongs to one `Player` and stores optional unique dedupe/session data, source, app-defined name, schema version, platform context, bounded metadata, server occurrence time, and optional client time. Indexes cover player, event, cohort, and acquisition queries. Production exposes no event update/delete API.

## Migration history

`OnboardingProgress` is a one-to-one Player record with `status`, `currentStep`, and started/completed/skipped timestamps. It stores no balances, rewards, tutorial inventory, or client-decided progress. Existing gameplay transactions advance it; system opponents receive only virtual skipped state.

`AdvisorTipProgress` stores one presentation-only row per `(playerId, tipKey)` with seen and audit timestamps. Missing rows never block gameplay, and the table has no relationship to economy, shield, Raid, Battle, or Revenge eligibility.

| Migration | Change |
| --- | --- |
| `20260823000000_initial_foundation` | Player, platform identity, Kingdom, resources, buildings, upgrades |
| `20260823030000_server_authoritative_economy` | Gold rename, Mine rename, economy ledger/requests, production remainder, active-upgrade index |
| `20260823040000_hero_system` | Hero content/ownership, Raid Team, starter seed/backfill |
| `20260823050000_core_pvp_raid` | Trophies, Match Offers, Battle, snapshots, events |
| `20260823060000_revenge_notifications` | Revenge battle type, targets, notifications, deep-link storage |
| `20260825070000_kingdom_progression` | Watchtower, Workshop, completed-upgrade collection action |
| `20260825070100_kingdom_building_backfill` | Idempotent four-building backfill for existing Kingdoms |
| `20260825070200_building_progression_constraints` | Building and upgrade level checks |
| `20260826090000_launch_safe_raid` | Rename system-opponent classification, add replenishment ledger reason and matchmaking index |
| `20260826100000_first_party_analytics` | Append-only canonical event storage, dedupe, cohort and acquisition indexes |
| `20260826110000_pre_bale_player_experience` | Persistent one-to-one onboarding state, steps, and lifecycle timestamps |
| `20260827090000_advisor_tip_progress` | Durable one-time Aren contextual-tip acknowledgements |
| `20260829080000_retention_02` | Mission assignments, Daily completion claims, Achievement claims, Daily Return claims, reward ledger/action enums, constraints, and indexes |
| `20260829090000_army_commander_foundation` | Troop ownership/training, Army Formation/slots, training ledger/action enums, constraints, and existing-player/system-opponent backfill |
| `20260829090100_army_commander_slot_cascade` | Cascade-safe Commander slots for Player/Hero cleanup and runtime repair |
| `20260829180000_army_battle_v2` | Versioned Army squad snapshots, squad-defeat events, and remaining-unit replay state |
| `20260830090000_match_offer_army_fingerprint` | Nullable SHA-256 attacker-Army fingerprint for secure Match Offer cutover; pre-migration offers remain readable but cannot start |

Do not infer the final schema from the first migration. Read `schema.prisma` and all later SQL migrations together.

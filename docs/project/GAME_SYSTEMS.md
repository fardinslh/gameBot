---
title: Trace the game system dependencies
navLabel: Game Systems
contentType: Conceptual
---

# Trace the game system dependencies

The current systems share authoritative building, Hero, resource, and battle state. A change to one formula can affect several response surfaces and transaction paths.

## Dependency map

```text
Castle level
  +-> building unlock rules
  +-> expansion stage
  +-> storage capacities
  +-> non-Castle upgrade requirements
  +-> advanced PvP metadata at level 7

All building levels
  +-> Kingdom XP and Kingdom Level
  +-> appearance variant

Academy level
  +-> production basis-point bonus
      +-> Collect preview
      +-> Collect settlement before storage caps

Workshop level
  +-> duration discount for newly started building upgrades

Blacksmith level
  +-> Hero Gold upgrade discount
      +-> displayed cost
      +-> affordability
      +-> charged amount and ledger

Watchtower level
  +-> Raid protection
      +-> Match Offer potential loot
      +-> Raid settlement
      +-> Revenge preview and settlement

Hero definitions + PlayerHero levels
  +-> derived HP, ATK, DEF, power
  +-> ordered Raid Team
      +-> Matchmaking power
      +-> immutable Battle snapshots
          +-> deterministic Battle engine
              +-> persisted events and winner

Resolved standard Raid
  +-> loot and Trophy settlement
  +-> defense inbox entry
  +-> PLAYER_RAIDED notification
  +-> RevengeTarget after attacker victory
      +-> REVENGE_AVAILABLE notification
      +-> one Revenge Battle using the same engine
```

## Authoritative write paths

`EconomyService` owns Collect, building upgrades, completion reconciliation, balances, storage calculations, and economy ledger rows. `HeroService` owns team persistence and Hero upgrade charges. `RaidService` owns Match Offers, battle settlement, loot transfer, Trophies, inbox data, and Revenge.

Each mutation validates ownership and server state. `EconomyRequest` stores replayable responses for economy, Hero upgrade, Raid start, and Revenge start actions that require an idempotency key.

## Presentation-only systems

The client maps server building types to Pixi visual IDs and maps Castle-derived `kingdomExpansionStage` to local terrain treatments. Appearance fallback, animation timing, camera movement, labels, and HUD formatting do not decide gameplay eligibility.

The Battle Pixi scene consumes stored snapshots and events. It schedules portrait movement, health changes, and effects but never re-simulates combat.

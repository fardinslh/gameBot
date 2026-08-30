---
title: Trace the game system dependencies
navLabel: Game Systems
contentType: Conceptual
---

# Trace the game system dependencies

The current systems share authoritative building, Hero, Army, resource, and battle state. A change to one formula can affect several response surfaces and transaction paths.

## Army and Commander foundation

The Army domain is the production Raid/Revenge combat input. Economy bootstrap creates missing starter troops and one formation after Hero bootstrap. `ArmyService` owns capacity, one training order, resource settlement, lazy completion, formation validation, Commander assignments, and authoritative battle snapshots under the Player advisory lock. Existing `PlayerHero` rows are referenced directly; `RaidTeam` remains only for rules-version-1 history compatibility.

Army Battle v2 keeps fixed Commander roles: Knight is tank/frontline sustain and shields its own squad; Ranger is single-target damage and Power Shot hits one enemy squad; Mage is area/burst and Arcane Blast hits all living enemy squads. Basic attacks prefer the same lane, then the nearest living enemy slot with a lower-slot tie break. The troop counter triangle is Infantry over Cavalry, Cavalry over Archer, and Archer over Infantry.

The PvE Campaign reuses Army Battle rules version 2 through a separate authoritative entry point. Broken Frontier contains nine configured stages with durable Campaign-only NPCs, Castle/prior-clear gates, persistent best stars, one-time first-clear rewards, and 9/18/27-star milestone claims. It creates no PvP loot, Trophy, Revenge, notification, shield, anti-farm, or permanent troop-casualty state.

```text
Castle level -> Army capacity
ResourceBalance -> training charge -> EconomyTransaction
PlayerTroop -> ready ownership
TroopTrainingOrder -> reserved capacity -> lazy completion
PlayerHero -> ArmyFormationSlot Commander
ArmyFormation -> three Army Battle v2 squads
```

`RaidService` consumes Army state for new rules-version-2 Raid and Revenge settlement. See [Army and Commanders](ARMY_AND_COMMANDERS.md).

## Dependency map

```text
Castle level
  +-> building unlock rules
  +-> expansion stage
  +-> storage capacities
  +-> non-Castle upgrade requirements
  +-> authoritative next real district goal through level 5

All building levels
  +-> Kingdom XP and Kingdom Level
  +-> appearance variant
  +-> derived active-building visual tier and minor step
      +-> current DEFAULT Kingdom Theme catalog (presentation only)

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

## Analytics signals

Collection, building upgrade start, Hero upgrade completion, Raid search/battle/result, Revenge battle/result, Campaign attempts/rewards, and first milestones emit server-owned analytics. Event writes share gameplay transactions where practical. Analytics is observational only.

Retention progress is a read model over those durable authoritative facts. Daily and Weekly assignments snapshot a deterministic server-selected definition for the UTC period; Achievement milestones backfill from history. Explicit claims reuse Player locks, balances, the economy ledger, and idempotent request storage. Retention never changes the underlying Collect, building, Hero, Raid, or Revenge outcome.

Onboarding advances inside successful authoritative Collect, building-upgrade, and standard-Raid transactions. The client may report `onboarding_started` and `onboarding_step_seen`; only the server emits `onboarding_completed`. Skipping and system-opponent identities do not create completion or activation events. Activation remains `first_raid_completed`. Kingdom goals are read-only server derivation: no client claim, reward, mission, or unlock write path exists.

## Presentation-only systems

The client maps server building types to Pixi visual IDs and maps Castle-derived `kingdomExpansionStage` to local terrain treatments. For all nine active buildings, authoritative level plus explicit presentation Theme deterministically selects a five-tier raster asset and minor detail set. `DEFAULT` is the only implemented theme; no appearance/theme column or client economy state exists. Theme, appearance fallback, construction cues, transformation timing, camera movement, labels, and HUD formatting do not decide gameplay eligibility or power.

Coach marks and the permanent Guide explain server behavior but never decide progress. Music context, Battle-event-to-SFX mapping, volume, and mute state are presentation-only and fail safely.

The Battle Pixi scene consumes stored snapshots and events. It schedules portrait movement, health changes, and effects but never re-simulates combat.

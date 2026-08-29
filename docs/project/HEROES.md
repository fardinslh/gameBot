---
title: Work with Heroes and Raid Team
navLabel: Heroes
contentType: Reference
---

# Work with Heroes and Raid Team

The Hero system stores content definitions separately from player ownership. The API derives stats, power, upgrade costs, and team power from server config.

Retention 03A also lets these same persistent `PlayerHero` rows serve as Commanders in `ArmyFormationSlot`. It creates no separate Commander ownership, renames no Hero tables, and imposes no permanent troop-class lock. Knight, Ranger, and Mage still form the current rules-version-1 `RaidTeam`; Commander assignments are parallel preparation for Army Battle v2.

## Current roster

`apps/game-api/src/heroes/hero.config.ts` defines three enabled starters:

| Hero | Class | Base HP | Base ATK | Base DEF | HP growth | ATK growth | DEF growth | Skill |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Knight | `TANK` | 1,500 | 110 | 170 | 1.11 | 1.07 | 1.10 | `SHIELD_WALL` |
| Ranger | `SINGLE_TARGET_DPS` | 1,050 | 170 | 90 | 1.08 | 1.11 | 1.07 | `POWER_SHOT` |
| Mage | `AOE_BURST` | 850 | 210 | 70 | 1.07 | 1.13 | 1.06 | `ARCANE_BLAST` |

All three use local 640 by 640 WebP portraits. These portraits are replaceable concept art.

## Stat and power formulas

For a stat with base value `B`, growth in basis points `G`, and Hero level `L`:

```text
stat = round(B * G^(L - 1) / 10000^(L - 1))
power = round((HP * 2 + ATK * 20 + DEF * 15) / 10)
```

The implementation uses integer exponentiation and half-up rounding. Hero maximum level is 20.

## Upgrade economy

The undiscounted Gold cost is:

```text
cost(L) = ceil(300 * 1.35^(L - 1))
```

Blacksmith removes one percent per level above 1, capped at 15 percent. The API uses the discounted value for display, affordability, conditional charge, response, and ledger entry.

Hero upgrade requires an 8 through 100 character idempotency key. The mutation runs under the player advisory lock, conditionally decrements Gold, records a `HERO_UPGRADE` transaction, increments level, and stores its response in `EconomyRequest`.

## Persistence model

- `HeroDefinition`: stable content key, class, base stats, growth, skill, portrait path, sort order, enabled state
- `PlayerHero`: one ownership/progression row for each player and definition
- `RaidTeam`: one persistent active team per player
- `RaidTeamSlot`: ordered slots 1 through 3 with uniqueness for slot and Hero

Migration `20260823040000_hero_system` seeds the definitions and backfills existing players. `ensureHeroSystemForPlayer` grants missing starters and repairs an incomplete starter team without duplicating rows.

## Raid Team rules

`PUT /heroes/team` accepts exactly three distinct `PlayerHero` IDs. Every Hero must belong to the caller and reference an enabled definition. The API deletes and recreates the three ordered slots in the same player transaction.

Battle start loads the current team, derives stats again, and stores immutable snapshots. Later Hero upgrades do not change an existing replay.

## Client architecture

`useHeroState` owns roster loading, a three-ID draft order, save state, errors, and upgrades. `HeroesPage` composes Player HUD, Resource HUD, `RaidTeamPanel`, `HeroCard`, and `HeroDetailSheet`. English and Persian share the component tree.

## Planned Hero concepts

The previous standalone Hero Expansion roadmap is superseded by [Army and Commander Expansion](ARMY_AND_COMMANDERS.md). Future Hero depth should strengthen Commander identity inside the Kingdom/Army loop rather than turn combat into a Hero-only collection RPG.

No additional Hero, equipment, crafting, rarity, recruitment, or XP-spending system exists. `PlayerHero.xp` persists and defaults to zero, but no current endpoint grants or consumes Hero XP.

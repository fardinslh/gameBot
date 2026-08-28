---
title: Understand Kingdom progression
navLabel: Progression
contentType: Reference
---

# Understand Kingdom progression

Building levels drive unlocks, production, storage, special effects, appearance metadata, and Kingdom XP. Castle remains the gameplay gate.

## Building levels

Each of the nine shared building types has a persistent level from 1 through 20. `BuildingUpgrade` records a one-level transition with start, completion, and status timestamps. Database constraints enforce both the range and `toLevel = fromLevel + 1`.

Only one `QUEUED` or `IN_PROGRESS` upgrade can exist for a building because migration `20260823030000_server_authoritative_economy` creates a partial unique index.

## Castle unlock rules

| Castle level | Unlock |
| ---: | --- |
| 1 | Castle, Farm, Lumber Mill, Mine, Grand Market |
| 2 | Watchtower |
| 3 | Academy |
| 4 | Workshop |
| 5 | Blacksmith |

`building-unlocks.config.ts` owns these rules. Internal configuration retains a reserved Castle-7 feature rule, but the public Kingdom response and goal UI expose only real building milestones. The API includes every persistent building in state and marks locked rows with `unlocked: false`. The Pixi scene mounts only unlocked rows.

## Kingdom Level and XP

`KingdomLevelService` calculates:

```text
xp = sum(max(0, building.level - 1) * 100)
kingdomLevel = min(20, 1 + floor(xp / 900))
xpIntoLevel = xp mod 900
```

At Kingdom Level 20, `xpIntoLevel` becomes `0` and `xpRequiredForNextLevel` becomes `null`. Castle level does not override Kingdom Level. `Kingdom.level` mirrors Castle during upgrade reconciliation for legacy/status compatibility, while API `kingdom.level` uses calculated progression.

## Appearance variants

| Building level | Variant |
| ---: | --- |
| 1 through 4 | `WOOD` |
| 5 through 9 | `STONE` |
| 10 through 20 | `FORTIFIED` |

The API retains these compatibility variants. Core-building presentation now derives from authoritative level plus the presentation-only `DEFAULT` Kingdom Theme: Early 1–4, Developed 5–8, Advanced 9–12, Fortified 13–16, and Prestige 17–20. Within each tier, levels map to minor steps 0–3 with cumulative visual details. Level 20 adds a capstone. No database appearance or theme state was added.

Academy, Blacksmith, Watchtower, and Workshop now use the same five-tier, four-minor-step, level-20-capstone resolver as the core five buildings. Compatibility `appearanceVariant` values remain in the API but do not select active DEFAULT raster art.

## Kingdom Progress goals

`KingdomProgressGoalsService` derives a presentation-safe, authoritative goals snapshot from persistent building levels. `GET /kingdom` returns Castle level, the four real district milestones, the next locked district or an all-current-districts-unlocked state, and current/next basis-point values for Watchtower, Academy, Workshop, and Blacksmith. The client cannot post progress, rewards, claims, or missions; none exist in Retention 01B.

## Special building effects

Each special effect gains `100` basis points, one percent, for each level above 1 and caps at `1,500` basis points, 15 percent.

### Academy production bonus

Academy increases Farm, Lumber Mill, Mine, and Grand Market production. The server applies the bonus with integer floor division before calculating elapsed production and storage caps.

### Blacksmith Hero discount

Blacksmith discounts Hero upgrade Gold. The server uses ceiling division so a discounted positive cost remains conservative and consistent across display and charge.

### Watchtower Raid protection

Base Raid protection is 70 percent of each defender resource balance. Watchtower adds its effect to that protected percentage, up to 85 percent total. Loot still respects per-resource reserve and cap rules.

### Workshop upgrade speed

Workshop discounts durations for building upgrades started after the effect exists. It does not recalculate `completesAt` for an upgrade already in progress.

## Visual expansion

`KingdomExpansionService` clamps Castle level into visual stages 1 through 5. The client uses that presentation stage only after checking authoritative building unlock state. [Kingdom](KINGDOM.md) records the environment, coordinates, and reveal behavior.

## Temporary balance status

Production rates, growth factors, costs, durations, capacity curves, XP thresholds, and effect caps are current working values. Treat them as temporary balance until a product balancing phase approves replacements. Keep formulas centralized when values change.

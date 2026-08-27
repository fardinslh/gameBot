---
title: Extend visible building evolution
navLabel: Building Evolution
contentType: Conceptual
---

# Extend visible building evolution

Retention 01A makes every successful core-building upgrade visibly change the Kingdom. Building level remains server-authoritative; the client derives presentation without a database appearance column.

## Five major tiers

| Tier | Levels | Major body starts at |
| --- | --- | ---: |
| Early | 1–4 | 1 |
| Developed | 5–8 | 5 |
| Advanced | 9–12 | 9 |
| Fortified | 13–16 | 13 |
| Prestige | 17–20 | 17 |

`getBuildingVisualState(buildingId, level)` clamps level to 1–20 and returns tier, minor step, local base asset, render width, detail IDs, and the level-20 capstone flag. Levels inside a tier use minor steps 0–3. Each later step cumulatively adds a deliberate local detail, so adjacent levels never resolve to the same visual configuration.

## Asset and rendering architecture

Core assets live under `public/assets/kingdom/evolution/<building>/tier-1.webp` through `tier-5.webp`. Production loads only the current base tier for each visible building. It does not preload all 25 files. Pixi adds small building-specific props and effects around the raster body; gameplay IDs and file names remain separate.

`building-visual-progression.ts` owns derivation. `building-art.ts` owns raster sizing, minor props, construction details, and transformation graphics. `create-kingdom-scene.ts` owns asynchronous texture replacement and short transition timing while preserving the existing container, selection, hit area, coordinate, and indicator anchors.

## Building rules

- **Castle**: modest stronghold to royal fortified center; strongest silhouette and a compact level-20 royal capstone.
- **Farm**: small farmhouse and wheat patch to prosperous agricultural estate.
- **Lumber Mill**: open cutting shed to refined royal woodworking complex.
- **Mine**: small rock opening to reinforced royal mining operation integrated into rock.
- **Grand Market**: small merchant house to wealthy royal trade center without casino-like gold overload.

Advanced buildings retain existing Stage 1 art until Retention 01B. Do not extend this system to them without that scoped task.

## Upgrade presentation

An active authoritative upgrade adds restrained scaffolding and material piles without obscuring the structure. Reconciled level increases use a 620 ms minor transformation or 980 ms major-tier transformation. `prefers-reduced-motion` applies the final state immediately. Selection and detail interaction survive because the stable Pixi container is not replaced.

## Development comparison tool

In development, open `/dev/buildings`. The Lab uses the production resolver and `building-art` renderer. It supports all five buildings, levels 1–20, quick levels 1/5/9/13/17/20, previous/next, construction state, adjacent N/N+1 comparison, and level 1 versus 20.

Use `npm run validate:building-evolution` for deterministic derivation and asset checks. Use `npm run capture:building-evolution` while API and development client are running to create Lab and mobile Kingdom screenshots under ignored `artifacts/building-evolution`.

---
title: Extend visible building evolution
navLabel: Building Evolution
contentType: Conceptual
---

# Extend visible building evolution

Retention 01A and 01B make every successful upgrade across all nine active buildings visibly change the Kingdom. Building level remains server-authoritative; the client derives presentation without a database appearance or theme column.

Building visual identity is now derived from:

```text
Building Type + Building Level + Kingdom Theme
```

`DEFAULT` is the only implemented Kingdom Theme. Planned historical IDs are documentation and future-domain intent, not selectable or complete themes.

## Five major tiers

| Tier | Levels | Major body starts at |
| --- | --- | ---: |
| Early | 1–4 | 1 |
| Developed | 5–8 | 5 |
| Advanced | 9–12 | 9 |
| Fortified | 13–16 | 13 |
| Prestige | 17–20 | 17 |

`getBuildingVisualState({ buildingId, level, theme })` clamps level to 1–20 and returns building ID, level, resolved theme, tier, tier number, minor step, local base asset, render width, detail IDs, and the level-20 capstone flag. `theme` defaults to `DEFAULT`. Levels inside a tier use minor steps 0–3. Each later step cumulatively adds a deliberate local detail, so adjacent levels never resolve to the same visual configuration.

## Asset and rendering architecture

Assets live under `public/assets/kingdom/evolution/default/<building>/tier-1.webp` through `tier-5.webp`. `BUILDING_VISUAL_CATALOG` maps Theme → Building → Tier asset/render metadata. Production loads only the current base tier for each visible building. It does not preload all 45 files. Pixi adds small building-specific props and effects around the raster body; gameplay IDs and file names remain separate.

Future complete Theme Packs may replace Castle, Farm, Lumber Mill, Mine, Grand Market, Academy, Blacksmith, Watchtower, and Workshop presentation. They may later include roads, banners, lamps, fences, ground details, and environmental accents. Adding a complete theme should register its theme domain value and catalog rather than rewrite `create-kingdom-scene.ts`. Minor props remain shared for `DEFAULT`; `BuildingVisualState.theme` is the extension point for future theme-specific props, capstones, widths, or offsets.

Theme is cosmetic only. It cannot change production, storage, building effects, Hero stats, Raid power, Battle rules, loot, Trophies, upgrade cost/duration, PvP strength, or resource generation.

`building-visual-progression.ts` owns derivation. `building-art.ts` owns raster sizing, minor props, construction details, and transformation graphics. `create-kingdom-scene.ts` owns asynchronous texture replacement and short transition timing while preserving the existing container, selection, hit area, coordinate, and semantic status anchors.

Building levels and compact upgrade/active indicators render together through a separate screen-space Pixi layer. Each building owns one semantic `statusStackAnchor`; the 20px indicator is always centered above the 42 by 22px level badge with a fixed 6px gap. The layer converts that shared anchor through building scale, world scale, and camera position, then snaps both elements to the renderer's device-pixel grid. This structural stack prevents overlap instead of repairing collisions after layout. Both elements follow pan, resize, tier changes, and unlock scale without intercepting taps or inheriting tiny world scale.

Raster quality is governed by effective opaque pixels, not canvas dimensions alone. `npm run audit:building-textures` measures all 45 DEFAULT files against production render width, layout scale, supported viewports, DPR 2, and 100/150/200% inspection. Never satisfy this gate through naive raster enlargement; use a genuine higher-detail source or inspected restoration, then encode the smallest WebP that survives real renderer review. Production continues to load only the current visible tier.

## Building rules

- **Castle**: modest stronghold to royal fortified center; strongest silhouette and a compact level-20 royal capstone.
- **Farm**: small farmhouse and wheat patch to prosperous agricultural estate.
- **Lumber Mill**: open cutting shed to refined royal woodworking complex.
- **Mine**: small rock opening to reinforced royal mining operation integrated into rock.
- **Grand Market**: small merchant house to wealthy royal trade center without casino-like gold overload.

- **Academy**: observatory and scholarly halls gain stronger masonry, instruments, blue-gold identity, and a restrained capstone glow.
- **Blacksmith**: forge halls, chimneys, anvils, armor racks, and controlled furnace light increase without becoming the Workshop.
- **Watchtower**: the defensive silhouette grows vertically through stronger stonework, lookout platforms, battlements, banners, and signal fire.
- **Workshop**: engineering bays, cranes, gears, workstations, and refined roofs expand without adopting forge identity.

## Upgrade presentation

An active authoritative upgrade adds restrained scaffolding and material piles without obscuring the structure. Reconciled level increases use a 620 ms minor transformation or 980 ms major-tier transformation. `prefers-reduced-motion` applies the final state immediately. Selection and detail interaction survive because the stable Pixi container is not replaced.

## Development comparison tool

In development, open `/dev/buildings`. The Lab displays `Theme DEFAULT` and uses the same theme-aware production resolver and `building-art` renderer. It supports all nine active buildings, levels 1–20, quick levels 1/5/9/13/17/20, previous/next, construction state, adjacent N/N+1 comparison, and level 1 versus 20. It does not offer fake historical selections.

The Lab also supports 100/150/200% fidelity inspection and renders Lv. 1/8/12/20 reference badges at 320px, 375px, and 390px viewport equivalents. Its exact-production status-overlay fixture exposes all nine active progression buildings and normal, can-upgrade, active-upgrade, and selected-plus-upgrade states using the production badge, indicator, and shared status-stack anchor. `data-status-overlap` must be `false`; `data-status-stack-aligned` must be `true` whenever an indicator is visible.

## Future historical art direction and distribution

Planned themes may draw from Achaemenid, Parthian, Sasanian, Seljuk, Ilkhanid, Timurid, Safavid, Zand, and Qajar architecture. They are **historically inspired**, not museum-grade archaeological reconstruction claims; fantasy progression tiers and production buildings require artistic interpretation.

Future distribution may include gameplay unlocks, direct cosmetic purchases, Season rewards, premium Season Pass rewards, or collection rewards. Not every theme must be paid. Theme ownership can never grant gameplay power. Selection, ownership, commerce, Seasons, and historical artwork belong to future Retention 05B or later work and are not implemented.

Use `npm run validate:building-evolution` for deterministic derivation and asset checks. Use `npm run capture:building-evolution` while API and development client are running to create Lab and mobile Kingdom screenshots under ignored `artifacts/building-evolution`.

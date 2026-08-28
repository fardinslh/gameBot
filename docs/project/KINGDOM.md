---
title: Work with the Kingdom world
navLabel: Kingdom
contentType: Reference
---

# Work with the Kingdom world

The Kingdom combines a PixiJS world with React controls. Server state decides which buildings exist and what each interaction can do.

## React and Pixi responsibilities

`apps/game-client/src/features/kingdom/components/kingdom-page.tsx` composes the page. `useKingdomState` fetches state, tracks the server clock offset, runs Collect and upgrade calls, and reconciles completed upgrades.

`KingdomScene` mounts `createKingdomScene` once and forwards building state changes. React owns Player HUD, Resource HUD, Collect, inbox access, bottom navigation, errors, and detail sheets. Pixi owns terrain, building sprites, selection, indicators, unlock reveals, z-order, hit areas, and vertical camera movement.

## World and camera

`KINGDOM_WORLD` in `building-layout.ts` uses:

- Width: `640`
- Height: `1536`
- Terrain source X offset: `-192`
- Active terrain: `/assets/kingdom/terrain/kingdom-base-v3.webp`
- Camera composition focus Y: `690`

The renderer scales the world to the host width. It calculates camera bounds from mounted buildings and the full world height. The upper bound keeps the top active building below Resource HUD, inbox, and Collect controls with 12 pixels of clearance. A pointer movement above 7 pixels changes the gesture from tap to pan.

Locked buildings never enter `buildingsLayer`, so they do not affect `getLocalBounds()`, camera bounds, z-order, hit areas, or pointer events.

## Active layout

| Building | Type | Ground X | Ground Y | Scale |
| --- | --- | ---: | ---: | ---: |
| Castle | `CASTLE` | 320 | 665 | 1.48 |
| Mine | `MINE` | 145 | 365 | 1.00 |
| Farm | `FARM` | 88 | 958 | 0.97 |
| Lumber Mill | `LUMBER_MILL` | 552 | 958 | 0.96 |
| Grand Market | `GRAND_MARKET` | 320 | 1172 | 1.03 |
| Watchtower | `WATCHTOWER` | 552 | 300 | 0.76 |
| Academy | `ACADEMY` | 410 | 420 | 0.84 |
| Workshop | `WORKSHOP` | 335 | 170 | 0.78 |
| Blacksmith | `BLACKSMITH` | 88 | 165 | 0.84 |

`KINGDOM_BUILDING_LAYOUT` remains the placement source. The Castle moved from Y `690` to `665` in the final pre-retention corrective pass so its mass sits closer to the visual center of the courtyard. The camera composition focus remains Y `690`, making the 25-world-pixel correction visible instead of cancelling it through recentering. `KINGDOM_EXPANSION_STAGES` supplies coordinates for Watchtower, Academy, Workshop, and Blacksmith.

## Expansion stages

| Stage | Castle level | Added building | Environment | Reveal |
| --- | ---: | --- | --- | ---: |
| 1 | 1 | Starting five only | Existing terrain | None |
| 2 | 2 | Watchtower | Defensive frontier | 900 ms |
| 3 | 3 | Academy | Scholarly terrace | 980 ms |
| 4 | 4 | Workshop | Engineering yard | 940 ms |
| 5 | 5 or higher | Blacksmith | Forge yard | 1,020 ms |

The API derives the stage from Castle level and returns it in `KingdomStateResponse`. The scene also requires the matching building to have `locked === false`, which prevents visual config from bypassing server unlock state.

During a live stage increase, the environment fades in while a local mist clears. The building starts after 24 percent of the configured duration and settles from 90 percent scale. Its pointer mode becomes active after the reveal. Reduced-motion mode displays the completed state without the animation.

## Building visuals

`building-visuals.ts` defines each sprite path, rendered dimensions, normalized ground anchor, visual offset, footprint, contact shadow, hit area, one semantic status-stack anchor, and lock anchor. `building-art.ts` converts those definitions into Pixi containers.

For all nine active buildings, `building-visual-progression.ts` resolves explicit `{ buildingId, level, theme }` requests through the centralized Theme → Building → Tier catalog. `DEFAULT` is the only implemented theme. Authoritative levels derive tiers 1–4 Early, 5–8 Developed, 9–12 Advanced, 13–16 Fortified, and 17–20 Prestige. Minor steps 0–3 add local building-specific details, and level 20 adds a compact capstone. No gameplay coordinate changes.

Production currently passes `DEFAULT` explicitly. Theme is presentation-only and has no database, ownership, selection, economy, effect, Hero, Raid, Battle, or PvP authority. Assets resolve under `/assets/kingdom/evolution/default/<building>/tier-X.webp`.

Legacy `appearanceVariantStage` remains available for unused/future art compatibility, but it no longer selects Academy, Blacksmith, Watchtower, or Workshop production bodies.

An active upgrade adds restrained scaffolding/materials. When a reconciled server level increases, Pixi keeps the stable building container and swaps only the required texture/details. Minor transitions last 620 ms; major boundaries 4→5, 8→9, 12→13, and 16→17 last 980 ms. Reduced-motion clients receive the final state immediately.

## Mine registration

The Mine source canvas measures 512 by 464 pixels. `MINE_GROUND_ANCHOR` pins source pixel `(280, 453)`, normalized to about `(0.547, 0.976)`, to world point `(145, 365)` at scale `1`. The calibrated front rail contact avoids anchoring to the final transparent-bound rail-tip pixels.

Do not replace this anchor with a generic bottom-center anchor. Move the Mine through `building-layout.ts` unless new art changes its source registration.

## Interaction and indicators

Each mounted building receives an elliptical hit area larger than its opaque pixels. A tap selects the gameplay ID and opens `BuildingDetailSheet`. The sheet reads server production, costs, unlock requirements, timer, appearance, and effects. Castle detail also opens `KingdomProgressSheet`, which reads the authoritative `kingdomGoals` snapshot: Kingdom XP, real Castle-2-through-5 district milestones, next unlock or all-current-districts-unlocked state, and current/next advanced effects.

Pixi renders a compact green upgrade arrow, a gold active-timer symbol, a `Lv.N` badge, and a pulsing selection ellipse. React also renders an accessible off-screen button for each unlocked building. Locked server buildings create none of these targets.

## Visual constraints

- Keep Castle as the largest and most prominent structure
- Preserve useful terrain and negative space around Castle
- Keep major gameplay buildings out of the base terrain image
- Match current pseudo-isometric perspective, warm light, cool shadow, material scale, and grounding
- Use building-specific irregular terrain treatment rather than generic circular pads
- Avoid future locked silhouettes, giant padlocks, terrain cards, and debug masks in the normal scene
- Keep building coordinates independent from Persian right-to-left and English left-to-right UI direction

## Future-only client definitions

`FUTURE_BUILDING_LAYOUT` and local assets include Barracks, Granary, Tavern, and Stable. The active scene does not iterate that layout, render those sprites, or expose their selection targets. Their coordinates are placeholders, not active world commitments.

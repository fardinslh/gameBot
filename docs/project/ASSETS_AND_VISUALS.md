---
title: Manage assets and Kingdom visuals
navLabel: Assets and Visuals
contentType: Reference
---

# Manage assets and Kingdom visuals

The client loads local WebP art. Runtime mappings separate gameplay IDs, placement, source registration, and file names so art can change without altering economy state.

## Active Kingdom assets

| Asset | Role | Approximate size |
| --- | --- | ---: |
| `terrain/kingdom-base-v3.webp` | Active 1024 by 1536 building-free environment | 460 KB |
| `castle-production-v1.webp` | Active separate Castle sprite | 90 KB |
| `buildings/farm-stage-1.webp` | Farm sprite | 70 KB |
| `buildings/lumber-mill-stage-1.webp` | Lumber Mill sprite | 60 KB |
| `buildings/mine-stage-1.webp` | Mine sprite | 76 KB |
| `buildings/grand-market-stage-1.webp` | Grand Market sprite | 63 KB |
| `buildings/academy-stage-1.webp` | Academy sprite | 71 KB |
| `buildings/blacksmith-stage-1.webp` | Blacksmith sprite | 65 KB |
| `buildings/watchtower-stage-1.webp` | Watchtower sprite | 57 KB |
| `buildings/workshop-stage-1.webp` | Workshop sprite | 65 KB |

`kingdom-base-v2.webp`, `kingdom-expansion-v1.webp`, and `kingdom-terrain-v1.webp` remain comparison or rollback files. The active renderer does not load them.

## Hero portraits

`public/assets/heroes` contains Knight, Ranger, and Mage portraits. `hero.config.ts` supplies their public paths. The Raid and Hero clients reuse the same files.

## Visual mapping layers

- `building-layout.ts`: gameplay building to world coordinate and scale
- `kingdom-expansion-stages.ts`: Stage 2 through 5 placement and environment presentation
- `building-visuals.ts`: texture stages, dimensions, ground anchors, offsets, footprint, shadow, hit area, and indicator anchors
- `building-art.ts`: Pixi sprite container construction
- `expansion-area-art.ts`: local irregular defensive, scholarly, engineering, and forge treatments
- `create-kingdom-scene.ts`: asset loading, active-only mounting, camera, reveal, interaction, and effects

File names do not decide gameplay. Shared building type and server state select a visual ID, then the mapping resolves its texture.

## Base terrain rule

Keep major gameplay structures out of the terrain image. The current base contains paths, vegetation, rock, river, bridge, Castle courtyard, and irregular work-ground cues. Separate sprites preserve selection, unlocks, level variants, z-order, and future replacement.

Do not solve building placement with rectangular backgrounds, generic circular pads, giant ground decals, or baked labels.

## Appearance stage fallback

The loader supports `*-stage-1.webp`, `*-stage-2.webp`, and `*-stage-3.webp`. Current files cover stage 1 only. `STONE` and `FORTIFIED` variants use stage 1 fallback until approved artwork exists.

## Mine source registration

The Mine source reaches the canvas edges and cannot rely on transparent padding. `MINE_GROUND_ANCHOR` uses source pixel `(280, 453)` on a 512 by 464 image. Pixi pins it to `(145, 365)` at scale `1` with zero visual offset.

## Future assets

Barracks, Granary, Tavern, and Stable Stage 1 assets exist locally. They have visual definitions and future layout entries but no active server building contract or Pixi mount path. Treat them as unused art inventory.

## Audio assets

All shipping audio is local under `apps/game-client/public/assets/audio`. Two music tracks and 22 short effects were created for this repository by the deterministic generator in `scripts/generate-audio-assets.mjs`; they contain no sampled third-party recordings or melodies. See [audio](AUDIO.md) for size, provenance, and replacement rules.

## Validation and debug views

`npm run validate:visual` checks active Stage 1 count, pan, interaction, mobile layout, console errors, and terrain/Castle budgets of 700 KB and 150 KB. `npm run validate:progression` checks active-only stage mounting and locked asset exclusion.

Query-only debug options include `?debugBuildingLayout=1`, `?debugKingdomLayers=terrain`, and `?debugKingdomLayers=castle`.

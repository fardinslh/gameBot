---
title: Manage assets and Kingdom visuals
navLabel: Assets and Visuals
contentType: Reference
---

# Manage assets and Kingdom visuals

The client loads local WebP art. Runtime mappings separate gameplay IDs, placement, source registration, and file names so art can change without altering economy state.

## Active Kingdom assets

Core-building production now uses 25 files under `kingdom/evolution`: five optimized local WebPs each for Castle, Farm, Lumber Mill, Mine, and Grand Market. Individual files are about 42–92 KB; total core evolution art is about 1.76 MiB. The old core files are retained as rollback/reference inputs and as Developed-tier files, but production resolution uses the evolution paths.

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
- `building-visual-progression.ts`: authoritative-level-to-tier/minor-detail derivation for the five 01A buildings
- `expansion-area-art.ts`: local irregular defensive, scholarly, engineering, and forge treatments
- `create-kingdom-scene.ts`: asset loading, active-only mounting, camera, reveal, interaction, and effects

File names do not decide gameplay. Shared building type and server state select a visual ID, then the mapping resolves its texture.

## Base terrain rule

Keep major gameplay structures out of the terrain image. The current base contains paths, vegetation, rock, river, bridge, Castle courtyard, and irregular work-ground cues. Separate sprites preserve selection, unlocks, level variants, z-order, and future replacement.

Do not solve building placement with rectangular backgrounds, generic circular pads, giant ground decals, or baked labels.

## Appearance stage fallback

Core buildings no longer use this fallback: they have five real raster tiers. Academy, Blacksmith, Watchtower, and Workshop still use Stage 1 fallback until Retention 01B.

## Mine source registration

The Mine source reaches the canvas edges and cannot rely on transparent padding. `MINE_GROUND_ANCHOR` uses source pixel `(280, 453)` on a 512 by 464 image. Pixi pins it to `(145, 365)` at scale `1` with zero visual offset.

## Future assets

Barracks, Granary, Tavern, and Stable Stage 1 assets exist locally. They have visual definitions and future layout entries but no active server building contract or Pixi mount path. Treat them as unused art inventory.

## Audio assets

All audio remains local under `apps/game-client/public/assets/audio`. All 24 explicit owner selections are stored under `assets/audio/approved` and mapped into gameplay. The rejected procedural catalog and unselected candidate files remain audit-only. See [audio](AUDIO.md) for the mapping and [audio audition](AUDIO_AUDITION.md) for the completed approval record.

## Validation and debug views

`npm run validate:building-evolution` tests every level for all five core buildings and inspects all 25 WebPs. `/dev/buildings` is development-only and renders the exact production visual state for single, adjacent, and level 1 versus 20 review. `npm run capture:building-evolution` captures the required Lab and mobile Kingdom artifacts.

`npm run validate:visual` continues to check pan, interaction, mobile layout, console errors, and terrain budgets. `npm run validate:progression` checks active-only expansion mounting and locked asset exclusion.

Query-only debug options include `?debugBuildingLayout=1`, `?debugKingdomLayers=terrain`, and `?debugKingdomLayers=castle`.

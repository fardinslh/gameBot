---
title: Manage assets and Kingdom visuals
navLabel: Assets and Visuals
contentType: Reference
---

# Manage assets and Kingdom visuals

The client loads local WebP art. Runtime mappings separate gameplay IDs, placement, source registration, and file names so art can change without altering economy state.

## Active Kingdom assets

Active-building production now uses 45 files under `kingdom/evolution/default`: five optimized local WebPs for each of the nine active buildings. Files are about 50–240 KiB and total about 5.27 MiB. Advanced tier candidates are 368–720px transparent cutouts and about 60–177 KiB each. Production uses theme-namespaced paths and loads only the current visible tier; locked advanced tiers do not preload.

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

`public/assets/heroes/world` contains three transparent full-body Kingdom figures (`knight-world-v1.webp`, `ranger-world-v1.webp`, and `mage-world-v1.webp`). These are presentation-only Pixi/standard-Raid journey assets selected by `hero-world-assets.ts`; portrait assets remain unchanged for roster, match, and Battle UI.

## Visual mapping layers

- `building-layout.ts`: gameplay building to world coordinate and scale
- `kingdom-expansion-stages.ts`: Stage 2 through 5 placement and environment presentation
- `building-visuals.ts`: texture stages, dimensions, ground anchors, offsets, footprint, shadow, hit area, and one semantic status-stack anchor per building
- `building-art.ts`: Pixi sprite container construction
- `kingdom-theme.ts`: implemented `DEFAULT` identity and separately listed planned theme IDs
- `building-visual-progression.ts`: Theme → Building → Tier catalog plus authoritative-level-to-tier/minor-detail derivation for all nine active buildings
- `expansion-area-art.ts`: local irregular defensive, scholarly, engineering, and forge treatments
- `create-kingdom-scene.ts`: asset loading, active-only mounting, camera, reveal, interaction, and effects
- `building-status-badge.ts`: constant-size screen-space level/upgrade presentation, device-pixel-snapped world-anchor conversion, and a structurally aligned indicator-above-badge stack

File names do not decide gameplay. Shared building type and server state select a visual ID, then the mapping resolves its texture.

Current path shape is `evolution/default/<building>/tier-X.webp`. Future complete catalogs may add another theme namespace, but no historical catalog, selection, ownership, or UI exists. Theme-specific base art and metadata can be registered centrally; `BuildingVisualState.theme` leaves a bounded extension point for future minor props and capstones without coupling Pixi scene orchestration to a theme.

## Base terrain rule

Keep major gameplay structures out of the terrain image. The current base contains paths, vegetation, rock, river, bridge, Castle courtyard, and irregular work-ground cues. Separate sprites preserve selection, unlocks, level variants, z-order, and future replacement.

Do not solve building placement with rectangular backgrounds, generic circular pads, giant ground decals, or baked labels.

## Appearance compatibility

All nine active buildings use five real raster tiers. The API still returns `WOOD`, `STONE`, and `FORTIFIED` compatibility variants for older consumers, but the DEFAULT renderer selects art from authoritative level and the tier catalog.

## Mine source registration

The Mine source reaches the canvas edges and cannot rely on transparent padding. `MINE_GROUND_ANCHOR` uses source pixel `(280, 453)` on a 512 by 464 image. Pixi pins it to `(145, 365)` at scale `1` with zero visual offset.

## Future assets

Barracks, Granary, Tavern, and Stable Stage 1 assets exist locally. They have visual definitions and future layout entries but no active server building contract or Pixi mount path. Treat them as unused art inventory.

## Audio assets

All audio remains local under `apps/game-client/public/assets/audio`. All 24 explicit owner selections are stored under `assets/audio/approved` and mapped into gameplay. The rejected procedural catalog and unselected candidate files remain audit-only. See [audio](AUDIO.md) for the mapping and [audio audition](AUDIO_AUDITION.md) for the completed approval record.

## Validation and debug views

`npm run validate:building-evolution` tests every level for all nine active buildings under `DEFAULT`, rejects legacy non-theme paths, and inspects all 45 namespaced WebPs. `/dev/buildings` is development-only and renders the exact theme-aware production visual state for single, adjacent, and level 1 versus 20 review. `npm run capture:building-evolution` captures the required Lab and mobile Kingdom artifacts.

`npm run audit:building-textures` uses Sharp to report dimensions, bytes, alpha, effective opaque bounds, production display size, and DPR-2 ratios at 100/150/200%. Never improve quality by resizing a low-detail raster upward. Use a genuine higher-detail source or inspected restoration, compare WebP settings in the real renderer, keep each tier below 250 KiB, and preserve current-stage lazy loading.

Installed Pixi 8.20 defaults these textures to linear minification/magnification, not nearest-neighbor. Automatic mipmaps remain disabled: real mobile captures showed no useful gain for the current render sizes, while mip chains would increase GPU memory. The renderer keeps its DPR cap of 2.

`npm run validate:visual` continues to check pan, interaction, mobile layout, console errors, and terrain budgets. `npm run validate:progression` checks active-only expansion mounting and locked asset exclusion.

Query-only debug options include `?debugBuildingLayout=1`, `?debugKingdomLayers=terrain`, and `?debugKingdomLayers=castle`.

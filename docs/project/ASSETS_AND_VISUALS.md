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
| `terrain/kingdom-base-v5.webp` | Active 2048 by 3072 building-free environment | 90 KB |
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

Production Kingdom and standard-Raid journey rendering uses the two-frame-per-Hero rows in `kingdom/characters/heroes/hero-atlas-v2.webp`; portrait assets remain unchanged for roster, match, and Battle UI. The older standalone `public/assets/heroes/world/*-v1.webp` files remain historical comparison assets and are not loaded by production.

`public/assets/kingdom/characters/ambient` contains a five-row people atlas for guards, workers, merchants, scholars, and builders, plus compact goat and cart strips. These replace the former procedural humanoids and journey cart with grounded transparent sprites while preserving the existing actor budget and lightweight deterministic animation.

## Character atlas metadata

All sheets use a regular transparent grid and are sliced by `sprite-atlas.ts`. Runtime animation uses manually driven Pixi `AnimatedSprite` instances so the Kingdom scene retains control of hidden-page pause and reduced motion.

| Sheet | Canvas | Frame layout | Production animations |
| --- | ---: | --- | --- |
| `characters/heroes/hero-atlas-v2.webp` | 320x660 | 2 columns x 3 rows; 160x220 frame; Knight, Ranger, Mage rows | Knight `idle` 2 fps and `walk` 4 fps; Ranger `idle` 2 fps and `walk` 5 fps; Mage `magic-idle` 4 fps |
| `characters/ambient/people-atlas-v1.webp` | 192x600 | 2 columns x 5 rows; 96x120 frame; Guard, Worker, Merchant, Scholar, Builder rows | Guard `idle` 2 fps; other people `walk` 4 fps |
| `characters/ambient/goat-strip-v1.webp` | 256x96 | 2 columns x 1 row; 128x96 frame | `walk` 3 fps |
| `characters/ambient/cart-strip-v1.webp` | 320x112 | 2 columns x 1 row; 160x112 frame | `walk` 2 fps |

All animations loop. Reduced motion displays frame zero without advancing. Encoded WebP bounds can report one pixel less where the final transparent edge is trimmed; the table records the authored logical grid.

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
- `sprite-atlas.ts`: bounded Pixi texture slicing for lightweight Hero and ambient-character animation
- `character-animation.ts`: named FPS/loop metadata application and scene-driven Pixi `AnimatedSprite` advancement

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

## Zoom and source-resolution budget

`npm run audit:kingdom-render-quality -- --output=artifacts/zoom-quality/world-assets.json` measures source pixels per physical renderer pixel at 320/375/390 widths, DPR 2, and 100/125/150/200% inspection. `npm run validate:kingdom-render-quality` records CSS canvas, logical renderer, physical framebuffer, effective resolution, and browser DPR at DPR-equivalent 1/1.25/1.5/2/3 scenarios plus live viewport resizing.

The current tier-5 buildings remain above one source pixel per physical pixel even at the strict 390px/DPR2/200% inspection budget: Mine is the narrowest margin at about 1.02, while Castle is about 1.27. Character atlas frames are also numerically above one at that display size, but their painted detail and two-frame motion remain below the owner quality bar; pixel count alone does not approve art.

Terrain uses the genuinely authored clean canvas master (`kingdom-base-v5.webp`, 90 KB, 2048x3072). It reaches 1.64 source pixels per physical pixel at 390px/DPR2/100% (up from 0.82) and 0.82 at 200% inspection (up from 0.41), eliminating raster starvation with low-frequency organic ground and crisp authored edges. Naive enlargement remains prohibited; all master art must maintain rich surface texture.

No sharpening/color-grade filter is retained. The observed failure includes magnification beyond source detail, which a post-process cannot recover, and a full-screen filter adds bandwidth/render-target cost. A/B would therefore compare altered edges rather than restored detail. Automatic mipmaps also remain disabled because they address minification, while the reported defect is magnification; enable them only if a future measured zoom-out shimmer case demonstrates a benefit.

A completed technical spike evaluated camera/renderer-level world-scale compensation across 3 viewports, 4 zoom levels (100%, 125%, 150%, 200%), and 2 locales (48 real-game A/B captures) to determine if zoom degradation could be reduced without replacement art. The compensation prototype was rejected and fully reverted: counter-scaling shrinks Kingdom content when the user zooms in (counter-intuitive UX) and cannot solve raster starvation. At 390px/DPR2, terrain (`kingdom-base-v3.webp`, 1024x1536) drops from ~0.82 source px per physical px at 100% to 0.66 at 125%, 0.55 at 150%, and 0.41 at 200% inspection, remaining sub-1.0 (~0.53) even under compensation. Tier-5 buildings remain >= 1.02 source px per physical px at 200% (Mine 1.02, Castle 1.27, Grand Market 1.92), and character atlas frames are >= 1.13 at 200% where weakness is authored 2-frame art depth rather than raster starvation. The verdict is that degradation is fundamentally source-bound: recovering zoom quality requires genuine higher-detail source art (~2048x3072 terrain master; Knight/Castle Guard animation masters per the character benchmark brief), not renderer tricks.

## Character quality benchmark gate

Knight and Castle Guard are the only approved next art-production targets. The repository currently has no layered or genuinely higher-detail animation source for either character, so the rejected two-frame sheets must not be distorted or upscaled into fake 4–6 frame animations. The required external/source-art deliverable is:

- Knight: at least four distinct idle and four to six distinct walk frames, authored at no less than 192x264 per frame, consistent warm upper-left light, cool ground shadow, armor/sword/shield silhouette, and current pseudo-isometric footing.
- Castle Guard: at least four distinct idle/patrol and four to six distinct walk frames, authored at no less than 128x160 per frame, spear/shield silhouette, matching palette/light, and grounded contact.
- Both: transparent lossless masters retained outside runtime WebP, identical registration point per frame, no duplicated poses under different animation names, and in-Kingdom approval at 320x568, 375x812, and 390x844 before replacing Ranger, Mage, or other ambient families.

`npm run validate:visual` continues to check pan, interaction, mobile layout, console errors, and terrain budgets. `npm run validate:progression` checks active-only expansion mounting and locked asset exclusion.

Query-only debug options include `?debugBuildingLayout=1`, `?debugKingdomLayers=terrain`, and `?debugKingdomLayers=castle`.

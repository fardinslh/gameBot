# Completed building tier artwork

All eight non-mine buildings use five distinct architectural sprites at levels
1, 5, 9, 13 and 17: Castle, Farm, Lumber Mill, Grand Market, Academy, Blacksmith,
Watchtower and Workshop. This adds 32 upgrade sprites to eight polished base
sprites. Mine artwork and placement remain unchanged.

Minor-level details, construction effects, selection/hit areas and the level-20
capstone remain active. Generic tier ornaments are replaced by architecture.
Polished status badges follow sprite height.

## Saved assets and prompts

- Source: `<building>/tier-2.png` through `<building>/tier-5.png` here.
- Base source: `../<building>.png`.
- Runtime: `apps/game-client/public/assets/kingdom/buildings/polished-v2/`,
  with `<building>.webp` for tier 1 and `<building>/tier-N.webp` for tiers 2–5.
- `prompts.json`: initial architectural briefs for all 32 upgrades.
- Per-building `tier-N.prompt.txt`: refined generation instructions where saved.
- `review/<buildingId>-tiers.png`: final production-renderer comparisons.
- `*-draft.png`: retained earlier candidates, not runtime assets.

Generated and edited with the built-in image-generation tool using polished base
sprites and preceding tiers as references. These are raster sprites, not Blender
meshes. Exports preserve genuine alpha and normalize to 512 × 512 WebP with a
consistent south anchor and 16-pixel margin.

Background cleanup preserved architecture, colors, camera, proportions and the
complete silhouette while removing painted checkerboards. Successful final
Workshop cleanup prompt:

> Use transparent background output mode. The input has a baked checkerboard;
> remove it. Need actual PNG alpha channel, not a visualization of transparency.
> Extract just the workshop building as a sticker with alpha 0 outside silhouette
> and between crane pieces. Keep exact architecture and colors. Please enable
> transparency in the generated file.

## Verification

Completed September 8, 2026:

- `npm run test:building-evolution --workspace @crown-and-coin/game-client`: 64 passed.
- `npm run test:kingdom-soul --workspace @crown-and-coin/game-client`: 32 passed.
- `npm run typecheck --workspace @crown-and-coin/game-client`: passed.
- `node scripts/validate-building-evolution.mjs`: 40 polished sprites and 45
  legacy assets passed; transparency, dimensions, size and five distinct decoded
  sprites per polished building checked.
- `node scripts/capture-building-tiers.mjs --require-distinct-assets`: all eight
  comparisons captured and visually reviewed; five distinct loaded paths each.

The lab at `/dev/buildings` includes **All tiers**. Capture is read-only and
requires no backend/player mutation. Regenerate normalized exports with
`node scripts/export-polished-buildings.mjs --tiers`; optionally select one set
with `--building=workshop` (folder names use kebab case).

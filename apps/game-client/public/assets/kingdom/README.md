# Kingdom local assets

The Kingdom uses local generated WebP artwork. `terrain/kingdom-base-v3.webp` is the
active 1024x1536 building-free environment with natural Farm, Lumber, Mine, and Market
work-yard footprints. `terrain/kingdom-base-v2.webp` retains the approved clean-map
baseline, and `kingdom-expansion-v1.webp` retains the previous baked-building terrain
for comparison and rollback. The Castle remains
independent in `castle-production-v1.webp`, while `buildings/` contains replaceable
Stage 1 building sprites. No remote asset URLs are used.

The active base map contains terrain, roads, a walled courtyard, an irregular farmyard,
a timber work yard, an excavated rocky Mine approach, a worn Market crossroads, river,
and bridge only. Major structures are never merged into the terrain texture, so Pixi
can position and interact with every gameplay building independently.

Runtime placement is independent from the image files:

- `building-visuals.ts` owns sprite anchors, footprints, shadows, hit areas, and badges.
- `building-layout.ts` positions all nine progression structures. The scene mounts only
  the structures unlocked by the current Castle level and preserves open space around the Castle.
- `create-kingdom-scene.ts` preloads the textures and keeps gameplay IDs separate from
  asset names.

Development capture helpers are query-only and do not affect the normal game:

- `?debugBuildingLayout=1` shows anchors, footprints, hit areas, and bounds.
- `?debugKingdomLayers=terrain` shows the clean terrain by itself.
- `?debugKingdomLayers=castle` shows the terrain plus the separate Castle.

`scripts/composite-kingdom-footprints.mjs` builds a versioned terrain asset from a
full-size edited source through soft, irregular masks. Only the Mine excavation and
lower work-yard regions are composited; the approved Castle area and outer environment
remain sourced from the clean baseline.

The Stage 1 Mine source is 512x464 and its non-transparent pixels reach every canvas
edge, so transparent padding is not used for registration. Its stable front rail contact
is source pixel `(280, 453)`, normalized to ground anchor `(0.547, 0.976)`. Pixi pins
that anchor to world target `(145, 365)` at scale `1`, with zero visual offset. The
Mine-specific shadow is intentionally faint because the raster already carries strong
grounding detail.

Watchtower, Academy, Workshop, and Blacksmith are progression assets that load only after
their Castle-level gates open. Barracks, Granary, Tavern, and Stable remain unused future
assets and are not part of the server building roster.

Future art progression can add `*-stage-2.webp` and `*-stage-3.webp` entries without
changing economy state or building interaction code.

# Kingdom local assets

The Kingdom uses local generated WebP artwork. `terrain/kingdom-base-v2.webp` is the
active 1024x1536 building-free environment. `kingdom-expansion-v1.webp` is retained as
the previous baked-building terrain for comparison and rollback. The Castle remains
independent in `castle-production-v1.webp`, while `buildings/` contains replaceable
Stage 1 building sprites. No remote asset URLs are used.

The active base map contains terrain, roads, a walled courtyard, fields, forest-edge
timber context, rock, river, and bridge only. Major structures are never merged into
the terrain texture, so Pixi can position and interact with every gameplay building
independently.

Runtime placement is independent from the image files:

- `building-visuals.ts` owns sprite anchors, footprints, shadows, hit areas, and badges.
- `building-layout.ts` positions the five currently active structures with deliberate
  open space around the Castle.
- `create-kingdom-scene.ts` preloads the textures and keeps gameplay IDs separate from
  asset names.

Development capture helpers are query-only and do not affect the normal game:

- `?debugBuildingLayout=1` shows anchors, footprints, hit areas, and bounds.
- `?debugKingdomLayers=terrain` shows the clean terrain by itself.
- `?debugKingdomLayers=castle` shows the terrain plus the separate Castle.

Future building definitions and local assets remain available for later progression,
but they are intentionally not loaded or rendered in the current Kingdom composition.

Future art progression can add `*-stage-2.webp` and `*-stage-3.webp` entries without
changing economy state or building interaction code.

# Kingdom local assets

The Kingdom uses local generated WebP artwork. `kingdom-expansion-v1.webp` is the active
terrain, `castle-production-v1.webp` is the Castle landmark, and `buildings/` contains
the replaceable Stage 1 building sprites. No remote asset URLs are used.

Runtime placement is independent from the image files:

- `building-visuals.ts` owns sprite anchors, footprints, shadows, hit areas, and badges.
- `building-layout.ts` positions the five currently active structures with deliberate
  open space around the Castle.
- `create-kingdom-scene.ts` preloads the textures and keeps gameplay IDs separate from
  asset names.

Future building definitions and local assets remain available for later progression,
but they are intentionally not loaded or rendered in the current Kingdom composition.

Future art progression can add `*-stage-2.webp` and `*-stage-3.webp` entries without
changing economy state or building interaction code.

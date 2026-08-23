# Kingdom temporary assets

`kingdom-terrain-v1.webp` is a temporary generated Phase 02 environment texture. It contains terrain only so the PixiJS building and interaction layer can be replaced independently.

- Source size: 1024 × 1536
- Runtime format: WebP, approximately 382 KB
- Intended replacement: an optimized atlas or layered environment produced by the final game-art pipeline
- No remote asset URLs are used

The five current buildings are lightweight PixiJS `Graphics` artwork in `src/features/kingdom/rendering/building-art.ts`. Their layout and hit areas are data-driven, so future sprites can replace the artwork without changing React UI or mock/domain data.

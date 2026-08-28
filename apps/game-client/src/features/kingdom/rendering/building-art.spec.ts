import { describe, expect, it } from 'vitest';
import { Texture } from 'pixi.js';
import { applyBuildingVisualState, createBuildingArtwork } from './building-art';
import { getBuildingVisualState } from './building-visual-progression';
import { BUILDING_VISUALS } from './building-visuals';

describe('building evolution artwork', () => {
  it('loads the production base stage and minor details', () => {
    const level = getBuildingVisualState({ buildingId: 'farm', level: 3 });
    const artwork = createBuildingArtwork('farm', Texture.WHITE, false, level, false);
    expect(level.asset).toBe('/assets/kingdom/evolution/default/farm/tier-1.webp');
    expect(artwork.sprite.width).toBe(level.renderWidth);
    expect(artwork.evolutionDetails.children).toHaveLength(1);
    expect(artwork.construction.children).toHaveLength(0);
    artwork.container.destroy({ children: true });
  });

  it('shows a restrained construction layer for an active upgrade', () => {
    const level = getBuildingVisualState({ buildingId: 'mine', level: 8 });
    const artwork = createBuildingArtwork('mine', Texture.WHITE, false, level, true);
    expect(artwork.construction.children).toHaveLength(1);
    expect(artwork.sprite.visible).toBe(true);
    artwork.container.destroy({ children: true });
  });

  it('keeps selection and interaction containers stable across visual changes', () => {
    const initial = getBuildingVisualState({ buildingId: 'grandMarket', level: 8 });
    const next = getBuildingVisualState({ buildingId: 'grandMarket', level: 9 });
    const artwork = createBuildingArtwork('grandMarket', Texture.WHITE, false, initial, false);
    const container = artwork.container;
    const selection = artwork.selection;
    selection.visible = true;
    applyBuildingVisualState(artwork, 'grandMarket', next, false);
    expect(artwork.container).toBe(container);
    expect(artwork.selection).toBe(selection);
    expect(artwork.selection.visible).toBe(true);
    expect(artwork.sprite.width).toBe(next.renderWidth);
    expect(artwork.container.hitArea).toBeTruthy();
    artwork.container.destroy({ children: true });
  });

  it('preserves intentional hit areas and indicator anchors at low and high stages', () => {
    for (const buildingId of ['castle', 'farm', 'lumberMill', 'mine', 'grandMarket'] as const) {
      expect(BUILDING_VISUALS[buildingId].hitArea.width).toBeGreaterThan(100);
      expect(BUILDING_VISUALS[buildingId].hitArea.height).toBeGreaterThan(100);
      expect(Number.isFinite(BUILDING_VISUALS[buildingId].upgradeIndicatorAnchor.x)).toBe(true);
      expect(Number.isFinite(BUILDING_VISUALS[buildingId].levelBadgeAnchor.x)).toBe(true);
      expect(getBuildingVisualState({ buildingId, level: 1 }).asset)
        .not.toBe(getBuildingVisualState({ buildingId, level: 20 }).asset);
    }
  });
});

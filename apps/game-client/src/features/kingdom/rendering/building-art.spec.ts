import { describe, expect, it } from 'vitest';
import { Texture } from 'pixi.js';
import { applyBuildingVisualState, createBuildingArtwork } from './building-art';
import { getBuildingVisualState } from './building-visual-progression';
import { BUILDING_VISUALS, resolveBuildingStatusAnchor } from './building-visuals';

describe('building evolution artwork', () => {
  it('lifts polished badges with tier height while preserving the mine anchor', () => {
    expect(resolveBuildingStatusAnchor('castle', 224).y)
      .toBeLessThan(resolveBuildingStatusAnchor('castle', 158).y);
    expect(resolveBuildingStatusAnchor('farm', 198)).toEqual({ x: 0, y: -198 * .91 - 14 });
    expect(resolveBuildingStatusAnchor('mine', 206)).toEqual(BUILDING_VISUALS.mine.statusStackAnchor);
  });
  it('loads the production base stage and minor details', () => {
    const level = getBuildingVisualState({ buildingId: 'farm', level: 3 });
    const artwork = createBuildingArtwork('farm', Texture.WHITE, false, level, false);
    expect(level.asset).toBe('/assets/kingdom/buildings/polished-v2/farm.webp');
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
    applyBuildingVisualState(artwork, 'mine', level, false);
    expect(artwork.construction.children).toHaveLength(0);
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
      expect(Number.isFinite(BUILDING_VISUALS[buildingId].statusStackAnchor.x)).toBe(true);
      expect(getBuildingVisualState({ buildingId, level: 20 }).renderWidth)
        .toBeGreaterThan(getBuildingVisualState({ buildingId, level: 1 }).renderWidth);
    }
  });

  it.each(['castle', 'farm', 'lumberMill', 'grandMarket', 'academy', 'blacksmith', 'watchtower', 'workshop'] as const)('uses %s architecture without generic tier ornaments, keeping minor details and capstone', (buildingId) => {
    const artwork = createBuildingArtwork(buildingId, Texture.WHITE, false,
      getBuildingVisualState({ buildingId, level: 5 }), false);
    expect(artwork.evolutionDetails.children[0].children).toHaveLength(0);
    applyBuildingVisualState(artwork, buildingId, getBuildingVisualState({ buildingId, level: 20 }), false);
    expect(artwork.evolutionDetails.children[0].children).toHaveLength(4);
    artwork.container.destroy({ children: true });
  });
});

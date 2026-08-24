import type { Texture } from 'pixi.js';
import type { FutureBuildingId } from '../domain/kingdom-types';
import { createSpriteBuildingArtwork, type BuildingArtwork } from './building-art';

export function createFutureBuildingArtwork(id: FutureBuildingId, texture: Texture, debug = false): BuildingArtwork {
  return createSpriteBuildingArtwork(id, texture, true, debug);
}

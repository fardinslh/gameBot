import { Assets, Container, Graphics, Sprite } from 'pixi.js';
import type { Ticker } from 'pixi.js';
import { createPixiRuntime } from '@/game/rendering/pixi-runtime';
import { KINGDOM_BUILDING_LAYOUT } from '../data/building-layout';
import type { BuildingId } from '../domain/kingdom-types';
import { createBuildingArtwork } from './building-art';

interface KingdomSceneRuntime {
  destroy(): void;
  select(buildingId: BuildingId | null): void;
  setIndicators(indicators: Partial<Record<BuildingId, BuildingIndicator>>): void;
}

export type BuildingIndicator = 'upgrade' | 'active' | null;

const TERRAIN_TEXTURE = '/assets/kingdom/kingdom-terrain-v1.webp';

export async function createKingdomScene(
  host: HTMLDivElement,
  onSelect: (buildingId: BuildingId) => void,
): Promise<KingdomSceneRuntime> {
  const runtime = await createPixiRuntime(host);
  const { app } = runtime;
  const texture = await Assets.load(TERRAIN_TEXTURE);
  const background = new Sprite(texture);
  background.anchor.set(0.5);
  app.stage.addChild(background);

  const atmosphere = new Graphics().rect(0, 0, 1, 1).fill({ color: 0x0c150e, alpha: 0.08 });
  app.stage.addChild(atmosphere);

  const buildingsLayer = new Container();
  app.stage.addChild(buildingsLayer);

  const artwork = new Map<BuildingId, ReturnType<typeof createBuildingArtwork>>();
  const indicatorArtwork = new Map<BuildingId, Graphics>();
  let selectedBuildingId: BuildingId | null = null;
  let elapsed = 0;

  for (const building of KINGDOM_BUILDING_LAYOUT) {
    const buildingArt = createBuildingArtwork(building.id);
    const indicator = createIndicator();
    indicator.position.set(building.id === 'castle' ? 58 : 47, building.id === 'castle' ? -126 : -84);
    buildingArt.container.addChild(indicator);
    artwork.set(building.id, buildingArt);
    indicatorArtwork.set(building.id, indicator);
    buildingArt.container.on('pointertap', () => {
      selectedBuildingId = building.id;
      syncSelection();
      onSelect(building.id);
    });
    buildingsLayer.addChild(buildingArt.container);
  }
  host.dataset.buildingCount = String(artwork.size);

  const syncSelection = (): void => {
    for (const [id, item] of artwork) {
      item.selection.visible = id === selectedBuildingId;
      item.selection.alpha = id === selectedBuildingId ? 1 : 0;
    }
  };

  const layout = (): void => {
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    app.renderer.resize(width, height);

    const coverScale = Math.max(width / texture.width, height / texture.height);
    background.position.set(width / 2, height / 2);
    background.scale.set(coverScale);
    atmosphere.width = width;
    atmosphere.height = height;

    const screenScale = Math.max(0.62, Math.min(width / 470, 1.08));
    for (const building of KINGDOM_BUILDING_LAYOUT) {
      const item = artwork.get(building.id);
      if (!item) continue;
      item.container.position.set(width * building.x, height * building.y);
      item.container.scale.set(screenScale * building.scale);
    }
  };

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animate = (ticker: Ticker): void => {
    elapsed += ticker.deltaMS / 1_000;
    for (const [id, item] of artwork) {
      const selected = id === selectedBuildingId;
      if (selected) {
        const pulse = 1 + Math.sin(elapsed * 3.2) * 0.045;
        item.selection.scale.set(pulse);
        item.selection.alpha = 0.78 + Math.sin(elapsed * 3.2) * 0.2;
      }
      for (const waving of item.wavingParts) waving.scale.x = 0.86 + Math.sin(elapsed * 2.4 + buildingOffset(id)) * 0.14;
      for (const rotator of item.rotators) rotator.rotation += ticker.deltaMS * 0.00035;
      for (const glow of item.glowParts) glow.alpha = 0.78 + Math.sin(elapsed * 2 + buildingOffset(id)) * 0.16;
      if (item.smoke) {
        item.smoke.y -= ticker.deltaMS * 0.003;
        item.smoke.alpha = 0.74 - Math.abs(item.smoke.y % 28) / 55;
        if (item.smoke.y < -122) item.smoke.y += 34;
      }
    }
  };

  if (!reducedMotion) app.ticker.add(animate);

  let resizeFrame = 0;
  const resizeObserver = new ResizeObserver(() => {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(layout);
  });
  resizeObserver.observe(host);
  layout();

  return {
    select: (buildingId) => {
      selectedBuildingId = buildingId;
      syncSelection();
    },
    setIndicators: (indicators) => {
      for (const [id, indicator] of indicatorArtwork) drawIndicator(indicator, indicators[id] ?? null);
    },
    destroy: () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(resizeFrame);
      if (!reducedMotion) app.ticker.remove(animate);
      runtime.destroy();
    },
  };
}

function createIndicator(): Graphics {
  const indicator = new Graphics();
  indicator.visible = false;
  return indicator;
}

function drawIndicator(indicator: Graphics, state: BuildingIndicator): void {
  indicator.clear();
  indicator.visible = state !== null;
  if (!state) return;
  const color = state === 'active' ? 0xe2b447 : 0x8ecb68;
  indicator.circle(0, 0, 18).fill({ color: 0x17140f, alpha: 0.94 }).stroke({ color, width: 3 });
  if (state === 'upgrade') {
    indicator.moveTo(0, 10).lineTo(0, -7).moveTo(-7, 0).lineTo(0, -8).lineTo(7, 0).stroke({ color, width: 4 });
  } else {
    indicator.circle(0, 0, 9).stroke({ color, width: 2 });
    indicator.moveTo(0, 0).lineTo(0, -6).moveTo(0, 0).lineTo(5, 3).stroke({ color, width: 2 });
  }
}

function buildingOffset(id: BuildingId): number {
  switch (id) {
    case 'castle': return 0;
    case 'farm': return 0.8;
    case 'lumberMill': return 1.6;
    case 'mine': return 2.4;
    case 'grandMarket': return 3.2;
  }
}

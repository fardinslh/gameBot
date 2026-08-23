import { Assets, Container, Graphics, Sprite } from 'pixi.js';
import type { Ticker } from 'pixi.js';
import { createPixiRuntime } from '@/game/rendering/pixi-runtime';
import { FUTURE_BUILDING_LAYOUT, KINGDOM_BUILDING_LAYOUT, KINGDOM_WORLD } from '../data/building-layout';
import type { BuildingId, WorldBuildingId } from '../domain/kingdom-types';
import { createBuildingArtwork, type BuildingArtwork } from './building-art';
import { createFutureBuildingArtwork } from './future-building-art';

interface KingdomSceneRuntime {
  destroy(): void;
  select(buildingId: WorldBuildingId | null): void;
  setIndicators(indicators: Partial<Record<BuildingId, BuildingIndicator>>): void;
}

export type BuildingIndicator = 'upgrade' | 'active' | null;

const TERRAIN_TEXTURE = '/assets/kingdom/kingdom-expansion-v1.webp';
const CASTLE_TEXTURE = '/assets/kingdom/castle-production-v1.webp';
const CASTLE_FOCUS_Y = 690;

export async function createKingdomScene(host: HTMLDivElement, onSelect: (buildingId: WorldBuildingId) => void): Promise<KingdomSceneRuntime> {
  const runtime = await createPixiRuntime(host);
  const { app } = runtime;
  const [texture, castleTexture] = await Promise.all([Assets.load(TERRAIN_TEXTURE), Assets.load(CASTLE_TEXTURE)]);
  const world = new Container();
  app.stage.addChild(world);

  const background = new Sprite(texture);
  background.position.set(KINGDOM_WORLD.sourceOffsetX, 0);
  world.addChild(background);
  world.addChild(new Graphics().rect(0, 0, KINGDOM_WORLD.width, KINGDOM_WORLD.height).fill({ color: 0x0b140d, alpha: .08 }));

  const buildingsLayer = new Container();
  world.addChild(buildingsLayer);
  const artwork = new Map<WorldBuildingId, BuildingArtwork>();
  const indicatorArtwork = new Map<BuildingId, Graphics>();
  let selectedBuildingId: WorldBuildingId | null = null;
  let elapsed = 0;
  let didPan = false;

  const registerBuilding = (id: WorldBuildingId, x: number, y: number, scale: number, buildingArt: BuildingArtwork): void => {
    artwork.set(id, buildingArt);
    buildingArt.container.position.set(x, y);
    buildingArt.container.scale.set(scale);
    buildingArt.container.on('pointertap', () => {
      if (didPan) return;
      selectedBuildingId = id;
      syncSelection();
      onSelect(id);
    });
    buildingsLayer.addChild(buildingArt.container);
  };

  for (const building of KINGDOM_BUILDING_LAYOUT) {
    const buildingArt = createBuildingArtwork(building.id, building.id === 'castle' ? castleTexture : undefined);
    const indicator = createIndicator();
    indicator.position.set(building.id === 'castle' ? 76 : 40, building.id === 'castle' ? -148 : -77);
    buildingArt.container.addChild(indicator);
    indicatorArtwork.set(building.id, indicator);
    registerBuilding(building.id, building.x, building.y, building.scale, buildingArt);
  }

  for (const building of FUTURE_BUILDING_LAYOUT) {
    const buildingArt = createFutureBuildingArtwork(building.id);
    const lockBadge = createLockBadge();
    lockBadge.position.set(building.id === 'watchtower' ? 32 : 46, building.id === 'watchtower' ? -113 : -72);
    buildingArt.container.addChild(lockBadge);
    registerBuilding(building.id, building.x, building.y, building.scale, buildingArt);
  }

  host.dataset.buildingCount = String(artwork.size);
  host.dataset.activeBuildingCount = String(KINGDOM_BUILDING_LAYOUT.length);
  host.dataset.futureBuildingCount = String(FUTURE_BUILDING_LAYOUT.length);
  host.dataset.panEnabled = 'true';

  function syncSelection(): void {
    for (const [id, item] of artwork) {
      item.selection.visible = id === selectedBuildingId;
      item.selection.alpha = id === selectedBuildingId ? 1 : 0;
    }
  }

  let cameraY = 0;
  let cameraMinY = 0;
  let laidOut = false;
  const clampCamera = (value: number): number => Math.max(cameraMinY, Math.min(0, value));
  const syncCamera = (): void => {
    world.y = cameraY;
    host.dataset.cameraY = String(Math.round(cameraY));
    host.dataset.cameraMinY = String(Math.round(cameraMinY));
  };
  const layout = (): void => {
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    const previousProgress = cameraMinY < 0 ? cameraY / cameraMinY : .28;
    app.renderer.resize(width, height);
    const worldScale = width / KINGDOM_WORLD.width;
    world.scale.set(worldScale);
    world.x = (width - KINGDOM_WORLD.width * worldScale) / 2;
    cameraMinY = Math.min(0, height - KINGDOM_WORLD.height * worldScale);
    cameraY = laidOut ? clampCamera(cameraMinY * previousProgress) : clampCamera(height * .49 - CASTLE_FOCUS_Y * worldScale);
    syncCamera();
    laidOut = true;
  };

  let pointerId: number | null = null;
  let dragStartY = 0;
  let cameraStartY = 0;
  const canvas = app.canvas;
  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    pointerId = event.pointerId;
    dragStartY = event.clientY;
    cameraStartY = cameraY;
    didPan = false;
    canvas.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return;
    const delta = event.clientY - dragStartY;
    if (Math.abs(delta) > 7) didPan = true;
    if (!didPan) return;
    cameraY = clampCamera(cameraStartY + delta);
    syncCamera();
  };
  const onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    pointerId = null;
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animate = (ticker: Ticker): void => {
    elapsed += ticker.deltaMS / 1_000;
    for (const [id, item] of artwork) {
      if (id === selectedBuildingId) {
        const pulse = 1 + Math.sin(elapsed * 3.2) * .045;
        item.selection.scale.set(pulse);
        item.selection.alpha = .78 + Math.sin(elapsed * 3.2) * .2;
      }
      for (const waving of item.wavingParts) waving.scale.x = .86 + Math.sin(elapsed * 2.4 + artOffset(id)) * .14;
      for (const rotator of item.rotators) rotator.rotation += ticker.deltaMS * .00035;
      for (const glow of item.glowParts) glow.alpha = .78 + Math.sin(elapsed * 2 + artOffset(id)) * .16;
      if (item.smoke) {
        item.smoke.y -= ticker.deltaMS * .003;
        item.smoke.alpha = .74 - Math.abs(item.smoke.y % 28) / 55;
        if (item.smoke.y < -150) item.smoke.y += 34;
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
    select: (buildingId) => { selectedBuildingId = buildingId; syncSelection(); },
    setIndicators: (indicators) => {
      for (const [id, indicator] of indicatorArtwork) drawIndicator(indicator, indicators[id] ?? null);
    },
    destroy: () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(resizeFrame);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
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

function createLockBadge(): Graphics {
  return new Graphics()
    .roundRect(-11, -9, 22, 19, 7).fill({ color: 0x17140f, alpha: .94 }).stroke({ color: 0xc9a75f, width: 2 })
    .arc(0, -8, 6, Math.PI, 0).stroke({ color: 0xe5c277, width: 2.5 })
    .circle(0, 0, 2).fill(0xe5c277)
    .moveTo(0, 1).lineTo(0, 5).stroke({ color: 0xe5c277, width: 2 });
}

function drawIndicator(indicator: Graphics, state: BuildingIndicator): void {
  indicator.clear();
  indicator.visible = state !== null;
  if (!state) return;
  const color = state === 'active' ? 0xe2b447 : 0x8ecb68;
  indicator.roundRect(-12, -11, 24, 22, 8).fill({ color: 0x17140f, alpha: .94 }).stroke({ color, width: 2 });
  if (state === 'upgrade') {
    indicator.moveTo(0, 7).lineTo(0, -5).moveTo(-5, 0).lineTo(0, -6).lineTo(5, 0).stroke({ color, width: 3 });
  } else {
    indicator.circle(0, 0, 7).stroke({ color, width: 1.5 });
    indicator.moveTo(0, 0).lineTo(0, -4).moveTo(0, 0).lineTo(4, 2).stroke({ color, width: 1.5 });
  }
}

function artOffset(id: WorldBuildingId): number {
  return ['castle', 'farm', 'lumberMill', 'mine', 'grandMarket', 'barracks', 'blacksmith', 'academy', 'granary', 'watchtower', 'tavern', 'stable'].indexOf(id) * .7;
}

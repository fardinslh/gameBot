import { Assets, Container, Graphics, Sprite } from 'pixi.js';
import type { Ticker } from 'pixi.js';
import { createPixiRuntime } from '@/game/rendering/pixi-runtime';
import { KINGDOM_BUILDING_LAYOUT, KINGDOM_WORLD } from '../data/building-layout';
import type { BuildingId, WorldBuildingId } from '../domain/kingdom-types';
import { createBuildingArtwork, type BuildingArtwork } from './building-art';
import { BUILDING_VISUALS, resolveBuildingTexture, type BuildingVisualId } from './building-visuals';

interface KingdomSceneRuntime {
  destroy(): void;
  select(buildingId: WorldBuildingId | null): void;
  setIndicators(indicators: Partial<Record<BuildingId, BuildingIndicator>>): void;
}

export type BuildingIndicator = 'upgrade' | 'active' | null;

const TERRAIN_TEXTURE = '/assets/kingdom/terrain/kingdom-base-v3.webp';
const CASTLE_TEXTURE = '/assets/kingdom/castle-production-v1.webp';
const CASTLE_FOCUS_Y = 690;

export async function createKingdomScene(host: HTMLDivElement, onSelect: (buildingId: WorldBuildingId) => void): Promise<KingdomSceneRuntime> {
  const runtime = await createPixiRuntime(host);
  const { app } = runtime;
  const searchParams = new URLSearchParams(window.location.search);
  const debugBuildingLayout = searchParams.get('debugBuildingLayout') === '1';
  const debugKingdomLayers = searchParams.get('debugKingdomLayers');
  const visualIds: BuildingVisualId[] = KINGDOM_BUILDING_LAYOUT
    .filter((building) => building.id !== 'castle')
    .map((building) => building.id as BuildingVisualId);
  const [texture, castleTexture, ...buildingTextures] = await Promise.all([
    Assets.load(TERRAIN_TEXTURE),
    Assets.load(CASTLE_TEXTURE),
    ...visualIds.map((id) => Assets.load(resolveBuildingTexture(id))),
  ]);
  const textureById = new Map(visualIds.map((id, index) => [id, buildingTextures[index]]));
  // A mirrored top-edge extension only shows above a positively panned world.
  // Its lower edge shares source row zero with the terrain, avoiding a repeated
  // or hard seam while the camera keeps the upper building clear of the HUD.
  const backdrop = new Sprite(texture);
  app.stage.addChild(backdrop);
  const world = new Container();
  app.stage.addChild(world);

  const background = new Sprite(texture);
  background.position.set(KINGDOM_WORLD.sourceOffsetX, 0);
  world.addChild(background);
  world.addChild(new Graphics().rect(0, 0, KINGDOM_WORLD.width, KINGDOM_WORLD.height).fill({ color: 0x0b140d, alpha: .08 }));

  const buildingsLayer = new Container();
  buildingsLayer.sortableChildren = true;
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
    buildingArt.container.zIndex = Math.round(y);
    buildingArt.container.on('pointertap', () => {
      if (didPan) return;
      selectedBuildingId = id;
      syncSelection();
      onSelect(id);
    });
    buildingsLayer.addChild(buildingArt.container);
  };

  for (const building of KINGDOM_BUILDING_LAYOUT) {
    const buildingTexture = building.id === 'castle' ? castleTexture : textureById.get(building.id);
    if (!buildingTexture) throw new Error(`Missing visual texture for ${building.id}`);
    const buildingArt = createBuildingArtwork(building.id, buildingTexture, debugBuildingLayout);
    const indicator = createIndicator();
    const indicatorAnchor = BUILDING_VISUALS[building.id].indicatorAnchor;
    indicator.position.copyFrom(indicatorAnchor);
    buildingArt.container.addChild(indicator);
    buildingArt.container.visible = debugKingdomLayers !== 'terrain'
      && (debugKingdomLayers !== 'castle' || building.id === 'castle');
    indicatorArtwork.set(building.id, indicator);
    registerBuilding(building.id, building.groundX, building.groundY, building.scale, buildingArt);
  }

  host.dataset.buildingCount = String(artwork.size);
  host.dataset.activeBuildingCount = String(KINGDOM_BUILDING_LAYOUT.length);
  host.dataset.futureBuildingCount = '0';
  host.dataset.panEnabled = 'true';
  host.dataset.debugBuildingLayout = String(debugBuildingLayout);
  host.dataset.debugKingdomLayers = debugKingdomLayers ?? 'all';

  function syncSelection(): void {
    for (const [id, item] of artwork) {
      item.selection.visible = id === selectedBuildingId;
      item.selection.alpha = id === selectedBuildingId ? 1 : 0;
    }
  }

  let cameraY = 0;
  let cameraMinY = 0;
  let cameraMaxY = 0;
  let worldScale = 1;
  let laidOut = false;
  const clampCamera = (value: number): number => Math.max(cameraMinY, Math.min(cameraMaxY, value));
  const syncCamera = (): void => {
    world.y = cameraY;
    backdrop.visible = cameraY > 0;
    backdrop.position.set(world.x + KINGDOM_WORLD.sourceOffsetX * worldScale, cameraY);
    host.dataset.cameraY = String(Math.round(cameraY));
    host.dataset.cameraMinY = String(Math.round(cameraMinY));
    host.dataset.cameraMaxY = String(Math.round(cameraMaxY));
  };
  const layout = (): void => {
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    const previousRange = cameraMinY - cameraMaxY;
    const previousProgress = laidOut && previousRange !== 0 ? (cameraY - cameraMaxY) / previousRange : .28;
    app.renderer.resize(width, height);
    worldScale = width / KINGDOM_WORLD.width;
    world.scale.set(worldScale);
    world.x = (width - KINGDOM_WORLD.width * worldScale) / 2;
    backdrop.scale.set(worldScale, -worldScale);
    cameraMinY = Math.min(0, height - KINGDOM_WORLD.height * worldScale);
    const shell = host.closest<HTMLElement>('.kingdom-shell');
    const resourceHud = shell?.querySelector<HTMLElement>('.resource-hud');
    const inboxButton = shell?.querySelector<HTMLElement>('.kingdom-inbox-button');
    const collectControl = shell?.querySelector<HTMLElement>('.collect-control');
    const shellTop = shell?.getBoundingClientRect().top ?? 0;
    const hudSafeBottom = Math.max(
      resourceHud?.getBoundingClientRect().bottom ?? shellTop + 100,
      inboxButton?.getBoundingClientRect().bottom ?? shellTop + 100,
      collectControl?.getBoundingClientRect().bottom ?? shellTop + 100,
    ) - shellTop + 12;
    const topmostBuildingY = buildingsLayer.getLocalBounds().y;
    cameraMaxY = Math.max(0, hudSafeBottom - topmostBuildingY * worldScale);
    const castleFocusCameraY = height * .49 - CASTLE_FOCUS_Y * worldScale;
    const topBuildingSafeCameraY = hudSafeBottom - topmostBuildingY * worldScale;
    cameraY = laidOut
      ? clampCamera(cameraMaxY + (cameraMinY - cameraMaxY) * previousProgress)
      : clampCamera(Math.max(castleFocusCameraY, topBuildingSafeCameraY));
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
  return ['castle', 'farm', 'lumberMill', 'mine', 'grandMarket', 'barracks', 'blacksmith', 'academy', 'granary', 'watchtower', 'workshop', 'tavern', 'stable'].indexOf(id) * .7;
}

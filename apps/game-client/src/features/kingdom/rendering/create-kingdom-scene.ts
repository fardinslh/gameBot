import { Assets, Container, Graphics, Sprite } from 'pixi.js';
import type { Ticker } from 'pixi.js';
import type { ArmyResponse, BuildingAppearanceVariant, KingdomExpansionStage } from '@crown-and-coin/shared';
import { createPixiRuntime } from '@/game/rendering/pixi-runtime';
import { KINGDOM_BUILDING_LAYOUT, KINGDOM_WORLD } from '../data/building-layout';
import type { BuildingId, WorldBuildingId } from '../domain/kingdom-types';
import { DEFAULT_KINGDOM_THEME } from '../domain/kingdom-theme';
import { applyBuildingVisualState, createBuildingArtwork, type BuildingArtwork } from './building-art';
import { appearanceVariantStage, BUILDING_VISUALS, resolveBuildingTexture } from './building-visuals';
import {
  getBuildingVisualState,
  getUpgradeTransition,
  isEvolutionBuilding,
  type BuildingVisualState,
} from './building-visual-progression';
import { KINGDOM_EXPANSION_PRESENTATIONS, EXPANSION_PRESENTATION_BY_BUILDING } from '../data/kingdom-expansion-stages';
import { createExpansionAreaArtwork, type ExpansionAreaArtwork } from './expansion-area-art';
import {
  calculateBuildingStatusLayout,
  createBuildingStatusBadge,
  createBuildingUpgradeIndicator,
  drawBuildingStatusBadge,
  drawBuildingUpgradeIndicator,
  type BuildingStatusIndicator,
} from './building-status-badge';
import type { Locale } from '@/i18n/config';
import { buildingActivityMilestone, createAmbientLifeArtwork } from './ambient-life';
import { createHeroPresenceArtwork, deriveKingdomHeroPresences } from './hero-presence';
import type { KingdomRaidReturnPresentation } from '@/features/raid/domain/raid-journey-presentation';

interface KingdomSceneRuntime {
  destroy(): void;
  select(buildingId: WorldBuildingId | null): void;
  setLocale(locale: Locale): void;
  setBuildingStates(states: Partial<Record<BuildingId, BuildingSceneState>>, expansionStage: KingdomExpansionStage): void;
  setArmyState(army: ArmyResponse | null): void;
  playRaidReturn(presentation: KingdomRaidReturnPresentation, onComplete: () => void): void;
  toggleOverview(): void;
  setZoom(zoom: number): void;
}

export type BuildingIndicator = BuildingStatusIndicator;
export interface BuildingSceneState {
  indicator: BuildingIndicator;
  level: number;
  locked: boolean;
  appearanceVariant: BuildingAppearanceVariant;
}

const TERRAIN_TEXTURE = '/assets/kingdom/terrain/kingdom-base-v6.webp';
const KINGDOM_COMPOSITION_FOCUS_Y = 690;

export async function createKingdomScene(host: HTMLDivElement, onSelect: (buildingId: WorldBuildingId) => void, initialLocale: Locale = 'en'): Promise<KingdomSceneRuntime> {
  const runtime = await createPixiRuntime(host);
  const { app } = runtime;
  const searchParams = new URLSearchParams(window.location.search);
  const debugBuildingLayout = searchParams.get('debugBuildingLayout') === '1';
  const debugKingdomLayers = searchParams.get('debugKingdomLayers');
  const texture = await Assets.load(TERRAIN_TEXTURE);
  const terrainScale = 1024 / texture.width;
  // A clean atmospheric top extension fill matching the northern alpine ridge,
  // avoiding any mirrored/repeated map artifacts when panned down.
  const backdrop = new Graphics();
  app.stage.addChild(backdrop);
  const world = new Container();
  app.stage.addChild(world);
  const statusLayer = new Container();
  statusLayer.eventMode = 'none';

  const background = new Sprite(texture);
  background.scale.set(terrainScale);
  background.position.set(KINGDOM_WORLD.sourceOffsetX, 0);
  world.addChild(background);
  world.addChild(new Graphics().rect(KINGDOM_WORLD.sourceOffsetX, 0, 1024, KINGDOM_WORLD.height).fill({ color: 0x0b140d, alpha: .08 }));

  const expansionLayer = new Container();
  world.addChild(expansionLayer);
  const buildingsLayer = new Container();
  buildingsLayer.sortableChildren = true;
  world.addChild(buildingsLayer);
  const ambientLife = createAmbientLifeArtwork();
  ambientLife.container.visible = debugKingdomLayers === null;
  world.addChild(ambientLife.container);
  const heroPresence = createHeroPresenceArtwork();
  heroPresence.container.visible = debugKingdomLayers === null;
  heroPresence.returnContainer.visible = debugKingdomLayers === null;
  world.addChild(heroPresence.container, heroPresence.returnContainer);
  app.stage.addChild(statusLayer);
  const artwork = new Map<WorldBuildingId, BuildingArtwork>();
  const indicatorArtwork = new Map<BuildingId, Graphics>();
  const statusArtwork = new Map<BuildingId, Container>();
  const knownUnlockState = new Map<BuildingId, boolean>();
  const texturePathById = new Map<BuildingId, string>();
  const levelById = new Map<BuildingId, number>();
  let locale = initialLocale;
  const transformationAnimation = new Map<BuildingId, { durationMs: number; elapsedMs: number; major: boolean }>();
  const unlockAnimation = new Map<BuildingId, number>();
  const expansionArtwork = new Map<BuildingId, ExpansionAreaArtwork>();
  const expansionAnimation = new Map<BuildingId, number>();
  let desiredStates: Partial<Record<BuildingId, BuildingSceneState>> = {};
  let currentArmy: ArmyResponse | null = null;
  let heroPresenceCount = 0;
  let currentExpansionStage: KingdomExpansionStage = 1;
  let hasReceivedExpansionStage = false;
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

  const syncBuildingCount = (): void => {
    host.dataset.buildingCount = String(artwork.size);
    host.dataset.activeBuildingCount = String(artwork.size);
  };

  const syncExpansionCount = (): void => {
    host.dataset.expansionAreaCount = String(expansionArtwork.size);
    host.dataset.expansionStage = String(currentExpansionStage);
  };

  const syncExpansionAreas = (
    states: Partial<Record<BuildingId, BuildingSceneState>>,
    nextStage: KingdomExpansionStage,
  ): void => {
    const hasAuthoritativeBuildings = Object.keys(states).length > 0;
    const liveAdvance = hasAuthoritativeBuildings
      && hasReceivedExpansionStage
      && nextStage > currentExpansionStage;
    for (const presentation of KINGDOM_EXPANSION_PRESENTATIONS) {
      const shouldExist = presentation.stage <= nextStage && states[presentation.buildingId]?.locked === false;
      const existing = expansionArtwork.get(presentation.buildingId);
      if (!shouldExist) {
        if (existing) {
          expansionArtwork.delete(presentation.buildingId);
          expansionAnimation.delete(presentation.buildingId);
          existing.container.destroy({ children: true });
        }
        continue;
      }
      if (existing) continue;
      const area = createExpansionAreaArtwork(presentation);
      area.container.position.set(presentation.groundX, presentation.groundY);
      area.container.visible = debugKingdomLayers !== 'terrain' && debugKingdomLayers !== 'castle';
      expansionLayer.addChild(area.container);
      expansionArtwork.set(presentation.buildingId, area);
      const reveal = liveAdvance && presentation.stage > currentExpansionStage && !reducedMotion;
      area.environment.alpha = reveal ? 0 : 1;
      area.mist.alpha = reveal ? 1 : 0;
      if (reveal) expansionAnimation.set(presentation.buildingId, 0);
    }
    currentExpansionStage = nextStage;
    if (hasAuthoritativeBuildings) hasReceivedExpansionStage = true;
    syncExpansionCount();
  };

  const removeBuilding = (id: BuildingId): void => {
    const item = artwork.get(id);
    if (!item) return;
    if (selectedBuildingId === id) selectedBuildingId = null;
    artwork.delete(id);
    const indicator = indicatorArtwork.get(id);
    indicatorArtwork.delete(id);
    indicator?.destroy();
    const status = statusArtwork.get(id);
    statusArtwork.delete(id);
    status?.destroy({ children: true });
    texturePathById.delete(id);
    levelById.delete(id);
    transformationAnimation.delete(id);
    unlockAnimation.delete(id);
    item.container.destroy({ children: true });
    syncBuildingCount();
    if (laidOut) layout();
  };

  const mountBuilding = async (
    building: (typeof KINGDOM_BUILDING_LAYOUT)[number],
    state: BuildingSceneState,
    reveal: boolean,
  ): Promise<void> => {
    const visualState = resolveEvolutionState(building.id, state.level);
    const desiredTexturePath = visualState?.asset ?? resolveBuildingTexture(building.id, appearanceVariantStage(state.appearanceVariant));
    const buildingTexture = await Assets.load(desiredTexturePath);
    const currentState = desiredStates[building.id];
    if (currentState?.locked !== false || artwork.has(building.id)) return;
    const currentVisualState = resolveEvolutionState(building.id, currentState.level);
    const currentTexturePath = currentVisualState?.asset ?? resolveBuildingTexture(building.id, appearanceVariantStage(currentState.appearanceVariant));
    if (currentTexturePath !== desiredTexturePath) {
      void mountBuilding(building, currentState, reveal);
      return;
    }
    const buildingArt = createBuildingArtwork(
      building.id,
      buildingTexture,
      debugBuildingLayout,
      visualState,
      currentState.indicator === 'active',
    );
    const indicator = createBuildingUpgradeIndicator(currentState.indicator);
    const status = createBuildingStatusBadge(currentState.level, app.renderer.resolution, locale);
    statusLayer.addChild(indicator, status);
    buildingArt.container.visible = debugKingdomLayers !== 'terrain'
      && (debugKingdomLayers !== 'castle' || building.id === 'castle');
    indicatorArtwork.set(building.id, indicator);
    statusArtwork.set(building.id, status);
    texturePathById.set(building.id, desiredTexturePath);
    levelById.set(building.id, currentState.level);
    registerBuilding(building.id, building.groundX, building.groundY, building.scale, buildingArt);
    if (reveal && !reducedMotion) {
      buildingArt.container.alpha = 0;
      buildingArt.container.scale.set(building.scale * .9);
      buildingArt.container.eventMode = 'none';
      unlockAnimation.set(building.id, 0);
    }
    syncBuildingCount();
    if (laidOut) layout();
  };

  host.dataset.buildingCount = '0';
  host.dataset.activeBuildingCount = '0';
  host.dataset.futureBuildingCount = '0';
  host.dataset.expansionAreaCount = '0';
  host.dataset.expansionStage = '1';
  host.dataset.ambientActorCount = '0';
  host.dataset.heroPresenceCount = '0';
  host.dataset.ambientRenderStyle = 'sprite-atlas';
  host.dataset.heroRenderStyle = 'sprite-atlas';
  host.dataset.characterAnimationEngine = 'pixi-animated-sprite';
  host.dataset.characterFrameCount = '2';
  host.dataset.worldActorCount = '0';
  host.dataset.raidReturn = 'idle';
  const mineLayout = KINGDOM_BUILDING_LAYOUT.find((building) => building.id === 'mine');
  host.dataset.mineGround = mineLayout ? `${mineLayout.groundX},${mineLayout.groundY}` : '';
  host.dataset.panEnabled = 'true';
  host.dataset.debugBuildingLayout = String(debugBuildingLayout);
  host.dataset.debugKingdomLayers = debugKingdomLayers ?? 'all';

  function syncSelection(): void {
    for (const [id, item] of artwork) {
      item.selection.visible = id === selectedBuildingId;
      item.selection.alpha = id === selectedBuildingId ? 1 : 0;
    }
  }

  let cameraX = 0;
  let cameraY = 0;
  let cameraMinX = 0;
  let cameraMaxX = 0;
  let cameraMinY = 0;
  let cameraMaxY = 0;
  let worldScale = 1;
  const MIN_ZOOM = 640 / 1024; // ~0.625 (fits complete 1024-wide designed terrain edge-to-edge)
  const MAX_ZOOM = 1.35;
  let zoom = 1.0;
  let laidOut = false;

  const clampCameraX = (value: number): number => Math.max(cameraMinX, Math.min(cameraMaxX, value));
  const clampCameraY = (value: number): number => Math.max(cameraMinY, Math.min(cameraMaxY, value));

  const updateCameraBounds = (width: number, height: number): void => {
    const effectiveScale = worldScale * zoom;
    const terrainWidthPx = 1024 * effectiveScale;
    const terrainHeightPx = KINGDOM_WORLD.height * effectiveScale;

    if (terrainWidthPx <= width) {
      // Zoomed out: full 1024 terrain width fits on screen; center horizontally
      const centeredX = (width - terrainWidthPx) / 2 - KINGDOM_WORLD.sourceOffsetX * effectiveScale;
      cameraMinX = centeredX;
      cameraMaxX = centeredX;
      cameraX = centeredX;
    } else {
      // Zoomed in: allow horizontal panning between western forest and eastern beach
      cameraMaxX = -KINGDOM_WORLD.sourceOffsetX * effectiveScale;
      cameraMinX = width - (KINGDOM_WORLD.sourceOffsetX + 1024) * effectiveScale;
      cameraX = clampCameraX(cameraX);
    }

    const shell = host.closest<HTMLElement>('.kingdom-shell');
    const resourceHud = shell?.querySelector<HTMLElement>('.resource-hud');
    const inboxButton = shell?.querySelector<HTMLElement>('.kingdom-inbox-button');
    const collectControl = shell?.querySelector<HTMLElement>('.collect-control');
    const bottomNav = shell?.querySelector<HTMLElement>('.bottom-navigation');
    const shellTop = shell?.getBoundingClientRect().top ?? 0;
    const hudSafeBottom = Math.max(
      resourceHud?.getBoundingClientRect().bottom ?? shellTop + 100,
      inboxButton?.getBoundingClientRect().bottom ?? shellTop + 100,
      collectControl?.getBoundingClientRect().bottom ?? shellTop + 100,
    ) - shellTop + 12;

    const bottomNavHeight = bottomNav?.getBoundingClientRect().height ?? 54;
    const bottomUiClearance = bottomNavHeight + 96;

    // Allow scrolling down so northern mountain crags and peaks clear the top HUD
    cameraMaxY = hudSafeBottom + 24;
    // Allow scrolling up so southern river and stone bridge clear the bottom UI
    cameraMinY = Math.min(cameraMaxY, height - bottomUiClearance - terrainHeightPx);
  };

  const syncStatusPositions = (): void => {
    const effectiveScale = worldScale * zoom;
    for (const [id, status] of statusArtwork) {
      const item = artwork.get(id);
      if (!item) continue;
      const indicator = indicatorArtwork.get(id);
      if (!indicator) continue;
      const layout = calculateBuildingStatusLayout({
        statusStackAnchor: BUILDING_VISUALS[id].statusStackAnchor,
        buildingPosition: item.container.position,
        buildingScale: item.container.scale.x,
        resolution: app.renderer.resolution,
        worldPosition: { x: world.x, y: cameraY },
        worldScale: effectiveScale,
      });
      status.position.set(layout.levelBadge.x, layout.levelBadge.y);
      indicator.position.set(layout.upgradeIndicator.x, layout.upgradeIndicator.y);
      status.visible = item.container.visible;
      status.alpha = item.container.alpha;
      indicator.renderable = item.container.visible;
      indicator.alpha = item.container.alpha;
    }
  };

  const syncCamera = (): void => {
    const effectiveScale = worldScale * zoom;
    world.scale.set(effectiveScale);
    world.position.set(cameraX, cameraY);
    if (cameraY > 0) {
      backdrop.visible = true;
      backdrop.clear();
      backdrop.rect(0, 0, app.screen.width, cameraY + 2).fill({ color: 0x4a6a4e });
    } else {
      backdrop.visible = false;
    }
    host.dataset.cameraX = String(Math.round(cameraX));
    host.dataset.cameraY = String(Math.round(cameraY));
    host.dataset.cameraMinY = String(Math.round(cameraMinY));
    host.dataset.cameraMaxY = String(Math.round(cameraMaxY));
    host.dataset.zoom = zoom.toFixed(3);
    syncStatusPositions();
  };

  const setZoom = (nextZoom: number): void => {
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    updateCameraBounds(width, height);
    cameraX = clampCameraX(cameraX);
    cameraY = clampCameraY(cameraY);
    syncCamera();
  };

  const toggleOverview = (): void => {
    const targetZoom = zoom < 0.85 ? 1.0 : MIN_ZOOM;
    setZoom(targetZoom);
    if (targetZoom === 1.0) {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      cameraX = 0;
      cameraY = clampCameraY(height * .49 - KINGDOM_COMPOSITION_FOCUS_Y * worldScale);
      syncCamera();
    } else {
      cameraY = clampCameraY((cameraMinY + cameraMaxY) / 2);
      syncCamera();
    }
  };

  const layout = (): void => {
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    const previousRange = cameraMinY - cameraMaxY;
    const previousProgress = laidOut && previousRange !== 0 ? (cameraY - cameraMaxY) / previousRange : .28;
    runtime.syncResolution();
    app.renderer.resize(width, height);
    host.dataset.canvasCssSize = `${width}x${height}`;
    host.dataset.rendererLogicalSize = `${app.renderer.width}x${app.renderer.height}`;
    host.dataset.rendererPhysicalSize = `${app.canvas.width}x${app.canvas.height}`;
    host.dataset.rendererResolution = String(app.renderer.resolution);
    host.dataset.devicePixelRatio = String(window.devicePixelRatio);
    worldScale = width / KINGDOM_WORLD.width;
    updateCameraBounds(width, height);

    const topmostBuildingY = buildingsLayer.getLocalBounds().y;
    host.dataset.activeBoundsTop = String(Math.round(topmostBuildingY));
    host.dataset.activeBoundsBottom = String(Math.round(buildingsLayer.getLocalBounds().bottom));

    const castleFocusCameraY = height * .49 - KINGDOM_COMPOSITION_FOCUS_Y * worldScale * zoom;
    cameraY = laidOut
      ? clampCameraY(cameraMaxY + (cameraMinY - cameraMaxY) * previousProgress)
      : clampCameraY(castleFocusCameraY);
    cameraX = clampCameraX(cameraX);
    syncCamera();
    laidOut = true;
  };

  const activePointers = new Map<number, { x: number; y: number }>();
  let initialPinchDistance = 0;
  let initialPinchZoom = 1.0;
  let dragStartX = 0;
  let dragStartY = 0;
  let cameraStartX = 0;
  let cameraStartY = 0;
  let lastTapTime = 0;
  let primaryPointerId: number | null = null;
  const canvas = app.canvas;

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointers.size === 1) {
      primaryPointerId = event.pointerId;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      cameraStartX = cameraX;
      cameraStartY = cameraY;
      didPan = false;
      canvas.setPointerCapture(event.pointerId);
    } else if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      initialPinchDistance = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      initialPinchZoom = zoom;
      didPan = true;
    }
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!activePointers.has(event.pointerId)) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointers.size === 2 && initialPinchDistance > 10) {
      const pts = Array.from(activePointers.values());
      const currentDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const targetZoom = initialPinchZoom * (currentDist / initialPinchDistance);
      setZoom(targetZoom);
      return;
    }

    if (event.pointerId !== primaryPointerId) return;
    const deltaX = event.clientX - dragStartX;
    const deltaY = event.clientY - dragStartY;
    if (Math.abs(deltaX) > 7 || Math.abs(deltaY) > 7) didPan = true;
    if (!didPan) return;

    if (cameraMinX < cameraMaxX) {
      cameraX = clampCameraX(cameraStartX + deltaX);
    }
    cameraY = clampCameraY(cameraStartY + deltaY);
    syncCamera();
  };

  const onPointerUp = (event: PointerEvent): void => {
    activePointers.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);

    if (event.pointerId === primaryPointerId) {
      primaryPointerId = null;
      const now = Date.now();
      if (!didPan && now - lastTapTime < 320) {
        toggleOverview();
        lastTapTime = 0;
      } else {
        lastTapTime = now;
      }
    }
  };

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const zoomFactor = event.deltaY > 0 ? 0.92 : 1.08;
    setZoom(zoom * zoomFactor);
  };

  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ambientPaused = document.visibilityState === 'hidden';
  const syncAmbientMotionState = (): void => {
    host.dataset.ambientMotion = reducedMotion ? 'reduced' : ambientPaused ? 'paused' : 'active';
    host.dataset.heroMotion = reducedMotion ? 'reduced' : ambientPaused ? 'paused' : 'active';
  };
  const onVisibilityChange = (): void => { ambientPaused = document.visibilityState === 'hidden'; syncAmbientMotionState(); };
  document.addEventListener('visibilitychange', onVisibilityChange);
  syncAmbientMotionState();
  const startTransformation = (id: BuildingId, previousLevel: number, nextLevel: number): void => {
    const transition = getUpgradeTransition(previousLevel, nextLevel, reducedMotion);
    const item = artwork.get(id);
    if (!item || transition.durationMs === 0) {
      if (item) item.transformation.visible = false;
      return;
    }
    item.transformation.visible = true;
    item.transformation.alpha = 0;
    item.transformation.scale.set(.84);
    transformationAnimation.set(id, { durationMs: transition.durationMs, elapsedMs: 0, major: transition.major });
  };
  const animate = (ticker: Ticker): void => {
    elapsed += ticker.deltaMS / 1_000;
    if (!ambientPaused) {
      ambientLife.update(elapsed);
      heroPresence.update(ticker.deltaMS, elapsed);
    }
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
      const unlockElapsed = unlockAnimation.get(id as BuildingId);
      if (unlockElapsed !== undefined) {
        const next = unlockElapsed + ticker.deltaMS;
        const layoutEntry = KINGDOM_BUILDING_LAYOUT.find((building) => building.id === id);
        const expansion = EXPANSION_PRESENTATION_BY_BUILDING[id as BuildingId];
        const duration = expansion?.revealDurationMs ?? 600;
        if (layoutEntry) {
          const progress = Math.min(1, Math.max(0, next / duration - .24) / .76);
          const eased = 1 - (1 - progress) ** 3;
          item.container.alpha = eased;
          item.container.scale.set(layoutEntry.scale * (.9 + eased * .1));
        }
        if (next >= duration) {
          unlockAnimation.delete(id as BuildingId);
          if (layoutEntry) item.container.scale.set(layoutEntry.scale);
          item.container.alpha = 1;
          item.container.eventMode = 'static';
        }
        else unlockAnimation.set(id as BuildingId, next);
      }
      const transformation = transformationAnimation.get(id as BuildingId);
      if (transformation) {
        const nextElapsed = transformation.elapsedMs + ticker.deltaMS;
        const progress = Math.min(1, nextElapsed / transformation.durationMs);
        const wave = Math.sin(progress * Math.PI);
        item.transformation.visible = true;
        item.transformation.alpha = wave * (transformation.major ? 1 : .72);
        item.transformation.scale.set(.84 + wave * (transformation.major ? .3 : .18));
        item.sprite.alpha = .72 + (1 - wave) * .28;
        if (progress >= 1) {
          transformationAnimation.delete(id as BuildingId);
          item.transformation.visible = false;
          item.transformation.alpha = 0;
          item.transformation.scale.set(1);
          item.sprite.alpha = 1;
        } else {
          transformationAnimation.set(id as BuildingId, { ...transformation, elapsedMs: nextElapsed });
        }
      }
    }
    for (const [id, area] of expansionArtwork) {
      const animationElapsed = expansionAnimation.get(id);
      if (animationElapsed === undefined) continue;
      const presentation = EXPANSION_PRESENTATION_BY_BUILDING[id];
      const next = animationElapsed + ticker.deltaMS;
      const progress = Math.min(1, next / (presentation?.revealDurationMs ?? 900));
      area.environment.alpha = Math.min(1, progress / .55);
      area.mist.alpha = Math.max(0, 1 - progress / .72);
      area.mist.y = -progress * 10;
      if (progress >= 1) {
        expansionAnimation.delete(id);
        area.environment.alpha = 1;
        area.mist.alpha = 0;
      } else expansionAnimation.set(id, next);
    }
    syncStatusPositions();
  };
  if (!reducedMotion) app.ticker.add(animate);

  const syncLivingPopulation = (): void => {
    const ambientStates = Object.fromEntries(Object.entries(desiredStates).map(([id, state]) => [id, {
      level: state?.level ?? 1,
      unlocked: state?.locked === false,
      upgrading: state?.indicator === 'active',
    }]));
    const heroes = deriveKingdomHeroPresences(currentArmy, desiredStates);
    heroPresenceCount = heroes.length;
    heroPresence.setHeroes(heroes);
    const visibleAmbientActors = ambientLife.setProgression(ambientStates, 14 - heroPresenceCount);
    host.dataset.ambientActorCount = String(visibleAmbientActors.length);
    host.dataset.ambientActorIds = visibleAmbientActors.join(',');
    host.dataset.heroPresenceCount = String(heroPresenceCount);
    host.dataset.heroPresenceKeys = heroes.map((hero) => hero.key).join(',');
    host.dataset.heroWorldAssets = heroes.map((hero) => hero.worldAsset).join(',');
    host.dataset.worldActorCount = String(visibleAmbientActors.length + heroPresenceCount);
    host.dataset.ambientMilestones = Object.entries(desiredStates)
      .filter(([, state]) => state?.locked === false)
      .map(([id, state]) => `${id}:${buildingActivityMilestone(state?.level ?? 1)}`)
      .join(',');
    host.dataset.activeConstructionActors = String(Object.values(desiredStates).filter((state) => state?.locked === false && state.indicator === 'active').length);
  };

  let resizeFrame = 0;
  const resizeObserver = new ResizeObserver(() => {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(layout);
  });
  resizeObserver.observe(host);
  layout();

  return {
    select: (buildingId) => { selectedBuildingId = buildingId; syncSelection(); },
    setLocale: (nextLocale) => {
      locale = nextLocale;
      for (const [id, status] of statusArtwork) drawBuildingStatusBadge(status, levelById.get(id) ?? 1, app.renderer.resolution, locale);
    },
    setBuildingStates: (states, expansionStage) => {
      desiredStates = states;
      syncExpansionAreas(states, expansionStage);
      syncLivingPopulation();
      for (const building of KINGDOM_BUILDING_LAYOUT) {
        const id = building.id;
        const state = states[id];
        if (!state) {
          removeBuilding(id);
          continue;
        }
        const unlocked = state?.locked === false;
        const previouslyUnlocked = knownUnlockState.get(id);
        knownUnlockState.set(id, unlocked);
        if (!unlocked) {
          removeBuilding(id);
          continue;
        }
        const indicator = indicatorArtwork.get(id);
        if (!indicator) {
          void mountBuilding(building, state, previouslyUnlocked === false);
          continue;
        }
        drawBuildingUpgradeIndicator(indicator, state.indicator);
        const item = artwork.get(id);
        const previousLevel = levelById.get(id) ?? state.level;
        const visualState = resolveEvolutionState(id, state.level);
        const desiredTexturePath = visualState?.asset ?? resolveBuildingTexture(id, appearanceVariantStage(state.appearanceVariant));
        const levelAdvanced = state.level > previousLevel;
        levelById.set(id, state.level);
        if (item && visualState) applyBuildingVisualState(item, visualState.buildingId, visualState, state.indicator === 'active');
        if (item && texturePathById.get(id) !== desiredTexturePath) {
          texturePathById.set(id, desiredTexturePath);
          void Assets.load(desiredTexturePath).then((nextTexture) => {
            if (texturePathById.get(id) !== desiredTexturePath) return;
            item.sprite.texture = nextTexture;
            if (visualState) applyBuildingVisualState(item, visualState.buildingId, visualState, state.indicator === 'active');
            if (levelAdvanced) startTransformation(id, previousLevel, state.level);
          });
        } else if (item && levelAdvanced) {
          startTransformation(id, previousLevel, state.level);
        }
        const status = statusArtwork.get(id);
        if (status) drawBuildingStatusBadge(status, state.level, app.renderer.resolution, locale);
      }
    },
    setArmyState: (army) => {
      currentArmy = army;
      syncLivingPopulation();
    },
    playRaidReturn: (presentation, onComplete) => {
      host.dataset.raidReturn = presentation.outcome.toLowerCase();
      host.dataset.raidReturnLootCart = String(presentation.outcome === 'VICTORY');
      heroPresence.playReturn(presentation, reducedMotion, () => {
        host.dataset.raidReturn = 'complete';
        onComplete();
      });
    },
    toggleOverview,
    setZoom,
    destroy: () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(resizeFrame);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (!reducedMotion) app.ticker.remove(animate);
      world.removeChild(ambientLife.container);
      ambientLife.destroy();
      world.removeChild(heroPresence.container, heroPresence.returnContainer);
      heroPresence.destroy();
      runtime.destroy();
    },
  };
}

function resolveEvolutionState(id: BuildingId, level: number): BuildingVisualState | undefined {
  return isEvolutionBuilding(id)
    ? getBuildingVisualState({ buildingId: id, level, theme: DEFAULT_KINGDOM_THEME })
    : undefined;
}

function artOffset(id: WorldBuildingId): number {
  return ['castle', 'farm', 'lumberMill', 'mine', 'grandMarket', 'barracks', 'blacksmith', 'academy', 'granary', 'watchtower', 'workshop', 'tavern', 'stable'].indexOf(id) * .7;
}

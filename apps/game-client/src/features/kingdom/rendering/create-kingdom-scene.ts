import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import type { Ticker } from 'pixi.js';
import type { BuildingAppearanceVariant, KingdomExpansionStage } from '@crown-and-coin/shared';
import { createPixiRuntime } from '@/game/rendering/pixi-runtime';
import { KINGDOM_BUILDING_LAYOUT, KINGDOM_WORLD } from '../data/building-layout';
import type { BuildingId, WorldBuildingId } from '../domain/kingdom-types';
import { DEFAULT_KINGDOM_THEME } from '../domain/kingdom-theme';
import { applyBuildingVisualState, createBuildingArtwork, type BuildingArtwork } from './building-art';
import { appearanceVariantStage, BUILDING_VISUALS, resolveBuildingTexture } from './building-visuals';
import {
  getBuildingVisualState,
  getUpgradeTransition,
  isCoreEvolutionBuilding,
  type BuildingVisualState,
} from './building-visual-progression';
import { KINGDOM_EXPANSION_PRESENTATIONS, EXPANSION_PRESENTATION_BY_BUILDING } from '../data/kingdom-expansion-stages';
import { createExpansionAreaArtwork, type ExpansionAreaArtwork } from './expansion-area-art';

interface KingdomSceneRuntime {
  destroy(): void;
  select(buildingId: WorldBuildingId | null): void;
  setBuildingStates(states: Partial<Record<BuildingId, BuildingSceneState>>, expansionStage: KingdomExpansionStage): void;
}

export type BuildingIndicator = 'upgrade' | 'active' | null;
export interface BuildingSceneState {
  indicator: BuildingIndicator;
  level: number;
  locked: boolean;
  appearanceVariant: BuildingAppearanceVariant;
}

const TERRAIN_TEXTURE = '/assets/kingdom/terrain/kingdom-base-v3.webp';
const CASTLE_FOCUS_Y = 690;

export async function createKingdomScene(host: HTMLDivElement, onSelect: (buildingId: WorldBuildingId) => void): Promise<KingdomSceneRuntime> {
  const runtime = await createPixiRuntime(host);
  const { app } = runtime;
  const searchParams = new URLSearchParams(window.location.search);
  const debugBuildingLayout = searchParams.get('debugBuildingLayout') === '1';
  const debugKingdomLayers = searchParams.get('debugKingdomLayers');
  const texture = await Assets.load(TERRAIN_TEXTURE);
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

  const expansionLayer = new Container();
  world.addChild(expansionLayer);
  const buildingsLayer = new Container();
  buildingsLayer.sortableChildren = true;
  world.addChild(buildingsLayer);
  const artwork = new Map<WorldBuildingId, BuildingArtwork>();
  const indicatorArtwork = new Map<BuildingId, Graphics>();
  const statusArtwork = new Map<BuildingId, Container>();
  const knownUnlockState = new Map<BuildingId, boolean>();
  const texturePathById = new Map<BuildingId, string>();
  const levelById = new Map<BuildingId, number>();
  const transformationAnimation = new Map<BuildingId, { durationMs: number; elapsedMs: number; major: boolean }>();
  const unlockAnimation = new Map<BuildingId, number>();
  const expansionArtwork = new Map<BuildingId, ExpansionAreaArtwork>();
  const expansionAnimation = new Map<BuildingId, number>();
  let desiredStates: Partial<Record<BuildingId, BuildingSceneState>> = {};
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
    indicatorArtwork.delete(id);
    statusArtwork.delete(id);
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
    const indicator = createIndicator();
    const status = new Container();
    const indicatorAnchor = BUILDING_VISUALS[building.id].indicatorAnchor;
    indicator.position.copyFrom(indicatorAnchor);
    status.position.copyFrom(BUILDING_VISUALS[building.id].lockAnchor);
    buildingArt.container.addChild(indicator);
    buildingArt.container.addChild(status);
    buildingArt.container.visible = debugKingdomLayers !== 'terrain'
      && (debugKingdomLayers !== 'castle' || building.id === 'castle');
    indicatorArtwork.set(building.id, indicator);
    statusArtwork.set(building.id, status);
    texturePathById.set(building.id, desiredTexturePath);
    levelById.set(building.id, currentState.level);
    registerBuilding(building.id, building.groundX, building.groundY, building.scale, buildingArt);
    drawIndicator(indicator, currentState.indicator);
    drawBuildingStatus(status, currentState.level);
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
    host.dataset.activeBoundsTop = String(Math.round(topmostBuildingY));
    host.dataset.activeBoundsBottom = String(Math.round(buildingsLayer.getLocalBounds().bottom));
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
    setBuildingStates: (states, expansionStage) => {
      desiredStates = states;
      syncExpansionAreas(states, expansionStage);
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
        drawIndicator(indicator, state.indicator);
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
        if (status) drawBuildingStatus(status, state.level);
      }
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

function resolveEvolutionState(id: BuildingId, level: number): BuildingVisualState | undefined {
  return isCoreEvolutionBuilding(id)
    ? getBuildingVisualState({ buildingId: id, level, theme: DEFAULT_KINGDOM_THEME })
    : undefined;
}

function drawBuildingStatus(status: Container, level: number): void {
  status.removeChildren().forEach((child) => child.destroy());
  const color = 0xe2b447;
  const width = 30;
  const background = new Graphics()
    .roundRect(-width / 2, -10, width, 20, 7)
    .fill({ color: 0x17140f, alpha: .94 })
    .stroke({ color, alpha: .9, width: 1.5 });
  status.addChild(background);
  const text = new Text({
    text: `Lv.${level}`,
    style: { fill: 0xffe7a1, fontFamily: 'Arial', fontSize: 8, fontWeight: '700' },
  });
  text.anchor.set(.5);
  status.addChild(text);
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

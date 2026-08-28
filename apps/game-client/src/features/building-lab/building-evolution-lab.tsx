'use client';

import { useEffect, useRef, useState } from 'react';
import { DEFAULT_KINGDOM_THEME } from '@/features/kingdom/domain/kingdom-theme';
import type { CoreEvolutionBuildingId } from '@/features/kingdom/rendering/building-visual-progression';
import { getBuildingVisualState } from '@/features/kingdom/rendering/building-visual-progression';
import styles from './building-evolution-lab.module.css';

const BUILDINGS: readonly { id: CoreEvolutionBuildingId; label: string }[] = [
  { id: 'castle', label: 'Castle' },
  { id: 'farm', label: 'Farm' },
  { id: 'lumberMill', label: 'Lumber Mill' },
  { id: 'mine', label: 'Mine' },
  { id: 'grandMarket', label: 'Grand Market' },
];
const QUICK_LEVELS = [1, 5, 9, 13, 17, 20] as const;
const BADGE_LEVELS = [1, 8, 12, 20] as const;
const INSPECTION_ZOOMS = [1, 1.5, 2] as const;

export function BuildingEvolutionLab() {
  const [buildingId, setBuildingId] = useState<CoreEvolutionBuildingId>('castle');
  const [level, setLevel] = useState(1);
  const [mode, setMode] = useState<'single' | 'adjacent' | 'extremes'>('single');
  const [construction, setConstruction] = useState(false);
  const [inspectionZoom, setInspectionZoom] = useState<(typeof INSPECTION_ZOOMS)[number]>(1);
  const state = getBuildingVisualState({ buildingId, level, theme: DEFAULT_KINGDOM_THEME });
  const comparisons = mode === 'single'
    ? [level]
    : mode === 'adjacent'
      ? [level, Math.min(20, level + 1)]
      : [1, 20];

  return (
    <main className={styles.lab} data-kingdom-theme={state.theme}>
      <header className={styles.header}>
        <div>
          <p>Development tool · production renderer</p>
          <h1>Building Evolution Lab</h1>
        </div>
        <div className={styles.stateBadge}>
          <span>Tier {state.tierNumber}</span>
          <strong>{state.tier}</strong>
          <small>Theme {state.theme}</small>
          <small>Minor step {state.minorStep}{state.capstone ? ' · MAX' : ''}</small>
        </div>
      </header>

      <section className={styles.controls} aria-label="Building evolution controls">
        <label>
          Building
          <select value={buildingId} onChange={(event) => setBuildingId(event.target.value as CoreEvolutionBuildingId)}>
            {BUILDINGS.map((building) => <option key={building.id} value={building.id}>{building.label}</option>)}
          </select>
        </label>
        <label className={styles.slider}>
          <span>Level <b>{level}</b></span>
          <input min="1" max="20" type="range" value={level} onChange={(event) => setLevel(Number(event.target.value))} />
        </label>
        <div className={styles.quick}>
          {QUICK_LEVELS.map((quickLevel) => (
            <button aria-pressed={level === quickLevel} key={quickLevel} onClick={() => setLevel(quickLevel)} type="button">{quickLevel}</button>
          ))}
        </div>
        <div className={styles.stepper}>
          <button disabled={level <= 1} onClick={() => setLevel((current) => Math.max(1, current - 1))} type="button">Previous level</button>
          <button disabled={level >= 20} onClick={() => setLevel((current) => Math.min(20, current + 1))} type="button">Next level</button>
        </div>
        <div className={styles.mode}>
          <button aria-pressed={mode === 'single'} onClick={() => setMode('single')} type="button">Single</button>
          <button aria-pressed={mode === 'adjacent'} onClick={() => setMode('adjacent')} type="button">N vs N+1</button>
          <button aria-pressed={mode === 'extremes'} onClick={() => setMode('extremes')} type="button">1 vs 20</button>
          <button aria-pressed={construction} onClick={() => setConstruction((current) => !current)} type="button">Construction</button>
        </div>
        <div className={styles.inspection}>
          <span>Inspection</span>
          {INSPECTION_ZOOMS.map((zoom) => (
            <button aria-pressed={inspectionZoom === zoom} key={zoom} onClick={() => setInspectionZoom(zoom)} type="button">
              {Math.round(zoom * 100)}%
            </button>
          ))}
        </div>
      </section>

      <section className={comparisons.length === 1 ? styles.stageSingle : styles.stageCompare}>
        {comparisons.map((comparisonLevel, index) => (
          <BuildingPreview
            buildingId={buildingId}
            construction={construction}
            key={`${buildingId}-${comparisonLevel}-${index}`}
            level={comparisonLevel}
            inspectionZoom={inspectionZoom}
          />
        ))}
      </section>

      <section className={styles.badgeLab} aria-label="Production building badge checks">
        <header>
          <div><p>Exact production renderer</p><h2>Building badge fidelity</h2></div>
          <span>Lv. 1 / 8 / 12 / 20 · 320px and 390px viewport equivalents</span>
        </header>
        <div className={styles.badgeViewports}>
          <BadgeViewportPreview viewportWidth={320} />
          <BadgeViewportPreview viewportWidth={390} />
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Asset: {state.asset}</span>
        <span>Details: {state.detailIds.length ? state.detailIds.join(', ') : 'base stage only'}</span>
      </footer>
    </main>
  );
}

function BuildingPreview({
  buildingId,
  construction,
  inspectionZoom,
  level,
}: {
  buildingId: CoreEvolutionBuildingId;
  construction: boolean;
  inspectionZoom: number;
  level: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const state = getBuildingVisualState({ buildingId, level, theme: DEFAULT_KINGDOM_THEME });

  useEffect(() => {
    const host = hostRef.current;
    let disposed = false;
    let observer: ResizeObserver | null = null;
    let runtime: Awaited<ReturnType<typeof import('@/game/rendering/pixi-runtime').createPixiRuntime>> | null = null;
    if (!host) return;
    void Promise.all([
      import('@/game/rendering/pixi-runtime'),
      import('@/features/kingdom/rendering/building-art'),
      import('@/features/kingdom/rendering/building-status-badge'),
      import('@/features/kingdom/rendering/building-visuals'),
      import('pixi.js'),
    ]).then(async ([
      { createPixiRuntime },
      { createBuildingArtwork },
      { calculateBuildingStatusPosition, createBuildingStatusBadge },
      { BUILDING_VISUALS },
      { Assets },
    ]) => {
      const localRuntime = await createPixiRuntime(host);
      runtime = localRuntime;
      const texture = await Assets.load(state.asset);
      if (disposed) {
        if (runtime === localRuntime) {
          localRuntime.destroy();
          runtime = null;
        }
        return;
      }
      const artwork = createBuildingArtwork(buildingId, texture, false, state, construction);
      const badge = createBuildingStatusBadge(level, localRuntime.app.renderer.resolution);
      const resize = () => {
        const width = Math.max(host.clientWidth, 1);
        const height = Math.max(host.clientHeight, 1);
        localRuntime.app.renderer.resize(width, height);
        const fit = Math.min(1.75, width / 270, height / 300) * inspectionZoom;
        artwork.container.scale.set(fit);
        artwork.container.position.set(width / 2, height * .84);
        const badgePosition = calculateBuildingStatusPosition({
          anchor: BUILDING_VISUALS[buildingId].lockAnchor,
          buildingPosition: artwork.container.position,
          buildingScale: fit,
          resolution: localRuntime.app.renderer.resolution,
          worldPosition: { x: 0, y: 0 },
          worldScale: 1,
        });
        badge.position.set(badgePosition.x, badgePosition.y);
      };
      localRuntime.app.stage.addChild(artwork.container, badge);
      observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();
      host.dataset.buildingId = buildingId;
      host.dataset.buildingLevel = String(level);
      host.dataset.visualState = `${state.tier}:${state.minorStep}:${state.capstone ? 'capstone' : 'standard'}`;
    });
    return () => {
      disposed = true;
      observer?.disconnect();
      runtime?.destroy();
      runtime = null;
    };
  }, [buildingId, construction, inspectionZoom, level, state.asset, state.capstone, state.minorStep, state.tier]);

  return (
    <article className={styles.preview}>
      <header><span>Level {level}</span><b>{state.tier}</b><small>step {state.minorStep}{state.capstone ? ' · MAX' : ''}</small></header>
      <div className={styles.canvas} ref={hostRef} />
    </article>
  );
}

function BadgeViewportPreview({ viewportWidth }: { viewportWidth: 320 | 390 }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    let disposed = false;
    let runtime: Awaited<ReturnType<typeof import('@/game/rendering/pixi-runtime').createPixiRuntime>> | null = null;
    if (!host) return;
    void Promise.all([
      import('@/game/rendering/pixi-runtime'),
      import('@/features/kingdom/rendering/building-status-badge'),
    ]).then(async ([{ createPixiRuntime }, { createBuildingStatusBadge }]) => {
      const localRuntime = await createPixiRuntime(host);
      runtime = localRuntime;
      if (disposed) {
        localRuntime.destroy();
        runtime = null;
        return;
      }
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      localRuntime.app.renderer.resize(width, height);
      BADGE_LEVELS.forEach((badgeLevel, index) => {
        const badge = createBuildingStatusBadge(badgeLevel, localRuntime.app.renderer.resolution);
        badge.position.set((index + .5) * width / BADGE_LEVELS.length, height / 2);
        localRuntime.app.stage.addChild(badge);
      });
      localRuntime.app.render();
      host.dataset.badgeLevels = BADGE_LEVELS.join(',');
      host.dataset.viewportEquivalent = String(viewportWidth);
    });
    return () => {
      disposed = true;
      runtime?.destroy();
      runtime = null;
    };
  }, [viewportWidth]);

  return (
    <article className={styles.badgeViewport} style={{ width: `${viewportWidth}px` }}>
      <header><b>{viewportWidth}px</b><span>DPR-aware · screen-space</span></header>
      <div className={styles.badgeCanvas} ref={hostRef} />
    </article>
  );
}

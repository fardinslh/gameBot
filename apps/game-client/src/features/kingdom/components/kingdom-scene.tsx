'use client';

import { useEffect, useRef, useState } from 'react';
import type { BuildingId, WorldBuildingId } from '../domain/kingdom-types';
import type { KingdomBuildingView } from '../domain/kingdom-types';
import { FUTURE_BUILDING_LAYOUT, KINGDOM_BUILDING_LAYOUT } from '../data/building-layout';

interface KingdomSceneProps {
  buildingLabels: Record<WorldBuildingId, string>;
  buildings: KingdomBuildingView[];
  errorLabel: string;
  loadingLabel: string;
  onSelect(buildingId: WorldBuildingId): void;
  panLabel: string;
  selectedBuildingId: WorldBuildingId | null;
}

type SceneStatus = 'loading' | 'ready' | 'error';

export function KingdomScene({
  buildingLabels,
  buildings,
  errorLabel,
  loadingLabel,
  onSelect,
  panLabel,
  selectedBuildingId,
}: KingdomSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const buildingsRef = useRef(buildings);
  const sceneRef = useRef<Awaited<ReturnType<typeof import('../rendering/create-kingdom-scene').createKingdomScene>> | null>(null);
  const [status, setStatus] = useState<SceneStatus>('loading');

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    sceneRef.current?.select(selectedBuildingId);
  }, [selectedBuildingId]);

  useEffect(() => {
    buildingsRef.current = buildings;
    sceneRef.current?.setIndicators(Object.fromEntries(buildings.map((building) => [
      building.visualId,
      building.activeUpgrade ? 'active' : building.upgradeAvailability === 'CAN_UPGRADE' ? 'upgrade' : null,
    ])));
  }, [buildings]);

  useEffect(() => {
    const container = containerRef.current;
    let disposed = false;

    if (!container) return;

    void import('../rendering/create-kingdom-scene')
      .then(({ createKingdomScene }) => createKingdomScene(container, (id) => onSelectRef.current(id)))
      .then((scene) => {
        if (disposed) {
          scene.destroy();
          return;
        }
        sceneRef.current = scene;
        scene.setIndicators(Object.fromEntries(buildingsRef.current.map((building) => [
          building.visualId,
          building.activeUpgrade ? 'active' : building.upgradeAvailability === 'CAN_UPGRADE' ? 'upgrade' : null,
        ])));
        setStatus('ready');
      })
      .catch(() => {
        if (!disposed) setStatus('error');
      });

    return () => {
      disposed = true;
      sceneRef.current?.destroy();
      sceneRef.current = null;
    };
  }, []); // Pixi runtime is mounted once; refs/effects synchronize changing React state.

  return (
    <section className="kingdom-scene" aria-label={loadingLabel} data-scene-status={status}>
      <div className="kingdom-scene__canvas" ref={containerRef} />
      <div className="kingdom-scene__vignette" aria-hidden="true" />
      <div className="kingdom-pan-cue" aria-hidden="true"><span>↕</span>{panLabel}</div>
      <div className={`scene-status scene-status--${status}`} role="status">
        <span className="scene-status__rune" aria-hidden="true" />
        <span>{status === 'error' ? errorLabel : loadingLabel}</span>
      </div>
      <div className="sr-only" aria-label={loadingLabel}>
        {KINGDOM_BUILDING_LAYOUT.map((building) => (
          <button key={building.id} onClick={() => onSelect(building.id)} type="button">
            {buildingLabels[building.id]}
          </button>
        ))}
        {FUTURE_BUILDING_LAYOUT.map((building) => (
          <button key={building.id} onClick={() => onSelect(building.id)} type="button">
            {buildingLabels[building.id]}
          </button>
        ))}
      </div>
    </section>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import type { KingdomExpansionStage } from '@crown-and-coin/shared';
import type { BuildingId, WorldBuildingId } from '../domain/kingdom-types';
import type { KingdomBuildingView } from '../domain/kingdom-types';

interface KingdomSceneProps {
  buildingLabels: Record<WorldBuildingId, string>;
  buildings: KingdomBuildingView[];
  expansionStage: KingdomExpansionStage;
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
  expansionStage,
  errorLabel,
  loadingLabel,
  onSelect,
  panLabel,
  selectedBuildingId,
}: KingdomSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const buildingsRef = useRef(buildings);
  const expansionStageRef = useRef(expansionStage);
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
    expansionStageRef.current = expansionStage;
    sceneRef.current?.setBuildingStates(toSceneStates(buildings), expansionStage);
  }, [buildings, expansionStage]);

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
        scene.setBuildingStates(toSceneStates(buildingsRef.current), expansionStageRef.current);
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
        {buildings.filter((building) => building.unlocked).map((building) => (
          <button
            data-world-building-id={building.visualId}
            key={building.visualId}
            onClick={() => onSelect(building.visualId)}
            type="button"
          >
            {buildingLabels[building.visualId]}
          </button>
        ))}
      </div>
    </section>
  );
}

function toSceneStates(buildings: KingdomBuildingView[]) {
  return Object.fromEntries(buildings.map((building) => [
    building.visualId,
    {
      indicator: building.activeUpgrade ? 'active' as const : building.upgradeAvailability === 'CAN_UPGRADE' ? 'upgrade' as const : null,
      level: building.level,
      locked: !building.unlocked,
      appearanceVariant: building.appearanceVariant,
    },
  ]));
}

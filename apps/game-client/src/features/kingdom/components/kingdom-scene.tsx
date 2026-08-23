'use client';

import { useEffect, useRef, useState } from 'react';
import type { BuildingId } from '../domain/kingdom-types';
import { MOCK_KINGDOM_BUILDINGS } from '../data/mock-kingdom';

interface KingdomSceneProps {
  buildingLabels: Record<BuildingId, string>;
  errorLabel: string;
  loadingLabel: string;
  onSelect(buildingId: BuildingId): void;
  selectedBuildingId: BuildingId | null;
}

type SceneStatus = 'loading' | 'ready' | 'error';

export function KingdomScene({
  buildingLabels,
  errorLabel,
  loadingLabel,
  onSelect,
  selectedBuildingId,
}: KingdomSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const sceneRef = useRef<Awaited<ReturnType<typeof import('../rendering/create-kingdom-scene').createKingdomScene>> | null>(null);
  const [status, setStatus] = useState<SceneStatus>('loading');

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    sceneRef.current?.select(selectedBuildingId);
  }, [selectedBuildingId]);

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
  }, []);

  return (
    <section className="kingdom-scene" aria-label={loadingLabel} data-scene-status={status}>
      <div className="kingdom-scene__canvas" ref={containerRef} />
      <div className="kingdom-scene__vignette" aria-hidden="true" />
      <div className={`scene-status scene-status--${status}`} role="status">
        <span className="scene-status__rune" aria-hidden="true" />
        <span>{status === 'error' ? errorLabel : loadingLabel}</span>
      </div>
      <div className="sr-only" aria-label={loadingLabel}>
        {MOCK_KINGDOM_BUILDINGS.map((building) => (
          <button key={building.id} onClick={() => onSelect(building.id)} type="button">
            {buildingLabels[building.id]}
          </button>
        ))}
      </div>
    </section>
  );
}

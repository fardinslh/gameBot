'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ArmyResponse, TroopType } from '@crown-and-coin/shared';
import { fetchArmy, trainTroops } from '@/features/army/api/army-api';
import styles from './army-lab.module.css';

const LABELS: Record<TroopType, string> = {
  INFANTRY: 'Infantry',
  ARCHER: 'Archer',
  CAVALRY: 'Cavalry',
};

export function ArmyLab() {
  const [state, setState] = useState<ArmyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setState(await fetchArmy(signal));
      setError(null);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : 'Army request failed.');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const train = useCallback(async (troopType: TroopType) => {
    setBusy(true);
    try {
      setState(await trainTroops(troopType, 1));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Training failed.');
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <main className={styles.lab}>
      <header className={styles.header}>
        <div><p>Development only · authoritative API</p><h1>Army Foundation Lab</h1></div>
        <button disabled={busy} onClick={() => void load()} type="button">Refresh</button>
      </header>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <section className={styles.capacity} aria-label="Army capacity">
        <Metric label="Maximum" value={state?.capacity.maximum} />
        <Metric label="Ready" value={state?.capacity.ready} />
        <Metric label="Training" value={state?.capacity.training} />
        <Metric label="Available" value={state?.capacity.available} />
      </section>

      <section className={styles.grid} aria-label="Troops">
        {state?.troops.map((troop) => (
          <article className={styles.card} key={troop.type}>
            <span>{LABELS[troop.type]}</span>
            <strong>{troop.readyCount}</strong>
            <small>{troop.trainingSecondsPerUnit}s per unit</small>
            <small>{Object.entries(troop.trainingCostPerUnit).map(([resource, amount]) => `${amount} ${resource}`).join(' · ')}</small>
            <button disabled={busy || state.training !== null || state.capacity.available < 1} onClick={() => void train(troop.type)} type="button">
              Train 1
            </button>
          </article>
        ))}
      </section>

      <section className={styles.panel} aria-label="Active training">
        <h2>Training</h2>
        {state?.training
          ? <p>{LABELS[state.training.troopType]} × {state.training.quantity} · {state.training.remainingSeconds}s remaining</p>
          : <p>No active order</p>}
      </section>

      <section className={styles.panel} aria-label="Army formation">
        <h2>Formation</h2>
        <div className={styles.formation}>
          {state?.formation.slots.map((slot) => (
            <article key={slot.slot}>
              <span>Squad {slot.slot}</span>
              <b>{LABELS[slot.troopType]} × {slot.unitCount}</b>
              <small>{slot.commander.key} · Lv. {slot.commander.level} · {slot.commander.power} power</small>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.panel} aria-label="Available Commanders">
        <h2>Commanders</h2>
        <p>{state?.commanders.map((commander) => `${commander.key} Lv.${commander.level}`).join(' · ') ?? 'Loading…'}</p>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number | undefined }) {
  return <article><span>{label}</span><strong>{value ?? '—'}</strong></article>;
}

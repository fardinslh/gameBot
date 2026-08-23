'use client';

import type { HealthResponse } from '@crown-and-coin/shared';
import { Cloud, CloudOff, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

type ApiState = 'checking' | 'online' | 'offline';

interface ApiStatusProps {
  labels: Record<ApiState, string>;
}

export function ApiStatus({ labels }: ApiStatusProps) {
  const [state, setState] = useState<ApiState>('checking');

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4_000);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

    void fetch(`${apiUrl}/health`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Health request failed');
        return (await response.json()) as HealthResponse;
      })
      .then((health) => setState(health.status === 'ok' ? 'online' : 'offline'))
      .catch(() => setState('offline'))
      .finally(() => window.clearTimeout(timeout));

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  const Icon = state === 'online' ? Cloud : state === 'offline' ? CloudOff : LoaderCircle;

  return (
    <div className={`api-status api-status--${state}`} role="status" aria-live="polite">
      <Icon aria-hidden="true" className={state === 'checking' ? 'spin' : undefined} size={14} />
      <span>{labels[state]}</span>
    </div>
  );
}

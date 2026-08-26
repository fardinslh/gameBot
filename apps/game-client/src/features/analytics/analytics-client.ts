'use client';

import type { AnalyticsEventsRequest, AnalyticsEventsResponse, ClientAnalyticsEventInput } from '@crown-and-coin/shared';
import { boundAnalyticsQueue, reconcileAnalyticsQueue } from './analytics-queue';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const QUEUE_KEY = 'crown-analytics-queue-v1';
const SESSION_KEY = 'crown-analytics-session-v1';
const OPEN_KEY = 'crown-analytics-open-v1';

let locale = 'en';
let acquisitionSource = 'DIRECT';
let flushing = false;
let lastScreen: string | null = null;
let initialized = false;
let pendingScreen: 'KINGDOM' | 'HEROES' | 'RAID' | 'BATTLE' | 'DEFENSE_INBOX' | 'RESULT' | null = null;

function sessionId(): string {
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, created);
  return created;
}

function readQueue(): ClientAnalyticsEventInput[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(QUEUE_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? boundAnalyticsQueue(parsed as ClientAnalyticsEventInput[]) : [];
  } catch { return []; }
}

function writeQueue(queue: ClientAnalyticsEventInput[]): void {
  sessionStorage.setItem(QUEUE_KEY, JSON.stringify(boundAnalyticsQueue(queue)));
}

function sourceFromLocation(): string {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('utm_source') || params.get('utm_campaign') || 'DIRECT';
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_').slice(0, 100) || 'DIRECT';
}

export async function flushAnalytics(): Promise<void> {
  if (flushing) return;
  const queue = readQueue();
  if (queue.length === 0) return;
  flushing = true;
  try {
    const body: AnalyticsEventsRequest = { events: queue.slice(0, 20) };
    const response = await fetch(`${API_URL}/analytics/events`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true,
    });
    if (!response.ok) {
      if (response.status >= 400 && response.status < 500 && response.status !== 429) writeQueue(queue.slice(body.events.length));
      return;
    }
    const result = await response.json() as AnalyticsEventsResponse;
    writeQueue(reconcileAnalyticsQueue(readQueue(), result));
  } catch {
    // Analytics is best-effort and must never block gameplay.
  } finally { flushing = false; }
}

export function trackClientEvent(eventName: ClientAnalyticsEventInput['eventName'], properties: Record<string, unknown> = {}): void {
  const event: ClientAnalyticsEventInput = {
    eventId: crypto.randomUUID(), eventName, sessionId: sessionId(), locale,
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev', acquisitionSource,
    properties, clientOccurredAt: new Date().toISOString(),
  };
  writeQueue([...readQueue(), event]);
  void flushAnalytics();
}

export function trackScreen(screen: 'KINGDOM' | 'HEROES' | 'RAID' | 'BATTLE' | 'DEFENSE_INBOX' | 'RESULT'): void {
  if (!initialized) {
    pendingScreen = screen;
    return;
  }
  if (screen === lastScreen) return;
  lastScreen = screen;
  trackClientEvent('screen_opened', { screen });
}

export function initializeAnalytics(nextLocale: string): () => void {
  locale = nextLocale.slice(0, 16);
  acquisitionSource = sourceFromLocation();
  initialized = true;
  if (!sessionStorage.getItem(OPEN_KEY)) {
    sessionStorage.setItem(OPEN_KEY, '1');
    trackClientEvent('app_open');
  } else void flushAnalytics();
  if (pendingScreen) {
    const screen = pendingScreen;
    pendingScreen = null;
    trackScreen(screen);
  }

  let hiddenAt: number | null = document.hidden ? Date.now() : null;
  const onVisibility = (): void => {
    if (document.hidden) hiddenAt = Date.now();
    else {
      if (hiddenAt !== null && Date.now() - hiddenAt >= 30_000) trackClientEvent('app_resume', { hiddenSeconds: Math.floor((Date.now() - hiddenAt) / 1_000) });
      hiddenAt = null;
      void flushAnalytics();
    }
  };
  const onOnline = (): void => { void flushAnalytics(); };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('online', onOnline);
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('online', onOnline);
  };
}

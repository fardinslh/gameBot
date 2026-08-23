import { Injectable } from '@nestjs/common';
import { RaidError } from './raid.errors';

@Injectable()
export class RaidRateLimiter {
  private readonly windows = new Map<string, { startedAt: number; count: number }>();

  assert(player: string, action: 'overview' | 'search' | 'start' | 'battle'): void {
    const limit = action === 'search' ? 30 : action === 'start' ? 20 : 120;
    const key = `${player}:${action}`;
    const now = Date.now();
    const current = this.windows.get(key);
    if (!current || now - current.startedAt >= 60_000) {
      this.windows.set(key, { startedAt: now, count: 1 });
      return;
    }
    current.count += 1;
    if (current.count > limit) throw new RaidError('RATE_LIMITED', 'Too many Raid requests. Please wait a moment.');
  }
}


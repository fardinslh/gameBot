import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class AnalyticsRateLimiter {
  private readonly windows = new Map<string, { startedAt: number; count: number }>();

  assert(playerId: string): void {
    const now = Date.now();
    if (this.windows.size > 10_000) {
      for (const [key, window] of this.windows) if (now - window.startedAt >= 60_000) this.windows.delete(key);
    }
    const current = this.windows.get(playerId);
    if (!current || now - current.startedAt >= 60_000) {
      this.windows.set(playerId, { startedAt: now, count: 1 });
      return;
    }
    current.count += 1;
    if (current.count > 60) throw new HttpException('Analytics rate limit exceeded.', HttpStatus.TOO_MANY_REQUESTS);
  }
}

import { describe, expect, it, vi } from 'vitest';
import { LeaderboardService } from './leaderboard.service';
import type { PrismaService } from '../infrastructure/prisma/prisma.service';
import type { DevelopmentPlayerContext } from '../player/player-context.service';

describe('LeaderboardService', () => {
  it('returns top players, user rank, and season metadata', async () => {
    const mockPrisma = {
      platformAccount: {
        findUnique: vi.fn().mockResolvedValue({ playerId: 'player-1' }),
      },
      player: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'player-2',
            displayName: 'Supreme Ruler',
            trophies: 2800,
            isSystemOpponent: false,
            equippedProfileCrest: 'DEFAULT',
            kingdom: { level: 5, buildings: [{ level: 5 }] },
          },
          {
            id: 'player-1',
            displayName: 'Warden of Dawnkeep',
            trophies: 1250,
            isSystemOpponent: false,
            equippedProfileCrest: 'DEFAULT',
            kingdom: { level: 2, buildings: [{ level: 2 }] },
          },
        ]),
        findUnique: vi.fn(),
        count: vi.fn(),
      },
      season: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;

    const service = new LeaderboardService(mockPrisma);
    const context: DevelopmentPlayerContext = { platform: 'WEB', externalUserId: 'user-1' };
    const result = await service.getLeaderboard(context);

    expect(result.topPlayers).toHaveLength(2);
    expect(result.topPlayers[0].rank).toBe(1);
    expect(result.topPlayers[0].league).toBe('CHAMPION');
    expect(result.topPlayers[1].rank).toBe(2);
    expect(result.topPlayers[1].league).toBe('SILVER');
    expect(result.topPlayers[1].isCurrentPlayer).toBe(true);
    expect(result.currentPlayer?.rank).toBe(2);
    expect(result.currentPlayer?.league).toBe('SILVER');
    expect(result.season.seasonId).toMatch(/^season-\d+$/);
    expect(result.season.daysRemaining).toBeGreaterThan(0);
  });
});

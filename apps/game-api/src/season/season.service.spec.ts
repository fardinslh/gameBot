import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeasonStatus, TrophyLeague } from '@prisma/client';
import { SeasonService } from './season.service';
import { calculateTrophySoftReset, getSeasonName } from './season.config';

describe('SeasonService', () => {
  let service: SeasonService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      season: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      player: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      playerSeasonRecord: {
        upsert: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      guild: {
        findMany: vi.fn(),
      },
      resourceBalance: {
        update: vi.fn(),
      },
      economyTransaction: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(prisma)),
    };
    service = new SeasonService(prisma);
  });

  describe('Trophy Soft-Reset Rules', () => {
    it('does not reset trophies at or below 2000', () => {
      expect(calculateTrophySoftReset(500)).toBe(500);
      expect(calculateTrophySoftReset(1500)).toBe(1500);
      expect(calculateTrophySoftReset(2000)).toBe(2000);
    });

    it('compresses trophies above 2000 by 50%', () => {
      // 2600 (Champion): 2000 + 600 * 0.5 = 2300
      expect(calculateTrophySoftReset(2600)).toBe(2300);
      // 3000: 2000 + 1000 * 0.5 = 2500
      expect(calculateTrophySoftReset(3000)).toBe(2500);
    });
  });

  describe('Season Naming', () => {
    it('generates thematic season names with season number suffix', () => {
      expect(getSeasonName(1)).toBe('Season of the Iron Crown (Season 1)');
      expect(getSeasonName(2)).toBe('Season of the Crimson Blade (Season 2)');
    });
  });

  describe('getOrCreateCurrentSeason', () => {
    it('creates Season 1 if no active season exists', async () => {
      prisma.season.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      prisma.season.create.mockResolvedValueOnce({
        id: 's1',
        seasonNumber: 1,
        name: 'Season of the Iron Crown (Season 1)',
        status: SeasonStatus.ACTIVE,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 100000),
      });

      const season = await service.getOrCreateCurrentSeason();
      expect(season.seasonNumber).toBe(1);
      expect(prisma.season.create).toHaveBeenCalled();
    });

    it('returns existing active season without creating new one', async () => {
      prisma.season.findFirst.mockResolvedValueOnce({
        id: 's1',
        seasonNumber: 1,
        name: 'Season of the Iron Crown (Season 1)',
        status: SeasonStatus.ACTIVE,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 100000),
      });

      const season = await service.getOrCreateCurrentSeason();
      expect(season.seasonNumber).toBe(1);
      expect(prisma.season.create).not.toHaveBeenCalled();
    });
  });

  describe('getSeasonOverview', () => {
    it('returns player standing, projected rewards, and top guilds', async () => {
      prisma.season.findFirst.mockResolvedValue({
        id: 's1',
        seasonNumber: 1,
        name: 'Season of the Iron Crown (Season 1)',
        status: SeasonStatus.ACTIVE,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 100000),
      });

      prisma.player.findUnique.mockResolvedValue({
        id: 'p1',
        trophies: 2700,
        kingdom: { id: 'k1', level: 5 },
      });

      prisma.playerSeasonRecord.upsert.mockResolvedValue({
        id: 'rec1',
        peakTrophies: 2700,
      });

      prisma.playerSeasonRecord.findFirst.mockResolvedValue(null);
      prisma.guild.findMany.mockResolvedValue([
        { id: 'g1', name: 'Iron Vanguard', tag: '#IV01', emblem: 'swords', score: 3500 },
      ]);

      const overview = await service.getSeasonOverview('p1');
      expect(overview.currentSeason.seasonNumber).toBe(1);
      expect(overview.playerStanding.currentLeague).toBe('CHAMPION');
      expect(overview.playerStanding.projectedReward.gems).toBe(2500);
      expect(overview.topGuilds).toHaveLength(1);
    });
  });
});

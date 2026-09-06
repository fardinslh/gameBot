import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuildTreasuryService } from './guild-treasury.service';
import type { PrismaService } from '../infrastructure/prisma/prisma.service';

describe('GuildTreasuryService', () => {
  let service: GuildTreasuryService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      platformAccount: {
        findUnique: vi.fn(),
      },
      player: {
        findUnique: vi.fn(),
      },
      kingdom: {
        findUnique: vi.fn(),
      },
      guildMember: {
        findUnique: vi.fn(),
      },
      guild: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      guildPerk: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      guildTreasuryDonation: {
        create: vi.fn(),
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 15000n } }),
      },
      resourceBalance: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      economyTransaction: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
    };

    service = new GuildTreasuryService(mockPrisma as unknown as PrismaService);
  });

  describe('getTreasuryOverview', () => {
    it('throws BadRequestException if player is not in a guild', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);

      await expect(service.getTreasuryOverview('player-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns treasury overview with perks, progress, and caller permissions', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        playerId: 'player-1',
        role: 'LEADER',
        guild: {
          id: 'guild-1',
          name: 'The Iron Vanguard',
          level: 2,
          xp: 600,
          treasuryGold: 25000n,
          perks: [
            { perkType: 'GOLD_BOOST', level: 1 },
          ],
          treasuryDonations: [
            {
              id: 'don-1',
              donorId: 'player-1',
              amount: 5000n,
              createdAt: new Date('2026-09-06T12:00:00Z'),
              donor: { displayName: 'Lord Commander' },
            },
          ],
        },
      });

      const overview = await service.getTreasuryOverview('player-1');

      expect(overview.guildId).toBe('guild-1');
      expect(overview.guildLevel).toBe(2);
      expect(overview.guildXp).toBe(600);
      expect(overview.nextLevelXp).toBe(1500);
      expect(overview.canUpgradePerks).toBe(true);
      expect(overview.perks.length).toBe(4);

      const goldBoost = overview.perks.find((p) => p.type === 'GOLD_BOOST');
      expect(goldBoost).toBeDefined();
      expect(goldBoost?.currentLevel).toBe(1);
      expect(goldBoost?.currentBonusValue).toBe(5);
      // Level 2 gold boost requires Guild Level 3, but guild is level 2
      expect(goldBoost?.canUpgrade).toBe(false);
      expect(goldBoost?.lockReason).toBe('INSUFFICIENT_LEVEL');

      const warLoot = overview.perks.find((p) => p.type === 'WAR_LOOT_BONUS');
      expect(warLoot).toBeDefined();
      expect(warLoot?.currentLevel).toBe(0);
      // Level 1 requires Guild Level 2 and 10,000 Gold, treasury has 25,000
      expect(warLoot?.canUpgrade).toBe(true);
      expect(warLoot?.lockReason).toBeUndefined();
    });
  });

  describe('donateToTreasury', () => {
    it('throws BadRequestException for donations below minimum', async () => {
      await expect(
        service.donateToTreasury('player-1', { amount: '50' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if player has insufficient gold', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        playerId: 'player-1',
        guildId: 'guild-1',
      });
      mockPrisma.kingdom.findUnique.mockResolvedValue({
        id: 'kingdom-1',
        resourceBalances: [
          { id: 'b-gold', resource: 'GOLD', amount: 500n },
        ],
      });

      await expect(
        service.donateToTreasury('player-1', { amount: '1000' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('successfully deducts player gold, credits treasury, awards XP, and checks level up', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        playerId: 'player-1',
        guildId: 'guild-1',
      });
      mockPrisma.kingdom.findUnique.mockResolvedValue({
        id: 'kingdom-1',
        resourceBalances: [
          { id: 'b-gold', resource: 'GOLD', amount: 50000n },
        ],
      });
      mockPrisma.guild.update.mockResolvedValue({
        id: 'guild-1',
        treasuryGold: 30000n,
        xp: 1600,
        level: 3, // leveled up!
      });
      mockPrisma.resourceBalance.findMany.mockResolvedValue([
        { resource: 'GOLD', amount: 40000n },
        { resource: 'FOOD', amount: 10000n },
        { resource: 'WOOD', amount: 10000n },
        { resource: 'STONE', amount: 10000n },
        { resource: 'GEMS', amount: 500n },
      ]);

      const result = await service.donateToTreasury('player-1', { amount: '10000' });

      expect(result.treasuryGold).toBe('30000');
      expect(result.xpAwarded).toBe(100); // 10,000 / 100 = 100 XP
      expect(result.guildLevel).toBe(3);
      expect(result.playerBalances.GOLD).toBe('40000');

      expect(mockPrisma.resourceBalance.update).toHaveBeenCalledWith({
        where: { id: 'b-gold' },
        data: { amount: 40000n },
      });
      expect(mockPrisma.economyTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            delta: -10000n,
            reason: 'GUILD_TREASURY_DONATE',
          }),
        }),
      );
      expect(mockPrisma.guildTreasuryDonation.create).toHaveBeenCalledWith({
        data: {
          guildId: 'guild-1',
          donorId: 'player-1',
          amount: 10000n,
        },
      });
    });
  });

  describe('upgradePerk', () => {
    it('throws ForbiddenException if caller is not LEADER or OFFICER', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        playerId: 'player-1',
        role: 'MEMBER',
        guild: {
          id: 'guild-1',
          perks: [],
        },
      });

      await expect(
        service.upgradePerk('player-1', { perkType: 'GOLD_BOOST' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if guild level requirement is not met', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        playerId: 'player-1',
        role: 'OFFICER',
        guild: {
          id: 'guild-1',
          level: 1, // requires level 2 for DONATION_CAPACITY level 1
          treasuryGold: 50000n,
          perks: [],
        },
      });

      await expect(
        service.upgradePerk('player-1', { perkType: 'DONATION_CAPACITY' }),
      ).rejects.toThrow('Requires Guild Level 2');
    });

    it('throws BadRequestException if treasury funds are insufficient', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        playerId: 'player-1',
        role: 'LEADER',
        guild: {
          id: 'guild-1',
          level: 3,
          treasuryGold: 1000n, // requires 5000 for GOLD_BOOST level 1
          perks: [],
        },
      });

      await expect(
        service.upgradePerk('player-1', { perkType: 'GOLD_BOOST' }),
      ).rejects.toThrow('Insufficient treasury funds');
    });

    it('successfully upgrades perk and deducts treasury gold', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        playerId: 'player-1',
        role: 'LEADER',
        guild: {
          id: 'guild-1',
          level: 3,
          treasuryGold: 20000n,
          perks: [],
        },
      });

      mockPrisma.guild.update.mockResolvedValue({
        id: 'guild-1',
        level: 3,
        treasuryGold: 15000n, // 20000 - 5000
      });

      mockPrisma.guildPerk.upsert.mockResolvedValue({
        id: 'perk-1',
        guildId: 'guild-1',
        perkType: 'GOLD_BOOST',
        level: 1,
      });

      const response = await service.upgradePerk('player-1', { perkType: 'GOLD_BOOST' });

      expect(response.treasuryGold).toBe('15000');
      expect(response.perk.currentLevel).toBe(1);
      expect(response.perk.currentBonusValue).toBe(5);
      expect(response.perk.name).toBe('Royal Mint');
    });
  });

  describe('getPerkBonus', () => {
    it('returns 0 if perk is not unlocked', async () => {
      mockPrisma.guildPerk.findUnique.mockResolvedValue(null);

      const bonus = await service.getPerkBonus('guild-1', 'WAR_LOOT_BONUS');
      expect(bonus).toBe(0);
    });

    it('returns bonus value for active perk level', async () => {
      mockPrisma.guildPerk.findUnique.mockResolvedValue({
        guildId: 'guild-1',
        perkType: 'WAR_LOOT_BONUS',
        level: 2,
      });

      const bonus = await service.getPerkBonus('guild-1', 'WAR_LOOT_BONUS');
      expect(bonus).toBe(20); // Level 2 gives +20%
    });
  });
});

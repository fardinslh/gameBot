import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GuildScrimmageService } from './guild-scrimmage.service';
import { FriendlyChallengeStatus, GuildChatMessageType, TroopType } from '@prisma/client';

describe('GuildScrimmageService', () => {
  let service: GuildScrimmageService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      guildMember: {
        findUnique: vi.fn(),
      },
      guildFriendlyChallenge: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      guildChatMessage: {
        create: vi.fn(),
      },
      guildWarAttack: {
        findUnique: vi.fn(),
      },
      platformAccount: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
      player: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
    };
    service = new GuildScrimmageService(mockPrisma);
  });

  describe('getChallenges', () => {
    it('returns challenges list for alliance members', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({ guildId: 'guild-1' });
      mockPrisma.guildFriendlyChallenge.findMany.mockResolvedValue([
        {
          id: 'scrimmage-1',
          guildId: 'guild-1',
          creatorId: 'player-1',
          message: 'Can you defeat my castle?',
          status: FriendlyChallengeStatus.OPEN,
          attackerId: null,
          stars: null,
          destructionPct: null,
          createdAt: new Date('2026-09-06T10:00:00Z'),
          completedAt: null,
          creator: {
            displayName: 'Lord Defender',
            kingdom: { level: 4 },
          },
          attacker: null,
        },
      ]);

      const res = await service.getChallenges('player-2');
      expect(res.challenges).toHaveLength(1);
      expect(res.challenges[0].creatorName).toBe('Lord Defender');
      expect(res.challenges[0].status).toBe('OPEN');
    });

    it('throws NotFoundException if player not in guild', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);
      await expect(service.getChallenges('solo-player')).rejects.toThrow('not in an alliance');
    });
  });

  describe('postChallenge', () => {
    it('creates a challenge and posts a chat message with type SCRIMMAGE', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        guildId: 'guild-1',
        player: { displayName: 'Lord Arthur', kingdom: { level: 3 } },
        guild: { name: 'Knights of Valor' },
      });

      mockPrisma.guildFriendlyChallenge.create.mockResolvedValue({
        id: 'challenge-123',
        guildId: 'guild-1',
        creatorId: 'player-1',
        message: 'Try my anti-air base!',
        status: FriendlyChallengeStatus.OPEN,
        createdAt: new Date('2026-09-06T12:00:00Z'),
      });

      const res = await service.postChallenge('player-1', { message: 'Try my anti-air base!' });
      expect(res.id).toBe('challenge-123');
      expect(res.creatorName).toBe('Lord Arthur');
      expect(mockPrisma.guildChatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: GuildChatMessageType.SCRIMMAGE,
            metadata: { challengeId: 'challenge-123', creatorCastleLevel: 3 },
          }),
        }),
      );
    });
  });

  describe('acceptChallenge', () => {
    it('prevents creator from scrimmaging own base', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        guildId: 'guild-1',
        player: { displayName: 'Lord Arthur', kingdom: { level: 3 } },
        guild: { name: 'Knights' },
      });

      mockPrisma.guildFriendlyChallenge.findUnique.mockResolvedValue({
        id: 'challenge-123',
        guildId: 'guild-1',
        creatorId: 'player-1',
        status: FriendlyChallengeStatus.OPEN,
        creator: { displayName: 'Lord Arthur', kingdom: { level: 3 } },
      });

      await expect(service.acceptChallenge('player-1', 'challenge-123')).rejects.toThrow(
        'cannot scrimmage your own defense layout',
      );
    });

    it('simulates scrimmage attack and generates replay', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        guildId: 'guild-1',
        player: { displayName: 'Sir Lancelot', kingdom: { level: 4 } },
        guild: { name: 'Knights of Valor' },
      });

      mockPrisma.guildFriendlyChallenge.findUnique.mockResolvedValue({
        id: 'challenge-123',
        guildId: 'guild-1',
        creatorId: 'player-1',
        status: FriendlyChallengeStatus.OPEN,
        creator: { displayName: 'Lord Arthur', kingdom: { level: 3 } },
      });

      const res = await service.acceptChallenge('player-2', 'challenge-123');
      expect(res.challengeId).toBe('challenge-123');
      expect(res.stars).toBeGreaterThanOrEqual(1);
      expect(res.replay).toBeDefined();
      expect(res.replay.timelineEvents.length).toBeGreaterThan(0);
      expect(mockPrisma.guildChatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: GuildChatMessageType.SYSTEM,
          }),
        }),
      );
    });
  });

  describe('getReplay', () => {
    it('retrieves war attack replay', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({ guildId: 'guild-1', guild: { name: 'Titans' } });
      mockPrisma.guildFriendlyChallenge.findUnique.mockResolvedValue(null);
      mockPrisma.guildWarAttack.findUnique.mockResolvedValue({
        id: 'attack-999',
        stars: 3,
        destructionPct: 100,
        attacker: { displayName: 'Warrior One', kingdom: { level: 4 } },
        defender: { displayName: 'Defender Two', kingdom: { level: 3 } },
        attackerGuild: { name: 'Titans' },
        defenderGuild: { name: 'Rivals' },
        replayData: null,
      });

      const replay = await service.getReplay('player-1', 'attack-999');
      expect(replay.id).toBe('attack-999');
      expect(replay.attackerName).toBe('Warrior One');
      expect(replay.defenderName).toBe('Defender Two');
      expect(replay.stars).toBe(3);
      expect(replay.timelineEvents).toBeDefined();
    });
  });

  describe('resolvePlayerId', () => {
    it('resolves playerId from existing platform account', async () => {
      mockPrisma.platformAccount.findUnique.mockResolvedValue({ playerId: 'player-account-1' });

      const res = await service.resolvePlayerId({
        platform: 'WEB',
        externalUserId: 'ext-user-1',
      } as any);
      expect(res).toBe('player-account-1');
      expect(mockPrisma.platformAccount.findUnique).toHaveBeenCalledWith({
        where: {
          platform_externalUserId: {
            platform: 'WEB',
            externalUserId: 'ext-user-1',
          },
        },
        select: { playerId: true },
      });
    });

    it('resolves playerId from direct player id when platform account not found', async () => {
      mockPrisma.platformAccount.findUnique.mockResolvedValue(null);
      mockPrisma.player.findUnique.mockResolvedValue({ id: 'direct-player-id' });

      const res = await service.resolvePlayerId('direct-player-id');
      expect(res).toBe('direct-player-id');
      expect(mockPrisma.player.findUnique).toHaveBeenCalledWith({
        where: { id: 'direct-player-id' },
        select: { id: true },
      });
    });

    it('auto-creates player when account and direct player do not exist', async () => {
      mockPrisma.platformAccount.findUnique.mockResolvedValue(null);
      mockPrisma.player.findUnique.mockResolvedValue(null);
      mockPrisma.player.create.mockResolvedValue({ id: 'new-player-id' });

      const res = await service.resolvePlayerId('new-user-123');
      expect(res).toBe('new-player-id');
      expect(mockPrisma.player.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            displayName: 'Warden of Dawnkeep',
          }),
          select: { id: true },
        }),
      );
    });

    it('throws NotFoundException when player creation fails', async () => {
      mockPrisma.platformAccount.findUnique.mockResolvedValue(null);
      mockPrisma.player.findUnique.mockResolvedValue(null);
      mockPrisma.player.create.mockRejectedValue(new Error('DB connection failed'));

      await expect(service.resolvePlayerId('failed-user')).rejects.toThrow('Player account not found');
    });
  });
});


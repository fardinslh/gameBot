import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuildChatService } from './guild-chat.service';
import type { PrismaService } from '../infrastructure/prisma/prisma.service';

describe('GuildChatService', () => {
  let service: GuildChatService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      platformAccount: { findUnique: vi.fn() },
      player: { findUnique: vi.fn(), create: vi.fn() },
      guildMember: { findUnique: vi.fn(), findMany: vi.fn() },
      guild: { findUnique: vi.fn() },
      guildChatMessage: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      guildWarCallout: {
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
    };

    service = new GuildChatService(mockPrisma as unknown as PrismaService);
  });

  describe('getChatFeed', () => {
    it('throws BadRequestException if player is not in a guild', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue(null);

      await expect(service.getChatFeed('player-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns chat feed with messages, roles, and pinned announcement', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        playerId: 'player-1',
        guildId: 'guild-1',
        role: 'LEADER',
      });
      mockPrisma.guildChatMessage.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          guildId: 'guild-1',
          senderId: 'player-1',
          type: 'TEXT',
          content: 'Welcome to our alliance!',
          isPinned: false,
          createdAt: new Date('2026-09-06T12:00:00Z'),
          sender: { id: 'player-1', displayName: 'Lord Commander', equippedProfileCrest: 'DEFAULT' },
        },
      ]);
      mockPrisma.guildChatMessage.findFirst.mockResolvedValue({
        id: 'msg-pinned',
        guildId: 'guild-1',
        senderId: 'player-1',
        type: 'ANNOUNCEMENT',
        content: 'Battle Day is starting soon!',
        isPinned: true,
        createdAt: new Date('2026-09-06T12:05:00Z'),
        sender: { id: 'player-1', displayName: 'Lord Commander', equippedProfileCrest: 'DEFAULT' },
      });
      mockPrisma.guildMember.findMany.mockResolvedValue([
        { playerId: 'player-1', role: 'LEADER' },
      ]);

      const feed = await service.getChatFeed('player-1');

      expect(feed.messages).toHaveLength(1);
      expect(feed.messages[0].content).toBe('Welcome to our alliance!');
      expect(feed.messages[0].senderRole).toBe('LEADER');
      expect(feed.pinnedAnnouncement).toBeDefined();
      expect(feed.pinnedAnnouncement?.content).toBe('Battle Day is starting soon!');
      expect(feed.canPostAnnouncement).toBe(true);
    });
  });

  describe('sendMessage', () => {
    it('allows regular members to post standard text messages', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        playerId: 'player-2',
        guildId: 'guild-1',
        role: 'MEMBER',
        player: { displayName: 'Knight Arthur', equippedProfileCrest: 'DEFAULT' },
      });
      mockPrisma.guildChatMessage.create.mockResolvedValue({
        id: 'msg-2',
        guildId: 'guild-1',
        senderId: 'player-2',
        type: 'TEXT',
        content: 'Donated 5 archers!',
        isPinned: false,
        createdAt: new Date('2026-09-06T12:10:00Z'),
      });

      const message = await service.sendMessage('player-2', { content: 'Donated 5 archers!' });

      expect(message.content).toBe('Donated 5 archers!');
      expect(message.senderName).toBe('Knight Arthur');
      expect(message.type).toBe('TEXT');
      expect(mockPrisma.guildChatMessage.create).toHaveBeenCalled();
    });

    it('rejects regular members attempting to post announcements', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        playerId: 'player-2',
        guildId: 'guild-1',
        role: 'MEMBER',
        player: { displayName: 'Knight Arthur', equippedProfileCrest: 'DEFAULT' },
      });

      await expect(
        service.sendMessage('player-2', { content: 'Announcement!', isAnnouncement: true }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows officers to post pinned announcements and unpins old ones', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        playerId: 'officer-1',
        guildId: 'guild-1',
        role: 'OFFICER',
        player: { displayName: 'Captain Leo', equippedProfileCrest: 'DEFAULT' },
      });
      mockPrisma.guildChatMessage.create.mockResolvedValue({
        id: 'msg-ann',
        guildId: 'guild-1',
        senderId: 'officer-1',
        type: 'ANNOUNCEMENT',
        content: 'Focus on base 2 and 3!',
        isPinned: true,
        createdAt: new Date('2026-09-06T12:15:00Z'),
      });

      const message = await service.sendMessage('officer-1', {
        content: 'Focus on base 2 and 3!',
        isAnnouncement: true,
        isPinned: true,
      });

      expect(message.isPinned).toBe(true);
      expect(message.type).toBe('ANNOUNCEMENT');
      expect(mockPrisma.guildChatMessage.updateMany).toHaveBeenCalledWith({
        where: { guildId: 'guild-1', isPinned: true },
        data: { isPinned: false },
      });
    });
  });

  describe('setWarCallout', () => {
    it('allows a member to claim an enemy base for themselves', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        playerId: 'player-1',
        guild: { id: 'guild-1', currentWarId: 'war-1' },
        player: { displayName: 'Lord Commander' },
      });
      mockPrisma.guildWarCallout.upsert.mockResolvedValue({
        id: 'callout-1',
        warId: 'war-1',
        defenderPlayerId: 'enemy-1',
        baseNumber: 2,
        marker: 'TARGET_CALLOUT',
        claimedById: 'player-1',
        claimedBy: { displayName: 'Lord Commander' },
        assignedById: 'player-1',
        assignedBy: { displayName: 'Lord Commander' },
        notes: 'Hitting with cavalry',
        updatedAt: new Date(),
      });

      const result = await service.setWarCallout('player-1', {
        defenderPlayerId: 'enemy-1',
        baseNumber: 2,
        marker: 'TARGET_CALLOUT',
        claimedById: 'player-1',
        notes: 'Hitting with cavalry',
      });

      expect(result.baseNumber).toBe(2);
      expect(result.claimedByName).toBe('Lord Commander');
      expect(mockPrisma.guildChatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'SYSTEM',
          }),
        }),
      );
    });

    it('rejects regular members assigning targets to other clanmates', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        playerId: 'player-2',
        role: 'MEMBER',
        guild: { id: 'guild-1', currentWarId: 'war-1' },
        player: { displayName: 'Knight Arthur' },
      });

      await expect(
        service.setWarCallout('player-2', {
          defenderPlayerId: 'enemy-1',
          baseNumber: 1,
          marker: 'TARGET_CALLOUT',
          claimedById: 'other-player',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows officers to set priority markers', async () => {
      mockPrisma.guildMember.findUnique.mockResolvedValue({
        playerId: 'officer-1',
        role: 'OFFICER',
        guild: { id: 'guild-1', currentWarId: 'war-1' },
        player: { displayName: 'Captain Leo' },
      });
      mockPrisma.guildWarCallout.upsert.mockResolvedValue({
        id: 'callout-2',
        warId: 'war-1',
        defenderPlayerId: 'enemy-boss',
        baseNumber: 1,
        marker: 'ATTACK_PRIORITY',
        claimedById: null,
        claimedBy: null,
        assignedById: 'officer-1',
        assignedBy: { displayName: 'Captain Leo' },
        notes: 'Clear defenses first',
        updatedAt: new Date(),
      });

      const result = await service.setWarCallout('officer-1', {
        defenderPlayerId: 'enemy-boss',
        baseNumber: 1,
        marker: 'ATTACK_PRIORITY',
        notes: 'Clear defenses first',
      });

      expect(result.marker).toBe('ATTACK_PRIORITY');
    });
  });
});

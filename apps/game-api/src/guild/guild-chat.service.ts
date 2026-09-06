import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import type { DevelopmentPlayerContext } from '../player/player-context.service';
import type {
  SendGuildChatMessageDto,
  SetWarCalloutDto,
} from './guild-chat.dto';
import type {
  GuildChatFeedResponse,
  GuildChatMessageItem,
  GuildRole,
  GuildWarCalloutItem,
  ProfileCrestKey,
  WarRoomStrategyResponse,
} from '@crown-and-coin/shared';

@Injectable()
export class GuildChatService {
  constructor(private readonly prisma: PrismaService) {}

  async resolvePlayerId(context: DevelopmentPlayerContext): Promise<string> {
    const account = await this.prisma.platformAccount.findUnique({
      where: {
        platform_externalUserId: {
          platform: 'WEB',
          externalUserId: context.externalUserId,
        },
      },
      select: { playerId: true },
    });
    if (account) return account.playerId;

    const directPlayer = await this.prisma.player.findUnique({
      where: { id: context.externalUserId },
      select: { id: true },
    });
    if (directPlayer) return directPlayer.id;

    try {
      const created = await this.prisma.player.create({
        data: {
          displayName: 'Warden of Dawnkeep',
          platformAccounts: {
            create: {
              platform: 'WEB',
              externalUserId: context.externalUserId,
              verifiedAt: new Date(),
            },
          },
        },
        select: { id: true },
      });
      return created.id;
    } catch {
      throw new NotFoundException('Player account not found');
    }
  }

  /**
   * Fetch recent chat feed and pinned announcement for the player's guild.
   */
  async getChatFeed(playerId: string, limit = 50): Promise<GuildChatFeedResponse> {
    const membership = await this.prisma.guildMember.findUnique({
      where: { playerId },
      include: { guild: true },
    });

    if (!membership) {
      throw new BadRequestException('You must be a member of a guild to view the chat.');
    }

    const { guildId } = membership;
    const canPostAnnouncement = membership.role === 'LEADER' || membership.role === 'OFFICER';

    const [messagesData, pinnedData, membersData] = await Promise.all([
      this.prisma.guildChatMessage.findMany({
        where: { guildId },
        orderBy: { createdAt: 'asc' },
        take: limit,
        include: {
          sender: {
            select: {
              id: true,
              displayName: true,
              equippedProfileCrest: true,
            },
          },
        },
      }),
      this.prisma.guildChatMessage.findFirst({
        where: { guildId, isPinned: true },
        orderBy: { createdAt: 'desc' },
        include: {
          sender: {
            select: {
              id: true,
              displayName: true,
              equippedProfileCrest: true,
            },
          },
        },
      }),
      this.prisma.guildMember.findMany({
        where: { guildId },
        select: { playerId: true, role: true },
      }),
    ]);

    const memberRoleMap = new Map<string, GuildRole>();
    for (const m of membersData) {
      memberRoleMap.set(m.playerId, m.role as GuildRole);
    }

    const mapMessage = (msg: typeof messagesData[number]): GuildChatMessageItem => {
      const role = msg.senderId ? memberRoleMap.get(msg.senderId) ?? null : null;
      return {
        id: msg.id,
        guildId: msg.guildId,
        senderId: msg.senderId,
        senderName: msg.type === 'SYSTEM' ? 'Guild Herald' : msg.sender?.displayName || 'Clanmate',
        senderRole: role,
        senderProfileCrest: (msg.sender?.equippedProfileCrest ?? 'DEFAULT') as ProfileCrestKey,
        type: msg.type,
        content: msg.content,
        isPinned: msg.isPinned,
        createdAt: msg.createdAt.toISOString(),
      };
    };

    return {
      messages: messagesData.map(mapMessage),
      pinnedAnnouncement: pinnedData ? mapMessage(pinnedData) : null,
      canPostAnnouncement,
    };
  }

  /**
   * Post a new message or pinned announcement to the guild chat.
   */
  async sendMessage(
    playerId: string,
    dto: SendGuildChatMessageDto,
  ): Promise<GuildChatMessageItem> {
    const membership = await this.prisma.guildMember.findUnique({
      where: { playerId },
      include: {
        player: {
          select: {
            id: true,
            displayName: true,
            equippedProfileCrest: true,
          },
        },
      },
    });

    if (!membership) {
      throw new BadRequestException('You must be a member of a guild to send messages.');
    }

    const isOfficerOrLeader = membership.role === 'LEADER' || membership.role === 'OFFICER';

    if ((dto.isAnnouncement || dto.isPinned) && !isOfficerOrLeader) {
      throw new ForbiddenException('Only Guild Leaders and Officers can post announcements.');
    }

    const type = dto.isAnnouncement ? 'ANNOUNCEMENT' : 'TEXT';
    const isPinned = !!dto.isPinned;

    const created = await this.prisma.$transaction(async (tx) => {
      if (isPinned) {
        await tx.guildChatMessage.updateMany({
          where: { guildId: membership.guildId, isPinned: true },
          data: { isPinned: false },
        });
      }

      return tx.guildChatMessage.create({
        data: {
          guildId: membership.guildId,
          senderId: playerId,
          type,
          content: dto.content.trim(),
          isPinned,
        },
      });
    });

    return {
      id: created.id,
      guildId: created.guildId,
      senderId: playerId,
      senderName: membership.player.displayName || 'Clanmate',
      senderRole: membership.role as GuildRole,
      senderProfileCrest: (membership.player.equippedProfileCrest ?? 'DEFAULT') as ProfileCrestKey,
      type: created.type,
      content: created.content,
      isPinned: created.isPinned,
      createdAt: created.createdAt.toISOString(),
    };
  }

  /**
   * Create an automated system audit message in the guild chat.
   */
  async createSystemMessage(guildId: string, content: string, metadata?: any): Promise<void> {
    await this.prisma.guildChatMessage.create({
      data: {
        guildId,
        senderId: null,
        type: 'SYSTEM',
        content,
        metadata: metadata ?? undefined,
      },
    });
  }

  /**
   * Retrieve active war strategy map and target callouts.
   */
  async getWarRoomStrategy(playerId: string): Promise<WarRoomStrategyResponse> {
    const membership = await this.prisma.guildMember.findUnique({
      where: { playerId },
      include: { guild: true },
    });

    if (!membership) {
      throw new BadRequestException('You must be in a guild to view war strategy.');
    }

    const { guild } = membership;
    const canManageStrategy = membership.role === 'LEADER' || membership.role === 'OFFICER';

    if (!guild.currentWarId) {
      return {
        warId: '',
        callouts: [],
        pinnedStrategyNotice: null,
        canManageStrategy,
      };
    }

    const [calloutsData, pinnedMsg] = await Promise.all([
      this.prisma.guildWarCallout.findMany({
        where: {
          warId: guild.currentWarId,
          guildId: guild.id,
        },
        include: {
          claimedBy: { select: { displayName: true } },
          assignedBy: { select: { displayName: true } },
        },
        orderBy: { baseNumber: 'asc' },
      }),
      this.prisma.guildChatMessage.findFirst({
        where: { guildId: guild.id, isPinned: true },
        orderBy: { createdAt: 'desc' },
        select: { content: true },
      }),
    ]);

    const callouts: GuildWarCalloutItem[] = calloutsData.map((c) => ({
      id: c.id,
      warId: c.warId,
      defenderPlayerId: c.defenderPlayerId,
      baseNumber: c.baseNumber,
      marker: c.marker,
      claimedById: c.claimedById,
      claimedByName: c.claimedBy?.displayName ?? null,
      notes: c.notes,
      assignedById: c.assignedById,
      assignedByName: c.assignedBy.displayName || 'Leader',
      updatedAt: c.updatedAt.toISOString(),
    }));

    return {
      warId: guild.currentWarId,
      callouts,
      pinnedStrategyNotice: pinnedMsg?.content ?? null,
      canManageStrategy,
    };
  }

  /**
   * Set or update a tactical callout on an opposing base during war.
   */
  async setWarCallout(playerId: string, dto: SetWarCalloutDto): Promise<GuildWarCalloutItem> {
    const membership = await this.prisma.guildMember.findUnique({
      where: { playerId },
      include: {
        guild: true,
        player: { select: { displayName: true } },
      },
    });

    if (!membership) {
      throw new BadRequestException('You must be in a guild.');
    }

    const { guild } = membership;
    if (!guild.currentWarId) {
      throw new BadRequestException('There is no active guild war currently.');
    }

    const isOfficerOrLeader = membership.role === 'LEADER' || membership.role === 'OFFICER';

    // If assigning to someone else or setting priority/scout marker, require officer/leader
    if (dto.claimedById && dto.claimedById !== playerId && !isOfficerOrLeader) {
      throw new ForbiddenException('Only Leaders and Officers can assign targets to other members.');
    }

    if (dto.marker !== 'TARGET_CALLOUT' && !isOfficerOrLeader) {
      throw new ForbiddenException('Only Leaders and Officers can set tactical markers (Priority/Scout).');
    }

    const callout = await this.prisma.guildWarCallout.upsert({
      where: {
        warId_guildId_defenderPlayerId: {
          warId: guild.currentWarId,
          guildId: guild.id,
          defenderPlayerId: dto.defenderPlayerId,
        },
      },
      create: {
        warId: guild.currentWarId,
        guildId: guild.id,
        defenderPlayerId: dto.defenderPlayerId,
        baseNumber: dto.baseNumber,
        marker: dto.marker,
        claimedById: dto.claimedById ?? null,
        notes: dto.notes?.trim() ?? null,
        assignedById: playerId,
      },
      update: {
        marker: dto.marker,
        claimedById: dto.claimedById ?? null,
        notes: dto.notes?.trim() ?? null,
        assignedById: playerId,
      },
      include: {
        claimedBy: { select: { displayName: true } },
        assignedBy: { select: { displayName: true } },
      },
    });

    // Announce callout in guild chat
    const actorName = membership.player.displayName || 'Clanmate';
    const targetNotice = dto.claimedById
      ? `${actorName} claimed Base #${dto.baseNumber} for assault!`
      : `${actorName} marked Base #${dto.baseNumber} (${dto.marker.replace('_', ' ')})`;

    await this.createSystemMessage(guild.id, targetNotice, {
      type: 'WAR_CALLOUT',
      baseNumber: dto.baseNumber,
      marker: dto.marker,
    });

    return {
      id: callout.id,
      warId: callout.warId,
      defenderPlayerId: callout.defenderPlayerId,
      baseNumber: callout.baseNumber,
      marker: callout.marker,
      claimedById: callout.claimedById,
      claimedByName: callout.claimedBy?.displayName ?? null,
      notes: callout.notes,
      assignedById: callout.assignedById,
      assignedByName: callout.assignedBy.displayName || 'Leader',
      updatedAt: callout.updatedAt.toISOString(),
    };
  }
}

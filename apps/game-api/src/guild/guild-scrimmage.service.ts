import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import {
  FriendlyChallengeStatus,
  GuildChatMessageType,
  TroopType,
} from '@prisma/client';
import type {
  AcceptFriendlyChallengeResult,
  FriendlyChallengesResponse,
  GuildFriendlyChallengeItem,
  WarBattleReplay,
  WarReplayEvent,
} from '@crown-and-coin/shared';
import type { DevelopmentPlayerContext } from '../player/player-context.service';
import type { PostFriendlyChallengeDto } from './guild-scrimmage.dto';

@Injectable()
export class GuildScrimmageService {
  constructor(private readonly prisma: PrismaService) {}

  async resolvePlayerId(context: DevelopmentPlayerContext | string): Promise<string> {
    const rawId = typeof context === 'string' ? context : context.externalUserId;
    const account = await this.prisma.platformAccount.findUnique({
      where: {
        platform_externalUserId: {
          platform: 'WEB',
          externalUserId: rawId,
        },
      },
      select: { playerId: true },
    });
    if (account) return account.playerId;

    const directPlayer = await this.prisma.player.findUnique({
      where: { id: rawId },
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
              externalUserId: rawId,
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

  async getChallenges(playerId: string): Promise<FriendlyChallengesResponse> {
    const member = await this.prisma.guildMember.findUnique({
      where: { playerId },
    });
    if (!member) throw new NotFoundException('You are not in an alliance.');

    const challenges = await this.prisma.guildFriendlyChallenge.findMany({
      where: { guildId: member.guildId },
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: {
        creator: {
          include: {
            kingdom: { select: { level: true } },
          },
        },
        attacker: {
          select: { displayName: true },
        },
      },
    });

    return {
      challenges: challenges.map((c) => ({
        id: c.id,
        guildId: c.guildId,
        creatorId: c.creatorId,
        creatorName: c.creator.displayName || 'Unknown Monarch',
        creatorCastleLevel: c.creator.kingdom?.level ?? 1,
        message: c.message || 'Test your armies against my defense layout!',
        status: c.status as any,
        attackerId: c.attackerId,
        attackerName: c.attacker?.displayName ?? null,
        stars: c.stars,
        destructionPct: c.destructionPct,
        replayId: c.id,
        createdAt: c.createdAt.toISOString(),
        completedAt: c.completedAt ? c.completedAt.toISOString() : null,
      })),
    };
  }

  async postChallenge(
    playerId: string,
    dto: PostFriendlyChallengeDto,
  ): Promise<GuildFriendlyChallengeItem> {
    const member = await this.prisma.guildMember.findUnique({
      where: { playerId },
      include: {
        player: { include: { kingdom: true } },
        guild: true,
      },
    });
    if (!member) throw new NotFoundException('You are not in an alliance.');

    const creatorName = member.player.displayName || 'Allied Lord';
    const creatorCastleLevel = member.player.kingdom?.level ?? 1;
    const challengeMessage =
      dto.message?.trim() || 'Friendly Challenge: Can you 3-star my kingdom?';

    const challenge = await this.prisma.$transaction(async (tx) => {
      const created = await tx.guildFriendlyChallenge.create({
        data: {
          guildId: member.guildId,
          creatorId: playerId,
          message: challengeMessage,
          status: FriendlyChallengeStatus.OPEN,
        },
      });

      // Automatically post scrimmage card to alliance chat
      await tx.guildChatMessage.create({
        data: {
          guildId: member.guildId,
          senderId: playerId,
          type: GuildChatMessageType.SCRIMMAGE,
          content: challengeMessage,
          metadata: {
            challengeId: created.id,
            creatorCastleLevel,
          },
        },
      });

      return created;
    });

    return {
      id: challenge.id,
      guildId: challenge.guildId,
      creatorId: playerId,
      creatorName,
      creatorCastleLevel,
      message: challengeMessage,
      status: 'OPEN',
      attackerId: null,
      attackerName: null,
      stars: null,
      destructionPct: null,
      replayId: challenge.id,
      createdAt: challenge.createdAt.toISOString(),
      completedAt: null,
    };
  }

  async acceptChallenge(
    playerId: string,
    challengeId: string,
  ): Promise<AcceptFriendlyChallengeResult> {
    const member = await this.prisma.guildMember.findUnique({
      where: { playerId },
      include: {
        player: { include: { kingdom: true } },
        guild: true,
      },
    });
    if (!member) throw new NotFoundException('You are not in an alliance.');

    const challenge = await this.prisma.guildFriendlyChallenge.findUnique({
      where: { id: challengeId },
      include: {
        creator: { include: { kingdom: true } },
      },
    });
    if (!challenge) throw new NotFoundException('Friendly challenge not found.');
    if (challenge.guildId !== member.guildId) {
      throw new ForbiddenException('This challenge belongs to another alliance.');
    }
    if (challenge.creatorId === playerId) {
      throw new BadRequestException('You cannot scrimmage your own defense layout.');
    }
    if (challenge.status === FriendlyChallengeStatus.COMPLETED) {
      throw new BadRequestException('This friendly scrimmage was already completed.');
    }

    const attackerName = member.player.displayName || 'Challenger';
    const attackerCastleLevel = member.player.kingdom?.level ?? 1;
    const defenderName = challenge.creator.displayName || 'Defending Monarch';
    const defenderCastleLevel = challenge.creator.kingdom?.level ?? 1;

    // Simulated attack result (2 or 3 stars with high destruction)
    const stars = Math.floor(Math.random() * 2) + 2;
    const destructionPct = Math.round((75 + Math.random() * 25) * 10) / 10;

    const replay = this.generateBattleReplay({
      id: challenge.id,
      title: `Friendly Scrimmage: ${attackerName} vs ${defenderName}`,
      source: 'SCRIMMAGE',
      attackerName,
      attackerClanName: member.guild.name,
      attackerCastleLevel,
      defenderName,
      defenderClanName: member.guild.name,
      defenderCastleLevel,
      stars,
      destructionPct,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.guildFriendlyChallenge.update({
        where: { id: challenge.id },
        data: {
          status: FriendlyChallengeStatus.COMPLETED,
          attackerId: playerId,
          stars,
          destructionPct,
          replayData: replay as any,
          completedAt: new Date(),
        },
      });

      // Post system announcement in alliance chat with results
      await tx.guildChatMessage.create({
        data: {
          guildId: member.guildId,
          senderId: null,
          type: GuildChatMessageType.SYSTEM,
          content: `${attackerName} practiced against ${defenderName}'s layout: ${stars}★ (${destructionPct.toFixed(0)}%)!`,
          metadata: {
            challengeId: challenge.id,
            replayId: challenge.id,
            stars,
            destructionPct,
          },
        },
      });
    });

    return {
      challengeId: challenge.id,
      stars,
      destructionPct,
      replay,
    };
  }

  async getReplay(playerId: string, replayId: string): Promise<WarBattleReplay> {
    const member = await this.prisma.guildMember.findUnique({
      where: { playerId },
      include: { guild: true },
    });
    if (!member) throw new NotFoundException('You are not in an alliance.');

    // 1. Try finding as a friendly challenge replay
    const challenge = await this.prisma.guildFriendlyChallenge.findUnique({
      where: { id: replayId },
      include: {
        creator: { include: { kingdom: true } },
        attacker: { include: { kingdom: true } },
      },
    });

    if (challenge && challenge.guildId === member.guildId) {
      if (challenge.replayData) {
        return challenge.replayData as unknown as WarBattleReplay;
      }

      // Generate if completed but legacy/missing
      return this.generateBattleReplay({
        id: challenge.id,
        title: `Friendly Scrimmage: ${challenge.attacker?.displayName ?? 'Warrior'} vs ${challenge.creator.displayName ?? 'Monarch'}`,
        source: 'SCRIMMAGE',
        attackerName: challenge.attacker?.displayName ?? 'Warrior',
        attackerClanName: member.guild.name,
        attackerCastleLevel: challenge.attacker?.kingdom?.level ?? 1,
        defenderName: challenge.creator.displayName ?? 'Monarch',
        defenderClanName: member.guild.name,
        defenderCastleLevel: challenge.creator.kingdom?.level ?? 1,
        stars: challenge.stars ?? 2,
        destructionPct: challenge.destructionPct ?? 80,
      });
    }

    // 2. Try finding as a Guild War Attack replay
    const attack = await this.prisma.guildWarAttack.findUnique({
      where: { id: replayId },
      include: {
        attacker: { include: { kingdom: true } },
        defender: { include: { kingdom: true } },
        attackerGuild: true,
        defenderGuild: true,
      },
    });

    if (attack) {
      if (attack.replayData) {
        return attack.replayData as unknown as WarBattleReplay;
      }

      // Dynamically assemble authoritative replay for war log
      return this.generateBattleReplay({
        id: attack.id,
        title: `War Attack: ${attack.attacker.displayName} vs ${attack.defender.displayName}`,
        source: 'WAR',
        attackerName: attack.attacker.displayName || 'Attacking Warrior',
        attackerClanName: attack.attackerGuild.name,
        attackerCastleLevel: attack.attacker.kingdom?.level ?? 1,
        defenderName: attack.defender.displayName || 'Defending Base',
        defenderClanName: attack.defenderGuild.name,
        defenderCastleLevel: attack.defender.kingdom?.level ?? 1,
        stars: attack.stars,
        destructionPct: attack.destructionPct,
      });
    }

    throw new NotFoundException('Battle replay record was not found.');
  }

  generateBattleReplay(params: {
    id: string;
    title: string;
    source: 'WAR' | 'SCRIMMAGE';
    attackerName: string;
    attackerClanName?: string;
    attackerCastleLevel: number;
    defenderName: string;
    defenderClanName?: string;
    defenderCastleLevel: number;
    stars: number;
    destructionPct: number;
  }): WarBattleReplay {
    const {
      id,
      title,
      source,
      attackerName,
      attackerClanName,
      attackerCastleLevel,
      defenderName,
      defenderClanName,
      defenderCastleLevel,
      stars,
      destructionPct,
    } = params;

    const timelineEvents: WarReplayEvent[] = [
      {
        timeSeconds: 0,
        label: 'Vanguard infantry squad breaches southern defense perimeter',
        category: 'DEPLOYMENT',
        destructionPct: 0,
        stars: 0,
      },
      {
        timeSeconds: 14,
        label: 'Archers unleash firestorm volley targeting defensive cannons',
        category: 'DAMAGE',
        destructionPct: Math.round(destructionPct * 0.2),
        stars: 0,
      },
      {
        timeSeconds: 32,
        label: 'Defensive watchtower eliminated — outer defense collapsed',
        category: 'DESTRUCTION_BENCHMARK',
        destructionPct: Math.round(destructionPct * 0.45),
        stars: 0,
      },
      {
        timeSeconds: 52,
        label: '50% Total Base Destruction reached! First war star awarded ★',
        category: 'STAR_SCORED',
        destructionPct: Math.max(50, Math.round(destructionPct * 0.55)),
        stars: 1,
      },
    ];

    if (stars >= 2) {
      timelineEvents.push({
        timeSeconds: 78,
        label: 'Castle fortress citadel overwhelmed and demolished! Second war star secured ★★',
        category: 'STAR_SCORED',
        destructionPct: Math.round(destructionPct * 0.85),
        stars: 2,
      });
    }

    if (stars >= 3) {
      timelineEvents.push({
        timeSeconds: 104,
        label: '100% Total Obliteration! Perfect 3-Star Victory achieved ★★★',
        category: 'STAR_SCORED',
        destructionPct: 100,
        stars: 3,
      });
    }

    return {
      id,
      title,
      source,
      attackerName,
      attackerClanName,
      attackerCastleLevel,
      defenderName,
      defenderClanName,
      defenderCastleLevel,
      stars,
      destructionPct,
      durationSeconds: stars === 3 ? 104 : stars === 2 ? 80 : 60,
      armyComposition: [
        { troopType: TroopType.INFANTRY, count: 25, survived: Math.max(8, Math.round(25 * (stars / 4))) },
        { troopType: TroopType.ARCHER, count: 18, survived: Math.max(5, Math.round(18 * (stars / 4))) },
        { troopType: TroopType.CAVALRY, count: 8, survived: Math.max(2, Math.round(8 * (stars / 4))) },
      ],
      defenseBuildings: [
        { type: 'Castle Keep', level: defenderCastleLevel, destroyed: stars >= 2 },
        { type: 'Cannon Battery', level: Math.max(1, defenderCastleLevel - 1), destroyed: true },
        { type: 'Archer Watchtower', level: Math.max(1, defenderCastleLevel - 1), destroyed: true },
        { type: 'Granary Vault', level: defenderCastleLevel, destroyed: destructionPct > 60 },
      ],
      timelineEvents,
      resolvedAt: new Date().toISOString(),
    };
  }
}

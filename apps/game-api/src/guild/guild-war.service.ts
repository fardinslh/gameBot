import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GuildRole,
  GuildWarOutcome,
  GuildWarState,
  Prisma,
  TroopType,
} from '@prisma/client';
import {
  GUILD_WAR_ATTACKS_PER_PLAYER,
  GUILD_WAR_BATTLE_DURATION_MS,
  GUILD_WAR_DEFAULT_SIZE,
  GUILD_WAR_LOSE_SPOILS_GOLD,
  GUILD_WAR_LOSE_XP,
  GUILD_WAR_PREP_DURATION_MS,
  GUILD_WAR_STAR_BONUS_GOLD,
  GUILD_WAR_WIN_SPOILS_GOLD,
  GUILD_WAR_WIN_XP,
  SYSTEM_RIVAL_CLANS,
  calculateGuildLevel,
} from './guild-war.config';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import {
  resolveLeagueFromTrophies,
  type GuildCrest,
  type GuildWarAttackEntry,
  type GuildWarDetails,
  type GuildWarOverviewResponse,
  type GuildWarParticipant,
  type GuildWarSideSummary,
  type WarAttackResult,
} from '@crown-and-coin/shared';

@Injectable()
export class GuildWarService {
  constructor(private readonly prisma: PrismaService) {}

  async getWarOverview(playerId: string): Promise<GuildWarOverviewResponse> {
    const member = await this.prisma.guildMember.findUnique({
      where: { playerId },
      include: { guild: true },
    });

    if (!member) {
      return {
        activeWar: null,
        warRecord: {
          wins: 0,
          losses: 0,
          draws: 0,
          currentStreak: 0,
          guildLevel: 1,
          guildXp: 0,
          nextLevelXp: 250,
        },
        canDeclareWar: false,
      };
    }

    const { level, nextLevelXp } = calculateGuildLevel(member.guild.xp);
    const warRecord = {
      wins: member.guild.warWins,
      losses: member.guild.warLosses,
      draws: member.guild.warDraws,
      currentStreak: member.guild.warWins,
      guildLevel: level,
      guildXp: member.guild.xp,
      nextLevelXp,
    };

    const canDeclareWar = member.role === GuildRole.LEADER || member.role === GuildRole.OFFICER;

    if (!member.guild.currentWarId) {
      return {
        activeWar: null,
        warRecord,
        canDeclareWar,
      };
    }

    const war = await this.prisma.guildWar.findUnique({
      where: { id: member.guild.currentWarId },
      include: {
        guild1: true,
        guild2: true,
        participants: {
          include: {
            player: {
              include: {
                kingdom: { select: { level: true } },
              },
            },
          },
        },
        attacks: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            attacker: { select: { displayName: true } },
            defender: { select: { displayName: true } },
          },
        },
      },
    });

    if (!war) {
      await this.prisma.guild.update({
        where: { id: member.guildId },
        data: { currentWarId: null },
      });
      return { activeWar: null, warRecord, canDeclareWar };
    }

    // Auto-transition time checks
    const reconciledWar = await this.reconcileWarState(war);
    const details = this.formatWarDetails(reconciledWar, member.guildId, playerId, canDeclareWar);

    return {
      activeWar: details,
      warRecord,
      canDeclareWar: canDeclareWar && reconciledWar.state === GuildWarState.WAR_ENDED,
    };
  }

  async startWar(playerId: string, size = GUILD_WAR_DEFAULT_SIZE): Promise<GuildWarDetails> {
    const member = await this.prisma.guildMember.findUnique({
      where: { playerId },
      include: { guild: true },
    });

    if (!member) throw new NotFoundException('You are not in an alliance.');
    if (member.role !== GuildRole.LEADER && member.role !== GuildRole.OFFICER) {
      throw new ForbiddenException('Only leaders or officers can declare war.');
    }

    if (member.guild.currentWarId) {
      const activeWar = await this.prisma.guildWar.findUnique({
        where: { id: member.guild.currentWarId },
      });
      if (activeWar && activeWar.state !== GuildWarState.WAR_ENDED) {
        throw new BadRequestException('Alliance is already engaged in an active war.');
      }
    }

    const warSize = Math.max(3, Math.min(15, size));

    // Resolve or spawn rival opponent clan
    const opponentGuild = await this.resolveOrSpawnRivalGuild(member.guildId, warSize);

    // Fetch friendly participants (top players in guild by trophies)
    const friendlyMembers = await this.prisma.guildMember.findMany({
      where: { guildId: member.guildId },
      include: { player: { include: { kingdom: true } } },
      orderBy: { player: { trophies: 'desc' } },
      take: warSize,
    });

    // Ensure we have enough friendly slots (fill with placeholder bots if small clan)
    const friendlyPlayerIds: string[] = friendlyMembers.map((m) => m.playerId);
    while (friendlyPlayerIds.length < warSize) {
      const placeholder = await this.createPlaceholderDefender(
        `Warden Defender ${friendlyPlayerIds.length + 1}`,
        500 + friendlyPlayerIds.length * 100,
      );
      friendlyPlayerIds.push(placeholder.id);
    }

    // Fetch opponent participants
    const opponentMembers = await this.prisma.guildMember.findMany({
      where: { guildId: opponentGuild.id },
      include: { player: true },
      take: warSize,
    });
    const opponentPlayerIds: string[] = opponentMembers.map((m) => m.playerId);
    while (opponentPlayerIds.length < warSize) {
      const placeholder = await this.createPlaceholderDefender(
        `Rival Warrior ${opponentPlayerIds.length + 1}`,
        600 + opponentPlayerIds.length * 80,
      );
      opponentPlayerIds.push(placeholder.id);
    }

    const now = new Date();
    const prepEndsAt = new Date(now.getTime() + GUILD_WAR_PREP_DURATION_MS);
    const battleEndsAt = new Date(prepEndsAt.getTime() + GUILD_WAR_BATTLE_DURATION_MS);

    const war = await this.prisma.$transaction(async (tx) => {
      const createdWar = await tx.guildWar.create({
        data: {
          guildId1: member.guildId,
          guildId2: opponentGuild.id,
          warSize,
          state: GuildWarState.PREPARATION,
          outcome: GuildWarOutcome.PENDING,
          prepEndsAt,
          battleEndsAt,
        },
      });

      // Insert friendly participants
      for (let i = 0; i < friendlyPlayerIds.length; i++) {
        await tx.guildWarParticipant.create({
          data: {
            warId: createdWar.id,
            guildId: member.guildId,
            playerId: friendlyPlayerIds[i],
            baseNumber: i + 1,
          },
        });
      }

      // Insert opponent participants
      for (let i = 0; i < opponentPlayerIds.length; i++) {
        await tx.guildWarParticipant.create({
          data: {
            warId: createdWar.id,
            guildId: opponentGuild.id,
            playerId: opponentPlayerIds[i],
            baseNumber: i + 1,
          },
        });
      }

      // Link war to friendly guild and opponent guild
      await tx.guild.update({
        where: { id: member.guildId },
        data: { currentWarId: createdWar.id },
      });
      await tx.guild.update({
        where: { id: opponentGuild.id },
        data: { currentWarId: createdWar.id },
      });

      return tx.guildWar.findUniqueOrThrow({
        where: { id: createdWar.id },
        include: {
          guild1: true,
          guild2: true,
          participants: {
            include: {
              player: {
                include: { kingdom: { select: { level: true } } },
              },
            },
          },
          attacks: {
            include: {
              attacker: { select: { displayName: true } },
              defender: { select: { displayName: true } },
            },
          },
        },
      });
    });

    return this.formatWarDetails(war, member.guildId, playerId, true);
  }

  async fastForwardToBattleDay(playerId: string): Promise<GuildWarDetails> {
    const member = await this.prisma.guildMember.findUnique({
      where: { playerId },
      include: { guild: true },
    });
    if (!member?.guild.currentWarId) throw new NotFoundException('No active war found.');

    const now = new Date();
    const updated = await this.prisma.guildWar.update({
      where: { id: member.guild.currentWarId },
      data: {
        state: GuildWarState.BATTLE_DAY,
        prepEndsAt: new Date(now.getTime() - 1000),
        battleEndsAt: new Date(now.getTime() + GUILD_WAR_BATTLE_DURATION_MS),
      },
      include: {
        guild1: true,
        guild2: true,
        participants: {
          include: { player: { include: { kingdom: { select: { level: true } } } } },
        },
        attacks: {
          include: {
            attacker: { select: { displayName: true } },
            defender: { select: { displayName: true } },
          },
        },
      },
    });

    return this.formatWarDetails(updated, member.guildId, playerId, true);
  }

  async fastForwardToWarEnd(playerId: string): Promise<GuildWarDetails> {
    const member = await this.prisma.guildMember.findUnique({
      where: { playerId },
      include: { guild: true },
    });
    if (!member?.guild.currentWarId) throw new NotFoundException('No active war found.');

    const war = await this.prisma.guildWar.findUniqueOrThrow({
      where: { id: member.guild.currentWarId },
      include: {
        guild1: true,
        guild2: true,
        participants: {
          include: { player: { include: { kingdom: { select: { level: true } } } } },
        },
        attacks: {
          include: {
            attacker: { select: { displayName: true } },
            defender: { select: { displayName: true } },
          },
        },
      },
    });

    const isGuild1 = war.guildId1 === member.guildId;
    let outcome: GuildWarOutcome = GuildWarOutcome.DRAW;
    if (war.guild1Stars > war.guild2Stars) outcome = isGuild1 ? GuildWarOutcome.VICTORY : GuildWarOutcome.DEFEAT;
    else if (war.guild2Stars > war.guild1Stars) outcome = isGuild1 ? GuildWarOutcome.DEFEAT : GuildWarOutcome.VICTORY;
    else {
      if (war.guild1Destruction > war.guild2Destruction) outcome = isGuild1 ? GuildWarOutcome.VICTORY : GuildWarOutcome.DEFEAT;
      else if (war.guild2Destruction > war.guild1Destruction) outcome = isGuild1 ? GuildWarOutcome.DEFEAT : GuildWarOutcome.VICTORY;
    }

    const updated = await this.prisma.guildWar.update({
      where: { id: war.id },
      data: {
        state: GuildWarState.WAR_ENDED,
        outcome,
        battleEndsAt: new Date(),
      },
      include: {
        guild1: true,
        guild2: true,
        participants: {
          include: { player: { include: { kingdom: { select: { level: true } } } } },
        },
        attacks: {
          include: {
            attacker: { select: { displayName: true } },
            defender: { select: { displayName: true } },
          },
        },
      },
    });

    return this.formatWarDetails(updated, member.guildId, playerId, true);
  }

  async attack(playerId: string, defenderPlayerId: string): Promise<WarAttackResult> {
    const member = await this.prisma.guildMember.findUnique({
      where: { playerId },
      include: { guild: true },
    });
    if (!member) throw new NotFoundException('You are not in an alliance.');
    if (!member.guild.currentWarId) throw new BadRequestException('Your alliance is not currently at war.');

    const war = await this.prisma.guildWar.findUnique({
      where: { id: member.guild.currentWarId },
      include: { participants: true },
    });
    if (!war) throw new NotFoundException('War record not found.');
    if (war.state === GuildWarState.PREPARATION) {
      throw new BadRequestException('War is still in Preparation Day. Attacks open on Battle Day!');
    }
    if (war.state === GuildWarState.WAR_ENDED) {
      throw new BadRequestException('This war has already ended.');
    }

    const isGuild1 = war.guildId1 === member.guildId;
    const friendlyGuildId = member.guildId;
    const opponentGuildId = isGuild1 ? war.guildId2 : war.guildId1;

    // Verify attacker is a registered participant in this war
    const attackerParticipant = war.participants.find(
      (p) => p.playerId === playerId && p.guildId === friendlyGuildId,
    );
    if (!attackerParticipant) {
      throw new ForbiddenException('You were not drafted into this alliance war roster.');
    }
    if (attackerParticipant.attacksUsed >= GUILD_WAR_ATTACKS_PER_PLAYER) {
      throw new BadRequestException('You have used all available war attacks (2/2).');
    }

    // Verify defender is a registered participant on opponent side
    const defenderParticipant = war.participants.find(
      (p) => p.playerId === defenderPlayerId && p.guildId === opponentGuildId,
    );
    if (!defenderParticipant) {
      throw new NotFoundException('Target opponent base was not found in this war.');
    }

    // Authoritative simulated attack
    // Minimum 1 star, up to 3 stars based on base comparison
    const starsScored = Math.floor(Math.random() * 2) + 2; // 2 or 3 stars
    const destructionPct = Math.round((70 + Math.random() * 30) * 10) / 10; // 70.0% to 100.0%
    const attackSpoils = BigInt(parseInt(GUILD_WAR_STAR_BONUS_GOLD, 10) * starsScored);

    const result = await this.prisma.$transaction(async (tx) => {
      // Record attack
      const attackRecord = await tx.guildWarAttack.create({
        data: {
          warId: war.id,
          attackerId: playerId,
          defenderId: defenderPlayerId,
          attackerGuildId: friendlyGuildId,
          defenderGuildId: opponentGuildId,
          stars: starsScored,
          destructionPct,
          spoilsGold: attackSpoils,
          timeMs: Math.floor(Math.random() * 45000) + 40000,
        },
      });

      // Increment attacker's attacks used
      await tx.guildWarParticipant.update({
        where: { id: attackerParticipant.id },
        data: { attacksUsed: { increment: 1 } },
      });

      // Check if this attack sets a new best for the defender's base
      const isNewBest =
        starsScored > defenderParticipant.bestStarsConceded ||
        (starsScored === defenderParticipant.bestStarsConceded &&
          destructionPct > defenderParticipant.bestDestructionConceded);

      let additionalStars = 0;
      if (starsScored > defenderParticipant.bestStarsConceded) {
        additionalStars = starsScored - defenderParticipant.bestStarsConceded;
      }

      if (isNewBest) {
        await tx.guildWarParticipant.update({
          where: { id: defenderParticipant.id },
          data: {
            bestStarsConceded: Math.max(defenderParticipant.bestStarsConceded, starsScored),
            bestDestructionConceded: Math.max(defenderParticipant.bestDestructionConceded, destructionPct),
          },
        });
      }

      // Update war aggregate stars & destruction
      const starField = isGuild1 ? 'guild1Stars' : 'guild2Stars';
      const destField = isGuild1 ? 'guild1Destruction' : 'guild2Destruction';

      const updatedWar = await tx.guildWar.update({
        where: { id: war.id },
        data: {
          [starField]: { increment: additionalStars },
          [destField]: Math.round(
            Math.max(
              isGuild1 ? war.guild1Destruction : war.guild2Destruction,
              destructionPct,
            ) * 10,
          ) / 10,
        },
      });

      // Credit personal war attack loot to player's kingdom
      const attackerPlayer = await tx.player.findUnique({
        where: { id: playerId },
        include: { kingdom: true },
      });
      if (attackerPlayer?.kingdom) {
        await tx.resourceBalance.updateMany({
          where: { kingdomId: attackerPlayer.kingdom.id, resource: 'GOLD' },
          data: { amount: { increment: attackSpoils } },
        });
      }

      return {
        attackId: attackRecord.id,
        stars: starsScored,
        destructionPct,
        isNewBest,
        additionalStarsAwarded: additionalStars,
        spoilsGoldAwarded: attackSpoils.toString(),
        friendlyTotalStars: isGuild1 ? updatedWar.guild1Stars : updatedWar.guild2Stars,
        opposingTotalStars: isGuild1 ? updatedWar.guild2Stars : updatedWar.guild1Stars,
        attacksRemaining: GUILD_WAR_ATTACKS_PER_PLAYER - (attackerParticipant.attacksUsed + 1),
        warFinished: updatedWar.state === GuildWarState.WAR_ENDED,
        outcome: updatedWar.outcome,
      };
    });

    return result;
  }

  async claimSpoils(playerId: string): Promise<{ goldClaimed: string; newBalance: string }> {
    const member = await this.prisma.guildMember.findUnique({
      where: { playerId },
      include: { guild: true, player: { include: { kingdom: true } } },
    });
    if (!member) throw new NotFoundException('You are not in an alliance.');
    if (!member.player.kingdom) throw new NotFoundException('Kingdom not found.');
    if (!member.guild.currentWarId) throw new BadRequestException('No completed war to claim spoils from.');

    const war = await this.prisma.guildWar.findUnique({
      where: { id: member.guild.currentWarId },
    });
    if (!war || war.state !== GuildWarState.WAR_ENDED) {
      throw new BadRequestException('War has not concluded yet.');
    }

    const isGuild1 = war.guildId1 === member.guildId;
    const won =
      (isGuild1 && war.guild1Stars > war.guild2Stars) ||
      (!isGuild1 && war.guild2Stars > war.guild1Stars);

    const spoilsAmount = BigInt(
      won ? GUILD_WAR_WIN_SPOILS_GOLD : GUILD_WAR_LOSE_SPOILS_GOLD,
    );

    // Credit gold to player
    await this.prisma.resourceBalance.updateMany({
      where: { kingdomId: member.player.kingdom.id, resource: 'GOLD' },
      data: { amount: { increment: spoilsAmount } },
    });

    // Detach finished war from guild
    await this.prisma.guild.update({
      where: { id: member.guildId },
      data: { currentWarId: null },
    });

    const updatedBalance = await this.prisma.resourceBalance.findFirst({
      where: { kingdomId: member.player.kingdom.id, resource: 'GOLD' },
    });

    return {
      goldClaimed: spoilsAmount.toString(),
      newBalance: updatedBalance?.amount.toString() ?? '0',
    };
  }

  // --- Private Helpers ---

  private async reconcileWarState(
    war: Prisma.GuildWarGetPayload<{
      include: {
        guild1: true;
        guild2: true;
        participants: { include: { player: { include: { kingdom: { select: { level: true } } } } } };
        attacks: {
          include: {
            attacker: { select: { displayName: true } };
            defender: { select: { displayName: true } };
          };
        };
      };
    }>,
  ) {
    const now = new Date();

    if (war.state === GuildWarState.PREPARATION && now >= war.prepEndsAt) {
      return this.prisma.guildWar.update({
        where: { id: war.id },
        data: { state: GuildWarState.BATTLE_DAY },
        include: {
          guild1: true,
          guild2: true,
          participants: {
            include: { player: { include: { kingdom: { select: { level: true } } } } },
          },
          attacks: {
            include: {
              attacker: { select: { displayName: true } },
              defender: { select: { displayName: true } },
            },
          },
        },
      });
    }

    if (war.state === GuildWarState.BATTLE_DAY && now >= war.battleEndsAt) {
      let outcome1: GuildWarOutcome = GuildWarOutcome.DRAW;
      let outcome2: GuildWarOutcome = GuildWarOutcome.DRAW;

      if (war.guild1Stars > war.guild2Stars) {
        outcome1 = GuildWarOutcome.VICTORY;
        outcome2 = GuildWarOutcome.DEFEAT;
      } else if (war.guild2Stars > war.guild1Stars) {
        outcome1 = GuildWarOutcome.DEFEAT;
        outcome2 = GuildWarOutcome.VICTORY;
      } else {
        if (war.guild1Destruction > war.guild2Destruction) {
          outcome1 = GuildWarOutcome.VICTORY;
          outcome2 = GuildWarOutcome.DEFEAT;
        } else if (war.guild2Destruction > war.guild1Destruction) {
          outcome1 = GuildWarOutcome.DEFEAT;
          outcome2 = GuildWarOutcome.VICTORY;
        }
      }

      await this.prisma.$transaction([
        this.prisma.guild.update({
          where: { id: war.guildId1 },
          data: {
            warWins: outcome1 === GuildWarOutcome.VICTORY ? { increment: 1 } : undefined,
            warLosses: outcome1 === GuildWarOutcome.DEFEAT ? { increment: 1 } : undefined,
            warDraws: outcome1 === GuildWarOutcome.DRAW ? { increment: 1 } : undefined,
            xp: { increment: outcome1 === GuildWarOutcome.VICTORY ? GUILD_WAR_WIN_XP : GUILD_WAR_LOSE_XP },
          },
        }),
        this.prisma.guild.update({
          where: { id: war.guildId2 },
          data: {
            warWins: outcome2 === GuildWarOutcome.VICTORY ? { increment: 1 } : undefined,
            warLosses: outcome2 === GuildWarOutcome.DEFEAT ? { increment: 1 } : undefined,
            warDraws: outcome2 === GuildWarOutcome.DRAW ? { increment: 1 } : undefined,
            xp: { increment: outcome2 === GuildWarOutcome.VICTORY ? GUILD_WAR_WIN_XP : GUILD_WAR_LOSE_XP },
          },
        }),
      ]);

      return this.prisma.guildWar.update({
        where: { id: war.id },
        data: { state: GuildWarState.WAR_ENDED, outcome: outcome1 },
        include: {
          guild1: true,
          guild2: true,
          participants: {
            include: { player: { include: { kingdom: { select: { level: true } } } } },
          },
          attacks: {
            include: {
              attacker: { select: { displayName: true } },
              defender: { select: { displayName: true } },
            },
          },
        },
      });
    }

    return war;
  }

  private formatWarDetails(
    war: Prisma.GuildWarGetPayload<{
      include: {
        guild1: true;
        guild2: true;
        participants: { include: { player: { include: { kingdom: { select: { level: true } } } } } };
        attacks: {
          include: {
            attacker: { select: { displayName: true } };
            defender: { select: { displayName: true } };
          };
        };
      };
    }>,
    friendlyGuildId: string,
    currentPlayerId: string,
    canDeclareWar: boolean,
  ): GuildWarDetails {
    const isGuild1 = war.guildId1 === friendlyGuildId;
    const friendlyGuild = isGuild1 ? war.guild1 : war.guild2;
    const opposingGuild = isGuild1 ? war.guild2 : war.guild1;

    const friendlyStars = isGuild1 ? war.guild1Stars : war.guild2Stars;
    const opposingStars = isGuild1 ? war.guild2Stars : war.guild1Stars;

    const friendlyDestruction = isGuild1 ? war.guild1Destruction : war.guild2Destruction;
    const opposingDestruction = isGuild1 ? war.guild2Destruction : war.guild1Destruction;

    const friendlyParts = war.participants
      .filter((p) => p.guildId === friendlyGuildId)
      .sort((a, b) => a.baseNumber - b.baseNumber);

    const opposingParts = war.participants
      .filter((p) => p.guildId === opposingGuild.id)
      .sort((a, b) => a.baseNumber - b.baseNumber);

    const friendlyAttacksUsed = friendlyParts.reduce((acc, p) => acc + p.attacksUsed, 0);
    const opposingAttacksUsed = opposingParts.reduce((acc, p) => acc + p.attacksUsed, 0);
    const totalAttacksPossible = war.warSize * GUILD_WAR_ATTACKS_PER_PLAYER;

    const currentParticipant = friendlyParts.find((p) => p.playerId === currentPlayerId);
    const currentUserAttacksLeft = currentParticipant
      ? Math.max(0, GUILD_WAR_ATTACKS_PER_PLAYER - currentParticipant.attacksUsed)
      : 0;

    let friendlyOutcome = war.outcome;
    if (war.state === GuildWarState.WAR_ENDED) {
      if (friendlyStars > opposingStars) friendlyOutcome = GuildWarOutcome.VICTORY;
      else if (opposingStars > friendlyStars) friendlyOutcome = GuildWarOutcome.DEFEAT;
      else {
        if (friendlyDestruction > opposingDestruction) friendlyOutcome = GuildWarOutcome.VICTORY;
        else if (opposingDestruction > friendlyDestruction) friendlyOutcome = GuildWarOutcome.DEFEAT;
        else friendlyOutcome = GuildWarOutcome.DRAW;
      }
    }

    const mapParticipant = (p: (typeof war.participants)[number]): GuildWarParticipant => ({
      playerId: p.playerId,
      displayName: p.player?.displayName ?? `Warden #${p.baseNumber}`,
      castleLevel: p.player?.kingdom?.level ?? 1,
      league: resolveLeagueFromTrophies(p.player?.trophies ?? 1000),
      baseNumber: p.baseNumber,
      attacksUsed: p.attacksUsed,
      maxAttacks: GUILD_WAR_ATTACKS_PER_PLAYER,
      bestStarsConceded: p.bestStarsConceded,
      bestDestructionConceded: p.bestDestructionConceded,
      defenseReinforcementsCount: 0,
    });

    const recentAttacks: GuildWarAttackEntry[] = war.attacks.map((a) => ({
      id: a.id,
      attackerId: a.attackerId,
      attackerName: a.attacker.displayName ?? 'Attacker',
      defenderId: a.defenderId,
      defenderName: a.defender.displayName ?? 'Defender',
      attackerGuildId: a.attackerGuildId,
      defenderGuildId: a.defenderGuildId,
      stars: a.stars,
      destructionPct: a.destructionPct,
      timeMs: a.timeMs,
      createdAt: a.createdAt.toISOString(),
      spoilsGold: a.spoilsGold.toString(),
    }));

    return {
      warId: war.id,
      state: war.state as GuildWarState,
      warSize: war.warSize,
      prepEndsAt: war.prepEndsAt.toISOString(),
      battleEndsAt: war.battleEndsAt.toISOString(),
      outcome: friendlyOutcome as GuildWarOutcome,
      friendly: {
        guildId: friendlyGuild.id,
        name: friendlyGuild.name,
        tag: friendlyGuild.tag,
        crest: {
          emblem: friendlyGuild.emblem as any,
          primaryColor: friendlyGuild.primaryColor,
          secondaryColor: friendlyGuild.secondaryColor,
        },
        stars: friendlyStars,
        totalStarsPossible: war.warSize * 3,
        destructionPct: friendlyDestruction,
        attacksUsed: friendlyAttacksUsed,
        totalAttacks: totalAttacksPossible,
      },
      opposing: {
        guildId: opposingGuild.id,
        name: opposingGuild.name,
        tag: opposingGuild.tag,
        crest: {
          emblem: opposingGuild.emblem as any,
          primaryColor: opposingGuild.primaryColor,
          secondaryColor: opposingGuild.secondaryColor,
        },
        stars: opposingStars,
        totalStarsPossible: war.warSize * 3,
        destructionPct: opposingDestruction,
        attacksUsed: opposingAttacksUsed,
        totalAttacks: totalAttacksPossible,
      },
      friendlyParticipants: friendlyParts.map(mapParticipant),
      opposingParticipants: opposingParts.map(mapParticipant),
      recentAttacks,
      canDeclareWar,
      currentUserAttacksLeft,
      warSpoilsAvailableGold:
        friendlyOutcome === GuildWarOutcome.VICTORY
          ? GUILD_WAR_WIN_SPOILS_GOLD
          : GUILD_WAR_LOSE_SPOILS_GOLD,
    };
  }

  private async resolveOrSpawnRivalGuild(friendlyGuildId: string, warSize: number) {
    // Try finding another guild
    const candidate = await this.prisma.guild.findFirst({
      where: {
        id: { not: friendlyGuildId },
        currentWarId: null,
      },
      include: { members: true },
    });

    if (candidate) return candidate;

    // Pick a random system rival clan
    const rivalData = SYSTEM_RIVAL_CLANS[Math.floor(Math.random() * SYSTEM_RIVAL_CLANS.length)];
    const uniqueTag = `${rivalData.tag.slice(0, 4)}${Math.floor(Math.random() * 900 + 100)}`;

    return this.prisma.guild.create({
      data: {
        name: `${rivalData.name} ${Math.floor(Math.random() * 90 + 10)}`,
        tag: uniqueTag,
        description: rivalData.motto,
        emblem: rivalData.emblem,
        primaryColor: rivalData.primaryColor,
        secondaryColor: rivalData.secondaryColor,
        score: 2500,
      },
    });
  }

  private async createPlaceholderDefender(name: string, trophies: number) {
    return this.prisma.player.create({
      data: {
        displayName: name,
        trophies,
        isSystemOpponent: true,
        kingdom: {
          create: {
            name: `${name}'s Keep`,
            level: Math.floor(trophies / 300) + 1,
          },
        },
      },
    });
  }
}

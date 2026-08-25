import { Injectable, Logger } from '@nestjs/common';
import {
  EconomyAction,
  EconomyTransactionReason,
  Platform,
  Prisma,
  ResourceType as PrismaResourceType,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type {
  HeroesResponse,
  HeroKey,
  HeroState,
  HeroUpgradeResponse,
  RaidTeamResponse,
  RaidTeamState,
  ResourceAmounts,
} from '@crown-and-coin/shared';
import type { DevelopmentPlayerContext } from '../player/player-context.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { EconomyService } from '../economy/economy.service';
import { deriveHeroStats, heroUpgradeCost } from './hero.calculator';
import { ensureHeroSystemForPlayer } from './hero.bootstrap';
import { HERO_CONTENT, HERO_MAXIMUM_LEVEL } from './hero.config';
import { HeroError } from './hero.errors';
import { kingdomEffectBps } from '../kingdom/kingdom-effects.config';

const playerHeroGraph = Prisma.validator<Prisma.PlayerHeroDefaultArgs>()({
  include: { heroDefinition: true },
});

const raidTeamGraph = Prisma.validator<Prisma.RaidTeamDefaultArgs>()({
  include: {
    slots: {
      include: { playerHero: { include: { heroDefinition: true } } },
      orderBy: { slot: 'asc' },
    },
  },
});

type PlayerHeroGraph = Prisma.PlayerHeroGetPayload<typeof playerHeroGraph>;
type RaidTeamGraph = Prisma.RaidTeamGetPayload<typeof raidTeamGraph>;
type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class HeroService {
  private readonly logger = new Logger(HeroService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
  ) {}

  getHeroes(context: DevelopmentPlayerContext): Promise<HeroesResponse> {
    return this.withPlayerTransaction(context, async (tx, playerId, kingdomId) => {
      const heroes = await this.loadHeroes(tx, playerId);
      const team = await this.loadTeam(tx, playerId);
      const balances = await this.loadBalances(tx, kingdomId);
      const blacksmithDiscountBps = kingdomEffectBps(await this.loadBuildingLevel(tx, kingdomId, 'BLACKSMITH'));
      const player = await tx.player.findUniqueOrThrow({
        where: { id: playerId },
        include: { kingdom: { include: { buildings: { where: { type: 'CASTLE' }, take: 1 } } } },
      });
      return {
        player: {
          id: player.id,
          displayName: player.displayName ?? 'Warden of Dawnkeep',
          level: player.kingdom?.buildings[0]?.level ?? player.kingdom?.level ?? 1,
        },
        heroes: heroes.map((hero) => this.presentHero(hero, balances.GOLD, blacksmithDiscountBps)),
        team: this.presentTeam(team),
        balances,
        serverTime: new Date().toISOString(),
      };
    });
  }

  getTeam(context: DevelopmentPlayerContext): Promise<RaidTeamResponse> {
    return this.withPlayerTransaction(context, async (tx, playerId) => ({
      team: this.presentTeam(await this.loadTeam(tx, playerId)),
      serverTime: new Date().toISOString(),
    }));
  }

  async saveTeam(context: DevelopmentPlayerContext, heroIds: string[]): Promise<RaidTeamResponse> {
    if (heroIds.length !== 3) throw new HeroError('INVALID_TEAM_SIZE', 'A Raid Team must contain exactly three Heroes.');
    if (new Set(heroIds).size !== heroIds.length) throw new HeroError('DUPLICATE_TEAM_HERO', 'A Hero can only occupy one Raid Team slot.');

    return this.withPlayerTransaction(context, async (tx, playerId) => {
      const ownedHeroes = await tx.playerHero.findMany({
        where: { id: { in: heroIds }, playerId, heroDefinition: { enabled: true } },
        select: { id: true },
      });
      if (ownedHeroes.length !== 3) throw new HeroError('INVALID_TEAM_HERO', 'Every selected Hero must be enabled and owned by this player.');

      const team = await tx.raidTeam.findUniqueOrThrow({ where: { playerId } });
      await tx.raidTeamSlot.deleteMany({ where: { raidTeamId: team.id } });
      await tx.raidTeamSlot.createMany({
        data: heroIds.map((playerHeroId, index) => ({ raidTeamId: team.id, playerHeroId, slot: index + 1 })),
      });
      const refreshed = await this.loadTeam(tx, playerId);
      this.logger.log(`team-save player=${playerId} heroes=${heroIds.join(',')}`);
      return { team: this.presentTeam(refreshed), serverTime: new Date().toISOString() };
    });
  }

  upgrade(
    context: DevelopmentPlayerContext,
    playerHeroId: string,
    idempotencyKey: string | undefined,
  ): Promise<HeroUpgradeResponse> {
    const key = this.validateIdempotencyKey(idempotencyKey);
    return this.withPlayerTransaction(context, async (tx, playerId, kingdomId) => {
      const previous = await tx.economyRequest.findUnique({
        where: {
          playerId_idempotencyKey_action: {
            playerId,
            idempotencyKey: key,
            action: EconomyAction.HERO_UPGRADE,
          },
        },
      });
      if (previous) return previous.response as unknown as HeroUpgradeResponse;

      const hero = await tx.playerHero.findFirst({
        where: { id: playerHeroId, playerId },
        ...playerHeroGraph,
      });
      if (!hero) {
        const exists = await tx.playerHero.findUnique({ where: { id: playerHeroId }, select: { playerId: true } });
        throw new HeroError(exists ? 'NOT_HERO_OWNER' : 'HERO_NOT_FOUND', 'Hero is not available to this player.');
      }
      if (!hero.heroDefinition.enabled) throw new HeroError('HERO_DISABLED', 'This Hero is not currently enabled.');
      if (hero.level >= HERO_MAXIMUM_LEVEL) throw new HeroError('HERO_MAX_LEVEL', 'This Hero is at maximum level.');

      const blacksmithDiscountBps = kingdomEffectBps(await this.loadBuildingLevel(tx, kingdomId, 'BLACKSMITH'));
      const cost = heroUpgradeCost(hero.level, blacksmithDiscountBps);
      if (cost <= 0n) throw new Error('Hero upgrade cost must be positive.');
      const gold = await tx.resourceBalance.findUnique({
        where: { kingdomId_resource: { kingdomId, resource: PrismaResourceType.GOLD } },
      });
      if (!gold || gold.amount < cost) throw new HeroError('HERO_INSUFFICIENT_GOLD', 'Not enough Gold for this Hero upgrade.');

      const charged = await tx.resourceBalance.updateMany({
        where: { id: gold.id, amount: { gte: cost } },
        data: { amount: { decrement: cost } },
      });
      if (charged.count !== 1) throw new HeroError('HERO_INSUFFICIENT_GOLD', 'Not enough Gold for this Hero upgrade.');

      const referenceId = randomUUID();
      await tx.economyTransaction.create({
        data: {
          playerId,
          kingdomId,
          balanceId: gold.id,
          resourceType: PrismaResourceType.GOLD,
          delta: -cost,
          balanceBefore: gold.amount,
          balanceAfter: gold.amount - cost,
          reason: EconomyTransactionReason.HERO_UPGRADE,
          referenceId,
        },
      });
      const upgraded = await tx.playerHero.update({
        where: { id: hero.id },
        data: { level: { increment: 1 } },
        ...playerHeroGraph,
      });
      const balances = await this.loadBalances(tx, kingdomId);
      const response: HeroUpgradeResponse = {
        hero: this.presentHero(upgraded, balances.GOLD, blacksmithDiscountBps),
        team: this.presentTeam(await this.loadTeam(tx, playerId)),
        balances,
        serverTime: new Date().toISOString(),
      };
      await tx.economyRequest.create({
        data: {
          playerId,
          idempotencyKey: key,
          action: EconomyAction.HERO_UPGRADE,
          response: response as unknown as Prisma.InputJsonValue,
        },
      });
      this.logger.log(`hero-upgrade player=${playerId} hero=${hero.id} level=${upgraded.level} reference=${referenceId}`);
      return response;
    });
  }

  private async withPlayerTransaction<T>(
    context: DevelopmentPlayerContext,
    operation: (tx: TransactionClient, playerId: string, kingdomId: string) => Promise<T>,
  ): Promise<T> {
    await this.economy.getKingdom(context);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(hashtext(${`${context.platform}:${context.externalUserId}`}))`;
          const account = await tx.platformAccount.findUniqueOrThrow({
            where: { platform_externalUserId: { platform: Platform.WEB, externalUserId: context.externalUserId } },
            include: { player: { include: { kingdom: true } } },
          });
          if (!account.player.kingdom) throw new Error('Player Kingdom bootstrap did not complete.');
          await ensureHeroSystemForPlayer(tx, account.playerId, true);
          return operation(tx, account.playerId, account.player.kingdom.id);
        }, { maxWait: 5_000, timeout: 15_000 });
      } catch (error) {
        if (this.isRetryableConflict(error) && attempt < 3) continue;
        if (this.isRetryableConflict(error)) throw new HeroError('HERO_CONFLICT', 'The Hero roster is busy. Please retry.');
        throw error;
      }
    }
    throw new HeroError('HERO_CONFLICT', 'The Hero roster is busy. Please retry.');
  }

  private loadHeroes(tx: TransactionClient, playerId: string): Promise<PlayerHeroGraph[]> {
    return tx.playerHero.findMany({
      where: { playerId, heroDefinition: { enabled: true } },
      ...playerHeroGraph,
      orderBy: { heroDefinition: { sortOrder: 'asc' } },
    });
  }

  private loadTeam(tx: TransactionClient, playerId: string): Promise<RaidTeamGraph> {
    return tx.raidTeam.findUniqueOrThrow({ where: { playerId }, ...raidTeamGraph });
  }

  private async loadBalances(tx: TransactionClient, kingdomId: string): Promise<ResourceAmounts> {
    const rows = await tx.resourceBalance.findMany({ where: { kingdomId } });
    const balances: ResourceAmounts = { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0', GEMS: '0' };
    for (const row of rows) balances[row.resource] = row.amount.toString();
    return balances;
  }

  private presentHero(hero: PlayerHeroGraph, availableGold: string, blacksmithDiscountBps: number): HeroState {
    const key = hero.heroDefinition.key as HeroKey;
    const config = HERO_CONTENT[key];
    const stats = deriveHeroStats(config, hero.level);
    const atMaximum = hero.level >= HERO_MAXIMUM_LEVEL;
    const cost = atMaximum ? null : heroUpgradeCost(hero.level, blacksmithDiscountBps);
    return {
      id: hero.id,
      key,
      level: hero.level,
      class: config.combatClass,
      ...stats,
      skill: { key: config.skillKey },
      portraitAsset: config.portraitAsset,
      canUpgrade: cost !== null && BigInt(availableGold) >= cost,
      maximumLevel: HERO_MAXIMUM_LEVEL,
      upgradeCost: cost === null ? null : { gold: cost.toString() },
    };
  }

  private async loadBuildingLevel(
    tx: TransactionClient,
    kingdomId: string,
    type: 'BLACKSMITH',
  ): Promise<number> {
    return (await tx.building.findUnique({
      where: { kingdomId_type: { kingdomId, type } },
      select: { level: true },
    }))?.level ?? 1;
  }

  private presentTeam(team: RaidTeamGraph): RaidTeamState {
    const slots = team.slots.map((item) => ({
      slot: item.slot as 1 | 2 | 3,
      playerHeroId: item.playerHeroId,
    }));
    const power = team.slots.reduce((total, item) => {
      const config = HERO_CONTENT[item.playerHero.heroDefinition.key as HeroKey];
      return total + deriveHeroStats(config, item.playerHero.level).power;
    }, 0);
    return { slots, power };
  }

  private validateIdempotencyKey(key: string | undefined): string {
    const normalized = key?.trim();
    if (!normalized || normalized.length < 8 || normalized.length > 100) {
      throw new HeroError('INVALID_IDEMPOTENCY_KEY', 'A valid Idempotency-Key header is required.');
    }
    return normalized;
  }

  private isRetryableConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
  }
}

import { Injectable, Logger } from '@nestjs/common';
import {
  EconomyAction,
  EconomyTransactionReason,
  Platform,
  Prisma,
  ResourceType as PrismaResourceType,
  UpgradeStatus,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type {
  CollectResponse,
  KingdomBuildingState,
  KingdomBuildingType,
  KingdomStateResponse,
  ResourceAmounts,
  ResourceType,
  UpgradeAvailability,
  UpgradeResponse,
} from '@crown-and-coin/shared';
import { KINGDOM_BUILDING_TYPES, RESOURCE_TYPES } from '@crown-and-coin/shared';
import type { DevelopmentPlayerContext } from '../player/player-context.service';
import { ensureHeroSystemForPlayer } from '../heroes/hero.bootstrap';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { KingdomLevelService } from '../kingdom/kingdom-level.service';
import { KingdomExpansionService } from '../kingdom/kingdom-expansion.service';
import { buildingEffect, kingdomEffectBps } from '../kingdom/kingdom-effects.config';
import { calculateProduction, capProductionToStorage } from './economy.calculator';
import { isBuildingUnlocked, presentUnlocks, unlockCastleLevel } from './building-unlocks.config';
import {
  appearanceVariant,
  ECONOMY_CONFIG,
  OFFLINE_STORAGE_CAP_HOURS,
  STARTING_RESOURCES,
  productionPerHour,
  requiredCastleLevel,
  storageCapacity,
  upgradeCost,
  upgradeDurationSeconds,
} from './economy.config';
import { EconomyError } from './economy.errors';

const kingdomGraph = Prisma.validator<Prisma.KingdomDefaultArgs>()({
  include: {
    player: true,
    resourceBalances: true,
    buildings: {
      include: {
        upgrades: {
          orderBy: { queuedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { type: 'asc' },
    },
  },
});

type KingdomGraph = Prisma.KingdomGetPayload<typeof kingdomGraph>;
type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class EconomyService {
  private readonly logger = new Logger(EconomyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly kingdomLevels: KingdomLevelService = new KingdomLevelService(),
    private readonly kingdomExpansion: KingdomExpansionService = new KingdomExpansionService(),
  ) {}

  getKingdom(context: DevelopmentPlayerContext): Promise<KingdomStateResponse> {
    return this.withPlayerTransaction(context, async (tx, _playerId, kingdomId) => {
      const now = new Date();
      await this.reconcileCompletedUpgrades(tx, kingdomId, now);
      const graph = await this.loadGraph(tx, kingdomId);
      return this.presentKingdom(graph, now);
    });
  }

  collect(context: DevelopmentPlayerContext, idempotencyKey: string | undefined): Promise<CollectResponse> {
    const key = this.validateIdempotencyKey(idempotencyKey);
    return this.withPlayerTransaction(context, async (tx, playerId, kingdomId) => {
      const previous = await tx.economyRequest.findUnique({
        where: { playerId_idempotencyKey_action: { playerId, idempotencyKey: key, action: EconomyAction.COLLECT } },
      });
      if (previous) return previous.response as unknown as CollectResponse;

      const now = new Date();
      await this.reconcileCompletedUpgrades(tx, kingdomId, now);
      const graph = await this.loadGraph(tx, kingdomId);
      const academyBonusBps = kingdomEffectBps(this.buildingLevel(graph, 'ACADEMY'));
      const rawProduction = calculateProduction(
        graph.buildings.map((building) => ({
          id: building.id,
          type: building.type as KingdomBuildingType,
          level: building.level,
          productionRemainder: building.productionRemainder,
        })),
        graph.lastCollectedAt,
        now,
        academyBonusBps,
      );
      const production = capProductionToStorage(
        rawProduction,
        this.presentBalances(graph),
        this.presentStorageCapacities(graph),
      );
      const gains = this.emptyAmounts();
      const referenceId = randomUUID();

      for (const result of production) {
        gains[result.resource] = result.gain.toString();
        await tx.building.update({ where: { id: result.buildingId }, data: { productionRemainder: result.remainder } });
        if (result.gain === 0n) continue;

        const balance = graph.resourceBalances.find((item) => item.resource === result.resource);
        if (!balance) throw new Error(`Missing ${result.resource} balance`);
        const balanceAfter = balance.amount + result.gain;
        await tx.resourceBalance.update({ where: { id: balance.id }, data: { amount: balanceAfter } });
        await tx.economyTransaction.create({
          data: {
            playerId,
            kingdomId,
            balanceId: balance.id,
            resourceType: result.resource as PrismaResourceType,
            delta: result.gain,
            balanceBefore: balance.amount,
            balanceAfter,
            reason: EconomyTransactionReason.OFFLINE_PRODUCTION,
            referenceId,
          },
        });
      }

      await tx.kingdom.update({ where: { id: kingdomId }, data: { lastCollectedAt: now } });
      const refreshed = await this.loadGraph(tx, kingdomId);
      const response: CollectResponse = {
        gains,
        balances: this.presentBalances(refreshed),
        buildings: this.presentBuildings(refreshed, now),
        lastCollectedAt: now.toISOString(),
        serverTime: now.toISOString(),
      };
      await this.saveIdempotentResponse(tx, playerId, key, EconomyAction.COLLECT, response);
      this.logger.log(`collect player=${playerId} reference=${referenceId} gains=${JSON.stringify(gains)}`);
      return response;
    });
  }

  upgrade(
    context: DevelopmentPlayerContext,
    buildingId: string,
    idempotencyKey: string | undefined,
  ): Promise<UpgradeResponse> {
    const key = this.validateIdempotencyKey(idempotencyKey);
    return this.withPlayerTransaction(context, async (tx, playerId, kingdomId) => {
      const previous = await tx.economyRequest.findUnique({
        where: { playerId_idempotencyKey_action: { playerId, idempotencyKey: key, action: EconomyAction.UPGRADE } },
      });
      if (previous) return previous.response as unknown as UpgradeResponse;

      const now = new Date();
      await this.reconcileCompletedUpgrades(tx, kingdomId, now);
      const graph = await this.loadGraph(tx, kingdomId);
      const building = graph.buildings.find((item) => item.id === buildingId);
      if (!building) {
        const exists = await tx.building.findUnique({ where: { id: buildingId }, select: { kingdomId: true } });
        throw new EconomyError(exists ? 'NOT_BUILDING_OWNER' : 'BUILDING_NOT_FOUND', 'Building is not available to this player.');
      }

      const type = building.type as KingdomBuildingType;
      const config = ECONOMY_CONFIG[type];
      const castle = graph.buildings.find((item) => item.type === 'CASTLE');
      const castleLevel = castle?.level ?? 1;
      if (!isBuildingUnlocked(type, castleLevel)) throw new EconomyError('BUILDING_LOCKED', 'Upgrade the Castle to unlock this building.');
      if (building.upgrades[0]?.status === UpgradeStatus.IN_PROGRESS) throw new EconomyError('UPGRADE_ALREADY_ACTIVE', 'This building is already upgrading.');
      if (building.level >= config.maximumLevel) throw new EconomyError('MAX_LEVEL', 'This building is at maximum level.');

      const castleRequirement = requiredCastleLevel(type, building.level + 1);
      if (castleRequirement && (!castle || castle.level < castleRequirement)) {
        throw new EconomyError('CASTLE_LEVEL_REQUIRED', 'Upgrade the Castle before upgrading this building.');
      }

      const costs = upgradeCost(type, building.level);
      for (const [resource, amount] of Object.entries(costs) as [ResourceType, bigint][]) {
        const balance = graph.resourceBalances.find((item) => item.resource === resource);
        if (!balance || balance.amount < amount) throw new EconomyError('INSUFFICIENT_RESOURCES', 'Not enough resources for this upgrade.');
      }

      const workshopSpeedBps = kingdomEffectBps(this.buildingLevel(graph, 'WORKSHOP'));
      const durationSeconds = upgradeDurationSeconds(type, building.level, workshopSpeedBps);
      const finishAt = new Date(now.getTime() + durationSeconds * 1_000);
      const upgradeId = randomUUID();
      for (const [resource, amount] of Object.entries(costs) as [ResourceType, bigint][]) {
        const balance = graph.resourceBalances.find((item) => item.resource === resource);
        if (!balance) throw new Error(`Missing ${resource} balance`);
        const result = await tx.resourceBalance.updateMany({
          where: { id: balance.id, amount: { gte: amount } },
          data: { amount: { decrement: amount } },
        });
        if (result.count !== 1) throw new EconomyError('INSUFFICIENT_RESOURCES', 'Not enough resources for this upgrade.');
        await tx.economyTransaction.create({
          data: {
            playerId,
            kingdomId,
            balanceId: balance.id,
            resourceType: resource as PrismaResourceType,
            delta: -amount,
            balanceBefore: balance.amount,
            balanceAfter: balance.amount - amount,
            reason: EconomyTransactionReason.BUILDING_UPGRADE,
            referenceId: upgradeId,
          },
        });
      }

      await tx.buildingUpgrade.create({
        data: {
          id: upgradeId,
          buildingId,
          fromLevel: building.level,
          toLevel: building.level + 1,
          status: UpgradeStatus.IN_PROGRESS,
          startedAt: now,
          completesAt: finishAt,
        },
      });
      const refreshed = await this.loadGraph(tx, kingdomId);
      const response: UpgradeResponse = {
        building: this.presentBuildings(refreshed, now).find((item) => item.id === buildingId)!,
        balances: this.presentBalances(refreshed),
        serverTime: now.toISOString(),
      };
      await this.saveIdempotentResponse(tx, playerId, key, EconomyAction.UPGRADE, response);
      this.logger.log(`upgrade-start player=${playerId} building=${buildingId} upgrade=${upgradeId} finish=${finishAt.toISOString()}`);
      return response;
    });
  }

  collectCompletedUpgrade(
    context: DevelopmentPlayerContext,
    buildingId: string,
    idempotencyKey: string | undefined,
  ): Promise<UpgradeResponse> {
    const key = this.validateIdempotencyKey(idempotencyKey);
    return this.withPlayerTransaction(context, async (tx, playerId, kingdomId) => {
      const previous = await tx.economyRequest.findUnique({
        where: { playerId_idempotencyKey_action: { playerId, idempotencyKey: key, action: EconomyAction.UPGRADE_COLLECT } },
      });
      if (previous) return previous.response as unknown as UpgradeResponse;

      const now = new Date();
      const owned = await tx.building.findFirst({ where: { id: buildingId, kingdomId }, select: { id: true } });
      if (!owned) {
        const exists = await tx.building.findUnique({ where: { id: buildingId }, select: { kingdomId: true } });
        throw new EconomyError(exists ? 'NOT_BUILDING_OWNER' : 'BUILDING_NOT_FOUND', 'Building is not available to this player.');
      }
      const active = await tx.buildingUpgrade.findFirst({
        where: { buildingId, status: UpgradeStatus.IN_PROGRESS },
        orderBy: { startedAt: 'desc' },
      });
      if (active?.completesAt && active.completesAt > now) {
        throw new EconomyError('UPGRADE_NOT_READY', 'This upgrade has not finished yet.');
      }
      const completedBefore = await tx.buildingUpgrade.count({ where: { buildingId, status: UpgradeStatus.COMPLETED } });
      await this.reconcileCompletedUpgrades(tx, kingdomId, now, buildingId);
      const completedAfter = await tx.buildingUpgrade.count({ where: { buildingId, status: UpgradeStatus.COMPLETED } });
      if (!active && completedBefore === 0 && completedAfter === 0) {
        throw new EconomyError('UPGRADE_NOT_READY', 'There is no completed upgrade to collect.');
      }

      const refreshed = await this.loadGraph(tx, kingdomId);
      const response: UpgradeResponse = {
        building: this.presentBuildings(refreshed, now).find((item) => item.id === buildingId)!,
        balances: this.presentBalances(refreshed),
        serverTime: now.toISOString(),
      };
      await this.saveIdempotentResponse(tx, playerId, key, EconomyAction.UPGRADE_COLLECT, response);
      return response;
    });
  }

  private async withPlayerTransaction<T>(
    context: DevelopmentPlayerContext,
    operation: (tx: TransactionClient, playerId: string, kingdomId: string) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(hashtext(${`${context.platform}:${context.externalUserId}`}))`;
          const { playerId, kingdomId } = await this.bootstrapPlayer(tx, context);
          return operation(tx, playerId, kingdomId);
        }, { maxWait: 5_000, timeout: 15_000 });
      } catch (error) {
        if (this.isRetryableConflict(error) && attempt < 3) continue;
        if (this.isRetryableConflict(error)) {
          this.logger.error(`transaction-failure player=${context.externalUserId} code=P2034`);
          throw new EconomyError('ECONOMY_CONFLICT', 'The economy is busy. Please retry.');
        }
        throw error;
      }
    }
    throw new EconomyError('ECONOMY_CONFLICT', 'The economy is busy. Please retry.');
  }

  private async bootstrapPlayer(tx: TransactionClient, context: DevelopmentPlayerContext): Promise<{ playerId: string; kingdomId: string }> {
    let account = await tx.platformAccount.findUnique({
      where: { platform_externalUserId: { platform: Platform.WEB, externalUserId: context.externalUserId } },
      include: { player: { include: { kingdom: true } } },
    });
    if (!account) {
      await tx.player.create({
        data: {
          displayName: 'Warden of Dawnkeep',
          platformAccounts: { create: { platform: Platform.WEB, externalUserId: context.externalUserId, verifiedAt: new Date() } },
        },
      });
      account = await tx.platformAccount.findUniqueOrThrow({
        where: { platform_externalUserId: { platform: Platform.WEB, externalUserId: context.externalUserId } },
        include: { player: { include: { kingdom: true } } },
      });
    }
    if (account.player.kingdom) {
      await this.ensureKingdomShape(tx, account.playerId, account.player.kingdom.id);
      await ensureHeroSystemForPlayer(tx, account.playerId);
      return { playerId: account.playerId, kingdomId: account.player.kingdom.id };
    }

    const kingdom = await tx.kingdom.create({
      data: {
        playerId: account.playerId,
        name: 'Dawnkeep',
        lastCollectedAt: new Date(),
        resourceBalances: { create: RESOURCE_TYPES.map((resource) => ({ resource: resource as PrismaResourceType, amount: STARTING_RESOURCES[resource] })) },
        buildings: { create: KINGDOM_BUILDING_TYPES.map((type) => ({ type })) },
      },
      include: { resourceBalances: true },
    });
    const referenceId = `seed:${kingdom.id}`;
    await tx.economyTransaction.createMany({
      data: kingdom.resourceBalances.map((balance) => ({
        playerId: account!.playerId,
        kingdomId: kingdom.id,
        balanceId: balance.id,
        resourceType: balance.resource,
        delta: balance.amount,
        balanceBefore: 0n,
        balanceAfter: balance.amount,
        reason: EconomyTransactionReason.ADMIN_OR_SEED,
        referenceId,
      })),
    });
    await ensureHeroSystemForPlayer(tx, account.playerId);
    this.logger.log(`bootstrap player=${account.playerId} kingdom=${kingdom.id}`);
    return { playerId: account.playerId, kingdomId: kingdom.id };
  }

  private async ensureKingdomShape(tx: TransactionClient, playerId: string, kingdomId: string): Promise<void> {
    for (const resource of RESOURCE_TYPES) {
      const existing = await tx.resourceBalance.findUnique({
        where: { kingdomId_resource: { kingdomId, resource: resource as PrismaResourceType } },
      });
      if (existing) continue;
      const balance = await tx.resourceBalance.create({
        data: { kingdomId, resource: resource as PrismaResourceType, amount: STARTING_RESOURCES[resource] },
      });
      await tx.economyTransaction.create({
        data: {
          playerId,
          kingdomId,
          balanceId: balance.id,
          resourceType: balance.resource,
          delta: balance.amount,
          balanceBefore: 0n,
          balanceAfter: balance.amount,
          reason: EconomyTransactionReason.ADMIN_OR_SEED,
          referenceId: `seed-backfill:${kingdomId}`,
        },
      });
    }
    for (const type of KINGDOM_BUILDING_TYPES) {
      await tx.building.upsert({
        where: { kingdomId_type: { kingdomId, type } },
        create: { kingdomId, type },
        update: {},
      });
    }
  }

  private async reconcileCompletedUpgrades(tx: TransactionClient, kingdomId: string, now: Date, buildingId?: string): Promise<void> {
    const due = await tx.buildingUpgrade.findMany({
      where: { status: UpgradeStatus.IN_PROGRESS, completesAt: { lte: now }, buildingId, building: { kingdomId } },
      include: { building: true },
    });
    for (const upgrade of due) {
      const claimed = await tx.buildingUpgrade.updateMany({
        where: { id: upgrade.id, status: UpgradeStatus.IN_PROGRESS, completesAt: { lte: now } },
        data: { status: UpgradeStatus.COMPLETED, completedAt: now },
      });
      if (claimed.count !== 1) continue;
      await tx.building.update({ where: { id: upgrade.buildingId }, data: { level: upgrade.toLevel } });
      if (upgrade.building.type === 'CASTLE') await tx.kingdom.update({ where: { id: kingdomId }, data: { level: upgrade.toLevel } });
      const kingdom = await tx.kingdom.findUniqueOrThrow({ where: { id: kingdomId }, select: { playerId: true } });
      await this.notifications.createNotification(tx, {
        playerId: kingdom.playerId,
        type: 'UPGRADE_COMPLETE',
        payload: {
          buildingId: upgrade.buildingId,
          buildingType: upgrade.building.type,
          level: upgrade.toLevel,
          completedAt: now.toISOString(),
        },
        deepLinkIntent: { screen: 'BUILDING', buildingId: upgrade.buildingId },
        sourceKey: `UPGRADE_COMPLETE:${upgrade.id}`,
      });
      this.logger.log(`upgrade-complete building=${upgrade.buildingId} upgrade=${upgrade.id} level=${upgrade.toLevel}`);
    }
  }

  private loadGraph(tx: TransactionClient, kingdomId: string): Promise<KingdomGraph> {
    return tx.kingdom.findUniqueOrThrow({ where: { id: kingdomId }, ...kingdomGraph });
  }

  private presentKingdom(graph: KingdomGraph, now: Date): KingdomStateResponse {
    const castle = graph.buildings.find((building) => building.type === 'CASTLE');
    const castleLevel = castle?.level ?? 1;
    const progression = this.kingdomLevels.calculate(graph.buildings.map((building) => ({
      type: building.type as KingdomBuildingType,
      level: building.level,
    })));
    return {
      player: { id: graph.player.id, displayName: graph.player.displayName ?? 'Warden of Dawnkeep', level: castle?.level ?? graph.level },
      kingdom: { id: graph.id, name: graph.name, level: progression.level, lastCollectedAt: graph.lastCollectedAt.toISOString() },
      progression,
      kingdomExpansionStage: this.kingdomExpansion.fromCastleLevel(castleLevel),
      unlocks: presentUnlocks(castleLevel),
      balances: this.presentBalances(graph),
      storageCapacities: this.presentStorageCapacities(graph),
      buildings: this.presentBuildings(graph, now),
      serverTime: now.toISOString(),
      offlineCapHours: OFFLINE_STORAGE_CAP_HOURS,
    };
  }

  private presentBalances(graph: KingdomGraph): ResourceAmounts {
    const balances = this.emptyAmounts();
    for (const balance of graph.resourceBalances) balances[balance.resource as ResourceType] = balance.amount.toString();
    return balances;
  }

  private presentStorageCapacities(graph: KingdomGraph): ResourceAmounts {
    const castleLevel = graph.buildings.find((building) => building.type === 'CASTLE')?.level ?? 1;
    return Object.fromEntries(RESOURCE_TYPES.map((resource) => [resource, storageCapacity(resource, castleLevel).toString()])) as unknown as ResourceAmounts;
  }

  private presentBuildings(graph: KingdomGraph, now: Date): KingdomBuildingState[] {
    const balances = this.presentBalances(graph);
    const castleLevel = graph.buildings.find((building) => building.type === 'CASTLE')?.level ?? 1;
    const academyBonusBps = kingdomEffectBps(this.buildingLevel(graph, 'ACADEMY'));
    const workshopSpeedBps = kingdomEffectBps(this.buildingLevel(graph, 'WORKSHOP'));
    const production = capProductionToStorage(calculateProduction(
      graph.buildings.map((building) => ({
        id: building.id,
        type: building.type as KingdomBuildingType,
        level: building.level,
        productionRemainder: building.productionRemainder,
      })),
      graph.lastCollectedAt,
      now,
      academyBonusBps,
    ), balances, this.presentStorageCapacities(graph));
    return graph.buildings.map((building): KingdomBuildingState => {
      const type = building.type as KingdomBuildingType;
      const config = ECONOMY_CONFIG[type];
      const latestUpgrade = building.upgrades[0] ?? null;
      const active = latestUpgrade?.status === UpgradeStatus.IN_PROGRESS ? latestUpgrade : null;
      const unlocked = isBuildingUnlocked(type, castleLevel);
      const atMax = building.level >= config.maximumLevel;
      const costs = atMax ? {} : upgradeCost(type, building.level);
      const castleRequirement = atMax ? null : requiredCastleLevel(type, building.level + 1);
      let availability: UpgradeAvailability = 'CAN_UPGRADE';
      if (!unlocked) availability = 'BUILDING_LOCKED';
      else if (atMax) availability = 'MAX_LEVEL';
      else if (active) availability = 'UPGRADE_IN_PROGRESS';
      else if (castleRequirement && castleLevel < castleRequirement) availability = 'CASTLE_LEVEL_REQUIRED';
      else if ((Object.entries(costs) as [ResourceType, bigint][]).some(([resource, amount]) => BigInt(balances[resource]) < amount)) availability = 'INSUFFICIENT_RESOURCES';

      return {
        id: building.id,
        type,
        buildingType: type,
        level: building.level,
        nextLevel: atMax ? null : building.level + 1,
        resource: config.resource,
        productionPerHour: (production.find((item) => item.buildingId === building.id)?.productionPerHour ?? productionPerHour(type, building.level)).toString(),
        collectable: production.find((item) => item.buildingId === building.id)?.gain.toString() ?? '0',
        nextProductionPerHour: atMax || !config.resource ? null : calculateProduction([{
          id: building.id,
          type,
          level: building.level + 1,
          productionRemainder: 0n,
        }], now, now, academyBonusBps)[0]?.productionPerHour.toString() ?? null,
        upgradeCost: (Object.entries(costs) as [ResourceType, bigint][]).map(([resource, amount]) => ({ resource, amount: amount.toString() })),
        upgradeDurationSeconds: atMax ? null : upgradeDurationSeconds(type, building.level, workshopSpeedBps),
        requiredCastleLevel: castleRequirement,
        remainingSeconds: active?.completesAt ? Math.max(0, Math.ceil((active.completesAt.getTime() - now.getTime()) / 1_000)) : 0,
        upgradeStartedAt: active?.startedAt?.toISOString() ?? null,
        upgradeFinishedAt: (active?.completesAt ?? latestUpgrade?.completedAt ?? latestUpgrade?.completesAt)?.toISOString() ?? null,
        appearanceVariant: appearanceVariant(building.level),
        unlocked,
        unlockCastleLevel: unlockCastleLevel(type),
        upgradeAvailability: availability,
        activeUpgrade: active && active.startedAt && active.completesAt ? {
          id: active.id,
          fromLevel: active.fromLevel,
          toLevel: active.toLevel,
          startedAt: active.startedAt.toISOString(),
          finishAt: active.completesAt.toISOString(),
        } : null,
        effects: buildingEffect(type, building.level, atMax),
      };
    });
  }

  private buildingLevel(graph: KingdomGraph, type: KingdomBuildingType): number {
    return graph.buildings.find((building) => building.type === type)?.level ?? 1;
  }

  private emptyAmounts(): ResourceAmounts {
    return { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0', GEMS: '0' };
  }

  private validateIdempotencyKey(key: string | undefined): string {
    const normalized = key?.trim();
    if (!normalized || normalized.length < 8 || normalized.length > 100) throw new EconomyError('INVALID_IDEMPOTENCY_KEY', 'A valid Idempotency-Key header is required.');
    return normalized;
  }

  private saveIdempotentResponse(
    tx: TransactionClient,
    playerId: string,
    idempotencyKey: string,
    action: EconomyAction,
    response: CollectResponse | UpgradeResponse,
  ): Promise<unknown> {
    return tx.economyRequest.create({ data: { playerId, idempotencyKey, action, response: response as unknown as Prisma.InputJsonValue } });
  }

  private isRetryableConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
  }
}

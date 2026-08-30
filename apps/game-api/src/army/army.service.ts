import { Injectable, Logger } from '@nestjs/common';
import {
  EconomyAction,
  EconomyTransactionReason,
  Platform,
  Prisma,
  ResourceType as PrismaResourceType,
  TroopTrainingStatus,
  TroopType as PrismaTroopType,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type {
  ArmyCommanderState,
  ArmyFormationSlotInput,
  ArmyResponse,
  ArmyTrainResponse,
  HeroKey,
  ResourceAmounts,
  ResourceType,
  TroopType,
} from '@crown-and-coin/shared';
import { TROOP_TYPES } from '@crown-and-coin/shared';
import { AnalyticsService } from '../analytics/analytics.service';
import { EconomyService } from '../economy/economy.service';
import { HERO_CONTENT } from '../heroes/hero.config';
import { deriveHeroStats } from '../heroes/hero.calculator';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import type { DevelopmentPlayerContext } from '../player/player-context.service';
import { ArmyClock } from './army.clock';
import { calculateArmySquad, type ArmyPowerSquadInput } from './army-power.calculator';
import { armyCapacity, MAX_TRAINING_BATCH, trainingCost, TROOP_CONTENT } from './army.config';
import { ArmyError } from './army.errors';
import type { ArmyCombatSquad } from '../battle/battle.types';

const formationGraph = Prisma.validator<Prisma.ArmyFormationDefaultArgs>()({
  include: {
    slots: {
      include: { commander: { include: { heroDefinition: true } } },
      orderBy: { slot: 'asc' },
    },
  },
});

const commanderGraph = Prisma.validator<Prisma.PlayerHeroDefaultArgs>()({
  include: { heroDefinition: true },
});

type FormationGraph = Prisma.ArmyFormationGetPayload<typeof formationGraph>;
type CommanderGraph = Prisma.PlayerHeroGetPayload<typeof commanderGraph>;
type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class ArmyService {
  private readonly logger = new Logger(ArmyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly analytics: AnalyticsService,
    private readonly clock: ArmyClock = new ArmyClock(),
  ) {}

  getArmy(context: DevelopmentPlayerContext): Promise<ArmyResponse> {
    return this.withPlayerTransaction(context, async (tx, playerId, kingdomId) => {
      const now = this.clock.now();
      await this.reconcileTraining(tx, playerId, now);
      return this.presentArmy(tx, playerId, kingdomId, now);
    });
  }

  async train(
    context: DevelopmentPlayerContext,
    rawTroopType: unknown,
    rawQuantity: unknown,
    idempotencyKey: string | undefined,
  ): Promise<ArmyTrainResponse> {
    const troopType = this.validateTroopType(rawTroopType);
    const quantity = this.validateTrainingQuantity(rawQuantity);
    const key = this.validateIdempotencyKey(idempotencyKey);

    return this.withPlayerTransaction(context, async (tx, playerId, kingdomId) => {
      const previous = await tx.economyRequest.findUnique({
        where: {
          playerId_idempotencyKey_action: {
            playerId,
            idempotencyKey: key,
            action: EconomyAction.TROOP_TRAINING,
          },
        },
      });
      if (previous) return previous.response as unknown as ArmyTrainResponse;

      const now = this.clock.now();
      await this.reconcileTraining(tx, playerId, now);
      const active = await tx.troopTrainingOrder.findFirst({
        where: { playerId, status: TroopTrainingStatus.IN_PROGRESS },
      });
      if (active) throw new ArmyError('TRAINING_ALREADY_ACTIVE', 'Only one troop training order may be active.');

      const castleLevel = await this.loadCastleLevel(tx, kingdomId);
      const maximum = armyCapacity(castleLevel);
      const ready = await this.readyCount(tx, playerId);
      if (ready + quantity > maximum) {
        throw new ArmyError('ARMY_CAPACITY_EXCEEDED', 'This training order exceeds Army capacity.');
      }

      const costs = trainingCost(troopType, quantity);
      const balances = await tx.resourceBalance.findMany({ where: { kingdomId } });
      for (const [resource, amount] of Object.entries(costs) as [ResourceType, bigint][]) {
        const balance = balances.find((item) => item.resource === resource);
        if (!balance || balance.amount < amount) {
          throw new ArmyError('INSUFFICIENT_RESOURCES', 'Not enough resources to train these troops.');
        }
      }

      const orderId = randomUUID();
      const completesAt = new Date(
        now.getTime() + TROOP_CONTENT[troopType].trainingSecondsPerUnit * quantity * 1_000,
      );
      for (const [resource, amount] of Object.entries(costs) as [ResourceType, bigint][]) {
        const balance = balances.find((item) => item.resource === resource);
        if (!balance) throw new Error(`Missing ${resource} balance.`);
        const charged = await tx.resourceBalance.updateMany({
          where: { id: balance.id, amount: { gte: amount } },
          data: { amount: { decrement: amount } },
        });
        if (charged.count !== 1) {
          throw new ArmyError('INSUFFICIENT_RESOURCES', 'Not enough resources to train these troops.');
        }
        await tx.economyTransaction.create({
          data: {
            playerId,
            kingdomId,
            balanceId: balance.id,
            resourceType: resource as PrismaResourceType,
            delta: -amount,
            balanceBefore: balance.amount,
            balanceAfter: balance.amount - amount,
            reason: EconomyTransactionReason.TROOP_TRAINING,
            referenceId: orderId,
          },
        });
      }

      await tx.troopTrainingOrder.create({
        data: {
          id: orderId,
          playerId,
          troopType: troopType as PrismaTroopType,
          quantity,
          status: TroopTrainingStatus.IN_PROGRESS,
          costSnapshot: this.presentCosts(costs) as unknown as Prisma.InputJsonValue,
          startedAt: now,
          completesAt,
        },
      });
      await this.analytics.recordServer(tx, {
        playerId,
        eventName: 'troop_training_started',
        dedupeKey: `troop_training_started:${orderId}`,
        properties: { troopType, quantity, capacity: maximum, castleLevel },
        occurredAt: now,
      });

      const response: ArmyTrainResponse = {
        ...(await this.presentArmy(tx, playerId, kingdomId, now)),
        balances: await this.loadBalances(tx, kingdomId),
      };
      await tx.economyRequest.create({
        data: {
          playerId,
          idempotencyKey: key,
          action: EconomyAction.TROOP_TRAINING,
          response: response as unknown as Prisma.InputJsonValue,
        },
      });
      this.logger.log(`training-start player=${playerId} type=${troopType} quantity=${quantity} order=${orderId}`);
      return response;
    });
  }

  async saveFormation(context: DevelopmentPlayerContext, rawSlots: unknown): Promise<ArmyResponse> {
    const slots = this.validateFormationInput(rawSlots);
    return this.withPlayerTransaction(context, async (tx, playerId, kingdomId) => {
      const now = this.clock.now();
      await this.reconcileTraining(tx, playerId, now);

      const commanderIds = slots.map((slot) => slot.commanderPlayerHeroId);
      const commanders = await tx.playerHero.findMany({
        where: { id: { in: commanderIds } },
        ...commanderGraph,
      });
      for (const commanderId of commanderIds) {
        const commander = commanders.find((item) => item.id === commanderId);
        if (!commander || commander.playerId !== playerId) {
          throw new ArmyError('COMMANDER_NOT_OWNED', 'Every Commander must belong to this player.');
        }
        if (!commander.heroDefinition.enabled) {
          throw new ArmyError('COMMANDER_DISABLED', 'A disabled Commander cannot join an Army formation.');
        }
      }

      const troops = await tx.playerTroop.findMany({ where: { playerId } });
      for (const troopType of TROOP_TYPES) {
        const assigned = slots
          .filter((slot) => slot.troopType === troopType)
          .reduce((total, slot) => total + slot.unitCount, 0);
        const owned = troops.find((item) => item.troopType === troopType)?.readyCount ?? 0;
        if (assigned > owned) {
          throw new ArmyError('FORMATION_TROOP_COUNT_EXCEEDED', `Formation exceeds ready ${troopType} count.`);
        }
      }
      const maximum = armyCapacity(await this.loadCastleLevel(tx, kingdomId));
      const totalAssigned = slots.reduce((total, slot) => total + slot.unitCount, 0);
      if (totalAssigned > maximum) {
        throw new ArmyError('ARMY_CAPACITY_EXCEEDED', 'Formation exceeds Army capacity.');
      }

      const formation = await tx.armyFormation.findUniqueOrThrow({ where: { playerId } });
      await tx.armyFormationSlot.deleteMany({ where: { armyFormationId: formation.id } });
      await tx.armyFormationSlot.createMany({
        data: slots.map((slot) => ({
          armyFormationId: formation.id,
          slot: slot.slot,
          troopType: slot.troopType as PrismaTroopType,
          unitCount: slot.unitCount,
          commanderPlayerHeroId: slot.commanderPlayerHeroId,
        })),
      });
      await this.analytics.recordServer(tx, {
        playerId,
        eventName: 'army_formation_saved',
        dedupeKey: `army_formation_saved:${formation.id}:${now.getTime()}`,
        properties: { totalUnits: totalAssigned },
        occurredAt: now,
      });
      this.logger.log(`formation-save player=${playerId} total=${totalAssigned}`);
      return this.presentArmy(tx, playerId, kingdomId, now);
    });
  }

  async loadBattleArmy(
    tx: TransactionClient,
    playerId: string,
    side: 'ATTACKER' | 'DEFENDER',
    now: Date,
  ): Promise<ArmyCombatSquad[]> {
    await this.reconcileTraining(tx, playerId, now);
    const [formation, troops] = await Promise.all([
      tx.armyFormation.findUnique({ where: { playerId }, ...formationGraph }),
      tx.playerTroop.findMany({ where: { playerId } }),
    ]);
    if (!formation || formation.slots.length !== 3 || formation.slots.some((slot) => slot.unitCount <= 0)) {
      throw new ArmyError('FORMATION_INVALID', 'A complete three-squad Army formation is required.');
    }
    const commanderIds = formation.slots.map((slot) => slot.commanderPlayerHeroId);
    if (new Set(commanderIds).size !== 3) {
      throw new ArmyError('FORMATION_COMMANDER_DUPLICATE', 'A Commander can lead only one squad.');
    }
    for (const troopType of TROOP_TYPES) {
      const assigned = formation.slots
        .filter((slot) => slot.troopType === troopType)
        .reduce((total, slot) => total + slot.unitCount, 0);
      const ready = troops.find((troop) => troop.troopType === troopType)?.readyCount ?? 0;
      if (assigned > ready) {
        throw new ArmyError('FORMATION_INVALID', `The ${troopType} squad quantity is not battle-ready.`);
      }
    }
    return formation.slots.map((slot): ArmyCombatSquad => {
      if (!slot.commander.heroDefinition.enabled || slot.commander.playerId !== playerId) {
        throw new ArmyError('FORMATION_INVALID', 'Every squad needs an owned enabled Commander.');
      }
      const calculated = calculateArmySquad(this.powerInput(slot));
      return {
        side,
        slot: slot.slot as 1 | 2 | 3,
        troopType: calculated.troopType,
        initialUnitCount: calculated.unitCount,
        perUnitHp: calculated.perUnitHp,
        perUnitAtk: calculated.perUnitAtk,
        perUnitDef: calculated.perUnitDef,
        aggregateMaxHp: calculated.aggregateMaxHp,
        commanderKey: calculated.commanderKey,
        commanderLevel: calculated.commanderLevel,
        commanderSkillKey: calculated.commanderSkillKey,
        commanderPower: calculated.commanderPower,
        commanderPortraitAsset: slot.commander.heroDefinition.portraitAsset,
        squadPower: calculated.squadPower,
      };
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
            where: {
              platform_externalUserId: { platform: Platform.WEB, externalUserId: context.externalUserId },
            },
            include: { player: { include: { kingdom: true } } },
          });
          if (!account.player.kingdom) throw new Error('Player Kingdom bootstrap did not complete.');
          return operation(tx, account.playerId, account.player.kingdom.id);
        }, { maxWait: 5_000, timeout: 15_000 });
      } catch (error) {
        if (this.isRetryableConflict(error) && attempt < 3) continue;
        if (this.isRetryableConflict(error)) {
          throw new ArmyError('ARMY_CONFLICT', 'The Army is busy. Please retry.');
        }
        throw error;
      }
    }
    throw new ArmyError('ARMY_CONFLICT', 'The Army is busy. Please retry.');
  }

  private async reconcileTraining(tx: TransactionClient, playerId: string, now: Date): Promise<void> {
    const due = await tx.troopTrainingOrder.findMany({
      where: { playerId, status: TroopTrainingStatus.IN_PROGRESS, completesAt: { lte: now } },
    });
    for (const order of due) {
      const claimed = await tx.troopTrainingOrder.updateMany({
        where: {
          id: order.id,
          status: TroopTrainingStatus.IN_PROGRESS,
          completesAt: { lte: now },
        },
        data: { status: TroopTrainingStatus.COMPLETED, completedAt: now },
      });
      if (claimed.count !== 1) continue;
      await tx.playerTroop.update({
        where: {
          playerId_troopType: { playerId, troopType: order.troopType },
        },
        data: { readyCount: { increment: order.quantity } },
      });
      await this.analytics.recordServer(tx, {
        playerId,
        eventName: 'troop_training_completed',
        dedupeKey: `troop_training_completed:${order.id}`,
        properties: { troopType: order.troopType, quantity: order.quantity },
        occurredAt: now,
      });
      this.logger.log(`training-complete player=${playerId} order=${order.id} quantity=${order.quantity}`);
    }
  }

  private async presentArmy(
    tx: TransactionClient,
    playerId: string,
    kingdomId: string,
    now: Date,
  ): Promise<ArmyResponse> {
    const [troops, training, formation, commanders, castleLevel] = await Promise.all([
      tx.playerTroop.findMany({ where: { playerId } }),
      tx.troopTrainingOrder.findFirst({
        where: { playerId, status: TroopTrainingStatus.IN_PROGRESS },
        orderBy: { startedAt: 'asc' },
      }),
      tx.armyFormation.findUniqueOrThrow({ where: { playerId }, ...formationGraph }),
      tx.playerHero.findMany({
        where: { playerId, heroDefinition: { enabled: true } },
        ...commanderGraph,
        orderBy: { heroDefinition: { sortOrder: 'asc' } },
      }),
      this.loadCastleLevel(tx, kingdomId),
    ]);
    const maximum = armyCapacity(castleLevel);
    const ready = troops.reduce((total, troop) => total + troop.readyCount, 0);
    const trainingCount = training?.quantity ?? 0;
    const presentedFormation = this.presentFormation(formation);
    return {
      serverTime: now.toISOString(),
      power: presentedFormation.slots.reduce((total, slot) => total + slot.squadPower, 0),
      capacity: {
        maximum,
        ready,
        training: trainingCount,
        available: Math.max(0, maximum - ready - trainingCount),
      },
      troops: TROOP_TYPES.map((type) => ({
        type,
        readyCount: troops.find((troop) => troop.troopType === type)?.readyCount ?? 0,
        trainingCostPerUnit: this.presentCosts(TROOP_CONTENT[type].trainingCosts),
        trainingSecondsPerUnit: TROOP_CONTENT[type].trainingSecondsPerUnit,
      })),
      training: training ? {
        id: training.id,
        troopType: training.troopType as TroopType,
        quantity: training.quantity,
        startedAt: training.startedAt.toISOString(),
        completesAt: training.completesAt.toISOString(),
        remainingSeconds: Math.max(0, Math.ceil((training.completesAt.getTime() - now.getTime()) / 1_000)),
      } : null,
      formation: presentedFormation,
      commanders: commanders.map((commander) => this.presentCommander(commander)),
    };
  }

  private presentFormation(formation: FormationGraph): ArmyResponse['formation'] {
    return {
      slots: formation.slots.map((slot) => ({
        slot: slot.slot as 1 | 2 | 3,
        troopType: slot.troopType as TroopType,
        unitCount: slot.unitCount,
        commander: this.presentCommander(slot.commander),
        squadPower: calculateArmySquad(this.powerInput(slot)).squadPower,
      })),
    };
  }

  private powerInput(slot: FormationGraph['slots'][number]): ArmyPowerSquadInput {
    const key = slot.commander.heroDefinition.key as HeroKey;
    const stats = deriveHeroStats(HERO_CONTENT[key], slot.commander.level);
    return {
      troopType: slot.troopType as TroopType,
      unitCount: slot.unitCount,
      commanderKey: key,
      commanderLevel: slot.commander.level,
      commanderSkillKey: HERO_CONTENT[key].skillKey,
      commanderPower: stats.power,
    };
  }

  private presentCommander(commander: CommanderGraph): ArmyCommanderState {
    const key = commander.heroDefinition.key as HeroKey;
    return {
      playerHeroId: commander.id,
      key,
      level: commander.level,
      power: deriveHeroStats(HERO_CONTENT[key], commander.level).power,
      portraitAsset: commander.heroDefinition.portraitAsset,
    };
  }

  private async readyCount(tx: TransactionClient, playerId: string): Promise<number> {
    const rows = await tx.playerTroop.findMany({ where: { playerId }, select: { readyCount: true } });
    return rows.reduce((total, row) => total + row.readyCount, 0);
  }

  private async loadCastleLevel(tx: TransactionClient, kingdomId: string): Promise<number> {
    return (await tx.building.findUnique({
      where: { kingdomId_type: { kingdomId, type: 'CASTLE' } },
      select: { level: true },
    }))?.level ?? 1;
  }

  private async loadBalances(tx: TransactionClient, kingdomId: string): Promise<ResourceAmounts> {
    const rows = await tx.resourceBalance.findMany({ where: { kingdomId } });
    const balances: ResourceAmounts = { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0', GEMS: '0' };
    for (const row of rows) balances[row.resource] = row.amount.toString();
    return balances;
  }

  private presentCosts(costs: Partial<Record<ResourceType, bigint>>): Partial<Record<ResourceType, string>> {
    return Object.fromEntries(
      Object.entries(costs).map(([resource, amount]) => [resource, (amount ?? 0n).toString()]),
    );
  }

  private validateTroopType(value: unknown): TroopType {
    if (typeof value !== 'string' || !TROOP_TYPES.includes(value as TroopType)) {
      throw new ArmyError('INVALID_TROOP_TYPE', 'Troop type must be INFANTRY, ARCHER, or CAVALRY.');
    }
    return value as TroopType;
  }

  private validateTrainingQuantity(value: unknown): number {
    if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > MAX_TRAINING_BATCH) {
      throw new ArmyError(
        'INVALID_TRAINING_QUANTITY',
        `Training quantity must be an integer from 1 to ${MAX_TRAINING_BATCH}.`,
      );
    }
    return value as number;
  }

  private validateFormationInput(value: unknown): ArmyFormationSlotInput[] {
    if (!Array.isArray(value) || value.length !== 3) {
      throw new ArmyError('FORMATION_INVALID', 'An Army formation must contain exactly three slots.');
    }
    const slots = value.map((item): ArmyFormationSlotInput => {
      if (!item || typeof item !== 'object') {
        throw new ArmyError('FORMATION_INVALID', 'Every Army formation slot must be an object.');
      }
      const record = item as Record<string, unknown>;
      const slot = record.slot;
      const unitCount = record.unitCount;
      const commanderPlayerHeroId = record.commanderPlayerHeroId;
      if (!Number.isInteger(slot) || ![1, 2, 3].includes(slot as number)) {
        throw new ArmyError('FORMATION_INVALID', 'Formation slots must be exactly 1, 2, and 3.');
      }
      if (!Number.isInteger(unitCount) || (unitCount as number) <= 0) {
        throw new ArmyError('FORMATION_INVALID', 'Formation unit counts must be positive integers.');
      }
      if (typeof commanderPlayerHeroId !== 'string' || !commanderPlayerHeroId.trim()) {
        throw new ArmyError('FORMATION_INVALID', 'Every formation slot requires a Commander ID.');
      }
      return {
        slot: slot as 1 | 2 | 3,
        troopType: this.validateTroopType(record.troopType),
        unitCount: unitCount as number,
        commanderPlayerHeroId: commanderPlayerHeroId.trim(),
      };
    });
    if (new Set(slots.map((slot) => slot.slot)).size !== 3) {
      throw new ArmyError('FORMATION_INVALID', 'Formation slots must be unique.');
    }
    if (new Set(slots.map((slot) => slot.commanderPlayerHeroId)).size !== 3) {
      throw new ArmyError('FORMATION_COMMANDER_DUPLICATE', 'A Commander can occupy only one formation slot.');
    }
    return slots.sort((left, right) => left.slot - right.slot);
  }

  private validateIdempotencyKey(value: string | undefined): string {
    const key = value?.trim();
    if (!key || key.length < 8 || key.length > 100) {
      throw new ArmyError('INVALID_IDEMPOTENCY_KEY', 'A valid Idempotency-Key header is required.');
    }
    return key;
  }

  private isRetryableConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
  }
}

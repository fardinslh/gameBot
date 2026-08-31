import { Injectable, Logger } from '@nestjs/common';
import {
  EconomyAction,
  EconomyTransactionReason,
  EntitlementSource,
  Platform,
  Prisma,
  ProfileCrestKey as PrismaProfileCrestKey,
  ResourceType,
  ShopCategory as PrismaShopCategory,
  ShopFulfillmentType as PrismaShopFulfillmentType,
  TroopTrainingStatus,
  UpgradeStatus,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type {
  EquipProfileCrestResponse,
  KingdomBuildingType,
  ProfileCrestKey,
  PurchasableProfileCrestKey,
  ResourceAmounts,
  ShopPurchaseEvidence,
  ShopPurchaseItemKey,
  ShopPurchaseResponse,
  ShopPurchaseTargetState,
  ShopStateResponse,
  TroopType,
} from '@crown-and-coin/shared';
import { SHOP_PURCHASE_ITEM_KEYS } from '@crown-and-coin/shared';
import { AnalyticsService } from '../analytics/analytics.service';
import { ArmyService } from '../army/army.service';
import { EconomyService } from '../economy/economy.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import type { DevelopmentPlayerContext } from '../player/player-context.service';
import {
  buildingFinishPrice,
  SHOP_CATALOG,
  SHOP_GEM_SOURCES,
  trainingFinishPrice,
} from './shop.config';
import { ShopError } from './shop.errors';

type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class ShopService {
  private readonly logger = new Logger(ShopService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly army: ArmyService,
    private readonly analytics: AnalyticsService,
  ) {}

  async getState(context: DevelopmentPlayerContext): Promise<ShopStateResponse> {
    await this.economy.getKingdom(context);
    return this.withPlayerTransaction(context, async (tx, playerId, kingdomId) => {
      const now = new Date();
      await this.economy.reconcileCompletedUpgrades(tx, kingdomId, now);
      await this.army.reconcileTraining(tx, playerId, now);
      return this.buildState(tx, playerId, kingdomId, now);
    });
  }

  async purchase(
    context: DevelopmentPlayerContext,
    rawItemKey: unknown,
    rawTargetId: unknown,
    idempotencyKey: string | undefined,
  ): Promise<ShopPurchaseResponse> {
    const itemKey = this.validateItemKey(rawItemKey);
    const targetId = this.validateTargetId(rawTargetId);
    const key = this.validateIdempotencyKey(idempotencyKey);
    await this.economy.getKingdom(context);

    return this.withPlayerTransaction(context, async (tx, playerId, kingdomId) => {
      const previous = await tx.economyRequest.findUnique({
        where: { playerId_idempotencyKey_action: { playerId, idempotencyKey: key, action: EconomyAction.SHOP_PURCHASE } },
      });
      if (previous) return previous.response as unknown as ShopPurchaseResponse;

      const now = new Date();
      await this.economy.reconcileCompletedUpgrades(tx, kingdomId, now);
      await this.army.reconcileTraining(tx, playerId, now);

      const result = itemKey === 'BUILDING_FINISH'
        ? await this.purchaseBuildingFinish(tx, playerId, kingdomId, targetId, now)
        : itemKey === 'TROOP_TRAINING_FINISH'
          ? await this.purchaseTrainingFinish(tx, playerId, kingdomId, targetId, now)
          : await this.purchaseCosmetic(tx, playerId, kingdomId, itemKey, targetId, now);

      const shop = await this.buildState(tx, playerId, kingdomId, now);
      const response: ShopPurchaseResponse = {
        purchase: this.presentPurchase(result.purchase),
        gemBalance: shop.gemBalance,
        balances: shop.balances,
        equippedProfileCrest: shop.equippedProfileCrest,
        target: result.target,
        shop,
        serverTime: now.toISOString(),
      };
      await tx.economyRequest.create({
        data: {
          playerId,
          idempotencyKey: key,
          action: EconomyAction.SHOP_PURCHASE,
          response: response as unknown as Prisma.InputJsonValue,
        },
      });
      await this.analytics.recordServer(tx, {
        playerId,
        eventName: 'shop_purchase_completed',
        dedupeKey: `shop_purchase_completed:${result.purchase.id}`,
        properties: {
          itemKey: result.purchase.itemKey,
          category: result.purchase.category,
          priceGems: result.purchase.gemPrice,
          purchaseType: result.purchase.fulfillmentType,
          targetType: result.purchase.targetType,
        },
        occurredAt: now,
      });
      this.logger.log(`purchase player=${playerId} item=${itemKey} gems=${result.purchase.gemPrice}`);
      return response;
    });
  }

  async equipProfileCrest(context: DevelopmentPlayerContext, rawItemKey: unknown): Promise<EquipProfileCrestResponse> {
    const itemKey = this.validateProfileCrest(rawItemKey);
    await this.economy.getKingdom(context);
    return this.withPlayerTransaction(context, async (tx, playerId, kingdomId) => {
      const now = new Date();
      if (itemKey !== 'DEFAULT') {
        const catalog = SHOP_CATALOG.find((item) => item.key === itemKey);
        if (!catalog) throw new ShopError('SHOP_ITEM_NOT_FOUND', 'Profile Crest does not exist.');
        if (!catalog.enabled) throw new ShopError('SHOP_ITEM_DISABLED', 'Profile Crest is unavailable.');
        const owned = await tx.playerEntitlement.findUnique({
          where: { playerId_entitlementKey: { playerId, entitlementKey: itemKey } },
        });
        if (!owned) throw new ShopError('SHOP_ENTITLEMENT_REQUIRED', 'Own this Profile Crest before equipping it.');
      }
      await tx.player.update({ where: { id: playerId }, data: { equippedProfileCrest: itemKey as PrismaProfileCrestKey } });
      await this.analytics.recordServer(tx, {
        playerId,
        eventName: 'shop_cosmetic_equipped',
        dedupeKey: `shop_cosmetic_equipped:${playerId}:${itemKey}:${randomUUID()}`,
        properties: { itemKey, category: 'COSMETICS' },
        occurredAt: now,
      });
      const shop = await this.buildState(tx, playerId, kingdomId, now);
      return { equippedProfileCrest: itemKey, shop, serverTime: now.toISOString() };
    });
  }

  private async purchaseCosmetic(
    tx: TransactionClient,
    playerId: string,
    kingdomId: string,
    itemKey: PurchasableProfileCrestKey,
    targetId: string | null,
    now: Date,
  ) {
    if (targetId) throw new ShopError('SHOP_INVALID_PURCHASE', 'Profile Crest purchases do not accept a target.');
    const item = SHOP_CATALOG.find((candidate) => candidate.key === itemKey);
    if (!item) throw new ShopError('SHOP_ITEM_NOT_FOUND', 'Shop item does not exist.');
    if (!item.enabled) throw new ShopError('SHOP_ITEM_DISABLED', 'Shop item is unavailable.');
    const owned = await tx.playerEntitlement.findUnique({
      where: { playerId_entitlementKey: { playerId, entitlementKey: item.key } },
    });
    if (owned) throw new ShopError('SHOP_ITEM_ALREADY_OWNED', 'This permanent Profile Crest is already owned.');
    const purchase = await tx.shopPurchase.create({
      data: {
        playerId,
        itemKey: item.key,
        category: PrismaShopCategory.COSMETICS,
        fulfillmentType: PrismaShopFulfillmentType.PROFILE_CREST,
        gemPrice: item.gemPrice,
      },
    });
    await this.chargeGems(tx, playerId, kingdomId, item.gemPrice, purchase.id);
    await tx.playerEntitlement.create({
      data: {
        playerId,
        entitlementKey: item.key,
        source: EntitlementSource.SHOP,
        sourceReferenceId: purchase.id,
      },
    });
    return {
      purchase,
      target: { type: 'PROFILE_CREST', itemKey: item.key, status: 'OWNED' } as ShopPurchaseTargetState,
    };
  }

  private async purchaseBuildingFinish(
    tx: TransactionClient,
    playerId: string,
    kingdomId: string,
    targetId: string | null,
    now: Date,
  ) {
    if (!targetId) throw new ShopError('SHOP_INVALID_PURCHASE', 'Building Finish requires an upgrade target.');
    const upgrade = await tx.buildingUpgrade.findUnique({ where: { id: targetId }, include: { building: true } });
    if (!upgrade) throw new ShopError('SHOP_TARGET_NOT_FOUND', 'Building upgrade does not exist.');
    if (upgrade.building.kingdomId !== kingdomId) throw new ShopError('SHOP_TARGET_NOT_OWNER', 'Building upgrade belongs to another player.');
    if (upgrade.status !== UpgradeStatus.IN_PROGRESS || !upgrade.completesAt) {
      throw new ShopError('SHOP_TARGET_ALREADY_COMPLETE', 'Building upgrade is already complete.');
    }
    const remainingSeconds = Math.max(0, Math.ceil((upgrade.completesAt.getTime() - now.getTime()) / 1_000));
    if (remainingSeconds <= 0) throw new ShopError('SHOP_TARGET_ALREADY_COMPLETE', 'Building upgrade completed naturally.');
    const price = buildingFinishPrice(remainingSeconds);
    const purchase = await tx.shopPurchase.create({
      data: {
        playerId,
        itemKey: 'BUILDING_FINISH',
        category: PrismaShopCategory.CONVENIENCE,
        fulfillmentType: PrismaShopFulfillmentType.BUILDING_FINISH,
        gemPrice: price,
        targetType: 'BUILDING_UPGRADE',
        targetId: upgrade.id,
      },
    });
    await this.chargeGems(tx, playerId, kingdomId, price, purchase.id);
    const completed = await this.economy.completeUpgradeInTransaction(tx, kingdomId, upgrade.id, now, true);
    if (!completed) throw new ShopError('SHOP_TARGET_ALREADY_COMPLETE', 'Building upgrade was already completed.');
    return {
      purchase,
      target: {
        type: 'BUILDING_UPGRADE',
        id: upgrade.id,
        buildingId: completed.buildingId,
        status: 'COMPLETED',
        level: completed.level,
      } as ShopPurchaseTargetState,
    };
  }

  private async purchaseTrainingFinish(
    tx: TransactionClient,
    playerId: string,
    kingdomId: string,
    targetId: string | null,
    now: Date,
  ) {
    if (!targetId) throw new ShopError('SHOP_INVALID_PURCHASE', 'Training Finish requires an active order target.');
    const order = await tx.troopTrainingOrder.findUnique({ where: { id: targetId } });
    if (!order) throw new ShopError('SHOP_TARGET_NOT_FOUND', 'Training order does not exist.');
    if (order.playerId !== playerId) throw new ShopError('SHOP_TARGET_NOT_OWNER', 'Training order belongs to another player.');
    if (order.status !== TroopTrainingStatus.IN_PROGRESS) {
      throw new ShopError('SHOP_TARGET_ALREADY_COMPLETE', 'Training order is already complete.');
    }
    const remainingSeconds = Math.max(0, Math.ceil((order.completesAt.getTime() - now.getTime()) / 1_000));
    if (remainingSeconds <= 0) throw new ShopError('SHOP_TARGET_ALREADY_COMPLETE', 'Training order completed naturally.');
    const price = trainingFinishPrice(remainingSeconds);
    const purchase = await tx.shopPurchase.create({
      data: {
        playerId,
        itemKey: 'TROOP_TRAINING_FINISH',
        category: PrismaShopCategory.CONVENIENCE,
        fulfillmentType: PrismaShopFulfillmentType.TROOP_TRAINING_FINISH,
        gemPrice: price,
        targetType: 'TROOP_TRAINING',
        targetId: order.id,
      },
    });
    await this.chargeGems(tx, playerId, kingdomId, price, purchase.id);
    const completed = await this.army.completeTrainingInTransaction(tx, playerId, order.id, now, true);
    if (!completed) throw new ShopError('SHOP_TARGET_ALREADY_COMPLETE', 'Training order was already completed.');
    return {
      purchase,
      target: {
        type: 'TROOP_TRAINING',
        id: completed.id,
        troopType: completed.troopType,
        quantity: completed.quantity,
        status: 'COMPLETED',
      } as ShopPurchaseTargetState,
    };
  }

  private async chargeGems(
    tx: TransactionClient,
    playerId: string,
    kingdomId: string,
    price: number,
    purchaseId: string,
  ): Promise<void> {
    const amount = BigInt(price);
    const balance = await tx.resourceBalance.findUnique({
      where: { kingdomId_resource: { kingdomId, resource: ResourceType.GEMS } },
    });
    if (!balance || balance.amount < amount) throw new ShopError('INSUFFICIENT_GEMS', 'Not enough Gems.');
    const charged = await tx.resourceBalance.updateMany({
      where: { id: balance.id, amount: { gte: amount } },
      data: { amount: { decrement: amount } },
    });
    if (charged.count !== 1) throw new ShopError('INSUFFICIENT_GEMS', 'Not enough Gems.');
    await tx.economyTransaction.create({
      data: {
        playerId,
        kingdomId,
        balanceId: balance.id,
        resourceType: ResourceType.GEMS,
        delta: -amount,
        balanceBefore: balance.amount,
        balanceAfter: balance.amount - amount,
        reason: EconomyTransactionReason.SHOP_GEM_SPEND,
        referenceId: purchaseId,
      },
    });
  }

  private async buildState(tx: TransactionClient, playerId: string, kingdomId: string, now: Date): Promise<ShopStateResponse> {
    const [player, balanceRows, entitlements, upgrades, training] = await Promise.all([
      tx.player.findUniqueOrThrow({ where: { id: playerId }, select: { equippedProfileCrest: true } }),
      tx.resourceBalance.findMany({ where: { kingdomId } }),
      tx.playerEntitlement.findMany({ where: { playerId }, select: { entitlementKey: true } }),
      tx.buildingUpgrade.findMany({
        where: { status: UpgradeStatus.IN_PROGRESS, building: { kingdomId } },
        include: { building: true },
        orderBy: { completesAt: 'asc' },
      }),
      tx.troopTrainingOrder.findFirst({
        where: { playerId, status: TroopTrainingStatus.IN_PROGRESS },
        orderBy: { startedAt: 'asc' },
      }),
    ]);
    const balances = this.presentBalances(balanceRows);
    const owned = new Set(entitlements.map((item) => item.entitlementKey));
    return {
      serverTime: now.toISOString(),
      gemBalance: balances.GEMS,
      balances,
      equippedProfileCrest: player.equippedProfileCrest as ProfileCrestKey,
      cosmetics: SHOP_CATALOG.map((item) => ({
        itemKey: item.key,
        category: 'COSMETICS',
        fulfillmentType: 'PROFILE_CREST',
        priceGems: item.gemPrice,
        displayOrder: item.displayOrder,
        enabled: item.enabled,
        owned: owned.has(item.key),
        equipped: player.equippedProfileCrest === item.key,
      })),
      convenience: {
        buildingFinishes: upgrades.flatMap((upgrade) => {
          if (!upgrade.completesAt) return [];
          const remainingSeconds = Math.max(0, Math.ceil((upgrade.completesAt.getTime() - now.getTime()) / 1_000));
          if (remainingSeconds <= 0) return [];
          return [{
            itemKey: 'BUILDING_FINISH' as const,
            category: 'CONVENIENCE' as const,
            fulfillmentType: 'BUILDING_FINISH' as const,
            targetId: upgrade.id,
            buildingId: upgrade.buildingId,
            buildingType: upgrade.building.type as KingdomBuildingType,
            targetLevel: upgrade.toLevel,
            remainingSeconds,
            priceGems: buildingFinishPrice(remainingSeconds),
          }];
        }),
        troopTrainingFinish: training ? {
          itemKey: 'TROOP_TRAINING_FINISH',
          category: 'CONVENIENCE',
          fulfillmentType: 'TROOP_TRAINING_FINISH',
          targetId: training.id,
          trainingOrderId: training.id,
          troopType: training.troopType as TroopType,
          quantity: training.quantity,
          remainingSeconds: Math.max(0, Math.ceil((training.completesAt.getTime() - now.getTime()) / 1_000)),
          priceGems: trainingFinishPrice(Math.max(0, Math.ceil((training.completesAt.getTime() - now.getTime()) / 1_000))),
        } : null,
      },
      gemSources: [...SHOP_GEM_SOURCES],
    };
  }

  private presentBalances(rows: Array<{ resource: ResourceType; amount: bigint }>): ResourceAmounts {
    const balances: ResourceAmounts = { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0', GEMS: '0' };
    for (const row of rows) balances[row.resource] = row.amount.toString();
    return balances;
  }

  private presentPurchase(purchase: {
    id: string;
    itemKey: string;
    category: PrismaShopCategory;
    fulfillmentType: PrismaShopFulfillmentType;
    gemPrice: number;
    targetType: string | null;
    targetId: string | null;
    createdAt: Date;
  }): ShopPurchaseEvidence {
    return {
      id: purchase.id,
      itemKey: purchase.itemKey as ShopPurchaseItemKey,
      category: purchase.category,
      fulfillmentType: purchase.fulfillmentType,
      gemPrice: purchase.gemPrice,
      targetType: purchase.targetType,
      targetId: purchase.targetId,
      createdAt: purchase.createdAt.toISOString(),
    };
  }

  private validateItemKey(value: unknown): ShopPurchaseItemKey {
    if (typeof value !== 'string' || !SHOP_PURCHASE_ITEM_KEYS.includes(value as ShopPurchaseItemKey)) {
      throw new ShopError('SHOP_ITEM_NOT_FOUND', 'Shop item does not exist.');
    }
    return value as ShopPurchaseItemKey;
  }

  private validateProfileCrest(value: unknown): ProfileCrestKey {
    if (value === 'DEFAULT' || SHOP_CATALOG.some((item) => item.key === value)) return value as ProfileCrestKey;
    throw new ShopError('SHOP_ITEM_NOT_FOUND', 'Profile Crest does not exist.');
  }

  private validateTargetId(value: unknown): string | null {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || value.trim().length > 100) {
      throw new ShopError('SHOP_INVALID_PURCHASE', 'Purchase target is invalid.');
    }
    return value.trim();
  }

  private validateIdempotencyKey(value: string | undefined): string {
    const key = value?.trim();
    if (!key || key.length < 8 || key.length > 100) {
      throw new ShopError('INVALID_IDEMPOTENCY_KEY', 'A valid Idempotency-Key header is required.');
    }
    return key;
  }

  private async withPlayerTransaction<T>(
    context: DevelopmentPlayerContext,
    operation: (tx: TransactionClient, playerId: string, kingdomId: string) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(hashtext(${`${context.platform}:${context.externalUserId}`}))`;
          const account = await tx.platformAccount.findUniqueOrThrow({
            where: { platform_externalUserId: { platform: Platform.WEB, externalUserId: context.externalUserId } },
            include: { player: { include: { kingdom: true } } },
          });
          if (!account.player.kingdom) throw new Error('Player Kingdom bootstrap did not complete.');
          return operation(tx, account.playerId, account.player.kingdom.id);
        }, { maxWait: 5_000, timeout: 15_000 });
      } catch (error) {
        if (this.isRetryableConflict(error) && attempt < 3) continue;
        if (this.isRetryableConflict(error)) throw new ShopError('SHOP_CONFLICT', 'Shop is busy. Please retry.');
        throw error;
      }
    }
    throw new ShopError('SHOP_CONFLICT', 'Shop is busy. Please retry.');
  }

  private isRetryableConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
  }
}

import { Injectable } from '@nestjs/common';
import {
  EconomyTransactionReason,
  Platform,
  Prisma,
  ResourceType,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { KingdomBuildingType, RaidResourceType } from '@crown-and-coin/shared';
import { KINGDOM_BUILDING_TYPES } from '@crown-and-coin/shared';
import { isBuildingUnlocked } from '../economy/building-unlocks.config';
import { EconomyService } from '../economy/economy.service';
import { STARTER_HERO_KEYS } from '../heroes/hero.config';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import {
  type ConfiguredSystemOpponent,
  SYSTEM_OPPONENT_EXTERNAL_IDS,
  SYSTEM_OPPONENTS,
} from './system-opponent.config';

type Tx = Prisma.TransactionClient;

export interface PreparedSystemOpponent {
  resourceBalances: { id: string; resource: ResourceType; amount: bigint }[];
  buildings: { type: string; level: number }[];
}

@Injectable()
export class SystemOpponentService {
  private ready: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService, private readonly economy: EconomyService) {}

  ensure(): Promise<void> {
    this.ready ??= this.ensurePool().catch((error) => {
      this.ready = null;
      throw error;
    });
    return this.ready;
  }

  async configuredPlayers(): Promise<Map<string, ConfiguredSystemOpponent>> {
    await this.ensure();
    const accounts = await this.prisma.platformAccount.findMany({
      where: { platform: Platform.WEB, externalUserId: { in: [...SYSTEM_OPPONENT_EXTERNAL_IDS] } },
      select: { playerId: true, externalUserId: true },
    });
    const byExternalId = new Map(SYSTEM_OPPONENTS.map((opponent) => [opponent.externalId, opponent]));
    return new Map(accounts.flatMap((account) => {
      const configured = byExternalId.get(account.externalUserId);
      return configured ? [[account.playerId, configured] as const] : [];
    }));
  }

  async prepareForOffer(
    playerId: string,
    configured: ConfiguredSystemOpponent,
  ): Promise<PreparedSystemOpponent> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockSystemOpponent(tx, configured.externalId);
      const player = await tx.player.findUniqueOrThrow({
        where: { id: playerId },
        include: { kingdom: { include: { resourceBalances: true, buildings: true } } },
      });
      if (!player.isSystemOpponent || !player.kingdom) throw new Error('Configured system opponent is unavailable.');

      const referenceId = `system-replenish:${randomUUID()}`;
      for (const resource of Object.keys(configured.tier.resourceTargets) as RaidResourceType[]) {
        const balance = player.kingdom.resourceBalances.find((row) => row.resource === resource);
        if (!balance) throw new Error(`System opponent is missing ${resource}.`);
        const threshold = configured.tier.resourceThresholds[resource];
        const target = configured.tier.resourceTargets[resource];
        if (balance.amount >= threshold) continue;
        const delta = target - balance.amount;
        await tx.resourceBalance.update({ where: { id: balance.id }, data: { amount: target } });
        await tx.economyTransaction.create({
          data: {
            playerId,
            kingdomId: player.kingdom.id,
            balanceId: balance.id,
            resourceType: resource as ResourceType,
            delta,
            balanceBefore: balance.amount,
            balanceAfter: target,
            reason: EconomyTransactionReason.SYSTEM_OPPONENT_REPLENISH,
            referenceId,
          },
        });
      }

      const refreshed = await tx.kingdom.findUniqueOrThrow({
        where: { id: player.kingdom.id },
        include: { resourceBalances: true, buildings: true },
      });
      return { resourceBalances: refreshed.resourceBalances, buildings: refreshed.buildings };
    }, { maxWait: 5_000, timeout: 15_000 });
  }

  private async ensurePool(): Promise<void> {
    for (const configured of SYSTEM_OPPONENTS) await this.ensureOpponent(configured);
  }

  private async ensureOpponent(configured: ConfiguredSystemOpponent): Promise<void> {
    await this.economy.getKingdom({ platform: 'WEB', externalUserId: configured.externalId });
    await this.prisma.$transaction(async (tx) => {
      await this.lockSystemOpponent(tx, configured.externalId);
      const account = await tx.platformAccount.findUniqueOrThrow({
        where: { platform_externalUserId: { platform: Platform.WEB, externalUserId: configured.externalId } },
        include: {
          player: {
            include: {
              kingdom: { include: { resourceBalances: true, buildings: true } },
              heroes: { include: { heroDefinition: true } },
            },
          },
        },
      });
      const player = account.player;
      if (!player.kingdom) throw new Error('System opponent Kingdom is missing.');
      const newlyClassified = !player.isSystemOpponent;
      await tx.player.update({
        where: { id: player.id },
        data: {
          displayName: configured.displayName,
          trophies: configured.trophies,
          isSystemOpponent: true,
        },
      });
      await tx.kingdom.update({
        where: { id: player.kingdom.id },
        data: { name: configured.kingdomName, level: configured.tier.castleLevel },
      });

      for (const building of player.kingdom.buildings) {
        const type = building.type as KingdomBuildingType;
        const level = type === 'CASTLE'
          ? configured.tier.castleLevel
          : isBuildingUnlocked(type, configured.tier.castleLevel)
            ? configured.tier.buildingLevel
            : 1;
        await tx.building.update({ where: { id: building.id }, data: { level } });
      }
      for (let index = 0; index < STARTER_HERO_KEYS.length; index += 1) {
        const hero = player.heroes.find((row) => row.heroDefinition.key === STARTER_HERO_KEYS[index]);
        if (!hero) throw new Error(`System opponent is missing ${STARTER_HERO_KEYS[index]}.`);
        await tx.playerHero.update({ where: { id: hero.id }, data: { level: configured.heroLevels[index] } });
      }

      if (newlyClassified) await this.seedTargetBalances(tx, player.id, player.kingdom.id, player.kingdom.resourceBalances, configured);
      await this.ensureBuildingShape(tx, player.kingdom.id);
    }, { maxWait: 5_000, timeout: 15_000 });
  }

  private async seedTargetBalances(
    tx: Tx,
    playerId: string,
    kingdomId: string,
    balances: { id: string; resource: ResourceType; amount: bigint }[],
    configured: ConfiguredSystemOpponent,
  ): Promise<void> {
    const referenceId = `system-bootstrap:${configured.externalId}`;
    for (const resource of Object.keys(configured.tier.resourceTargets) as RaidResourceType[]) {
      const balance = balances.find((row) => row.resource === resource);
      if (!balance) throw new Error(`System opponent is missing ${resource}.`);
      const target = configured.tier.resourceTargets[resource];
      const delta = target - balance.amount;
      if (delta === 0n) continue;
      await tx.resourceBalance.update({ where: { id: balance.id }, data: { amount: target } });
      await tx.economyTransaction.create({
        data: {
          playerId,
          kingdomId,
          balanceId: balance.id,
          resourceType: resource as ResourceType,
          delta,
          balanceBefore: balance.amount,
          balanceAfter: target,
          reason: EconomyTransactionReason.ADMIN_OR_SEED,
          referenceId,
        },
      });
    }
  }

  private async ensureBuildingShape(tx: Tx, kingdomId: string): Promise<void> {
    for (const type of KINGDOM_BUILDING_TYPES) {
      await tx.building.upsert({
        where: { kingdomId_type: { kingdomId, type } },
        create: { kingdomId, type },
        update: {},
      });
    }
  }

  private async lockSystemOpponent(tx: Tx, externalId: string): Promise<void> {
    await tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(hashtext(${`WEB:${externalId}`}))`;
  }
}

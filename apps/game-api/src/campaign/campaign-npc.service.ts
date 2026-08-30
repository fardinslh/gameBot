import { Injectable } from '@nestjs/common';
import { Platform, Prisma, TroopType as PrismaTroopType } from '@prisma/client';
import { EconomyService } from '../economy/economy.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { CAMPAIGN_EXTERNAL_IDS, CAMPAIGN_STAGES, type CampaignStageDefinition } from './campaign.config';

type Tx = Prisma.TransactionClient;

@Injectable()
export class CampaignNpcService {
  private ready: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService, private readonly economy: EconomyService) {}

  ensure(): Promise<void> {
    this.ready ??= this.ensureAll().catch((error) => {
      this.ready = null;
      throw error;
    });
    return this.ready;
  }

  async playerIdsByStage(): Promise<Map<string, string>> {
    await this.ensure();
    const accounts = await this.prisma.platformAccount.findMany({
      where: { platform: Platform.WEB, externalUserId: { in: [...CAMPAIGN_EXTERNAL_IDS] } },
      select: { playerId: true, externalUserId: true },
    });
    const stageByExternalId = new Map(CAMPAIGN_STAGES.map((stage) => [stage.externalId, stage.key]));
    return new Map(accounts.flatMap((account) => {
      const stageKey = stageByExternalId.get(account.externalUserId);
      return stageKey ? [[stageKey, account.playerId] as const] : [];
    }));
  }

  private async ensureAll(): Promise<void> {
    for (const stage of CAMPAIGN_STAGES) await this.ensureStage(stage);
  }

  private async ensureStage(stage: CampaignStageDefinition): Promise<void> {
    await this.economy.getKingdom({ platform: 'WEB', externalUserId: stage.externalId });
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(hashtext(${`WEB:${stage.externalId}`}))`;
      const account = await tx.platformAccount.findUniqueOrThrow({
        where: { platform_externalUserId: { platform: Platform.WEB, externalUserId: stage.externalId } },
        include: {
          player: {
            include: {
              kingdom: { include: { buildings: true } },
              heroes: { include: { heroDefinition: true } },
              armyFormation: true,
            },
          },
        },
      });
      const player = account.player;
      if (!player.kingdom) throw new Error(`Campaign NPC ${stage.key} has no Kingdom.`);
      await tx.player.update({
        where: { id: player.id },
        data: {
          displayName: stage.enemyName.en,
          trophies: 1000,
          isSystemOpponent: true,
          systemOpponentKind: 'CAMPAIGN',
        },
      });
      await tx.kingdom.update({
        where: { id: player.kingdom.id },
        data: { name: stage.enemyName.en, level: stage.castleLevel },
      });
      for (const building of player.kingdom.buildings) {
        await tx.building.update({
          where: { id: building.id },
          data: { level: building.type === 'CASTLE' ? stage.castleLevel : Math.max(1, stage.castleLevel - 1) },
        });
      }
      for (const hero of player.heroes) {
        const configured = stage.formation.find((slot) => slot.commanderKey === hero.heroDefinition.key);
        if (!configured) continue;
        await tx.playerHero.update({ where: { id: hero.id }, data: { level: configured.commanderLevel } });
      }
      await this.ensureArmy(tx, player, stage);
    }, { maxWait: 5_000, timeout: 20_000 });
  }

  private async ensureArmy(
    tx: Tx,
    player: {
      id: string;
      heroes: { id: string; heroDefinition: { key: string } }[];
      armyFormation: { id: string } | null;
    },
    stage: CampaignStageDefinition,
  ): Promise<void> {
    const counts = new Map<PrismaTroopType, number>([
      [PrismaTroopType.INFANTRY, 0],
      [PrismaTroopType.ARCHER, 0],
      [PrismaTroopType.CAVALRY, 0],
    ]);
    for (const slot of stage.formation) {
      const type = slot.troopType as PrismaTroopType;
      counts.set(type, (counts.get(type) ?? 0) + slot.unitCount);
    }
    for (const [troopType, readyCount] of counts) {
      await tx.playerTroop.upsert({
        where: { playerId_troopType: { playerId: player.id, troopType } },
        create: { playerId: player.id, troopType, readyCount },
        update: { readyCount },
      });
    }
    const formation = player.armyFormation ?? await tx.armyFormation.create({ data: { playerId: player.id } });
    await tx.armyFormationSlot.deleteMany({ where: { armyFormationId: formation.id } });
    await tx.armyFormationSlot.createMany({
      data: stage.formation.map((slot, index) => {
        const commander = player.heroes.find((hero) => hero.heroDefinition.key === slot.commanderKey);
        if (!commander) throw new Error(`Campaign NPC ${stage.key} lacks ${slot.commanderKey}.`);
        return {
          armyFormationId: formation.id,
          slot: index + 1,
          troopType: slot.troopType as PrismaTroopType,
          unitCount: slot.unitCount,
          commanderPlayerHeroId: commander.id,
        };
      }),
    });
  }
}

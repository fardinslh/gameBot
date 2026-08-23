import { Injectable } from '@nestjs/common';
import { Platform, ResourceType } from '@prisma/client';
import { EconomyService } from '../economy/economy.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { DEVELOPMENT_OPPONENTS } from './raid.config';

@Injectable()
export class RaidFixtureService {
  private ready: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService, private readonly economy: EconomyService) {}

  ensure(): Promise<void> {
    this.ready ??= this.createMissingFixtures();
    return this.ready;
  }

  private async createMissingFixtures(): Promise<void> {
    for (const fixture of DEVELOPMENT_OPPONENTS) {
      const existing = await this.prisma.platformAccount.findUnique({
        where: { platform_externalUserId: { platform: Platform.WEB, externalUserId: fixture.externalId } },
      });
      await this.economy.getKingdom({ platform: 'WEB', externalUserId: fixture.externalId });
      if (existing) continue;
      await this.prisma.$transaction(async (tx) => {
        const account = await tx.platformAccount.findUniqueOrThrow({
          where: { platform_externalUserId: { platform: Platform.WEB, externalUserId: fixture.externalId } },
          include: { player: { include: { kingdom: true } } },
        });
        const kingdom = account.player.kingdom;
        if (!kingdom) throw new Error('Development opponent Kingdom is missing.');
        await tx.player.update({
          where: { id: account.playerId },
          data: { displayName: fixture.name, trophies: fixture.trophies, isDevelopmentOpponent: true },
        });
        await tx.kingdom.update({ where: { id: kingdom.id }, data: { name: fixture.kingdom, level: fixture.level } });
        await tx.building.updateMany({
          where: { kingdomId: kingdom.id, type: 'CASTLE' },
          data: { level: fixture.level },
        });
        const resources = [ResourceType.GOLD, ResourceType.FOOD, ResourceType.WOOD, ResourceType.STONE] as const;
        for (let index = 0; index < resources.length; index += 1) {
          await tx.resourceBalance.update({
            where: { kingdomId_resource: { kingdomId: kingdom.id, resource: resources[index] } },
            data: { amount: fixture.resources[index] },
          });
        }
        await tx.playerHero.updateMany({ where: { playerId: account.playerId }, data: { level: fixture.level } });
      });
    }
  }
}


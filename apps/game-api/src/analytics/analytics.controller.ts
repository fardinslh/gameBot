import { Body, Controller, Headers, Post } from '@nestjs/common';
import { Platform } from '@prisma/client';
import type { AnalyticsEventsResponse } from '@crown-and-coin/shared';
import { EconomyService } from '../economy/economy.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { PlayerContextService } from '../player/player-context.service';
import { AnalyticsEventsDto } from './analytics.dto';
import { AnalyticsRateLimiter } from './analytics-rate-limiter.service';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly economy: EconomyService,
    private readonly prisma: PrismaService,
    private readonly playerContext: PlayerContextService,
    private readonly limiter: AnalyticsRateLimiter,
  ) {}

  @Post('events')
  async ingest(
    @Body() body: AnalyticsEventsDto,
    @Headers('x-dev-player-id') developmentPlayerId?: string,
  ): Promise<AnalyticsEventsResponse> {
    const context = this.playerContext.resolve(developmentPlayerId);
    await this.economy.getKingdom(context);
    const account = await this.prisma.platformAccount.findUniqueOrThrow({
      where: { platform_externalUserId: { platform: Platform.WEB, externalUserId: context.externalUserId } },
      select: { playerId: true, platform: true },
    });
    this.limiter.assert(account.playerId);
    return this.analytics.ingestClient(account.playerId, account.platform, body.events);
  }
}

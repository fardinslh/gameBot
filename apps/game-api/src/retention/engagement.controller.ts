import { Controller, Get, Headers, Post } from '@nestjs/common';
import type { EngagementOverviewResponse, EngagementSessionResponse, RoyalDecreeClaimResponse } from '@crown-and-coin/shared';
import { PlayerContextService } from '../player/player-context.service';
import { EngagementService } from './engagement.service';

@Controller('engagement')
export class EngagementController {
  constructor(private readonly engagement: EngagementService, private readonly playerContext: PlayerContextService) {}

  @Get()
  get(@Headers('x-dev-player-id') player?: string): Promise<EngagementOverviewResponse> {
    return this.engagement.getOverview(this.playerContext.resolve(player));
  }

  @Post('session')
  openSession(@Headers('x-dev-player-id') player?: string, @Headers('idempotency-key') key?: string): Promise<EngagementSessionResponse> {
    return this.engagement.openSession(this.playerContext.resolve(player), key);
  }

  @Post('heartbeat')
  heartbeat(@Headers('x-dev-player-id') player?: string): Promise<{ serverTime: string }> {
    return this.engagement.heartbeat(this.playerContext.resolve(player));
  }

  @Post('royal-decree/claim')
  claimRoyalDecree(@Headers('x-dev-player-id') player?: string, @Headers('idempotency-key') key?: string): Promise<RoyalDecreeClaimResponse> {
    return this.engagement.claimRoyalDecree(this.playerContext.resolve(player), key);
  }
}

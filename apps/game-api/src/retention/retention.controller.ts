import { Controller, Get, Headers, Param, ParseIntPipe, Post } from '@nestjs/common';
import type { RetentionClaimResponse, RetentionStateResponse } from '@crown-and-coin/shared';
import { PlayerContextService } from '../player/player-context.service';
import { RetentionService } from './retention.service';

@Controller('retention')
export class RetentionController {
  constructor(private readonly retention: RetentionService, private readonly playerContext: PlayerContextService) {}

  @Get()
  getState(@Headers('x-dev-player-id') player?: string): Promise<RetentionStateResponse> {
    return this.retention.getState(this.playerContext.resolve(player));
  }

  @Post('missions/:missionId/claim')
  claimMission(@Param('missionId') missionId: string, @Headers('x-dev-player-id') player?: string, @Headers('idempotency-key') key?: string): Promise<RetentionClaimResponse> {
    return this.retention.claimMission(this.playerContext.resolve(player), missionId, key);
  }

  @Post('daily/bonus/claim')
  claimDailyBonus(@Headers('x-dev-player-id') player?: string, @Headers('idempotency-key') key?: string): Promise<RetentionClaimResponse> {
    return this.retention.claimDailyBonus(this.playerContext.resolve(player), key);
  }

  @Post('achievements/:achievementKey/:tier/claim')
  claimAchievement(@Param('achievementKey') achievementKey: string, @Param('tier', ParseIntPipe) tier: number, @Headers('x-dev-player-id') player?: string, @Headers('idempotency-key') key?: string): Promise<RetentionClaimResponse> {
    return this.retention.claimAchievement(this.playerContext.resolve(player), achievementKey, tier, key);
  }

  @Post('daily-return/claim')
  claimDailyReturn(@Headers('x-dev-player-id') player?: string, @Headers('idempotency-key') key?: string): Promise<RetentionClaimResponse> {
    return this.retention.claimDailyReturn(this.playerContext.resolve(player), key);
  }
}

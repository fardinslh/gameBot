import { Controller, Get, Headers, Param, Post } from '@nestjs/common';
import type { CampaignBattleStartResponse, CampaignResponse, CampaignRewardClaimResponse } from '@crown-and-coin/shared';
import { PlayerContextService } from '../player/player-context.service';
import { CampaignService } from './campaign.service';

@Controller('campaign')
export class CampaignController {
  constructor(private readonly campaign: CampaignService, private readonly playerContext: PlayerContextService) {}

  @Get()
  get(@Headers('x-dev-player-id') player?: string): Promise<CampaignResponse> {
    return this.campaign.get(this.playerContext.resolve(player));
  }

  @Post('stages/:stageKey/start')
  start(
    @Param('stageKey') stageKey: string,
    @Headers('x-dev-player-id') player?: string,
    @Headers('idempotency-key') key?: string,
  ): Promise<CampaignBattleStartResponse> {
    return this.campaign.start(this.playerContext.resolve(player), stageKey, key);
  }

  @Post('rewards/:milestoneStars/claim')
  claim(
    @Param('milestoneStars') milestoneStars: string,
    @Headers('x-dev-player-id') player?: string,
    @Headers('idempotency-key') key?: string,
  ): Promise<CampaignRewardClaimResponse> {
    return this.campaign.claim(this.playerContext.resolve(player), milestoneStars, key);
  }
}

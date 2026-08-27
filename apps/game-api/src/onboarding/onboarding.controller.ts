import { Controller, Get, Headers, Param, Post } from '@nestjs/common';
import type { AdvisorTipsResponse, OnboardingStateResponse } from '@crown-and-coin/shared';
import { EconomyService } from '../economy/economy.service';
import { PlayerContextService } from '../player/player-context.service';
import { OnboardingService } from './onboarding.service';
import { AdvisorTipsService } from './advisor-tips.service';

@Controller('onboarding')
export class OnboardingController {
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly economy: EconomyService,
    private readonly playerContext: PlayerContextService,
    private readonly advisorTips: AdvisorTipsService,
  ) {}

  @Get()
  async get(@Headers('x-dev-player-id') developmentPlayerId?: string): Promise<OnboardingStateResponse> {
    const kingdom = await this.economy.getKingdom(this.playerContext.resolve(developmentPlayerId));
    return this.onboarding.get(kingdom.player.id);
  }

  @Post('start')
  async start(@Headers('x-dev-player-id') developmentPlayerId?: string): Promise<OnboardingStateResponse> {
    const kingdom = await this.economy.getKingdom(this.playerContext.resolve(developmentPlayerId));
    return this.onboarding.start(kingdom.player.id);
  }

  @Post('skip')
  async skip(@Headers('x-dev-player-id') developmentPlayerId?: string): Promise<OnboardingStateResponse> {
    const kingdom = await this.economy.getKingdom(this.playerContext.resolve(developmentPlayerId));
    return this.onboarding.skip(kingdom.player.id);
  }

  @Get('advisor-tips')
  async getAdvisorTips(@Headers('x-dev-player-id') developmentPlayerId?: string): Promise<AdvisorTipsResponse> {
    const kingdom = await this.economy.getKingdom(this.playerContext.resolve(developmentPlayerId));
    return this.advisorTips.get(kingdom.player.id);
  }

  @Post('advisor-tips/:tipKey')
  async dismissAdvisorTip(@Param('tipKey') tipKey: string, @Headers('x-dev-player-id') developmentPlayerId?: string): Promise<AdvisorTipsResponse> {
    const kingdom = await this.economy.getKingdom(this.playerContext.resolve(developmentPlayerId));
    return this.advisorTips.dismiss(kingdom.player.id, tipKey);
  }
}

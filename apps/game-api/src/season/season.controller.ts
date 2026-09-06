import { Controller, Get, Headers, Post } from '@nestjs/common';
import type {
  ClaimSeasonRewardResponse,
  SeasonOverviewResponse,
  SeasonSummary,
} from '@crown-and-coin/shared';
import { PlayerContextService } from '../player/player-context.service';
import { SeasonService } from './season.service';

@Controller('seasons')
export class SeasonController {
  constructor(
    private readonly season: SeasonService,
    private readonly playerContext: PlayerContextService,
  ) {}

  @Get('overview')
  async getSeasonOverview(
    @Headers('x-dev-player-id') player?: string,
  ): Promise<SeasonOverviewResponse> {
    const context = this.playerContext.resolve(player);
    const playerId = await this.season.resolvePlayerId(context);
    return this.season.getSeasonOverview(playerId);
  }

  @Post('claim')
  async claimPreviousSeasonRewards(
    @Headers('x-dev-player-id') player?: string,
  ): Promise<ClaimSeasonRewardResponse> {
    const context = this.playerContext.resolve(player);
    const playerId = await this.season.resolvePlayerId(context);
    return this.season.claimPreviousSeasonRewards(playerId);
  }

  @Post('simulate-end')
  simulateEndSeason(): Promise<SeasonSummary> {
    return this.season.simulateEndSeason();
  }
}

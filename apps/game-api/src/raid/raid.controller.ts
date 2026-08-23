import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import type { BattleReplayResponse, RaidHistoryResponse, RaidOverviewResponse, RaidSearchResponse } from '@crown-and-coin/shared';
import { PlayerContextService } from '../player/player-context.service';
import { RaidService } from './raid.service';
import { StartRaidDto } from './start-raid.dto';

@Controller()
export class RaidController {
  constructor(private readonly raids: RaidService, private readonly playerContext: PlayerContextService) {}

  @Get('raid')
  overview(@Headers('x-dev-player-id') player?: string): Promise<RaidOverviewResponse> {
    return this.raids.overview(this.playerContext.resolve(player));
  }

  @Post('raid/search')
  search(@Headers('x-dev-player-id') player?: string): Promise<RaidSearchResponse> {
    return this.raids.search(this.playerContext.resolve(player));
  }

  @Post('raid/start')
  start(@Body() body: StartRaidDto, @Headers('x-dev-player-id') player?: string, @Headers('idempotency-key') key?: string): Promise<BattleReplayResponse> {
    return this.raids.start(this.playerContext.resolve(player), body.matchOfferId, key);
  }

  @Get('raid/history')
  history(@Headers('x-dev-player-id') player?: string): Promise<RaidHistoryResponse> {
    return this.raids.history(this.playerContext.resolve(player));
  }

  @Get('battles/:battleId')
  battle(@Param('battleId') battleId: string, @Headers('x-dev-player-id') player?: string): Promise<BattleReplayResponse> {
    return this.raids.battle(this.playerContext.resolve(player), battleId);
  }
}


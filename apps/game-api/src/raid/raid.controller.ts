import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import type {
  BattleReplayResponse,
  DefenseInboxResponse,
  RaidHistoryResponse,
  RaidOverviewResponse,
  RaidSearchResponse,
  RevengePreviewResponse,
} from '@crown-and-coin/shared';
import { PlayerContextService } from '../player/player-context.service';
import { RaidService } from './raid.service';
import { StartRaidDto } from './start-raid.dto';
import { StartRevengeDto } from './start-revenge.dto';

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

  @Get('raid/inbox')
  inbox(@Headers('x-dev-player-id') player?: string): Promise<DefenseInboxResponse> {
    return this.raids.inbox(this.playerContext.resolve(player));
  }

  @Post('raid/inbox/read')
  markInboxRead(@Headers('x-dev-player-id') player?: string): Promise<{ readCount: number }> {
    return this.raids.markInboxRead(this.playerContext.resolve(player));
  }

  @Get('raid/revenge/:revengeTargetId')
  revengePreview(@Param('revengeTargetId') revengeTargetId: string, @Headers('x-dev-player-id') player?: string): Promise<RevengePreviewResponse> {
    return this.raids.revengePreview(this.playerContext.resolve(player), revengeTargetId);
  }

  @Post('raid/revenge/start')
  startRevenge(@Body() body: StartRevengeDto, @Headers('x-dev-player-id') player?: string, @Headers('idempotency-key') key?: string): Promise<BattleReplayResponse> {
    return this.raids.startRevenge(this.playerContext.resolve(player), body.revengeTargetId, key);
  }

  @Get('battles/:battleId')
  battle(@Param('battleId') battleId: string, @Headers('x-dev-player-id') player?: string): Promise<BattleReplayResponse> {
    return this.raids.battle(this.playerContext.resolve(player), battleId);
  }
}

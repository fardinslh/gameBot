import { Controller, Get, Headers } from '@nestjs/common';
import type { LeaderboardResponse } from '@crown-and-coin/shared';
import { PlayerContextService } from '../player/player-context.service';
import { LeaderboardService } from './leaderboard.service';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(
    private readonly leaderboard: LeaderboardService,
    private readonly playerContext: PlayerContextService,
  ) {}

  @Get()
  getLeaderboard(@Headers('x-dev-player-id') player?: string): Promise<LeaderboardResponse> {
    return this.leaderboard.getLeaderboard(this.playerContext.resolve(player));
  }
}

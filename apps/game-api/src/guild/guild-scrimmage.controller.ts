import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
} from '@nestjs/common';
import { GuildScrimmageService } from './guild-scrimmage.service';
import { PostFriendlyChallengeDto } from './guild-scrimmage.dto';
import { PlayerContextService } from '../player/player-context.service';
import type {
  AcceptFriendlyChallengeResult,
  FriendlyChallengesResponse,
  GuildFriendlyChallengeItem,
  WarBattleReplay,
} from '@crown-and-coin/shared';

@Controller('guilds')
export class GuildScrimmageController {
  constructor(
    private readonly scrimmageService: GuildScrimmageService,
    private readonly playerContext: PlayerContextService,
  ) {}

  @Get('scrimmages')
  async getChallenges(
    @Headers('x-dev-player-id') devPlayerId?: string,
  ): Promise<FriendlyChallengesResponse> {
    const playerId = await this.scrimmageService.resolvePlayerId(
      this.playerContext.resolve(devPlayerId),
    );
    return this.scrimmageService.getChallenges(playerId);
  }

  @Post('scrimmages')
  async postChallenge(
    @Body() dto: PostFriendlyChallengeDto,
    @Headers('x-dev-player-id') devPlayerId?: string,
  ): Promise<GuildFriendlyChallengeItem> {
    const playerId = await this.scrimmageService.resolvePlayerId(
      this.playerContext.resolve(devPlayerId),
    );
    return this.scrimmageService.postChallenge(playerId, dto);
  }

  @Post('scrimmages/:id/attack')
  async acceptChallenge(
    @Param('id') challengeId: string,
    @Headers('x-dev-player-id') devPlayerId?: string,
  ): Promise<AcceptFriendlyChallengeResult> {
    const playerId = await this.scrimmageService.resolvePlayerId(
      this.playerContext.resolve(devPlayerId),
    );
    return this.scrimmageService.acceptChallenge(playerId, challengeId);
  }

  @Get('replays/:id')
  async getReplay(
    @Param('id') replayId: string,
    @Headers('x-dev-player-id') devPlayerId?: string,
  ): Promise<WarBattleReplay> {
    const playerId = await this.scrimmageService.resolvePlayerId(
      this.playerContext.resolve(devPlayerId),
    );
    return this.scrimmageService.getReplay(playerId, replayId);
  }
}

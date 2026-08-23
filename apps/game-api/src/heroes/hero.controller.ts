import { Body, Controller, Get, Headers, Param, Post, Put } from '@nestjs/common';
import type { HeroesResponse, HeroUpgradeResponse, RaidTeamResponse } from '@crown-and-coin/shared';
import { PlayerContextService } from '../player/player-context.service';
import { HeroService } from './hero.service';
import { SaveRaidTeamDto } from './save-raid-team.dto';

@Controller('heroes')
export class HeroController {
  constructor(
    private readonly heroes: HeroService,
    private readonly playerContext: PlayerContextService,
  ) {}

  @Get()
  getHeroes(@Headers('x-dev-player-id') developmentPlayerId?: string): Promise<HeroesResponse> {
    return this.heroes.getHeroes(this.playerContext.resolve(developmentPlayerId));
  }

  @Get('team')
  getTeam(@Headers('x-dev-player-id') developmentPlayerId?: string): Promise<RaidTeamResponse> {
    return this.heroes.getTeam(this.playerContext.resolve(developmentPlayerId));
  }

  @Put('team')
  saveTeam(
    @Body() body: SaveRaidTeamDto,
    @Headers('x-dev-player-id') developmentPlayerId?: string,
  ): Promise<RaidTeamResponse> {
    return this.heroes.saveTeam(this.playerContext.resolve(developmentPlayerId), body.heroIds);
  }

  @Post(':playerHeroId/upgrade')
  upgrade(
    @Param('playerHeroId') playerHeroId: string,
    @Headers('x-dev-player-id') developmentPlayerId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<HeroUpgradeResponse> {
    return this.heroes.upgrade(this.playerContext.resolve(developmentPlayerId), playerHeroId, idempotencyKey);
  }
}


import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import type {
  GuildWarDetails,
  GuildWarOverviewResponse,
  WarAttackResult,
} from '@crown-and-coin/shared';
import { PlayerContextService } from '../player/player-context.service';
import { StartWarDto, WarAttackDto } from './guild.dto';
import { GuildWarService } from './guild-war.service';
import { GuildService } from './guild.service';

@Controller('guilds/war')
export class GuildWarController {
  constructor(
    private readonly war: GuildWarService,
    private readonly guild: GuildService,
    private readonly playerContext: PlayerContextService,
  ) {}

  @Get()
  async getWarOverview(@Headers('x-dev-player-id') player?: string): Promise<GuildWarOverviewResponse> {
    const playerId = await this.guild.resolvePlayerId(this.playerContext.resolve(player));
    return this.war.getWarOverview(playerId);
  }

  @Post('start')
  async startWar(
    @Headers('x-dev-player-id') player: string | undefined,
    @Body() dto: StartWarDto,
  ): Promise<GuildWarDetails> {
    const playerId = await this.guild.resolvePlayerId(this.playerContext.resolve(player));
    return this.war.startWar(playerId, dto.warSize);
  }

  @Post('attack')
  async attack(
    @Headers('x-dev-player-id') player: string | undefined,
    @Body() dto: WarAttackDto,
  ): Promise<WarAttackResult> {
    const playerId = await this.guild.resolvePlayerId(this.playerContext.resolve(player));
    return this.war.attack(playerId, dto.defenderPlayerId);
  }

  @Post('simulate-battle-day')
  async simulateBattleDay(@Headers('x-dev-player-id') player?: string): Promise<GuildWarDetails> {
    const playerId = await this.guild.resolvePlayerId(this.playerContext.resolve(player));
    return this.war.fastForwardToBattleDay(playerId);
  }

  @Post('simulate-war-end')
  async simulateWarEnd(@Headers('x-dev-player-id') player?: string): Promise<GuildWarDetails> {
    const playerId = await this.guild.resolvePlayerId(this.playerContext.resolve(player));
    return this.war.fastForwardToWarEnd(playerId);
  }

  @Post('claim-spoils')
  async claimSpoils(@Headers('x-dev-player-id') player?: string): Promise<{ goldClaimed: string; newBalance: string }> {
    const playerId = await this.guild.resolvePlayerId(this.playerContext.resolve(player));
    return this.war.claimSpoils(playerId);
  }
}

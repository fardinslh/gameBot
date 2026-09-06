import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import type {
  DonateTroopsResult,
  GuildDetailsResponse,
  GuildLeaderboardResponse,
  GuildOverviewResponse,
  GuildSummary,
} from '@crown-and-coin/shared';
import { PlayerContextService } from '../player/player-context.service';
import {
  CreateGuildDto,
  DonateTroopsDto,
  KickMemberDto,
  RequestTroopsDto,
  SetMemberRoleDto,
} from './guild.dto';
import { GuildService } from './guild.service';

@Controller('guilds')
export class GuildController {
  constructor(
    private readonly guild: GuildService,
    private readonly playerContext: PlayerContextService,
  ) {}

  @Get('overview')
  async getOverview(@Headers('x-dev-player-id') player?: string): Promise<GuildOverviewResponse> {
    const playerId = await this.guild.resolvePlayerId(this.playerContext.resolve(player));
    return this.guild.getOverview(playerId);
  }

  @Post()
  async createGuild(
    @Headers('x-dev-player-id') player: string | undefined,
    @Body() dto: CreateGuildDto,
  ): Promise<GuildOverviewResponse> {
    const playerId = await this.guild.resolvePlayerId(this.playerContext.resolve(player));
    return this.guild.createGuild(playerId, dto);
  }

  @Get('search')
  searchGuilds(
    @Query('query') query?: string,
    @Query('minTrophies') minTrophies?: string,
  ): Promise<GuildSummary[]> {
    const min = minTrophies ? parseInt(minTrophies, 10) : undefined;
    return this.guild.searchGuilds(query, isNaN(min as number) ? undefined : min);
  }

  @Get('leaderboard')
  async getLeaderboard(@Headers('x-dev-player-id') player?: string): Promise<GuildLeaderboardResponse> {
    let playerId: string | undefined;
    try {
      playerId = await this.guild.resolvePlayerId(this.playerContext.resolve(player));
    } catch {
      playerId = undefined;
    }
    return this.guild.getGuildLeaderboard(playerId);
  }

  @Get(':id')
  async getGuildDetails(
    @Param('id') id: string,
    @Headers('x-dev-player-id') player?: string,
  ): Promise<GuildDetailsResponse> {
    let playerId: string | undefined;
    try {
      playerId = await this.guild.resolvePlayerId(this.playerContext.resolve(player));
    } catch {
      playerId = undefined;
    }
    return this.guild.getGuildDetails(id, playerId);
  }

  @Post(':id/join')
  async joinGuild(
    @Param('id') id: string,
    @Headers('x-dev-player-id') player?: string,
  ): Promise<GuildOverviewResponse> {
    const playerId = await this.guild.resolvePlayerId(this.playerContext.resolve(player));
    return this.guild.joinGuild(playerId, id);
  }

  @Post('leave')
  async leaveGuild(@Headers('x-dev-player-id') player?: string): Promise<GuildOverviewResponse> {
    const playerId = await this.guild.resolvePlayerId(this.playerContext.resolve(player));
    return this.guild.leaveGuild(playerId);
  }

  @Post('kick')
  async kickMember(
    @Headers('x-dev-player-id') player: string | undefined,
    @Body() dto: KickMemberDto,
  ): Promise<GuildDetailsResponse> {
    const playerId = await this.guild.resolvePlayerId(this.playerContext.resolve(player));
    return this.guild.kickMember(playerId, dto.memberPlayerId);
  }

  @Post('role')
  async setMemberRole(
    @Headers('x-dev-player-id') player: string | undefined,
    @Body() dto: SetMemberRoleDto,
  ): Promise<GuildDetailsResponse> {
    const playerId = await this.guild.resolvePlayerId(this.playerContext.resolve(player));
    return this.guild.setMemberRole(playerId, dto.memberPlayerId, dto.role);
  }

  @Post('request-troops')
  async requestTroops(
    @Headers('x-dev-player-id') player: string | undefined,
    @Body() dto: RequestTroopsDto,
  ): Promise<GuildDetailsResponse> {
    const playerId = await this.guild.resolvePlayerId(this.playerContext.resolve(player));
    return this.guild.requestTroops(playerId, dto);
  }

  @Post('donate-troops')
  async donateTroops(
    @Headers('x-dev-player-id') player: string | undefined,
    @Body() dto: DonateTroopsDto,
  ): Promise<DonateTroopsResult> {
    const playerId = await this.guild.resolvePlayerId(this.playerContext.resolve(player));
    return this.guild.donateTroops(playerId, dto);
  }
}

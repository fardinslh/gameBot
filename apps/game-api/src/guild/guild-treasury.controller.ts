import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
} from '@nestjs/common';
import type {
  DonateToTreasuryResponse,
  GuildTreasuryOverviewResponse,
  UpgradeGuildPerkResponse,
} from '@crown-and-coin/shared';
import { PlayerContextService } from '../player/player-context.service';
import {
  DonateToTreasuryDto,
  UpgradeGuildPerkDto,
} from './guild-treasury.dto';
import { GuildTreasuryService } from './guild-treasury.service';

@Controller('guilds')
export class GuildTreasuryController {
  constructor(
    private readonly treasury: GuildTreasuryService,
    private readonly playerContext: PlayerContextService,
  ) {}

  @Get('treasury/overview')
  async getOverview(
    @Headers('x-dev-player-id') player?: string,
  ): Promise<GuildTreasuryOverviewResponse> {
    const playerId = await this.treasury.resolvePlayerId(this.playerContext.resolve(player));
    return this.treasury.getTreasuryOverview(playerId);
  }

  @Post('treasury/donate')
  async donate(
    @Headers('x-dev-player-id') player: string | undefined,
    @Body() dto: DonateToTreasuryDto,
  ): Promise<DonateToTreasuryResponse> {
    const playerId = await this.treasury.resolvePlayerId(this.playerContext.resolve(player));
    return this.treasury.donateToTreasury(playerId, dto);
  }

  @Post('perks/upgrade')
  async upgradePerk(
    @Headers('x-dev-player-id') player: string | undefined,
    @Body() dto: UpgradeGuildPerkDto,
  ): Promise<UpgradeGuildPerkResponse> {
    const playerId = await this.treasury.resolvePlayerId(this.playerContext.resolve(player));
    return this.treasury.upgradePerk(playerId, dto);
  }
}

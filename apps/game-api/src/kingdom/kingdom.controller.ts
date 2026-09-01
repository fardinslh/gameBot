import { Body, Controller, Get, Headers, Param, Post, Put } from '@nestjs/common';
import type { CollectResponse, KingdomStateResponse, UpdateKingdomIdentityResponse, UpgradeResponse } from '@crown-and-coin/shared';
import { PlayerContextService } from '../player/player-context.service';
import { KingdomService } from './kingdom.service';
import { UpdateKingdomIdentityDto } from './update-kingdom-identity.dto';

@Controller('kingdom')
export class KingdomController {
  constructor(
    private readonly kingdom: KingdomService,
    private readonly playerContext: PlayerContextService,
  ) {}

  @Get()
  getKingdom(@Headers('x-dev-player-id') developmentPlayerId?: string): Promise<KingdomStateResponse> {
    return this.kingdom.get(this.playerContext.resolve(developmentPlayerId));
  }

  @Get('buildings')
  getBuildingStatus(@Headers('x-dev-player-id') developmentPlayerId?: string): Promise<KingdomStateResponse> {
    return this.kingdom.get(this.playerContext.resolve(developmentPlayerId));
  }

  @Put('identity')
  updateIdentity(
    @Body() body: UpdateKingdomIdentityDto,
    @Headers('x-dev-player-id') developmentPlayerId?: string,
  ): Promise<UpdateKingdomIdentityResponse> {
    return this.kingdom.updateIdentity(this.playerContext.resolve(developmentPlayerId), body);
  }

  @Post('collect')
  collect(
    @Headers('x-dev-player-id') developmentPlayerId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CollectResponse> {
    return this.kingdom.collect(this.playerContext.resolve(developmentPlayerId), idempotencyKey);
  }

  @Post('buildings/:buildingId/upgrade')
  upgrade(
    @Param('buildingId') buildingId: string,
    @Headers('x-dev-player-id') developmentPlayerId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<UpgradeResponse> {
    return this.kingdom.upgrade(this.playerContext.resolve(developmentPlayerId), buildingId, idempotencyKey);
  }

  @Post('buildings/:buildingId/upgrade/collect')
  collectCompletedUpgrade(
    @Param('buildingId') buildingId: string,
    @Headers('x-dev-player-id') developmentPlayerId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<UpgradeResponse> {
    return this.kingdom.collectCompletedUpgrade(this.playerContext.resolve(developmentPlayerId), buildingId, idempotencyKey);
  }
}

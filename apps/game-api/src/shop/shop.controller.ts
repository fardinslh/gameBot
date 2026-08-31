import { Body, Controller, Get, Headers, Post, Put } from '@nestjs/common';
import type { EquipProfileCrestResponse, ShopPurchaseResponse, ShopStateResponse } from '@crown-and-coin/shared';
import { PlayerContextService } from '../player/player-context.service';
import { EquipProfileCrestDto, ShopPurchaseDto } from './shop.dto';
import { ShopService } from './shop.service';

@Controller('shop')
export class ShopController {
  constructor(private readonly shop: ShopService, private readonly playerContext: PlayerContextService) {}

  @Get()
  getState(@Headers('x-dev-player-id') player?: string): Promise<ShopStateResponse> {
    return this.shop.getState(this.playerContext.resolve(player));
  }

  @Post('purchases')
  purchase(
    @Body() body: ShopPurchaseDto,
    @Headers('x-dev-player-id') player?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ShopPurchaseResponse> {
    return this.shop.purchase(this.playerContext.resolve(player), body.itemKey, body.targetId, idempotencyKey);
  }

  @Put('cosmetics/profile-crest')
  equip(
    @Body() body: EquipProfileCrestDto,
    @Headers('x-dev-player-id') player?: string,
  ): Promise<EquipProfileCrestResponse> {
    return this.shop.equipProfileCrest(this.playerContext.resolve(player), body.itemKey);
  }
}

import { Body, Controller, Get, Headers, Post, Put } from '@nestjs/common';
import type { ArmyResponse, ArmyTrainResponse } from '@crown-and-coin/shared';
import { PlayerContextService } from '../player/player-context.service';
import { ArmyService } from './army.service';
import { SaveArmyFormationDto, TrainTroopsDto } from './army.dto';

@Controller('army')
export class ArmyController {
  constructor(private readonly army: ArmyService, private readonly playerContext: PlayerContextService) {}

  @Get()
  getArmy(@Headers('x-dev-player-id') player?: string): Promise<ArmyResponse> {
    return this.army.getArmy(this.playerContext.resolve(player));
  }

  @Post('train')
  train(
    @Body() body: TrainTroopsDto,
    @Headers('x-dev-player-id') player?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ArmyTrainResponse> {
    return this.army.train(this.playerContext.resolve(player), body.troopType, body.quantity, idempotencyKey);
  }

  @Put('formation')
  saveFormation(
    @Body() body: SaveArmyFormationDto,
    @Headers('x-dev-player-id') player?: string,
  ): Promise<ArmyResponse> {
    return this.army.saveFormation(this.playerContext.resolve(player), body.slots);
  }
}

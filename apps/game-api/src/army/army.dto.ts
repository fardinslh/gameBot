import { Allow } from 'class-validator';

export class TrainTroopsDto {
  @Allow()
  troopType!: unknown;

  @Allow()
  quantity!: unknown;
}

export class SaveArmyFormationDto {
  @Allow()
  slots!: unknown;
}

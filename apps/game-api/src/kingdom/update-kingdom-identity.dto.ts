import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import {
  KINGDOM_HERALDRY_KEYS,
  KINGDOM_RULER_TITLES,
  type KingdomHeraldryKey,
  type KingdomRulerTitle,
} from '@crown-and-coin/shared';

export class UpdateKingdomIdentityDto {
  @IsString()
  @MinLength(2)
  @MaxLength(24)
  name!: string;

  @IsIn(KINGDOM_RULER_TITLES)
  rulerTitle!: KingdomRulerTitle;

  @IsIn(KINGDOM_HERALDRY_KEYS)
  heraldry!: KingdomHeraldryKey;
}

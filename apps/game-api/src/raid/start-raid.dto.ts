import { IsString, Length } from 'class-validator';

export class StartRaidDto {
  @IsString()
  @Length(8, 100)
  matchOfferId!: string;
}


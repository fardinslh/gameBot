import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  WAR_TACTICAL_MARKERS,
  type WarTacticalMarker,
} from '@crown-and-coin/shared';

export class SendGuildChatMessageDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(280)
  content!: string;

  @IsOptional()
  @IsBoolean()
  isAnnouncement?: boolean;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}

export class SetWarCalloutDto {
  @IsNotEmpty()
  @IsString()
  defenderPlayerId!: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  baseNumber!: number;

  @IsNotEmpty()
  @IsIn(WAR_TACTICAL_MARKERS)
  marker!: WarTacticalMarker;

  @IsOptional()
  @IsString()
  claimedById?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  notes?: string;
}

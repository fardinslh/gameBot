import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import {
  GUILD_CREST_EMBLEMS,
  GUILD_JOIN_POLICIES,
  GUILD_ROLES,
  TROOP_TYPES,
  type GuildCrestEmblem,
  type GuildJoinPolicy,
  type GuildRole,
  type TroopType,
} from '@crown-and-coin/shared';

export class CreateGuildDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(24)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(160)
  description?: string;

  @IsEnum(GUILD_CREST_EMBLEMS)
  emblem!: GuildCrestEmblem;

  @IsString()
  @IsNotEmpty()
  primaryColor!: string;

  @IsString()
  @IsNotEmpty()
  secondaryColor!: string;

  @IsEnum(GUILD_JOIN_POLICIES)
  joinPolicy!: GuildJoinPolicy;

  @IsInt()
  @Min(0)
  @Max(50000)
  minTrophies!: number;
}

export class SearchGuildDto {
  @IsString()
  @IsOptional()
  query?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  minTrophies?: number;
}

export class RequestTroopsDto {
  @IsEnum(TROOP_TYPES)
  troopType!: TroopType;
}

export class DonateTroopsDto {
  @IsString()
  @IsNotEmpty()
  requestId!: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(5)
  amount?: number;
}

export class KickMemberDto {
  @IsString()
  @IsNotEmpty()
  memberPlayerId!: string;
}

export class SetMemberRoleDto {
  @IsString()
  @IsNotEmpty()
  memberPlayerId!: string;

  @IsEnum(['OFFICER', 'MEMBER'])
  role!: 'OFFICER' | 'MEMBER';
}

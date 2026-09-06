import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { GUILD_PERK_TYPES, type GuildPerkType } from '@crown-and-coin/shared';

export class DonateToTreasuryDto {
  @IsNotEmpty()
  @IsString()
  amount!: string;
}

export class UpgradeGuildPerkDto {
  @IsNotEmpty()
  @IsIn(GUILD_PERK_TYPES)
  perkType!: GuildPerkType;
}

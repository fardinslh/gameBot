import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PROFILE_CREST_KEYS, SHOP_PURCHASE_ITEM_KEYS } from '@crown-and-coin/shared';
import type { ProfileCrestKey, ShopPurchaseItemKey } from '@crown-and-coin/shared';

export class ShopPurchaseDto {
  @IsIn(SHOP_PURCHASE_ITEM_KEYS)
  itemKey!: ShopPurchaseItemKey;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetId?: string;
}

export class EquipProfileCrestDto {
  @IsIn(PROFILE_CREST_KEYS)
  itemKey!: ProfileCrestKey;
}

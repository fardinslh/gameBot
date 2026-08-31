import { HttpException, HttpStatus } from '@nestjs/common';
import type { ShopErrorCode, ShopErrorResponse } from '@crown-and-coin/shared';

const ERROR_STATUS: Record<ShopErrorCode, HttpStatus> = {
  SHOP_ITEM_NOT_FOUND: HttpStatus.NOT_FOUND,
  SHOP_ITEM_DISABLED: HttpStatus.CONFLICT,
  SHOP_ITEM_ALREADY_OWNED: HttpStatus.CONFLICT,
  SHOP_TARGET_NOT_FOUND: HttpStatus.NOT_FOUND,
  SHOP_TARGET_NOT_OWNER: HttpStatus.FORBIDDEN,
  SHOP_TARGET_ALREADY_COMPLETE: HttpStatus.CONFLICT,
  INSUFFICIENT_GEMS: HttpStatus.CONFLICT,
  SHOP_INVALID_PURCHASE: HttpStatus.BAD_REQUEST,
  SHOP_ENTITLEMENT_REQUIRED: HttpStatus.FORBIDDEN,
  INVALID_IDEMPOTENCY_KEY: HttpStatus.BAD_REQUEST,
  SHOP_CONFLICT: HttpStatus.CONFLICT,
};

export class ShopError extends HttpException {
  constructor(code: ShopErrorCode, message: string) {
    const statusCode = ERROR_STATUS[code];
    const response: ShopErrorResponse = { statusCode, code, message };
    super(response, statusCode);
  }
}

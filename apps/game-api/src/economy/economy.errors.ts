import { HttpException, HttpStatus } from '@nestjs/common';
import type { EconomyErrorCode, EconomyErrorResponse } from '@crown-and-coin/shared';

const ERROR_STATUS: Record<EconomyErrorCode, HttpStatus> = {
  INSUFFICIENT_RESOURCES: HttpStatus.CONFLICT,
  UPGRADE_ALREADY_ACTIVE: HttpStatus.CONFLICT,
  UPGRADE_NOT_READY: HttpStatus.CONFLICT,
  BUILDING_LOCKED: HttpStatus.CONFLICT,
  CASTLE_LEVEL_REQUIRED: HttpStatus.CONFLICT,
  MAX_LEVEL: HttpStatus.CONFLICT,
  BUILDING_NOT_FOUND: HttpStatus.NOT_FOUND,
  NOT_BUILDING_OWNER: HttpStatus.FORBIDDEN,
  INVALID_IDEMPOTENCY_KEY: HttpStatus.BAD_REQUEST,
  ECONOMY_CONFLICT: HttpStatus.CONFLICT,
};

export class EconomyError extends HttpException {
  constructor(code: EconomyErrorCode, message: string) {
    const statusCode = ERROR_STATUS[code];
    const response: EconomyErrorResponse = { statusCode, code, message };
    super(response, statusCode);
  }
}

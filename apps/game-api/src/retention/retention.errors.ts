import { HttpException, HttpStatus } from '@nestjs/common';
import type { RetentionErrorCode, RetentionErrorResponse } from '@crown-and-coin/shared';

const STATUS: Record<RetentionErrorCode, HttpStatus> = {
  INVALID_IDEMPOTENCY_KEY: HttpStatus.BAD_REQUEST,
  MISSION_NOT_FOUND: HttpStatus.NOT_FOUND,
  MISSION_NOT_OWNER: HttpStatus.FORBIDDEN,
  MISSION_EXPIRED: HttpStatus.GONE,
  MISSION_INCOMPLETE: HttpStatus.CONFLICT,
  MISSION_ALREADY_CLAIMED: HttpStatus.CONFLICT,
  DAILY_BONUS_INCOMPLETE: HttpStatus.CONFLICT,
  DAILY_BONUS_ALREADY_CLAIMED: HttpStatus.CONFLICT,
  ACHIEVEMENT_NOT_FOUND: HttpStatus.NOT_FOUND,
  ACHIEVEMENT_INCOMPLETE: HttpStatus.CONFLICT,
  ACHIEVEMENT_TIER_OUT_OF_ORDER: HttpStatus.CONFLICT,
  ACHIEVEMENT_ALREADY_CLAIMED: HttpStatus.CONFLICT,
  DAILY_RETURN_ALREADY_CLAIMED: HttpStatus.CONFLICT,
  RETENTION_CONFLICT: HttpStatus.CONFLICT,
};

export class RetentionError extends HttpException {
  constructor(code: RetentionErrorCode, message: string) {
    const statusCode = STATUS[code];
    const response: RetentionErrorResponse = { statusCode, code, message };
    super(response, statusCode);
  }
}

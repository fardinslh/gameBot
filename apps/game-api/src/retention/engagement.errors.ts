import { HttpException, HttpStatus } from '@nestjs/common';
import type { EngagementErrorCode, EngagementErrorResponse } from '@crown-and-coin/shared';

const STATUS: Record<EngagementErrorCode, HttpStatus> = {
  INVALID_IDEMPOTENCY_KEY: HttpStatus.BAD_REQUEST,
  ROYAL_DECREE_LOCKED: HttpStatus.FORBIDDEN,
  ROYAL_DECREE_INCOMPLETE: HttpStatus.CONFLICT,
  ROYAL_DECREE_ALREADY_CLAIMED: HttpStatus.CONFLICT,
  ENGAGEMENT_CONFLICT: HttpStatus.CONFLICT,
};

export class EngagementError extends HttpException {
  constructor(code: EngagementErrorCode, message: string) {
    const statusCode = STATUS[code];
    const response: EngagementErrorResponse = { statusCode, code, message };
    super(response, statusCode);
  }
}

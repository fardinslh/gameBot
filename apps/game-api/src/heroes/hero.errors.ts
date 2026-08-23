import { HttpException, HttpStatus } from '@nestjs/common';
import type { HeroErrorCode, HeroErrorResponse } from '@crown-and-coin/shared';

const ERROR_STATUS: Record<HeroErrorCode, HttpStatus> = {
  HERO_NOT_FOUND: HttpStatus.NOT_FOUND,
  NOT_HERO_OWNER: HttpStatus.FORBIDDEN,
  HERO_DISABLED: HttpStatus.CONFLICT,
  INVALID_TEAM_SIZE: HttpStatus.BAD_REQUEST,
  DUPLICATE_TEAM_HERO: HttpStatus.BAD_REQUEST,
  INVALID_TEAM_HERO: HttpStatus.BAD_REQUEST,
  HERO_MAX_LEVEL: HttpStatus.CONFLICT,
  HERO_INSUFFICIENT_GOLD: HttpStatus.CONFLICT,
  INVALID_IDEMPOTENCY_KEY: HttpStatus.BAD_REQUEST,
  HERO_CONFLICT: HttpStatus.CONFLICT,
};

export class HeroError extends HttpException {
  constructor(code: HeroErrorCode, message: string) {
    const statusCode = ERROR_STATUS[code];
    const response: HeroErrorResponse = { statusCode, code, message };
    super(response, statusCode);
  }
}


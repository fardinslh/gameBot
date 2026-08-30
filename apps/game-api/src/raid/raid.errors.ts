import { HttpException, HttpStatus } from '@nestjs/common';
import type { RaidErrorCode, RaidErrorResponse } from '@crown-and-coin/shared';

const STATUS: Record<RaidErrorCode, HttpStatus> = {
  NO_OPPONENT_AVAILABLE: HttpStatus.NOT_FOUND,
  MATCH_OFFER_EXPIRED: HttpStatus.GONE,
  MATCH_OFFER_ALREADY_USED: HttpStatus.CONFLICT,
  MATCH_OFFER_NOT_FOUND: HttpStatus.NOT_FOUND,
  MATCH_OFFER_NOT_OWNER: HttpStatus.FORBIDDEN,
  INVALID_RAID_TEAM: HttpStatus.CONFLICT,
  INVALID_ARMY_FORMATION: HttpStatus.CONFLICT,
  OPPONENT_NOT_FOUND: HttpStatus.NOT_FOUND,
  BATTLE_NOT_FOUND: HttpStatus.NOT_FOUND,
  BATTLE_NOT_PARTICIPANT: HttpStatus.FORBIDDEN,
  SELF_ATTACK_FORBIDDEN: HttpStatus.BAD_REQUEST,
  INSUFFICIENT_OR_INVALID_STATE: HttpStatus.CONFLICT,
  INVALID_IDEMPOTENCY_KEY: HttpStatus.BAD_REQUEST,
  REVENGE_NOT_FOUND: HttpStatus.NOT_FOUND,
  REVENGE_NOT_OWNER: HttpStatus.FORBIDDEN,
  REVENGE_EXPIRED: HttpStatus.GONE,
  REVENGE_ALREADY_USED: HttpStatus.CONFLICT,
  REVENGE_INVALID_SOURCE: HttpStatus.CONFLICT,
  RAID_CONFLICT: HttpStatus.CONFLICT,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
};

export class RaidError extends HttpException {
  constructor(code: RaidErrorCode, message: string) {
    const statusCode = STATUS[code];
    const response: RaidErrorResponse = { statusCode, code, message };
    super(response, statusCode);
  }
}

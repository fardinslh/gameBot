import { HttpException, HttpStatus } from '@nestjs/common';
import type { ArmyErrorCode, ArmyErrorResponse } from '@crown-and-coin/shared';

const STATUS: Record<ArmyErrorCode, HttpStatus> = {
  INVALID_TROOP_TYPE: HttpStatus.BAD_REQUEST,
  INVALID_TRAINING_QUANTITY: HttpStatus.BAD_REQUEST,
  TRAINING_ALREADY_ACTIVE: HttpStatus.CONFLICT,
  ARMY_CAPACITY_EXCEEDED: HttpStatus.CONFLICT,
  INSUFFICIENT_RESOURCES: HttpStatus.CONFLICT,
  FORMATION_INVALID: HttpStatus.BAD_REQUEST,
  FORMATION_TROOP_COUNT_EXCEEDED: HttpStatus.CONFLICT,
  FORMATION_COMMANDER_DUPLICATE: HttpStatus.BAD_REQUEST,
  COMMANDER_NOT_OWNED: HttpStatus.FORBIDDEN,
  COMMANDER_DISABLED: HttpStatus.CONFLICT,
  INVALID_IDEMPOTENCY_KEY: HttpStatus.BAD_REQUEST,
  ARMY_CONFLICT: HttpStatus.CONFLICT,
};

export class ArmyError extends HttpException {
  constructor(code: ArmyErrorCode, message: string) {
    const statusCode = STATUS[code];
    const response: ArmyErrorResponse = { statusCode, code, message };
    super(response, statusCode);
  }
}

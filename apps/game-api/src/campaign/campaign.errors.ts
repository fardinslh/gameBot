import { HttpException, HttpStatus } from '@nestjs/common';
import type { CampaignErrorCode, CampaignErrorResponse } from '@crown-and-coin/shared';

const STATUS: Record<CampaignErrorCode, HttpStatus> = {
  CAMPAIGN_STAGE_NOT_FOUND: HttpStatus.NOT_FOUND,
  CAMPAIGN_STAGE_LOCKED: HttpStatus.CONFLICT,
  CAMPAIGN_CASTLE_REQUIRED: HttpStatus.CONFLICT,
  CAMPAIGN_INVALID_ARMY: HttpStatus.CONFLICT,
  CAMPAIGN_REWARD_LOCKED: HttpStatus.CONFLICT,
  CAMPAIGN_REWARD_ALREADY_CLAIMED: HttpStatus.CONFLICT,
  CAMPAIGN_CONFLICT: HttpStatus.CONFLICT,
  INVALID_IDEMPOTENCY_KEY: HttpStatus.BAD_REQUEST,
};

export class CampaignError extends HttpException {
  constructor(code: CampaignErrorCode, message: string) {
    const statusCode = STATUS[code];
    const response: CampaignErrorResponse = { statusCode, code, message };
    super(response, statusCode);
  }
}

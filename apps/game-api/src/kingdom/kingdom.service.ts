import { Injectable } from '@nestjs/common';
import type { CollectResponse, KingdomStateResponse, UpdateKingdomIdentityRequest, UpdateKingdomIdentityResponse, UpgradeResponse } from '@crown-and-coin/shared';
import { EconomyService } from '../economy/economy.service';
import type { DevelopmentPlayerContext } from '../player/player-context.service';

@Injectable()
export class KingdomService {
  constructor(private readonly economy: EconomyService) {}

  get(context: DevelopmentPlayerContext): Promise<KingdomStateResponse> {
    return this.economy.getKingdom(context);
  }

  updateIdentity(context: DevelopmentPlayerContext, input: UpdateKingdomIdentityRequest): Promise<UpdateKingdomIdentityResponse> {
    return this.economy.updateKingdomIdentity(context, input);
  }

  collect(context: DevelopmentPlayerContext, idempotencyKey?: string): Promise<CollectResponse> {
    return this.economy.collect(context, idempotencyKey);
  }

  upgrade(context: DevelopmentPlayerContext, buildingId: string, idempotencyKey?: string): Promise<UpgradeResponse> {
    return this.economy.upgrade(context, buildingId, idempotencyKey);
  }

  collectCompletedUpgrade(context: DevelopmentPlayerContext, buildingId: string, idempotencyKey?: string): Promise<UpgradeResponse> {
    return this.economy.collectCompletedUpgrade(context, buildingId, idempotencyKey);
  }
}

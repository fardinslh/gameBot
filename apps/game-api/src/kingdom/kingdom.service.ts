import { Injectable } from '@nestjs/common';
import type { CollectResponse, KingdomStateResponse, UpgradeResponse } from '@crown-and-coin/shared';
import { EconomyService } from '../economy/economy.service';
import type { DevelopmentPlayerContext } from '../player/player-context.service';

@Injectable()
export class KingdomService {
  constructor(private readonly economy: EconomyService) {}

  get(context: DevelopmentPlayerContext): Promise<KingdomStateResponse> {
    return this.economy.getKingdom(context);
  }

  collect(context: DevelopmentPlayerContext, idempotencyKey?: string): Promise<CollectResponse> {
    return this.economy.collect(context, idempotencyKey);
  }

  upgrade(context: DevelopmentPlayerContext, buildingId: string, idempotencyKey?: string): Promise<UpgradeResponse> {
    return this.economy.upgrade(context, buildingId, idempotencyKey);
  }
}

import { Injectable } from '@nestjs/common';
import type { KingdomExpansionStage } from '@crown-and-coin/shared';

@Injectable()
export class KingdomExpansionService {
  fromCastleLevel(castleLevel: number): KingdomExpansionStage {
    return Math.min(5, Math.max(1, Math.trunc(castleLevel))) as KingdomExpansionStage;
  }
}

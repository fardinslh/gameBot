import { describe, expect, it } from 'vitest';
import { KingdomExpansionService } from './kingdom-expansion.service';

describe('KingdomExpansionService', () => {
  const service = new KingdomExpansionService();

  it('derives visual stages from the authoritative Castle level without persistence', () => {
    expect([1, 2, 3, 4, 5, 6, 20].map((level) => service.fromCastleLevel(level))).toEqual([1, 2, 3, 4, 5, 5, 5]);
  });
});

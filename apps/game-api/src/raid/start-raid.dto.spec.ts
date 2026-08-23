import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { StartRaidDto } from './start-raid.dto';

describe('StartRaidDto', () => {
  it('whitelists forged combat, loot, Trophy, and defender fields', async () => {
    const body = plainToInstance(StartRaidDto, {
      matchOfferId: 'valid-offer-id', defenderPlayerId: 'forged', power: 999_999,
      heroStats: { hp: 999_999 }, loot: { GOLD: '999999' }, trophyDelta: 999,
    });
    expect(await validate(body, { whitelist: true })).toHaveLength(0);
    expect(body).toEqual({ matchOfferId: 'valid-offer-id' });
  });

  it('rejects malformed offer IDs', async () => {
    expect(await validate(plainToInstance(StartRaidDto, { matchOfferId: 'short' }), { whitelist: true })).not.toHaveLength(0);
  });
});

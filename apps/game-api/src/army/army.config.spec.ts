import { describe, expect, it } from 'vitest';
import { armyCapacity, MAX_TRAINING_BATCH, trainingCost, TROOP_CONTENT } from './army.config';

describe('Army content configuration', () => {
  it('keeps the bounded Castle-derived capacity formula', () => {
    expect(armyCapacity(1)).toBe(60);
    expect(armyCapacity(5)).toBe(100);
    expect(armyCapacity(20)).toBe(250);
    expect(armyCapacity(0)).toBe(60);
  });

  it('centralizes the three starter troop costs and training times', () => {
    expect(MAX_TRAINING_BATCH).toBe(25);
    expect(TROOP_CONTENT.INFANTRY).toMatchObject({
      displayOrder: 1,
      trainingCosts: { FOOD: 20n, GOLD: 5n },
      trainingSecondsPerUnit: 2,
      starterCount: 20,
    });
    expect(TROOP_CONTENT.ARCHER).toMatchObject({
      displayOrder: 2,
      trainingCosts: { FOOD: 15n, WOOD: 10n, GOLD: 5n },
      trainingSecondsPerUnit: 3,
      starterCount: 15,
    });
    expect(TROOP_CONTENT.CAVALRY).toMatchObject({
      displayOrder: 3,
      trainingCosts: { FOOD: 30n, GOLD: 15n },
      trainingSecondsPerUnit: 5,
      starterCount: 10,
    });
    expect(trainingCost('ARCHER', 5)).toEqual({ FOOD: 75n, WOOD: 50n, GOLD: 25n });
  });
});

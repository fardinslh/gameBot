import { TroopType as PrismaTroopType, type Prisma } from '@prisma/client';
import type { HeroKey, TroopType } from '@crown-and-coin/shared';
import { TROOP_TYPES } from '@crown-and-coin/shared';
import { TROOP_CONTENT } from './army.config';

type TransactionClient = Prisma.TransactionClient;

const DEFAULT_FORMATION: ReadonlyArray<{
  slot: 1 | 2 | 3;
  troopType: TroopType;
  unitCount: number;
  heroKey: HeroKey;
}> = [
  { slot: 1, troopType: 'INFANTRY', unitCount: 20, heroKey: 'KNIGHT' },
  { slot: 2, troopType: 'ARCHER', unitCount: 15, heroKey: 'RANGER' },
  { slot: 3, troopType: 'CAVALRY', unitCount: 10, heroKey: 'MAGE' },
];

export async function ensureArmySystemForPlayer(
  tx: TransactionClient,
  playerId: string,
): Promise<boolean> {
  const troopResult = await tx.playerTroop.createMany({
    data: TROOP_TYPES.map((type) => ({
      playerId,
      troopType: type as PrismaTroopType,
      readyCount: TROOP_CONTENT[type].starterCount,
    })),
    skipDuplicates: true,
  });

  const existingFormation = await tx.armyFormation.findUnique({
    where: { playerId },
    include: { slots: true },
  });
  if (existingFormation?.slots.length === 3) return troopResult.count > 0;

  const heroes = await tx.playerHero.findMany({
    where: { playerId, heroDefinition: { key: { in: DEFAULT_FORMATION.map((item) => item.heroKey) } } },
    include: { heroDefinition: true },
  });
  if (heroes.length !== 3) throw new Error('Starter Commander ownership is incomplete.');

  const formation = await tx.armyFormation.upsert({
    where: { playerId },
    create: { playerId },
    update: {},
  });
  await tx.armyFormationSlot.deleteMany({ where: { armyFormationId: formation.id } });
  await tx.armyFormationSlot.createMany({
    data: DEFAULT_FORMATION.map((item) => {
      const commander = heroes.find((hero) => hero.heroDefinition.key === item.heroKey);
      if (!commander) throw new Error(`Starter Commander ${item.heroKey} is missing.`);
      return {
        armyFormationId: formation.id,
        slot: item.slot,
        troopType: item.troopType as PrismaTroopType,
        unitCount: item.unitCount,
        commanderPlayerHeroId: commander.id,
      };
    }),
  });
  return true;
}

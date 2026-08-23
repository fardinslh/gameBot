import { HeroClass as PrismaHeroClass, HeroKey as PrismaHeroKey, type Prisma } from '@prisma/client';
import { HERO_CONTENT, STARTER_HERO_KEYS } from './hero.config';

type TransactionClient = Prisma.TransactionClient;

export async function ensureHeroSystemForPlayer(
  tx: TransactionClient,
  playerId: string,
  syncContent = false,
): Promise<void> {
  if (syncContent) await syncHeroDefinitions(tx);
  const definitions = await tx.heroDefinition.findMany({
    where: { key: { in: STARTER_HERO_KEYS as PrismaHeroKey[] }, enabled: true },
    orderBy: { sortOrder: 'asc' },
  });
  if (definitions.length !== 3) throw new Error('Starter Hero definitions are incomplete.');

  await tx.playerHero.createMany({
    data: definitions.map((definition) => ({ playerId, heroDefinitionId: definition.id, level: 1, xp: 0 })),
    skipDuplicates: true,
  });

  const team = await tx.raidTeam.upsert({ where: { playerId }, create: { playerId }, update: {} });
  const slotCount = await tx.raidTeamSlot.count({ where: { raidTeamId: team.id } });
  if (slotCount === 3) return;
  const starters = await tx.playerHero.findMany({
    where: { playerId, heroDefinitionId: { in: definitions.map((definition) => definition.id) } },
    include: { heroDefinition: true },
    orderBy: { heroDefinition: { sortOrder: 'asc' } },
  });
  if (starters.length !== 3) throw new Error('Starter Hero ownership is incomplete.');
  await tx.raidTeamSlot.deleteMany({ where: { raidTeamId: team.id } });
  await tx.raidTeamSlot.createMany({
    data: starters.map((hero, index) => ({ raidTeamId: team.id, playerHeroId: hero.id, slot: index + 1 })),
  });
}

async function syncHeroDefinitions(tx: TransactionClient): Promise<void> {
  for (const config of Object.values(HERO_CONTENT)) {
    const data = {
      combatClass: config.combatClass as PrismaHeroClass,
      baseHp: config.baseHp,
      baseAtk: config.baseAtk,
      baseDef: config.baseDef,
      hpGrowthBps: config.hpGrowthBps,
      atkGrowthBps: config.atkGrowthBps,
      defGrowthBps: config.defGrowthBps,
      skillKey: config.skillKey,
      portraitAsset: config.portraitAsset,
      sortOrder: config.sortOrder,
      enabled: true,
    };
    await tx.heroDefinition.upsert({
      where: { key: config.key as PrismaHeroKey },
      create: { key: config.key as PrismaHeroKey, ...data },
      update: data,
    });
  }
}


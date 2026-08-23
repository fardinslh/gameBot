ALTER TYPE "EconomyTransactionReason" ADD VALUE 'HERO_UPGRADE';
ALTER TYPE "EconomyAction" ADD VALUE 'HERO_UPGRADE';

CREATE TYPE "HeroKey" AS ENUM ('KNIGHT', 'RANGER', 'MAGE');
CREATE TYPE "HeroClass" AS ENUM ('TANK', 'SINGLE_TARGET_DPS', 'AOE_BURST');

CREATE TABLE "HeroDefinition" (
  "id" TEXT NOT NULL,
  "key" "HeroKey" NOT NULL,
  "combatClass" "HeroClass" NOT NULL,
  "baseHp" INTEGER NOT NULL,
  "baseAtk" INTEGER NOT NULL,
  "baseDef" INTEGER NOT NULL,
  "hpGrowthBps" INTEGER NOT NULL,
  "atkGrowthBps" INTEGER NOT NULL,
  "defGrowthBps" INTEGER NOT NULL,
  "skillKey" TEXT NOT NULL,
  "portraitAsset" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HeroDefinition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HeroDefinition_positive_stats" CHECK ("baseHp" > 0 AND "baseAtk" > 0 AND "baseDef" > 0),
  CONSTRAINT "HeroDefinition_valid_growth" CHECK ("hpGrowthBps" >= 10000 AND "atkGrowthBps" >= 10000 AND "defGrowthBps" >= 10000)
);

CREATE TABLE "PlayerHero" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "heroDefinitionId" TEXT NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 1,
  "xp" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlayerHero_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlayerHero_valid_progression" CHECK ("level" BETWEEN 1 AND 20 AND "xp" >= 0)
);

CREATE TABLE "RaidTeam" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RaidTeam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RaidTeamSlot" (
  "id" TEXT NOT NULL,
  "raidTeamId" TEXT NOT NULL,
  "playerHeroId" TEXT NOT NULL,
  "slot" INTEGER NOT NULL,
  CONSTRAINT "RaidTeamSlot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RaidTeamSlot_valid_slot" CHECK ("slot" BETWEEN 1 AND 3)
);

CREATE UNIQUE INDEX "HeroDefinition_key_key" ON "HeroDefinition"("key");
CREATE INDEX "HeroDefinition_enabled_sortOrder_idx" ON "HeroDefinition"("enabled", "sortOrder");
CREATE UNIQUE INDEX "PlayerHero_playerId_heroDefinitionId_key" ON "PlayerHero"("playerId", "heroDefinitionId");
CREATE INDEX "PlayerHero_playerId_idx" ON "PlayerHero"("playerId");
CREATE UNIQUE INDEX "RaidTeam_playerId_key" ON "RaidTeam"("playerId");
CREATE UNIQUE INDEX "RaidTeamSlot_raidTeamId_slot_key" ON "RaidTeamSlot"("raidTeamId", "slot");
CREATE UNIQUE INDEX "RaidTeamSlot_raidTeamId_playerHeroId_key" ON "RaidTeamSlot"("raidTeamId", "playerHeroId");
CREATE INDEX "RaidTeamSlot_playerHeroId_idx" ON "RaidTeamSlot"("playerHeroId");

ALTER TABLE "PlayerHero" ADD CONSTRAINT "PlayerHero_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerHero" ADD CONSTRAINT "PlayerHero_heroDefinitionId_fkey"
  FOREIGN KEY ("heroDefinitionId") REFERENCES "HeroDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RaidTeam" ADD CONSTRAINT "RaidTeam_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaidTeamSlot" ADD CONSTRAINT "RaidTeamSlot_raidTeamId_fkey"
  FOREIGN KEY ("raidTeamId") REFERENCES "RaidTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaidTeamSlot" ADD CONSTRAINT "RaidTeamSlot_playerHeroId_fkey"
  FOREIGN KEY ("playerHeroId") REFERENCES "PlayerHero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed immutable starter content, then safely backfill every existing player.
INSERT INTO "HeroDefinition" (
  "id", "key", "combatClass", "baseHp", "baseAtk", "baseDef",
  "hpGrowthBps", "atkGrowthBps", "defGrowthBps", "skillKey",
  "portraitAsset", "sortOrder", "enabled", "createdAt", "updatedAt"
) VALUES
  ('hero-def-knight', 'KNIGHT', 'TANK', 1500, 110, 170, 11100, 10700, 11000, 'SHIELD_WALL', '/assets/heroes/knight.webp', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hero-def-ranger', 'RANGER', 'SINGLE_TARGET_DPS', 1050, 170, 90, 10800, 11100, 10700, 'POWER_SHOT', '/assets/heroes/ranger.webp', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hero-def-mage', 'MAGE', 'AOE_BURST', 850, 210, 70, 10700, 11300, 10600, 'ARCANE_BLAST', '/assets/heroes/mage.webp', 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "PlayerHero" ("id", "playerId", "heroDefinitionId", "level", "xp", "createdAt", "updatedAt")
SELECT p."id" || ':' || d."key"::text, p."id", d."id", 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Player" p CROSS JOIN "HeroDefinition" d
ON CONFLICT ("playerId", "heroDefinitionId") DO NOTHING;

INSERT INTO "RaidTeam" ("id", "playerId", "createdAt", "updatedAt")
SELECT p."id" || ':raid', p."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Player" p
ON CONFLICT ("playerId") DO NOTHING;

INSERT INTO "RaidTeamSlot" ("id", "raidTeamId", "playerHeroId", "slot")
SELECT rt."id" || ':' || d."sortOrder", rt."id", ph."id", d."sortOrder"
FROM "RaidTeam" rt
JOIN "PlayerHero" ph ON ph."playerId" = rt."playerId"
JOIN "HeroDefinition" d ON d."id" = ph."heroDefinitionId"
WHERE d."key" IN ('KNIGHT', 'RANGER', 'MAGE')
ON CONFLICT DO NOTHING;

ALTER TYPE "EconomyTransactionReason" ADD VALUE 'RAID_LOSS';
ALTER TYPE "EconomyAction" ADD VALUE 'RAID_START';

CREATE TYPE "BattleType" AS ENUM ('RAID');
CREATE TYPE "BattleStatus" AS ENUM ('CREATED', 'RESOLVED', 'REWARDED');
CREATE TYPE "BattleSide" AS ENUM ('ATTACKER', 'DEFENDER');
CREATE TYPE "BattleResult" AS ENUM ('ATTACKER_WIN', 'DEFENDER_WIN');
CREATE TYPE "BattleEventType" AS ENUM ('BATTLE_START', 'BASIC_ATTACK', 'SKILL_CAST', 'DAMAGE', 'BUFF_APPLIED', 'BUFF_EXPIRED', 'HERO_DEFEATED', 'BATTLE_END');

ALTER TABLE "Player"
  ADD COLUMN "trophies" INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN "isDevelopmentOpponent" BOOLEAN NOT NULL DEFAULT false,
  ADD CONSTRAINT "Player_nonnegative_trophies" CHECK ("trophies" >= 0);

CREATE TABLE "RaidMatchOffer" (
  "id" TEXT NOT NULL, "attackerPlayerId" TEXT NOT NULL, "defenderPlayerId" TEXT NOT NULL,
  "attackerPower" INTEGER NOT NULL, "defenderPower" INTEGER NOT NULL, "potentialLoot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3),
  CONSTRAINT "RaidMatchOffer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RaidMatchOffer_not_self" CHECK ("attackerPlayerId" <> "defenderPlayerId"),
  CONSTRAINT "RaidMatchOffer_positive_power" CHECK ("attackerPower" > 0 AND "defenderPower" > 0)
);

CREATE TABLE "Battle" (
  "id" TEXT NOT NULL, "matchOfferId" TEXT NOT NULL, "type" "BattleType" NOT NULL DEFAULT 'RAID',
  "status" "BattleStatus" NOT NULL DEFAULT 'CREATED', "attackerPlayerId" TEXT NOT NULL,
  "defenderPlayerId" TEXT NOT NULL, "winnerPlayerId" TEXT NOT NULL, "result" "BattleResult" NOT NULL,
  "seed" TEXT NOT NULL, "rulesVersion" INTEGER NOT NULL, "durationMs" INTEGER NOT NULL,
  "attackerTrophyBefore" INTEGER NOT NULL, "defenderTrophyBefore" INTEGER NOT NULL,
  "attackerTrophyDelta" INTEGER NOT NULL, "defenderTrophyDelta" INTEGER NOT NULL, "loot" JSONB NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL, "resolvedAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Battle_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Battle_not_self" CHECK ("attackerPlayerId" <> "defenderPlayerId"),
  CONSTRAINT "Battle_valid_rules" CHECK ("rulesVersion" > 0),
  CONSTRAINT "Battle_valid_duration" CHECK ("durationMs" BETWEEN 8000 AND 15000)
);

CREATE TABLE "BattleHeroSnapshot" (
  "id" TEXT NOT NULL, "battleId" TEXT NOT NULL, "side" "BattleSide" NOT NULL, "slot" INTEGER NOT NULL,
  "heroKey" "HeroKey" NOT NULL, "level" INTEGER NOT NULL, "hp" INTEGER NOT NULL, "atk" INTEGER NOT NULL,
  "def" INTEGER NOT NULL, "power" INTEGER NOT NULL, "skillKey" TEXT NOT NULL,
  CONSTRAINT "BattleHeroSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BattleHeroSnapshot_valid_slot" CHECK ("slot" BETWEEN 1 AND 3),
  CONSTRAINT "BattleHeroSnapshot_valid_stats" CHECK ("level" > 0 AND "hp" > 0 AND "atk" > 0 AND "def" > 0 AND "power" > 0)
);

CREATE TABLE "BattleEvent" (
  "id" TEXT NOT NULL, "battleId" TEXT NOT NULL, "sequence" INTEGER NOT NULL, "timeMs" INTEGER NOT NULL,
  "type" "BattleEventType" NOT NULL, "sourceSide" "BattleSide", "sourceSlot" INTEGER,
  "targetSide" "BattleSide", "targetSlot" INTEGER, "amount" INTEGER, "remainingHp" INTEGER, "skillKey" TEXT,
  CONSTRAINT "BattleEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BattleEvent_nonnegative_time" CHECK ("sequence" >= 0 AND "timeMs" >= 0),
  CONSTRAINT "BattleEvent_nonnegative_hp" CHECK ("remainingHp" IS NULL OR "remainingHp" >= 0)
);

CREATE UNIQUE INDEX "Battle_matchOfferId_key" ON "Battle"("matchOfferId");
CREATE INDEX "RaidMatchOffer_attackerPlayerId_createdAt_idx" ON "RaidMatchOffer"("attackerPlayerId", "createdAt");
CREATE INDEX "RaidMatchOffer_defenderPlayerId_createdAt_idx" ON "RaidMatchOffer"("defenderPlayerId", "createdAt");
CREATE INDEX "RaidMatchOffer_expiresAt_idx" ON "RaidMatchOffer"("expiresAt");
CREATE INDEX "Battle_attackerPlayerId_createdAt_idx" ON "Battle"("attackerPlayerId", "createdAt");
CREATE INDEX "Battle_defenderPlayerId_createdAt_idx" ON "Battle"("defenderPlayerId", "createdAt");
CREATE INDEX "Battle_winnerPlayerId_createdAt_idx" ON "Battle"("winnerPlayerId", "createdAt");
CREATE UNIQUE INDEX "BattleHeroSnapshot_battleId_side_slot_key" ON "BattleHeroSnapshot"("battleId", "side", "slot");
CREATE INDEX "BattleHeroSnapshot_battleId_side_idx" ON "BattleHeroSnapshot"("battleId", "side");
CREATE UNIQUE INDEX "BattleEvent_battleId_sequence_key" ON "BattleEvent"("battleId", "sequence");
CREATE INDEX "BattleEvent_battleId_timeMs_idx" ON "BattleEvent"("battleId", "timeMs");

ALTER TABLE "RaidMatchOffer" ADD CONSTRAINT "RaidMatchOffer_attackerPlayerId_fkey" FOREIGN KEY ("attackerPlayerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaidMatchOffer" ADD CONSTRAINT "RaidMatchOffer_defenderPlayerId_fkey" FOREIGN KEY ("defenderPlayerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_matchOfferId_fkey" FOREIGN KEY ("matchOfferId") REFERENCES "RaidMatchOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_attackerPlayerId_fkey" FOREIGN KEY ("attackerPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_defenderPlayerId_fkey" FOREIGN KEY ("defenderPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_winnerPlayerId_fkey" FOREIGN KEY ("winnerPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BattleHeroSnapshot" ADD CONSTRAINT "BattleHeroSnapshot_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BattleEvent" ADD CONSTRAINT "BattleEvent_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

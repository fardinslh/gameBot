ALTER TYPE "EconomyTransactionReason" ADD VALUE 'MISSION_REWARD';
ALTER TYPE "EconomyTransactionReason" ADD VALUE 'WEEKLY_MISSION_REWARD';
ALTER TYPE "EconomyTransactionReason" ADD VALUE 'ACHIEVEMENT_REWARD';
ALTER TYPE "EconomyTransactionReason" ADD VALUE 'DAILY_RETURN_REWARD';
ALTER TYPE "EconomyTransactionReason" ADD VALUE 'DAILY_COMPLETION_REWARD';

ALTER TYPE "EconomyAction" ADD VALUE 'MISSION_CLAIM';
ALTER TYPE "EconomyAction" ADD VALUE 'DAILY_BONUS_CLAIM';
ALTER TYPE "EconomyAction" ADD VALUE 'ACHIEVEMENT_CLAIM';
ALTER TYPE "EconomyAction" ADD VALUE 'DAILY_RETURN_CLAIM';

CREATE TYPE "RetentionCadence" AS ENUM ('DAILY', 'WEEKLY');

CREATE TABLE "RetentionMissionInstance" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "cadence" "RetentionCadence" NOT NULL,
  "periodKey" TEXT NOT NULL,
  "definitionKey" TEXT NOT NULL,
  "target" BIGINT NOT NULL,
  "rewards" JSONB NOT NULL,
  "claimedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetentionMissionInstance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RetentionMissionInstance_target_check" CHECK ("target" > 0)
);

CREATE TABLE "RetentionDailyBonusClaim" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "rewards" JSONB NOT NULL,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetentionDailyBonusClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RetentionAchievementClaim" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "achievementKey" TEXT NOT NULL,
  "tier" INTEGER NOT NULL,
  "target" BIGINT NOT NULL,
  "rewards" JSONB NOT NULL,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetentionAchievementClaim_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RetentionAchievementClaim_tier_check" CHECK ("tier" > 0),
  CONSTRAINT "RetentionAchievementClaim_target_check" CHECK ("target" > 0)
);

CREATE TABLE "DailyReturnClaim" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "dayIndex" INTEGER NOT NULL,
  "rewards" JSONB NOT NULL,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyReturnClaim_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DailyReturnClaim_day_check" CHECK ("dayIndex" BETWEEN 1 AND 7)
);

CREATE UNIQUE INDEX "RetentionMissionInstance_playerId_cadence_periodKey_definitionKey_key" ON "RetentionMissionInstance"("playerId", "cadence", "periodKey", "definitionKey");
CREATE INDEX "RetentionMissionInstance_playerId_cadence_periodKey_idx" ON "RetentionMissionInstance"("playerId", "cadence", "periodKey");
CREATE UNIQUE INDEX "RetentionDailyBonusClaim_playerId_periodKey_key" ON "RetentionDailyBonusClaim"("playerId", "periodKey");
CREATE INDEX "RetentionDailyBonusClaim_claimedAt_idx" ON "RetentionDailyBonusClaim"("claimedAt");
CREATE UNIQUE INDEX "RetentionAchievementClaim_playerId_achievementKey_tier_key" ON "RetentionAchievementClaim"("playerId", "achievementKey", "tier");
CREATE INDEX "RetentionAchievementClaim_playerId_achievementKey_idx" ON "RetentionAchievementClaim"("playerId", "achievementKey");
CREATE UNIQUE INDEX "DailyReturnClaim_playerId_periodKey_key" ON "DailyReturnClaim"("playerId", "periodKey");
CREATE INDEX "DailyReturnClaim_playerId_claimedAt_idx" ON "DailyReturnClaim"("playerId", "claimedAt");

ALTER TABLE "RetentionMissionInstance" ADD CONSTRAINT "RetentionMissionInstance_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetentionDailyBonusClaim" ADD CONSTRAINT "RetentionDailyBonusClaim_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetentionAchievementClaim" ADD CONSTRAINT "RetentionAchievementClaim_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyReturnClaim" ADD CONSTRAINT "DailyReturnClaim_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

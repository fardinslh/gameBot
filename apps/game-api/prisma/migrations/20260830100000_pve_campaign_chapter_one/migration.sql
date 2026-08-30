-- Retention 04: authoritative PvE Campaign Chapter One.
CREATE TYPE "SystemOpponentKind" AS ENUM ('RAID', 'CAMPAIGN');

ALTER TYPE "BattleType" ADD VALUE 'CAMPAIGN';
ALTER TYPE "EconomyTransactionReason" ADD VALUE 'CAMPAIGN_REWARD';
ALTER TYPE "EconomyTransactionReason" ADD VALUE 'CAMPAIGN_STAR_REWARD';
ALTER TYPE "EconomyAction" ADD VALUE 'CAMPAIGN_START';
ALTER TYPE "EconomyAction" ADD VALUE 'CAMPAIGN_STAR_REWARD';

ALTER TABLE "Player" ADD COLUMN "systemOpponentKind" "SystemOpponentKind";
UPDATE "Player" SET "systemOpponentKind" = 'RAID' WHERE "isSystemOpponent" = true;

ALTER TABLE "Battle" ADD COLUMN "campaignStageKey" TEXT;
CREATE INDEX "Battle_attackerPlayerId_campaignStageKey_createdAt_idx"
  ON "Battle"("attackerPlayerId", "campaignStageKey", "createdAt");

CREATE TABLE "PlayerCampaignStage" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "stageKey" TEXT NOT NULL,
  "bestStars" INTEGER NOT NULL DEFAULT 0,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "firstClearedAt" TIMESTAMP(3),
  "lastPlayedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlayerCampaignStage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlayerCampaignStage_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlayerCampaignStage_bestStars_check" CHECK ("bestStars" BETWEEN 0 AND 3),
  CONSTRAINT "PlayerCampaignStage_attempts_check" CHECK ("attempts" >= 0)
);
CREATE UNIQUE INDEX "PlayerCampaignStage_playerId_stageKey_key" ON "PlayerCampaignStage"("playerId", "stageKey");
CREATE INDEX "PlayerCampaignStage_playerId_lastPlayedAt_idx" ON "PlayerCampaignStage"("playerId", "lastPlayedAt");

CREATE TABLE "CampaignRewardClaim" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "chapterKey" TEXT NOT NULL,
  "milestoneStars" INTEGER NOT NULL,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignRewardClaim_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CampaignRewardClaim_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CampaignRewardClaim_milestoneStars_check" CHECK ("milestoneStars" IN (9, 18, 27))
);
CREATE UNIQUE INDEX "CampaignRewardClaim_playerId_chapterKey_milestoneStars_key"
  ON "CampaignRewardClaim"("playerId", "chapterKey", "milestoneStars");
CREATE INDEX "CampaignRewardClaim_playerId_claimedAt_idx" ON "CampaignRewardClaim"("playerId", "claimedAt");

-- AlterEnum
ALTER TYPE "EconomyTransactionReason" ADD VALUE 'ROYAL_DECREE_REWARD';

-- AlterEnum
ALTER TYPE "EconomyAction" ADD VALUE 'ENGAGEMENT_SESSION';
ALTER TYPE "EconomyAction" ADD VALUE 'ROYAL_DECREE_CLAIM';

-- CreateTable
CREATE TABLE "PlayerEngagementState" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "royalDecreeClaimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerEngagementState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerEngagementState_playerId_key" ON "PlayerEngagementState"("playerId");
CREATE INDEX "PlayerEngagementState_lastSeenAt_idx" ON "PlayerEngagementState"("lastSeenAt");

ALTER TABLE "PlayerEngagementState" ADD CONSTRAINT "PlayerEngagementState_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

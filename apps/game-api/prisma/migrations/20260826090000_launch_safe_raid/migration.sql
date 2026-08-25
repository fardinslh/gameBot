ALTER TABLE "Player"
RENAME COLUMN "isDevelopmentOpponent" TO "isSystemOpponent";

ALTER TYPE "EconomyTransactionReason"
ADD VALUE IF NOT EXISTS 'SYSTEM_OPPONENT_REPLENISH';

CREATE INDEX "Player_isSystemOpponent_trophies_createdAt_idx"
ON "Player"("isSystemOpponent", "trophies", "createdAt");

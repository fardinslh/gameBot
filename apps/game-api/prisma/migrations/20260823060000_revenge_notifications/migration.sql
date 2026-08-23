ALTER TYPE "EconomyAction" ADD VALUE 'REVENGE_START';
ALTER TYPE "BattleType" ADD VALUE 'REVENGE';

CREATE TYPE "RevengeStatus" AS ENUM ('AVAILABLE', 'USED', 'EXPIRED', 'INVALID');
CREATE TYPE "NotificationType" AS ENUM ('PLAYER_RAIDED', 'REVENGE_AVAILABLE', 'UPGRADE_COMPLETE');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('STORED');

ALTER TABLE "Battle"
  ALTER COLUMN "matchOfferId" DROP NOT NULL,
  ADD COLUMN "revengeTargetId" TEXT;

CREATE TABLE "RevengeTarget" (
  "id" TEXT NOT NULL,
  "sourceBattleId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "targetPlayerId" TEXT NOT NULL,
  "status" "RevengeStatus" NOT NULL DEFAULT 'AVAILABLE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  CONSTRAINT "RevengeTarget_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RevengeTarget_not_self" CHECK ("playerId" <> "targetPlayerId")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "payload" JSONB NOT NULL,
  "deepLinkIntent" JSONB NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  "deliveryStatus" "NotificationDeliveryStatus" NOT NULL DEFAULT 'STORED',
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Battle_revengeTargetId_key" ON "Battle"("revengeTargetId");
CREATE INDEX "Battle_type_createdAt_idx" ON "Battle"("type", "createdAt");
CREATE UNIQUE INDEX "RevengeTarget_sourceBattleId_key" ON "RevengeTarget"("sourceBattleId");
CREATE INDEX "RevengeTarget_playerId_status_expiresAt_idx" ON "RevengeTarget"("playerId", "status", "expiresAt");
CREATE INDEX "RevengeTarget_targetPlayerId_createdAt_idx" ON "RevengeTarget"("targetPlayerId", "createdAt");
CREATE UNIQUE INDEX "Notification_sourceKey_key" ON "Notification"("sourceKey");
CREATE INDEX "Notification_playerId_readAt_createdAt_idx" ON "Notification"("playerId", "readAt", "createdAt");
CREATE INDEX "Notification_playerId_type_createdAt_idx" ON "Notification"("playerId", "type", "createdAt");

ALTER TABLE "Battle" ADD CONSTRAINT "Battle_revengeTargetId_fkey" FOREIGN KEY ("revengeTargetId") REFERENCES "RevengeTarget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RevengeTarget" ADD CONSTRAINT "RevengeTarget_sourceBattleId_fkey" FOREIGN KEY ("sourceBattleId") REFERENCES "Battle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RevengeTarget" ADD CONSTRAINT "RevengeTarget_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevengeTarget" ADD CONSTRAINT "RevengeTarget_targetPlayerId_fkey" FOREIGN KEY ("targetPlayerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

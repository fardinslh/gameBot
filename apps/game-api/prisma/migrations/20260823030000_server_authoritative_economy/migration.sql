ALTER TYPE "ResourceType" RENAME VALUE 'COIN' TO 'GOLD';
ALTER TYPE "BuildingType" RENAME VALUE 'QUARRY' TO 'MINE';
ALTER TYPE "BuildingType" ADD VALUE 'GRAND_MARKET';
ALTER TYPE "BuildingType" ADD VALUE 'BLACKSMITH';
ALTER TYPE "BuildingType" ADD VALUE 'ACADEMY';

CREATE TYPE "EconomyTransactionReason" AS ENUM (
  'OFFLINE_PRODUCTION',
  'BUILDING_UPGRADE',
  'ADMIN_OR_SEED',
  'RAID_REWARD',
  'QUEST_REWARD',
  'PURCHASE'
);
CREATE TYPE "EconomyAction" AS ENUM ('COLLECT', 'UPGRADE');

ALTER TABLE "Kingdom"
  ADD COLUMN "lastCollectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Building"
  ADD COLUMN "productionRemainder" BIGINT NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "Building_kingdomId_type_key" ON "Building"("kingdomId", "type");

CREATE TABLE "EconomyTransaction" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "kingdomId" TEXT NOT NULL,
  "balanceId" TEXT NOT NULL,
  "resourceType" "ResourceType" NOT NULL,
  "delta" BIGINT NOT NULL,
  "balanceBefore" BIGINT NOT NULL,
  "balanceAfter" BIGINT NOT NULL,
  "reason" "EconomyTransactionReason" NOT NULL,
  "referenceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EconomyTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EconomyRequest" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "action" "EconomyAction" NOT NULL,
  "response" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EconomyRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EconomyTransaction_playerId_createdAt_idx" ON "EconomyTransaction"("playerId", "createdAt");
CREATE INDEX "EconomyTransaction_referenceId_idx" ON "EconomyTransaction"("referenceId");
CREATE UNIQUE INDEX "EconomyRequest_playerId_idempotencyKey_action_key" ON "EconomyRequest"("playerId", "idempotencyKey", "action");
CREATE INDEX "EconomyRequest_createdAt_idx" ON "EconomyRequest"("createdAt");

-- PostgreSQL enforces at most one active upgrade per building. Prisma cannot
-- express a partial unique index, so it intentionally lives in this migration.
CREATE UNIQUE INDEX "BuildingUpgrade_one_active_per_building"
  ON "BuildingUpgrade"("buildingId")
  WHERE "status" IN ('QUEUED', 'IN_PROGRESS');

ALTER TABLE "EconomyTransaction" ADD CONSTRAINT "EconomyTransaction_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EconomyTransaction" ADD CONSTRAINT "EconomyTransaction_kingdomId_fkey"
  FOREIGN KEY ("kingdomId") REFERENCES "Kingdom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EconomyTransaction" ADD CONSTRAINT "EconomyTransaction_balanceId_fkey"
  FOREIGN KEY ("balanceId") REFERENCES "ResourceBalance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EconomyRequest" ADD CONSTRAINT "EconomyRequest_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

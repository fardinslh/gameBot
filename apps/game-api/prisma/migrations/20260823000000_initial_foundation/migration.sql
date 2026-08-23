CREATE TYPE "Platform" AS ENUM ('BALE', 'TELEGRAM', 'WEB');
CREATE TYPE "ResourceType" AS ENUM ('COIN', 'FOOD', 'WOOD', 'STONE', 'GEMS');
CREATE TYPE "BuildingType" AS ENUM ('CASTLE', 'FARM', 'LUMBER_MILL', 'QUARRY', 'BARRACKS', 'WALL');
CREATE TYPE "UpgradeStatus" AS ENUM ('QUEUED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE "Player" (
  "id" TEXT NOT NULL,
  "displayName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformAccount" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "platform" "Platform" NOT NULL,
  "externalUserId" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Kingdom" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Kingdom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResourceBalance" (
  "id" TEXT NOT NULL,
  "kingdomId" TEXT NOT NULL,
  "resource" "ResourceType" NOT NULL,
  "amount" BIGINT NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResourceBalance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Building" (
  "id" TEXT NOT NULL,
  "kingdomId" TEXT NOT NULL,
  "type" "BuildingType" NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BuildingUpgrade" (
  "id" TEXT NOT NULL,
  "buildingId" TEXT NOT NULL,
  "fromLevel" INTEGER NOT NULL,
  "toLevel" INTEGER NOT NULL,
  "status" "UpgradeStatus" NOT NULL DEFAULT 'QUEUED',
  "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completesAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "BuildingUpgrade_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformAccount_platform_externalUserId_key" ON "PlatformAccount"("platform", "externalUserId");
CREATE INDEX "PlatformAccount_playerId_idx" ON "PlatformAccount"("playerId");
CREATE UNIQUE INDEX "Kingdom_playerId_key" ON "Kingdom"("playerId");
CREATE UNIQUE INDEX "ResourceBalance_kingdomId_resource_key" ON "ResourceBalance"("kingdomId", "resource");
CREATE INDEX "Building_kingdomId_idx" ON "Building"("kingdomId");
CREATE INDEX "BuildingUpgrade_buildingId_status_idx" ON "BuildingUpgrade"("buildingId", "status");

ALTER TABLE "PlatformAccount" ADD CONSTRAINT "PlatformAccount_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Kingdom" ADD CONSTRAINT "Kingdom_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceBalance" ADD CONSTRAINT "ResourceBalance_kingdomId_fkey" FOREIGN KEY ("kingdomId") REFERENCES "Kingdom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Building" ADD CONSTRAINT "Building_kingdomId_fkey" FOREIGN KEY ("kingdomId") REFERENCES "Kingdom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuildingUpgrade" ADD CONSTRAINT "BuildingUpgrade_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

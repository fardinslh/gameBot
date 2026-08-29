-- CreateEnum
CREATE TYPE "TroopType" AS ENUM ('INFANTRY', 'ARCHER', 'CAVALRY');

-- CreateEnum
CREATE TYPE "TroopTrainingStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- AlterEnum
ALTER TYPE "EconomyTransactionReason" ADD VALUE 'TROOP_TRAINING';

-- AlterEnum
ALTER TYPE "EconomyAction" ADD VALUE 'TROOP_TRAINING';

-- CreateTable
CREATE TABLE "PlayerTroop" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "troopType" "TroopType" NOT NULL,
    "readyCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlayerTroop_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PlayerTroop_readyCount_check" CHECK ("readyCount" >= 0)
);

-- CreateTable
CREATE TABLE "TroopTrainingOrder" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "troopType" "TroopType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "TroopTrainingStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "costSnapshot" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completesAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TroopTrainingOrder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TroopTrainingOrder_quantity_check" CHECK ("quantity" > 0),
    CONSTRAINT "TroopTrainingOrder_completion_check" CHECK (
      ("status" = 'IN_PROGRESS' AND "completedAt" IS NULL) OR
      ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "ArmyFormation" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ArmyFormation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArmyFormationSlot" (
    "id" TEXT NOT NULL,
    "armyFormationId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "troopType" "TroopType" NOT NULL,
    "unitCount" INTEGER NOT NULL,
    "commanderPlayerHeroId" TEXT NOT NULL,
    CONSTRAINT "ArmyFormationSlot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ArmyFormationSlot_slot_check" CHECK ("slot" BETWEEN 1 AND 3),
    CONSTRAINT "ArmyFormationSlot_unitCount_check" CHECK ("unitCount" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerTroop_playerId_troopType_key" ON "PlayerTroop"("playerId", "troopType");
CREATE INDEX "PlayerTroop_playerId_idx" ON "PlayerTroop"("playerId");
CREATE INDEX "TroopTrainingOrder_playerId_status_idx" ON "TroopTrainingOrder"("playerId", "status");
CREATE INDEX "TroopTrainingOrder_status_completesAt_idx" ON "TroopTrainingOrder"("status", "completesAt");
CREATE UNIQUE INDEX "TroopTrainingOrder_playerId_active_key" ON "TroopTrainingOrder"("playerId") WHERE "status" = 'IN_PROGRESS';
CREATE UNIQUE INDEX "ArmyFormation_playerId_key" ON "ArmyFormation"("playerId");
CREATE UNIQUE INDEX "ArmyFormationSlot_armyFormationId_slot_key" ON "ArmyFormationSlot"("armyFormationId", "slot");
CREATE UNIQUE INDEX "ArmyFormationSlot_armyFormationId_commanderPlayerHeroId_key" ON "ArmyFormationSlot"("armyFormationId", "commanderPlayerHeroId");
CREATE INDEX "ArmyFormationSlot_commanderPlayerHeroId_idx" ON "ArmyFormationSlot"("commanderPlayerHeroId");

-- AddForeignKey
ALTER TABLE "PlayerTroop" ADD CONSTRAINT "PlayerTroop_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TroopTrainingOrder" ADD CONSTRAINT "TroopTrainingOrder_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArmyFormation" ADD CONSTRAINT "ArmyFormation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArmyFormationSlot" ADD CONSTRAINT "ArmyFormationSlot_armyFormationId_fkey" FOREIGN KEY ("armyFormationId") REFERENCES "ArmyFormation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArmyFormationSlot" ADD CONSTRAINT "ArmyFormationSlot_commanderPlayerHeroId_fkey" FOREIGN KEY ("commanderPlayerHeroId") REFERENCES "PlayerHero"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill starter troops for every existing human and system Player.
INSERT INTO "PlayerTroop" ("id", "playerId", "troopType", "readyCount", "createdAt", "updatedAt")
SELECT gen_random_uuid(), p."id", values."troopType"::"TroopType", values."readyCount", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Player" p
CROSS JOIN (VALUES ('INFANTRY', 20), ('ARCHER', 15), ('CAVALRY', 10)) AS values("troopType", "readyCount")
ON CONFLICT ("playerId", "troopType") DO NOTHING;

-- Backfill one formation and three Commander slots without changing RaidTeam.
INSERT INTO "ArmyFormation" ("id", "playerId", "createdAt", "updatedAt")
SELECT gen_random_uuid(), p."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Player" p
ON CONFLICT ("playerId") DO NOTHING;

INSERT INTO "ArmyFormationSlot" ("id", "armyFormationId", "slot", "troopType", "unitCount", "commanderPlayerHeroId")
SELECT gen_random_uuid(), af."id", mapping."slot", mapping."troopType"::"TroopType", mapping."unitCount", ph."id"
FROM "ArmyFormation" af
JOIN (VALUES
  (1, 'INFANTRY', 20, 'KNIGHT'),
  (2, 'ARCHER', 15, 'RANGER'),
  (3, 'CAVALRY', 10, 'MAGE')
) AS mapping("slot", "troopType", "unitCount", "heroKey") ON TRUE
JOIN "PlayerHero" ph ON ph."playerId" = af."playerId"
JOIN "HeroDefinition" hd ON hd."id" = ph."heroDefinitionId" AND hd."key"::text = mapping."heroKey"
ON CONFLICT ("armyFormationId", "slot") DO NOTHING;

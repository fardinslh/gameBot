ALTER TYPE "BattleEventType" ADD VALUE 'SQUAD_DEFEATED';

ALTER TABLE "BattleEvent" ADD COLUMN "remainingUnits" INTEGER;

CREATE TABLE "BattleArmySquadSnapshot" (
  "id" TEXT NOT NULL,
  "battleId" TEXT NOT NULL,
  "side" "BattleSide" NOT NULL,
  "slot" INTEGER NOT NULL,
  "troopType" "TroopType" NOT NULL,
  "initialUnitCount" INTEGER NOT NULL,
  "perUnitHp" INTEGER NOT NULL,
  "perUnitAtk" INTEGER NOT NULL,
  "perUnitDef" INTEGER NOT NULL,
  "aggregateMaxHp" INTEGER NOT NULL,
  "commanderKey" "HeroKey" NOT NULL,
  "commanderLevel" INTEGER NOT NULL,
  "commanderSkillKey" TEXT NOT NULL,
  "commanderPower" INTEGER NOT NULL,
  "commanderPortraitAsset" TEXT NOT NULL,
  "squadPower" INTEGER NOT NULL,
  CONSTRAINT "BattleArmySquadSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BattleArmySquadSnapshot_battleId_side_slot_key"
  ON "BattleArmySquadSnapshot"("battleId", "side", "slot");
CREATE INDEX "BattleArmySquadSnapshot_battleId_side_idx"
  ON "BattleArmySquadSnapshot"("battleId", "side");

ALTER TABLE "BattleArmySquadSnapshot"
  ADD CONSTRAINT "BattleArmySquadSnapshot_battleId_fkey"
  FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

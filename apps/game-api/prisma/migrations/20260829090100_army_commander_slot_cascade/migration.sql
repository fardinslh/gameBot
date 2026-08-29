ALTER TABLE "ArmyFormationSlot" DROP CONSTRAINT "ArmyFormationSlot_commanderPlayerHeroId_fkey";
ALTER TABLE "ArmyFormationSlot" ADD CONSTRAINT "ArmyFormationSlot_commanderPlayerHeroId_fkey"
  FOREIGN KEY ("commanderPlayerHeroId") REFERENCES "PlayerHero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

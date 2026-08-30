ALTER TABLE "RaidMatchOffer"
ADD COLUMN "attackerArmyFingerprint" TEXT;

ALTER TABLE "RaidMatchOffer"
ADD CONSTRAINT "RaidMatchOffer_attackerArmyFingerprint_check"
CHECK (
  "attackerArmyFingerprint" IS NULL
  OR char_length("attackerArmyFingerprint") = 64
);

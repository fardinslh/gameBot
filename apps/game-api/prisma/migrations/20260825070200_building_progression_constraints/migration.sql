ALTER TABLE "Building"
  ADD CONSTRAINT "Building_level_range" CHECK ("level" BETWEEN 1 AND 20);

ALTER TABLE "BuildingUpgrade"
  ADD CONSTRAINT "BuildingUpgrade_level_step" CHECK (
    "fromLevel" BETWEEN 1 AND 19
    AND "toLevel" BETWEEN 2 AND 20
    AND "toLevel" = "fromLevel" + 1
  );

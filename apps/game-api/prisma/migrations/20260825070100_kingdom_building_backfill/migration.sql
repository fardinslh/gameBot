-- Phase 07 buildings are backfilled at level 1 without altering existing
-- building rows, balances, upgrades, or economy history. Enum values are
-- committed by the preceding migration before they are referenced here.
INSERT INTO "Building" ("id", "kingdomId", "type", "level", "productionRemainder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, k."id", building_type::"BuildingType", 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Kingdom" k
CROSS JOIN unnest(ARRAY['ACADEMY', 'BLACKSMITH', 'WATCHTOWER', 'WORKSHOP']) AS types(building_type)
ON CONFLICT ("kingdomId", "type") DO NOTHING;

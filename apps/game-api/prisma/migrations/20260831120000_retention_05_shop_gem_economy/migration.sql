-- Retention 05: earned-Gem Shop, generic entitlements, and Profile Crest selection.
ALTER TYPE "EconomyTransactionReason" ADD VALUE 'SHOP_GEM_SPEND';
ALTER TYPE "EconomyAction" ADD VALUE 'SHOP_PURCHASE';

CREATE TYPE "ShopCategory" AS ENUM ('CONVENIENCE', 'COSMETICS');
CREATE TYPE "ShopFulfillmentType" AS ENUM ('PROFILE_CREST', 'BUILDING_FINISH', 'TROOP_TRAINING_FINISH');
CREATE TYPE "EntitlementSource" AS ENUM ('SHOP');
CREATE TYPE "ProfileCrestKey" AS ENUM (
  'DEFAULT',
  'PROFILE_CREST_FOREST',
  'PROFILE_CREST_CRIMSON',
  'PROFILE_CREST_ROYAL'
);

ALTER TABLE "Player"
  ADD COLUMN "equippedProfileCrest" "ProfileCrestKey" NOT NULL DEFAULT 'DEFAULT';

CREATE TABLE "PlayerEntitlement" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "entitlementKey" TEXT NOT NULL,
  "source" "EntitlementSource" NOT NULL,
  "sourceReferenceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlayerEntitlement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlayerEntitlement_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlayerEntitlement_playerId_entitlementKey_key"
  ON "PlayerEntitlement"("playerId", "entitlementKey");
CREATE INDEX "PlayerEntitlement_sourceReferenceId_idx"
  ON "PlayerEntitlement"("sourceReferenceId");

CREATE TABLE "ShopPurchase" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "itemKey" TEXT NOT NULL,
  "category" "ShopCategory" NOT NULL,
  "fulfillmentType" "ShopFulfillmentType" NOT NULL,
  "gemPrice" INTEGER NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShopPurchase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShopPurchase_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ShopPurchase_gemPrice_check" CHECK ("gemPrice" > 0)
);
CREATE INDEX "ShopPurchase_playerId_createdAt_idx" ON "ShopPurchase"("playerId", "createdAt");
CREATE INDEX "ShopPurchase_targetId_idx" ON "ShopPurchase"("targetId");

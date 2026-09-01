-- CreateEnum
CREATE TYPE "KingdomRulerTitle" AS ENUM ('LORD', 'LADY', 'WARDEN');

-- CreateEnum
CREATE TYPE "KingdomHeraldry" AS ENUM ('GOLDEN_LION', 'VERDANT_STAG', 'CRIMSON_FALCON');

-- AlterTable
ALTER TABLE "Kingdom"
ADD COLUMN "rulerTitle" "KingdomRulerTitle" NOT NULL DEFAULT 'LORD',
ADD COLUMN "heraldry" "KingdomHeraldry" NOT NULL DEFAULT 'GOLDEN_LION';

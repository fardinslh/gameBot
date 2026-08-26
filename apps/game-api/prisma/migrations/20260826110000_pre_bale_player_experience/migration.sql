CREATE TYPE "OnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');
CREATE TYPE "OnboardingStep" AS ENUM ('WELCOME', 'COLLECT', 'UPGRADE', 'RAID', 'COMPLETE');

CREATE TABLE "OnboardingProgress" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "currentStep" "OnboardingStep" NOT NULL DEFAULT 'WELCOME',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OnboardingProgress_playerId_key" ON "OnboardingProgress"("playerId");
CREATE INDEX "OnboardingProgress_status_updatedAt_idx" ON "OnboardingProgress"("status", "updatedAt");

ALTER TABLE "OnboardingProgress"
ADD CONSTRAINT "OnboardingProgress_playerId_fkey"
FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

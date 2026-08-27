CREATE TABLE "AdvisorTipProgress" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "tipKey" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdvisorTipProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdvisorTipProgress_playerId_tipKey_key" ON "AdvisorTipProgress"("playerId", "tipKey");
CREATE INDEX "AdvisorTipProgress_playerId_seenAt_idx" ON "AdvisorTipProgress"("playerId", "seenAt");
ALTER TABLE "AdvisorTipProgress" ADD CONSTRAINT "AdvisorTipProgress_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

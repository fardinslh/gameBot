CREATE TYPE "AnalyticsSource" AS ENUM ('SERVER', 'CLIENT');

CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "playerId" TEXT NOT NULL,
    "sessionId" TEXT,
    "source" "AnalyticsSource" NOT NULL,
    "eventName" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "platform" "Platform" NOT NULL,
    "locale" TEXT,
    "appVersion" TEXT,
    "acquisitionSource" TEXT,
    "properties" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientOccurredAt" TIMESTAMP(3),

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalyticsEvent_dedupeKey_key" ON "AnalyticsEvent"("dedupeKey");
CREATE INDEX "AnalyticsEvent_playerId_occurredAt_idx" ON "AnalyticsEvent"("playerId", "occurredAt");
CREATE INDEX "AnalyticsEvent_eventName_occurredAt_idx" ON "AnalyticsEvent"("eventName", "occurredAt");
CREATE INDEX "AnalyticsEvent_playerId_eventName_occurredAt_idx" ON "AnalyticsEvent"("playerId", "eventName", "occurredAt");
CREATE INDEX "AnalyticsEvent_acquisitionSource_occurredAt_idx" ON "AnalyticsEvent"("acquisitionSource", "occurredAt");

ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_playerId_fkey"
FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

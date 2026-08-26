import { Injectable } from '@nestjs/common';
import { AnalyticsSource, Platform, Prisma } from '@prisma/client';
import type { AnalyticsEventsResponse } from '@crown-and-coin/shared';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import type { ClientAnalyticsEventDto } from './analytics.dto';
import { ANALYTICS_SCHEMA_VERSION, MAX_ANALYTICS_PROPERTIES_BYTES } from './analytics.events';
import type { ServerAnalyticsEventName } from './analytics.events';

type AnalyticsTx = Prisma.TransactionClient | PrismaService;

export interface ServerAnalyticsInput {
  playerId: string;
  eventName: ServerAnalyticsEventName;
  dedupeKey: string;
  properties?: Prisma.InputJsonObject;
  occurredAt?: Date;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordServer(tx: AnalyticsTx, input: ServerAnalyticsInput): Promise<void> {
    const player = await tx.player.findUnique({
      where: { id: input.playerId },
      select: { isSystemOpponent: true, platformAccounts: { orderBy: { createdAt: 'asc' }, take: 1, select: { platform: true } } },
    });
    if (!player || player.isSystemOpponent) return;
    await tx.analyticsEvent.createMany({
      data: [{
        playerId: input.playerId,
        source: AnalyticsSource.SERVER,
        eventName: input.eventName,
        dedupeKey: input.dedupeKey,
        schemaVersion: ANALYTICS_SCHEMA_VERSION,
        platform: player.platformAccounts[0]?.platform ?? Platform.WEB,
        properties: input.properties ?? {},
        occurredAt: input.occurredAt,
      }],
      skipDuplicates: true,
    });
  }

  async ingestClient(playerId: string, platform: Platform, events: ClientAnalyticsEventDto[]): Promise<AnalyticsEventsResponse> {
    const response: AnalyticsEventsResponse = { accepted: [], duplicates: [], rejected: [] };
    for (const event of events) {
      const properties = this.sanitizeProperties(event.properties ?? {});
      if (!properties) {
        response.rejected.push({ eventId: event.eventId, reason: 'properties_too_large_or_invalid' });
        continue;
      }
      const result = await this.prisma.analyticsEvent.createMany({
        data: [{
          id: event.eventId,
          dedupeKey: `client:${playerId}:${event.eventId}`,
          playerId,
          sessionId: event.sessionId,
          source: AnalyticsSource.CLIENT,
          eventName: event.eventName,
          schemaVersion: ANALYTICS_SCHEMA_VERSION,
          platform,
          locale: event.locale?.trim() || null,
          appVersion: event.appVersion?.trim() || null,
          acquisitionSource: this.sanitizeSource(event.acquisitionSource),
          properties,
          clientOccurredAt: event.clientOccurredAt ? new Date(event.clientOccurredAt) : null,
        }],
        skipDuplicates: true,
      });
      (result.count === 1 ? response.accepted : response.duplicates).push(event.eventId);
    }
    return response;
  }

  private sanitizeSource(value?: string): string | null {
    const normalized = value?.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_').slice(0, 100);
    return normalized || null;
  }

  private sanitizeProperties(value: Record<string, unknown>): Prisma.InputJsonObject | null {
    let json: string;
    try { json = JSON.stringify(value); } catch { return null; }
    if (Buffer.byteLength(json, 'utf8') > MAX_ANALYTICS_PROPERTIES_BYTES) return null;
    const parsed = JSON.parse(json) as Record<string, unknown>;
    for (const [key, item] of Object.entries(parsed)) {
      if (key.length > 64 || (typeof item === 'string' && item.length > 200)) return null;
    }
    return parsed as Prisma.InputJsonObject;
  }
}

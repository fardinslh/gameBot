import { Injectable } from '@nestjs/common';
import type { NotificationType, Prisma } from '@prisma/client';
import type { DeepLinkIntent, NotificationState } from '@crown-and-coin/shared';
import { PrismaService } from '../infrastructure/prisma/prisma.service';

type Tx = Prisma.TransactionClient;

interface CreateNotificationInput {
  playerId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  deepLinkIntent: DeepLinkIntent;
  sourceKey: string;
}

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(tx: Tx, input: CreateNotificationInput): Promise<void> {
    await tx.notification.upsert({
      where: { sourceKey: input.sourceKey },
      create: {
        playerId: input.playerId,
        type: input.type,
        payload: input.payload as Prisma.InputJsonValue,
        deepLinkIntent: input.deepLinkIntent as unknown as Prisma.InputJsonValue,
        sourceKey: input.sourceKey,
      },
      update: {},
    });
  }

  async listNotifications(playerId: string): Promise<NotificationState[]> {
    const rows = await this.prisma.notification.findMany({
      where: { playerId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      payload: row.payload as Record<string, unknown>,
      deepLinkIntent: row.deepLinkIntent as unknown as DeepLinkIntent,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
    }));
  }

  async markRead(playerId: string, notificationIds?: string[]): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: {
        playerId,
        readAt: null,
        ...(notificationIds ? { id: { in: notificationIds } } : {}),
      },
      data: { readAt: new Date() },
    });
    return result.count;
  }

  async markIncomingRead(playerId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { playerId, readAt: null, type: { in: ['PLAYER_RAIDED', 'REVENGE_AVAILABLE'] } },
      data: { readAt: new Date() },
    });
    return result.count;
  }
}

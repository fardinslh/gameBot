import { Injectable } from '@nestjs/common';
import type { HealthResponse } from '@crown-and-coin/shared';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { RedisService } from '../infrastructure/redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthResponse> {
    await this.prisma.$queryRaw`SELECT 1`;
    if (!this.redis.disabled) await this.redis.client.ping();
    return { status: 'ok' };
  }
}

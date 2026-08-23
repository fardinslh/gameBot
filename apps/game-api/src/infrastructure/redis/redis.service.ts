import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  readonly client: Redis;
  readonly disabled: boolean;

  constructor(config: ConfigService) {
    const redisUrl = config.get<string>('REDIS_URL');
    this.disabled = config.get<string>('SKIP_REDIS_FOR_DEVELOPMENT') === 'true';

    if (!redisUrl && !this.disabled) {
      throw new Error('REDIS_URL is required');
    }

    this.client = new Redis(redisUrl ?? 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      retryStrategy: (attempt) => (attempt > 3 ? null : Math.min(attempt * 200, 1_000)),
    });
  }

  async onModuleInit(): Promise<void> {
    if (this.disabled) return;
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
    await this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.disabled) {
      this.client.disconnect();
      return;
    }
    if (this.client.status === 'ready') {
      await this.client.quit();
      return;
    }
    this.client.disconnect();
  }
}

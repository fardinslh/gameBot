import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RedisService } from '../redis/redis.service';

export const GAME_JOBS_QUEUE = 'game-jobs';

@Injectable()
export class JobsService implements OnModuleDestroy {
  readonly queue: Queue;

  constructor(redis: RedisService) {
    this.queue = new Queue(GAME_JOBS_QUEUE, { connection: redis.client });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}

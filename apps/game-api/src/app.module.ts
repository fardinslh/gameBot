import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EconomyModule } from './economy/economy.module';
import { HealthModule } from './health/health.module';
import { JobsModule } from './infrastructure/jobs/jobs.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { KingdomModule } from './kingdom/kingdom.module';
import { PlatformModule } from './platform/platform.module';
import { PlayerModule } from './player/player.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    RedisModule,
    JobsModule,
    HealthModule,
    PlayerModule,
    PlatformModule,
    KingdomModule,
    EconomyModule,
  ],
})
export class AppModule {}

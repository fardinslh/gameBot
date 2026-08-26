import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EconomyModule } from './economy/economy.module';
import { HealthModule } from './health/health.module';
import { HeroModule } from './heroes/hero.module';
import { JobsModule } from './infrastructure/jobs/jobs.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { KingdomModule } from './kingdom/kingdom.module';
import { NotificationModule } from './notifications/notification.module';
import { PlatformModule } from './platform/platform.module';
import { PlayerModule } from './player/player.module';
import { RaidModule } from './raid/raid.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { OnboardingModule } from './onboarding/onboarding.module';

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
    HeroModule,
    PlayerModule,
    PlatformModule,
    KingdomModule,
    EconomyModule,
    NotificationModule,
    RaidModule,
    AnalyticsModule,
    OnboardingModule,
  ],
})
export class AppModule {}

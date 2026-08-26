import { forwardRef, Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { PlayerModule } from '../player/player.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsRateLimiter } from './analytics-rate-limiter.service';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [forwardRef(() => EconomyModule), PlayerModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsRateLimiter],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}

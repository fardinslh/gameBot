import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { EconomyModule } from '../economy/economy.module';
import { PlayerModule } from '../player/player.module';
import { RetentionController } from './retention.controller';
import { RetentionMetricsService } from './retention-metrics.service';
import { RetentionService } from './retention.service';
import { RetentionClock } from './retention-clock.service';

@Module({
  imports: [EconomyModule, AnalyticsModule, PlayerModule],
  controllers: [RetentionController],
  providers: [RetentionService, RetentionMetricsService, RetentionClock],
  exports: [RetentionService],
})
export class RetentionModule {}

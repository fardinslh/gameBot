import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { EconomyModule } from '../economy/economy.module';
import { PlayerModule } from '../player/player.module';
import { RetentionController } from './retention.controller';
import { RetentionMetricsService } from './retention-metrics.service';
import { RetentionService } from './retention.service';
import { RetentionClock } from './retention-clock.service';
import { ArmyModule } from '../army/army.module';
import { EngagementController } from './engagement.controller';
import { EngagementService } from './engagement.service';

@Module({
  imports: [EconomyModule, AnalyticsModule, PlayerModule, ArmyModule],
  controllers: [RetentionController, EngagementController],
  providers: [RetentionService, RetentionMetricsService, RetentionClock, EngagementService],
  exports: [RetentionService, EngagementService],
})
export class RetentionModule {}

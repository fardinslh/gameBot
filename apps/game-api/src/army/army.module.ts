import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { EconomyModule } from '../economy/economy.module';
import { PlayerModule } from '../player/player.module';
import { ArmyClock } from './army.clock';
import { ArmyController } from './army.controller';
import { ArmyService } from './army.service';

@Module({
  imports: [EconomyModule, PlayerModule, AnalyticsModule],
  controllers: [ArmyController],
  providers: [ArmyService, ArmyClock],
  exports: [ArmyService],
})
export class ArmyModule {}

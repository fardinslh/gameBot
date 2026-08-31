import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ArmyModule } from '../army/army.module';
import { EconomyModule } from '../economy/economy.module';
import { PlayerModule } from '../player/player.module';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';

@Module({
  imports: [AnalyticsModule, ArmyModule, EconomyModule, PlayerModule],
  controllers: [ShopController],
  providers: [ShopService],
  exports: [ShopService],
})
export class ShopModule {}

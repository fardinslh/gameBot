import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { EconomyModule } from '../economy/economy.module';
import { PlayerModule } from '../player/player.module';
import { HeroController } from './hero.controller';
import { HeroService } from './hero.service';

@Module({
  imports: [EconomyModule, PlayerModule, AnalyticsModule],
  controllers: [HeroController],
  providers: [HeroService],
  exports: [HeroService],
})
export class HeroModule {}

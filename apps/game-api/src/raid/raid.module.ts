import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { PlayerModule } from '../player/player.module';
import { NotificationModule } from '../notifications/notification.module';
import { RaidController } from './raid.controller';
import { RaidFixtureService } from './raid-fixture.service';
import { RaidRateLimiter } from './raid-rate-limiter.service';
import { RaidService } from './raid.service';

@Module({
  imports: [EconomyModule, NotificationModule, PlayerModule],
  controllers: [RaidController],
  providers: [RaidService, RaidFixtureService, RaidRateLimiter],
  exports: [RaidService],
})
export class RaidModule {}

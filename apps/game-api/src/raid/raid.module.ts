import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { EconomyModule } from '../economy/economy.module';
import { PlayerModule } from '../player/player.module';
import { NotificationModule } from '../notifications/notification.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { ArmyModule } from '../army/army.module';
import { RaidController } from './raid.controller';
import { RaidCandidateSelector } from './raid.matchmaking';
import { RaidRateLimiter } from './raid-rate-limiter.service';
import { RaidService } from './raid.service';
import { SystemOpponentService } from './system-opponent.service';

@Module({
  imports: [EconomyModule, NotificationModule, PlayerModule, AnalyticsModule, OnboardingModule, ArmyModule],
  controllers: [RaidController],
  providers: [RaidService, SystemOpponentService, RaidCandidateSelector, RaidRateLimiter],
  exports: [RaidService],
})
export class RaidModule {}

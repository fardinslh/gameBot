import { forwardRef, Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { EconomyModule } from '../economy/economy.module';
import { PlayerModule } from '../player/player.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { AdvisorTipsService } from './advisor-tips.service';

@Module({
  imports: [AnalyticsModule, PlayerModule, forwardRef(() => EconomyModule)],
  controllers: [OnboardingController],
  providers: [OnboardingService, AdvisorTipsService],
  exports: [OnboardingService],
})
export class OnboardingModule {}

import { forwardRef, Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { NotificationModule } from '../notifications/notification.module';
import { KingdomLevelService } from '../kingdom/kingdom-level.service';
import { KingdomExpansionService } from '../kingdom/kingdom-expansion.service';
import { KingdomProgressGoalsService } from '../kingdom/kingdom-progress-goals.service';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { EconomyService } from './economy.service';

@Module({ imports: [NotificationModule, forwardRef(() => AnalyticsModule), forwardRef(() => OnboardingModule)], providers: [EconomyService, KingdomLevelService, KingdomExpansionService, KingdomProgressGoalsService], exports: [EconomyService] })
export class EconomyModule {}

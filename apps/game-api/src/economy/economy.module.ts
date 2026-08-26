import { forwardRef, Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { NotificationModule } from '../notifications/notification.module';
import { KingdomLevelService } from '../kingdom/kingdom-level.service';
import { KingdomExpansionService } from '../kingdom/kingdom-expansion.service';
import { EconomyService } from './economy.service';

@Module({ imports: [NotificationModule, forwardRef(() => AnalyticsModule)], providers: [EconomyService, KingdomLevelService, KingdomExpansionService], exports: [EconomyService] })
export class EconomyModule {}

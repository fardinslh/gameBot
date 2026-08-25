import { Module } from '@nestjs/common';
import { NotificationModule } from '../notifications/notification.module';
import { KingdomLevelService } from '../kingdom/kingdom-level.service';
import { EconomyService } from './economy.service';

@Module({ imports: [NotificationModule], providers: [EconomyService, KingdomLevelService], exports: [EconomyService] })
export class EconomyModule {}

import { Module } from '@nestjs/common';
import { NotificationModule } from '../notifications/notification.module';
import { EconomyService } from './economy.service';

@Module({ imports: [NotificationModule], providers: [EconomyService], exports: [EconomyService] })
export class EconomyModule {}

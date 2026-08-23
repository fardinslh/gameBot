import { Module } from '@nestjs/common';
import { KingdomService } from './kingdom.service';

@Module({ providers: [KingdomService], exports: [KingdomService] })
export class KingdomModule {}

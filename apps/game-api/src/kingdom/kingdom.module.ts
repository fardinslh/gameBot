import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { PlayerModule } from '../player/player.module';
import { KingdomController } from './kingdom.controller';
import { KingdomService } from './kingdom.service';

@Module({
  imports: [EconomyModule, PlayerModule],
  controllers: [KingdomController],
  providers: [KingdomService],
  exports: [KingdomService],
})
export class KingdomModule {}

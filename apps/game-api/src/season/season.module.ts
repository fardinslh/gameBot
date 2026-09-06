import { Module } from '@nestjs/common';
import { PlayerModule } from '../player/player.module';
import { SeasonController } from './season.controller';
import { SeasonService } from './season.service';

@Module({
  imports: [PlayerModule],
  controllers: [SeasonController],
  providers: [SeasonService],
  exports: [SeasonService],
})
export class SeasonModule {}

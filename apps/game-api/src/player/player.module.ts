import { Module } from '@nestjs/common';
import { PlayerService } from './player.service';
import { PlayerContextService } from './player-context.service';

@Module({
  providers: [PlayerService, PlayerContextService],
  exports: [PlayerService, PlayerContextService],
})
export class PlayerModule {}

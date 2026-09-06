import { Module } from '@nestjs/common';
import { PlayerModule } from '../player/player.module';
import { GuildController } from './guild.controller';
import { GuildService } from './guild.service';

@Module({
  imports: [PlayerModule],
  controllers: [GuildController],
  providers: [GuildService],
  exports: [GuildService],
})
export class GuildModule {}

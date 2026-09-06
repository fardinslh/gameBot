import { Module } from '@nestjs/common';
import { PlayerModule } from '../player/player.module';
import { GuildController } from './guild.controller';
import { GuildService } from './guild.service';
import { GuildWarController } from './guild-war.controller';
import { GuildWarService } from './guild-war.service';

@Module({
  imports: [PlayerModule],
  controllers: [GuildWarController, GuildController],
  providers: [GuildService, GuildWarService],
  exports: [GuildService, GuildWarService],
})
export class GuildModule {}

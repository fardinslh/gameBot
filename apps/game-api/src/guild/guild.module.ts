import { Module } from '@nestjs/common';
import { PlayerModule } from '../player/player.module';
import { GuildController } from './guild.controller';
import { GuildService } from './guild.service';
import { GuildWarController } from './guild-war.controller';
import { GuildWarService } from './guild-war.service';

import { GuildTreasuryController } from './guild-treasury.controller';
import { GuildTreasuryService } from './guild-treasury.service';
import { GuildChatController } from './guild-chat.controller';
import { GuildChatService } from './guild-chat.service';

@Module({
  imports: [PlayerModule],
  controllers: [GuildWarController, GuildController, GuildTreasuryController, GuildChatController],
  providers: [GuildService, GuildWarService, GuildTreasuryService, GuildChatService],
  exports: [GuildService, GuildWarService, GuildTreasuryService, GuildChatService],
})
export class GuildModule {}
